// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// e13 — Voz do cliente: canal de feedback in-app (avaliação NPS + sugestão/funcionalidade/problema),
// com contexto (módulo) capturado automaticamente. Dados em public.feedback (migration 0018) com RLS:
// cada usuário insere e lê o seu; admin lê/tria tudo. O NPS alimenta o dashboard de marketing (e5).
// Carregado no app (modal de envio) e no admin (FB.listar/atualizar p/ a aba Feedback).
const FB = {
  TIPOS: {
    avaliacao:    { label: "Avaliação",     icone: "ti-star",          dica: "De 0 a 10, o quanto você recomendaria o Civilbook a um colega?" },
    sugestao:     { label: "Sugestão",      icone: "ti-bulb",          dica: "O que poderíamos melhorar?" },
    funcionalidade:{ label: "Funcionalidade",icone: "ti-wand",          dica: "Que recurso você gostaria de ver?" },
    problema:     { label: "Problema",      icone: "ti-bug",           dica: "O que não funcionou como esperado?" }
  },
  STATUS: { novo: ["Novo", "pill-gray"], em_analise: ["Em análise", "pill-amber"], planejado: ["Planejado", "pill-blue"], concluido: ["Concluído", "pill-teal"] },

  _supaOk() { return !!(typeof window !== "undefined" && window.supa && typeof AUTH !== "undefined" && AUTH.session()); },
  _esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); },
  _contexto() { try { return (typeof currentModule !== "undefined" && currentModule) ? currentModule : ((location.hash || "").replace(/^#/, "").split("/")[0] || "app"); } catch (e) { return "app"; } },

  // ---- Usuário ----
  async enviar(f) {
    const row = {
      user_id: AUTH.session().id, tipo: f.tipo,
      nota: (f.tipo === "avaliacao" && f.nota != null) ? f.nota : null,
      texto: f.texto || null, contexto: f.contexto || this._contexto()
    };
    const { error } = await window.supa.from("feedback").insert(row);
    if (error) throw error;
  },
  async meus() {
    if (!this._supaOk()) return [];
    const { data, error } = await window.supa.from("feedback")
      .select("id,tipo,nota,texto,contexto,status,created_at")
      .eq("user_id", AUTH.session().id).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return data || [];
  },

  // ---- Admin ----
  async listar(filtro) {
    let q = window.supa.from("feedback").select("*").order("created_at", { ascending: false }).limit(300);
    if (filtro && filtro.tipo) q = q.eq("tipo", filtro.tipo);
    if (filtro && filtro.status) q = q.eq("status", filtro.status);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },
  // e31 (Parte 2): AUTORES em lote — user_id -> {nome, email} pela RPC admin_autores (0079,
  // gate is_admin no banco). Tolerante: sem a migration (ou sem permissão) devolve mapa vazio e o
  // painel mostra o user_id curto — a rastreabilidade não depende disto.
  async autores(ids) {
    const unicos = [...new Set((ids || []).filter(Boolean))];
    if (!unicos.length || !window.supa) return new Map();
    try {
      const { data, error } = await window.supa.rpc("admin_autores", { ids: unicos });
      if (error || !Array.isArray(data)) return new Map();
      return new Map(data.map(r => [r.id, { nome: r.nome || "", email: r.email || "" }]));
    } catch (e) { return new Map(); }
  },
  async atualizarStatus(id, status) {
    const { error } = await window.supa.from("feedback").update({ status }).eq("id", id);
    if (error) throw error;
  },
  async promover(id, val) {
    const { error } = await window.supa.from("feedback").update({ promovido: !!val }).eq("id", id);
    if (error) throw error;
  },
  // NPS dos dados de 'avaliacao' (admin lê tudo via RLS; computa no cliente). Para o e5.
  async npsResumo() {
    const { data, error } = await window.supa.from("feedback").select("nota").eq("tipo", "avaliacao").not("nota", "is", null).limit(5000);
    if (error) throw error;
    const notas = (data || []).map(r => r.nota);
    const n = notas.length;
    if (!n) return { respostas: 0, nps: null, promotores: 0, detratores: 0 };
    const prom = notas.filter(x => x >= 9).length, det = notas.filter(x => x <= 6).length;
    return { respostas: n, promotores: prom, detratores: det, nps: Math.round((prom - det) / n * 100) };
  }
};
if (typeof window !== "undefined") window.FB = FB;

// ══════════════════════════════════════════════════════════════════════════
// Modal de feedback in-app (usado no app, via botão do menu do usuário).
// ══════════════════════════════════════════════════════════════════════════
let _fbTipo = "avaliacao", _fbNota = null;

function fbAbrir(tipo) {
  if (!FB._supaOk()) { if (typeof toast === "function") toast("Disponível com a conta conectada.", "info"); return; }
  _fbTipo = tipo || "avaliacao"; _fbNota = null;
  document.querySelectorAll(".cb-modal-ov").forEach(e => e.remove());
  const ov = document.createElement("div");
  ov.className = "cb-modal-ov";
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  ov.innerHTML = `<div class="card cb-modal-box" role="dialog" aria-modal="true" aria-label="Feedback" style="max-width:540px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <h3 style="margin:0;font-size:18px"><i class="ti ti-message-2-heart" aria-hidden="true"></i> Sua opinião</h3>
      <button class="btn icon-only" aria-label="Fechar" onclick="this.closest('.cb-modal-ov').remove()"><i class="ti ti-x"></i></button>
    </div>
    <div class="tabs-bar fb-tabs">
      <button id="fb-tab-enviar" class="active" onclick="fbTab('enviar')"><i class="ti ti-send"></i> Enviar</button>
      <button id="fb-tab-meus" onclick="fbTab('meus')"><i class="ti ti-history"></i> Meus envios</button>
    </div>
    <div id="fb-pane-enviar">
      <div class="fb-tipos">
        ${Object.keys(FB.TIPOS).map(t => `<button type="button" class="fb-tipo${t === _fbTipo ? " active" : ""}" data-t="${t}" onclick="fbTipo('${t}')"><i class="ti ${FB.TIPOS[t].icone}"></i>${FB.TIPOS[t].label}</button>`).join("")}
      </div>
      <div id="fb-form"></div>
      <p class="fb-ctx"><i class="ti ti-map-pin" aria-hidden="true"></i> Enviado a partir de: <strong>${FB._esc(FB._contexto())}</strong></p>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">
        <button class="btn" onclick="this.closest('.cb-modal-ov').remove()">Cancelar</button>
        <button class="btn primary" id="fb-enviar"><i class="ti ti-send"></i>Enviar</button>
      </div>
    </div>
    <div id="fb-pane-meus" style="display:none"><p class="page-sub">Carregando…</p></div>
  </div>`;
  document.body.appendChild(ov);
  fbForm();
  ov.querySelector("#fb-enviar").onclick = fbEnviar;
}

function fbTab(qual) {
  const en = document.getElementById("fb-pane-enviar"), me = document.getElementById("fb-pane-meus");
  const tEn = document.getElementById("fb-tab-enviar"), tMe = document.getElementById("fb-tab-meus");
  if (!en || !me) return;
  const enviar = qual === "enviar";
  en.style.display = enviar ? "" : "none"; me.style.display = enviar ? "none" : "";
  tEn.classList.toggle("active", enviar); tMe.classList.toggle("active", !enviar);
  if (!enviar) fbMeus();
}

function fbTipo(t) {
  _fbTipo = t; _fbNota = null;
  document.querySelectorAll(".fb-tipo").forEach(b => b.classList.toggle("active", b.dataset.t === t));
  fbForm();
}

function fbForm() {
  const f = document.getElementById("fb-form"); if (!f) return;
  const dica = FB.TIPOS[_fbTipo].dica;
  if (_fbTipo === "avaliacao") {
    f.innerHTML = `<p class="fb-dica">${FB._esc(dica)}</p>
      <div class="fb-nps" role="group" aria-label="Nota de 0 a 10">
        ${Array.from({ length: 11 }, (_, n) => `<button type="button" class="fb-nps-b" data-n="${n}" onclick="fbNota(${n})" aria-label="Nota ${n}">${n}</button>`).join("")}
      </div>
      <div class="fb-nps-leg"><span>Não recomendaria</span><span>Recomendaria muito</span></div>
      <div class="field" style="margin-top:10px"><label>Comentário (opcional)</label><textarea id="fb-texto" rows="3" maxlength="1000" placeholder="Conte o porquê da nota (opcional)."></textarea></div>`;
  } else {
    f.innerHTML = `<p class="fb-dica">${FB._esc(dica)}</p>
      <div class="field"><textarea id="fb-texto" rows="5" maxlength="2000" placeholder="${FB._esc(dica)}"></textarea></div>`;
  }
}

function fbNota(n) {
  _fbNota = n;
  document.querySelectorAll(".fb-nps-b").forEach(b => b.classList.toggle("active", Number(b.dataset.n) === n));
}

async function fbEnviar() {
  const texto = (document.getElementById("fb-texto") || {}).value || "";
  if (_fbTipo === "avaliacao" && _fbNota == null) { toast("Escolha uma nota de 0 a 10.", "error"); return; }
  if (_fbTipo !== "avaliacao" && !texto.trim()) { toast("Escreva sua mensagem.", "error"); return; }
  const btn = document.getElementById("fb-enviar"); if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2"></i>Enviando…'; }
  try {
    await FB.enviar({ tipo: _fbTipo, nota: _fbNota, texto: texto.trim() });
    document.querySelectorAll(".cb-modal-ov").forEach(e => e.remove());
    toast("Obrigado! Seu feedback foi enviado.", "success");
  } catch (e) {
    toast("Não foi possível enviar (a migration 0018_feedback.sql foi aplicada?): " + (e.message || e), "error");
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-send"></i>Enviar'; }
  }
}

function fbMeus() {
  const pane = document.getElementById("fb-pane-meus"); if (!pane) return;
  FB.meus().then(items => {
    if (!items.length) { pane.innerHTML = `<p class="page-sub" style="margin:8px 0">Você ainda não enviou feedback. Use a aba “Enviar”.</p>`; return; }
    pane.innerHTML = items.map(x => {
      const st = FB.STATUS[x.status] || [x.status, "pill-gray"];
      const cab = FB.TIPOS[x.tipo] ? FB.TIPOS[x.tipo].label : x.tipo;
      const nota = x.tipo === "avaliacao" && x.nota != null ? ` · nota ${x.nota}/10` : "";
      return `<div class="fb-meu">
        <div class="fb-meu-top"><span class="fb-meu-tipo">${FB._esc(cab)}${nota}</span><span class="pill ${st[1]}">${st[0]}</span></div>
        ${x.texto ? `<div class="fb-meu-txt">${FB._esc(x.texto)}</div>` : ""}
        <div class="fb-meu-meta">${new Date(x.created_at).toLocaleDateString("pt-BR")} · ${FB._esc(x.contexto || "")}</div>
      </div>`;
    }).join("");
  }).catch(e => { pane.innerHTML = `<p class="page-sub">Erro ao carregar: ${FB._esc(e.message || e)}</p>`; });
}
