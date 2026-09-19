// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// d15 — Atalho/Chatbot de WhatsApp (FASE 1: clique-para-conversar, sem backend).
// Botão flutuante na landing e no app, com atalhos por tópico (Planos / Produtos / Suporte /
// Outro) que abrem o WhatsApp com a conversa já contextualizada (link wa.me). Número configurável
// em config.js (WHATSAPP_NUMERO); vazio = botão OCULTO. LGPD: ação do usuário (opt-in), sem PII na
// URL e sem cookies — só o assunto + a origem (site/app) para atribuição. A FASE 2 (bot
// automatizado via WhatsApp Business Cloud API + Edge Function, com IA ancorada) é descrita em
// docs/WHATSAPP.md e NÃO expõe segredo no front.
const ZAP = {
  numero() { return String((window.CB_CONFIG && window.CB_CONFIG.WHATSAPP_NUMERO) || "").replace(/\D/g, ""); },
  ativo() { return this.numero().length >= 10; },   // DDI+DDD+número
  TOPICOS: [
    { id: "planos", label: "Dúvidas sobre planos", icone: "ti-rosette", msg: "Olá! Tenho dúvidas sobre os planos do Civilbook." },
    { id: "produtos", label: "Conhecer os recursos", icone: "ti-apps", msg: "Olá! Quero saber mais sobre os recursos do Civilbook." },
    { id: "suporte", label: "Preciso de suporte", icone: "ti-lifebuoy", msg: "Olá! Preciso de ajuda no Civilbook." },
    { id: "outro", label: "Outro assunto", icone: "ti-message-2", msg: "Olá! Vim pelo site do Civilbook." }
  ],
  _origem() { try { return /app\.html|\/app(\b|$)/.test(location.pathname) ? "app" : "site"; } catch (e) { return "site"; } },
  link(msg) { return "https://wa.me/" + this.numero() + "?text=" + encodeURIComponent(msg + " (via " + this._origem() + ")"); },
  abrirTopico(id) {
    const t = this.TOPICOS.find(x => x.id === id) || this.TOPICOS[this.TOPICOS.length - 1];
    window.open(this.link(t.msg), "_blank", "noopener,noreferrer");
    if (typeof METRICS !== "undefined" && METRICS.event) { try { METRICS.event("whatsapp", id, this._origem()); } catch (e) {} }
    this.fechar();
  },

  // Modo piloto (19/set/2026): quem abre um link compartilhado (app.html?share=) SEM conta não vê o botão — a decisão do
  // fundador é "sem WhatsApp" para quem não tem convite, e os tópicos daqui ("Dúvidas sobre planos", "Conhecer os
  // recursos") são vitrine. O cbInit do app.html chama desligar(); vale antes OU depois de o botão montar (o
  // DOMContentLoaded deste arquivo e o cbInit não têm ordem garantida). Travado em tests/portas-convite.check.mjs.
  _desligado: false,
  desligar() {
    this._desligado = true;
    const w = document.getElementById("cb-zap");
    if (w) w.remove();
  },

  montar() {
    if (!this.ativo()) return;                          // sem número → não exibe
    if (this._desligado) return;                        // desligado pela página (link compartilhado sem conta, no piloto)
    if (document.getElementById("cb-zap")) return;      // idempotente
    const wrap = document.createElement("div");
    wrap.id = "cb-zap"; wrap.className = "cb-zap";
    wrap.innerHTML = `
      <div class="cb-zap-panel" id="cb-zap-panel" role="dialog" aria-label="Fale no WhatsApp" hidden>
        <div class="cb-zap-head"><i class="ti ti-brand-whatsapp" aria-hidden="true"></i><div><strong>Fale no WhatsApp</strong><span>Tire suas dúvidas — respondemos por aqui.</span></div></div>
        <div class="cb-zap-topicos">${this.TOPICOS.map(t => `<button type="button" onclick="ZAP.abrirTopico('${t.id}')"><i class="ti ${t.icone}" aria-hidden="true"></i>${t.label}</button>`).join("")}</div>
        <div class="cb-zap-foot"><i class="ti ti-lock" aria-hidden="true"></i> Você será levado ao WhatsApp. Não enviamos seus dados automaticamente.</div>
      </div>
      <button type="button" class="cb-zap-fab" id="cb-zap-fab" aria-label="Fale no WhatsApp" aria-expanded="false" onclick="ZAP.alternar()"><i class="ti ti-brand-whatsapp" aria-hidden="true"></i></button>`;
    document.body.appendChild(wrap);
    document.addEventListener("keydown", e => { if (e.key === "Escape") this.fechar(); });
    document.addEventListener("click", e => { const w = document.getElementById("cb-zap"); if (w && !w.contains(e.target)) this.fechar(); });
  },
  _aberto() { const p = document.getElementById("cb-zap-panel"); return !!(p && !p.hasAttribute("hidden")); },
  alternar() { this._aberto() ? this.fechar() : this.abrir(); },
  abrir() {
    const p = document.getElementById("cb-zap-panel"), f = document.getElementById("cb-zap-fab"), w = document.getElementById("cb-zap");
    if (p) p.removeAttribute("hidden"); if (f) f.setAttribute("aria-expanded", "true"); if (w) w.classList.add("open");
  },
  fechar() {
    const p = document.getElementById("cb-zap-panel"), f = document.getElementById("cb-zap-fab"), w = document.getElementById("cb-zap");
    if (p) p.setAttribute("hidden", ""); if (f) f.setAttribute("aria-expanded", "false"); if (w) w.classList.remove("open");
  }
};
if (typeof window !== "undefined") window.ZAP = ZAP;

// Auto-monta quando o DOM estiver pronto (landing e app carregam este script).
(function () {
  function go() { try { ZAP.montar(); } catch (e) {} }
  if (document.readyState !== "loading") go(); else document.addEventListener("DOMContentLoaded", go);
})();
