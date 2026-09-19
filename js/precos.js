// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// d14 — Preços do plano em FONTE ÚNICA. O admin define em planos_precos (migration 0022); a landing
// e o modal de checkout EXIBEM daqui (view anon v_planos_precos); a Edge Function asaas-checkout
// COBRA daqui (service_role). Sem backend/sem dados → cai para o conteúdo estático (no-op).
const PRECOS = {
  _cache: null,
  _supaOk() { return !!(typeof window !== "undefined" && window.supa); },

  async carregar(force) {
    if (this._cache && !force) return this._cache;
    if (!this._supaOk()) return null;
    try {
      const { data, error } = await window.supa.from("v_planos_precos").select("*");
      if (error) return null;
      const m = {}; (data || []).forEach(r => m[r.plano] = r); this._cache = m; return m;
    } catch (e) { return null; }
  },
  get(plano) { return this._cache && this._cache[plano] ? this._cache[plano] : null; },
  // Rótulo curto p/ o modal de checkout: prefixo + preço + período, como vêm da view (sem exemplo de valor aqui: este
  // arquivo é publicado, e a varredura de preço do modo piloto — tools/modo-piloto.ts — reprova preço escrito no código).
  rotulo(plano) { const p = this.get(plano); if (!p) return null; return (p.prefixo ? p.prefixo + " " : "") + p.preco + (p.periodo || ""); },

  // Atualiza os cards da landing a partir da fonte. No-op sem dados → mantém o HTML estático.
  async aplicarLanding() {
    const m = await this.carregar();
    if (!m) return;
    ["pro-mensal", "pro-anual"].forEach(plano => {
      const p = m[plano]; if (!p) return;
      const set = (suf, val) => { const el = document.getElementById("preco-" + plano + "-" + suf); if (el && val != null) el.textContent = val; };
      set("cur", p.prefixo); set("num", p.preco); set("per", p.periodo);
      const nota = document.getElementById("nota-" + plano); if (nota && p.nota != null) nota.textContent = p.nota;
    });
  },

  // ---- Admin ----
  async listarAdmin() { const { data, error } = await window.supa.from("planos_precos").select("*").order("valor"); if (error) throw error; return data || []; },
  async salvar(plano, d) {
    const { error } = await window.supa.from("planos_precos").update({
      valor: d.valor, ciclo: d.ciclo, prefixo: d.prefixo, preco: d.preco, periodo: d.periodo,
      nota: d.nota, descricao: d.descricao, ativo: d.ativo,
      atualizado_por: (typeof AUTH !== "undefined" && AUTH.session() || {}).id, atualizado_em: new Date().toISOString()
    }).eq("plano", plano);
    if (error) throw error;
    this._cache = null;   // invalida o cache p/ refletir na próxima leitura
  }
};
if (typeof window !== "undefined") window.PRECOS = PRECOS;
