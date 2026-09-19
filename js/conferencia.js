// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Módulo Conferência de Projetos — verificação de projetos por disciplina
// com critérios eliminatórios, observações e relatório imprimível.
// Fluxo: projeto → disciplinas → conferência item a item → pendências → relatório.

const CONF = {
  KEY: "cb-projetos",
  _cache: null,     // array de projetos em memória (fonte de leitura síncrona)
  _loaded: false,

  // ---------- Carga inicial (banco quando logado; senão localStorage) ----------
  async load() {
    const locais = CBStore.lsGet(this.KEY, []);
    if (CBStore.online()) {
      try {
        const { data, error } = await window.supa
          .from("projetos").select("*").order("created_at", { ascending: true });
        if (error) throw error;
        let remoto = (data || []).map(this._fromRow);
        // Migração única: se o banco está vazio e há projetos locais antigos, sobe-os.
        if (!remoto.length && locais.length) {
          remoto = [];
          for (const p of locais) {
            const np = { ...p, id: CBStore.uuid() }; // ids legados não são uuid
            const { error: e2 } = await window.supa.from("projetos").insert(this._toRow(np));
            if (!e2) remoto.push(np);
          }
        }
        this._cache = remoto;
        CBStore.lsSet(this.KEY, this._cache);
        this._loaded = true;
        return;
      } catch (e) { console.warn("CONF.load:", e && e.message); }
    }
    this._cache = locais;
    this._loaded = true;
  },
  async ready() { if (!this._loaded) await this.load(); return this._loaded; },

  _fromRow(r) {
    return {
      id: r.id, nome: r.nome, tipo: r.tipo, fase: r.fase, rev: r.rev,
      rt: r.rt, crea: r.crea, dono: r.user_id,   // dono do recurso (≠ eu = compartilhado comigo)
      disciplinas: r.disciplinas || [], respostas: r.respostas || {},
      criadoEm: r.created_at ? new Date(r.created_at).getTime() : Date.now()
    };
  },
  _toRow(p) {
    return {
      id: p.id, user_id: p.dono || CBStore.uid(),   // preserva o dono original (projeto compartilhado)
      nome: p.nome, tipo: p.tipo, fase: p.fase, rev: p.rev, rt: p.rt, crea: p.crea,
      disciplinas: p.disciplinas || [], respostas: p.respostas || {}
    };
  },

  projetos() { return this._cache || []; },
  projeto(id) { return this.projetos().find(p => p.id === id); },

  // Grava um projeto: atualiza cache + espelho local + banco (otimista).
  upsert(p) {
    const lista = this.projetos();
    const i = lista.findIndex(x => x.id === p.id);
    const novo = i < 0;
    if (novo) lista.push(p); else lista[i] = p;
    this._ultimaGravacao = { id: p.id, t: Date.now() };   // p/ o Realtime ignorar o eco da própria escrita
    CBStore.lsSet(this.KEY, lista);
    if (CBStore.online()) {
      const row = this._toRow(p);
      // insert p/ novos; update p/ existentes — evita o INSERT-check do upsert falhar quando um
      // colaborador edita projeto de outro dono, e respeita o trigger de dono imutável (0010).
      const q = novo ? window.supa.from("projetos").insert(row)
                     : window.supa.from("projetos").update(row).eq("id", p.id);
      q.then(({ error }) => { if (error) console.warn("CONF.upsert:", error.message); });
    }
    return p;
  },

  remove(id) {
    this._cache = this.projetos().filter(p => p.id !== id);
    CBStore.lsSet(this.KEY, this._cache);
    if (CBStore.online()) {
      window.supa.from("projetos").delete().eq("id", id)
        .then(({ error }) => { if (error) console.warn("CONF.remove:", error.message); });
    }
  },

  atualizar(id, fn) {
    const p = this.projeto(id);
    if (p) { fn(p); this.upsert(p); }
    return p;
  },

  // ---------- Realtime: colaboração ao vivo (c5) ----------
  _rtCh: null,
  escutarRealtime() {
    if (this._rtCh || !window.SHARE || !CBStore.online()) return;
    this._rtCh = SHARE.assinar("projetos", (payload) => {
      try {
        const novo = payload.new, antigo = payload.old;
        const mudouId = (novo && novo.id) || (antigo && antigo.id);
        // ignora o eco da própria gravação recente (não atropela edição local nem spama toast)
        const lg = this._ultimaGravacao;
        if (lg && lg.id === mudouId && Date.now() - lg.t < 3000) return;
        if (payload.eventType === "DELETE" && antigo) {
          this._cache = this.projetos().filter(p => p.id !== antigo.id);
        } else if (novo) {
          const np = this._fromRow(novo);
          const i = this.projetos().findIndex(p => p.id === np.id);
          if (i >= 0) this._cache[i] = np; else this._cache.push(np);
        }
        CBStore.lsSet(this.KEY, this._cache);
        // re-renderiza só se a tela atual ainda for a lista/painel afetado (não atrapalha edição em disciplina)
        if (document.querySelector('[data-cb-view="conf-lista"]')) renderConfLista();
        else { const el = document.querySelector('[data-cb-view="conf-proj"]'); if (el && el.dataset.id === mudouId && this.projeto(mudouId)) renderConfProjeto(this.projeto(mudouId)); }
        if (typeof toast === "function") toast("Projeto atualizado por um colaborador.", "info");
      } catch (e) {}
    });
  },

  // Estatísticas de uma disciplina dentro de um projeto
  statsDisciplina(p, discId) {
    const disc = CONFERENCIA.find(d => d.id === discId);
    let total = disc.itens.length, c = 0, nc = 0, na = 0, ncElim = 0;
    disc.itens.forEach((item, i) => {
      const r = (p.respostas || {})[discId + "-" + i];
      if (!r) return;
      if (r.st === "c") c++;
      else if (r.st === "na") na++;
      else if (r.st === "nc") { nc++; if (item.elim) ncElim++; }
    });
    const respondidos = c + nc + na;
    return { total, c, nc, na, ncElim, respondidos, pct: Math.round(respondidos / total * 100) };
  },

  statsProjeto(p) {
    let total = 0, respondidos = 0, nc = 0, ncElim = 0;
    (p.disciplinas || []).forEach(d => {
      const s = this.statsDisciplina(p, d);
      total += s.total; respondidos += s.respondidos; nc += s.nc; ncElim += s.ncElim;
    });
    return { total, respondidos, nc, ncElim, pct: total ? Math.round(respondidos / total * 100) : 0 };
  }
};

