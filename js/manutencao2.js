// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// e8 — Manutenção 2.0 (núcleo). Porta o núcleo do maintenance-flux: ativos (empreendimento/
// unidade + documentos + especificações), agendamentos, calendário e checklist de OS. Mesmo padrão
// offline-first do MNT (localStorage + Supabase via try/catch que degrada sozinho enquanto a
// migration 0028 não foi aplicada). Origem rastreável: github.com/pessoa1234-brazil/maintenance-flux.

const ATIVO_CATEGORIAS = [
  "Estrutura", "Hidrossanitário", "Elétrico", "Climatização (AVAC)", "Elevador",
  "Bomba / Pressurização", "Incêndio", "Gás", "Cobertura / Impermeabilização",
  "Esquadrias", "Gerador", "Portões / Automação", "Outro"
];
const AGEND_STATUS = [
  { id: "agendado", label: "Agendado", cor: "blue" },
  { id: "concluido", label: "Concluído", cor: "teal" },
  { id: "cancelado", label: "Cancelado", cor: "gray" }
];
const AGEND_PERIODOS = [1, 3, 6, 12, 24, 36];

// ---------- Coleção genérica offline-first (id próprio + dono), no padrão do MNT ----------
// a19 (24/ago/2026): duas armadilhas fechadas na fábrica. (1) listar() com _items null devolvia
// um [] NOVO a cada chamada — o upsert empurrava o item num array que ninguém guardava: ia p/ o
// localStorage e sumia da sessão. Agora upsert/remover MATERIALIZAM _items a partir do LS.
// (2) um load() em voo terminava DEPOIS de uma gravação e enterrava o item com o retrato lido
// no começo (e _loaded=true impedia qualquer recarga). Agora gravação feita antes da 1ª carga
// (ou durante uma em voo) vira PENDENTE e é reaplicada por cima do retrato no fim do load —
// os dois retratos não disputam mais. Teste puro: tests/colecao.check.mjs (roda no CI).
function cbColecao(table, lsKey, fromRow, toRow) {
  return {
    _items: null, _loaded: false, _carregando: false, _pendentes: null, _carga: null, table, lsKey,
    _pendente(op, id, it) {
      if (this._loaded && !this._carregando) return;   // fora da janela de risco não há disputa
      (this._pendentes = this._pendentes || []).push({ op, id, it });
    },
    // a19 (2ª volta — achado da revisão adversarial de 24/ago): DOIS load() concorrentes ainda
    // enterravam gravação — o primeiro a terminar zerava _pendentes/_carregando e o segundo
    // sobrescrevia com o retrato velho. Agora o load em voo é MEMOIZADO: chamadas concorrentes
    // dividem a MESMA carga; só existe um retrato por vez.
    load() {
      if (this._carga) return this._carga;
      this._carga = this._carregar().finally(() => { this._carga = null; });
      return this._carga;
    },
    async _carregar() {
      this._carregando = true;
      const local = CBStore.lsGet(lsKey, []);
      let items = null;
      if (CBStore.online()) {
        try {
          const { data, error } = await window.supa.from(table).select("*");
          if (error) throw error;
          items = (data || []).map(fromRow);
          if (!items.length && local.length) {                 // migração única: sobe locais se vazio
            items = [];
            for (const it of local) {
              const { error: e } = await window.supa.from(table).insert(toRow(it));
              if (!e) items.push(it);
            }
          }
        } catch (e) { console.warn(table + ".load:", e && e.message); items = null; }
      }
      if (items == null) items = local;
      // a19: reaplica o que foi gravado enquanto este load corria — a gravação vence o retrato.
      for (const p of (this._pendentes || [])) {
        if (p.op === "remover") { items = items.filter(x => x.id !== p.id); continue; }
        const i = items.findIndex(x => x.id === p.id);
        if (i < 0) items.push(p.it); else items[i] = p.it;
      }
      this._pendentes = null;
      this._items = items; CBStore.lsSet(lsKey, items);
      this._loaded = true; this._carregando = false;
    },
    async ready() { if (!this._loaded) await this.load(); return this._loaded; },
    listar() { return this._items || []; },
    get(id) { return this.listar().find(x => x.id === id) || null; },
    upsert(it) {
      // a19: materializa — sem isso, com _items null, a lista era um array descartável.
      const lista = this._items || (this._items = CBStore.lsGet(lsKey, []));
      const i = lista.findIndex(x => x.id === it.id);
      const novo = i < 0;
      if (novo) lista.push(it); else lista[i] = it;
      CBStore.lsSet(lsKey, lista);
      this._pendente("upsert", it.id, it);
      if (CBStore.online()) {
        const row = toRow(it);
        const q = novo ? window.supa.from(table).insert(row) : window.supa.from(table).update(row).eq("id", it.id);
        q.then(({ error }) => { if (error) console.warn(table + ".upsert:", error.message); });
      }
    },
    remover(id) {
      const lista = this._items || (this._items = CBStore.lsGet(lsKey, []));
      this._items = lista.filter(x => x.id !== id);
      CBStore.lsSet(lsKey, this._items);
      this._pendente("remover", id);
      CBStore.remove(table, { id });
    }
  };
}

