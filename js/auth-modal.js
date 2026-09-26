// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Ver LICENSE.

// js/auth-modal.js — o MARKUP do modal de login/cadastro da landing (abas, "Entrar com Google", formulários).
// Vive aqui, e não no index.html, por causa do verificador de marca do Google (tela de consentimento OAuth, d20,
// 16/set/2026): ele lia o HTML da home, encontrava <form> com campo de senha (mesmo dentro de um <template>
// inerte) e classificava a página como "protegida por login" / "sem finalidade". Com o markup num script, o
// HTML servido não contém formulário de login nenhum; o modal é montado por montarAuth() (index.html) no
// 1º clique em "Entrar"/"Criar conta grátis" via innerHTML. Os ids (#form-login, #l-email, #c-senha, #c-consent…)
// são os mesmos de sempre: o script inline do index.html e os specs E2E (tests/e2e/) dependem deles.
// Script clássico (sem import/export), carregado depois de js/auth.js e antes do script inline da página.
// Desde 18/set/2026 mora aqui também a etapa "Esqueci a senha" (#form-recuperar) e o CONTROLE dela (fim do
// arquivo, window.cbRecuperar), pelo mesmo motivo: a home servida não leva nem o formulário nem os textos da
// recuperação. O index.html só chama cbRecuperar.esconder() dentro de trocarAba().
window.cbAuthModalHTML = `
    <button class="auth-close" onclick="fecharAuth()" aria-label="Fechar"><i class="ti ti-x"></i></button>
    <div class="logo" style="justify-content:center;margin-bottom:18px">
      <img class="logo-icon" src="icon.svg?v=cd8b896" alt="Civilbook"><span>Civilbook</span>
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
      <div class="field"><label>Senha (mínimo 8 caracteres)</label><small class="hint" id="c-senha-regra">Com pelo menos uma letra minúscula, uma letra maiúscula, um número e um símbolo. Espaço, ç, letras com acento, emojis e sinais como º, °, § e € podem entrar, mas não contam. Valem como símbolo: <span class="senha-simbolos">! @ # $ % ^ &amp; * ( ) _ + - = [ ] { } ; ' &#92; : &quot; | &lt; &gt; ? , . / &#96; ~</span></small><input aria-describedby="c-senha-regra" type="password" id="c-senha" minlength="8" required></div>
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
        <span>Li e concordo com a <a href="privacidade.html" target="_blank" style="color:var(--blue)">Política de Privacidade</a> e autorizo o tratamento dos meus dados conforme a LGPD.</span>
      </label>
      <p class="auth-erro hidden" id="c-erro"></p>
      <button class="btn primary" style="width:100%" type="submit">Criar conta grátis</button>
      <p style="font-size:12px;color:var(--text-3);margin-top:10px;text-align:center">Conta gratuita — faça upgrade para PRO quando quiser.</p>
    </form>
`;

// ---- Aviso de "o login não carregou" (a50, 19/set/2026) --------------------------------------------------
// O pedido da a50 era "login com aviso de que o login não carregou". Sem este aviso a pessoa abria o modal igual
// ao normal, digitava e-mail e senha e só DEPOIS do envio lia "Serviço de login indisponível" (céticos, 19/set/2026).
// Agora o aviso aparece AO ABRIR, e o "Entrar com Google" some junto — ele também não tem como funcionar.
// Só depois do boot (AUTH._ready): antes disso "sem SDK" é download em curso, não falha (é a mesma distinção dos
// Detalhes do splash em AUTH.resumoBoot). Chamado por abrirAuth() (index.html) a CADA abertura, porque o boot pode
// terminar depois de o modal ser montado. Devolve true quando avisou. Travado em tests/boot-sessao.check.mjs (A13, A16).
window.cbAuthAvisoFora = function () {
  var el = document.getElementById("auth-fora");
  if (!el) return false;   // modal não montado, ou uma cópia antiga do markup
  var A = typeof AUTH !== "undefined" ? AUTH : null;
  var fora = !!(A && A._ready === true && typeof A._supaIndisponivel === "function" && A._supaIndisponivel());
  el.textContent = fora ? "O login não carregou nesta página — costuma ser conexão instável, bloqueador de anúncios ou extensão do navegador. Recarregue a página para entrar." : "";
  el.classList.toggle("hidden", !fora);
  if (fora) { var s = document.getElementById("auth-social"); if (s) s.style.display = "none"; }
  return fora;
};

