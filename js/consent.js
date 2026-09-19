// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Consentimento de cookies (LGPD) + Google Consent Mode v2.
// Define dataLayer/gtag cedo e o estado DEFAULT = negado (análise/marketing) ANTES de qualquer
// tag — GA4/GTM/Pixels (Fase D, d6–d8) só passam a gravar/medir após o aceite. Cookies essenciais
// (login, preferências) são sempre permitidos. Decisão persiste em localStorage; reabrível pelo
// rodapé ("Gerenciar cookies"). Carregado cedo em index.html e app.html.
(function () {
  var KEY = "cb-consent";
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") window.gtag = function () { window.dataLayer.push(arguments); };

  function ler() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function salvar(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  // Consent Mode v2 — nega tudo que é análise/anúncio até a decisão; essenciais liberados.
  window.gtag("consent", "default", {
    ad_storage: "denied",
    analytics_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    functionality_storage: "granted",
    security_storage: "granted",
    wait_for_update: 500
  });

  function aplicar(concedido) {
    window.gtag("consent", "update", {
      ad_storage: concedido ? "granted" : "denied",
      analytics_storage: concedido ? "granted" : "denied",
      ad_user_data: concedido ? "granted" : "denied",
      ad_personalization: concedido ? "granted" : "denied"
    });
    window.gtag("event", "consent_decision", { decisao: concedido ? "aceito" : "recusado" });
    // Sinaliza para quem precisa reagir ao consentimento (ex.: pixels Meta/TikTok da d6, que não
    // respeitam o Consent Mode do Google e só podem carregar após o aceite).
    try { document.dispatchEvent(new CustomEvent("cb-consent", { detail: { aceito: !!concedido } })); } catch (e) {}
  }

  var inicial = ler();
  if (inicial === "accepted") aplicar(true);   // reaplica em visitas seguintes (default era denied)
  // 'rejected' mantém o default negado; null → mostra o banner

  function fechar() { var b = document.getElementById("cb-cookie"); if (b) b.remove(); }
  function decidir(v) { salvar(v); aplicar(v === "accepted"); fechar(); }

  function banner() {
    if (document.getElementById("cb-cookie")) return;
    var el = document.createElement("div");
    el.id = "cb-cookie";
    el.className = "cb-cookie";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Consentimento de cookies");
    el.innerHTML =
      '<div class="cb-cookie-txt">Usamos cookies essenciais para o funcionamento e, com seu aceite, ' +
      'cookies de <strong>análise e marketing</strong> para melhorar a plataforma. Você pode recusar ' +
      'sem prejuízo de uso. <a href="privacidade.html" target="_blank" rel="noopener">Política de Privacidade</a>.</div>' +
      '<div class="cb-cookie-acoes">' +
      '<button type="button" class="btn" id="cb-cookie-rej">Recusar</button>' +
      '<button type="button" class="btn primary" id="cb-cookie-acc">Aceitar</button>' +
      '</div>';
    (document.body || document.documentElement).appendChild(el);
    el.querySelector("#cb-cookie-acc").onclick = function () { decidir("accepted"); };
    el.querySelector("#cb-cookie-rej").onclick = function () { decidir("rejected"); };
  }

  function quandoPronto(fn) {
    if (document.body) fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  if (!inicial) quandoPronto(banner);

  // API pública: reabrir/gerenciar pelo rodapé.
  window.cbCookies = {
    abrir: function () { quandoPronto(banner); },
    estado: ler,
    redefinir: function () { try { localStorage.removeItem(KEY); } catch (e) {} quandoPronto(banner); }
  };
})();