function rowToAtivo(r) {
  return {
    id: r.id, empreendimento: r.empreendimento || "", unidade: r.unidade || "", nome: r.nome,
    categoria: r.categoria || "", fabricante: r.fabricante || "", modelo: r.modelo || "",
    num_serie: r.num_serie || "", local: r.local || "", instalado_em: r.instalado_em || "",
    garantia_ate: r.garantia_ate || "", especificacoes: r.especificacoes || [], documentos: r.documentos || [],
    obs: r.obs || "", dono: r.user_id
  };
}
function ativoToRow(a) {
  return {
    id: a.id, user_id: a.dono || CBStore.uid(), empreendimento: a.empreendimento || null, unidade: a.unidade || null,
    nome: a.nome, categoria: a.categoria || null, fabricante: a.fabricante || null, modelo: a.modelo || null,
    num_serie: a.num_serie || null, local: a.local || null, instalado_em: a.instalado_em || null,
    garantia_ate: a.garantia_ate || null, especificacoes: a.especificacoes || [], documentos: a.documentos || [], obs: a.obs || null
  };
}
function rowToAgend(r) {
  return {
    id: r.id, ativo_id: r.ativo_id || "", titulo: r.titulo, atividade: r.atividade || "", data: r.data || "",
    periodicidade_meses: r.periodicidade_meses, resp: r.resp || "", status: r.status || "agendado", obs: r.obs || "", dono: r.user_id
  };
}
function agendToRow(a) {
  return {
    id: a.id, user_id: a.dono || CBStore.uid(), ativo_id: a.ativo_id || null, titulo: a.titulo,
    atividade: a.atividade || null, data: a.data, resp: a.resp || null, status: a.status || "agendado", obs: a.obs || null,
    periodicidade_meses: (a.periodicidade_meses === "" || a.periodicidade_meses == null) ? null : Number(a.periodicidade_meses)
  };
}

const ATV = cbColecao("ativos", "cb-ativos", rowToAtivo, ativoToRow);
const AGE = cbColecao("agendamentos", "cb-agendamentos", rowToAgend, agendToRow);

// ---------- Detalhes da OS (satélite): ativo vinculado + checklist ----------
const OSD = {
  _map: null, _loaded: false, LS: "cb-os-detalhes",
  async load() {
    const local = CBStore.lsGet(this.LS, {});
    if (CBStore.online()) {
      try {
        const { data, error } = await window.supa.from("os_detalhes").select("*");
        if (error) throw error;
        const m = {};
        (data || []).forEach(r => { m[r.os_id] = { ativo_id: r.ativo_id || "", checklist: r.checklist || [] }; });
        if (!Object.keys(m).length && Object.keys(local).length) {
          for (const [osId, d] of Object.entries(local)) {
            const { error: e } = await window.supa.from("os_detalhes").upsert({ os_id: osId, user_id: CBStore.uid(), ativo_id: d.ativo_id || null, checklist: d.checklist || [] });
            if (!e) m[osId] = d;
          }
        }
        this._map = m; CBStore.lsSet(this.LS, m); this._loaded = true; return;
      } catch (e) { console.warn("OSD.load:", e && e.message); }
    }
    this._map = local; this._loaded = true;
  },
  async ready() { if (!this._loaded) await this.load(); return this._loaded; },
  get(osId) { return (this._map && this._map[osId]) || { ativo_id: "", checklist: [] }; },
  set(osId, d) {
    if (!this._map) this._map = {};
    this._map[osId] = { ativo_id: d.ativo_id || "", checklist: d.checklist || [] };
    CBStore.lsSet(this.LS, this._map);
    if (CBStore.online()) {
      window.supa.from("os_detalhes")
        .upsert({ os_id: osId, user_id: CBStore.uid(), ativo_id: d.ativo_id || null, checklist: d.checklist || [], updated_at: new Date().toISOString() })
        .then(({ error }) => { if (error) console.warn("OSD.set:", error.message); });
    }
  }
};

