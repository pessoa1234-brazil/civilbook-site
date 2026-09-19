// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Módulo Manutenção — gestão de manutenção predial (NBR 5674).
// Funcionalidades portadas do maintenance-flux: ordens de serviço, cronograma
// preventivo e painel de conformidade. Persistência via CBStore (Supabase quando
// logado; localStorage como cache offline / modo local).

const MNT = {
  KEY_OS: "cb-os",
  KEY_EXEC: "cb-execucoes",
  _os: null,      // array de ordens de serviço em memória
  _exec: null,    // mapa { chave: timestamp } de execuções
  _loaded: false,

  // ---------- Carga inicial (banco quando logado; senão localStorage) ----------
  async load() {
    const osLocal = CBStore.lsGet(this.KEY_OS, []);
    const exLocal = CBStore.lsGet(this.KEY_EXEC, {});
    if (CBStore.online()) {
      try {
        const [ro, re] = await Promise.all([
          window.supa.from("ordens_servico").select("*").order("num", { ascending: true }),
          window.supa.from("manutencao_execucoes").select("*")
        ]);
        if (ro.error) throw ro.error;
        if (re.error) throw re.error;
        let os = (ro.data || []).map(this._osFromRow);
        const ex = {};
        (re.data || []).forEach(r => { ex[r.chave] = new Date(r.executed_at).getTime(); });
        // Migração única dos dados locais antigos, se o banco estiver vazio.
        if (!os.length && osLocal.length) {
          os = [];
          for (const o of osLocal) {
            const no = { ...o, id: CBStore.uuid() };
            const { error } = await window.supa.from("ordens_servico").insert(this._osToRow(no));
            if (!error) os.push(no);
          }
        }
        if (!Object.keys(ex).length && Object.keys(exLocal).length) {
          const rows = Object.entries(exLocal).map(([chave, ts]) =>
            ({ user_id: CBStore.uid(), chave, executed_at: new Date(ts).toISOString() }));
          const { error } = await window.supa.from("manutencao_execucoes").upsert(rows);
          if (!error) Object.assign(ex, exLocal);
        }
        this._os = os; this._exec = ex;
        CBStore.lsSet(this.KEY_OS, os); CBStore.lsSet(this.KEY_EXEC, ex);
        this._loaded = true;
        return;
      } catch (e) { console.warn("MNT.load:", e && e.message); }
    }
    this._os = osLocal; this._exec = exLocal; this._loaded = true;
  },
  async ready() { if (!this._loaded) await this.load(); return this._loaded; },

  _osFromRow(r) {
    return {
      id: r.id, num: r.num, titulo: r.titulo, local: r.local, tipo: r.tipo,
      prioridade: r.prioridade, resp: r.resp, prazo: r.prazo || "",
      desc: r.descricao || "", status: r.status, dono: r.user_id,   // dono ≠ eu = compartilhada comigo
      criadaEm: r.created_at ? new Date(r.created_at).getTime() : Date.now()
    };
  },
  _osToRow(o) {
    return {
      id: o.id, user_id: o.dono || CBStore.uid(), num: o.num, titulo: o.titulo, local: o.local || null,
      tipo: o.tipo || null, prioridade: o.prioridade || null, resp: o.resp || null,
      prazo: o.prazo || null, descricao: o.desc || null, status: o.status
    };
  },

  listarOS() { return this._os || []; },

  // OSs abertas que exigem atenção: já vencidas ou vencendo em ≤7 dias.
  osAtencao() {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const limite = new Date(hoje); limite.setDate(limite.getDate() + 7);
    const out = { vencidas: [], proximas: [] };
    this.listarOS().forEach(o => {
      if ((o.status !== "aberta" && o.status !== "andamento") || !o.prazo) return;
      const d = new Date(o.prazo + "T12:00");
      if (isNaN(d.getTime())) return;
      if (d < hoje) out.vencidas.push(o);
      else if (d <= limite) out.proximas.push(o);
    });
    return out;
  },

  // Grava uma OS: cache + espelho local + banco (otimista).
  upsertOS(o) {
    const lista = this.listarOS();
    const i = lista.findIndex(x => x.id === o.id);
    const novo = i < 0;
    if (novo) lista.push(o); else lista[i] = o;
    this._ultimaGravacao = { id: o.id, t: Date.now() };   // p/ o Realtime ignorar o eco da própria escrita
    CBStore.lsSet(this.KEY_OS, lista);
    if (CBStore.online()) {
      const row = this._osToRow(o);
      // insert p/ novas; update p/ existentes — colaborador edita OS compartilhada sem bater no
      // trigger de dono imutável nem no INSERT-check do upsert (mesma lógica do CONF, c5).
      const q = novo ? window.supa.from("ordens_servico").insert(row)
                     : window.supa.from("ordens_servico").update(row).eq("id", o.id);
      q.then(({ error }) => { if (error) console.warn("MNT.upsertOS:", error.message); });
    }
  },

  // ---------- Realtime: colaboração ao vivo em OSs (c5) ----------
  _rtCh: null,
  escutarRealtime() {
    if (this._rtCh || !window.SHARE || !CBStore.online()) return;
    this._rtCh = SHARE.assinar("ordens_servico", (payload) => {
      try {
        const novo = payload.new, antigo = payload.old;
        const mudouId = (novo && novo.id) || (antigo && antigo.id);
        const lg = this._ultimaGravacao;
        if (lg && lg.id === mudouId && Date.now() - lg.t < 3000) return;   // ignora eco próprio
        if (payload.eventType === "DELETE" && antigo) this._os = this.listarOS().filter(o => o.id !== antigo.id);
        else if (novo) { const no = this._osFromRow(novo); const i = this.listarOS().findIndex(o => o.id === no.id); if (i >= 0) this._os[i] = no; else this._os.push(no); }
        CBStore.lsSet(this.KEY_OS, this._os);
        if (document.querySelector('[data-cb-view="mnt-os"]')) renderMntOS();
        if (typeof toast === "function") toast("Ordem de serviço atualizada por um colaborador.", "info");
      } catch (e) {}
    });
  },

  execucoes() { return this._exec || {}; },
  registrarExecucao(chave) {
    const ex = this.execucoes();
    ex[chave] = Date.now();
    CBStore.lsSet(this.KEY_EXEC, ex);
    if (CBStore.online()) {
      window.supa.from("manutencao_execucoes")
        .upsert({ user_id: CBStore.uid(), chave, executed_at: new Date().toISOString() })
        .then(({ error }) => { if (error) console.warn("MNT.exec:", error.message); });
    }
  },

  // Situação de uma atividade do plano: ok | vencendo | vencida | nunca
  situacao(chave, periodicidadeMeses) {
    const ultima = this.execucoes()[chave];
    if (!ultima) return { st: "nunca", label: "Sem registro" };
    const dias = (Date.now() - ultima) / 86400000;
    const prazo = periodicidadeMeses * 30.44;
    if (dias > prazo) return { st: "vencida", label: "Vencida há " + Math.round(dias - prazo) + " d" };
    if (dias > prazo * 0.8) return { st: "vencendo", label: "Vence em " + Math.round(prazo - dias) + " d" };
    return { st: "ok", label: "Em dia" };
  },

  conformidade() {
    let total = 0, emDia = 0, vencidas = 0, semRegistro = 0;
    PLANO_MANUTENCAO.forEach((s, si) => s.atividades.forEach((a, ai) => {
      total++;
      const st = this.situacao(si + "-" + ai, a.periodicidade).st;
      if (st === "ok" || st === "vencendo") emDia++;
      else if (st === "vencida") vencidas++;
      else semRegistro++;
    }));
    return { total, emDia, vencidas, semRegistro, pct: total ? Math.round(emDia / total * 100) : 0 };
  }
};

