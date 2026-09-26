// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Módulo Interações entre Materiais (PRO).
// Verificador bidirecional A×B + lista de referência das interações documentadas.
// Quando o par não consta na base, informa que não há interação documentada.

const NIVEL_INFO = {
  grave:      { cor: "red",   rotulo: "Incompatível / contraindicado", icone: "ti-alert-octagon" },
  moderada:   { cor: "coral", rotulo: "Requer cuidado",                icone: "ti-alert-triangle" },
  leve:       { cor: "amber", rotulo: "Atenção / ressalva",            icone: "ti-info-circle" },
  compativel: { cor: "teal",  rotulo: "Compatível (uso consagrado)",   icone: "ti-circle-check" }
};

function nomeMaterial(id) {
  const m = MATERIAIS_INTERACAO.find(x => x.id === id);
  return m ? m.nome : id;
}

function buscarInteracao(a, b) {
  return INTERACOES.find(i => (i.a === a && i.b === b) || (i.a === b && i.b === a)) || null;
}

function renderInteracoes() {
  if (!planoEhPro()) return renderInteracoesUpsell();
  const opc = id => `<option value="">— selecione —</option>` +
    MATERIAIS_INTERACAO.map(m => `<option value="${m.id}">${esc(m.nome)}</option>`).join("");
  const ordem = { grave: 0, moderada: 1, leve: 2, compativel: 3 };
  const lista = INTERACOES.slice().sort((x, y) => ordem[x.nivel] - ordem[y.nivel]);

  app.innerHTML = `
    <h2 class="page-title">Interação entre materiais</h2>
    <p class="page-sub">Selecione dois materiais para verificar incompatibilidades documentadas na literatura técnica — análogo às bases de interação medicamentosa.</p>

    <div class="card" style="max-width:760px">
      <div class="field-row">
        <div class="field"><label>Material A</label><select id="int-a">${opc("a")}</select></div>
        <div class="field"><label>Material B</label><select id="int-b">${opc("b")}</select></div>
      </div>
      <button class="btn primary lg" onclick="verificarInteracao()"><i class="ti ti-arrows-cross"></i>Verificar interação</button>
    </div>

    <div id="int-result" style="margin-top:16px;max-width:760px"></div>

    <h3 style="margin:26px 0 10px">Interações documentadas (${lista.length})</h3>
    ${lista.map(cardInteracao).join("")}

    <p class="page-sub" style="margin-top:18px"><i class="ti ti-info-circle"></i> A ausência de interação nesta base não garante compatibilidade absoluta. Sempre confirme com a ficha técnica do fabricante e, quando aplicável, com ensaios de compatibilidade.</p>`;
}

function renderInteracoesUpsell() {
  app.innerHTML = `
    <div class="card" style="max-width:560px;margin:40px auto;text-align:center;padding:36px">
      <div class="card-icon" style="background:var(--coral-light);color:var(--coral);margin:0 auto 16px"><i class="ti ti-arrows-cross"></i></div>
      <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">Interação entre materiais é um recurso PRO</h2>
      <p style="color:var(--text-2);margin-bottom:20px">Verifique incompatibilidades entre materiais (mecanismo, recomendação e referências) antes de especificar ou executar.</p>
      ${typeof cbTesteBotaoHTML === "function" ? cbTesteBotaoHTML('interacoes', null, 'btn primary lg') : ""}
    </div>`;
}

function verificarInteracao() {
  const a = document.getElementById("int-a").value;
  const b = document.getElementById("int-b").value;
  const el = document.getElementById("int-result");
  if (!a || !b) { el.innerHTML = `<div class="card" style="border-left:4px solid var(--border)"><p class="page-sub" style="margin:0">Selecione os dois materiais para verificar.</p></div>`; return; }
  if (a === b) { el.innerHTML = `<div class="card" style="border-left:4px solid var(--amber)"><p style="margin:0">Selecione <strong>dois materiais diferentes</strong>.</p></div>`; return; }

  const it = buscarInteracao(a, b);
  if (!it) {
    el.innerHTML = `
      <div class="card" style="border-left:4px solid var(--text-3)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <i class="ti ti-search-off" style="color:var(--text-2)"></i>
          <span class="pill pill-gray">Sem interação documentada</span>
        </div>
        <h3 style="margin:2px 0 6px">${esc(nomeMaterial(a))} × ${esc(nomeMaterial(b))}</h3>
        <p style="color:var(--text-2)">Não há interação relevante documentada na literatura consultada para este par. Isso <strong>não garante</strong> compatibilidade absoluta — confirme com a ficha técnica do fabricante e ensaios quando houver dúvida.</p>
        <button class="btn" onclick="perguntarInteracaoIA('${a}','${b}')" title="Abre o assessor com a pergunta pronta — ele responde citando a norma, ou se abstém se não houver base">
          <i class="ti ti-sparkles" aria-hidden="true"></i> Perguntar ao assessor
        </button>
      </div>`;
    return;
  }
  el.innerHTML = cardInteracao(it, true);
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// f51 — cauda longa SEM inventar conteúdo: a base do módulo tem pares curados e assinados; o resto
// o assessor consulta nas 83 normas integrais, citando a fonte (f12: cita ou se abstém). O módulo
// continua dizendo "não documentado" — o botão é uma saída, não um palpite disfarçado de resposta.
// Escopo GLOBAL de propósito: o onclick do cartão é resolvido em window.
function perguntarInteracaoIA(a, b) {
  const na = nomeMaterial(a), nb = nomeMaterial(b);
  const pergunta = `Há incompatibilidade ou cuidado técnico no contato entre ${na} e ${nb} na construção civil? ` +
    `Explique o mecanismo (químico/eletroquímico/físico), diga o que fazer na prática e cite a norma aplicável. ` +
    `Se não houver base normativa para esse par, diga isso claramente em vez de supor.`;
  // a52 P2: o Assessor chega quando a aba dele abre — cbAssessor (js/app.js) o busca antes de chamar.
  cbAssessor("abrirCom", "interacoes", `O usuário está na tela Interação entre materiais e consultou o par "${na} × ${nb}", que NÃO consta na base curada do módulo.`, pergunta);
}

function cardInteracao(it, destaque) {
  const n = NIVEL_INFO[it.nivel] || NIVEL_INFO.leve;
  return `
    <div class="card" style="margin-bottom:10px;border-left:4px solid var(--${n.cor})${destaque ? ";box-shadow:0 0 0 2px var(--" + n.cor + "-light)" : ""}">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:8px">
          <i class="ti ${n.icone}" style="color:var(--${n.cor})"></i>
          <h3 style="margin:0;font-size:15.5px">${esc(it.titulo)}</h3>
        </div>
        <span class="pill pill-${n.cor}">${n.rotulo}</span>
      </div>
      <p style="font-size:12.5px;color:var(--text-3);margin-bottom:8px">${esc(nomeMaterial(it.a))} × ${esc(nomeMaterial(it.b))}</p>
      <p style="margin-bottom:8px"><strong>Mecanismo.</strong> ${esc(it.mecanismo)}</p>
      <p style="margin-bottom:8px"><strong>Recomendação.</strong> ${esc(it.recomendacao)}</p>
      <p style="font-size:12.5px;color:var(--text-2);margin:0"><i class="ti ti-book"></i> ${it.refs.map(esc).join(" · ")}</p>
    </div>`;
}