async function mnt2Ready() { await Promise.all([ATV.ready(), AGE.ready(), OSD.ready()]); }

// ════════════════════════════ Ativos ════════════════════════════
let _ativoForm = null;   // { id|null, esp:[], doc:[] } enquanto o formulário está aberto

function renderMntAtivos() {
  const body = document.getElementById("mnt-body");
  if (!body) return;
  const ativos = ATV.listar();
  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
      <p class="page-sub" style="margin:0">${ativos.length} ativo(s) cadastrado(s). Equipamentos e sistemas do empreendimento — base para OS e agendamentos.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${typeof EXEMPLO !== "undefined" ? EXEMPLO.botaoBarraHTML("ativos") : ""}
        <button class="btn primary" onclick="abrirAtivoForm()"><i class="ti ti-plus"></i> Novo ativo</button>
      </div>
    </div>
    <div id="ativo-form-host"></div>
    <div id="ativo-lista">${ativosListaHTML()}</div>`;
}

function ativosListaHTML() {
  const ativos = ATV.listar();
  if (!ativos.length) {
    return typeof EXEMPLO !== "undefined" ? EXEMPLO.vazioHTML("ativos", {
      icone: "ti-tools", titulo: "Cadastre o que precisa de manutenção",
      texto: "Elevador, bombas, portões, geradores: cada ativo guarda fabricante, número de série, data de instalação e fim da garantia — e o Civilbook avisa quando a garantia está para vencer.",
      ctaLabel: "Cadastrar o primeiro ativo", ctaAcao: "abrirAtivoForm()",
    }) : `<p class="page-sub" style="text-align:center;padding:20px">Nenhum ativo cadastrado. Clique em "Novo ativo".</p>`;
  }
  // agrupa por empreendimento → unidade (hierarquia)
  const grupos = {};
  ativos.forEach(a => {
    const emp = a.empreendimento || "Sem empreendimento";
    const uni = a.unidade || "—";
    (grupos[emp] = grupos[emp] || {});
    (grupos[emp][uni] = grupos[emp][uni] || []).push(a);
  });
  return Object.keys(grupos).sort().map(emp => `
    <div class="card" style="margin-bottom:12px">
      <h3 style="margin-bottom:8px"><i class="ti ti-building-community" style="color:var(--text-2)"></i> ${esc(emp)}</h3>
      ${Object.keys(grupos[emp]).sort().map(uni => `
        ${uni !== "—" ? `<div class="ativo-uni"><i class="ti ti-stack-2"></i> ${esc(uni)}</div>` : ""}
        ${grupos[emp][uni].map(ativoCardHTML).join("")}
      `).join("")}
    </div>`).join("");
}

function ativoCardHTML(a) {
  const garante = a.garantia_ate ? new Date(a.garantia_ate + "T12:00") : null;
  const garVencida = garante && garante < new Date();
  const ident = [a.fabricante, a.modelo, a.num_serie ? "Nº " + a.num_serie : ""].filter(Boolean).join(" · ");
  return `
  <div class="ativo-item">
    <div style="flex:1;min-width:200px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <strong>${esc(a.nome)}</strong>
        ${a.categoria ? `<span class="pill pill-blue">${esc(a.categoria)}</span>` : ""}
        ${a.garantia_ate ? `<span class="pill pill-${garVencida ? "gray" : "teal"}" title="Garantia">${garVencida ? "Garantia expirada" : "Garantia até " + garante.toLocaleDateString("pt-BR")}</span>` : ""}
      </div>
      ${ident ? `<p style="font-size:12.5px;color:var(--text-2);margin-top:3px">${esc(ident)}</p>` : ""}
      ${a.local ? `<p style="font-size:12.5px;color:var(--text-3)"><i class="ti ti-map-pin"></i> ${esc(a.local)}</p>` : ""}
      ${(a.especificacoes && a.especificacoes.length) ? `<details class="ativo-det"><summary>${a.especificacoes.length} especificação(ões)</summary>
        <table class="spec-table" style="margin-top:6px">${a.especificacoes.map(e => `<tr><td>${esc(e.chave)}</td><td>${esc(e.valor)}</td></tr>`).join("")}</table></details>` : ""}
      ${(a.documentos && a.documentos.length) ? `<details class="ativo-det"><summary>${a.documentos.length} documento(s)</summary>
        <ul style="margin:6px 0 0;padding-left:18px;font-size:13px">${a.documentos.map(d => `<li>${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.nome || d.url)}</a>` : esc(d.nome || "")}${d.tipo ? " · " + esc(d.tipo) : ""}</li>`).join("")}</ul></details>` : ""}
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start">
      <button class="btn" onclick="abrirAtivoForm('${a.id}')"><i class="ti ti-edit"></i>Editar</button>
      <button class="btn icon-only" title="Excluir" onclick="excluirAtivo('${a.id}')"><i class="ti ti-trash"></i></button>
    </div>
  </div>`;
}

