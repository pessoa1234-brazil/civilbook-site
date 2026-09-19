// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// e3 — Avaliação de imóveis (NBR 14653). Método comparativo direto de dados de mercado:
//   • tratamento por fatores (homogeneização + saneamento + campo de arbítrio);
//   • tratamento por regressão linear múltipla (OLS em JS puro — a CSP não permite libs externas);
//   • laudo de valor de mercado imprimível.
// Tudo roda no cliente. Ferramenta de apoio — não substitui o responsável técnico (RT).

// ---------- Estado (persistido em localStorage, padrão offline-first do projeto) ----------
const AVAL = {
  LS: "cb-aval-v1",
  tab: "fatores",
  s: null,
  _vazio() {
    return {
      subj: { ident: "", endereco: "", area: null },
      fat: { amostras: [novaAmostra(), novaAmostra(), novaAmostra()] },
      reg: { dep: "Valor unitário (R$/m²)", vars: ["Área (m²)", "Idade (anos)"], rows: [], subj: [null, null] },
      laudo: { finalidade: "Valor de mercado para compra e venda", solicitante: "", rt: "", crea: "", art: "", data: "", cidade: "", metodo: "fatores" }
    };
  },
  load() {
    if (this.s) return this.s;
    try { this.s = JSON.parse(localStorage.getItem(this.LS)) || null; } catch { this.s = null; }
    if (!this.s) this.s = this._vazio();
    return this.s;
  },
  save() { try { localStorage.setItem(this.LS, JSON.stringify(this.s)); } catch {} }
};
function novaAmostra() { return { desc: "", valor: null, area: null, f: { oferta: 1, local: 1, area: 1, padrao: 1 }, on: true }; }

// ══════════════════════════════════════════════════════════════════════════
// Motores de cálculo (puros — sem DOM)
// ══════════════════════════════════════════════════════════════════════════

// Estatística descritiva (desvio-padrão amostral, n-1).
function avalStats(arr) {
  const n = arr.length;
  if (!n) return null;
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? arr.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  return { n, mean, sd, cv: mean !== 0 ? sd / Math.abs(mean) : 0, min: Math.min(...arr), max: Math.max(...arr) };
}

// Tratamento por fatores: homogeneíza cada dado e resume os valores ativos.
function computeFatores() {
  const s = AVAL.load();
  const area = Number(s.subj.area) || 0;
  const amostras = s.fat.amostras.map(a => {
    const valor = Number(a.valor) || 0;
    const ar = Number(a.area) || 0;
    const fs = AVAL_FATORES.map(def => Number(a.f[def.id]) || 0);
    const prod = fs.reduce((p, x) => p * x, 1);
    const vu = ar > 0 ? valor / ar : null;            // valor unitário observado
    const vh = vu != null ? vu * prod : null;          // valor unitário homogeneizado
    const foraLimite = fs.some(x => x > 0 && (x < AVAL_FATOR_MIN || x > AVAL_FATOR_MAX));
    return { ...a, valor, ar, fs, prod, vu, vh, foraLimite, valido: a.on && vh != null && isFinite(vh) && vh > 0 };
  });
  const ativos = amostras.filter(a => a.valido).map(a => a.vh);
  const st = avalStats(ativos);
  if (!st) return { amostras, stats: null, area };
  // saneamento: amostras ativas que divergem mais de ±30% da média (candidatas a descarte)
  amostras.forEach(a => { a.outlier = a.valido && Math.abs(a.vh - st.mean) / st.mean > AVAL_SANEAMENTO; });
  const arbitrio = { min: st.mean * (1 - AVAL_ARBITRIO), max: st.mean * (1 + AVAL_ARBITRIO) };
  const valorTotal = area > 0 ? st.mean * area : null;
  // grau de fundamentação (pela quantidade de dados utilizados) e de precisão (pelo CV)
  const gf = AVAL_GRAU_FATORES.find(g => st.n >= g.minDados) || null;
  const gp = AVAL_PRECISAO_CV.find(g => st.cv <= g.max) || null;
  return { amostras, stats: st, arbitrio, valorTotal, area, grauFund: gf, grauPrec: gp };
}

// ---------- Álgebra linear mínima p/ regressão (OLS via equações normais) ----------
function mT(A) { return A[0].map((_, j) => A.map(r => r[j])); }
function mMul(A, B) {
  const Bt = mT(B);
  return A.map(r => Bt.map(c => r.reduce((s, v, k) => s + v * c[k], 0)));
}
function mVec(A, x) { return A.map(r => r.reduce((s, v, k) => s + v * x[k], 0)); }
function vDot(a, b) { return a.reduce((s, v, k) => s + v * b[k], 0); }
function mInv(A) {                       // Gauss-Jordan; null se singular
  const n = A.length;
  const M = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col];
    for (let j = 0; j < 2 * n; j++) M[col][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[col][j];
    }
  }
  return M.map(r => r.slice(n));
}

