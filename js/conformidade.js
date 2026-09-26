// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// e9 — Manutenção 2.0: garantias e conformidade. Porta os garantias_nbr_* e relatorios_conformidade
// do maintenance-flux. CONSOLIDA com o que já existe (sem duplicar): reaproveita o catálogo NBR 17170
// (GARANTIAS / GAR.listarGarantias), os fornecedores (GAR.fornecedores), os ativos (ATV) e a
// conformidade da manutenção preventiva (MNT.conformidade). Mesmo padrão offline-first do e8: stores
// via cbColecao (localStorage + Supabase via try/catch que degrada sozinho enquanto a migration 0029
// não foi aplicada). Origem rastreável: github.com/pessoa1234-brazil/maintenance-flux.

// ---------- Stores (reaproveitam a fábrica cbColecao, que desde a a52 P2 mora no js/colecao.js) ----------
function rowToGarReg(r) {
  return {
    id: r.id, ativo_id: r.ativo_id || "", empreendimento: r.empreendimento || "", unidade: r.unidade || "",
    sistema: r.sistema, categoria: r.categoria || "", catalogo_id: r.catalogo_id || "",
    tipo: r.tipo || "oferecida", prazo_anos: r.prazo_anos != null ? Number(r.prazo_anos) : 1,
    inicio: r.inicio || "", fornecedor_id: r.fornecedor_id || "", observacoes: r.observacoes || "", dono: r.user_id
  };
}
function garRegToRow(g) {
  return {
    id: g.id, user_id: g.dono || CBStore.uid(), ativo_id: g.ativo_id || null,
    empreendimento: g.empreendimento || null, unidade: g.unidade || null, sistema: g.sistema,
    categoria: g.categoria || null, catalogo_id: g.catalogo_id || null, tipo: g.tipo || "oferecida",
    prazo_anos: Number(g.prazo_anos) || 1, inicio: g.inicio || null, fornecedor_id: g.fornecedor_id || null,
    observacoes: g.observacoes || null
  };
}
function rowToRelConf(r) {
  return {
    id: r.id, titulo: r.titulo, empreendimento: r.empreendimento || "", referencia_em: r.referencia_em || "",
    dados: r.dados || {}, observacoes: r.observacoes || "", created_at: r.created_at || "", dono: r.user_id
  };
}
function relConfToRow(r) {
  return {
    id: r.id, user_id: r.dono || CBStore.uid(), titulo: r.titulo, empreendimento: r.empreendimento || null,
    referencia_em: r.referencia_em || new Date().toISOString().slice(0, 10), dados: r.dados || {},
    observacoes: r.observacoes || null
  };
}

const GREG = cbColecao("garantias_registro", "cb-gar-registro", rowToGarReg, garRegToRow);
const RELC = cbColecao("relatorios_conformidade", "cb-rel-conformidade", rowToRelConf, relConfToRow);

async function conf2Ready() { await Promise.all([GREG.ready(), RELC.ready()]); }

