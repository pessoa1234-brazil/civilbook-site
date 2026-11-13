// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.
const MNT={KEY_OS:"cb-os",KEY_EXEC:"cb-execucoes",_os:null,_exec:null,_loaded:false,_compartilhados:null,async load(){const e=CBStore.lsGet(this.KEY_OS,[]);const i=CBStore.lsGet(this.KEY_EXEC,{});if(CBStore.online()){try{const[a,t]=await Promise.all([cbLerMeusRecursos("ordens_servico","os",{ordem:"num"}),window.supa.from("manutencao_execucoes").select("*").eq("user_id",CBStore.uid())]);if(a.error)throw a.error;if(t.error)throw t.error;this._compartilhados=a.compartilhados;if(a.parcial&&typeof toast==="function")toast("Ordens de serviço compartilhadas com você podem não ter carregado.","warn");let o=(a.data||[]).map(this._osFromRow);const n={};(t.data||[]).forEach(s=>{n[s.chave]=new Date(s.executed_at).getTime()});if(!a.parcial&&!o.length&&e.length){o=[];for(const s of e){const r={...s,id:CBStore.uuid()};const{error:l}=await window.supa.from("ordens_servico").insert(this._osToRow(r));if(!l)o.push(r)}}if(!Object.keys(n).length&&Object.keys(i).length){const s=Object.entries(i).map(([l,d])=>({user_id:CBStore.uid(),chave:l,executed_at:new Date(d).toISOString()}));const{error:r}=await window.supa.from("manutencao_execucoes").upsert(s);if(!r)Object.assign(n,i)}this._os=o;this._exec=n;if(!a.parcial)CBStore.lsSet(this.KEY_OS,o);CBStore.lsSet(this.KEY_EXEC,n);this._loaded=true;return}catch(a){console.warn("MNT.load:",a&&a.message)}}this._os=e;this._exec=i;this._loaded=true},async ready(){if(!this._loaded)await this.load();return this._loaded},_osFromRow(e){return{id:e.id,num:e.num,titulo:e.titulo,local:e.local,tipo:e.tipo,prioridade:e.prioridade,resp:e.resp,prazo:e.prazo||"",desc:e.descricao||"",status:e.status,dono:e.user_id,criadaEm:e.created_at?new Date(e.created_at).getTime():Date.now()}},_osToRow(e){return{id:e.id,user_id:e.dono||CBStore.uid(),num:e.num,titulo:e.titulo,local:e.local||null,tipo:e.tipo||null,prioridade:e.prioridade||null,resp:e.resp||null,prazo:e.prazo||null,descricao:e.desc||null,status:e.status}},listarOS(){return this._os||[]},osAtencao(){const e=new Date;e.setHours(0,0,0,0);const i=new Date(e);i.setDate(i.getDate()+7);const a={vencidas:[],proximas:[]};this.listarOS().forEach(t=>{if(t.status!=="aberta"&&t.status!=="andamento"||!t.prazo)return;const o=new Date(t.prazo+"T12:00");if(isNaN(o.getTime()))return;if(o<e)a.vencidas.push(t);else if(o<=i)a.proximas.push(t)});return a},upsertOS(e){const i=this.listarOS();const a=i.findIndex(o=>o.id===e.id);const t=a<0;if(t)i.push(e);else i[a]=e;this._ultimaGravacao={id:e.id,t:Date.now()};CBStore.lsSet(this.KEY_OS,i);if(CBStore.online()){const o=this._osToRow(e);const n=t?window.supa.from("ordens_servico").insert(o):window.supa.from("ordens_servico").update(o).eq("id",e.id);n.then(({error:s})=>{if(s)console.warn("MNT.upsertOS:",s.message)})}},_rtCh:null,escutarRealtime(){if(this._rtCh||!window.SHARE||!CBStore.online())return;this._rtCh=SHARE.assinar("ordens_servico",e=>{try{const i=e.new,a=e.old;const t=i&&i.id||a&&a.id;const o=this._ultimaGravacao;if(o&&o.id===t&&Date.now()-o.t<3e3)return;const n=e.eventType==="DELETE";if(!n&&!cbRecursoEhMeu(i,this._compartilhados))return;if(n){if(!a||!a.id||!this.listarOS().some(s=>s.id===a.id))return;this._os=this.listarOS().filter(s=>s.id!==a.id)}else if(i){const s=this._osFromRow(i);const r=this.listarOS().findIndex(l=>l.id===s.id);if(r>=0)this._os[r]=s;else this._os.push(s)}CBStore.lsSet(this.KEY_OS,this._os);if(document.querySelector('[data-cb-view="mnt-os"]'))renderMntOS();if(typeof toast==="function")toast("Ordem de serviço atualizada por um colaborador.","info")}catch(i){}})},execucoes(){return this._exec||{}},registrarExecucao(e){const i=this.execucoes();i[e]=Date.now();CBStore.lsSet(this.KEY_EXEC,i);if(CBStore.online()){window.supa.from("manutencao_execucoes").upsert({user_id:CBStore.uid(),chave:e,executed_at:new Date().toISOString()}).then(({error:a})=>{if(a)console.warn("MNT.exec:",a.message)})}},situacao(e,i){const a=this.execucoes()[e];if(!a)return{st:"nunca",label:"Sem registro"};const t=(Date.now()-a)/864e5;const o=i*30.44;if(t>o)return{st:"vencida",label:"Vencida há "+Math.round(t-o)+" d"};if(t>o*.8)return{st:"vencendo",label:"Vence em "+Math.round(o-t)+" d"};return{st:"ok",label:"Em dia"}},conformidade(){let e=0,i=0,a=0,t=0;PLANO_MANUTENCAO.forEach((o,n)=>o.atividades.forEach((s,r)=>{e++;const l=this.situacao(n+"-"+r,s.periodicidade).st;if(l==="ok"||l==="vencendo")i++;else if(l==="vencida")a++;else t++}));return{total:e,emDia:i,vencidas:a,semRegistro:t,pct:e?Math.round(i/e*100):0}}};async function renderManutencao(e){if(!planoEhPro())return renderManutencaoUpsell(e);if(!MNT._loaded){app.innerHTML=CBStore.loadingCard("Carregando manutenção…");await MNT.ready()}MNT.escutarRealtime();if(typeof GAR!=="undefined"&&!GAR._loaded)await GAR.ready();if(typeof mnt2Ready==="function")await mnt2Ready();if(typeof conf2Ready==="function")await conf2Ready();if(typeof manualReady==="function")await manualReady();if(typeof slaReady==="function")await slaReady();e=e||"visao";const i=[{titulo:"Manutenção",abas:[{id:"visao",label:"Visão geral",icone:"ti-gauge"},{id:"ativos",label:"Ativos",icone:"ti-package"},{id:"os",label:"Ordens de serviço",icone:"ti-tool"},{id:"agendamentos",label:"Agendamentos",icone:"ti-calendar-plus"},{id:"calendario",label:"Calendário",icone:"ti-calendar-month"},{id:"cronograma",label:"Cronograma",icone:"ti-calendar-time"}]},{titulo:"Garantias e documentação",abas:[{id:"garantias",label:"Garantias",icone:"ti-shield-check"},{id:"manual",label:"Manual",icone:"ti-book"},{id:"fornecedores",label:"Fornecedores",icone:"ti-truck"},{id:"conformidade",label:"Conformidade",icone:"ti-clipboard-check"}]}];app.innerHTML=`
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <h2 class="page-title" style="margin-right:auto">Manutenções e Garantias</h2>
      <button class="btn" onclick="cbAssessor('abrirCom','manutencao')" title="Abrir o assessor já sabendo que você está na Manutenção (f40)"><i class="ti ti-sparkles" aria-hidden="true"></i> Perguntar à IA</button>
    </div>
    <p class="page-sub">Gestão NBR 5674 (manutenção) e NBR 17170 (garantias) — plano preventivo, OS, prazos de garantia e fornecedores.</p>
    <div class="tabs-bar">
      ${i.map(a=>`<span class="tabs-grupo">${a.titulo}</span>${a.abas.map(t=>`<button class="${t.id===e?"active":""}" onclick="navigate('manutencao','${t.id}')"><i class="ti ${t.icone}"></i>${t.label}</button>`).join("")}`).join("")}
    </div>
    <div id="mnt-body"></div>`;if(e==="os")renderMntOS();else if(e==="ativos"&&typeof renderMntAtivos==="function")renderMntAtivos();else if(e==="agendamentos"&&typeof renderMntAgendamentos==="function")renderMntAgendamentos();else if(e==="calendario"&&typeof renderMntCalendario==="function")renderMntCalendario();else if(e==="cronograma")renderMntCronograma();else if(e==="manual"&&typeof renderMntManual==="function")renderMntManual();else if(e==="garantias"&&typeof renderGarantias==="function")renderGarantias();else if(e==="fornecedores"&&typeof renderFornecedores==="function")renderFornecedores();else if(e==="conformidade"&&typeof renderMntConformidade==="function")renderMntConformidade();else if(typeof renderMntPainel==="function")renderMntPainel();else renderMntVisao()}function renderManutencaoUpsell(e){const i=["ativos","agendamentos","garantias"].includes(e)?e:"ativos";app.innerHTML=`
    <div class="card" style="max-width:560px;margin:40px auto;text-align:center;padding:36px">
      <div class="card-icon" style="background:var(--blue-light);color:var(--blue);margin:0 auto 16px"><i class="ti ti-lock"></i></div>
      <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">Gestão de manutenção é um recurso PRO</h2>
      <p style="color:var(--text-2);margin-bottom:20px">Ordens de serviço, cronograma preventivo NBR 5674 e painel de conformidade para o seu empreendimento.</p>
      ${typeof cbTesteBotaoHTML==="function"?cbTesteBotaoHTML("manutencao",null,"btn primary lg"):""}
      ${typeof EXEMPLO!=="undefined"?EXEMPLO.botaoUpsellHTML(i):""}
    </div>`}function renderMntVisao(){const e=MNT.conformidade();const i=MNT.listarOS();const a=i.filter(o=>o.status==="aberta"||o.status==="andamento");const t=e.pct>=80?"var(--teal)":e.pct>=50?"var(--amber)":"var(--red)";document.getElementById("mnt-body").innerHTML=`
    <div class="grid grid-3" style="margin-bottom:14px">
      <div class="card" style="text-align:center">
        <div style="font-size:36px;font-weight:600;color:${t}">${e.pct}%</div>
        <p>Aderência ao plano preventivo</p>
      </div>
      <div class="card" style="text-align:center">
        <div style="font-size:36px;font-weight:600;color:var(--blue)">${a.length}</div>
        <p>OS abertas ou em andamento</p>
      </div>
      <div class="card" style="text-align:center">
        <div style="font-size:36px;font-weight:600;color:${e.vencidas?"var(--red)":"var(--teal)"}">${e.vencidas}</div>
        <p>Atividades preventivas vencidas</p>
      </div>
    </div>
    <div class="card">
      <h3 style="margin-bottom:10px">Resumo do plano (${e.total} atividades)</h3>
      <div class="progress-bar" style="margin:10px 0"><div style="width:${e.pct}%;background:${t}"></div></div>
      <p style="font-size:13.5px;color:var(--text-2)">
        ${e.emDia} em dia · ${e.vencidas} vencidas · ${e.semRegistro} sem registro de execução.
        Registre as execuções na aba <a href="javascript:navigate('manutencao','cronograma')" style="color:var(--blue)">Cronograma</a>.
      </p>
    </div>`}function renderMntOS(){const e=MNT.listarOS();const i=t=>OS_STATUS.find(o=>o.id===t)||OS_STATUS[0];const a=t=>OS_PRIORIDADES.find(o=>o.id===t)||OS_PRIORIDADES[0];document.getElementById("mnt-body").innerHTML=`
    <div class="card" data-cb-view="mnt-os" style="margin-bottom:14px">
      <h3 style="margin-bottom:12px"><i class="ti ti-plus"></i> Nova ordem de serviço</h3>
      <div class="field-row">
        <div class="field"><label>Título *</label><input type="text" id="os-titulo" placeholder="ex.: Vazamento no barrilete"></div>
        <div class="field"><label>Local</label><input type="text" id="os-local" placeholder="ex.: Cobertura, torre A"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Tipo</label><select id="os-tipo">${OS_TIPOS.map(t=>`<option>${t}</option>`).join("")}</select></div>
        <div class="field"><label>Prioridade</label><select id="os-prio">${OS_PRIORIDADES.map(t=>`<option value="${t.id}">${t.label}</option>`).join("")}</select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Responsável</label><input type="text" id="os-resp" placeholder="ex.: Zelador / empresa X"></div>
        <div class="field"><label>Prazo</label><input type="date" id="os-prazo"></div>
      </div>
      ${typeof osFormAtivoField==="function"?osFormAtivoField():""}
      <div class="field"><label>Descrição</label><textarea id="os-desc" rows="2"></textarea></div>
      <button class="btn primary" onclick="criarOS()"><i class="ti ti-plus"></i>Abrir OS</button>
    </div>
    ${e.length===0?`<p class="page-sub" style="text-align:center;padding:20px">Nenhuma OS registrada ainda.</p>`:""}
    ${e.slice().reverse().map(t=>{const o=i(t.status),n=a(t.prioridade);return`
      <div class="card os-card" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start">
          <div style="flex:1;min-width:220px">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <span class="os-num">OS-${String(t.num).padStart(3,"0")}</span>
              <span class="pill pill-${n.cor}">${n.label}</span>
              <span class="pill pill-${o.cor}">${o.label}</span>
              ${t.dono&&window.SHARE&&SHARE.uid()&&t.dono!==SHARE.uid()?`<span class="pill" style="background:var(--purple-light);color:var(--purple)"><i class="ti ti-users"></i> Compartilhada</span>`:""}
            </div>
            <h3 style="margin:6px 0 2px">${esc(t.titulo)}</h3>
            <p style="font-size:13px;color:var(--text-2)">
              ${esc(t.tipo)}${t.local?" · "+esc(t.local):""}${t.resp?" · Resp.: "+esc(t.resp):""}${t.prazo?" · Prazo: "+new Date(t.prazo+"T12:00").toLocaleDateString("pt-BR"):""}
            </p>
            ${t.desc?`<p style="font-size:13.5px;margin-top:6px">${esc(t.desc)}</p>`:""}
            ${typeof osCardDetalhes==="function"?osCardDetalhes(t):""}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${t.status==="aberta"?`<button class="btn" onclick="mudarStatusOS(${t.num},'andamento')"><i class="ti ti-player-play"></i>Iniciar</button>`:""}
            ${t.status!=="concluida"&&t.status!=="cancelada"?`<button class="btn" onclick="mudarStatusOS(${t.num},'concluida')"><i class="ti ti-check"></i>Concluir</button>`:""}
            ${t.status!=="cancelada"&&t.status!=="concluida"?`<button class="btn" onclick="mudarStatusOS(${t.num},'cancelada')"><i class="ti ti-x"></i>Cancelar</button>`:""}
            ${!t.dono||window.SHARE&&SHARE.uid()===t.dono?`<button class="btn icon-only" title="Compartilhar" onclick="abrirCompartilhar('os','${t.id}',this.dataset.n)" data-n="${esc(t.titulo).replace(/"/g,"&quot;")}"><i class="ti ti-share"></i></button>`:""}
          </div>
        </div>
      </div>`}).join("")}`}function criarOS(){const e=document.getElementById("os-titulo").value.trim();if(!e){document.getElementById("os-titulo").focus();toast("Informe o título da OS.","warn");return}const i=MNT.listarOS();const a={id:CBStore.uuid(),num:(i.length?Math.max(...i.map(o=>o.num)):0)+1,titulo:e,local:document.getElementById("os-local").value.trim(),tipo:document.getElementById("os-tipo").value,prioridade:document.getElementById("os-prio").value,resp:document.getElementById("os-resp").value.trim(),prazo:document.getElementById("os-prazo").value,desc:document.getElementById("os-desc").value.trim(),status:"aberta",criadaEm:Date.now()};MNT.upsertOS(a);const t=document.getElementById("os-ativo");if(t&&typeof OSD!=="undefined"&&t.value)OSD.set(a.id,{ativo_id:t.value,checklist:[]});toast("OS aberta.","success");renderMntOS()}function mudarStatusOS(e,i){const a=MNT.listarOS().find(t=>t.num===e);if(a){a.status=i;MNT.upsertOS(a)}renderMntOS()}function renderMntCronograma(){document.getElementById("mnt-body").innerHTML=PLANO_MANUTENCAO.map((e,i)=>`
    <div class="card" style="margin-bottom:12px">
      <h3 style="margin-bottom:4px"><i class="ti ${e.icone}" style="margin-right:6px;color:var(--text-2)"></i>${e.sistema}</h3>
      ${e.atividades.map((a,t)=>{const o=i+"-"+t;const n=MNT.situacao(o,a.periodicidade);const s={ok:"teal",vencendo:"amber",vencida:"red",nunca:"gray"}[n.st];return`
        <div class="cron-item">
          <div style="flex:1;min-width:200px">
            <p style="font-size:14px;font-weight:500">${a.atividade}</p>
            <p style="font-size:12.5px;color:var(--text-2)">${periodicidadeLabel(a.periodicidade)} · ${a.responsavel}${a.norma?" · "+a.norma:""}</p>
          </div>
          <span class="pill pill-${s}">${n.label}</span>
          <button class="btn" onclick="MNT.registrarExecucao('${o}');toast('Execução registrada.','success');renderMntCronograma()"><i class="ti ti-check"></i>Registrar execução</button>
        </div>`}).join("")}
    </div>`).join("")+`
    <p class="page-sub"><i class="ti ti-info-circle"></i> Periodicidades orientativas conforme práticas usuais da NBR 5674 — ajuste ao manual de uso e operação do seu empreendimento.</p>`}