// Regressão linear múltipla a partir do modelo salvo.
function computeRegressao() {
  const s = AVAL.load();
  const k = s.reg.vars.length;
  const rows = s.reg.rows
    .map(r => ({ y: Number(r.y), x: (r.x || []).map(Number) }))
    .filter(r => isFinite(r.y) && r.x.length === k && r.x.every(isFinite));
  const n = rows.length, p = k + 1;
  if (n < p) return { error: `Dados insuficientes: informe ao menos ${p} amostras completas (nº de parâmetros = ${p}).`, n, p, k };
  const X = rows.map(r => [1, ...r.x]);
  const y = rows.map(r => r.y);
  const inv = mInv(mMul(mT(X), X));
  if (!inv) return { error: "Não foi possível ajustar (matriz singular — variáveis colineares ou repetidas).", n, p, k };
  const beta = mVec(inv, mVec(mT(X), y));
  const yhat = X.map(row => vDot(row, beta));
  const resid = y.map((yi, i) => yi - yhat[i]);
  const ybar = y.reduce((a, b) => a + b, 0) / n;
  const sst = y.reduce((a, b) => a + (b - ybar) * (b - ybar), 0);
  const sse = resid.reduce((a, b) => a + b * b, 0);
  const ssr = sst - sse;
  const dfE = n - p, dfR = p - 1;
  const r2 = sst > 0 ? ssr / sst : 0;
  const r2adj = dfE > 0 && n > 1 ? 1 - (sse / dfE) / (sst / (n - 1)) : NaN;
  const mse = dfE > 0 ? sse / dfE : NaN;
  const se = Math.sqrt(mse);
  const F = dfR > 0 && mse > 0 ? (ssr / dfR) / mse : NaN;
  const seBeta = beta.map((_, j) => Math.sqrt(mse * inv[j][j]));
  const tBeta = beta.map((b, j) => (seBeta[j] > 0 ? b / seBeta[j] : NaN));
  // estimativa do avaliando
  const xs = (s.reg.subj || []).map(Number);
  let pred = null;
  if (xs.length === k && xs.every(isFinite)) {
    const x0 = [1, ...xs];
    const yh = vDot(x0, beta);
    const qf = vDot(x0, mVec(inv, x0));               // x0' (X'X)^-1 x0
    const sePred = se * Math.sqrt(1 + Math.max(qf, 0));
    pred = { y: yh, sePred, lo: yh - 2 * sePred, hi: yh + 2 * sePred }; // banda ~95% (t≈2)
  }
  // grau de fundamentação (pela razão n / (k+1)) e de precisão (pelo R²)
  const gf = AVAL_GRAU_REGRESSAO.find(g => n >= g.fator * p) || null;
  return { beta, r2, r2adj, se, F, mse, n, p, k, dfE, dfR, seBeta, tBeta, dep: s.reg.dep, vars: s.reg.vars, pred, grauFund: gf };
}

// ══════════════════════════════════════════════════════════════════════════
// UI
// ══════════════════════════════════════════════════════════════════════════
function renderAvaliacao(param) {
  AVAL.load();
  if (param === "regressao" || param === "laudo" || param === "fatores") AVAL.tab = param;
  const tabBtn = (id, icone, label) =>
    `<button data-t="${id}" class="${AVAL.tab === id ? "active" : ""}"><i class="ti ${icone}"></i> ${label}</button>`;
  app.innerHTML = `
    <h2 class="page-title">Avaliação de imóveis</h2>
    <p class="page-sub">Valor de mercado pela <strong>NBR 14653</strong> — método comparativo (fatores/regressão) e laudo. Ferramenta de apoio; os resultados não substituem o responsável técnico.</p>
    <details class="sinapi-howto">
      <summary><i class="ti ti-info-circle"></i> Como funciona a avaliação (NBR 14653)</summary>
      <ul>${AVAL_NBR_PONTOS.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
      <p class="howto-src">Resumo orientativo do procedimento — não reproduz o texto integral. Obtenha a norma vigente junto à ABNT.</p>
    </details>
    <div class="tabs-bar" id="aval-tabs">
      ${tabBtn("fatores", "ti-table", "Comparativo (fatores)")}
      ${tabBtn("regressao", "ti-chart-dots", "Regressão")}
      ${tabBtn("laudo", "ti-file-description", "Laudo")}
    </div>
    <div id="aval-pane"></div>`;
  document.querySelectorAll("#aval-tabs button").forEach(b =>
    b.addEventListener("click", () => { AVAL.tab = b.dataset.t; renderAvaliacao(AVAL.tab); }));
  renderAvalPane();
}

function renderAvalPane() {
  const pane = document.getElementById("aval-pane");
  if (!pane) return;
  if (AVAL.tab === "regressao") { paneRegressao(pane); return; }
  if (AVAL.tab === "laudo") { paneLaudo(pane); return; }
  paneFatores(pane);
}

const avalDisclaimer = `<div class="card no-print" style="margin-top:14px;border-left:3px solid var(--amber)">
  <p style="margin:0;font-size:13px"><i class="ti ti-alert-triangle" aria-hidden="true" style="color:var(--amber)"></i>
  Resultado <strong>orientativo</strong>. A avaliação formal deve seguir a NBR 14653 vigente e ser assinada por profissional habilitado (engenheiro/arquiteto com ART/RRT). Confira os dados, o saneamento e o grau de fundamentação.</p></div>`;