// ---- "Esqueci a senha": o controle da etapa #form-recuperar (18/set/2026) --------------------------------
// REGRAS (travadas em tests/recuperar-senha.check.mjs, que roda este arquivo num DOM falso; o fluxo no
// navegador em tests/e2e/recuperar-senha.spec.js):
//   1. ANTI-ENUMERAÇÃO NA TELA. A resposta de envio é UMA frase só (TEXTOS.enviado), exista ou não conta com o
//      e-mail, e vem com a MESMA espera. O Supabase já responde 200 para e-mail sem conta; o que só acontece
//      depois de achar a conta (o limite por conta, a cota de e-mails do projeto, a falha e a demora do envio)
//      chega de AUTH.resetSenha como motivo "outro" e recebe a mesma frase. Mensagem PRÓPRIA só para os
//      motivos de PROPRIOS, que o servidor confere antes de procurar a conta (ou que nem chegam a ele). Motivo
//      que não está na lista (inclusive um que nasça amanhã em js/auth.js) cai no "enviado": é o lado seguro.
//      A mensagem do servidor nunca chega à tela. Quem chama a API direto não passa por aqui: o que a fecha é
//      do servidor (limites e CAPTCHA, docs/SECURITY.md §7).
//   2. Cada clique manda um e-mail, e o Supabase limita os envios por hora: o botão fica desligado durante o
//      envio e, depois do "enviado" e do "muitas tentativas" (limite por IP), por ESPERA_S segundos, com
//      contagem. A espera sobrevive a fechar o modal e a recarregar a página (localStorage, quando o navegador
//      deixa), vale para as outras abas no clique, e nunca passa de ESPERA_S contados de agora.
//   3. Sem servidor (modo local dos testes, ?e2e=1) a etapa diz isso e não finge envio.
//   4. Teclado: abrir leva o foco ao campo de e-mail (já preenchido com o do formulário de entrar); Esc, com a
//      etapa na tela, e "Voltar para entrar" voltam ao formulário de entrar. trocarAba() (index.html) chama
//      esconder(): abrir o modal por "Entrar" ou "Criar conta" nunca cai na recuperação aberta da vez anterior.
(function () {
  "use strict";
  var ESPERA_S = 60;
  var CHAVE_ESPERA = "cb-recuperar-ate";
  var FORMATO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var TEXTOS = {
    enviado: "Se houver uma conta com este e-mail, enviamos um link para criar uma senha nova. Confira a caixa de entrada e o spam; o link vale uma vez e por tempo limitado.",
    limite: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
    rede: "Não conseguimos falar com o servidor. Confira a sua conexão e tente de novo.",
    formato: "Digite um e-mail válido, como nome@empresa.com.br.",
    captcha: "A verificação de segurança não passou. Recarregue a página e tente de novo.",
    falha: "Não foi possível enviar agora. Tente de novo em instantes.",
    sem_backend: "A troca de senha por e-mail precisa do servidor do Civilbook, que não está ligado neste modo de teste. Nenhum e-mail foi enviado.",
    indisponivel: "Serviço indisponível no momento. Verifique sua conexão e recarregue a página."
  };
  // Os únicos motivos com mensagem própria: nenhum depende de a conta existir (js/auth.js, resetSenha).
  var PROPRIOS = ["limite", "rede", "formato", "captcha", "falha", "sem_backend", "indisponivel"];
  var ROTULO_ENVIAR = "Enviar link", ROTULO_REENVIAR = "Reenviar link", ROTULO_ENVIANDO = "Enviando…";

  var enviando = false;   // pedido no ar: um clique só por vez
  var jaEnviou = false;   // muda o rótulo para "Reenviar link"
  var ate = 0;            // fim da espera (ms). A cópia no localStorage só serve para sobreviver ao recarregar.
  var relogio = null;

  function $(id) { return document.getElementById(id); }
  function ocultar(id, sim) { var el = $(id); if (el) el.classList.toggle("hidden", !!sim); }
  function focar(id) { var el = $(id); if (el && el.focus) { try { el.focus(); } catch (e) { /* foco é conforto */ } } }

  // Segundos até liberar o reenvio. Valor fora do normal (o relógio voltou depois do envio, storage editado) é
  // rebaixado UMA vez para agora + ESPERA_S, e regravado: um teto recalculado a cada tique andaria junto com o
  // relógio e prenderia o botão em "Reenviar em 60 s" até o valor guardado vencer (horas, no caso adulterado).
  function restante() {
    var agora = Date.now(), teto = agora + ESPERA_S * 1000, guardado = 0;
    try { guardado = Number(localStorage.getItem(CHAVE_ESPERA)) || 0; } catch (e) { /* sem storage: vale a memória */ }
    if (ate > teto) ate = teto;
    if (guardado > teto) {
      guardado = teto;
      try { localStorage.setItem(CHAVE_ESPERA, String(teto)); } catch (e) { /* segue só com a memória */ }
    }
    return Math.max(0, Math.ceil((Math.max(ate, guardado) - agora) / 1000));
  }
  function iniciarEspera() {
    ate = Date.now() + ESPERA_S * 1000;
    try { localStorage.setItem(CHAVE_ESPERA, String(ate)); } catch (e) { /* segue só com a memória */ }
    atualizarBotao();
  }
  function atualizarBotao() {
    if (relogio) { clearTimeout(relogio); relogio = null; }
    var b = $("r-enviar");
    if (!b) return;
    if (enviando) { b.disabled = true; b.textContent = ROTULO_ENVIANDO; return; }
    var s = restante();
    if (s > 0) {
      b.disabled = true;
      b.textContent = "Reenviar em " + s + " s";
      relogio = setTimeout(atualizarBotao, 1000);
      return;
    }
    b.disabled = false;
    b.textContent = jaEnviou ? ROTULO_REENVIAR : ROTULO_ENVIAR;
  }
  // tipo: "ok" | "erro" | "" (limpa as duas)
  function mensagem(tipo, texto) {
    var ok = $("r-ok"), erro = $("r-erro");
    if (ok) { ok.textContent = tipo === "ok" ? texto : ""; ok.classList.toggle("hidden", tipo !== "ok"); }
    if (erro) { erro.textContent = tipo === "erro" ? texto : ""; erro.classList.toggle("hidden", tipo !== "erro"); }
  }

  function abrir() {
    var form = $("form-recuperar");
    if (!form) return;
    ocultar("auth-abas", true);
    ocultar("auth-social", true);
    ocultar("form-login", true);
    ocultar("form-cadastro", true);
    form.classList.remove("hidden");
    var de = $("l-email"), para = $("r-email");
    var digitado = de ? String(de.value || "").trim() : "";
    if (para && digitado) para.value = digitado;
    mensagem("", "");
    if (restante() > 0) jaEnviou = true;
    atualizarBotao();
    focar("r-email");
  }
  // Só desfaz a etapa (as abas e o "Entrar com Google" voltam); quem escolhe o formulário é trocarAba().
  function esconder() {
    var form = $("form-recuperar");
    if (!form || form.classList.contains("hidden")) return false;
    form.classList.add("hidden");
    ocultar("auth-abas", false);
    ocultar("auth-social", false);
    return true;
  }
  function voltar() {
    var de = $("r-email"), para = $("l-email");
    var digitado = de ? String(de.value || "").trim() : "";
    if (para && !String(para.value || "").trim() && digitado) para.value = digitado;
    if (typeof window.trocarAba === "function") window.trocarAba("login");
    else { esconder(); ocultar("form-cadastro", true); ocultar("form-login", false); }
    focar(para && String(para.value || "").trim() ? "l-senha" : "l-email");
  }

  async function enviar(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    if (enviando) return false;
    // Espera em curso, inclusive a que começou noutra aba (o localStorage é o mesmo): o clique mostra a contagem
    // e desliga o botão, em vez de não fazer nada.
    if (restante() > 0) { atualizarBotao(); return false; }
    var campo = $("r-email");
    var email = campo ? String(campo.value || "").trim() : "";
    if (!FORMATO.test(email)) { mensagem("erro", TEXTOS.formato); focar("r-email"); return false; }
    enviando = true;
    mensagem("", "");
    atualizarBotao();
    var r;
    try {
      var captcha = typeof window.cbCaptchaToken === "function" ? window.cbCaptchaToken() : "";
      r = await AUTH.resetSenha(email, captcha);
    } catch (e) {
      r = { ok: false, motivo: "falha" };   // AUTH ausente ou exceção daqui: não houve resposta do servidor
    }
    enviando = false;
    var motivo = r && r.ok === true ? "" : String((r && r.motivo) || "");
    if (PROPRIOS.indexOf(motivo) < 0) {
      // Enviado, "outro" ou motivo desconhecido: a MESMA frase e a MESMA espera (regra 1).
      jaEnviou = true;
      mensagem("ok", TEXTOS.enviado);
      iniciarEspera();
      focar("r-ok");
      return false;
    }
    mensagem("erro", TEXTOS[motivo]);
    if (motivo === "limite") iniciarEspera();
    else atualizarBotao();
    if (motivo === "formato") focar("r-email");
    return false;
  }

  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape") return;
    var form = $("form-recuperar"), camada = $("auth-overlay");
    if (!form || form.classList.contains("hidden") || (camada && camada.classList.contains("hidden"))) return;
    ev.preventDefault();
    voltar();
  });

  window.cbRecuperar = { abrir: abrir, voltar: voltar, esconder: esconder, enviar: enviar };
})();
