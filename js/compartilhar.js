// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.
const SHARE={_online(){return!!(window.supa&&typeof AUTH!=="undefined"&&AUTH.session&&AUTH.session())},uid(){const t=typeof AUTH!=="undefined"&&AUTH.session?AUTH.session():null;return t?t.id:null},async vincular(){if(!this._online())return;try{await window.supa.rpc("vincular_compartilhamentos")}catch(t){}},async convidar(t,i,o,r){o=(o||"").trim().toLowerCase();if(!o.includes("@"))return{erro:"E-mail inválido."};const{error:l}=await window.supa.from("compartilhamentos").insert({recurso_tipo:t,recurso_id:i,owner_id:this.uid(),convidado_email:o,permissao:r||"edicao"});if(l)return{erro:/duplicate|unique/i.test(l.message)?"Este e-mail já foi convidado.":l.message};return{ok:true}},async listar(t,i){const{data:o,error:r}=await window.supa.from("compartilhamentos").select("id,convidado_email,permissao,convidado_id").eq("recurso_tipo",t).eq("recurso_id",i).order("criado_em");return r?[]:o||[]},async revogar(t){try{await window.supa.from("compartilhamentos").delete().eq("id",t)}catch(i){}},_token(){const t=new Uint8Array(18);(window.crypto||crypto).getRandomValues(t);return Array.from(t,i=>i.toString(16).padStart(2,"0")).join("")},async gerarLink(t,i){const o=this._token();const{error:r}=await window.supa.from("compartilhamento_links").insert({token:o,recurso_tipo:t,recurso_id:i,owner_id:this.uid()});if(r)return{erro:r.message};return{ok:true,token:o,url:new URL("app.html?share="+o,location.href).href}},async listarLinks(t,i){const{data:o}=await window.supa.from("compartilhamento_links").select("token,criado_em").eq("recurso_tipo",t).eq("recurso_id",i);return o||[]},async revogarLink(t){try{await window.supa.from("compartilhamento_links").delete().eq("token",t)}catch(i){}},async abrirToken(t){try{const{data:i}=await window.supa.rpc("abrir_por_token",{p_token:t});return i}catch(i){return null}},assinar(t,i){if(!window.supa||!window.supa.channel)return null;try{return window.supa.channel("cb-"+t+"-"+Math.random().toString(36).slice(2)).on("postgres_changes",{event:"*",schema:"public",table:t},i).subscribe()}catch(o){return null}},desassinar(t){try{if(t&&window.supa)window.supa.removeChannel(t)}catch(i){}}};window.SHARE=SHARE;async function abrirCompartilhar(t,i,o){if(!SHARE._online()){(typeof toast==="function"?toast:alert)("Compartilhamento exige estar logado no backend.");return}document.querySelectorAll(".cb-modal-ov").forEach(a=>a.remove());const r=document.createElement("div");r.className="cb-modal-ov";r.onclick=a=>{if(a.target===r)r.remove()};r.innerHTML=`<div class="card cb-modal-box" role="dialog" aria-modal="true" style="max-width:520px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
      <h3 style="margin:0;font-size:16px"><i class="ti ti-share"></i> Compartilhar</h3>
      <button class="btn icon-only" aria-label="Fechar" onclick="this.closest('.cb-modal-ov').remove()"><i class="ti ti-x"></i></button>
    </div>
    <p class="page-sub" style="margin:4px 0 14px">${esc(o||"")}</p>

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
  </div>`;document.body.appendChild(r);const l=r.querySelector("#sh-erro");const d=a=>{l.textContent=a;l.classList.remove("hidden")};async function e(){const a=await SHARE.listar(t,i);r.querySelector("#sh-lista").innerHTML=a.length?a.map(n=>`
      <div class="hist-item" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <span>${esc(n.convidado_email)} <span style="color:var(--text-3);font-size:11px">· ${n.permissao}${n.convidado_id?"":" · pendente"}</span></span>
        <button class="btn icon-only" title="Remover" aria-label="Remover" onclick="SHARE.revogar('${esc(n.id)}').then(()=>this.closest('.hist-item').remove())"><i class="ti ti-trash"></i></button>
      </div>`).join(""):`<p style="font-size:12px;color:var(--text-3);margin:4px 0">Ninguém convidado ainda.</p>`}async function c(){const a=await SHARE.listarLinks(t,i);r.querySelector("#sh-links").innerHTML=a.map(n=>`
      <div class="hist-item" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <span style="font-size:11px;color:var(--text-3);word-break:break-all">…/app.html?share=${esc(n.token.slice(0,10))}…</span>
        <button class="btn icon-only" title="Revogar" aria-label="Revogar" onclick="SHARE.revogarLink('${esc(n.token)}').then(()=>this.closest('.hist-item').remove())"><i class="ti ti-trash"></i></button>
      </div>`).join("")}r.querySelector("#sh-convidar").onclick=async a=>{l.classList.add("hidden");const n=a.currentTarget;n.disabled=true;const s=await SHARE.convidar(t,i,r.querySelector("#sh-email").value,r.querySelector("#sh-perm").value);n.disabled=false;if(s.erro)return d(s.erro);r.querySelector("#sh-email").value="";e()};r.querySelector("#sh-gerar").onclick=async a=>{const n=a.currentTarget;n.disabled=true;const s=await SHARE.gerarLink(t,i);n.disabled=false;if(s.erro)return d(s.erro);r.querySelector("#sh-link").value=s.url;c()};r.querySelector("#sh-copiar").onclick=()=>{const a=r.querySelector("#sh-link").value;if(!a)return;navigator.clipboard&&navigator.clipboard.writeText(a)};e();c()}window.abrirCompartilhar=abrirCompartilhar;async function renderSharedToken(t){const i=document.getElementById("app");if(!i)return;i.innerHTML=CBStore&&CBStore.loadingCard?CBStore.loadingCard("Abrindo…"):"<p>Abrindo…</p>";const o=await SHARE.abrirToken(t);const r=e=>`<div class="card" style="max-width:520px;margin:48px auto;text-align:center;padding:32px">
      <div class="card-icon" style="background:var(--purple-light);color:var(--purple);margin:0 auto 12px"><i class="ti ti-link-off"></i></div>
      <h2 style="font-size:20px">Link indisponível</h2>
      <p style="color:var(--text-2)">${e}</p>
      <a class="btn primary" href="./" style="margin-top:12px"><i class="ti ti-home"></i>Ir ao Civilbook</a></div>`;if(!o||!o.recurso){i.innerHTML=r("Este link de compartilhamento é inválido ou expirou.");return}const l=`<div class="result" style="background:var(--purple-light);color:var(--purple);margin-bottom:16px"><div class="r-label"><i class="ti ti-eye"></i> Visualização compartilhada — somente leitura</div></div>`;const d=e=>`<div class="card" style="max-width:520px;margin:48px auto;text-align:center;padding:32px">
        <div class="card-icon" style="background:var(--purple-light);color:var(--purple);margin:0 auto 12px"><i class="ti ti-alert-triangle"></i></div>
        <h2 style="font-size:20px">Não foi possível abrir</h2>
        <p style="color:var(--text-2)">Esta conferência ${e}</p>
        <button type="button" class="btn primary" style="margin-top:12px" onclick="location.reload()"><i class="ti ti-refresh"></i> Tentar de novo</button></div>`;if(o.tipo==="projeto"&&typeof MODULOS!=="undefined"&&MODULOS.faltam("conferencia").length){try{await MODULOS.garantir("conferencia")}catch(e){i.innerHTML=d(MODULOS.motivoTexto(e&&e.motivo||"rede"));return}}if(o.tipo==="projeto"&&(typeof CONF==="undefined"||typeof CONFERENCIA==="undefined")){i.innerHTML=d("não chegou. Verifique a conexão e tente de novo.");return}if(o.tipo==="projeto"&&typeof CONF!=="undefined"){const e=CONF._fromRow(o.recurso),c=CONF.statsProjeto(e);i.innerHTML=l+`<h2 class="page-title" style="margin-bottom:2px">${esc(e.nome)}</h2>
      <p class="page-sub">${esc(e.tipo||"")}${e.fase?" · "+esc(e.fase):""}${e.rev?" · Rev. "+esc(e.rev):""}${e.rt?" · RT: "+esc(e.rt):""}</p>
      <div class="grid grid-3" style="margin:16px 0">
        <div class="card" style="text-align:center"><div style="font-size:32px;font-weight:600;color:var(--blue)">${c.pct}%</div><p>Conferido (${c.respondidos}/${c.total})</p></div>
        <div class="card" style="text-align:center"><div style="font-size:32px;font-weight:600;color:${c.nc?"var(--coral)":"var(--teal)"}">${c.nc}</div><p>Não conformidades</p></div>
        <div class="card" style="text-align:center"><div style="font-size:32px;font-weight:600;color:${c.ncElim?"var(--red)":"var(--teal)"}">${c.ncElim}</div><p>NCs eliminatórias</p></div>
      </div>`+(e.disciplinas||[]).map(a=>{const n=CONFERENCIA.find(m=>m.id===a);if(!n)return"";const s=CONF.statsDisciplina(e,a);const p=s.ncElim?"red":s.nc?"coral":s.pct===100?"teal":"blue";const u=s.ncElim?"Eliminatório NC":s.pct===100?s.nc?s.nc+" NC":"Conforme":s.respondidos+"/"+s.total;return`<div class="card" style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center"><span>${esc(n.nome)}</span><span class="pill pill-${p}">${u}</span></div>`}).join("")}else if(typeof cbModuloOculto==="function"&&cbModuloOculto("manutencao")){i.innerHTML=r("Esta área não faz parte do piloto.")}else{const e=o.recurso;i.innerHTML=l+`<h2 class="page-title" style="margin-bottom:2px">${esc(e.titulo||"Ordem de serviço")}</h2>
      <p class="page-sub">${esc(e.tipo||"")}${e.local?" · "+esc(e.local):""}${e.prazo?" · prazo "+esc(e.prazo):""}</p>
      <div class="card" style="margin-top:12px">
        <p><strong>Status:</strong> ${esc(e.status||"—")}</p>
        ${e.prioridade?`<p><strong>Prioridade:</strong> ${esc(e.prioridade)}</p>`:""}
        ${e.resp?`<p><strong>Responsável:</strong> ${esc(e.resp)}</p>`:""}
        ${e.descricao?`<p style="margin-top:8px;white-space:pre-wrap">${esc(e.descricao)}</p>`:""}
      </div>`}}window.renderSharedToken=renderSharedToken;
