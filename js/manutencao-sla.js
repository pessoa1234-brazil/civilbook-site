// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// e11 — Manutenção 2.0: SLA, alertas, painel/BI e exportação. Enriquece a aba "Visão geral" com um
// PAINEL: KPIs + gráficos (OS por status, cumprimento de SLA), ALERTAS consolidados (SLA violado/em
// risco, garantias vencendo, agendamentos atrasados, preventivas vencidas), CONFIGURAÇÃO de SLA e
// EXPORT CSV (OS/agendamentos/garantias). Os alertas são calculados no cliente (offline-first); o
// e-mail é enviado pela Edge Function manutencao-alertas (segredo do provedor SÓ na função).
// Reaproveita MNT (e8), GREG/vigenciaCalc (e9), AGE/ATV (e8). Origem: github.com/pessoa1234-brazil/maintenance-flux.

// ---------- Configuração de SLA (1 linha por usuário, no padrão do GAR) ----------
const SLA = {
  KEY: "cb-sla-cfg", _cfg: null, _loaded: false,
  DEF_PRAZOS: { baixa: 120, media: 72, alta: 24, urgente: 8 },   // horas p/ conclusão
  _def() { return { prazos: { ...this.DEF_PRAZOS }, notificar_email: false, email: "", alerta_garantia_dias: 90, alerta_agendamento_dias: 7 }; },
  _fromRow(r) {
    return {
      prazos: (r.prazos && typeof r.prazos === "object") ? r.prazos : { ...this.DEF_PRAZOS },
      notificar_email: !!r.notificar_email, email: r.email || "",
      alerta_garantia_dias: r.alerta_garantia_dias || 90, alerta_agendamento_dias: r.alerta_agendamento_dias || 7
    };
  },
  async load() {
    const local = CBStore.lsGet(this.KEY, null);
    if (CBStore.online()) {
      try {
        const { data, error } = await window.supa.from("sla_configuracao").select("*").eq("user_id", CBStore.uid()).maybeSingle();
        if (error) throw error;
        this._cfg = data ? this._fromRow(data) : (local || this._def());
        CBStore.lsSet(this.KEY, this._cfg); this._loaded = true; return;
      } catch (e) { console.warn("SLA.load:", e && e.message); }
    }
    this._cfg = local || this._def(); this._loaded = true;
  },
  async ready() { if (!this._loaded) await this.load(); return this._loaded; },
  cfg() { return this._cfg || this._def(); },
  async salvar(patch) {
    this._cfg = { ...this.cfg(), ...patch };
    CBStore.lsSet(this.KEY, this._cfg);
    if (CBStore.online()) {
      const c = this._cfg;
      const { error } = await window.supa.from("sla_configuracao").upsert({
        user_id: CBStore.uid(), prazos: c.prazos, notificar_email: c.notificar_email, email: c.email || null,
        alerta_garantia_dias: c.alerta_garantia_dias, alerta_agendamento_dias: c.alerta_agendamento_dias,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });
      if (error) console.warn("SLA.salvar:", error.message);
    }
  }
};
async function slaReady() { await SLA.ready(); }

// Situação de SLA de uma OS aberta: ok | risco | violado | na (concluída/cancelada) | sem (sem prazo def.)
function slaStatusOS(o) {
  if (!o || o.status === "concluida" || o.status === "cancelada") return { st: "na" };
  const horas = Number((SLA.cfg().prazos || {})[o.prioridade]);
  if (!horas || !o.criadaEm) return { st: "sem" };
  const decorridas = (Date.now() - o.criadaEm) / 3600000;
  if (decorridas > horas) return { st: "violado", horas: Math.round(decorridas - horas) };
  if (decorridas > horas * 0.8) return { st: "risco", horas: Math.round(horas - decorridas) };
  return { st: "ok", horas: Math.round(horas - decorridas) };
}
function slaResumo() {
  const r = { ok: 0, risco: 0, violado: 0, sem: 0, abertas: 0 };
  (typeof MNT !== "undefined" ? MNT.listarOS() : []).forEach(o => {
    if (o.status === "concluida" || o.status === "cancelada") return;
    r.abertas++;
    const s = slaStatusOS(o).st;
    if (r[s] != null) r[s]++;
  });
  return r;
}

