// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// d3 — Referências bibliográficas. Busca metadados por DOI na API pública do CrossRef
// (https://api.crossref.org — sem chave, com CORS) e formata a citação em ABNT NBR 6023
// (aproximado). Reutilizável: REF.montar(container, {key}) injeta a ferramenta (campo DOI +
// lista persistida em localStorage + copiar). Zotero/Mendeley exigem chave/OAuth por usuário
// e ficam para depois — comparativo em docs/REFERENCIAS.md.
const REF = {
  CROSSREF: "https://api.crossref.org/works/",

  // Aceita "10.x/y", "doi:10...", "https://doi.org/10...".
  limparDOI(s) {
    return String(s || "").trim()
      .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
      .replace(/^doi:\s*/i, "")
      .trim();
  },

  async buscarDOI(doi) {
    const d = this.limparDOI(doi);
    if (!/^10\.\d{4,9}\/\S+$/.test(d)) throw new Error("DOI inválido. Ex.: 10.1590/abc123");
    const r = await fetch(this.CROSSREF + encodeURIComponent(d), { headers: { Accept: "application/json" } });
    if (r.status === 404) throw new Error("DOI não encontrado no CrossRef.");
    if (!r.ok) throw new Error("Falha ao consultar o CrossRef (HTTP " + r.status + ").");
    const j = await r.json();
    return this._normalizar(j.message || {});
  },

  // Busca por título/assunto em base acadêmica (OpenAlex: aberto, sem chave, com CORS, indexa
  // SciELO e a maioria dos periódicos). Devolve resultados já normalizados (mesmo formato do DOI).
  async buscar(query) {
    const q = String(query || "").trim();
    if (q.length < 3) throw new Error("Digite ao menos 3 caracteres.");
    const sel = "display_name,authorships,publication_year,primary_location,doi,biblio,type,open_access";
    const url = "https://api.openalex.org/works?per-page=8&search=" + encodeURIComponent(q) + "&select=" + sel;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("Falha ao consultar o OpenAlex (HTTP " + r.status + ").");
    const j = await r.json();
    return (j.results || []).map(w => this._normalizarOpenAlex(w));
  },

  _normalizarOpenAlex(w) {
    const autores = (w.authorships || []).map(a => {
      const nome = ((a.author && a.author.display_name) || "").trim();
      const p = nome.split(/\s+/);
      return { sobrenome: p.length > 1 ? p[p.length - 1] : nome, nome: p.length > 1 ? p.slice(0, -1).join(" ") : "" };
    }).filter(a => a.sobrenome);
    const src = (w.primary_location && w.primary_location.source) || {};
    const b = w.biblio || {};
    const pgs = b.first_page ? (b.last_page ? b.first_page + "-" + b.last_page : b.first_page) : "";
    return {
      tipo: w.type || "", autores, titulo: w.display_name || "",
      container: src.display_name || "", editora: "",
      volume: b.volume || "", numero: b.issue || "", paginas: pgs,
      ano: w.publication_year || "",
      doi: (w.doi || "").replace(/^https?:\/\/(dx\.)?doi\.org\//i, ""),
      oa: !!(w.open_access && w.open_access.is_oa),
    };
  },

  _normalizar(m) {
    const autores = (m.author || []).map(a => ({
      sobrenome: (a.family || "").trim(),
      nome: (a.given || "").trim(),
    })).filter(a => a.sobrenome);
    const issued = (m.issued && m.issued["date-parts"] && m.issued["date-parts"][0]) || [];
    return {
      tipo: m.type || "",
      autores,
      titulo: (m.title && m.title[0]) || "",
      container: (m["container-title"] && m["container-title"][0]) || "",
      editora: m.publisher || "",
      volume: m.volume || "",
      numero: m.issue || "",
      paginas: m.page || "",
      ano: issued[0] || "",
      doi: m.DOI || "",
    };
  },

  // "SOBRENOME, Iniciais." (ex.: "SILVA, J. A.")
  _autorABNT(a) {
    const iniciais = a.nome.split(/\s+/).filter(Boolean).map(p => p[0].toUpperCase() + ".").join(" ");
    return a.sobrenome.toUpperCase() + (iniciais ? ", " + iniciais : "");
  },

  // Citação ABNT NBR 6023 (aproximada). Periódico/obra destacado em <strong>.
  abnt(meta) {
    const aut = meta.autores.length ? meta.autores.map(a => this._autorABNT(a)).join("; ") : "[AUTOR NÃO INFORMADO]";
    const livro = /book|monograph/i.test(meta.tipo);
    let s = aut + (/\.$/.test(aut) ? " " : ". ");   // evita ponto duplo quando termina em inicial "X."
    if (livro) {
      s += "<strong>" + (meta.titulo || "[título]") + "</strong>. ";
      if (meta.editora) s += meta.editora + ", ";
      s += (meta.ano || "[s.d.]") + ".";
    } else {
      s += (meta.titulo || "[título]") + ". ";
      if (meta.container) s += "<strong>" + meta.container + "</strong>, ";
      if (meta.volume) s += "v. " + meta.volume + ", ";
      if (meta.numero) s += "n. " + meta.numero + ", ";
      if (meta.paginas) s += "p. " + meta.paginas + ", ";
      s += (meta.ano || "[s.d.]") + ".";
    }
    if (meta.doi) s += " DOI: " + meta.doi + ".";
    return s;
  },

  // Citação no texto (NBR 10520): (SOBRENOME, ano) / (SOBRENOME; SOBRENOME, ano) / (SOBRENOME et al., ano).
  abntTexto(meta) {
    const nomes = meta.autores.map(a => a.sobrenome.toUpperCase());
    const base = nomes.length > 3 ? nomes[0] + " et al." : nomes.join("; ");
    return "(" + (base || "AUTOR") + ", " + (meta.ano || "s.d.") + ")";
  },

  // Texto puro (sem HTML) para a área de transferência.
  texto(meta) { return this.abnt(meta).replace(/<[^>]+>/g, ""); },

  _esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); },
  _msg(elMsg, txt, cls) { elMsg.textContent = txt; elMsg.className = "ref-msg" + (cls ? " " + cls : ""); },

  // Injeta a ferramenta no elemento `container` (id ou nó). opts.key = chave do localStorage
  // (para persistir a lista por laudo/material).
  montar(container, opts) {
    opts = opts || {};
    const el = typeof container === "string" ? document.getElementById(container) : container;
    if (!el) return;
    const LS = "cb-ref-" + (opts.key || "geral");
    const ler = () => { try { return JSON.parse(localStorage.getItem(LS)) || []; } catch (e) { return []; } };
    const salvar = arr => { try { localStorage.setItem(LS, JSON.stringify(arr)); } catch (e) {} };
    let lista = ler();

    el.innerHTML = `
      <div class="ref-row">
        <input type="text" id="ref-busca" placeholder="Buscar por título ou assunto (OpenAlex)…" aria-label="Buscar referência por título ou assunto" autocomplete="off">
        <button class="btn primary" id="ref-buscar"><i class="ti ti-search"></i>Buscar</button>
      </div>
      <div id="ref-resultados" class="ref-resultados"></div>
      <div class="ref-ou">— ou adicione direto por DOI —</div>
      <div class="ref-row">
        <input type="text" id="ref-doi" placeholder="Cole um DOI (ex.: 10.1590/…)" aria-label="DOI da referência" autocomplete="off">
        <button class="btn" id="ref-add"><i class="ti ti-plus"></i>Adicionar</button>
      </div>
      <p id="ref-msg" class="ref-msg" role="status" aria-live="polite"></p>
      <ol id="ref-lista" class="ref-lista"></ol>
      <div id="ref-acoes" class="ref-acoes" style="display:none">
        <button class="btn" id="ref-copiar"><i class="ti ti-copy"></i>Copiar referências</button>
        <button class="btn" id="ref-limpar"><i class="ti ti-trash"></i>Limpar</button>
      </div>`;

    const input = el.querySelector("#ref-doi");
    const msg = el.querySelector("#ref-msg");
    const listaEl = el.querySelector("#ref-lista");
    const acoes = el.querySelector("#ref-acoes");
    const btnAdd = el.querySelector("#ref-add");

    const render = () => {
      listaEl.innerHTML = lista.map((m, i) => `
        <li>
          <span class="ref-cit">${REF.abnt(m)}</span>
          <span class="ref-item-acoes">
            <button class="btn icon-only" title="Copiar citação" aria-label="Copiar citação" data-copy="${i}"><i class="ti ti-copy"></i></button>
            <button class="btn icon-only" title="Copiar citação no texto ${REF._esc(REF.abntTexto(m))}" aria-label="Copiar citação no texto" data-intext="${i}"><i class="ti ti-quote"></i></button>
            <button class="btn icon-only" title="Remover" aria-label="Remover" data-del="${i}"><i class="ti ti-x"></i></button>
          </span>
        </li>`).join("");
      acoes.style.display = lista.length ? "flex" : "none";
    };
    render();

    const adicionar = async () => {
      const doi = input.value.trim();
      if (!doi) return;
      REF._msg(msg, "Buscando no CrossRef…");
      btnAdd.disabled = true;
      try {
        const meta = await REF.buscarDOI(doi);
        lista.push(meta); salvar(lista); render();
        input.value = ""; REF._msg(msg, "Referência adicionada.", "ok");
      } catch (e) {
        REF._msg(msg, e.message || "Erro ao buscar a referência.", "erro");
      } finally {
        btnAdd.disabled = false;
      }
    };

    btnAdd.onclick = adicionar;
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); adicionar(); } });

    // Busca acadêmica (OpenAlex) → resultados → "+" adiciona à lista (mesma formatação ABNT).
    const inputBusca = el.querySelector("#ref-busca");
    const btnBuscar = el.querySelector("#ref-buscar");
    const resEl = el.querySelector("#ref-resultados");
    let resultados = [];
    const buscar = async () => {
      const q = inputBusca.value.trim();
      if (q.length < 3) { REF._msg(msg, "Digite ao menos 3 caracteres para buscar."); return; }
      REF._msg(msg, "Buscando no OpenAlex…");
      btnBuscar.disabled = true; resEl.innerHTML = "";
      try {
        resultados = await REF.buscar(q);
        if (!resultados.length) { REF._msg(msg, "Nada encontrado. Tente outros termos."); return; }
        resEl.innerHTML = resultados.map((m, i) => {
          const aut = m.autores.map(a => a.sobrenome).slice(0, 3).join("; ") + (m.autores.length > 3 ? " et al." : "");
          const meta = [REF._esc(aut), m.ano, m.container ? REF._esc(m.container) : ""].filter(Boolean).join(" · ");
          return `<div class="ref-res">
            <div class="ref-res-info">
              <div class="ref-res-tit">${REF._esc(m.titulo) || "[sem título]"}</div>
              <div class="ref-res-meta">${meta}${m.oa ? ' · <span class="ref-oa">acesso aberto</span>' : ""}</div>
            </div>
            <button class="btn icon-only" title="Adicionar às referências" aria-label="Adicionar às referências" data-add-res="${i}"><i class="ti ti-plus"></i></button>
          </div>`;
        }).join("");
        REF._msg(msg, resultados.length + " resultado(s) — clique no + para adicionar.", "ok");
      } catch (e) {
        REF._msg(msg, e.message || "Erro na busca.", "erro");
      } finally { btnBuscar.disabled = false; }
    };
    btnBuscar.onclick = buscar;
    inputBusca.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); buscar(); } });
    resEl.onclick = e => {
      const b = e.target.closest("[data-add-res]"); if (!b) return;
      const m = resultados[+b.dataset.addRes]; if (!m) return;
      lista.push(m); salvar(lista); render();
      REF._msg(msg, "Referência adicionada.", "ok");
    };
    listaEl.onclick = e => {
      const cp = e.target.closest("[data-copy]"), it = e.target.closest("[data-intext]"), dl = e.target.closest("[data-del]");
      if (cp) { navigator.clipboard.writeText(REF.texto(lista[+cp.dataset.copy])); if (typeof toast === "function") toast("Citação copiada.", "success"); }
      else if (it) { navigator.clipboard.writeText(REF.abntTexto(lista[+it.dataset.intext])); if (typeof toast === "function") toast("Citação no texto copiada.", "success"); }
      else if (dl) { lista.splice(+dl.dataset.del, 1); salvar(lista); render(); }
    };
    el.querySelector("#ref-copiar").onclick = () => {
      const txt = "REFERÊNCIAS\n\n" + lista.map(m => REF.texto(m)).join("\n");
      navigator.clipboard.writeText(txt); if (typeof toast === "function") toast("Lista de referências copiada.", "success");
    };
    el.querySelector("#ref-limpar").onclick = () => { lista = []; salvar(lista); render(); };
  },
};
if (typeof window !== "undefined") window.REF = REF;