function planoEhPro() {
  const sess = AUTH.session();
  return sess && sess.plano && sess.plano !== "gratuito";
}

async function renderManutencao(aba) {
  if (!planoEhPro()) return renderManutencaoUpsell(aba);
  if (!MNT._loaded) { app.innerHTML = CBStore.loadingCard("Carregando manutenção…"); await MNT.ready(); }
  MNT.escutarRealtime();   // colaboração ao vivo em OSs (c5)
  if (typeof GAR !== "undefined" && !GAR._loaded) await GAR.ready();   // garantias + fornecedores
  if (typeof mnt2Ready === "function") await mnt2Ready();   // e8: ativos, agendamentos, checklist de OS
  if (typeof conf2Ready === "function") await conf2Ready();   // e9: garantias registradas + relatórios de conformidade
  if (typeof manualReady === "function") await manualReady();   // e10: manuais do proprietário (cronograma por IA)
  if (typeof slaReady === "function") await slaReady();   // e11: configuração de SLA (painel/alertas)
  aba = aba || "visao";
  // As 10 sub-abas em GRUPOS ROTULADOS (correção do achado de campo de 16/ago: "não achei a aba
  // Garantias"). A barra nunca rolou — `.tabs-bar` tem flex-wrap, então as 10 estavam todas na
  // tela; o problema é que eram dez botões idênticos, e quem procura "Garantias" precisa ler os dez
  // para achar. Os rótulos dão um ponto de apoio para o olho, sem mexer na estrutura de módulos
  // nem nas rotas (navigate('manutencao','garantias') continua igual).
  const grupos = [
    { titulo: "Manutenção", abas: [
      { id: "visao", label: "Visão geral", icone: "ti-gauge" },
      { id: "ativos", label: "Ativos", icone: "ti-package" },
      { id: "os", label: "Ordens de serviço", icone: "ti-tool" },
      { id: "agendamentos", label: "Agendamentos", icone: "ti-calendar-plus" },
      { id: "calendario", label: "Calendário", icone: "ti-calendar-month" },
      { id: "cronograma", label: "Cronograma", icone: "ti-calendar-time" },
    ] },
    { titulo: "Garantias e documentação", abas: [
      { id: "garantias", label: "Garantias", icone: "ti-shield-check" },
      { id: "manual", label: "Manual", icone: "ti-book" },
      { id: "fornecedores", label: "Fornecedores", icone: "ti-truck" },
      { id: "conformidade", label: "Conformidade", icone: "ti-clipboard-check" },
    ] },
  ];
  app.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <h2 class="page-title" style="margin-right:auto">Manutenções e Garantias</h2>
      <button class="btn" onclick="typeof ASSIST!=='undefined'&&ASSIST.abrirCom('manutencao')" title="Abrir o assessor já sabendo que você está na Manutenção (f40)"><i class="ti ti-sparkles" aria-hidden="true"></i> Perguntar à IA</button>
    </div>
    <p class="page-sub">Gestão NBR 5674 (manutenção) e NBR 17170 (garantias) — plano preventivo, OS, prazos de garantia e fornecedores.</p>
    <div class="tabs-bar">
      ${grupos.map(g => `<span class="tabs-grupo">${g.titulo}</span>${g.abas.map(a => `<button class="${a.id === aba ? "active" : ""}" onclick="navigate('manutencao','${a.id}')"><i class="ti ${a.icone}"></i>${a.label}</button>`).join("")}`).join("")}
    </div>
    <div id="mnt-body"></div>`;
  if (aba === "os") renderMntOS();
  else if (aba === "ativos" && typeof renderMntAtivos === "function") renderMntAtivos();
  else if (aba === "agendamentos" && typeof renderMntAgendamentos === "function") renderMntAgendamentos();
  else if (aba === "calendario" && typeof renderMntCalendario === "function") renderMntCalendario();
  else if (aba === "cronograma") renderMntCronograma();
  else if (aba === "manual" && typeof renderMntManual === "function") renderMntManual();
  else if (aba === "garantias" && typeof renderGarantias === "function") renderGarantias();
  else if (aba === "fornecedores" && typeof renderFornecedores === "function") renderFornecedores();
  else if (aba === "conformidade" && typeof renderMntConformidade === "function") renderMntConformidade();
  else if (typeof renderMntPainel === "function") renderMntPainel();   // e11: visão geral vira o painel/BI
  else renderMntVisao();
}

// e29 (correção de 16/ago): o exemplo faltava justamente na trava do PRO de Ativos, Agendamentos e
// Garantias — quem é gratuito não vê o estado vazio (não chega lá) e também não via exemplo nenhum
// aqui. Mostra o painel da sub-aba que a pessoa tentou abrir; visão geral e as demais caem em
// Ativos, que é a porta do módulo.
function renderManutencaoUpsell(aba) {
  const mod = ["ativos", "agendamentos", "garantias"].includes(aba) ? aba : "ativos";
  app.innerHTML = `
    <div class="card" style="max-width:560px;margin:40px auto;text-align:center;padding:36px">
      <div class="card-icon" style="background:var(--blue-light);color:var(--blue);margin:0 auto 16px"><i class="ti ti-lock"></i></div>
      <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">Gestão de manutenção é um recurso PRO</h2>
      <p style="color:var(--text-2);margin-bottom:20px">Ordens de serviço, cronograma preventivo NBR 5674 e painel de conformidade para o seu empreendimento.</p>
      ${typeof cbTesteBotaoHTML === "function" ? cbTesteBotaoHTML('manutencao', null, 'btn primary lg') : ""}
      ${typeof EXEMPLO !== "undefined" ? EXEMPLO.botaoUpsellHTML(mod) : ""}
    </div>`;
}

function renderMntVisao() {
  const c = MNT.conformidade();
  const os = MNT.listarOS();
  const abertas = os.filter(o => o.status === "aberta" || o.status === "andamento");
  const corPct = c.pct >= 80 ? "var(--teal)" : c.pct >= 50 ? "var(--amber)" : "var(--red)";
  document.getElementById("mnt-body").innerHTML = `
    <div class="grid grid-3" style="margin-bottom:14px">
      <div class="card" style="text-align:center">
        <div style="font-size:36px;font-weight:600;color:${corPct}">${c.pct}%</div>
        <p>Aderência ao plano preventivo</p>
      </div>
      <div class="card" style="text-align:center">
        <div style="font-size:36px;font-weight:600;color:var(--blue)">${abertas.length}</div>
        <p>OS abertas ou em andamento</p>
      </div>
      <div class="card" style="text-align:center">
        <div style="font-size:36px;font-weight:600;color:${c.vencidas ? "var(--red)" : "var(--teal)"}">${c.vencidas}</div>
        <p>Atividades preventivas vencidas</p>
      </div>
    </div>
    <div class="card">
      <h3 style="margin-bottom:10px">Resumo do plano (${c.total} atividades)</h3>
      <div class="progress-bar" style="margin:10px 0"><div style="width:${c.pct}%;background:${corPct}"></div></div>
      <p style="font-size:13.5px;color:var(--text-2)">
        ${c.emDia} em dia · ${c.vencidas} vencidas · ${c.semRegistro} sem registro de execução.
        Registre as execuções na aba <a href="javascript:navigate('manutencao','cronograma')" style="color:var(--blue)">Cronograma</a>.
      </p>
    </div>`;
}

function renderMntOS() {
  const os = MNT.listarOS();
  const stInfo = id => OS_STATUS.find(s => s.id === id) || OS_STATUS[0];
  const prInfo = id => OS_PRIORIDADES.find(p => p.id === id) || OS_PRIORIDADES[0];
  document.getElementById("mnt-body").innerHTML = `
    <div class="card" data-cb-view="mnt-os" style="margin-bottom:14px">
      <h3 style="margin-bottom:12px"><i class="ti ti-plus"></i> Nova ordem de serviço</h3>
      <div class="field-row">
        <div class="field"><label>Título *</label><input type="text" id="os-titulo" placeholder="ex.: Vazamento no barrilete"></div>
        <div class="field"><label>Local</label><input type="text" id="os-local" placeholder="ex.: Cobertura, torre A"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Tipo</label><select id="os-tipo">${OS_TIPOS.map(t => `<option>${t}</option>`).join("")}</select></div>
        <div class="field"><label>Prioridade</label><select id="os-prio">${OS_PRIORIDADES.map(p => `<option value="${p.id}">${p.label}</option>`).join("")}</select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Responsável</label><input type="text" id="os-resp" placeholder="ex.: Zelador / empresa X"></div>
        <div class="field"><label>Prazo</label><input type="date" id="os-prazo"></div>
      </div>
      ${typeof osFormAtivoField === "function" ? osFormAtivoField() : ""}
      <div class="field"><label>Descrição</label><textarea id="os-desc" rows="2"></textarea></div>
      <button class="btn primary" onclick="criarOS()"><i class="ti ti-plus"></i>Abrir OS</button>
    </div>
    ${os.length === 0 ? `<p class="page-sub" style="text-align:center;padding:20px">Nenhuma OS registrada ainda.</p>` : ""}
    ${os.slice().reverse().map(o => {
      const st = stInfo(o.status), pr = prInfo(o.prioridade);
      return `
      <div class="card os-card" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start">
          <div style="flex:1;min-width:220px">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <span class="os-num">OS-${String(o.num).padStart(3, "0")}</span>
              <span class="pill pill-${pr.cor}">${pr.label}</span>
              <span class="pill pill-${st.cor}">${st.label}</span>
              ${(o.dono && window.SHARE && SHARE.uid() && o.dono !== SHARE.uid()) ? `<span class="pill" style="background:var(--purple-light);color:var(--purple)"><i class="ti ti-users"></i> Compartilhada</span>` : ""}
            </div>
            <h3 style="margin:6px 0 2px">${esc(o.titulo)}</h3>
            <p style="font-size:13px;color:var(--text-2)">
              ${esc(o.tipo)}${o.local ? " · " + esc(o.local) : ""}${o.resp ? " · Resp.: " + esc(o.resp) : ""}${o.prazo ? " · Prazo: " + new Date(o.prazo + "T12:00").toLocaleDateString("pt-BR") : ""}
            </p>
            ${o.desc ? `<p style="font-size:13.5px;margin-top:6px">${esc(o.desc)}</p>` : ""}
            ${typeof osCardDetalhes === "function" ? osCardDetalhes(o) : ""}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${o.status === "aberta" ? `<button class="btn" onclick="mudarStatusOS(${o.num},'andamento')"><i class="ti ti-player-play"></i>Iniciar</button>` : ""}
            ${o.status !== "concluida" && o.status !== "cancelada" ? `<button class="btn" onclick="mudarStatusOS(${o.num},'concluida')"><i class="ti ti-check"></i>Concluir</button>` : ""}
            ${o.status !== "cancelada" && o.status !== "concluida" ? `<button class="btn" onclick="mudarStatusOS(${o.num},'cancelada')"><i class="ti ti-x"></i>Cancelar</button>` : ""}
            ${(!o.dono || (window.SHARE && SHARE.uid() === o.dono)) ? `<button class="btn icon-only" title="Compartilhar" onclick="abrirCompartilhar('os','${o.id}',this.dataset.n)" data-n="${esc(o.titulo).replace(/"/g, "&quot;")}"><i class="ti ti-share"></i></button>` : ""}
          </div>
        </div>
      </div>`;
    }).join("")}`;
}

function criarOS() {
  const titulo = document.getElementById("os-titulo").value.trim();
  if (!titulo) { document.getElementById("os-titulo").focus(); toast("Informe o título da OS.", "warn"); return; }
  const os = MNT.listarOS();
  const nova = {
    id: CBStore.uuid(),
    num: (os.length ? Math.max(...os.map(o => o.num)) : 0) + 1,
    titulo,
    local: document.getElementById("os-local").value.trim(),
    tipo: document.getElementById("os-tipo").value,
    prioridade: document.getElementById("os-prio").value,
    resp: document.getElementById("os-resp").value.trim(),
    prazo: document.getElementById("os-prazo").value,
    desc: document.getElementById("os-desc").value.trim(),
    status: "aberta",
    criadaEm: Date.now()
  };
  MNT.upsertOS(nova);
  const sa = document.getElementById("os-ativo");   // e8: vincula ativo (satélite os_detalhes)
  if (sa && typeof OSD !== "undefined" && sa.value) OSD.set(nova.id, { ativo_id: sa.value, checklist: [] });
  toast("OS aberta.", "success");
  renderMntOS();
}

function mudarStatusOS(num, status) {
  const o = MNT.listarOS().find(x => x.num === num);
  if (o) { o.status = status; MNT.upsertOS(o); }
  renderMntOS();
}

function renderMntCronograma() {
  document.getElementById("mnt-body").innerHTML = PLANO_MANUTENCAO.map((s, si) => `
    <div class="card" style="margin-bottom:12px">
      <h3 style="margin-bottom:4px"><i class="ti ${s.icone}" style="margin-right:6px;color:var(--text-2)"></i>${s.sistema}</h3>
      ${s.atividades.map((a, ai) => {
        const chave = si + "-" + ai;
        const sit = MNT.situacao(chave, a.periodicidade);
        const corSit = { ok: "teal", vencendo: "amber", vencida: "red", nunca: "gray" }[sit.st];
        return `
        <div class="cron-item">
          <div style="flex:1;min-width:200px">
            <p style="font-size:14px;font-weight:500">${a.atividade}</p>
            <p style="font-size:12.5px;color:var(--text-2)">${periodicidadeLabel(a.periodicidade)} · ${a.responsavel}${a.norma ? " · " + a.norma : ""}</p>
          </div>
          <span class="pill pill-${corSit}">${sit.label}</span>
          <button class="btn" onclick="MNT.registrarExecucao('${chave}');toast('Execução registrada.','success');renderMntCronograma()"><i class="ti ti-check"></i>Registrar execução</button>
        </div>`;
      }).join("")}
    </div>`).join("") + `
    <p class="page-sub"><i class="ti ti-info-circle"></i> Periodicidades orientativas conforme práticas usuais da NBR 5674 — ajuste ao manual de uso e operação do seu empreendimento.</p>`;
}
