// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.
const SHARE={_online(){return!!(window.supa&&typeof AUTH!=="undefined"&&AUTH.session&&AUTH.session())},uid(){const e=typeof AUTH!=="undefined"&&AUTH.session?AUTH.session():null;return e?e.id:null},async vincular(){if(!this._online())return;try{await window.supa.rpc("vincular_compartilhamentos")}catch(e){}},async convidar(e,i,a,r){a=(a||"").trim().toLowerCase();if(!a.includes("@"))return{erro:"E-mail inválido."};const{error:s}=await window.supa.from("compartilhamentos").insert({recurso_tipo:e,recurso_id:i,owner_id:this.uid(),convidado_email:a,permissao:r||"edicao"});if(s)return{erro:/duplicate|unique/i.test(s.message)?"Este e-mail já foi convidado.":s.message};return{ok:true}},async listar(e,i){const{data:a,error:r}=await window.supa.from("compartilhamentos").select("id,convidado_email,permissao,convidado_id").eq("recurso_tipo",e).eq("recurso_id",i).order("criado_em");return r?[]:a||[]},async revogar(e){try{await window.supa.from("compartilhamentos").delete().eq("id",e)}catch(i){}},_token(){const e=new Uint8Array(18);(window.crypto||crypto).getRandomValues(e);return Array.from(e,i=>i.toString(16).padStart(2,"0")).join("")},async gerarLink(e,i){const a=this._token();const{error:r}=await window.supa.from("compartilhamento_links").insert({token:a,recurso_tipo:e,recurso_id:i,owner_id:this.uid()});if(r)return{erro:r.message};return{ok:true,token:a,url:new URL("app.html?share="+a,location.href).href}},async listarLinks(e,i){const{data:a}=await window.supa.from("compartilhamento_links").select("token,criado_em").eq("recurso_tipo",e).eq("recurso_id",i);return a||[]},async revogarLink(e){try{await window.supa.from("compartilhamento_links").delete().eq("token",e)}catch(i){}},async abrirToken(e){try{const{data:i}=await window.supa.rpc("abrir_por_token",{p_token:e});return i}catch(i){return null}},assinar(e,i){if(!window.supa||!window.supa.channel)return null;try{return window.supa.channel("cb-"+e+"-"+Math.random().toString(36).slice(2)).on("postgres_changes",{event:"*",schema:"public",table:e},i).subscribe()}catch(a){return null}},desassinar(e){try{if(e&&window.supa)window.supa.removeChannel(e)}catch(i){}}};window.SHARE=SHARE;async function abrirCompartilhar(e,i,a){if(!SHARE._online()){(typeof toast==="function"?toast:alert)("Compartilhamento exige estar logado no backend.");return}document.querySelectorAll(".cb-modal-ov").forEach(n=>n.remove());const r=document.createElement("div");r.className="cb-modal-ov";r.onclick=n=>{if(n.target===r)r.remove()};r.innerHTML=`<div class="card cb-modal-box" role="dialog" aria-modal="true" style="max-width:520px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
      <h3 style="margin:0;font-size:16px"><i class="ti ti-share"></i> Compartilhar</h3>
      <button class="btn icon-only" aria-label="Fechar" onclick="this.closest('.cb-modal-ov').remove()"><i class="ti ti-x"></i></button>
    </div>
    <p class="page-sub" style="margin:4px 0 14px">${esc(a||"")}</p>

    <label style="font-size:12px;font-weight:600;color:var(--text-2)">Convidar por e-mail (colabora editando)</label>
    <div class="field-row" style="margin:6px 0 4px">
      <input type="email" id="sh-email" placeholder="email@colega.com" style="flex:1">
      <select id="sh-perm" class="sinapi-uf" style="min-width:104px"><option value="edicao">Edição</option><option value="leitura">Leitura</option></select>
      <button class="btn primary" id="sh-convidar"><i class="ti ti-user-plus"></i>Convidar</button>
    </div>
    <p class="auth-erro hidden" id="sh-erro" style="margin:2px 0"></p>
    <div id="sh-lista" style="margin:8px 0 16px"></div>

    <label style="font-size:12px;font-weight:600;color:var(--text-2)">Link de leitura (qualquer pessoa com o link vê)</label>
    <div class="field-row" style="margin:6px 0">
      <input type="text" id="sh-link" readonly placeholder="(nenhum link gerado)" style="flex:1">
      <button class="btn" id="sh-gerar"><i class="ti ti-link"></i>Gerar</button>
      <button class="btn icon-only" id="sh-copiar" title="Copiar" aria-label="Copiar"><i class="ti ti-copy"></i></button>
    </div>
    <div id="sh-links" style="margin-top:6px"></div>
  </div>`;document.body.appendChild(r);const s=r.querySelector("#sh-erro");const t=n=>{s.textContent=n;s.classList.remove("hidden")};async function l(){const n=await SHARE.listar(e,i);r.querySelector("#sh-lista").innerHTML=n.length?n.map(o=>`
      <div class="hist-item" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <span>${esc(o.convidado_email)} <span style="color:var(--text-3);font-size:11px">· ${o.permissao}${o.convidado_id?"":" · pendente"}</span></span>
        <button class="btn icon-only" title="Remover" aria-label="Remover" onclick="SHARE.revogar('${esc(o.id)}').then(()=>this.closest('.hist-item').remove())"><i class="ti ti-trash"></i></button>
      </div>`).join(""):`<p style="font-size:12px;color:var(--text-3);margin:4px 0">Ninguém convidado ainda.</p>`}async function d(){const n=await SHARE.listarLinks(e,i);r.querySelector("#sh-links").innerHTML=n.map(o=>`
      <div class="hist-item" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <span style="font-size:11px;color:var(--text-3);word-break:break-all">…/app.html?share=${esc(o.token.slice(0,10))}…</span>
        <button class="btn icon-only" title="Revogar" aria-label="Revogar" onclick="SHARE.revogarLink('${esc(o.token)}').then(()=>this.closest('.hist-item').remove())"><i class="ti ti-trash"></i></button>
      </div>`).join("")}r.querySelector("#sh-convidar").onclick=async n=>{s.classList.add("hidden");const o=n.currentTarget;o.disabled=true;const c=await SHARE.convidar(e,i,r.querySelector("#sh-email").value,r.querySelector("#sh-perm").value);o.disabled=false;if(c.erro)return t(c.erro);r.querySelector("#sh-email").value="";l()};r.querySelector("#sh-gerar").onclick=async n=>{const o=n.currentTarget;o.disabled=true;const c=await SHARE.gerarLink(e,i);o.disabled=false;if(c.erro)return t(c.erro);r.querySelector("#sh-link").value=c.url;d()};r.querySelector("#sh-copiar").onclick=()=>{const n=r.querySelector("#sh-link").value;if(!n)return;navigator.clipboard&&navigator.clipboard.writeText(n)};l();d()}window.abrirCompartilhar=abrirCompartilhar;async function renderSharedToken(e){const i=document.getElementById("app");if(!i)return;i.innerHTML=CBStore&&CBStore.loadingCard?CBStore.loadingCard("Abrindo…"):"<p>Abrindo…</p>";const a=await SHARE.abrirToken(e);if(!a||!a.recurso){i.innerHTML=`<div class="card" style="max-width:520px;margin:48px auto;text-align:center;padding:32px">
      <div class="card-icon" style="background:var(--purple-light);color:var(--purple);margin:0 auto 12px"><i class="ti ti-link-off"></i></div>
      <h2 style="font-size:20px">Link indisponível</h2>
      <p style="color:var(--text-2)">Este link de compartilhamento é inválido ou expirou.</p>
      <a class="btn primary" href="./" style="margin-top:12px"><i class="ti ti-home"></i>Ir ao Civilbook</a></div>`;return}const r=`<div class="result" style="background:var(--purple-light);color:var(--purple);margin-bottom:16px"><div class="r-label"><i class="ti ti-eye"></i> Visualização compartilhada — somente leitura</div></div>`;const s=t=>`<div class="card" style="max-width:520px;margin:48px auto;text-align:center;padding:32px">
        <div class="card-icon" style="background:var(--purple-light);color:var(--purple);margin:0 auto 12px"><i class="ti ti-alert-triangle"></i></div>
        <h2 style="font-size:20px">Não foi possível abrir</h2>
        <p style="color:var(--text-2)">Esta conferência ${t}</p>
        <button type="button" class="btn primary" style="margin-top:12px" onclick="location.reload()"><i class="ti ti-refresh"></i> Tentar de novo</button></div>`;if(a.tipo==="projeto"&&typeof MODULOS!=="undefined"&&MODULOS.faltam("conferencia").length){try{await MODULOS.garantir("conferencia")}catch(t){i.innerHTML=s(MODULOS.motivoTexto(t&&t.motivo||"rede"));return}}if(a.tipo==="projeto"&&(typeof CONF==="undefined"||typeof CONFERENCIA==="undefined")){i.innerHTML=s("não chegou. Verifique a conexão e tente de novo.");return}if(a.tipo==="projeto"&&typeof CONF!=="undefined"){const t=CONF._fromRow(a.recurso),l=CONF.statsProjeto(t);i.innerHTML=r+`<h2 class="page-title" style="margin-bottom:2px">${esc(t.nome)}</h2>
      <p class="page-sub">${esc(t.tipo||"")}${t.fase?" · "+esc(t.fase):""}${t.rev?" · Rev. "+esc(t.rev):""}${t.rt?" · RT: "+esc(t.rt):""}</p>
      <div class="grid grid-3" style="margin:16px 0">
        <div class="card" style="text-align:center"><div style="font-size:32px;font-weight:600;color:var(--blue)">${l.pct}%</div><p>Conferido (${l.respondidos}/${l.total})</p></div>
        <div class="card" style="text-align:center"><div style="font-size:32px;font-weight:600;color:${l.nc?"var(--coral)":"var(--teal)"}">${l.nc}</div><p>Não conformidades</p></div>
        <div class="card" style="text-align:center"><div style="font-size:32px;font-weight:600;color:${l.ncElim?"var(--red)":"var(--teal)"}">${l.ncElim}</div><p>NCs eliminatórias</p></div>
      </div>`+(t.disciplinas||[]).map(d=>{const n=CONFERENCIA.find(u=>u.id===d);if(!n)return"";const o=CONF.statsDisciplina(t,d);const c=o.ncElim?"red":o.nc?"coral":o.pct===100?"teal":"blue";const p=o.ncElim?"Eliminatório NC":o.pct===100?o.nc?o.nc+" NC":"Conforme":o.respondidos+"/"+o.total;return`<div class="card" style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center"><span>${esc(n.nome)}</span><span class="pill pill-${c}">${p}</span></div>`}).join("")}else{const t=a.recurso;i.innerHTML=r+`<h2 class="page-title" style="margin-bottom:2px">${esc(t.titulo||"Ordem de serviço")}</h2>
      <p class="page-sub">${esc(t.tipo||"")}${t.local?" · "+esc(t.local):""}${t.prazo?" · prazo "+esc(t.prazo):""}</p>
      <div class="card" style="margin-top:12px">
        <p><strong>Status:</strong> ${esc(t.status||"—")}</p>
        ${t.prioridade?`<p><strong>Prioridade:</strong> ${esc(t.prioridade)}</p>`:""}
        ${t.resp?`<p><strong>Responsável:</strong> ${esc(t.resp)}</p>`:""}
        ${t.descricao?`<p style="margin-top:8px;white-space:pre-wrap">${esc(t.descricao)}</p>`:""}
      </div>`}}window.renderSharedToken=renderSharedToken;
