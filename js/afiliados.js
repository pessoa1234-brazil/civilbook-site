// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// d11 — Afiliados de nicho (Amazon Associados, Hotmart…). Recomendações curadas com link de
// afiliado → comissão por VENDA (rende mais que CPM em audiência pequena/segmentada).
// DESLIGADO por padrão (AFILIADOS_ATIVO=false em config.js).
//
// Decisões (ver docs/AFILIADOS.md):
//   - São CONTEÚDO editorial com DISCLOSURE (não anúncio servido) → aparecem p/ TODOS os planos
//     (diferente do AdSense/d10, que é só free). PRO não "perde" recomendação útil.
//   - Links: target=_blank + rel="sponsored nofollow noopener noreferrer" (SEO/segurança + política
//     dos programas). Disclosure obrigatório por perto (CDC/transparência + regras da Amazon).
//   - Amazon: usamos BUSCA por termo (não ASIN fixo, que apodrece); a tag carrega a comissão igual.
//   - Sem CSP: são links de saída (navegação), não embed/fetch — nada a ampliar no app.html.
const AFIL = {
  _esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); },
  ativo() { return !!(window.CB_CONFIG && window.CB_CONFIG.AFILIADOS_ATIVO); },
  _tag() { return ((window.CB_CONFIG && window.CB_CONFIG.AMAZON_TAG) || "").trim(); },
  _dominio() { return ((window.CB_CONFIG && window.CB_CONFIG.AMAZON_DOMINIO) || "amazon.com.br").trim(); },
  // URL de busca da Amazon com a tag de afiliado (sem tag, ainda é um link válido — só não rende).
  urlAmazon(termo) {
    var u = "https://www." + this._dominio() + "/s?k=" + encodeURIComponent(termo || "");
    var t = this._tag();
    if (t) u += "&tag=" + encodeURIComponent(t);
    return u;
  },
  // Resolve a URL final do item conforme o tipo. "" => omitir (ex.: curso sem hotlink ainda).
  _url(item) {
    if (!item) return "";
    if (item.tipo === "amazon") return item.termo ? this.urlAmazon(item.termo) : "";
    return (item.url || "").trim();   // hotmart/link
  },
  // Registra o clique no afiliado (analytics interno + dataLayer, se houver). Sem PII.
  _clique(contexto, i) {
    try {
      var item = ((window.AFILIADOS || {})[contexto] || [])[i] || {};
      if (typeof METRICS !== "undefined" && METRICS.event) METRICS.event("afiliado", contexto, item.titulo || item.tipo || "");
      if (window.CBEV && CBEV.track) CBEV.track("afiliado_clique", { contexto: contexto, item: item.titulo || "", rede: item.tipo || "" });
    } catch (e) {}
  },
  // Renderiza um bloco de recomendações no container (id ou nó). No-op se off ou sem itens válidos.
  // opts: { titulo, max }.
  bloco(container, contexto, opts) {
    opts = opts || {};
    var el = typeof container === "string" ? document.getElementById(container) : container;
    if (!el) return;
    if (!this.ativo()) { el.innerHTML = ""; return; }
    var lista = (window.AFILIADOS || {})[contexto] || [];
    var self = this;
    var itens = lista
      .map(function (it, idx) { return { it: it, idx: idx, url: self._url(it) }; })
      .filter(function (x) { return x.url; });
    if (opts.max) itens = itens.slice(0, opts.max);
    if (!itens.length) { el.innerHTML = ""; return; }

    var linhas = itens.map(function (x) {
      var it = x.it;
      var rede = it.tipo === "amazon" ? "Amazon" : (it.tipo === "hotmart" ? "Hotmart" : "");
      return '<a class="cb-afil-item" href="' + self._esc(x.url) + '" target="_blank" rel="sponsored nofollow noopener noreferrer"' +
        ' onclick="AFIL._clique(\'' + self._esc(contexto) + '\',' + x.idx + ')">' +
        '<span class="cb-afil-ic"><i class="ti ' + self._esc(it.icone || "ti-shopping-bag") + '" aria-hidden="true"></i></span>' +
        '<span class="cb-afil-txt"><strong>' + self._esc(it.titulo) + '</strong>' +
        (it.desc ? '<span class="cb-afil-desc">' + self._esc(it.desc) + '</span>' : "") + '</span>' +
        (rede ? '<span class="cb-afil-rede">' + rede + '</span>' : "") +
        '<i class="ti ti-external-link cb-afil-arrow" aria-hidden="true"></i></a>';
    }).join("");

    el.innerHTML =
      '<div class="cb-afil-card">' +
        '<div class="cb-afil-head"><i class="ti ti-sparkles" aria-hidden="true"></i>' +
          '<span>' + self._esc(opts.titulo || "Recomendados para a obra") + '</span></div>' +
        '<div class="cb-afil-list">' + linhas + '</div>' +
        '<p class="cb-afil-disc">Recomendações independentes. Alguns são links de afiliado — se você ' +
        'comprar por eles, o Civilbook pode receber uma comissão, sem custo adicional pra você.</p>' +
      '</div>';
  },
};
if (typeof window !== "undefined") window.AFIL = AFIL;
