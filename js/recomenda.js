// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Motor de recomendação da tela inicial (mobile) — com base nos registros de uso.
// "Mais acessados pela comunidade": função itens_populares() (contagem por módulo e ref, sem user_id). A Início só
// mostra módulo do app (MOD) e só usa o ref quando ele é item de catálogo público (_refPublico); fora disso, o cartão
// leva ao módulo (a56, 19/set/2026; o porquê está no docs/SECURITY.md, item "Recomendações").
// "Seus acessos recentes": usage_events filtrado pelo uid da sessão NA CONSULTA (a56, 19/set/2026). O RLS
// sozinho não basta: a política usage_events_select_own (0001) deixa o ADMIN ler os eventos de todos, e a
// Início do fundador mostrava o que outros usuários abriram. Travado por tests/recomenda.check.mjs.
// No-op quando o backend não está configurado ou não há sessão.
const RECO = {
  // Todo módulo do navigate() do js/app.js, menos os OCULTOS: o popular() descarta o que não está aqui (é texto que
  // alguém gravou, não módulo do app). Módulo novo no app entra aqui também — a R8 do tests/recomenda.check.mjs cobra.
  MOD: {
    assessor:     { label: "Assessor IA",   icone: "ti-sparkles" },
    projetos:     { label: "Projetos",      icone: "ti-folder" },
    calculadoras: { label: "Calculadoras", icone: "ti-calculator" },
    normas:       { label: "Normas",       icone: "ti-book" },
    sinapi:       { label: "SINAPI",        icone: "ti-receipt" },
    materiais:    { label: "Materiais",     icone: "ti-cube" },
    checklists:   { label: "Checklists",    icone: "ti-clipboard-check" },
    laudos:       { label: "Laudos",        icone: "ti-file-description" },
    avaliacao:    { label: "Avaliação de imóveis", icone: "ti-home-dollar" },
    seguranca:    { label: "Segurança do Trabalho", icone: "ti-helmet" },
    manutencao:   { label: "Manutenção",    icone: "ti-tool" },
    rdo:          { label: "Diário de Obra", icone: "ti-notebook" },
    cronograma:   { label: "Cronograma",    icone: "ti-timeline-event" },
    conferencia:  { label: "Conferência",   icone: "ti-clipboard-list" },
    interacoes:   { label: "Interações",    icone: "ti-arrows-cross" },
    tecnicas:     { label: "Ações técnicas", icone: "ti-list-details" },
    compras:      { label: "Compras",       icone: "ti-shopping-cart" },
    corpo:        { label: "Corpo técnico",  icone: "ti-users-group" }
  },
  // Módulos que NÃO entram nas listas (recentes/populares): home e a área pessoal "Minha conta".
  OCULTOS: ["home", "conta"],

  // a52 P2 (21/set/2026): os módulos cujo CATÁLOGO o resolve()/_refPublico consultam e que deixaram de vir na
  // abertura do app (js/modulos.js). Sem o catálogo, o cartão de "Seus acessos recentes" perde o título do item
  // (fica o nome do módulo) e o _refPublico devolve null — o a56 continua fechado, mas a home piora. Então o
  // render() busca o catálogo SÓ dos módulos que aparecem nas linhas: quem nunca abriu Normas não paga por ela.
  // Módulo NOVO com rótulo vindo de catálogo entra aqui junto com o ramo do resolve(); a régua M do
  // tests/abertura.check.mjs DERIVA a lista dos ramos do próprio resolve() e reprova a divergência.
  CATALOGOS_DO_ROTULO: ["normas", "tecnicas"],
  async _catalogos(linhas) {
    if (typeof MODULOS === "undefined") return;
    const querem = this.CATALOGOS_DO_ROTULO;
    const ids = [...new Set((linhas || []).map(r => r && r.module).filter(m => querem.indexOf(m) >= 0))];
    for (const id of ids) {
      if (!MODULOS.faltam(id).length) continue;
      try { await MODULOS.garantir(id); } catch (e) { /* sem catálogo: o cartão leva ao módulo */ }
    }
  },

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

  // O ref de um item da comunidade só fica quando é item de catálogo público carregado no app (a56; o porquê está no
  // docs/SECURITY.md, item "Recomendações"). Sem catálogo, o cartão leva ao módulo.
  _refPublico(module, ref) {
    if (!ref) return null;
    const tem = (lista, campo) => Array.isArray(lista) && lista.some(x => x && x[campo] === ref);
    try {
      if (module === "calculadoras") return typeof CALCULADORAS !== "undefined" && tem(CALCULADORAS, "id") ? ref : null;
      if (module === "normas") return typeof NORMAS !== "undefined" && tem(NORMAS, "codigo") ? ref : null;
      if (module === "materiais") return typeof MATERIAIS !== "undefined" && tem(MATERIAIS, "nome") ? ref : null;
      if (module === "checklists") return typeof CHECKLISTS !== "undefined" && tem(CHECKLISTS, "id") ? ref : null;
      if (module === "laudos") return typeof LAUDOS !== "undefined" && tem(LAUDOS, "id") ? ref : null;
      if (module === "tecnicas") return typeof TECNICAS !== "undefined" && tem(TECNICAS, "id") ? ref : null;
    } catch (e) { /* sem catálogo: cartão do módulo */ }
    return null;
  },

  async popular() {
    if (!CBStore.online()) return [];
    try {
      const { data, error } = await window.supa.rpc("itens_populares", { dias: 30, lim: 24 });
      if (error) throw error;
      await this._catalogos(data);   // a52 P2: idem — e é o catálogo que faz o _refPublico voltar a reconhecer o item
      const seen = new Set(), out = [];
      (data || []).forEach(r => {
        if (!r.module || this.OCULTOS.indexOf(r.module) >= 0) return;
        if (!Object.prototype.hasOwnProperty.call(this.MOD, r.module)) return;   // fora do MOD não é módulo do app
        const it = this.resolve(r.module, this._refPublico(r.module, r.ref));
        const key = it.module + "|" + it.titulo;  // colapsa variações de aba no mesmo rótulo
        if (seen.has(key)) return; seen.add(key);
        out.push(Object.assign(it, { acessos: Number(r.acessos), usuarios: Number(r.usuarios) }));
      });
      return out.slice(0, 8);
    } catch (e) { console.warn("RECO.popular:", e && e.message); return []; }
  },

  // uid = de quem são os acessos (o render passa o da sessão no início, para a lista e o cache casarem).
  async recentes(uid = CBStore.uid()) {
    if (!CBStore.online()) return [];
    if (!uid) return [];
    try {
      const { data, error } = await window.supa.from("usage_events")
        .select("module,ref,occurred_at").eq("user_id", uid).eq("event_type", "navigate")
        .order("occurred_at", { ascending: false }).limit(80);
      if (error) throw error;
      await this._catalogos(data);   // a52 P2: os catálogos do rótulo, só dos módulos que aparecem
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
  // v3 (a56): o cache v2 do admin podia guardar acessos de outros usuários; não é lido e sai na 1ª leitura.
  CACHE_TTL: 5 * 60 * 1000,
  _cacheKey(uid = CBStore.uid()) { return "cb-reco-cache:v3:" + (uid || "anon"); },
  _readCache(uid = CBStore.uid()) {
    try { localStorage.removeItem("cb-reco-cache:v2:" + (uid || "anon")); } catch (e) {}
    try {
      const raw = JSON.parse(localStorage.getItem(this._cacheKey(uid)));
      if (raw && Array.isArray(raw.rec) && Array.isArray(raw.pop) && (Date.now() - raw.ts) < this.CACHE_TTL) {
        const liga = it => Object.assign({}, it, { go: () => navigate(it.module, it.ref || undefined) });
        return { rec: raw.rec.map(liga), pop: raw.pop.map(liga) };
      }
    } catch (e) {}
    return null;
  },
  _writeCache(uid, rec, pop) {
    // Guarda só os campos serializáveis (a função go é reconstruída na leitura).
    const strip = it => ({ icone: it.icone, titulo: it.titulo, sub: it.sub, module: it.module, ref: it.ref, acessos: it.acessos, usuarios: it.usuarios });
    try { localStorage.setItem(this._cacheKey(uid), JSON.stringify({ ts: Date.now(), rec: rec.map(strip), pop: pop.map(strip) })); } catch (e) {}
  },
  bust() { try { localStorage.removeItem(this._cacheKey()); } catch (e) {} },

  async render() {
    const host = document.getElementById("reco-home");
    if (!host) return;
    if (!CBStore.online()) { host.innerHTML = ""; return; }
    const uid = CBStore.uid();
    const cache = this._readCache(uid);
    if (cache) { this._paint(host, cache.rec, cache.pop); return; }   // cache fresco: zero consulta
    host.innerHTML = (typeof UI !== "undefined") ? UI.skelRow(5) : "";
    const [rec, pop] = await Promise.all([this.recentes(uid), this.popular()]);
    if (!document.body.contains(host)) return; // usuário navegou para outra tela
    // A conta trocou no meio da consulta: o resultado não vale para ninguém. O supabase-js põe o token na hora do
    // fetch, e o token da conta nova com o filtro da anterior devolve vazio ou incompleto. Nada vai ao cache (ele
    // valeria 5 min para a conta anterior); redesenha para a atual.
    if (CBStore.uid() !== uid) return this.render();
    this._writeCache(uid, rec, pop);          // sob a chave de QUEM foi consultado
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