// ---------- Resultados de conferência (auditoria) ----------
// Snapshots IMUTÁVEIS do veredito go/no-go por projeto, em conferencia_resultados
// (+ espelho localStorage). Append-only: cada "Registrar" cria um novo registro.
const CONFRES = {
  TABLE: "conferencia_resultados",
  LS: "cb-conf-resultados",

  // Veredito go/no-go a partir das estatísticas (fonte única, usada no relatório e no snapshot).
  veredito(p) {
    const s = CONF.statsProjeto(p);
    const resultado = s.ncElim ? "REPROVADO — critérios eliminatórios não conformes"
      : s.pct < 100 ? "EM ANDAMENTO — conferência incompleta (" + s.pct + "%)"
      : s.nc ? "APROVADO COM RESSALVAS — " + s.nc + " não conformidade(s) a corrigir"
      : "APROVADO — todas as verificações conformes";
    return { resultado, stats: s };
  },

  // Lista de não conformidades do projeto, para guardar no snapshot.
  _ncs(p) {
    const out = [];
    (p.disciplinas || []).forEach(dId => {
      const d = CONFERENCIA.find(x => x.id === dId); if (!d) return;
      d.itens.forEach((item, i) => {
        const r = (p.respostas || {})[dId + "-" + i];
        if (r && r.st === "nc") out.push({ disciplina: d.disciplina, item: item.texto, elim: !!item.elim, norma: item.norma || "", obs: r.obs || "" });
      });
    });
    return out;
  },

  async registrar(p) {
    if (!p) return;
    const { resultado, stats } = this.veredito(p);
    const rec = {
      id: CBStore.uuid(), projeto_id: p.id, projeto_nome: p.nome, resultado,
      pct: stats.pct, nc: stats.nc, nc_elim: stats.ncElim, total: stats.total, respondidos: stats.respondidos,
      fase: p.fase || "", rev: p.rev || "", rt: p.rt || "", crea: p.crea || "",
      ncs: this._ncs(p), created_at: new Date().toISOString(),
    };
    let lista = CBStore.lsGet(this.LS, []); lista.unshift(rec); CBStore.lsSet(this.LS, lista.slice(0, 100)); // espelho local
    if (CBStore.online()) {
      const res = await CBStore.upsert(this.TABLE, { ...rec, user_id: CBStore.uid() });
      if (res && res.error) { if (typeof toast === "function") toast("Registrado localmente; falha ao gravar no banco.", "warn"); return; }
    }
    if (typeof toast === "function") toast("Resultado registrado para auditoria.", "success");
  },

  async historico(projetoId) {
    if (CBStore.online()) {
      try {
        let q = window.supa.from(this.TABLE).select("*").order("created_at", { ascending: false }).limit(50);
        if (projetoId) q = q.eq("projeto_id", projetoId);
        const { data, error } = await q;
        if (!error && data) return data;
      } catch (e) { /* cai no localStorage */ }
    }
    let lista = CBStore.lsGet(this.LS, []);
    return projetoId ? lista.filter(r => r.projeto_id === projetoId) : lista;
  },

  async abrirHistorico(p) {
    if (!p) return;
    document.getElementById("cb-conf-hist")?.remove();
    const regs = await this.historico(p.id);
    const cor = r => /REPROVADO/.test(r) ? "var(--red)" : /RESSALVAS/.test(r) ? "var(--amber,#c97a00)" : /ANDAMENTO/.test(r) ? "var(--text-3)" : "var(--green)";
    const linhas = regs.length ? regs.map(r => `
      <div class="hist-item">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13.5px;color:${cor(r.resultado)}">${esc(r.resultado)}</div>
          <div style="font-size:12px;color:var(--text-3);margin:2px 0">${r.created_at ? new Date(r.created_at).toLocaleString("pt-BR") : ""}</div>
          <div style="font-size:12.5px;color:var(--text-2)">${r.respondidos}/${r.total} itens · ${r.nc || 0} NC (${r.nc_elim || 0} elim.) · ${r.pct}%${r.rt ? " · RT: " + esc(r.rt) : ""}</div>
        </div>
      </div>`).join("") : `<p class="page-sub" style="text-align:center;padding:18px 0">Nenhum resultado registrado para este projeto ainda.</p>`;
    const ov = document.createElement("div");
    ov.id = "cb-conf-hist"; ov.className = "cb-modal-ov";
    ov.onclick = e => { if (e.target === ov) ov.remove(); };
    ov.innerHTML = `<div class="card cb-modal-box">
      <h3 style="margin-bottom:4px">Histórico de conferências</h3>
      <p class="page-sub" style="margin-bottom:12px">${esc(p.nome)} — registros para auditoria.</p>
      <div class="hist-list">${linhas}</div>
      <div style="text-align:right;margin-top:12px"><button class="btn" id="cb-confhist-close">Fechar</button></div>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelector("#cb-confhist-close").onclick = () => ov.remove();
  }
};

async function renderConferencia(param) {
  if (!planoEhPro()) return renderConferenciaUpsell();
  if (!CONF._loaded) { app.innerHTML = CBStore.loadingCard("Carregando projetos…"); await CONF.ready(); }
  CONF.escutarRealtime();   // colaboração ao vivo (c5): mudanças de colaboradores chegam em tempo real
  if (param && param.startsWith("p:")) {
    const partes = param.split(":");
    const p = CONF.projeto(partes[1]);
    if (p) {
      if (partes[2] === "rel") return renderConfRelatorio(p);
      if (partes[2]) return renderConfDisciplina(p, partes[2]);
      return renderConfProjeto(p);
    }
  }
  if (param === "novo") return renderConfNovo();
  renderConfLista();
}

function renderConferenciaUpsell() {
  app.innerHTML = `
    <div class="card" style="max-width:560px;margin:40px auto;text-align:center;padding:36px">
      <div class="card-icon" style="background:var(--purple-light);color:var(--purple);margin:0 auto 16px"><i class="ti ti-lock"></i></div>
      <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">Conferência de projetos é um recurso PRO</h2>
      <p style="color:var(--text-2);margin-bottom:20px">Verificação por disciplina com critérios eliminatórios, controle de pendências e relatório de conferência.</p>
      ${typeof cbTesteBotaoHTML === "function" ? cbTesteBotaoHTML('conferencia', null, 'btn primary lg') : ""}
    </div>`;
}

// ---------- Lista de projetos ----------
function renderConfLista() {
  const projetos = CONF.projetos();
  app.innerHTML = `
    <div data-cb-view="conf-lista" style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px;margin-bottom:6px">
      <div>
        <h2 class="page-title">Conferência de projetos</h2>
        <p class="page-sub" style="margin-bottom:0">Verifique cada disciplina antes de aprovar, licitar ou executar.</p>
      </div>
      <button class="btn primary" onclick="navigate('conferencia','novo')"><i class="ti ti-plus"></i>Novo projeto</button>
    </div>
    <div style="margin-top:20px">
    ${projetos.length === 0 ? `
      <div class="card" style="text-align:center;padding:40px">
        <div class="card-icon" style="background:var(--purple-light);color:var(--purple);margin:0 auto 14px"><i class="ti ti-clipboard-list"></i></div>
        <h3>Nenhum projeto em conferência</h3>
        <p style="margin-bottom:16px">Crie o primeiro projeto e selecione as disciplinas a verificar.</p>
        <button class="btn primary" onclick="navigate('conferencia','novo')"><i class="ti ti-plus"></i>Criar projeto</button>
      </div>` :
      projetos.map(p => {
        const s = CONF.statsProjeto(p);
        const status = s.ncElim ? { txt: "Reprovado (eliminatório)", cor: "red" } :
          s.pct === 100 && s.nc === 0 ? { txt: "Aprovado", cor: "teal" } :
          s.pct === 100 ? { txt: "Concluído com NCs", cor: "amber" } :
          { txt: s.pct + "% conferido", cor: "blue" };
        return `
        <div class="card clickable" style="margin-bottom:10px" onclick="navigate('conferencia','p:${p.id}')">
          <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center">
            <div>
              <h3>${esc(p.nome)}</h3>
              <p style="font-size:13px;color:var(--text-2)">${esc(p.tipo)} · ${esc(p.fase)} · ${(p.disciplinas || []).length} disciplinas${p.rt ? " · RT: " + esc(p.rt) : ""}</p>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              ${(p.dono && window.SHARE && SHARE.uid() && p.dono !== SHARE.uid()) ? `<span class="pill" style="background:var(--purple-light);color:var(--purple)"><i class="ti ti-users"></i> Compartilhado</span>` : ""}
              ${s.nc ? `<span class="pill pill-coral">${s.nc} NC</span>` : ""}
              <span class="pill pill-${status.cor}">${status.txt}</span>
              <i class="ti ti-chevron-right" style="color:var(--text-3)"></i>
            </div>
          </div>
          <div class="progress-bar" style="margin:12px 0 0"><div style="width:${s.pct}%"></div></div>
        </div>`;
      }).join("")}
    </div>`;
}

// ---------- Novo projeto ----------
function renderConfNovo() {
  app.innerHTML = `
    <button class="back-link" onclick="navigate('conferencia')"><i class="ti ti-arrow-left"></i>Projetos</button>
    <h2 class="page-title">Novo projeto</h2>
    <p class="page-sub">Identifique a obra e selecione as disciplinas que serão conferidas.</p>
    <div class="card" style="max-width:720px">
      <div class="field-row">
        <div class="field"><label>Nome da obra *</label><input type="text" id="cf-nome" placeholder="ex.: CMEI Jardim Monte Rei"></div>
        <div class="field"><label>Tipo</label><select id="cf-tipo">${TIPOS_OBRA.map(t => `<option>${t}</option>`).join("")}</select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Fase do projeto</label><select id="cf-fase">${FASES_PROJETO.map(f => `<option ${f === "Projeto executivo" ? "selected" : ""}>${f}</option>`).join("")}</select></div>
        <div class="field"><label>Revisão em conferência</label><input type="text" id="cf-rev" placeholder="ex.: R03"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Responsável técnico</label><input type="text" id="cf-rt" placeholder="Nome do RT"></div>
        <div class="field"><label>CREA/CAU</label><input type="text" id="cf-crea" placeholder="ex.: PR-123456/D"></div>
      </div>
      <div class="field">
        <label>Disciplinas a conferir</label>
        <div class="disc-grid">
          ${CONFERENCIA.map(d => `
            <label class="disc-check">
              <input type="checkbox" value="${d.id}" ${["arquitetonico", "estrutural", "compatibilizacao", "documentacao"].includes(d.id) ? "checked" : ""}>
              <i class="ti ${d.icone}"></i>${d.disciplina}
              <span style="margin-left:auto;font-size:11.5px;color:var(--text-3)">${d.itens.length} itens</span>
            </label>`).join("")}
        </div>
      </div>
      <button class="btn primary lg" onclick="criarProjetoConf()"><i class="ti ti-plus"></i>Criar e iniciar conferência</button>
    </div>`;
}

function criarProjetoConf() {
  const nome = document.getElementById("cf-nome").value.trim();
  if (!nome) { document.getElementById("cf-nome").focus(); toast("Informe o nome da obra.", "warn"); return; }
  const disciplinas = [...document.querySelectorAll(".disc-check input:checked")].map(i => i.value);
  if (!disciplinas.length) { toast("Selecione ao menos uma disciplina.", "warn"); return; }
  const p = {
    id: CBStore.uuid(),
    nome,
    tipo: document.getElementById("cf-tipo").value,
    fase: document.getElementById("cf-fase").value,
    rev: document.getElementById("cf-rev").value.trim(),
    rt: document.getElementById("cf-rt").value.trim(),
    crea: document.getElementById("cf-crea").value.trim(),
    disciplinas,
    respostas: {},
    criadoEm: Date.now()
  };
  CONF.upsert(p);
  toast("Projeto criado.", "success");
  navigate("conferencia", "p:" + p.id);
}

// ---------- Painel do projeto ----------
function renderConfProjeto(p) {
  const s = CONF.statsProjeto(p);
  app.innerHTML = `
    <button class="back-link" data-cb-view="conf-proj" data-id="${esc(p.id)}" onclick="navigate('conferencia')"><i class="ti ti-arrow-left"></i>Projetos</button>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px;margin-bottom:18px">
      <div>
        <h2 class="page-title" style="margin-bottom:2px">${esc(p.nome)}</h2>
        <p class="page-sub" style="margin-bottom:0">${esc(p.tipo)} · ${esc(p.fase)}${p.rev ? " · Rev. " + esc(p.rev) : ""}${p.rt ? " · RT: " + esc(p.rt) + (p.crea ? " (" + esc(p.crea) + ")" : "") : ""}</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn" onclick="navigate('conferencia','p:${p.id}:rel')"><i class="ti ti-file-text"></i>Relatório</button>
        ${(!p.dono || (window.SHARE && SHARE.uid() === p.dono)) ? `
        <button class="btn" title="Compartilhar" onclick="abrirCompartilhar('projeto','${p.id}',this.dataset.n)" data-n="${esc(p.nome).replace(/"/g, "&quot;")}"><i class="ti ti-share"></i></button>
        <button class="btn" title="Excluir" onclick="excluirProjetoConf('${p.id}')"><i class="ti ti-trash"></i></button>` : `
        <span class="pill" style="background:var(--purple-light);color:var(--purple)"><i class="ti ti-users"></i> Compartilhado com você</span>`}
      </div>
    </div>
    ${s.ncElim ? `<div class="result danger" style="margin-bottom:16px"><div class="r-label"><i class="ti ti-alert-triangle"></i> ${s.ncElim} critério(s) eliminatório(s) não conforme(s) — o projeto não pode ser aprovado até a correção.</div></div>` : ""}
    <div class="grid grid-3" style="margin-bottom:16px">
      <div class="card" style="text-align:center"><div style="font-size:32px;font-weight:600;color:var(--blue)">${s.pct}%</div><p>Itens conferidos (${s.respondidos}/${s.total})</p></div>
      <div class="card" style="text-align:center"><div style="font-size:32px;font-weight:600;color:${s.nc ? "var(--coral)" : "var(--teal)"}">${s.nc}</div><p>Não conformidades</p></div>
      <div class="card" style="text-align:center"><div style="font-size:32px;font-weight:600;color:${s.ncElim ? "var(--red)" : "var(--teal)"}">${s.ncElim}</div><p>NCs eliminatórias</p></div>
    </div>
    ${p.disciplinas.map(dId => {
      const d = CONFERENCIA.find(x => x.id === dId);
      const ds = CONF.statsDisciplina(p, dId);
      const cor = ds.ncElim ? "red" : ds.nc ? "coral" : ds.pct === 100 ? "teal" : "blue";
      const txt = ds.ncElim ? "Eliminatório NC" : ds.pct === 100 ? (ds.nc ? ds.nc + " NC" : "Conforme") : ds.respondidos + "/" + ds.total;
      return `
      <div class="card clickable" style="margin-bottom:8px" onclick="navigate('conferencia','p:${p.id}:${dId}')">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
          <div style="display:flex;align-items:center;gap:10px">
            <i class="ti ${d.icone}" style="font-size:20px;color:var(--text-2)"></i>
            <h3 style="font-size:15px">${d.disciplina}</h3>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span class="pill pill-${cor}">${txt}</span>
            <i class="ti ti-chevron-right" style="color:var(--text-3)"></i>
          </div>
        </div>
        <div class="progress-bar" style="margin:10px 0 0"><div style="width:${ds.pct}%"></div></div>
      </div>`;
    }).join("")}`;
}

async function excluirProjetoConf(id) {
  if (!await cbConfirmar("Excluir este projeto e toda a conferência?")) return;
  CONF.remove(id);
  navigate("conferencia");
}

// ---------- Conferência da disciplina ----------
function renderConfDisciplina(p, dId) {
  const d = CONFERENCIA.find(x => x.id === dId);
  app.innerHTML = `
    <button class="back-link" onclick="navigate('conferencia','p:${p.id}')"><i class="ti ti-arrow-left"></i>${esc(p.nome)}</button>
    <h2 class="page-title"><i class="ti ${d.icone}" style="margin-right:8px;color:var(--text-2)"></i>${d.disciplina}</h2>
    <p class="page-sub">Marque cada item: <strong>C</strong> conforme · <strong>NC</strong> não conforme · <strong>NA</strong> não se aplica. Itens com <i class="ti ti-alert-triangle" style="color:var(--red)"></i> são eliminatórios.</p>
    <div class="card">
      ${d.itens.map((item, i) => {
        const chave = dId + "-" + i;
        const r = (p.respostas || {})[chave] || {};
        return `
        <div class="conf-item ${r.st === "nc" ? "conf-nc" : ""}" id="ci-${i}">
          <div style="flex:1;min-width:240px">
            <p style="font-size:14px;font-weight:500">
              ${item.elim ? `<i class="ti ti-alert-triangle" style="color:var(--red);margin-right:4px" title="Eliminatório"></i>` : ""}
              ${item.texto}
            </p>
            ${item.norma ? `<p style="font-size:12px;color:var(--text-3)"><i class="ti ti-book"></i> ${item.norma}</p>` : ""}
            <input type="text" class="conf-obs ${r.st === "nc" || r.obs ? "" : "hidden"}" id="obs-${i}" placeholder="Observação / pendência…" value="${(r.obs || "").replace(/"/g, "&quot;")}" onchange="salvarObsConf('${p.id}','${dId}',${i},this.value)">
          </div>
          <div class="conf-btns">
            <button class="cb-c ${r.st === "c" ? "on" : ""}" onclick="marcarConf('${p.id}','${dId}',${i},'c')" title="Conforme">C</button>
            <button class="cb-nc ${r.st === "nc" ? "on" : ""}" onclick="marcarConf('${p.id}','${dId}',${i},'nc')" title="Não conforme">NC</button>
            <button class="cb-na ${r.st === "na" ? "on" : ""}" onclick="marcarConf('${p.id}','${dId}',${i},'na')" title="Não se aplica">NA</button>
          </div>
        </div>`;
      }).join("")}
    </div>
    <div style="display:flex;gap:10px;margin-top:14px">
      <button class="btn" onclick="marcarTodosConf('${p.id}','${dId}')"><i class="ti ti-checks"></i>Marcar restantes como conformes</button>
      <button class="btn primary" onclick="navigate('conferencia','p:${p.id}')"><i class="ti ti-arrow-left"></i>Voltar ao painel</button>
    </div>`;
}

function marcarConf(pid, dId, i, st) {
  CONF.atualizar(pid, p => {
    p.respostas = p.respostas || {};
    const chave = dId + "-" + i;
    const atual = p.respostas[chave] || {};
    p.respostas[chave] = { st: atual.st === st ? null : st, obs: atual.obs || "" };
  });
  renderConfDisciplina(CONF.projeto(pid), dId);
}

function salvarObsConf(pid, dId, i, valor) {
  CONF.atualizar(pid, p => {
    p.respostas = p.respostas || {};
    const chave = dId + "-" + i;
    p.respostas[chave] = { ...(p.respostas[chave] || {}), obs: valor };
  });
}

function marcarTodosConf(pid, dId) {
  const d = CONFERENCIA.find(x => x.id === dId);
  CONF.atualizar(pid, p => {
    p.respostas = p.respostas || {};
    d.itens.forEach((_, i) => {
      const chave = dId + "-" + i;
      if (!p.respostas[chave] || !p.respostas[chave].st) {
        p.respostas[chave] = { ...(p.respostas[chave] || {}), st: "c" };
      }
    });
  });
  renderConfDisciplina(CONF.projeto(pid), dId);
}

// ---------- Relatório ----------
function renderConfRelatorio(p) {
  const { resultado: conclusao, stats: s } = CONFRES.veredito(p);
  app.innerHTML = `
    <button class="back-link no-print" onclick="navigate('conferencia','p:${p.id}')"><i class="ti ti-arrow-left"></i>${esc(p.nome)}</button>
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px" class="no-print">
      <h2 class="page-title" style="margin:0">Relatório de conferência</h2>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn" onclick="CONFRES.abrirHistorico(CONF.projeto('${p.id}'))"><i class="ti ti-history"></i>Histórico</button>
        <button class="btn" onclick="CONFRES.registrar(CONF.projeto('${p.id}'))"><i class="ti ti-device-floppy"></i>Registrar resultado</button>
        <button class="btn primary" onclick="window.print()"><i class="ti ti-printer"></i>Imprimir / salvar PDF</button>
      </div>
    </div>
    <div class="card laudo-print">
      <h2 style="font-size:18px;text-align:center;margin-bottom:4px">RELATÓRIO DE CONFERÊNCIA DE PROJETOS</h2>
      <p style="text-align:center;font-size:12.5px;color:var(--text-2);margin-bottom:18px">Gerado pelo Civilbook em ${new Date().toLocaleDateString("pt-BR")}</p>
      <table class="spec-table" style="margin-bottom:18px">
        <tr><td>Obra</td><td>${esc(p.nome)}</td></tr>
        <tr><td>Tipo</td><td>${esc(p.tipo)}</td></tr>
        <tr><td>Fase / Revisão</td><td>${esc(p.fase)}${p.rev ? " · Rev. " + esc(p.rev) : ""}</td></tr>
        ${p.rt ? `<tr><td>Responsável técnico</td><td>${esc(p.rt)}${p.crea ? " — " + esc(p.crea) : ""}</td></tr>` : ""}
        <tr><td>Resultado</td><td style="font-weight:600">${conclusao}</td></tr>
        <tr><td>Itens conferidos</td><td>${s.respondidos} de ${s.total} (${s.nc} NC, ${s.ncElim} eliminatórias)</td></tr>
      </table>
      ${p.disciplinas.map(dId => {
        const d = CONFERENCIA.find(x => x.id === dId);
        const itens = d.itens.map((item, i) => ({ item, r: (p.respostas || {})[dId + "-" + i] || {} }));
        const ncs = itens.filter(x => x.r.st === "nc");
        return `
        <h3 style="font-size:15px;margin:16px 0 6px;border-bottom:1px solid var(--border);padding-bottom:4px">${d.disciplina}</h3>
        <p style="font-size:13px;color:var(--text-2);margin-bottom:6px">
          ${itens.filter(x => x.r.st === "c").length} conformes · ${ncs.length} não conformes · ${itens.filter(x => x.r.st === "na").length} N/A · ${itens.filter(x => !x.r.st).length} não conferidos
        </p>
        ${ncs.length ? `
          <table class="data" style="font-size:12.5px;margin-bottom:8px">
            <thead><tr><th>Não conformidade</th><th>Norma</th><th>Observação</th></tr></thead>
            <tbody>${ncs.map(x => `<tr>
              <td>${x.item.elim ? "⚠ ELIMINATÓRIO — " : ""}${esc(x.item.texto)}</td>
              <td>${esc(x.item.norma || "—")}</td>
              <td>${esc(x.r.obs || "—")}</td>
            </tr>`).join("")}</tbody>
          </table>` : ""}`;
      }).join("")}
      <div style="margin-top:40px;display:flex;justify-content:space-around;gap:20px;flex-wrap:wrap">
        <div style="text-align:center;font-size:13px;border-top:1px solid var(--text);padding-top:6px;min-width:220px">${esc(p.rt || "Responsável pela conferência")}<br>${esc(p.crea || "CREA/CAU")}</div>
        <div style="text-align:center;font-size:13px;border-top:1px solid var(--text);padding-top:6px;min-width:220px">Contratante / Fiscalização</div>
      </div>
    </div>`;
}
