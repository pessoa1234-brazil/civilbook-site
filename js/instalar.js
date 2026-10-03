// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
const INSTALAR={_prompt:null,_K:"cb-instalar-off",standalone(){try{return matchMedia("(display-mode: standalone)").matches||matchMedia("(display-mode: fullscreen)").matches||window.navigator.standalone===true}catch(e){return false}},ehIOS(){const e=navigator.userAgent||"";return/iPad|iPhone|iPod/.test(e)||/Macintosh/.test(e)&&typeof document.ontouchend!=="undefined"},ehSafariIOS(){return this.ehIOS()&&!/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent||"")},_dispensado(){try{return localStorage.getItem(this._K)==="1"}catch(e){return false}},dispensar(){try{localStorage.setItem(this._K,"1")}catch(t){}const e=document.getElementById("instalar-home");if(e)e.innerHTML=""},iniciar(){if(this._ligado)return;this._ligado=true;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();this._prompt=e;this.render()});window.addEventListener("appinstalled",()=>{this._prompt=null;const e=document.getElementById("instalar-home");if(e)e.innerHTML="";if(typeof toast==="function")toast("Civilbook instalado! Abra pelo ícone na tela inicial.","success")})},disponivel(){if(this.standalone()||this._dispensado())return false;return!!this._prompt||this.ehSafariIOS()},render(){const e=document.getElementById("instalar-home");if(!e)return;if(!this.disponivel()){e.innerHTML="";return}const t=!this._prompt&&this.ehSafariIOS();e.innerHTML=`
      <div class="card" style="margin-bottom:14px;border-left:3px solid var(--blue);display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <i class="ti ti-device-mobile" aria-hidden="true" style="font-size:22px;color:var(--blue)"></i>
        <div style="flex:1;min-width:200px">
          <div style="font-weight:600">Instale o Civilbook no seu celular</div>
          <div class="page-sub" style="margin:0;font-size:13px">Abre em tela cheia, com ícone próprio — e as calculadoras, normas e SINAPI continuam funcionando <strong>sem internet</strong> no canteiro.</div>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0">
          <button class="btn primary" onclick="INSTALAR.${t?"comoNoIphone()":"instalar()"}"><i class="ti ti-download" aria-hidden="true"></i> ${t?"Como instalar":"Instalar"}</button>
          <button class="btn" onclick="INSTALAR.dispensar()" title="Não mostrar de novo">Agora não</button>
        </div>
      </div>`},async instalar(){if(!this._prompt){this.comoNoIphone();return}const e=this._prompt;this._prompt=null;try{e.prompt();const t=await e.userChoice;if(t&&t.outcome==="dismissed"&&typeof toast==="function"){toast("Sem problema — o convite fica na tela inicial do app quando quiser.","info")}}catch(t){}this.render()},comoNoIphone(){document.querySelectorAll(".cb-modal-ov").forEach(i=>i.remove());const e=document.createElement("div");e.className="cb-modal-ov";e.onclick=i=>{if(i.target===e)e.remove()};const t=(i,o)=>`<li style="margin-bottom:8px">${o}</li>`;e.innerHTML=`<div class="card cb-modal-box" role="dialog" aria-modal="true" style="max-width:460px">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
        <h3 style="margin:0"><i class="ti ti-device-mobile" aria-hidden="true"></i> Instalar no iPhone</h3>
        <button class="btn icon-only" aria-label="Fechar" onclick="this.closest('.cb-modal-ov').remove()"><i class="ti ti-x"></i></button>
      </div>
      <ol style="margin:14px 0 0;padding-left:20px;font-size:14px;line-height:1.6">
        ${t(1,'Toque em <strong>Compartilhar</strong> <i class="ti ti-share" aria-hidden="true"></i> na barra do Safari (embaixo).')}
        ${t(2,"Role a lista e escolha <strong>Adicionar à Tela de Início</strong>.")}
        ${t(3,"Confirme em <strong>Adicionar</strong>. O ícone do Civilbook aparece junto dos seus apps.")}
      </ol>
      <p class="page-sub" style="font-size:12.5px;margin:14px 0 0"><i class="ti ti-info-circle" aria-hidden="true"></i> No iPhone isso só funciona pelo <strong>Safari</strong> — Chrome e outros navegadores não oferecem a opção.</p>
    </div>`;document.body.appendChild(e)}};if(typeof window!=="undefined")window.INSTALAR=INSTALAR;
