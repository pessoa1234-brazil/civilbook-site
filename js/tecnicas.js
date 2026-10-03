// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.
function areaTecnica(i){return TECNICAS_AREAS.find(e=>e.id===i)||{nome:i,icone:"ti-tool"}}function renderTecnicas(i){if(!planoEhPro())return renderTecnicasUpsell();if(i){const e=TECNICAS.find(t=>t.id===i);if(e)return renderTecnicaDetalhe(e)}app.innerHTML=`
    <h2 class="page-title">Ações técnicas</h2>
    <p class="page-sub">Procedimentos de engenharia por área, com indicações, técnica de execução, cuidados, complicações e referências.</p>
    ${TECNICAS_AREAS.map(e=>{const t=TECNICAS.filter(a=>a.area===e.id);if(!t.length)return"";return`
        <h3 style="margin:22px 0 10px;display:flex;align-items:center;gap:8px">
          <i class="ti ${e.icone}" style="color:var(--text-2)"></i>${esc(e.nome)}
          <span style="font-size:12.5px;color:var(--text-3);font-weight:400">${t.length} procedimento(s)</span>
        </h3>
        <div class="grid grid-2">
          ${t.map(a=>`
            <div class="card clickable" onclick="navigate('tecnicas','${a.id}')">
              <h3 style="font-size:15.5px;margin-bottom:4px">${esc(a.titulo)}</h3>
              <p style="font-size:13px;color:var(--text-2)">${esc(a.definicao)}</p>
              <p style="font-size:12px;color:var(--text-3);margin-top:8px"><i class="ti ti-book"></i> ${a.refs.length} referência(s) · <i class="ti ti-arrow-right"></i> abrir ficha</p>
            </div>`).join("")}
        </div>`}).join("")}
    <p class="page-sub" style="margin-top:18px"><i class="ti ti-info-circle"></i> Conteúdo orientativo de apoio. Não substitui o texto integral das normas ABNT nem o julgamento do profissional habilitado (responsável técnico).</p>`}function renderTecnicasUpsell(){app.innerHTML=`
    <div class="card" style="max-width:560px;margin:40px auto;text-align:center;padding:36px">
      <div class="card-icon" style="background:var(--blue-light);color:var(--blue);margin:0 auto 16px"><i class="ti ti-list-details"></i></div>
      <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">Ações técnicas é um recurso PRO</h2>
      <p style="color:var(--text-2);margin-bottom:20px">Fichas de procedimentos por área da engenharia — definição, indicações, contraindicações, técnica de execução, cuidados, complicações e referências.</p>
      ${typeof cbTesteBotaoHTML==="function"?cbTesteBotaoHTML("tecnicas",null,"btn primary lg"):""}
    </div>`}function renderTecnicaDetalhe(i){const e=areaTecnica(i.area);app.innerHTML=`
    <button class="back-link no-print" onclick="navigate('tecnicas')"><i class="ti ti-arrow-left"></i>Ações técnicas</button>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:6px">
      <div>
        <span class="pill pill-blue"><i class="ti ${e.icone}"></i> ${esc(e.nome)}</span>
        <h2 class="page-title" style="margin:8px 0 2px">${esc(i.titulo)}</h2>
      </div>
      <button class="btn no-print" onclick="window.print()"><i class="ti ti-printer"></i>Imprimir</button>
    </div>

    <div class="card laudo-print">
      <p style="font-size:14.5px;color:var(--text-2);margin-bottom:4px">${esc(i.introducao)}</p>
      ${secaoTexto("Definição","ti-bookmark",i.definicao)}
      ${secaoLista("Indicações","ti-circle-check",i.indicacoes,"teal")}
      ${secaoLista("Contraindicações","ti-ban",i.contraindicacoes,"red")}
      ${secaoLista("Materiais necessários","ti-package",i.materiais,"text-2")}
      ${secaoLista("Verificações antes de executar (equipamento, energia, acesso, segurança)","ti-clipboard-check",i.verificacoes,"blue")}
      ${secaoPassos("Técnica de execução","ti-list-numbers",i.tecnica)}
      ${secaoLista("Cuidados específicos","ti-alert-triangle",i.cuidados,"amber")}
      ${secaoLista("Complicações possíveis","ti-activity",i.complicacoes,"coral")}
      <div style="margin-top:18px;border-top:1px solid var(--border);padding-top:10px">
        <h3 style="font-size:13.5px;color:var(--text-2);margin-bottom:6px"><i class="ti ti-book"></i> Referências</h3>
        <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:3px">
          ${i.refs.map(t=>`<li style="font-size:13px;color:var(--text-2)">${esc(t)}</li>`).join("")}
        </ul>
      </div>
    </div>`}function secaoTexto(i,e,t){return`<div style="margin-top:14px">
    <h3 style="font-size:14.5px;display:flex;align-items:center;gap:6px;margin-bottom:4px"><i class="ti ${e}" style="color:var(--text-2)"></i>${i}</h3>
    <p style="font-size:14px">${esc(t)}</p>
  </div>`}function secaoLista(i,e,t,a){if(!t||!t.length)return"";return`<div style="margin-top:14px">
    <h3 style="font-size:14.5px;display:flex;align-items:center;gap:6px;margin-bottom:6px"><i class="ti ${e}" style="color:var(--${a||"text-2"})"></i>${i}</h3>
    <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px">
      ${t.map(n=>`<li style="font-size:14px">${esc(n)}</li>`).join("")}
    </ul>
  </div>`}function secaoPassos(i,e,t){if(!t||!t.length)return"";return`<div style="margin-top:14px">
    <h3 style="font-size:14.5px;display:flex;align-items:center;gap:6px;margin-bottom:6px"><i class="ti ${e}" style="color:var(--blue)"></i>${i}</h3>
    <ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px">
      ${t.map(a=>`<li style="font-size:14px">${esc(a)}</li>`).join("")}
    </ol>
  </div>`}
