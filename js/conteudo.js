// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Área do corpo técnico — mini-CMS (tarefa d5).
// CONT: acesso a public.conteudos (Supabase) com fluxo autoria → revisão → publicação.
// renderCorpo: ÁREA ÚNICA do corpo técnico (autor/editor/admin) com as sub-abas
//   Conteúdo (biblioteca) · Meus conteúdos · Revisão · Equipe. Requer backend (modo dinâmico).
// Papéis em profiles.role: autor < editor < admin.

const CONT = {
  CATS: ["Estruturas", "Fundações", "Instalações", "Materiais", "Patologias e manutenção",
    "Gestão de obra", "Sustentabilidade", "Normas e legislação", "Outros"],

  _supaOk() { return !!(typeof window !== "undefined" && window.supa && AUTH.session()); },
  papel() { const s = AUTH.session(); return s ? (s.role || "user") : "user"; },
  ehCorpoTecnico() { return ["autor", "editor", "admin"].includes(this.papel()); },
  ehEditor() { return ["editor", "admin"].includes(this.papel()); },

  slugify(t) {
    return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "conteudo";
  },

  // ---- Leitura ----
  async publicados() {
    if (!this._supaOk()) return [];
    const { data, error } = await window.supa.from("conteudos")
      .select("id,titulo,slug,categoria,resumo,published_at")
      .eq("status", "publicado").order("published_at", { ascending: false }).limit(200);
    if (error) throw error;
    return data || [];
  },
  async ver(id) {
    const { data, error } = await window.supa.from("conteudos").select("*").eq("id", id).single();
    if (error) throw error;
    return data;
  },

  // ---- Autoria (corpo técnico) ----
  async meus() {
    if (!this._supaOk()) return [];
    // Lista não mostra o corpo — busca só os campos exibidos (corpo vem ao abrir/editar via ver()).
    const { data, error } = await window.supa.from("conteudos")
      .select("id,titulo,categoria,status,nota_revisao,updated_at")
      .eq("autor_id", AUTH.session().id).order("updated_at", { ascending: false }).limit(100);
    if (error) throw error;
    return data || [];
  },
  async criar(c) {
    const row = {
      autor_id: AUTH.session().id, titulo: c.titulo, categoria: c.categoria,
      resumo: c.resumo, corpo: c.corpo, status: "rascunho",
      slug: this.slugify(c.titulo) + "-" + Math.random().toString(36).slice(2, 7)
    };
    const { data, error } = await window.supa.from("conteudos").insert(row).select().single();
    if (error) throw error;
    return data;
  },
  async salvar(id, c) {
    const { error } = await window.supa.from("conteudos")
      .update({ titulo: c.titulo, categoria: c.categoria, resumo: c.resumo, corpo: c.corpo }).eq("id", id);
    if (error) throw error;
  },
  async enviarRevisao(id) {
    const { error } = await window.supa.from("conteudos").update({ status: "em_revisao", nota_revisao: null }).eq("id", id);
    if (error) throw error;
  },

  // ---- Revisão (editor/admin) ----
  async fila() {
    if (!this.ehEditor()) return [];
    // Fila não mostra o corpo — busca só os campos exibidos (corpo vem ao clicar em "Revisar").
    const { data, error } = await window.supa.from("conteudos")
      .select("id,titulo,categoria,status,resumo,updated_at")
      .eq("status", "em_revisao").order("updated_at", { ascending: true }).limit(100);
    if (error) throw error;
    return data || [];
  },
  async publicar(id) {
    const { error } = await window.supa.from("conteudos").update({
      status: "publicado", revisor_id: AUTH.session().id, published_at: new Date().toISOString(), nota_revisao: null
    }).eq("id", id);
    if (error) throw error;
  },
  async devolver(id, nota) {
    const { error } = await window.supa.from("conteudos").update({
      status: "rejeitado", revisor_id: AUTH.session().id, nota_revisao: nota
    }).eq("id", id);
    if (error) throw error;
  },
  async remover(id) {
    const { error } = await window.supa.from("conteudos").delete().eq("id", id);
    if (error) throw error;
  },

  // ---- Equipe (admin) ----
  async usuarios() {
    const { data, error } = await window.supa.from("profiles")
      .select("id,nome,email_cache,role").order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return data || [];
  },
  async definirPapel(uid, papel) {
    const { error } = await window.supa.rpc("definir_papel", { p_uid: uid, p_papel: papel });
    if (error) throw error;
  }
};
if (typeof window !== "undefined") window.CONT = CONT;

