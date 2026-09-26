// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Civilbook MVP — SPA sem dependências.
const app = document.getElementById("app");
let currentModule = "home";
let _navPop = false; // true durante navegação vinda do botão "voltar" (não empilha histórico)

// ---------- Navegação ----------
document.querySelectorAll("#module-nav button").forEach(btn => {
  btn.addEventListener("click", () => navigate(btn.dataset.module));
});

function navigate(module, param) {
  // 18/set/2026 (piloto só por convite): SEM sessão ninguém navega pelos módulos. A única tela sem conta é a vista
  // por link (?share=, js/compartilhar.js), que não passa por aqui — e nela, numa tela larga, o #module-nav, a busca
  // e o logo chamavam navigate() e abriam Calculadoras, Normas, SINAPI… sem conta. Sem sessão, vai ao login.
  // Travado em tests/portas-convite.check.mjs (roda esta função).
  // a47 (19/set/2026): sem sessão, só vai ao login quem PODE ir (AUTH.podeIrAoLogin: o SDK disse que não há sessão E o
  // storage dele está vazio). Na volta do Google o SDK apaga o hash (#access_token=…) ANTES de gravar a sessão; o
  // navegador trata isso como navegação de fragmento e dispara popstate, e o popstate (abaixo) chamava navigate("home")
  // sem sessão → index.html#entrar com a sessão a caminho do storage: o "voltei à landing com Entrar" do relato (o
  // "Session History Item Has Been Marked Skippable" em app.html# do navegador do fundador). Aqui a recusa é calada:
  // quem decide o login é o cbInit do app.html, que espera a sessão. Travado em tests/boot-sessao.check.mjs (A7).
  if (typeof AUTH !== "undefined" && !AUTH.session()) {
    if (typeof AUTH.podeIrAoLogin === "function" && !AUTH.podeIrAoLogin()) return Promise.resolve();
    if (typeof AUTH._diagIrLogin === "function") AUTH._diagIrLogin("navegar");
  }
  // a52 P2: as saídas de navigate() devolvem promessa como o caminho normal — quem chama com .then() (o
  // ?esquema= do app.html, os specs E2E) não pode receber undefined de um caminho e promessa de outro.
  if (typeof AUTH === "undefined" || !AUTH.session()) { window.location.href = "index.html#entrar"; return Promise.resolve(); }
  currentModule = module;
  _navUltima = { module: module, param: param };
  document.querySelectorAll("#module-nav button, #mobile-tabbar button[data-module]").forEach(b => {
    const on = b.dataset.module === module;
    b.classList.toggle("active", on);
    if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  TABBAR.marcar(module);              // celular: módulo fora dos 4 atalhos → "Mais" ativo com o nome dele
  // Navegar fecha a folha (Mais / menu da conta). Se a folha tinha a entrada dela no topo do histórico
  // (ver FOLHA), o módulo novo SUBSTITUI essa entrada — senão o "voltar" seguinte cairia numa entrada
  // fantasma (mesma tela, folha fechada) antes de voltar de verdade.
  const daFolha = FOLHA.aberta();
  const trocaEntrada = FOLHA.fechar({ semFoco: true, navegando: true });
  hideSearch();
  const views = {
    home: renderHome,
    assessor: () => (typeof ASSIST !== "undefined" ? ASSIST.render() : renderHome()),
    calculadoras: () => renderCalculadoras(param),
    normas: () => renderNormas(param),
    sinapi: () => renderSinapi(param),
    materiais: () => renderMateriais(param),
    checklists: () => renderChecklists(param),
    laudos: () => renderLaudos(param),
    avaliacao: () => renderAvaliacao(param),
    seguranca: () => renderSegTrab(param),
    manutencao: () => renderManutencao(param),
    projetos: () => renderProjetos(param),
    rdo: () => renderRdo(param),
    cronograma: () => renderCronograma(param),
    conferencia: () => renderConferencia(param),
    interacoes: () => renderInteracoes(param),
    tecnicas: () => renderTecnicas(param),
    compras: () => renderCompras(param),
    corpo: () => renderCorpo(param),
    conta: () => renderConta(param)
  };
  renderUserMenu();
  window.scrollTo(0, 0);
  // Integração com o histórico → botão/gesto "voltar" do navegador e do celular. Fica ANTES do desenho, e
  // síncrona: o histórico e a aba ativa não podem esperar a rede de um módulo (o "voltar" apertado durante o
  // download cairia na entrada errada).
  if (!_navPop) {
    try { history[trocaEntrada ? "replaceState" : "pushState"]({ module, param: param || null }, "", "#" + module + (param ? "/" + encodeURIComponent(param) : "")); } catch (e) {}
  }

  // a52 passo 2 (21/set/2026): o JS deste módulo chega AGORA, se ainda não chegou (js/modulos.js). Tudo o que é
  // da CASCA já foi feito acima, de forma síncrona; o que espera é só o conteúdo do <main>.
  // navigate() DEVOLVE UMA PROMESSA que resolve com a tela desenhada (ou com a tela de falha) — é por ela que o
  // ?esquema= do app.html e os specs E2E sabem que o módulo abriu. Ela NUNCA rejeita: quem chama do onclick de
  // um cartão não tem como tratar rejeição, e promessa rejeitada sem dono derruba o console.
  const desenhar = function () {
    let desenhou = false;
    try {
      (views[module] || renderHome)();
      if (typeof PROT !== "undefined") PROT.aplicar(module);   // d13: marca d'água/no-select no conteúdo sensível
      desenhou = true;
    } catch (e) {
      // O render LANÇOU (o registro js/modulos.js que não chegou e levou junto todo render* de módulo; um
      // global de módulo lido sem typeof). Antes da a52 P2 o lance subia pelo onclick e a tela ANTERIOR
      // continuava na frente, navegável; agora o <main> está em "Carregando…" e ficaria assim para sempre.
      // Correção de 21/set/2026 (achado da revisão): vira tela de falha com saída, em vez de tela parada.
      try { console.error("[cb] o módulo " + module + " não desenhou:", e); } catch (_) {}
      app.innerHTML = (typeof MODULOS !== "undefined") ? MODULOS.falhaHTML("conteudo") : cbFalhaSemRegistroHTML();
    }
    // Só é ACESSO a tela que desenhou: o evento alimenta "Seus acessos recentes" (RECO) e o itens_populares da
    // comunidade, e módulo que não chegou (elevador, 4G ruim) não pode entrar como visita.
    if (desenhou && typeof METRICS !== "undefined") { try { METRICS.event("navigate", module, param || null); } catch (_) {} }
    // Veio da folha: o botão tocado foi removido com ela e o foco cairia no <body> (leitor de tela e
    // teclado recomeçariam do topo da página). Vai para o título da tela nova.
    if (daFolha) focarTela();
  };
  // A senha desta navegação sobe SEMPRE, inclusive quando não há nada a baixar: a tela que já estava sendo
  // esperada tem de perder a vez. Subindo só no ramo lento, abrir Manutenção (lenta) e em seguida Calculadoras
  // (que já está carregada) fazia a Manutenção redesenhar POR CIMA das Calculadoras quando enfim chegasse.
  const seq = ++_navSeq;
  const falta = (typeof MODULOS !== "undefined") ? MODULOS.faltam(module) : [];
  if (!falta.length) { desenhar(); return Promise.resolve(); }
  app.innerHTML = MODULOS.carregandoHTML();
  // O foco vai para o <main> JÁ, não só quando a rede responder: veio da folha, o botão tocado sumiu com ela e
  // o foco está no <body> — quem usa leitor de tela ou Tab recomeçaria do topo da página durante todo o
  // download (segundos, no 4G de canteiro). O "Carregando…" é role="status" para ser anunciado.
  if (daFolha) focarTela();
  return MODULOS.garantir(module).then(
    function () { if (seq === _navSeq) desenhar(); },
    function (e) {
      // Trocou de tela enquanto o módulo vinha: a falha é de uma tela que ninguém está vendo.
      if (seq !== _navSeq) return;
      app.innerHTML = MODULOS.falhaHTML((e && e.motivo) || "rede");
      if (daFolha) focarTela();
    }
  );
}
// Qual foi a última navegação pedida: o "Tentar de novo" da tela de falha repete ESTA, com o parâmetro (a sub-aba
// do SINAPI, o id do laudo) — um onclick="navigate('sinapi')" perderia o "cub:" e abriria outra tela.
let _navSeq = 0;
let _navUltima = { module: "home", param: undefined };
function cbTentarModulo() {
  _navPop = true;   // repetir a mesma tela não empilha entrada nova no histórico
  try { return navigate(_navUltima.module, _navUltima.param); } finally { _navPop = false; }
}
if (typeof window !== "undefined") window.cbTentarModulo = cbTentarModulo;
// O registro (js/modulos.js) é da CASCA e vem no app.html. Se ELE não chegar, módulo nenhum tem como chegar e
// todo render* de módulo vira ReferenceError — e o "Tentar de novo" comum pediria exatamente a mesma coisa de
// novo. A saída aqui é recarregar a PÁGINA, que é o que traz o registro (a página nunca leva carimbo).
function cbFalhaSemRegistroHTML() {
  return `<div class="card" style="max-width:560px;margin:30px auto;text-align:center;padding:28px">
    <p style="color:var(--text-2);margin:0 0 16px">O app não carregou por inteiro. Recarregue a página.</p>
    <button type="button" class="btn primary" onclick="location.reload()"><i class="ti ti-refresh"></i> Recarregar</button>
  </div>`;
}

// Foco programático no título da tela (ou no <main>, se o módulo ainda não desenhou título).
// tabindex=-1: focável por script, fora da ordem do Tab. O anel de foco some no css (.cb-foco-tela):
// título não é controle.
function focarTela() {
  const alvo = app.querySelector("h1, h2") || app;
  alvo.setAttribute("tabindex", "-1");
  alvo.classList.add("cb-foco-tela");
  try { alvo.focus({ preventScroll: true }); } catch (e) {}
}

window.addEventListener("popstate", e => {
  // Gesto/botão "voltar" com a folha aberta fecha SÓ a folha (no Android é o reflexo de todo usuário;
  // antes trocava de módulo por baixo dela e, na Início logo após o boot, FECHAVA o PWA).
  if (FOLHA.aoPopstate()) return;
  const st = e.state || {};
  // "Avançar" até a entrada de uma folha já fechada: é a mesma tela — nada a redesenhar.
  if (st.folha && (st.module || "home") === currentModule) return;
  _navPop = true;
  navigate(st.module || "home", st.param || undefined);
  _navPop = false;
});

// Acessibilidade por teclado: Esc fecha qualquer modal aberto (overlay .cb-modal-ov).
document.addEventListener("keydown", e => {
  if (e.key === "Escape") document.querySelectorAll(".cb-modal-ov").forEach(ov => ov.remove());
});

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const brl = n => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
// a11 — número no padrão pt-BR (separador de milhar + vírgula decimal). Aceita número OU string
// já com casas (ex.: "9375000.00"), preservando as casas — ou força `dec` casas. A unidade vem
// separada (com espaço, no render). Mesmo espírito do brl()/Intl usado no financeiro.
function fmtNum(v, dec) {
  const s = String(v == null ? "" : v).trim();
  const n = parseFloat(s);
  if (!isFinite(n)) return s;
  const casas = (dec != null) ? dec : (s.indexOf(".") >= 0 ? (s.split(".")[1] || "").length : 0);
  return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
if (typeof window !== "undefined") window.fmtNum = fmtNum;

// ---------- Home ----------
// O stat "textos técnicos indexados" é FIXO ("700+"): a contagem viva mora na Base IA atrás de
// RLS (visitante anônimo não conta; censo de 28/ago/2026: 745 fontes — normas, leis, NRs,
// resoluções, manuais). Atualizar por marco (próximo: 1.000), nunca por contagem exata que caduca.
function renderHome() {
  app.innerHTML = `
    <div class="hero">
      <h1>Referência técnica de bolso para a construção civil</h1>
      <p>Calculadoras normatizadas, acervo técnico indexado (normas ABNT, leis, NRs, resoluções e manuais), preços SINAPI, fichas de materiais, checklists de obra e modelos de laudos — tudo em um só lugar.</p>
      <div class="stat-row">
        <div class="stat"><div class="s-num">${CALCULADORAS.length}</div><div class="s-label">calculadoras</div></div>
        <div class="stat"><div class="s-num">700+</div><div class="s-label">textos técnicos indexados</div></div>
        <div class="stat"><div class="s-num">${typeof SINAPI !== "undefined" ? SINAPI.length.toLocaleString("pt-BR") : "10 mil+"}</div><div class="s-label">composições SINAPI</div></div>
        <div class="stat"><div class="s-num">${MATERIAIS.length}</div><div class="s-label">fichas de materiais</div></div>
        <div class="stat"><div class="s-num">${CHECKLISTS.length}</div><div class="s-label">checklists</div></div>
        <div class="stat"><div class="s-num">${LAUDOS.length}</div><div class="s-label">modelos de laudo</div></div>
      </div>
    </div>
    <div class="card" style="margin-bottom:14px;border-left:3px solid var(--blue);cursor:pointer" onclick="navigate('assessor')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' ')navigate('assessor')">
      <div style="display:flex;align-items:center;gap:12px">
        <i class="ti ti-sparkles" aria-hidden="true" style="font-size:22px;color:var(--blue)"></i>
        <div>
          <div style="font-weight:600">Perguntar à IA — o assessor do Civilbook</div>
          <div class="page-sub" style="margin:0;font-size:13px">Dúvidas técnicas com respostas citadas, da base curada. Apoio — não substitui o RT.</div>
        </div>
      </div>
    </div>
    <div id="instalar-home"></div>
    <div id="mnt-alert"></div>
    <div id="reco-home" class="reco-home"></div>
    <div class="grid grid-3">
      ${moduleCard("calculadoras", "ti-calculator", "var(--blue-light)", "var(--blue)", "Calculadoras", "Vigas, pilares, lajes, fundações, quantitativos e instalações.")}
      ${moduleCard("normas", "ti-book", "var(--green-light)", "var(--green)", "Normas ABNT", "Pontos-chave das NBRs mais usadas, para consulta rápida.")}
      ${moduleCard("sinapi", "ti-receipt", "var(--amber-light)", "var(--amber)", "SINAPI", "Composições de custo com busca e filtro por categoria.")}
      ${moduleCard("materiais", "ti-cube", "var(--purple-light)", "var(--purple)", "Materiais", "Fichas técnicas: concretos, aços, blocos, cimentos.")}
      ${moduleCard("checklists", "ti-clipboard-check", "var(--teal-light)", "var(--teal)", "Checklists", "Recebimento de concreto, armação, alvenaria, entrega de obra.")}
      ${moduleCard("laudos", "ti-file-description", "var(--coral-light)", "var(--coral)", "Laudos", "Modelos prontos: vistoria, patologia, diário de obra, termos.")}
      ${moduleCard("avaliacao", "ti-home-dollar", "var(--green-light)", "var(--green)", "Avaliação de imóveis", "Valor de mercado NBR 14653: comparativo por fatores, regressão e laudo.")}
      ${moduleCard("seguranca", "ti-helmet", "var(--red-light)", "var(--red)", "Segurança do Trabalho", "NRs do MTE na obra: exigências, checklists de inspeção e modelos (APR, PT, PGR).")}
      ${moduleCard("manutencao", "ti-tool", "var(--blue-light)", "var(--blue)", "Manutenções e Garantias", "OS e cronograma NBR 5674, prazos de garantia NBR 17170 e fornecedores.")}
      ${moduleCard("projetos", "ti-folder", "var(--purple-light)", "var(--purple)", "Meus projetos", "Envie plantas, memoriais e fotos da obra e pergunte à IA com base no seu projeto.")}
      ${moduleCard("rdo", "ti-notebook", "var(--teal-light)", "var(--teal)", "Diário de Obra", "RDO por data: efetivo, clima, atividades, ocorrências e fotos — imprimível.")}
      ${moduleCard("cronograma", "ti-timeline-event", "var(--blue-light)", "var(--blue)", "Cronograma de obra", "Etapas, Gantt e curva S físico-financeiro — previsto × realizado, imprimível.")}
      ${moduleCard("conferencia", "ti-clipboard-list", "var(--purple-light)", "var(--purple)", "Conferência de projetos", "Verificação por disciplina com critérios eliminatórios e relatório.")}
      ${moduleCard("interacoes", "ti-arrows-cross", "var(--coral-light)", "var(--coral)", "Interações entre materiais", "Incompatibilidades entre materiais, com mecanismo e referências.")}
      ${moduleCard("tecnicas", "ti-list-details", "var(--blue-light)", "var(--blue)", "Ações técnicas", "Procedimentos por área: técnica, cuidados, complicações e referências.")}
      ${moduleCard("compras", "ti-shopping-cart", "var(--teal-light)", "var(--teal)", "Compras", "Conferência do pedido: itens complementares e materiais por serviço.")}
    </div>
    <div id="fb-convite"></div>
    <div id="roadmap-home" class="cb-roadmap"></div>
    <div id="ad-home" class="cb-ad-home"></div>
    <div id="afil-home" class="cb-afil"></div>`;
  if (typeof INSTALAR !== "undefined") INSTALAR.render();   // convite para instalar o PWA (no-op se já instalado/dispensado)
  if (typeof RECO !== "undefined") RECO.render();
  if (typeof renderMntAlert === "function") renderMntAlert();
  // e34: o convite a avaliar. SÍNCRONO e aqui dentro de propósito — o cartão nasce junto com a tela ou não
  // nasce; nada de temporizador enchendo o espaço depois que a pessoa começou a ler. Quem decide se aparece
  // (e se já é hora) é o FBCONVITE; este é o único lugar que conta a abertura.
  if (typeof FBCONVITE !== "undefined") { FBCONVITE.abertura(); FBCONVITE.render(); }
  if (typeof ROADMAP !== "undefined") ROADMAP.render("roadmap-home");   // e7: novidades públicas (no-op se vazio/off)
  if (typeof ADS !== "undefined") ADS.slot("ad-home");   // d10: anúncio in-content (só free users; no-op se off/PRO)
  if (typeof AFIL !== "undefined") AFIL.bloco("afil-home", "geral", { max: 3 });   // d11: recomendações de afiliado (no-op se off)
}

// Badge de atenção na home: OSs de manutenção vencidas ou vencendo em ≤7 dias (só PRO).
// a52 P2: o módulo Manutenção deixou de vir na abertura, e este aviso é a ÚNICA coisa da primeira tela que
// depende dele. Ele continua aparecendo — só que o arquivo chega DEPOIS que a home pintou, e só para quem é
// PRO (o gratuito nem chega aqui). Falhou o download: sem aviso, como já acontecia quando MNT.ready() falhava —
// a home nunca fica presa por causa de um badge.
// GRUPO, não o módulo (correção de 21/set/2026, achado da revisão): pedir "manutencao" trazia os 12 arquivos do
// módulo (56,1 KB comprimidos a mais) para desenhar um badge, na home de TODA conta PRO — que é justamente
// quem paga. O badge só usa MNT.ready()/MNT.osAtencao(), e MNT mora num arquivo só.
async function renderMntAlert() {
  if (typeof planoEhPro !== "function" || !planoEhPro()) return;
  if (typeof MODULOS !== "undefined") { try { await MODULOS.garantirGrupo("mnt-alerta"); } catch (e) { return; } }
  if (typeof MNT === "undefined") return;
  await MNT.ready();
  const host = document.getElementById("mnt-alert");
  if (!host) return;   // usuário já navegou para outra tela
  const a = MNT.osAtencao();
  const total = a.vencidas.length + a.proximas.length;
  if (!total) { host.innerHTML = ""; return; }
  const temVencida = a.vencidas.length > 0;
  const partes = [];
  if (a.vencidas.length) partes.push(`${a.vencidas.length} vencida${a.vencidas.length > 1 ? "s" : ""}`);
  if (a.proximas.length) partes.push(`${a.proximas.length} vence${a.proximas.length > 1 ? "m" : ""} em ≤7 dias`);
  host.innerHTML = `
    <div class="mnt-alert-card ${temVencida ? "danger" : ""}" role="button" tabindex="0"
         onclick="navigate('manutencao')" onkeydown="if(event.key==='Enter')navigate('manutencao')">
      <i class="ti ti-alert-triangle"></i>
      <div style="flex:1;min-width:0">
        <strong>${total} ${total > 1 ? "ordens" : "ordem"} de serviço ${total > 1 ? "exigem" : "exige"} atenção</strong>
        <div style="font-size:13px;opacity:.9">${partes.join(" · ")} — toque para abrir a manutenção</div>
      </div>
      <i class="ti ti-chevron-right" style="opacity:.6"></i>
    </div>`;
}

function moduleCard(mod, icon, bg, color, title, desc) {
  return `<div class="card clickable" onclick="navigate('${mod}')">
    <div class="card-icon" style="background:${bg};color:${color}"><i class="ti ${icon}"></i></div>
    <h3>${title}</h3><p>${desc}</p>
  </div>`;
}

// ---------- Calculadoras ----------
// e14: busca/filtro + favoritos (localStorage). A lista de itens (#calc-list-items) re-renderiza
// sozinha ao buscar/favoritar; o campo de busca fica fora dela para não perder o foco.
let _calcQuery = "";
let _calcActive = null;
const CALCFAV = {
  LS: "cb-calc-fav",
  lista() { try { return JSON.parse(localStorage.getItem(this.LS)) || []; } catch { return []; } },
  toggle(id) { const l = this.lista(), i = l.indexOf(id); if (i >= 0) l.splice(i, 1); else l.unshift(id); try { localStorage.setItem(this.LS, JSON.stringify(l)); } catch {} }
};

function renderCalculadoras(activeId) {
  const active = CALCULADORAS.find(c => c.id === activeId) || CALCULADORAS[0];
  _calcActive = active.id;
  app.innerHTML = `
    <h2 class="page-title">Calculadoras</h2>
    <p class="page-sub">Resultados em tempo real. Sempre valide com o projeto e a norma vigente.</p>
    <div class="calc-layout">
      <div class="calc-list">
        <div class="calc-search"><i class="ti ti-search" aria-hidden="true"></i><input type="text" id="calc-search" placeholder="Buscar calculadora…" value="${esc(_calcQuery)}" aria-label="Buscar calculadora"></div>
        <div id="calc-list-items">${renderCalcItems()}</div>
      </div>
      <div class="card" id="calc-panel"></div>
    </div>`;
  document.getElementById("calc-search").addEventListener("input", e => {
    _calcQuery = e.target.value;
    const items = document.getElementById("calc-list-items"); if (items) items.innerHTML = renderCalcItems();
  });
  renderCalcPanel(active);
}

function renderCalcItems() {
  const q = _calcQuery.trim().toLowerCase();
  const favs = CALCFAV.lista();
  const match = c => !q || (c.titulo + " " + (c.sub || "") + " " + c.grupo).toLowerCase().includes(q);
  const matched = CALCULADORAS.filter(match);
  const btn = c => `<button class="${c.id === _calcActive ? "active" : ""}" data-calc="${c.id}" onclick="selecionarCalc('${c.id}')">
      <i class="ti ${c.icone}"></i><span class="calc-tit">${esc(c.titulo)}</span>
      <span class="calc-fav${favs.indexOf(c.id) >= 0 ? " on" : ""}" role="button" tabindex="0" title="Favoritar" aria-label="Favoritar ${esc(c.titulo)}" onclick="event.stopPropagation();toggleCalcFav('${c.id}')"><i class="ti ti-star"></i></span>
    </button>`;
  let html = "";
  const favCalcs = matched.filter(c => favs.indexOf(c.id) >= 0);
  // ti-star, nunca a variante "star-filled": o @tabler/icons-webfont não tem NENHUM ícone "-filled" (conferido na 3.47.0,
  // a52 P1). Eram DOIS defeitos vivos: o rótulo "Favoritas" saía sem ícone, e a estrela da calculadora FAVORITADA
  // sumia justamente quando a pessoa a favoritava. O estado favorito continua visível pela classe .calc-fav.on
  // (opacidade 1 e dourado, css/style.css).
  if (favCalcs.length && !q) html += `<div class="group-label"><i class="ti ti-star"></i> Favoritas</div>` + favCalcs.map(btn).join("");
  [...new Set(matched.map(c => c.grupo))].forEach(g => { html += `<div class="group-label">${esc(g)}</div>` + matched.filter(c => c.grupo === g).map(btn).join(""); });
  if (!matched.length) html += `<p class="page-sub" style="padding:12px 4px">Nada encontrado para “${esc(_calcQuery)}”.</p>`;
  return html;
}

function toggleCalcFav(id) {
  CALCFAV.toggle(id);
  const items = document.getElementById("calc-list-items"); if (items) items.innerHTML = renderCalcItems();
}

// Seleciona uma calculadora SEM re-navegar (o navigate() rola a página ao topo, causando o
// salto incômodo). Troca apenas o painel e o destaque da lista, preservando a posição de
// rolagem. No mobile (layout empilhado, <=760px) traz o painel à vista para mostrar a escolha.
function selecionarCalc(id) {
  const calc = CALCULADORAS.find(c => c.id === id);
  if (!calc) return;
  _calcActive = id;
  document.querySelectorAll(".calc-list button").forEach(b => b.classList.toggle("active", b.dataset.calc === id));
  renderCalcPanel(calc);
  try { history.replaceState({ module: "calculadoras", param: id }, "", "#calculadoras/" + encodeURIComponent(id)); } catch (e) {}
  if (typeof METRICS !== "undefined") METRICS.event("navigate", "calculadoras", id);
  if (window.matchMedia("(max-width: 760px)").matches) {
    const p = document.getElementById("calc-panel");
    if (p) p.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderCalcPanel(calc) {
  const panel = document.getElementById("calc-panel");
  // Ferramentas interativas (conversor, científica) trazem render próprio — fora do padrão campos+compute.
  if (typeof calc.render === "function") {
    panel.innerHTML = `
      <div class="detail-header"><div><h2>${esc(calc.titulo)}</h2><div class="sub">${esc(calc.sub)}</div></div></div>
      <div id="calc-custom"></div>
      ${calc.norma && calc.norma !== "—" ? `<span class="norm-ref"><i class="ti ti-book"></i>${esc(calc.norma)}</span>` : ""}`;
    try { calc.render(document.getElementById("calc-custom")); }
    catch (e) { document.getElementById("calc-custom").innerHTML = `<p class="page-sub">Não foi possível montar a ferramenta: ${esc(e.message || e)}</p>`; }
    return;
  }
  panel.innerHTML = `
    <div class="detail-header" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div>
        <h2>${calc.titulo}</h2>
        <div class="sub">${calc.sub}</div>
      </div>
      <button class="btn" id="calc-hist-btn"><i class="ti ti-history"></i>Histórico</button>
    </div>
    <div id="calc-fields">
      ${calc.campos.map(f => f.tipo === "select" ? `
        <div class="field">
          <label>${f.label}</label>
          <select id="f-${f.id}">${f.opcoes.map((o, i) => `<option value="${o.valor}" ${i === 0 ? "selected" : ""}>${o.label}</option>`).join("")}</select>
        </div>` : `
        <div class="field">
          <label>${f.label}</label>
          <input type="number" id="f-${f.id}" value="${f.valor}" step="any">
          ${f.hint ? `<span class="hint">${f.hint}</span>` : ""}
        </div>`).join("")}
    </div>
    <div id="calc-results"></div>
    <button class="btn" id="calc-save" style="margin-top:12px"><i class="ti ti-bookmark"></i>Salvar no histórico</button>
    <span class="norm-ref"><i class="ti ti-book"></i>${calc.norma}</span>`;
  const recalc = () => {
    const vals = {};
    calc.campos.forEach(f => { vals[f.id] = parseFloat(document.getElementById("f-" + f.id).value) || 0; });
    const results = calc.compute(vals);
    document.getElementById("calc-results").innerHTML = results.map(r => `
      <div class="result ${r.status || ""}">
        <div>
          <div class="r-label">${r.label}</div>
          ${r.note ? `<div class="r-label" style="font-weight:400;opacity:.85">${r.note}</div>` : ""}
        </div>
        <div><span class="r-value">${fmtNum(r.value)}</span>${r.unit ? `<span class="r-unit"> ${esc(r.unit)}</span>` : ""}</div>
      </div>`).join("");
  };
  calc.campos.forEach(f => document.getElementById("f-" + f.id).addEventListener("input", recalc));
  // Pré-preenche com um cálculo carregado do histórico, se houver.
  if (_calcPreload) {
    calc.campos.forEach(f => { const el = document.getElementById("f-" + f.id); if (el && _calcPreload[f.id] != null) el.value = _calcPreload[f.id]; });
    _calcPreload = null;
  }
  document.getElementById("calc-hist-btn").addEventListener("click", () => CALCHIST.abrir());
  document.getElementById("calc-save").addEventListener("click", () => {
    const vals = {};
    calc.campos.forEach(f => { vals[f.id] = parseFloat(document.getElementById("f-" + f.id).value) || 0; });
    CALCHIST.salvar(calc, vals, calc.compute(vals));
  });
  recalc();
}

// ---------- Histórico de cálculos ----------
// Salva cada cálculo marcado em usage_events.metadata (event_type='calculo') para revisão,
// com espelho em localStorage (instantâneo + offline). Lista os últimos 20.
let _calcPreload = null;   // inputs a pré-preencher no próximo renderCalcPanel
const CALCHIST = {
  // a57 (22/set/2026): o espelho local é POR CONTA — a chave única "cb-calc-hist" valia para qualquer conta
  // que usasse este navegador, e o histórico traz as ENTRADAS e os RESULTADOS. A LEGADA é apagada na 1ª
  // leitura, nunca migrada (não se sabe de quem é). Limite: quem usou o MODO LOCAL antes do conserto perde
  // o espelho; quem tem conta recupera do usage_events.
  LS_LEGADO: "cb-calc-hist",
  _ls(uid) {
    try { localStorage.removeItem(this.LS_LEGADO); } catch (e) {}
    const u = uid === undefined ? (typeof CBStore !== "undefined" ? CBStore.uid() : null) : uid;
    return "cb-calc-hist:v2:" + (u || "anon");
  },
  salvar(calc, vals, results) {
    const item = {
      ref: calc.id, titulo: calc.titulo, inputs: vals,
      results: results.map(r => ({ label: r.label, value: String(r.value), unit: r.unit || "" })),
      occurred_at: new Date().toISOString(),
    };
    const chave = this._ls();
    let lista = CBStore.lsGet(chave, []);
    lista.unshift(item); lista = lista.slice(0, 20);
    CBStore.lsSet(chave, lista);                   // espelho local (instantâneo/offline), por conta
    if (typeof METRICS !== "undefined") {          // usage_events (cross-device) — só logado
      METRICS.event("calculo", "calculadoras", calc.id, { titulo: calc.titulo, inputs: vals, results: item.results });
    }
    if (typeof toast === "function") toast("Cálculo salvo no histórico.", "success");
  },
  // uid = de quem é o histórico (o abrir() passa o da sessão, para a consulta e o espelho casarem). O
  // filtro vai NA CONSULTA (a57): usage_events_select_own (0001) é "dono ou is_admin()", e sem ele o
  // histórico do admin listava os 20 cálculos mais recentes de QUALQUER conta.
  async listar(uid) {
    const u = uid === undefined ? (typeof CBStore !== "undefined" ? CBStore.uid() : null) : uid;
    if (typeof CBStore !== "undefined" && CBStore.online() && u) {
      try {
        const { data, error } = await window.supa.from("usage_events")
          .select("ref,metadata,occurred_at").eq("user_id", u).eq("event_type", "calculo")
          .order("occurred_at", { ascending: false }).limit(20);
        if (!error && data && data.length) {
          return data.map(r => ({
            ref: r.ref, titulo: (r.metadata && r.metadata.titulo) || r.ref,
            inputs: (r.metadata && r.metadata.inputs) || {},
            results: (r.metadata && r.metadata.results) || [],
            occurred_at: r.occurred_at,
          }));
        }
      } catch (e) { /* cai no localStorage */ }
    }
    return CBStore.lsGet(this._ls(u), []);
  },
  carregar(ref, inputs) {
    _calcPreload = inputs || null;
    document.getElementById("cb-calc-hist")?.remove();
    navigate("calculadoras", ref);
  },
  async abrir() {
    document.getElementById("cb-calc-hist")?.remove();
    const uid = (typeof CBStore !== "undefined") ? CBStore.uid() : null;   // lido cedo: consulta e espelho casam
    const itens = await this.listar(uid);
    const ov = document.createElement("div");
    ov.id = "cb-calc-hist";
    ov.className = "cb-modal-ov";
    ov.onclick = e => { if (e.target === ov) ov.remove(); };
    const linhas = itens.length ? itens.map((it, i) => {
      const calc = CALCULADORAS.find(c => c.id === it.ref);
      const ins = Object.entries(it.inputs || {}).map(([k, v]) => {
        const campo = calc && calc.campos.find(f => f.id === k);
        return `${campo ? esc(campo.label.replace(/\s*\(.*?\)\s*/g, "")) : esc(k)}: ${esc(String(v))}`;
      }).join(" · ");
      const res = (it.results || []).slice(0, 2).map(r => `${esc(r.label)}: <strong>${esc(fmtNum(r.value))} ${esc(r.unit)}</strong>`).join(" · ");
      const data = it.occurred_at ? new Date(it.occurred_at).toLocaleString("pt-BR") : "";
      return `<div class="hist-item">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px">${esc(it.titulo)}</div>
          <div style="font-size:12px;color:var(--text-3);margin:2px 0">${data}</div>
          ${ins ? `<div style="font-size:12.5px;color:var(--text-2)">${ins}</div>` : ""}
          ${res ? `<div style="font-size:12.5px;margin-top:3px">${res}</div>` : ""}
        </div>
        <button class="btn" data-hist-i="${i}" style="align-self:center;white-space:nowrap"><i class="ti ti-arrow-back-up"></i>Carregar</button>
      </div>`;
    }).join("") : `<p class="page-sub" style="text-align:center;padding:18px 0">Nenhum cálculo salvo ainda. Faça um cálculo e clique em "Salvar no histórico".</p>`;
    ov.innerHTML = `<div class="card cb-modal-box">
      <h3 style="margin-bottom:4px">Histórico de cálculos</h3>
      <p class="page-sub" style="margin-bottom:12px">Seus últimos cálculos salvos (até 20).</p>
      <div class="hist-list">${linhas}</div>
      <div style="text-align:right;margin-top:12px"><button class="btn" id="cb-hist-close">Fechar</button></div>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelector("#cb-hist-close").onclick = () => ov.remove();
    ov.querySelectorAll("[data-hist-i]").forEach(b => b.addEventListener("click", () => {
      const it = itens[+b.dataset.histI];
      this.carregar(it.ref, it.inputs);
    }));
  }
};

// ---------- Normas ----------
// Órgão emissor: entradas sem "orgao" são ABNT. Pílula colorida + nota de "onde obter" por órgão.
const orgaoDe = n => n.orgao || "ABNT";
const ORGAO_PILL = { "ABNT": "pill-blue", "DNIT": "pill-teal", "CONAMA": "pill-amber", "MTP (NR)": "pill-red", "DER": "pill-coral" };
const orgaoPill = o => ORGAO_PILL[o] || "pill-gray";
const NORMA_FONTE = {
  "ABNT": "O texto integral deve ser obtido junto à ABNT (norma paga).",
  "DNIT": "Norma pública — texto integral no site do DNIT (Instituto de Pesquisas Rodoviárias).",
  "CONAMA": "Resolução pública — texto integral no site do CONAMA / Ministério do Meio Ambiente.",
  "MTP (NR)": "Norma Regulamentadora pública — texto integral no gov.br (MTE/MTP).",
  "DER": "Especificação estadual — consulte o texto no portal do DER do estado."
};

function renderNormas(codigo) {
  if (codigo) {
    const n = NORMAS.find(x => x.codigo === codigo);
    if (n) return renderNormaDetail(n);
  }
  const orgaos = [...new Set(NORMAS.map(orgaoDe))].sort();
  app.innerHTML = `
    <h2 class="page-title">Normas técnicas</h2>
    <p class="page-sub">Pontos-chave para consulta rápida — ABNT e demais órgãos (DNIT, CONAMA, DER, NR). Não substitui o texto integral; obtenha-o junto ao órgão emissor.</p>
    <div class="filter-bar">
      <input type="text" id="norm-filter" placeholder="Filtrar por código, título ou área…" aria-label="Filtrar normas por código, título ou área">
      <select id="norm-orgao" class="sinapi-uf" data-cbselect aria-label="Órgão emissor" title="Filtrar por órgão emissor">
        <option value="">Todos os órgãos</option>
        ${orgaos.map(o => `<option value="${o}">${o}</option>`).join("")}
      </select>
    </div>
    <p class="page-sub" style="margin:0 0 12px"><strong id="norm-count">${NORMAS.length}</strong> normas · ${orgaos.length} órgãos emissores</p>
    <div id="norm-list"></div>`;
  const draw = () => {
    const f = (document.getElementById("norm-filter").value || "").toLowerCase();
    const og = document.getElementById("norm-orgao").value;
    const list = NORMAS.filter(n => {
      const org = orgaoDe(n);
      if (og && org !== og) return false;
      return (n.codigo + " " + n.titulo + " " + n.area + " " + org).toLowerCase().includes(f);
    });
    document.getElementById("norm-count").textContent = list.length;
    document.getElementById("norm-list").innerHTML = list.map(n => {
      const org = orgaoDe(n);
      return `
      <div class="list-item" onclick="navigate('normas','${n.codigo}')">
        <div>
          <div class="li-code">${n.codigo} <span class="pill ${orgaoPill(org)}">${org}</span></div>
          <div class="li-title">${n.titulo}</div>
        </div>
        <div class="li-meta">${n.area}${n.ano ? " · " + n.ano : ""} <i class="ti ti-chevron-right"></i></div>
      </div>`;
    }).join("") || `<p class="page-sub">Nenhuma norma encontrada.</p>`;
  };
  document.getElementById("norm-filter").addEventListener("input", draw);
  document.getElementById("norm-orgao").addEventListener("change", draw);
  draw();
}

function renderNormaDetail(n) {
  const org = orgaoDe(n);
  app.innerHTML = `
    <button class="back-link" onclick="navigate('normas')"><i class="ti ti-arrow-left"></i>Todas as normas</button>
    <div class="detail-header">
      <h2>${n.codigo} <span class="pill ${orgaoPill(org)}" style="vertical-align:middle;font-size:12px">${org}</span></h2>
      <div class="sub">${n.titulo} · ${n.area}${n.ano ? " · " + n.ano : ""}</div>
    </div>
    <div class="card">
      <h3 style="margin-bottom:12px">Pontos-chave</h3>
      ${n.resumo.map(r => `<div class="check-item"><i class="ti ti-point ci-icon" style="color:var(--blue)"></i><span>${r}</span></div>`).join("")}
    </div>
    <p class="page-sub" style="margin-top:14px"><i class="ti ti-alert-triangle"></i> Resumo orientativo — não substitui o texto integral. ${NORMA_FONTE[org] || ""}</p>`;
}

// ---------- SINAPI e CUB ----------
async function renderSinapiTabela(q0) {
  // A base SINAPI (~1,7 MB) é carregada sob demanda — mostra estado de carregamento enquanto baixa.
  const pane0 = document.getElementById("sinapi-pane");
  if (typeof SINAPI === "undefined") {
    if (pane0) pane0.innerHTML = `<p class="page-sub" style="padding:20px 2px"><i class="ti ti-loader-2"></i> Carregando base SINAPI (10 mil composições)…</p>`;
    try { await ensureSinapiData(); }
    catch { if (pane0) pane0.innerHTML = `<p class="page-sub" style="padding:20px 2px">Não foi possível carregar a base SINAPI agora. Verifique a conexão e tente novamente.</p>`; return; }
  }
  const cats = (typeof SINAPI_CATEGORIAS !== "undefined" ? SINAPI_CATEGORIAS.slice().sort() : [...new Set(SINAPI.map(s => s.categoria))].sort());
  let ROW_H = 76;     // altura de linha (px) — calibrada pela altura real no 1º render
  let calibrado = false;
  const BUFFER = 8;   // linhas extras renderizadas acima/abaixo da viewport
  // SINAPIDB serve a base estática (PR) imediatamente e, após ready(), a UF dinâmica do banco.
  function ufOptions() {
    const ativa = SINAPIDB.meta().uf;
    return SINAPIDB.ufs().map(u =>
      `<option value="${esc(u.uf)}"${u.uf === ativa ? " selected" : ""}>${esc(u.uf)}</option>`).join("");
  }
  let lista = SINAPIDB.lista();
  let filtered = lista;
  // A base (~1,7 MB) é assíncrona: se o usuário trocou de módulo durante o await, o #sinapi-pane
  // já não existe — aborta o render tardio (evita "Cannot set properties of null").
  const pane = document.getElementById("sinapi-pane");
  if (!pane) return;
  pane.innerHTML = `
    <p class="page-sub" id="sinapi-fonte">${esc(SINAPIDB.meta().fonte)}.</p>
    <details class="sinapi-howto">
      <summary><i class="ti ti-info-circle"></i> Como funciona a SINAPI</summary>
      <ul>${SINAPI_PROCESSO.map(p => `<li>${p}</li>`).join("")}</ul>
      <p class="howto-src">Resumo com base no livro “SINAPI — Metodologias e Conceitos” (Caixa). Planilhas oficiais: caixa.gov.br → Downloads → SINAPI.</p>
    </details>
    <div class="filter-bar">
      <input type="text" id="sinapi-filter" placeholder="Buscar por código ou descrição…" aria-label="Buscar composição SINAPI por código ou descrição">
      <select id="sinapi-uf" class="sinapi-uf" data-cbselect aria-label="Estado (UF) da tabela de preços" title="Estado (UF) da tabela de preços">
        ${ufOptions()}
      </select>
      <select id="sinapi-regime" class="sinapi-uf" data-cbselect aria-label="Regime de encargos (desoneração)" title="Regime de encargos (desoneração)">
        <option value="SD">Sem desoneração</option>
        <option value="CD">Com desoneração</option>
      </select>
      <select id="sinapi-cat" data-cbselect>
        <option value="">Todas as categorias</option>
        ${cats.map(c => `<option value="${c}">${c}</option>`).join("")}
      </select>
    </div>
    <p class="page-sub" style="margin:0 0 12px"><strong id="sinapi-count">${lista.length.toLocaleString("pt-BR")}</strong> composições · ${cats.length} categorias · role a tabela para percorrer</p>
    <div id="sinapi-scroll" class="sinapi-scroll">
      <table class="data sinapi-vtable">
        <thead><tr><th class="sv-cod">Código</th><th>Descrição</th><th class="sv-un">Un.</th><th id="sinapi-precoh" class="sv-preco" style="text-align:right">Preço ${esc(SINAPIDB.meta().uf)}</th></tr></thead>
        <tbody id="sinapi-body"></tbody>
      </table>
    </div>`;

  const scroller = document.getElementById("sinapi-scroll");
  const body = document.getElementById("sinapi-body");

  // Filtro: reaproveita o índice normalizado pré-computado (compartilhado com a busca global).
  const filtrar = () => {
    const f = normalizar(document.getElementById("sinapi-filter").value.trim());
    const cat = document.getElementById("sinapi-cat").value;
    if (!f && !cat) return lista;
    if (!_sinapiNorm) _sinapiNorm = SINAPI.map(s => normalizar(s.codigo + " " + s.descricao));
    const out = [];
    for (let i = 0; i < lista.length; i++) {
      const s = lista[i];   // mesmo comprimento/ordem de SINAPI → _sinapiNorm[i] alinhado
      if (cat && s.categoria !== cat) continue;
      if (f && !_sinapiNorm[i].includes(f)) continue;
      out.push(s);
    }
    return out;
  };

  const rowHTML = s => `<tr class="sinapi-vrow" data-cod="${esc(s.codigo)}" tabindex="0" role="button" aria-label="Ver composição de custo de ${esc(s.codigo)}">
      <td class="code">${esc(s.codigo)}</td>
      <td class="sinapi-desc-td"><div class="sinapi-cell"><div class="sinapi-desc" title="${esc(s.descricao)}">${esc(s.descricao)}</div><div class="sinapi-grp">${esc(s.grupo || s.categoria)}</div></div></td>
      <td class="sv-un">${esc(s.unidade)}</td>
      <td class="price" style="text-align:right">${s.preco == null ? '<span style="color:var(--text-3)">—</span>' : brl(s.preco)}<i class="ti ti-chevron-right sinapi-go" aria-hidden="true"></i><span class="sinapi-un-m" aria-hidden="true">por ${esc(s.unidade)}</span></td>
    </tr>`;

  // Renderiza só a janela visível (start..end) + 2 linhas-espaçadoras que ocupam o resto.
  const drawWindow = () => {
    const total = filtered.length;
    if (!total) { body.innerHTML = `<tr><td colspan="4" style="color:var(--text-3);padding:18px 14px">Nenhuma composição encontrada.</td></tr>`; return; }
    const scrollTop = scroller.scrollTop, viewH = scroller.clientHeight || 480;
    const start = Math.max(0, Math.floor(scrollTop / ROW_H) - BUFFER);
    const end = Math.min(total, Math.ceil((scrollTop + viewH) / ROW_H) + BUFFER);
    let html = start ? `<tr class="sinapi-spacer" style="height:${start * ROW_H}px"><td colspan="4"></td></tr>` : "";
    for (let i = start; i < end; i++) html += rowHTML(filtered[i]);
    if (end < total) html += `<tr class="sinapi-spacer" style="height:${(total - end) * ROW_H}px"><td colspan="4"></td></tr>`;
    body.innerHTML = html;
  };

  const refiltrar = () => {
    filtered = filtrar();
    document.getElementById("sinapi-count").textContent = filtered.length.toLocaleString("pt-BR");
    scroller.scrollTop = 0;
    drawWindow();
    if (!calibrado) {   // calibra ROW_H pela altura real de uma linha e recalcula a janela
      const r = body.querySelector("tr.sinapi-vrow");
      if (r) {
        calibrado = true;
        const h = r.getBoundingClientRect().height;
        if (h > 0 && Math.abs(h - ROW_H) > 0.5) { ROW_H = h; drawWindow(); }
      }
    }
  };

  // Scroll com throttle por requestAnimationFrame (mantém a janela em sincronia sem travar).
  let ticking = false;
  scroller.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { drawWindow(); ticking = false; });
  });
  // Aplica a UF ativa do SINAPIDB ao DOM (lista de preços, fonte e cabeçalho da coluna).
  const aplicarMeta = () => {
    lista = SINAPIDB.lista();
    const m = SINAPIDB.meta();
    const fe = document.getElementById("sinapi-fonte");
    if (fe) fe.textContent = m.fonte + ".";
    const ph = document.getElementById("sinapi-precoh");
    if (ph) ph.textContent = "Preço " + m.uf;
  };
  const montarSeletorUF = () => {
    const sel = document.getElementById("sinapi-uf");
    if (sel) sel.innerHTML = ufOptions();   // reflete o estado real (pode ter caído p/ fallback)
  };
  // Regime de encargos (desoneração): só dinâmico tem CD; na base estática fica SD travado.
  const aplicarRegimeUI = () => {
    const sr = document.getElementById("sinapi-regime");
    if (!sr) return;
    sr.value = SINAPIDB.regime();
    sr.disabled = !SINAPIDB.meta().dinamico;
    sr.title = SINAPIDB.meta().dinamico
      ? "Regime de encargos (desoneração)"
      : "Alternar desoneração fica disponível com a base online da SINAPI";
  };
  const trocarUF = async (uf) => {
    const sel = document.getElementById("sinapi-uf");
    if (sel) sel.disabled = true;
    await SINAPIDB.setUF(uf);
    aplicarMeta();
    montarSeletorUF();
    aplicarRegimeUI();
    if (sel) sel.disabled = false;
    refiltrar();
  };
  const trocarRegime = async (regime) => {
    const sr = document.getElementById("sinapi-regime");
    if (sr) sr.disabled = true;
    await SINAPIDB.setRegime(regime);
    aplicarMeta();
    aplicarRegimeUI();
    refiltrar();
  };

  document.getElementById("sinapi-uf").addEventListener("change", e => trocarUF(e.target.value));
  document.getElementById("sinapi-regime").addEventListener("change", e => trocarRegime(e.target.value));
  document.getElementById("sinapi-filter").addEventListener("input", refiltrar);
  document.getElementById("sinapi-cat").addEventListener("change", refiltrar);
  // Clique/Enter numa linha abre o detalhamento de custo (material × mão de obra) da composição.
  const abrirDaLinha = el => { const tr = el.closest && el.closest("tr.sinapi-vrow"); if (tr && tr.dataset.cod) abrirComposicao(tr.dataset.cod); };
  body.addEventListener("click", e => abrirDaLinha(e.target));
  body.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrirDaLinha(e.target); } });
  if (q0) document.getElementById("sinapi-filter").value = q0;
  aplicarRegimeUI();
  refiltrar();

  // Progressive enhancement: quando o backend responde, repovoa o seletor com as UFs do banco
  // e aplica a UF/regime salvos (dinâmica). Sem backend, permanece na base estática (PR).
  SINAPIDB.ready().then(() => {
    if (!document.getElementById("sinapi-pane")) return;   // trocou de módulo enquanto o backend respondia
    montarSeletorUF(); aplicarMeta(); aplicarRegimeUI(); refiltrar();
  }).catch(() => {});
}

// Wrapper com abas SINAPI | CUB/m² (mesma "aba" de navegação). q0 com prefixo "cub:" abre
// direto a aba CUB (opcionalmente filtrada por código de projeto); senão abre a SINAPI.
function renderSinapi(q0) {
  const goCub = typeof q0 === "string" && q0.indexOf("cub:") === 0;
  const goOrc = typeof q0 === "string" && q0.indexOf("orc:") === 0;
  const goPar = typeof q0 === "string" && q0.indexOf("par:") === 0;
  const goChg = typeof q0 === "string" && q0.indexOf("chg:") === 0;
  const cubQ = goCub ? q0.slice(4) : "";
  const sinQ = (goCub || goOrc || goPar || goChg) ? "" : (q0 || "");
  app.innerHTML = `
    <h2 class="page-title">SINAPI e CUB — custos de referência</h2>
    <div class="tabs-bar sc-tabs" id="sc-tabs" role="tablist">
      <button data-sc="sinapi" class="active" role="tab"><i class="ti ti-receipt"></i> SINAPI<span class="sc-tab-sub">composições de serviço</span></button>
      <button data-sc="cub" role="tab"><i class="ti ti-ruler-2"></i> CUB/m²<span class="sc-tab-sub">custo por m² de obra</span></button>
      <button data-sc="orcamento" role="tab"><i class="ti ti-file-invoice"></i> Orçamento<span class="sc-tab-sub">orçamento da obra</span></button>
      <button data-sc="parametrico" role="tab"><i class="ti ti-wand"></i> Paramétrico<span class="sc-tab-sub">estimativa por área</span></button>
      <button data-sc="mudancas" role="tab"><i class="ti ti-git-compare"></i> Mudanças<span class="sc-tab-sub">changelog por competência</span></button>
    </div>
    <div id="sinapi-pane"></div>
    <div id="cub-pane" hidden></div>
    <div id="orcamento-pane" hidden></div>
    <div id="parametrico-pane" hidden></div>
    <div id="changelog-pane" hidden></div>`;
  renderSinapiTabela(sinQ);   // pane visível → o virtual-scroll da SINAPI calibra a altura certa
  let cubLoaded = false, orcLoaded = false, parLoaded = false, chgLoaded = false;
  const ativar = (sc) => {
    document.querySelectorAll("#sc-tabs button").forEach(b => b.classList.toggle("active", b.dataset.sc === sc));
    document.getElementById("sinapi-pane").hidden = sc !== "sinapi";
    document.getElementById("cub-pane").hidden = sc !== "cub";
    document.getElementById("orcamento-pane").hidden = sc !== "orcamento";
    document.getElementById("parametrico-pane").hidden = sc !== "parametrico";
    document.getElementById("changelog-pane").hidden = sc !== "mudancas";
    if (sc === "cub" && !cubLoaded) { renderCub(cubQ); cubLoaded = true; }
    if (sc === "orcamento" && !orcLoaded) { orcLoaded = true; if (typeof renderOrcamento === "function") renderOrcamento(document.getElementById("orcamento-pane")); }
    if (sc === "parametrico" && !parLoaded) { parLoaded = true; if (typeof renderParametrico === "function") renderParametrico(document.getElementById("parametrico-pane")); }
    if (sc === "mudancas" && !chgLoaded) { chgLoaded = true; if (typeof renderSinapiChangelog === "function") renderSinapiChangelog(document.getElementById("changelog-pane")); }
  };
  document.querySelectorAll("#sc-tabs button").forEach(b => b.addEventListener("click", () => ativar(b.dataset.sc)));
  if (goCub) ativar("cub");
  else if (goOrc) ativar("orcamento");
  else if (goPar) ativar("parametrico");
  else if (goChg) ativar("mudancas");
}

// CUB/m² — tabela de custo por m² por estado + estimador rápido (área × CUB). Offline-first
// via CUBDB (base estática PR; sobrepõe a UF do banco quando disponível).
function renderCub(q0) {
  const pane = document.getElementById("cub-pane");
  if (!pane) return;
  const projetos = (typeof CUB_PROJETOS !== "undefined") ? CUB_PROJETOS : [];
  let keepEst = null;   // preserva área/projeto/padrão do estimador entre redesenhos (troca de UF)

  let mapa = {};
  const recarregarMapa = () => { mapa = {}; CUBDB.valores().forEach(v => { mapa[v.projeto + "|" + v.padrao] = v.valor; }); };
  const val = (cod, pad) => (mapa[cod + "|" + pad] != null ? mapa[cod + "|" + pad] : null);

  const ufOptions = () => {
    const ativa = CUBDB.meta().uf;
    return CUBDB.ufs().map(u => `<option value="${esc(u.uf)}"${u.uf === ativa ? " selected" : ""}>${esc(u.uf)}</option>`).join("");
  };

  const tabelaGrupo = (grupo) => {
    const ps = projetos.filter(p => p.grupo === grupo);
    if (!ps.length) return "";
    const unico = ps.every(p => p.unico);
    const cols = unico ? ["único"] : CUB_PADROES;
    const head = unico
      ? `<th>Projeto-padrão</th><th style="text-align:right">R$/m²</th>`
      : `<th>Projeto-padrão</th>${cols.map(c => `<th style="text-align:right">${CUB_PADRAO_LABEL[c]}</th>`).join("")}`;
    const rows = ps.map(p => {
      const tds = cols.map(c => {
        const v = val(p.codigo, c);
        return `<td class="price" style="text-align:right">${v == null ? '<span style="color:var(--text-3)">—</span>' : brl(v)}</td>`;
      }).join("");
      return `<tr><td><strong class="code">${esc(p.codigo)}</strong><div class="cub-desc">${esc(p.desc)}</div></td>${tds}</tr>`;
    }).join("");
    // .tbl-scroll: a tabela de 4 colunas (393 px) rola no próprio contêiner em vez de alargar a página no celular.
    return `<div class="cub-grp-title">${esc(grupo)}</div>
      <div class="tbl-scroll"><table class="data cub-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  };

  function padraoOptions(cod) {
    const p = projetos.find(x => x.codigo === cod);
    const cols = (p && p.unico) ? ["único"] : CUB_PADROES;
    return cols.filter(c => val(cod, c) != null).map(c => `<option value="${c}">${CUB_PADRAO_LABEL[c]}</option>`).join("");
  }
  function calcular() {
    const cod = document.getElementById("cub-proj").value;
    const pad = document.getElementById("cub-pad").value;
    const area = parseFloat(document.getElementById("cub-area").value);
    const v = val(cod, pad);
    document.getElementById("cub-est-unit").textContent = v == null ? "—" : brl(v) + "/m²";
    const out = document.getElementById("cub-est-total");
    out.textContent = (v == null || !isFinite(area) || area <= 0) ? "—" : brl(v * area);
  }

  const wire = () => {
    const selUF = document.getElementById("cub-uf");
    if (selUF) selUF.addEventListener("change", async (e) => {
      selUF.disabled = true;
      keepEst = { area: document.getElementById("cub-area").value, proj: document.getElementById("cub-proj").value, pad: document.getElementById("cub-pad").value };
      await CUBDB.setUF(e.target.value);
      recarregarMapa();
      draw();
    });
    const proj = document.getElementById("cub-proj"), pad = document.getElementById("cub-pad"), area = document.getElementById("cub-area");
    if (proj && pad && area) {
      const repop = () => { pad.innerHTML = padraoOptions(proj.value); };
      proj.addEventListener("change", () => { repop(); calcular(); });
      pad.addEventListener("change", calcular);
      area.addEventListener("input", calcular);
      if (keepEst) {                                   // restaura seleção após troca de UF
        if (keepEst.area) area.value = keepEst.area;
        if (keepEst.proj) proj.value = keepEst.proj;
        repop();
        if (keepEst.pad && padraoOptions(proj.value).indexOf(`value="${keepEst.pad}"`) >= 0) pad.value = keepEst.pad;
        keepEst = null;
      } else {                                         // 1ª vez: pré-seleciona o projeto da busca
        const alvo = q0 && projetos.find(p => p.codigo.toLowerCase() === String(q0).toLowerCase());
        if (alvo) proj.value = alvo.codigo;
        repop();
      }
      calcular();
    }
  };

  const draw = () => {
    const m = CUBDB.meta();
    pane.innerHTML = `
      <p class="page-sub" id="cub-fonte">${esc(m.fonte)}.</p>
      <details class="sinapi-howto">
        <summary><i class="ti ti-info-circle"></i> Como funciona o CUB/m²</summary>
        <ul>${CUB_PROCESSO.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
        <p class="howto-src">Índice publicado mensalmente pelos Sinduscons (cub.org.br / CBIC), conforme ABNT NBR 12.721:2006.</p>
      </details>
      <div class="filter-bar">
        <label for="cub-uf" class="cub-uf-label">Estado (UF)</label>
        <select id="cub-uf" class="sinapi-uf" data-cbselect aria-label="Estado (UF) do CUB" title="Estado (UF) do CUB">${ufOptions()}</select>
      </div>
      <div class="card cub-estimador">
        <h3 class="cub-est-title"><i class="ti ti-calculator"></i> Estimativa rápida de custo</h3>
        <p class="page-sub" style="margin:0 0 12px">Custo aproximado de construção = área equivalente × CUB do projeto-padrão escolhido.</p>
        <div class="cub-est-grid">
          <div><label for="cub-area">Área (m²)</label><input type="number" id="cub-area" min="0" step="0.01" placeholder="ex.: 120" inputmode="decimal"></div>
          <div><label for="cub-proj">Projeto-padrão</label><select id="cub-proj">${projetos.map(p => `<option value="${esc(p.codigo)}">${esc(p.nome)}</option>`).join("")}</select></div>
          <div><label for="cub-pad">Padrão</label><select id="cub-pad"></select></div>
        </div>
        <div class="cub-est-out">
          <div><span class="cub-est-lbl">CUB unitário</span><span id="cub-est-unit" class="cub-est-unit">—</span></div>
          <div><span class="cub-est-lbl">Custo estimado</span><span id="cub-est-total" class="cub-est-total">—</span></div>
        </div>
        <p class="cub-aviso"><i class="ti ti-alert-triangle"></i> Estimativa parcial. O CUB <strong>não inclui</strong>: ${CUB_EXCLUSOES.map(e => esc(e)).join("; ")}.</p>
      </div>
      ${CUB_GRUPOS.map(g => tabelaGrupo(g)).join("")}
      <p class="page-sub" style="margin-top:14px">Os valores não substituem orçamento detalhado por responsável técnico. Para custo por serviço, use a aba <strong>SINAPI</strong>.</p>`;
    wire();
  };

  recarregarMapa();
  draw();
  // Progressive enhancement: backend respondeu → repovoa UFs/valores e aplica a UF salva.
  CUBDB.ready().then(() => {
    const a = document.getElementById("cub-area");
    if (a) keepEst = { area: a.value, proj: document.getElementById("cub-proj").value, pad: document.getElementById("cub-pad").value };
    recarregarMapa();
    draw();
  }).catch(() => {});
}

// Detalhamento de custo de uma composição SINAPI (material × mão de obra × equipamento,
// discriminado por insumo) num modal. Calcula via SINAPIDB.composicao (modo dinâmico).
async function abrirComposicao(codigo) {
  const s = (SINAPIDB.lista() || SINAPI).find(x => x.codigo === codigo) || { codigo, descricao: "", unidade: "", preco: null };
  const m = SINAPIDB.meta();
  const regLabel = m.regime === "CD" ? "Com desoneração" : m.regime === "SE" ? "Sem encargos sociais" : "Sem desoneração";
  document.querySelectorAll(".cb-modal-ov").forEach(e => e.remove());
  const ov = document.createElement("div");
  ov.className = "cb-modal-ov";
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  ov.innerHTML = `<div class="card cb-modal-box" role="dialog" aria-modal="true" style="max-width:780px">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
      <div style="min-width:0">
        <div style="font-size:12px;color:var(--text-3)">Composição SINAPI · ${esc(m.uf)} · ${esc(SINAPIDB.fmtCompet(m.competencia))} · ${regLabel}</div>
        <h3 style="margin:3px 0 0"><span class="code">${esc(codigo)}</span> <span style="font-size:12px;color:var(--text-3);font-weight:400">/ ${esc(s.unidade || "")}</span></h3>
        <p style="margin:6px 0 0;font-size:13.5px;line-height:1.45">${esc(s.descricao)}</p>
      </div>
      <button class="btn icon-only" aria-label="Fechar" onclick="this.closest('.cb-modal-ov').remove()"><i class="ti ti-x"></i></button>
    </div>
    <div id="sinapi-comp-body" style="margin-top:14px"><p class="page-sub">Carregando composição…</p></div>
  </div>`;
  document.body.appendChild(ov);
  const bodyEl = ov.querySelector("#sinapi-comp-body");
  let dados;
  try { dados = await SINAPIDB.composicao(codigo); }
  catch (err) { bodyEl.innerHTML = `<p class="page-sub">Não foi possível carregar a composição agora. Tente novamente.</p>`; return; }
  if (!dados || !dados.disponivel) {
    bodyEl.innerHTML = `<p class="page-sub">O detalhamento de custo (material × mão de obra, por insumo) fica disponível com a base online da SINAPI.${s.preco != null ? ` Preço sintético desta composição: <strong>${brl(s.preco)}</strong>/${esc(s.unidade)}.` : ""}</p>`;
    return;
  }
  if (dados.vazio) {
    bodyEl.innerHTML = `<p class="page-sub">Esta competência não traz detalhamento analítico publicado para este item.${s.preco != null ? ` Preço sintético: <strong>${brl(s.preco)}</strong>/${esc(s.unidade)}.` : ""}</p>`;
    return;
  }
  const ORDER = ["Material", "Mão de obra", "Equipamento", "Serviços", "Composições auxiliares", "Outros"];
  const COR = { "Material": "var(--blue)", "Mão de obra": "var(--amber)", "Equipamento": "var(--teal)", "Serviços": "#7c3aed", "Composições auxiliares": "var(--text-2)", "Outros": "var(--text-3)" };
  const grupos = {};
  let somaPreco = 0, temSemPreco = false;
  dados.itens.forEach(it => {
    const g = grupos[it.grupo] = grupos[it.grupo] || { custo: 0, itens: [] };
    g.itens.push(it);
    if (it.custo != null) { g.custo += it.custo; somaPreco += it.custo; }
    if (it.semPreco) temSemPreco = true;
  });
  const publicado = s.preco;
  const base = (publicado != null && publicado > 0) ? publicado : somaPreco;
  const pct = v => base > 0 ? Math.round(v / base * 100) : 0;
  const dot = c => `<span class="sinapi-dot" style="background:${c}"></span>`;
  const resumo = ORDER.filter(g => grupos[g]).map(g =>
    `<div class="sinapi-resumo-row">${dot(COR[g])}<span style="flex:1">${g}</span><strong>${brl(grupos[g].custo)}</strong><span class="sinapi-pct">${pct(grupos[g].custo)}%</span></div>`).join("");
  const residuo = publicado != null ? +(publicado - somaPreco).toFixed(2) : 0;
  const residuoRow = (publicado != null && Math.abs(residuo) >= 0.01)
    ? `<div class="sinapi-resumo-row">${dot("var(--border)")}<span style="flex:1">Itens sem preço na UF / arredondamento</span><strong>${brl(residuo)}</strong><span class="sinapi-pct">${pct(residuo)}%</span></div>` : "";
  const totalRow = `<div class="sinapi-resumo-row sinapi-resumo-total"><span style="flex:1">${publicado != null ? "Preço sintético (oficial)" : "Soma dos itens"}</span><strong>${brl(publicado != null ? publicado : somaPreco)}</strong><span class="sinapi-pct">100%</span></div>`;
  const fmtCoef = c => Number(c).toLocaleString("pt-BR", { maximumFractionDigits: 7 });
  const tabelas = ORDER.filter(g => grupos[g]).map(g => `
    <div class="sinapi-grp-block">
      <div class="sinapi-grp-head">${dot(COR[g])}<span>${g}</span><span style="margin-left:auto">${brl(grupos[g].custo)}</span></div>
      <div class="sinapi-comp-scroll"><table class="data sinapi-comp-table">
        <thead><tr><th style="width:72px">Código</th><th>Insumo / item</th><th style="width:38px">Un.</th><th style="width:84px;text-align:right">Coef.</th><th style="width:90px;text-align:right">Preço</th><th style="width:92px;text-align:right">Custo</th></tr></thead>
        <tbody>${grupos[g].itens.map(it => `<tr>
          <td class="code">${esc(it.codigo)}</td>
          <td title="${esc(it.descricao)}">${esc(it.descricao)}</td>
          <td>${esc(it.unidade || "")}</td>
          <td style="text-align:right">${fmtCoef(it.coeficiente)}</td>
          <td style="text-align:right">${it.preco == null ? '<span style="color:var(--text-3)">—</span>' : brl(it.preco)}</td>
          <td class="price" style="text-align:right">${it.custo == null ? '<span style="color:var(--text-3)">—</span>' : brl(it.custo)}</td>
        </tr>`).join("")}</tbody></table></div>
    </div>`).join("");
  bodyEl.innerHTML = `
    <div class="sinapi-comp-headline">
      <span class="cub-est-lbl">Preço sintético (${esc(m.uf)}, ${regLabel.toLowerCase()})</span>
      <span class="sinapi-comp-total">${publicado == null ? "—" : brl(publicado)}</span>
      <span style="font-size:12px;color:var(--text-3)">por ${esc(s.unidade || "un")}</span>
    </div>
    <div class="sinapi-resumo">${resumo}${residuoRow}${totalRow}</div>
    ${temSemPreco ? `<p class="sinapi-comp-note"><i class="ti ti-info-circle"></i> Alguns insumos não têm preço coletado nesta UF — a SINAPI completa o custo com preços de referência (representatividade/%AS), por isso a soma dos itens pode ficar abaixo do preço sintético.</p>` : ""}
    ${tabelas}
    <p class="sinapi-comp-note">Custo direto, sem BDI. "Mão de obra" inclui as composições auxiliares "com encargos complementares". Sempre confira a competência/UF do seu orçamento.</p>`;
}

// ---------- Materiais ----------
function renderMateriais(nome) {
  if (nome) {
    const m = MATERIAIS.find(x => x.nome === nome);
    if (m) return renderMaterialDetail(m);
  }
  const cats = [...new Set(MATERIAIS.map(m => m.categoria))];
  app.innerHTML = `
    <h2 class="page-title">Materiais</h2>
    <p class="page-sub">Fichas técnicas com propriedades de projeto.</p>
    ${cats.map(cat => `
      <div class="group-label" style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin:18px 0 10px">${cat}</div>
      <div class="grid grid-3">
        ${MATERIAIS.filter(m => m.categoria === cat).map(m => `
          <div class="card clickable" onclick="navigate('materiais','${esc(m.nome)}')">
            <div class="card-icon" style="background:var(--purple-light);color:var(--purple)"><i class="ti ${m.icone}"></i></div>
            <h3 style="font-size:15px">${m.nome}</h3>
            <p>${Object.entries(m.specs).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
          </div>`).join("")}
      </div>`).join("")}`;
}

function renderMaterialDetail(m) {
  app.innerHTML = `
    <button class="back-link" onclick="navigate('materiais')"><i class="ti ti-arrow-left"></i>Todos os materiais</button>
    <div class="detail-header">
      <h2>${m.nome}</h2>
      <div class="sub">${m.categoria}</div>
    </div>
    <div class="card" style="max-width:560px">
      <table class="spec-table">
        ${Object.entries(m.specs).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}
      </table>
    </div>
    <div class="card" style="max-width:560px;margin-top:16px">
      <h3 style="margin-bottom:4px"><i class="ti ti-quote"></i> Referências / fontes (ABNT)</h3>
      <p class="page-sub" style="margin:0 0 12px">Cite por DOI (via CrossRef) as normas e artigos que embasam esta ficha técnica.</p>
      <div id="ref-tool"></div>
    </div>`;
  if (window.REF) REF.montar("ref-tool", { key: "mat-" + (m.nome || "").replace(/\W+/g, "-").toLowerCase() });
}

// ---------- Checklists ----------
async function renderChecklists(id) {
  if (!CK._loaded) { app.innerHTML = CBStore.loadingCard("Carregando checklists…"); await CK.ready(); }
  if (id) {
    const c = CHECKLISTS.find(x => x.id === id);
    if (c) return renderChecklistDetail(c);
  }
  app.innerHTML = `
    <h2 class="page-title">Checklists de obra</h2>
    <p class="page-sub">Marque os itens durante a inspeção. O progresso fica salvo na sua conta.</p>
    <div class="grid grid-2">
      ${CHECKLISTS.map(c => {
        const saved = getCheckState(c.id);
        const done = c.itens.filter((_, i) => saved[i]).length;
        return `<div class="card clickable" onclick="navigate('checklists','${c.id}')">
          <div class="card-icon" style="background:var(--teal-light);color:var(--teal)"><i class="ti ${c.icone}"></i></div>
          <h3>${c.titulo}</h3>
          <p>${c.normas} · ${done}/${c.itens.length} itens</p>
        </div>`;
      }).join("")}
    </div>`;
}

// Estado dos checklists — cache em memória, sincronizado com o Supabase (tabela
// checklist_estado) quando logado, ou localStorage (chaves ck-<id>) no modo local.
const CK = {
  _cache: null, _loaded: false,
  TABLE: "checklist_estado",
  CONFLICT: "user_id,checklist_id",
  async load() {
    const { data, error } = await CBStore.select(this.TABLE, "checklist_id,estado");
    if (!error && data) {
      const c = {};
      data.forEach(r => { c[r.checklist_id] = r.estado || {}; });
      // Migração única dos ck-* locais, se o banco ainda não tem nada do usuário.
      if (!Object.keys(c).length) {
        for (const cl of CHECKLISTS) {
          const loc = CBStore.lsGet("ck-" + cl.id, null);
          if (loc && Object.keys(loc).length) {
            CBStore.upsert(this.TABLE, { user_id: CBStore.uid(), checklist_id: cl.id, estado: loc }, this.CONFLICT);
            c[cl.id] = loc;
          }
        }
      }
      this._cache = c; this._loaded = true; return;
    }
    // Offline / erro de rede: usa o espelho em localStorage.
    const c = {};
    CHECKLISTS.forEach(cl => { const v = CBStore.lsGet("ck-" + cl.id, null); if (v) c[cl.id] = v; });
    this._cache = c; this._loaded = true;
  },
  async ready() { if (!this._loaded) await this.load(); return this._loaded; },
  get(id) { return (this._cache && this._cache[id]) || {}; },
  set(id, estado) {
    if (!this._cache) this._cache = {};
    this._cache[id] = estado;
    CBStore.lsSet("ck-" + id, estado);
    CBStore.upsert(this.TABLE, { user_id: CBStore.uid(), checklist_id: id, estado }, this.CONFLICT); // otimista
  },
  reset(id) {
    if (this._cache) delete this._cache[id];
    try { localStorage.removeItem("ck-" + id); } catch (e) {}
    CBStore.remove(this.TABLE, { user_id: CBStore.uid(), checklist_id: id });
  }
};

function getCheckState(id) { return CK.get(id); }

function renderChecklistDetail(c) {
  const state = getCheckState(c.id);
  app.innerHTML = `
    <button class="back-link no-print" onclick="navigate('checklists')"><i class="ti ti-arrow-left"></i>Todos os checklists</button>
    <div class="detail-header">
      <h2>${c.titulo}</h2>
      <div class="sub">${c.normas}</div>
    </div>
    <div class="progress-bar no-print"><div id="ck-progress"></div></div>
    <div class="card laudo-print">
      ${c.itens.map((item, i) => `
        <div class="check-item ${item.warn ? "warn" : ""} ${state[i] ? "done" : ""}" id="ck-row-${i}">
          <input type="checkbox" id="ck-${i}" ${state[i] ? "checked" : ""}>
          ${item.warn ? `<i class="ti ti-alert-triangle ci-icon"></i>` : ""}
          <label for="ck-${i}">${item.texto}</label>
        </div>`).join("")}
    </div>
    <div style="margin-top:14px;display:flex;gap:10px" class="no-print">
      <button class="btn" onclick="resetChecklist('${c.id}')"><i class="ti ti-refresh"></i>Reiniciar</button>
      <button class="btn primary" onclick="window.print()"><i class="ti ti-printer"></i>Imprimir / salvar PDF</button>
    </div>`;
  const updateProgress = () => {
    const s = getCheckState(c.id);
    const done = c.itens.filter((_, i) => s[i]).length;
    document.getElementById("ck-progress").style.width = (done / c.itens.length * 100) + "%";
  };
  c.itens.forEach((_, i) => {
    document.getElementById("ck-" + i).addEventListener("change", e => {
      const s = getCheckState(c.id);
      s[i] = e.target.checked;
      CK.set(c.id, s);
      document.getElementById("ck-row-" + i).classList.toggle("done", e.target.checked);
      updateProgress();
    });
  });
  updateProgress();
}

function resetChecklist(id) {
  CK.reset(id);
  navigate("checklists", id);
}

// ---------- Laudos ----------
function renderLaudos(id) {
  if (id) {
    const l = LAUDOS.find(x => x.id === id);
    if (l) return renderLaudoDetail(l);
  }
  app.innerHTML = `
    <h2 class="page-title">Modelos de laudos e documentos</h2>
    <p class="page-sub">Templates editáveis — substitua os campos entre [colchetes].</p>
    <div class="grid grid-2">
      ${LAUDOS.map(l => `
        <div class="card clickable" onclick="navigate('laudos','${l.id}')">
          <div class="card-icon" style="background:var(--coral-light);color:var(--coral)"><i class="ti ${l.icone}"></i></div>
          <h3>${l.titulo}</h3>
          <p>${l.sub}</p>
        </div>`).join("")}
    </div>`;
}

function renderLaudoDetail(l) {
  // 18/set/2026 (revisão da "IA fora do Gratuito"): o texto do modelo é editável (contenteditable) e não é salvo em
  // lugar nenhum — mas esta tela é REDESENHADA NO LUGAR: "Testar grátis por 7 dias" do convite logo acima
  // (cbTestarGratis → cbAbrirNoLugar → navigate) e a revalidação do perfil em 2º plano (cbPerfilMudou, app.html).
  // O innerHTML novo trazia o modelo de volta e apagava a edição, justo abaixo de um convite que promete "o modelo
  // continua livre para editar". Redesenho do MESMO laudo reaproveita o nó vivo do texto (com a edição da pessoa ou
  // o texto que a IA já redigiu); abrir o laudo de novo pela lista (o nó antigo já saiu da página) traz o modelo
  // limpo, como sempre. Travado em tests/ia-plano.check.mjs (f) e no spec tests/e2e/ia-plano.spec.js.
  const vivo = document.getElementById("laudo-texto");
  const manter = vivo && vivo.dataset && vivo.dataset.laudo === String(l.id) ? vivo : null;
  app.innerHTML = `
    <button class="back-link no-print" onclick="navigate('laudos')"><i class="ti ti-arrow-left"></i>Todos os modelos</button>
    <div class="detail-header no-print" style="display:flex;justify-content:space-between;align-items:flex-end;gap:14px;flex-wrap:wrap">
      <div>
        <h2>${l.titulo}</h2>
        <div class="sub">${l.sub}</div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn primary" onclick="window.print()"><i class="ti ti-printer"></i>Imprimir / salvar PDF</button>
        <button class="btn" onclick="copyLaudo('${l.id}', this)"><i class="ti ti-copy"></i>Copiar texto</button>
        <button class="btn" onclick="downloadLaudo('${l.id}')"><i class="ti ti-download"></i>Baixar .txt</button>
      </div>
    </div>
    <div class="card no-print" style="margin-bottom:14px;border-left:3px solid var(--blue)">
      <h3 style="margin:0 0 6px"><i class="ti ti-sparkles"></i> Gerar com IA (citado)</h3>
      ${cbPlanoSemIA() ? cbConviteIAHTML("laudos", l.id, "Gerar laudo com IA faz parte dos planos pagos",
        "O modelo abaixo continua livre para editar, imprimir e baixar — só a redação por IA, com as fontes citadas, é dos planos pagos.") : `
      <p class="page-sub" style="margin:0 0 10px">Descreva os dados do caso; a IA redige o laudo em linguagem normativa, citando as fontes da base curada. Substitui o texto abaixo (editável) — revise e assine como RT.</p>
      <textarea id="laudo-ia-dados" rows="3" placeholder="ex.: Edifício residencial, 4 pavimentos, concreto armado; fissura inclinada ~2 mm no térreo, provável recalque; vistoria em 20/06/2026."></textarea>
      <div style="margin-top:8px"><button class="btn primary" id="laudo-ia-go" onclick="gerarLaudoIA('${l.id}')"><i class="ti ti-wand"></i> Gerar laudo com IA</button></div>
      <div id="laudo-ia-fontes" style="margin-top:8px"></div>`}
    </div>
    <div class="laudo-body laudo-print">
      <div class="laudo-print-head print-only"><span class="t">${esc(l.titulo)}</span><span class="m">${esc(l.sub)} · gerado pelo Civilbook em ${new Date().toLocaleDateString("pt-BR")}</span></div>
      <div class="laudo-text" id="laudo-texto" data-laudo="${esc(l.id)}" contenteditable="true" spellcheck="false">${esc(l.corpo)}</div>
    </div>
    <div class="card no-print" style="margin-top:16px">
      <h3 style="margin-bottom:4px"><i class="ti ti-quote"></i> Referências (ABNT NBR 6023)</h3>
      <p class="page-sub" style="margin:0 0 12px">Busque por DOI (via CrossRef) e gere a citação padronizada para colar na seção de referências do laudo.</p>
      <div id="ref-tool"></div>
    </div>`;
  if (manter) {
    const novo = document.getElementById("laudo-texto");
    if (novo && novo !== manter) novo.replaceWith(manter);
  }
  if (window.REF) REF.montar("ref-tool", { key: "laudo-" + l.id });
}

function copyLaudo(id, btn) {
  const l = LAUDOS.find(x => x.id === id);
  const el = document.getElementById("laudo-texto");
  const txt = (el && el.textContent.trim()) ? el.textContent : (l ? l.corpo : "");
  navigator.clipboard.writeText(txt).then(() => {
    btn.innerHTML = `<i class="ti ti-check"></i>Copiado!`;
    setTimeout(() => { btn.innerHTML = `<i class="ti ti-copy"></i>Copiar texto`; }, 1800);
  });
}

function downloadLaudo(id) {
  const l = LAUDOS.find(x => x.id === id);
  const el = document.getElementById("laudo-texto");
  const txt = (el && el.textContent.trim()) ? el.textContent : (l ? l.corpo : "");
  const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = l.id + ".txt";
  a.click();
  URL.revokeObjectURL(a.href);
}

// f8 — Gerador de laudos com IA (citado): redige no .laudo-text a partir dos dados do caso.
async function gerarLaudoIA(id) {
  const l = LAUDOS.find(x => x.id === id); if (!l) return;
  const dados = (document.getElementById("laudo-ia-dados").value || "").trim();
  const go = document.getElementById("laudo-ia-go");
  const fontesEl = document.getElementById("laudo-ia-fontes");
  const textoEl = document.getElementById("laudo-texto");
  const aviso = (m) => { if (fontesEl) fontesEl.innerHTML = `<p class="page-sub" style="color:var(--amber);margin:0"><i class="ti ti-alert-triangle"></i> ${esc(m)}</p>`; };
  if (dados.length < 8) { if (typeof toast === "function") toast("Descreva os dados do caso para a IA redigir.", "warn"); return; }
  const C = window.CB_CONFIG || {};
  if (!window.supa || !C.FUNCTIONS_URL) { aviso("A geração por IA exige a conta conectada ao backend."); return; }
  if (go) { go.disabled = true; go.innerHTML = `<i class="ti ti-loader"></i> Redigindo…`; }
  try {
    const { data: { session } } = await window.supa.auth.getSession();
    const token = session && session.access_token;
    if (!token) { aviso("Faça login para usar a IA."); return; }
    const r = await fetch(C.FUNCTIONS_URL + "/gerar-laudo", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, "apikey": C.SUPABASE_ANON_KEY },
      body: JSON.stringify({ tipo: l.titulo, modelo: l.corpo, dados }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { aviso(d.error || ("Falha (erro " + r.status + "). A função gerar-laudo está deployada?")); return; }
    if (textoEl && d.texto) { textoEl.textContent = d.texto; textoEl.scrollIntoView({ behavior: "smooth", block: "start" }); }
    let fontesHTML = "";
    if (d.fontes && d.fontes.length) fontesHTML = `<p style="margin:8px 0 4px;font-weight:600;font-size:13px">Fontes citadas</p><ul style="padding-left:18px;font-size:13px;line-height:1.6">${d.fontes.map(f => `<li>[${f.n}] ${esc(f.fonte || "")}${f.titulo ? " — " + esc(f.titulo) : ""}</li>`).join("")}</ul>`;
    if (fontesEl) fontesEl.innerHTML = `<p class="page-sub" style="font-size:12px;margin:8px 0 0"><i class="ti ti-circle-check"></i> Laudo gerado e citado. Revise, ajuste o texto e <strong>assine como responsável técnico</strong>.${d.semBase ? " (Base curada limitada para este tema.)" : ""}</p>${fontesHTML}`;
    if (typeof toast === "function") toast("Laudo gerado.", "success");
  } catch (e) { aviso("Não foi possível gerar agora. Tente novamente."); }
  finally { if (go) { go.disabled = false; go.innerHTML = `<i class="ti ti-wand"></i> Gerar laudo com IA`; } }
}

// ---------- Busca global ----------
const searchInput = document.getElementById("global-search");
const searchResults = document.getElementById("search-results");
searchResults.setAttribute("role", "listbox");
searchInput.setAttribute("role", "combobox");
searchInput.setAttribute("aria-autocomplete", "list");
searchInput.setAttribute("aria-expanded", "false");

// Normaliza p/ busca: minúsculas + remove acentos (tolerante a acentuação em PT-BR).
// Remove os diacríticos de combinação (U+0300–U+036F = códigos 768–879) após NFD,
// sem regex de caractere literal (evita problemas de encoding no arquivo).
const normalizar = s => String(s == null ? "" : s).toLowerCase().normalize("NFD")
  .split("").filter(ch => { const c = ch.charCodeAt(0); return c < 768 || c > 879; }).join("");

// Busca profunda (c2): coleta recursivamente TODO o texto de um item (strings, números,
// arrays e objetos aninhados) para indexar o conteúdo inteiro — não só título/subtítulo.
// Ignora ícones e o callback de navegação.
function deepText(v) {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return v + " ";
  if (Array.isArray(v)) return v.map(deepText).join("");
  if (typeof v === "object") return Object.entries(v).map(([k, val]) => (k === "icone" || k === "icon" || k === "go") ? "" : deepText(val)).join("");
  return "";
}

// Trecho do corpo ao redor do 1º termo encontrado (acento-insensível), por palavras —
// mostra ONDE casou numa busca profunda. Por palavra evita o desalinhamento de índices
// que o normalizar (que remove diacríticos) causaria num slice por caractere.
function makeSnippet(braw, term) {
  if (!braw || !term) return null;
  const words = braw.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    if (normalizar(words[i]).includes(term)) {
      const a = Math.max(0, i - 5), b = Math.min(words.length, i + 8);
      let s = words.slice(a, b).join(" ");
      if (a > 0) s = "… " + s;
      if (b < words.length) s = s + " …";
      return s;
    }
  }
  return null;
}

function buildIndex() {
  const idx = [];
  // src = objeto-fonte; deepText(src) vira o corpo indexado (_braw bruto p/ trecho, _all normalizado).
  const add = (cat, title, sub, go, src) => {
    const braw = src ? deepText(src) : "";
    idx.push({ cat, title, sub: sub || "", go,
      _t: normalizar(title), _s: normalizar(sub || ""), _braw: braw,
      _all: normalizar(title + " " + (sub || "") + " " + braw) });
  };
  CALCULADORAS.forEach(c => add("Cálculo", c.titulo, c.norma, () => navigate("calculadoras", c.id), c));
  if (typeof NORMAS !== "undefined") NORMAS.forEach(n => add("Norma", n.codigo, orgaoDe(n) + " · " + n.titulo, () => navigate("normas", n.codigo), n));
  add("SINAPI", "SINAPI — composições de custo", (typeof SINAPI !== "undefined" ? SINAPI.length.toLocaleString("pt-BR") : "10 mil+") + " composições (PR 05/2026)", () => navigate("sinapi"));
  add("CUB", "CUB/m² — Custo Unitário Básico", "custo por m² de obra · NBR 12.721 · estimador de custo", () => navigate("sinapi", "cub:"));
  add("Custos", "Orçamento de obra", "compor orçamento SINAPI + avulsos, BDI e resumo por etapa (e23)", () => navigate("sinapi", "orc:"));
  add("SINAPI", "Mudanças entre competências (changelog)", "diff add/retiradas/alteradas + linha do tempo do item (e27)", () => navigate("sinapi", "chg:"));
  if (typeof CUB_PROJETOS !== "undefined") CUB_PROJETOS.forEach(p => add("CUB", p.nome, "CUB/m² · " + p.grupo, () => navigate("sinapi", "cub:" + p.codigo), p));
  add("Conteúdo", "Área do corpo técnico", "biblioteca técnica e produção de conteúdo", () => navigate("corpo", "conteudo"));
  MATERIAIS.forEach(m => add("Material", m.nome, m.categoria, () => navigate("materiais", m.nome), m));
  CHECKLISTS.forEach(c => add("Checklist", c.titulo, c.normas, () => navigate("checklists", c.id), c));
  LAUDOS.forEach(l => add("Laudo", l.titulo, l.sub, () => navigate("laudos", l.id), l));
  if (typeof PLANO_MANUTENCAO !== "undefined") PLANO_MANUTENCAO.forEach(s => add("Manutenção", s.sistema, s.atividades.length + " atividades preventivas — NBR 5674", () => navigate("manutencao", "cronograma"), s));
  add("Cronograma", "Cronograma de obra", "Gantt + curva S físico-financeiro (e24)", () => navigate("cronograma"));
  if (typeof CONFERENCIA !== "undefined") CONFERENCIA.forEach(d => add("Conferência", d.disciplina, d.itens.length + " itens de verificação", () => navigate("conferencia"), d));
  // areaTecnica (js/tecnicas.js) e nomeMaterial (js/interacoes.js) são do MÓDULO; o índice só precisa do
  // catálogo (data/*.js, grupo `busca`). Sem eles o subtítulo é o genérico — o item continua sendo achado.
  if (typeof TECNICAS !== "undefined") TECNICAS.forEach(t => add("Ação técnica", t.titulo, typeof areaTecnica === "function" ? areaTecnica(t.area).nome : "Procedimento técnico", () => navigate("tecnicas", t.id), t));
  if (typeof INTERACOES !== "undefined") INTERACOES.forEach(it => add("Interação", it.titulo, typeof nomeMaterial === "function" ? nomeMaterial(it.a) + " × " + nomeMaterial(it.b) : "Incompatibilidade entre materiais", () => navigate("interacoes"), it));
  if (typeof COMPRAS_ITENS !== "undefined") COMPRAS_ITENS.forEach(i => add("Compra", i.item, "Itens complementares para conferir antes de comprar", () => navigate("compras", "item"), i));
  if (typeof COMPRAS_SERVICOS !== "undefined") COMPRAS_SERVICOS.forEach(s => add("Compra (serviço)", s.servico, "Materiais necessários para o serviço", () => navigate("compras", "servico"), s));
  if (typeof GARANTIAS !== "undefined") GARANTIAS.forEach(g => add("Garantia", g.sistema, `${g.prazo} ${g.prazo === 1 ? "ano" : "anos"} — NBR 17170`, () => navigate("manutencao", "garantias"), g));
  return idx;
}
// a52 P2 (21/set/2026): o índice é montado com os catálogos que JÁ estão na página e REMONTADO quando outros
// chegam (MODULOS.aoCarregar). Antes, os 8 data/*.js que ele varre vinham todos na abertura; agora chegam com o
// módulo, ou de uma vez quando a pessoa foca o campo de busca (searchInput, abaixo). `let`, não `const`.
let SEARCH_INDEX = buildIndex();
if (typeof MODULOS !== "undefined") {
  MODULOS.aoCarregar(function () {
    SEARCH_INDEX = buildIndex();
    // Já havia uma busca na tela quando o catálogo chegou: refaz com o índice completo, sem a pessoa
    // digitar de novo (senão ela lê "Nada encontrado" para algo que existe).
    if (searchInput && searchInput.value.trim().length >= 2 && !searchResults.classList.contains("hidden")) runSearch();
  });
}

// SINAPI (10k+ composições) não entra no índice estático: busca sob demanda,
// com texto normalizado pré-computado na 1ª consulta.
let _sinapiNorm = null;
function sinapiHits(nq) {
  if (typeof SINAPI === "undefined") { ensureSinapiData().catch(() => {}); return null; }  // carrega p/ a próxima busca
  if (!_sinapiNorm) _sinapiNorm = SINAPI.map(s => normalizar(s.codigo + " " + s.descricao));
  let n = 0, firstIdx = -1;
  for (let i = 0; i < _sinapiNorm.length; i++) {
    if (_sinapiNorm[i].includes(nq)) { n++; if (firstIdx < 0) firstIdx = i; }
  }
  return n ? { n, first: SINAPI[firstIdx] } : null;
}

let _hits = [];
let _active = -1;

function runSearch() {
  const raw = searchInput.value.trim();
  const nq = normalizar(raw);
  if (nq.length < 2) return hideSearch();
  const terms = nq.split(/\s+/).filter(t => t.length >= 2);
  if (!terms.length) return hideSearch();
  // Busca profunda: candidato = TODOS os termos presentes em algum campo (título/sub/corpo).
  // Pontua por prominência (título > subtítulo > corpo) + bônus de frase inteira.
  const scored = [];
  for (const x of SEARCH_INDEX) {
    if (!terms.every(t => x._all.includes(t))) continue;
    let sc = 0;
    if (x._t.startsWith(nq)) sc += 100;
    else if (x._t.includes(nq)) sc += 60;
    if (x._s.includes(nq)) sc += 25;
    if (x._all.includes(nq)) sc += 12;
    for (const t of terms) {
      if (x._t.includes(t)) sc += 8;
      else if (x._s.includes(t)) sc += 4;
      else sc += 2;
    }
    // casou só no corpo (não no título/sub) → mostra um trecho de contexto
    const snip = terms.some(t => x._t.includes(t) || x._s.includes(t)) ? null : makeSnippet(x._braw, terms[0]);
    scored.push({ x, sc, snip });
  }
  scored.sort((a, b) => b.sc - a.sc);
  _hits = scored.slice(0, 12).map(o => ({ cat: o.x.cat, title: o.x.title, sub: o.x.sub, go: o.x.go, snip: o.snip }));
  // entrada dinâmica de composições SINAPI (abre o módulo já filtrado)
  const sh = sinapiHits(nq);
  if (sh) _hits.push({ cat: "SINAPI", title: `${sh.n} composição(ões) com “${raw}”`, sub: sh.first.descricao, go: () => navigate("sinapi", raw) });
  _active = -1;
  if (!_hits.length) {
    // a52 P2: sem resultado COM acervo ainda a caminho não é "nada encontrado" — é "ainda não sei". E acervo
    // que NÃO chegou (a rede piscou) também não é: a frase curta afirmaria que o item não existe.
    searchResults.innerHTML = _buscaCarregando
      ? `<div class="search-empty">Carregando o acervo… nada encontrado para “${esc(raw)}” até agora.</div>`
      : cbBuscaIncompleta()
        ? `<div class="search-empty">Nada encontrado para “${esc(raw)}” — mas parte do acervo não chegou. Verifique a conexão e digite de novo para buscar o resto.</div>`
        : `<div class="search-empty">Nada encontrado para “${esc(raw)}”.</div>`;
    searchResults.classList.remove("hidden");
    searchInput.setAttribute("aria-expanded", "true");
    return;
  }
  drawHits(raw);
}

function drawHits(raw) {
  searchResults.innerHTML = _hits.map((h, i) => `
    <div class="search-result-item" role="option" data-i="${i}" aria-selected="${i === _active}">
      <span class="sr-cat">${esc(h.cat)}</span>
      <div><div class="sr-title">${destacar(h.title, raw)}</div><div class="sr-sub">${destacar(h.snip || h.sub, raw)}</div></div>
    </div>`).join("");
  searchResults.classList.remove("hidden");
  searchInput.setAttribute("aria-expanded", "true");
  searchResults.querySelectorAll(".search-result-item").forEach((el, i) => {
    el.addEventListener("click", () => selectHit(i));
    el.addEventListener("mousemove", () => setActive(i));
  });
}

function setActive(i) {
  _active = i;
  searchResults.querySelectorAll(".search-result-item").forEach((el, j) => {
    const on = j === i;
    el.classList.toggle("active", on);
    el.setAttribute("aria-selected", on);
    if (on) el.scrollIntoView({ block: "nearest" });
  });
}

function selectHit(i) {
  const h = _hits[i];
  if (!h) return;
  h.go();
  searchInput.value = "";
  hideSearch();
}

// destaca o termo (escapa antes; destaque é sensível a acento, a busca não)
function destacar(texto, q) {
  const e = esc(texto == null ? "" : texto);
  if (!q) return e;
  // realça cada termo (busca multi-termo); alternância num único replace evita casar dentro
  // das tags <mark> já inseridas.
  const terms = q.trim().split(/\s+/).filter(t => t.length >= 2)
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!terms.length) return e;
  try { return e.replace(new RegExp("(" + terms.join("|") + ")", "ig"), "<mark>$1</mark>"); } catch (err) { return e; }
}

searchInput.addEventListener("focus", () => { try { ensureSinapiData(); } catch (e) {} }, { once: true }); // pré-carrega a base SINAPI ao intencionar buscar
// a52 P2: e traz os CATÁLOGOS dos módulos (grupo `busca` do js/modulos.js) — normas, ações técnicas, interações,
// conferência, compras, garantias, manutenção e CUB deixaram de vir na abertura. Focar o campo é a intenção de
// buscar, o mesmo gatilho que a base SINAPI já usava. Enquanto eles vêm, a busca acha o que está carregado e o
// resultado DIZ que ainda falta acervo (_buscaCarregando) — em vez de mentir "Nada encontrado". Quando chegam,
// MODULOS.aoCarregar remonta o índice e refaz a consulta que estiver na tela.
// Ligado ao FOCO e também ao 1º "input": quem preenche o campo por script (os specs E2E, um gerenciador de
// senhas, um atalho) pode nunca disparar foco, e aí a 1ª busca ficaria sem acervo sem nada a buscar depois.
let _buscaCarregando = false;
let _buscaPedida = false;
function cbGarantirAcervoDaBusca() {
  if (_buscaPedida || typeof MODULOS === "undefined" || !MODULOS.faltaGrupo("busca").length) return;
  _buscaPedida = true;
  _buscaCarregando = true;
  const fim = () => {
    _buscaCarregando = false;
    // A rede piscou e um catálogo ficou pelo caminho: LIBERA o pedido, senão uma única falha desligava o
    // acervo da busca até a pessoa recarregar a página, e toda consulta seguinte respondia "Nada encontrado"
    // (correção de 21/set/2026, achado da revisão). O próximo foco ou a próxima tecla retomam só o que faltou.
    if (MODULOS.faltaGrupo("busca").length) _buscaPedida = false;
    if (searchInput.value.trim().length >= 2 && !searchResults.classList.contains("hidden")) runSearch();
  };
  MODULOS.garantirGrupo("busca").then(fim, fim);
}
/** Falta catálogo para esta busca? (a caminho, ou que não chegou). Enquanto faltar, "Nada encontrado" é
 *  mentira sobre o acervo — e é o que faz a pessoa desistir de procurar o que existe. */
function cbBuscaIncompleta() {
  return _buscaCarregando || (typeof MODULOS !== "undefined" && MODULOS.faltaGrupo("busca").length > 0);
}
searchInput.addEventListener("focus", cbGarantirAcervoDaBusca);
searchInput.addEventListener("input", cbGarantirAcervoDaBusca);
searchInput.addEventListener("input", runSearch);
searchInput.addEventListener("keydown", e => {
  const aberto = !searchResults.classList.contains("hidden") && _hits.length;
  if (e.key === "Escape") { hideSearch(); searchInput.blur(); return; }
  if (!aberto) return;
  if (e.key === "ArrowDown") { e.preventDefault(); setActive((_active + 1) % _hits.length); }
  else if (e.key === "ArrowUp") { e.preventDefault(); setActive((_active - 1 + _hits.length) % _hits.length); }
  else if (e.key === "Enter") { e.preventDefault(); selectHit(_active >= 0 ? _active : 0); }
});

function hideSearch() {
  searchResults.classList.add("hidden");
  searchInput.setAttribute("aria-expanded", "false");
  _active = -1;
}
document.addEventListener("click", e => {
  if (!e.target.closest(".nav-search")) hideSearch();
});

// ---------- Menu do usuário ----------
// >>> plano-teste (início) — bloco SEM dependência de DOM no carregamento: tests/plano-protegido.check.mjs
// recorta do marcador de início ao de fim e roda o código REAL com AUTH/navigate/toast falsos.
// Rótulo do plano e iniciais: fonte única p/ o cabeçalho (desktop) e o menu da conta (celular).
// `plano` é o EFETIVO da sessão (AUTH.session().plano); teste e cortesia levam a data em que vencem.
function planoRotulo(plano, planoAte) {
  const ate = planoAte ? cbDiaMes(planoAte) : "";
  if (plano === "pro-teste") return ate ? `PRO (teste até ${ate})` : "PRO (teste)";
  if (plano === "pro-cortesia") return ate ? `PRO (cortesia até ${ate})` : "PRO (cortesia)";
  return { "gratuito": "Gratuito", "pro-mensal": "PRO", "pro-anual": "PRO" }[plano] || plano;
}
// Badge do CABEÇALHO: { texto, titulo }. Numa janela entre 641 e ~840 px (tablet, janela lado a lado) o rótulo
// COM a data mais o link Admin estouravam a linha — medido em 17/set/2026 a 700 px: 731 px de conteúdo com
// "PRO (teste até 24/09)" e 742 com "PRO (cortesia até 16/11)", Sair fora da tela e rolagem horizontal
// (regressão pontual da a41; abaixo de 641 px o badge nem aparece no cabeçalho). Nessa faixa (`estreito`,
// decidido fora pelo matchMedia MQ_CAB_ESTREITO) o badge mostra o rótulo curto e a data vai para o title;
// o menu da conta (celular) e a tela de plano seguem dizendo a data.
function planoBadge(plano, planoAte, estreito) {
  const cheio = planoRotulo(plano, planoAte);
  return { texto: estreito ? planoRotulo(plano, null) : cheio, titulo: "Seu plano: " + cheio };
}
// dd/mm (ou dd/mm/aaaa) no fuso do projeto (America/Sao_Paulo, UTC-3 fixo — CLAUDE.md): o prazo que o
// usuário lê é o mesmo que o admin concedeu, em qualquer aparelho. Data ilegível → "".
function cbDiaMes(quando, comAno) {
  const d = new Date(quando);
  if (isNaN(d.getTime())) return "";
  const o = { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" };
  if (comAno) o.year = "numeric";
  try { return d.toLocaleDateString("pt-BR", o); } catch (e) { return ""; }
}

// TESTE GRÁTIS (0098). Os 10 paywalls tinham no onclick o AUTH.upgrade e o navigate em sequência, SEM esperar:
// com o teste virando RPC (assíncrona), o navigate rodava antes da resposta e o usuário caía de volta no
// paywall. Agora todos chamam este ajudante, que ESPERA o servidor e decide pelo motivo:
//   ok → abre o módulo · "ja_pro" → só abre (a sessão é que estava velha) · "ja_usado" → aviso claro e a
//   tela de plano continua (o botão é trocado no lugar) · "indisponivel" (a RPC ainda não existe: banco
//   sem a 0098) → "Recurso ainda não disponível" · rede/erro → mensagem e NADA muda.
let _cbTesteEmCurso = false;
async function cbTestarGratis(modulo, param, btn) {
  if (_cbTesteEmCurso) return null;   // duplo clique / dois botões: um pedido só
  _cbTesteEmCurso = true;
  const rotulo = btn ? btn.innerHTML : null;
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2"></i>Ativando…'; }
  let r;
  try { r = await AUTH.upgrade("pro-teste"); }
  catch (e) { console.error("cbTestarGratis:", e); r = null; }
  finally { _cbTesteEmCurso = false; }
  r = r || { ok: false, motivo: "rede" };
  const avisar = (msg, tipo) => { if (typeof toast === "function") toast(msg, tipo); };
  if (r.ok || r.motivo === "ja_pro") {
    if (r.ok) avisar("Teste PRO ativado" + (r.planoAte && cbDiaMes(r.planoAte) ? " — vale até " + cbDiaMes(r.planoAte) : "") + ".", "success");
    cbAbrirNoLugar(modulo, param);
    return r;
  }
  if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = rotulo; }
  if (r.motivo === "ja_usado") {
    avisar("Seu teste grátis já foi usado nesta conta.", "warn");
    // a tela de plano CONTINUA: só o bloco do botão é refeito (sem prometer 7 dias de novo)
    const bloco = btn && btn.closest ? btn.closest(".cb-teste-bloco") : null;
    try { if (bloco) bloco.outerHTML = cbTesteBotaoHTML(modulo, param, bloco.dataset.cls); }
    catch (e) { /* a tela foi redesenhada com o pedido no ar: o bloco novo já nasce certo */ }
  } else if (r.motivo === "indisponivel") avisar("Recurso ainda não disponível — tente mais tarde.", "info");
  else if (r.motivo === "sem_sessao") avisar("Sua sessão expirou. Entre de novo para ativar o teste.", "warn");
  // Rede/erro: o front NÃO sabe se o servidor gravou (o pedido pode ter chegado e só a resposta se perdido — aí
  // o teste está ativo e os 7 dias já correm). A frase honesta é "não foi possível confirmar": no próximo clique
  // a RPC responde ja_pro e o módulo abre; afirmar "não foi ativado" fazia a pessoa fechar o app com o prazo correndo.
  else if (r.motivo === "rede") avisar("Sem conexão com o servidor — não foi possível confirmar a ativação do teste. Verifique a internet e clique de novo: se o teste já tiver sido ativado, o módulo abre direto.", "error");
  else avisar("Não foi possível confirmar a ativação do teste agora. Tente de novo em instantes.", "error");
  return r;
}
// Abre o módulo SEM empilhar histórico quando a tela de plano já é a entrada atual dele (é o caso dos 10
// paywalls): o "voltar" não passa duas vezes pela mesma tela. Fora disso, navigate normal.
function cbAbrirNoLugar(modulo, param) {
  let st = null;
  try { st = history.state; } catch (e) {}
  if (st && st.module === modulo && (st.param || null) === (param || null)) {
    _navPop = true;
    try { navigate(modulo, param); } finally { _navPop = false; }
  } else navigate(modulo, param);
}
// Pagamento online ligado? (js/pagamentos.js; PAY.ativo() = PAGAMENTOS_ATIVO + Supabase pronto). Com ele
// DESLIGADO, "assine um plano" é um beco: a landing devolve ao app com o aviso de que pagamentos não estão
// ativos. Então o paywall de quem já usou o teste aponta o caminho que EXISTE — o suporte (a cortesia é
// concedida pelo admin) — e só volta a mandar assinar quando o pagamento entrar.
function cbPagamentosAtivos() {
  try { return !!(typeof PAY !== "undefined" && PAY && typeof PAY.ativo === "function" && PAY.ativo()); } catch (e) { return false; }
}
// Modo piloto (18/set/2026): o site publicado não tem a seção de planos da landing (index.html#planos). A chave chega
// aqui por CB_CONFIG.MODO_PILOTO, que SÓ a publicação liga (tools/modo-piloto.ts; docs/MODO-PILOTO.md). É ajuste de
// interface — onde mandar a pessoa ver os planos —, não fecho de nada.
function cbModoPiloto() {
  try { return !!(window.CB_CONFIG && window.CB_CONFIG.MODO_PILOTO === true); } catch (e) { return false; }
}
// Bloco do botão das telas de plano (fonte única dos 10 módulos). Teste disponível → "Testar grátis por
// 7 dias" + as regras; teste já usado → NÃO promete 7 dias de novo: diz quando terminou e leva ao caminho
// real (planos com o pagamento ligado; suporte com ele desligado).
// `modulo`/`param`/`cls` são literais do código dos módulos (nunca dado de usuário).
function cbTesteBotaoHTML(modulo, param, cls) {
  cls = cls || "btn primary lg";
  const t = (typeof AUTH !== "undefined" && typeof AUTH.testeGratis === "function") ? AUTH.testeGratis() : { usado: false, fimMs: null };
  const nota = (txt) => `<p style="font-size:12px;color:var(--text-3);margin-top:12px">${txt}</p>`;
  let dentro;
  if (t.usado) {
    const dia = t.fimMs ? cbDiaMes(t.fimMs, true) : "";
    const quando = !dia ? "Seu teste grátis já foi usado nesta conta."
      : (t.fimMs < Date.now() ? `Seu teste grátis terminou em ${dia}.` : `Seu teste grátis vale até ${dia}.`);
    // No piloto a landing não tem planos: "Ver planos PRO" leva a Minha conta → Assinatura (com o pagamento ligado,
    // é lá que estão os botões de assinar, com o preço lido da fonte única por quem está logado).
    dentro = cbPagamentosAtivos()
      ? (cbModoPiloto()
        ? `<button type="button" class="${cls}" onclick="navigate('conta','assinatura')"><i class="ti ti-crown"></i>Ver planos PRO</button>`
        : `<a class="${cls}" href="index.html#planos"><i class="ti ti-crown"></i>Ver planos PRO</a>`)
        + nota(`${quando} O teste vale uma vez por conta — para seguir no PRO, assine um plano.`)
      : `<button type="button" class="${cls}" onclick="navigate('conta','suporte')"><i class="ti ti-lifebuoy"></i>Falar com o suporte</button>`
        + nota(`${quando} O teste vale uma vez por conta. Pagamentos ainda não estão ativos — para seguir no PRO, fale com a gente pelo suporte.`);
  } else {
    const args = `'${modulo}',${param ? `'${param}'` : "undefined"},this`;
    dentro = `<button class="${cls}" onclick="cbTestarGratis(${args})"><i class="ti ti-rocket"></i>Testar grátis por 7 dias</button>`
      + nota("7 dias de PRO, uma vez por conta — sem cartão e sem renovação automática.");
  }
  return `<div class="cb-teste-bloco" data-cls="${cls}">${dentro}</div>`;
}

// A conta é de um plano pago? 11 módulos perguntam isto para decidir entre a tela e o aviso de plano.
// a52 P2 (21/set/2026): MUDOU DE CASA — vivia no js/manutencao.js, que passou a chegar só quando a Manutenção
// abre. Os chamadores estão nas DUAS formas, e as duas quebram sem ela (conferido arquivo a arquivo em
// 21/set/2026, na revisão): 9 chamam `if (!planoEhPro())` CRU (compras, conferencia, cronograma, interacoes,
// manutencao, orcamento, projetos, rdo, tecnicas) e teriam ReferenceError dentro do render — a tela do módulo
// não desenha; 2 perguntam com `typeof` (parametrico, ads) e aí a falta vira RESPOSTA ERRADA em silêncio (no
// js/parametrico.js, `typeof planoEhPro === "function" && !planoEhPro()` fica falso e a tela PRO abre para
// quem é gratuito). Decisão de plano é da CASCA, não de um módulo.
// (Um js/manutencao.js ANTIGO vindo do service worker redefine esta função com o mesmo corpo — inofensivo.)
function planoEhPro() {
  const sess = AUTH.session();
  return sess && sess.plano && sess.plano !== "gratuito";
}

// "Perguntar à IA" a partir de QUALQUER módulo (a52 P2, 21/set/2026). O Assessor (js/assistente.js, 17,6 KB
// comprimidos) chega quando a aba dele abre, e os botões espalhados pelo RDO, Projetos e Interações o chamavam
// com `typeof ASSIST !== "undefined" && ASSIST.x(...)`: com o arquivo ainda não baixado, o teste dá falso e o
// botão não faz NADA — sem erro, sem aviso, o pior desfecho possível. Todos passam por aqui, que busca o
// módulo e só então chama. Módulo que precisar do Assessor usa esta função, nunca o ASSIST direto.
function cbAssessor(metodo) {
  const args = Array.prototype.slice.call(arguments, 1);
  const usar = () => {
    if (typeof ASSIST === "undefined" || typeof ASSIST[metodo] !== "function") {
      if (typeof toast === "function") toast("Assessor indisponível.", "warn");
      return;
    }
    ASSIST[metodo].apply(ASSIST, args);
  };
  if (typeof MODULOS === "undefined") { usar(); return Promise.resolve(); }
  return MODULOS.garantir("assessor").then(usar, (e) => {
    if (typeof toast === "function") toast("O assessor " + MODULOS.motivoTexto((e && e.motivo) || "rede"), "error");
  });
}
if (typeof window !== "undefined") window.cbAssessor = cbAssessor;

// É do corpo técnico (autor/editor/admin)? Mesma régua do CONT.ehCorpoTecnico (js/conteudo.js) e do
// BIBLIO.ehCorpoTecnico (js/biblioteca.js), só que na CASCA: a aba "Corpo técnico" é escondida no initApp e o
// cartão da Minha conta a consulta — os dois ANTES de o módulo `corpo` existir (a52 P2). Quem manda de verdade é
// o RLS do banco; isto é só o que a tela mostra.
function cbEhCorpoTecnico() {
  const s = (typeof AUTH !== "undefined") ? AUTH.session() : null;
  return !!s && ["autor", "editor", "admin"].indexOf(s.role || "user") >= 0;
}
if (typeof window !== "undefined") window.cbEhCorpoTecnico = cbEhCorpoTecnico;

// BAIXAR ARQUIVO: a tela BAIXA, nunca NAVEGA (f50, 23/set/2026 — três defeitos vistos no Android do fundador
// no mesmo toque, e um quarto que só aparece no iPhone). Fica na CASCA porque Meus projetos, a Manutenção e o
// Manual chegam sob demanda (a52 P2) e precisam da MESMA régua.
//   · `window.open(urlAssinada)` NAVEGA para um .docx que o navegador não sabe desenhar → aba EM BRANCO, no
//     endereço do host do Supabase. Baixar é buscar os BYTES e entregá-los a uma âncora com `download`.
//   · iPhone: entre o toque e o `window.open` há `getSession()` e o fetch da Edge Function; fora do gesto do
//     usuário o Safari BLOQUEIA o popup e o botão não faz NADA, sem erro. A âncora com `download` não abre
//     janela nenhuma, então não há popup para bloquear — MAS veja o limite (2) abaixo.
//   · o NOME: a chave do Storage é ASCII (o manual-gerar normaliza, senão o upload toma "Invalid key") e era
//     esse nome que o aparelho gravava. Aqui manda o nome bonito, que quem chama já tem.
//   · c9: o resultado é DEVOLVIDO, nunca prometido. Esta promessa só resolve com os bytes na mão, e por isso a
//     frase de sucesso de quem chama sai DEPOIS do await — nunca antes, como o "Baixando…" que o fundador leu
//     sobre uma aba vazia. A falha vira exceção com frase de CLASSE (rede × servidor × arquivo), NUNCA a do
//     servidor: quem chama só põe na tela a frase de um erro marcado com `cbDownload` (`cbErroDownload`), e o
//     resto vira uma frase fixa. StorageError do supabase-js ("Object not found") não é texto para engenheiro
//     convidado ler.
// LIMITES DECLARADOS (nenhum deles é conserto desta tarefa; os dois últimos NÃO foram medidos):
//   (1) o endereço do Supabase segue aparecendo em quem inspeciona a rede — domínio próprio é add-on pago e
//       mexe na callback do Google (docs/GOOGLE-AUTH.md);
//   (2) `a.click()` PEDE a gravação; ninguém confirma que ela aconteceu. Se o navegador recusar (política de
//       MDM, armazenamento cheio, iOS que ignore o `download` de um blob), o `true` daqui sai igual. Não foi
//       medido em iPhone nem em Android reais — fica no diário do fundador, e está dito no cabeçalho de
//       tests/download-arquivo.check.mjs;
//   (3) o arquivo passa INTEIRO pela memória da aba (o app já limita a 15 MB em PROJ_MAX_BYTES).
async function cbBaixarArquivo(url, nome) {
  if (!url) throw cbErroDownload("Não há link para este arquivo.");
  let r;
  try { r = await fetch(url); }
  catch (e) { throw cbErroDownload("Não foi possível baixar agora — confira a conexão e tente de novo."); }
  if (!r.ok) throw cbErroDownload("O arquivo não veio (erro " + r.status + "). Tente de novo em instantes.");
  let blob;
  // o corpo cai DEPOIS dos cabeçalhos: numa planta de 15 MB em 4G instável o `r.ok` já passou e é aqui que o
  // rádio morre. Sem este try, o TypeError do navegador ("Failed to fetch") ia cru para a tela, em inglês.
  try { blob = await r.blob(); }
  catch (e) { throw cbErroDownload("O download parou no meio — confira a conexão e tente de novo."); }
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = nome || "arquivo";
  a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  // o navegador lê o blob DEPOIS do clique: revogar na mesma volta do laço cancela o download (mesmo prazo do
  // orcCSV, js/orcamento.js).
  setTimeout(() => { try { URL.revokeObjectURL(href); } catch (e) {} }, 2000);
  return true;
}
/** Erro NOSSO, de classe conhecida: só a mensagem destes vai à tela (c9). */
function cbErroDownload(msg) { const e = new Error(msg); e.cbDownload = true; return e; }
/** A frase da CLASSE do erro. Erro de fora (StorageError, TypeError) nunca fala na tela. */
function cbFraseDownload(e, padrao) {
  if (e && e.cbDownload && e.message) return e.message;
  if (e) { try { console.warn("[download]", (e.name || "erro"), e.statusCode || e.status || ""); } catch (x) {} }
  return padrao;
}
// O NOME do `{ download }` da URL assinada — MESMAS regras do _shared/download.ts (a casca não importa módulo
// de Edge Function; o check compara os dois conjuntos letra a letra). O SDK monta `&download=` + nome e só
// DEPOIS aplica `encodeURI`, que não escapa `&` nem `#`: "Obra A & B" truncava o nome e matava a extensão, e
// nome vazio apagava o parâmetro inteiro — e com ele o Content-Disposition: attachment.
const CB_PROIBIDOS_NO_DOWNLOAD = "&#?=+%\\/:*\"<>|";
const CB_MAX_NOME_DOWNLOAD = 150;
function cbNomeDownload(nome, padrao) {
  let s = typeof nome === "string" ? nome : "";
  s = s.replace(/[\u0000-\u001F\u007F-\u009F]+/g, " ");
  s = Array.from(s).map(function (c) { return CB_PROIBIDOS_NO_DOWNLOAD.indexOf(c) >= 0 ? "-" : c; }).join("");
  s = s.replace(/-{2,}/g, "-").replace(/\s{2,}/g, " ").trim();
  // mesma correção do _shared/download.ts: a limpeza do começo comia a EXTENSÃO quando o miolo era só
  // caractere proibido ("#.docx" → "-.docx" → "docx"), e arquivo sem extensão não abre em nada no Android.
  const antesDoCorte = s;
  s = s.replace(/^[-.\s]+|[-\s]+$/g, "");
  if (!s) return padrao || "arquivo";
  const mExt = /\.([A-Za-z0-9]{1,8})$/.exec(antesDoCorte);
  if (mExt && s === mExt[1]) s = (padrao || "arquivo") + "." + s;
  if (s.length > CB_MAX_NOME_DOWNLOAD) {
    const p = s.lastIndexOf(".");
    const ext = (p > 0 && s.length - p <= 8) ? s.slice(p) : "";
    s = s.slice(0, CB_MAX_NOME_DOWNLOAD - ext.length).replace(/[-\s]+$/, "") + ext;
  }
  return s || padrao || "arquivo";
}
if (typeof window !== "undefined") {
  window.cbBaixarArquivo = cbBaixarArquivo;
  window.cbFraseDownload = cbFraseDownload;
  window.cbNomeDownload = cbNomeDownload;
}

// RECURSO COMPARTILHÁVEL: a tela só lê o que é MEU (a59, 22/set/2026; o porquê inteiro está no
// docs/SECURITY.md §2 e na regra dura do CLAUDE.md). Fica na CASCA porque a Conferência, a Manutenção e
// a fábrica cbColecao chegam sob demanda e precisam da MESMA régua. A política de select da 0010 é
// "dono OU public.is_admin() OU tem_acesso(...)": ao ADMIN ela devolvia as linhas de TODAS as contas, e
// o _fromRow de cada módulo marca "dono ≠ eu" como compartilhado comigo. Então o filtro é a consulta:
// dono = eu MAIS os ids de compartilhamentos com convidado_id = eu (um .eq("user_id") sozinho tiraria o
// compartilhado legítimo). Erro DEVOLVIDO, nunca lançado (b10/c9): { data, error, parcial,
// compartilhados }; `parcial` é a falha que atingiu SÓ os compartilhados, e aí a tela mostra o que é meu.
// NÃO toca no ?share=: aquele caminho é a RPC abrir_por_token.
async function cbLerMeusRecursos(tabela, tipoCompart, opcoes) {
  const op = opcoes || {};
  const uid = op.uid || CBStore.uid();
  const compartilhados = new Set();
  if (!uid) return { data: [], error: null, parcial: null, compartilhados };
  const meus = await window.supa.from(tabela).select("*").eq("user_id", uid);
  if (meus.error) return { data: null, error: meus.error, parcial: null, compartilhados };
  const linhas = (meus.data || []).slice();
  const convites = await window.supa.from("compartilhamentos").select("recurso_id")
    .eq("recurso_tipo", tipoCompart).eq("convidado_id", uid);
  let parcial = convites.error || null;
  const ids = convites.error ? [] : [...new Set((convites.data || []).map(r => r && r.recurso_id).filter(Boolean))];
  ids.forEach(id => compartilhados.add(id));
  const aBuscar = ids.filter(id => !linhas.some(l => l && l.id === id));
  if (aBuscar.length) {
    const outros = await window.supa.from(tabela).select("*").in("id", aBuscar);
    if (outros.error) parcial = outros.error;
    else (outros.data || []).forEach(r => linhas.push(r));
  }
  if (op.ordem) {
    const col = op.ordem;
    linhas.sort((a, b) => {
      const x = a ? a[col] : null, y = b ? b[col] : null;
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return x < y ? -1 : x > y ? 1 : 0;
    });
  }
  return { data: linhas, error: null, parcial, compartilhados };
}
if (typeof window !== "undefined") window.cbLerMeusRecursos = cbLerMeusRecursos;

// O evento de Realtime é MEU? (a59) O canal aplica a MESMA política de select, então o admin recebe ao vivo
// o projeto e a OS de todas as contas — filtrar só a carga inicial não bastava. Só INSERT/UPDATE passam por
// aqui: o DELETE do SDK vem com `new` VAZIO (js/vendor/supabase.js, _getPayloadRecords, que só preenche
// `new` em INSERT/UPDATE), e quem decide um DELETE é o cache de quem escuta — está no chamador.
// A régua tem TRÊS degraus, e o terceiro é o que conserta o achado da revisão de 22/set/2026: o retrato
// `compartilhados` é do load(), então compartilhamento feito DEPOIS ficava de fora. Para quem NÃO é admin o
// canal já é a prova — linha de outro dono só chega se `tem_acesso()` passou —, e ela entra. Quem recebe o
// de todas as contas é só o admin, e para ele o retrato continua sendo a única régua (limite declarado: o
// compartilhamento novo aparece na próxima carga). AUTH fora do ar = não sei = não entra.
function cbRecursoEhMeu(linha, compartilhados) {
  if (!linha) return false;
  const uid = CBStore.uid();
  if (!uid) return false;
  if (linha.user_id === uid) return true;
  if (compartilhados && compartilhados.has && compartilhados.has(linha.id)) return true;
  const admin = (typeof AUTH !== "undefined" && AUTH && typeof AUTH.isAdmin === "function") ? AUTH.isAdmin() : null;
  return admin === false;
}
if (typeof window !== "undefined") window.cbRecursoEhMeu = cbRecursoEhMeu;

// IA FORA DO GRATUITO (decisão do fundador, 18/set/2026). Quem manda é o servidor — _shared/cota.ts dá
// cota 0 ao plano Gratuito e nega com motivo "plano" em TODA função de IA. Isto aqui é só UX: nas telas de
// IA que o gratuito alcança (Assessor, "Gerar com IA" dos Laudos e "Sugerir nome e pasta (IA)" em Minha
// conta → Google Drive), o campo/botão vira um convite, para ninguém escrever a pergunta inteira (ou
// esperar o PDF ser lido) e só depois ouvir "não". Critério IGUAL ao tierDoPlano do servidor sobre o plano
// EFETIVO (AUTH.session().plano, que já traz teste/cortesia vencidos como gratuito): vazio ou "gratuito"
// (caixa e espaço não são brecha). Sem sessão → false: a própria tela pede o login.
// Plano AINDA NÃO LIDO → false (revisão de 18/set): num aparelho sem cache, a sessão nasce "gratuito" por
// padrão até o perfil chegar (js/auth.js, _sessaoDe) — e, se a leitura falhar, fica assim. Tratar esse
// padrão como fato mostrava o convite de plano pago a quem paga. Na dúvida a caixa aparece e o servidor, que
// lê o plano, decide; se ele disser "plano", o assessor troca a caixa pelo convite na hora (_semIAServidor).
// Só a sessão do Supabase tem planoBruto; a do modo local (dev/E2E) não tem perfil a esperar.
// ESPELHO DO SERVIDOR, com teste (tests/ia-plano.check.mjs): "Gratuito é 0 fixo" (fundador, 18/set/2026) — o
// gratuito não tem IA nos DOIS lados, sem alavanca de env que reabra só um deles. O check roda a mesma tabela de
// planos aqui e no _shared/cota.ts (plano efetivo → tier → cota > 0) e reprova se divergirem; mexeu no
// tierDoPlano ou na cota do Gratuito, mexa aqui junto.
function cbPlanoSemIA() {
  try {
    if (typeof AUTH === "undefined" || typeof AUTH.session !== "function") return false;
    const s = AUTH.session();
    if (!s) return false;
    if (s.planoBruto !== undefined && !s.perfilConfirmadoEm) return false;
    const p = String(s.plano == null ? "" : s.plano).trim().toLowerCase();
    return !p || p === "gratuito";
  } catch (e) { return false; }
}
// O convite (fonte única). Botão principal = o do teste grátis (cbTesteBotaoHTML já sabe se o teste foi usado
// e se o pagamento está ligado); o link leva à aba real de planos (Minha conta → Assinatura, js/conta.js), o
// mesmo destino da mensagem do servidor — e lá, para quem não tem IA, está o MESMO botão (teste ou suporte),
// senão o destino seria um beco com o pagamento desligado. Estilo inline: só os tokens de cor do tema.
// `modulo`/`param`/`titulo`/`texto` são literais do código dos módulos (nunca dado de usuário).
function cbConviteIAHTML(modulo, param, titulo, texto) {
  const botao = typeof cbTesteBotaoHTML === "function" ? cbTesteBotaoHTML(modulo, param, "btn primary") : "";
  return `<div class="card cb-convite-ia" role="note" style="margin:0;padding:16px 18px;text-align:center">
    <p style="margin:0 0 4px;font-weight:600;color:var(--text)"><i class="ti ti-lock" aria-hidden="true"></i> ${titulo || "A IA faz parte dos planos pagos"}</p>
    <p class="page-sub" style="margin:0 0 12px">${texto || "O plano Gratuito não inclui a IA do Civilbook."}</p>
    ${botao}
    <p style="margin:10px 0 0;font-size:12.5px"><a href="#" onclick="navigate('conta','assinatura');return false;" style="color:var(--blue)">Ver os planos em Minha conta → Assinatura</a></p>
  </div>`;
}

// NEGAÇÃO DE IA DO SERVIDOR → para onde o botão leva (fonte única da ata, da conferência e do assessor; revisão
// de 18/set/2026, jornadas). A resposta é o 429 com `cota: true` do _shared/cota.ts (negacaoHttp): `motivo`
// "plano" (o plano não tem IA) ou "cota" (tem IA e o mês acabou; servidor antigo não manda motivo = "cota"), e
// `tier`. O achado: PRO/cortesia com a cota esgotada ouvia "Conhecer o Civilbook IA", ia para a Assinatura e, com
// os pagamentos DESLIGADOS (CB_CONFIG.PAGAMENTOS_ATIVO=false), "Assinar Civilbook IA" era um link para a landing,
// que não vende o Civilbook IA e devolve ao app com "Pagamentos ainda não estão ativos" — um beco. Regra: com o
// pagamento desligado, nenhum botão de IA leva a assinar o que não dá para assinar; o destino é o que EXISTE (o
// Suporte) e o texto diz a verdade (as assinaturas abrem em breve). Quem já está no Civilbook IA (tier "ia") não
// ouve oferta do próprio plano. Com o pagamento ligado, o fluxo de antes vale.
//   "plano" → "Ver planos" (Minha conta → Assinatura: lá mora o teste grátis ou o suporte, js/conta.js);
//   "cota", pagamento ligado e tier ≠ "ia" → "Conhecer o Civilbook IA" (Assinatura, com o checkout);
//   "cota" com o pagamento desligado, ou tier "ia" → "Falar com o suporte".
// Devolve null quando a negação não é de plano/cota (instabilidade, 503): aí não há botão.
function cbSaidaNegacaoIA(d) {
  if (!d || !d.cota) return null;
  if (d.motivo === "plano") return { rotulo: "Ver planos", icone: "ti-rocket", destino: "assinatura", nota: "" };
  if (d.tier === "ia") return { rotulo: "Falar com o suporte", icone: "ti-lifebuoy", destino: "suporte", nota: "" };
  if (cbPagamentosAtivos()) return { rotulo: "Conhecer o Civilbook IA", icone: "ti-rocket", destino: "assinatura", nota: "" };
  return { rotulo: "Falar com o suporte", icone: "ti-lifebuoy", destino: "suporte",
    nota: "As assinaturas online abrem em breve — enquanto isso, fale com a gente pelo suporte." };
}
// O botão (e a nota, quando há) que a ata e a conferência põem sob a mensagem do servidor. "" = sem botão.
function cbNegacaoIABotaoHTML(d) {
  const s = cbSaidaNegacaoIA(d);
  if (!s) return "";
  return `<div class="cb-negacao-ia" style="margin-top:8px"><button class="btn primary" onclick="navigate('conta','${s.destino}')"><i class="ti ${s.icone}" aria-hidden="true"></i> ${s.rotulo}</button>`
    + (s.nota ? `<p class="page-sub" style="margin:6px 0 0;font-size:12.5px">${s.nota}</p>` : "") + `</div>`;
}
// O mesmo, em TEXTO, para o fio do assessor (a troca negada é uma linha de erro, sem botão). "plano" → "": a
// mensagem do servidor já diz para onde ir e a caixa vira o convite.
// A frase do servidor (d.error, de mensagemCotaEsgotada no _shared/cota.ts) aparece UMA vez e o complemento só
// diz o que ela ainda NÃO diz — revisão de 18/set: quem assina o Civilbook IA lia o Suporte duas vezes ("…fale
// com o suporte em Minha conta → Suporte. Para falar da sua cota, fale com a gente em Minha conta → Suporte.") e
// o PRO, com o pagamento ligado, "Conheça o plano Civilbook IA… — conheça o plano Civilbook IA…". O complemento
// nunca é oferta: ligado, só ONDE ficam os planos; desligado, a verdade (as assinaturas abrem em breve) e o
// Suporte, se o servidor ainda não o citou. tests/ia-plano.check.mjs (d) compõe com a frase REAL do cota.ts.
function cbSufixoNegacaoIA(d) {
  const s = cbSaidaNegacaoIA(d);
  if (!s || d.motivo === "plano") return "";
  const dito = String(d.error || "");
  const jaDiz = (t) => dito.indexOf(t) >= 0;
  if (s.destino === "assinatura") {
    if (jaDiz("Minha conta → Assinatura")) return "";
    return /Civilbook IA/.test(dito) ? " Os planos ficam em Minha conta → Assinatura." : " Conheça o plano Civilbook IA em Minha conta → Assinatura.";
  }
  const suporte = jaDiz("Minha conta → Suporte") ? "" : "fale com a gente em Minha conta → Suporte.";
  if (d.tier === "ia") return suporte ? " Para falar da sua cota, " + suporte : "";
  return " As assinaturas online abrem em breve" + (suporte ? " — enquanto isso, " + suporte : ".");
}

// Recado da landing (index.html, seguirAposAuth): a pessoa escolheu um plano PAGO com os pagamentos
// desligados. Nada foi gravado — a conta entra no plano em que está (nova = gratuito) e o app diz isso com
// todas as letras, uma vez. A chave de sessionStorage é o único elo entre as duas páginas.
function cbAvisoPlanoTexto(origem, sess, teste) {
  const gratuito = !sess || !sess.plano || sess.plano === "gratuito";
  if (!gratuito) return "Pagamentos ainda não estão ativos; nada foi cobrado e o seu plano atual continua valendo.";
  const convite = teste && teste.usado ? "" : " Você pode testar o PRO por 7 dias dentro do app.";
  return (origem === "cadastro"
    ? "Pagamentos ainda não estão ativos; sua conta foi criada no plano gratuito."
    : "Pagamentos ainda não estão ativos; sua conta segue no plano gratuito e nada foi cobrado.") + convite;
}
function cbAvisoPlanoDaLanding() {
  let origem = null;
  try { origem = sessionStorage.getItem("cb-aviso-plano"); if (origem) sessionStorage.removeItem("cb-aviso-plano"); } catch (e) {}
  if (!origem) return;
  const sess = AUTH.session();
  const texto = cbAvisoPlanoTexto(origem, sess, typeof AUTH.testeGratis === "function" ? AUTH.testeGratis() : null);
  const ov = document.createElement("div");
  ov.className = "cb-modal-ov";
  ov.setAttribute("role", "dialog");
  ov.setAttribute("aria-modal", "true");
  ov.setAttribute("aria-labelledby", "cb-aviso-plano-tit");
  ov.innerHTML = `<div class="card cb-modal-box cb-confirm">
    <strong class="cb-confirm-tit" id="cb-aviso-plano-tit">Sobre o plano que você escolheu</strong>
    <div class="cb-confirm-msg"><p style="margin:8px 0 0"></p></div>
    <div class="cb-confirm-acoes"><button type="button" class="btn primary">Entendi</button></div>
  </div>`;
  ov.querySelector(".cb-confirm-msg p").textContent = texto;
  const fechar = () => ov.remove();
  ov.addEventListener("click", (e) => { if (e.target === ov) fechar(); });
  ov.querySelector("button").addEventListener("click", fechar);
  document.body.appendChild(ov);
  requestAnimationFrame(() => { try { ov.querySelector("button").focus(); } catch (e) {} });
}
if (typeof window !== "undefined") { window.cbTestarGratis = cbTestarGratis; window.cbTesteBotaoHTML = cbTesteBotaoHTML; }
// <<< plano-teste (fim)

function iniciaisDe(nome) {
  return String(nome || "").split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
}

// Desktop: igual a sempre (Admin · plano · chip · feedback · sair, em linha). Celular (<= 640 px): o
// CSS deixa só o chip (avatar) e o toque nele abre contaMenu() — os demais controles (.nav-so-desktop,
// .admin-link, .badge-pro) somem do cabeçalho e reaparecem na folha. Em 17/set/2026 os 5 em linha
// mediam 519 px numa tela de 360: "sair", feedback e a conta ficavam FORA da tela.
function renderUserMenu() {
  const sess = AUTH.session();
  const menu = document.getElementById("user-menu");
  if (!sess || !menu) return;
  const badge = planoBadge(sess.plano, sess.planoAte, MQ_CAB_ESTREITO.matches);   // plano desconhecido sai como veio do servidor: escapa
  const iniciais = iniciaisDe(sess.nome);
  const adminLink = AUTH.isAdmin()
    ? `<a class="btn admin-link" href="admin.html" style="padding:7px 12px" title="Painel administrativo"><i class="ti ti-shield-lock"></i><span class="admin-link-label">Admin</span></a>`
    : "";
  menu.innerHTML = `
    ${adminLink}
    <span class="badge-pro" style="white-space:nowrap" title="${esc(badge.titulo)}">${esc(badge.texto)}</span>
    <button class="user-chip" onclick="contaMenu()" title="Minha conta — ${sess.email}" aria-label="Minha conta"${MQ_CELULAR.matches ? ' aria-haspopup="dialog"' : ""}>
      <div class="user-avatar">${iniciais}</div>
      <span class="user-name">${sess.nome.split(" ")[0]}</span>
    </button>
    <button class="btn icon-only nav-so-desktop" onclick="if(typeof fbAbrir==='function')fbAbrir()" title="Avaliar / enviar feedback" aria-label="Enviar feedback"><i class="ti ti-message-2-heart"></i></button>
    <button class="btn nav-so-desktop" style="padding:7px 12px" onclick="AUTH.logout()" title="Sair"><i class="ti ti-logout"></i></button>`;
  const nav = menu.closest(".nav");
  if (nav) nav.classList.add("nav-logado");   // celular: com sessão, o botão de tema sai do cabeçalho (está no menu da conta)
}

// ---------- Celular: folha inferior, barra com "Mais" e menu da conta ----------
const MQ_CELULAR = window.matchMedia("(max-width: 640px)");   // o mesmo corte do css/style.css
// Cabeçalho "estreito" (641–840 px): o badge do plano sai sem a data (ver planoBadge). 840 = os ~745 px que o
// rótulo datado + Admin pediam a 700 px de viewport, com folga para um primeiro nome comprido no chip.
const MQ_CAB_ESTREITO = window.matchMedia("(max-width: 840px)");

// FOLHA — bottom sheet acessível, uma por vez. O foco VAI para a folha ao abrir e VOLTA ao gatilho ao
// fechar; Esc, toque fora, o botão X, o 2º toque no gatilho e o "VOLTAR" do aparelho fecham.
// Fica acima da barra inferior, que segue visível e tocável — por isso NÃO é aria-modal: aria-modal
// diria ao TalkBack que tudo fora da folha está inerte, inclusive a barra (e o próprio gatilho "Mais",
// que também fecha). Em vez disso o FUNDO de verdade (cabeçalho, conteúdo, rodapé, FAB, banner)
// recebe `inert` enquanto a folha está aberta, e o Tab circula entre a barra e a folha.
// Cobre FAB do WhatsApp, toasts e o banner de cookies (z-index no css). Não é .cb-modal-ov de
// propósito: o Esc global do app remove todo .cb-modal-ov sem devolver o foco nem avisar o gatilho.
//
// HISTÓRICO: abrir empilha UMA entrada (mesma URL, state.folha) para o "voltar" ter o que consumir.
// Fechar pela interface devolve essa entrada com history.back() (o popstate que chega é engolido em
// aoPopstate); navegar a partir da folha a SUBSTITUI (navigate usa replaceState). Assim a pilha fica
// sempre igual à de quem nunca abriu a folha.
const FOLHA = (function () {
  let ov = null, gatilhoFn = null;
  let comHist = false;        // a entrada da folha está no topo do histórico
  let esperandoPop = false;   // history.back() nosso em curso: o próximo popstate é dele, não do usuário
  let depoisFn = null, tmrPop = null;
  const barra = () => document.getElementById("mobile-tabbar");
  const focaveis = el => el ? Array.prototype.filter.call(
    el.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
    x => !x.disabled && x.offsetParent !== null) : [];
  // Tudo que é filho direto do <body> e não é a folha, a barra, os toasts (avisos) ou o gate LGPD.
  function inertizar(on) {
    Array.prototype.forEach.call(document.body.children, el => {
      if (on) {
        if (el === ov || el.id === "mobile-tabbar" || el.id === "cb-lgpd-gate" || el.classList.contains("cb-toasts")) return;
        if (/^(SCRIPT|STYLE|LINK)$/.test(el.tagName) || el.inert) return;
        el.inert = true; el.setAttribute("data-folha-inert", "1");
      } else if (el.hasAttribute("data-folha-inert")) { el.inert = false; el.removeAttribute("data-folha-inert"); }
    });
  }
  function onKey(e) {
    if (!ov) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fechar(); return; }
    if (e.key !== "Tab") return;
    const painel = ov.firstElementChild, b = barra();
    const f = focaveis(b).concat(focaveis(painel));   // ordem do DOM: a barra vem antes da folha
    if (!f.length) { e.preventDefault(); return; }
    const a = document.activeElement;
    if (!painel.contains(a) && !(b && b.contains(a))) { e.preventDefault(); (focaveis(painel)[0] || painel).focus(); }
    else if (e.shiftKey && a === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && a === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    // no meio do caminho (inclusive do painel para o 1º botão) o Tab nativo já faz o certo
  }
  function desmontar(semFoco) {
    const g = gatilhoFn ? gatilhoFn() : null;
    inertizar(false);   // antes de devolver o foco: o gatilho da conta mora no cabeçalho, que estava inerte
    ov.remove(); ov = null; gatilhoFn = null;
    document.body.classList.remove("cb-folha-on");
    document.removeEventListener("keydown", onKey, true);
    if (g) {
      g.setAttribute("aria-expanded", "false"); g.removeAttribute("aria-controls");
      if (!semFoco) { try { g.focus({ preventScroll: true }); } catch (e) {} }
    }
  }
  function concluirPop() {
    esperandoPop = false;
    if (tmrPop) { clearTimeout(tmrPop); tmrPop = null; }
    const d = depoisFn; depoisFn = null;
    if (d) d();
  }
  const encadear = fn => { const d0 = depoisFn; depoisFn = () => { if (d0) d0(); fn(); }; };   // roda quando o back() em curso assentar
  // opts = { semFoco, navegando, semHist, depois }
  //   navegando: quem chama é navigate() — devolve true se a entrada da folha ficou no topo (ele a substitui)
  //   semHist:   a página está de saída (logout): não mexe no histórico
  //   depois:    roda quando o histórico já assentou (abrir modal, seguir link) — sem corrida com o back()
  function fechar(opts) {
    opts = opts || {};
    if (!ov) {
      if (opts.depois) { if (esperandoPop) encadear(opts.depois); else opts.depois(); }
      return false;
    }
    desmontar(!!opts.semFoco);
    const tinha = comHist; comHist = false;
    if (tinha && opts.navegando) return true;
    if (tinha && !opts.semHist) {
      esperandoPop = true; depoisFn = opts.depois || null;
      tmrPop = setTimeout(() => { if (esperandoPop) concluirPop(); }, 700);   // popstate que não veio: não trava o "depois"
      try { history.back(); } catch (e) { concluirPop(); }
      return false;
    }
    if (opts.depois) opts.depois();
    return false;
  }
  // Chamado pelo popstate do app ANTES de navegar. true = o evento era da folha; não navegue.
  function aoPopstate() {
    if (esperandoPop) { concluirPop(); return true; }                       // o nosso history.back()
    if (ov && comHist) { comHist = false; desmontar(false); return true; }  // "voltar" do aparelho: fecha só a folha
    return false;
  }
  // o = { id, titulo, html, gatilho: () => elemento, aoClicar: (alvo, evento) => void }
  function abrir(o) {
    if (esperandoPop) { encadear(() => abrir(o)); return; }   // espera o back() anterior assentar (senão ele comeria a entrada nova)
    let reusa = false;
    if (ov) {
      if (ov.dataset.folha === o.id) { fechar(); return; }   // 2º toque no gatilho fecha
      reusa = comHist; desmontar(true);                      // troca de folha (conta → Mais): a entrada do histórico é reaproveitada
    }
    ov = document.createElement("div");
    ov.className = "cb-folha-ov";
    ov.dataset.folha = o.id;
    ov.innerHTML = `<div class="cb-folha" id="cb-folha" role="dialog" aria-labelledby="cb-folha-titulo" tabindex="-1">
      <div class="cb-folha-topo">
        <h2 class="cb-folha-titulo" id="cb-folha-titulo">${esc(o.titulo)}</h2>
        <button type="button" class="cb-folha-x" data-folha-fechar aria-label="Fechar"><i class="ti ti-x" aria-hidden="true"></i></button>
      </div>
      <div class="cb-folha-corpo">${o.html}</div>
    </div>`;
    ov.addEventListener("click", e => {
      if (e.target === ov || e.target.closest("[data-folha-fechar]")) { fechar(); return; }
      if (o.aoClicar) o.aoClicar(e.target, e);
    });
    document.body.appendChild(ov);
    document.body.classList.add("cb-folha-on");
    inertizar(true);
    try {
      const st = Object.assign({ module: currentModule, param: null }, history.state || {}, { folha: o.id });
      if (reusa) history.replaceState(st, ""); else history.pushState(st, "");
      comHist = true;
    } catch (e) { comHist = false; }
    gatilhoFn = o.gatilho || null;
    const g = gatilhoFn ? gatilhoFn() : null;
    if (g) { g.setAttribute("aria-expanded", "true"); g.setAttribute("aria-controls", "cb-folha"); }
    document.addEventListener("keydown", onKey, true);   // captura: o Esc fecha só a folha
    const painel = ov.firstElementChild;
    try { painel.focus({ preventScroll: true }); } catch (e) {}
    const atual = painel.querySelector('[aria-current="page"]');   // módulo atual à vista ao abrir
    if (atual && atual.scrollIntoView) { try { atual.scrollIntoView({ block: "nearest" }); } catch (e) {} }
  }
  return { abrir, fechar, aoPopstate, aberta: () => !!ov };
})();
// Girou/alargou a tela: a folha é do celular e o chip da conta muda de papel (abre a folha × leva a
// Minha conta) — o aria-haspopup dele é recalculado. (addListener = Safari antigo.)
const aoMudarCorte = () => { FOLHA.fechar({ semFoco: true }); renderUserMenu(); };
if (MQ_CELULAR.addEventListener) MQ_CELULAR.addEventListener("change", aoMudarCorte);
else if (MQ_CELULAR.addListener) MQ_CELULAR.addListener(aoMudarCorte);
// Cruzou os 840 px: o badge do cabeçalho ganha/perde a data (renderUserMenu sai cedo sem sessão).
const aoMudarCabecalho = () => { renderUserMenu(); };
if (MQ_CAB_ESTREITO.addEventListener) MQ_CAB_ESTREITO.addEventListener("change", aoMudarCabecalho);
else if (MQ_CAB_ESTREITO.addListener) MQ_CAB_ESTREITO.addListener(aoMudarCabecalho);

// OS 4 ATALHOS DA BARRA INFERIOR — para trocar, mude esta lista E o HTML estático do #mobile-tabbar
// (app.html). O estático não é enfeite: se o app.html novo chegar com um js/app.js velho do cache
// (deploy recente), são esses botões que mantêm a barra funcionando. O espelho é TRAVADO por
// tests/tabbar-atalhos.check.mjs (mesmos ids, mesma ordem, mesmos nomes curtos). Cada id é um
// data-module do #module-nav: ícone e nome completo vêm de lá. Decisão de 17/set/2026 (reversível):
// Início · Assessor (pedido do fundador) · Cálculos · Custos + "Mais"; Técnicas e Compras passaram
// para dentro do Mais.
const TABBAR_ATALHOS = ["home", "assessor", "calculadoras", "sinapi"];
// Nome curto (cabe em ~70 px) para a barra e para o botão Mais quando ele mostra o módulo atual.
// Sem entrada aqui vale o rótulo do #module-nav, cortado com reticências pelo CSS. O curto deve
// LEMBRAR o nome do menu; quando não lembra ("Custos" × "SINAPI e CUB"), a folha mostra os dois
// (nomesNaFolha) — quem leu "Custos" na barra tem de achar "Custos" na folha.
const ROTULO_CURTO = {
  home: "Início", assessor: "Assessor", calculadoras: "Cálculos", sinapi: "Custos",
  seguranca: "Segurança", manutencao: "Manutenção", rdo: "Diário", tecnicas: "Técnicas", corpo: "Corpo téc.", conta: "Conta"
};
const semAcento = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// "Lembra" = as 4 primeiras letras do curto aparecem no nome do menu (Cálculos ~ Calculadoras,
// Técnicas ~ Ações técnicas). Não lembra → { nome: curto, sub: nome do menu }.
function nomesNaFolha(m) {
  const curto = ROTULO_CURTO[m.id];
  if (!curto || semAcento(m.rotulo).indexOf(semAcento(curto).slice(0, 4)) >= 0) return { nome: m.rotulo, sub: "" };
  return { nome: curto, sub: m.rotulo };
}
// Telas que existem no app mas NÃO estão no #module-nav — entram na folha "Mais" por aqui.
const TELAS_FORA_DO_MENU = [{ id: "conta", rotulo: "Minha conta", icone: "ti ti-user-circle" }];
// Agrupamento da folha "Mais". A lista de módulos NÃO mora aqui: vem do #module-nav (fonte única de
// rótulo, ícone e data-module). Módulo novo no menu do desktop que não esteja em nenhum grupo aparece
// sozinho em "Outros"; id sem módulo presente (ex.: corpo, para quem não é do corpo técnico) é ignorado.
// Grupos de 3 ou 6 fecham linhas inteiras na grade de 3 colunas (menos rolagem na folha).
const MAIS_GRUPOS = [
  { titulo: "Dia a dia", mods: ["home", "assessor", "calculadoras"] },
  { titulo: "Obra", mods: ["projetos", "rdo", "cronograma", "conferencia", "checklists", "seguranca"] },
  { titulo: "Consulta e custos", mods: ["normas", "materiais", "interacoes", "tecnicas", "sinapi", "compras"] },
  { titulo: "Laudos e pós-obra", mods: ["laudos", "avaliacao", "manutencao"] },
  { titulo: "Conta e equipe", mods: ["conta", "corpo"] }
];

const TABBAR = {
  // Lê o menu do desktop: [{ id, rotulo, icone }] na ordem em que aparece lá.
  modulos() {
    return Array.prototype.map.call(document.querySelectorAll("#module-nav button[data-module]"), b => {
      const i = b.querySelector("i.ti"), s = b.querySelector("span");
      return { id: b.dataset.module, rotulo: (s ? s.textContent : b.textContent).trim(), icone: i ? i.className : "ti ti-point" };
    });
  },
  rotulo(id) {
    const m = this.modulos().concat(TELAS_FORA_DO_MENU).find(x => x.id === id);
    return m ? m.rotulo : id;
  },
  // Redesenha os atalhos a partir de TABBAR_ATALHOS (o botão Mais é fixo no HTML).
  montar() {
    const bar = document.getElementById("mobile-tabbar"), mais = document.getElementById("tabbar-mais");
    if (!bar || !mais) return;
    const mods = this.modulos();
    bar.querySelectorAll("button[data-module]").forEach(b => b.remove());
    TABBAR_ATALHOS.forEach(id => {
      const m = mods.find(x => x.id === id);
      if (!m) return;   // atalho que não existe no menu: não inventa botão
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.module = id;
      b.innerHTML = `<i class="${esc(m.icone)}" aria-hidden="true"></i><span>${esc(ROTULO_CURTO[id] || m.rotulo)}</span>`;
      if (ROTULO_CURTO[id] && ROTULO_CURTO[id] !== m.rotulo) b.title = m.rotulo;   // nome completo como descrição; o nome acessível é o texto visível
      b.addEventListener("click", () => navigate(id));
      bar.insertBefore(b, mais);
    });
  },
  // Módulo atual fora dos atalhos → "Mais" fica ativo e mostra ONDE o usuário está (antes nenhum
  // botão acendia em 14 dos 19 módulos e o usuário perdia o "onde estou").
  marcar(module) {
    const mais = document.getElementById("tabbar-mais");
    if (!mais) return;
    const fora = TABBAR_ATALHOS.indexOf(module) < 0;
    const nome = this.rotulo(module), curto = ROTULO_CURTO[module] || nome;
    mais.classList.toggle("active", fora);
    // No celular o #module-nav está com display:none (fora da árvore de acessibilidade): o "onde
    // estou" de um módulo fora dos atalhos precisa estar na barra.
    if (fora) mais.setAttribute("aria-current", "true"); else mais.removeAttribute("aria-current");
    const sp = mais.querySelector("span");
    if (sp) sp.textContent = fora ? curto : "Mais";
    // O nome acessível CONTÉM o texto visível (WCAG 2.5.3) e diz o que o botão faz.
    mais.setAttribute("aria-label", fora
      ? `${curto}${nome !== curto ? " (" + nome + ")" : ""} — você está aqui. Abrir todos os módulos`
      : "Mais: abrir todos os módulos");
  },
  abrirMais() {
    const mods = this.modulos().concat(TELAS_FORA_DO_MENU), usados = {};
    const botao = m => {
      const n = nomesNaFolha(m);
      return `<button type="button" class="cb-folha-mod" data-ir="${esc(m.id)}"${m.id === currentModule ? ' aria-current="page"' : ""}><i class="${esc(m.icone)}" aria-hidden="true"></i><span>${esc(n.nome)}</span>${n.sub ? `<small>${esc(n.sub)}</small>` : ""}</button>`;
    };
    const bloco = (titulo, lista) => lista.length ? `<h3 class="cb-folha-grupo">${esc(titulo)}</h3><div class="cb-folha-grade">${lista.map(botao).join("")}</div>` : "";
    let html = MAIS_GRUPOS.map(g => bloco(g.titulo, g.mods.map(id => { usados[id] = 1; return mods.find(x => x.id === id); }).filter(Boolean))).join("");
    html += bloco("Outros", mods.filter(m => !usados[m.id]));   // módulo novo no menu, ainda sem grupo
    FOLHA.abrir({
      id: "mais", titulo: "Todos os módulos", html,
      gatilho: () => document.getElementById("tabbar-mais"),
      aoClicar: alvo => { const b = alvo.closest("[data-ir]"); if (b) navigate(b.dataset.ir); }   // navigate fecha a folha
    });
  }
};

// Menu da conta. Desktop: o chip segue levando direto a Minha conta (comportamento de sempre).
// Celular: abre a folha com nome, plano, Minha conta, Admin (se admin), feedback, tema e sair.
function contaMenu() {
  if (!MQ_CELULAR.matches) { navigate("conta"); return; }
  const sess = AUTH.session();
  if (!sess) return;
  const escuro = () => THEME.get() === "dark";
  const temaTxt = () => escuro() ? "Usar tema claro" : "Usar tema escuro";
  const html = `
    <div class="cb-folha-conta">
      <div class="user-avatar" aria-hidden="true">${esc(iniciaisDe(sess.nome))}</div>
      <div class="cb-folha-conta-txt">
        <div class="cb-folha-conta-nome">${esc(sess.nome)}</div>
        <div class="cb-folha-conta-email">${esc(sess.email || "")}</div>
      </div>
      <span class="badge-pro" title="Seu plano">${esc(planoRotulo(sess.plano, sess.planoAte))}</span>
    </div>
    <div class="cb-folha-lista">
      <button type="button" class="cb-folha-item" data-acao="conta"><i class="ti ti-user-circle" aria-hidden="true"></i><span>Minha conta</span><i class="ti ti-chevron-right cb-folha-seta" aria-hidden="true"></i></button>
      ${AUTH.isAdmin() ? `<a class="cb-folha-item" href="admin.html"><i class="ti ti-shield-lock" aria-hidden="true"></i><span>Painel administrativo</span><i class="ti ti-chevron-right cb-folha-seta" aria-hidden="true"></i></a>` : ""}
      <button type="button" class="cb-folha-item" data-acao="feedback"><i class="ti ti-message-2-heart" aria-hidden="true"></i><span>Avaliar / enviar feedback</span></button>
      <button type="button" class="cb-folha-item" data-acao="tema" aria-pressed="${escuro()}"><i class="ti ${escuro() ? "ti-sun" : "ti-moon-stars"}" aria-hidden="true"></i><span>${temaTxt()}</span></button>
      <button type="button" class="cb-folha-item perigo" data-acao="sair"><i class="ti ti-logout" aria-hidden="true"></i><span>Sair</span></button>
    </div>`;
  FOLHA.abrir({
    id: "conta", titulo: "Sua conta", html,
    gatilho: () => document.querySelector("#user-menu .user-chip"),   // o chip é re-renderizado a cada navigate
    aoClicar: (alvo, ev) => {
      // Link que SAI do app (Painel administrativo): fecha a folha, deixa o histórico assentar e só
      // então segue — senão a entrada da folha ficaria na pilha e o "voltar" do Admin cairia nela.
      const a = alvo.closest("a[href]");
      if (a && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey) {
        ev.preventDefault();
        FOLHA.fechar({ semFoco: true, depois: () => { window.location.href = a.href; } });
        return;
      }
      const b = alvo.closest("[data-acao]");
      if (!b) return;
      const acao = b.dataset.acao;
      if (acao === "conta") navigate("conta");
      else if (acao === "feedback") FOLHA.fechar({ semFoco: true, depois: () => { if (typeof fbAbrir === "function") fbAbrir(); } });
      else if (acao === "sair") { FOLHA.fechar({ semFoco: true, semHist: true }); AUTH.logout(); }   // a página está de saída: histórico fica como está
      else if (acao === "tema") {   // troca na hora e a folha fica aberta, para o usuário ver o resultado
        THEME.toggle();
        b.setAttribute("aria-pressed", String(escuro()));
        b.querySelector("i").className = "ti " + (escuro() ? "ti-sun" : "ti-moon-stars");
        b.querySelector("span").textContent = temaTxt();
      }
    }
  });
}

// ROLX — rolagem horizontal com indicação de continuidade (sub-abas, carrossel da Início, tabelas
// roláveis). Marca rolx-esq / rolx-dir conforme ainda há conteúdo daquele lado; o degradê é do CSS
// (só no celular). Nas sub-abas, mantém a aba ATIVA à vista — com uma linha rolável, abrir
// Custos → Mudanças (a 5ª aba) deixaria a aba ativa fora da tela. Um MutationObserver liga os
// contêineres conforme a SPA os desenha (inclusive renders assíncronos e modais).
const ROLX = (function () {
  const SEL = ".tabs-bar, .reco-row, .tbl-scroll, .aval-scroll, .sinapi-comp-scroll";
  const vivos = new Set();
  const medir = el => {
    const max = el.scrollWidth - el.clientWidth;
    el.classList.toggle("rolx-esq", el.scrollLeft > 4);
    el.classList.toggle("rolx-dir", max - el.scrollLeft > 4);
  };
  const ro = ("ResizeObserver" in window) ? new ResizeObserver(es => es.forEach(e => medir(e.target))) : null;
  function ativoAVista(el, suave) {
    if (!el.classList.contains("tabs-bar") || el.scrollWidth <= el.clientWidth + 1) return;
    const at = el.querySelector(":scope > .active, :scope > [aria-selected='true']");
    if (!at) return;
    const re = el.getBoundingClientRect(), ra = at.getBoundingClientRect();
    const alvo = el.scrollLeft + (ra.left - re.left) - (re.width - ra.width) / 2;
    el.scrollTo({ left: Math.max(0, alvo), behavior: suave ? "smooth" : "auto" });
  }
  function ligar(el) {
    el.dataset.rolx = "1";
    el.classList.add("cb-rolx");
    vivos.add(el);
    let tick = false;
    el.addEventListener("scroll", () => { if (tick) return; tick = true; requestAnimationFrame(() => { tick = false; medir(el); }); }, { passive: true });
    el.addEventListener("click", () => requestAnimationFrame(() => { ativoAVista(el, true); medir(el); }));
    if (ro) ro.observe(el);
    ativoAVista(el, false);
    medir(el);
  }
  function varrer() {
    vivos.forEach(el => { if (!el.isConnected) { vivos.delete(el); if (ro) ro.unobserve(el); } });   // não segura nó morto
    document.querySelectorAll(SEL).forEach(el => { if (el.dataset.rolx !== "1") ligar(el); else medir(el); });
  }
  let agendado = false;
  const agendar = () => { if (agendado) return; agendado = true; requestAnimationFrame(() => { agendado = false; varrer(); }); };
  function iniciar() {
    varrer();
    if ("MutationObserver" in window) new MutationObserver(agendar).observe(document.body, { childList: true, subtree: true });
  }
  return { iniciar, varrer };
})();

// ---------- Init ----------
// Chamado por cbInit (app.html) depois que AUTH.boot() resolve a sessão.
function initApp() {
  // Esconde a aba "Corpo técnico" para quem não é do corpo técnico (autor/editor/admin). a47 (19/set/2026): com o
  // perfil PROVISÓRIO (1º acesso no aparelho e o perfil ainda no ar: o papel é o padrão "user") a decisão espera o
  // perfil LIDO — antes, a aba sumia de um admin até o reload. Nunca lido: a aba fica, e a tela do corpo técnico
  // confere o papel ao abrir. (A folha "Mais" lê o #module-nav na hora; os atalhos da barra não incluem esta aba.)
  // a52 P2: a régua é a da CASCA (cbEhCorpoTecnico), não a do CONT — o js/conteudo.js só chega quando a aba
  // abre, e "typeof CONT === undefined" deixaria a aba visível para todo mundo.
  cbDepoisDoPerfil(() => {
    if (!cbEhCorpoTecnico()) {
      const b = document.getElementById("nav-corpo"); if (b) b.remove();
    }
  });
  TABBAR.montar();   // barra inferior a partir de TABBAR_ATALHOS + #module-nav
  ROLX.iniciar();
  _navPop = true; navigate("home"); _navPop = false;
  try { history.replaceState({ module: "home", param: null }, "", "#home"); } catch (e) {}
  // 0098: recado da landing (plano pago com pagamentos desligados). a47: o texto fala do plano da conta — espera o lido.
  cbDepoisDoPerfil(() => { try { cbAvisoPlanoDaLanding(); } catch (e) { console.error("aviso de plano:", e); } });
}
// a47: decisão que depende do perfil (papel, plano) espera o perfil LIDO (js/auth.js, depoisDoPerfil). Sem essa
// função (js/auth.js antigo no cache junto de um js/app.js novo), decide na hora, como antes.
function cbDepoisDoPerfil(fn) {
  if (typeof AUTH !== "undefined" && typeof AUTH.depoisDoPerfil === "function") AUTH.depoisDoPerfil(fn);
  else fn();
}
