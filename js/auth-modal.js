// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Ver LICENSE.
window.cbAuthModalHTML=`
    <button class="auth-close" onclick="fecharAuth()" aria-label="Fechar"><i class="ti ti-x"></i></button>
    <div class="logo" style="justify-content:center;margin-bottom:18px">
      <img class="logo-icon" src="icon.svg?v=465ecd6" alt="Civilbook"><span>Civilbook</span>
    </div>
    <div class="auth-tabs" id="auth-abas">
      <button id="tab-login" class="active" onclick="trocarAba('login')">Entrar</button>
      <button id="tab-cadastro" onclick="trocarAba('cadastro')">Criar conta</button>
    </div>

    <p class="auth-erro hidden" id="auth-fora" role="alert"></p>

    <div id="auth-social" class="auth-social">
      <button type="button" class="btn auth-google" onclick="entrarComGoogle(this)" aria-label="Entrar com Google">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.61z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.96 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"/></svg>
        <span>Entrar com Google</span>
      </button>
      <p class="auth-erro hidden" id="g-erro"></p>
      <div class="auth-or"><span>ou</span></div>
    </div>

    <form id="form-login" onsubmit="return fazerLogin(event)">
      <div class="field"><label>E-mail</label><input type="email" id="l-email" required></div>
      <div class="field"><label>Senha</label><span class="senha-campo"><input type="password" spellcheck="false" autocapitalize="off" autocorrect="off" id="l-senha" required><button type="button" class="senha-olho" aria-controls="l-senha" aria-label="Mostrar a senha" aria-pressed="false" onmousedown="event.preventDefault()" onclick="AUTH.olhoSenha(this)"><i class="ti ti-eye" aria-hidden="true"></i></button></span></div>
      <p class="auth-erro hidden" id="l-erro"></p>
      <div class="cb-captcha hidden" id="l-captcha" style="margin:0 0 12px"></div>
      <button class="btn primary" style="width:100%" type="submit">Entrar</button>
      <button type="button" class="auth-link" id="l-esqueci" onclick="cbRecuperar.abrir()">Esqueci a senha</button>
    </form>

    <form id="form-recuperar" class="hidden" novalidate onsubmit="return cbRecuperar.enviar(event)">
      <h2 class="auth-titulo" id="r-titulo">Esqueci a senha</h2>
      <p class="auth-texto">Informe o e-mail da sua conta. Enviaremos um link para você criar uma senha nova.</p>
      <div class="field"><label for="r-email">E-mail</label><input type="email" id="r-email" autocomplete="email" required></div>
      <p class="auth-erro hidden" id="r-erro" role="alert"></p>
      <p class="auth-ok hidden" id="r-ok" role="status" tabindex="-1"></p>
      <div class="cb-captcha hidden" id="r-captcha" style="margin:0 0 12px"></div>
      <button class="btn primary" style="width:100%" type="submit" id="r-enviar">Enviar link</button>
      <button type="button" class="btn auth-voltar" id="r-voltar" onclick="cbRecuperar.voltar()">Voltar para entrar</button>
    </form>

    <form id="form-cadastro" class="hidden" onsubmit="return fazerCadastro(event)">
      <div class="field"><label>Nome completo</label><input type="text" id="c-nome" required></div>
      <div class="field"><label>E-mail</label><input type="email" id="c-email" required></div>
      <div class="field"><label>Senha (mínimo 8 caracteres)</label><small class="hint" id="c-senha-regra">Com pelo menos uma letra minúscula, uma letra maiúscula, um número e um símbolo. Espaço, ç, letras com acento, emojis e sinais como º, °, § e € não são aceitos.</small><span class="senha-campo"><input aria-describedby="c-senha-regra" type="password" spellcheck="false" autocapitalize="off" autocorrect="off" id="c-senha" minlength="8" required><button type="button" class="senha-olho" aria-controls="c-senha" aria-label="Mostrar a senha" aria-pressed="false" onmousedown="event.preventDefault()" onclick="AUTH.olhoSenha(this)"><i class="ti ti-eye" aria-hidden="true"></i></button></span></div>
      <label style="display:flex;gap:8px;align-items:flex-start;font-size:12.5px;color:var(--text-2);margin:4px 0 10px;cursor:pointer">
        <input type="checkbox" id="c-consent" required style="width:15px;height:15px;margin-top:2px;flex-shrink:0;accent-color:var(--blue)">
        <span>Li e concordo com a <a href="privacidade" target="_blank" style="color:var(--blue)">Política de Privacidade</a> e autorizo o tratamento dos meus dados conforme a LGPD.</span>
      </label>
      <p class="auth-erro hidden" id="c-erro"></p>
      <div class="cb-captcha hidden" id="c-captcha" style="margin:0 0 12px"></div>
      <button class="btn primary" style="width:100%" type="submit">Criar conta</button>
    </form>
`;window.cbAuthAvisoFora=function(){var l=document.getElementById("auth-fora");if(!l)return false;var o=typeof AUTH!=="undefined"?AUTH:null;var s=!!(o&&o._ready===true&&typeof o._supaIndisponivel==="function"&&o._supaIndisponivel());l.textContent=s?"O login não carregou. Recarregue a página.":"";l.classList.toggle("hidden",!s);if(s){var c=document.getElementById("auth-social");if(c)c.style.display="none"}return s};(function(){"use strict";var l=60;var o="cb-recuperar-ate";var s=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;var c={enviado:"Se houver uma conta com este e-mail, enviamos um link para criar uma senha nova. Confira a caixa de entrada e o spam; o link vale uma vez e por tempo limitado.",limite:"Muitas tentativas. Aguarde alguns minutos e tente de novo.",rede:"Não conseguimos falar com o servidor. Confira a sua conexão e tente de novo.",formato:"Digite um e-mail válido, como nome@empresa.com.br.",captcha:"A verificação de segurança não passou. Recarregue a página e tente de novo.",falha:"Não foi possível enviar agora. Tente de novo em instantes.",sem_backend:"A troca de senha por e-mail precisa do servidor do Civilbook, que não está ligado neste modo de teste. Nenhum e-mail foi enviado.",indisponivel:"Serviço indisponível no momento. Verifique sua conexão e recarregue a página."};var C=["limite","rede","formato","captcha","falha","sem_backend","indisponivel"];var S="Enviar link",T="Reenviar link",R="Enviando…";var h=false;var y=false;var p=0;var b=null;function r(a){return document.getElementById(a)}function n(a,e){var t=r(a);if(t)t.classList.toggle("hidden",!!e)}function v(a){var e=r(a);if(e&&e.focus){try{e.focus()}catch(t){}}}function k(){var a=Date.now(),e=a+l*1e3,t=0;try{t=Number(localStorage.getItem(o))||0}catch(i){}if(p>e)p=e;if(t>e){t=e;try{localStorage.setItem(o,String(e))}catch(i){}}return Math.max(0,Math.ceil((Math.max(p,t)-a)/1e3))}function A(){p=Date.now()+l*1e3;try{localStorage.setItem(o,String(p))}catch(a){}u()}function u(){if(b){clearTimeout(b);b=null}var a=r("r-enviar");if(!a)return;if(h){a.disabled=true;a.textContent=R;return}var e=k();if(e>0){a.disabled=true;a.textContent="Reenviar em "+e+" s";b=setTimeout(u,1e3);return}a.disabled=false;a.textContent=y?T:S}function d(a,e){var t=r("r-ok"),i=r("r-erro");if(t){t.textContent=a==="ok"?e:"";t.classList.toggle("hidden",a!=="ok")}if(i){i.textContent=a==="erro"?e:"";i.classList.toggle("hidden",a!=="erro")}}function L(){var a=r("form-recuperar");if(!a)return;n("auth-abas",true);n("auth-social",true);n("form-login",true);n("form-cadastro",true);a.classList.remove("hidden");var e=r("l-email"),t=r("r-email");var i=e?String(e.value||"").trim():"";if(t&&i)t.value=i;d("","");if(k()>0)y=true;u();var m=x();if(m)m.montar("recuperar",r("r-captcha"));v("r-email")}function x(){var a=typeof window!=="undefined"?window.CBCAPTCHA:null;return a&&typeof a.conferir==="function"?a:null}function E(){if(typeof AUTH!=="undefined"&&AUTH&&typeof AUTH.esconderSenhas==="function")AUTH.esconderSenhas(r("auth-modal"));var a=r("form-recuperar");if(!a||a.classList.contains("hidden"))return false;a.classList.add("hidden");n("auth-abas",false);n("auth-social",false);return true}function w(){var a=r("r-email"),e=r("l-email");var t=a?String(a.value||"").trim():"";if(e&&!String(e.value||"").trim()&&t)e.value=t;if(typeof window.trocarAba==="function")window.trocarAba("login");else{E();n("form-cadastro",true);n("form-login",false)}v(e&&String(e.value||"").trim()?"l-senha":"l-email")}async function H(a){if(a&&a.preventDefault)a.preventDefault();if(h)return false;if(k()>0){u();return false}var e=r("r-email");var t=e?String(e.value||"").trim():"";if(!s.test(t)){d("erro",c.formato);v("r-email");return false}var i=x(),m=i?i.conferir("recuperar"):{token:"",erro:""};if(m.erro){d("erro",m.erro);return false}h=true;d("","");u();var f;try{f=await AUTH.resetSenha(t,m.token)}catch(O){f={ok:false,motivo:"falha"}}if(i)i.resetar("recuperar");h=false;var g=f&&f.ok===true?"":String(f&&f.motivo||"");if(C.indexOf(g)<0){y=true;d("ok",c.enviado);A();v("r-ok");return false}d("erro",c[g]);if(g==="limite")A();else u();if(g==="formato")v("r-email");return false}document.addEventListener("keydown",function(a){if(a.key!=="Escape")return;var e=r("form-recuperar"),t=r("auth-overlay");if(!e||e.classList.contains("hidden")||t&&t.classList.contains("hidden"))return;a.preventDefault();w()});window.cbRecuperar={abrir:L,voltar:w,esconder:E,enviar:H}})();
