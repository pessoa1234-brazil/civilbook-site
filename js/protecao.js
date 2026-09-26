// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// d13 — Proteção de conteúdo (PALIATIVOS — dissuadem, não impedem; ver docs/PROTECAO-CONTEUDO.md):
//   (a) bloqueio de seleção/cópia/menu de contexto SÓ no conteúdo sensível (opt-in, OFF por padrão —
//       puniria o PRO que paga p/ usar os modelos de laudo);
//   (b) marca d'água por usuário (e-mail + data) no conteúdo autoral — print/foto NÃO são
//       bloqueáveis no navegador; a defesa real é rastrear o vazamento;
//   (c) anti-scraping: conteúdo atrás de login (já é o caso) + robots.txt + meta noai (sempre on) +
//       rate-limiting/bot-detection no WAF (Cloudflare) — eleva o custo, não impede o determinado.
// A marca d'água é discreta, pointer-events:none e aria-hidden → não atrapalha clique nem leitor de tela.
const PROT = {
  // Módulos com conteúdo AUTORAL sensível. Ferramentas (calculadoras, sinapi, compras, normas
  // públicas) ficam de FORA p/ não atrapalhar o uso. Ajuste este conjunto conforme o produto.
  _sensiveis: { laudos: 1, tecnicas: 1, interacoes: 1, seguranca: 1 },
  _mod: null,
  _ultimoToast: 0,

  ehSensivel(m) { return !!this._sensiveis[m]; },
  _cfgWatermark() { return !(window.CB_CONFIG && window.CB_CONFIG.WATERMARK_CONTEUDO === false); }, // default ON
  _cfgCopia() { return !!(window.CB_CONFIG && window.CB_CONFIG.PROTECAO_COPIA); },                  // default OFF
  _app() { return document.getElementById("app"); },
  _email() {
    try { var s = (typeof AUTH !== "undefined" && AUTH.session) ? AUTH.session() : null; return (s && s.email) || ""; }
    catch (e) { return ""; }
  },
  _xml(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); },

  // Chamado pelo navigate() após cada render. Liga/desliga marca d'água + no-select conforme o módulo.
  aplicar(module) {
    this._mod = module;
    var sens = this.ehSensivel(module);
    this._watermark(sens && this._cfgWatermark());
    var a = this._app();
    if (a) a.classList.toggle("cb-noselect", !!(sens && this._cfgCopia()));
  },

  // Overlay fixo, tile diagonal com "Civilbook · <e-mail> · <data>". Sem usuário → sem marca.
  _watermark(ligar) {
    var el = document.getElementById("cb-wm");
    if (!ligar) { if (el) el.remove(); return; }
    var email = this._email();
    if (!email) { if (el) el.remove(); return; }
    var texto = "Civilbook · " + email + " · " + new Date().toISOString().slice(0, 10);
    if (!el) {
      el = document.createElement("div");
      el.id = "cb-wm"; el.className = "cb-wm"; el.setAttribute("aria-hidden", "true");
      document.body.appendChild(el);
    }
    if (el.dataset.txt === texto) return;   // já montado p/ este usuário/dia
    el.dataset.txt = texto;
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='460' height='260'>" +
      "<text x='24' y='146' transform='rotate(-26 230 130)' font-family='system-ui,Arial,sans-serif' " +
      "font-size='13' fill='%23808080'>" + this._xml(texto) + "</text></svg>";
    el.style.backgroundImage = "url(\"data:image/svg+xml," + encodeURIComponent(svg) + "\")";
  },

  // Dissuasor de cópia: só quando PROTECAO_COPIA on E módulo sensível E alvo dentro do #app.
  // Não atrapalha campos de formulário (busca/inputs). Toast com throttle.
  _bloquear(e) {
    if (!this._cfgCopia() || !this.ehSensivel(this._mod)) return;
    var a = this._app(), t = e.target;
    if (!a || !(t === a || a.contains(t))) return;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    e.preventDefault();
    var n = Date.now();
    if (n - this._ultimoToast > 2500 && typeof toast === "function") {
      this._ultimoToast = n;
      toast("Conteúdo protegido — © Civilbook. Uso pessoal; redistribuição proibida (ver LICENSE).", "info");
    }
  },

  init() {
    var self = this;
    ["copy", "cut", "contextmenu"].forEach(function (ev) {
      document.addEventListener(ev, function (e) { self._bloquear(e); }, true);
    });
  },
};
if (typeof window !== "undefined") { window.PROT = PROT; PROT.init(); }
