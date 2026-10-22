// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.
const NIVEL_INFO={grave:{cor:"red",rotulo:"Incompatível / contraindicado",icone:"ti-alert-octagon"},moderada:{cor:"coral",rotulo:"Requer cuidado",icone:"ti-alert-triangle"},leve:{cor:"amber",rotulo:"Atenção / ressalva",icone:"ti-info-circle"},compativel:{cor:"teal",rotulo:"Compatível (uso consagrado)",icone:"ti-circle-check"}};function nomeMaterial(a){const t=MATERIAIS_INTERACAO.find(e=>e.id===a);return t?t.nome:a}function buscarInteracao(a,t){return INTERACOES.find(e=>e.a===a&&e.b===t||e.a===t&&e.b===a)||null}function renderInteracoes(){if(!planoEhPro())return renderInteracoesUpsell();const a=o=>`<option value="">— selecione —</option>`+MATERIAIS_INTERACAO.map(i=>`<option value="${i.id}">${esc(i.nome)}</option>`).join("");const t={grave:0,moderada:1,leve:2,compativel:3};const e=INTERACOES.slice().sort((o,i)=>t[o.nivel]-t[i.nivel]);app.innerHTML=`
    <h2 class="page-title">Interação entre materiais</h2>
    <p class="page-sub">Selecione dois materiais para verificar incompatibilidades documentadas na literatura técnica — análogo às bases de interação medicamentosa.</p>

    <div class="card" style="max-width:760px">
      <div class="field-row">
        <div class="field"><label>Material A</label><select id="int-a">${a("a")}</select></div>
        <div class="field"><label>Material B</label><select id="int-b">${a("b")}</select></div>
      </div>
      <button class="btn primary lg" onclick="verificarInteracao()"><i class="ti ti-arrows-cross"></i>Verificar interação</button>
    </div>

    <div id="int-result" style="margin-top:16px;max-width:760px"></div>

    <h3 style="margin:26px 0 10px">Interações documentadas (${e.length})</h3>
    ${e.map(cardInteracao).join("")}

    <p class="page-sub" style="margin-top:18px"><i class="ti ti-info-circle"></i> A ausência de interação nesta base não garante compatibilidade absoluta. Sempre confirme com a ficha técnica do fabricante e, quando aplicável, com ensaios de compatibilidade.</p>`}function renderInteracoesUpsell(){app.innerHTML=`
    <div class="card" style="max-width:560px;margin:40px auto;text-align:center;padding:36px">
      <div class="card-icon" style="background:var(--coral-light);color:var(--coral);margin:0 auto 16px"><i class="ti ti-arrows-cross"></i></div>
      <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">Interação entre materiais é um recurso PRO</h2>
      <p style="color:var(--text-2);margin-bottom:20px">Verifique incompatibilidades entre materiais (mecanismo, recomendação e referências) antes de especificar ou executar.</p>
      ${typeof cbTesteBotaoHTML==="function"?cbTesteBotaoHTML("interacoes",null,"btn primary lg"):""}
    </div>`}function verificarInteracao(){const a=document.getElementById("int-a").value;const t=document.getElementById("int-b").value;const e=document.getElementById("int-result");if(!a||!t){e.innerHTML=`<div class="card" style="border-left:4px solid var(--border)"><p class="page-sub" style="margin:0">Selecione os dois materiais para verificar.</p></div>`;return}if(a===t){e.innerHTML=`<div class="card" style="border-left:4px solid var(--amber)"><p style="margin:0">Selecione <strong>dois materiais diferentes</strong>.</p></div>`;return}const o=buscarInteracao(a,t);if(!o){e.innerHTML=`
      <div class="card" style="border-left:4px solid var(--text-3)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <i class="ti ti-search-off" style="color:var(--text-2)"></i>
          <span class="pill pill-gray">Sem interação documentada</span>
        </div>
        <h3 style="margin:2px 0 6px">${esc(nomeMaterial(a))} × ${esc(nomeMaterial(t))}</h3>
        <p style="color:var(--text-2)">Não há interação relevante documentada na literatura consultada para este par. Isso <strong>não garante</strong> compatibilidade absoluta — confirme com a ficha técnica do fabricante e ensaios quando houver dúvida.</p>
        <button class="btn" onclick="perguntarInteracaoIA('${a}','${t}')" title="Abre o assessor com a pergunta pronta — ele responde citando a norma, ou se abstém se não houver base">
          <i class="ti ti-sparkles" aria-hidden="true"></i> Perguntar ao assessor
        </button>
      </div>`;return}e.innerHTML=cardInteracao(o,true);e.scrollIntoView({behavior:"smooth",block:"nearest"})}function perguntarInteracaoIA(a,t){const e=nomeMaterial(a),o=nomeMaterial(t);const i=`Há incompatibilidade ou cuidado técnico no contato entre ${e} e ${o} na construção civil? Explique o mecanismo (químico/eletroquímico/físico), diga o que fazer na prática e cite a norma aplicável. Se não houver base normativa para esse par, diga isso claramente em vez de supor.`;cbAssessor("abrirCom","interacoes",`O usuário está na tela Interação entre materiais e consultou o par "${e} × ${o}", que NÃO consta na base curada do módulo.`,i)}function cardInteracao(a,t){const e=NIVEL_INFO[a.nivel]||NIVEL_INFO.leve;return`
    <div class="card" style="margin-bottom:10px;border-left:4px solid var(--${e.cor})${t?";box-shadow:0 0 0 2px var(--"+e.cor+"-light)":""}">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:8px">
          <i class="ti ${e.icone}" style="color:var(--${e.cor})"></i>
          <h3 style="margin:0;font-size:15.5px">${esc(a.titulo)}</h3>
        </div>
        <span class="pill pill-${e.cor}">${e.rotulo}</span>
      </div>
      <p style="font-size:12.5px;color:var(--text-3);margin-bottom:8px">${esc(nomeMaterial(a.a))} × ${esc(nomeMaterial(a.b))}</p>
      <p style="margin-bottom:8px"><strong>Mecanismo.</strong> ${esc(a.mecanismo)}</p>
      <p style="margin-bottom:8px"><strong>Recomendação.</strong> ${esc(a.recomendacao)}</p>
      <p style="font-size:12.5px;color:var(--text-2);margin:0"><i class="ti ti-book"></i> ${a.refs.map(esc).join(" · ")}</p>
    </div>`}