function abrirAtivoForm(id) {
  const a = id ? ATV.get(id) : null;
  _ativoForm = { id: id || null, esp: a ? JSON.parse(JSON.stringify(a.especificacoes || [])) : [], doc: a ? JSON.parse(JSON.stringify(a.documentos || [])) : [] };
  const host = document.getElementById("ativo-form-host");
  const v = (k, d) => esc(a && a[k] != null ? a[k] : (d || ""));
  // datalists p/ reaproveitar empreendimento/unidade já cadastrados
  const emps = [...new Set(ATV.listar().map(x => x.empreendimento).filter(Boolean))];
  const unis = [...new Set(ATV.listar().map(x => x.unidade).filter(Boolean))];
  host.innerHTML = `
    <div class="card" style="margin-bottom:14px;border:1.5px solid var(--blue)">
      <h3 style="margin-bottom:12px"><i class="ti ti-${id ? "edit" : "plus"}"></i> ${id ? "Editar ativo" : "Novo ativo"}</h3>
      <div class="field-row">
        <div class="field"><label>Empreendimento</label><input type="text" id="atv-emp" list="atv-emps" value="${v("empreendimento")}" placeholder="ex.: Edifício Aurora"><datalist id="atv-emps">${emps.map(e => `<option value="${esc(e)}">`).join("")}</datalist></div>
        <div class="field"><label>Unidade / setor</label><input type="text" id="atv-uni" list="atv-unis" value="${v("unidade")}" placeholder="ex.: Torre A / Cobertura"><datalist id="atv-unis">${unis.map(u => `<option value="${esc(u)}">`).join("")}</datalist></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Nome do ativo *</label><input type="text" id="atv-nome" value="${v("nome")}" placeholder="ex.: Bomba de recalque 01"></div>
        <div class="field"><label>Categoria</label><select id="atv-cat">${ATIVO_CATEGORIAS.map(c => `<option${a && a.categoria === c ? " selected" : ""}>${c}</option>`).join("")}</select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Fabricante</label><input type="text" id="atv-fab" value="${v("fabricante")}"></div>
        <div class="field"><label>Modelo</label><input type="text" id="atv-mod" value="${v("modelo")}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Nº de série / patrimônio</label><input type="text" id="atv-ns" value="${v("num_serie")}"></div>
        <div class="field"><label>Localização</label><input type="text" id="atv-local" value="${v("local")}" placeholder="ex.: Casa de máquinas"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Instalado em</label><input type="date" id="atv-inst" value="${v("instalado_em")}"></div>
        <div class="field"><label>Garantia até</label><input type="date" id="atv-gar" value="${v("garantia_ate")}"></div>
      </div>
      <div class="field"><label>Especificações técnicas</label><div id="atv-esp"></div>
        <button class="btn sm" type="button" onclick="ativoAddEsp()"><i class="ti ti-plus"></i> Adicionar especificação</button></div>
      <div class="field"><label>Documentos (manuais, notas, ART — por link)</label><div id="atv-doc"></div>
        <button class="btn sm" type="button" onclick="ativoAddDoc()"><i class="ti ti-plus"></i> Adicionar documento</button></div>
      <div class="field"><label>Observações</label><textarea id="atv-obs" rows="2">${v("obs")}</textarea></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn primary" onclick="salvarAtivo()"><i class="ti ti-device-floppy"></i> Salvar</button>
        <button class="btn" onclick="_ativoForm=null;renderMntAtivos()">Cancelar</button>
      </div>
    </div>`;
  ativoRenderEsp(); ativoRenderDoc();
  host.scrollIntoView({ behavior: "smooth", block: "start" });
  const nome = document.getElementById("atv-nome"); if (nome) nome.focus();
}

