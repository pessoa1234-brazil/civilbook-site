// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Módulo Ações Técnicas (PRO) — biblioteca de procedimentos de engenharia.
// Lista por área e ficha detalhada (introdução, definição, indicações,
// contraindicações, materiais, técnica, cuidados, complicações, referências).

function areaTecnica(id) { return TECNICAS_AREAS.find(a => a.id === id) || { nome: id, icone: "ti-tool" }; }

function renderTecnicas(param) {
  if (!planoEhPro()) return renderTecnicasUpsell();
  if (param) {
    const t = TECNICAS.find(x => x.id === param);
    if (t) return renderTecnicaDetalhe(t);
  }
  app.innerHTML = `
    <h2 class="page-title">Ações técnicas</h2>
    <p class="page-sub">Procedimentos de engenharia por área, com indicações, técnica de execução, cuidados, complicações e referências.</p>
    ${TECNICAS_AREAS.map(area => {
      const itens = TECNICAS.filter(t => t.area === area.id);
      if (!itens.length) return "";
      return `
        <h3 style="margin:22px 0 10px;display:flex;align-items:center;gap:8px">
          <i class="ti ${area.icone}" style="color:var(--text-2)"></i>${esc(area.nome)}
          <span style="font-size:12.5px;color:var(--text-3);font-weight:400">${itens.length} procedimento(s)</span>
        </h3>
        <div class="grid grid-2">
          ${itens.map(t => `
            <div class="card clickable" onclick="navigate('tecnicas','${t.id}')">
              <h3 style="font-size:15.5px;margin-bottom:4px">${esc(t.titulo)}</h3>
              <p style="font-size:13px;color:var(--text-2)">${esc(t.definicao)}</p>
              <p style="font-size:12px;color:var(--text-3);margin-top:8px"><i class="ti ti-book"></i> ${t.refs.length} referência(s) · <i class="ti ti-arrow-right"></i> abrir ficha</p>
            </div>`).join("")}
        </div>`;
    }).join("")}
    <p class="page-sub" style="margin-top:18px"><i class="ti ti-info-circle"></i> Conteúdo orientativo de apoio. Não substitui o texto integral das normas ABNT nem o julgamento do profissional habilitado (responsável técnico).</p>`;
}

function renderTecnicasUpsell() {
  app.innerHTML = `
    <div class="card" style="max-width:560px;margin:40px auto;text-align:center;padding:36px">
      <div class="card-icon" style="background:var(--blue-light);color:var(--blue);margin:0 auto 16px"><i class="ti ti-list-details"></i></div>
      <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">Ações técnicas é um recurso PRO</h2>
      <p style="color:var(--text-2);margin-bottom:20px">Fichas de procedimentos por área da engenharia — definição, indicações, contraindicações, técnica de execução, cuidados, complicações e referências.</p>
      ${typeof cbTesteBotaoHTML === "function" ? cbTesteBotaoHTML('tecnicas', null, 'btn primary lg') : ""}
    </div>`;
}

function renderTecnicaDetalhe(t) {
  const area = areaTecnica(t.area);
  app.innerHTML = `
    <button class="back-link no-print" onclick="navigate('tecnicas')"><i class="ti ti-arrow-left"></i>Ações técnicas</button>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:6px">
      <div>
        <span class="pill pill-blue"><i class="ti ${area.icone}"></i> ${esc(area.nome)}</span>
        <h2 class="page-title" style="margin:8px 0 2px">${esc(t.titulo)}</h2>
      </div>
      <button class="btn no-print" onclick="window.print()"><i class="ti ti-printer"></i>Imprimir</button>
    </div>

    <div class="card laudo-print">
      <p style="font-size:14.5px;color:var(--text-2);margin-bottom:4px">${esc(t.introducao)}</p>
      ${secaoTexto("Definição", "ti-bookmark", t.definicao)}
      ${secaoLista("Indicações", "ti-circle-check", t.indicacoes, "teal")}
      ${secaoLista("Contraindicações", "ti-ban", t.contraindicacoes, "red")}
      ${secaoLista("Materiais necessários", "ti-package", t.materiais, "text-2")}
      ${secaoLista("Verificações antes de executar (equipamento, energia, acesso, segurança)", "ti-clipboard-check", t.verificacoes, "blue")}
      ${secaoPassos("Técnica de execução", "ti-list-numbers", t.tecnica)}
      ${secaoLista("Cuidados específicos", "ti-alert-triangle", t.cuidados, "amber")}
      ${secaoLista("Complicações possíveis", "ti-activity", t.complicacoes, "coral")}
      <div style="margin-top:18px;border-top:1px solid var(--border);padding-top:10px">
        <h3 style="font-size:13.5px;color:var(--text-2);margin-bottom:6px"><i class="ti ti-book"></i> Referências</h3>
        <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:3px">
          ${t.refs.map(r => `<li style="font-size:13px;color:var(--text-2)">${esc(r)}</li>`).join("")}
        </ul>
      </div>
    </div>`;
}

function secaoTexto(titulo, icone, texto) {
  return `<div style="margin-top:14px">
    <h3 style="font-size:14.5px;display:flex;align-items:center;gap:6px;margin-bottom:4px"><i class="ti ${icone}" style="color:var(--text-2)"></i>${titulo}</h3>
    <p style="font-size:14px">${esc(texto)}</p>
  </div>`;
}

function secaoLista(titulo, icone, itens, cor) {
  if (!itens || !itens.length) return "";
  return `<div style="margin-top:14px">
    <h3 style="font-size:14.5px;display:flex;align-items:center;gap:6px;margin-bottom:6px"><i class="ti ${icone}" style="color:var(--${cor || "text-2"})"></i>${titulo}</h3>
    <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px">
      ${itens.map(x => `<li style="font-size:14px">${esc(x)}</li>`).join("")}
    </ul>
  </div>`;
}

function secaoPassos(titulo, icone, passos) {
  if (!passos || !passos.length) return "";
  return `<div style="margin-top:14px">
    <h3 style="font-size:14.5px;display:flex;align-items:center;gap:6px;margin-bottom:6px"><i class="ti ${icone}" style="color:var(--blue)"></i>${titulo}</h3>
    <ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px">
      ${passos.map(p => `<li style="font-size:14px">${esc(p)}</li>`).join("")}
    </ol>
  </div>`;
}
