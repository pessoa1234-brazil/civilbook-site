// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).

// f4 — Assessor IA: consome a Edge Function ai-gateway (RAG ancorado), CITANDO as fontes.
// f6 — Fiscalização por foto (visão). f24 — ditado por voz (Web Speech API).
// f40 — CHAT de verdade (multi-turno): a conversa vira um FIO (thread); as últimas trocas vão no
//   payload (historico[]) e o follow-up "e no caso de reforma?" funciona. Botão "Nova conversa".
//   Contexto do MÓDULO: os módulos (RDO, cronograma, orçamento, manutenção, biblioteca) têm
//   "Perguntar à IA" → ASSIST.abrirCom(modulo) abre o chat sabendo de onde o usuário veio
//   (contextoTela no gateway). Respostas ganham CHIPS de ação (deep-link p/ o módulo citado).
//   A conversa persiste na SESSÃO (sessionStorage) — sobrevive à navegação, morre ao fechar a aba.
// O segredo (chave do Claude/Voyage) fica só na função; aqui só vai o JWT do usuário logado.
//
// a42 (17/set/2026) — CARA DE CHAT. O pedido do fundador foi "a tela do app deve ser mais amigável,
//   algo que lembre o visual das IAs mais usadas". O que mudou é SÓ apresentação (esta tela + a
//   seção .ia-* do css/style.css); nenhuma capacidade saiu:
//     · a conversa ocupa a tela; a caixa de escrita é FIXA embaixo (sticky) e cresce com o texto;
//     · Enter envia / Shift+Enter quebra linha no desktop; no celular Enter quebra linha e quem
//       envia é o botão (teclado de celular não tem "shift+enter" confortável);
//     · estado vazio com o nome do assessor e 4 perguntas-exemplo clicáveis (preenchem o campo,
//       NÃO disparam: quem gasta a cota é o clique do usuário — mesma regra da f51);
//     · fontes em bloco RECOLHIDO ("Fontes (3)") — antes eram uma parede de texto embaixo de toda
//       resposta; o estado aberto/fechado sobrevive ao re-render (_fontesAbertas);
//     · botão de copiar em cada resposta; indicador de "pensando" animado.
//   Acessibilidade: a região da conversa é role="log" com aria-live="off" DE PROPÓSITO — o fio é
//   redesenhado inteiro a cada troca (innerHTML), e uma região viva reanunciaria a conversa toda a
//   cada resposta. Quem anuncia é #ia-anuncio (role="status", polido), uma vez por resposta.
//   Depois da revisão adversarial da mesma entrega:
//     · o corpo da resposta passou a render MARKDOWN-LITE (_fmt): tabela, bloco de código, lista e
//       título. Antes a tela mostrava "| Desnível | Inclinação |" e ```js literais — era o ponto em
//       que ela mais destoava das "IAs mais usadas" do pedido;
//     · o foco volta ao campo NA HORA DO ENVIO (dentro do gesto do usuário) e não quando a resposta
//       chega: um focus() segundos depois abre o teclado do celular por cima da resposta.
//
// 18/set/2026 — IA FORA DO GRATUITO (decisão do fundador; o servidor dá cota 0 ao Gratuito e nega com
//   motivo "plano", ver supabase/functions/_shared/cota.ts). Para o gratuito não escrever a pergunta e só
//   depois dar com a porta na cara, a caixa de escrita vira o CONVITE (cbConviteIAHTML, js/app.js) quando o
//   plano EFETIVO da sessão é gratuito. O fio antigo e os esquemas continuam visíveis. Se a sessão estiver
//   velha (acha que é PRO) e o servidor responder "plano", a caixa vira o convite na hora (_semIAServidor,
//   amarrado ao plano da sessão de então: mudou o plano — teste ativado, cortesia —, o convite some).
const ASSIST = {
  _foto: null,        // { media_type, data (base64 sem prefixo), url (dataURL p/ preview) }
  _projetoCtx: null,  // f3/f16 — { nome, projetoId, texto }: responder "com base no seu projeto"
  _ctxTela: null,     // f40 — { modulo, label, texto }: de onde o usuário veio no app
  _hist: [],          // f40 — [{ pergunta, resposta, fontes, semBase, foto, erro }]
  _K: "cb-ia-chat",   // sessionStorage (por aba; some ao fechar — LGPD-friendly)
  _fontesAbertas: null,   // a42 — Set de índices com o bloco "Fontes" aberto (sobrevive ao re-render)
  _semIAServidor: null,   // 18/set — { plano } da sessão quando o servidor negou por "plano"

  // f40 — contexto por módulo (texto que vai ao gateway + rótulo do chip). Curto de propósito.
  _CTX: {
    rdo:        { label: "Diário de Obra",         texto: "O usuário está na tela Diário de Obra (RDO) do app — registros diários da obra: efetivo, clima, atividades executadas, ocorrências." },
    cronograma: { label: "Cronograma de obra",     texto: "O usuário está na tela Cronograma de obra do app — físico-financeiro: etapas, Gantt e curva S (previsto × realizado)." },
    orcamento:  { label: "Orçamento de obra",      texto: "O usuário está na sub-aba Orçamento de obra (aba Custos) do app — composições SINAPI + itens avulsos, BDI e resumo por etapa." },
    manutencao: { label: "Manutenções/Garantias",  texto: "O usuário está na tela Manutenções e Garantias do app — plano preventivo NBR 5674, ordens de serviço e garantias NBR 17170." },
    biblioteca: { label: "Biblioteca técnica",     texto: "O usuário está na Biblioteca técnica (corpo técnico) do app — acervo de PDFs e referências." },
    sinapi:     { label: "Custos (SINAPI/CUB)",    texto: "O usuário está na aba Custos do app — SINAPI, CUB/m², orçamento de obra e estimativa paramétrica." },
    interacoes: { label: "Interação entre materiais", texto: "O usuário está na tela Interação entre materiais do app — base de incompatibilidades entre materiais de construção (mecanismo, recomendação e fontes), análoga a uma base de interação medicamentosa. Ele consultou um par que NÃO está documentado nessa base." },
  },

  // a42 — perguntas-exemplo do estado vazio. Técnicas e REAIS (cada uma exercita um caminho que o
  // assessor tem de verdade: norma na base curada, paramétrico, SINAPI e as obras do próprio
  // usuário). Clicar PREENCHE o campo — não envia.
  _SUGESTOES: [
    { icone: "ti-ruler",      texto: "Qual a inclinação máxima de uma rampa acessível e a norma aplicável?" },
    { icone: "ti-building",   texto: "Qual o cobrimento mínimo da armadura para classe de agressividade ambiental II?" },
    { icone: "ti-wand",       texto: "Quanto custa uma escola de 1.200 m²?" },
    { icone: "ti-chart-line", texto: "Como está o cronograma da minha obra?" },
  ],

  // ── Persistência da conversa (sessão da aba) ─────────────────────────────
  _persist() {
    try {
      const hist = this._hist.slice(-12).map(h => ({
        pergunta: (h.pergunta || "").slice(0, 2000), resposta: h.resposta ? h.resposta.slice(0, 6000) : h.resposta,
        fontes: (h.fontes || []).slice(0, 8), figuras: (h.figuras || []).slice(0, 3),
        // f50: guarda só o último esquema por troca — SVG é grande e o sessionStorage tem ~5 MB.
        esquemas: (h.esquemas || []).slice(0, 1), semBase: !!h.semBase, foto: !!h.foto, erro: h.erro || null,
      }));
      sessionStorage.setItem(this._K, JSON.stringify({ hist, ctx: this._ctxTela }));
    } catch (e) { /* sem sessionStorage → conversa só em memória */ }
  },
  _restore() {
    try {
      const d = JSON.parse(sessionStorage.getItem(this._K) || "null");
      if (d && Array.isArray(d.hist)) { this._hist = d.hist; this._ctxTela = d.ctx || null; }
    } catch (e) { /* ignora */ }
  },

  // 18/set — o plano desta sessão NÃO inclui IA? Plano efetivo gratuito (cbPlanoSemIA, js/app.js) OU o
  // servidor já disse "plano" com a sessão neste mesmo plano (sessão velha que ainda se achava PRO).
  _planoSessao() {
    try { const s = (typeof AUTH !== "undefined" && AUTH.session) ? AUTH.session() : null; return s ? String(s.plano == null ? "" : s.plano) : null; }
    catch (e) { return null; }
  },
  _semIA() {
    if (typeof cbPlanoSemIA === "function" && cbPlanoSemIA()) return true;
    const neg = this._semIAServidor;
    if (neg && neg.plano === this._planoSessao()) return true;
    this._semIAServidor = null;   // o plano mudou desde a negação (teste ativado, cortesia): vale o de agora
    return false;
  },
  _conviteHTML() {
    return typeof cbConviteIAHTML === "function"
      ? cbConviteIAHTML("assessor", null, "O assessor faz parte dos planos pagos",
        "No plano Gratuito a IA do Civilbook não está incluída. Com um plano pago você pergunta sobre norma, custo, prazo e a sua obra — sempre com a fonte citada.")
      : `<p class="ia-erro">A IA do Civilbook não está incluída no plano Gratuito — veja os planos em Minha conta → Assinatura.</p>`;
  },

  // Celular: o breakpoint é o MESMO do resto do app (640 px, css/style.css). Decide duas coisas —
  // Enter quebra linha em vez de enviar, e a dica de teclado não aparece.
  _celular() {
    try { return !!(window.matchMedia && window.matchMedia("(max-width: 640px)").matches); } catch (e) { return false; }
  },

  render(host) {
    host = host || document.getElementById("app");
    if (!host) return;
    this._foto = null;
    if (!this._fontesAbertas) this._fontesAbertas = new Set();
    if (!this._hist.length) this._restore();
    // 18/set: plano sem IA → o convite ocupa o lugar da caixa de escrita (os ligamentos abaixo já
    // toleram a ausência de cada elemento: todos são `if (el)`). O convite NÃO mora na .ia-composer:
    // a caixa é sticky e o css (body:has(.ia-composer) .cb-zap) posiciona o FAB do WhatsApp supondo a
    // caixa GRUDADA no rodapé; com o estado vazio curto do gratuito ela fica no fluxo, 53 px acima, e o
    // FAB caía em cima do título do convite (medido no preview a 360x740 em 18/set/2026). Sem
    // .ia-composer na página, o FAB volta ao lugar de sempre e o convite fica no fluxo, no rodapé do chat.
    const semIA = this._semIA();
    const legal = `
          <details class="ia-legal" id="ia-legal">
            <summary><i class="ti ti-info-circle" aria-hidden="true"></i> <span>Apoio técnico — <strong>não substitui o responsável técnico (RT)</strong> nem a consulta ao <strong>texto integral da norma</strong>.</span><i class="ti ti-chevron-down ia-seta" aria-hidden="true"></i></summary>
            <p>No administrativo, as orientações não substituem o contador, o advogado ou o profissional de segurança do trabalho. A análise de foto aponta indícios; <strong>confirme em campo</strong>.</p>
            <p class="ia-legal-links"><a href="privacidade.html" target="_blank" rel="noopener">Política de Privacidade</a> · <a href="termos.html" target="_blank" rel="noopener">Termos de Uso</a> · <a href="#" onclick="if (window.cbCookies) cbCookies.abrir(); return false;">Gerenciar cookies</a></p>
          </details>`;
    const rodape = semIA
      ? `<div class="ia-convite" style="margin-top:10px;padding:10px 0 14px">${this._conviteHTML()}${legal}
        </div>`
      : `<div class="ia-composer">
          <div id="ia-ctx"></div>
          <div id="ia-proj"></div>
          <div id="ia-foto" hidden></div>
          <div class="ia-campo">
            <label class="ia-sr" for="ia-q">Sua pergunta ao assessor</label>
            <textarea id="ia-q" class="ia-campo-txt" rows="1" placeholder="Pergunte ao assessor — norma, custo, prazo, a sua obra…"></textarea>
            <div class="ia-campo-barra">
              <label class="ia-ic-btn" for="ia-foto-input" title="Anexar foto da obra (fiscalização visual)"><i class="ti ti-camera" aria-hidden="true"></i><span class="ia-sr">Anexar foto da obra</span></label>
              <input type="file" id="ia-foto-input" accept="image/*" capture="environment" hidden>
              <button type="button" class="ia-ic-btn" id="ia-mic" title="Ditar a pergunta por voz (pt-BR)"><i class="ti ti-microphone" aria-hidden="true"></i><span class="ia-sr">Ditar a pergunta por voz</span></button>
              <span class="ia-dica">Enter envia · Shift+Enter quebra linha</span>
              <button type="button" class="ia-enviar" id="ia-go" title="Perguntar ao assessor"><i class="ti ti-send" aria-hidden="true"></i><span class="ia-sr">Perguntar à IA</span></button>
            </div>
          </div>${legal}
        </div>`;
    host.innerHTML = `
      <div class="ia-chat">
        <div class="ia-top">
          <h1 class="ia-top-tt"><i class="ti ti-sparkles" aria-hidden="true"></i> Assessor IA</h1>
          <span class="ia-uso" id="ia-uso"></span>
          <button type="button" class="ia-acao ia-nova" id="ia-nova" ${this._hist.length ? "" : "hidden"} title="Limpa a conversa e começa do zero"><i class="ti ti-refresh" aria-hidden="true"></i> Nova conversa</button>
        </div>

        <div class="ia-thread" id="ia-thread" role="log" aria-live="off" aria-label="Conversa com o assessor"></div>
        <div id="ia-esquemas" class="ia-esquemas"></div>
        <p class="ia-sr" id="ia-anuncio" role="status" aria-live="polite"></p>

        ${rodape}
      </div>`;
    const go = document.getElementById("ia-go");
    const q = document.getElementById("ia-q");
    const fileIn = document.getElementById("ia-foto-input");
    const nova = document.getElementById("ia-nova");
    const disparar = () => this.ask(q ? q.value : "", "assessor");
    if (go) go.addEventListener("click", disparar);
    if (q) {
      q.addEventListener("input", () => this._crescer(q));
      q.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" || e.shiftKey) return;
        if (e.isComposing || e.keyCode === 229) return;            // teclado IME compondo: Enter confirma a palavra
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); disparar(); return; }   // atalho antigo, mantido
        if (this._celular()) return;                                // celular: Enter quebra linha; enviar é o botão
        e.preventDefault(); disparar();
      });
    }
    if (fileIn) fileIn.addEventListener("change", (e) => this.anexarFoto(e.target));
    if (nova) nova.addEventListener("click", () => this.novaConversa());
    const mic = document.getElementById("ia-mic");
    if (mic) mic.addEventListener("click", () => this.ditar());
    const ctx = document.getElementById("ia-ctx"); if (ctx) ctx.innerHTML = this._ctxChipHTML();
    const proj = document.getElementById("ia-proj"); if (proj) proj.innerHTML = this._projetoChipHTML();
    this._renderThread();
    this._medirComposer();
    if (!semIA) this._uso();    // 18/set: contador de uso não diz nada a quem não tem IA
    this._carregarEsquemas();   // f50: desenhos gerados fora do app (WhatsApp)
  },

  // A caixa de escrita é fixa no rodapé e ocupa o MESMO canto em que o FAB do WhatsApp flutua —
  // medido em 360 px, os dois caíam em x 294–344 e o verde cobria o botão de enviar. Aqui a altura
  // da caixa (que cresce com o texto) vira variável CSS; quem sobe o FAB é a regra
  // `body:has(.ia-composer) .cb-zap` do css/style.css.
  _medirComposer() {
    const el = document.querySelector(".ia-composer");
    if (!el) return;
    const publicar = () => {
      try { document.documentElement.style.setProperty("--ia-composer-h", Math.round(el.getBoundingClientRect().height) + "px"); } catch (e) {}
    };
    publicar();
    try {
      if (this._ro) this._ro.disconnect();
      this._ro = new ResizeObserver(publicar);
      this._ro.observe(el);
    } catch (e) { /* sem ResizeObserver: fica a medida do render */ }
  },

  // a42 — a caixa cresce com o texto até um teto (depois rola dentro dela).
  _crescer(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  },

  // a42 — anúncio único para leitor de tela (ver o cabeçalho do arquivo). Tira a marcação: ela vira
  // forma na TELA (negrito, título, `código`), mas o leitor soletraria "asterisco asterisco".
  _anunciar(txt) {
    const el = document.getElementById("ia-anuncio");
    if (!el) return;
    el.textContent = String(txt || "")
      .replace(/```[\w+-]*/g, "").replace(/\*\*/g, "").replace(/`/g, "")
      .replace(/^#{1,6}\s+/gm, "").slice(0, 400);
  },

  // ── f50: ESQUEMAS gerados no WhatsApp ────────────────────────────────────
  // O WhatsApp não aceita SVG (limite da Cloud API da Meta): lá vão as cotas em texto e o traço fica
  // aqui. Esta seção é o "aqui" — antes a mensagem dizia "o desenho está no app" e não havia lugar
  // nenhum onde ele estivesse. O webhook persiste em ia_esquemas (0060) e manda o link.
  // A lista NÃO traz o `svg` (~5 KB cada): busca só o cabeçalho e carrega o desenho ao abrir.
  _esqSvg: {},   // id -> svg já buscado
  _esqSeq: 0,    // carga mais recente vence (o link do WhatsApp dispara uma segunda, sobre a do render)

  // Monta a LISTA. Não abre nada: quem abre é abrirEsquema(), e manter a divisão evita a recursão
  // "carrega → abre → não achou → carrega" quando o id do link não existe mais.
  async _carregarEsquemas(abrirId) {
    const host = document.getElementById("ia-esquemas");
    if (!host || !window.supa) return;
    const seq = ++this._esqSeq;
    const COLS = "id,titulo,citacao,conforme,resumo,canal,created_at";
    let lista = [];
    try {
      const { data } = await window.supa.from("ia_esquemas").select(COLS)
        .order("created_at", { ascending: false }).limit(20);
      lista = data || [];
    } catch (e) { return; }
    // Veio de link e o desenho é mais antigo que a janela da lista? Busca esse à parte, senão o
    // link levaria a uma tela onde ele não está — exatamente o problema que esta seção resolve.
    if (abrirId && !lista.some(e => e.id === abrirId)) {
      try {
        const { data } = await window.supa.from("ia_esquemas").select(COLS).eq("id", abrirId).maybeSingle();
        if (data) lista.unshift(data);
      } catch (e) { /* segue com a lista que veio */ }
    }
    // Carga mais nova já começou (ex.: a do link, depois da do render): sair sem escrever, senão
    // esta apaga o desenho que a outra abriu.
    if (seq !== this._esqSeq) return;
    if (!lista.length) { host.innerHTML = ""; return; }
    // Nasce RECOLHIDO (o assunto da tela é a conversa); quem chega pelo link do WhatsApp tem o bloco
    // aberto por abrirEsquema(), senão o desenho abriria dentro de um <details> fechado.
    host.innerHTML = `<details class="ia-fontes ia-esq-bloco" id="ia-esq-bloco">
      <summary><i class="ti ti-ruler-measure" aria-hidden="true"></i> Esquemas gerados (${lista.length})<i class="ti ti-chevron-down ia-seta" aria-hidden="true"></i></summary>
      <p class="ia-esq-sub">Desenhos cotados criados nas suas conversas — inclusive as do WhatsApp, onde o traço não cabe na mensagem. Ficam aqui por 90 dias.</p>
      ${lista.map(e => this._esqLinhaHTML(e)).join("")}
    </details>`;
  },

  _esqLinhaHTML(e) {
    const selo = e.conforme
      ? `<span class="ia-selo ia-selo-ok">dentro da norma</span>`
      : `<span class="ia-selo ia-selo-fora">fora da norma</span>`;
    const canal = e.canal === "whatsapp"
      ? `<span class="ia-esq-canal"><i class="ti ti-brand-whatsapp" aria-hidden="true"></i> WhatsApp</span>` : "";
    const data = e.created_at ? new Date(e.created_at).toLocaleString("pt-BR") : "";
    const id = esc(e.id);
    return `<div id="esq-${id}" class="ia-esq-item">
      <div class="ia-esq-cab">
        <strong class="ia-esq-tt">${esc(e.titulo || "Esquema")}</strong>${selo}${canal}
        <span class="ia-esq-data">${esc(data)}</span>
      </div>
      <div class="ia-esq-cit">${esc(e.citacao || "")}</div>
      ${e.resumo ? `<div class="ia-esq-res">${esc(e.resumo)}</div>` : ""}
      <button type="button" class="ia-acao" id="esq-btn-${id}" onclick="ASSIST.abrirEsquema('${id}')"><i class="ti ti-eye" aria-hidden="true"></i> Ver o desenho cotado</button>
      <div id="esq-svg-${id}"></div>
    </div>`;
  },

  // Abre (ou fecha) o desenho de um esquema. Serve ao clique do botão E ao link do WhatsApp.
  async abrirEsquema(id) {
    if (!id) return;
    // O link cai no app inteiro, não nesta tela: garante o Assessor antes de procurar o alvo.
    if (!document.getElementById("ia-esquemas") && typeof navigate === "function") navigate("assessor");
    const host = document.getElementById("ia-esquemas");
    if (!host) return;
    let alvo = document.getElementById("esq-svg-" + id);
    if (!alvo) {                                  // veio de link: a lista ainda não montou (ou é antigo)
      await this._carregarEsquemas(id);
      alvo = document.getElementById("esq-svg-" + id);
      // Link velho, esquema expirado (90 dias) ou de outra conta: dizer isso é melhor que tela muda.
      if (!alvo) {
        host.insertAdjacentHTML("afterbegin", `<p class="ia-erro"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Não encontrei esse desenho. Os esquemas ficam guardados por <strong>90 dias</strong> — se o link for antigo, refaça a pergunta ao assessor que ele desenha de novo.</p>`);
        return;
      }
    }
    const bloco = document.getElementById("ia-esq-bloco");      // o desenho não pode abrir escondido
    if (bloco) bloco.open = true;
    if (alvo.innerHTML) { alvo.innerHTML = ""; return; }        // já aberto → fecha
    let svg = this._esqSvg[id];
    if (svg == null) {
      alvo.innerHTML = `<p class="ia-esq-res"><i class="ti ti-loader" aria-hidden="true"></i> Carregando o desenho…</p>`;
      try {
        const { data } = await window.supa.from("ia_esquemas").select("svg").eq("id", id).maybeSingle();
        svg = (data && data.svg) || "";
      } catch (e) { svg = ""; }
      this._esqSvg[id] = svg;
    }
    // Mesma peneira do cartão da conversa: a origem é nossa, a defesa fica (ver _svgSeguro).
    const limpo = this._svgSeguro(svg);
    alvo.innerHTML = limpo
      ? `<div class="ia-svg">${limpo}</div>`
      : `<p class="ia-esq-res"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Este desenho não está mais disponível (os esquemas ficam guardados por 90 dias).</p>`;
    const el = document.getElementById("esq-" + id);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "center", behavior: "smooth" });
  },

  // f40 — o FIO da conversa: balões do usuário (direita) e respostas em bloco largo (a42).
  _renderThread(rolar) {
    const el = document.getElementById("ia-thread");
    if (!el) return;
    if (!this._hist.length) { el.innerHTML = this._vazioHTML(); this._ligarSugestoes(); }
    else {
      el.innerHTML = this._hist.map((h, i) => {
        const user = `<div class="ia-msg-user">${h.foto ? '<i class="ti ti-camera" aria-hidden="true"></i> ' : ""}${esc(h.pergunta)}</div>`;
        let resp = "";
        if (h.erro) resp = `<p class="ia-erro"><i class="ti ti-alert-triangle" aria-hidden="true"></i> ${esc(h.erro)}</p>`;
        else if (h.resposta == null) resp = this._pensandoHTML(h.foto);
        else resp = this._resposta(h, i);
        return `<div class="ia-troca" data-troca="${i}">${user}<div class="ia-msg-bot">${resp}</div></div>`;
      }).join("");
    }
    const nova = document.getElementById("ia-nova");
    if (nova) nova.hidden = !this._hist.length;
    // a42 — rola a troca NOVA para o alto da tela (e não para o fundo, onde a caixa fixa a cobriria):
    // o usuário lê a resposta do começo, como nos chats que ele já conhece.
    if (rolar) {
      const ult = el.lastElementChild;
      if (ult && ult.scrollIntoView) ult.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  },

  _pensandoHTML(comFoto) {
    return `<p class="ia-pensando"><span class="ia-dots" aria-hidden="true"><i></i><i></i><i></i></span> ${comFoto ? "Analisando a foto…" : "Consultando o assessor…"}</p>`;
  },

  // a42 — estado vazio: nome, o que ele faz e 4 perguntas-exemplo clicáveis.
  _vazioHTML() {
    // 18/set: sem IA no plano, as perguntas-exemplo seriam botões mortos (preenchem um campo que não
    // existe) — fica a apresentação, e o convite no rodapé diz como liberar.
    const sug = this._semIA() ? "" : this._SUGESTOES.map((s, i) =>
      `<button type="button" class="ia-sug" data-sug="${i}"><i class="ti ${esc(s.icone)}" aria-hidden="true"></i><span>${esc(s.texto)}</span></button>`).join("");
    return `<div class="ia-vazio">
      <div class="ia-vazio-ic"><i class="ti ti-sparkles" aria-hidden="true"></i></div>
      <p class="ia-vazio-tt">Assessor Civilbook</p>
      <p class="ia-vazio-sub">Norma, custo, prazo ou a sua obra — e <strong>sempre com a fonte citada</strong>.<span class="ia-vazio-extra"> Aceita <strong>foto da obra</strong> e pergunta <strong>ditada por voz</strong>.</span></p>
      ${sug ? `<div class="ia-sugestoes">${sug}</div>` : ""}
    </div>`;
  },

  _ligarSugestoes() {
    document.querySelectorAll(".ia-sug[data-sug]").forEach((b) => {
      b.addEventListener("click", () => this._sugerir(+b.dataset.sug));
    });
  },

  // Preenche o campo e devolve o foco — NÃO envia. Quem gasta a cota é o clique do usuário no
  // enviar (mesma decisão da f51, em abrirCom).
  _sugerir(i) {
    const s = this._SUGESTOES[i];
    const q = document.getElementById("ia-q");
    if (!s || !q) return;
    q.value = s.texto;
    this._crescer(q);
    q.focus();
    try { q.setSelectionRange(q.value.length, q.value.length); } catch (e) {}
  },

  novaConversa() {
    this._hist = []; this._ctxTela = null;
    if (this._fontesAbertas) this._fontesAbertas.clear();
    try { sessionStorage.removeItem(this._K); } catch (e) {}
    this.render();
  },

  // f40 — entrada CONTEXTUAL: os módulos chamam ASSIST.abrirCom('rdo'|'cronograma'|...) e o chat
  // abre sabendo de onde o usuário veio (o gateway recebe contextoTela; some no ✕ ou na nova conversa).
  // `pergunta` (f51): além do contexto, já deixa a PERGUNTA escrita no campo — o usuário só
  // confere e envia. Não dispara sozinho de propósito: quem gasta a cota é o clique dele.
  abrirCom(modulo, texto, pergunta) {
    const base = this._CTX[modulo] || { label: modulo, texto: "O usuário está na tela " + modulo + " do app." };
    this._ctxTela = { modulo, label: base.label, texto: texto || base.texto };
    this._persist();
    if (typeof navigate === "function") navigate("assessor"); else this.render();
    if (pergunta) {
      // O render acontece no navigate; preenche no próximo tick, quando o campo já existe.
      setTimeout(() => {
        const q = document.getElementById("ia-q");
        if (!q) return;
        q.value = pergunta;
        this._crescer(q);
        q.focus();
        q.setSelectionRange(q.value.length, q.value.length);
      }, 0);
    }
  },
  removerCtxTela() {
    this._ctxTela = null; this._persist();
    const el = document.getElementById("ia-ctx"); if (el) el.innerHTML = "";
  },
  _ctxChipHTML() {
    if (!this._ctxTela) return "";
    return `<div class="ia-chip">
      <i class="ti ti-compass" aria-hidden="true"></i>
      <span>Perguntando no contexto: <strong>${esc(this._ctxTela.label)}</strong></span>
      <button type="button" class="ia-chip-x" title="Remover contexto da tela" onclick="ASSIST.removerCtxTela()"><i class="ti ti-x" aria-hidden="true"></i><span class="ia-sr">Remover contexto da tela</span></button>
    </div>`;
  },

  // f40 — CHIPS de ação: quando a resposta usou um módulo (fonte de ferramenta f39), oferece o
  // deep-link correspondente ("par:" abre direto a sub-aba Paramétrico — ver renderSinapi/app.js).
  _chipsHTML(d) {
    const chips = [];
    const add = (label, icon, mod, param) => { if (!chips.some(c => c.label === label)) chips.push({ label, icon, mod, param }); };
    (d.fontes || []).forEach(f => {
      const s = String(f.fonte || "");
      if (/^Paramétrico Civilbook/.test(s)) add("Abrir no Paramétrico", "wand", "sinapi", "par:");
      else if (/^SINAPI /.test(s)) add("Ver na SINAPI", "receipt", "sinapi", "");
      else if (/^CUB /.test(s)) add("Ver CUB/m²", "ruler-2", "sinapi", "cub:");
      else if (/^Suas obras/.test(s)) { add("Meus projetos", "folder", "projetos", ""); add("Cronograma", "chart-line", "cronograma", ""); }
    });
    if (!chips.length) return "";
    return chips.slice(0, 3).map(c => `<button type="button" class="ia-acao" onclick="ASSIST._ir('${c.mod}','${c.param}')"><i class="ti ti-${c.icon}" aria-hidden="true"></i> ${esc(c.label)}</button>`).join("");
  },
  _ir(mod, param) { if (typeof navigate === "function") navigate(mod, param || undefined); },

  // a42 — copiar a resposta (texto puro, como o modelo escreveu).
  _copiar(i) {
    const h = this._hist[i];
    if (!h || !h.resposta) return;
    const btn = document.getElementById("ia-cp-" + i);
    const ok = () => {
      if (btn) {
        btn.innerHTML = '<i class="ti ti-check" aria-hidden="true"></i> Copiado';
        setTimeout(() => { const b = document.getElementById("ia-cp-" + i); if (b) b.innerHTML = '<i class="ti ti-copy" aria-hidden="true"></i> Copiar'; }, 1800);
      }
      if (typeof toast === "function") toast("Resposta copiada.", "success");
    };
    const naMao = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = h.resposta; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
        ok();
      } catch (e) { if (typeof toast === "function") toast("Não foi possível copiar.", "warn"); }
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(h.resposta).then(ok, naMao);
      else naMao();
    } catch (e) { naMao(); }
  },

  // a42 — o bloco de fontes é <details>: lembrar quem o usuário abriu evita que ele feche sozinho
  // no próximo re-render do fio.
  _marcarFontes(i, aberto) {
    if (!this._fontesAbertas) this._fontesAbertas = new Set();
    if (aberto) this._fontesAbertas.add(i); else this._fontesAbertas.delete(i);
  },

  // f24 (in-app): ditado por voz via Web Speech API (grátis, no navegador; pt-BR). Alterna ouvir/parar e
  // acrescenta a transcrição no campo de pergunta (a IA é consultada quando o usuário clicar em Perguntar).
  ditar() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const btn = document.getElementById("ia-mic");
    const q = document.getElementById("ia-q");
    if (!SR) { if (typeof toast === "function") toast("Seu navegador não suporta ditado por voz. Tente o Chrome ou o Edge (ou use o WhatsApp).", "warn"); return; }
    if (this._recog) { try { this._recog.stop(); } catch (e) {} return; }   // já ouvindo → para (onend limpa)
    const rec = new SR();
    rec.lang = "pt-BR"; rec.continuous = true; rec.interimResults = true;
    let base = q ? q.value : "";
    rec.onresult = (e) => {
      let fin = "", interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const tr = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += tr; else interim += tr;
      }
      if (fin) base = (base ? base.trim() + " " : "") + fin.trim();
      if (q) { q.value = (base + (interim ? " " + interim.trim() : "")).trim(); this._crescer(q); }
    };
    rec.onerror = (e) => { if (e && e.error === "not-allowed" && typeof toast === "function") toast("Permita o microfone para ditar.", "warn"); };
    rec.onend = () => {
      this._recog = null;
      if (btn) { btn.classList.remove("ia-ouvindo"); btn.title = "Ditar a pergunta por voz (pt-BR)"; btn.innerHTML = '<i class="ti ti-microphone" aria-hidden="true"></i><span class="ia-sr">Ditar a pergunta por voz</span>'; }
    };
    try {
      rec.start(); this._recog = rec;
      if (btn) { btn.classList.add("ia-ouvindo"); btn.title = "Ouvindo… clique para parar"; btn.innerHTML = '<i class="ti ti-microphone-filled" aria-hidden="true"></i><span class="ia-sr">Ouvindo — clique para parar o ditado</span>'; }
      if (typeof toast === "function") toast("Ouvindo — fale sua pergunta. Clique de novo para parar.", "info");
    } catch (e) { this._recog = null; }
  },

  // f10 — mostra o uso de IA do usuário no mês corrente (lê o próprio ia_uso; RLS restringe ao dono).
  async _uso() {
    try {
      if (!window.supa || typeof AUTH === "undefined" || !AUTH.session()) return;
      const ini = new Date(); ini.setUTCDate(1); ini.setUTCHours(0, 0, 0, 0);
      const { count } = await window.supa.from("ia_uso").select("id", { count: "exact", head: true })
        .eq("user_id", AUTH.session().id).gte("criado_em", ini.toISOString());
      const el = document.getElementById("ia-uso");
      if (el && count != null) {
        el.title = "Uso de IA neste mês";
        el.innerHTML = `<i class="ti ti-gauge" aria-hidden="true"></i> ${count} <span class="ia-uso-txt">consulta${count === 1 ? "" : "s"} este mês</span>`;
      }
    } catch (e) { /* silencioso */ }
  },

  // Reduz a imagem no cliente (máx. 1280px, JPEG q0.8) → base64 sem prefixo. Mantém o payload pequeno
  // (o gateway limita a 7MB/imagem) e barato. Mantém a foto até o usuário remover/trocar/enviar.
  anexarFoto(input) {
    const file = input && input.files && input.files[0];
    if (input) input.value = "";   // permite re-selecionar o mesmo arquivo depois
    if (!file) return;
    if (!/^image\//.test(file.type || "")) { if (typeof toast === "function") toast("Selecione um arquivo de imagem.", "warn"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1280;
        let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        if (w > max || h > max) { const r = Math.min(max / w, max / h); w = Math.round(w * r); h = Math.round(h * r); }
        const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
        cv.getContext("2d").drawImage(img, 0, 0, w, h);
        const url = cv.toDataURL("image/jpeg", 0.8);
        this._foto = { media_type: "image/jpeg", data: (url.split(",")[1] || ""), url };
        this._renderFoto();
      };
      img.onerror = () => { if (typeof toast === "function") toast("Não foi possível ler a imagem.", "warn"); };
      img.src = reader.result;
    };
    reader.onerror = () => { if (typeof toast === "function") toast("Não foi possível ler o arquivo.", "warn"); };
    reader.readAsDataURL(file);
  },

  removerFoto() { this._foto = null; this._renderFoto(); },

  // f3 — contexto do projeto do usuário ("com base no seu projeto").
  _projetoChipHTML() {
    if (!this._projetoCtx) return "";
    return `<div class="ia-chip">
      <i class="ti ti-folder" aria-hidden="true"></i>
      <span>Respondendo <strong>com base no projeto: ${esc(this._projetoCtx.nome)}</strong></span>
      <button type="button" class="ia-chip-x" title="Remover contexto do projeto" onclick="ASSIST.removerProjetoCtx()"><i class="ti ti-x" aria-hidden="true"></i><span class="ia-sr">Remover contexto do projeto</span></button>
    </div>`;
  },
  consultarProjeto(nome, projetoId, texto) {
    this._projetoCtx = { nome: nome || "Projeto", projetoId: projetoId || null, texto: texto || "" };
    if (typeof navigate === "function") navigate("assessor"); else this.render();
  },
  removerProjetoCtx() { this._projetoCtx = null; const el = document.getElementById("ia-proj"); if (el) el.innerHTML = ""; },

  _renderFoto() {
    const el = document.getElementById("ia-foto");
    if (!el) return;
    if (!this._foto) { el.hidden = true; el.innerHTML = ""; return; }
    el.hidden = false;
    el.innerHTML = `<div class="ia-foto-prev">
      <img src="${this._foto.url}" alt="Foto anexada da obra">
      <button type="button" class="ia-chip-x ia-foto-x" title="Remover foto" onclick="ASSIST.removerFoto()"><i class="ti ti-x" aria-hidden="true"></i><span class="ia-sr">Remover foto anexada</span></button>
    </div>`;
  },

  async ask(pergunta, modulo) {
    // 18/set: plano sem IA não chega a pedir (o servidor negaria de qualquer jeito, sem custo).
    if (this._semIA()) { if (typeof toast === "function") toast("A IA do Civilbook não está incluída no plano Gratuito — veja os planos em Minha conta → Assinatura.", "info"); return; }
    pergunta = (pergunta || "").trim();
    const go = document.getElementById("ia-go");
    const q = document.getElementById("ia-q");
    const temFoto = !!(this._foto && this._foto.data);
    if (pergunta.length < 3 && !temFoto) { if (typeof toast === "function") toast("Escreva uma pergunta ou anexe uma foto.", "warn"); return; }
    // Com foto e sem pergunta clara, orienta uma fiscalização por foto (f6).
    if (temFoto && pergunta.length < 3) {
      pergunta = "Fiscalização por foto: aponte indícios de não conformidade de execução, riscos e boas práticas não seguidas, com base nas normas; diga o que precisa ser confirmado em campo.";
    }
    // f40: a troca entra no fio JÁ na hora do envio (a resposta preenche depois).
    const troca = { pergunta, resposta: null, fontes: [], semBase: false, foto: temFoto, erro: null };
    this._hist.push(troca);
    this._renderThread(true);
    this._anunciar(temFoto ? "Foto enviada. Analisando…" : "Pergunta enviada. Consultando o assessor…");
    if (q) {
      q.value = ""; this._crescer(q);
      // O foco volta ao campo AGORA — ainda dentro do gesto do usuário (tocar em "enviar" tirou o
      // foco do campo). Fazer isso no finally, quando a resposta chega segundos depois, abria o
      // teclado do celular por cima da resposta que a rolagem tinha acabado de deixar à vista.
      if (!document.activeElement || document.activeElement === document.body || document.activeElement === go) this._focoCampo(q);
    }
    if (go) { go.disabled = true; go.setAttribute("aria-busy", "true"); }
    try {
      const C = window.CB_CONFIG || {};
      if (!window.supa || !C.FUNCTIONS_URL) { troca.erro = "O assessor exige a conta conectada ao backend."; return; }
      const { data: { session } } = await window.supa.auth.getSession();
      const token = session && session.access_token;
      if (!token) { troca.erro = "Faça login para usar o assessor."; return; }
      const body = {
        pergunta,
        modulo: this._ctxTela ? this._ctxTela.modulo : (modulo || (temFoto ? "fiscalizacao-foto" : (this._projetoCtx ? "projeto" : null))),
      };
      // f40: multi-turno — últimas trocas completas (sem a atual, que ainda não tem resposta).
      const anteriores = this._hist.filter(h => h.resposta && !h.erro).slice(-6).map(h => ({ pergunta: h.pergunta, resposta: h.resposta }));
      if (anteriores.length) body.historico = anteriores;
      if (this._ctxTela) body.contextoTela = this._ctxTela.texto;   // f40: onde o usuário está
      if (temFoto) body.imagens = [{ media_type: this._foto.media_type, data: this._foto.data }];
      if (this._projetoCtx && this._projetoCtx.projetoId) body.projetoId = this._projetoCtx.projetoId;   // f16: RAG no projeto_chunks
      if (this._projetoCtx && this._projetoCtx.texto) body.contextoProjeto = this._projetoCtx.texto;     // fallback p/ projeto ainda não indexado
      const r = await fetch(C.FUNCTIONS_URL + "/ai-gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, "apikey": C.SUPABASE_ANON_KEY },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        troca.erro = (d.error || ("Não foi possível consultar (erro " + r.status + ")."));
        // 18/set: "plano" = o plano não tem IA (a mensagem do servidor já diz para onde ir) → a caixa de
        // escrita vira o convite no finally. "cota" = tem IA e o mês acabou → a frase do servidor sai UMA vez e o
        // complemento vem de cbSufixoNegacaoIA (js/app.js), que só acrescenta o que ela ainda não diz: onde ficam
        // os planos (pagamento ligado, quem não é Civilbook IA) ou o Suporte — nunca uma segunda oferta
        // (tests/ia-plano.check.mjs (d), com a frase REAL do _shared/cota.ts).
        if (d.motivo === "plano") this._semIAServidor = { plano: this._planoSessao() };
        else if (d.cota && typeof cbSufixoNegacaoIA === "function") troca.erro += cbSufixoNegacaoIA(d);
        return;
      }
      troca.resposta = d.resposta || "—";
      troca.fontes = d.fontes || [];
      troca.figuras = d.figuras || [];   // f44
      troca.esquemas = d.esquemas || [];   // f50
      troca.semBase = !!d.semBase;
      this._foto = null; this._renderFoto();   // foto vale para a vez enviada
    } catch (e) {
      troca.erro = "Não foi possível consultar agora. Tente novamente em instantes.";
    } finally {
      if (go) { go.disabled = false; go.removeAttribute("aria-busy"); }
      this._persist();
      // 18/set: o servidor disse que o plano não tem IA (sessão velha) → redesenha já com o convite no
      // lugar da caixa; o fio (com a troca negada) continua na tela.
      if (this._semIAServidor && document.getElementById("ia-q")) {
        this.render();
        this._anunciar(troca.erro);
      } else {
        this._renderThread();
        this._anunciar(troca.erro ? troca.erro : ("Resposta do assessor: " + String(troca.resposta || "")));
        this._uso();
        // Rede de acessibilidade, não um focus() incondicional: se desabilitar o botão empurrou o foco
        // para o <body>, ele volta ao campo. Quem devolve o foco no caso normal é o envio (acima).
        if (q && document.activeElement === document.body) this._focoCampo(q);
      }
    }
  },

  // Foco sem arrastar a página: preventScroll é ignorado por navegador antigo — daí o catch.
  _focoCampo(q) {
    if (!q) return;
    try { q.focus({ preventScroll: true }); } catch (e) { try { q.focus(); } catch (e2) {} }
  },

  // f50: o SVG é gerado pelo NOSSO servidor (biblioteca fechada, texto escapado na origem) — não
  // vem do modelo nem do usuário. Ainda assim, como entra por innerHTML, passa por esta peneira:
  // defesa em profundidade contra um dia em que a origem mude. Aceita só o que começa com <svg.
  _svgSeguro(svg) {
    const s = String(svg || "");
    if (!/^\s*<svg[\s>]/i.test(s)) return "";
    return s
      .replace(/<\s*(script|foreignObject|iframe|object|embed)\b[\s\S]*?<\/\s*\1\s*>/gi, "")
      .replace(/<\s*(script|foreignObject|iframe|object|embed)\b[^>]*\/?>/gi, "")
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "");
  },

  // a42 — MARKDOWN-LITE do corpo da resposta. O modelo escreve tabela, lista e bloco de código
  // naturalmente; até aqui o corpo era só esc + **negrito** + <br>, e a tela mostrava
  // "| Desnível (m) | Inclinação máx. |", "|---|---|" e ```js como texto cru.
  // NÃO é um parser de markdown completo de propósito: só o que o assessor de fato produz. A ordem
  // importa — o esc() vem PRIMEIRO (nenhum HTML do modelo chega ao DOM) e os blocos ``` saem de cena
  // antes das outras regras, senão um pipe dentro do código viraria tabela.
  _fmt(txt) {
    const cercas = [];
    const s = esc(txt == null ? "" : txt)
      .replace(/```[ \t]*[\w+-]*[ \t]*\r?\n?([\s\S]*?)```/g, (m, code) => {
        cercas.push(`<pre class="ia-code"><code>${code.replace(/\s+$/, "")}</code></pre>`);
        return "" + (cercas.length - 1) + "";
      });
    // Marcação DENTRO da linha (também usada em cada célula da tabela).
    const linha = (t) => String(t)
      .replace(/`([^`\n]+)`/g, '<code class="ia-cod">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    const ehCerca = (t) => /^\d+$/.test(String(t).trim());
    const ehSep = (t) => /\|/.test(t) && /-/.test(t) && /^[\s|:-]+$/.test(t);          // |---|---|
    const ehTabela = (t, prox) => /\|/.test(t) && prox != null && ehSep(prox);
    const ehItem = (t) => /^\s*([-*•]|\d+[.)])\s+/.test(t);
    const ehTitulo = (t) => /^\s*#{1,6}\s+/.test(t);
    const celulas = (t) => t.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
    const ls = s.split(/\r?\n/);
    const out = [];
    let i = 0;
    while (i < ls.length) {
      const L = ls[i];
      if (!L.trim()) { i++; continue; }
      if (ehCerca(L)) { out.push(cercas[+L.trim().replace(//g, "")] || ""); i++; continue; }
      if (ehTabela(L, ls[i + 1])) {
        const cab = celulas(L); i += 2;
        const corpo = [];
        while (i < ls.length && ls[i].trim() && /\|/.test(ls[i])) { corpo.push(celulas(ls[i])); i++; }
        out.push(`<div class="ia-tab-wrap"><table class="ia-tab"><thead><tr>${
          cab.map((c) => `<th>${linha(c)}</th>`).join("")}</tr></thead><tbody>${
          corpo.map((r) => `<tr>${r.map((c) => `<td>${linha(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
        continue;
      }
      if (/^\s*[-*•]\s+/.test(L) || /^\s*\d+[.)]\s+/.test(L)) {
        const num = /^\s*\d+[.)]\s+/.test(L);
        const marca = num ? /^\s*\d+[.)]\s+/ : /^\s*[-*•]\s+/;
        const itens = [];
        while (i < ls.length && marca.test(ls[i])) { itens.push(`<li>${linha(ls[i].replace(marca, ""))}</li>`); i++; }
        out.push(`<${num ? "ol" : "ul"} class="ia-lista">${itens.join("")}</${num ? "ol" : "ul"}>`);
        continue;
      }
      // "### Título" vira parágrafo forte: a hierarquia de <h> da tela é do app, não do modelo.
      if (ehTitulo(L)) { out.push(`<p class="ia-h">${linha(L.replace(/^\s*#{1,6}\s+/, ""))}</p>`); i++; continue; }
      const p = [];
      while (i < ls.length && ls[i].trim() && !ehItem(ls[i]) && !ehTitulo(ls[i]) && !ehCerca(ls[i]) && !ehTabela(ls[i], ls[i + 1])) {
        p.push(ls[i].trim()); i++;
      }
      if (p.length) out.push(`<p>${linha(p.join("<br>"))}</p>`);
      else i++;   // trava de segurança: nenhum ramo consumiu a linha
    }
    return out.join("") || `<p>${linha(s)}</p>`;
  },

  _resposta(d, i) {
    const corpo = this._fmt(d.resposta || "—");
    // a42: as fontes viram bloco RECOLHIDO. A proveniência continua a um toque (decisão de
    // 12/ago/2026: "proveniência vale mais que estética"), mas deixa de ser uma parede embaixo de
    // toda resposta — o que o fundador viu no print do WhatsApp.
    let fontesHTML = "";
    if (d.fontes && d.fontes.length) {
      // f32: citação FINA ("NBR 6118:2023 · §6.4.2 · p. 47") + link ancorado — com página, o "abrir"
      // cai direto na página do PDF (#page=N, honrado pelo viewer nativo do navegador).
      const itens = d.fontes.map((f) => {
        const cit = f.citacao ? ` · <span class="ia-fonte-cit">${esc(f.citacao)}</span>` : "";
        const anc = (f.url && f.pagina && /\.pdf(\?|#|$)/i.test(f.url)) ? "#page=" + f.pagina : "";
        const abrir = f.url ? ` · <a href="${esc(f.url) + anc}" target="_blank" rel="noopener"${anc ? ` title="abre na página ${f.pagina}"` : ""}>abrir${anc ? " na p. " + f.pagina : ""}</a>` : "";
        return `<li><span class="ia-fonte-n">[${f.n}]</span> ${esc(f.fonte || "")}${f.titulo ? " — " + esc(f.titulo) : ""}${cit}${abrir}</li>`;
      }).join("");
      const aberto = this._fontesAbertas && this._fontesAbertas.has(i) ? " open" : "";
      fontesHTML = `<details class="ia-fontes"${aberto} ontoggle="ASSIST._marcarFontes(${i}, this.open)">
        <summary><i class="ti ti-quote" aria-hidden="true"></i> Fontes (${d.fontes.length})<i class="ti ti-chevron-down ia-seta" aria-hidden="true"></i></summary>
        <ul class="ia-fontes-lista">${itens}</ul>
      </details>`;
    }
    // f44: figuras da norma citadas na resposta (URL assinada de 1h — em conversa restaurada
    // antiga a imagem pode expirar; o onerror esmaece em vez de quebrar o layout).
    let figurasHTML = "";
    if (d.figuras && d.figuras.length) {
      figurasHTML = `<div class="ia-figs">` + d.figuras.map((f) =>
        `<figure class="ia-fig"><img src="${esc(f.url)}" alt="${esc((f.figura || "Figura") + " da " + (f.norma_codigo || "norma"))}" loading="lazy" onerror="this.closest('figure').style.opacity=.35"><figcaption>${esc(f.figura || "")} — ${esc(f.norma_codigo || "")}${f.legenda ? " · " + esc(f.legenda) : ""}${f.pagina ? " · p. " + f.pagina : ""}</figcaption></figure>`).join("") + `</div>`;
    }
    // f50: esquemas DESENHADOS pelo servidor. O SVG vem inline (sem storage, sem expirar) e já
    // carrega marca d'água + aviso legal no próprio desenho — o que se lê aqui fora é a verificação
    // contra a norma, para o "fora de norma" saltar aos olhos sem precisar abrir a imagem.
    let esquemasHTML = "";
    if (d.esquemas && d.esquemas.length) {
      esquemasHTML = d.esquemas.map((e) => {
        // Os achados já estão DENTRO do SVG (o desenho tem de viajar auto-contido). Aqui fora só os
        // ERROS, que precisam saltar aos olhos como texto selecionável — repetir os "ok" polui.
        const erros = (e.achados || []).filter((a) => a.severidade === "erro").map((a) =>
          `<li class="ia-erro-li"><i class="ti ti-alert-octagon" aria-hidden="true"></i> ${esc(a.texto)}</li>`).join("");
        const selo = e.conforme
          ? `<span class="ia-selo ia-selo-ok">dentro da norma</span>`
          : `<span class="ia-selo ia-selo-fora">fora da norma</span>`;
        return `<figure class="ia-esquema">
          <div class="ia-esq-cab">
            <strong class="ia-esq-tt">${esc(e.titulo || "Esquema")}</strong>${selo}
            <span class="ia-esq-cit">${esc(e.citacao || "")}</span>
          </div>
          <div class="ia-svg">${ASSIST._svgSeguro(e.svg)}</div>
          ${erros ? `<ul class="ia-erros">${erros}</ul>` : ""}
          <figcaption>${esc(e.resumo || "")}</figcaption>
        </figure>`;
      }).join("");
    }
    const semBase = d.semBase ? `<p class="ia-sembase"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Ainda não há base curada para esta pergunta — por isso a resposta é limitada.</p>` : "";
    const chips = this._chipsHTML(d);
    const acoes = `<div class="ia-acoes">
      <button type="button" class="ia-acao" id="ia-cp-${i}" onclick="ASSIST._copiar(${i})"><i class="ti ti-copy" aria-hidden="true"></i> Copiar</button>${chips}
    </div>`;
    return `<div class="ia-bot-cab"><span class="ia-avatar" aria-hidden="true"><i class="ti ti-sparkles"></i></span><span class="ia-bot-nome">Assessor</span></div>
      <div class="ia-bot-corpo">${corpo}</div>${esquemasHTML}${figurasHTML}${semBase}${fontesHTML}${acoes}`;
  },
};
if (typeof window !== "undefined") window.ASSIST = ASSIST;
