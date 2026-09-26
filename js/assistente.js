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
//       chega: um focus() segundos depois abre o teclado do celular por cima da resposta. Desde a
//       revisão de 21/set/2026 (abaixo) isso vale SÓ NO COMPUTADOR: em aparelho de toque o código
//       nunca devolve o foco ao campo.
//
// 21/set/2026 — REVISÃO DO CELULAR. Relato do fundador, com 3 prints do Android dele (app instalado, ~369 px):
//   "muita informação e, quando obtém a resposta, está ruim de scrollar". Medido antes, a 369x800: a conversa
//   tinha 46% da altura; a caixa de escrita media 210 px (56 deles eram a faixa do botão do WhatsApp); o botão
//   verde ficava EM CIMA da linha do texto; depois de enviar, o foco voltava ao campo, o teclado reabria e a
//   caixa (sticky no rodapé do layout viewport) ficava ATRÁS dele; e, no fim da rolagem, a caixa cobria 50 px
//   do fim do fio (o botão Copiar da última resposta inteiro). O que mudou:
//     · TECLADO: API visualViewport SÓ nesta tela (_ligarTeclado/_vvAplicar). O meta viewport do app.html
//       (interactive-widget) NÃO foi tocado: é global, mexeria em toda tela com campo sem aparelho para provar,
//       e o iOS o ignora — o código do visualViewport seria necessário de todo jeito. Com o campo em foco o
//       body ganha a classe ia-teclado: a barra de abas some (só sob :has(.ia-chat)) e a caixa sobe --ia-kb px,
//       a parte do layout viewport que o teclado cobre (0 onde o layout encolhe junto com o teclado). A classe
//       liga no FOCO, nunca no pointerdown/touchstart (a caixa desceria 60 px entre o toque e o foco, e o toque
//       cairia fora do campo) nem por :has(:focus) (o toque no microfone ou na câmera perderia o clique);
//     · TOQUE: o foco NUNCA volta ao campo por código (envio, chegada da resposta, sugestão, abrirCom). Toda
//       chamada de foco do arquivo mora em _focoCampo (que sai cedo em aparelho de toque) e em _focoTroca;
//     · ROLAGEM: continua sendo a da PÁGINA (uma só). No envio a troca nova vai ao ALTO da tela (a última troca
//       tem min-height igual à altura de leitura: é o que dá curso à página); na chegada da resposta só o balão
//       é redesenhado (_renderTroca) e a tela NÃO anda; se a pessoa saiu dali, o #ia-fim vira "Nova resposta";
//       longe do fim (160 px), ele é a seta que leva ao fim. Todo scrollIntoView/scrollTo daqui traz behavior
//       EXPLÍCITO: o html{scroll-behavior:smooth} global deixaria suave o que tem de ser imediato;
//     · MENOS MOLDURA: aviso legal de uma linha (o texto inteiro no MESMO <details>, a um toque), placeholder
//       curto, campo de uma fileira em repouso, "Esquemas gerados" num botão da linha do título (painel acima
//       do fio, fechado por padrão), chips de contexto em pílula, "Nova conversa" só com o ícone (no celular
//       pede um 2º toque em 3 s: o botão ficou pequeno e no canto, e apagar a conversa não tem volta);
//     · o botão do WhatsApp sai desta tela até 1023 px (css); não há entrada substituta aqui — ele segue, o
//       mesmo botão flutuante, em todas as outras telas. Por isso nenhum texto DESTA tela manda a pessoa ao
//       WhatsApp (o aviso do ditado mandava, e o botão já não estava à vista).
//   Depois da revisão adversarial da mesma entrega (21/set):
//     · a altura do LAYOUT viewport não é window.innerHeight — no Chrome do Android ele acompanha o VISUAL
//       viewport, e a conta do teclado dava sempre 0. Quem mede é _layoutH(): uma sonda position:fixed de alto
//       a baixo (#ia-sonda; é o próprio quadro em que o rodapé sticky se apoia), com reserva no clientHeight;
//     · o microfone NÃO muda de lugar quando o campo troca de uma para duas fileiras (no 1º toque o botão
//       ganhava o foco, o campo virava, o microfone ia para a esquerda e o clique caía no vão), e o toque
//       nele não tira o foco do campo (mousedown evitado, como no Enviar);
//     · o campo tem 16 px no celular: abaixo disso o Safari do iPhone dá zoom ao focar, e com zoom a conta do
//       teclado responde "não sei" (a caixa não acompanharia o teclado);
//     · "a troca ainda está no alto?" mede contra a ALTURA do cabeçalho (a mesma do scroll-margin-top), esteja
//       ele preso ou não: no modo teclado ele é static, a conta dava "saiu dali" e nascia um "Nova resposta"
//       com a resposta na tela;
//     · a altura de leitura da última troca só vale com a caixa de escrita (.ia-com-caixa): na tela do convite
//       do Gratuito com conversa ela empurrava o botão do convite para trás da barra de abas;
//     · o cabeçalho do app só se solta no modo teclado até 640 px (num tablet ele sumia e não há barra de abas).
//   Depois da 2ª revisão adversarial (21/set), cada item reproduzido antes do conserto (preview ou relógio falso):
//     · "voltar" do Android a menos de 1 s do foco: a guarda de 1 s segurava o desligamento e não vinha mais evento
//       do visual viewport — o modo ficava ligado com o teclado fechado e o toque seguinte no campo tirava o foco
//       (toque morto). _vvAplicar refaz a conferência quando a guarda vence;
//     · o X do chip (contexto, projeto) e o da foto APAGAM o botão que tinha o foco: o foco cai no <body> e, conforme
//       o navegador, sem focusout — quem apaga chama _seFocoSaiu() (o mesmo prazo do focusout da caixa);
//     · "Nova resposta" só para quem SAIU dali: a rolagem suave do envio ainda a caminho (computador, resposta
//       rápida) não conta (_aCaminho), e a resposta de uma conversa APAGADA durante a espera não redesenha, não
//       oferece nem anuncia nada;
//     · o link do desenho (app.html: navigate ANTES de abrirEsquema) cancela a âncora da conversa restaurada por
//       senha (_ancoraSeq) — a marca ligada antes do render nunca valia no caminho real;
//     · chips de contexto/projeto: no celular a frase tem abertura CURTA e o NOME fica sempre à vista (sobravam
//       38 px para ele); o toque abre o chip;
//     · celular DEITADO: com até 500 px de altura o cabeçalho também se solta no modo teclado (a caixa subia para
//       trás dele), e o campo tem 16 px em todo aparelho de toque (pointer: coarse), não só até 640 px;
//     · o cursor só vai ao fim do texto DENTRO de _focoCampo (sem toque): mexer na seleção de um campo sem foco
//       dava o foco a ele em WebKit antigo.
//   LIMITES (declarados): nada disto foi visto em aparelho real — o teclado só tem dublê (ASSIST._vv e a sonda)
//   e janela encolhida; no iOS a caixa acompanha o teclado com o atraso do evento; navegador sem :has() fica
//   como antes (a barra não some, nada quebra); resposta curta deixa um vazio embaixo, como nos chats
//   conhecidos; janela de computador com até 640 px conta como toque (sem refoco); onde o LAYOUT encolhe junto
//   com o teclado (navegador antigo) o "voltar" do Android não é percebido — a barra de abas volta no próximo
//   toque fora da caixa (ou quando o foco sai dela); com o celular deitado o teclado deixa ~170 px e a caixa do
//   computador (172 px) ocupa a janela inteira — o campo fica à vista, a conversa não. Travado em
//   tests/assessor-celular.check.mjs.
//
// 18/set/2026 — IA FORA DO GRATUITO (decisão do fundador; o servidor dá cota 0 ao Gratuito e nega com
//   motivo "plano", ver supabase/functions/_shared/cota.ts). Para o gratuito não escrever a pergunta e só
//   depois dar com a porta na cara, a caixa de escrita vira o CONVITE (cbConviteIAHTML, js/app.js) quando o
//   plano EFETIVO da sessão é gratuito. O fio antigo e os esquemas continuam visíveis. Se a sessão estiver
//   velha (acha que é PRO) e o servidor responder "plano", a caixa vira o convite na hora (_semIAServidor,
//   amarrado ao plano da sessão de então: mudou o plano — teste ativado, cortesia —, o convite some).
//
// a65 (24/set/2026) — A RESPOSTA NÃO SE PERDE QUANDO A PESSOA SAI DO APP. Relato do fundador, Android, no
//   dia da publicação: perguntou, saiu do app enquanto esperava, voltou e leu "Não foi possível consultar
//   agora. Tente novamente em instantes." A pergunta tinha sumido; ele reescreveu e a 2ª vez funcionou. No
//   celular ninguém fica olhando a tela parado por 20 s — sair é o comportamento NORMAL, não a exceção.
//   O QUE ACONTECIA, no código de então (medido, não suposto):
//     · o fetch para o ai-gateway não tinha AbortController, não tinha prazo e ninguém olhava a
//       visibilidade da página. O Chrome do Android CONGELA a aba em segundo plano e pode DESCARTÁ-LA (o
//       PWA instalado idem); o pedido em voo morre com ela e a promessa rejeita;
//     · a frase que ele leu nasce no `catch` — ou seja, FALHA DE REDE/promessa rejeitada, nunca resposta de
//       erro do servidor (o ramo `!r.ok` tem frase própria). Só que a mesma frase servia a três mundos
//       diferentes: "você saiu do app", "sem internet" e "demorou demais";
//     · e a pergunta não era guardada: `_persist()` só corria no `finally`, que numa página DESCARTADA
//       nunca chega a rodar. Sem rastro no sessionStorage, voltar ao app não tinha o que oferecer.
//   O QUE MUDOU AQUI (front; nada disto depende de deploy de função):
//     1. a troca vai ao sessionStorage com `pendente: true` ANTES do envio. Página descartada e recarregada
//        volta com a pergunta na tela e a oferta de repetir, em vez de um "Consultando…" eterno;
//     2. AbortController com prazo (_PRAZO_MS), e o prazo conta SÓ o tempo em que a página esteve à vista:
//        o relógio para ao esconder e recomeça ao voltar. Assim a espera termina com frase honesta em vez
//        de ficar pendurada, e o pedido que SOBREVIVEU ao congelamento nunca é morto pelo próprio app por
//        causa do tempo em que ninguém estava olhando. O número é o piso derivado do teto REAL do servidor
//        MAIS uma margem declarada (ver _PRAZO_MS), não os 60 s de uma chamada só; e o prazo cobre TAMBÉM a
//        espera do getSession, cuja trava o SDK pede sem prazo nenhum (_corrida);
//     3. UMA FRASE POR CLASSE do erro (c9: a frase sai da classe, nunca do servidor), porque a pessoa faz
//        coisas diferentes em cada caso — a lição das duas frases da a52 P2: saiu do app · sem conexão ·
//        a internet caiu no meio · demorou · cancelada por outra pergunta;
//     4. "Tentar de novo" é BOTÃO, nunca reenvio automático: ver a cota, abaixo. E o CONVITE da frase sai
//        do mesmo teste que desenha o botão, para o texto nunca mandar tocar no que não está lá;
//     5. UMA consulta em voo por vez: pergunta nova cancela a anterior, em vez de deixá-la pendurada — e o
//        voo é registrado ANTES do primeiro await, senão a janela da trava do getSession devolvia a órfã.
//   A COTA FOI GASTA? FOI (medido no servidor, 24/set/2026): o `ia_uso.insert` do
//   _shared/assessor.ts roda DEPOIS da chamada ao modelo e ANTES de o ai-gateway serializar a resposta. Se
//   a função completou e só a volta se perdeu, a pessoa PAGOU tokens e queimou 1 das 100 do mês sem ver
//   nada. Por isso as frases de "fundo" e de "prazo" DIZEM que a consulta pode ter contado na cota (é
//   ressalva, não afirmação: daqui não há como saber), e por isso o reenvio é um toque explícito — um
//   retry automático dobraria o gasto sem ninguém pedir. NÃO DÁ para recuperar a resposta do servidor:
//   `ia_uso` e `ia_interacoes` guardam metering e rótulos, NUNCA o texto (régua f45/LGPD) — não existe
//   onde buscá-la. Guardar a resposta para reentrega é decisão de servidor (migration + deploy + LGPD) e
//   ficou como tarefa à parte.
//   NÃO FECHADO, declarado: página DESCARTADA pelo Android continua fora do nosso alcance (o pedido morre
//   com ela — o que está ao nosso alcance é não perder a PERGUNTA); pergunta com FOTO não é retomada
//   depois de a página morrer, nem depois de um redesenho da tela (o render() limpa a foto), e nesses
//   casos a frase convida a reescrever, não a tocar num botão que não está lá; o reenvio gasta mais uma
//   unidade da cota, porque a resposta perdida não volta; a CLASSE da falha é inferência, não certeza — o
//   único sinal que PROVA algo é o navigator.onLine falso no envio (o pedido não saiu), e há uma janela de
//   _JANELA_VOLTA_MS depois da volta em que uma queda de rede é lida como "saiu do app".
//   Travado por tests/assessor-segundo-plano.check.mjs (roda este arquivo REAL num DOM falso, com
//   mutantes embutidos).
const ASSIST = {
  _foto: null,        // { media_type, data (base64 sem prefixo), url (dataURL p/ preview) }
  _projetoCtx: null,  // f3/f16 — { nome, projetoId, texto }: responder "com base no seu projeto"
  _ctxTela: null,     // f40 — { modulo, label, texto }: de onde o usuário veio no app
  _hist: [],          // f40 — [{ pergunta, resposta, fontes, semBase, foto, erro }]
  _K: "cb-ia-chat",   // sessionStorage (por aba; some ao fechar — LGPD-friendly)
  _fontesAbertas: null,   // a42 — Set de índices com o bloco "Fontes" aberto (sobrevive ao re-render)
  _semIAServidor: null,   // 18/set — { plano } da sessão quando o servidor negou por "plano"
  _voo: null,             // a65 — { i, t0, parado, escondidoEm, voltouEm, prazo, substituida, semRedeNoEnvio, ctrl, corta }: a consulta EM VOO (uma por vez)
  _visLigada: false,      // a65 — os ouvintes de visibilidade já foram instalados nesta página

  // a65 — prazo do CLIENTE, e não é número de gosto: ele fica acima do TETO REAL do servidor. O teto real
  // NÃO é o CB_IA_TIMEOUT_MS (60 s): esse setTimeout está DENTRO do laço de ferramentas do
  // _shared/assessor.ts, que gasta até MAX_RODADAS_FERR + 1 = 4 chamadas ao modelo numa pergunta que
  // consulta SINAPI ou a base de normas — 4 × 60 s = 240 s. A 1ª versão desta tarefa pôs 75 s lendo o 60 s
  // como se fosse o teto da FUNÇÃO: o cliente matava aos 75 s a resposta que o servidor ainda montava E JÁ
  // TINHA COBRADO (a cota é debitada antes do retorno, ver o cabeçalho) — o contrário do que esta tarefa
  // existe para consertar.
  // E 240 s é PISO, não teto (achado da 2ª revisão, 24/set/2026): ficam FORA daquele setTimeout, e sem prazo
  // nenhum, o embed() e o rerank() da Voyage (fetch sem `signal` — o `orcamentoMs` do `tentar()` de
  // _shared/resiliencia.ts só decide se cabe uma RETENTATIVA, não corta a chamada em curso), a busca híbrida
  // no Postgres e as execuções de FERRAMENTA entre as 4 rodadas. Por isso o número é piso + MARGEM, e a
  // margem é declarada e cobrada em tests/assessor-segundo-plano.check.mjs (régua E), que DERIVA o piso dos
  // dois valores do assessor.ts a cada execução (a lição da lista SEM_JWT: número em prosa envelhece sem
  // nada reprovar). Mudou o teto lá, este cai aqui. Errar para MAIS aqui custa uma espera longa a quem está
  // olhando (e o relógio nem corre enquanto a pessoa está fora); errar para MENOS mata resposta viva já
  // cobrada — por isso a margem é generosa.
  // LIMITE DECLARADO: CB_IA_TIMEOUT_MS é secret OPCIONAL, e daqui só se lê o DEFAULT do código. Subir esse
  // secret em produção sobe o teto real sem nada reprovar no CI — quem o mexer mexe neste número junto.
  _PRAZO_MS: 300000,

  // a65 — o prazo só conta o tempo em que a página esteve À VISTA (ver _armarPrazo). Quando a pessoa volta,
  // a rejeição do fetch que o navegador matou ao congelar chega nas primeiras tarefas seguintes: falha
  // dentro desta janela ainda é "saiu do app", não "sem internet".
  _JANELA_VOLTA_MS: 2000,

  // a65 — as frases da falha de ida e volta. A frase sai da CLASSE do erro (c9), nunca do servidor, e cada
  // uma manda fazer uma coisa DIFERENTE. A ressalva da cota é RESSALVA ("pode ter"), não afirmação: daqui
  // não há como saber se a função chegou a completar — e, quando completa, ela JÁ debitou (ver o cabeçalho).
  // Ela só falta em `rede`, onde a falta é DEMONSTRÁVEL: não havia rede quando o pedido saiu, então ele não
  // saiu. A queda NO MEIO do caminho é outra classe (`redeCaiu`), porque aí o pedido pode ter sido entregue.
  // NENHUMA delas manda tocar num botão: quem convida é _CONVITES, na hora de DESENHAR, porque só ali se
  // sabe se o botão existe — a frase mandava tocar em "Tentar de novo" em balão que não o desenha.
  _FALHAS: {
    fundo: "Você saiu do app enquanto a resposta vinha e ela se perdeu no caminho. Se ela chegou a ser processada, pode ter contado na sua cota do mês.",
    prazo: "O assessor demorou mais do que o esperado e a resposta não chegou. Se ela chegou a ser processada, pode ter contado na sua cota do mês.",
    rede: "Sem conexão com a internet: o pedido não chegou a sair, então nada foi descontado.",
    redeCaiu: "A internet caiu enquanto a resposta vinha e ela se perdeu no caminho. Se ela chegou a ser processada, pode ter contado na sua cota do mês.",
    substituida: "Você enviou outra pergunta antes desta ser respondida, e ela foi cancelada. Se chegou a ser processada, pode ter contado na sua cota do mês.",
    desconhecida: "Não foi possível consultar agora. Se a pergunta chegou a ser processada, pode ter contado na sua cota do mês.",
  },

  // a65 — o CONVITE sai do MESMO _podeRetomar que decide o botão: é isso, e só isso, que impede o texto de
  // mandar tocar no que não foi desenhado (pergunta com foto de uma página descartada, troca que não é a
  // última). "quando a internet voltar" é exclusivo das duas classes de rede, as únicas que dependem disso.
  _CONVITES: {
    com: " Sua pergunta continua aqui — toque em Tentar de novo.",
    comRede: " Sua pergunta continua aqui — toque em Tentar de novo quando a internet voltar.",
    sem: " Sua pergunta continua na tela: envie-a outra vez para tentar mais uma.",
  },

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
        // a65: `pendente` é a pergunta EM VOO. Sem ela no storage, a página descartada pelo Android voltava
        // sem rastro nenhum do que a pessoa perguntou. `falha`/`retomar` fazem a oferta sobreviver também.
        pendente: !!h.pendente, retomar: !!h.retomar, falha: h.falha || null,
      }));
      sessionStorage.setItem(this._K, JSON.stringify({ hist, ctx: this._ctxTela }));
    } catch (e) { /* sem sessionStorage → conversa só em memória */ }
  },
  _restore() {
    try {
      const d = JSON.parse(sessionStorage.getItem(this._K) || "null");
      if (d && Array.isArray(d.hist)) { this._hist = d.hist; this._ctxTela = d.ctx || null; }
    } catch (e) { /* ignora */ }
    // a65 — a página FOI descartada no meio da espera: a troca voltou `pendente`, sem resposta e sem erro.
    // Sem isto ela renderiza "Consultando o assessor…" PARA SEMPRE (o fetch que a preencheria morreu com a
    // página anterior). Vira a frase do segundo plano, com a oferta de repetir — a pergunta não se perde.
    for (const h of this._hist) {
      if (h && h.pendente && h.resposta == null && !h.erro) { h.falha = "fundo"; h.erro = this._FALHAS.fundo; h.retomar = true; }
      if (h) h.pendente = false;
    }
  },

  // ── a65: o ciclo de sair e voltar ────────────────────────────────────────
  // A página está fora de vista? (congelada, aba trocada, app em segundo plano). É o que separa "você saiu
  // do app" de "sem conexão" na hora de falar — sem essa distinção o conserto seria palpite.
  _escondido() {
    try { return document.visibilityState === "hidden" || document.hidden === true; } catch (e) { return false; }
  },
  // O navegador diz que NÃO há rede? Só este sentido é confiável (onLine true não prova conexão), e é por
  // isso que "sem conexão" é a única frase SEM a ressalva da cota: sem interface de rede o pedido não saiu.
  _semRede() {
    try { return typeof navigator !== "undefined" && !!navigator && navigator.onLine === false; } catch (e) { return false; }
  },
  _ligarVisibilidade() {
    if (this._visLigada) return;
    this._visLigada = true;
    try {
      // `freeze` e `pagehide` chegam onde o visibilitychange não chega (congelamento, descarte, bfcache).
      // Nada é CANCELADO aqui: fetch que sobrevive ao congelamento ainda entrega, e a resposta vale — o que
      // acontece é o relógio do prazo PARAR (_aoEsconder) e voltar a correr na volta (_aoVoltar).
      document.addEventListener("visibilitychange", () => { if (this._escondido()) this._aoEsconder(); else this._aoVoltar(); });
      document.addEventListener("freeze", () => this._aoEsconder());
      window.addEventListener("pagehide", () => this._aoEsconder());
    } catch (e) { this._visLigada = false; }
  },
  // FORA DE VISTA: o relógio do prazo PARA (e o corte é desarmado — o setTimeout não anda com a aba
  // congelada de qualquer modo). Contar contra o prazo o tempo em que ninguém estava olhando foi o 2º
  // defeito da 1ª versão desta tarefa: quem saía do app por mais tempo que o prazo voltava e tinha o pedido
  // AINDA VIVO morto pelo próprio app — exatamente o caso do fundador, que é o caso desta tarefa.
  _aoEsconder() {
    const voo = this._voo;
    if (!voo || voo.escondidoEm) return;
    voo.escondidoEm = Date.now();
    this._desarmarPrazo(voo);
  },
  // DE VOLTA AO APP: o relógio recomeça de onde parou e o corte é reagendado para o tempo ATIVO que falta.
  _aoVoltar() {
    const voo = this._voo;
    if (!voo || !voo.escondidoEm) return;
    voo.parado += Date.now() - voo.escondidoEm;
    voo.escondidoEm = null;
    voo.voltouEm = Date.now();
    this._armarPrazo(voo);
  },
  // Tempo em que a página esteve À VISTA desde o envio: o único que o prazo cobra.
  _ativoMs(voo) {
    if (!voo) return null;
    const parado = voo.parado + (voo.escondidoEm ? Date.now() - voo.escondidoEm : 0);
    return Date.now() - voo.t0 - parado;
  },
  _desarmarPrazo(voo) {
    if (voo && voo.corta != null) { try { clearTimeout(voo.corta); } catch (e) {} voo.corta = null; }
  },
  _armarPrazo(voo) {
    if (!voo || voo !== this._voo) return;
    this._desarmarPrazo(voo);
    if (voo.escondidoEm) return;                       // relógio parado: nada a agendar
    const falta = this._PRAZO_MS - this._ativoMs(voo);
    if (falta <= 0) { this._abortarVoo(voo, "prazo"); return; }
    voo.corta = setTimeout(() => this._abortarVoo(voo, "prazo"), falta);
  },
  _abortarVoo(voo, motivo) {
    if (!voo || voo !== this._voo) return;
    if (motivo === "prazo") voo.prazo = true;
    if (motivo === "substituida") voo.substituida = true;
    this._desarmarPrazo(voo);
    try { if (voo.ctrl) voo.ctrl.abort(); } catch (e) {}
  },
  // a65 (2ª revisão) — espera do SDK que obedece ao MESMO sinal que corta o fetch. O getSession pede a trava
  // com `_acquireLock(-1)`, SEM prazo (a61 do CLAUDE.md): ele pode não voltar nunca, e aí o corte do prazo e o
  // cancelamento por pergunta nova abortariam um AbortController que ainda não está preso a pedido algum — a
  // troca ficaria em "Consultando o assessor…" para sempre, que é exatamente o estado que esta tarefa existe
  // para acabar. Sem AbortController (navegador antigo) a espera segue como era.
  _corrida(voo, p) {
    const sig = voo && voo.ctrl ? voo.ctrl.signal : null;
    const corte = () => Object.assign(new Error("consulta cortada antes do envio"), { name: "AbortError" });
    if (!sig) return p;
    if (sig.aborted) return Promise.reject(corte());
    return Promise.race([p, new Promise((_ok, cai) => {
      try { sig.addEventListener("abort", () => cai(corte()), { once: true }); } catch (e) {}
    })]);
  },
  // A CLASSE da falha, e é ela (não o servidor) que escolhe a frase (c9). A ordem é por FORÇA DA PROVA, não
  // por gosto: primeiro o que este código FEZ (cancelou para dar lugar a outra pergunta), depois o que o
  // navegador PROVA (não havia rede quando o pedido saiu, logo ele não saiu e nada foi cobrado), depois o
  // que explica o ocorrido a quem está lendo (a página estava fora de vista), depois o corte do próprio
  // prazo e só então a queda de rede no meio do caminho. A 1ª versão desta tarefa punha "saiu do app" no
  // topo com uma marca que NUNCA era limpa: dois segundos no WhatsApp faziam uma queda de internet meio
  // minuto depois dizer "você saiu do app" e acusar uma cobrança que não houve.
  // E "rede" é a ÚNICA das seis frases que AFIRMA ("nada foi descontado") em vez de ressalvar, então ela
  // exige PROVA e não indício (achado da 2ª revisão, 24/set/2026): a marca do envio sozinha era pegajosa e
  // envelhecia. O navigator.onLine do Android pisca falso na troca de wifi para dados móveis, o pedido SAI
  // pela outra interface (este código nem consulta onLine antes de enviar — foi medido), o servidor trabalha,
  // a cota é debitada e, cinco minutos depois, a tela afirmava que nada tinha sido descontado; e a mesma
  // marca sobrevivia à pessoa SAIR do app, onde a frase nem dizia que ela saiu. A afirmação só vale enquanto
  // o mundo continua o do envio: ainda sem rede AGORA, a página nunca saiu de vista e o corte não foi nosso.
  // Fora disso, desce para a escada normal — que ressalva a cota. NÃO FECHADO: rede que cai, volta, entrega o
  // pedido e cai de novo com a página sempre à vista continua lida como "rede"; é composto e raro, e o dano é
  // um sossego indevido, não perda de dado.
  _classeFalha(voo) {
    if (!voo) return "desconhecida";
    if (voo.substituida) return "substituida";
    if (voo.semRedeNoEnvio && this._semRede() && !voo.prazo && !voo.escondidoEm && !voo.voltouEm && !this._escondido()) return "rede";
    if (voo.escondidoEm || this._escondido()) return "fundo";
    if (voo.prazo) return "prazo";
    if (this._semRede()) return "redeCaiu";
    if (voo.voltouEm && Date.now() - voo.voltouEm <= this._JANELA_VOLTA_MS) return "fundo";
    return "desconhecida";
  },
  // A oferta de repetir só vale para a ÚLTIMA troca (é a que ficou em voo) e só quando dá para repetir o
  // pedido FIELMENTE: a foto não vai ao sessionStorage, então pergunta com foto de uma página descartada
  // não é retomada — o texto do erro continua na tela, sem botão que mentiria.
  // `h.retomar` é a marca que SÓ a falha de ida e volta põe: é ela que separa o que vale repetir (saiu do
  // app, sem conexão, demorou) do que repetir não conserta ("faça login", plano sem IA, troca já respondida).
  _podeRetomar(h, i) {
    if (!h || !h.retomar) return false;
    if (Number(i) !== this._hist.length - 1) return false;
    if (h.foto && !(this._foto && this._foto.data)) return false;
    return true;
  },
  // O convite que fecha a frase, decidido pelo MESMO _podeRetomar que desenha o botão — é isso que impede o
  // texto de mandar tocar no que não existe (a revisão de 24/set achou três caminhos em que ele não existe:
  // pergunta com foto depois do descarte, troca que não é a última e a foto que o render() limpa).
  _convite(h, i) {
    if (!h || !h.falha) return "";
    if (!this._podeRetomar(h, i)) return this._CONVITES.sem;
    return (h.falha === "rede" || h.falha === "redeCaiu") ? this._CONVITES.comRede : this._CONVITES.com;
  },
  // Reenvia a MESMA pergunta. NUNCA automático: a resposta perdida provavelmente já foi cobrada (ver o
  // cabeçalho), e um retry automático dobraria o gasto sem ninguém pedir. A troca velha SAI do fio antes do
  // reenvio, então a pergunta não aparece duas vezes. Quem barra o toque duplo é o `h.retomar` do
  // _podeRetomar (a troca reenviada nasce sem a marca); o `|| this._voo` é cinto e suspensório para o dia em
  // que alguém chamar retomar() por outro caminho — por isso ele não tem mutante próprio: é inalcançável hoje.
  retomar(i) {
    i = Number(i);
    const h = this._hist[i];
    if (!this._podeRetomar(h, i) || this._voo) return;
    const p = h.pergunta;
    this._hist.pop();
    this._persist();
    this.ask(p, "assessor");
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

  // 21/set — aparelho de TOQUE: ponteiro grosso OU tela de celular. É quem decide se o código pode devolver o
  // foco ao campo (não pode: o foco abre o teclado por cima da resposta) e se o modo teclado existe. Janela de
  // computador estreita cai aqui também (limite declarado no cabeçalho): errar para este lado custa um clique
  // a mais no campo; errar para o outro tapa a resposta com o teclado.
  _toque() {
    try { if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return true; } catch (e) {}
    return this._celular();
  },

  // Ponto de injeção dos testes (check e E2E trocam por um dublê): o teclado de verdade não se emula.
  _vv() { try { return window.visualViewport || null; } catch (e) { return null; } },

  // Altura do LAYOUT viewport — o quadro em que o rodapé sticky/fixed se apoia. NÃO é window.innerHeight: no
  // Chrome (Android incluso) innerWidth/innerHeight do quadro principal acompanham o VISUAL viewport (é por
  // isso que mudam com o zoom de pinça); com o teclado aberto os dois encolhem juntos e a conta abaixo daria
  // kb = 0 e aberto = false para sempre (achado da revisão adversarial de 21/set). Quem mede é a SONDA
  // (#ia-sonda: position fixed, de alto a baixo, invisível — o molde do exemplo da própria especificação do
  // visualViewport); sem ela, o clientHeight do documento; innerHeight é só a última reserva.
  _layoutH() {
    try {
      const s = document.getElementById("ia-sonda");
      const h = s && s.getBoundingClientRect ? s.getBoundingClientRect().height : 0;
      if (h > 0) return h;
    } catch (e) {}
    try { const c = document.documentElement.clientHeight; if (c > 0) return c; } catch (e) {}
    try { return window.innerHeight; } catch (e) { return NaN; }
  },

  // PURA. A geometria do teclado a partir do layout viewport (layoutH) e do visual viewport (altura e topo):
  //   kb     = quanto do layout viewport fica atrás do teclado, medido a partir do rodapé — é o que a caixa
  //            sticky tem de subir. Com a janela visual já encostada no rodapé do layout (vvTop alto), é 0;
  //   aberto = o visual encolheu mais de 120 px (a barra de endereço que vai e vem mexe bem menos que isso).
  // Com zoom de pinça (escala ≠ 1) os dois números mentem: devolve null, e "não sei" não muda nada.
  _geoTeclado(g) {
    const layoutH = Number(g && g.layoutH), vvH = Number(g && g.vvH), vvTop = Number(g && g.vvTop) || 0;
    const escala = g && g.escala != null ? Number(g.escala) : 1;
    if (!isFinite(layoutH) || !isFinite(vvH) || !isFinite(escala) || Math.abs(escala - 1) >= 0.01) return null;
    return { kb: Math.max(0, Math.round(layoutH - vvTop - vvH)), aberto: (layoutH - vvH) > 120 };
  },

  // Liga/desliga o MODO TECLADO (body.ia-teclado). O css só obedece à classe sob :has(.ia-chat): esquecida
  // no body depois de sair desta tela, ela não esconde a barra de abas de mais ninguém.
  _teclado(on) {
    let cl = null;
    try { cl = document.body && document.body.classList; } catch (e) {}
    if (!cl || typeof cl.add !== "function") return;
    if (on) {
      if (!cl.contains("ia-teclado")) { this._ligadoDesde = Date.now(); this._kbVisto = false; }
      cl.add("ia-teclado");
      this._fecharLegal();
      this._vvAplicar();
    } else {
      cl.remove("ia-teclado");
      try {
        const st = document.documentElement.style;
        st.removeProperty("--ia-kb"); st.removeProperty("--ia-vv-top");
      } catch (e) {}
    }
    if (this._medirDeNovo) this._medirDeNovo();   // a barra de abas entrou ou saiu: a caixa e o chat mudaram de lugar
  },
  _tecladoLigado() {
    try { return !!(document.body && document.body.classList && document.body.classList.contains("ia-teclado")); } catch (e) { return false; }
  },

  // Publica a geometria do teclado e percebe o teclado FECHADO sem perda de foco (o "voltar" do Android): aí
  // o campo perde o foco por código e a barra de abas volta. Sem ter VISTO o teclado aberto (_kbVisto) nunca
  // dá blur: teclado físico e navegador que encolhe o layout não mexem no visual viewport, e tirar o foco de
  // quem está digitando seria defeito.
  _vvAplicar() {
    if (!this._tecladoLigado()) return;
    const vv = this._vv();
    if (!vv) return;
    let g = null;
    try { g = this._geoTeclado({ layoutH: this._layoutH(), vvH: vv.height, vvTop: vv.offsetTop, escala: vv.scale }); } catch (e) {}
    if (!g) return;
    try {
      const st = document.documentElement.style;
      st.setProperty("--ia-kb", g.kb + "px");
      st.setProperty("--ia-vv-top", Math.max(0, Math.round(Number(vv.offsetTop) || 0)) + "px");
    } catch (e) {}
    if (g.aberto) { this._kbVisto = true; return; }
    if (!this._kbVisto) return;
    // Fechou DENTRO do 1º segundo depois do foco (o "voltar" apertado logo em seguida): a guarda de 1 s ainda não
    // deixa desligar, e depois dela pode não vir mais evento NENHUM do visual viewport. O modo ficava ligado com o
    // teclado fechado e o foco no campo; o toque seguinte (só `click`: o foco já estava lá) caía aqui com a
    // geometria de "fechado", tirava o foco, e o teclado não abria — um toque morto (revisão de 21/set, sonda com
    // relógio falso). A conferência é REFEITA quando a guarda vence, com a geometria de então.
    const falta = 1000 - (Date.now() - (this._ligadoDesde || 0));
    if (falta >= 0) {
      clearTimeout(this._vvDeNovo);
      this._vvDeNovo = setTimeout(() => this._vvAplicar(), falta + 20);
      return;
    }
    const q = document.getElementById("ia-q");
    try { if (q) q.blur(); } catch (e) {}
    this._teclado(false);
  },

  // O foco saiu da caixa de escrita? Com PRAZO (o toque no microfone ou na câmera passa pelo <body> no caminho) e
  // conferindo de novo no fim dele. Dois chamadores: o focusout da caixa e quem APAGA o botão que tinha o foco (o X
  // do chip de contexto, do chip de projeto e da foto, redesenhados por innerHTML): aí o foco cai no <body> e,
  // conforme o navegador, SEM focusout nenhum — a caixa não avisa, e em navegador que encolhe o layout junto com o
  // teclado (_kbVisto nunca liga) nada mais desligava o modo: barra de abas e cabeçalho sumidos até a pessoa focar
  // o campo e tocar fora (revisão de 21/set; o Chromium de hoje dispara o focusout na remoção — medido no preview
  // —, os outros motores não garantem).
  _seFocoSaiu() {
    if (!this._tecladoLigado()) return;
    setTimeout(() => {
      if (!this._tecladoLigado()) return;
      const caixa = document.querySelector(".ia-composer");
      const a = document.activeElement;
      if (caixa && a && a !== document.body && caixa.contains(a)) return;
      this._teclado(false);
    }, 200);
  },

  // Próximo quadro — com reserva: página escondida não roda requestAnimationFrame, e o que estava
  // agendado (medir a rolagem, levar à última troca) ficaria sem acontecer.
  _quadro(fn) {
    let feito = false;
    const rodar = () => { if (feito) return; feito = true; try { fn(); } catch (e) {} };
    try { if (typeof requestAnimationFrame === "function") requestAnimationFrame(rodar); } catch (e) {}
    setTimeout(rodar, 120);
  },

  // Quem liga o modo teclado é o FOCO do campo (focusin) e o toque num campo que JÁ tem o foco (click: depois
  // do "voltar" do Android o teclado fecha, o foco fica, e o toque seguinte não gera focusin). Os dois
  // acontecem DEPOIS de o navegador ter decidido o alvo do toque. Quem desliga: o envio, o foco que saiu da
  // caixa (com prazo: o toque no microfone ou na câmera passa pelo <body> no caminho) e o teclado que fechou.
  _ligarTeclado(q) {
    if (!q || typeof q.addEventListener !== "function") return;
    const ligar = () => { if (this._toque()) this._teclado(true); };
    q.addEventListener("focusin", ligar);
    q.addEventListener("click", ligar);
    const caixa = document.querySelector(".ia-composer");
    if (caixa) {
      caixa.addEventListener("focusout", (e) => {
        if (e && e.relatedTarget && caixa.contains(e.relatedTarget)) return;
        this._seFocoSaiu();
      });
    }
    const vv = this._vv();
    if (vv && typeof vv.addEventListener === "function" && this._vvAlvo !== vv) {
      this._vvAlvo = vv;
      let pendente = false;
      const aoMudar = () => {
        if (pendente || this._vv() !== vv) return;
        pendente = true;
        this._quadro(() => { pendente = false; this._vvAplicar(); });
      };
      vv.addEventListener("resize", aoMudar);
      vv.addEventListener("scroll", aoMudar);
    }
    if (!this._popLigado && typeof window.addEventListener === "function") {
      this._popLigado = true;
      window.addEventListener("popstate", () => setTimeout(() => {
        if (!document.querySelector(".ia-chat")) this._teclado(false);
      }, 0));
    }
  },

  _fecharLegal() {
    try { const d = document.getElementById("ia-legal"); if (d && d.open) d.open = false; } catch (e) {}
  },

  render(host) {
    host = host || document.getElementById("app");
    if (!host) return;
    this._teclado(false);   // tela nova nasce fora do modo teclado (a classe pode ter ficado de uma saída com o campo em foco)
    this._foto = null;
    if (!this._fontesAbertas) this._fontesAbertas = new Set();
    if (!this._hist.length) this._restore();
    // 18/set: plano sem IA → o convite ocupa o lugar da caixa de escrita (os ligamentos abaixo já
    // toleram a ausência de cada elemento: todos são `if (el)`). O convite NÃO mora na .ia-composer:
    // a caixa é sticky no rodapé e o convite é alto — grudado, ele taparia a apresentação do assessor
    // numa tela de 740 px. Fica no fluxo, no rodapé do chat (tests/e2e/ia-plano.spec.js confere).
    const semIA = this._semIA();
    // 21/set: no celular o resumo é UMA linha curta (.ia-legal-curto) e a frase inteira abre o painel
    // (.ia-legal-inteiro), no MESMO <details>; no computador o resumo já diz a frase toda (.ia-legal-longo).
    // O aviso é obrigação: muda de tamanho, nunca some (tests/assessor-celular.check.mjs, régua (e)).
    const FRASE_LEGAL = `Apoio técnico — <strong>não substitui o responsável técnico (RT)</strong> nem a consulta ao <strong>texto integral da norma</strong>.`;
    const legal = `
          <details class="ia-legal" id="ia-legal">
            <summary><i class="ti ti-info-circle" aria-hidden="true"></i> <span class="ia-legal-curto">Apoio técnico · não substitui o RT nem a norma</span><span class="ia-legal-longo">${FRASE_LEGAL}</span><i class="ti ti-chevron-down ia-seta" aria-hidden="true"></i></summary>
            <div class="ia-legal-corpo">
              <p class="ia-legal-inteiro">${FRASE_LEGAL}</p>
              <p>No administrativo, as orientações não substituem o contador, o advogado ou o profissional de segurança do trabalho. A análise de foto aponta indícios; <strong>confirme em campo</strong>.</p>
              <p class="ia-legal-links"><a href="privacidade.html" target="_blank" rel="noopener">Política de Privacidade</a> · <a href="termos.html" target="_blank" rel="noopener">Termos de Uso</a> · <a href="#" onclick="if (window.cbCookies) cbCookies.abrir(); return false;">Gerenciar cookies</a></p>
            </div>
          </details>`;
    const rodape = semIA
      ? `<div class="ia-convite" style="margin-top:10px;padding:10px 0 14px">${this._conviteHTML()}${legal}
        </div>`
      : `<div class="ia-composer">
          <button type="button" id="ia-fim" class="ia-fim" hidden aria-label="Ir para o fim da conversa"><i class="ti ti-chevron-down" aria-hidden="true"></i><span class="ia-fim-txt"></span></button>
          <div id="ia-ctx"></div>
          <div id="ia-proj"></div>
          <div id="ia-foto" hidden></div>
          <div class="ia-campo">
            <label class="ia-sr" for="ia-q">Sua pergunta ao assessor</label>
            <textarea id="ia-q" class="ia-campo-txt" rows="1" placeholder="Pergunte ao assessor"></textarea>
            <div class="ia-campo-barra">
              <label class="ia-ic-btn" for="ia-foto-input" title="Anexar foto da obra (fiscalização visual)"><i class="ti ti-camera" aria-hidden="true"></i><span class="ia-sr">Anexar foto da obra</span></label>
              <input type="file" id="ia-foto-input" accept="image/*" capture="environment" hidden>
              <button type="button" class="ia-ic-btn" id="ia-mic" title="Ditar a pergunta por voz (pt-BR)"><i class="ti ti-microphone" aria-hidden="true"></i><span class="ia-sr">Ditar a pergunta por voz</span></button>
              <span class="ia-dica">Enter envia · Shift+Enter quebra linha</span>
              <button type="button" class="ia-enviar" id="ia-go" title="Perguntar ao assessor"><i class="ti ti-send" aria-hidden="true"></i><span class="ia-sr">Perguntar à IA</span></button>
            </div>
          </div>${legal}
        </div>`;
    // .ia-com-caixa: só com a caixa de escrita a última troca ganha a altura de leitura (css). Na tela do
    // convite ela empurrava o botão do convite para trás da barra de abas (medido em 21/set a 360x740: botão
    // em y 719–760, barra em 680–740). #ia-sonda: a régua do layout viewport (_layoutH).
    host.innerHTML = `
      <div class="ia-chat${semIA ? "" : " ia-com-caixa"}">
        <div class="ia-sonda" id="ia-sonda" aria-hidden="true"></div>
        <div class="ia-top">
          <h1 class="ia-top-tt"><i class="ti ti-sparkles" aria-hidden="true"></i> <span>Assessor IA</span></h1>
          <span class="ia-uso" id="ia-uso"></span>
          <button type="button" class="ia-acao ia-top-btn" id="ia-esq-abrir" hidden aria-controls="ia-esquemas" aria-expanded="false" aria-label="Esquemas gerados" title="Desenhos cotados criados nas suas conversas"><i class="ti ti-ruler-measure" aria-hidden="true"></i><span class="ia-top-rot">Esquemas</span><span class="ia-esq-n" id="ia-esq-n"></span></button>
          <button type="button" class="ia-acao ia-nova ia-top-btn" id="ia-nova" ${this._hist.length ? "" : "hidden"} aria-label="Nova conversa" title="Limpa a conversa e começa do zero"><i class="ti ti-refresh" aria-hidden="true"></i><span class="ia-top-rot">Nova conversa</span></button>
        </div>

        <div id="ia-esquemas" class="ia-esquemas" hidden></div>
        <div class="ia-thread" id="ia-thread" role="log" aria-live="off" aria-label="Conversa com o assessor"></div>
        <p class="ia-sr" id="ia-anuncio" role="status" aria-live="polite"></p>

        ${rodape}
      </div>`;
    const go = document.getElementById("ia-go");
    const q = document.getElementById("ia-q");
    const fileIn = document.getElementById("ia-foto-input");
    const nova = document.getElementById("ia-nova");
    const disparar = () => this.ask(q ? q.value : "", "assessor");
    if (go) {
      go.addEventListener("click", disparar);
      // O toque em Enviar NÃO tira o foco do campo: sem isto o campo perderia o foco no mousedown, o modo
      // teclado começaria a desligar (a barra de abas volta, a caixa sobe 60 px) e o click cairia noutro lugar.
      go.addEventListener("mousedown", (e) => { try { e.preventDefault(); } catch (e2) {} });
    }
    const esqAbrir = document.getElementById("ia-esq-abrir");
    if (esqAbrir) esqAbrir.addEventListener("click", () => this._alternarEsquemas());
    const fim = document.getElementById("ia-fim");
    if (fim) fim.addEventListener("click", () => this._irParaFim());
    this._ligarTeclado(q);
    if (q) {
      q.addEventListener("focus", () => this._fecharLegal());   // o painel do aviso abre por cima da conversa: escrever o fecha
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
    if (mic) {
      mic.addEventListener("click", () => this.ditar());
      // O toque no microfone NÃO leva o foco (como no Enviar). Reproduzido em 21/set a 369 px, campo em
      // repouso: o mousedown dava o foco ao botão, o campo virava de uma para duas fileiras (:focus-within), o
      // microfone mudava de lugar e o click caía no vão — o ditado não começava. Com o foco parado nada vira;
      // e com o campo em foco o teclado não fecha no meio do toque. Pelo teclado (Tab) o botão segue focável.
      mic.addEventListener("mousedown", (e) => { try { e.preventDefault(); } catch (e2) {} });
    }
    const ctx = document.getElementById("ia-ctx"); if (ctx) ctx.innerHTML = this._ctxChipHTML();
    const proj = document.getElementById("ia-proj"); if (proj) proj.innerHTML = this._projetoChipHTML();
    this._renderThread();
    this._medir();
    this._ligarRolagem();
    if (!semIA) this._uso();    // 18/set: contador de uso não diz nada a quem não tem IA
    this._carregarEsquemas();   // f50: desenhos gerados fora do app (WhatsApp)
    // Conversa restaurada: a tela abre na ÚLTIMA troca (pergunta no alto), não no começo de uma conversa de
    // 12 trocas. No próximo quadro, porque o navigate() leva a janela ao topo DEPOIS deste render. Quem
    // chega pelo link de um desenho (abrirEsquema) é levado ao desenho — aí a âncora é CANCELADA pela senha
    // (_ancoraSeq): o app.html chama navigate("assessor") e SÓ DEPOIS abrirEsquema(), então uma marca ligada antes
    // do render nunca valia no caminho real (revisão de 21/set) — quem cancela é quem chega depois.
    if (this._hist.length) {
      const ult = this._hist.length - 1;
      const senha = this._ancoraSeq = (this._ancoraSeq || 0) + 1;
      this._quadro(() => { if (senha === this._ancoraSeq) this._mostrarTroca(ult, { instant: true }); this._aoRolar(); });
    }
  },

  // Medidas que o css não tem como saber e usava como número cravado (o "130px" do celular errava a conta
  // em 53 px, medido em 21/set/2026: a caixa parava 53 px acima da barra de abas com a conversa vazia):
  //   --ia-composer-h  altura da caixa de escrita + a margem de cima dela (ela cresce com o texto);
  //   --ia-cab-h       altura do cabeçalho do app, que é sticky e cobre o alto da tela;
  //   --ia-chat-top    onde o .ia-chat começa na página (cabeçalho + menu de módulos + folga do <main>).
  // Com elas o chat vai exatamente até o rodapé da tela e a ÚLTIMA troca tem a altura de leitura — é o que
  // dá curso à página para a pergunta nova subir até o alto.
  _medir() {
    const publicar = () => {
      try {
        const st = document.documentElement.style;
        const caixa = document.querySelector(".ia-composer");
        if (caixa) {
          const mt = parseFloat(getComputedStyle(caixa).marginTop) || 0;
          st.setProperty("--ia-composer-h", Math.round(caixa.getBoundingClientRect().height + mt) + "px");
        } else st.removeProperty("--ia-composer-h");
        const cab = document.querySelector("header.nav-app") || document.querySelector("header");
        if (cab) st.setProperty("--ia-cab-h", Math.round(cab.getBoundingClientRect().height) + "px");
        const chat = document.querySelector(".ia-chat");
        if (chat) st.setProperty("--ia-chat-top", Math.round(chat.getBoundingClientRect().top + (window.scrollY || 0)) + "px");
      } catch (e) {}
    };
    publicar();
    try {
      if (this._ro) this._ro.disconnect();
      const caixa = document.querySelector(".ia-composer");
      if (caixa) { this._ro = new ResizeObserver(publicar); this._ro.observe(caixa); }
    } catch (e) { /* sem ResizeObserver: fica a medida do render e a do resize */ }
    this._medirDeNovo = publicar;
    if (!this._resizeLigado && typeof window.addEventListener === "function") {
      this._resizeLigado = true;
      window.addEventListener("resize", () => { if (this._medirDeNovo && document.querySelector(".ia-chat")) this._medirDeNovo(); });
    }
  },

  // a42 — a caixa cresce com o texto até um teto (depois rola dentro dela). No celular o teto é menor:
  // com o teclado aberto sobram ~480 px, e 200 de campo deixariam a conversa sem lugar.
  _crescer(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, this._celular() ? 120 : 200) + "px";
    // A altura da caixa entra no min-height da última troca: publicada JÁ (e não só pelo ResizeObserver, um
    // quadro depois), a página não encurta no meio do caminho e a rolagem não é presa no fim dela.
    if (this._medirDeNovo) this._medirDeNovo();
  },

  // ── 21/set: ROLAGEM (a da página; uma só) ────────────────────────────────
  _movReduzido() {
    try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
  },
  _trocaEl(i) {
    try { return document.querySelector('#ia-thread [data-troca="' + Number(i) + '"]'); } catch (e) { return null; }
  },
  // Leva a troca i ao ALTO da tela (pergunta à vista, resposta logo abaixo) — nunca ao fim.
  _mostrarTroca(i, opt) {
    const alvo = this._trocaEl(i);
    if (!alvo || typeof alvo.scrollIntoView !== "function") return;
    const behavior = ((opt && opt.instant) || this._celular() || this._movReduzido()) ? "instant" : "smooth";
    // Rolagem SUAVE leva tempo para pousar (computador): até lá a troca ainda não está "no alto" — ver _aCaminho.
    this._pousando = behavior !== "instant" ? { i, ate: Date.now() + 1000 } : null;
    try { alvo.scrollIntoView({ block: "start", behavior }); } catch (e) { try { alvo.scrollIntoView(true); } catch (e2) {} }
  },
  // A rolagem suave do ENVIO ainda está a caminho? Resposta rápida (sem rede, sem login, cota) chega com a troca no
  // meio do trajeto: _aindaNoAlto dizia "saiu dali" e acendia um "Nova resposta" que ninguém pediu (medido no
  // preview em 21/set a 1280 px: troca em y 777 na chegada, 71 um segundo e meio depois). Nesse intervalo a chegada
  // trata a troca como "ainda no alto" e POUSA a âncora de imediato — não espera a animação, que não anda com a
  // página escondida (medido no mesmo dia: painel oculto, a troca ficava em y 777 para sempre).
  _aCaminho(i) {
    const p = this._pousando;
    return !!(p && p.i === i && Date.now() < p.ate);
  },
  // A troca i ainda está onde o envio a deixou? Se a pessoa rolou, não. O ponto de pouso é o do
  // scroll-margin-top da troca (css): a ALTURA do cabeçalho + 8 px — com o cabeçalho preso OU solto. No modo
  // teclado ele é static, mas a troca continua pousada no mesmo lugar (o cabeçalho ocupa o mesmo espaço no
  // fluxo): descontar a altura só com ele preso dava "saiu dali" para quem tocou no campo enquanto esperava,
  // e nascia um "Nova resposta" com a resposta na tela (reproduzido em 21/set: topo 69 px o tempo todo).
  _aindaNoAlto(i) {
    const alvo = this._trocaEl(i);
    if (!alvo) return false;
    let cabH = 61;
    try {
      const cab = document.querySelector("header.nav-app") || document.querySelector("header");
      if (cab) cabH = cab.getBoundingClientRect().height;
    } catch (e) {}
    return Math.abs(alvo.getBoundingClientRect().top - (cabH + 8)) < 48;
  },
  // Redesenha SÓ o balão da resposta da troca i: o resto do fio não pisca, os blocos de fontes abertos
  // continuam abertos e a página não perde a posição.
  _renderTroca(i) {
    const h = this._hist[i];
    const alvo = this._trocaEl(i);
    const bot = alvo && alvo.querySelector ? alvo.querySelector(".ia-msg-bot") : null;
    if (!h || !bot) { this._renderThread(); this._aoRolar(); return; }
    bot.innerHTML = this._botHTML(h, i);
    this._aoRolar();
  },
  _botHTML(h, i) {
    // a65 — "Tentar de novo" ao lado da frase: o reenvio é um TOQUE, nunca automático (a consulta perdida
    // provavelmente já foi cobrada). Frase e botão saem do MESMO _podeRetomar, na mesma expressão: onde o
    // botão não nasce, o convite é o de reescrever — nunca "toque em Tentar de novo" sem botão nenhum.
    if (h.erro) return `<p class="ia-erro"><i class="ti ti-alert-triangle" aria-hidden="true"></i> ${esc(h.erro + this._convite(h, i))}</p>` + (this._podeRetomar(h, i)
      ? `<div class="ia-acoes"><button type="button" class="ia-acao ia-retomar" onclick="ASSIST.retomar(${Number(i)})"><i class="ti ti-refresh" aria-hidden="true"></i> Tentar de novo</button></div>`
      : "");   // .ia-acoes é a fileira de ações que já existe sob a resposta: nenhuma regra de css nova (a52 P2: byte a mais na abertura tem de ser medido)
    if (h.resposta == null) return this._pensandoHTML(h.foto);
    return this._resposta(h, i);
  },
  // O #ia-fim mora DENTRO da caixa sticky (acima dela, à direita). Aparece longe do fim (160 px) ou quando
  // chegou resposta com a pessoa noutro ponto da conversa ("Nova resposta"). É por `scroll` com limiar, e
  // não por IntersectionObserver: com o min-height da última troca a sentinela ficaria na borda da caixa.
  _ligarRolagem() {
    if (this._rolagemLigada || typeof window.addEventListener !== "function") return;
    this._rolagemLigada = true;
    let pendente = false;
    window.addEventListener("scroll", () => {
      if (pendente) return;
      pendente = true;
      this._quadro(() => { pendente = false; this._aoRolar(); });
    }, { passive: true });
  },
  _aoRolar() {
    const fim = document.getElementById("ia-fim");
    if (!fim) return;
    let dist = 0;
    try {
      const de = document.documentElement;
      dist = de.scrollHeight - ((window.scrollY || de.scrollTop || 0) + window.innerHeight);
    } catch (e) {}
    let nova = fim.hasAttribute("data-nova");
    if (nova && (dist <= 8 || this._aindaNoAlto(this._hist.length - 1))) { nova = false; this._pilula(null); }
    fim.hidden = !(nova || dist > 160);
  },
  _pilula(tipo) {
    const fim = document.getElementById("ia-fim");
    if (!fim) return;
    const txt = fim.querySelector ? fim.querySelector(".ia-fim-txt") : null;
    if (tipo === "nova") {
      fim.setAttribute("data-nova", "");
      fim.setAttribute("aria-label", "Nova resposta — ir para ela");
      if (txt) txt.textContent = "Nova resposta";
      fim.hidden = false;
    } else {
      fim.removeAttribute("data-nova");
      fim.setAttribute("aria-label", "Ir para o fim da conversa");
      if (txt) txt.textContent = "";
    }
  },
  _irParaFim() {
    const fim = document.getElementById("ia-fim");
    if (fim && fim.hasAttribute("data-nova")) {
      this._pilula(null);
      this._mostrarTroca(this._hist.length - 1);
    } else {
      const behavior = (this._celular() || this._movReduzido()) ? "instant" : "smooth";
      try { window.scrollTo({ top: document.documentElement.scrollHeight, behavior }); }
      catch (e) { try { window.scrollTo(0, document.documentElement.scrollHeight); } catch (e2) {} }
    }
    this._quadro(() => this._aoRolar());
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
    this._pintarEsquemas(lista);
  },

  // 21/set — a lista saiu da faixa fixa entre a conversa e a caixa de escrita (era um cartão a mais preso na
  // tela). Agora é um BOTÃO na linha do título ("Esquemas" + quantos são) que abre o painel ACIMA do fio,
  // fechado por padrão; quem chega pelo link do WhatsApp tem o painel aberto por abrirEsquema(). Síncrona e
  // sem rede de propósito: é o que o check e o E2E conseguem exercitar.
  _pintarEsquemas(lista) {
    lista = Array.isArray(lista) ? lista : [];
    const host = document.getElementById("ia-esquemas");
    const btn = document.getElementById("ia-esq-abrir");
    const n = document.getElementById("ia-esq-n");
    if (n) n.textContent = lista.length ? String(lista.length) : "";
    if (btn) {
      btn.hidden = !lista.length;
      btn.setAttribute("aria-label", "Esquemas gerados (" + lista.length + ")");
    }
    if (!host) return;
    if (!lista.length) { host.innerHTML = ""; this._alternarEsquemas(false); return; }
    host.innerHTML = `<div class="ia-fontes ia-esq-bloco" id="ia-esq-bloco">
      <div class="ia-esq-cabecalho"><i class="ti ti-ruler-measure" aria-hidden="true"></i> <span>Esquemas gerados (${lista.length})</span><button type="button" class="ia-chip-x ia-esq-fechar" title="Fechar os esquemas" onclick="ASSIST._alternarEsquemas(false)"><i class="ti ti-x" aria-hidden="true"></i><span class="ia-sr">Fechar os esquemas gerados</span></button></div>
      <p class="ia-esq-sub">Desenhos cotados criados nas suas conversas — inclusive as do WhatsApp, onde o traço não cabe na mensagem. Ficam aqui por 90 dias.</p>
      ${lista.map(e => this._esqLinhaHTML(e)).join("")}
    </div>`;
  },

  // Abre/fecha o painel dos esquemas. `forcar` true/false fixa o estado; sem ele, alterna.
  _alternarEsquemas(forcar, opt) {
    const host = document.getElementById("ia-esquemas");
    if (!host) return;
    const abrir = typeof forcar === "boolean" ? forcar : !!host.hidden;
    host.hidden = !abrir;
    const btn = document.getElementById("ia-esq-abrir");
    if (btn) btn.setAttribute("aria-expanded", abrir ? "true" : "false");
    if (abrir && !(opt && opt.semRolar) && typeof host.scrollIntoView === "function") {
      const behavior = (this._celular() || this._movReduzido()) ? "instant" : "smooth";
      try { host.scrollIntoView({ block: "start", behavior }); } catch (e) { try { host.scrollIntoView(true); } catch (e2) {} }
    }
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
    // Quem chega pelo link vai ao DESENHO (ou ao aviso de "não encontrei", no alto do painel), não à última troca
    // da conversa restaurada: cancela a âncora que o render acabou de agendar — tenha o render sido o daqui de cima
    // ou o do app.html, que navega ANTES de chamar esta função.
    this._ancoraSeq = (this._ancoraSeq || 0) + 1;
    const host = document.getElementById("ia-esquemas");
    if (!host) return;
    let alvo = document.getElementById("esq-svg-" + id);
    if (!alvo) {                                  // veio de link: a lista ainda não montou (ou é antigo)
      await this._carregarEsquemas(id);
      // 21/set: o painel nasce FECHADO (hidden). Abre ANTES de procurar o alvo e de escrever o aviso
      // abaixo — senão o desenho, ou o "não encontrei", nasceria dentro de um painel escondido.
      this._alternarEsquemas(true, { semRolar: true });
      alvo = document.getElementById("esq-svg-" + id);
      // Link velho, esquema expirado (90 dias) ou de outra conta: dizer isso é melhor que tela muda.
      if (!alvo) {
        host.insertAdjacentHTML("afterbegin", `<p class="ia-erro"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Não encontrei esse desenho. Os esquemas ficam guardados por <strong>90 dias</strong> — se o link for antigo, refaça a pergunta ao assessor que ele desenha de novo.</p>`);
        return;
      }
    }
    this._alternarEsquemas(true, { semRolar: true });           // o desenho não pode abrir escondido
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
    if (el && el.scrollIntoView) {
      const behavior = (this._celular() || this._movReduzido()) ? "instant" : "smooth";
      try { el.scrollIntoView({ block: "center", behavior }); } catch (e) { try { el.scrollIntoView(true); } catch (e2) {} }
    }
  },

  // f40 — o FIO da conversa: balões do usuário (direita) e respostas em bloco largo (a42).
  // Só DESENHA. Quem leva a troca nova ao alto da tela é _mostrarTroca (no envio); a chegada da resposta
  // não passa por aqui (_renderTroca) e não move a tela.
  _renderThread() {
    const el = document.getElementById("ia-thread");
    if (!el) return;
    if (!this._hist.length) { el.innerHTML = this._vazioHTML(); this._ligarSugestoes(); }
    else {
      el.innerHTML = this._hist.map((h, i) => {
        const user = `<div class="ia-msg-user">${h.foto ? '<i class="ti ti-camera" aria-hidden="true"></i> ' : ""}${esc(h.pergunta)}</div>`;
        return `<div class="ia-troca" data-troca="${i}">${user}<div class="ia-msg-bot">${this._botHTML(h, i)}</div></div>`;
      }).join("");
    }
    const nova = document.getElementById("ia-nova");
    if (nova) nova.hidden = !this._hist.length;
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
    // 21/set: no celular o foco NÃO vai ao campo — o teclado abriria por cima da pergunta que a pessoa
    // acabou de escolher, e quem só quer conferir e enviar toca no botão (o campo já está cheio e à vista).
    this._focoCampo(q, { fim: true });
  },

  // No computador, um clique (como sempre). No CELULAR o botão virou um ícone de 44 px no canto do título,
  // ao lado do medidor: o 1º toque ARMA por 3 s ("Apagar?") e o 2º apaga — a conversa não tem volta. Sem
  // confirm(): o nativo devolve false dentro de PWA/preview e o botão "não funcionaria".
  novaConversa() {
    const btn = document.getElementById("ia-nova");
    if (this._celular() && btn && this._hist.length) {
      const rot = btn.querySelector ? btn.querySelector(".ia-top-rot") : null;
      if (!btn.classList.contains("ia-nova-armada")) {
        btn.classList.add("ia-nova-armada");
        btn.setAttribute("aria-label", "Apagar a conversa? Toque de novo para confirmar");
        if (rot) rot.textContent = "Apagar?";
        this._anunciar("Toque de novo em Apagar para limpar a conversa.");
        clearTimeout(this._novaT);
        this._novaT = setTimeout(() => {
          const b = document.getElementById("ia-nova");
          if (!b) return;
          b.classList.remove("ia-nova-armada");
          b.setAttribute("aria-label", "Nova conversa");
          const r = b.querySelector(".ia-top-rot"); if (r) r.textContent = "Nova conversa";
        }, 3000);
        return;
      }
      clearTimeout(this._novaT);
    }
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
        this._focoCampo(q, { fim: true });   // 21/set: só no computador; no celular a pessoa confere e toca em enviar
      }, 0);
    }
  },
  removerCtxTela() {
    this._ctxTela = null; this._persist();
    const el = document.getElementById("ia-ctx"); if (el) el.innerHTML = "";
    if (this._medirDeNovo) this._medirDeNovo();   // a caixa encolheu (ver _crescer)
    this._seFocoSaiu();   // o X que tinha o foco acabou de ser apagado (ver _seFocoSaiu)
  },
  _ctxChipHTML() {
    if (!this._ctxTela) return "";
    return `<div class="ia-chip">
      <i class="ti ti-compass" aria-hidden="true"></i>
      ${this._chipTxtHTML("Perguntando no contexto: ", "Contexto: ", this._ctxTela.label, "Perguntando no contexto: " + this._ctxTela.label)}
      <button type="button" class="ia-chip-x" title="Remover contexto da tela" onclick="ASSIST.removerCtxTela()"><i class="ti ti-x" aria-hidden="true"></i><span class="ia-sr">Remover contexto da tela</span></button>
    </div>`;
  },

  // O texto do chip. No celular o chip é uma pílula de UMA linha com reticências, e a parte que informa (o nome
  // do projeto, o rótulo da tela) está no FIM da frase: com a frase inteira sobravam ~38 px para o nome a 360 px
  // (medido no preview em 21/set: texto de 442 px numa caixa de 258). Por isso a frase tem duas aberturas — a
  // LONGA (computador) e a CURTA (corte do celular, css) — e o nome fica fora das duas, sempre à vista; a frase
  // inteira está no title e a um toque (o toque abre o chip em mais de uma linha: .ia-chip-aberto).
  // `longoHTML` e `curto` são literais DESTE arquivo; `nome` vem do usuário e é escapado aqui.
  _chipTxtHTML(longoHTML, curto, nome, inteiro) {
    return `<span class="ia-chip-txt" title="${esc(inteiro)}" onclick="this.parentNode.classList.toggle('ia-chip-aberto')"><span class="ia-chip-longo">${longoHTML}</span><span class="ia-chip-curto">${esc(curto)}</span><strong>${esc(nome)}</strong></span>`;
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
    // 21/set: a frase dizia "(ou use o WhatsApp)" — e o botão do WhatsApp saiu desta tela até 1023 px. Aviso
    // daqui não aponta para o que a tela não mostra (tests/assessor-celular.check.mjs, régua (a)).
    if (!SR) { if (typeof toast === "function") toast("Seu navegador não suporta ditado por voz. Tente o Chrome ou o Edge.", "warn"); return; }
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
      // ti-microphone (o webfont não tem "-filled", a52 P1): quem estava ouvindo ficava com o botão VAZIO.
      // O estado "ouvindo" continua visível pela classe ia-ouvindo e pelo title.
      if (btn) { btn.classList.add("ia-ouvindo"); btn.title = "Ouvindo… clique para parar"; btn.innerHTML = '<i class="ti ti-microphone" aria-hidden="true"></i><span class="ia-sr">Ouvindo — clique para parar o ditado</span>'; }
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
      ${this._chipTxtHTML("Respondendo <strong>com base no projeto:</strong> ", "Projeto: ", this._projetoCtx.nome, "Respondendo com base no projeto: " + this._projetoCtx.nome)}
      <button type="button" class="ia-chip-x" title="Remover contexto do projeto" onclick="ASSIST.removerProjetoCtx()"><i class="ti ti-x" aria-hidden="true"></i><span class="ia-sr">Remover contexto do projeto</span></button>
    </div>`;
  },
  consultarProjeto(nome, projetoId, texto) {
    this._projetoCtx = { nome: nome || "Projeto", projetoId: projetoId || null, texto: texto || "" };
    if (typeof navigate === "function") navigate("assessor"); else this.render();
  },
  removerProjetoCtx() {
    this._projetoCtx = null;
    const el = document.getElementById("ia-proj"); if (el) el.innerHTML = "";
    if (this._medirDeNovo) this._medirDeNovo();   // a caixa encolheu (ver _crescer)
    this._seFocoSaiu();   // idem: o X do chip de projeto
  },

  _renderFoto() {
    const el = document.getElementById("ia-foto");
    if (!el) return;
    if (!this._foto) { el.hidden = true; el.innerHTML = ""; if (this._medirDeNovo) this._medirDeNovo(); this._seFocoSaiu(); return; }
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
    // a65 — UMA consulta em voo por vez. A pessoa mandou OUTRA pergunta antes desta responder (o Enter do
    // campo não olha o botão desabilitado, e no computador o foco volta ao campo de propósito): o pedido
    // velho é CANCELADO aqui, com frase própria. Sem isto ele perdia o corte do prazo e o ciclo de
    // visibilidade — que só olham `this._voo` — e ficava em "Consultando o assessor…" para sempre, com a
    // troca `pendente: true` no sessionStorage para sempre junto. Era o estado que esta tarefa diz ter
    // acabado, aberto pelo próprio gesto que o fundador fez ("ele repetiu e a segunda vez funcionou").
    if (this._voo) this._abortarVoo(this._voo, "substituida");
    // f40: a troca entra no fio JÁ na hora do envio (a resposta preenche depois).
    const troca = { pergunta, resposta: null, fontes: [], semBase: false, foto: temFoto, erro: null };
    this._hist.push(troca);
    const i = this._hist.length - 1;
    // a65 — a pergunta é GUARDADA AQUI, antes do primeiro `await` desta função. Até então o _persist() só
    // corria no `finally`, que numa página DESCARTADA pelo Android nunca chega a rodar — a pergunta sumia
    // junto com a espera. E é antes do getSession de propósito: o SDK pede a trava sem prazo (a61), então
    // a página pode morrer ali mesmo, antes de qualquer pedido sair.
    troca.pendente = true;
    this._persist();
    // 21/set — aparelho de TOQUE: o campo LARGA o foco no envio (o teclado fecha e a resposta tem a tela
    // inteira) e o modo teclado desliga ANTES de desenhar, para a âncora abaixo já contar com a barra de abas
    // no lugar. Nos prints do fundador o foco voltava ao campo, o teclado reabria e tapava a caixa e a resposta.
    const toque = this._toque();
    if (toque) {
      try { if (q) q.blur(); } catch (e) {}
      this._teclado(false);
    }
    this._fecharLegal();
    this._renderThread();
    // A ORDEM IMPORTA (medido em 21/set/2026 a 360x420): primeiro o campo esvazia e a caixa ENCOLHE, depois as
    // medidas são refeitas, e só então a troca vai ao alto. A âncora depende do min-height da última troca
    // (tela − cabeçalho − caixa − barra), e o ResizeObserver só publicaria a altura nova da caixa no quadro
    // seguinte: ancorar ANTES de esvaziar deixava a página 46 px mais curta no instante em que o campo
    // encolhia, o navegador prendia a rolagem no fim da página e a pergunta parava 48 px abaixo do alto.
    if (q) { q.value = ""; this._crescer(q); }
    if (this._medirDeNovo) this._medirDeNovo();
    // A troca NOVA vai ao alto da tela: a pessoa vê a pergunta e o COMEÇO da resposta, não o fim.
    this._mostrarTroca(i, { instant: toque });
    this._anunciar(temFoto ? "Foto enviada. Analisando…" : "Pergunta enviada. Consultando o assessor…");
    if (q) {
      // COMPUTADOR: o foco volta ao campo AGORA — ainda dentro do gesto do usuário (clicar em "enviar" tirou o
      // foco do campo). Fazer isso no finally, quando a resposta chega segundos depois, roubaria o foco de
      // quem já estava noutro lugar. TOQUE: o foco vai para a troca nova (tabindex -1, não abre teclado), para
      // o leitor de tela e o teclado externo não recomeçarem do alto da página.
      if (toque) this._focoTroca(i);
      else if (!document.activeElement || document.activeElement === document.body || document.activeElement === go) this._focoCampo(q);
    }
    if (go) { go.disabled = true; go.setAttribute("aria-busy", "true"); }
    let voo = null;
    try {
      // a65 (2ª revisão) — o VOO é registrado AQUI, antes do PRIMEIRO `await` desta função. Enquanto ele
      // nascia lá embaixo, `this._voo` ficava null durante toda a trava do getSession (que a61 mostra pedir
      // `_acquireLock(-1)`, SEM prazo): uma 2ª pergunta nesse intervalo não cancelava nada, as duas
      // atravessavam o await, a 2ª sobrescrevia `this._voo` e a 1ª virava ÓRFÃ — o corte do prazo dela
      // virava no-op (`voo !== this._voo`), o ciclo de visibilidade não a enxergava, e ela ficava em
      // "Consultando o assessor…" para sempre, com `pendente: true` gravado junto. Era o gesto do fundador
      // ("ele repetiu e a segunda vez funcionou"). Registrar cedo também põe prazo na espera do PRÓPRIO
      // getSession (ver _corrida).
      this._ligarVisibilidade();
      voo = this._voo = { i, t0: Date.now(), parado: 0, escondidoEm: null, voltouEm: null, prazo: false, substituida: false, semRedeNoEnvio: this._semRede(), ctrl: null, corta: null };
      if (this._escondido()) voo.escondidoEm = voo.t0;   // já nasceu fora de vista: o relógio nem começa a andar
      try { voo.ctrl = new AbortController(); } catch (e) { /* navegador antigo: fica sem prazo, como antes */ }
      this._armarPrazo(voo);
      const C = window.CB_CONFIG || {};
      if (!window.supa || !C.FUNCTIONS_URL) { troca.erro = "O assessor exige a conta conectada ao backend."; return; }
      const { data: { session } } = await this._corrida(voo, window.supa.auth.getSession());
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
      let r, d = null, corpoFalhou = false;
      try {
        r = await fetch(C.FUNCTIONS_URL + "/ai-gateway", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, "apikey": C.SUPABASE_ANON_KEY },
          body: JSON.stringify(body),
          signal: voo.ctrl ? voo.ctrl.signal : undefined,
        });
        // O CORPO é lido AQUI DENTRO, com o prazo ainda armado: os cabeçalhos podem chegar e o corpo não
        // (abort no meio, conexão cortada, página congelada com a resposta a caminho). Engolir essa
        // rejeição com um `catch(() => ({}))` fazia o Assessor "responder" um TRAVESSÃO — sem erro, sem
        // botão — e gravá-lo no fio como se fosse resposta, de onde ele saía como `historico` das próximas.
        try { d = await r.json(); } catch (eCorpo) { d = {}; corpoFalhou = true; }
      } finally { this._desarmarPrazo(voo); }
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
      // Corpo que não chegou NÃO é resposta: cai no catch como a falha de ida e volta que é. (Com !r.ok o
      // status já disse o bastante e a frase saiu acima, então só o caminho de sucesso passa por aqui.)
      if (corpoFalhou) throw new Error("o corpo da resposta não chegou");
      troca.resposta = d.resposta || "—";
      troca.fontes = d.fontes || [];
      troca.figuras = d.figuras || [];   // f44
      troca.esquemas = d.esquemas || [];   // f50
      troca.semBase = !!d.semBase;
      this._foto = null; this._renderFoto();   // foto vale para a vez enviada
    } catch (e) {
      // a65 — a mesma frase servia a três mundos. Agora a CLASSE decide o que dizer, e o que dizer decide o
      // que a pessoa faz: repetir (saiu do app / demorou) ou olhar a internet (sem conexão).
      const classe = this._classeFalha(voo);
      troca.falha = classe;
      troca.erro = this._FALHAS[classe] || this._FALHAS.desconhecida;
      troca.retomar = true;
      // LGPD: classe e tempo, nunca a pergunta nem a resposta (o console do celular é copiável).
      try { console.warn("[ia] consulta não concluída", { classe, ms: this._ativoMs(voo) }); } catch (e2) {}
    } finally {
      this._desarmarPrazo(voo);
      if (this._voo === voo) this._voo = null;
      troca.pendente = false;
      // O botão de enviar não volta a valer quando ESTA consulta foi a SUBSTITUÍDA por uma pergunta nova: o
      // dono do botão passou a ser a consulta nova, e quem o reabilita é o finally dela. (A rejeição do
      // pedido cancelado chega ANTES de a nova registrar o seu voo, então `!this._voo` sozinho não basta.)
      if (go && !this._voo && !(voo && voo.substituida)) { go.disabled = false; go.removeAttribute("aria-busy"); }
      this._persist();
      // 18/set: o servidor disse que o plano não tem IA (sessão velha) → redesenha já com o convite no
      // lugar da caixa; o fio (com a troca negada) continua na tela.
      if (this._semIAServidor && document.getElementById("ia-q")) {
        this.render();
        this._anunciar(troca.erro);
      } else if (this._hist[i] !== troca) {
        // A conversa foi APAGADA (Nova conversa) enquanto a resposta vinha: não há balão para redesenhar, nem
        // "Nova resposta" para oferecer, nem o que anunciar — o botão ficava preso sobre a tela vazia, que não
        // rola e por isso nunca o recolhia (medido no preview em 21/set). Só o medidor de uso anda.
        this._uso();
      } else {
        // 21/set: a CHEGADA da resposta não move a tela. Só o balão desta troca é redesenhado; se a troca
        // continua onde o envio a deixou, a âncora é reafirmada (no máximo alguns px: o "pensando" virou
        // texto); se a pessoa foi ler outra coisa, ela fica onde está e o botão vira "Nova resposta".
        // NUNCA rola para o fim: quem recebe uma resposta longa quer o começo dela.
        this._renderTroca(i);
        if (this._aCaminho(i) || this._aindaNoAlto(i)) this._mostrarTroca(i, { instant: true });
        else this._pilula("nova");
        this._quadro(() => this._aoRolar());   // a seta do fim foi medida ANTES da âncora (em _renderTroca): mede de novo
        this._anunciar(troca.erro ? troca.erro : ("Resposta do assessor: " + String(troca.resposta || "")));
        this._uso();
        // Rede de acessibilidade, não um focus() incondicional: se desabilitar o botão empurrou o foco
        // para o <body>, ele volta ao campo. Quem devolve o foco no caso normal é o envio (acima).
        // Em aparelho de toque, nem isso: o teclado abriria por cima da resposta que acabou de chegar.
        if (!toque && q && document.activeElement === document.body) this._focoCampo(q);
      }
    }
  },

  // Foco sem arrastar a página: preventScroll é ignorado por navegador antigo — daí o catch.
  // 21/set: em aparelho de TOQUE não faz nada. Todo caminho que devolvia o foco ao campo (envio, chegada da
  // resposta, sugestão, abrirCom) passa por aqui, e o check reprova chamada de foco fora daqui e de _focoTroca.
  _focoCampo(q, opt) {
    if (!q || this._toque()) return;
    try { q.focus({ preventScroll: true }); } catch (e) { try { q.focus(); } catch (e2) {} }
    // opt.fim (sugestão e abrirCom: o campo acabou de ser preenchido) leva o cursor ao fim do texto — AQUI DENTRO,
    // depois do foco e só sem toque: mexer na seleção de um campo SEM foco dava o foco a ele em WebKit antigo, e no
    // iPhone a sugestão reabriria o teclado por outro caminho. No ENVIO não: mexer na seleção no meio da rolagem
    // suave da âncora a interrompe (medido no preview em 21/set a 1280 px: a troca parava em y 777).
    if (opt && opt.fim) { try { const n = String(q.value || "").length; q.setSelectionRange(n, n); } catch (e) {} }
  },
  // Foco na troca recém-enviada: não é campo de texto (o teclado não abre) e não rola (quem posiciona é
  // _mostrarTroca).
  _focoTroca(i) {
    const alvo = this._trocaEl(i);
    if (!alvo || typeof alvo.focus !== "function") return;
    try { alvo.setAttribute("tabindex", "-1"); alvo.focus({ preventScroll: true }); } catch (e) {}
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
        const abrir = f.url ? ` · <a class="ia-fonte-abrir" href="${esc(f.url) + anc}" target="_blank" rel="noopener"${anc ? ` title="abre na página ${f.pagina}"` : ""}>abrir${anc ? " na p. " + f.pagina : ""}</a>` : "";
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