// ---------- Aba: comparativo por fatores ----------
function paneFatores(pane) {
  const s = AVAL.load();
  pane.innerHTML = `
    <div class="card">
      <div class="field" style="max-width:340px">
        <label for="avf-area">Área do imóvel avaliando (m²)</label>
        <input type="number" id="avf-area" step="any" min="0" value="${s.subj.area != null ? s.subj.area : ""}" placeholder="ex.: 120">
        <span class="hint">Base para converter o valor unitário (R$/m²) em valor total.</span>
      </div>
      <h3 style="margin:6px 0 4px">Dados de mercado</h3>
      <p class="page-sub" style="margin:0 0 10px">Informe valor total, área e os fatores de homogeneização (referência = 1,000; cada fator deve ficar entre ${fmtNum(AVAL_FATOR_MIN, 2)} e ${fmtNum(AVAL_FATOR_MAX, 2)}). Desmarque para excluir uma amostra do saneamento.</p>
      <div class="aval-scroll">
        <table class="data aval-table" id="avf-table">
          <thead><tr>
            <th style="width:30px" title="Incluir no cálculo">✓</th>
            <th style="min-width:120px">Descrição</th>
            <th style="width:120px;text-align:right">Valor total (R$)</th>
            <th style="width:90px;text-align:right">Área (m²)</th>
            <th style="width:96px;text-align:right">V. unit.</th>
            ${AVAL_FATORES.map(f => `<th style="width:78px;text-align:right" title="${esc(f.hint)}">${esc(f.label)}</th>`).join("")}
            <th style="width:108px;text-align:right">V. homog.</th>
            <th style="width:34px"></th>
          </tr></thead>
          <tbody id="avf-body">${rowsFatoresHTML()}</tbody>
        </table>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
        <button class="btn" id="avf-add"><i class="ti ti-plus"></i> Adicionar amostra</button>
        <button class="btn" id="avf-exemplo"><i class="ti ti-flask"></i> Carregar exemplo</button>
        <button class="btn" id="avf-limpar"><i class="ti ti-eraser"></i> Limpar</button>
      </div>
    </div>
    <div id="avf-result"></div>
    ${avalDisclaimer}`;

  const body = document.getElementById("avf-body");
  document.getElementById("avf-area").addEventListener("input", e => { s.subj.area = e.target.value === "" ? null : parseFloat(e.target.value); AVAL.save(); recalcFatores(); });
  // edição inline (delegada): texto/números atualizam o modelo e recomputam
  body.addEventListener("input", e => {
    const tr = e.target.closest("tr[data-i]"); if (!tr) return;
    const i = +tr.dataset.i, campo = e.target.dataset.c;
    if (!campo) return;
    const a = s.fat.amostras[i]; if (!a) return;
    if (campo === "desc") a.desc = e.target.value;
    else if (campo === "valor") a.valor = e.target.value === "" ? null : parseFloat(e.target.value);
    else if (campo === "area") a.area = e.target.value === "" ? null : parseFloat(e.target.value);
    else if (campo.indexOf("f-") === 0) a.f[campo.slice(2)] = e.target.value === "" ? null : parseFloat(e.target.value);
    AVAL.save(); recalcFatores();
  });
  body.addEventListener("change", e => {
    const tr = e.target.closest("tr[data-i]"); if (!tr || !e.target.matches(".avf-on")) return;
    s.fat.amostras[+tr.dataset.i].on = e.target.checked; AVAL.save(); recalcFatores();
  });
  body.addEventListener("click", e => {
    const btn = e.target.closest(".avf-del"); if (!btn) return;
    s.fat.amostras.splice(+btn.closest("tr[data-i]").dataset.i, 1);
    if (!s.fat.amostras.length) s.fat.amostras.push(novaAmostra());
    AVAL.save(); paneFatores(pane);
  });
  document.getElementById("avf-add").addEventListener("click", () => { s.fat.amostras.push(novaAmostra()); AVAL.save(); paneFatores(pane); });
  document.getElementById("avf-limpar").addEventListener("click", () => { s.subj.area = null; s.fat.amostras = [novaAmostra(), novaAmostra(), novaAmostra()]; AVAL.save(); paneFatores(pane); });
  document.getElementById("avf-exemplo").addEventListener("click", () => { carregarExemploFatores(); paneFatores(pane); });
  recalcFatores();
}

function rowsFatoresHTML() {
  const amostras = AVAL.s.fat.amostras;
  return amostras.map((a, i) => `
    <tr data-i="${i}">
      <td style="text-align:center"><input type="checkbox" class="avf-on" ${a.on ? "checked" : ""} aria-label="Incluir amostra ${i + 1}"></td>
      <td><input type="text" class="aval-in" data-c="desc" value="${esc(a.desc || "")}" placeholder="ex.: Apto 3 dorm., bairro X"></td>
      <td><input type="number" class="aval-in t-right" data-c="valor" step="any" min="0" value="${a.valor != null ? a.valor : ""}"></td>
      <td><input type="number" class="aval-in t-right" data-c="area" step="any" min="0" value="${a.area != null ? a.area : ""}"></td>
      <td class="t-right" id="avf-vu-${i}" style="color:var(--text-2)">—</td>
      ${AVAL_FATORES.map(f => `<td><input type="number" class="aval-in t-right avf-f" data-c="f-${f.id}" step="0.001" value="${a.f[f.id] != null ? a.f[f.id] : ""}"></td>`).join("")}
      <td class="t-right price" id="avf-vh-${i}">—</td>
      <td style="text-align:center"><button class="btn icon-only avf-del" aria-label="Remover amostra ${i + 1}" title="Remover"><i class="ti ti-trash"></i></button></td>
    </tr>`).join("");
}

