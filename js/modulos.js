// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).

// a52 passo 2 (21/set/2026) — OS MÓDULOS DO APP CHEGAM AO CLICAR, não na abertura.
//
// POR QUE EXISTE. Medido em 21/set/2026 no navegador do fundador: a 1ª abertura do app.html depois de publicar
// levou 15,2 s até o boot começar, e a primeira visita pede 82 arquivos / ~1.041 KB, boa parte deles de módulos
// que a primeira tela nunca toca. No REPOSITÓRIO, com o método do cabeçalho de tests/abertura.check.mjs (LF +
// gzip -9), o que saiu daqui são 39 arquivos / 256.006 B comprimidos, de 74 subrecursos para 36. Compilar os 72
// JS custava 20-23 ms: o gargalo não é interpretar, é a FILA de pedidos — e ela é paga inteira em toda abertura
// depois de cada publicação (o carimbo da a52 P0 troca a URL de todo subrecurso, então nenhum vem do cache).
//
// O DESENHO É O DA a51 (js/parametrico.js + tests/abertura.check.mjs), repetido por MÓDULO:
//   · ARQUIVOS: o registro caminho → pronto(). pronto() responde "este arquivo JÁ rodou nesta página?" olhando o
//     global que ele define — é o que torna o carregamento idempotente e o que reconhece o app.html ANTIGO do
//     service worker (aquele ainda traz os <script> síncronos: nada é baixado de novo).
//   · POR_MODULO: para cada id do mapa `views` do js/app.js, os arquivos daquele módulo NA ORDEM em que precisam
//     rodar (dado antes do código que o usa, e a fábrica js/colecao.js antes de quem a chama no topo). Arquivo
//     compartilhado aparece em mais de uma lista — quem deduplica é o pronto(), não uma terceira lista. A lista
//     INTEIRA, na ordem, é EXECUTADA pela régua M14 do tests/abertura.check.mjs num sandbox que só tem a casca do
//     app.html: qualquer "X is not defined" reprova. Foi assim que se achou, em 21/set/2026, que Custos, Meus
//     projetos, Diário de Obra e Cronograma não abriam — a fábrica de coleções morava no arquivo de outro módulo.
//   · GRUPOS: conjuntos que não são módulo. `busca`, os catálogos que o índice da busca global do cabeçalho
//     varre (js/app.js, buildIndex) — ela passou a indexar o que está carregado e a completar o índice quando a
//     pessoa foca o campo, no mesmo espírito do ensureSinapiData que já morava lá; e `mnt-alerta`, o único
//     pedaço de módulo de que a PRIMEIRA TELA precisa (o badge de OSs vencidas). Grupo é sempre um pedaço
//     MENOR que o módulo, para um uso declarado: quem abre a tela do módulo passa pelo POR_MODULO inteiro.
//
// DOWNLOAD EM PARALELO, EXECUÇÃO NA ORDEM (`async = false`), que é a diferença para o ensureParamData da a51.
// Lá a série estrita existe porque cada tipologia é independente e o que chegou FICA USÁVEL sozinho; aqui um
// módulo pela metade não abre tela nenhuma, e 10 arquivos em série seriam 10 idas à rede. Então os <script> vão
// todos de uma vez com `async = false` (o navegador baixa junto e executa na ordem de entrada) e a falha de UM é
// a falha do módulo. O que JÁ rodou continua valendo: o "Tentar de novo" só pede o que ainda falta (pronto()).
//
// DUAS CLASSES DE FALHA, duas frases (a lição da a51, 19/set/2026): "rede" (o arquivo não chegou) manda conferir
// a conexão; "conteudo" (chegou e não definiu o que devia — cópia guardada com defeito, proxy, portal de wi-fi)
// manda fechar e abrir o app. Mandar "verifique a conexão" a quem está com a conexão boa põe a pessoa num laço.
// Tela de falha SEMPRE com "Tentar de novo" — nunca tela vazia, nunca "Carregando…" eterno.
//
// CARIMBO DE VERSÃO (a52 P0): os caminhos aqui são literais INTEIROS de propósito. Na publicação,
// tools/carimbar-versao.ts reescreve TODOS eles para `…?v=<sha>` (regra CARIMBO_TODO_LITERAL, este arquivo), de
// uma vez e nos dois lugares (chave de ARQUIVOS e item de POR_MODULO/GRUPOS), porque é a mesma substituição de
// texto. Sem carimbo, um módulo pedido hoje viria da borda do Cloudflare com até 4 h de atraso. Caminho montado
// por concatenação ou template NÃO pode existir aqui: a ferramenta reprova, e é bom que reprove.
//
// MÓDULO NOVO no app = uma entrada em POR_MODULO e as entradas dos arquivos em ARQUIVOS. Travado por
// tests/abertura.check.mjs (seção M), que DERIVA a lista de módulos do mapa `views` do js/app.js e a lista de
// arquivos deste registro — nunca de uma cópia à mão.
//
// LIMITES DECLARADOS:
//   · pedido que nunca responde (nem onload nem onerror) deixa o "Carregando…" até o navegador desistir — o mesmo
//     do ensureSinapiData e do ensureParamData;
//   · offline sem service worker, quem nunca abriu o módulo não o tem guardado (antes vinha em toda abertura):
//     vê a tela de falha com Tentar de novo;
//   · js/parametrico.js NÃO entra aqui de propósito (ver o comentário em POR_MODULO.sinapi).

