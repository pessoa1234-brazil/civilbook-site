// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// e17 — Risco financeiro: calibração (histórico da DRE/e16) + orquestração do Monte Carlo
// (Web Worker, com fallback inline via window.cbSimularRisco) + persistência das premissas
// (RLS admin-only, migration 0023). Tudo degrada com elegância: sem migração ainda simula
// (calibração + linha de base + padrões); sem Worker, roda inline. Comunicar em FAIXAS.
const RISCO = {
  _supaOk() { return !!(typeof window !== "undefined" && window.supa && typeof AUTH !== "undefined" && AUTH.isAdmin && AUTH.isAdmin()); },

  // Padrões usados quando não há histórico nem linha de base.
  PADRAO: {
    receitaMensal: 0, cvReceita: 0.15, custoPct: 60, cvCusto: 0.10, despFixaMensal: 0,
    churnPct: 0, crescimentoPct: 0, caixaInicial: 0, horizonteMeses: 12,
    metaResultado: 0, iteracoes: 10000, confianca: 0.95
  },

  // ---- Calibração a partir do histórico da DRE (e16) ----
  // Estima média e CV mensais de receita líquida, % de custo e despesas fixas. Quanto mais
  // meses, melhor. Cacheado por sessão (recalibra ao lançar/estornar — ver admin.js).
  _calib: null, _calibDone: false,
  async calibrar() {
    if (this._calibDone) return this._calib;
    this._calibDone = true;
    if (typeof FIN === "undefined" || !window.supa) { this._calib = null; return null; }
    try {
      const comps = await FIN.competencias();
      if (!comps || !comps.length) { this._calib = { nMeses: 0 }; return this._calib; }
      const use = comps.slice(0, 24);   // até 24 meses recentes
      const arr = await Promise.all(use.map(c => FIN.lancamentos(c).catch(() => [])));
      const rl = [], frac = [], desp = [];
      arr.forEach(lancs => {
        const dre = FIN.calcular(lancs);
        const r = dre.sub.receita_liquida;
        if (r > 0) {
          rl.push(r);
          frac.push(Math.min(3, Math.abs(dre.g.custo) / r));
          desp.push(Math.abs(dre.g.despesa_comercial) + Math.abs(dre.g.despesa_administrativa));
        }
      });
      if (rl.length < 2) { this._calib = { nMeses: rl.length }; return this._calib; }
      const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
      const cv = a => { const m = mean(a); if (!m) return 0; const v = mean(a.map(x => (x - m) * (x - m))); return Math.sqrt(v) / m; };
      this._calib = {
        nMeses: rl.length,
        receitaMensal: Math.round(mean(rl) * 100) / 100,
        cvReceita: Math.round(cv(rl) * 1000) / 1000,
        custoPct: Math.round(mean(frac) * 1000) / 10,   // fração → % (1 casa)
        cvCusto: Math.round(cv(frac) * 1000) / 1000,
        despFixaMensal: Math.round(mean(desp) * 100) / 100
      };
      return this._calib;
    } catch (e) { this._calib = null; return null; }
  },
  invalidarCalibracao() { this._calib = null; this._calibDone = false; },

  // Monta as premissas do painel: salvas (admin) > calibração (histórico) > linha de base > padrões.
  async montarPremissas() {
    const p = Object.assign({}, this.PADRAO);
    let base = null; try { base = (typeof FIN !== "undefined" && window.supa) ? await FIN.baseline() : null; } catch (e) {}
    if (base) {
      if (base.receita_mensal != null) p.receitaMensal = Number(base.receita_mensal);
      if (base.custo_mensal != null && Number(base.receita_mensal) > 0) p.custoPct = Math.round(Number(base.custo_mensal) / Number(base.receita_mensal) * 1000) / 10;
      if (base.caixa != null) p.caixaInicial = Number(base.caixa);
    }
    const calib = await this.calibrar().catch(() => null);
    let nMeses = (calib && calib.nMeses != null) ? calib.nMeses : 0;
    if (calib && calib.receitaMensal != null) {
      p.receitaMensal = calib.receitaMensal; p.cvReceita = calib.cvReceita;
      p.custoPct = calib.custoPct; p.cvCusto = calib.cvCusto; p.despFixaMensal = calib.despFixaMensal;
    }
    const salvas = await this.carregar().catch(() => null);
    if (salvas) {
      const map = {
        receita_mensal: "receitaMensal", cv_receita: "cvReceita", custo_pct: "custoPct", cv_custo: "cvCusto",
        desp_fixa: "despFixaMensal", churn_pct: "churnPct", crescimento_pct: "crescimentoPct", caixa_inicial: "caixaInicial",
        horizonte_meses: "horizonteMeses", meta_resultado: "metaResultado", iteracoes: "iteracoes", confianca: "confianca"
      };
      Object.keys(map).forEach(k => { if (salvas[k] != null) p[map[k]] = Number(salvas[k]); });
    }
    return { premissas: p, nMeses, temSalvas: !!salvas, temBaseline: !!base };
  },

  // ---- Persistência das premissas (migration 0023) ----
  async carregar() {
    if (!window.supa) return null;
    const { data, error } = await window.supa.from("financeiro_risco").select("*").eq("chave", "base").maybeSingle();
    if (error) throw error;
    return data || null;
  },
  async salvar(p) {
    const row = {
      chave: "base",
      receita_mensal: p.receitaMensal, cv_receita: p.cvReceita, custo_pct: p.custoPct, cv_custo: p.cvCusto,
      desp_fixa: p.despFixaMensal, churn_pct: p.churnPct, crescimento_pct: p.crescimentoPct,
      caixa_inicial: p.caixaInicial, horizonte_meses: p.horizonteMeses, meta_resultado: p.metaResultado,
      iteracoes: p.iteracoes, confianca: p.confianca,
      atualizado_por: AUTH.session().id, atualizado_em: new Date().toISOString()
    };
    const { error } = await window.supa.from("financeiro_risco").upsert(row, { onConflict: "chave" });
    if (error) throw error;
  },

  // ---- Simulação: Web Worker (preferido) com fallback inline ----
  simular(premissas) {
    return new Promise((resolve, reject) => {
      let done = false;
      const inline = () => {
        try {
          if (typeof window !== "undefined" && typeof window.cbSimularRisco === "function") resolve(window.cbSimularRisco(premissas));
          else reject(new Error("Motor de simulação indisponível."));
        } catch (e) { reject(e); }
      };
      if (typeof Worker === "undefined") return inline();
      let w;
      try { w = new Worker("js/risco.worker.js?v=cd8b896"); } catch (e) { return inline(); }
      const t = setTimeout(() => { if (done) return; done = true; try { w.terminate(); } catch (e) {} inline(); }, 20000);
      w.onmessage = ev => {
        if (done) return; done = true; clearTimeout(t); try { w.terminate(); } catch (e) {}
        const r = ev.data;
        if (r && r.ok) resolve(r); else reject(new Error((r && r.erro) || "Falha na simulação."));
      };
      w.onerror = () => { if (done) return; done = true; clearTimeout(t); try { w.terminate(); } catch (e) {} inline(); };
      w.postMessage(premissas);
    });
  },

  brl(n) { return (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); },
  pct(f) { return (Number(f) * 100).toFixed(1).replace(".", ",") + "%"; }
};
if (typeof window !== "undefined") window.RISCO = RISCO;