function recalcFatores() {
  const res = computeFatores();
  res.amostras.forEach((a, i) => {
    const vu = document.getElementById("avf-vu-" + i);
    const vh = document.getElementById("avf-vh-" + i);
    if (vu) vu.textContent = a.vu != null ? brl(a.vu) : "—";
    if (vh) { vh.textContent = a.vh != null ? brl(a.vh) : "—"; vh.style.opacity = a.valido ? "1" : ".4"; }
    // sinaliza fator fora do intervalo e outliers
    const tr = document.querySelector(`#avf-body tr[data-i="${i}"]`);
    if (tr) {
      tr.querySelectorAll(".avf-f").forEach((inp, k) => {
        const x = parseFloat(inp.value);
        inp.style.color = (isFinite(x) && (x < AVAL_FATOR_MIN || x > AVAL_FATOR_MAX)) ? "var(--red)" : "";
      });
      tr.style.background = a.outlier ? "var(--amber-light)" : "";
    }
  });
  const out = document.getElementById("avf-result");
  if (!out) return;
  const st = res.stats;
  if (!st) { out.innerHTML = `<p class="page-sub" style="margin-top:14px">Informe ao menos uma amostra válida (valor e área) para ver o resultado.</p>`; return; }
  const temOutlier = res.amostras.some(a => a.outlier);
  out.innerHTML = `
    <div class="card" style="margin-top:14px">
      <h3 style="margin-bottom:10px"><i class="ti ti-calculator"></i> Resultado — valor de mercado</h3>
      <div class="result ok">
        <div><div class="r-label">Valor unitário homogeneizado (média de ${st.n} dado${st.n > 1 ? "s" : ""})</div></div>
        <div><span class="r-value">${brl(st.mean)}</span><span class="r-unit"> /m²</span></div>
      </div>
      ${res.valorTotal != null ? `<div class="result">
        <div><div class="r-label">Valor total estimado (× ${fmtNum(res.area)} m²)</div></div>
        <div><span class="r-value">${brl(res.valorTotal)}</span></div>
      </div>` : `<p class="page-sub" style="margin:6px 0">Informe a área do avaliando para obter o valor total.</p>`}
      <table class="spec-table" style="margin-top:8px">
        <tr><td>Campo de arbítrio (±${fmtNum(AVAL_ARBITRIO * 100, 0)}%)</td><td>${brl(res.arbitrio.min)} a ${brl(res.arbitrio.max)} /m²</td></tr>
        <tr><td>Amplitude da amostra</td><td>${brl(st.min)} a ${brl(st.max)} /m²</td></tr>
        <tr><td>Desvio-padrão</td><td>${brl(st.sd)} /m²</td></tr>
        <tr><td>Coeficiente de variação (CV)</td><td>${fmtNum(st.cv * 100, 1)}%</td></tr>
        <tr><td>Grau de fundamentação (por nº de dados)</td><td>${res.grauFund ? esc(res.grauFund.desc) : "Insuficiente (mín. 3 dados)"}</td></tr>
        <tr><td>Grau de precisão (pela dispersão)</td><td>${res.grauPrec ? esc(res.grauPrec.desc) : "Fora dos graus (CV > 50%)"}</td></tr>
      </table>
      ${temOutlier ? `<p class="page-sub" style="margin:10px 0 0;color:var(--coral)"><i class="ti ti-alert-triangle"></i> Amostras destacadas divergem mais de ${fmtNum(AVAL_SANEAMENTO * 100, 0)}% da média — avalie o saneamento (desmarque para excluir).</p>` : ""}
      <p class="page-sub" style="margin:10px 0 0"><i class="ti ti-arrow-right"></i> Use estes números no <a href="#" onclick="AVAL.s.laudo.metodo='fatores';AVAL.save();renderAvaliacao('laudo');return false;">Laudo</a>.</p>
    </div>`;
}

function carregarExemploFatores() {
  const s = AVAL.load();
  s.subj.area = 120;
  s.fat.amostras = [
    { desc: "Apto 3 dorm., mesmo bairro", valor: 540000, area: 110, f: { oferta: 0.9, local: 1.00, area: 1.02, padrao: 1.00 }, on: true },
    { desc: "Apto 3 dorm., bairro vizinho", valor: 620000, area: 128, f: { oferta: 0.9, local: 1.05, area: 0.98, padrao: 1.03 }, on: true },
    { desc: "Apto 2 dorm., mesma rua", valor: 480000, area: 95, f: { oferta: 0.9, local: 1.00, area: 1.05, padrao: 0.97 }, on: true },
    { desc: "Apto 3 dorm., oferta antiga", valor: 700000, area: 130, f: { oferta: 0.9, local: 1.02, area: 0.98, padrao: 1.05 }, on: true },
    { desc: "Apto 4 dorm., padrão alto", valor: 820000, area: 150, f: { oferta: 0.9, local: 1.03, area: 0.95, padrao: 1.10 }, on: true }
  ];
  AVAL.save();
}

