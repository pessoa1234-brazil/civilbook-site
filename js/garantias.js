// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Garantias (NBR 17170) + Fornecedores — parte do módulo "Manutenções e Garantias".
// Offline-first (CBStore): datas do projeto + garantias personalizadas em garantia_config;
// fornecedores em fornecedores. Vigência calculada a partir da data de entrega/recebimento.
const GAR = {
  KEY_CFG: "cb-garantia-cfg",
  KEY_FORN: "cb-fornecedores",
  _cfg: null, _forn: null, _loaded: false,

  async load() {
    const cfgLocal = CBStore.lsGet(this.KEY_CFG, { obra: "", data_entrega: "", data_habitese: "", custom: [] });
    const fornLocal = CBStore.lsGet(this.KEY_FORN, []);
    if (CBStore.online()) {
      try {
        const [{ data: cfgRow }, { data: fornRows, error: e2 }] = await Promise.all([
          window.supa.from("garantia_config").select("*").eq("user_id", CBStore.uid()).maybeSingle(),
          window.supa.from("fornecedores").select("*").order("criado_em", { ascending: false })
        ]);
        if (e2) throw e2;
        this._cfg = cfgRow ? { obra: cfgRow.obra || "", data_entrega: cfgRow.data_entrega || "", data_habitese: cfgRow.data_habitese || "", custom: cfgRow.custom || [] }
                           : { ...cfgLocal };
        this._forn = (fornRows || []).map(this._fornFromRow);
        // migração única: sobe config/fornecedores locais se o banco estiver vazio
        if (!cfgRow && (cfgLocal.data_entrega || (cfgLocal.custom || []).length)) await this.salvarCfg({});
        if (!this._forn.length && fornLocal.length) { for (const f of fornLocal) await this._inserir(f); }
        CBStore.lsSet(this.KEY_CFG, this._cfg); CBStore.lsSet(this.KEY_FORN, this._forn);
        this._loaded = true; return;
      } catch (e) { console.warn("GAR.load:", e && e.message); }
    }
    this._cfg = cfgLocal; this._forn = fornLocal; this._loaded = true;
  },
  async ready() { if (!this._loaded) await this.load(); return this._loaded; },

  _fornFromRow(r) { return { id: r.id, servico: r.servico, cnpj: r.cnpj || "", empresa: r.empresa || "", contato: r.contato || "", telefone: r.telefone || "", garantia_sistema: r.garantia_sistema || "", obs: r.obs || "" }; },

  cfg() { return this._cfg || { obra: "", data_entrega: "", data_habitese: "", custom: [] }; },
  fornecedores() { return this._forn || []; },
  inicioGarantias() { const c = this.cfg(); return c.data_entrega || c.data_habitese || ""; },

  async salvarCfg(patch) {
    this._cfg = { ...this.cfg(), ...patch };
    CBStore.lsSet(this.KEY_CFG, this._cfg);
    if (CBStore.online()) {
      const row = { user_id: CBStore.uid(), obra: this._cfg.obra || null, data_entrega: this._cfg.data_entrega || null, data_habitese: this._cfg.data_habitese || null, custom: this._cfg.custom || [], updated_at: new Date().toISOString() };
      const { error } = await window.supa.from("garantia_config").upsert(row, { onConflict: "user_id" });
      if (error) console.warn("GAR.salvarCfg:", error.message);
    }
  },

  // garantias personalizadas (guardadas em cfg.custom)
  listarGarantias() {
    const custom = (this.cfg().custom || []).map(c => ({ ...c, tipo: c.tipo || "oferecida", categoria: c.categoria || "Personalizado", _custom: true }));
    return GARANTIAS.concat(custom);
  },
  async addGarantia(g) {
    const custom = (this.cfg().custom || []).slice();
    custom.push({ id: "gc-" + Date.now(), sistema: g.sistema, categoria: g.categoria || "Personalizado", descricao: g.descricao || "", falhas: g.falhas || "", prazo: Number(g.prazo) || 1, tipo: "oferecida" });
    await this.salvarCfg({ custom });
  },
  async removeGarantia(id) { await this.salvarCfg({ custom: (this.cfg().custom || []).filter(c => c.id !== id) }); },

  async _inserir(f) {
    const id = f.id && /^[0-9a-f-]{36}$/.test(f.id) ? f.id : CBStore.uuid();
    const novo = { id, servico: f.servico, cnpj: f.cnpj || "", empresa: f.empresa || "", contato: f.contato || "", telefone: f.telefone || "", garantia_sistema: f.garantia_sistema || "", obs: f.obs || "" };
    this._forn = [novo].concat(this.fornecedores());
    CBStore.lsSet(this.KEY_FORN, this._forn);
    if (CBStore.online()) {
      const { error } = await window.supa.from("fornecedores").insert({ id, user_id: CBStore.uid(), servico: novo.servico, cnpj: novo.cnpj || null, empresa: novo.empresa || null, contato: novo.contato || null, telefone: novo.telefone || null, garantia_sistema: novo.garantia_sistema || null, obs: novo.obs || null });
      if (error) console.warn("GAR.inserirForn:", error.message);
    }
    return novo;
  },
  async addFornecedor(f) {
    if (!f.servico || !f.servico.trim()) return { erro: "Informe o serviço realizado." };
    await this._inserir(f);
    return { ok: true };
  },
  async removeFornecedor(id) {
    this._forn = this.fornecedores().filter(f => f.id !== id);
    CBStore.lsSet(this.KEY_FORN, this._forn);
    if (CBStore.online()) { const { error } = await window.supa.from("fornecedores").delete().eq("id", id); if (error) console.warn("GAR.removeForn:", error.message); }
  },

  // Vigência de uma garantia a partir do início (entrega/habite-se).
  vigencia(prazoAnos) {
    const ini = this.inicioGarantias();
    if (!ini) return { status: "sem-data" };
    const inicio = new Date(ini + "T12:00");
    if (isNaN(inicio.getTime())) return { status: "sem-data" };
    const vence = new Date(inicio); vence.setFullYear(vence.getFullYear() + prazoAnos);
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dias = Math.ceil((vence - hoje) / 86400000);
    if (dias < 0) return { status: "vencida", dias: -dias, vence };
    if (dias <= 90) return { status: "vencendo", dias, vence };
    return { status: "vigente", dias, vence };
  },
  stats() {
    const gs = this.listarGarantias();
    const r = { total: gs.length, vigentes: 0, vencendo: 0, vencidas: 0 };
    if (!this.inicioGarantias()) return r;
    gs.forEach(g => { const v = this.vigencia(g.prazo); if (v.status === "vigente") r.vigentes++; else if (v.status === "vencendo") { r.vigentes++; r.vencendo++; } else if (v.status === "vencida") r.vencidas++; });
    return r;
  }
};
window.GAR = GAR;