// ---------- Alertas consolidados (client-side) ----------
function mntAlertas() {
  const out = [];
  const cfg = SLA.cfg();
  // SLA das OS
  (typeof MNT !== "undefined" ? MNT.listarOS() : []).forEach(o => {
    const s = slaStatusOS(o);
    if (s.st === "violado") out.push({ cor: "red", icone: "ti-alarm", txt: `OS-${String(o.num).padStart(3, "0")} “${o.titulo}” estourou o SLA há ${s.horas}h.` });
    else if (s.st === "risco") out.push({ cor: "amber", icone: "ti-clock-exclamation", txt: `OS-${String(o.num).padStart(3, "0")} “${o.titulo}” vence o SLA em ${s.horas}h.` });
  });
  // Agendamentos atrasados / próximos
  const hojeStr = new Date().toISOString().slice(0, 10);
  const limite = new Date(); limite.setDate(limite.getDate() + (cfg.alerta_agendamento_dias || 7));
  const limStr = limite.toISOString().slice(0, 10);
  (typeof AGE !== "undefined" ? AGE.listar() : []).forEach(g => {
    if (g.status !== "agendado" || !g.data) return;
    if (g.data < hojeStr) out.push({ cor: "red", icone: "ti-calendar-x", txt: `Agendamento atrasado: “${g.titulo}” (${new Date(g.data + "T12:00").toLocaleDateString("pt-BR")}).` });
    else if (g.data <= limStr) out.push({ cor: "amber", icone: "ti-calendar-due", txt: `Agendamento próximo: “${g.titulo}” (${new Date(g.data + "T12:00").toLocaleDateString("pt-BR")}).` });
  });
  // Garantias vencendo/vencidas (reaproveita e9)
  if (typeof GREG !== "undefined" && typeof vigenciaCalc === "function" && typeof garRegInicio === "function") {
    GREG.listar().forEach(gr => {
      const v = vigenciaCalc(garRegInicio(gr), gr.prazo_anos);
      if (v.status === "vencida") out.push({ cor: "red", icone: "ti-shield-x", txt: `Garantia vencida: “${gr.sistema}” (há ${v.dias} dias).` });
      else if (v.status === "vencendo" && v.dias <= (cfg.alerta_garantia_dias || 90)) out.push({ cor: "amber", icone: "ti-shield-half", txt: `Garantia vencendo: “${gr.sistema}” em ${v.dias} dias.` });
    });
  }
  // Preventivas vencidas (NBR 5674)
  if (typeof MNT !== "undefined" && MNT.conformidade) {
    const c = MNT.conformidade();
    if (c.vencidas) out.push({ cor: "red", icone: "ti-tools-off", txt: `${c.vencidas} atividade(s) preventiva(s) vencida(s) no plano NBR 5674.` });
  }
  return out;
}

