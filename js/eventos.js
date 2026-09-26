// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// d7 — Mapeamento de eventos do funil (dataLayer → GTM/GA4). SEM PII (sem nome/e-mail). Empurrar
// para o dataLayer é seguro pré-consentimento: é só um array JS; o GA4 só ENVIA com cookies após o
// aceite (Consent Mode, d6). Eventos cobertos:
//   page_view  — automático no GA4 (enhanced measurement) na landing;
//   scroll     — 50% e 90% (engajamento/rejeição), uma vez cada;
//   cta_click  — intenção (qualquer [data-cta] ou âncora p/ #orcamento; + abrirAuth no index.html);
//   generate_lead / sign_up — conversão (disparados nos handlers do index.html);
//   app_install / first_open — PWA (CAC real).
// Carregado na landing (index.html) após o tracking.js.
(function () {
  window.dataLayer = window.dataLayer || [];
  function track(event, params) {
    // d8 — anexa a atribuição first-touch (utm_*) já capturada (cbAttrib/e5) a cada evento, para
    // o GA4/GTM saber qual canal e campanha converte. Só inclui os utm presentes (sem PII).
    var attr = {};
    try {
      var a = (typeof window.cbAttrib === "function") ? window.cbAttrib() : {};
      ["utm_source", "utm_medium", "utm_campaign"].forEach(function (k) { if (a[k]) attr[k] = a[k]; });
    } catch (e) {}
    try { window.dataLayer.push(Object.assign({ event: event }, attr, params || {})); } catch (e) {}
  }
  window.CBEV = { track: track };

  function iniciar() {
    // cta_click — delegado: [data-cta] explícito ou âncora para #orcamento (sem editar cada botão).
    document.addEventListener("click", function (e) {
      var el = e.target.closest && e.target.closest("[data-cta], a[href=\"#orcamento\"]");
      if (el) track("cta_click", { cta: el.getAttribute("data-cta") || "orcamento" });
    });

    // scroll 50% e 90% (uma vez cada).
    var marcos = { 50: false, 90: false };
    function onScroll() {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      if (max <= 0) return;
      var pct = (window.scrollY || h.scrollTop || 0) / max * 100;
      [50, 90].forEach(function (m) { if (!marcos[m] && pct >= m) { marcos[m] = true; track("scroll", { percent: m }); } });
      if (marcos[50] && marcos[90]) window.removeEventListener("scroll", onScroll);
    }
    window.addEventListener("scroll", onScroll, { passive: true });

    // PWA: app_install (evento nativo) e first_open (1ª vez neste dispositivo → CAC).
    window.addEventListener("appinstalled", function () { track("app_install"); });
    try {
      if (!localStorage.getItem("cb-first-open")) { localStorage.setItem("cb-first-open", "1"); track("first_open"); }
    } catch (e) {}
  }

  if (document.body) iniciar();
  else document.addEventListener("DOMContentLoaded", iniciar);
})();
