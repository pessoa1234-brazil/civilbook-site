// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// e6 — Visualizador PDF.js in-app (citações ancoradas): abre o PDF-fonte no ponto exato
// (deep-link #page=N) com navegação e destaque best-effort do trecho citado. A lib do PDF.js
// é carregada SOB DEMANDA (só ao abrir um PDF) do CDN; o worker é fixado na MESMA versão
// resolvida (evita mismatch). O PDF vem por URL assinada do bucket PRIVADO (BIBLIO.urlAssinada).
// CSP: precisa de worker-src p/ o worker do PDF.js (ver app.html / docs/BIBLIOTECA.md).
const PDFV = {
  _libP: null,
  _doc: null,
  _pagina: 1,
  _total: 0,
  _trecho: "",

  _carregarLib() {
    if (this._libP) return this._libP;
    this._libP = import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.min.mjs")
      .then(function (m) {
        var lib = m && m.getDocument ? m : (m.default || m);
        try { lib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@" + (lib.version || "4") + "/build/pdf.worker.min.mjs"; } catch (e) {}
        return lib;
      });
    return this._libP;
  },

  fechar() { document.querySelectorAll(".cb-pdf-ov").forEach(function (o) { o.remove(); }); this._doc = null; },

  // opts: { url? , data? (Uint8Array), pagina, trecho, titulo }
  async abrir(opts) {
    opts = opts || {};
    this._trecho = (opts.trecho || "").trim();
    this.fechar();
    var ov = document.createElement("div");
    ov.className = "cb-modal-ov cb-pdf-ov";
    ov.onclick = function (e) { if (e.target === ov) PDFV.fechar(); };
    ov.innerHTML =
      '<div class="card cb-modal-box cb-pdf-box" role="dialog" aria-modal="true" aria-label="Visualizador de PDF">' +
        '<div class="cb-pdf-bar">' +
          '<div class="cb-pdf-titulo">' + this._esc(opts.titulo || "Documento") + '</div>' +
          '<div class="cb-pdf-nav">' +
            '<button class="btn icon-only" id="pdf-prev" aria-label="Página anterior"><i class="ti ti-chevron-left"></i></button>' +
            '<span id="pdf-pag" class="cb-pdf-pag">—</span>' +
            '<button class="btn icon-only" id="pdf-next" aria-label="Próxima página"><i class="ti ti-chevron-right"></i></button>' +
            '<button class="btn icon-only" aria-label="Fechar" onclick="PDFV.fechar()"><i class="ti ti-x"></i></button>' +
          '</div>' +
        '</div>' +
        (this._trecho ? '<div class="cb-pdf-trecho"><i class="ti ti-quote" aria-hidden="true"></i> ' + this._esc(this._trecho) + '</div>' : '') +
        '<div class="cb-pdf-vis" id="pdf-vis"><p class="page-sub" style="padding:24px">Carregando o documento…</p></div>' +
      '</div>';
    document.body.appendChild(ov);
    document.getElementById("pdf-prev").onclick = function () { PDFV.irPara(PDFV._pagina - 1); };
    document.getElementById("pdf-next").onclick = function () { PDFV.irPara(PDFV._pagina + 1); };

    try {
      var lib = await this._carregarLib();
      var tarefa = lib.getDocument(opts.data ? { data: opts.data } : { url: opts.url });
      this._doc = await tarefa.promise;
      this._total = this._doc.numPages;
      this._pagina = Math.min(Math.max(parseInt(opts.pagina, 10) || 1, 1), this._total);
      await this._render();
    } catch (e) {
      var vis = document.getElementById("pdf-vis");
      if (vis) vis.innerHTML = '<p class="page-sub" style="padding:24px;color:var(--coral)">Não foi possível abrir o PDF: ' + this._esc(String(e && e.message || e)) + '</p>';
    }
  },

  async irPara(n) {
    if (!this._doc) return;
    n = Math.min(Math.max(n, 1), this._total);
    if (n === this._pagina && document.querySelector("#pdf-vis canvas")) return;
    this._pagina = n;
    await this._render();
  },

  async _render() {
    var vis = document.getElementById("pdf-vis"); if (!vis) return;
    var pag = document.getElementById("pdf-pag"); if (pag) pag.textContent = this._pagina + " / " + this._total;
    var page = await this._doc.getPage(this._pagina);
    var larguraAlvo = Math.min(vis.clientWidth || 800, 900) - 8;
    var v1 = page.getViewport({ scale: 1 });
    var escala = Math.max(0.3, larguraAlvo / v1.width);
    var viewport = page.getViewport({ scale: escala });
    var canvas = document.createElement("canvas");
    canvas.className = "cb-pdf-canvas";
    canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height);
    var ctx = canvas.getContext("2d");
    vis.innerHTML = ""; vis.appendChild(canvas);
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    if (this._trecho) { try { await this._destacar(page, viewport, vis, canvas); } catch (e) { /* destaque é best-effort */ } }
  },

  // Destaque best-effort: procura o trecho no texto da página e desenha um retângulo sobre o
  // item de texto que o contém. Nunca quebra o visualizador (try/catch no chamador).
  async _destacar(page, viewport, vis, canvas) {
    var alvo = this._norm(this._trecho).slice(0, 40);
    if (!alvo) return;
    var tc = await page.getTextContent();
    for (var i = 0; i < tc.items.length; i++) {
      var it = tc.items[i];
      if (!it.str || this._norm(it.str).indexOf(alvo.slice(0, Math.min(alvo.length, 18))) < 0) continue;
      var tx = it.transform;   // [a,b,c,d,e,f]
      var x = tx[4], y = tx[5], h = Math.hypot(tx[2], tx[3]) || it.height || 10, w = it.width || (it.str.length * h * 0.5);
      var p1 = viewport.convertToViewportPoint(x, y);
      var hl = document.createElement("div");
      hl.className = "cb-pdf-hl";
      hl.style.left = (canvas.offsetLeft + p1[0]) + "px";
      hl.style.top = (canvas.offsetTop + p1[1] - h * (viewport.scale)) + "px";
      hl.style.width = (w * viewport.scale) + "px";
      hl.style.height = (h * viewport.scale * 1.3) + "px";
      vis.appendChild(hl);
      hl.scrollIntoView({ block: "center" });
      break;
    }
  },

  _norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); },
  _esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
};
if (typeof window !== "undefined") window.PDFV = PDFV;