// ════════════════════════════ Painel / BI (aba "Visão geral") ════════════════════════════
function renderMntPainel() {
  const body = document.getElementById("mnt-body");
  if (!body) return;
  const os = (typeof MNT !== "undefined" ? MNT.listarOS() : []);
  const conf = (typeof MNT !== "undefined" && MNT.conformidade) ? MNT.conformidade() : { pct: 0, vencidas: 0 };
  const sla = slaResumo();
  const alertas = mntAlertas();
  const gst = (typeof garRegStats === "function") ? garRegStats() : { vigentes: 0, vencidas: 0 };
  const ageAtras = (typeof AGE !== "undefined") ? AGE.listar().filter(g => g.status === "agendado" && g.data && g.data < new Date().toISOString().slice(0, 10)).length : 0;
  const corPct = conf.pct >= 80 ? "var(--teal)" : conf.pct >= 50 ? "var(--amber)" : "var(--red)";
  // contagem OS por status
  const stc = { aberta: 0, andamento: 0, concluida: 0, cancelada: 0 };
  os.forEach(o => { if (stc[o.status] != null) stc[o.status]++; });
  const maxOS = Math.max(1, stc.aberta, stc.andamento, stc.concluida, stc.cancelada);
  const slaTot = Math.max(1, sla.ok + sla.risco + sla.violado + sla.sem);
  const card = (n, label, cor, extra) => `<div class="card" style="text-align:center"><div style="font-size:32px;font-weight:600;color:${cor}">${n}</div><p>${label}${extra || ""}</p></div>`;
  const barra = (label, n, max, cor) => `<div style="margin:6px 0"><div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:2px"><span>${label}</span><strong>${n}</strong></div><div class="progress-bar"><div style="width:${Math.round(n / max * 100)}%;background:${cor}"></div></div></div>`;

  body.innerHTML = `
    <div class="grid grid-3" style="margin-bottom:14px">
      ${card(conf.pct + "%", "Aderência ao plano preventivo", corPct)}
      ${card(sla.violado, "OS com SLA estourado", sla.violado ? "var(--red)" : "var(--teal)", sla.risco ? ` <span class="pill pill-amber">${sla.risco} em risco</span>` : "")}
      ${card(os.filter(o => o.status === "aberta" || o.status === "andamento").length, "OS abertas ou em andamento", "var(--blue)")}
    </div>
    <div class="grid grid-3" style="margin-bottom:14px">
      ${card(gst.vigentes, "Garantias vigentes", "var(--teal)", gst.vencendo ? ` <span class="pill pill-amber">${gst.vencendo} vencendo</span>` : "")}
      ${card(gst.vencidas, "Garantias vencidas", gst.vencidas ? "var(--red)" : "var(--teal)")}
      ${card(ageAtras, "Agendamentos atrasados", ageAtras ? "var(--red)" : "var(--blue)")}
    </div>

    <div class="grid grid-2" style="margin-bottom:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">
      <div class="card">
        <h3 style="margin:0 0 10px"><i class="ti ti-chart-bar"></i> Ordens de serviço por status</h3>
        ${barra("Abertas", stc.aberta, maxOS, "var(--blue)")}
        ${barra("Em andamento", stc.andamento, maxOS, "var(--amber)")}
        ${barra("Concluídas", stc.concluida, maxOS, "var(--teal)")}
        ${barra("Canceladas", stc.cancelada, maxOS, "var(--text-3)")}
      </div>
      <div class="card">
        <h3 style="margin:0 0 10px"><i class="ti ti-gauge"></i> Cumprimento de SLA (OS abertas)</h3>
        ${sla.abertas ? `
          ${barra("Dentro do prazo", sla.ok, slaTot, "var(--teal)")}
          ${barra("Em risco (≥80%)", sla.risco, slaTot, "var(--amber)")}
          ${barra("Estourado", sla.violado, slaTot, "var(--red)")}
          ${sla.sem ? barra("Sem SLA definido", sla.sem, slaTot, "var(--text-3)") : ""}` :
          `<p class="page-sub" style="margin:0">Nenhuma OS aberta para avaliar SLA.</p>`}
      </div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px">
        <h3 style="margin:0"><i class="ti ti-bell"></i> Alertas ${alertas.length ? `<span class="pill pill-red">${alertas.length}</span>` : ""}</h3>
        <button class="btn" onclick="enviarAlertasEmail()"><i class="ti ti-mail"></i> Enviar por e-mail</button>
      </div>
      ${alertas.length ? alertas.map(a => `<div class="cron-item"><div style="flex:1;min-width:200px"><i class="ti ${a.icone}" style="color:var(--${a.cor})"></i> ${esc(a.txt)}</div></div>`).join("") : `<p class="page-sub" style="margin:0;color:var(--teal)"><i class="ti ti-circle-check"></i> Tudo em dia — nenhum alerta no momento.</p>`}
      <div id="sla-email-status" aria-live="polite"></div>
    </div>

    <div class="grid grid-2" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">
      <div class="card">
        <h3 style="margin:0 0 8px"><i class="ti ti-download"></i> Exportar (CSV / Excel)</h3>
        <p class="page-sub" style="margin:0 0 10px">Planilhas abríveis no Excel. O relatório de conformidade em PDF fica na aba <a href="javascript:navigate('manutencao','conformidade')" style="color:var(--blue)">Conformidade</a>.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" onclick="exportarOSCSV()"><i class="ti ti-file-spreadsheet"></i> Ordens de serviço</button>
          <button class="btn" onclick="exportarAgendamentosCSV()"><i class="ti ti-file-spreadsheet"></i> Agendamentos</button>
          <button class="btn" onclick="exportarGarantiasCSV()"><i class="ti ti-file-spreadsheet"></i> Garantias</button>
        </div>
      </div>
      <div class="card">
        <details>
          <summary style="cursor:pointer;font-weight:600"><i class="ti ti-adjustments"></i> Configuração de SLA e notificações</summary>
          ${slaConfigFormHTML()}
        </details>
      </div>
    </div>`;
}