// captura edições atuais dos campos chave/valor e nome/url antes de re-renderizar
function ativoLerSub() {
  if (!_ativoForm) return;
  _ativoForm.esp = [...document.querySelectorAll("#atv-esp .atv-esp-row")].map(r => ({ chave: r.querySelector(".ek").value, valor: r.querySelector(".ev").value }));
  _ativoForm.doc = [...document.querySelectorAll("#atv-doc .atv-doc-row")].map(r => ({ nome: r.querySelector(".dn").value, url: r.querySelector(".du").value, tipo: r.querySelector(".dt").value }));
}
function ativoRenderEsp() {
  const host = document.getElementById("atv-esp"); if (!host) return;
  host.innerHTML = _ativoForm.esp.map((e, i) => `
    <div class="atv-esp-row" style="display:flex;gap:8px;margin-bottom:6px">
      <input type="text" class="aval-in ek" placeholder="Característica (ex.: Potência)" value="${esc(e.chave || "")}" style="flex:1">
      <input type="text" class="aval-in ev" placeholder="Valor (ex.: 3 CV)" value="${esc(e.valor || "")}" style="flex:1">
      <button class="btn icon-only" type="button" title="Remover" onclick="ativoDelEsp(${i})"><i class="ti ti-x"></i></button>
    </div>`).join("") || `<p class="page-sub" style="margin:0 0 6px">Nenhuma especificação.</p>`;
}
function ativoRenderDoc() {
  const host = document.getElementById("atv-doc"); if (!host) return;
  host.innerHTML = _ativoForm.doc.map((d, i) => `
    <div class="atv-doc-row" style="display:flex;gap:8px;margin-bottom:6px;flex-wrap:wrap">
      <input type="text" class="aval-in dn" placeholder="Nome (ex.: Manual)" value="${esc(d.nome || "")}" style="flex:1;min-width:120px">
      <input type="url" class="aval-in du" placeholder="URL (https://…)" value="${esc(d.url || "")}" style="flex:1.4;min-width:140px">
      <input type="text" class="aval-in dt" placeholder="Tipo" value="${esc(d.tipo || "")}" style="width:100px">
      <button class="btn icon-only" type="button" title="Remover" onclick="ativoDelDoc(${i})"><i class="ti ti-x"></i></button>
    </div>`).join("") || `<p class="page-sub" style="margin:0 0 6px">Nenhum documento.</p>`;
}
function ativoAddEsp() { ativoLerSub(); _ativoForm.esp.push({ chave: "", valor: "" }); ativoRenderEsp(); }
function ativoDelEsp(i) { ativoLerSub(); _ativoForm.esp.splice(i, 1); ativoRenderEsp(); }
function ativoAddDoc() { ativoLerSub(); _ativoForm.doc.push({ nome: "", url: "", tipo: "" }); ativoRenderDoc(); }
function ativoDelDoc(i) { ativoLerSub(); _ativoForm.doc.splice(i, 1); ativoRenderDoc(); }

function salvarAtivo() {
  const nome = document.getElementById("atv-nome").value.trim();
  if (!nome) { document.getElementById("atv-nome").focus(); toast("Informe o nome do ativo.", "warn"); return; }
  ativoLerSub();
  const esp = _ativoForm.esp.filter(e => (e.chave || "").trim() || (e.valor || "").trim());
  const doc = _ativoForm.doc.filter(d => (d.nome || "").trim() || (d.url || "").trim());
  const base = _ativoForm.id ? ATV.get(_ativoForm.id) : null;
  ATV.upsert({
    id: _ativoForm.id || CBStore.uuid(),
    dono: base ? base.dono : CBStore.uid(),
    empreendimento: document.getElementById("atv-emp").value.trim(),
    unidade: document.getElementById("atv-uni").value.trim(),
    nome,
    categoria: document.getElementById("atv-cat").value,
    fabricante: document.getElementById("atv-fab").value.trim(),
    modelo: document.getElementById("atv-mod").value.trim(),
    num_serie: document.getElementById("atv-ns").value.trim(),
    local: document.getElementById("atv-local").value.trim(),
    instalado_em: document.getElementById("atv-inst").value,
    garantia_ate: document.getElementById("atv-gar").value,
    especificacoes: esp, documentos: doc,
    obs: document.getElementById("atv-obs").value.trim()
  });
  _ativoForm = null;
  toast(base ? "Ativo atualizado." : "Ativo cadastrado.", "success");
  renderMntAtivos();
}

async function excluirAtivo(id) {
  const a = ATV.get(id);
  if (!a) return;
  if (!await cbConfirmar(`Excluir o ativo "${a.nome}"? Esta ação não pode ser desfeita.`)) return;
  ATV.remover(id);
  toast("Ativo excluído.", "info");
  renderMntAtivos();
}

