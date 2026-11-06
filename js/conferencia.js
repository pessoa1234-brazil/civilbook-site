// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.
const CONF={KEY:"cb-projetos",_cache:null,_loaded:false,_compartilhados:null,async load(){const t=CBStore.lsGet(this.KEY,[]);if(CBStore.online()){try{const{data:e,error:i,parcial:s,compartilhados:o}=await cbLerMeusRecursos("projetos","projeto",{ordem:"created_at"});if(i)throw i;this._compartilhados=o;if(s&&typeof toast==="function")toast("Projetos compartilhados com você podem não ter carregado.","warn");let a=(e||[]).map(this._fromRow);if(!s&&!a.length&&t.length){a=[];for(const n of t){const r={...n,id:CBStore.uuid()};const{error:c}=await window.supa.from("projetos").insert(this._toRow(r));if(!c)a.push(r)}}this._cache=a;if(!s)CBStore.lsSet(this.KEY,this._cache);this._loaded=true;return}catch(e){console.warn("CONF.load:",e&&e.message)}}this._cache=t;this._loaded=true},async ready(){if(!this._loaded)await this.load();return this._loaded},_fromRow(t){return{id:t.id,nome:t.nome,tipo:t.tipo,fase:t.fase,rev:t.rev,rt:t.rt,crea:t.crea,dono:t.user_id,disciplinas:t.disciplinas||[],respostas:t.respostas||{},criadoEm:t.created_at?new Date(t.created_at).getTime():Date.now()}},_toRow(t){return{id:t.id,user_id:t.dono||CBStore.uid(),nome:t.nome,tipo:t.tipo,fase:t.fase,rev:t.rev,rt:t.rt,crea:t.crea,disciplinas:t.disciplinas||[],respostas:t.respostas||{}}},projetos(){return this._cache||[]},projeto(t){return this.projetos().find(e=>e.id===t)},upsert(t){const e=this.projetos();const i=e.findIndex(o=>o.id===t.id);const s=i<0;if(s)e.push(t);else e[i]=t;this._ultimaGravacao={id:t.id,t:Date.now()};CBStore.lsSet(this.KEY,e);if(CBStore.online()){const o=this._toRow(t);const a=s?window.supa.from("projetos").insert(o):window.supa.from("projetos").update(o).eq("id",t.id);a.then(({error:n})=>{if(n)console.warn("CONF.upsert:",n.message)})}return t},remove(t){this._cache=this.projetos().filter(e=>e.id!==t);CBStore.lsSet(this.KEY,this._cache);if(CBStore.online()){window.supa.from("projetos").delete().eq("id",t).then(({error:e})=>{if(e)console.warn("CONF.remove:",e.message)})}},atualizar(t,e){const i=this.projeto(t);if(i){e(i);this.upsert(i)}return i},_rtCh:null,escutarRealtime(){if(this._rtCh||!window.SHARE||!CBStore.online())return;this._rtCh=SHARE.assinar("projetos",t=>{try{const e=t.new,i=t.old;const s=e&&e.id||i&&i.id;const o=this._ultimaGravacao;if(o&&o.id===s&&Date.now()-o.t<3e3)return;const a=t.eventType==="DELETE";if(!a&&!cbRecursoEhMeu(e,this._compartilhados))return;if(a){if(!i||!i.id||!this.projetos().some(n=>n.id===i.id))return;this._cache=this.projetos().filter(n=>n.id!==i.id)}else if(e){const n=this._fromRow(e);const r=this.projetos().findIndex(c=>c.id===n.id);if(r>=0)this._cache[r]=n;else this._cache.push(n)}CBStore.lsSet(this.KEY,this._cache);if(document.querySelector('[data-cb-view="conf-lista"]'))renderConfLista();else{const n=document.querySelector('[data-cb-view="conf-proj"]');if(n&&n.dataset.id===s&&this.projeto(s))renderConfProjeto(this.projeto(s))}if(typeof toast==="function")toast("Projeto atualizado por um colaborador.","info")}catch(e){}})},statsDisciplina(t,e){const i=CONFERENCIA.find(d=>d.id===e);let s=i.itens.length,o=0,a=0,n=0,r=0;i.itens.forEach((d,p)=>{const l=(t.respostas||{})[e+"-"+p];if(!l)return;if(l.st==="c")o++;else if(l.st==="na")n++;else if(l.st==="nc"){a++;if(d.elim)r++}});const c=o+a+n;return{total:s,c:o,nc:a,na:n,ncElim:r,respondidos:c,pct:Math.round(c/s*100)}},statsProjeto(t){let e=0,i=0,s=0,o=0;(t.disciplinas||[]).forEach(a=>{const n=this.statsDisciplina(t,a);e+=n.total;i+=n.respondidos;s+=n.nc;o+=n.ncElim});return{total:e,respondidos:i,nc:s,ncElim:o,pct:e?Math.round(i/e*100):0}}};const CONFRES={TABLE:"conferencia_resultados",LS:"cb-conf-resultados",veredito(t){const e=CONF.statsProjeto(t);const i=e.ncElim?"REPROVADO — critérios eliminatórios não conformes":e.pct<100?"EM ANDAMENTO — conferência incompleta ("+e.pct+"%)":e.nc?"APROVADO COM RESSALVAS — "+e.nc+" não conformidade(s) a corrigir":"APROVADO — todas as verificações conformes";return{resultado:i,stats:e}},_ncs(t){const e=[];(t.disciplinas||[]).forEach(i=>{const s=CONFERENCIA.find(o=>o.id===i);if(!s)return;s.itens.forEach((o,a)=>{const n=(t.respostas||{})[i+"-"+a];if(n&&n.st==="nc")e.push({disciplina:s.disciplina,item:o.texto,elim:!!o.elim,norma:o.norma||"",obs:n.obs||""})})});return e},async registrar(t){if(!t)return;const{resultado:e,stats:i}=this.veredito(t);const s={id:CBStore.uuid(),projeto_id:t.id,projeto_nome:t.nome,resultado:e,pct:i.pct,nc:i.nc,nc_elim:i.ncElim,total:i.total,respondidos:i.respondidos,fase:t.fase||"",rev:t.rev||"",rt:t.rt||"",crea:t.crea||"",ncs:this._ncs(t),created_at:new Date().toISOString()};let o=CBStore.lsGet(this.LS,[]);o.unshift(s);CBStore.lsSet(this.LS,o.slice(0,100));if(CBStore.online()){const a=await CBStore.upsert(this.TABLE,{...s,user_id:CBStore.uid()});if(a&&a.error){if(typeof toast==="function")toast("Registrado localmente; falha ao gravar no banco.","warn");return}}if(typeof toast==="function")toast("Resultado registrado para auditoria.","success")},async historico(t){const e=CBStore.uid();if(CBStore.online()&&e){try{let s=window.supa.from("conferencia_resultados").select("*").eq("user_id",e).order("created_at",{ascending:false}).limit(50);if(t)s=s.eq("projeto_id",t);const{data:o,error:a}=await s;if(!a&&o)return o}catch(s){}}let i=CBStore.lsGet(this.LS,[]);return t?i.filter(s=>s.projeto_id===t):i},async abrirHistorico(t){if(!t)return;document.getElementById("cb-conf-hist")?.remove();const e=await this.historico(t.id);const i=a=>/REPROVADO/.test(a)?"var(--red)":/RESSALVAS/.test(a)?"var(--amber,#c97a00)":/ANDAMENTO/.test(a)?"var(--text-3)":"var(--green)";const s=e.length?e.map(a=>`
      <div class="hist-item">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13.5px;color:${i(a.resultado)}">${esc(a.resultado)}</div>
          <div style="font-size:12px;color:var(--text-3);margin:2px 0">${a.created_at?new Date(a.created_at).toLocaleString("pt-BR"):""}</div>
          <div style="font-size:12.5px;color:var(--text-2)">${a.respondidos}/${a.total} itens · ${a.nc||0} NC (${a.nc_elim||0} elim.) · ${a.pct}%${a.rt?" · RT: "+esc(a.rt):""}</div>
        </div>
      </div>`).join(""):`<p class="page-sub" style="text-align:center;padding:18px 0">Nenhum resultado registrado para este projeto ainda.</p>`;const o=document.createElement("div");o.id="cb-conf-hist";o.className="cb-modal-ov";o.onclick=a=>{if(a.target===o)o.remove()};o.innerHTML=`<div class="card cb-modal-box">
      <h3 style="margin-bottom:4px">Histórico de conferências</h3>
      <p class="page-sub" style="margin-bottom:12px">${esc(t.nome)} — registros para auditoria.</p>
      <div class="hist-list">${s}</div>
      <div style="text-align:right;margin-top:12px"><button class="btn" id="cb-confhist-close">Fechar</button></div>
    </div>`;document.body.appendChild(o);o.querySelector("#cb-confhist-close").onclick=()=>o.remove()}};async function renderConferencia(t){if(!planoEhPro())return renderConferenciaUpsell();if(!CONF._loaded){app.innerHTML=CBStore.loadingCard("Carregando projetos…");await CONF.ready()}CONF.escutarRealtime();if(t&&t.startsWith("p:")){const e=t.split(":");const i=CONF.projeto(e[1]);if(i){if(e[2]==="rel")return renderConfRelatorio(i);if(e[2])return renderConfDisciplina(i,e[2]);return renderConfProjeto(i)}}if(t==="novo")return renderConfNovo();renderConfLista()}function renderConferenciaUpsell(){app.innerHTML=`
    <div class="card" style="max-width:560px;margin:40px auto;text-align:center;padding:36px">
      <div class="card-icon" style="background:var(--purple-light);color:var(--purple);margin:0 auto 16px"><i class="ti ti-lock"></i></div>
      <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">Conferência de projetos é um recurso PRO</h2>
      <p style="color:var(--text-2);margin-bottom:20px">Verificação por disciplina com critérios eliminatórios, controle de pendências e relatório de conferência.</p>
      ${typeof cbTesteBotaoHTML==="function"?cbTesteBotaoHTML("conferencia",null,"btn primary lg"):""}
    </div>`}function renderConfLista(){const t=CONF.projetos();app.innerHTML=`
    <div data-cb-view="conf-lista" style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px;margin-bottom:6px">
      <div>
        <h2 class="page-title">Conferência de projetos</h2>
        <p class="page-sub" style="margin-bottom:0">Verifique cada disciplina antes de aprovar, licitar ou executar.</p>
      </div>
      <button class="btn primary" onclick="navigate('conferencia','novo')"><i class="ti ti-plus"></i>Novo projeto</button>
    </div>
    <div style="margin-top:20px">
    ${t.length===0?`
      <div class="card" style="text-align:center;padding:40px">
        <div class="card-icon" style="background:var(--purple-light);color:var(--purple);margin:0 auto 14px"><i class="ti ti-clipboard-list"></i></div>
        <h3>Nenhum projeto em conferência</h3>
        <p style="margin-bottom:16px">Crie o primeiro projeto e selecione as disciplinas a verificar.</p>
        <button class="btn primary" onclick="navigate('conferencia','novo')"><i class="ti ti-plus"></i>Criar projeto</button>
      </div>`:t.map(e=>{const i=CONF.statsProjeto(e);const s=i.ncElim?{txt:"Reprovado (eliminatório)",cor:"red"}:i.pct===100&&i.nc===0?{txt:"Aprovado",cor:"teal"}:i.pct===100?{txt:"Concluído com NCs",cor:"amber"}:{txt:i.pct+"% conferido",cor:"blue"};return`
        <div class="card clickable" style="margin-bottom:10px" onclick="navigate('conferencia','p:${e.id}')">
          <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center">
            <div>
              <h3>${esc(e.nome)}</h3>
              <p style="font-size:13px;color:var(--text-2)">${esc(e.tipo)} · ${esc(e.fase)} · ${(e.disciplinas||[]).length} disciplinas${e.rt?" · RT: "+esc(e.rt):""}</p>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              ${e.dono&&window.SHARE&&SHARE.uid()&&e.dono!==SHARE.uid()?`<span class="pill" style="background:var(--purple-light);color:var(--purple)"><i class="ti ti-users"></i> Compartilhado</span>`:""}
              ${i.nc?`<span class="pill pill-coral">${i.nc} NC</span>`:""}
              <span class="pill pill-${s.cor}">${s.txt}</span>
              <i class="ti ti-chevron-right" style="color:var(--text-3)"></i>
            </div>
          </div>
          <div class="progress-bar" style="margin:12px 0 0"><div style="width:${i.pct}%"></div></div>
        </div>`}).join("")}
    </div>`}function renderConfNovo(){app.innerHTML=`
    <button class="back-link" onclick="navigate('conferencia')"><i class="ti ti-arrow-left"></i>Projetos</button>
    <h2 class="page-title">Novo projeto</h2>
    <p class="page-sub">Identifique a obra e selecione as disciplinas que serão conferidas.</p>
    <div class="card" style="max-width:720px">
      <div class="field-row">
        <div class="field"><label>Nome da obra *</label><input type="text" id="cf-nome" placeholder="ex.: CMEI Jardim Monte Rei"></div>
        <div class="field"><label>Tipo</label><select id="cf-tipo">${TIPOS_OBRA.map(t=>`<option>${t}</option>`).join("")}</select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Fase do projeto</label><select id="cf-fase">${FASES_PROJETO.map(t=>`<option ${t==="Projeto executivo"?"selected":""}>${t}</option>`).join("")}</select></div>
        <div class="field"><label>Revisão em conferência</label><input type="text" id="cf-rev" placeholder="ex.: R03"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Responsável técnico</label><input type="text" id="cf-rt" placeholder="Nome do RT"></div>
        <div class="field"><label>CREA/CAU</label><input type="text" id="cf-crea" placeholder="ex.: PR-123456/D"></div>
      </div>
      <div class="field">
        <label>Disciplinas a conferir</label>
        <div class="disc-grid">
          ${CONFERENCIA.map(t=>`
            <label class="disc-check">
              <input type="checkbox" value="${t.id}" ${["arquitetonico","estrutural","compatibilizacao","documentacao"].includes(t.id)?"checked":""}>
              <i class="ti ${t.icone}"></i>${t.disciplina}
              <span style="margin-left:auto;font-size:11.5px;color:var(--text-3)">${t.itens.length} itens</span>
            </label>`).join("")}
        </div>
      </div>
      <button class="btn primary lg" onclick="criarProjetoConf()"><i class="ti ti-plus"></i>Criar e iniciar conferência</button>
    </div>`}function criarProjetoConf(){const t=document.getElementById("cf-nome").value.trim();if(!t){document.getElementById("cf-nome").focus();toast("Informe o nome da obra.","warn");return}const e=[...document.querySelectorAll(".disc-check input:checked")].map(s=>s.value);if(!e.length){toast("Selecione ao menos uma disciplina.","warn");return}const i={id:CBStore.uuid(),nome:t,tipo:document.getElementById("cf-tipo").value,fase:document.getElementById("cf-fase").value,rev:document.getElementById("cf-rev").value.trim(),rt:document.getElementById("cf-rt").value.trim(),crea:document.getElementById("cf-crea").value.trim(),disciplinas:e,respostas:{},criadoEm:Date.now()};CONF.upsert(i);toast("Projeto criado.","success");navigate("conferencia","p:"+i.id)}function renderConfProjeto(t){const e=CONF.statsProjeto(t);app.innerHTML=`
    <button class="back-link" data-cb-view="conf-proj" data-id="${esc(t.id)}" onclick="navigate('conferencia')"><i class="ti ti-arrow-left"></i>Projetos</button>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px;margin-bottom:18px">
      <div>
        <h2 class="page-title" style="margin-bottom:2px">${esc(t.nome)}</h2>
        <p class="page-sub" style="margin-bottom:0">${esc(t.tipo)} · ${esc(t.fase)}${t.rev?" · Rev. "+esc(t.rev):""}${t.rt?" · RT: "+esc(t.rt)+(t.crea?" ("+esc(t.crea)+")":""):""}</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn" onclick="navigate('conferencia','p:${t.id}:rel')"><i class="ti ti-file-text"></i>Relatório</button>
        ${!t.dono||window.SHARE&&SHARE.uid()===t.dono?`
        <button class="btn" title="Compartilhar" onclick="abrirCompartilhar('projeto','${t.id}',this.dataset.n)" data-n="${esc(t.nome).replace(/"/g,"&quot;")}"><i class="ti ti-share"></i></button>
        <button class="btn" title="Excluir" onclick="excluirProjetoConf('${t.id}')"><i class="ti ti-trash"></i></button>`:`
        <span class="pill" style="background:var(--purple-light);color:var(--purple)"><i class="ti ti-users"></i> Compartilhado com você</span>`}
      </div>
    </div>
    ${e.ncElim?`<div class="result danger" style="margin-bottom:16px"><div class="r-label"><i class="ti ti-alert-triangle"></i> ${e.ncElim} critério(s) eliminatório(s) não conforme(s) — o projeto não pode ser aprovado até a correção.</div></div>`:""}
    <div class="grid grid-3" style="margin-bottom:16px">
      <div class="card" style="text-align:center"><div style="font-size:32px;font-weight:600;color:var(--blue)">${e.pct}%</div><p>Itens conferidos (${e.respondidos}/${e.total})</p></div>
      <div class="card" style="text-align:center"><div style="font-size:32px;font-weight:600;color:${e.nc?"var(--coral)":"var(--teal)"}">${e.nc}</div><p>Não conformidades</p></div>
      <div class="card" style="text-align:center"><div style="font-size:32px;font-weight:600;color:${e.ncElim?"var(--red)":"var(--teal)"}">${e.ncElim}</div><p>NCs eliminatórias</p></div>
    </div>
    ${t.disciplinas.map(i=>{const s=CONFERENCIA.find(r=>r.id===i);const o=CONF.statsDisciplina(t,i);const a=o.ncElim?"red":o.nc?"coral":o.pct===100?"teal":"blue";const n=o.ncElim?"Eliminatório NC":o.pct===100?o.nc?o.nc+" NC":"Conforme":o.respondidos+"/"+o.total;return`
      <div class="card clickable" style="margin-bottom:8px" onclick="navigate('conferencia','p:${t.id}:${i}')">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
          <div style="display:flex;align-items:center;gap:10px">
            <i class="ti ${s.icone}" style="font-size:20px;color:var(--text-2)"></i>
            <h3 style="font-size:15px">${s.disciplina}</h3>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span class="pill pill-${a}">${n}</span>
            <i class="ti ti-chevron-right" style="color:var(--text-3)"></i>
          </div>
        </div>
        <div class="progress-bar" style="margin:10px 0 0"><div style="width:${o.pct}%"></div></div>
      </div>`}).join("")}`}async function excluirProjetoConf(t){if(!await cbConfirmar("Excluir este projeto e toda a conferência?"))return;CONF.remove(t);navigate("conferencia")}function renderConfDisciplina(t,e){const i=CONFERENCIA.find(s=>s.id===e);app.innerHTML=`
    <button class="back-link" onclick="navigate('conferencia','p:${t.id}')"><i class="ti ti-arrow-left"></i>${esc(t.nome)}</button>
    <h2 class="page-title"><i class="ti ${i.icone}" style="margin-right:8px;color:var(--text-2)"></i>${i.disciplina}</h2>
    <p class="page-sub">Marque cada item: <strong>C</strong> conforme · <strong>NC</strong> não conforme · <strong>NA</strong> não se aplica. Itens com <i class="ti ti-alert-triangle" style="color:var(--red)"></i> são eliminatórios.</p>
    <div class="card">
      ${i.itens.map((s,o)=>{const a=e+"-"+o;const n=(t.respostas||{})[a]||{};return`
        <div class="conf-item ${n.st==="nc"?"conf-nc":""}" id="ci-${o}">
          <div style="flex:1;min-width:240px">
            <p style="font-size:14px;font-weight:500">
              ${s.elim?`<i class="ti ti-alert-triangle" style="color:var(--red);margin-right:4px" title="Eliminatório"></i>`:""}
              ${s.texto}
            </p>
            ${s.norma?`<p style="font-size:12px;color:var(--text-3)"><i class="ti ti-book"></i> ${s.norma}</p>`:""}
            <input type="text" class="conf-obs ${n.st==="nc"||n.obs?"":"hidden"}" id="obs-${o}" placeholder="Observação / pendência…" value="${(n.obs||"").replace(/"/g,"&quot;")}" onchange="salvarObsConf('${t.id}','${e}',${o},this.value)">
          </div>
          <div class="conf-btns">
            <button class="cb-c ${n.st==="c"?"on":""}" onclick="marcarConf('${t.id}','${e}',${o},'c')" title="Conforme">C</button>
            <button class="cb-nc ${n.st==="nc"?"on":""}" onclick="marcarConf('${t.id}','${e}',${o},'nc')" title="Não conforme">NC</button>
            <button class="cb-na ${n.st==="na"?"on":""}" onclick="marcarConf('${t.id}','${e}',${o},'na')" title="Não se aplica">NA</button>
          </div>
        </div>`}).join("")}
    </div>
    <div style="display:flex;gap:10px;margin-top:14px">
      <button class="btn" onclick="marcarTodosConf('${t.id}','${e}')"><i class="ti ti-checks"></i>Marcar restantes como conformes</button>
      <button class="btn primary" onclick="navigate('conferencia','p:${t.id}')"><i class="ti ti-arrow-left"></i>Voltar ao painel</button>
    </div>`}function marcarConf(t,e,i,s){CONF.atualizar(t,o=>{o.respostas=o.respostas||{};const a=e+"-"+i;const n=o.respostas[a]||{};o.respostas[a]={st:n.st===s?null:s,obs:n.obs||""}});renderConfDisciplina(CONF.projeto(t),e)}function salvarObsConf(t,e,i,s){CONF.atualizar(t,o=>{o.respostas=o.respostas||{};const a=e+"-"+i;o.respostas[a]={...o.respostas[a]||{},obs:s}})}function marcarTodosConf(t,e){const i=CONFERENCIA.find(s=>s.id===e);CONF.atualizar(t,s=>{s.respostas=s.respostas||{};i.itens.forEach((o,a)=>{const n=e+"-"+a;if(!s.respostas[n]||!s.respostas[n].st){s.respostas[n]={...s.respostas[n]||{},st:"c"}}})});renderConfDisciplina(CONF.projeto(t),e)}function renderConfRelatorio(t){const{resultado:e,stats:i}=CONFRES.veredito(t);app.innerHTML=`
    <button class="back-link no-print" onclick="navigate('conferencia','p:${t.id}')"><i class="ti ti-arrow-left"></i>${esc(t.nome)}</button>
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px" class="no-print">
      <h2 class="page-title" style="margin:0">Relatório de conferência</h2>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn" onclick="CONFRES.abrirHistorico(CONF.projeto('${t.id}'))"><i class="ti ti-history"></i>Histórico</button>
        <button class="btn" onclick="CONFRES.registrar(CONF.projeto('${t.id}'))"><i class="ti ti-device-floppy"></i>Registrar resultado</button>
        <button class="btn primary" onclick="window.print()"><i class="ti ti-printer"></i>Imprimir / salvar PDF</button>
      </div>
    </div>
    <div class="card laudo-print">
      <h2 style="font-size:18px;text-align:center;margin-bottom:4px">RELATÓRIO DE CONFERÊNCIA DE PROJETOS</h2>
      <p style="text-align:center;font-size:12.5px;color:var(--text-2);margin-bottom:18px">Gerado pelo Civilbook em ${new Date().toLocaleDateString("pt-BR")}</p>
      <table class="spec-table" style="margin-bottom:18px">
        <tr><td>Obra</td><td>${esc(t.nome)}</td></tr>
        <tr><td>Tipo</td><td>${esc(t.tipo)}</td></tr>
        <tr><td>Fase / Revisão</td><td>${esc(t.fase)}${t.rev?" · Rev. "+esc(t.rev):""}</td></tr>
        ${t.rt?`<tr><td>Responsável técnico</td><td>${esc(t.rt)}${t.crea?" — "+esc(t.crea):""}</td></tr>`:""}
        <tr><td>Resultado</td><td style="font-weight:600">${e}</td></tr>
        <tr><td>Itens conferidos</td><td>${i.respondidos} de ${i.total} (${i.nc} NC, ${i.ncElim} eliminatórias)</td></tr>
      </table>
      ${t.disciplinas.map(s=>{const o=CONFERENCIA.find(r=>r.id===s);const a=o.itens.map((r,c)=>({item:r,r:(t.respostas||{})[s+"-"+c]||{}}));const n=a.filter(r=>r.r.st==="nc");return`
        <h3 style="font-size:15px;margin:16px 0 6px;border-bottom:1px solid var(--border);padding-bottom:4px">${o.disciplina}</h3>
        <p style="font-size:13px;color:var(--text-2);margin-bottom:6px">
          ${a.filter(r=>r.r.st==="c").length} conformes · ${n.length} não conformes · ${a.filter(r=>r.r.st==="na").length} N/A · ${a.filter(r=>!r.r.st).length} não conferidos
        </p>
        ${n.length?`
          <table class="data" style="font-size:12.5px;margin-bottom:8px">
            <thead><tr><th>Não conformidade</th><th>Norma</th><th>Observação</th></tr></thead>
            <tbody>${n.map(r=>`<tr>
              <td>${r.item.elim?"⚠ ELIMINATÓRIO — ":""}${esc(r.item.texto)}</td>
              <td>${esc(r.item.norma||"—")}</td>
              <td>${esc(r.r.obs||"—")}</td>
            </tr>`).join("")}</tbody>
          </table>`:""}`}).join("")}
      <div style="margin-top:40px;display:flex;justify-content:space-around;gap:20px;flex-wrap:wrap">
        <div style="text-align:center;font-size:13px;border-top:1px solid var(--text);padding-top:6px;min-width:220px">${esc(t.rt||"Responsável pela conferência")}<br>${esc(t.crea||"CREA/CAU")}</div>
        <div style="text-align:center;font-size:13px;border-top:1px solid var(--text);padding-top:6px;min-width:220px">Contratante / Fiscalização</div>
      </div>
    </div>`}