function slaConfigFormHTML() {
  const c = SLA.cfg(), p = c.prazos || {};
  return `
    <p class="page-sub" style="margin:10px 0 8px">Prazo máximo para CONCLUSÃO da OS, em horas, por prioridade.</p>
    <div class="field-row">
      <div class="field"><label>Baixa (h)</label><input type="number" id="sla-baixa" min="1" value="${esc(p.baixa || 120)}"></div>
      <div class="field"><label>Média (h)</label><input type="number" id="sla-media" min="1" value="${esc(p.media || 72)}"></div>
      <div class="field"><label>Alta (h)</label><input type="number" id="sla-alta" min="1" value="${esc(p.alta || 24)}"></div>
      <div class="field"><label>Urgente (h)</label><input type="number" id="sla-urgente" min="1" value="${esc(p.urgente || 8)}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Avisar garantia vencendo em (dias)</label><input type="number" id="sla-gar-dias" min="1" value="${esc(c.alerta_garantia_dias || 90)}"></div>
      <div class="field"><label>Avisar agendamento nos próximos (dias)</label><input type="number" id="sla-age-dias" min="1" value="${esc(c.alerta_agendamento_dias || 7)}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>E-mail para alertas</label><input type="email" id="sla-email" value="${esc(c.email || "")}" placeholder="voce@empresa.com"></div>
      <div class="field" style="display:flex;align-items:flex-end"><label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" id="sla-notif" ${c.notificar_email ? "checked" : ""}> Receber alertas por e-mail</label></div>
    </div>
    <button class="btn primary" onclick="salvarSLA()"><i class="ti ti-device-floppy"></i> Salvar configuração</button>
    <p class="page-sub" style="font-size:11.5px;margin-top:8px"><i class="ti ti-info-circle"></i> O envio de e-mail exige a Edge Function <code>manutencao-alertas</code> deployada + o segredo do provedor (configurado só no servidor).</p>`;
}
function salvarSLA() {
  const num = (id, d) => { const v = parseFloat(document.getElementById(id).value); return isNaN(v) ? d : v; };
  SLA.salvar({
    prazos: { baixa: num("sla-baixa", 120), media: num("sla-media", 72), alta: num("sla-alta", 24), urgente: num("sla-urgente", 8) },
    alerta_garantia_dias: num("sla-gar-dias", 90), alerta_agendamento_dias: num("sla-age-dias", 7),
    email: document.getElementById("sla-email").value.trim(), notificar_email: document.getElementById("sla-notif").checked
  }).then(() => { toast("Configuração de SLA salva.", "success"); renderMntPainel(); });
}