// ---------- Vigência (mesma regra do GAR, mas a partir de um início explícito) ----------
function vigenciaCalc(inicioStr, prazoAnos) {
  if (!inicioStr) return { status: "sem-data" };
  const inicio = new Date(inicioStr + "T12:00");
  if (isNaN(inicio.getTime())) return { status: "sem-data" };
  const vence = new Date(inicio); vence.setFullYear(vence.getFullYear() + Number(prazoAnos || 0));
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const dias = Math.ceil((vence - hoje) / 86400000);
  if (dias < 0) return { status: "vencida", dias: -dias, vence };
  if (dias <= 90) return { status: "vencendo", dias, vence };
  return { status: "vigente", dias, vence };
}
// Início efetivo de uma garantia registrada: o seu próprio, senão a instalação do ativo, senão a
// data de entrega/habite-se do projeto (garantia_config) — consolida com o módulo de garantias atual.
function garRegInicio(g) {
  if (g.inicio) return g.inicio;
  const a = g.ativo_id && typeof ATV !== "undefined" ? ATV.get(g.ativo_id) : null;
  if (a && a.instalado_em) return a.instalado_em;
  return (typeof GAR !== "undefined" && GAR.inicioGarantias) ? (GAR.inicioGarantias() || "") : "";
}
function garRegStats(itens) {
  const lista = itens || GREG.listar();
  const r = { total: 0, vigentes: 0, vencendo: 0, vencidas: 0, semData: 0, listaVencendo: [], listaVencidas: [] };
  lista.forEach(g => {
    r.total++;
    const v = vigenciaCalc(garRegInicio(g), g.prazo_anos);
    if (v.status === "vigente") r.vigentes++;
    else if (v.status === "vencendo") { r.vigentes++; r.vencendo++; r.listaVencendo.push({ sistema: g.sistema, dias: v.dias }); }
    else if (v.status === "vencida") { r.vencidas++; r.listaVencidas.push({ sistema: g.sistema, dias: v.dias }); }
    else r.semData++;
  });
  return r;
}

// ════════════════════════ Garantias registradas (seção dentro da aba Garantias) ════════════════════════
let _garRegEdit = null;   // null = fechado | "new" | id