// Opções <option> de ativos p/ selects (OS, agendamento). selId pré-seleciona.
function ativoOptions(selId) {
  return `<option value="">— sem ativo —</option>` + ATV.listar().map(a =>
    `<option value="${a.id}"${a.id === selId ? " selected" : ""}>${esc(a.nome)}${a.empreendimento ? " — " + esc(a.empreendimento) : ""}</option>`).join("");
}
function ativoNome(id) { const a = ATV.get(id); return a ? a.nome : ""; }

// ════════════════════════════ Agendamentos ════════════════════════════
let _ageEdit = null;

function renderMntAgendamentos() {
  const body = document.getElementById("mnt-body");
  if (!body) return;
  const itens = AGE.listar().slice().sort((a, b) => (a.data || "").localeCompare(b.data || ""));
  const stInfo = id => AGEND_STATUS.find(s => s.id === id) || AGEND_STATUS[0];
  const hojeStr = new Date().toISOString().slice(0, 10);
  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
      <p class="page-sub" style="margin:0">${itens.length} agendamento(s). Manutenção preventiva datada, com responsável e periodicidade.</p>
      ${typeof EXEMPLO !== "undefined" ? EXEMPLO.botaoBarraHTML("agendamentos") : ""}
    </div>
    <div class="card" style="margin-bottom:14px">
      <h3 style="margin-bottom:12px"><i class="ti ti-calendar-plus"></i> ${_ageEdit ? "Editar agendamento" : "Novo agendamento"}</h3>
      ${ageFormHTML(_ageEdit ? AGE.get(_ageEdit) : null)}
    </div>
    ${itens.length === 0 ? (typeof EXEMPLO !== "undefined" ? EXEMPLO.vazioHTML("agendamentos", {
        icone: "ti-calendar-plus", titulo: "Programe a manutenção preventiva",
        texto: "Cada agendamento tem data, responsável e periodicidade — o que vence aparece em destaque e o alerta por e-mail avisa antes. É o que transforma o manual do proprietário em rotina de verdade.",
      }) : `<p class="page-sub" style="text-align:center;padding:16px">Nenhum agendamento. Programe manutenções preventivas datadas.</p>`) : ""}
    ${itens.map(g => {
      const st = stInfo(g.status);
      const venc = g.status === "agendado" && g.data && g.data < hojeStr;
      return `
      <div class="card" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start">
          <div style="flex:1;min-width:200px">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <strong>${esc(g.titulo)}</strong>
              <span class="pill pill-${st.cor}">${st.label}</span>
              ${venc ? `<span class="pill pill-red">Atrasado</span>` : ""}
              ${g.periodicidade_meses ? `<span class="pill pill-blue">${periodicidadeLabel(Number(g.periodicidade_meses))}</span>` : ""}
            </div>
            <p style="font-size:13px;color:var(--text-2);margin-top:4px">
              <i class="ti ti-calendar"></i> ${g.data ? new Date(g.data + "T12:00").toLocaleDateString("pt-BR") : "—"}
              ${g.ativo_id && ativoNome(g.ativo_id) ? " · <i class='ti ti-package'></i> " + esc(ativoNome(g.ativo_id)) : ""}
              ${g.resp ? " · " + esc(g.resp) : ""}
            </p>
            ${g.atividade ? `<p style="font-size:13.5px;margin-top:4px">${esc(g.atividade)}</p>` : ""}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${g.status === "agendado" ? `<button class="btn" onclick="ageConcluir('${g.id}')"><i class="ti ti-check"></i>Concluir</button>` : ""}
            <button class="btn" onclick="_ageEdit='${g.id}';renderMntAgendamentos()"><i class="ti ti-edit"></i></button>
            <button class="btn icon-only" title="Excluir" onclick="excluirAgendamento('${g.id}')"><i class="ti ti-trash"></i></button>
          </div>
        </div>
      </div>`;
    }).join("")}`;
}

function ageFormHTML(g) {
  const v = (k, d) => esc(g && g[k] != null ? g[k] : (d || ""));
  return `
    <div class="field-row">
      <div class="field"><label>Título *</label><input type="text" id="age-titulo" value="${v("titulo")}" placeholder="ex.: Limpeza de reservatório"></div>
      <div class="field"><label>Ativo</label><select id="age-ativo">${ativoOptions(g ? g.ativo_id : "")}</select></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Data *</label><input type="date" id="age-data" value="${v("data")}"></div>
      <div class="field"><label>Periodicidade</label><select id="age-per"><option value="">Pontual</option>${AGEND_PERIODOS.map(m => `<option value="${m}"${g && Number(g.periodicidade_meses) === m ? " selected" : ""}>${periodicidadeLabel(m)}</option>`).join("")}</select></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Responsável</label><input type="text" id="age-resp" value="${v("resp")}" placeholder="ex.: Empresa X"></div>
      <div class="field"><label>Atividade</label><input type="text" id="age-atv" value="${v("atividade")}" placeholder="descrição curta"></div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn primary" onclick="salvarAgendamento()"><i class="ti ti-device-floppy"></i> ${g ? "Salvar" : "Agendar"}</button>
      ${g ? `<button class="btn" onclick="_ageEdit=null;renderMntAgendamentos()">Cancelar</button>` : ""}
    </div>`;
}

function salvarAgendamento() {
  const titulo = document.getElementById("age-titulo").value.trim();
  const data = document.getElementById("age-data").value;
  if (!titulo) { document.getElementById("age-titulo").focus(); toast("Informe o título.", "warn"); return; }
  if (!data) { document.getElementById("age-data").focus(); toast("Informe a data.", "warn"); return; }
  const base = _ageEdit ? AGE.get(_ageEdit) : null;
  AGE.upsert({
    id: _ageEdit || CBStore.uuid(),
    dono: base ? base.dono : CBStore.uid(),
    titulo, data,
    ativo_id: document.getElementById("age-ativo").value,
    periodicidade_meses: document.getElementById("age-per").value,
    resp: document.getElementById("age-resp").value.trim(),
    atividade: document.getElementById("age-atv").value.trim(),
    status: base ? base.status : "agendado"
  });
  _ageEdit = null;
  toast(base ? "Agendamento atualizado." : "Agendamento criado.", "success");
  renderMntAgendamentos();
}

function ageConcluir(id) {
  const g = AGE.get(id);
  if (!g) return;
  g.status = "concluido";
  AGE.upsert(g);
  // recorrência: gera o próximo agendamento automaticamente
  if (g.periodicidade_meses) {
    const prox = new Date(g.data + "T12:00");
    prox.setMonth(prox.getMonth() + Number(g.periodicidade_meses));
    AGE.upsert({ ...g, id: CBStore.uuid(), data: prox.toISOString().slice(0, 10), status: "agendado" });
    toast("Concluído. Próxima ocorrência agendada.", "success");
  } else { toast("Agendamento concluído.", "success"); }
  renderMntAgendamentos();
}

async function excluirAgendamento(id) {
  if (!await cbConfirmar("Excluir este agendamento?")) return;
  AGE.remover(id);
  toast("Agendamento excluído.", "info");
  renderMntAgendamentos();
}

// ════════════════════════════ Calendário ════════════════════════════
let _calRef = null;   // { y, m } (m: 0-11)

function renderMntCalendario() {
  const body = document.getElementById("mnt-body");
  if (!body) return;
  if (!_calRef) { const n = new Date(); _calRef = { y: n.getFullYear(), m: n.getMonth() }; }
  const { y, m } = _calRef;
  const primeiro = new Date(y, m, 1);
  const inicioSemana = primeiro.getDay();             // 0=domingo
  const diasNoMes = new Date(y, m + 1, 0).getDate();
  const mesNome = primeiro.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // eventos por dia (AAAA-MM-DD): agendamentos + prazos de OS abertas
  const ev = {};
  const add = (dia, item) => { (ev[dia] = ev[dia] || []).push(item); };
  AGE.listar().forEach(g => { if (g.data && g.status !== "cancelado") add(g.data, { tipo: "age", cor: g.status === "concluido" ? "teal" : "blue", label: g.titulo }); });
  (typeof MNT !== "undefined" ? MNT.listarOS() : []).forEach(o => {
    if (o.prazo && (o.status === "aberta" || o.status === "andamento")) add(o.prazo, { tipo: "os", cor: "amber", label: "OS: " + o.titulo });
  });

  const hojeStr = new Date().toISOString().slice(0, 10);
  let celulas = "";
  for (let i = 0; i < inicioSemana; i++) celulas += `<div class="cal-cel cal-vazia"></div>`;
  for (let d = 1; d <= diasNoMes; d++) {
    const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const evs = ev[ds] || [];
    celulas += `<div class="cal-cel${ds === hojeStr ? " cal-hoje" : ""}">
      <div class="cal-dia">${d}</div>
      ${evs.slice(0, 3).map(e => `<div class="cal-ev cal-ev-${e.cor}" title="${esc(e.label)}">${esc(e.label)}</div>`).join("")}
      ${evs.length > 3 ? `<div class="cal-mais">+${evs.length - 3}</div>` : ""}
    </div>`;
  }
  body.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:10px;flex-wrap:wrap">
        <button class="btn" onclick="calMover(-1)"><i class="ti ti-chevron-left"></i></button>
        <h3 style="margin:0;text-transform:capitalize">${esc(mesNome)}</h3>
        <div style="display:flex;gap:8px"><button class="btn" onclick="calHoje()">Hoje</button><button class="btn" onclick="calMover(1)"><i class="ti ti-chevron-right"></i></button></div>
      </div>
      <div class="cal-grid cal-head">${["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => `<div class="cal-cab">${d}</div>`).join("")}</div>
      <div class="cal-grid">${celulas}</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:12px;font-size:12.5px;color:var(--text-2)">
        <span><span class="cal-leg cal-ev-blue"></span> Agendamento</span>
        <span><span class="cal-leg cal-ev-amber"></span> Prazo de OS</span>
        <span><span class="cal-leg cal-ev-teal"></span> Concluído</span>
      </div>
    </div>`;
}
function calMover(delta) { let m = _calRef.m + delta, y = _calRef.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } _calRef = { y, m }; renderMntCalendario(); }
function calHoje() { const n = new Date(); _calRef = { y: n.getFullYear(), m: n.getMonth() }; renderMntCalendario(); }

