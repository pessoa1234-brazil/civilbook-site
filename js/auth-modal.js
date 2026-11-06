// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Ver LICENSE.
window.cbAuthModalHTML=`
    <button class="auth-close" onclick="fecharAuth()" aria-label="Fechar"><i class="ti ti-x"></i></button>
    <div class="logo" style="justify-content:center;margin-bottom:18px">
      <img class="logo-icon" src="icon.svg?v=0126c70" alt="Civilbook"><span>Civilbook</span>
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
      <button class="btn primary" style="width:100%" type="submit">Entrar</button>
      <button type="button" class="auth-link" id="l-esqueci" onclick="cbRecuperar.abrir()">Esqueci a senha</button>
    </form>

    <form id="form-recuperar" class="hidden" novalidate onsubmit="return cbRecuperar.enviar(event)">
      <h2 class="auth-titulo" id="r-titulo">Esqueci a senha</h2>
      <p class="auth-texto">Informe o e-mail da sua conta. Enviaremos um link para você criar uma senha nova.</p>
      <div class="field"><label for="r-email">E-mail</label><input type="email" id="r-email" autocomplete="email" required></div>
      <p class="auth-erro hidden" id="r-erro" role="alert"></p>
      <p class="auth-ok hidden" id="r-ok" role="status" tabindex="-1"></p>
      <button class="btn primary" style="width:100%" type="submit" id="r-enviar">Enviar link</button>
      <button type="button" class="btn auth-voltar" id="r-voltar" onclick="cbRecuperar.voltar()">Voltar para entrar</button>
    </form>

    <form id="form-cadastro" class="hidden" onsubmit="return fazerCadastro(event)">
      <div class="field"><label>Nome completo</label><input type="text" id="c-nome" required></div>
      <div class="field"><label>E-mail</label><input type="email" id="c-email" required></div>
      <div class="field"><label>Senha (mínimo 8 caracteres)</label><small class="hint" id="c-senha-regra">Com pelo menos uma letra minúscula, uma letra maiúscula, um número e um símbolo. Espaço, ç, letras com acento, emojis e sinais como º, °, § e € não são aceitos.</small><span class="senha-campo"><input aria-describedby="c-senha-regra" type="password" spellcheck="false" autocapitalize="off" autocorrect="off" id="c-senha" minlength="8" required><button type="button" class="senha-olho" aria-controls="c-senha" aria-label="Mostrar a senha" aria-pressed="false" onmousedown="event.preventDefault()" onclick="AUTH.olhoSenha(this)"><i class="ti ti-eye" aria-hidden="true"></i></button></span></div>
      <div class="field-row">
        <div class="field">
          <label>Conselho <span style="color:var(--text-3);font-weight:400;font-size:12px">(opcional)</span></label>
          <select id="c-conselho">
            <option value="">Não informar</option>
            <option value="CREA">CREA (Engenharia)</option>
            <option value="CAU">CAU (Arquitetura)</option>
            <option value="CFT">CFT (Téc. Edificações)</option>
            <option value="Outro">Outro</option>
            <option value="Estudante">Estudante</option>
          </select>
        </div>
        <div class="field"><label>Nº de registro <span style="color:var(--text-3);font-weight:400;font-size:12px">(opcional)</span></label><input type="text" id="c-registro" placeholder="ex.: 123456-7"></div>
      </div>
      <label style="display:flex;gap:8px;align-items:flex-start;font-size:12.5px;color:var(--text-2);margin:4px 0 10px;cursor:pointer">
        <input type="checkbox" id="c-consent" required style="width:15px;height:15px;margin-top:2px;flex-shrink:0;accent-color:var(--blue)">
        <span>Li e concordo com a <a href="privacidade" target="_blank" style="color:var(--blue)">Política de Privacidade</a> e autorizo o tratamento dos meus dados conforme a LGPD.</span>
      </label>
      <p class="auth-erro hidden" id="c-erro"></p>
      <button class="btn primary" style="width:100%" type="submit">Criar conta grátis</button>
      <p style="font-size:12px;color:var(--text-3);margin-top:10px;text-align:center">Conta gratuita — faça upgrade para PRO quando quiser.</p>
    </form>
`;window.cbAuthAvisoFora=function(){var l=document.getElementById("auth-fora");if(!l)return false;var r=typeof AUTH!=="undefined"?AUTH:null;var s=!!(r&&r._ready===true&&typeof r._supaIndisponivel==="function"&&r._supaIndisponivel());l.textContent=s?"O login não carregou nesta página — costuma ser conexão instável, bloqueador de anúncios ou extensão do navegador. Recarregue a página para entrar.":"";l.classList.toggle("hidden",!s);if(s){var c=document.getElementById("auth-social");if(c)c.style.display="none"}return s};(function(){"use strict";var l=60;var r="cb-recuperar-ate";var s=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;var c={enviado:"Se houver uma conta com este e-mail, enviamos um link para criar uma senha nova. Confira a caixa de entrada e o spam; o link vale uma vez e por tempo limitado.",limite:"Muitas tentativas. Aguarde alguns minutos e tente de novo.",rede:"Não conseguimos falar com o servidor. Confira a sua conexão e tente de novo.",formato:"Digite um e-mail válido, como nome@empresa.com.br.",captcha:"A verificação de segurança não passou. Recarregue a página e tente de novo.",falha:"Não foi possível enviar agora. Tente de novo em instantes.",sem_backend:"A troca de senha por e-mail precisa do servidor do Civilbook, que não está ligado neste modo de teste. Nenhum e-mail foi enviado.",indisponivel:"Serviço indisponível no momento. Verifique sua conexão e recarregue a página."};var E=["limite","rede","formato","captcha","falha","sem_backend","indisponivel"];var A="Enviar link",w="Reenviar link",C="Enviando…";var f=false;var b=false;var d=0;var v=null;function o(e){return document.getElementById(e)}function n(e,a){var t=o(e);if(t)t.classList.toggle("hidden",!!a)}function p(e){var a=o(e);if(a&&a.focus){try{a.focus()}catch(t){}}}function g(){var e=Date.now(),a=e+l*1e3,t=0;try{t=Number(localStorage.getItem(r))||0}catch(i){}if(d>a)d=a;if(t>a){t=a;try{localStorage.setItem(r,String(a))}catch(i){}}return Math.max(0,Math.ceil((Math.max(d,t)-e)/1e3))}function y(){d=Date.now()+l*1e3;try{localStorage.setItem(r,String(d))}catch(e){}u()}function u(){if(v){clearTimeout(v);v=null}var e=o("r-enviar");if(!e)return;if(f){e.disabled=true;e.textContent=C;return}var a=g();if(a>0){e.disabled=true;e.textContent="Reenviar em "+a+" s";v=setTimeout(u,1e3);return}e.disabled=false;e.textContent=b?w:A}function m(e,a){var t=o("r-ok"),i=o("r-erro");if(t){t.textContent=e==="ok"?a:"";t.classList.toggle("hidden",e!=="ok")}if(i){i.textContent=e==="erro"?a:"";i.classList.toggle("hidden",e!=="erro")}}function S(){var e=o("form-recuperar");if(!e)return;n("auth-abas",true);n("auth-social",true);n("form-login",true);n("form-cadastro",true);e.classList.remove("hidden");var a=o("l-email"),t=o("r-email");var i=a?String(a.value||"").trim():"";if(t&&i)t.value=i;m("","");if(g()>0)b=true;u();p("r-email")}function x(){if(typeof AUTH!=="undefined"&&AUTH&&typeof AUTH.esconderSenhas==="function")AUTH.esconderSenhas(o("auth-modal"));var e=o("form-recuperar");if(!e||e.classList.contains("hidden"))return false;e.classList.add("hidden");n("auth-abas",false);n("auth-social",false);return true}function k(){var e=o("r-email"),a=o("l-email");var t=e?String(e.value||"").trim():"";if(a&&!String(a.value||"").trim()&&t)a.value=t;if(typeof window.trocarAba==="function")window.trocarAba("login");else{x();n("form-cadastro",true);n("form-login",false)}p(a&&String(a.value||"").trim()?"l-senha":"l-email")}async function T(e){if(e&&e.preventDefault)e.preventDefault();if(f)return false;if(g()>0){u();return false}var a=o("r-email");var t=a?String(a.value||"").trim():"";if(!s.test(t)){m("erro",c.formato);p("r-email");return false}f=true;m("","");u();var i;try{var R=typeof window.cbCaptchaToken==="function"?window.cbCaptchaToken():"";i=await AUTH.resetSenha(t,R)}catch(L){i={ok:false,motivo:"falha"}}f=false;var h=i&&i.ok===true?"":String(i&&i.motivo||"");if(E.indexOf(h)<0){b=true;m("ok",c.enviado);y();p("r-ok");return false}m("erro",c[h]);if(h==="limite")y();else u();if(h==="formato")p("r-email");return false}document.addEventListener("keydown",function(e){if(e.key!=="Escape")return;var a=o("form-recuperar"),t=o("auth-overlay");if(!a||a.classList.contains("hidden")||t&&t.classList.contains("hidden"))return;e.preventDefault();k()});window.cbRecuperar={abrir:S,voltar:k,esconder:x,enviar:T}})();
