// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// e17 — Núcleo da simulação de risco (Monte Carlo). PURO: sem DOM, sem rede, sem
// dependências. Roda igual no Web Worker (risco.worker.js, via importScripts) e na
// thread principal (fallback de risco.js). REPRODUTÍVEL: PRNG semeado → mesmas premissas
// geram os mesmos números (auditável). O resultado é sempre uma DISTRIBUIÇÃO (faixas e
// probabilidades), nunca um número único — a decisão deve ler a incerteza.
(function (root) {
  "use strict";

  // PRNG determinístico (mulberry32) — reprodutibilidade para auditoria.
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Normal padrão por Box–Muller polar (com cache do 2º valor).
  function gaussFactory(rnd) {
    var spare = null;
    return function () {
      if (spare !== null) { var s0 = spare; spare = null; return s0; }
      var u, v, s;
      do { u = rnd() * 2 - 1; v = rnd() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
      var m = Math.sqrt(-2 * Math.log(s) / s);
      spare = v * m; return u * m;
    };
  }

  // Quantil por interpolação linear sobre vetor ORDENADO.
  function quantile(sorted, q) {
    var n = sorted.length; if (!n) return 0;
    var pos = (n - 1) * q, base = Math.floor(pos), rest = pos - base;
    var next = sorted[base + 1];
    return (next !== undefined) ? sorted[base] + rest * (next - sorted[base]) : sorted[base];
  }

  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }

  // p = premissas (todas opcionais). Retorna distribuição + estatísticas de risco.
  function simular(p) {
    p = p || {};
    var N = Math.max(1000, Math.min(200000, Math.round(num(p.iteracoes, 10000))));
    var H = Math.max(1, Math.min(60, Math.round(num(p.horizonteMeses, 12))));
    var receita0 = Math.max(0, num(p.receitaMensal, 0));
    var cvRec = Math.max(0, num(p.cvReceita, 0.15));
    var custoFrac = Math.max(0, num(p.custoPct, 60) / 100);
    var cvCusto = Math.max(0, num(p.cvCusto, 0.10));
    var despFixa = Math.max(0, num(p.despFixaMensal, 0));
    var churn = num(p.churnPct, 0) / 100;
    var cresc = num(p.crescimentoPct, 0) / 100;
    var caixa0 = num(p.caixaInicial, 0);
    var meta = num(p.metaResultado, 0);
    var conf = Math.min(0.999, Math.max(0.5, num(p.confianca, 0.95)));
    var seed = (p.seed != null) ? (p.seed >>> 0) : 0x9E3779B9;

    var rnd = mulberry32(seed);
    var gauss = gaussFactory(rnd);

    // Receita ~ Lognormal com E[X]=mean e CV=cvRec  (σ²=ln(1+cv²); μ=ln(mean)−σ²/2).
    var sigRec = Math.sqrt(Math.log(1 + cvRec * cvRec));
    function lnRec(mean) {
      if (mean <= 0) return 0;
      var mu = Math.log(mean) - sigRec * sigRec / 2;
      return Math.exp(mu + sigRec * gauss());
    }

    var resultados = new Float64Array(N);   // resultado acumulado no horizonte
    var caixaFinal = new Float64Array(N);    // caixa ao fim do horizonte
    var semCaixa = 0;                        // iterações que ficaram sem caixa em algum mês

    for (var i = 0; i < N; i++) {
      var base = receita0, acum = 0, caixa = caixa0, furou = false;
      for (var m = 0; m < H; m++) {
        base = base * (1 + cresc - churn);          // base recorrente evolui (cresc − churn)
        if (base < 0) base = 0;
        var receita = lnRec(base);
        var ratio = custoFrac + cvCusto * custoFrac * gauss();   // custo como % da receita, com ruído
        if (ratio < 0) ratio = 0; else if (ratio > 3) ratio = 3;
        var custo = receita * ratio;
        var desp = despFixa + 0.10 * despFixa * gauss();          // despesa fixa com pequeno ruído
        if (desp < 0) desp = 0;
        var res = receita - custo - desp;
        acum += res; caixa += res;
        if (caixa < 0) furou = true;
      }
      resultados[i] = acum; caixaFinal[i] = caixa;
      if (furou) semCaixa++;
    }

    var sorted = Float64Array.from(resultados).sort();
    var sortedCx = Float64Array.from(caixaFinal).sort();
    var soma = 0; for (var j = 0; j < N; j++) soma += resultados[j];
    var media = soma / N;

    var p5 = quantile(sorted, 0.05), p50 = quantile(sorted, 0.5), p95 = quantile(sorted, 0.95);

    var abaixoMeta = 0, prejuizo = 0;
    for (var k = 0; k < N; k++) { if (resultados[k] < meta) abaixoMeta++; if (resultados[k] < 0) prejuizo++; }

    // VaR (perda máxima provável ao nível conf) = −quantil(1−conf). CVaR = média da cauda além do VaR.
    var qLoss = quantile(sorted, 1 - conf);
    var VaR = Math.max(0, -qLoss);
    var tailSum = 0, tailN = 0;
    for (var a = 0; a < N; a++) { if (resultados[a] <= qLoss) { tailSum += resultados[a]; tailN++; } }
    var CVaR = tailN ? Math.max(0, -(tailSum / tailN)) : VaR;

    // Histograma (faixas) para o gráfico.
    var lo = sorted[0], hi = sorted[N - 1], w = (hi - lo) || 1, nb = 28, bins = [];
    for (var b = 0; b < nb; b++) bins.push({ x0: lo + (w * b) / nb, x1: lo + (w * (b + 1)) / nb, count: 0 });
    for (var c = 0; c < N; c++) {
      var idx = Math.floor(((resultados[c] - lo) / w) * nb);
      if (idx < 0) idx = 0; else if (idx >= nb) idx = nb - 1;
      bins[idx].count++;
    }

    return {
      ok: true, n: N, horizonte: H, meta: meta, confianca: conf,
      resultado: { p5: p5, p50: p50, p95: p95, media: media, min: lo, max: hi },
      caixa: { p5: quantile(sortedCx, 0.05), p50: quantile(sortedCx, 0.5), p95: quantile(sortedCx, 0.95) },
      probAbaixoMeta: abaixoMeta / N,
      probPrejuizo: prejuizo / N,
      probSemCaixa: semCaixa / N,
      VaR: VaR, CVaR: CVaR, bins: bins
    };
  }

  root.cbSimularRisco = simular;
})(typeof self !== "undefined" ? self : this);
