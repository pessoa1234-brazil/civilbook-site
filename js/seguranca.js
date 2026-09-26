// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// e21 — Segurança do Trabalho na obra (NRs do MTE). Hub que OPERACIONALIZA as Normas
// Regulamentadoras: (1) conteúdo/exigências práticas por NR, (2) checklists de inspeção
// (reaproveita a aba Checklists), (3) modelos de documentos exportáveis (reaproveita Laudos),
// (4) vínculos com Diário de Obra e Ações técnicas. Material de REFERÊNCIA — não substitui o
// SESMT nem o responsável técnico de segurança. (Distinto da Segurança da Informação do app/a5.)

const SEG_CHECKLISTS = ["seg-altura-andaime", "seg-eletrica", "seg-escavacao", "seg-epi", "seg-maquinas", "seg-confinado"];
const SEG_DOCS = ["os-seguranca", "apr-ast", "pt-trabalho", "ficha-epi", "pgr-construcao"];

let _segTab = "nrs";
let _nrQuery = "";
let _nrAtiv = "";   // filtro por atividade/frente de serviço

function renderSegTrab(param) {
  // Deep-link: param pode ser um id de NR (abre detalhe), um nome de aba, ou nada.
  if (param && typeof NRS !== "undefined") {
    const nr = NRS.find(n => n.id === param);
    if (nr) return renderNrDetail(nr);
  }
  if (param === "nrs" || param === "checklists" || param === "documentos") _segTab = param;

  const tabBtn = (id, icone, label) =>
    `<button data-t="${id}" class="${_segTab === id ? "active" : ""}"><i class="ti ${icone}"></i> ${label}</button>`;
  app.innerHTML = `
    <h2 class="page-title">Segurança do Trabalho na obra</h2>
    <p class="page-sub">Normas Regulamentadoras (MTE) aplicadas à construção — conteúdo, checklists de inspeção e modelos de documentos. Material de apoio: <strong>não substitui o SESMT nem o responsável técnico de segurança</strong>; confira sempre a redação vigente das NRs.</p>
    <div class="seg-links no-print">
      <span class="page-sub" style="margin:0">Vínculos:</span>
      <a class="btn" onclick="navigate('laudos','diario-obra')"><i class="ti ti-notebook"></i> Registrar no Diário de obra</a>
      <a class="btn" onclick="navigate('tecnicas')"><i class="ti ti-list-details"></i> Ações técnicas</a>
      <a class="btn" onclick="navigate('normas','NR-18')"><i class="ti ti-book"></i> NRs no índice de Normas</a>
    </div>
    <div class="tabs-bar" id="seg-tabs">
      ${tabBtn("nrs", "ti-shield-half", "NRs aplicáveis")}
      ${tabBtn("checklists", "ti-clipboard-check", "Checklists de inspeção")}
      ${tabBtn("documentos", "ti-file-text", "Modelos de documentos")}
    </div>
    <div id="seg-pane"></div>`;
  document.querySelectorAll("#seg-tabs button").forEach(b =>
    b.addEventListener("click", () => { _segTab = b.dataset.t; renderSegTrab(_segTab); }));
  segPane();
}

function segPane() {
  const pane = document.getElementById("seg-pane");
  if (!pane) return;
  if (_segTab === "checklists") return segPaneChecklists(pane);
  if (_segTab === "documentos") return segPaneDocs(pane);
  segPaneNRs(pane);
}

// ---------- Aba: NRs aplicáveis ----------
function segPaneNRs(pane) {
  const atividades = [...new Set(NRS.flatMap(n => n.atividades || []))].sort();
  pane.innerHTML = `
    <div class="filter-bar">
      <input type="text" id="nr-filter" placeholder="Buscar por NR, título ou frente de serviço…" value="${esc(_nrQuery)}" aria-label="Buscar NR">
    </div>
    <div class="seg-chips" id="nr-chips">
      <button class="seg-chip${_nrAtiv === "" ? " on" : ""}" data-a="">Todas</button>
      ${atividades.map(a => `<button class="seg-chip${_nrAtiv === a ? " on" : ""}" data-a="${esc(a)}">${esc(a)}</button>`).join("")}
    </div>
    <p class="page-sub" style="margin:0 0 12px"><strong id="nr-count">${NRS.length}</strong> NRs indexadas · ${atividades.length} frentes de serviço</p>
    <div id="seg-nr-list" class="grid grid-2"></div>`;
  document.getElementById("nr-filter").addEventListener("input", e => { _nrQuery = e.target.value; segDrawNrList(); });
  document.querySelectorAll("#nr-chips .seg-chip").forEach(b =>
    b.addEventListener("click", () => { _nrAtiv = b.dataset.a; segPaneNRs(pane); }));
  segDrawNrList();
}

function segDrawNrList() {
  const host = document.getElementById("seg-nr-list");
  if (!host) return;
  const q = _nrQuery.trim().toLowerCase();
  const list = NRS.filter(n => {
    if (_nrAtiv && !(n.atividades || []).includes(_nrAtiv)) return false;
    return !q || (n.codigo + " " + n.titulo + " " + (n.foco || "") + " " + (n.atividades || []).join(" ")).toLowerCase().includes(q);
  });
  const cnt = document.getElementById("nr-count");
  if (cnt) cnt.textContent = list.length;
  host.innerHTML = list.map(n => `
    <div class="card clickable" onclick="navigate('seguranca','${n.id}')">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span class="pill pill-red">${esc(n.codigo)}</span>
        <span style="font-size:12px;color:var(--text-3)">${(n.atividades || []).slice(0, 2).map(esc).join(" · ")}</span>
      </div>
      <h3 style="font-size:15px">${esc(n.titulo)}</h3>
      <p>${esc(n.foco || "")}</p>
    </div>`).join("") || `<p class="page-sub">Nenhuma NR encontrada.</p>`;
}