// ---------- Aba: regressão linear múltipla ----------
function paneRegressao(pane) {
  const s = AVAL.load();
  const k = s.reg.vars.length;
  pane.innerHTML = `
    <div class="card">
      <p class="page-sub" style="margin:0 0 12px">Regressão linear múltipla (mínimos quadrados): modela o valor em função das características. Informe as variáveis, os dados de mercado e os valores do imóvel avaliando.</p>
      <div class="field-row" style="grid-template-columns:1fr auto">
        <div class="field" style="margin:0">
          <label for="avr-dep">Variável dependente (o que se quer estimar)</label>
          <input type="text" id="avr-dep" value="${esc(s.reg.dep)}">
        </div>
        <div class="field" style="margin:0">
          <label for="avr-nvars">Nº de variáveis</label>
          <select id="avr-nvars" class="sinapi-uf">${[1, 2, 3, 4].map(n => `<option value="${n}"${n === k ? " selected" : ""}>${n}</option>`).join("")}</select>
        </div>
      </div>
      <div class="aval-scroll">
        <table class="data aval-table" id="avr-table">
          <thead><tr>
            <th style="width:30px">#</th>
            ${s.reg.vars.map((v, j) => `<th style="min-width:110px"><input type="text" class="aval-in avr-vname" data-j="${j}" value="${esc(v)}" placeholder="Variável ${j + 1}"></th>`).join("")}
            <th style="min-width:130px;text-align:right">${esc(s.reg.dep)}</th>
            <th style="width:34px"></th>
          </tr></thead>
          <tbody id="avr-body">${rowsRegressaoHTML()}</tbody>
          <tfoot><tr style="background:var(--blue-light)">
            <td style="font-weight:600;color:var(--blue-dark)" title="Imóvel avaliando">A.</td>
            ${s.reg.vars.map((_, j) => `<td><input type="number" class="aval-in t-right avr-subj" data-j="${j}" step="any" value="${s.reg.subj[j] != null ? s.reg.subj[j] : ""}" placeholder="avaliando"></td>`).join("")}
            <td class="t-right" id="avr-pred-cell" style="font-weight:600;color:var(--blue-dark)">—</td>
            <td></td>
          </tr></tfoot>
        </table>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
        <button class="btn" id="avr-add"><i class="ti ti-plus"></i> Adicionar dado</button>
        <button class="btn primary" id="avr-calc"><i class="ti ti-equal"></i> Calcular regressão</button>
        <button class="btn" id="avr-exemplo"><i class="ti ti-flask"></i> Carregar exemplo</button>
        <button class="btn" id="avr-limpar"><i class="ti ti-eraser"></i> Limpar</button>
      </div>
    </div>
    <div id="avr-result"></div>
    ${avalDisclaimer}`;

  const body = document.getElementById("avr-body");
  document.getElementById("avr-dep").addEventListener("input", e => { s.reg.dep = e.target.value; AVAL.save(); });
  document.getElementById("avr-nvars").addEventListener("change", e => { ajustarNVars(+e.target.value); paneRegressao(pane); });
  pane.querySelectorAll(".avr-vname").forEach(inp => inp.addEventListener("input", e => { s.reg.vars[+e.target.dataset.j] = e.target.value; AVAL.save(); }));
  pane.querySelectorAll(".avr-subj").forEach(inp => inp.addEventListener("input", e => { s.reg.subj[+e.target.dataset.j] = e.target.value === "" ? null : parseFloat(e.target.value); AVAL.save(); }));
  body.addEventListener("input", e => {
    const tr = e.target.closest("tr[data-i]"); if (!tr) return;
    const i = +tr.dataset.i, c = e.target.dataset.c, val = e.target.value === "" ? null : parseFloat(e.target.value);
    if (c === "y") s.reg.rows[i].y = val;
    else if (c && c.indexOf("x-") === 0) s.reg.rows[i].x[+c.slice(2)] = val;
    AVAL.save();
  });
  body.addEventListener("click", e => {
    const btn = e.target.closest(".avr-del"); if (!btn) return;
    s.reg.rows.splice(+btn.closest("tr[data-i]").dataset.i, 1); AVAL.save(); paneRegressao(pane);
  });
  document.getElementById("avr-add").addEventListener("click", () => { s.reg.rows.push({ y: null, x: Array(k).fill(null) }); AVAL.save(); paneRegressao(pane); });
  document.getElementById("avr-calc").addEventListener("click", () => renderRegressaoResult());
  document.getElementById("avr-exemplo").addEventListener("click", () => { carregarExemploRegressao(); paneRegressao(pane); renderRegressaoResult(); });
  document.getElementById("avr-limpar").addEventListener("click", () => { s.reg.rows = []; s.reg.subj = Array(k).fill(null); AVAL.save(); paneRegressao(pane); });
}

function ajustarNVars(n) {
  const s = AVAL.load();
  const cur = s.reg.vars.length;
  if (n > cur) { for (let j = cur; j < n; j++) { s.reg.vars.push("Variável " + (j + 1)); s.reg.subj.push(null); s.reg.rows.forEach(r => r.x.push(null)); } }
  else if (n < cur) { s.reg.vars.length = n; s.reg.subj.length = n; s.reg.rows.forEach(r => (r.x.length = n)); }
  AVAL.save();
}