// ════════════════════════════ Integração com OS (checklist + ativo) ════════════════════════════
// Campo de ativo p/ o formulário de nova OS (chamado pelo renderMntOS via typeof-guard).
function osFormAtivoField() {
  return `<div class="field"><label>Ativo (opcional)</label><select id="os-ativo">${ativoOptions("")}</select></div>`;
}
// Bloco exibido em cada card de OS: ativo vinculado + checklist com progresso.
function osCardDetalhes(o) {
  const d = OSD.get(o.id);
  const nome = d.ativo_id ? ativoNome(d.ativo_id) : "";
  const chk = d.checklist || [];
  const feitos = chk.filter(i => i.done).length;
  return `
    <div class="os-detalhes">
      ${nome ? `<p style="font-size:12.5px;color:var(--text-2);margin:6px 0 0"><i class="ti ti-package"></i> Ativo: <strong>${esc(nome)}</strong></p>` : ""}
      <details class="ativo-det"${chk.length ? " open" : ""}>
        <summary><i class="ti ti-checklist"></i> Checklist${chk.length ? ` (${feitos}/${chk.length})` : ""}</summary>
        <div style="margin-top:6px">
          ${chk.map((it, i) => `<div class="check-item ${it.done ? "done" : ""}" style="padding:4px 0">
            <input type="checkbox" ${it.done ? "checked" : ""} onchange="osChkToggle('${o.id}',${i})">
            <label style="flex:1">${esc(it.texto)}</label>
            <button class="btn icon-only sm" title="Remover" onclick="osChkDel('${o.id}',${i})"><i class="ti ti-x"></i></button>
          </div>`).join("")}
          <div style="display:flex;gap:8px;margin-top:6px">
            <input type="text" class="aval-in" id="chk-in-${o.id}" placeholder="Novo item do checklist…" style="flex:1" onkeydown="if(event.key==='Enter')osChkAdd('${o.id}')">
            <button class="btn sm" onclick="osChkAdd('${o.id}')"><i class="ti ti-plus"></i></button>
          </div>
        </div>
      </details>
    </div>`;
}
function osChkAdd(osId) {
  const inp = document.getElementById("chk-in-" + osId);
  const texto = (inp.value || "").trim();
  if (!texto) return;
  const d = OSD.get(osId);
  const chk = (d.checklist || []).slice();
  chk.push({ texto, done: false });
  OSD.set(osId, { ativo_id: d.ativo_id, checklist: chk });
  renderMntOS();
}
function osChkToggle(osId, i) {
  const d = OSD.get(osId);
  const chk = (d.checklist || []).slice();
  if (chk[i]) chk[i] = { ...chk[i], done: !chk[i].done };
  OSD.set(osId, { ativo_id: d.ativo_id, checklist: chk });
  renderMntOS();
}
function osChkDel(osId, i) {
  const d = OSD.get(osId);
  const chk = (d.checklist || []).slice();
  chk.splice(i, 1);
  OSD.set(osId, { ativo_id: d.ativo_id, checklist: chk });
  renderMntOS();
}

if (typeof window !== "undefined") { window.ATV = ATV; window.AGE = AGE; window.OSD = OSD; window.mnt2Ready = mnt2Ready; }
