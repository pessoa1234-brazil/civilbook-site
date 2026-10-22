// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.
const ATIVO_CATEGORIAS=["Estrutura","Hidrossanitário","Elétrico","Climatização (AVAC)","Elevador","Bomba / Pressurização","Incêndio","Gás","Cobertura / Impermeabilização","Esquadrias","Gerador","Portões / Automação","Outro"];const AGEND_STATUS=[{id:"agendado",label:"Agendado",cor:"blue"},{id:"concluido",label:"Concluído",cor:"teal"},{id:"cancelado",label:"Cancelado",cor:"gray"}];const AGEND_PERIODOS=[1,3,6,12,24,36];function rowToAtivo(e){return{id:e.id,empreendimento:e.empreendimento||"",unidade:e.unidade||"",nome:e.nome,categoria:e.categoria||"",fabricante:e.fabricante||"",modelo:e.modelo||"",num_serie:e.num_serie||"",local:e.local||"",instalado_em:e.instalado_em||"",garantia_ate:e.garantia_ate||"",especificacoes:e.especificacoes||[],documentos:e.documentos||[],obs:e.obs||"",dono:e.user_id}}function ativoToRow(e){return{id:e.id,user_id:e.dono||CBStore.uid(),empreendimento:e.empreendimento||null,unidade:e.unidade||null,nome:e.nome,categoria:e.categoria||null,fabricante:e.fabricante||null,modelo:e.modelo||null,num_serie:e.num_serie||null,local:e.local||null,instalado_em:e.instalado_em||null,garantia_ate:e.garantia_ate||null,especificacoes:e.especificacoes||[],documentos:e.documentos||[],obs:e.obs||null}}function rowToAgend(e){return{id:e.id,ativo_id:e.ativo_id||"",titulo:e.titulo,atividade:e.atividade||"",data:e.data||"",periodicidade_meses:e.periodicidade_meses,resp:e.resp||"",status:e.status||"agendado",obs:e.obs||"",dono:e.user_id}}function agendToRow(e){return{id:e.id,user_id:e.dono||CBStore.uid(),ativo_id:e.ativo_id||null,titulo:e.titulo,atividade:e.atividade||null,data:e.data,resp:e.resp||null,status:e.status||"agendado",obs:e.obs||null,periodicidade_meses:e.periodicidade_meses===""||e.periodicidade_meses==null?null:Number(e.periodicidade_meses)}}const ATV=cbColecao("ativos","cb-ativos",rowToAtivo,ativoToRow);const AGE=cbColecao("agendamentos","cb-agendamentos",rowToAgend,agendToRow);const OSD={_map:null,_loaded:false,LS:"cb-os-detalhes",async load(){const e=CBStore.lsGet(this.LS,{});if(CBStore.online()){try{const{data:t,error:a}=await window.supa.from("os_detalhes").select("*");if(a)throw a;const o={};(t||[]).forEach(i=>{o[i.os_id]={ativo_id:i.ativo_id||"",checklist:i.checklist||[]}});if(!Object.keys(o).length&&Object.keys(e).length){for(const[i,n]of Object.entries(e)){const{error:d}=await window.supa.from("os_detalhes").upsert({os_id:i,user_id:CBStore.uid(),ativo_id:n.ativo_id||null,checklist:n.checklist||[]});if(!d)o[i]=n}}this._map=o;CBStore.lsSet(this.LS,o);this._loaded=true;return}catch(t){console.warn("OSD.load:",t&&t.message)}}this._map=e;this._loaded=true},async ready(){if(!this._loaded)await this.load();return this._loaded},get(e){return this._map&&this._map[e]||{ativo_id:"",checklist:[]}},set(e,t){if(!this._map)this._map={};this._map[e]={ativo_id:t.ativo_id||"",checklist:t.checklist||[]};CBStore.lsSet(this.LS,this._map);if(CBStore.online()){window.supa.from("os_detalhes").upsert({os_id:e,user_id:CBStore.uid(),ativo_id:t.ativo_id||null,checklist:t.checklist||[],updated_at:new Date().toISOString()}).then(({error:a})=>{if(a)console.warn("OSD.set:",a.message)})}}};async function mnt2Ready(){await Promise.all([ATV.ready(),AGE.ready(),OSD.ready()])}let _ativoForm=null;function renderMntAtivos(){const e=document.getElementById("mnt-body");if(!e)return;const t=ATV.listar();e.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
      <p class="page-sub" style="margin:0">${t.length} ativo(s) cadastrado(s). Equipamentos e sistemas do empreendimento — base para OS e agendamentos.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${typeof EXEMPLO!=="undefined"?EXEMPLO.botaoBarraHTML("ativos"):""}
        <button class="btn primary" onclick="abrirAtivoForm()"><i class="ti ti-plus"></i> Novo ativo</button>
      </div>
    </div>
    <div id="ativo-form-host"></div>
    <div id="ativo-lista">${ativosListaHTML()}</div>`}function ativosListaHTML(){const e=ATV.listar();if(!e.length){return typeof EXEMPLO!=="undefined"?EXEMPLO.vazioHTML("ativos",{icone:"ti-tools",titulo:"Cadastre o que precisa de manutenção",texto:"Elevador, bombas, portões, geradores: cada ativo guarda fabricante, número de série, data de instalação e fim da garantia — e o Civilbook avisa quando a garantia está para vencer.",ctaLabel:"Cadastrar o primeiro ativo",ctaAcao:"abrirAtivoForm()"}):`<p class="page-sub" style="text-align:center;padding:20px">Nenhum ativo cadastrado. Clique em "Novo ativo".</p>`}const t={};e.forEach(a=>{const o=a.empreendimento||"Sem empreendimento";const i=a.unidade||"—";t[o]=t[o]||{};(t[o][i]=t[o][i]||[]).push(a)});return Object.keys(t).sort().map(a=>`
    <div class="card" style="margin-bottom:12px">
      <h3 style="margin-bottom:8px"><i class="ti ti-building-community" style="color:var(--text-2)"></i> ${esc(a)}</h3>
      ${Object.keys(t[a]).sort().map(o=>`
        ${o!=="—"?`<div class="ativo-uni"><i class="ti ti-stack-2"></i> ${esc(o)}</div>`:""}
        ${t[a][o].map(ativoCardHTML).join("")}
      `).join("")}
    </div>`).join("")}function ativoCardHTML(e){const t=e.garantia_ate?new Date(e.garantia_ate+"T12:00"):null;const a=t&&t<new Date;const o=[e.fabricante,e.modelo,e.num_serie?"Nº "+e.num_serie:""].filter(Boolean).join(" · ");return`
  <div class="ativo-item">
    <div style="flex:1;min-width:200px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <strong>${esc(e.nome)}</strong>
        ${e.categoria?`<span class="pill pill-blue">${esc(e.categoria)}</span>`:""}
        ${e.garantia_ate?`<span class="pill pill-${a?"gray":"teal"}" title="Garantia">${a?"Garantia expirada":"Garantia até "+t.toLocaleDateString("pt-BR")}</span>`:""}
      </div>
      ${o?`<p style="font-size:12.5px;color:var(--text-2);margin-top:3px">${esc(o)}</p>`:""}
      ${e.local?`<p style="font-size:12.5px;color:var(--text-3)"><i class="ti ti-map-pin"></i> ${esc(e.local)}</p>`:""}
      ${e.especificacoes&&e.especificacoes.length?`<details class="ativo-det"><summary>${e.especificacoes.length} especificação(ões)</summary>
        <table class="spec-table" style="margin-top:6px">${e.especificacoes.map(i=>`<tr><td>${esc(i.chave)}</td><td>${esc(i.valor)}</td></tr>`).join("")}</table></details>`:""}
      ${e.documentos&&e.documentos.length?`<details class="ativo-det"><summary>${e.documentos.length} documento(s)</summary>
        <ul style="margin:6px 0 0;padding-left:18px;font-size:13px">${e.documentos.map(i=>`<li>${i.url?`<a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.nome||i.url)}</a>`:esc(i.nome||"")}${i.tipo?" · "+esc(i.tipo):""}</li>`).join("")}</ul></details>`:""}
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start">
      <button class="btn" onclick="abrirAtivoForm('${e.id}')"><i class="ti ti-edit"></i>Editar</button>
      <button class="btn icon-only" title="Excluir" onclick="excluirAtivo('${e.id}')"><i class="ti ti-trash"></i></button>
    </div>
  </div>`}function abrirAtivoForm(e){const t=e?ATV.get(e):null;_ativoForm={id:e||null,esp:t?JSON.parse(JSON.stringify(t.especificacoes||[])):[],doc:t?JSON.parse(JSON.stringify(t.documentos||[])):[]};const a=document.getElementById("ativo-form-host");const o=(s,c)=>esc(t&&t[s]!=null?t[s]:c||"");const i=[...new Set(ATV.listar().map(s=>s.empreendimento).filter(Boolean))];const n=[...new Set(ATV.listar().map(s=>s.unidade).filter(Boolean))];a.innerHTML=`
    <div class="card" style="margin-bottom:14px;border:1.5px solid var(--blue)">
      <h3 style="margin-bottom:12px"><i class="ti ti-${e?"edit":"plus"}"></i> ${e?"Editar ativo":"Novo ativo"}</h3>
      <div class="field-row">
        <div class="field"><label>Empreendimento</label><input type="text" id="atv-emp" list="atv-emps" value="${o("empreendimento")}" placeholder="ex.: Edifício Aurora"><datalist id="atv-emps">${i.map(s=>`<option value="${esc(s)}">`).join("")}</datalist></div>
        <div class="field"><label>Unidade / setor</label><input type="text" id="atv-uni" list="atv-unis" value="${o("unidade")}" placeholder="ex.: Torre A / Cobertura"><datalist id="atv-unis">${n.map(s=>`<option value="${esc(s)}">`).join("")}</datalist></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Nome do ativo *</label><input type="text" id="atv-nome" value="${o("nome")}" placeholder="ex.: Bomba de recalque 01"></div>
        <div class="field"><label>Categoria</label><select id="atv-cat">${ATIVO_CATEGORIAS.map(s=>`<option${t&&t.categoria===s?" selected":""}>${s}</option>`).join("")}</select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Fabricante</label><input type="text" id="atv-fab" value="${o("fabricante")}"></div>
        <div class="field"><label>Modelo</label><input type="text" id="atv-mod" value="${o("modelo")}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Nº de série / patrimônio</label><input type="text" id="atv-ns" value="${o("num_serie")}"></div>
        <div class="field"><label>Localização</label><input type="text" id="atv-local" value="${o("local")}" placeholder="ex.: Casa de máquinas"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Instalado em</label><input type="date" id="atv-inst" value="${o("instalado_em")}"></div>
        <div class="field"><label>Garantia até</label><input type="date" id="atv-gar" value="${o("garantia_ate")}"></div>
      </div>
      <div class="field"><label>Especificações técnicas</label><div id="atv-esp"></div>
        <button class="btn sm" type="button" onclick="ativoAddEsp()"><i class="ti ti-plus"></i> Adicionar especificação</button></div>
      <div class="field"><label>Documentos (manuais, notas, ART — por link)</label><div id="atv-doc"></div>
        <button class="btn sm" type="button" onclick="ativoAddDoc()"><i class="ti ti-plus"></i> Adicionar documento</button></div>
      <div class="field"><label>Observações</label><textarea id="atv-obs" rows="2">${o("obs")}</textarea></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn primary" onclick="salvarAtivo()"><i class="ti ti-device-floppy"></i> Salvar</button>
        <button class="btn" onclick="_ativoForm=null;renderMntAtivos()">Cancelar</button>
      </div>
    </div>`;ativoRenderEsp();ativoRenderDoc();a.scrollIntoView({behavior:"smooth",block:"start"});const d=document.getElementById("atv-nome");if(d)d.focus()}function ativoLerSub(){if(!_ativoForm)return;_ativoForm.esp=[...document.querySelectorAll("#atv-esp .atv-esp-row")].map(e=>({chave:e.querySelector(".ek").value,valor:e.querySelector(".ev").value}));_ativoForm.doc=[...document.querySelectorAll("#atv-doc .atv-doc-row")].map(e=>({nome:e.querySelector(".dn").value,url:e.querySelector(".du").value,tipo:e.querySelector(".dt").value}))}function ativoRenderEsp(){const e=document.getElementById("atv-esp");if(!e)return;e.innerHTML=_ativoForm.esp.map((t,a)=>`
    <div class="atv-esp-row" style="display:flex;gap:8px;margin-bottom:6px">
      <input type="text" class="aval-in ek" placeholder="Característica (ex.: Potência)" value="${esc(t.chave||"")}" style="flex:1">
      <input type="text" class="aval-in ev" placeholder="Valor (ex.: 3 CV)" value="${esc(t.valor||"")}" style="flex:1">
      <button class="btn icon-only" type="button" title="Remover" onclick="ativoDelEsp(${a})"><i class="ti ti-x"></i></button>
    </div>`).join("")||`<p class="page-sub" style="margin:0 0 6px">Nenhuma especificação.</p>`}function ativoRenderDoc(){const e=document.getElementById("atv-doc");if(!e)return;e.innerHTML=_ativoForm.doc.map((t,a)=>`
    <div class="atv-doc-row" style="display:flex;gap:8px;margin-bottom:6px;flex-wrap:wrap">
      <input type="text" class="aval-in dn" placeholder="Nome (ex.: Manual)" value="${esc(t.nome||"")}" style="flex:1;min-width:120px">
      <input type="url" class="aval-in du" placeholder="URL (https://…)" value="${esc(t.url||"")}" style="flex:1.4;min-width:140px">
      <input type="text" class="aval-in dt" placeholder="Tipo" value="${esc(t.tipo||"")}" style="width:100px">
      <button class="btn icon-only" type="button" title="Remover" onclick="ativoDelDoc(${a})"><i class="ti ti-x"></i></button>
    </div>`).join("")||`<p class="page-sub" style="margin:0 0 6px">Nenhum documento.</p>`}function ativoAddEsp(){ativoLerSub();_ativoForm.esp.push({chave:"",valor:""});ativoRenderEsp()}function ativoDelEsp(e){ativoLerSub();_ativoForm.esp.splice(e,1);ativoRenderEsp()}function ativoAddDoc(){ativoLerSub();_ativoForm.doc.push({nome:"",url:"",tipo:""});ativoRenderDoc()}function ativoDelDoc(e){ativoLerSub();_ativoForm.doc.splice(e,1);ativoRenderDoc()}function salvarAtivo(){const e=document.getElementById("atv-nome").value.trim();if(!e){document.getElementById("atv-nome").focus();toast("Informe o nome do ativo.","warn");return}ativoLerSub();const t=_ativoForm.esp.filter(i=>(i.chave||"").trim()||(i.valor||"").trim());const a=_ativoForm.doc.filter(i=>(i.nome||"").trim()||(i.url||"").trim());const o=_ativoForm.id?ATV.get(_ativoForm.id):null;ATV.upsert({id:_ativoForm.id||CBStore.uuid(),dono:o?o.dono:CBStore.uid(),empreendimento:document.getElementById("atv-emp").value.trim(),unidade:document.getElementById("atv-uni").value.trim(),nome:e,categoria:document.getElementById("atv-cat").value,fabricante:document.getElementById("atv-fab").value.trim(),modelo:document.getElementById("atv-mod").value.trim(),num_serie:document.getElementById("atv-ns").value.trim(),local:document.getElementById("atv-local").value.trim(),instalado_em:document.getElementById("atv-inst").value,garantia_ate:document.getElementById("atv-gar").value,especificacoes:t,documentos:a,obs:document.getElementById("atv-obs").value.trim()});_ativoForm=null;toast(o?"Ativo atualizado.":"Ativo cadastrado.","success");renderMntAtivos()}async function excluirAtivo(e){const t=ATV.get(e);if(!t)return;if(!await cbConfirmar(`Excluir o ativo "${t.nome}"? Esta ação não pode ser desfeita.`))return;ATV.remover(e);toast("Ativo excluído.","info");renderMntAtivos()}function ativoOptions(e){return`<option value="">— sem ativo —</option>`+ATV.listar().map(t=>`<option value="${t.id}"${t.id===e?" selected":""}>${esc(t.nome)}${t.empreendimento?" — "+esc(t.empreendimento):""}</option>`).join("")}function ativoNome(e){const t=ATV.get(e);return t?t.nome:""}let _ageEdit=null;function renderMntAgendamentos(){const e=document.getElementById("mnt-body");if(!e)return;const t=AGE.listar().slice().sort((i,n)=>(i.data||"").localeCompare(n.data||""));const a=i=>AGEND_STATUS.find(n=>n.id===i)||AGEND_STATUS[0];const o=new Date().toISOString().slice(0,10);e.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
      <p class="page-sub" style="margin:0">${t.length} agendamento(s). Manutenção preventiva datada, com responsável e periodicidade.</p>
      ${typeof EXEMPLO!=="undefined"?EXEMPLO.botaoBarraHTML("agendamentos"):""}
    </div>
    <div class="card" style="margin-bottom:14px">
      <h3 style="margin-bottom:12px"><i class="ti ti-calendar-plus"></i> ${_ageEdit?"Editar agendamento":"Novo agendamento"}</h3>
      ${ageFormHTML(_ageEdit?AGE.get(_ageEdit):null)}
    </div>
    ${t.length===0?typeof EXEMPLO!=="undefined"?EXEMPLO.vazioHTML("agendamentos",{icone:"ti-calendar-plus",titulo:"Programe a manutenção preventiva",texto:"Cada agendamento tem data, responsável e periodicidade — o que vence aparece em destaque e o alerta por e-mail avisa antes. É o que transforma o manual do proprietário em rotina de verdade."}):`<p class="page-sub" style="text-align:center;padding:16px">Nenhum agendamento. Programe manutenções preventivas datadas.</p>`:""}
    ${t.map(i=>{const n=a(i.status);const d=i.status==="agendado"&&i.data&&i.data<o;return`
      <div class="card" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start">
          <div style="flex:1;min-width:200px">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <strong>${esc(i.titulo)}</strong>
              <span class="pill pill-${n.cor}">${n.label}</span>
              ${d?`<span class="pill pill-red">Atrasado</span>`:""}
              ${i.periodicidade_meses?`<span class="pill pill-blue">${periodicidadeLabel(Number(i.periodicidade_meses))}</span>`:""}
            </div>
            <p style="font-size:13px;color:var(--text-2);margin-top:4px">
              <i class="ti ti-calendar"></i> ${i.data?new Date(i.data+"T12:00").toLocaleDateString("pt-BR"):"—"}
              ${i.ativo_id&&ativoNome(i.ativo_id)?" · <i class='ti ti-package'></i> "+esc(ativoNome(i.ativo_id)):""}
              ${i.resp?" · "+esc(i.resp):""}
            </p>
            ${i.atividade?`<p style="font-size:13.5px;margin-top:4px">${esc(i.atividade)}</p>`:""}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${i.status==="agendado"?`<button class="btn" onclick="ageConcluir('${i.id}')"><i class="ti ti-check"></i>Concluir</button>`:""}
            <button class="btn" onclick="_ageEdit='${i.id}';renderMntAgendamentos()"><i class="ti ti-edit"></i></button>
            <button class="btn icon-only" title="Excluir" onclick="excluirAgendamento('${i.id}')"><i class="ti ti-trash"></i></button>
          </div>
        </div>
      </div>`}).join("")}`}function ageFormHTML(e){const t=(a,o)=>esc(e&&e[a]!=null?e[a]:o||"");return`
    <div class="field-row">
      <div class="field"><label>Título *</label><input type="text" id="age-titulo" value="${t("titulo")}" placeholder="ex.: Limpeza de reservatório"></div>
      <div class="field"><label>Ativo</label><select id="age-ativo">${ativoOptions(e?e.ativo_id:"")}</select></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Data *</label><input type="date" id="age-data" value="${t("data")}"></div>
      <div class="field"><label>Periodicidade</label><select id="age-per"><option value="">Pontual</option>${AGEND_PERIODOS.map(a=>`<option value="${a}"${e&&Number(e.periodicidade_meses)===a?" selected":""}>${periodicidadeLabel(a)}</option>`).join("")}</select></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Responsável</label><input type="text" id="age-resp" value="${t("resp")}" placeholder="ex.: Empresa X"></div>
      <div class="field"><label>Atividade</label><input type="text" id="age-atv" value="${t("atividade")}" placeholder="descrição curta"></div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn primary" onclick="salvarAgendamento()"><i class="ti ti-device-floppy"></i> ${e?"Salvar":"Agendar"}</button>
      ${e?`<button class="btn" onclick="_ageEdit=null;renderMntAgendamentos()">Cancelar</button>`:""}
    </div>`}function salvarAgendamento(){const e=document.getElementById("age-titulo").value.trim();const t=document.getElementById("age-data").value;if(!e){document.getElementById("age-titulo").focus();toast("Informe o título.","warn");return}if(!t){document.getElementById("age-data").focus();toast("Informe a data.","warn");return}const a=_ageEdit?AGE.get(_ageEdit):null;AGE.upsert({id:_ageEdit||CBStore.uuid(),dono:a?a.dono:CBStore.uid(),titulo:e,data:t,ativo_id:document.getElementById("age-ativo").value,periodicidade_meses:document.getElementById("age-per").value,resp:document.getElementById("age-resp").value.trim(),atividade:document.getElementById("age-atv").value.trim(),status:a?a.status:"agendado"});_ageEdit=null;toast(a?"Agendamento atualizado.":"Agendamento criado.","success");renderMntAgendamentos()}function ageConcluir(e){const t=AGE.get(e);if(!t)return;t.status="concluido";AGE.upsert(t);if(t.periodicidade_meses){const a=new Date(t.data+"T12:00");a.setMonth(a.getMonth()+Number(t.periodicidade_meses));AGE.upsert({...t,id:CBStore.uuid(),data:a.toISOString().slice(0,10),status:"agendado"});toast("Concluído. Próxima ocorrência agendada.","success")}else{toast("Agendamento concluído.","success")}renderMntAgendamentos()}async function excluirAgendamento(e){if(!await cbConfirmar("Excluir este agendamento?"))return;AGE.remover(e);toast("Agendamento excluído.","info");renderMntAgendamentos()}let _calRef=null;function renderMntCalendario(){const e=document.getElementById("mnt-body");if(!e)return;if(!_calRef){const l=new Date;_calRef={y:l.getFullYear(),m:l.getMonth()}}const{y:t,m:a}=_calRef;const o=new Date(t,a,1);const i=o.getDay();const n=new Date(t,a+1,0).getDate();const d=o.toLocaleDateString("pt-BR",{month:"long",year:"numeric"});const s={};const c=(l,r)=>{(s[l]=s[l]||[]).push(r)};AGE.listar().forEach(l=>{if(l.data&&l.status!=="cancelado")c(l.data,{tipo:"age",cor:l.status==="concluido"?"teal":"blue",label:l.titulo})});(typeof MNT!=="undefined"?MNT.listarOS():[]).forEach(l=>{if(l.prazo&&(l.status==="aberta"||l.status==="andamento"))c(l.prazo,{tipo:"os",cor:"amber",label:"OS: "+l.titulo})});const m=new Date().toISOString().slice(0,10);let u="";for(let l=0;l<i;l++)u+=`<div class="cal-cel cal-vazia"></div>`;for(let l=1;l<=n;l++){const r=`${t}-${String(a+1).padStart(2,"0")}-${String(l).padStart(2,"0")}`;const p=s[r]||[];u+=`<div class="cal-cel${r===m?" cal-hoje":""}">
      <div class="cal-dia">${l}</div>
      ${p.slice(0,3).map(v=>`<div class="cal-ev cal-ev-${v.cor}" title="${esc(v.label)}">${esc(v.label)}</div>`).join("")}
      ${p.length>3?`<div class="cal-mais">+${p.length-3}</div>`:""}
    </div>`}e.innerHTML=`
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:10px;flex-wrap:wrap">
        <button class="btn" onclick="calMover(-1)"><i class="ti ti-chevron-left"></i></button>
        <h3 style="margin:0;text-transform:capitalize">${esc(d)}</h3>
        <div style="display:flex;gap:8px"><button class="btn" onclick="calHoje()">Hoje</button><button class="btn" onclick="calMover(1)"><i class="ti ti-chevron-right"></i></button></div>
      </div>
      <div class="cal-grid cal-head">${["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(l=>`<div class="cal-cab">${l}</div>`).join("")}</div>
      <div class="cal-grid">${u}</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:12px;font-size:12.5px;color:var(--text-2)">
        <span><span class="cal-leg cal-ev-blue"></span> Agendamento</span>
        <span><span class="cal-leg cal-ev-amber"></span> Prazo de OS</span>
        <span><span class="cal-leg cal-ev-teal"></span> Concluído</span>
      </div>
    </div>`}function calMover(e){let t=_calRef.m+e,a=_calRef.y;if(t<0){t=11;a--}if(t>11){t=0;a++}_calRef={y:a,m:t};renderMntCalendario()}function calHoje(){const e=new Date;_calRef={y:e.getFullYear(),m:e.getMonth()};renderMntCalendario()}function osFormAtivoField(){return`<div class="field"><label>Ativo (opcional)</label><select id="os-ativo">${ativoOptions("")}</select></div>`}function osCardDetalhes(e){const t=OSD.get(e.id);const a=t.ativo_id?ativoNome(t.ativo_id):"";const o=t.checklist||[];const i=o.filter(n=>n.done).length;return`
    <div class="os-detalhes">
      ${a?`<p style="font-size:12.5px;color:var(--text-2);margin:6px 0 0"><i class="ti ti-package"></i> Ativo: <strong>${esc(a)}</strong></p>`:""}
      <details class="ativo-det"${o.length?" open":""}>
        <summary><i class="ti ti-checklist"></i> Checklist${o.length?` (${i}/${o.length})`:""}</summary>
        <div style="margin-top:6px">
          ${o.map((n,d)=>`<div class="check-item ${n.done?"done":""}" style="padding:4px 0">
            <input type="checkbox" ${n.done?"checked":""} onchange="osChkToggle('${e.id}',${d})">
            <label style="flex:1">${esc(n.texto)}</label>
            <button class="btn icon-only sm" title="Remover" onclick="osChkDel('${e.id}',${d})"><i class="ti ti-x"></i></button>
          </div>`).join("")}
          <div style="display:flex;gap:8px;margin-top:6px">
            <input type="text" class="aval-in" id="chk-in-${e.id}" placeholder="Novo item do checklist…" style="flex:1" onkeydown="if(event.key==='Enter')osChkAdd('${e.id}')">
            <button class="btn sm" onclick="osChkAdd('${e.id}')"><i class="ti ti-plus"></i></button>
          </div>
        </div>
      </details>
    </div>`}function osChkAdd(e){const t=document.getElementById("chk-in-"+e);const a=(t.value||"").trim();if(!a)return;const o=OSD.get(e);const i=(o.checklist||[]).slice();i.push({texto:a,done:false});OSD.set(e,{ativo_id:o.ativo_id,checklist:i});renderMntOS()}function osChkToggle(e,t){const a=OSD.get(e);const o=(a.checklist||[]).slice();if(o[t])o[t]={...o[t],done:!o[t].done};OSD.set(e,{ativo_id:a.ativo_id,checklist:o});renderMntOS()}function osChkDel(e,t){const a=OSD.get(e);const o=(a.checklist||[]).slice();o.splice(t,1);OSD.set(e,{ativo_id:a.ativo_id,checklist:o});renderMntOS()}if(typeof window!=="undefined"){window.ATV=ATV;window.AGE=AGE;window.OSD=OSD;window.mnt2Ready=mnt2Ready}
