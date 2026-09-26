// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// e24 — Cronograma de OBRA (físico-financeiro). Distinto do cronograma de manutenção NBR 5674 (e10).
// Etapas/atividades com início, duração, valor e avanço → Gantt simples + Curva S (previsto ×
// realizado). Offline-first (cbColecao); atividades ficam em JSONB num único registro (como o RDO).
// Vínculo opcional ao Projeto (f3). PRO, como RDO/Projetos. Imprimível (b1). Apoio — não substitui
// o planejamento do RT. Curva S é o cronograma do PMBOK (f18, cap. 6); IA a partir de EAP/orçamento
// (e23/f5/f16) é evolução futura — por ora etapas-modelo editáveis + avanço manual (alimentação
// automática pelo RDO/e4 vem depois).

function rowToCrono(r) {
  return { id: r.id, projeto_id: r.projeto_id || "", nome: r.nome || "", inicio: r.inicio || "", atividades: r.atividades || [], obs: r.obs || "", dono: r.user_id };
}
function cronoToRow(d) {
  return { id: d.id, user_id: d.dono || CBStore.uid(), projeto_id: d.projeto_id || null, nome: d.nome || "Cronograma", inicio: d.inicio || null, atividades: d.atividades || [], obs: d.obs || null };
}
const CRONO = cbColecao("cronogramas", "cb-cronogramas", rowToCrono, cronoToRow);
async function cronoReady() { await CRONO.ready(); }

// WBS típica de obra (quick-start editável). Durações em dias (sequenciais).
const CRONO_MODELO = [
  { etapa: "Preliminares", nome: "Serviços preliminares e canteiro", dur: 15 },
  { etapa: "Infraestrutura", nome: "Fundações", dur: 30 },
  { etapa: "Superestrutura", nome: "Estrutura (pilares, vigas, lajes)", dur: 45 },
  { etapa: "Vedações", nome: "Alvenaria e vedações", dur: 30 },
  { etapa: "Cobertura", nome: "Cobertura", dur: 15 },
  { etapa: "Instalações", nome: "Instalações elétricas e hidrossanitárias", dur: 30 },
  { etapa: "Acabamentos", nome: "Revestimentos e contrapisos", dur: 30 },
  { etapa: "Acabamentos", nome: "Esquadrias", dur: 15 },
  { etapa: "Acabamentos", nome: "Pintura", dur: 20 },
  { etapa: "Entrega", nome: "Limpeza final e entrega", dur: 10, marco: true }
];

