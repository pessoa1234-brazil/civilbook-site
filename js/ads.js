// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// d10 — Monetização por anúncios (Google AdSense). DESLIGADO até ADSENSE_CLIENT + ADS_ATIVO
// (config.js) e a CSP do app.html ampliada (ver docs/ADS.md). Regras:
//   - NUNCA para assinantes PRO (não veem anúncios — é argumento de upgrade);
//   - só no app (a landing fica sem anúncios, p/ não competir com a conversão);
//   - in-content (converte mais) + âncora no rodapé mobile (config no dashboard do AdSense);
//     nada nas laterais, sem encher de banner (protege UX e SEO);
//   - LGPD: respeita o Consent Mode v2 (consent.js/d9) — sem aceite, o AdSense serve anúncios
//     NÃO personalizados; no aceite, personaliza. Integração automática (nada a fazer aqui).
const ADS = {
  _loaded: false,
  client() { return ((window.CB_CONFIG && window.CB_CONFIG.ADSENSE_CLIENT) || "").trim(); },
  ehPro() {
    try {
      if (typeof planoEhPro === "function") return planoEhPro();
      return !!(typeof AUTH !== "undefined" && AUTH.session && AUTH.session() && AUTH.session().plano === "pro");
    } catch (e) { return false; }
  },
  // Anúncios ativos? flag + client configurado + NÃO é PRO.
  ativo() {
    var C = window.CB_CONFIG || {};
    return !!(C.ADS_ATIVO && this.client() && !this.ehPro());
  },
  _carregar() {
    if (this._loaded) return; this._loaded = true;
    var s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(this.client());
    document.head.appendChild(s);
  },
  // Carrega a stack (habilita a âncora/Auto ads p/ free users). Chamar uma vez no init do app.
  iniciar() { if (this.ativo()) this._carregar(); },
  // Insere um bloco in-content responsivo no container (id ou nó) — só p/ free users.
  slot(container) {
    if (!this.ativo()) return;
    var el = typeof container === "string" ? document.getElementById(container) : container;
    if (!el || el.querySelector(".adsbygoogle")) return;   // não duplica
    this._carregar();
    var ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.setAttribute("data-ad-client", this.client());
    var slotId = ((window.CB_CONFIG && window.CB_CONFIG.ADSENSE_SLOT_INCONTENT) || "").trim();
    if (slotId) ins.setAttribute("data-ad-slot", slotId);
    ins.setAttribute("data-ad-format", "auto");
    ins.setAttribute("data-full-width-responsive", "true");
    el.appendChild(ins);
    el.insertAdjacentHTML("beforeend", '<p class="cb-ad-upsell">Anúncios mantêm o Civilbook gratuito — o plano PRO remove os anúncios.</p>');
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
  },
  // d11 — anúncio NATIVO (integra ao layout; CTR maior, menos "cara de banner"). Mesmo client/CSP
  // do AdSense, mesmas regras (só free, consent). tipo: "in-article" (padrão) ou "in-feed".
  slotNativo(container, opts) {
    if (!this.ativo()) return;
    var el = typeof container === "string" ? document.getElementById(container) : container;
    if (!el || el.querySelector(".adsbygoogle")) return;   // não duplica
    var C = window.CB_CONFIG || {};
    var slotId = (C.ADSENSE_SLOT_NATIVE || "").trim();
    if (!slotId) return;   // sem unidade nativa configurada → não renderiza
    this._carregar();
    var tipo = (opts && opts.tipo) || "in-article";
    var ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.style.textAlign = "center";
    ins.setAttribute("data-ad-client", this.client());
    ins.setAttribute("data-ad-slot", slotId);
    ins.setAttribute("data-ad-format", "fluid");   // nativo = fluid
    if (tipo === "in-feed") {
      var key = (C.ADSENSE_LAYOUT_KEY || "").trim();
      if (key) ins.setAttribute("data-ad-layout-key", key);
    } else {
      ins.setAttribute("data-ad-layout", "in-article");
    }
    el.appendChild(ins);
    el.insertAdjacentHTML("beforeend", '<p class="cb-ad-upsell">Anúncio — o plano PRO remove os anúncios.</p>');
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
  },
};
if (typeof window !== "undefined") window.ADS = ADS;