// ---------- Envio dos alertas por e-mail (Edge Function) ----------
async function enviarAlertasEmail() {
  const status = document.getElementById("sla-email-status");
  const alertas = mntAlertas();
  if (!alertas.length) { if (status) status.innerHTML = `<p class="page-sub" style="margin:8px 0 0"><i class="ti ti-circle-check"></i> Sem alertas para enviar.</p>`; return; }
  const C = window.CB_CONFIG || {};
  if (!window.supa || !C.FUNCTIONS_URL) { if (status) status.innerHTML = `<p class="page-sub" style="margin:8px 0 0;color:var(--amber)"><i class="ti ti-alert-triangle"></i> Exige a conta conectada ao backend.</p>`; return; }
  if (!SLA.cfg().notificar_email || !SLA.cfg().email) { if (status) status.innerHTML = `<p class="page-sub" style="margin:8px 0 0;color:var(--amber)"><i class="ti ti-alert-triangle"></i> Configure um e-mail e ative a notificação na seção de SLA abaixo.</p>`; return; }
  const corpo = "Alertas de manutenção (Civilbook) — " + new Date().toLocaleString("pt-BR") + "\n\n" + alertas.map(a => "• " + a.txt).join("\n");
  try {
    const { data: { session } } = await window.supa.auth.getSession();
    const token = session && session.access_token;
    if (!token) { if (status) status.innerHTML = `<p class="page-sub" style="margin:8px 0 0;color:var(--amber)">Faça login.</p>`; return; }
    if (status) status.innerHTML = `<p class="page-sub" style="margin:8px 0 0"><i class="ti ti-loader"></i> Enviando…</p>`;
    const r = await fetch(C.FUNCTIONS_URL + "/manutencao-alertas", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, "apikey": C.SUPABASE_ANON_KEY },
      body: JSON.stringify({ assunto: "Civilbook — " + alertas.length + " alerta(s) de manutenção", corpo }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { if (status) status.innerHTML = `<p class="page-sub" style="margin:8px 0 0;color:var(--amber)"><i class="ti ti-alert-triangle"></i> ${esc(d.error || ("Falha (erro " + r.status + "). A função manutencao-alertas está deployada?"))}</p>`; return; }
    if (status) status.innerHTML = `<p class="page-sub" style="margin:8px 0 0;color:var(--teal)"><i class="ti ti-mail-check"></i> Alertas enviados para ${esc(d.destino || "seu e-mail")}.</p>`;
    toast("Alertas enviados por e-mail.", "success");
  } catch (e) { if (status) status.innerHTML = `<p class="page-sub" style="margin:8px 0 0;color:var(--amber)">Não foi possível enviar agora.</p>`; }
}

// ---------- Export CSV (delimitador ; + BOM p/ Excel pt-BR) ----------
function mntBaixarCSV(nome, headers, linhas) {
  const cel = v => { v = (v == null ? "" : String(v)); return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const csv = [headers.join(";")].concat(linhas.map(r => r.map(cel).join(";"))).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  if (typeof toast === "function") toast("CSV exportado.", "success");
}
function dataBR(s) { return s ? new Date(s + "T12:00").toLocaleDateString("pt-BR") : ""; }
function exportarOSCSV() {
  const os = (typeof MNT !== "undefined" ? MNT.listarOS() : []);
  if (!os.length) { toast("Nenhuma OS para exportar.", "info"); return; }
  const stLabel = id => (typeof OS_STATUS !== "undefined" ? (OS_STATUS.find(s => s.id === id) || {}).label : id) || id;
  const slaLabel = { ok: "No prazo", risco: "Em risco", violado: "Estourado", na: "—", sem: "Sem SLA" };
  const linhas = os.map(o => ["OS-" + String(o.num).padStart(3, "0"), o.titulo, o.tipo, o.prioridade, stLabel(o.status), o.local, o.resp, dataBR(o.prazo), slaLabel[slaStatusOS(o).st] || ""]);
  mntBaixarCSV("civilbook-os.csv", ["Número", "Título", "Tipo", "Prioridade", "Status", "Local", "Responsável", "Prazo", "SLA"], linhas);
}
function exportarAgendamentosCSV() {
  const ags = (typeof AGE !== "undefined" ? AGE.listar() : []);
  if (!ags.length) { toast("Nenhum agendamento para exportar.", "info"); return; }
  const nomeAtivo = id => (typeof ativoNome === "function" ? ativoNome(id) : "");
  const linhas = ags.map(g => [g.titulo, g.atividade, dataBR(g.data), g.periodicidade_meses ? (typeof periodicidadeLabel === "function" ? periodicidadeLabel(Number(g.periodicidade_meses)) : g.periodicidade_meses) : "Pontual", g.resp, nomeAtivo(g.ativo_id), g.status]);
  mntBaixarCSV("civilbook-agendamentos.csv", ["Título", "Atividade", "Data", "Periodicidade", "Responsável", "Ativo", "Status"], linhas);
}
function exportarGarantiasCSV() {
  const gs = (typeof GREG !== "undefined" ? GREG.listar() : []);
  if (!gs.length) { toast("Nenhuma garantia registrada para exportar.", "info"); return; }
  const linhas = gs.map(g => {
    const ini = (typeof garRegInicio === "function") ? garRegInicio(g) : g.inicio;
    const v = (typeof vigenciaCalc === "function") ? vigenciaCalc(ini, g.prazo_anos) : { status: "" };
    const stL = { vigente: "Vigente", vencendo: "Vencendo", vencida: "Vencida", "sem-data": "Sem data" };
    return [g.sistema, g.empreendimento, g.unidade, g.tipo === "legal" ? "Legal" : "Oferecida", g.prazo_anos, dataBR(ini), v.vence ? v.vence.toLocaleDateString("pt-BR") : "", stL[v.status] || ""];
  });
  mntBaixarCSV("civilbook-garantias.csv", ["Sistema", "Empreendimento", "Unidade", "Tipo", "Prazo (anos)", "Início", "Vence em", "Situação"], linhas);
}

if (typeof window !== "undefined") {
  window.SLA = SLA; window.slaReady = slaReady; window.slaStatusOS = slaStatusOS;
  window.renderMntPainel = renderMntPainel;
}