// ── Datas/format ──────────────────────────────────────────────────────────
function cParse(iso) { return iso ? new Date(iso + "T12:00:00") : null; }
function cHoje() { return new Date().toISOString().slice(0, 10); }
function cAddDias(iso, n) { const d = cParse(iso); if (!d) return iso; d.setDate(d.getDate() + (Number(n) || 0)); return d.toISOString().slice(0, 10); }
function cFimISO(a) { return a.marco ? a.inicio : cAddDias(a.inicio, Math.max(0, Number(a.dur) || 0)); }
function cFmtBR(iso) { const d = cParse(iso); return d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"; }
function cBRL(n) { return (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function cCompact(v) { const a = Math.abs(v), s = v < 0 ? "−" : ""; if (a >= 1e6) return s + "R$ " + (a / 1e6).toFixed(1).replace(".", ",") + "M"; if (a >= 1e3) return s + "R$ " + Math.round(a / 1e3) + "k"; return s + "R$ " + Math.round(a); }
function cEscClip(s, n) { s = String(s == null ? "" : s); if (s.length > n) s = s.slice(0, n - 1) + "…"; return esc(s); }
function cronoObraNome(c) { if (c.projeto_id && typeof PROJ !== "undefined" && PROJ.get(c.projeto_id)) return PROJ.get(c.projeto_id).nome; return c.nome || "Obra"; }

// ════════════════════════════ Render ════════════════════════════
async function renderCronograma(param) {
  if (!planoEhPro()) return renderCronoUpsell();
  if (!CRONO._loaded) { app.innerHTML = CBStore.loadingCard("Carregando os cronogramas…"); await cronoReady(); }
  if (typeof PROJ !== "undefined" && !PROJ._loaded && typeof proj2Ready === "function") { try { await proj2Ready(); } catch (e) {} }
  app.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <h2 class="page-title" style="margin-right:auto">Cronograma de obra</h2>
      ${typeof EXEMPLO !== "undefined" ? EXEMPLO.botaoBarraHTML("cronograma") : ""}
      <button class="btn" onclick="cbAssessor('abrirCom','cronograma')" title="Abrir o assessor já sabendo que você está no Cronograma (f40)"><i class="ti ti-sparkles" aria-hidden="true"></i> Perguntar à IA</button>
    </div>
    <p class="page-sub">Físico-financeiro: etapas, Gantt e curva S (previsto × realizado). Material de apoio — não substitui o planejamento do responsável técnico.</p>
    <div id="crono-body"></div>`;
  if (param && CRONO.get(param)) renderCronoView(param);
  else renderCronoLista();
}

function renderCronoUpsell() {
  app.innerHTML = `
    <div class="card" style="max-width:560px;margin:40px auto;text-align:center;padding:36px">
      <div class="card-icon" style="background:var(--blue-light);color:var(--blue);margin:0 auto 16px"><i class="ti ti-timeline-event"></i></div>
      <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">Cronograma de obra é um recurso PRO</h2>
      <p style="color:var(--text-2);margin-bottom:20px">Planeje a obra com etapas, Gantt e curva S físico-financeiro (previsto × realizado), imprimível.</p>
      ${typeof cbTesteBotaoHTML === "function" ? cbTesteBotaoHTML('cronograma', null, 'btn primary lg') : ""}
      ${typeof EXEMPLO !== "undefined" ? EXEMPLO.botaoUpsellHTML("cronograma") : ""}
    </div>`;
}

function renderCronoLista() {
  const body = document.getElementById("crono-body");
  if (!body) return;
  const itens = CRONO.listar().slice().sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
  body.innerHTML = `
    <div style="margin-bottom:14px"><button class="btn primary" onclick="cronoNovo()"><i class="ti ti-plus"></i> Novo cronograma</button></div>
    ${itens.length === 0 ? (typeof EXEMPLO !== "undefined" ? EXEMPLO.vazioHTML("cronograma", {
        icone: "ti-timeline-event", titulo: "Planeje a obra e acompanhe o avanço",
        texto: "Comece pela WBS-modelo (10 etapas típicas, editáveis) e o Civilbook monta o Gantt e a curva S físico-financeira — previsto contra realizado, sem planilha.",
        ctaLabel: "Criar cronograma pela WBS-modelo", ctaAcao: "cronoNovo()",
      }) : `<p class="page-sub" style="text-align:center;padding:18px">Nenhum cronograma ainda. Crie um e comece pela WBS-modelo, editável.</p>`)
      : itens.map(c => {
        const t = cronoTotais(c);
        return `<div class="card clickable" onclick="navigate('cronograma','${c.id}')" style="display:flex;justify-content:space-between;align-items:center;gap:12px">
          <div><div style="font-weight:600">${esc(c.nome || "Cronograma")}</div>
            <div class="page-sub" style="margin:2px 0 0;font-size:12px">${esc(cronoObraNome(c))} · ${t.n} atividades · avanço ${t.avancoPct.toFixed(0)}%${t.totalV > 0 ? " · " + cBRL(t.totalV) : ""}</div></div>
          <i class="ti ti-chevron-right" style="color:var(--text-3)"></i></div>`;
      }).join("")}`;
}

function cronoNovo() {
  const projs = (typeof PROJ !== "undefined") ? PROJ.listar() : [];
  const opts = `<option value="">— sem projeto vinculado —</option>` + projs.map(p => `<option value="${esc(p.id)}">${esc(p.nome)}</option>`).join("");
  document.querySelectorAll(".cb-modal-ov").forEach(e => e.remove());
  const ov = document.createElement("div"); ov.className = "cb-modal-ov"; ov.onclick = e => { if (e.target === ov) ov.remove(); };
  ov.innerHTML = `<div class="card cb-modal-box" role="dialog" aria-modal="true" style="max-width:520px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0;font-size:17px">Novo cronograma</h3><button class="btn icon-only" aria-label="Fechar" onclick="this.closest('.cb-modal-ov').remove()"><i class="ti ti-x"></i></button></div>
    <div class="field"><label for="cr-nome">Nome</label><input id="cr-nome" placeholder="Ex.: Residência Silva — execução"></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <div class="field" style="flex:1;min-width:150px"><label for="cr-inicio">Início da obra</label><input type="date" id="cr-inicio" value="${cHoje()}"></div>
      <div class="field" style="flex:1;min-width:180px"><label for="cr-proj">Projeto (opcional)</label><select id="cr-proj" class="sinapi-uf">${opts}</select></div>
    </div>
    <label style="display:flex;gap:8px;align-items:center;font-size:13px;margin-top:6px"><input type="checkbox" id="cr-modelo" checked> Começar com a WBS-modelo de obra (editável)</label>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button class="btn" onclick="this.closest('.cb-modal-ov').remove()">Cancelar</button>
      <button class="btn primary" onclick="cronoCriar()"><i class="ti ti-check"></i> Criar</button>
    </div></div>`;
  document.body.appendChild(ov);
  setTimeout(() => { const n = document.getElementById("cr-nome"); if (n) n.focus(); }, 30);
}

function cronoCriar() {
  const nome = (document.getElementById("cr-nome").value || "").trim() || "Cronograma de obra";
  const inicio = document.getElementById("cr-inicio").value || cHoje();
  const projeto_id = document.getElementById("cr-proj").value || "";
  const usarModelo = document.getElementById("cr-modelo").checked;
  const id = CBStore.uuid();
  const c = { id, nome, inicio, projeto_id, atividades: [], obs: "", dono: CBStore.uid() };
  if (usarModelo) c.atividades = cronoModeloAtividades(inicio);
  CRONO.upsert(c);
  document.querySelectorAll(".cb-modal-ov").forEach(e => e.remove());
  navigate("cronograma", id);
}

// Monta atividades sequenciais a partir da WBS-modelo (cada uma começa no fim da anterior).
function cronoModeloAtividades(inicio) {
  let d = inicio || cHoje();
  return CRONO_MODELO.map(m => {
    const a = { id: CBStore.uuid(), etapa: m.etapa, nome: m.nome, inicio: d, dur: m.dur, valor: 0, avanco: 0, marco: !!m.marco, dep: "" };
    d = cAddDias(d, m.marco ? 0 : m.dur);
    return a;
  });
}

function renderCronoView(id) {
  const body = document.getElementById("crono-body");
  const c = CRONO.get(id);
  if (!body || !c) { renderCronoLista(); return; }
  const projs = (typeof PROJ !== "undefined") ? PROJ.listar() : [];
  const projOpts = `<option value="">— sem projeto —</option>` + projs.map(p => `<option value="${esc(p.id)}"${p.id === c.projeto_id ? " selected" : ""}>${esc(p.nome)}</option>`).join("");
  body.innerHTML = `
    <div class="no-print" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
      <button class="back-link" onclick="navigate('cronograma')"><i class="ti ti-arrow-left"></i> Todos os cronogramas</button>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn sm" onclick="window.print()"><i class="ti ti-printer"></i> Imprimir / PDF</button>
        <button class="btn sm" style="color:#b3261e" onclick="cronoExcluir('${c.id}')"><i class="ti ti-trash"></i> Excluir</button>
      </div>
    </div>
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
        <div class="field" style="flex:2;min-width:200px"><label>Nome</label><input value="${esc(c.nome)}" onchange="cronoMeta('${c.id}','nome',this.value)"></div>
        <div class="field" style="min-width:150px"><label>Início da obra</label><input type="date" value="${esc(c.inicio)}" onchange="cronoMeta('${c.id}','inicio',this.value)"></div>
        <div class="field" style="flex:1;min-width:170px"><label>Projeto vinculado</label><select class="sinapi-uf" onchange="cronoMeta('${c.id}','projeto_id',this.value)">${projOpts}</select></div>
      </div>
    </div>
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
        <h3 class="fin-h" style="margin:0">Atividades</h3>
        <div class="no-print" style="display:flex;gap:8px"><button class="btn sm" onclick="cronoAtvAdd('${c.id}')"><i class="ti ti-plus"></i> Atividade</button><button class="btn sm" onclick="cronoSeed('${c.id}')" title="Inserir a WBS-modelo de obra (acrescenta às atuais)"><i class="ti ti-list-check"></i> Etapas-modelo</button></div>
      </div>
      ${cronoTabela(c)}
    </div>
    <div id="crono-visuais">${cronoVisuaisHTML(c)}</div>
    <p class="page-sub" style="margin-top:12px;font-size:12px"><i class="ti ti-info-circle"></i> A curva S vira <strong>físico-financeira</strong> quando há valores; sem valores, mostra o avanço <strong>físico</strong> (%). O realizado é o avanço informado em cada atividade — a alimentação automática pelo Diário de Obra (e4) e a geração por IA a partir da EAP/orçamento (e23) são evoluções previstas no plano.</p>`;
}

function cronoTabela(c) {
  const ats = c.atividades || [];
  if (!ats.length) return `<p class="page-sub" style="margin:0">Sem atividades. Adicione uma ou use as <strong>etapas-modelo</strong>.</p>`;
  const linhas = ats.map(a => `
    <tr>
      <td><input value="${esc(a.etapa || "")}" onchange="cronoAtvSet('${c.id}','${a.id}','etapa',this.value)" style="min-width:90px" aria-label="Etapa"></td>
      <td><input value="${esc(a.nome || "")}" onchange="cronoAtvSet('${c.id}','${a.id}','nome',this.value)" style="min-width:150px" aria-label="Atividade"></td>
      <td><input type="date" value="${esc(a.inicio || "")}" onchange="cronoAtvSet('${c.id}','${a.id}','inicio',this.value)" aria-label="Início"></td>
      <td><input type="number" min="0" step="1" value="${a.marco ? "" : (a.dur != null ? a.dur : "")}" ${a.marco ? "disabled" : ""} onchange="cronoAtvSet('${c.id}','${a.id}','dur',this.value)" style="width:64px" aria-label="Duração em dias"></td>
      <td><input type="number" min="0" step="0.01" value="${a.valor != null ? a.valor : ""}" onchange="cronoAtvSet('${c.id}','${a.id}','valor',this.value)" style="width:100px" aria-label="Valor"></td>
      <td><input type="number" min="0" max="100" step="1" value="${a.avanco != null ? a.avanco : 0}" onchange="cronoAtvSet('${c.id}','${a.id}','avanco',this.value)" style="width:64px" aria-label="Avanço %"></td>
      <td style="text-align:center"><input type="checkbox" ${a.marco ? "checked" : ""} onchange="cronoAtvSet('${c.id}','${a.id}','marco',this.checked)" aria-label="Marco"></td>
      <td class="no-print"><button class="btn sm icon-only" title="Remover" onclick="cronoAtvRemove('${c.id}','${a.id}')"><i class="ti ti-x"></i></button></td>
    </tr>`).join("");
  return `<div style="overflow-x:auto"><table class="data" style="min-width:680px"><thead><tr>
    <th>Etapa</th><th>Atividade</th><th>Início</th><th>Dur (d)</th><th>Valor</th><th>Avanço</th><th>Marco</th><th class="no-print"></th>
    </tr></thead><tbody>${linhas}</tbody></table></div>`;
}

function cronoVisuaisHTML(c) {
  const t = cronoTotais(c);
  return `
    <div class="grid grid-3" style="margin-bottom:14px">
      ${cronoStat("Valor total", t.totalV > 0 ? cBRL(t.totalV) : "—", "#185FA5")}
      ${cronoStat("Avanço (ponderado)", t.avancoPct.toFixed(0) + "%", t.avancoPct >= t.previstoPct ? "#1a7a4a" : "#c97a00")}
      ${cronoStat("Previsto até hoje", t.previstoPct.toFixed(0) + "%", "#6B6A65")}
    </div>
    <div class="card" style="margin-bottom:14px"><h3 class="fin-h">Gantt</h3>${cronoGantt(c)}</div>
    <div class="card"><h3 class="fin-h">Curva S — previsto × realizado</h3>${cronoCurvaS(c)}
      <p class="page-sub" style="margin:6px 0 0;font-size:11px"><span style="color:#185FA5;font-weight:600">— previsto</span> · <span style="color:#0e9488;font-weight:600">- - realizado (até hoje)</span></p>
    </div>`;
}
function cronoRenderVisuais(id) { const c = CRONO.get(id), host = document.getElementById("crono-visuais"); if (c && host) host.innerHTML = cronoVisuaisHTML(c); }
function cronoStat(lbl, val, cor) { return `<div class="card" style="padding:12px 14px"><div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em">${lbl}</div><div style="font-size:18px;font-weight:700;color:${cor || "var(--text)"}">${val}</div></div>`; }

// ── Mutações ────────────────────────────────────────────────────────────────
function cronoMeta(id, campo, valor) { const c = CRONO.get(id); if (!c) return; c[campo] = valor; CRONO.upsert(c); if (campo === "nome" || campo === "projeto_id") { /* só metadados */ } cronoRenderVisuais(id); }
function cronoAtvAdd(id) {
  const c = CRONO.get(id); if (!c) return;
  const ult = (c.atividades || [])[c.atividades.length - 1];
  const inicio = ult ? cFimISO(ult) : (c.inicio || cHoje());
  c.atividades = (c.atividades || []).concat([{ id: CBStore.uuid(), etapa: "", nome: "Nova atividade", inicio, dur: 7, valor: 0, avanco: 0, marco: false, dep: "" }]);
  CRONO.upsert(c); renderCronoView(id);
}
function cronoSeed(id) {
  const c = CRONO.get(id); if (!c) return;
  c.atividades = (c.atividades || []).concat(cronoModeloAtividades(c.inicio || cHoje()));
  CRONO.upsert(c); renderCronoView(id);
}
function cronoAtvRemove(id, atvId) {
  const c = CRONO.get(id); if (!c) return;
  c.atividades = (c.atividades || []).filter(a => a.id !== atvId);
  CRONO.upsert(c); renderCronoView(id);
}
function cronoAtvSet(id, atvId, campo, valor) {
  const c = CRONO.get(id); if (!c) return;
  const a = (c.atividades || []).find(x => x.id === atvId); if (!a) return;
  if (campo === "marco") a.marco = !!valor;
  else if (campo === "dur" || campo === "valor" || campo === "avanco") a[campo] = Math.max(0, Number(valor) || 0);
  else a[campo] = valor;
  if (campo === "avanco") a.avanco = Math.min(100, a.avanco);
  CRONO.upsert(c);
  cronoRenderVisuais(id);   // atualiza só os gráficos/totais (mantém o foco nos inputs)
}
async function cronoExcluir(id) {
  if (!await cbConfirmar("Excluir este cronograma? A ação não pode ser desfeita.")) return;
  CRONO.remover(id); navigate("cronograma");
}

// ── Cálculo (totais + frações) ───────────────────────────────────────────────
function cronoFrac(a, t) {
  const s = cParse(a.inicio) && cParse(a.inicio).getTime(), e = cParse(cFimISO(a)) && cParse(cFimISO(a)).getTime();
  if (s == null) return 0;
  if (a.marco || e <= s) return t >= s ? 1 : 0;
  return Math.max(0, Math.min(1, (t - s) / (e - s)));
}
function cronoTotais(c) {
  const ats = (c.atividades || []).filter(a => a.inicio);
  const totalV = ats.reduce((s, a) => s + (Number(a.valor) || 0), 0);
  const fin = totalV > 0;
  const peso = a => fin ? (Number(a.valor) || 0) : 1;
  const somaPeso = ats.reduce((s, a) => s + peso(a), 0) || 1;
  const avancoPct = ats.reduce((s, a) => s + peso(a) * Math.max(0, Math.min(100, Number(a.avanco) || 0)) / 100, 0) / somaPeso * 100;
  const hoje = Date.now();
  const previstoPct = ats.reduce((s, a) => s + peso(a) * cronoFrac(a, hoje), 0) / somaPeso * 100;
  return { n: (c.atividades || []).length, totalV, avancoPct: avancoPct || 0, previstoPct: previstoPct || 0, fin };
}

// ── Gantt (SVG) ──────────────────────────────────────────────────────────────
function cronoGantt(c) {
  const ats = (c.atividades || []).filter(a => a.inicio);
  if (!ats.length) return `<p class="page-sub" style="margin:0">Adicione atividades para ver o Gantt.</p>`;
  let t0 = Infinity, t1 = -Infinity;
  ats.forEach(a => { const s = cParse(a.inicio).getTime(), e = cParse(cFimISO(a)).getTime(); t0 = Math.min(t0, s); t1 = Math.max(t1, e); });
  if (!(t1 > t0)) t1 = t0 + 7 * 864e5;
  const W = 720, rowH = 22, padT = 22, padB = 22, padL = 8, padR = 10, labelW = 180;
  const H = padT + padB + ats.length * rowH;
  const xOf = t => labelW + ((t - t0) / (t1 - t0)) * (W - labelW - padR);
  const hoje = Date.now();
  const rows = ats.map((a, i) => {
    const y = padT + i * rowH;
    const s = cParse(a.inicio).getTime(), e = cParse(cFimISO(a)).getTime();
    const av = Math.max(0, Math.min(100, Number(a.avanco) || 0));
    const lbl = `<text x="${padL}" y="${(y + 13).toFixed(1)}" font-size="10.5" fill="var(--text-2)">${cEscClip(a.nome || a.etapa || "—", 28)}</text>`;
    let bar;
    if (a.marco) { const mx = xOf(s); bar = `<path d="M ${mx.toFixed(1)} ${(y + 3).toFixed(1)} l 7 7 l -7 7 l -7 -7 z" fill="#7c3aed"/>`; }
    else {
      const x1 = xOf(s), w = Math.max(2, xOf(e) - x1);
      bar = `<rect x="${x1.toFixed(1)}" y="${(y + 4).toFixed(1)}" width="${w.toFixed(1)}" height="12" rx="2" fill="#cbd5e1"/>` +
        `<rect x="${x1.toFixed(1)}" y="${(y + 4).toFixed(1)}" width="${(w * av / 100).toFixed(1)}" height="12" rx="2" fill="#185FA5"/>`;
    }
    return lbl + bar;
  }).join("");
  const hojeX = (hoje >= t0 && hoje <= t1) ? xOf(hoje) : null;
  const hojeLine = hojeX != null ? `<line x1="${hojeX.toFixed(1)}" y1="${padT - 4}" x2="${hojeX.toFixed(1)}" y2="${(H - padB + 4).toFixed(1)}" stroke="#b3261e" stroke-width="1" stroke-dasharray="3 3"/><text x="${hojeX.toFixed(1)}" y="13" font-size="9" fill="#b3261e" text-anchor="middle">hoje</text>` : "";
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Gantt do cronograma da obra">
    <line x1="${labelW}" y1="${padT - 4}" x2="${labelW}" y2="${(H - padB + 4).toFixed(1)}" stroke="var(--border)"/>
    ${hojeLine}${rows}
    <text x="${labelW}" y="${(H - 6).toFixed(1)}" font-size="9.5" fill="var(--text-3)">${cFmtBR(new Date(t0).toISOString().slice(0, 10))}</text>
    <text x="${(W - padR).toFixed(1)}" y="${(H - 6).toFixed(1)}" font-size="9.5" fill="var(--text-3)" text-anchor="end">${cFmtBR(new Date(t1).toISOString().slice(0, 10))}</text>
  </svg>`;
}

// ── Curva S (SVG) — previsto × realizado (cumulativo %) ───────────────────────
function cronoCurvaS(c) {
  const ats = (c.atividades || []).filter(a => a.inicio);
  if (!ats.length) return `<p class="page-sub" style="margin:0">Adicione atividades para ver a curva S.</p>`;
  let t0 = Infinity, t1 = -Infinity;
  ats.forEach(a => { const s = cParse(a.inicio).getTime(), e = cParse(cFimISO(a)).getTime(); t0 = Math.min(t0, s); t1 = Math.max(t1, e); });
  if (!(t1 > t0)) t1 = t0 + 7 * 864e5;
  const totalV = ats.reduce((s, a) => s + (Number(a.valor) || 0), 0), fin = totalV > 0;
  const peso = a => fin ? (Number(a.valor) || 0) : 1;
  const somaPeso = ats.reduce((s, a) => s + peso(a), 0) || 1;
  const N = 24, hoje = Date.now();
  const W = 720, H = 200, padB = 24, padT = 18, padL = 30, padR = 10;
  const xOf = i => padL + (i / N) * (W - padL - padR);
  const yOf = v => padT + (1 - v / 100) * (H - padB - padT);
  const prev = [], real = [];
  for (let i = 0; i <= N; i++) {
    const t = t0 + (t1 - t0) * i / N;
    prev.push(ats.reduce((s, a) => s + peso(a) * cronoFrac(a, t), 0) / somaPeso * 100);
    real.push(t > hoje ? null : ats.reduce((s, a) => s + peso(a) * Math.min(cronoFrac(a, t), Math.max(0, Math.min(100, Number(a.avanco) || 0)) / 100), 0) / somaPeso * 100);
  }
  const prevStr = prev.map((v, i) => xOf(i).toFixed(1) + "," + yOf(v).toFixed(1)).join(" ");
  const realPts = real.map((v, i) => v == null ? null : (xOf(i).toFixed(1) + "," + yOf(v).toFixed(1))).filter(Boolean);
  const area = `${xOf(0).toFixed(1)},${yOf(0).toFixed(1)} ${prevStr} ${xOf(N).toFixed(1)},${yOf(0).toFixed(1)}`;
  const hojeX = (hoje >= t0 && hoje <= t1) ? (padL + ((hoje - t0) / (t1 - t0)) * (W - padL - padR)) : null;
  const grid = [0, 25, 50, 75, 100].map(p => `<line x1="${padL}" y1="${yOf(p).toFixed(1)}" x2="${(W - padR).toFixed(1)}" y2="${yOf(p).toFixed(1)}" stroke="var(--border)" stroke-width="0.5" opacity="0.6"/><text x="${(padL - 4).toFixed(1)}" y="${(yOf(p) + 3).toFixed(1)}" font-size="9" fill="var(--text-3)" text-anchor="end">${p}%</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Curva S: previsto e realizado">
    ${grid}
    <polygon points="${area}" fill="#185FA5" opacity="0.08"/>
    <polyline points="${prevStr}" fill="none" stroke="#185FA5" stroke-width="2"/>
    ${realPts.length ? `<polyline points="${realPts.join(" ")}" fill="none" stroke="#0e9488" stroke-width="2" stroke-dasharray="5 3"/>` : ""}
    ${hojeX != null ? `<line x1="${hojeX.toFixed(1)}" y1="${padT}" x2="${hojeX.toFixed(1)}" y2="${(H - padB).toFixed(1)}" stroke="#b3261e" stroke-width="1" stroke-dasharray="3 3"/><text x="${hojeX.toFixed(1)}" y="${(padT - 6).toFixed(1)}" font-size="9" fill="#b3261e" text-anchor="middle">hoje</text>` : ""}
    <text x="${padL}" y="${(H - 8).toFixed(1)}" font-size="9.5" fill="var(--text-3)">${cFmtBR(new Date(t0).toISOString().slice(0, 10))}</text>
    <text x="${(W - padR).toFixed(1)}" y="${(H - 8).toFixed(1)}" font-size="9.5" fill="var(--text-3)" text-anchor="end">${cFmtBR(new Date(t1).toISOString().slice(0, 10))}</text>
  </svg>`;
}
