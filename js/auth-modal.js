// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Ver LICENSE.
window.cbAuthModalHTML=`
    <button class="auth-close" onclick="fecharAuth()" aria-label="Fechar"><i class="ti ti-x"></i></button>
    <div class="logo" style="justify-content:center;margin-bottom:18px">
      <img class="logo-icon" src="icon.svg?v=41524e0" alt="Civilbook"><span>Civilbook</span>
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
      <div class="field"><label>Senha</label><input type="password" id="l-senha" required></div>
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
      <div class="field"><label>Senha (mínimo 8 caracteres)</label><small class="hint" id="c-senha-regra">Com pelo menos uma letra minúscula, uma letra maiúscula, um número e um símbolo. Use só letras sem acento, números e estes símbolos: <span class="senha-simbolos">! @ # $ % ^ &amp; * ( ) _ + - = [ ] { } ; ' &#92; : &quot; | &lt; &gt; ? , . / &#96; ~</span> — espaço, ç, letras com acento, emojis e sinais como º, °, § e € não são aceitos.</small><input aria-describedby="c-senha-regra" type="password" id="c-senha" minlength="8" required></div>
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
`;window.cbAuthAvisoFora=function(){var l=document.getElementById("auth-fora");if(!l)return false;var i=typeof AUTH!=="undefined"?AUTH:null;var s=!!(i&&i._ready===true&&typeof i._supaIndisponivel==="function"&&i._supaIndisponivel());l.textContent=s?"O login não carregou nesta página — costuma ser conexão instável, bloqueador de anúncios ou extensão do navegador. Recarregue a página para entrar.":"";l.classList.toggle("hidden",!s);if(s){var c=document.getElementById("auth-social");if(c)c.style.display="none"}return s};(function(){"use strict";var l=60;var i="cb-recuperar-ate";var s=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;var c={enviado:"Se houver uma conta com este e-mail, enviamos um link para criar uma senha nova. Confira a caixa de entrada e o spam; o link vale uma vez e por tempo limitado.",limite:"Muitas tentativas. Aguarde alguns minutos e tente de novo.",rede:"Não conseguimos falar com o servidor. Confira a sua conexão e tente de novo.",formato:"Digite um e-mail válido, como nome@empresa.com.br.",captcha:"A verificação de segurança não passou. Recarregue a página e tente de novo.",falha:"Não foi possível enviar agora. Tente de novo em instantes.",sem_backend:"A troca de senha por e-mail precisa do servidor do Civilbook, que não está ligado neste modo de teste. Nenhum e-mail foi enviado.",indisponivel:"Serviço indisponível no momento. Verifique sua conexão e recarregue a página."};var k=["limite","rede","formato","captcha","falha","sem_backend","indisponivel"];var A="Enviar link",w="Reenviar link",C="Enviando…";var p=false;var b=false;var d=0;var f=null;function r(e){return document.getElementById(e)}function n(e,a){var t=r(e);if(t)t.classList.toggle("hidden",!!a)}function m(e){var a=r(e);if(a&&a.focus){try{a.focus()}catch(t){}}}function g(){var e=Date.now(),a=e+l*1e3,t=0;try{t=Number(localStorage.getItem(i))||0}catch(o){}if(d>a)d=a;if(t>a){t=a;try{localStorage.setItem(i,String(a))}catch(o){}}return Math.max(0,Math.ceil((Math.max(d,t)-e)/1e3))}function y(){d=Date.now()+l*1e3;try{localStorage.setItem(i,String(d))}catch(e){}u()}function u(){if(f){clearTimeout(f);f=null}var e=r("r-enviar");if(!e)return;if(p){e.disabled=true;e.textContent=C;return}var a=g();if(a>0){e.disabled=true;e.textContent="Reenviar em "+a+" s";f=setTimeout(u,1e3);return}e.disabled=false;e.textContent=b?w:A}function v(e,a){var t=r("r-ok"),o=r("r-erro");if(t){t.textContent=e==="ok"?a:"";t.classList.toggle("hidden",e!=="ok")}if(o){o.textContent=e==="erro"?a:"";o.classList.toggle("hidden",e!=="erro")}}function R(){var e=r("form-recuperar");if(!e)return;n("auth-abas",true);n("auth-social",true);n("form-login",true);n("form-cadastro",true);e.classList.remove("hidden");var a=r("l-email"),t=r("r-email");var o=a?String(a.value||"").trim():"";if(t&&o)t.value=o;v("","");if(g()>0)b=true;u();m("r-email")}function x(){var e=r("form-recuperar");if(!e||e.classList.contains("hidden"))return false;e.classList.add("hidden");n("auth-abas",false);n("auth-social",false);return true}function E(){var e=r("r-email"),a=r("l-email");var t=e?String(e.value||"").trim():"";if(a&&!String(a.value||"").trim()&&t)a.value=t;if(typeof window.trocarAba==="function")window.trocarAba("login");else{x();n("form-cadastro",true);n("form-login",false)}m(a&&String(a.value||"").trim()?"l-senha":"l-email")}async function S(e){if(e&&e.preventDefault)e.preventDefault();if(p)return false;if(g()>0){u();return false}var a=r("r-email");var t=a?String(a.value||"").trim():"";if(!s.test(t)){v("erro",c.formato);m("r-email");return false}p=true;v("","");u();var o;try{var T=typeof window.cbCaptchaToken==="function"?window.cbCaptchaToken():"";o=await AUTH.resetSenha(t,T)}catch(q){o={ok:false,motivo:"falha"}}p=false;var h=o&&o.ok===true?"":String(o&&o.motivo||"");if(k.indexOf(h)<0){b=true;v("ok",c.enviado);y();m("r-ok");return false}v("erro",c[h]);if(h==="limite")y();else u();if(h==="formato")m("r-email");return false}document.addEventListener("keydown",function(e){if(e.key!=="Escape")return;var a=r("form-recuperar"),t=r("auth-overlay");if(!a||a.classList.contains("hidden")||t&&t.classList.contains("hidden"))return;e.preventDefault();E()});window.cbRecuperar={abrir:R,voltar:E,esconder:x,enviar:S}})();
