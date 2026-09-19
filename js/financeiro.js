// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// e16 — Dashboard Financeiro: DRE auditável (CPC 26) + linha de base (orçado) da Viabilidade.
// Dado sensível → tudo em tabelas RLS admin-only (migration 0020). Lançamentos IMUTÁVEIS
// (correção = estorno); período fechado não aceita novos lançamentos (garantido por trigger).
// valor é SINALIZADO (receita +, deduções/custos/despesas/impostos −, resultado financeiro ±).
const FIN = {
  // Estrutura da DRE (ordem + rótulo). Itens com `key` são lançáveis; com `sub` são subtotais.
  GRUPOS: [
    { key: "receita_bruta", label: "Receita bruta de serviços", desp: false },
    { key: "deducao", label: "(−) Deduções (impostos s/ receita, devoluções)", desp: true },
    { sub: "receita_liquida", label: "= Receita líquida" },
    { key: "custo", label: "(−) Custos dos serviços prestados", desp: true },
    { sub: "lucro_bruto", label: "= Lucro bruto" },
    { key: "despesa_comercial", label: "(−) Despesas comerciais", desp: true },
    { key: "despesa_administrativa", label: "(−) Despesas administrativas", desp: true },
    { sub: "ebitda", label: "= EBITDA", forte: true },
    { key: "deprecia_amort", label: "(−) Depreciação e amortização", desp: true },
    { sub: "ebit", label: "= EBIT (resultado operacional)" },
    { key: "result_financeiro", label: "(±) Resultado financeiro", amb: true },
    { sub: "lair", label: "= Resultado antes do IR/CSLL" },
    { key: "ir_csll", label: "(−) IR e CSLL", desp: true },
    { sub: "lucro_liquido", label: "= Lucro líquido", forte: true }
  ],
  gruposLancaveis() { return this.GRUPOS.filter(g => g.key); },
  rotuloGrupo(key) { var g = this.GRUPOS.find(x => x.key === key); return g ? g.label : key; },

  _supaOk() { return !!(typeof window !== "undefined" && window.supa && typeof AUTH !== "undefined" && AUTH.session()); },
  compAtual() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); },
  fmtComp(c) { var m = /^(\d{4})-(\d{2})$/.exec(String(c || "")); return m ? m[2] + "/" + m[1] : (c || ""); },
  brl(n) { return (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); },

  // ---- Lançamentos (append-only) ----
  async lancamentos(competencia) {
    const { data, error } = await window.supa.from("dre_lancamentos")
      .select("id,competencia,grupo,descricao,valor,estorno_de,criado_por,created_at")
      .eq("competencia", competencia).order("created_at");
    if (error) throw error;
    return data || [];
  },
  async competencias() {
    const { data, error } = await window.supa.from("dre_lancamentos").select("competencia").order("competencia", { ascending: false }).limit(3000);
    if (error) throw error;
    return [...new Set((data || []).map(r => r.competencia))];
  },
  async inserir(l) {
    const { error } = await window.supa.from("dre_lancamentos").insert({
      competencia: l.competencia, grupo: l.grupo, descricao: l.descricao, valor: l.valor, criado_por: AUTH.session().id
    });
    if (error) throw error;
  },
  async estornar(orig) {
    const { error } = await window.supa.from("dre_lancamentos").insert({
      competencia: orig.competencia, grupo: orig.grupo, descricao: "ESTORNO: " + orig.descricao,
      valor: -Number(orig.valor), estorno_de: orig.id, criado_por: AUTH.session().id
    });
    if (error) throw error;
  },

  // ---- Período (fechamento) ----
  async periodo(competencia) {
    const { data } = await window.supa.from("dre_periodos").select("*").eq("competencia", competencia).maybeSingle();
    return data || { competencia, fechado: false };
  },
  async fechar(competencia, fechar) {
    const { error } = await window.supa.from("dre_periodos").upsert({
      competencia, fechado: !!fechar, fechado_por: fechar ? AUTH.session().id : null, fechado_em: fechar ? new Date().toISOString() : null
    }, { onConflict: "competencia" });
    if (error) throw error;
  },

  // ---- Linha de base (orçado) ----
  async baseline() {
    const { data } = await window.supa.from("financeiro_baseline").select("*").eq("chave", "base").maybeSingle();
    return data || null;
  },
  async salvarBaseline(b) {
    const row = Object.assign({ chave: "base", congelado_por: AUTH.session().id, congelado_em: new Date().toISOString() }, b);
    const { error } = await window.supa.from("financeiro_baseline").upsert(row, { onConflict: "chave" });
    if (error) throw error;
  },

  // ---- Cálculo da DRE (soma por grupo + subtotais) ----
  calcular(lancs) {
    const g = {};
    this.gruposLancaveis().forEach(x => g[x.key] = 0);
    (lancs || []).forEach(l => { if (g[l.grupo] != null) g[l.grupo] += Number(l.valor); });
    const rl = g.receita_bruta + g.deducao;
    const lb = rl + g.custo;
    const ebitda = lb + g.despesa_comercial + g.despesa_administrativa;
    const ebit = ebitda + g.deprecia_amort;
    const lair = ebit + g.result_financeiro;
    const ll = lair + g.ir_csll;
    return { g, sub: { receita_liquida: rl, lucro_bruto: lb, ebitda: ebitda, ebit: ebit, lair: lair, lucro_liquido: ll } };
  },
  valorSub(dre, key) { return dre.sub[key] != null ? dre.sub[key] : (dre.g[key] || 0); },

  // ---- Insights (realizado vs. orçado) ----
  insights(dre, base) {
    if (!base) return [{ tipo: "info", txt: "Defina a linha de base (orçado) para comparar realizado × previsto." }];
    const out = [];
    const rl = dre.sub.receita_liquida, ml = rl ? dre.sub.lucro_liquido / rl * 100 : null;
    if (base.receita_mensal != null && rl > 0 && rl < Number(base.receita_mensal) * 0.9)
      out.push({ tipo: "alerta", txt: `Receita líquida (${this.brl(rl)}) abaixo do orçado (${this.brl(base.receita_mensal)}).` });
    if (base.margem_alvo != null && ml != null && ml < Number(base.margem_alvo) - 2)
      out.push({ tipo: "alerta", txt: `Margem líquida ${ml.toFixed(1)}% abaixo do alvo ${Number(base.margem_alvo).toFixed(1)}% — revisar custos/preços.` });
    if (base.ebitda_alvo != null && dre.sub.ebitda < Number(base.ebitda_alvo))
      out.push({ tipo: "atencao", txt: `EBITDA (${this.brl(dre.sub.ebitda)}) abaixo do alvo (${this.brl(base.ebitda_alvo)}).` });
    if (base.caixa != null && Number(base.custo_mensal) > 0) {
      const rw = Number(base.caixa) / Number(base.custo_mensal);
      if (rw < 6) out.push({ tipo: "alerta", txt: `Runway ~${rw.toFixed(1)} meses (caixa ÷ custo mensal) — atenção ao caixa.` });
    }
    if (!out.length) out.push({ tipo: "ok", txt: "Indicadores dentro das faixas do orçado. 👍" });
    return out;
  }
};
if (typeof window !== "undefined") window.FIN = FIN;
