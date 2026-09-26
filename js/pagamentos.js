// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Frontend de pagamentos (PSP: Asaas). Coleta o CPF/CNPJ (exigido pelo Asaas para criar
// o cliente) e chama a Edge Function asaas-checkout, que devolve a URL da fatura hospedada
// (PIX / boleto / cartão). NENHUMA chave do Asaas nem dado de cartão passa por aqui.
const PAY = {
  // Pagamento online disponível? (flag + backend configurado)
  ativo() {
    return !!(window.CB_CONFIG && window.CB_CONFIG.PAGAMENTOS_ATIVO && window.CB_CONFIG.SUPA_READY && window.supa);
  },

  // Inicia a assinatura de um plano pago (pro-mensal | pro-anual): pede o CPF/CNPJ.
  checkout(plano) {
    if (!this.ativo()) {
      if (typeof toast === "function") toast("Pagamento online ainda não está ativo.", "info");
      return;
    }
    if (typeof AUTH === "undefined" || !AUTH.session()) {
      if (typeof abrirAuth === "function") abrirAuth("cadastro");
      return;
    }
    this._modalDoc(plano);
  },

  // Modal que coleta CPF/CNPJ antes de seguir ao pagamento.
  _modalDoc(plano) {
    document.getElementById("cb-pay-modal")?.remove();
    const nome = (AUTH.session() && AUTH.session().nome) || "";
    const ov = document.createElement("div");
    ov.id = "cb-pay-modal";
    ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px";
    ov.onclick = e => { if (e.target === ov) ov.remove(); };
    const nomePlano = /^ia/.test(plano) ? "Civilbook IA" : (plano === "pro-anual" ? "PRO Anual" : "PRO Mensal");
    const rot = (typeof PRECOS !== "undefined" && PRECOS.rotulo) ? PRECOS.rotulo(plano) : null;   // d14: fonte única
    // 18/set/2026: sem o rótulo do banco, só o NOME do plano. Antes havia um preço fixo aqui ("12x R$ …" / "R$ …/mês"):
    // publicado em todo js/pagamentos.js mesmo com o site fechado (piloto) e fora da fonte única — no dia em que o
    // admin mudasse o preço, o modal mostraria o antigo. Quem cobra é a Edge Function, com o valor do banco.
    // Travado em tests/portas-convite.check.mjs (roda o modal) e na varredura de preço do tools/modo-piloto.ts.
    const planoLabel = rot ? (nomePlano + " (" + rot + ")") : nomePlano;
    ov.innerHTML = `<div class="card" style="max-width:420px;width:100%">
      <h3 style="margin-bottom:4px">Assinar ${planoLabel}</h3>
      <p class="page-sub" style="margin-bottom:14px">Informe seu CPF ou CNPJ para emitir a cobrança. No Asaas você escolhe PIX, boleto ou cartão.</p>
      <div class="field"><label>CPF ou CNPJ</label><input type="text" id="cb-pay-doc" inputmode="numeric" placeholder="Somente números"></div>
      <p id="cb-pay-erro" style="color:var(--red);font-size:13px;min-height:18px;margin:2px 0"></p>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:6px">
        <button class="btn" id="cb-pay-cancel">Cancelar</button>
        <button class="btn primary" id="cb-pay-go"><i class="ti ti-lock"></i> Ir para o pagamento</button>
      </div>
    </div>`;
    document.body.appendChild(ov);
    const input = ov.querySelector("#cb-pay-doc");
    const erro = ov.querySelector("#cb-pay-erro");
    const goBtn = ov.querySelector("#cb-pay-go");
    input.focus();
    ov.querySelector("#cb-pay-cancel").onclick = () => ov.remove();
    const submit = async () => {
      const doc = (input.value || "").replace(/\D/g, "");
      if (doc.length !== 11 && doc.length !== 14) { erro.textContent = "CPF (11 dígitos) ou CNPJ (14 dígitos)."; return; }
      goBtn.disabled = true; goBtn.innerHTML = `<i class="ti ti-loader"></i> Gerando cobrança…`;
      const r = await this._iniciar(plano, doc, nome);
      if (r && r.erro) { erro.textContent = r.erro; goBtn.disabled = false; goBtn.innerHTML = `<i class="ti ti-lock"></i> Ir para o pagamento`; }
    };
    goBtn.onclick = submit;
    input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
  },

  // Chama a Edge Function e redireciona para a fatura hospedada do Asaas.
  async _iniciar(plano, cpfCnpj, nome) {
    try {
      const { data: { session } } = await window.supa.auth.getSession();
      const token = session && session.access_token;
      const r = await fetch(window.CB_CONFIG.FUNCTIONS_URL + "/asaas-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token,
          "apikey": window.CB_CONFIG.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ plano, cpfCnpj, nome }),
      });
      const dados = await r.json().catch(() => ({}));
      if (dados.url) { window.location.href = dados.url; return { ok: true }; }
      return { erro: dados.error || "Não foi possível iniciar o pagamento." };
    } catch (e) {
      return { erro: "Falha ao conectar ao pagamento. Tente novamente." };
    }
  },
};