function rowsRegressaoHTML() {
  const s = AVAL.s;
  if (!s.reg.rows.length) return `<tr><td colspan="${s.reg.vars.length + 3}" style="color:var(--text-3);padding:14px">Nenhum dado ainda. Clique em "Adicionar dado" ou "Carregar exemplo".</td></tr>`;
  return s.reg.rows.map((r, i) => `
    <tr data-i="${i}">
      <td style="color:var(--text-3)">${i + 1}</td>
      ${r.x.map((xv, j) => `<td><input type="number" class="aval-in t-right" data-c="x-${j}" step="any" value="${xv != null ? xv : ""}"></td>`).join("")}
      <td><input type="number" class="aval-in t-right" data-c="y" step="any" value="${r.y != null ? r.y : ""}"></td>
      <td style="text-align:center"><button class="btn icon-only avr-del" aria-label="Remover dado ${i + 1}" title="Remover"><i class="ti ti-trash"></i></button></td>
    </tr>`).join("");
}

function renderRegressaoResult() {
  const out = document.getElementById("avr-result");
  if (!out) return;
  const r = computeRegressao();
  const predCell = document.getElementById("avr-pred-cell");
  if (r.error) {
    if (predCell) predCell.textContent = "—";
    out.innerHTML = `<div class="card" style="margin-top:14px"><p style="margin:0;font-size:14px"><i class="ti ti-alert-triangle" style="color:var(--coral)"></i> ${esc(r.error)}</p></div>`;
    return;
  }
  if (predCell) predCell.textContent = r.pred ? brl(r.pred.y) : "—";
  const eq = `${esc(r.dep)} = ${fmtNum(r.beta[0], 2)} ` +
    r.vars.map((v, j) => `${r.beta[j + 1] >= 0 ? "+ " : "− "}${fmtNum(Math.abs(r.beta[j + 1]), 4)}·(${esc(v)})`).join(" ");
  const coefRows = r.beta.map((b, j) => {
    const nome = j === 0 ? "Intercepto (β₀)" : esc(r.vars[j - 1]);
    const t = r.tBeta[j];
    const signif = isFinite(t) && Math.abs(t) >= 2 ? `<span class="pill pill-teal">|t|≥2</span>` : `<span class="pill pill-gray">baixa</span>`;
    return `<tr><td>${nome}</td><td class="t-right">${fmtNum(b, 4)}</td><td class="t-right">${isFinite(r.seBeta[j]) ? fmtNum(r.seBeta[j], 4) : "—"}</td><td class="t-right">${isFinite(t) ? fmtNum(t, 2) : "—"} ${signif}</td></tr>`;
  }).join("");
  out.innerHTML = `
    <div class="card" style="margin-top:14px">
      <h3 style="margin-bottom:10px"><i class="ti ti-chart-dots"></i> Modelo de regressão</h3>
      ${r.pred ? `<div class="result ok">
        <div><div class="r-label">Estimativa para o avaliando</div><div class="r-label" style="font-weight:400;opacity:.85">Intervalo ~95%: ${brl(r.pred.lo)} a ${brl(r.pred.hi)}</div></div>
        <div><span class="r-value">${brl(r.pred.y)}</span></div>
      </div>` : `<p class="page-sub">Preencha os valores do <strong>avaliando</strong> (linha "A.") para obter a estimativa.</p>`}
      <p style="font-size:13px;background:var(--bg-2,#f6f6f6);padding:10px 12px;border-radius:8px;overflow-x:auto"><strong>Equação:</strong> ${eq}</p>
      <table class="spec-table">
        <tr><td>Coeficiente de determinação (R²)</td><td>${fmtNum(r.r2 * 100, 2)}%</td></tr>
        <tr><td>R² ajustado</td><td>${isFinite(r.r2adj) ? fmtNum(r.r2adj * 100, 2) + "%" : "—"}</td></tr>
        <tr><td>Erro-padrão da estimativa</td><td>${brl(r.se)}</td></tr>
        <tr><td>Estatística F</td><td>${isFinite(r.F) ? fmtNum(r.F, 2) : "—"} (gl ${r.dfR}, ${r.dfE})</td></tr>
        <tr><td>Nº de dados / parâmetros</td><td>${r.n} / ${r.p}</td></tr>
        <tr><td>Grau de fundamentação (por nº de dados)</td><td>${r.grauFund ? esc(r.grauFund.desc) : "Abaixo do Grau I (n < 3·(k+1))"}</td></tr>
      </table>
      <h4 style="margin:14px 0 6px;font-size:14px">Coeficientes</h4>
      <div class="aval-scroll"><table class="data" style="font-size:13px">
        <thead><tr><th>Variável</th><th class="t-right">Coef.</th><th class="t-right">Erro-padrão</th><th class="t-right">t (signif.)</th></tr></thead>
        <tbody>${coefRows}</tbody>
      </table></div>
      <p class="page-sub" style="margin:10px 0 0">|t| ≥ 2 indica variável estatisticamente relevante (aprox.). Banda da estimativa é aproximada (t≈2). Confira os pressupostos da regressão e os graus da NBR 14653.</p>
      <p class="page-sub" style="margin:6px 0 0"><i class="ti ti-arrow-right"></i> Use no <a href="#" onclick="AVAL.s.laudo.metodo='regressao';AVAL.save();renderAvaliacao('laudo');return false;">Laudo</a>.</p>
    </div>`;
}