// Máscaras leves
function fmtCNPJ(v) { v = (v || "").replace(/\D/g, "").slice(0, 14); return v.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2"); }
function fmtTel(v) { v = (v || "").replace(/\D/g, "").slice(0, 11); if (v.length <= 10) return v.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2"); return v.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2"); }

// ───────────────────────── Aba Garantias ─────────────────────────
const GAR_FILTRO = { busca: "", categoria: "todos", status: "todos" };
function renderGarantias() {
  const c = GAR.cfg(), ini = GAR.inicioGarantias(), s = GAR.stats();
  const corStat = { vigente: "teal", vencendo: "amber", vencida: "red", "sem-data": "blue" };
  const labelStat = { vigente: "Vigente", vencendo: "Vencendo", vencida: "Vencida", "sem-data": "Defina a data" };
  let lista = GAR.listarGarantias();
  const nb = s => normalizar(s);
  if (GAR_FILTRO.categoria !== "todos") lista = lista.filter(g => g.categoria === GAR_FILTRO.categoria);
  if (GAR_FILTRO.status !== "todos" && ini) lista = lista.filter(g => GAR.vigencia(g.prazo).status === GAR_FILTRO.status || (GAR_FILTRO.status === "vigente" && GAR.vigencia(g.prazo).status === "vencendo"));
  if (GAR_FILTRO.busca) { const q = nb(GAR_FILTRO.busca); lista = lista.filter(g => nb(g.sistema + " " + g.descricao + " " + g.falhas + " " + g.categoria).includes(q)); }

  document.getElementById("mnt-body").innerHTML = `
    <div class="card" data-cb-view="gar" style="margin-bottom:14px">
      <h3 style="margin-bottom:4px"><i class="ti ti-calendar-event"></i> Datas do projeto</h3>
      <p class="page-sub" style="margin-bottom:12px">A entrega/recebimento da obra inicia a contagem das garantias.</p>
      <div class="field-row">
        <div class="field"><label>Obra / empreendimento</label><input type="text" id="gar-obra" value="${esc(c.obra || "")}" placeholder="ex.: Residencial Aurora"></div>
        <div class="field"><label>Data de entrega / recebimento</label><input type="date" id="gar-entrega" value="${esc(c.data_entrega || "")}"></div>
        <div class="field"><label>Habite-se (opcional)</label><input type="date" id="gar-habitese" value="${esc(c.data_habitese || "")}"></div>
      </div>
      <button class="btn primary" onclick="salvarDatasGar()"><i class="ti ti-device-floppy"></i>Salvar datas</button>
      ${ini ? `<span style="font-size:12.5px;color:var(--text-2);margin-left:10px">Início das garantias: <strong>${new Date(ini + "T12:00").toLocaleDateString("pt-BR")}</strong></span>` : ""}
    </div>

    <!-- e9: garantias reais vinculadas a ativo/unidade (preenchido por conformidade.js) -->
    <div id="gar-registro-host"></div>

    ${ini ? `<div class="grid grid-3" style="margin-bottom:14px">
      <div class="card" style="text-align:center"><div style="font-size:30px;font-weight:600;color:var(--teal)">${s.vigentes}</div><p>Vigentes${s.vencendo ? ` <span class="pill pill-amber">${s.vencendo} vencendo</span>` : ""}</p></div>
      <div class="card" style="text-align:center"><div style="font-size:30px;font-weight:600;color:${s.vencidas ? "var(--red)" : "var(--teal)"}">${s.vencidas}</div><p>Vencidas</p></div>
      <div class="card" style="text-align:center"><div style="font-size:30px;font-weight:600;color:var(--blue)">${s.total}</div><p>Sistemas monitorados</p></div>
    </div>` : `<div class="card" style="background:var(--blue-light);border:none;margin-bottom:14px"><p style="font-size:13.5px;color:var(--blue)"><i class="ti ti-info-circle"></i> Informe a data de entrega acima para calcular quais garantias ainda estão vigentes hoje.</p></div>`}

    <div class="filter-bar">
      <input type="text" id="gar-busca" placeholder="Buscar sistema, patologia…" aria-label="Buscar garantia por sistema ou patologia" value="${esc(GAR_FILTRO.busca)}">
      <select id="gar-cat" class="sinapi-uf" data-cbselect><option value="todos">Categorias</option>${GARANTIAS_CATEGORIAS.concat(["Personalizado"]).map(k => `<option value="${k}"${GAR_FILTRO.categoria === k ? " selected" : ""}>${k}</option>`).join("")}</select>
      <select id="gar-st" class="sinapi-uf" data-cbselect ${ini ? "" : "disabled"}><option value="todos">Status</option><option value="vigente"${GAR_FILTRO.status === "vigente" ? " selected" : ""}>Vigentes</option><option value="vencida"${GAR_FILTRO.status === "vencida" ? " selected" : ""}>Vencidas</option></select>
      <button class="btn" onclick="novaGarantia()"><i class="ti ti-plus"></i>Garantia</button>
    </div>
    <p class="page-sub" style="margin:0 0 10px">${lista.length} de ${GAR.listarGarantias().length} · <span style="color:var(--text-3)">${esc(GARANTIAS_REF)}</span></p>

    ${lista.map(g => {
      const v = GAR.vigencia(g.prazo);
      return `<div class="card" style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start">
          <div style="flex:1;min-width:240px">
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:4px">
              <span class="pill" style="background:var(--bg-2,#eef);color:var(--text-2)">${esc(g.categoria)}</span>
              ${g.tipo === "legal" ? `<span class="pill pill-red">Legal · 5 anos</span>` : `<span class="pill pill-blue">Oferecida</span>`}
              ${g._custom ? `<span class="pill" style="background:var(--purple-light);color:var(--purple)">Personalizada</span>` : ""}
            </div>
            <h3 style="margin:2px 0">${esc(g.sistema)}</h3>
            <p style="font-size:13px;color:var(--text-2)">${esc(g.descricao)}</p>
            <p style="font-size:12.5px;color:var(--text-3);margin-top:4px"><strong>Cobre:</strong> ${esc(g.falhas)}</p>
          </div>
          <div style="text-align:right;min-width:120px">
            <div style="font-size:22px;font-weight:600">${g.prazo} ${g.prazo === 1 ? "ano" : "anos"}</div>
            ${v.status === "sem-data" ? "" :
              v.status === "vencida" ? `<span class="pill pill-red">Vencida há ${v.dias}d</span>` :
              v.status === "vencendo" ? `<span class="pill pill-amber">Vence em ${v.dias}d</span>` :
              `<span class="pill pill-teal">Vigente · ${Math.floor(v.dias / 30)} meses</span>`}
            ${v.vence ? `<div style="font-size:11px;color:var(--text-3);margin-top:3px">até ${v.vence.toLocaleDateString("pt-BR")}</div>` : ""}
            ${g._custom ? `<button class="btn icon-only" title="Remover" style="margin-top:4px" onclick="GAR.removeGarantia('${esc(g.id)}').then(()=>renderGarantias())"><i class="ti ti-trash"></i></button>` : ""}
          </div>
        </div>
      </div>`;
    }).join("")}`;

  const wire = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };
  wire("gar-busca", "input", e => { GAR_FILTRO.busca = e.target.value; const p = e.target.selectionStart; renderGarantias(); const n = document.getElementById("gar-busca"); if (n) { n.focus(); n.setSelectionRange(p, p); } });
  wire("gar-cat", "change", e => { GAR_FILTRO.categoria = e.target.value; renderGarantias(); });
  wire("gar-st", "change", e => { GAR_FILTRO.status = e.target.value; renderGarantias(); });
  if (typeof renderGarantiasRegistro === "function") renderGarantiasRegistro();   // e9: garantias por ativo/unidade
}
function salvarDatasGar() {
  GAR.salvarCfg({ obra: document.getElementById("gar-obra").value.trim(), data_entrega: document.getElementById("gar-entrega").value, data_habitese: document.getElementById("gar-habitese").value })
    .then(() => { if (typeof toast === "function") toast("Datas salvas.", "success"); renderGarantias(); });
}
function novaGarantia() {
  const sistema = prompt("Sistema/equipamento da garantia personalizada:"); if (!sistema || !sistema.trim()) return;
  const prazo = parseInt(prompt("Prazo de garantia (em anos):", "1"), 10) || 1;
  const descricao = prompt("Descrição (opcional):") || "";
  GAR.addGarantia({ sistema: sistema.trim(), prazo, descricao, falhas: "Definido pelo usuário." }).then(() => renderGarantias());
}