// Chamado por renderGarantias (garantias.js) via typeof-guard — preenche #gar-registro-host.
function renderGarantiasRegistro() {
  const host = document.getElementById("gar-registro-host");
  if (!host) return;
  const itens = GREG.listar();
  const s = garRegStats(itens);
  host.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:4px">
        <h3 style="margin:0"><i class="ti ti-shield-check"></i> Garantias registradas (por ativo/unidade)</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${typeof EXEMPLO !== "undefined" ? EXEMPLO.botaoBarraHTML("garantias") : ""}
          ${_garRegEdit ? "" : `<button class="btn primary" onclick="_garRegEdit='new';renderGarantiasRegistro()"><i class="ti ti-plus"></i> Registrar garantia</button>`}
        </div>
      </div>
      <p class="page-sub" style="margin:0 0 10px">Garantias reais do empreendimento vinculadas a um ativo/unidade, com início, prazo, fornecedor e alerta de vigência próprios.${itens.length ? ` <strong style="color:var(--teal)">${s.vigentes}</strong> vigentes${s.vencendo ? ` · <strong style="color:var(--amber)">${s.vencendo}</strong> vencendo` : ""} · <strong style="color:${s.vencidas ? "var(--red)" : "var(--text-2)"}">${s.vencidas}</strong> vencidas.` : ""}</p>
      ${_garRegEdit ? garRegFormHTML(_garRegEdit === "new" ? null : GREG.get(_garRegEdit)) : ""}
      ${itens.length ? garRegListaHTML(itens) : (_garRegEdit ? "" : (typeof EXEMPLO !== "undefined" ? EXEMPLO.vazioHTML("garantias", {
        icone: "ti-shield-check", titulo: "Registre as garantias da obra",
        texto: "Prazo por sistema (impermeabilização, esquadrias, instalações…), contado do habite-se ou da entrega. O catálogo da NBR 17170 preenche em um clique e o Civilbook mostra o que está vencendo.",
        ctaLabel: "Registrar a primeira garantia", ctaAcao: "_garRegEdit='new';renderGarantiasRegistro()",
      }) : `<p class="page-sub" style="padding:6px 0;color:var(--text-3)">Nenhuma garantia registrada. Clique em “Registrar garantia” — use “Aplicar do catálogo NBR 17170” para preencher rápido.</p>`))}
    </div>
    <div id="gar-confer-host"></div>`;
  if (itens.length && !_garRegEdit && typeof CONFER !== "undefined") {   // f17: conferir a garantia mais recente
    const g0 = itens[0];
    CONFER.montarCard("gar-confer-host", { alvoTipo: "garantia", alvoId: g0.id, projetoId: null, titulo: "Garantia: " + (g0.sistema || ""), dados: () => garRegDadosConferencia(g0) });
  }
}

// f17 — dados estruturados de UMA garantia registrada para a conferência de conformidade.
function garRegDadosConferencia(g) {
  if (!g) return "";
  return `Garantia registrada — ${g.sistema || "?"}\n`
    + (g.categoria ? `Categoria: ${g.categoria}\n` : "")
    + `Tipo: ${g.tipo === "legal" ? "legal (solidez/seguranca)" : "oferecida"}\n`
    + `Prazo: ${g.prazo_anos} ano(s)\n`
    + (g.inicio ? `Inicio: ${g.inicio}\n` : "")
    + (g.empreendimento ? `Empreendimento: ${g.empreendimento}\n` : "")
    + (g.unidade ? `Unidade: ${g.unidade}\n` : "")
    + (g.observacoes ? `Observacoes: ${g.observacoes}\n` : "");
}

function garRegListaHTML(itens) {
  const fornNome = id => { const f = (typeof GAR !== "undefined" ? GAR.fornecedores() : []).find(x => x.id === id); return f ? (f.empresa || f.servico) : ""; };
  const corStat = { vigente: "teal", vencendo: "amber", vencida: "red", "sem-data": "gray" };
  // agrupa por empreendimento (herda do ativo quando o registro não tem)
  const grupos = {};
  itens.forEach(g => {
    const at = g.ativo_id && typeof ATV !== "undefined" ? ATV.get(g.ativo_id) : null;
    const emp = g.empreendimento || (at && at.empreendimento) || "Sem empreendimento";
    (grupos[emp] = grupos[emp] || []).push(g);
  });
  return Object.keys(grupos).sort().map(emp => `
    <div style="margin-top:8px">
      <div class="ativo-uni" style="margin-bottom:6px"><i class="ti ti-building-community"></i> ${esc(emp)}</div>
      ${grupos[emp].map(g => {
        const ini = garRegInicio(g);
        const v = vigenciaCalc(ini, g.prazo_anos);
        const at = g.ativo_id && typeof ATV !== "undefined" ? ATV.get(g.ativo_id) : null;
        const fn = fornNome(g.fornecedor_id);
        const pillV = v.status === "vencida" ? `Vencida há ${v.dias}d` : v.status === "vencendo" ? `Vence em ${v.dias}d` : v.status === "vigente" ? "Vigente" : "Defina o início";
        return `<div class="ativo-item">
          <div style="flex:1;min-width:200px">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <strong>${esc(g.sistema)}</strong>
              ${g.tipo === "legal" ? `<span class="pill pill-red">Legal · 5 anos</span>` : `<span class="pill pill-blue">Oferecida</span>`}
              <span class="pill pill-${corStat[v.status]}">${pillV}</span>
            </div>
            <p style="font-size:12.5px;color:var(--text-2);margin-top:3px">
              ${g.unidade ? `<i class="ti ti-stack-2"></i> ${esc(g.unidade)} · ` : ""}${at ? `<i class="ti ti-package"></i> ${esc(at.nome)} · ` : ""}${g.prazo_anos} ${Number(g.prazo_anos) === 1 ? "ano" : "anos"}${ini ? ` · início ${new Date(ini + "T12:00").toLocaleDateString("pt-BR")}` : ""}${v.vence ? ` · vence ${v.vence.toLocaleDateString("pt-BR")}` : ""}
            </p>
            ${fn ? `<p style="font-size:12.5px;color:var(--text-3)"><i class="ti ti-truck"></i> ${esc(fn)}</p>` : ""}
            ${g.observacoes ? `<p style="font-size:12.5px;color:var(--text-3)">${esc(g.observacoes)}</p>` : ""}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start">
            <button class="btn" onclick="_garRegEdit='${g.id}';renderGarantiasRegistro()"><i class="ti ti-edit"></i></button>
            <button class="btn icon-only" title="Excluir" onclick="excluirGarReg('${g.id}')"><i class="ti ti-trash"></i></button>
          </div>
        </div>`;
      }).join("")}
    </div>`).join("");
}

function garRegFormHTML(g) {
  const v = (k, d) => esc(g && g[k] != null && g[k] !== "" ? g[k] : (d || ""));
  const forn = (typeof GAR !== "undefined" ? GAR.fornecedores() : []);
  const cats = (typeof GARANTIAS_CATEGORIAS !== "undefined" ? GARANTIAS_CATEGORIAS.concat(["Personalizado"]) : ["Personalizado"]);
  const catalogo = (typeof GAR !== "undefined" && GAR.listarGarantias) ? GAR.listarGarantias() : [];
  return `
    <div class="card" style="border:1.5px solid var(--blue);margin:6px 0 12px">
      <h4 style="margin:0 0 10px">${g ? "Editar" : "Nova"} garantia registrada</h4>
      <div class="field">
        <label>Aplicar do catálogo NBR 17170 (opcional — preenche os campos abaixo)</label>
        <select id="greg-cat" onchange="garRegAplicarCatalogo(this.value)">
          <option value="">— escolher um sistema do catálogo —</option>
          ${catalogo.map(c => `<option value="${esc(c.id)}">${esc(c.sistema)} · ${c.prazo} ${c.prazo === 1 ? "ano" : "anos"}${c.tipo === "legal" ? " (legal)" : ""}</option>`).join("")}
        </select>
      </div>
      <div class="field-row">
        <div class="field"><label>Ativo (opcional)</label><select id="greg-ativo" onchange="garRegAtivoChange(this.value)">${typeof ativoOptions === "function" ? ativoOptions(g ? g.ativo_id : "") : `<option value="">— sem ativo —</option>`}</select></div>
        <div class="field"><label>Sistema / item *</label><input type="text" id="greg-sistema" value="${v("sistema")}" placeholder="ex.: Impermeabilização da laje"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Empreendimento</label><input type="text" id="greg-emp" value="${v("empreendimento")}" placeholder="ex.: Edifício Aurora"></div>
        <div class="field"><label>Unidade / setor</label><input type="text" id="greg-uni" value="${v("unidade")}" placeholder="ex.: Torre A / Cobertura"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Categoria</label><select id="greg-categoria">${cats.map(c => `<option${g && g.categoria === c ? " selected" : ""}>${c}</option>`).join("")}</select></div>
        <div class="field"><label>Tipo</label><select id="greg-tipo"><option value="oferecida"${g && g.tipo === "oferecida" ? " selected" : ""}>Oferecida</option><option value="legal"${g && g.tipo === "legal" ? " selected" : ""}>Legal (solidez/segurança · 5 anos)</option></select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Prazo (anos) *</label><input type="number" id="greg-prazo" min="0" step="0.5" value="${v("prazo_anos", "1")}"></div>
        <div class="field"><label>Início da garantia</label><input type="date" id="greg-inicio" value="${v("inicio")}"><span style="font-size:11.5px;color:var(--text-3)">Vazio = herda do ativo (instalação) ou da entrega do projeto.</span></div>
      </div>
      <div class="field"><label>Fornecedor responsável (opcional)</label>
        <select id="greg-forn"><option value="">— nenhum —</option>${forn.map(f => `<option value="${esc(f.id)}"${g && g.fornecedor_id === f.id ? " selected" : ""}>${esc(f.empresa || f.servico)}${f.empresa && f.servico ? " · " + esc(f.servico) : ""}</option>`).join("")}</select>
      </div>
      <div class="field"><label>Observações</label><textarea id="greg-obs" rows="2">${v("observacoes")}</textarea></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn primary" onclick="salvarGarReg()"><i class="ti ti-device-floppy"></i> ${g ? "Salvar" : "Registrar"}</button>
        <button class="btn" onclick="_garRegEdit=null;renderGarantiasRegistro()">Cancelar</button>
      </div>
    </div>`;
}

// Preenche o formulário a partir de um item do catálogo NBR 17170 (sem duplicar o catálogo).
function garRegAplicarCatalogo(id) {
  if (!id || typeof GAR === "undefined" || !GAR.listarGarantias) return;
  const c = GAR.listarGarantias().find(x => x.id === id);
  if (!c) return;
  const set = (eid, val) => { const e = document.getElementById(eid); if (e) e.value = val; };
  set("greg-sistema", c.sistema);
  set("greg-prazo", c.prazo);
  const tp = document.getElementById("greg-tipo"); if (tp) tp.value = (c.tipo === "legal" ? "legal" : "oferecida");
  const cat = document.getElementById("greg-categoria");
  if (cat && c.categoria) [...cat.options].forEach(o => { if (o.value === c.categoria || o.text === c.categoria) cat.value = o.value; });
  const sis = document.getElementById("greg-sistema"); if (sis) sis.dataset.catalogoId = id;   // p/ rastreabilidade ao salvar
}
// Ao escolher um ativo, herda empreendimento/unidade se os campos estiverem vazios.
function garRegAtivoChange(id) {
  if (!id || typeof ATV === "undefined") return;
  const a = ATV.get(id); if (!a) return;
  const emp = document.getElementById("greg-emp"), uni = document.getElementById("greg-uni");
  if (emp && !emp.value && a.empreendimento) emp.value = a.empreendimento;
  if (uni && !uni.value && a.unidade) uni.value = a.unidade;
}

function salvarGarReg() {
  const sisEl = document.getElementById("greg-sistema");
  const sistema = sisEl.value.trim();
  if (!sistema) { sisEl.focus(); toast("Informe o sistema/item da garantia.", "warn"); return; }
  const base = (_garRegEdit && _garRegEdit !== "new") ? GREG.get(_garRegEdit) : null;
  GREG.upsert({
    id: base ? base.id : CBStore.uuid(),
    dono: base ? base.dono : CBStore.uid(),
    ativo_id: document.getElementById("greg-ativo").value,
    empreendimento: document.getElementById("greg-emp").value.trim(),
    unidade: document.getElementById("greg-uni").value.trim(),
    sistema,
    categoria: document.getElementById("greg-categoria").value,
    catalogo_id: (sisEl.dataset.catalogoId) || (base ? base.catalogo_id : ""),
    tipo: document.getElementById("greg-tipo").value,
    prazo_anos: Number(document.getElementById("greg-prazo").value) || 1,
    inicio: document.getElementById("greg-inicio").value,
    fornecedor_id: document.getElementById("greg-forn").value,
    observacoes: document.getElementById("greg-obs").value.trim()
  });
  _garRegEdit = null;
  toast(base ? "Garantia atualizada." : "Garantia registrada.", "success");
  renderGarantiasRegistro();
}
async function excluirGarReg(id) {
  const g = GREG.get(id);
  if (!g) return;
  if (!await cbConfirmar(`Excluir a garantia registrada "${g.sistema}"?`)) return;
  GREG.remover(id);
  toast("Garantia excluída.", "info");
  renderGarantiasRegistro();
}

// ════════════════════════ Relatório de conformidade (aba própria) ════════════════════════
let _confEmp = "";   // filtro de empreendimento (vazio = todos)

// Snapshot consolidado: manutenção preventiva (NBR 5674) + garantias (NBR 17170) + agendamentos + OS.
function conformidadeSnapshot(filtroEmp) {
  const mnt = (typeof MNT !== "undefined" && MNT.conformidade) ? MNT.conformidade() : { total: 0, emDia: 0, vencidas: 0, semRegistro: 0, pct: 0 };
  let greg = GREG.listar();
  if (filtroEmp) greg = greg.filter(g => {
    const at = g.ativo_id && typeof ATV !== "undefined" ? ATV.get(g.ativo_id) : null;
    return (g.empreendimento || (at && at.empreendimento) || "") === filtroEmp;
  });
  const garantias = garRegStats(greg);
  const hojeStr = new Date().toISOString().slice(0, 10);
  const age = (typeof AGE !== "undefined") ? AGE.listar() : [];
  const agendamentos = {
    abertos: age.filter(a => a.status === "agendado").length,
    atrasados: age.filter(a => a.status === "agendado" && a.data && a.data < hojeStr).length
  };
  const osAt = (typeof MNT !== "undefined" && MNT.osAtencao) ? MNT.osAtencao() : { vencidas: [], proximas: [] };
  const osAbertas = (typeof MNT !== "undefined") ? MNT.listarOS().filter(o => o.status === "aberta" || o.status === "andamento").length : 0;
  return { mnt, garantias, agendamentos, os: { abertas: osAbertas, vencidas: osAt.vencidas.length, proximas: osAt.proximas.length } };
}

function conformidadeEmpreendimentos() {
  const set = new Set();
  if (typeof ATV !== "undefined") ATV.listar().forEach(a => { if (a.empreendimento) set.add(a.empreendimento); });
  GREG.listar().forEach(g => { if (g.empreendimento) set.add(g.empreendimento); });
  return [...set].sort();
}

function renderMntConformidade() {
  const body = document.getElementById("mnt-body");
  if (!body) return;
  const snap = conformidadeSnapshot(_confEmp);
  const m = snap.mnt, g = snap.garantias;
  const corPct = m.pct >= 80 ? "var(--teal)" : m.pct >= 50 ? "var(--amber)" : "var(--red)";
  const emps = conformidadeEmpreendimentos();
  const hojeStr = new Date().toISOString().slice(0, 10);
  const hist = RELC.listar().slice().sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "") || (b.referencia_em || "").localeCompare(a.referencia_em || ""));
  const card = (n, label, cor, extra) => `<div class="card" style="text-align:center"><div style="font-size:32px;font-weight:600;color:${cor}">${n}</div><p>${label}${extra || ""}</p></div>`;
  body.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <h3 style="margin:0 0 4px"><i class="ti ti-clipboard-check"></i> Relatório de conformidade</h3>
      <p class="page-sub" style="margin:0 0 12px">Consolida a manutenção preventiva (NBR 5674) e as garantias (NBR 17170) do empreendimento em um documento exportável (imprimir / salvar PDF).</p>
      <div class="field-row">
        <div class="field"><label>Título do relatório</label><input type="text" id="conf-titulo" value="Relatório de conformidade — manutenção e garantias"></div>
        <div class="field"><label>Empreendimento</label>
          <select id="conf-emp" onchange="_confEmp=this.value;renderMntConformidade()">
            <option value=""${_confEmp === "" ? " selected" : ""}>Todos</option>
            ${emps.map(e => `<option value="${esc(e)}"${_confEmp === e ? " selected" : ""}>${esc(e)}</option>`).join("")}
          </select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Data-base</label><input type="date" id="conf-data" value="${hojeStr}"></div>
        <div class="field"><label>Observações (opcional)</label><input type="text" id="conf-obs" placeholder="ex.: pendências priorizadas para o próximo mês"></div>
      </div>
      <button class="btn primary" onclick="gerarRelatorioConformidade()"><i class="ti ti-file-plus"></i> Gerar e salvar relatório</button>
    </div>

    <div class="grid grid-3" style="margin-bottom:14px">
      ${card(m.pct + "%", "Aderência ao plano preventivo", corPct)}
      ${card(g.vigentes, "Garantias vigentes", "var(--teal)", g.vencendo ? ` <span class="pill pill-amber">${g.vencendo} vencendo</span>` : "")}
      ${card(g.vencidas, "Garantias vencidas", g.vencidas ? "var(--red)" : "var(--teal)")}
    </div>
    <div class="grid grid-3" style="margin-bottom:14px">
      ${card(m.vencidas, "Atividades preventivas vencidas", m.vencidas ? "var(--red)" : "var(--teal)")}
      ${card(snap.agendamentos.atrasados, "Agendamentos atrasados", snap.agendamentos.atrasados ? "var(--red)" : "var(--blue)")}
      ${card(snap.os.vencidas, "OS com prazo vencido", snap.os.vencidas ? "var(--red)" : "var(--blue)")}
    </div>

    <div class="card">
      <h3 style="margin:0 0 8px"><i class="ti ti-history"></i> Relatórios salvos</h3>
      ${hist.length ? hist.map(r => `
        <div class="ativo-item">
          <div style="flex:1;min-width:200px">
            <strong>${esc(r.titulo)}</strong>
            <p style="font-size:12.5px;color:var(--text-2);margin-top:2px">${r.empreendimento ? esc(r.empreendimento) + " · " : ""}Data-base ${r.referencia_em ? new Date(r.referencia_em + "T12:00").toLocaleDateString("pt-BR") : "—"}${r.created_at ? " · emitido " + new Date(r.created_at).toLocaleDateString("pt-BR") : ""}</p>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn" onclick="verRelatorioConformidade('${r.id}')"><i class="ti ti-eye"></i> Ver</button>
            <button class="btn icon-only" title="Excluir" onclick="excluirRelatorioConformidade('${r.id}')"><i class="ti ti-trash"></i></button>
          </div>
        </div>`).join("") : `<p class="page-sub" style="padding:8px 0;color:var(--text-3)">Nenhum relatório salvo. Gere o primeiro acima.</p>`}
    </div>`;
}