function carregarExemploRegressao() {
  const s = AVAL.load();
  s.reg.dep = "Valor total (R$)";
  s.reg.vars = ["Área (m²)", "Idade (anos)"];
  s.reg.subj = [120, 5];
  // Exemplo com relação realista: ~R$ 4.000/m² e ~−R$ 8.000 por ano de idade (+ leve ruído).
  s.reg.rows = [
    { y: 478000, x: [110, 8] }, { y: 585000, x: [128, 3] }, { y: 386000, x: [95, 12] },
    { y: 604000, x: [130, 2] }, { y: 689000, x: [150, 1] }, { y: 342000, x: [90, 15] },
    { y: 527000, x: [118, 6] }, { y: 418000, x: [100, 10] },
    { y: 625000, x: [140, 4] }, { y: 466000, x: [105, 7] }
  ];
  AVAL.save();
}

// ---------- Aba: laudo ----------
function paneLaudo(pane) {
  const s = AVAL.load();
  const L = s.laudo;
  const fld = (id, label, ph) => `<div class="field"><label for="avl-${id}">${label}</label><input type="text" id="avl-${id}" value="${esc(L[id] || "")}" placeholder="${esc(ph || "")}"></div>`;
  pane.innerHTML = `
    <div class="card no-print">
      <h3 style="margin-bottom:10px">Dados do laudo</h3>
      <div class="field-row">
        ${fld("solicitante", "Solicitante", "Nome / CPF-CNPJ")}
        ${fld("finalidade", "Finalidade", "ex.: compra e venda")}
      </div>
      <div class="field"><label for="avl-endereco">Endereço do imóvel avaliando</label><input type="text" id="avl-endereco" value="${esc(s.subj.endereco || "")}" placeholder="Endereço completo"></div>
      <div class="field-row">
        ${fld("rt", "Responsável técnico", "Nome do eng./arquiteto")}
        ${fld("crea", "CREA/CAU nº", "")}
      </div>
      <div class="field-row">
        ${fld("art", "ART/RRT nº", "")}
        ${fld("cidade", "Cidade", "")}
      </div>
      <div class="field-row">
        <div class="field"><label for="avl-data">Data</label><input type="date" id="avl-data" value="${esc(L.data || "")}"></div>
        <div class="field"><label for="avl-metodo">Método empregado</label>
          <select id="avl-metodo" class="sinapi-uf">
            <option value="fatores"${L.metodo === "fatores" ? " selected" : ""}>Comparativo — tratamento por fatores</option>
            <option value="regressao"${L.metodo === "regressao" ? " selected" : ""}>Comparativo — regressão linear</option>
          </select>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">
        <button class="btn primary" id="avl-print"><i class="ti ti-printer"></i> Imprimir / salvar PDF</button>
      </div>
    </div>
    <div id="avl-preview"></div>`;
  const wire = (id, key, obj) => document.getElementById("avl-" + id).addEventListener("input", e => { obj[key] = e.target.value; AVAL.save(); renderLaudoPreview(); });
  ["solicitante", "finalidade", "rt", "crea", "art", "cidade", "data"].forEach(id => wire(id, id, L));
  document.getElementById("avl-endereco").addEventListener("input", e => { s.subj.endereco = e.target.value; AVAL.save(); renderLaudoPreview(); });
  document.getElementById("avl-metodo").addEventListener("change", e => { L.metodo = e.target.value; AVAL.save(); renderLaudoPreview(); });
  document.getElementById("avl-print").addEventListener("click", () => window.print());
  renderLaudoPreview();
}