// ── Helpers de UI ──────────────────────────────────────────────────────────
const CONT_STATUS = {
  rascunho: ["Rascunho", "pill-gray"], em_revisao: ["Em revisão", "pill-amber"],
  publicado: ["Publicado", "pill-teal"], rejeitado: ["Devolvido", "pill-red"]
};
function contBadge(st) { const m = CONT_STATUS[st] || [st, "pill-gray"]; return `<span class="pill ${m[1]}">${m[0]}</span>`; }
function contData(ts) { return ts ? new Date(ts).toLocaleDateString("pt-BR") : "—"; }
// Corpo em texto simples → HTML seguro (escapa e preserva parágrafos/quebras).
// e6: marcadores de citação ancorada [[ref:<id>|p=N|trecho]] viram links clicáveis que abrem o
// PDF-fonte na página N (PDFV). Processa o texto CRU por trechos p/ escapar com precisão.
const CONT_CIT_RE = /\[\[ref:([0-9a-fA-F-]{6,})\|p=(\d+)(?:\|([^\]]*))?\]\]/g;
function contCitLink(id, pg, tr) {
  tr = (tr || "").trim();
  const trAttr = esc(tr).replace(/'/g, "&#39;");
  const rotulo = tr ? esc(tr.length > 42 ? tr.slice(0, 42) + "…" : tr) : ("fonte, p. " + pg);
  return `<a class="cb-cit" role="button" tabindex="0" title="Abrir a fonte na página ${pg}"` +
    ` onclick="abrirCitacao('${id}',${pg},'${trAttr}')"><i class="ti ti-quote" aria-hidden="true"></i>${rotulo}</a>`;
}
function contCorpoHTML(txt) {
  const blocos = String(txt || "").split(/\n{2,}/).map(par => {
    let out = "", last = 0, m;
    CONT_CIT_RE.lastIndex = 0;
    while ((m = CONT_CIT_RE.exec(par)) !== null) {
      out += esc(par.slice(last, m.index)).replace(/\n/g, "<br>");
      out += contCitLink(m[1], m[2], m[3]);
      last = CONT_CIT_RE.lastIndex;
    }
    out += esc(par.slice(last)).replace(/\n/g, "<br>");
    return `<p>${out}</p>`;
  });
  return blocos.join("") || "<p>—</p>";
}

// Abre a fonte de uma citação no ponto exato (PDF privado → URL assinada → visualizador PDF.js).
async function abrirCitacao(refId, pagina, trecho) {
  if (typeof BIBLIO === "undefined" || typeof PDFV === "undefined") return;
  try {
    const r = await BIBLIO.ref(refId);
    if (r.arquivo_path) {
      const url = await BIBLIO.urlAssinada(r.arquivo_path);
      PDFV.abrir({ url, pagina, trecho, titulo: r.titulo });
    } else if (r.fonte_url) {
      window.open(r.fonte_url, "_blank", "noopener");
    } else { toast("Esta referência não tem PDF anexado.", "info"); }
  } catch (e) { toast("Não foi possível abrir a citação: " + (e.message || e), "error"); }
}

// ── Área do corpo técnico (uma só, com sub-abas) ───────────────────────────
// param: "" | "conteudo" | "meus" | "revisao" | "equipe" | "ver:<id>"
function renderCorpo(param) {
  if (!CONT.ehCorpoTecnico()) {
    app.innerHTML = `<div class="card" style="max-width:540px;margin:30px auto;text-align:center;padding:32px">
      <div class="card-icon" style="background:var(--blue-light);color:var(--blue);margin:0 auto 14px"><i class="ti ti-users-group"></i></div>
      <h2 style="font-size:19px;font-weight:600;margin-bottom:6px">Área do corpo técnico</h2>
      <p style="color:var(--text-2)">Esta área é exclusiva para o corpo técnico (autores e revisores) do Civilbook. Fale com um administrador para participar da produção de conteúdo.</p>
      <p style="margin-top:14px"><button class="btn" onclick="navigate('home')"><i class="ti ti-arrow-left"></i>Voltar ao início</button></p>
    </div>`;
    return;
  }
  let aba = "conteudo", verId = null;
  if (param && param.indexOf("ver:") === 0) { aba = "conteudo"; verId = param.slice(4); }
  else if (["conteudo", "meus", "biblioteca", "revisao", "equipe"].includes(param)) aba = param;
  const ed = CONT.ehEditor(), adm = AUTH.isAdmin();
  app.innerHTML = `
    <h2 class="page-title">Área do corpo técnico</h2>
    <p class="page-sub">Biblioteca técnica e produção de conteúdo. Seu papel: <strong>${esc(CONT.papel())}</strong>.</p>
    <div class="tabs-bar" id="corpo-tabs">
      <button data-aba="conteudo" class="${aba === "conteudo" ? "active" : ""}" onclick="navigate('corpo','conteudo')"><i class="ti ti-article"></i> Conteúdo</button>
      <button data-aba="meus" class="${aba === "meus" ? "active" : ""}" onclick="navigate('corpo','meus')"><i class="ti ti-files"></i> Meus conteúdos</button>
      <button data-aba="biblioteca" class="${aba === "biblioteca" ? "active" : ""}" onclick="navigate('corpo','biblioteca')"><i class="ti ti-books"></i> Biblioteca</button>
      ${ed ? `<button data-aba="revisao" class="${aba === "revisao" ? "active" : ""}" onclick="navigate('corpo','revisao')"><i class="ti ti-eye-check"></i> Revisão</button>` : ""}
      ${adm ? `<button data-aba="equipe" class="${aba === "equipe" ? "active" : ""}" onclick="navigate('corpo','equipe')"><i class="ti ti-users"></i> Equipe</button>` : ""}
    </div>
    <div id="corpo-pane"><p class="page-sub">Carregando…</p></div>`;
  if (aba === "conteudo") { if (verId) paneVer(verId); else paneConteudo(); }
  else if (aba === "meus") paneMeus();
  else if (aba === "biblioteca") paneBiblioteca();
  else if (aba === "revisao") paneRevisao();
  else if (aba === "equipe") paneEquipe();
}

// ---- Sub-aba: Conteúdo (biblioteca publicada) ----
function paneConteudo() {
  const pane = document.getElementById("corpo-pane");
  if (!CONT._supaOk()) { pane.innerHTML = `<p class="page-sub">Disponível com a conta conectada (backend online).</p>`; return; }
  CONT.publicados().then(items => {
    if (!items.length) { pane.innerHTML = `<div class="card"><p class="page-sub" style="margin:0">Ainda não há conteúdo publicado. Crie em “Meus conteúdos” e envie para revisão.</p></div>`; return; }
    pane.innerHTML = `<div class="grid grid-2">${items.map(c => `
      <div class="card clickable cont-card" onclick="navigate('corpo','ver:${c.id}')" tabindex="0" role="button">
        <div class="cont-card-cat">${esc(c.categoria || "Conteúdo")}</div>
        <h3 class="cont-card-title">${esc(c.titulo)}</h3>
        <p class="cont-card-resumo">${esc(c.resumo || "")}</p>
        <div class="cont-card-meta">${contData(c.published_at)} <i class="ti ti-arrow-right"></i></div>
      </div>`).join("")}</div>`;
  }).catch(e => { pane.innerHTML = `<p class="page-sub">Não foi possível carregar o conteúdo (a migration 0014_cms.sql foi aplicada?): ${esc(e.message || e)}</p>`; });
}

// ---- Sub-aba: Conteúdo → detalhe de um publicado ----
function paneVer(id) {
  const pane = document.getElementById("corpo-pane");
  CONT.ver(id).then(c => {
    pane.innerHTML = `
      <button class="back-link" onclick="navigate('corpo','conteudo')"><i class="ti ti-arrow-left"></i>Conteúdo</button>
      <div class="detail-header">
        <h2>${esc(c.titulo)}</h2>
        <div class="sub">${esc(c.categoria || "Conteúdo")} · publicado em ${contData(c.published_at)}</div>
      </div>
      ${c.resumo ? `<p class="cont-det-resumo">${esc(c.resumo)}</p>` : ""}
      <div class="card cont-corpo">${contCorpoHTML(c.corpo)}</div>
      <p class="page-sub" style="margin-top:14px"><i class="ti ti-shield-check"></i> Conteúdo revisado pela equipe técnica do Civilbook. Orientativo — confira sempre as normas vigentes.</p>`;
  }).catch(() => { pane.innerHTML = `<p class="page-sub">Conteúdo indisponível.</p>`; });
}

// ---- Sub-aba: Meus conteúdos (autoria) ----
function paneMeus() {
  const pane = document.getElementById("corpo-pane");
  if (!pane) return;
  CONT.meus().then(items => {
    const body = items.length ? items.map(c => `
      <div class="card cont-row">
        <div style="flex:1;min-width:0">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${contBadge(c.status)}<span style="color:var(--text-3);font-size:12px">${esc(c.categoria || "—")} · atualizado ${contData(c.updated_at)}</span></div>
          <div style="font-weight:600;margin-top:4px">${esc(c.titulo)}</div>
          ${c.status === "rejeitado" && c.nota_revisao ? `<div class="cont-nota"><i class="ti ti-message-2"></i> Revisor: ${esc(c.nota_revisao)}</div>` : ""}
        </div>
        <div class="cont-row-acoes">
          ${c.status === "publicado" ? `<button class="btn" onclick="navigate('corpo','ver:${c.id}')"><i class="ti ti-external-link"></i>Ver</button>` : `<button class="btn" onclick="contEditor('${c.id}')"><i class="ti ti-edit"></i>Editar</button>`}
          ${(c.status === "rascunho" || c.status === "rejeitado") ? `<button class="btn primary" onclick="contEnviar('${c.id}')"><i class="ti ti-send"></i>Enviar p/ revisão</button>` : ""}
          ${(c.status === "rascunho" || c.status === "rejeitado") ? `<button class="btn icon-only" title="Excluir" onclick="contRemover('${c.id}')"><i class="ti ti-trash"></i></button>` : ""}
        </div>
      </div>`).join("") : `<div class="card"><p class="page-sub" style="margin:0">Você ainda não criou conteúdo. Clique em “Novo conteúdo”.</p></div>`;
    pane.innerHTML = `<div style="margin-bottom:14px"><button class="btn primary" onclick="contEditor()"><i class="ti ti-plus"></i>Novo conteúdo</button></div>${body}`;
  }).catch(e => { pane.innerHTML = `<p class="page-sub">Erro ao carregar (a migration 0014_cms.sql foi aplicada?): ${esc(e.message || e)}</p>`; });
}

// ---- Sub-aba: Revisão (editor/admin) ----
function paneRevisao() {
  const pane = document.getElementById("corpo-pane");
  if (!pane) return;
  CONT.fila().then(items => {
    pane.innerHTML = items.length ? items.map(c => `
      <div class="card cont-row">
        <div style="flex:1;min-width:0">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${contBadge(c.status)}<span style="color:var(--text-3);font-size:12px">${esc(c.categoria || "—")} · enviado ${contData(c.updated_at)}</span></div>
          <div style="font-weight:600;margin-top:4px">${esc(c.titulo)}</div>
          <div style="font-size:13px;color:var(--text-2);margin-top:2px">${esc(c.resumo || "")}</div>
        </div>
        <div class="cont-row-acoes"><button class="btn primary" onclick="contRevisar('${c.id}')"><i class="ti ti-eye-check"></i>Revisar</button></div>
      </div>`).join("") : `<div class="card"><p class="page-sub" style="margin:0">Nenhum conteúdo aguardando revisão.</p></div>`;
  }).catch(e => { pane.innerHTML = `<p class="page-sub">Erro ao carregar a fila: ${esc(e.message || e)}</p>`; });
}

// ---- Sub-aba: Equipe (admin) ----
function paneEquipe() {
  const pane = document.getElementById("corpo-pane");
  if (!pane) return;
  pane.innerHTML = `<p class="page-sub">Defina quem produz e revisa conteúdo. <strong>autor</strong> cria e envia; <strong>editor</strong> revisa e publica.</p><div id="corpo-equipe"><p class="page-sub">Carregando…</p></div>`;
  CONT.usuarios().then(us => {
    document.getElementById("corpo-equipe").innerHTML = `<div class="card" style="overflow-x:auto"><table class="data">
      <thead><tr><th>Usuário</th><th>E-mail</th><th style="width:160px">Papel</th></tr></thead>
      <tbody>${us.map(u => `<tr>
        <td>${esc(u.nome || "—")}</td>
        <td>${esc(u.email_cache || "—")}</td>
        <td><select class="sinapi-uf" data-cbselect style="min-width:120px" onchange="contPapel('${u.id}', this.value, this)">
          ${["user", "autor", "editor", "admin"].map(p => `<option value="${p}"${(u.role || "user") === p ? " selected" : ""}>${p}</option>`).join("")}
        </select></td>
      </tr>`).join("")}</tbody></table></div>`;
  }).catch(e => { document.getElementById("corpo-equipe").innerHTML = `<p class="page-sub">Erro: ${esc(e.message || e)}</p>`; });
}

// ── Ações (modais e operações) ─────────────────────────────────────────────
function contFecharModal() { document.querySelectorAll(".cb-modal-ov").forEach(e => e.remove()); }

// Editor de conteúdo (novo ou edição). id ausente = novo.
async function contEditor(id) {
  let c = { titulo: "", categoria: CONT.CATS[0], resumo: "", corpo: "" };
  if (id) { try { c = await CONT.ver(id); } catch (e) { toast("Não foi possível abrir o conteúdo.", "error"); return; } }
  contFecharModal();
  const ov = document.createElement("div");
  ov.className = "cb-modal-ov";
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  ov.innerHTML = `<div class="card cb-modal-box" role="dialog" aria-modal="true" style="max-width:720px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <h3 style="margin:0">${id ? "Editar conteúdo" : "Novo conteúdo"}</h3>
      <button class="btn icon-only" aria-label="Fechar" onclick="contFecharModal()"><i class="ti ti-x"></i></button>
    </div>
    <div class="field"><label>Título</label><input type="text" id="ct-titulo" maxlength="160" value="${esc(c.titulo)}" placeholder="Ex.: Cuidados na cura do concreto em clima quente"></div>
    <div class="field"><label>Categoria</label><select id="ct-cat">${CONT.CATS.map(x => `<option${c.categoria === x ? " selected" : ""}>${x}</option>`).join("")}</select></div>
    <div class="field"><label>Resumo (1–2 linhas)</label><textarea id="ct-resumo" rows="2" maxlength="280" placeholder="Aparece na listagem.">${esc(c.resumo || "")}</textarea></div>
    <div class="field"><label>Conteúdo</label>
      <div class="cont-cit-bar"><button type="button" class="btn sm" onclick="bibPickerCitacao()"><i class="ti ti-quote"></i>Inserir citação</button><span class="cont-cit-dica">Cita uma referência da Biblioteca apontando página/trecho.</span></div>
      <textarea id="ct-corpo" rows="12" placeholder="Escreva o conteúdo. Deixe uma linha em branco entre parágrafos.">${esc(c.corpo || "")}</textarea></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:6px">
      <button class="btn" onclick="contFecharModal()">Cancelar</button>
      <button class="btn" id="ct-save"><i class="ti ti-device-floppy"></i>Salvar rascunho</button>
      <button class="btn primary" id="ct-save-send"><i class="ti ti-send"></i>Salvar e enviar p/ revisão</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  const ler = () => ({
    titulo: document.getElementById("ct-titulo").value.trim(),
    categoria: document.getElementById("ct-cat").value,
    resumo: document.getElementById("ct-resumo").value.trim(),
    corpo: document.getElementById("ct-corpo").value.trim()
  });
  const gravar = async (enviar) => {
    const dados = ler();
    if (!dados.titulo) { toast("Dê um título ao conteúdo.", "error"); return; }
    try {
      let cid = id;
      if (id) await CONT.salvar(id, dados); else cid = (await CONT.criar(dados)).id;
      if (enviar) await CONT.enviarRevisao(cid);
      contFecharModal();
      toast(enviar ? "Enviado para revisão." : "Rascunho salvo.", "success");
      paneMeus();
    } catch (e) { toast("Erro ao salvar: " + (e.message || e), "error"); }
  };
  ov.querySelector("#ct-save").onclick = () => gravar(false);
  ov.querySelector("#ct-save-send").onclick = () => gravar(true);
  setTimeout(() => { const t = document.getElementById("ct-titulo"); if (t) t.focus(); }, 30);
}

async function contEnviar(id) {
  try { await CONT.enviarRevisao(id); toast("Enviado para revisão.", "success"); paneMeus(); }
  catch (e) { toast("Erro: " + (e.message || e), "error"); }
}

async function contRemover(id) {
  if (!await cbConfirmar("Excluir este conteúdo? Esta ação não pode ser desfeita.")) return;
  try { await CONT.remover(id); toast("Conteúdo excluído.", "success"); paneMeus(); }
  catch (e) { toast("Erro ao excluir: " + (e.message || e), "error"); }
}

// Revisão (editor): visualiza e decide.
async function contRevisar(id) {
  let c;
  try { c = await CONT.ver(id); } catch (e) { toast("Não foi possível abrir.", "error"); return; }
  contFecharModal();
  const ov = document.createElement("div");
  ov.className = "cb-modal-ov";
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  ov.innerHTML = `<div class="card cb-modal-box" role="dialog" aria-modal="true" style="max-width:760px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
      <div><div style="font-size:12px;color:var(--text-3)">${esc(c.categoria || "Conteúdo")} · em revisão</div><h3 style="margin:2px 0 0">${esc(c.titulo)}</h3></div>
      <button class="btn icon-only" aria-label="Fechar" onclick="contFecharModal()"><i class="ti ti-x"></i></button>
    </div>
    ${c.resumo ? `<p class="cont-det-resumo">${esc(c.resumo)}</p>` : ""}
    <div class="cont-corpo cont-revisar-corpo">${contCorpoHTML(c.corpo)}</div>
    <div class="field" style="margin-top:12px"><label>Nota ao autor (obrigatória para devolver)</label><textarea id="cr-nota" rows="2" placeholder="O que precisa ajustar?"></textarea></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
      <button class="btn" onclick="contFecharModal()">Fechar</button>
      <button class="btn" id="cr-devolver"><i class="ti ti-arrow-back-up"></i>Devolver</button>
      <button class="btn primary" id="cr-publicar"><i class="ti ti-check"></i>Publicar</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelector("#cr-publicar").onclick = async () => {
    try { await CONT.publicar(id); contFecharModal(); toast("Conteúdo publicado.", "success"); paneRevisao(); }
    catch (e) { toast("Erro ao publicar: " + (e.message || e), "error"); }
  };
  ov.querySelector("#cr-devolver").onclick = async () => {
    const nota = document.getElementById("cr-nota").value.trim();
    if (!nota) { toast("Escreva uma nota explicando o que ajustar.", "error"); return; }
    try { await CONT.devolver(id, nota); contFecharModal(); toast("Conteúdo devolvido ao autor.", "success"); paneRevisao(); }
    catch (e) { toast("Erro ao devolver: " + (e.message || e), "error"); }
  };
}

async function contPapel(uid, papel, selEl) {
  if (selEl) selEl.disabled = true;
  try { await CONT.definirPapel(uid, papel); toast("Papel atualizado para “" + papel + "”.", "success"); }
  catch (e) { toast("Erro: " + (e.message || e), "error"); }
  if (selEl) selEl.disabled = false;
}

// ══════════════════════════════════════════════════════════════════════════
// e6 — Biblioteca (sub-aba do corpo técnico): acervo, upload, abrir PDF, vínculos, citações.
// ══════════════════════════════════════════════════════════════════════════
function bibVal(id) { const e = document.getElementById(id); return e ? e.value : ""; }

function paneBiblioteca() {
  const pane = document.getElementById("corpo-pane");
  if (!pane) return;
  if (typeof BIBLIO === "undefined" || !BIBLIO._supaOk()) { pane.innerHTML = `<p class="page-sub">Disponível com a conta conectada (backend online).</p>`; return; }
  pane.innerHTML = `
    <div class="bib-toolbar">
      <div class="nav-search bib-search"><i class="ti ti-search"></i><input type="text" id="bib-q" placeholder="Buscar por título, autor ou órgão…" oninput="bibBuscarDebounce()" aria-label="Buscar referências"></div>
      <button class="btn primary" onclick="bibEditor()"><i class="ti ti-plus"></i>Adicionar referência</button>
      <button class="btn" onclick="cbAssessor('abrirCom','biblioteca')" title="Abrir o assessor já sabendo que você está na Biblioteca (f40)"><i class="ti ti-sparkles" aria-hidden="true"></i> Perguntar à IA</button>
    </div>
    <div id="bib-lista"><p class="page-sub">Carregando…</p></div>`;
  bibCarregar("");
}
let _bibT = null;
function bibBuscarDebounce() { clearTimeout(_bibT); _bibT = setTimeout(() => bibCarregar(bibVal("bib-q")), 250); }
function bibCarregar(q) {
  const el = document.getElementById("bib-lista"); if (!el) return;
  BIBLIO.listar(q).then(items => {
    if (!items.length) { el.innerHTML = `<div class="card"><p class="page-sub" style="margin:0">Nenhuma referência. Clique em “Adicionar referência” para enviar um PDF (norma, livro, manual, artigo) ao acervo privado.</p></div>`; return; }
    el.innerHTML = `<div class="grid grid-2">${items.map(bibCard).join("")}</div>`;
  }).catch(e => { el.innerHTML = `<p class="page-sub">Erro ao carregar (a migration 0017_biblioteca.sql foi aplicada?): ${esc(e.message || e)}</p>`; });
}
function bibCard(r) {
  const meta = [r.orgao, r.ano].filter(Boolean).join(" · ");
  const acaoPdf = r.arquivo_path
    ? `<button class="btn sm" onclick="bibAbrir('${r.id}')"><i class="ti ti-file-text"></i>Abrir PDF</button>`
    : (r.fonte_url ? `<a class="btn sm" href="${esc(r.fonte_url)}" target="_blank" rel="noopener noreferrer"><i class="ti ti-external-link"></i>Fonte</a>` : `<span class="bib-sempdf">sem PDF</span>`);
  return `<div class="card bib-card">
    <div class="bib-tipo">${esc(r.tipo || "outro")}</div>
    <h3 class="bib-titulo">${esc(r.titulo)}</h3>
    ${r.autores ? `<div class="bib-aut">${esc(r.autores)}</div>` : ""}
    ${meta ? `<div class="bib-meta">${esc(meta)}</div>` : ""}
    <div class="bib-acoes">
      ${acaoPdf}
      <button class="btn sm" onclick="bibLinks('${r.id}')"><i class="ti ti-link"></i>Vínculos</button>
      <button class="btn sm icon-only" title="Editar" onclick="bibEditor('${r.id}')"><i class="ti ti-edit"></i></button>
      <button class="btn sm icon-only" title="Excluir" onclick="bibRemover('${r.id}')"><i class="ti ti-trash"></i></button>
    </div>
  </div>`;
}

async function bibAbrir(id) {
  try {
    const r = await BIBLIO.ref(id);
    if (r.arquivo_path) { const url = await BIBLIO.urlAssinada(r.arquivo_path); PDFV.abrir({ url, titulo: r.titulo }); }
    else if (r.fonte_url) window.open(r.fonte_url, "_blank", "noopener");
    else toast("Esta referência não tem PDF anexado.", "info");
  } catch (e) { toast("Erro ao abrir: " + (e.message || e), "error"); }
}

async function bibEditor(id) {
  let r = { titulo: "", autores: "", orgao: "", ano: "", tipo: "norma", fonte_url: "", arquivo_path: null };
  if (id) { try { r = await BIBLIO.ref(id); } catch (e) { toast("Não foi possível abrir.", "error"); return; } }
  contFecharModal();
  const ov = document.createElement("div"); ov.className = "cb-modal-ov"; ov.onclick = e => { if (e.target === ov) ov.remove(); };
  ov.innerHTML = `<div class="card cb-modal-box" role="dialog" aria-modal="true" style="max-width:560px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <h3 style="margin:0">${id ? "Editar referência" : "Nova referência"}</h3>
      <button class="btn icon-only" aria-label="Fechar" onclick="contFecharModal()"><i class="ti ti-x"></i></button>
    </div>
    <div class="field"><label>Título</label><input type="text" id="bib-titulo" maxlength="240" value="${esc(r.titulo)}" placeholder="Ex.: NBR 6118 — Projeto de estruturas de concreto"></div>
    <div class="field"><label>Autores</label><input type="text" id="bib-autores" maxlength="240" value="${esc(r.autores || "")}" placeholder="Ex.: ABNT"></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <div class="field" style="flex:1;min-width:150px"><label>Órgão emissor</label><input type="text" id="bib-orgao" maxlength="120" value="${esc(r.orgao || "")}" placeholder="ABNT, DNIT, editora…"></div>
      <div class="field" style="width:90px"><label>Ano</label><input type="number" id="bib-ano" value="${r.ano || ""}" placeholder="2024"></div>
      <div class="field" style="width:130px"><label>Tipo</label><select id="bib-tipo">${BIBLIO.TIPOS.map(t => `<option${r.tipo === t ? " selected" : ""}>${t}</option>`).join("")}</select></div>
    </div>
    <div class="field"><label>PDF ${id && r.arquivo_path ? "(enviar substitui o atual)" : "(opcional)"}</label><input type="file" id="bib-file" accept="application/pdf"></div>
    <div class="field"><label>Ou link externo (quando não há PDF próprio)</label><input type="url" id="bib-fonte" value="${esc(r.fonte_url || "")}" placeholder="https://…"></div>
    <p style="font-size:12px;color:var(--text-3);margin:-4px 0 10px"><i class="ti ti-shield-lock"></i> O PDF vai para um bucket PRIVADO (atrás de login). Não envie material sem direito de uso (respeite o licenciamento).</p>
    <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
      <button class="btn" onclick="contFecharModal()">Cancelar</button>
      <button class="btn primary" id="bib-save"><i class="ti ti-device-floppy"></i>Salvar</button>
    </div></div>`;
  document.body.appendChild(ov);
  ov.querySelector("#bib-save").onclick = async () => {
    const meta = {
      titulo: bibVal("bib-titulo").trim(), autores: bibVal("bib-autores").trim(), orgao: bibVal("bib-orgao").trim(),
      ano: parseInt(bibVal("bib-ano"), 10) || null, tipo: bibVal("bib-tipo"), fonte_url: bibVal("bib-fonte").trim()
    };
    if (!meta.titulo) { toast("Dê um título à referência.", "error"); return; }
    const file = document.getElementById("bib-file").files[0];
    if (file && file.type && file.type.indexOf("pdf") < 0) { toast("Envie um arquivo PDF.", "error"); return; }
    const btn = ov.querySelector("#bib-save"); btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2"></i>Salvando…';
    try {
      let rid = id;
      if (id) await BIBLIO.atualizar(id, meta); else rid = (await BIBLIO.criar(meta)).id;
      if (file) await BIBLIO.enviarArquivo(rid, file);
      contFecharModal(); toast("Referência salva.", "success"); bibCarregar(bibVal("bib-q"));
    } catch (e) { toast("Erro ao salvar: " + (e.message || e), "error"); btn.disabled = false; btn.innerHTML = '<i class="ti ti-device-floppy"></i>Salvar'; }
  };
  setTimeout(() => { const t = document.getElementById("bib-titulo"); if (t) t.focus(); }, 30);
}

async function bibRemover(id) {
  if (!await cbConfirmar("Excluir esta referência e seu PDF do acervo? Esta ação não pode ser desfeita.")) return;
  try { const r = await BIBLIO.ref(id); await BIBLIO.remover(id, r.arquivo_path); toast("Referência excluída.", "success"); bibCarregar(bibVal("bib-q")); }
  catch (e) { toast("Erro ao excluir: " + (e.message || e), "error"); }
}

// ---- Referências cruzadas (vínculos N:N) ----
async function bibLinks(refId) {
  let r, links;
  try { r = await BIBLIO.ref(refId); links = await BIBLIO.links(refId); } catch (e) { toast("Erro: " + (e.message || e), "error"); return; }
  contFecharModal();
  const ov = document.createElement("div"); ov.className = "cb-modal-ov"; ov.onclick = e => { if (e.target === ov) ov.remove(); };
  ov.innerHTML = `<div class="card cb-modal-box" role="dialog" aria-modal="true" style="max-width:560px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <h3 style="margin:0;font-size:17px">Vínculos — ${esc(r.titulo)}</h3>
      <button class="btn icon-only" aria-label="Fechar" onclick="contFecharModal()"><i class="ti ti-x"></i></button>
    </div>
    <p style="font-size:12.5px;color:var(--text-2);margin:0 0 10px">Referências cruzadas: ligue a uma norma (código), a um conteúdo publicado (id), a um laudo (id) ou a outra referência (id).</p>
    <div id="bib-links-lista">${bibLinksHTML(links)}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-top:12px">
      <div class="field" style="width:130px;margin:0"><label>Tipo</label><select id="bl-tipo">${BIBLIO.ALVOS.map(a => `<option value="${a}">${a}</option>`).join("")}</select></div>
      <div class="field" style="flex:1;min-width:150px;margin:0"><label>Alvo (código/id)</label><input type="text" id="bl-alvo" placeholder="ex.: NBR 6118"></div>
      <button class="btn primary" onclick="bibVincular('${refId}')"><i class="ti ti-plus"></i>Vincular</button>
    </div></div>`;
  document.body.appendChild(ov);
}
function bibLinksHTML(links) {
  if (!links.length) return `<p class="page-sub" style="margin:0">Sem vínculos ainda.</p>`;
  return `<ul class="bib-links">${links.map(l => `<li><span class="pill pill-gray">${esc(l.alvo_tipo)}</span> <code>${esc(l.alvo_id)}</code>${l.rotulo ? ` — ${esc(l.rotulo)}` : ""}<button class="btn sm icon-only" title="Remover vínculo" onclick="bibDesvincular('${l.id}', this)"><i class="ti ti-x"></i></button></li>`).join("")}</ul>`;
}
async function bibVincular(refId) {
  const tipo = bibVal("bl-tipo"), alvo = bibVal("bl-alvo").trim();
  if (!alvo) { toast("Informe o alvo do vínculo.", "error"); return; }
  try { await BIBLIO.vincular(refId, tipo, alvo); const links = await BIBLIO.links(refId); document.getElementById("bib-links-lista").innerHTML = bibLinksHTML(links); const a = document.getElementById("bl-alvo"); if (a) a.value = ""; toast("Vínculo criado.", "success"); }
  catch (e) { toast("Erro ao vincular: " + (e.message || e), "error"); }
}
async function bibDesvincular(linkId, btn) {
  try { await BIBLIO.desvincular(linkId); const li = btn.closest("li"); if (li) li.remove(); toast("Vínculo removido.", "success"); }
  catch (e) { toast("Erro: " + (e.message || e), "error"); }
}

// ---- Picker de citação (chamado pelo editor de conteúdo) ----
async function bibPickerCitacao() {
  if (typeof BIBLIO === "undefined" || !BIBLIO._supaOk()) { toast("Biblioteca indisponível (backend offline).", "info"); return; }
  let refs;
  try { refs = await BIBLIO.listar(""); } catch (e) { toast("Erro ao listar referências: " + (e.message || e), "error"); return; }
  const ov = document.createElement("div"); ov.className = "cb-modal-ov"; ov.style.zIndex = "1200"; ov.onclick = e => { if (e.target === ov) ov.remove(); };
  ov.innerHTML = `<div class="card cb-modal-box" role="dialog" aria-modal="true" style="max-width:520px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><h3 style="margin:0;font-size:17px">Inserir citação</h3><button class="btn icon-only" aria-label="Fechar" onclick="this.closest('.cb-modal-ov').remove()"><i class="ti ti-x"></i></button></div>
    ${refs.length ? `
      <div class="field"><label>Referência</label><select id="cit-ref">${refs.map(r => `<option value="${r.id}">${esc(r.titulo)}${r.ano ? ` (${r.ano})` : ""}</option>`).join("")}</select></div>
      <div style="display:flex;gap:10px">
        <div class="field" style="width:110px"><label>Página</label><input type="number" id="cit-pag" min="1" value="1"></div>
        <div class="field" style="flex:1"><label>Trecho (opcional)</label><input type="text" id="cit-trecho" maxlength="120" placeholder="palavras p/ destacar"></div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" onclick="this.closest('.cb-modal-ov').remove()">Cancelar</button><button class="btn primary" id="cit-ins"><i class="ti ti-quote"></i>Inserir</button></div>`
    : `<p class="page-sub">Você ainda não tem referências. Adicione na aba <strong>Biblioteca</strong> primeiro.</p>`}
  </div>`;
  document.body.appendChild(ov);
  const ins = ov.querySelector("#cit-ins");
  if (ins) ins.onclick = () => {
    const id = bibVal("cit-ref"), pg = parseInt(bibVal("cit-pag"), 10) || 1;
    const tr = bibVal("cit-trecho").trim().replace(/[\[\]|]/g, "");   // marcador usa [ ] | — saneia
    bibInserirNoCorpo(`[[ref:${id}|p=${pg}${tr ? `|${tr}` : ""}]]`);
    ov.remove();
  };
}
function bibInserirNoCorpo(texto) {
  const ta = document.getElementById("ct-corpo"); if (!ta) return;
  const s = ta.selectionStart || 0, e = ta.selectionEnd || 0;
  ta.value = ta.value.slice(0, s) + texto + ta.value.slice(e);
  ta.focus(); ta.selectionStart = ta.selectionEnd = s + texto.length;
}
