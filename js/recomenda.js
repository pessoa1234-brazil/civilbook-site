// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Motor de recomendação da tela inicial (mobile) — com base nos registros de uso.
// "Mais acessados pela comunidade": função itens_populares() (agregados anônimos).
// "Seus acessos recentes": usage_events do próprio usuário (filtrado pelo RLS).
// No-op quando o backend não está configurado ou não há sessão.
const RECO = {
  MOD: {
    calculadoras: { label: "Calculadoras", icone: "ti-calculator" },
    normas:       { label: "Normas",       icone: "ti-book" },
    sinapi:       { label: "SINAPI",        icone: "ti-receipt" },
    materiais:    { label: "Materiais",     icone: "ti-cube" },
    checklists:   { label: "Checklists",    icone: "ti-clipboard-check" },
    laudos:       { label: "Laudos",        icone: "ti-file-description" },
    manutencao:   { label: "Manutenção",    icone: "ti-tool" },
    conferencia:  { label: "Conferência",   icone: "ti-clipboard-list" },
    interacoes:   { label: "Interações",    icone: "ti-arrows-cross" },
    tecnicas:     { label: "Ações técnicas", icone: "ti-list-details" },
    compras:      { label: "Compras",       icone: "ti-shopping-cart" },
    corpo:        { label: "Corpo técnico",  icone: "ti-users-group" }
  },
  // Módulos que NÃO entram nas listas (recentes/populares): home e a área pessoal "Minha conta".
  OCULTOS: ["home", "conta"],

  // Resolve (module, ref) -> rótulo legível + navegação, usando os bancos de dados já carregados.
  resolve(module, ref) {
    const m = this.MOD[module] || { label: module, icone: "ti-app-window" };
    let titulo = m.label, sub = m.label;
    try {
      if (module === "calculadoras" && ref && typeof CALCULADORAS !== "undefined") {
        const c = CALCULADORAS.find(x => x.id === ref); if (c) { titulo = c.titulo; sub = "Calculadora"; }
      } else if (module === "normas" && ref) {
        titulo = ref; const n = (typeof NORMAS !== "undefined") && NORMAS.find(x => x.codigo === ref); sub = n ? n.titulo : "Norma ABNT";
      } else if (module === "materiais" && ref) {
        titulo = ref; sub = "Ficha de material";
      } else if (module === "checklists" && ref && typeof CHECKLISTS !== "undefined") {
        const c = CHECKLISTS.find(x => x.id === ref); if (c) { titulo = c.titulo; sub = "Checklist"; }
      } else if (module === "laudos" && ref && typeof LAUDOS !== "undefined") {
        const l = LAUDOS.find(x => x.id === ref); if (l) { titulo = l.titulo; sub = "Modelo de laudo"; }
      } else if (module === "tecnicas" && ref && typeof TECNICAS !== "undefined") {
        const t = TECNICAS.find(x => x.id === ref); if (t) { titulo = t.titulo; sub = "Ação técnica"; }
      }
    } catch (e) { /* mantém o rótulo do módulo */ }
    return { icone: m.icone, titulo, sub, module, ref: ref || null, go: () => navigate(module, ref || undefined) };
  },

  async popular() {
    if (!CBStore.online()) return [];
    try {
      const { data, error } = await window.supa.rpc("itens_populares", { dias: 30, lim: 24 });
      if (error) throw error;
      const seen = new Set(), out = [];
      (data || []).forEach(r => {
        if (!r.module || this.OCULTOS.indexOf(r.module) >= 0) return;
        const it = this.resolve(r.module, r.ref);
        const key = it.module + "|" + it.titulo;  // colapsa variações de aba no mesmo rótulo
        if (seen.has(key)) return; seen.add(key);
        out.push(Object.assign(it, { acessos: Number(r.acessos), usuarios: Number(r.usuarios) }));
      });
      return out.slice(0, 8);
    } catch (e) { console.warn("RECO.popular:", e && e.message); return []; }
  },

  async recentes() {
    if (!CBStore.online()) return [];
    try {
      const { data, error } = await window.supa.from("usage_events")
        .select("module,ref,occurred_at").eq("event_type", "navigate")
        .order("occurred_at", { ascending: false }).limit(80);
      if (error) throw error;
      const seen = new Set(), out = [];
      (data || []).forEach(r => {
        if (!r.module || this.OCULTOS.indexOf(r.module) >= 0) return;
        const it = this.resolve(r.module, r.ref);
        const key = it.module + "|" + it.titulo;
        if (seen.has(key)) return; seen.add(key);
        out.push(it);
      });
      return out.slice(0, 8);
    } catch (e) { console.warn("RECO.recentes:", e && e.message); return []; }
  },

  // Cache TTL 5 min (localStorage, por usuário): evita refazer as 2 consultas
  // (recentes + RPC popular) a cada volta à home dentro da janela.
  CACHE_TTL: 5 * 60 * 1000,
  _cacheKey() { return "cb-reco-cache:v2:" + (CBStore.uid() || "anon"); },
  _readCache() {
    try {
      const raw = JSON.parse(localStorage.getItem(this._cacheKey()));
      if (raw && Array.isArray(raw.rec) && Array.isArray(raw.pop) && (Date.now() - raw.ts) < this.CACHE_TTL) {
        const liga = it => Object.assign({}, it, { go: () => navigate(it.module, it.ref || undefined) });
        return { rec: raw.rec.map(liga), pop: raw.pop.map(liga) };
      }
    } catch (e) {}
    return null;
  },
  _writeCache(rec, pop) {
    // Guarda só os campos serializáveis (a função go é reconstruída na leitura).
    const strip = it => ({ icone: it.icone, titulo: it.titulo, sub: it.sub, module: it.module, ref: it.ref, acessos: it.acessos, usuarios: it.usuarios });
    try { localStorage.setItem(this._cacheKey(), JSON.stringify({ ts: Date.now(), rec: rec.map(strip), pop: pop.map(strip) })); } catch (e) {}
  },
  bust() { try { localStorage.removeItem(this._cacheKey()); } catch (e) {} },

  async render() {
    const host = document.getElementById("reco-home");
    if (!host) return;
    if (!CBStore.online()) { host.innerHTML = ""; return; }
    const cache = this._readCache();
    if (cache) { this._paint(host, cache.rec, cache.pop); return; }   // cache fresco: zero consulta
    host.innerHTML = (typeof UI !== "undefined") ? UI.skelRow(5) : "";
    const [rec, pop] = await Promise.all([this.recentes(), this.popular()]);
    if (!document.body.contains(host)) return; // usuário navegou para outra tela
    this._writeCache(rec, pop);
    this._paint(host, rec, pop);
  },

  _paint(host, rec, pop) {
    let html = "";
    if (rec.length) html += this._sec("Seus acessos recentes", "ti-history", rec, false);
    if (pop.length) html += this._sec("Mais acessados pela comunidade", "ti-flame", pop, true);
    host.innerHTML = html;
    // Liga os cliques às funções de navegação resolvidas (sem inline, evita escapar refs).
    host.querySelectorAll("[data-reco-i]").forEach(el => {
      const it = (el.dataset.recoList === "pop" ? pop : rec)[+el.dataset.recoI];
      if (it) el.addEventListener("click", it.go);
    });
  },

  _sec(titulo, icone, itens, isPop) {
    return `<div class="reco-sec">
      <h3 class="reco-h"><i class="ti ${icone}"></i>${titulo}</h3>
      <div class="reco-row">
        ${itens.map((it, i) => `
          <div class="reco-card clickable" data-reco-list="${isPop ? "pop" : "rec"}" data-reco-i="${i}" role="button" tabindex="0">
            <div class="reco-ic"><i class="ti ${it.icone}"></i></div>
            <div class="reco-tt">${esc(it.titulo)}</div>
            <div class="reco-sb">${esc(it.sub)}</div>
            ${isPop ? `<div class="reco-badge"><i class="ti ti-users"></i> ${it.acessos} acesso${it.acessos === 1 ? "" : "s"}</div>` : ""}
          </div>`).join("")}
      </div>
    </div>`;
  }
};
