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

// ══════════════════════════════════════════════════════════════════════════
// e34 (23/set/2026) — O CONVITE. O app PERGUNTA a nota, em vez de esperar que a pessoa ache o ícone.
//
// POR QUE: a máquina de escuta (tabela, RLS, triagem no Admin, NPS) estava pronta desde a e13 e ninguém
// nunca era convidado a usá-la. O fbAbrir tinha DOIS chamadores — um botão de ícone `nav-so-desktop` e
// uma linha da gaveta "Mais" do celular: no celular, a única porta era uma gaveta que a pessoa precisa
// abrir por conta própria. O piloto acontece uma vez; sem pergunta, termina com NPS nulo.
//
// AS QUATRO DECISÕES, e o porquê de cada uma:
//
//  · QUANDO — na Início, numa abertura que não é a primeira, depois de a tela ÚTIL ter desenhado. Nunca
//    no meio de trabalho: _ocupado() recusa fora da Início, com modal aberto, com a folha ("Mais"/conta)
//    aberta e com o foco num campo (quem está digitando está trabalhando). E não basta abrir o app três
//    vezes seguidas: ESPERA_MS exige um dia inteiro entre a primeira abertura e a pergunta — três
//    recarregamentos num minuto não são uso de verdade, e nota dada sem uso não vale para o NPS.
//  · COMO — um cartão no fluxo da Início, discreto e dispensável, desenhado DENTRO do renderHome, de
//    forma síncrona: nada de temporizador que encha o espaço depois que a pessoa começou a ler (o
//    conteúdo pularia sob o dedo). E NENHUMA chamada de foco neste arquivo: a lição do Assessor no
//    celular é que devolver o foco reabre o teclado por cima do que a pessoa queria ler.
//  · QUANTAS VEZES — uma por período (INTERVALO_MS), nunca mais depois de responder (`resp`), e nunca
//    mais depois de MAX_DISPENSAS dispensas. Os três números estão declarados aqui, não são mágicos:
//    quem dispensa duas vezes já respondeu "não quero" — insistir uma terceira é o que faz as pessoas
//    desinstalarem o app.
//  · ONDE MORA O ESTADO — no APARELHO, por conta (a57): "cb-fb-convite:v1:<uid>". No servidor exigiria
//    tabela nova (migration, e o front não inventa tabela) para guardar o que é preferência local de um
//    navegador; e o que importa de verdade — a RESPOSTA — já vai para public.feedback, de onde o NPS
//    sai. A chave LEGADA sem uid é apagada, nunca migrada: não se sabe de quem é.
//
// A GRAVAÇÃO segue a c9 e a b10: o supabase-js DEVOLVE o erro em vez de lançar e um insert que não casa
// linha volta como sucesso calado, então a nota só vira "Obrigado" com erro nulo, status HTTP de sucesso
// E uma linha de volta. Falhou: a nota escolhida CONTINUA marcada, com "Tentar de novo" — e o console
// leva código e status, nunca o que a pessoa respondeu (LGPD).
//
// O QUE A REVISÃO DE 23/set/2026 CONSERTOU — cada um custava ao convidado do piloto uma das duas janelas
// que ele tem em ~28 dias, e as duas primeiras faziam a nota se perder sem ninguém perceber:
//
//  · O PERÍODO era queimado pelo DESENHO, e o desenho podia não chegar a ninguém. (a) A Início É uma
//    grade de cartões: abrir um módulo e voltar repintava a tela, deve() recusava pelo INTERVALO_MS e o
//    cartão era APAGADO no mesmo minuto em que nasceu. Agora a fase do cartão vive em memória (_fase):
//    dentro do MESMO carregamento o cartão volta como estava, sem contar período novo. (b) A Início DE
//    PASSAGEM — o ?esquema= do WhatsApp desenha a home e o app.html navega para o Assessor em seguida —
//    não pergunta nada: DEEPLINKS declara os parâmetros que tiram a pessoa da Início, PARAMS_NEUTROS os
//    que a deixam ficar, e o check cobra que os dois juntos cubram TODO parâmetro lido no app.html.
//  · A NOTA SE PERDIA na falha de rede se a pessoa recarregasse a página: _nota é memória da página, e o
//    período já estava queimado. Agora a nota não confirmada mora no estado da conta (`pend`) e volta
//    MARCADA, com "Tentar de novo", em qualquer abertura seguinte — e isso NÃO é pergunta nova: não
//    conta período nem dispensa.
//  · O "Tentar de novo" podia gravar uma SEGUNDA linha de avaliação (o insert chega ao banco e a resposta
//    se perde) e o FB.npsResumo soma TODAS as linhas: com 5 a 10 respondentes, a mesma pessoa contada
//    duas vezes move o NPS inteiro. Toda RETENTATIVA procura antes a linha que a tentativa anterior possa
//    ter deixado (_jaGravada). LIMITE DECLARADO: se a PROCURA também falhar, reenvia — uma linha a mais é
//    menos grave que a nota perdida. (Linha repetida vinda do formulário completo — fbAbrir — continua
//    possível e é anterior a esta tarefa.)
//  · dispensar()/responder() gravavam estado SEM sessão, na chave compartilhada "…:anon" — o contrário da
//    a57, do lado da escrita. Agora a guarda é UMA só, no _gravar: sem sessão não se grava nada.
//  · Dois convites "Agora não" na mesma Início: o do PWA (INSTALAR) nasce ACIMA da grade e é o que torna o
//    app utilizável offline. Uma pergunta por vez — com ele à mostra, este espera a abertura seguinte, e
//    como _ocupado() recusa ANTES de gravar, esperar não custa período. NÃO fechado: no Android o evento
//    beforeinstallprompt costuma chegar DEPOIS do primeiro render (js/instalar.js), e nesse caso o cartão
//    do PWA nasce acima e empurra este para baixo — é a mesma janela que já move roadmap, anúncio e
//    afiliados da Início, e fechá-la é mexer no INSTALAR, não aqui.
//
// Travado por tests/convite-avaliar.check.mjs (roda este arquivo num DOM falso, com mutantes embutidos).
const FBCONVITE = {
  ABERTURAS_MIN: 3,                          // a 1ª e a 2ª abertura da conta nunca perguntam
  ESPERA_MS: 24 * 60 * 60 * 1000,            // e um dia inteiro desde a primeira abertura
  INTERVALO_MS: 14 * 24 * 60 * 60 * 1000,    // uma pergunta por quinzena
  MAX_DISPENSAS: 2,                          // duas dispensas = resposta dada; não se pergunta mais
  CONTEXTO: "convite-inicio",                // de onde a nota veio, na coluna `contexto` do feedback
  LS_LEGADO: "cb-fb-convite",
  // Os parâmetros de ?…= que o app.html lê. DEEPLINKS: a Início desenha e o app sai dela em seguida —
  // perguntar ali queima o período com um cartão que ninguém chega a ver. PARAMS_NEUTROS: a pessoa fica
  // na Início. O check DERIVA a lista do próprio app.html e reprova parâmetro que não esteja numa das
  // duas — nega por padrão, como a régua de vitrine do modo piloto.
  DEEPLINKS: ["esquema", "share"],
  PARAMS_NEUTROS: ["checkout"],
  _contada: false,                           // a abertura conta UMA vez por carregamento de página
  _fase: null,                               // o cartão DESTE carregamento: pergunta|enviando|falhou|obrigado|fora
  _nota: null,
  _tentou: false,                            // já houve uma tentativa de gravar neste carregamento

  _host() { try { return document.getElementById("fb-convite"); } catch (e) { return null; } },

  // a57: o espelho é POR CONTA — chave única mostraria à conta seguinte o que a anterior deixou (e aqui
  // isso significaria o app nunca mais perguntar a quem acabou de entrar neste navegador).
  _chave() {
    try { localStorage.removeItem(this.LS_LEGADO); } catch (e) {}
    const u = (typeof CBStore !== "undefined") ? CBStore.uid() : null;
    return "cb-fb-convite:v1:" + (u || "anon");
  },
  _ler() {
    const e = (typeof CBStore !== "undefined") ? CBStore.lsGet(this._chave(), null) : null;
    return (e && typeof e === "object") ? e : { ab: 0, nasc: 0, ped: 0, ult: 0, disp: 0, resp: 0 };
  },
  // a57, do lado da ESCRITA: sem sessão não se sabe de quem é o estado, e gravar na chave "anon" é a
  // chave única que a regra proíbe. Esta é a ÚNICA porta de escrita do convite — abertura, dispensa e
  // resposta passam por aqui.
  _gravar(e) {
    if (!FB._supaOk()) return;
    if (typeof CBStore !== "undefined") CBStore.lsSet(this._chave(), e);
  },

  /** Uma abertura do app (a primeira Início deste carregamento). Sem sessão o _gravar não grava nada. */
  abertura() {
    if (this._contada) return;
    this._contada = true;
    const e = this._ler();
    e.ab = (e.ab || 0) + 1;
    if (!e.nasc) e.nasc = Date.now();
    this._gravar(e);
  },

  /** A Início de PASSAGEM: o app.html desenha a home e navega para outro lugar logo em seguida. */
  _dePassagem() {
    const q = new URLSearchParams(location.search || "");
    for (const p of this.DEEPLINKS) if (q.get(p)) return true;
    return false;
  },

  /** A pessoa está no meio de alguma coisa? Então não se pergunta nada. Na dúvida (exceção), está. */
  _ocupado() {
    try {
      if (currentModule !== "home") return true;                       // só na Início
      if (this._dePassagem()) return true;                             // a Início é só a escala do deep link
      if (document.querySelector(".cb-modal-ov")) return true;         // modal por cima
      if (typeof FOLHA !== "undefined" && FOLHA.aberta && FOLHA.aberta()) return true;   // gaveta "Mais"/conta
      if (typeof INSTALAR !== "undefined" && INSTALAR.disponivel && INSTALAR.disponivel()) return true;   // um convite por vez
      const a = document.activeElement;
      if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable)) return true;
    } catch (e) { return true; }
    return false;
  },

  deve() {
    if (!FB._supaOk()) return false;
    const e = this._ler(), agora = Date.now();
    if (e.resp) return false;                                          // já respondeu: nunca mais
    if ((e.disp || 0) >= this.MAX_DISPENSAS) return false;             // dispensou o bastante
    if ((e.ab || 0) < this.ABERTURAS_MIN) return false;                // nunca na primeira abertura
    if (!e.nasc || (agora - e.nasc) < this.ESPERA_MS) return false;    // nem no mesmo dia da primeira
    if (e.ult && (agora - e.ult) < this.INTERVALO_MS) return false;    // uma vez por período
    if (this._ocupado()) return false;                                 // nunca por cima de trabalho
    return true;
  },

  /** Chamado pelo renderHome, SÍNCRONO: o cartão nasce junto com a tela ou não nasce. */
  render() {
    const host = this._host();
    if (!host) return;
    // Voltar à Início no MESMO carregamento não é pergunta nova: o cartão volta como estava e o período
    // não conta de novo. Sem isto, abrir um módulo e voltar APAGAVA o cartão com o período já queimado.
    if (this._fase) {
      if (this._fase === "fora") { host.innerHTML = ""; return; }
      this._pintar(this._fase);
      return;
    }
    const e = this._ler();
    // Nota que a pessoa deu e a rede não levou, mesmo de outro carregamento: volta MARCADA, com "Tentar
    // de novo". Não é pergunta nova — não conta período, não conta dispensa.
    if (FB._supaOk() && !e.resp && e.pend != null && !this._ocupado()) {
      this._nota = e.pend; this._fase = "falhou"; this._pintar("falhou"); return;
    }
    if (!this.deve()) { host.innerHTML = ""; return; }
    e.ped = (e.ped || 0) + 1; e.ult = Date.now();
    this._gravar(e);                        // o período começa a contar ao PERGUNTAR, não ao responder
    this._nota = null; this._fase = "pergunta";
    this._pintar("pergunta");
  },

  _pintar(fase) {
    const host = this._host();
    if (!host) return;
    if (fase === "obrigado") {
      host.innerHTML = `<div class="card" style="margin:14px 0;border-left:3px solid var(--green)">
        <div style="font-weight:600"><i class="ti ti-check" aria-hidden="true"></i> Obrigado!</div>
        <p class="fb-dica" style="margin:6px 0 0">Isso ajuda a decidir o que vem primeiro.
          <button class="btn" style="margin-left:6px" onclick="FBCONVITE.comentar()">Contar o porquê</button></p>
      </div>`;
      return;
    }
    const enviando = fase === "enviando";
    const notas = Array.from({ length: 11 }, (_, n) =>
      `<button type="button" class="fb-nps-b${this._nota === n ? " active" : ""}"${enviando ? " disabled" : ""} onclick="FBCONVITE.responder(${n})" aria-label="Nota ${n}">${n}</button>`).join("");
    const rodape = enviando
      ? `<p class="fb-ctx">Enviando…</p>`
      : fase === "falhou"
        ? `<p class="fb-ctx" role="alert">Não foi possível enviar agora — confira a conexão. Sua nota continua marcada.
             <button class="btn" style="margin-left:6px" onclick="FBCONVITE.responder(${this._nota})">Tentar de novo</button></p>`
        : `<div class="fb-nps-leg"><span>Não recomendaria</span><span>Recomendaria muito</span></div>`;
    host.innerHTML = `<div class="card" style="margin:14px 0;border-left:3px solid var(--blue)" role="group" aria-label="Avaliação do Civilbook">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div>
          <div style="font-weight:600"><i class="ti ti-message-2-heart" aria-hidden="true"></i> Uma pergunta rápida</div>
          <p class="fb-dica" style="margin:6px 0 10px">De 0 a 10, o quanto você recomendaria o Civilbook a um colega de profissão?</p>
        </div>
        <button class="btn icon-only" aria-label="Agora não" title="Agora não" onclick="FBCONVITE.dispensar()"><i class="ti ti-x"></i></button>
      </div>
      <div class="fb-nps" role="group" aria-label="Nota de 0 a 10">${notas}</div>
      ${rodape}
    </div>`;
  },

  async responder(n) {
    this._nota = n;
    if (!this._host()) return;
    this._fase = "enviando";
    this._pintar("enviando");
    try {
      await this._enviarNota(n);
    } catch (err) {
      // LGPD: código e status, nunca a nota nem texto nenhum do pedido.
      try { console.warn("[cb] convite de avaliação não gravou: code=" + ((err && err.codigo) || "") + " status=" + ((err && err.status) || 0)); } catch (e2) {}
      const ef = this._ler(); ef.pend = n; this._gravar(ef);   // a nota sobrevive a fechar o app
      this._fase = "falhou"; this._pintar("falhou");
      return;
    }
    const e = this._ler(); e.resp = 1; delete e.pend; this._gravar(e);
    this._fase = "obrigado"; this._pintar("obrigado");
  },

  // c9 + b10: erro nulo NÃO basta — confere o status HTTP e a linha de volta (.select). Sem isso a tela
  // diria "Obrigado" com o banco vazio, que é exatamente o defeito do formulário de proposta da landing.
  async _enviarNota(n) {
    // RETENTATIVA (desta página ou de outra, pela nota pendente): a tentativa anterior pode ter chegado ao
    // banco e só a resposta ter se perdido. Gravar de novo poria a mesma pessoa duas vezes no NPS.
    if (this._tentou || this._ler().pend != null) {
      if (await this._jaGravada()) return;
    }
    this._tentou = true;
    const r = await window.supa.from("feedback")
      .insert({ user_id: AUTH.session().id, tipo: "avaliacao", nota: n, texto: null, contexto: this.CONTEXTO })
      .select("id");
    const st = r && r.status;
    const linhas = (r && Array.isArray(r.data)) ? r.data.length : 0;
    if ((r && r.error) || !(st === 200 || st === 201) || linhas !== 1) {
      const err = new Error("convite de avaliação: gravação não confirmada");
      err.codigo = (r && r.error && r.error.code) || "";
      err.status = st || 0;
      throw err;
    }
  },

  /** A tentativa anterior chegou a gravar? Procura no PRÓPRIO dono (RLS da 0018) a avaliação deste convite
   *  dentro do período. Procura que falha devolve false: reenviar é melhor do que perder a nota. */
  async _jaGravada() {
    try {
      const desde = new Date(Date.now() - this.INTERVALO_MS).toISOString();
      const r = await window.supa.from("feedback").select("id")
        .eq("user_id", AUTH.session().id).eq("tipo", "avaliacao")
        .eq("contexto", this.CONTEXTO).gte("created_at", desde).limit(1);
      return !!(r && !r.error && Array.isArray(r.data) && r.data.length);
    } catch (e) { return false; }
  },

  dispensar() {
    const e = this._ler();
    e.disp = (e.disp || 0) + 1;
    delete e.pend;                          // desistiu: a nota não confirmada não volta a aparecer
    this._gravar(e);
    this._fase = "fora";
    const host = this._host();
    if (host) host.innerHTML = "";
  },

  comentar() { if (typeof fbAbrir === "function") fbAbrir("sugestao"); }
};
if (typeof window !== "undefined") window.FBCONVITE = FBCONVITE;
