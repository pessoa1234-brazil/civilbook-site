// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// e18 — Métodos quantitativos + dados de mercado. Previsão (forecasting) sobre as séries do
// próprio negócio (receita/custo/resultado da DRE, e16) + índices da construção civil (carga
// manual, 0025) como contexto. Métodos: média móvel, suavização exponencial (SES), Holt
// (tendência), regressão linear e AR(1) (ARIMA simples) — escolha do melhor por backtest
// (one-step rolling, menor RMSE). Comunica em FAIXAS (banda de previsão), nunca um número único,
// e detecta DESVIO do realizado. Gera sinais que realimentam a linha de base (e16). Cálculo leve
// → roda inline (não precisa de Web Worker como o Monte Carlo do e17).
const PREVISAO = {
  _supaOk() { return !!(typeof window !== "undefined" && window.supa && typeof AUTH !== "undefined" && AUTH.session()); },
  INDICES: { cub: "CUB — NBR 12.721", incc: "INCC (FGV)", ipca: "IPCA (IBGE)", pib_construcao: "PIB Construção (IBGE)", sinapi: "SINAPI (CEF)", igpm: "IGP-M (FGV)", selic: "Selic (BCB)", outro: "Outro" },
  SERIES: { receita: "Receita líquida", custo: "Custos", resultado: "Resultado (lucro líquido)" },

  // ── Série mensal do negócio (a partir do e16) ────────────────────────────
  _cache: null, _done: false,
  async series() {
    if (this._done) return this._cache;
    this._done = true;
    if (typeof FIN === "undefined" || !window.supa) { this._cache = null; return null; }
    try {
      const comps = (await FIN.competencias() || []).slice().sort();   // crescente
      const arr = await Promise.all(comps.map(c => FIN.lancamentos(c).catch(() => [])));
      const labels = [], receita = [], custo = [], resultado = [], ebitda = [];
      comps.forEach((c, i) => {
        const d = FIN.calcular(arr[i]);
        labels.push(c); receita.push(d.sub.receita_liquida); custo.push(-(d.g.custo || 0)); resultado.push(d.sub.lucro_liquido); ebitda.push(d.sub.ebitda);
      });
      this._cache = { labels, receita, custo, resultado, ebitda };
      return this._cache;
    } catch (e) { this._cache = null; return null; }
  },
  invalidar() { this._cache = null; this._done = false; },

  // ── Estatística base ─────────────────────────────────────────────────────
  _mean(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0; },
  _rmse(err) { return err.length ? Math.sqrt(this._mean(err.map(e => e * e))) : Infinity; },
  _mape(y, pred, from) { let s = 0, n = 0; for (let t = from; t < y.length; t++) { if (y[t] !== 0) { s += Math.abs((y[t] - pred[t]) / y[t]); n++; } } return n ? s / n * 100 : null; },

  // Cada método devolve { nome, oneStep:[pred t=from..n-1], from, forecast:(h)=>[v0..v_{h-1}] }.
  _mediaMovel(y, k) {
    k = Math.max(2, Math.min(k || 3, y.length - 1));
    const n = y.length, oneStep = new Array(n).fill(null);
    for (let t = k; t < n; t++) oneStep[t] = this._mean(y.slice(t - k, t));
    const ultimo = this._mean(y.slice(n - k));
    return { nome: "Média móvel (" + k + ")", oneStep, from: k, forecast: h => new Array(h).fill(ultimo) };
  },
  _ses(y) {
    const n = y.length; let best = null;
    for (let a = 0.1; a <= 0.9001; a += 0.1) {
      let l = y[0]; const os = new Array(n).fill(null); let sse = 0, cnt = 0;
      for (let t = 1; t < n; t++) { os[t] = l; const e = y[t] - l; sse += e * e; cnt++; l = a * y[t] + (1 - a) * l; }
      if (!best || sse < best.sse) best = { a, os, l, sse };
    }
    return { nome: "Suavização exponencial", oneStep: best.os, from: 1, forecast: h => new Array(h).fill(best.l) };
  },
  _holt(y) {
    const n = y.length; if (n < 3) return null; let best = null;
    for (let a = 0.2; a <= 0.8001; a += 0.2) for (let b = 0.1; b <= 0.6001; b += 0.1) {
      let l = y[0], tr = y[1] - y[0]; const os = new Array(n).fill(null); let sse = 0;
      for (let t = 1; t < n; t++) { os[t] = l + tr; const e = y[t] - os[t]; sse += e * e; const lp = l; l = a * y[t] + (1 - a) * (l + tr); tr = b * (l - lp) + (1 - b) * tr; }
      if (!best || sse < best.sse) best = { l, tr, os, sse };
    }
    return { nome: "Holt (tendência)", oneStep: best.os, from: 1, forecast: h => Array.from({ length: h }, (_, i) => best.l + (i + 1) * best.tr) };
  },
  _linreg(y) {
    const n = y.length, xm = (n - 1) / 2, ym = this._mean(y);
    let sxy = 0, sxx = 0; for (let t = 0; t < n; t++) { sxy += (t - xm) * (y[t] - ym); sxx += (t - xm) * (t - xm); }
    const b = sxx ? sxy / sxx : 0, a = ym - b * xm;
    const os = new Array(n).fill(null); for (let t = 0; t < n; t++) os[t] = a + b * t;
    return { nome: "Regressão linear", oneStep: os, from: 1, forecast: h => Array.from({ length: h }, (_, i) => a + b * (n + i)) };
  },
  _ar1(y) {
    const n = y.length; if (n < 3) return null;
    const x = y.slice(0, n - 1), z = y.slice(1);
    const xm = this._mean(x), zm = this._mean(z);
    let sxy = 0, sxx = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i] - xm) * (z[i] - zm); sxx += (x[i] - xm) * (x[i] - xm); }
    let phi = sxx ? sxy / sxx : 0; if (phi > 1.2) phi = 1.2; if (phi < -1.2) phi = -1.2;
    const c = zm - phi * xm;
    const os = new Array(n).fill(null); for (let t = 1; t < n; t++) os[t] = c + phi * y[t - 1];
    return { nome: "AR(1) — ARIMA simples", oneStep: os, from: 1, forecast: h => { const out = []; let prev = y[n - 1]; for (let i = 0; i < h; i++) { const v = c + phi * prev; out.push(v); prev = v; } return out; } };
  },

  // Backtest + escolha do melhor; previsão com banda; detecção de desvio.
  prever(y, h) {
    y = (y || []).map(Number).filter(v => isFinite(v));
    const n = y.length;
    if (n < 4) return { ok: false, motivo: "Histórico insuficiente (mínimo 4 meses)." };
    h = Math.max(1, Math.min(h || 6, 12));
    const cand = [this._mediaMovel(y, 3), this._ses(y), this._holt(y), this._linreg(y), this._ar1(y)].filter(Boolean);
    const aval = cand.map(m => {
      const err = []; for (let t = m.from; t < n; t++) if (m.oneStep[t] != null) err.push(y[t] - m.oneStep[t]);
      return { nome: m.nome, rmse: this._rmse(err), mape: this._mape(y, m.oneStep, m.from), m, err };
    }).sort((a, b) => a.rmse - b.rmse);
    const best = aval[0];
    const sigma = best.rmse && isFinite(best.rmse) ? best.rmse : (this._std(y) || 1);
    const z = 1.28;   // ~80%
    const fc = best.m.forecast(h);
    const previsao = fc.map((v, i) => { const hw = z * sigma * Math.sqrt(i + 1); return { valor: v, lo: v - hw, hi: v + hw }; });
    // Desvio: último realizado vs. o previsto (one-step) para ele.
    let desvio = null;
    const prevUlt = best.m.oneStep[n - 1];
    if (prevUlt != null && sigma > 0) {
      const r = y[n - 1] - prevUlt, sd = r / sigma;
      if (Math.abs(sd) >= 2) desvio = { dir: r > 0 ? "acima" : "abaixo", real: y[n - 1], previsto: prevUlt, sigmas: Math.abs(sd) };
    }
    return { ok: true, metodo: best.nome, sigma, historico: y, previsao, comparacao: aval.map(a => ({ nome: a.nome, rmse: a.rmse, mape: a.mape })), desvio, n };
  },
  _std(a) { const m = this._mean(a); return Math.sqrt(this._mean(a.map(x => (x - m) * (x - m)))); },

  // ── Índices de mercado (0025) ────────────────────────────────────────────
  async indices() {
    const { data, error } = await window.supa.from("indices_mercado").select("*").order("competencia", { ascending: false }).limit(500);
    if (error) throw error;
    return data || [];
  },
  // Último valor por índice.
  ultimosPorIndice(rows) {
    const out = {};
    (rows || []).forEach(r => { if (!out[r.indice]) out[r.indice] = r; });   // já vem desc por competência
    return out;
  },
  async salvarIndice(d) {
    const row = { indice: d.indice, competencia: d.competencia, valor: d.valor, variacao_pct: d.variacao_pct, fonte: d.fonte || null, nota: d.nota || null, atualizado_por: AUTH.session().id, atualizado_em: new Date().toISOString() };
    const { error } = await window.supa.from("indices_mercado").upsert(row, { onConflict: "indice,competencia" });
    if (error) throw error;
  },

  brl(n) { return (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
};
if (typeof window !== "undefined") window.PREVISAO = PREVISAO;
