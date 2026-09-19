// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Ver LICENSE.

// js/acesso.js — lógica de acesso.html, o destino dos links dos e-mails de login do Supabase Auth:
// convite, confirmação de cadastro, link mágico, troca de senha e troca de e-mail. Os modelos dos e-mails
// moram em supabase/templates/email/ (o README de lá diz onde colar e em que ordem).
//
// POR QUE ESTA PÁGINA EXISTE (18/set/2026): o convite chegou no SPAM do Gmail com o modelo padrão do
// Supabase (em inglês, link para *.supabase.co, domínio diferente do remetente civilbook.com.br). Além
// disso, quem aceitava o convite nunca criava senha e o link de troca de senha entrava na conta sem pedir
// senha nova. Desenho da documentação do Supabase ("Email templates"): o link do e-mail aponta para o
// PRÓPRIO domínio com o token_hash, e a página chama verifyOtp.
//
// REGRAS (cada uma travada em tests/acesso.check.mjs, com mutante; o fluxo no navegador em
// tests/e2e/acesso.spec.js):
//   1. token_hash e type saem da barra de endereço ANTES de qualquer outra coisa (history.replaceState) e
//      ficam só nesta closure: a barra, o favorito, o print de tela, o botão Voltar e o cabeçalho Referer não
//      mostram mais o token. Nenhum storage, console, cookie ou link da página guarda o token (o check varre
//      tudo o que a simulação alcança). O que a página NÃO apaga: a visita já registrada no histórico global
//      do navegador e no log de acesso do servidor, e a cópia que o service worker fizer da página (o sw.js
//      ainda não trata acesso.html como trata drive-callback.html). Por isso o token vale uma vez só e por
//      pouco tempo.
//   2. verifyOtp SÓ dentro do clique da pessoa. Robôs de segurança de e-mail "abrem" os links para
//      inspecionar; se a página confirmasse sozinha, o robô gastaria o token e a pessoa encontraria o link
//      já usado (aviso de prefetch da documentação do Supabase). O cliente Supabase nem é criado antes do
//      clique: até lá, nada vai à rede. Clique sintético (isTrusted === false) é ignorado.
//   3. Destino FIXO: app.html (ou o login, index.html#entrar). Nenhum parâmetro da URL decide para onde a
//      pessoa vai — sem redirecionamento aberto. Por isso os modelos também não usam {{ .RedirectTo }}.
//   4. Tipos aceitos = EmailOtpType do supabase-js VENDORIZADO (js/vendor/supabase.js: supabase-js 2.45.0,
//      auth-js 2.64.4), o tipo que verifyOtp aceita com token_hash: signup | invite | magiclink | recovery |
//      email_change | email. Nesta versão "email" substitui "signup" e "magiclink" (o servidor procura o
//      token de confirmação e o de acesso), e os modelos usam "email"; os dois antigos continuam aceitos
//      porque o verifyOtp ainda os aceita. O bundle não valida o tipo no cliente — manda direto para
//      /auth/v1/verify —, então a lista fechada daqui é o que transforma valor estranho em erro amigável.
//   5. Texto que vem da URL nunca vira HTML: tudo é textContent, e nada é escrito com innerHTML.
//   6. Nenhum console.* neste arquivo: token não vai parar em log.
//   7. Só getElementById como API de DOM (o check roda este arquivo num DOM falso e registra cada efeito).
//   8. Sessão no aparelho só quando precisa, e sempre à vista (achado da revisão de 18/set/2026):
//      - convite, troca de senha e troca de e-mail confirmam num cliente SÓ EM MEMÓRIA (persistSession:false:
//        nada no storage, nada avisado às outras abas). No convite e na troca de senha, a sessão do aparelho
//        só nasce DEPOIS que a senha nova é salva, entrando com ela (signInWithPassword). Antes, o clique já
//        gravava a sessão: quem fechava a aba na tela da senha ficava conectado sem ter senha;
//      - confirmação de cadastro e link mágico (type email/signup/magiclink) gravam a sessão no clique, e a
//        página diz QUAL conta abriu e espera o clique em "Abrir o Civilbook". Um link da conta de outra
//        pessoa não põe ninguém dentro dela sem ver (login CSRF);
//      - antes do clique, se o navegador já tem uma conta aberta, a página avisa qual é.
(function () {
  "use strict";

  // ---- 1. Captura e limpeza da URL — PRIMEIRA coisa, antes de qualquer outra chamada -----------------
  var consulta = new URLSearchParams(location.search);
  var tokenHash = consulta.get("token_hash") || "";
  var tipo = consulta.get("type") || "";
  consulta = null;
  try { history.replaceState(null, "", location.pathname); } catch (e) { /* sandbox/file://: segue sem limpar */ }

  // ---- 2. Tema: o mesmo critério do resto do site (escolha salva > sistema operacional) --------------
  try {
    var tema = localStorage.getItem("cb-theme");
    if (tema !== "dark" && tema !== "light") {
      tema = (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", tema);
  } catch (e) { /* sem storage: fica o tema claro do CSS */ }

  // ---- 3. Constantes -------------------------------------------------------------------------------
  var DESTINO = "app.html";            // FIXO. Nunca vem da URL (regra 3).
  var LOGIN = "index.html#entrar";     // a landing abre o modal de login com este hash
  var SENHA_MIN = 8;                   // = Supabase Auth → Email → Minimum password length (8, visto em 18/set/2026);
                                       // o mesmo do cadastro (js/auth-modal.js), do AUTH e de Minha conta
  var SENHA_MAX_BYTES = 72;            // limite do servidor (bcrypt): acima disso o Supabase recusa
  var ESPERA_MS = 1200;                // tempo para ler "tudo certo" antes de abrir o app

  // Regra 4. Chave = type da URL; valor = qual texto e qual fluxo esta página usa.
  var TIPOS = {
    invite: "convite",
    recovery: "senha",
    email: "email",
    signup: "email",
    magiclink: "email",
    email_change: "troca"
  };
  // Hash do Supabase: hexadecimal (com prefixo "pkce_" quando o pedido nasceu no fluxo PKCE). A régua é
  // larga de propósito: quem decide se o token vale é o servidor; aqui só se barra lixo e link cortado.
  var TOKEN_OK = /^[A-Za-z0-9_-]{16,256}$/;

  var modo = Object.prototype.hasOwnProperty.call(TIPOS, tipo) ? TIPOS[tipo] : "";
  // Regra 8: só o modo "email" grava a sessão no aparelho no clique; os outros confirmam só em memória.
  var GRAVA_NO_CLIQUE = modo === "email";

  var TEXTOS = {
    convite: {
      titulo: "Aceitar o convite",
      texto: "Você recebeu um convite para usar o Civilbook. Ao continuar, o convite é confirmado e, em seguida, você cria a sua senha de acesso.",
      botao: "Aceitar convite",
      senhaTitulo: "Crie a sua senha",
      senhaTexto: "É com ela que você vai entrar no Civilbook daqui para a frente.",
      okTitulo: "Senha criada",
      expirado: "Este convite já foi usado ou expirou. Por segurança, cada link vale uma vez só e por tempo limitado.",
      // Quem clicou em "Aceitar convite" e não criou a senha já tem a conta confirmada, sem senha: para essa
      // pessoa o caminho é um link de troca de senha, não um convite novo.
      comoPedir: "Se você já criou a sua senha, é só entrar. Se ainda não criou, peça a quem convidou você um novo convite, ou um link de troca de senha se você já tinha clicado em “Aceitar convite”.",
      refazer: "Como o convite já foi aceito, peça a quem convidou você um link de troca de senha.",
      contato: false
    },
    senha: {
      titulo: "Criar uma senha nova",
      texto: "Recebemos um pedido para trocar a senha da sua conta. Ao continuar, o pedido é confirmado e, em seguida, você define a senha nova.",
      botao: "Continuar",
      senhaTitulo: "Crie a sua senha nova",
      senhaTexto: "A senha antiga deixa de valer assim que você salvar a nova.",
      okTitulo: "Senha trocada",
      expirado: "Este link de troca de senha já foi usado ou expirou. Por segurança, cada link vale uma vez só, por tempo limitado, e só o e-mail mais recente vale.",
      // O login tem "Esqueci a senha" desde 18/set/2026 (link #l-esqueci em js/auth-modal.js). A tela de erro
      // tem o botão "Ir para o login"; a tela da senha não tem, por isso refazer diz onde fica a tela de entrar.
      // tests/acesso.check.mjs reprova citar "Esqueci a senha" se o link sumir do login.
      comoPedir: "Peça um link novo em “Esqueci a senha”, na tela de entrar (botão “Ir para o login”, aqui embaixo).",
      refazer: "Peça um link novo em “Esqueci a senha”, na tela de entrar do Civilbook.",
      contato: true
    },
    email: {
      titulo: "Confirmar o e-mail e entrar",
      texto: "Ao continuar, o e-mail deste link é confirmado e você entra no Civilbook com essa conta. A próxima tela mostra qual é.",
      botao: "Confirmar e entrar",
      okTitulo: "Tudo certo",
      expirado: "Este link já foi usado ou expirou. Por segurança, cada link vale uma vez só e por tempo limitado.",
      comoPedir: "Se você já confirmou o seu e-mail, é só entrar com o seu e-mail e a sua senha.",
      contato: false
    },
    troca: {
      titulo: "Confirmar a troca de e-mail",
      texto: "Ao continuar, confirmamos a troca do e-mail da sua conta no Civilbook.",
      botao: "Confirmar a troca",
      okTitulo: "E-mail trocado",
      expirado: "Este link de troca de e-mail já foi usado ou expirou. Por segurança, cada link vale uma vez só e por tempo limitado.",
      comoPedir: "Enquanto a troca não é confirmada, o e-mail antigo continua valendo para entrar.",
      contato: false
    }
  };
  var T = TEXTOS[modo] || null;

  var ETAPAS = ["carregando", "inicio", "senha", "ok", "erro"];
  var ocupado = false;
  var clientes = {};
  var contaDoLink = "";                  // e-mail que o verifyOtp devolveu (convite e troca de senha)

  // ---- 4. Utilidades de tela (só getElementById + textContent — regras 5 e 7) -----------------------
  function $(id) { return document.getElementById(id); }
  function texto(id, t) { var el = $(id); if (el) el.textContent = t || ""; }
  function mostrarEl(id, sim) { var el = $(id); if (el) el.hidden = !sim; }
  function mostrar(etapa) {
    for (var i = 0; i < ETAPAS.length; i++) mostrarEl("etapa-" + ETAPAS[i], ETAPAS[i] === etapa);
    var foco = { inicio: "conf-titulo", senha: "senha-titulo", ok: "ok-titulo", erro: "erro-titulo" }[etapa];
    var el = foco && $(foco);
    if (el && el.focus) { try { el.focus(); } catch (e) { /* foco é conforto, não requisito */ } }
  }
  function botao(id, rotulo, desligado) {
    var el = $(id);
    if (!el) return;
    if (rotulo) el.textContent = rotulo;
    el.disabled = !!desligado;
  }

  var ERROS = {
    vazio: {
      titulo: "Nenhum link para abrir",
      texto: "Esta página abre os links que o Civilbook manda por e-mail: convite, confirmação de cadastro e troca de senha.",
      dica: "Abra o link direto do e-mail. Se você recarregou esta página antes de confirmar, abra o link do e-mail de novo: ele continua valendo enquanto não for usado."
    },
    tipo: {
      titulo: "Link não reconhecido",
      texto: "O endereço que abriu esta página não corresponde a nenhum e-mail do Civilbook.",
      dica: "Volte ao e-mail e use o botão dele. Se o e-mail parecer estranho, não clique em nada e apague a mensagem."
    },
    incompleto: {
      titulo: "Link incompleto",
      texto: "Parte do endereço se perdeu no caminho. Alguns programas de e-mail cortam links longos.",
      dica: "Volte ao e-mail e use o botão, ou copie o endereço inteiro, do começo ao fim, e cole no navegador."
    },
    config: {
      titulo: "Não foi possível carregar a página",
      texto: "Uma parte desta página não carregou.",
      dica: "Abra o link do e-mail de novo. Ele continua valendo enquanto não for usado."
    },
    moldura: {
      titulo: "Abra o link direto do e-mail",
      texto: "Por segurança, esta página não funciona dentro de outra página.",
      dica: "Volte ao e-mail e abra o link numa aba do navegador."
    }
  };

  function mostrarErro(titulo, textoPrincipal, dica, opcoes) {
    opcoes = opcoes || {};
    texto("erro-titulo", titulo);
    texto("erro-texto", textoPrincipal);
    texto("erro-dica", dica);
    mostrarEl("erro-dica", !!dica);
    mostrarEl("erro-contato", !!opcoes.contato);
    mostrarEl("btn-tentar", !!opcoes.tentar);
    botao("btn-tentar", "Tentar de novo", false);
    mostrar("erro");
  }
  function erroFixo(chave) { var e = ERROS[chave]; mostrarErro(e.titulo, e.texto, e.dica); }

  // opcoes: abrirApp = vai sozinho para o app; login = mostra também "Ir para o login"; soLogin = só o login
  // (sem "Abrir o Civilbook"); nota = aviso abaixo do texto.
  function mostrarOk(titulo, textoPrincipal, opcoes) {
    opcoes = opcoes || {};
    texto("ok-titulo", titulo);
    texto("ok-texto", textoPrincipal);
    texto("ok-nota", opcoes.nota);
    mostrarEl("ok-nota", !!opcoes.nota);
    mostrarEl("ok-ir", !opcoes.soLogin);
    mostrarEl("ok-login", !!(opcoes.login || opcoes.soLogin));
    mostrar("ok");
    if (opcoes.abrirApp) setTimeout(function () { location.replace(DESTINO); }, ESPERA_MS);
  }

  // ---- 5. Erros do Supabase -> texto de gente ---------------------------------------------------------
  // auth-js 2.64.4: AuthApiError traz .status e .code (o error_code do servidor); falha de rede e 502/503/504
  // viram AuthRetryableFetchError (status 0 ou o 5xx); senha fraca vira AuthWeakPasswordError com .reasons.
  function codigo(e) { return (e && typeof e.code === "string") ? e.code : ""; }
  function ehRede(e) {
    return !!e && (e.name === "AuthRetryableFetchError" || e.status === 0 || e.name === "TypeError");
  }
  function classificar(e) {
    if (ehRede(e)) return "rede";
    var c = codigo(e), s = e && e.status;
    if (s === 429 || /rate_limit/.test(c)) return "limite";
    // Só o que o servidor diz ser link gasto ou vencido (403 otp_expired no /verify). Nada de adivinhar pela
    // mensagem: um 401 "Invalid API key" (chave do app trocada, config.js velho) caía aqui como "link
    // expirado" e a pessoa abandonava um link que ainda valia. Esse caso é "outro", com "Tentar de novo".
    if (c === "otp_expired" || s === 403 || s === 410) return "expirado";
    return "outro";
  }

  // grava = true: a sessão vai para o storage padrão do app (a mesma chave que js/supa.js usa: é a que o
  // app.html encontra) e é avisada às outras abas. grava = false: tudo só em memória (regra 8).
  // detectSessionInUrl:false porque esta página trata a URL sozinha (regra 1); autoRefreshToken:false porque
  // ela vive segundos — quem cuida da sessão depois é o app. No convite e na troca de senha nascem os dois
  // clientes (o de memória no clique, o do aparelho depois da senha) e o supabase-js avisa no console
  // "Multiple GoTrueClient instances": é esperado, um não é usado depois que o outro nasce.
  function cliente(grava) {
    var qual = grava ? "aparelho" : "memoria";
    if (clientes[qual]) return clientes[qual];
    var cfg = window.CB_CONFIG || {};
    var sdk = window.supabase;
    if (!sdk || typeof sdk.createClient !== "function" || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return null;
    clientes[qual] = sdk.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: { persistSession: !!grava, autoRefreshToken: false, detectSessionInUrl: false }
    });
    return clientes[qual];
  }

  // Conta já aberta neste navegador (a do app), só para AVISAR antes do clique (regra 8). Só leitura. O
  // formato é o do auth-js vendorizado: chave sb-<ref>-auth-token com a sessão em JSON (o check trava a
  // versão e a fórmula da chave). Se o formato mudar, o aviso some e nada quebra.
  function contaAberta() {
    try {
      var cfg = window.CB_CONFIG || {};
      var ref = new URL(cfg.SUPABASE_URL).hostname.split(".")[0];
      var s = JSON.parse(localStorage.getItem("sb-" + ref + "-auth-token") || "null");
      return (s && s.user && typeof s.user.email === "string") ? s.user.email : "";
    } catch (e) { return ""; }
  }

  // ---- 6. O clique -----------------------------------------------------------------------------------
  async function confirmar(ev) {
    if (ev && ev.isTrusted === false) return;   // clique disparado por script não conta (regra 2)
    if (ocupado || !tokenHash || !T) return;
    ocupado = true;
    botao("btn-confirmar", "Conferindo o link…", true);
    botao("btn-tentar", "Conferindo o link…", true);
    texto("conf-status", "");
    try {
      var c = cliente(GRAVA_NO_CLIQUE);
      if (!c) { erroFixo("config"); return; }
      // Termina a inicialização do cliente ANTES de verificar: se houver no aparelho uma sessão vencida de
      // outra conta, a renovação dela não pode chegar depois e sobrescrever a sessão que o link abre.
      await c.auth.initialize();
      var r = await c.auth.verifyOtp({ token_hash: tokenHash, type: tipo });
      if (r && r.error) throw r.error;
      tokenHash = "";                            // consumido: nunca é reenviado
      depoisDeVerificar((r && r.data) || {});
    } catch (e) {
      falhaAoVerificar(e);
    } finally {
      ocupado = false;
      botao("btn-confirmar", T.botao, false);
    }
  }

  function falhaAoVerificar(e) {
    var tipoErro = classificar(e);
    if (tipoErro === "expirado") {
      mostrarErro("Link usado ou expirado", T.expirado, T.comoPedir, { contato: T.contato });
    } else if (tipoErro === "rede") {
      mostrarErro("Sem conexão com o servidor", "Não conseguimos confirmar agora. Confira a sua conexão com a internet e tente de novo.", "", { tentar: true });
    } else if (tipoErro === "limite") {
      mostrarErro("Muitas tentativas seguidas", "O servidor pediu uma pausa. Espere um minuto e tente de novo.", "", { tentar: true });
    } else {
      mostrarErro("Não foi possível confirmar", "Algo deu errado ao conferir o link. Tente de novo em instantes.", T.comoPedir, { tentar: true, contato: T.contato });
    }
  }

  function depoisDeVerificar(data) {
    var sessao = data.session || null;
    var usuario = (data.user && data.user.email) ? data.user : ((sessao && sessao.user) || {});
    var email = typeof usuario.email === "string" ? usuario.email : "";

    if (modo === "convite" || modo === "senha") {
      if (!sessao) {
        mostrarErro("Não foi possível abrir a sua conta", "O link foi aceito, mas a sessão não abriu.", T.refazer, { contato: T.contato });
        return;
      }
      contaDoLink = email;
      texto("senha-titulo", T.senhaTitulo);
      texto("senha-texto", T.senhaTexto);
      texto("senha-conta", email ? "Conta: " + email : "");
      mostrarEl("senha-conta", !!email);
      var u = $("senha-usuario");
      if (u) u.value = email;
      mostrarEl("senha-erro", false);
      mostrar("senha");
      var campo = $("senha-nova");
      if (campo && campo.focus) { try { campo.focus(); } catch (e) { /* idem */ } }
      return;
    }
    if (modo === "email") {
      if (!sessao) {
        mostrarOk("E-mail confirmado", "Agora entre no Civilbook com o seu e-mail e a sua senha.", { soLogin: true });
        return;
      }
      // Regra 8: a sessão JÁ está gravada. A página diz QUAL conta abriu e espera o clique: nada de pular
      // sozinha para o app com a conta de outra pessoa.
      mostrarOk(T.okTitulo, email ? "Você entrou no Civilbook como " + email + "." : "Você entrou no Civilbook.", {
        login: true,
        nota: "Não é o seu e-mail? Não abra o app: vá para o login e entre com a sua conta."
      });
      return;
    }
    // Troca de e-mail. Com a "troca segura" ligada no Supabase, o pedido vai ao endereço antigo E ao novo; o
    // primeiro clique volta sem sessão e a troca só vale depois do segundo.
    if (!sessao) {
      mostrarOk("Falta uma confirmação", "Recebemos esta confirmação. Abra também o link que enviamos para o outro endereço de e-mail: a troca só vale depois das duas.");
      return;
    }
    mostrarOk(T.okTitulo, email ? "A partir de agora, entre no Civilbook com " + email + "." : "A troca de e-mail foi confirmada.");
  }

  // ---- 7. Senha nova (convite e troca de senha) -------------------------------------------------------
  function bytes(s) {
    try { return new TextEncoder().encode(s).length; } catch (e) { return s.length; }
  }
  function erroSenha(msg) {
    texto("senha-erro", msg);
    mostrarEl("senha-erro", true);
  }
  // Os tipos que o servidor EXIGE, lidos da frase dele — corpo IDÊNTICO ao de AUTH._tiposExigidos (js/auth.js);
  // tests/acesso.check.mjs compara os dois e roda. Antes a tela pedia sempre "maiúsculas, minúsculas, números e
  // símbolos", mesmo quando o painel exigia só letras e números.
  function tiposExigidos(frase) {
    var m = String(frase || "").match(/at least one character of each:\s*([\s\S]*?)(?:\.\s+Password\b[\s\S]*|\.?\s*)$/i);
    if (!m) return "";
    var partes = m[1].split(/,\s+/), nomes = [];
    for (var i = 0; i < partes.length; i++) {
      var p = partes[i], nome;
      if (!p) continue;
      if (/^[a-z]+$/.test(p)) nome = "letras minúsculas";
      else if (/^[A-Z]+$/.test(p)) nome = "letras maiúsculas";
      else if (/^[a-zA-Z]+$/.test(p)) nome = "letras";
      else if (/^[0-9]+$/.test(p)) nome = "números";
      else nome = "símbolos";
      if (nomes.indexOf(nome) < 0) nomes.push(nome);
    }
    if (!nomes.length) return "";
    return nomes.length === 1 ? nomes[0] : nomes.slice(0, -1).join(", ") + " e " + nomes[nomes.length - 1];
  }
  // Reconhece a recusa pelo code, pelos reasons OU pela frase do servidor — o mesmo critério do AUTH._msgSenha
  // (js/auth.js); tests/acesso.check.mjs roda os dois e exige a mesma frase na tela.
  function mensagemSenha(e) {
    var c = codigo(e);
    var frase = String((e && e.message) || "");
    var curta = /password should be at least/i.test(frase), semTipos = /password should contain/i.test(frase), fraseVazada = /known to be weak/i.test(frase);
    if ((e && e.name === "AuthWeakPasswordError") || c === "weak_password" || curta || semTipos || fraseVazada) {
      var motivos = (e && Array.isArray(e.reasons)) ? e.reasons : [];
      // Os motivos vêm juntos (tamanho, tipos e vazada): a tela diz todos, com o número e os tipos da frase do servidor.
      var vazada = motivos.indexOf("pwned") >= 0 || fraseVazada;
      var exigencias = [];
      if (motivos.indexOf("length") >= 0 || curta) {
        exigencias.push("ter pelo menos " + (Number((frase.match(/at least (\d+) characters/i) || [])[1]) || SENHA_MIN) + " caracteres");
      }
      if (motivos.indexOf("characters") >= 0 || semTipos) {
        var tipos = tiposExigidos(frase);
        exigencias.push(tipos ? "ter pelo menos um caractere de cada tipo: " + tipos : "ter todos os tipos de caractere que o servidor exige");
      }
      if (exigencias.length) return "A senha precisa " + exigencias.join(" e ") + "." + (vazada ? " Ela também aparece em listas de senhas vazadas na internet: escolha outra." : "");
      if (vazada) return "Esta senha aparece em listas de senhas vazadas na internet. Escolha outra.";
      return "Esta senha é fraca demais. Use uma senha mais longa, misturando letras, números e símbolos.";
    }
    if (c === "same_password" || /should be different from the old password/i.test(frase)) return "A senha nova precisa ser diferente da senha atual.";
    if (ehRede(e)) return "Não conseguimos falar com o servidor. Confira a sua conexão e tente de novo.";
    if ((e && e.name === "AuthSessionMissingError") || c === "session_not_found" || c === "session_expired" || c === "bad_jwt" || (e && e.status === 401)) {
      return "A confirmação expirou antes de a senha ser salva. " + T.refazer;
    }
    return "Não foi possível salvar a senha agora. Tente de novo em instantes.";
  }

  async function salvarSenha(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    if (ocupado || !T) return;
    var campoA = $("senha-nova"), campoB = $("senha-confirma");
    var a = (campoA && campoA.value) || "", b = (campoB && campoB.value) || "";
    if (a.length < SENHA_MIN) { erroSenha("A senha precisa ter pelo menos " + SENHA_MIN + " caracteres."); return; }
    if (bytes(a) > SENHA_MAX_BYTES) { erroSenha("A senha é longa demais: o limite é de " + SENHA_MAX_BYTES + " bytes (letras sem acento contam 1; letras acentuadas, 2; símbolos como € e emojis, 3 ou 4)."); return; }
    if (a !== b) { erroSenha("As duas senhas não são iguais. Digite de novo."); return; }
    var c = cliente(false);                      // o mesmo cliente EM MEMÓRIA do clique (regra 8)
    if (!c) { erroFixo("config"); return; }
    ocupado = true;
    mostrarEl("senha-erro", false);
    botao("btn-salvar", "Salvando…", true);
    try {
      var r = await c.auth.updateUser({ password: a });
      if (r && r.error) throw r.error;
    } catch (e) {
      erroSenha(mensagemSenha(e));
      ocupado = false;
      botao("btn-salvar", "Salvar senha e entrar", false);
      return;
    }
    if (campoA) campoA.value = "";
    if (campoB) campoB.value = "";
    // Regra 8: só agora a sessão vai para o aparelho, entrando com a senha que acabou de ser salva (prova de
    // que ela vale). Se não der (rede, limite), a senha já está salva: a pessoa entra pelo login.
    var entrou = false;
    try {
      var p = contaDoLink ? cliente(true) : null;
      if (p) {
        await p.auth.initialize();
        var s = await p.auth.signInWithPassword({ email: contaDoLink, password: a });
        entrou = !!(s && !s.error && s.data && s.data.session);
      }
    } catch (e) { entrou = false; }
    if (entrou) mostrarOk(T.okTitulo, "Abrindo o Civilbook…", { abrirApp: true });
    else mostrarOk(T.okTitulo, "A senha nova já vale. Agora entre no Civilbook com o seu e-mail e a senha nova.", { soLogin: true });
  }

  function alternarVisibilidade() {
    var mostrarSenha = !!($("senha-mostrar") && $("senha-mostrar").checked);
    var ids = ["senha-nova", "senha-confirma"];
    for (var i = 0; i < ids.length; i++) { var el = $(ids[i]); if (el) el.type = mostrarSenha ? "text" : "password"; }
  }

  // ---- 8. Início -------------------------------------------------------------------------------------
  function iniciar() {
    // Página dentro de moldura (iframe) de outro site: não mostra botão nenhum (clickjacking). A CSP por
    // <meta> não aceita frame-ancestors, e o GitHub Pages não deixa mandar o cabeçalho.
    if (window.top !== window.self) { erroFixo("moldura"); return; }

    var b = $("btn-confirmar");
    if (b) b.addEventListener("click", confirmar);
    var t = $("btn-tentar");
    if (t) t.addEventListener("click", confirmar);
    var f = $("form-senha");
    if (f) f.addEventListener("submit", salvarSenha);
    var m = $("senha-mostrar");
    if (m) m.addEventListener("change", alternarVisibilidade);
    var ir = $("ok-ir");
    if (ir) ir.setAttribute("href", DESTINO);
    var entrar = $("erro-login");
    if (entrar) entrar.setAttribute("href", LOGIN);
    var okLogin = $("ok-login");
    if (okLogin) okLogin.setAttribute("href", LOGIN);

    if (!tokenHash && !tipo) { erroFixo("vazio"); return; }
    if (tipo && !T) { erroFixo("tipo"); return; }
    // O type fica no FIM do endereço: link cortado pelo programa de e-mail perde ele primeiro.
    if (!tipo || !TOKEN_OK.test(tokenHash)) { erroFixo("incompleto"); return; }

    texto("conf-titulo", T.titulo);
    texto("conf-texto", T.texto);
    // Regra 8: a troca de conta no aparelho não tem volta nesta página, então o aviso vem ANTES do clique. A
    // troca de e-mail não grava sessão e não troca conta nenhuma.
    var aberta = modo === "troca" ? "" : contaAberta();
    texto("conf-conta", aberta ? "Este navegador já está conectado como " + aberta + ". Se este link for de outra conta, ao concluir você sai de " + aberta + " aqui e entra na conta do link." : "");
    mostrarEl("conf-conta", !!aberta);
    botao("btn-confirmar", T.botao, false);
    mostrar("inicio");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