function renderLaudoPreview() {
  const host = document.getElementById("avl-preview");
  if (!host) return;
  const s = AVAL.load(), L = s.laudo;
  const hoje = L.data ? new Date(L.data + "T00:00").toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR");
  const linha = (rotulo, valor) => `<tr><td>${esc(rotulo)}</td><td>${valor}</td></tr>`;
  let metodoBloco = "", resultadoBloco = "";

  if (L.metodo === "regressao") {
    const r = computeRegressao();
    metodoBloco = `<p>Empregou-se o <strong>método comparativo direto de dados de mercado</strong> com <strong>tratamento por regressão linear múltipla</strong> (inferência estatística), modelando ${esc(s.reg.dep)} em função de ${s.reg.vars.map(v => esc(v)).join(", ")}.</p>`;
    if (r.error) {
      resultadoBloco = `<p style="color:#922b21">${esc(r.error)} Complete os dados na aba Regressão.</p>`;
    } else {
      metodoBloco += `<table class="spec-table" style="margin:8px 0">
        ${linha("Nº de dados de mercado", r.n)}
        ${linha("R² / R² ajustado", `${fmtNum(r.r2 * 100, 2)}% / ${isFinite(r.r2adj) ? fmtNum(r.r2adj * 100, 2) + "%" : "—"}`)}
        ${linha("Erro-padrão da estimativa", brl(r.se))}
        ${linha("Grau de fundamentação", r.grauFund ? esc(r.grauFund.desc) : "Abaixo do Grau I")}</table>`;
      resultadoBloco = r.pred
        ? `<p>Pela aplicação do modelo às características do imóvel avaliando, o <strong>valor de mercado</strong> resulta em:</p>
           <p class="aval-laudo-val">${brl(r.pred.y)}</p>
           <p style="font-size:13px">Intervalo de confiança aproximado (~95%): ${brl(r.pred.lo)} a ${brl(r.pred.hi)}.</p>`
        : `<p style="color:#922b21">Informe os valores do imóvel avaliando na aba Regressão para concluir a estimativa.</p>`;
    }
  } else {
    const f = computeFatores();
    metodoBloco = `<p>Empregou-se o <strong>método comparativo direto de dados de mercado</strong> com <strong>tratamento por fatores</strong>, homogeneizando ${f.stats ? f.stats.n : 0} dado(s) de mercado por meio dos fatores de ${AVAL_FATORES.map(x => x.label.toLowerCase()).join(", ")} (referência = 1,000).</p>`;
    if (!f.stats) {
      resultadoBloco = `<p style="color:#922b21">Informe ao menos uma amostra válida na aba Comparativo (fatores) para concluir a avaliação.</p>`;
    } else {
      metodoBloco += `<table class="spec-table" style="margin:8px 0">
        ${linha("Nº de dados utilizados", f.stats.n)}
        ${linha("Valor unitário médio homogeneizado", brl(f.stats.mean) + " /m²")}
        ${linha("Coeficiente de variação (CV)", fmtNum(f.stats.cv * 100, 1) + "%")}
        ${linha("Campo de arbítrio (±" + fmtNum(AVAL_ARBITRIO * 100, 0) + "%)", brl(f.arbitrio.min) + " a " + brl(f.arbitrio.max) + " /m²")}
        ${linha("Grau de fundamentação", f.grauFund ? esc(f.grauFund.desc) : "Insuficiente")}
        ${linha("Grau de precisão", f.grauPrec ? esc(f.grauPrec.desc) : "Fora dos graus")}</table>`;
      resultadoBloco = f.valorTotal != null
        ? `<p>Considerando a área de ${fmtNum(f.area)} m² do imóvel avaliando, o <strong>valor de mercado</strong> resulta em:</p>
           <p class="aval-laudo-val">${brl(f.valorTotal)}</p>
           <p style="font-size:13px">Valor unitário de referência: ${brl(f.stats.mean)} /m².</p>`
        : `<p>Valor unitário de mercado: <span class="aval-laudo-val" style="font-size:20px">${brl(f.stats.mean)} /m²</span>. Informe a área do avaliando para o valor total.</p>`;
    }
  }

  host.innerHTML = `
    <div class="card laudo-print" style="margin-top:14px">
      <div class="laudo-print-head"><span class="t">LAUDO DE AVALIAÇÃO DE IMÓVEL — VALOR DE MERCADO</span><span class="m">Conforme diretrizes da ABNT NBR 14653 · gerado pelo Civilbook em ${hoje}</span></div>
      <h3 style="font-size:15px;margin:4px 0 6px">1. Identificação</h3>
      <table class="spec-table">
        ${linha("Solicitante", esc(L.solicitante || "—"))}
        ${linha("Finalidade", esc(L.finalidade || "—"))}
        ${linha("Imóvel avaliando", esc(s.subj.endereco || "—"))}
        ${linha("Responsável técnico", esc(L.rt || "—") + (L.crea ? " — CREA/CAU " + esc(L.crea) : ""))}
        ${linha("ART/RRT", esc(L.art || "—"))}
        ${linha("Data", hoje + (L.cidade ? " · " + esc(L.cidade) : ""))}
      </table>
      <h3 style="font-size:15px;margin:14px 0 6px">2. Objetivo e pressupostos</h3>
      <p>Determinar o valor de mercado do imóvel para a finalidade indicada, com base em pesquisa de dados de mercado e tratamento conforme a NBR 14653. Pressupõe-se a veracidade das informações fornecidas e a inexistência de ônus não declarados.</p>
      <h3 style="font-size:15px;margin:14px 0 6px">3. Metodologia e tratamento</h3>
      ${metodoBloco}
      <h3 style="font-size:15px;margin:14px 0 6px">4. Resultado</h3>
      ${resultadoBloco}
      <h3 style="font-size:15px;margin:14px 0 6px">5. Ressalvas</h3>
      <p style="font-size:13px">Avaliação de apoio, válida na data de referência e para a finalidade declarada. O grau de fundamentação/precisão depende da quantidade e qualidade dos dados. Este documento deve ser conferido e assinado por profissional habilitado (engenheiro/arquiteto) com a respectiva ART/RRT, sob pena de não ter validade técnica.</p>
      <p style="margin-top:26px">${esc(L.cidade || "[Cidade]")}, ${hoje}.</p>
      <p style="margin-top:30px">_________________________________________<br>${esc(L.rt || "[Responsável técnico]")}${L.crea ? " — CREA/CAU " + esc(L.crea) : " — CREA/CAU [nº]"}</p>
    </div>`;
}

if (typeof window !== "undefined") { window.AVAL = AVAL; window.renderAvaliacao = renderAvaliacao; }
