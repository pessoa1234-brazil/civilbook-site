// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// d6 — Stack de rastreamento de marketing. Carrega os trackers conforme os IDs em config.js
// (todos vazios = DESLIGADO). Recomendado: usar só o GTM (container único) e configurar GA4 +
// Pixels dentro dele. Sem GTM, carrega GA4/Meta/TikTok direto. Integra com o consentimento
// (consent.js / d9):
//   - GA4/Google respeitam o Consent Mode v2 (já definido como NEGADO por padrão).
//   - Meta Pixel e TikTok NÃO respeitam o Consent Mode → só carregam APÓS o aceite (LGPD),
//     ouvindo o evento `cb-consent` (ou o estado já salvo).
// Carregado depois do consent.js, na landing (index.html). Para rastrear também o app, incluir
// este script + os domínios na CSP do app.html (ver docs/RASTREAMENTO.md).
(function () {
  var C = window.CB_CONFIG || {};
  var GTM = (C.GTM_ID || "").trim();
  var GA4 = (C.GA4_ID || "").trim();
  var META = (C.META_PIXEL_ID || "").trim();
  var TT = (C.TIKTOK_PIXEL_ID || "").trim();
  if (!GTM && !GA4 && !META && !TT) return;   // nada configurado → não faz nada

  window.dataLayer = window.dataLayer || [];
  var gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  // ---- GTM: container único (preferido). GA4/Meta/TikTok ficam DENTRO do GTM, com gatilhos
  // de consentimento configurados lá (ver docs/RASTREAMENTO.md). ----
  if (GTM) {
    (function (w, d, s, l, i) {
      w[l] = w[l] || []; w[l].push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
      var f = d.getElementsByTagName(s)[0], j = d.createElement(s);
      j.async = true; j.src = "https://www.googletagmanager.com/gtm.js?id=" + i;
      f.parentNode.insertBefore(j, f);
    })(window, document, "script", "dataLayer", GTM);
    return; // com GTM, o resto (incl. consentimento dos pixels) é configurado no container
  }

  // ---- Sem GTM: carrega direto ----
  // GA4 — respeita o Consent Mode (consent.js já definiu default negado; vira granted no aceite).
  if (GA4) {
    var g = document.createElement("script");
    g.async = true; g.src = "https://www.googletagmanager.com/gtag/js?id=" + GA4;
    document.head.appendChild(g);
    gtag("js", new Date());
    gtag("config", GA4, { anonymize_ip: true });
  }

  // Meta Pixel + TikTok — NÃO respeitam o Consent Mode → só APÓS o aceite (LGPD).
  var carregados = false;
  function carregarPixels() {
    if (carregados) return; carregados = true;
    if (META) {
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      window.fbq("init", META); window.fbq("track", "PageView");
    }
    if (TT) {
      !function (w, d, t) { w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || []; ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"]; ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } }; for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]); ttq.instance = function (t) { for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]); return e }; ttq.load = function (e, n) { var r = "https://analytics.tiktok.com/i18n/pixel/events.js"; ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = r; ttq._t = ttq._t || {}; ttq._t[e] = +new Date; ttq._o = ttq._o || {}; ttq._o[e] = n || {}; var o = d.createElement("script"); o.type = "text/javascript"; o.async = !0; o.src = r + "?sdkid=" + e + "&lib=" + t; var a = d.getElementsByTagName("script")[0]; a.parentNode.insertBefore(o, a) }; ttq.load(TT); ttq.page() }(window, document, "ttq");
    }
  }
  function consentido() { try { return window.cbCookies && window.cbCookies.estado() === "accepted"; } catch (e) { return false; } }
  if (META || TT) {
    if (consentido()) carregarPixels();   // visitante que já aceitou
    document.addEventListener("cb-consent", function (e) { if (e && e.detail && e.detail.aceito) carregarPixels(); });
  }
})();