function gerarRelatorioConformidade() {
  const titulo = (document.getElementById("conf-titulo").value || "").trim() || "Relatório de conformidade";
  const emp = _confEmp;
  const data = document.getElementById("conf-data").value || new Date().toISOString().slice(0, 10);
  const obs = (document.getElementById("conf-obs").value || "").trim();
  const rel = {
    id: CBStore.uuid(), dono: CBStore.uid(), titulo, empreendimento: emp, referencia_em: data,
    dados: conformidadeSnapshot(emp), observacoes: obs, created_at: new Date().toISOString()
  };
  RELC.upsert(rel);
  toast("Relatório gerado e salvo.", "success");
  verRelatorioConformidade(rel.id);
}

function verRelatorioConformidade(id) {
  const rel = RELC.get(id);
  if (!rel) { toast("Relatório não encontrado.", "warn"); return; }
  const body = document.getElementById("mnt-body");
  if (!body) return;
  body.innerHTML = `
    <div class="no-print" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
      <button class="btn" onclick="renderMntConformidade()"><i class="ti ti-arrow-left"></i> Voltar</button>
      <button class="btn primary" onclick="window.print()"><i class="ti ti-printer"></i> Imprimir / salvar PDF</button>
    </div>
    ${relatorioDocHTML(rel)}`;
  body.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function excluirRelatorioConformidade(id) {
  if (!await cbConfirmar("Excluir este relatório salvo?")) return;
  RELC.remover(id);
  toast("Relatório excluído.", "info");
  renderMntConformidade();
}

// Documento imprimível (folha branca via .laudo-print). Reaproveita .conf-item (break-inside no print).
function relatorioDocHTML(rel) {
  const d = rel.dados || {};
  const m = d.mnt || {}, g = d.garantias || {}, ag = d.agendamentos || {}, os = d.os || {};
  const dataBase = rel.referencia_em ? new Date(rel.referencia_em + "T12:00").toLocaleDateString("pt-BR") : "—";
  const emitido = rel.created_at ? new Date(rel.created_at).toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR");
  const corPct = (m.pct || 0) >= 80 ? "var(--teal)" : (m.pct || 0) >= 50 ? "var(--amber)" : "var(--red)";
  const linha = (label, val, cor) => `<div class="conf-item" style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text-2)">${label}</span><strong style="color:${cor || "var(--text)"}">${val}</strong></div>`;
  return `
    <div class="card laudo-print" data-cb-view="conf-doc">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;border-bottom:2px solid var(--blue);padding-bottom:10px;margin-bottom:14px">
        <div><div style="font-size:13px;color:var(--blue);font-weight:700;letter-spacing:.04em">CIVILBOOK</div>
          <h2 style="margin:2px 0 0">${esc(rel.titulo || "Relatório de conformidade")}</h2></div>
        <div style="text-align:right;font-size:12.5px;color:var(--text-2)">
          ${rel.empreendimento ? `<div><strong>${esc(rel.empreendimento)}</strong></div>` : `<div>Todos os empreendimentos</div>`}
          <div>Data-base: ${dataBase}</div>
          <div>Emitido em: ${emitido}</div>
        </div>
      </div>

      <h3 style="margin:0 0 8px"><i class="ti ti-gauge"></i> Manutenção preventiva — NBR 5674</h3>
      ${linha("Aderência ao plano preventivo", (m.pct || 0) + "%", corPct)}
      ${linha("Atividades em dia", (m.emDia || 0) + " de " + (m.total || 0))}
      ${linha("Atividades vencidas", (m.vencidas || 0), m.vencidas ? "var(--red)" : "var(--teal)")}
      ${linha("Sem registro de execução", (m.semRegistro || 0))}

      <h3 style="margin:16px 0 8px"><i class="ti ti-shield-check"></i> Garantias — NBR 17170</h3>
      ${linha("Garantias registradas", (g.total || 0))}
      ${linha("Vigentes", (g.vigentes || 0) + (g.vencendo ? ` (${g.vencendo} vencendo em ≤90 dias)` : ""), "var(--teal)")}
      ${linha("Vencidas", (g.vencidas || 0), g.vencidas ? "var(--red)" : "var(--teal)")}
      ${(g.listaVencendo && g.listaVencendo.length) ? `<p style="font-size:12.5px;color:var(--amber);margin:6px 0 0"><strong>Vencendo:</strong> ${g.listaVencendo.map(x => esc(x.sistema) + " (" + x.dias + "d)").join("; ")}</p>` : ""}
      ${(g.listaVencidas && g.listaVencidas.length) ? `<p style="font-size:12.5px;color:var(--red);margin:6px 0 0"><strong>Vencidas:</strong> ${g.listaVencidas.map(x => esc(x.sistema) + " (há " + x.dias + "d)").join("; ")}</p>` : ""}

      <h3 style="margin:16px 0 8px"><i class="ti ti-calendar"></i> Agendamentos e ordens de serviço</h3>
      ${linha("Agendamentos abertos", (ag.abertos || 0) + (ag.atrasados ? ` (${ag.atrasados} atrasados)` : ""), ag.atrasados ? "var(--red)" : "var(--text)")}
      ${linha("OS abertas ou em andamento", (os.abertas || 0))}
      ${linha("OS com prazo vencido", (os.vencidas || 0), os.vencidas ? "var(--red)" : "var(--teal)")}
      ${linha("OS vencendo (≤7 dias)", (os.proximas || 0))}

      ${rel.observacoes ? `<h3 style="margin:16px 0 8px"><i class="ti ti-note"></i> Observações</h3><p style="font-size:13.5px;white-space:pre-wrap">${esc(rel.observacoes)}</p>` : ""}

      <p style="font-size:11.5px;color:var(--text-3);margin-top:18px;border-top:1px solid var(--border);padding-top:10px">
        Relatório gerado pelo Civilbook a partir dos registros de manutenção (NBR 5674) e de garantias (NBR 17170) do usuário, na data-base indicada. Documento de apoio — não substitui a vistoria nem o parecer de um profissional habilitado (responsável técnico). Os prazos de garantia são de referência (ABNT NBR 17170:2022); confirme no contrato e no manual de uso, operação e manutenção da obra.
      </p>
    </div>`;
}

if (typeof window !== "undefined") {
  window.GREG = GREG; window.RELC = RELC; window.conf2Ready = conf2Ready;
  window.renderGarantiasRegistro = renderGarantiasRegistro; window.renderMntConformidade = renderMntConformidade;
}