const MODULOS = (function () {
  "use strict";

  // ── o registro: caminho → "já rodou?" ─────────────────────────────────────────────────────────────────────
  // O global escolhido é o que o arquivo define no topo. typeof antes de o script rodar é "undefined" (a ligação
  // nem existe), o que é exatamente a pergunta.
  const ARQUIVOS = {
    // Infraestrutura compartilhada: a fábrica de coleções offline-first, que cinco módulos chamam NO TOPO dos
    // seus arquivos. Mora sozinha em js/colecao.js desde 21/set/2026 — ver o cabeçalho de lá.
    "js/colecao.js?v=cd8b896": function () { return typeof cbColecao === "function"; },
    "js/assistente.js?v=cd8b896": function () { return typeof ASSIST !== "undefined"; },
    "data/normas.js?v=cd8b896": function () { return typeof NORMAS !== "undefined"; },
    "data/cub.js?v=cd8b896": function () { return typeof CUB_RAW !== "undefined"; },
    "js/cub.js?v=cd8b896": function () { return typeof CUBDB !== "undefined"; },
    "js/orcamento.js?v=cd8b896": function () { return typeof ORC !== "undefined"; },
    "js/sinapi-changelog.js?v=cd8b896": function () { return typeof renderSinapiChangelog === "function"; },
    "data/avaliacao.js?v=cd8b896": function () { return typeof AVAL_FATORES !== "undefined"; },
    "js/avaliacao.js?v=cd8b896": function () { return typeof AVAL !== "undefined"; },
    "data/nrs.js?v=cd8b896": function () { return typeof NRS !== "undefined"; },
    "js/seguranca.js?v=cd8b896": function () { return typeof renderSegTrab === "function"; },
    "data/manutencao.js?v=cd8b896": function () { return typeof PLANO_MANUTENCAO !== "undefined"; },
    "data/garantias.js?v=cd8b896": function () { return typeof GARANTIAS !== "undefined"; },
    "data/exemplo-obra.js?v=cd8b896": function () { return typeof EXEMPLO_OBRA !== "undefined"; },
    "js/exemplo.js?v=cd8b896": function () { return typeof EXEMPLO !== "undefined"; },
    "js/manutencao.js?v=cd8b896": function () { return typeof MNT !== "undefined"; },
    "js/garantias.js?v=cd8b896": function () { return typeof GAR !== "undefined"; },
    "js/manutencao2.js?v=cd8b896": function () { return typeof ATV !== "undefined"; },
    "js/conformidade.js?v=cd8b896": function () { return typeof GREG !== "undefined"; },
    "js/manual.js?v=cd8b896": function () { return typeof MANUAIS !== "undefined"; },
    "js/manutencao-sla.js?v=cd8b896": function () { return typeof SLA !== "undefined"; },
    "js/projetos.js?v=cd8b896": function () { return typeof PROJ !== "undefined"; },
    "js/pdfviewer.js?v=cd8b896": function () { return typeof PDFV !== "undefined"; },
    "js/diario-motor.js?v=cd8b896": function () { return typeof DIARIO_MOTOR !== "undefined"; },
    "js/rdo.js?v=cd8b896": function () { return typeof RDO !== "undefined"; },
    "js/diario.js?v=cd8b896": function () { return typeof RAO_UI !== "undefined"; },
    "js/cronograma.js?v=cd8b896": function () { return typeof CRONO !== "undefined"; },
    "data/conferencia.js?v=cd8b896": function () { return typeof CONFERENCIA !== "undefined"; },
    "js/conferencia.js?v=cd8b896": function () { return typeof CONF !== "undefined"; },
    "js/conferencia-ia.js?v=cd8b896": function () { return typeof CONFER !== "undefined"; },
    "data/interacoes.js?v=cd8b896": function () { return typeof INTERACOES !== "undefined"; },
    "js/interacoes.js?v=cd8b896": function () { return typeof NIVEL_INFO !== "undefined"; },
    "data/tecnicas.js?v=cd8b896": function () { return typeof TECNICAS !== "undefined"; },
    "js/tecnicas.js?v=cd8b896": function () { return typeof areaTecnica === "function"; },
    "data/compras.js?v=cd8b896": function () { return typeof COMPRAS_ITENS !== "undefined"; },
    "js/compras.js?v=cd8b896": function () { return typeof renderCompras === "function"; },
    "js/conteudo.js?v=cd8b896": function () { return typeof CONT !== "undefined"; },
    "js/biblioteca.js?v=cd8b896": function () { return typeof BIBLIO !== "undefined"; },
    "js/referencias.js?v=cd8b896": function () { return typeof REF !== "undefined"; },
    "js/conta.js?v=cd8b896": function () { return typeof CONTA !== "undefined"; }
  };

  // ── os módulos, pelos ids do mapa `views` do js/app.js ────────────────────────────────────────────────────
  // Só entra aqui o módulo que tem arquivo próprio para baixar. Módulo cuja tela inteira mora no js/app.js e nos
  // catálogos da casca (home, calculadoras, checklists) não aparece — e a régua M cobra os dois sentidos.
  const POR_MODULO = {
    assessor: ["js/assistente.js?v=cd8b896"],
    normas: ["data/normas.js?v=cd8b896"],
    // Custos: CUB, Orçamento e o changelog do SINAPI são sub-abas desta tela (js/app.js, renderSinapi).
    // js/parametrico.js FICA FORA, declarado: ele é o caso da a51 e tem a ponte de compatibilidade do app.html
    // (<script id=cb-ponte-parametrico>), que só funciona com a tag do parametrico carregada pela PÁGINA antes
    // dela — tirá-lo daqui mataria a ponte em silêncio. São 15,7 KB que saem quando a ponte sair, com régua
    // própria. (O caminho dele não aparece aqui entre aspas de propósito: a regra CARIMBO_TODO_LITERAL carimba
    // todo literal deste arquivo e não distingue código de comentário — carimbar um caminho dentro de um
    // comentário é inofensivo, mas inflava a contagem que sustenta o piso `minimo`.)
    // data/exemplo-obra.js + js/exemplo.js: o js/orcamento.js chama EXEMPLO.* (o "Ver exemplo" da barra e o do
    // aviso de plano). Eles aparecem em 4 listas — quem deduplica é o pronto(), não uma lista à parte.
    // js/colecao.js vem PRIMEIRO: o js/orcamento.js chama cbColecao() na primeira linha de código dele. Sem
    // este arquivo antes, o Custos abria com ReferenceError (revisão de 21/set/2026 — ver js/colecao.js).
    sinapi: ["js/colecao.js?v=cd8b896", "data/exemplo-obra.js?v=cd8b896", "js/exemplo.js?v=cd8b896", "data/cub.js?v=cd8b896", "js/cub.js?v=cd8b896", "js/orcamento.js?v=cd8b896", "js/sinapi-changelog.js?v=cd8b896"],
    materiais: ["js/referencias.js?v=cd8b896"],
    laudos: ["js/referencias.js?v=cd8b896"],
    avaliacao: ["data/avaliacao.js?v=cd8b896", "js/avaliacao.js?v=cd8b896"],
    seguranca: ["data/nrs.js?v=cd8b896", "js/seguranca.js?v=cd8b896"],
    // js/conferencia-ia.js (CONFER): o cartão "conferir contra as normas" é DESENHADO junto com a garantia
    // registrada, com o projeto e com o RDO — não é botão, é parte da tela. Sem ele o cartão some em silêncio.
    manutencao: [
      "js/colecao.js?v=cd8b896", "data/manutencao.js?v=cd8b896", "data/garantias.js?v=cd8b896", "data/exemplo-obra.js?v=cd8b896", "js/exemplo.js?v=cd8b896",
      "js/manutencao.js?v=cd8b896", "js/garantias.js?v=cd8b896", "js/manutencao2.js?v=cd8b896", "js/conformidade.js?v=cd8b896",
      "js/pdfviewer.js?v=cd8b896", "js/conferencia-ia.js?v=cd8b896", "js/manual.js?v=cd8b896", "js/manutencao-sla.js?v=cd8b896"
    ],
    projetos: ["js/colecao.js?v=cd8b896", "js/pdfviewer.js?v=cd8b896", "js/conferencia-ia.js?v=cd8b896", "js/projetos.js?v=cd8b896"],
    // O RDO é o módulo mais pesado, e é assumido: o gerador de RAO/RSO (js/diario.js) fecha a obra INTEIRA —
    // lê as obras (PROJ), o orçamento (ORC) e o cronograma (CRONO) para calcular a EAP ponderada da capa. Sem
    // eles o documento sairia com a capa zerada e sem aviso nenhum. O seletor de obra do próprio RDO também
    // depende de PROJ.
    rdo: [
      "js/colecao.js?v=cd8b896", "data/exemplo-obra.js?v=cd8b896", "js/exemplo.js?v=cd8b896", "js/diario-motor.js?v=cd8b896", "js/pdfviewer.js?v=cd8b896",
      "js/conferencia-ia.js?v=cd8b896", "js/projetos.js?v=cd8b896", "js/orcamento.js?v=cd8b896", "js/cronograma.js?v=cd8b896",
      "js/rdo.js?v=cd8b896", "js/diario.js?v=cd8b896"
    ],
    // (o Cronograma lê as obras por PROJ; js/pdfviewer.js e js/conferencia-ia.js vêm de carona porque o
    //  js/projetos.js os usa — o registro fecha por ARQUIVO, não por chamada, e é mais barato trazer 6,5 KB
    //  do que confiar num typeof que degrada calado.)
    cronograma: ["js/colecao.js?v=cd8b896", "data/exemplo-obra.js?v=cd8b896", "js/exemplo.js?v=cd8b896", "js/pdfviewer.js?v=cd8b896", "js/conferencia-ia.js?v=cd8b896", "js/projetos.js?v=cd8b896", "js/cronograma.js?v=cd8b896"],
    conferencia: ["data/conferencia.js?v=cd8b896", "js/conferencia.js?v=cd8b896", "js/conferencia-ia.js?v=cd8b896"],
    interacoes: ["data/interacoes.js?v=cd8b896", "js/interacoes.js?v=cd8b896"],
    tecnicas: ["data/tecnicas.js?v=cd8b896", "js/tecnicas.js?v=cd8b896"],
    compras: ["data/compras.js?v=cd8b896", "js/compras.js?v=cd8b896"],
    corpo: ["js/pdfviewer.js?v=cd8b896", "js/biblioteca.js?v=cd8b896", "js/referencias.js?v=cd8b896", "js/conteudo.js?v=cd8b896"],
    conta: ["js/conta.js?v=cd8b896"]
  };

  // ── grupos que não são módulo ─────────────────────────────────────────────────────────────────────────────
  // `busca`: os catálogos que o índice da busca global varre (js/app.js, buildIndex). SÓ os data/*.js — trazer o
  // js/ dos módulos junto devolveria ~60 KB à abertura pela porta dos fundos.
  const GRUPOS = {
    busca: [
      "data/normas.js?v=cd8b896", "data/cub.js?v=cd8b896", "data/manutencao.js?v=cd8b896", "data/conferencia.js?v=cd8b896",
      "data/tecnicas.js?v=cd8b896", "data/interacoes.js?v=cd8b896", "data/compras.js?v=cd8b896", "data/garantias.js?v=cd8b896"
    ],
    // `mnt-alerta`: o aviso de OSs vencidas da Início (renderMntAlert, js/app.js) é a ÚNICA coisa da PRIMEIRA
    // TELA que depende de um módulo. Ele só chama MNT.ready() e MNT.osAtencao(), que tocam o CBStore e o
    // window.supa — ambos da casca. Pedir o módulo Manutenção INTEIRO por causa de um badge custava 12
    // arquivos / 56,1 KB comprimidos a mais na home de TODA conta PRO (achado da revisão de 21/set/2026: a
    // conta pagante pagava mais da metade do que o passo 2 economizou). Abrir a Manutenção continua trazendo
    // os 13 — quem deduplica é o pronto(). A régua M12 do tests/abertura.check.mjs deriva este grupo dos
    // globais que o corpo do renderMntAlert lê, nos dois sentidos.
    "mnt-alerta": ["js/manutencao.js?v=cd8b896"]
  };

  const _emCurso = Object.create(null);   // caminho → promessa do <script> que está vindo
  const _ouvintes = [];                   // chamados quando algo novo passou a valer (a busca reconstrói o índice)
  function avisar() { for (let i = 0; i < _ouvintes.length; i++) { try { _ouvintes[i](); } catch (e) {} } }

  function pronto(caminho) {
    const f = ARQUIVOS[caminho];
    if (!f) return false;
    try { return !!f(); } catch (e) { return false; }
  }
  function erro(motivo, src) { const e = new Error(motivo + ": " + src); e.motivo = motivo; return e; }

  // Um <script> com async = false: o navegador baixa em paralelo com os outros e EXECUTA na ordem em que foram
  // inseridos. É o mesmo que a ponte do app.html faz desde a a51.
  function baixar(src) {
    if (_emCurso[src]) return _emCurso[src];
    const p = new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.async = false;
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { try { s.remove(); } catch (e) {} reject(erro("rede", src)); };
      document.head.appendChild(s);
    });
    // A promessa some quando termina: a próxima tentativa (o "Tentar de novo") pede de novo o que faltou.
    const limpar = function () { delete _emCurso[src]; };
    p.then(limpar, limpar);
    _emCurso[src] = p;
    return p;
  }

  /** Baixa o que falta da lista. Falha de rede em qualquer arquivo, ou arquivo que chegou sem definir o que devia,
   *  rejeitam com `motivo`. Nada a fazer → promessa já resolvida (nenhum await desnecessário na tela).
   *
   *  ESPERA TODOS TERMINAREM, não o primeiro que falha (correção de 21/set/2026, achado da revisão). O lote que
   *  chega PELA METADE ainda vale para quem espera: dos 8 catálogos do grupo `busca`, 7 chegaram e 1 não — os 7
   *  JÁ estão na página e têm de entrar no índice. Com o corte no primeiro erro (Promise.all cru), o aviso nunca
   *  saía, o índice ficava o do boot e a busca respondia "Nada encontrado" para catálogo que estava carregado. */
  function garantirLista(lista) {
    const falta = lista.filter(function (p) { return !pronto(p); });
    if (!falta.length) return Promise.resolve();
    let deRede = null;
    return Promise.all(falta.map(function (p) {
      return baixar(p).then(null, function (e) { if (!deRede) deRede = e; });
    })).then(function () {
      // Quem chegou e não definiu o que devia (resposta errada, cópia com defeito) é outra classe de falha.
      const mudo = falta.filter(function (p) { return !pronto(p); });
      if (mudo.length < falta.length) avisar();   // algo novo passou a valer, mesmo que o lote tenha falhado
      if (deRede) throw deRede;
      if (mudo.length) throw erro("conteudo", mudo.join(", "));
    });
  }

  function faltam(id) { return (POR_MODULO[id] || []).filter(function (p) { return !pronto(p); }); }
  function garantir(id) { return garantirLista(POR_MODULO[id] || []); }
  function garantirGrupo(nome) { return garantirLista(GRUPOS[nome] || []); }
  function faltaGrupo(nome) { return (GRUPOS[nome] || []).filter(function (p) { return !pronto(p); }); }
  function aoCarregar(fn) { if (typeof fn === "function") _ouvintes.push(fn); }

  // ── as telas ──────────────────────────────────────────────────────────────────────────────────────────────
  // O texto do "Carregando…" é CURTO de propósito: o tests/e2e/celular.spec.js só considera a tela desenhada
  // acima de 20 caracteres, e assim ele não mede o intervalo em vez do conteúdo.
  // role="status" (aria-live polite): o navigate() põe o foco no <main> ao trocar de tela, e sem isto quem usa
  // leitor de tela ouviria silêncio durante todo o download do módulo.
  function carregandoHTML() { return `<p class="page-sub" role="status">Carregando…</p>`; }

  function motivoTexto(motivo) {
    return motivo === "conteudo"
      ? "chegou incompleto — a cópia guardada no aparelho tem defeito. Feche e abra o app para buscar uma cópia nova."
      : "não chegou. Verifique a conexão e tente de novo.";
  }
  function falhaHTML(motivo) {
    return `<div class="card" style="max-width:560px;margin:30px auto;text-align:center;padding:28px">
      <p style="color:var(--text-2);margin:0 0 16px">Este módulo ${motivoTexto(motivo)}</p>
      <button type="button" class="btn primary" onclick="cbTentarModulo()"><i class="ti ti-refresh"></i> Tentar de novo</button>
    </div>`;
  }

  return {
    faltam: faltam, garantir: garantir, garantirGrupo: garantirGrupo, faltaGrupo: faltaGrupo,
    pronto: pronto, aoCarregar: aoCarregar,
    carregandoHTML: carregandoHTML, falhaHTML: falhaHTML, motivoTexto: motivoTexto,
    // Só para as réguas do tests/abertura.check.mjs (a lista tem de ser DERIVADA do código, nunca copiada).
    _ARQUIVOS: ARQUIVOS, _POR_MODULO: POR_MODULO, _GRUPOS: GRUPOS
  };
})();
if (typeof window !== "undefined") window.MODULOS = MODULOS;