function renderNrDetail(nr) {
  const bloco = (titulo, icone, itens) => !itens || !itens.length ? "" : `
    <div class="card" style="margin-top:14px">
      <h3 style="margin-bottom:10px"><i class="ti ${icone}"></i> ${titulo}</h3>
      ${itens.map(t => `<div class="check-item"><i class="ti ti-point ci-icon" style="color:var(--red)"></i><span>${esc(t)}</span></div>`).join("")}
    </div>`;
  // vínculos: checklists e modelos relacionados (cruzam com as abas Checklists e Laudos)
  const cks = (nr.checklists || []).map(id => (typeof CHECKLISTS !== "undefined") && CHECKLISTS.find(c => c.id === id)).filter(Boolean);
  const docs = (nr.modelos || []).map(id => (typeof LAUDOS !== "undefined") && LAUDOS.find(l => l.id === id)).filter(Boolean);
  const linkCard = (titulo, icone, mod, itens) => !itens.length ? "" : `
    <div class="card" style="margin-top:14px">
      <h3 style="margin-bottom:8px"><i class="ti ${icone}"></i> ${titulo}</h3>
      ${itens.map(it => `<div class="list-item" onclick="navigate('${mod}','${it.id}')">
        <div><div class="li-title">${esc(it.titulo)}</div></div>
        <div class="li-meta"><i class="ti ti-chevron-right"></i></div>
      </div>`).join("")}
    </div>`;

  app.innerHTML = `
    <button class="back-link no-print" onclick="navigate('seguranca','nrs')"><i class="ti ti-arrow-left"></i>Todas as NRs</button>
    <div class="detail-header">
      <h2>${esc(nr.codigo)} <span class="pill pill-red" style="vertical-align:middle;font-size:12px">NR · MTE</span></h2>
      <div class="sub">${esc(nr.titulo)}${nr.ano ? " · " + nr.ano : ""}</div>
    </div>
    <div class="seg-chips" style="margin-bottom:4px">${(nr.atividades || []).map(a => `<span class="seg-chip on" style="cursor:default">${esc(a)}</span>`).join("")}</div>
    ${bloco("O que é", "ti-info-circle", nr.resumo)}
    ${bloco("Exigências práticas em obra", "ti-checklist", nr.exigencias)}
    ${bloco("EPIs típicos", "ti-shield-check", nr.epis)}
    ${bloco("Documentos / registros", "ti-files", nr.documentos)}
    ${linkCard("Checklists de inspeção", "ti-clipboard-check", "checklists", cks)}
    ${linkCard("Modelos de documentos", "ti-file-text", "laudos", docs)}
    ${nr.normaRef ? `<p class="page-sub" style="margin-top:14px"><a onclick="navigate('normas','${esc(nr.normaRef)}')" style="cursor:pointer;color:var(--blue)"><i class="ti ti-book"></i> Ver ${esc(nr.codigo)} no índice de Normas</a></p>` : ""}
    <p class="page-sub" style="margin-top:14px"><i class="ti ti-alert-triangle"></i> Resumo orientativo e autoral — não reproduz o texto integral da NR (público no gov.br/trabalho). Não substitui o SESMT nem o responsável técnico de segurança; confira a redação vigente.</p>`;
  window.scrollTo(0, 0);
}

// ---------- Aba: checklists de inspeção (deep-link p/ o módulo Checklists) ----------
function segPaneChecklists(pane) {
  const itens = (typeof CHECKLISTS !== "undefined") ? CHECKLISTS.filter(c => SEG_CHECKLISTS.includes(c.id)) : [];
  pane.innerHTML = `
    <p class="page-sub" style="margin:0 0 12px">Inspeções de segurança por frente de serviço. Abrem na aba <strong>Checklists</strong>, onde você marca os itens e o progresso fica salvo na sua conta.</p>
    <div class="grid grid-2">
      ${itens.map(c => `
        <div class="card clickable" onclick="navigate('checklists','${c.id}')">
          <div class="card-icon" style="background:var(--red-light);color:var(--red)"><i class="ti ${c.icone}"></i></div>
          <h3>${esc(c.titulo)}</h3>
          <p>${esc(c.normas)} · ${c.itens.length} itens</p>
        </div>`).join("") || `<p class="page-sub">Checklists de segurança indisponíveis.</p>`}
    </div>`;
}

// ---------- Aba: modelos de documentos (deep-link p/ o módulo Laudos) ----------
function segPaneDocs(pane) {
  const itens = (typeof LAUDOS !== "undefined") ? SEG_DOCS.map(id => LAUDOS.find(l => l.id === id)).filter(Boolean) : [];
  pane.innerHTML = `
    <p class="page-sub" style="margin:0 0 12px">Modelos prontos (APR/AST, PT, OS de segurança, ficha de EPI, PGR). Abrem na aba <strong>Laudos</strong> e são <strong>exportáveis</strong> (imprimir/PDF ou baixar .txt). Substitua os campos entre [colchetes].</p>
    <div class="grid grid-2">
      ${itens.map(l => `
        <div class="card clickable" onclick="navigate('laudos','${l.id}')">
          <div class="card-icon" style="background:var(--coral-light);color:var(--coral)"><i class="ti ${l.icone}"></i></div>
          <h3>${esc(l.titulo)}</h3>
          <p>${esc(l.sub)}</p>
        </div>`).join("") || `<p class="page-sub">Modelos de segurança indisponíveis.</p>`}
    </div>`;
}

if (typeof window !== "undefined") { window.renderSegTrab = renderSegTrab; window.NRS_READY = true; }