// ───────────────────────── Aba Fornecedores ─────────────────────────
function renderFornecedores() {
  const forn = GAR.fornecedores();
  const sistemas = GAR.listarGarantias().map(g => g.sistema);
  document.getElementById("mnt-body").innerHTML = `
    <div class="card" data-cb-view="forn" style="margin-bottom:14px">
      <h3 style="margin-bottom:12px"><i class="ti ti-plus"></i> Novo fornecedor</h3>
      <div class="field-row">
        <div class="field"><label>Serviço realizado *</label><input type="text" id="f-servico" placeholder="ex.: Impermeabilização da laje"></div>
        <div class="field"><label>Nome da empresa</label><input type="text" id="f-empresa" placeholder="ex.: Impermebem Ltda"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>CNPJ</label><input type="text" id="f-cnpj" inputmode="numeric" placeholder="00.000.000/0000-00" oninput="this.value=fmtCNPJ(this.value)"></div>
        <div class="field"><label>Contato / responsável</label><input type="text" id="f-contato" placeholder="ex.: Eng. Marcos"></div>
        <div class="field"><label>Telefone</label><input type="text" id="f-tel" inputmode="numeric" placeholder="(00) 00000-0000" oninput="this.value=fmtTel(this.value)"></div>
      </div>
      <div class="field"><label>Garantia vinculada (opcional)</label>
        <select id="f-garantia"><option value="">— nenhuma —</option>${[...new Set(sistemas)].map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join("")}</select>
      </div>
      <button class="btn primary" onclick="addFornecedorUI()"><i class="ti ti-plus"></i>Adicionar fornecedor</button>
      <p class="auth-erro hidden" id="f-erro" style="margin-top:8px"></p>
    </div>

    ${forn.length === 0 ? `<p class="page-sub" style="text-align:center;padding:20px">Nenhum fornecedor cadastrado. Registre quem executou cada serviço para acionar a garantia quando precisar.</p>` :
      forn.map(f => `
      <div class="card" style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start">
          <div style="flex:1;min-width:240px">
            <h3 style="margin:0 0 2px">${esc(f.servico)}</h3>
            <p style="font-size:13px;color:var(--text-2)">${esc(f.empresa || "—")}${f.cnpj ? " · CNPJ " + esc(f.cnpj) : ""}</p>
            <p style="font-size:13px;color:var(--text-2)">${f.contato ? "<i class='ti ti-user'></i> " + esc(f.contato) : ""}${f.telefone ? " · <i class='ti ti-phone'></i> " + esc(f.telefone) : ""}</p>
            ${f.garantia_sistema ? `<span class="pill pill-teal" style="margin-top:4px"><i class="ti ti-shield-check"></i> ${esc(f.garantia_sistema)}</span>` : ""}
          </div>
          <div style="display:flex;gap:6px">
            ${f.telefone ? `<a class="btn icon-only" title="Ligar" href="tel:${esc((f.telefone || "").replace(/\D/g, ""))}"><i class="ti ti-phone"></i></a>` : ""}
            <button class="btn icon-only" title="Remover" onclick="GAR.removeFornecedor('${esc(f.id)}').then(()=>renderFornecedores())"><i class="ti ti-trash"></i></button>
          </div>
        </div>
      </div>`).join("")}`;
}
function addFornecedorUI() {
  const f = {
    servico: document.getElementById("f-servico").value.trim(),
    empresa: document.getElementById("f-empresa").value.trim(),
    cnpj: document.getElementById("f-cnpj").value.trim(),
    contato: document.getElementById("f-contato").value.trim(),
    telefone: document.getElementById("f-tel").value.trim(),
    garantia_sistema: document.getElementById("f-garantia").value
  };
  GAR.addFornecedor(f).then(r => {
    if (r.erro) { const el = document.getElementById("f-erro"); el.textContent = r.erro; el.classList.remove("hidden"); return; }
    if (typeof toast === "function") toast("Fornecedor adicionado.", "success");
    renderFornecedores();
  });
}
