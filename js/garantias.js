// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.
const GAR={KEY_CFG:"cb-garantia-cfg",KEY_FORN:"cb-fornecedores",_cfg:null,_forn:null,_loaded:false,async load(){const e=CBStore.lsGet(this.KEY_CFG,{obra:"",data_entrega:"",data_habitese:"",custom:[]});const t=CBStore.lsGet(this.KEY_FORN,[]);if(CBStore.online()){try{const[{data:a},{data:n,error:r}]=await Promise.all([window.supa.from("garantia_config").select("*").eq("user_id",CBStore.uid()).maybeSingle(),window.supa.from("fornecedores").select("*").order("criado_em",{ascending:false})]);if(r)throw r;this._cfg=a?{obra:a.obra||"",data_entrega:a.data_entrega||"",data_habitese:a.data_habitese||"",custom:a.custom||[]}:{...e};this._forn=(n||[]).map(this._fornFromRow);if(!a&&(e.data_entrega||(e.custom||[]).length))await this.salvarCfg({});if(!this._forn.length&&t.length){for(const o of t)await this._inserir(o)}CBStore.lsSet(this.KEY_CFG,this._cfg);CBStore.lsSet(this.KEY_FORN,this._forn);this._loaded=true;return}catch(a){console.warn("GAR.load:",a&&a.message)}}this._cfg=e;this._forn=t;this._loaded=true},async ready(){if(!this._loaded)await this.load();return this._loaded},_fornFromRow(e){return{id:e.id,servico:e.servico,cnpj:e.cnpj||"",empresa:e.empresa||"",contato:e.contato||"",telefone:e.telefone||"",garantia_sistema:e.garantia_sistema||"",obs:e.obs||""}},cfg(){return this._cfg||{obra:"",data_entrega:"",data_habitese:"",custom:[]}},fornecedores(){return this._forn||[]},inicioGarantias(){const e=this.cfg();return e.data_entrega||e.data_habitese||""},async salvarCfg(e){this._cfg={...this.cfg(),...e};CBStore.lsSet(this.KEY_CFG,this._cfg);if(CBStore.online()){const t={user_id:CBStore.uid(),obra:this._cfg.obra||null,data_entrega:this._cfg.data_entrega||null,data_habitese:this._cfg.data_habitese||null,custom:this._cfg.custom||[],updated_at:new Date().toISOString()};const{error:a}=await window.supa.from("garantia_config").upsert(t,{onConflict:"user_id"});if(a)console.warn("GAR.salvarCfg:",a.message)}},listarGarantias(){const e=(this.cfg().custom||[]).map(t=>({...t,tipo:t.tipo||"oferecida",categoria:t.categoria||"Personalizado",_custom:true}));return GARANTIAS.concat(e)},async addGarantia(e){const t=(this.cfg().custom||[]).slice();t.push({id:"gc-"+Date.now(),sistema:e.sistema,categoria:e.categoria||"Personalizado",descricao:e.descricao||"",falhas:e.falhas||"",prazo:Number(e.prazo)||1,tipo:"oferecida"});await this.salvarCfg({custom:t})},async removeGarantia(e){await this.salvarCfg({custom:(this.cfg().custom||[]).filter(t=>t.id!==e)})},async _inserir(e){const t=e.id&&/^[0-9a-f-]{36}$/.test(e.id)?e.id:CBStore.uuid();const a={id:t,servico:e.servico,cnpj:e.cnpj||"",empresa:e.empresa||"",contato:e.contato||"",telefone:e.telefone||"",garantia_sistema:e.garantia_sistema||"",obs:e.obs||""};this._forn=[a].concat(this.fornecedores());CBStore.lsSet(this.KEY_FORN,this._forn);if(CBStore.online()){const{error:n}=await window.supa.from("fornecedores").insert({id:t,user_id:CBStore.uid(),servico:a.servico,cnpj:a.cnpj||null,empresa:a.empresa||null,contato:a.contato||null,telefone:a.telefone||null,garantia_sistema:a.garantia_sistema||null,obs:a.obs||null});if(n)console.warn("GAR.inserirForn:",n.message)}return a},async addFornecedor(e){if(!e.servico||!e.servico.trim())return{erro:"Informe o serviço realizado."};await this._inserir(e);return{ok:true}},async removeFornecedor(e){this._forn=this.fornecedores().filter(t=>t.id!==e);CBStore.lsSet(this.KEY_FORN,this._forn);if(CBStore.online()){const{error:t}=await window.supa.from("fornecedores").delete().eq("id",e);if(t)console.warn("GAR.removeForn:",t.message)}},vigencia(e){const t=this.inicioGarantias();if(!t)return{status:"sem-data"};const a=new Date(t+"T12:00");if(isNaN(a.getTime()))return{status:"sem-data"};const n=new Date(a);n.setFullYear(n.getFullYear()+e);const r=new Date;r.setHours(0,0,0,0);const o=Math.ceil((n-r)/864e5);if(o<0)return{status:"vencida",dias:-o,vence:n};if(o<=90)return{status:"vencendo",dias:o,vence:n};return{status:"vigente",dias:o,vence:n}},stats(){const e=this.listarGarantias();const t={total:e.length,vigentes:0,vencendo:0,vencidas:0};if(!this.inicioGarantias())return t;e.forEach(a=>{const n=this.vigencia(a.prazo);if(n.status==="vigente")t.vigentes++;else if(n.status==="vencendo"){t.vigentes++;t.vencendo++}else if(n.status==="vencida")t.vencidas++});return t}};window.GAR=GAR;function fmtCNPJ(e){e=(e||"").replace(/\D/g,"").slice(0,14);return e.replace(/^(\d{2})(\d)/,"$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3").replace(/\.(\d{3})(\d)/,".$1/$2").replace(/(\d{4})(\d)/,"$1-$2")}function fmtTel(e){e=(e||"").replace(/\D/g,"").slice(0,11);if(e.length<=10)return e.replace(/^(\d{2})(\d)/,"($1) $2").replace(/(\d{4})(\d)/,"$1-$2");return e.replace(/^(\d{2})(\d)/,"($1) $2").replace(/(\d{5})(\d)/,"$1-$2")}const GAR_FILTRO={busca:"",categoria:"todos",status:"todos"};function renderGarantias(){const e=GAR.cfg(),t=GAR.inicioGarantias(),a=GAR.stats();const n={vigente:"teal",vencendo:"amber",vencida:"red","sem-data":"blue"};const r={vigente:"Vigente",vencendo:"Vencendo",vencida:"Vencida","sem-data":"Defina a data"};let o=GAR.listarGarantias();const d=i=>normalizar(i);if(GAR_FILTRO.categoria!=="todos")o=o.filter(i=>i.categoria===GAR_FILTRO.categoria);if(GAR_FILTRO.status!=="todos"&&t)o=o.filter(i=>GAR.vigencia(i.prazo).status===GAR_FILTRO.status||GAR_FILTRO.status==="vigente"&&GAR.vigencia(i.prazo).status==="vencendo");if(GAR_FILTRO.busca){const i=d(GAR_FILTRO.busca);o=o.filter(s=>d(s.sistema+" "+s.descricao+" "+s.falhas+" "+s.categoria).includes(i))}document.getElementById("mnt-body").innerHTML=`
    <div class="card" data-cb-view="gar" style="margin-bottom:14px">
      <h3 style="margin-bottom:4px"><i class="ti ti-calendar-event"></i> Datas do projeto</h3>
      <p class="page-sub" style="margin-bottom:12px">A entrega/recebimento da obra inicia a contagem das garantias.</p>
      <div class="field-row">
        <div class="field"><label>Obra / empreendimento</label><input type="text" id="gar-obra" value="${esc(e.obra||"")}" placeholder="ex.: Residencial Aurora"></div>
        <div class="field"><label>Data de entrega / recebimento</label><input type="date" id="gar-entrega" value="${esc(e.data_entrega||"")}"></div>
        <div class="field"><label>Habite-se (opcional)</label><input type="date" id="gar-habitese" value="${esc(e.data_habitese||"")}"></div>
      </div>
      <button class="btn primary" onclick="salvarDatasGar()"><i class="ti ti-device-floppy"></i>Salvar datas</button>
      ${t?`<span style="font-size:12.5px;color:var(--text-2);margin-left:10px">Início das garantias: <strong>${new Date(t+"T12:00").toLocaleDateString("pt-BR")}</strong></span>`:""}
    </div>

    <!-- e9: garantias reais vinculadas a ativo/unidade (preenchido por conformidade.js) -->
    <div id="gar-registro-host"></div>

    ${t?`<div class="grid grid-3" style="margin-bottom:14px">
      <div class="card" style="text-align:center"><div style="font-size:30px;font-weight:600;color:var(--teal)">${a.vigentes}</div><p>Vigentes${a.vencendo?` <span class="pill pill-amber">${a.vencendo} vencendo</span>`:""}</p></div>
      <div class="card" style="text-align:center"><div style="font-size:30px;font-weight:600;color:${a.vencidas?"var(--red)":"var(--teal)"}">${a.vencidas}</div><p>Vencidas</p></div>
      <div class="card" style="text-align:center"><div style="font-size:30px;font-weight:600;color:var(--blue)">${a.total}</div><p>Sistemas monitorados</p></div>
    </div>`:`<div class="card" style="background:var(--blue-light);border:none;margin-bottom:14px"><p style="font-size:13.5px;color:var(--blue)"><i class="ti ti-info-circle"></i> Informe a data de entrega acima para calcular quais garantias ainda estão vigentes hoje.</p></div>`}

    <div class="filter-bar">
      <input type="text" id="gar-busca" placeholder="Buscar sistema, patologia…" aria-label="Buscar garantia por sistema ou patologia" value="${esc(GAR_FILTRO.busca)}">
      <select id="gar-cat" class="sinapi-uf" data-cbselect><option value="todos">Categorias</option>${GARANTIAS_CATEGORIAS.concat(["Personalizado"]).map(i=>`<option value="${i}"${GAR_FILTRO.categoria===i?" selected":""}>${i}</option>`).join("")}</select>
      <select id="gar-st" class="sinapi-uf" data-cbselect ${t?"":"disabled"}><option value="todos">Status</option><option value="vigente"${GAR_FILTRO.status==="vigente"?" selected":""}>Vigentes</option><option value="vencida"${GAR_FILTRO.status==="vencida"?" selected":""}>Vencidas</option></select>
      <button class="btn" onclick="novaGarantia()"><i class="ti ti-plus"></i>Garantia</button>
    </div>
    <p class="page-sub" style="margin:0 0 10px">${o.length} de ${GAR.listarGarantias().length} · <span style="color:var(--text-3)">${esc(GARANTIAS_REF)}</span></p>

    ${o.map(i=>{const s=GAR.vigencia(i.prazo);return`<div class="card" style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start">
          <div style="flex:1;min-width:240px">
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:4px">
              <span class="pill" style="background:var(--bg-2,#eef);color:var(--text-2)">${esc(i.categoria)}</span>
              ${i.tipo==="legal"?`<span class="pill pill-red">Legal · 5 anos</span>`:`<span class="pill pill-blue">Oferecida</span>`}
              ${i._custom?`<span class="pill" style="background:var(--purple-light);color:var(--purple)">Personalizada</span>`:""}
            </div>
            <h3 style="margin:2px 0">${esc(i.sistema)}</h3>
            <p style="font-size:13px;color:var(--text-2)">${esc(i.descricao)}</p>
            <p style="font-size:12.5px;color:var(--text-3);margin-top:4px"><strong>Cobre:</strong> ${esc(i.falhas)}</p>
          </div>
          <div style="text-align:right;min-width:120px">
            <div style="font-size:22px;font-weight:600">${i.prazo} ${i.prazo===1?"ano":"anos"}</div>
            ${s.status==="sem-data"?"":s.status==="vencida"?`<span class="pill pill-red">Vencida há ${s.dias}d</span>`:s.status==="vencendo"?`<span class="pill pill-amber">Vence em ${s.dias}d</span>`:`<span class="pill pill-teal">Vigente · ${Math.floor(s.dias/30)} meses</span>`}
            ${s.vence?`<div style="font-size:11px;color:var(--text-3);margin-top:3px">até ${s.vence.toLocaleDateString("pt-BR")}</div>`:""}
            ${i._custom?`<button class="btn icon-only" title="Remover" style="margin-top:4px" onclick="GAR.removeGarantia('${esc(i.id)}').then(()=>renderGarantias())"><i class="ti ti-trash"></i></button>`:""}
          </div>
        </div>
      </div>`}).join("")}`;const c=(i,s,l)=>{const p=document.getElementById(i);if(p)p.addEventListener(s,l)};c("gar-busca","input",i=>{GAR_FILTRO.busca=i.target.value;const s=i.target.selectionStart;renderGarantias();const l=document.getElementById("gar-busca");if(l){l.focus();l.setSelectionRange(s,s)}});c("gar-cat","change",i=>{GAR_FILTRO.categoria=i.target.value;renderGarantias()});c("gar-st","change",i=>{GAR_FILTRO.status=i.target.value;renderGarantias()});if(typeof renderGarantiasRegistro==="function")renderGarantiasRegistro()}function salvarDatasGar(){GAR.salvarCfg({obra:document.getElementById("gar-obra").value.trim(),data_entrega:document.getElementById("gar-entrega").value,data_habitese:document.getElementById("gar-habitese").value}).then(()=>{if(typeof toast==="function")toast("Datas salvas.","success");renderGarantias()})}function novaGarantia(){const e=prompt("Sistema/equipamento da garantia personalizada:");if(!e||!e.trim())return;const t=parseInt(prompt("Prazo de garantia (em anos):","1"),10)||1;const a=prompt("Descrição (opcional):")||"";GAR.addGarantia({sistema:e.trim(),prazo:t,descricao:a,falhas:"Definido pelo usuário."}).then(()=>renderGarantias())}function renderFornecedores(){const e=GAR.fornecedores();const t=GAR.listarGarantias().map(a=>a.sistema);document.getElementById("mnt-body").innerHTML=`
    <div class="card" data-cb-view="forn" style="margin-bottom:14px">
      <h3 style="margin-bottom:12px"><i class="ti ti-plus"></i> Novo fornecedor</h3>
      <div class="field-row">
        <div class="field"><label>Serviço realizado *</label><input type="text" id="f-servico" placeholder="ex.: Impermeabilização da laje"></div>
        <div class="field"><label>Nome da empresa</label><input type="text" id="f-empresa" placeholder="ex.: Impermebem Ltda"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>CNPJ</label><input type="text" id="f-cnpj" inputmode="numeric" placeholder="00.000.000/0000-00" oninput="this.value=fmtCNPJ(this.value)"></div>
        <div class="field"><label>Contato / responsável</label><input type="text" id="f-contato" placeholder="ex.: Eng. Marcos"></div>
        <div class="field"><label>Telefone</label><input type="text" id="f-tel" inputmode="numeric" placeholder="(00) 00000-0000" oninput="this.value=fmtTel(this.value)"></div>
      </div>
      <div class="field"><label>Garantia vinculada (opcional)</label>
        <select id="f-garantia"><option value="">— nenhuma —</option>${[...new Set(t)].map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join("")}</select>
      </div>
      <button class="btn primary" onclick="addFornecedorUI()"><i class="ti ti-plus"></i>Adicionar fornecedor</button>
      <p class="auth-erro hidden" id="f-erro" style="margin-top:8px"></p>
    </div>

    ${e.length===0?`<p class="page-sub" style="text-align:center;padding:20px">Nenhum fornecedor cadastrado. Registre quem executou cada serviço para acionar a garantia quando precisar.</p>`:e.map(a=>`
      <div class="card" style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start">
          <div style="flex:1;min-width:240px">
            <h3 style="margin:0 0 2px">${esc(a.servico)}</h3>
            <p style="font-size:13px;color:var(--text-2)">${esc(a.empresa||"—")}${a.cnpj?" · CNPJ "+esc(a.cnpj):""}</p>
            <p style="font-size:13px;color:var(--text-2)">${a.contato?"<i class='ti ti-user'></i> "+esc(a.contato):""}${a.telefone?" · <i class='ti ti-phone'></i> "+esc(a.telefone):""}</p>
            ${a.garantia_sistema?`<span class="pill pill-teal" style="margin-top:4px"><i class="ti ti-shield-check"></i> ${esc(a.garantia_sistema)}</span>`:""}
          </div>
          <div style="display:flex;gap:6px">
            ${a.telefone?`<a class="btn icon-only" title="Ligar" href="tel:${esc((a.telefone||"").replace(/\D/g,""))}"><i class="ti ti-phone"></i></a>`:""}
            <button class="btn icon-only" title="Remover" onclick="GAR.removeFornecedor('${esc(a.id)}').then(()=>renderFornecedores())"><i class="ti ti-trash"></i></button>
          </div>
        </div>
      </div>`).join("")}`}function addFornecedorUI(){const e={servico:document.getElementById("f-servico").value.trim(),empresa:document.getElementById("f-empresa").value.trim(),cnpj:document.getElementById("f-cnpj").value.trim(),contato:document.getElementById("f-contato").value.trim(),telefone:document.getElementById("f-tel").value.trim(),garantia_sistema:document.getElementById("f-garantia").value};GAR.addFornecedor(e).then(t=>{if(t.erro){const a=document.getElementById("f-erro");a.textContent=t.erro;a.classList.remove("hidden");return}if(typeof toast==="function")toast("Fornecedor adicionado.","success");renderFornecedores()})}
