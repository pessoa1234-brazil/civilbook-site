// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.
const SEG_CHECKLISTS=["seg-altura-andaime","seg-eletrica","seg-escavacao","seg-epi","seg-maquinas","seg-confinado"];const SEG_DOCS=["os-seguranca","apr-ast","pt-trabalho","ficha-epi","pgr-construcao"];let _segTab="nrs";let _nrQuery="";let _nrAtiv="";function renderSegTrab(e){if(e&&typeof NRS!=="undefined"){const s=NRS.find(a=>a.id===e);if(s)return renderNrDetail(s)}if(e==="nrs"||e==="checklists"||e==="documentos")_segTab=e;const i=(s,a,t)=>`<button data-t="${s}" class="${_segTab===s?"active":""}"><i class="ti ${a}"></i> ${t}</button>`;app.innerHTML=`
    <h2 class="page-title">Segurança do Trabalho na obra</h2>
    <p class="page-sub">Normas Regulamentadoras (MTE) aplicadas à construção — conteúdo, checklists de inspeção e modelos de documentos. Material de apoio: <strong>não substitui o SESMT nem o responsável técnico de segurança</strong>; confira sempre a redação vigente das NRs.</p>
    <div class="seg-links no-print">
      <span class="page-sub" style="margin:0">Vínculos:</span>
      <a class="btn" onclick="navigate('laudos','diario-obra')"><i class="ti ti-notebook"></i> Registrar no Diário de obra</a>
      <a class="btn" onclick="navigate('tecnicas')"><i class="ti ti-list-details"></i> Ações técnicas</a>
      <a class="btn" onclick="navigate('normas','NR-18')"><i class="ti ti-book"></i> NRs no índice de Normas</a>
    </div>
    <div class="tabs-bar" id="seg-tabs">
      ${i("nrs","ti-shield-half","NRs aplicáveis")}
      ${i("checklists","ti-clipboard-check","Checklists de inspeção")}
      ${i("documentos","ti-file-text","Modelos de documentos")}
    </div>
    <div id="seg-pane"></div>`;document.querySelectorAll("#seg-tabs button").forEach(s=>s.addEventListener("click",()=>{_segTab=s.dataset.t;renderSegTrab(_segTab)}));segPane()}function segPane(){const e=document.getElementById("seg-pane");if(!e)return;if(_segTab==="checklists")return segPaneChecklists(e);if(_segTab==="documentos")return segPaneDocs(e);segPaneNRs(e)}function segPaneNRs(e){const i=[...new Set(NRS.flatMap(s=>s.atividades||[]))].sort();e.innerHTML=`
    <div class="filter-bar">
      <input type="text" id="nr-filter" placeholder="Buscar por NR, título ou frente de serviço…" value="${esc(_nrQuery)}" aria-label="Buscar NR">
    </div>
    <div class="seg-chips" id="nr-chips">
      <button class="seg-chip${_nrAtiv===""?" on":""}" data-a="">Todas</button>
      ${i.map(s=>`<button class="seg-chip${_nrAtiv===s?" on":""}" data-a="${esc(s)}">${esc(s)}</button>`).join("")}
    </div>
    <p class="page-sub" style="margin:0 0 12px"><strong id="nr-count">${NRS.length}</strong> NRs indexadas · ${i.length} frentes de serviço</p>
    <div id="seg-nr-list" class="grid grid-2"></div>`;document.getElementById("nr-filter").addEventListener("input",s=>{_nrQuery=s.target.value;segDrawNrList()});document.querySelectorAll("#nr-chips .seg-chip").forEach(s=>s.addEventListener("click",()=>{_nrAtiv=s.dataset.a;segPaneNRs(e)}));segDrawNrList()}function segDrawNrList(){const e=document.getElementById("seg-nr-list");if(!e)return;const i=_nrQuery.trim().toLowerCase();const s=NRS.filter(t=>{if(_nrAtiv&&!(t.atividades||[]).includes(_nrAtiv))return false;return!i||(t.codigo+" "+t.titulo+" "+(t.foco||"")+" "+(t.atividades||[]).join(" ")).toLowerCase().includes(i)});const a=document.getElementById("nr-count");if(a)a.textContent=s.length;e.innerHTML=s.map(t=>`
    <div class="card clickable" onclick="navigate('seguranca','${t.id}')">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span class="pill pill-red">${esc(t.codigo)}</span>
        <span style="font-size:12px;color:var(--text-3)">${(t.atividades||[]).slice(0,2).map(esc).join(" · ")}</span>
      </div>
      <h3 style="font-size:15px">${esc(t.titulo)}</h3>
      <p>${esc(t.foco||"")}</p>
    </div>`).join("")||`<p class="page-sub">Nenhuma NR encontrada.</p>`}function renderNrDetail(e){const i=(o,n,c)=>!c||!c.length?"":`
    <div class="card" style="margin-top:14px">
      <h3 style="margin-bottom:10px"><i class="ti ${n}"></i> ${o}</h3>
      ${c.map(l=>`<div class="check-item"><i class="ti ti-point ci-icon" style="color:var(--red)"></i><span>${esc(l)}</span></div>`).join("")}
    </div>`;const s=(e.checklists||[]).map(o=>typeof CHECKLISTS!=="undefined"&&CHECKLISTS.find(n=>n.id===o)).filter(Boolean);const a=(e.modelos||[]).map(o=>typeof LAUDOS!=="undefined"&&LAUDOS.find(n=>n.id===o)).filter(Boolean);const t=(o,n,c,l)=>!l.length?"":`
    <div class="card" style="margin-top:14px">
      <h3 style="margin-bottom:8px"><i class="ti ${n}"></i> ${o}</h3>
      ${l.map(d=>`<div class="list-item" onclick="navigate('${c}','${d.id}')">
        <div><div class="li-title">${esc(d.titulo)}</div></div>
        <div class="li-meta"><i class="ti ti-chevron-right"></i></div>
      </div>`).join("")}
    </div>`;app.innerHTML=`
    <button class="back-link no-print" onclick="navigate('seguranca','nrs')"><i class="ti ti-arrow-left"></i>Todas as NRs</button>
    <div class="detail-header">
      <h2>${esc(e.codigo)} <span class="pill pill-red" style="vertical-align:middle;font-size:12px">NR · MTE</span></h2>
      <div class="sub">${esc(e.titulo)}${e.ano?" · "+e.ano:""}</div>
    </div>
    <div class="seg-chips" style="margin-bottom:4px">${(e.atividades||[]).map(o=>`<span class="seg-chip on" style="cursor:default">${esc(o)}</span>`).join("")}</div>
    ${i("O que é","ti-info-circle",e.resumo)}
    ${i("Exigências práticas em obra","ti-checklist",e.exigencias)}
    ${i("EPIs típicos","ti-shield-check",e.epis)}
    ${i("Documentos / registros","ti-files",e.documentos)}
    ${t("Checklists de inspeção","ti-clipboard-check","checklists",s)}
    ${t("Modelos de documentos","ti-file-text","laudos",a)}
    ${e.normaRef?`<p class="page-sub" style="margin-top:14px"><a onclick="navigate('normas','${esc(e.normaRef)}')" style="cursor:pointer;color:var(--blue)"><i class="ti ti-book"></i> Ver ${esc(e.codigo)} no índice de Normas</a></p>`:""}
    <p class="page-sub" style="margin-top:14px"><i class="ti ti-alert-triangle"></i> Resumo orientativo e autoral — não reproduz o texto integral da NR (público no gov.br/trabalho). Não substitui o SESMT nem o responsável técnico de segurança; confira a redação vigente.</p>`;window.scrollTo(0,0)}function segPaneChecklists(e){const i=typeof CHECKLISTS!=="undefined"?CHECKLISTS.filter(s=>SEG_CHECKLISTS.includes(s.id)):[];e.innerHTML=`
    <p class="page-sub" style="margin:0 0 12px">Inspeções de segurança por frente de serviço. Abrem na aba <strong>Checklists</strong>, onde você marca os itens e o progresso fica salvo na sua conta.</p>
    <div class="grid grid-2">
      ${i.map(s=>`
        <div class="card clickable" onclick="navigate('checklists','${s.id}')">
          <div class="card-icon" style="background:var(--red-light);color:var(--red)"><i class="ti ${s.icone}"></i></div>
          <h3>${esc(s.titulo)}</h3>
          <p>${esc(s.normas)} · ${s.itens.length} itens</p>
        </div>`).join("")||`<p class="page-sub">Checklists de segurança indisponíveis.</p>`}
    </div>`}function segPaneDocs(e){const i=typeof LAUDOS!=="undefined"?SEG_DOCS.map(s=>LAUDOS.find(a=>a.id===s)).filter(Boolean):[];e.innerHTML=`
    <p class="page-sub" style="margin:0 0 12px">Modelos prontos (APR/AST, PT, OS de segurança, ficha de EPI, PGR). Abrem na aba <strong>Laudos</strong> e são <strong>exportáveis</strong> (imprimir/PDF ou baixar .txt). Substitua os campos entre [colchetes].</p>
    <div class="grid grid-2">
      ${i.map(s=>`
        <div class="card clickable" onclick="navigate('laudos','${s.id}')">
          <div class="card-icon" style="background:var(--coral-light);color:var(--coral)"><i class="ti ${s.icone}"></i></div>
          <h3>${esc(s.titulo)}</h3>
          <p>${esc(s.sub)}</p>
        </div>`).join("")||`<p class="page-sub">Modelos de segurança indisponíveis.</p>`}
    </div>`}if(typeof window!=="undefined"){window.renderSegTrab=renderSegTrab;window.NRS_READY=true}
