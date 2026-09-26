// Service worker do Civilbook (PWA).
//
// O QUE ELE RESOLVE (relato do fundador, 17/set/2026, PWA num Android): "às vezes demora a carregar"
// e a Início aparecia vazia. O SW antigo era rede-primeiro SEM PRAZO para ~75 arquivos: com sinal
// ruim (canteiro, elevador, troca Wi-Fi/4G) cada pedido ficava preso esperando a rede, mesmo com uma
// cópia boa guardada no aparelho. Além disso guardava QUALQUER resposta (404, página de erro).
// E o segundo relato (21/set/2026, medido no navegador do fundador): a PRIMEIRA abertura depois de
// publicar levou 15,2 s até o boot começar — com o carimbo de versão toda URL é nova, o SW não tinha
// cópia para nenhuma e buscava arquivo por arquivo; a abertura seguinte, 3,5 s. É o que o PACOTE POR
// VERSÃO (a52 passo 3, 22/set/2026) resolve: a partir da segunda abertura de cada versão publicada, o
// app abre DO APARELHO — nenhuma requisição de rede para os subrecursos do pacote.
//
// ESTRATÉGIA — decidida por estrategiaPara(), função pura testada em tests/sw-estrategia.test.mjs:
//
//   0. "pacote" (a52 passo 3): TODO subrecurso próprio pedido com o carimbo de versão (`?v=<sha>`, que é
//      como as páginas publicadas pedem js/, css/, data/ e imagens desde o passo 0) sai CACHE-PRIMEIRO
//      do cache DAQUELA versão, `civilbook-pacote-<sha>`. Não está lá → vai à rede pela URL carimbada e,
//      se for da versão DESTE SW e os bytes conferirem com o hash da publicação, entra no pacote.
//      NUNCA se entrega a cópia de outra versão: pedido `?v=A` não sai do pacote B, nem do cache sem
//      versão. É isso que fecha a mistura de versões por construção — a página diz a versão em cada URL,
//      e o SW só responde com bytes daquela versão ou com a rede. Esta estratégia SÓ EXISTE quando a
//      publicação injetou PACOTE_VERSAO e as listas (abaixo): no repositório, no preview e no E2E o
//      `?v=` da URL é ignorado e vale o resto da lista, como antes do passo 3.
//   1. "rede-com-prazo": páginas (navegação) e o que ainda é pedido SEM carimbo — o manifest.json, as
//      páginas como subrecurso e, sem pacote, tudo o que o app executa ou lê como código (.js, .css,
//      .json, .html, INCLUSIVE data/*.js). Vai à rede primeiro; se ela não responder em PRAZO_MS e houver
//      cópia guardada, entrega a cópia NA HORA e deixa a rede terminar em segundo plano, atualizando a
//      cópia para a próxima abertura. Sem cópia não há o que entregar: espera a rede.
//      As PÁGINAS ficam aqui de propósito: são o PONTEIRO da versão (10 min de TTL na borda, `<meta
//      name="cb-versao">` no <head>), e é por elas que o conserto urgente chega e que o piloto nunca
//      serve do aparelho uma landing que já não está no ar.
//      POR QUE data/*.js ESTÁ AQUI e não na 2 (achado da revisão de 17/set/2026): as bases são lidas
//      pelo js/ do MESMO deploy (data/param-*.js ↔ js/parametrico.js, data/cub.js, data/normas.js…).
//      Em cache-e-revalida, toda 1ª abertura depois de um deploy juntava js/ NOVO (rede) com data/
//      VELHO (cópia), mesmo com rede boa — e num PWA que fica dias aberto a "próxima abertura" demora.
//   2. "cache-e-revalida": SÓ o que não tem par no código e não leva carimbo — os ícones do manifesto e
//      a fonte dos ícones (endereçada pelo conteúdo). Entrega a cópia guardada na hora e busca a versão
//      nova em segundo plano.
//   3. "ignorar": o SW não toca no pedido (o navegador segue direto para a rede, sem cache nosso).
//      Tudo que NÃO é GET, tudo de OUTRO domínio (Supabase, jsDelivr, esm.sh), /cdn-cgi/ (Cloudflare),
//      o painel admin (admin.html e js/admin.js — só funciona online e pesa ~750 KB), o retorno do
//      OAuth do Drive (leva ?code= na URL), a acesso.html e o js/acesso.js (token_hash na URL) e
//      extensões desconhecidas. A lista SO_REDE é comparada com o CAMINHO do pedido, sem a query:
//      `js/acesso.js?v=<sha>` continua só rede.
//
// O PACOTE POR VERSÃO, em detalhe (roteiro completo em docs/DEPLOY.md, seção "Pacote por versão"):
//   · A LISTA nasce na PUBLICAÇÃO, nunca à mão: tools/carimbar-versao.ts (o mesmo passo do carimbo)
//     deriva do dist/ JÁ carimbado três listas e troca as duas linhas PACOTE_VERSAO/PACOTE abaixo SÓ na
//     cópia do dist/ — `abertura` (os src=/href= do app.html: o que a casca pede para abrir), `modulos`
//     (o que o registro js/modulos.js baixa ao clicar, mais o que as páginas públicas pedem) e
//     `sobDemanda` (o que é grande e PRO — a base SINAPI e os modelos do Paramétrico —, declarado em
//     PACOTE_SOB_DEMANDA da ferramenta: entra no pacote na primeira vez que a pessoa o abre naquela
//     versão, nunca em segundo plano). Cada item leva o HASH SHA-256 (16 hexas) dos bytes publicados.
//     No repositório as duas linhas ficam vazias: preview e E2E rodam sem pacote. A lista mora DENTRO
//     deste arquivo (e não num pacote.json) porque o SW precisa dela em dois momentos em que um arquivo
//     a mais custaria — no install (o que baixar) e a cada acordar (o que ainda falta para retomar) —
//     e porque um sw.js sem lista seria um sw.js sem versão: PACOTE_VERSAO é a versão DESTE código, a
//     única que este SW baixa; o `?v=` da URL de registro é só o gancho que fura a borda.
//   · O PACOTE É ENDEREÇADO PELO CONTEÚDO (achado da revisão de 22/set/2026): o servidor tem UM arquivo
//     por caminho e ignora a query, então `js/x.js?v=B` pedido DEPOIS de a publicação C entrar no ar
//     devolve o arquivo de C — e o SW gravava isso no pacote B, marcava "completo" e servia do aparelho,
//     para sempre, um arquivo de C dentro da versão B. Agora NADA entra num pacote sem (1) estar na lista
//     daquela versão e (2) ter os bytes com o hash que a publicação declarou (guardarNoPacote). Vale
//     para TODO caminho de escrita: o install, a descida em segundo plano e o pedido da página. Arquivo
//     de outra publicação é ENTREGUE à página (é o que ela receberia sem service worker: a mistura
//     "página velha + arquivo novo", que o carimbo declara não fechar) e NÃO é guardado; a descida PARA
//     no primeiro deles (o servidor já não tem esta versão: o resto viria igual) e anota na MARCA do
//     pacote quando foi — a próxima tentativa só depois de PACOTE_CARENCIA_OUTRA_MS, em qualquer vida
//     do SW (revisão de 22/set/2026, A2: antes cada vida refazia 3 rodadas baixando tudo para recusar).
//   · A CASCA GUARDADA É DA VERSÃO DO PACOTE (revisão de 22/set/2026, A1): havendo pacote, as PÁGINAS
//     (casca, landing, páginas legais) moram no pacote da versão DESTE SW, não no cache do app — que é um
//     só para todas as gerações de SW —, e só a página que declara esta versão no `<meta name="cb-versao">`
//     entra nele (redeComPrazo e o install conferem; versaoDaPagina). A página que chega com sha novo é
//     entregue e NÃO guardada: quem a guarda é o install do SW novo, no pacote novo. Sem isso, a primeira
//     abertura online depois de publicar D gravava a casca D onde o SW A a lê, e um SW D que não chegasse
//     a instalar (app fechado no meio, processo morto) deixava a abertura OFFLINE seguinte sem nada — a
//     casca D pedindo `?v=D` a um SW que só tem o pacote A, completo e inútil. Só o manifest.json continua
//     no cache do app: não leva versão, e os ícones que ele pede também não.
//   · INSTALL: o CORE (mínimo para a casca abrir offline) é tudo-ou-nada, como sempre — e, havendo
//     pacote, as PÁGINAS dele vão para o pacote da versão, com a versão do `<meta>` conferida; a ABERTURA da
//     versão (os subrecursos que o app.html pede — e só ele) também é tudo-ou-nada, e sai quase de graça,
//     porque a própria página acabou de baixar esses arquivos e o install os pede com cache:"default"
//     (URL carimbada não tem cópia errada possível no cache HTTP, e o hash confere de qualquer jeito); os
//     MÓDULOS são melhor-esforço: descem em segundo plano, em lotes, com prazo por arquivo, retentativa
//     com recuo e teto, e o install segura o SW vivo por eles no máximo PRAZO_INSTALL_MODULOS_MS. Falhou
//     no meio? O que chegou fica e serve; o que falta é retomado a cada acordar do SW (garantirPacote,
//     chamado pelos próprios pedidos da página), com carência entre rodadas e teto de rodadas por vida
//     do SW — nunca em laço, nunca segurando pedido nenhum, nunca duas descidas ao mesmo tempo.
//   · TROCA DE VERSÃO — a escolha, entre as duas opções descritas em docs/DEPLOY.md ("Pacote por
//     versão", item "A troca de versão — a escolha"): a página que chega com sha novo é servida DA REDE enquanto o pacote dela
//     desce (opção b), e não segurada no pacote antigo até ele completar (opção a). Com o HTML sempre da
//     rede, a opção (a) exigiria servir a página velha por cima da nova — ou misturar. A primeira
//     abertura depois de publicar custa o que a rede custa para a abertura (URLs novas para a borda, como
//     uma primeira visita sem SW), sem os passos que o SW antigo acrescentava (busca da cópia velha,
//     revalidação no-cache e o prazo de 3 s por arquivo, que era justamente o que misturava); a segunda
//     abertura da versão vem inteira do aparelho. skipWaiting e clients.claim continuam: como cada pedido
//     diz a versão, um SW novo assumindo uma aba velha responde a ela do pacote VELHO — sem mistura.
//   · FAXINA (activate): fica o pacote da versão deste SW, o MAIS RECENTE dos outros (a aba aberta desde
//     a publicação anterior continua servida dele, sempre) e mais os que SERVIRAM alguém nas últimas
//     PACOTE_RETENCAO_MS, até PACOTE_OUTROS_MAX — uma aba que atravessa duas publicações sem recarregar
//     não perde o pacote dela (achado da revisão de 22/set/2026). O uso é anotado na marca do pacote, no
//     máximo uma vez a cada PACOTE_USO_INTERVALO_MS. Os demais são apagados; nada fica para sempre.
//     E APAGADO NÃO VOLTA (conserto de 22/set/2026): a aba velha continua pedindo `?v=<versão dela>`
//     DURANTE o activate, e entre o `caches.has` e o `caches.open` de doPacote cabia o delete da faxina
//     — caches.open CRIA, então o pacote voltava vazio e o teto "atual + PACOTE_OUTROS_MAX" deixava de
//     valer. Agora o nome entra em _apagadosPelaFaxina ANTES do delete e doPacote o confere depois do
//     has, sem await no meio; e uma 2ª varredura depois do clients.claim (varrerZumbis) apaga o que a
//     GERAÇÃO ANTERIOR do SW, que não conhece essa lista, tenha recriado. E a descida DESISTE quando o
//     pacote desta versão sumiu (baixarPacote): era ela quem devolvia o zumbi COM arquivos e COM marca
//     nova, e marca nova faz a faxina SEGUINTE mantê-lo no lugar do pacote de uma aba viva. O limite
//     que sobra está no cabeçalho de varrerZumbis: zumbi sem marca, que a faxina seguinte leva.
//     Pacote nunca é migrado, nem de nem para (cópia migrada seria arquivo de outra geração dentro de
//     um pacote; e no sentido DE, o icon.svg de um pacote apagado viraria o ícone do PWA), e o que o
//     cache v3 tinha de código (js/css/data sem versão) e de PÁGINA não migra para o v4 quando há
//     pacote: em produção ninguém pede código sem carimbo (a cópia viraria órfã), e a página mora no
//     pacote, onde o install já pôs a da versão certa.
//   · VERSÕES: `civilbook-app-v4` (manifesto e, SEM pacote, páginas e código) / `civilbook-estatico-v4`
//     (ícones do manifesto e a fonte) + `civilbook-pacote-<sha>` por versão publicada (subrecursos
//     carimbados E as páginas dessa versão).
//
// REGRAS QUE NÃO SE NEGOCIAM:
//   - Nunca entregar HTML no lugar de JS/CSS. Só NAVEGAÇÃO cai para a casca app.html; e uma resposta
//     200 com text/html para um .js/.css (portal cativo de Wi-Fi, desafio do Cloudflare) é tratada
//     como falha de rede: nem é entregue nem é guardada — ver respostaPropria(). Vale para TODO
//     caminho de escrita, inclusive o INSTALL e o pacote: até 21/set/2026 o install era o único que
//     dispensava a régua, e com a fonte dos ícones no CORE isso virava caixa de glifo ausente.
//   - Só se guarda resposta 200 do próprio site. 404, 5xx e redirect não entram no cache.
//   - A chave do cache é origem + caminho, SEM query string: app.html?code=… não grava o código do
//     OAuth no cache e acha a mesma cópia de app.html. No pacote a versão está no NOME do cache, não na
//     chave.
//   - Pedido com carimbo nunca recebe cópia de outra versão nem cópia sem versão.
//   - Só entra no pacote o que a lista da versão conhece e cujos bytes batem com o hash publicado.
//   - A casca que sai do aparelho é da versão do pacote que vai servir os `?v=` dela: página de outra
//     versão não é guardada onde este SW a lê (A1).
//   - Nada espera sem teto: na descida o prazo por tentativa vale do pedido ao ÚLTIMO byte, e vencido
//     aborta o pedido (A7).
//
// REDE-PRIMEIRO DE VERDADE, SEM IR À REDE A CADA ABERTURA (estratégia 1): o Cloudflare manda max-age
// de 4 h no JS/CSS e de 10 min no HTML (medido em 17/set/2026), então o fetch() comum do SW devolvia JS
// de até 4 h atrás junto com HTML novo. O GitHub Pages carimba TODOS os arquivos com a hora do deploy no
// Last-Modified; modoDeBusca() compara o carimbo da cópia guardada com o do último HTML visto: cópia
// do mesmo deploy → deixa o cache HTTP responder, sem rede; cópia mais velha que o HTML (saiu deploy)
// → cache:"no-cache", que obriga a perguntar ao servidor. Se o carimbo faltar, pergunta sempre. Com o
// pacote, isso só vale para o que ainda é pedido sem carimbo.
//
// COMO SUBIR A VERSÃO: troque VERSAO abaixo ("v4" → "v5"). O activate APROVEITA as cópias boas dos
// caches "civilbook-app-*"/"civilbook-estatico-*" de outras versões (migrarCopias: mesma régua de
// respostaPropria, chave sem query) e só então os apaga. NÃO precisa subir versão para publicar
// mudança de HTML/JS/CSS — o pacote por versão já é por publicação. Suba quando mudar ESTE arquivo
// de um jeito que torne o cache antigo impróprio (chave, estratégia). Para EXPURGAR cópia ruim dos
// aparelhos, suba a versão COM APROVEITAR_ANTIGO = false nessa subida e volte para true na seguinte.
// v3 → v4 (22/set/2026, passo 3): o código saiu do cache do app e foi para os pacotes.
//
// CARIMBO DE VERSÃO (a52 passo 0, 20/set/2026 — tools/carimbar-versao.ts): na publicação, todo
// subrecurso próprio das páginas passa a ser pedido com `?v=<sha do commit publicado>`, e o registro
// deste arquivo no app.html vira `register("sw.js?v=<sha>")`. chaveDeCache() descarta a query, então a
// chave continua sendo origem + caminho. A versão que ESTE SW baixa é PACOTE_VERSAO (injetada na
// publicação, passo 3); o `?v=` da URL de registro NÃO é usado como versão — só fura a borda.
//
// LIMITES CONHECIDOS: (a) FECHADO em 22/set/2026 (passo 3) a partir da SEGUNDA publicação depois dele:
// era "com rede lenta, uma abertura pode misturar arquivos novos com cópias antigas", porque a cópia
// era achada pela chave sem query. Agora cada pedido diz a versão e o SW só responde com o pacote
// daquela versão ou com a rede. RESSALVA DE TRANSIÇÃO (só na publicação do passo 3, v3 → v4): na
// PRIMEIRA abertura depois de publicá-lo quem serve é o SW v3 que já está no aparelho, e ele ainda
// mistura pela chave sem query — nessa abertura o limite (a) vale como antes; o v4 instala no fim dela
// e vale da seguinte em diante. E a ABA que atravessa essa publicação aberta (o `reg.update()` de 10 min
// traz o v4, que apaga as cópias de código do v3 sem migrá-las e não tem pacote para a versão dela)
// PERDE O OFFLINE até recarregar: online ela segue recebendo da rede (a1); sem rede, o que não estava
// em cache é erro, onde o v3 serviria a cópia (revisão de 22/set/2026, A4). Nas publicações seguintes
// isso não acontece: a aba antiga fica com o pacote dela, que a faxina mantém. O que RESTA, declarado:
// (a1) a mistura "página velha + arquivo novo", que o carimbo não fecha — uma aba aberta desde ANTES
// da publicação que pede um arquivo ainda fora do seu pacote (módulo nunca aberto com pacote
// incompleto, ou item sob demanda) recebe da rede o arquivo da publicação nova, o mesmo que
// aconteceria sem service worker nenhum; ele NÃO entra no pacote (o hash não bate) e some ao navegar
// para a página nova; (a2) o Ctrl+Shift+R ignora o SW de propósito (vai tudo à rede pela URL carimbada:
// correto, só sem o pacote naquela carga); (a3) offline, um item sob demanda que a pessoa nunca abriu
// nesta versão é erro (o aviso com Tentar de novo); (a4) BIBLIOTECA DE CDN carregada sob demanda fica
// fora do offline (o SW ignora outro domínio, estratégia 3): o pdf.js do jsDelivr (js/pdfviewer.js,
// js/conta.js) e o que o Admin pede — offline o módulo abre, o PDF não.
// (b) O registro (app.html, fim do <body>) usa updateViaCache:"none" e reg.update() ao voltar ao
// primeiro plano, no máximo 1 vez a cada 10 min. A URL registrada é `sw.js?v=<sha da página>` e o
// servidor tem UM sw.js por caminho: o update de um PWA que ficou dias aberto recebe o sw.js da
// publicação NOVA por essa URL antiga — bytes diferentes, porque PACOTE_VERSAO e as listas mudam a cada
// publicação — e é por isso que a versão vem de PACOTE_VERSAO e não da URL: esse SW baixa o pacote novo
// em segundo plano (pelas URLs certas) e segue servindo a aba velha do pacote dela; na próxima abertura
// a página nova já encontra o pacote pronto. A borda pode segurar `sw.js?v=<antigo>` por até 4 h
// (updateViaCache só fura o cache do navegador): o update chega com esse atraso, no pior caso.
// (c) FECHADO em 21/set/2026 (a52 passo 1b). A folha (css/icones.css) e a FONTE dos ícones são do
// próprio domínio e estão as duas no CORE: offline, depois da primeira visita, o ícone DESENHA. A fonte
// é subsetada (33.104 B, 260 glifos) e fica FORA de CARIMBAVEL: o nome dela JÁ é o subconjunto (soma
// dos codepoints), então a URL muda sozinha quando os glifos mudam e não muda quando eles não mudam —
// e por isso o install a pede com cache:"default", nunca "reload": a cópia do cache HTTP para esse nome
// é a certa por construção, e o reload fazia a fonte descer duas vezes na mesma visita (achado da
// revisão de 22/set/2026). Na PRIMEIRA visita não há service worker, e aí a fonte vem da rede.
// (d) 404 com cópia guardada entrega a cópia (decisão, ver redeComPrazo). Arquivo removido ou
// renomeado num deploy fica órfão no cache, e a migração o carrega de versão em versão. Órfão não é
// pedido por ninguém (o HTML novo não o cita): o custo é espaço, não comportamento. Faxina = uma
// subida de versão com APROVEITAR_ANTIGO = false. Os pacotes não têm órfão: cada um é apagado inteiro.
// (e) iOS: o Safari pode apagar registro e caches de um site pouco usado; o PWA instalado na tela
// inicial guarda. Sem SW a página abre da rede pela URL carimbada (correta) e reinstala. Cota: até
// PACOTE_OUTROS_MAX + 1 pacotes (medido em 22/set/2026 no dist/ do repositório, em LF — o resumo de cada run traz o exato: abertura 38
// arquivos / ~810 KB crus, módulos 43 / ~875 KB — ~1,7 MB crus por pacote), mais o que a pessoa
// abriu sob demanda naquela versão. NÃO medido em aparelho.
// (f) Um SW encerrado por ociosidade no meio da descida dos módulos retoma no próximo pedido da página
// ou na próxima abertura; enquanto isso o módulo que falta vem da rede pela URL carimbada.
// (g) `cache.put` recusado (cota cheia) conta como arquivo que NÃO chegou: o pacote fica parcial, serve o
// que tem, e a retomada tenta de novo dentro do teto — nunca "completo" com arquivo faltando.

const VERSAO = "v4";
const PREFIXO = "civilbook-";
const CACHE_APP = PREFIXO + "app-" + VERSAO;           // páginas, manifesto e o que ainda vem sem carimbo
const CACHE_ESTATICO = PREFIXO + "estatico-" + VERSAO; // ícones do manifesto e a fonte (cache-e-revalida)
const PREFIXO_PACOTE = PREFIXO + "pacote-";            // + <sha>: UM cache por versão publicada
const PRAZO_MS = 3000;                                 // quanto se espera a rede antes de entregar a cópia
const APROVEITAR_ANTIGO = true;                        // false só na subida de versão feita para EXPURGAR

// PUBLICAÇÃO: tools/carimbar-versao.ts troca as DUAS linhas abaixo na cópia do dist/ (e só nela), com o
// sha do commit e as listas derivadas do próprio dist/ — cada item é [caminho, hash SHA-256 dos bytes
// publicados, 16 hexas]. Reformatá-las faz a publicação PARAR (a substituição exige casar exatamente uma
// vez); no repositório elas ficam vazias de propósito. Sem lista não há pacote (VERSAO_SW fica "").
const PACOTE_VERSAO = "cd8b896";
const PACOTE = {"abertura":[["css/icones.css","f1142614aafff0b2"],["css/style.css","bcf4658e4bd20e94"],["data/afiliados.js","9c216a477f74c53f"],["data/checklists.js","9d368a5af43086ae"],["data/laudos.js","526f9c9677e27a81"],["data/materiais.js","f009bae3bc0c6d73"],["icon-180.png","31553e752e01ee7b"],["icon.svg","91e0215421549b96"],["js/a11y-icons.js","1d53337f3dc6cd43"],["js/ads.js","9c04d5cec22a022d"],["js/afiliados.js","7d078bbdf52be8e9"],["js/app.js","3d51c3bb18263998"],["js/auth.js","5462417631ea0f75"],["js/calculadoras.js","2bad3d8f56bf0967"],["js/cbselect.js","cfdecf6f5690901f"],["js/compartilhar.js","0aa817afde463d13"],["js/config.js","dc453d008170bcfc"],["js/consent.js","97c24b4b6435d706"],["js/copyright.js","36d84cd0321dccaf"],["js/feedback.js","239eb3d6838f9e8d"],["js/instalar.js","b328f5e632a809ca"],["js/metrics.js","1f7c80747416312b"],["js/modulos.js","2329e9767de6ef35"],["js/observar.js","435121949f3f6af0"],["js/pagamentos.js","64576daaa35e8df9"],["js/parametrico.js","39e9324175020c94"],["js/precos.js","e3011bec91bba25d"],["js/protecao.js","02949f3a32fe5fb6"],["js/recomenda.js","4905b3a7def88d1c"],["js/repositorio.js","6342bedec2a66fba"],["js/roadmap.js","9ff7503d39aa9c4c"],["js/sinapi.js","b56bef59179de501"],["js/store.js","bcf22622605b9fb3"],["js/supa.js","230357e3538fcd11"],["js/theme.js","0623cac7361ff7d9"],["js/ui.js","d9c30437e4b1fb08"],["js/vendor/supabase.js","53eec6009c7ce5aa"],["js/whatsapp.js","82fd4784f5a4173b"]],"modulos":[["data/avaliacao.js","949fd589ae5a5647"],["data/compras.js","ef4bde0f01b8b0ba"],["data/conferencia.js","b36613df66207d60"],["data/cub.js","f3921a41a2639e95"],["data/exemplo-obra.js","99e426c123844945"],["data/garantias.js","ca8f8d04c31f19c9"],["data/interacoes.js","ef1ee92a9f60b8d5"],["data/manutencao.js","8b92cf47a0de7b9a"],["data/normas.js","b3afaefaa1025ec7"],["data/nrs.js","a58cf704cf36be7a"],["data/tecnicas.js","2be153f72c193d8f"],["js/assistente.js","8a0271359640309b"],["js/auth-modal.js","e7e4033848cc812a"],["js/avaliacao.js","4c258acafc2e94cf"],["js/biblioteca.js","38594147fc5c9514"],["js/colecao.js","4bf7de4f98b39a42"],["js/compras.js","ba58f376074158da"],["js/conferencia-ia.js","a283018cc24744e0"],["js/conferencia.js","774c8442f03fea97"],["js/conformidade.js","f3bc3124a0fe8422"],["js/conta.js","bb0ee8cf715b777a"],["js/conteudo.js","0e5bc3c54ea81102"],["js/cronograma.js","faf778306311f919"],["js/cub.js","28f04e87c40ccb67"],["js/diario-motor.js","b942aa54f0d4675d"],["js/diario.js","3361659d4fcbcb77"],["js/eventos.js","3383e96b1fee5717"],["js/exemplo.js","3efdbeebea633159"],["js/garantias.js","064e63985ec8c0aa"],["js/interacoes.js","337fd4e5241783ce"],["js/manual.js","2441bb9c00d54ada"],["js/manutencao-sla.js","2913c7b9a7b9895f"],["js/manutencao.js","5ea23aa64b3b7a97"],["js/manutencao2.js","680319f5859a3d2b"],["js/orcamento.js","0f64ecdcbf313ce7"],["js/pdfviewer.js","7c7401348a82df84"],["js/projetos.js","741d36f6fa2bf448"],["js/rdo.js","d4252406ca2bcde0"],["js/referencias.js","6536167c3dd46834"],["js/seguranca.js","411f37d1a283564f"],["js/sinapi-changelog.js","f37979173f239e52"],["js/tecnicas.js","5c591525a9fcf6b9"],["js/tracking.js","0a8be6a2ae5fe633"]],"sobDemanda":[["data/param-escola.js","daaa7500575ccd98"],["data/param-pam.js","5b26aa8a7704e4fb"],["data/sinapi.js","3766b6176b9065b0"]]};

const HASH_TAMANHO = 16;                  // hexas do SHA-256 que a lista carrega (o mesmo de tools/carimbar-versao.ts)
const PACOTE_LOTE = 6;                    // quantos arquivos do pacote descem ao mesmo tempo
const PACOTE_TENTATIVAS = 3;              // por arquivo, por rodada (rede caída ou 5xx; 404 e hash errado não repetem)
const PACOTE_RECUO_MS = 1500;             // espera antes de repetir; dobra a cada tentativa
const PACOTE_PRAZO_ARQUIVO_MS = 20000;    // teto por pedido na descida (resposta que nunca chega conta como rede caída)
const PACOTE_CARENCIA_MS = 60000;         // depois de uma rodada com falha, quanto esperar pela próxima
const PACOTE_CARENCIA_OUTRA_MS = 4 * 3600000; // depois de receber arquivo de OUTRA publicação: gravada na marca, sobrevive às vidas do SW (= o TTL da borda)
const PACOTE_RODADAS_MAX = 3;             // rodadas com falha por vida do SW (depois, só na próxima vida)
const PRAZO_INSTALL_MODULOS_MS = 90000;   // quanto o install segura o SW vivo pelos MÓDULOS (a abertura é tudo-ou-nada)
const PACOTE_RETENCAO_MS = 24 * 3600000;  // um pacote que serviu alguém há menos que isto sobrevive à faxina
const PACOTE_OUTROS_MAX = 2;              // quantos pacotes além do atual a faxina pode manter
const PACOTE_USO_INTERVALO_MS = 600000;   // a marca de uso é regravada no máximo a cada 10 min, por versão

// Mínimo para abrir offline logo após instalar. O resto entra no cache conforme é pedido.
// O install é TUDO-OU-NADA para o CORE: um 404 aqui e o SW não instala (o teste confere que todos
// existem e vão para dist/).
const CORE = ["app.html", "index.html", "css/style.css", "css/icones.css",
  "css/tabler-icons-3.47.0-21638061-sub.woff2", "manifest.json", "icon.svg"];
// Itens do CORE que as páginas pedem COM carimbo (?v=<sha>). Havendo pacote, eles NÃO são pedidos pelo
// CORE: vêm pela abertura do pacote da versão, com o hash conferido (a publicação exige que estejam na
// lista `abertura`); sem pacote (preview, E2E), vão crus para o cache do app, como sempre. Páginas e
// manifest.json ficam de fora pelo mesmo motivo de tools/carimbar-versao.ts: são o PONTEIRO da versão,
// não o conteúdo dela. A FONTE dos ícones também fica de fora, por motivo próprio: o nome dela já
// carrega o subconjunto (tools/gerar-icones.ts, nomeFonteLocal), então a URL muda sozinha quando os
// glifos mudam e NÃO muda quando eles não mudam. Fonte nenhuma é carimbada, aqui e em
// tools/carimbar-versao.ts; travado por tests/icones.check.mjs.
const CARIMBAVEL = ["css/style.css", "css/icones.css", "icon.svg"];
// Páginas legais: o banner de cookies e o cadastro apontam para elas; offline e sem cópia, quem
// tocasse em "Política de Privacidade" recebia a casca do app no lugar. Entram no install SEM o
// tudo-ou-nada: se uma faltar, o SW instala do mesmo jeito.
const CORE_EXTRA = ["termos.html", "privacidade.html"];
const CASCA = "app.html";

// Caminhos (relativos à pasta do sw.js) que o SW nunca intercepta.
// acesso.html e js/acesso.js (d24, 18/set/2026): a página dos links de e-mail do login recebe o token_hash na
// URL — mesma razão da drive-callback.html: nada de cópia em cache nem de casca do app no lugar dela.
const SO_REDE = ["sw.js", "admin.html", "js/admin.js", "drive-callback.html", "acesso.html", "js/acesso.js",
  "viabilidade.html", "js/viabilidade.jsx"];
const SO_REDE_PREFIXOS = ["cdn-cgi/", ".well-known/"];

const EXT_CODIGO = ["js", "mjs", "css", "json", "webmanifest", "html", "htm"];
const EXT_ESTATICO = ["png", "jpg", "jpeg", "webp", "gif", "svg", "ico", "avif", "woff", "woff2", "ttf", "otf"];

const ESTRATEGIA = { IGNORAR: "ignorar", REDE_PRAZO: "rede-com-prazo", CACHE_REVALIDA: "cache-e-revalida", PACOTE: "pacote" };

// A lista da versão, indexada: caminho → hash. Vazia = sem pacote.
const HASH_DO = new Map([...PACOTE.abertura, ...PACOTE.modulos, ...PACOTE.sobDemanda]);
// A versão que ESTE SW serve e baixa: a injetada na publicação, e só com lista. "" = sem pacote — no
// repositório, no preview e no E2E o `?v=` da URL de registro não vira versão.
const VERSAO_SW = (PACOTE_VERSAO && HASH_DO.size) ? PACOTE_VERSAO : "";

// ---------------------------------------------------------------------------------------------
// Decisão PURA (sem rede, sem cache, sem relógio) — é o que tests/sw-estrategia.test.mjs exercita.
// ---------------------------------------------------------------------------------------------

// Chave do cache: origem + caminho. Sem query e sem hash; pasta vira o index.html dela.
function chaveDeCache(url) {
  const u = new URL(url);
  return u.origin + (u.pathname.endsWith("/") ? u.pathname + "index.html" : u.pathname);
}

function extensaoDe(caminho) {
  const nome = caminho.slice(caminho.lastIndexOf("/") + 1);
  const i = nome.lastIndexOf(".");
  return i <= 0 ? "" : nome.slice(i + 1).toLowerCase();
}

// O sha do carimbo de versão numa query: "?v=e950d6c" → "e950d6c". Só a forma que
// tools/carimbar-versao.ts produz (7 a 40 dígitos hexadecimais minúsculos, nada mais na query).
function versaoDaQuery(search) {
  const m = /^\?v=([0-9a-f]{7,40})$/.exec(search || "");
  return m ? m[1] : null;
}

function nomePacote(versao) { return PREFIXO_PACOTE + versao; }

// A versão que uma PÁGINA publicada declara: o `<meta name="cb-versao" content="<sha>">` que
// tools/carimbar-versao.ts põe no <head> de toda página do dist/. null = página sem carimbo (preview, E2E
// do modo local) ou texto que não é uma página nossa. É por ela que a casca guardada no aparelho fica
// SEMPRE da mesma versão que o pacote que a serve (achado da revisão de 22/set/2026, A1): sem essa régua,
// a primeira abertura online depois de publicar D gravava a casca D no cache que o SW A lê, e — se o SW
// D não chegasse a instalar (app fechado no meio, processo morto, rede caída) — a abertura OFFLINE
// seguinte servia a casca D pedindo `?v=D` a um SW que só tem o pacote A: erro em tudo, com o app
// inteiro no aparelho e ninguém mais o pedindo.
function versaoDaPagina(html) {
  const m = /<meta\s+name="cb-versao"\s+content="([0-9a-f]{7,40})"\s*\/?>/.exec(String(html || ""));
  return m ? m[1] : null;
}

// pedido = { url, method, mode, destination, cache, temRange } · escopo = { origem, base }
// (base = pasta do sw.js, "/" em produção) · comPacote = este SW tem pacote? (sem pacote o ?v= é
// ignorado). Devolve { estrategia } ou { estrategia, navegacao, chave } — e, no pacote, também
// { versao, rel } (a versão do PEDIDO e o caminho relativo, que é a chave da lista).
function estrategiaPara(pedido, escopo, comPacote = !!VERSAO_SW) {
  const FORA = { estrategia: ESTRATEGIA.IGNORAR };
  if (!pedido || pedido.method !== "GET") return FORA;
  let u;
  try { u = new URL(pedido.url); } catch (_e) { return FORA; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return FORA;
  if (u.origin !== escopo.origem) return FORA;                       // outro domínio: nunca é nosso
  if (!u.pathname.startsWith(escopo.base)) return FORA;
  if (pedido.temRange) return FORA;                                  // resposta parcial (206) não se guarda
  if (pedido.cache === "only-if-cached" && pedido.mode !== "same-origin") return FORA; // fetch() lançaria

  const rel = u.pathname.slice(escopo.base.length);
  if (SO_REDE.includes(rel)) return FORA;                            // pelo CAMINHO: carimbado ou não
  if (SO_REDE_PREFIXOS.some((p) => rel.startsWith(p))) return FORA;

  const chave = chaveDeCache(u.href);
  if (pedido.mode === "navigate" || pedido.destination === "document") {
    return { estrategia: ESTRATEGIA.REDE_PRAZO, navegacao: true, chave };
  }
  const ext = extensaoDe(u.pathname);
  // Subrecurso com o carimbo de versão: cache-primeiro no pacote DAQUELA versão. Página nunca leva
  // carimbo (tools/carimbar-versao.ts reprova), e se levasse continuaria sendo ponteiro: fica de fora.
  const versao = comPacote ? versaoDaQuery(u.search) : null;
  if (versao && ext !== "html" && ext !== "htm" && (EXT_ESTATICO.includes(ext) || EXT_CODIGO.includes(ext))) {
    return { estrategia: ESTRATEGIA.PACOTE, navegacao: false, chave, versao, rel };
  }
  // data/*.js NÃO tem regra própria de propósito: cai em EXT_CODIGO, a mesma estratégia do js/ que o lê.
  if (EXT_ESTATICO.includes(ext)) return { estrategia: ESTRATEGIA.CACHE_REVALIDA, navegacao: false, chave };
  if (EXT_CODIGO.includes(ext) || u.pathname.endsWith("/")) {
    return { estrategia: ESTRATEGIA.REDE_PRAZO, navegacao: false, chave };
  }
  return FORA;
}

// A resposta pode ser entregue E guardada? r = { navegacao, chave, status, tipo, contentType }.
// É aqui que mora o "nunca HTML no lugar de JS/CSS".
function respostaPropria(r) {
  if (r.status !== 200 || r.tipo !== "basic") return false;
  const ehHtml = /^\s*text\/html\b/i.test(r.contentType || "");
  if (!ehHtml) return true;
  return !!r.navegacao || /\.html?$/i.test(r.chave || "");
}

// "default" = o cache HTTP pode responder (rápido, sem rede) · "no-cache" = revalida no servidor.
// lmCopia / lmDeploy = Last-Modified em ms (0 = desconhecido). Navegação fica no default: o HTML já
// tem só 10 min de cache HTTP e recriar um pedido de navegação com init muda o modo dele.
function modoDeBusca(m) {
  if (m.navegacao) return "default";
  if (m.lmCopia > 0 && m.lmDeploy > 0 && m.lmCopia >= m.lmDeploy) return "default";
  return "no-cache";
}

// Mesma versão já guardada → não regrava (o SW antigo fazia ~75 escritas no cache por abertura).
// a / b = { etag, lastModified, tamanho } (strings dos cabeçalhos; podem faltar).
function mesmaVersao(a, b) {
  if (!a || !b) return false;
  const limpa = (e) => String(e).replace(/^W\//, "");
  if (a.etag && b.etag) return limpa(a.etag) === limpa(b.etag);
  if (a.lastModified && b.lastModified && a.tamanho && b.tamanho) {
    return a.lastModified === b.lastModified && a.tamanho === b.tamanho;
  }
  return false;
}

// Quais caches apagar no activate: só os NOSSOS (prefixo) que não estão na lista dos que ficam.
function cachesParaApagar(nomes, atuais) {
  return nomes.filter((n) => n.startsWith(PREFIXO) && !atuais.includes(n));
}

// Quais PACOTES ficam no activate: o desta versão (atual, "" quando não há); o MAIS RECENTE dos outros,
// sempre (é ele que serve a aba aberta desde a publicação anterior, ou a segunda aba, depois que este
// SW a assume); e, até PACOTE_OUTROS_MAX, os que SERVIRAM alguém dentro de PACOTE_RETENCAO_MS — uma
// aba que atravessa duas publicações sem recarregar continua servida do pacote dela. "Recente" é o
// maior entre a criação e o último uso. pacotes = [{ nome, criado, usado }] (ms; criado 0 = pacote sem
// marca, que não fica). Empate é decidido pelo nome, para a resposta ser a mesma em qualquer ordem.
function escolherPacotes(pacotes, atual, agora = Date.now()) {
  const manter = atual ? [atual] : [];
  const outros = pacotes.filter((p) => p.nome !== atual && p.criado > 0)
    .map((p) => ({ nome: p.nome, recente: Math.max(p.criado, p.usado || 0) }))
    .sort((a, b) => (b.recente - a.recente) || (a.nome < b.nome ? 1 : -1));
  outros.forEach((p, i) => {
    if (i === 0 || (i < PACOTE_OUTROS_MAX && agora - p.recente <= PACOTE_RETENCAO_MS)) manter.push(p.nome);
  });
  return manter;
}

// Exposto para o teste (e para depurar no DevTools: self.CB_SW.VERSAO).
self.CB_SW = {
  VERSAO, CACHE_APP, CACHE_ESTATICO, PREFIXO_PACOTE, PRAZO_MS, CORE, CORE_EXTRA, SO_REDE, ESTRATEGIA,
  PACOTE, PACOTE_VERSAO, PACOTE_LOTE, PACOTE_TENTATIVAS, PACOTE_RODADAS_MAX, PACOTE_PRAZO_ARQUIVO_MS,
  PACOTE_CARENCIA_OUTRA_MS,
  PACOTE_RETENCAO_MS, PACOTE_OUTROS_MAX, PACOTE_USO_INTERVALO_MS, PRAZO_INSTALL_MODULOS_MS, HASH_TAMANHO,
  estrategiaPara, chaveDeCache, respostaPropria, modoDeBusca, mesmaVersao, cachesParaApagar,
  versaoDaQuery, nomePacote, escolherPacotes, versaoDaPagina,
};

// ---------------------------------------------------------------------------------------------
// Execução (rede + cache).
// ---------------------------------------------------------------------------------------------
const BASE = new URL("./", self.location.href);              // pasta do sw.js
const ESCOPO = { origem: BASE.origin, base: BASE.pathname };
const URL_CASCA = new URL(CASCA, BASE).href;
// "?v=<sha>" com que a descida pede os arquivos do pacote; "" sem pacote.
const CARIMBO = VERSAO_SW ? "?v=" + VERSAO_SW : "";
// A marca do pacote: um item do próprio cache do pacote que diz se ele está completo, quando nasceu e
// quando serviu alguém pela última vez (só cabeçalhos, para poder ser lida quantas vezes for preciso).
// Nunca é servida a página nenhuma.
const MARCA_PACOTE = new URL("__pacote__", BASE).href;
// Exposto para o teste (e para depurar no DevTools: self.CB_SW.VERSAO_SW diz a versão que este SW serve).
self.CB_SW.CARIMBO = CARIMBO;
self.CB_SW.VERSAO_SW = VERSAO_SW;
self.CB_SW.CARIMBAVEL = CARIMBAVEL;
self.CB_SW.MARCA_PACOTE = MARCA_PACOTE;

let deployVisto = 0;      // maior Last-Modified (ms) visto num HTML vindo da rede nesta instância do SW
let deployLido = false;   // já tentou recuperar o carimbo da casca guardada?

const lmDe = (resp) => (resp ? Date.parse(resp.headers.get("last-modified") || "") || 0 : 0);
const versaoDe = (resp) => (resp ? {
  etag: resp.headers.get("etag"),
  lastModified: resp.headers.get("last-modified"),
  tamanho: resp.headers.get("content-length"),
} : null);

// ONDE MORA A CÓPIA de um pedido rede-com-prazo. Havendo pacote, as PÁGINAS (casca, landing, páginas
// legais) moram no pacote da versão DESTE SW — porque a casca que sai do aparelho offline tem de ser da
// mesma versão que o pacote que vai servir os `?v=` dela (A1, ver versaoDaPagina); e o cache do app
// (civilbook-app-v4) é UM só para todas as gerações de SW: o SW D instalando escreveria a casca D onde
// o SW A, ainda ativo, a lê. O manifest.json fica no cache do app: não leva carimbo nem versão e os ícones
// que ele pede também não — é o único ponteiro que as gerações compartilham, de propósito. Sem pacote
// (preview, E2E), tudo no cache do app, como antes do passo 3.
const ehPagina = (plano) => !!plano.navegacao || /\.html?$/i.test(plano.chave || "");
const cacheDasPaginas = () => caches.open(VERSAO_SW ? nomePacote(VERSAO_SW) : CACHE_APP);
const cacheDaCopia = (plano) => (VERSAO_SW && ehPagina(plano) ? cacheDasPaginas() : caches.open(CACHE_APP));
// Só a página da versão deste SW entra no pacote dele (a página que chega com sha novo é ENTREGUE e não
// guardada: quem a guarda é o install do SW novo, no pacote novo). Lê o corpo de um clone, nunca o que
// vai à página.
const admitePagina = async (resp) => versaoDaPagina(await resp.text()) === VERSAO_SW;

// O SW é encerrado quando fica ocioso e a variável zera: recupera o carimbo da casca guardada.
async function deployConhecido() {
  if (!deployVisto && !deployLido) {
    deployLido = true;
    deployVisto = lmDe(await (await cacheDasPaginas()).match(URL_CASCA));
  }
  return deployVisto;
}

function comPrazo(promessa, ms) {
  let t;
  const prazo = new Promise((ok) => { t = setTimeout(() => ok(null), ms); });
  return Promise.race([promessa, prazo]).finally(() => clearTimeout(t));
}
// Um prazo que vale para VÁRIAS esperas seguidas (o pedido e depois o corpo): `venceu` resolve null na hora.
function relogio(ms) {
  let t;
  const venceu = new Promise((ok) => { t = setTimeout(() => ok(null), ms); });
  return { venceu, parar: () => clearTimeout(t) };
}
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));

// Vai à rede e, se a resposta serve, guarda a cópia SEM segurar a entrega (cache = null: não guarda).
// `admite` (opcional): porta a mais para a gravação, lida de um CLONE em segundo plano — é a régua da
// versão da página (admitePagina). Devolve { resp, boa } e nunca rejeita (resp = null quando a rede falhou).
async function buscarEGuardar(evento, init, cache, plano, copia, admite = null) {
  let resp;
  try {
    resp = init ? await fetch(evento.request, init) : await fetch(evento.request);
  } catch (_e) {
    return { resp: null, boa: false };
  }
  // Redirect de navegação: devolve como veio (o navegador segue) e não guarda.
  if (resp.type === "opaqueredirect") return { resp, boa: true };
  const boa = respostaPropria({
    navegacao: plano.navegacao, chave: plano.chave,
    status: resp.status, tipo: resp.type, contentType: resp.headers.get("content-type"),
  });
  if (boa) {
    if (plano.navegacao) deployVisto = Math.max(deployVisto, lmDe(resp));
    if (cache && !mesmaVersao(versaoDe(copia), versaoDe(resp))) {
      // clone() ANTES de entregar; a gravação corre em paralelo (cota cheia não derruba a entrega).
      const paraGuardar = resp.clone();
      const gravacao = (async () => {
        if (admite && !(await admite(paraGuardar.clone()))) return;
        await cache.put(plano.chave, paraGuardar);
      })().catch(() => {});
      try { evento.waitUntil(gravacao); } catch (_e) { /* evento já encerrado: grava sem garantia */ }
    }
  }
  return { resp, boa };
}

// Sem resposta boa e sem cópia: 404/5xx de verdade seguem como vieram; HTML-no-lugar-de-JS vira erro.
function semSaida(fim) {
  if (fim.resp && fim.resp.status !== 200) return fim.resp;
  return Response.error();
}

async function redeComPrazo(evento, plano) {
  const cache = await cacheDaCopia(plano);
  const copia = await cache.match(plano.chave);
  const modo = modoDeBusca({
    navegacao: plano.navegacao, lmCopia: lmDe(copia), lmDeploy: await deployConhecido(),
  });
  // Página, havendo pacote, só é guardada se for da versão DESTE SW (A1): a página nova é entregue e
  // segue; quem a guarda é o install do SW novo, no pacote novo.
  const admite = VERSAO_SW && ehPagina(plano) ? admitePagina : null;
  const rede = buscarEGuardar(evento, modo === "default" ? null : { cache: modo }, cache, plano, copia, admite);
  evento.waitUntil(rede); // a rede termina (e atualiza a cópia) mesmo depois de a cópia ser entregue

  // Só existe prazo quando há o que entregar no lugar da rede.
  const primeiro = copia ? await comPrazo(rede, PRAZO_MS) : await rede;
  if (primeiro && primeiro.boa) return primeiro.resp;
  // Prazo estourou, rede caiu ou resposta imprópria → a cópia. "Imprópria" inclui 404 e 5xx, e é
  // DECISÃO: quando a hospedagem quebra (Pages despublicado, CNAME errado, repo privado) o site
  // inteiro responde 404, e o PWA instalado tem de seguir abrindo com o que guardou. O preço é um
  // arquivo removido num deploy continuar servido a quem já o tinha (limite (d) no cabeçalho).
  if (copia) return copia;
  const fim = primeiro || await rede;
  if (plano.navegacao) {
    // Última saída, SÓ para navegação: a casca do app. Nunca para JS/CSS/imagem.
    const casca = await cache.match(URL_CASCA);
    if (casca) return casca;
  }
  return semSaida(fim);
}

async function cacheERevalida(evento, plano) {
  const cache = await caches.open(CACHE_ESTATICO);
  const copia = await cache.match(plano.chave);
  const rede = buscarEGuardar(evento, null, cache, plano, copia);
  evento.waitUntil(rede);
  if (copia) return copia;
  const fim = await rede;
  return fim.boa ? fim.resp : semSaida(fim);
}

// Os pacotes que a FAXINA desta vida do SW apagou (a52 P3, conserto de 22/set/2026). Entre o
// `caches.has` e o `caches.open` de doPacote cabe o `caches.delete` do activate — e caches.open CRIA o
// cache: o pacote recém-apagado voltava VAZIO, quebrando a garantia "no máximo o atual +
// PACOTE_OUTROS_MAX" e deixando lixo no aparelho de quem fica com aba aberta. O nome entra aqui ANTES
// do delete, e quem for abrir confere DEPOIS do await do has e SEM await até o open — o JS é de uma
// linha só, então nada roda entre a conferência e a chamada, e a ordem das duas mensagens (open depois
// de delete, nunca antes) deixa de existir como corrida. Cresce no máximo o número de pacotes da vida
// do SW. Ver varrerZumbis() para o que isto NÃO fecha.
const _apagadosPelaFaxina = new Set();

// Estratégia 0: cache-primeiro no pacote da versão que o PEDIDO diz. Sem cópia → a rede, pela URL
// carimbada; a resposta só entra no pacote se for da versão deste SW E passar em guardarNoPacote (lista
// e hash). Pacote de outra versão é lido se existir, nunca criado nem recebe arquivo — caches.open
// criaria um cache vazio que a faxina apagaria; só a marca de USO dele é regravada, para a faxina saber
// que ele serve alguém. Sem rede e sem cópia → erro, NUNCA a cópia de outra versão nem a cópia sem
// versão: é a regra que fecha a mistura. Sem prazo aqui de propósito: não há cópia alternativa a
// entregar, e a página é quem tem o aviso (o splash lento e o "Tentar de novo" dos módulos).
async function doPacote(evento, plano) {
  const atual = plano.versao === VERSAO_SW;
  const nome = nomePacote(plano.versao);
  // A lista vale para TODO nome, inclusive o desta versão (a conferência está antes do `atual ||`, de
  // propósito). Hoje o pacote atual nunca entra nela — pacotesAManter sempre o devolve em `ficam`, logo
  // ele nunca está em `antigos` —, e se um dia entrar é melhor este SW ir à rede do que recriar o cache
  // que a própria faxina dele acabou de apagar. Para os outros, a pergunta é feita DUAS vezes de
  // propósito: antes do has (para nem perguntar) e depois dele — é entre a resposta do has e o open que
  // a faxina apaga, e a 2ª conferência é síncrona com a chamada do open.
  const existe = !_apagadosPelaFaxina.has(nome) && (atual || await caches.has(nome));
  const cache = existe && !_apagadosPelaFaxina.has(nome) ? await caches.open(nome) : null;
  const copia = cache ? await cache.match(plano.chave) : undefined;
  // Todo pedido da página é uma chance de retomar o pacote desta versão (o SW acorda por ele).
  if (atual && !_pacote.completo) { try { evento.waitUntil(garantirPacote()); } catch (_e) { /* evento encerrado */ } }
  if (copia) { registrarUso(evento, cache, plano.versao); return copia; }
  const fim = await buscarEGuardar(evento, null, null, plano, null);
  const destino = atual ? cache : null;   // pacote de OUTRA versão nunca recebe arquivo (nem é criado)
  if (fim.boa && destino) {
    // clone() ANTES de entregar; a gravação (com o hash) corre em paralelo e nunca segura a resposta.
    const gravacao = guardarNoPacote(destino, plano.rel, fim.resp.clone()).catch(() => {});
    try { evento.waitUntil(gravacao); } catch (_e) { /* evento encerrado: grava sem garantia */ }
  }
  return fim.boa ? fim.resp : semSaida(fim);
}

// ---------------------------------------------------------------------------------------------
// O pacote da versão: install, descida em segundo plano com retomada, marca de completo, faxina.
// ---------------------------------------------------------------------------------------------
const caminhosDe = (lista) => lista.map((item) => item[0]);
const listaDoPacote = () => [...new Set([...caminhosDe(PACOTE.abertura), ...caminhosDe(PACOTE.modulos)])];
const urlCarimbada = (rel) => new URL(rel, BASE).href + CARIMBO;
const chaveDe = (rel) => chaveDeCache(new URL(rel, BASE).href);

async function lerMarca(cache) {
  const r = await cache.match(MARCA_PACOTE);
  if (!r) return null;
  return {
    completo: r.headers.get("x-cb-pacote") === "completo",
    criado: Number(r.headers.get("x-cb-criado")) || 0,
    usado: Number(r.headers.get("x-cb-usado")) || 0,
    outra: Number(r.headers.get("x-cb-outra")) || 0,   // ms em que a descida recebeu arquivo de OUTRA publicação
  };
}
async function gravarMarca(cache, m) {
  const h = {
    "content-type": "text/plain",
    "x-cb-pacote": m.completo ? "completo" : "parcial",
    "x-cb-criado": String(m.criado || Date.now()),
    "x-cb-usado": String(m.usado || 0),
    "x-cb-outra": String(m.outra || 0),
  };
  await cache.put(MARCA_PACOTE, new Response("", { headers: h }));
}
// TODA escrita na marca passa por aqui, numa FILA por pacote (lê-modifica-grava, um de cada vez): o uso
// (registrarUso) e o fim da descida (baixarPacote) escrevem a MESMA marca, e um "lê parcial → [a descida
// grava completo] → grava parcial + usado" deixava a memória dizendo completo e o cache dizendo parcial
// (achado da revisão de 22/set/2026, A12). `muda(marca)` devolve a marca nova, ou null para não gravar.
const _filaMarca = new Map();   // nome do cache → a última escrita enfileirada
function atualizarMarca(cache, nome, muda) {
  const anterior = _filaMarca.get(nome) || Promise.resolve();
  const p = anterior.then(async () => {
    const nova = muda(await lerMarca(cache));
    if (nova) await gravarMarca(cache, nova);
  });
  _filaMarca.set(nome, p.catch(() => {}));
  return p;
}

// O hash que a lista carrega: SHA-256 dos bytes, os primeiros HASH_TAMANHO hexas.
async function hashDe(resp) {
  const bytes = await resp.arrayBuffer();
  const soma = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(soma), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, HASH_TAMANHO);
}

// A ÚNICA porta de escrita do pacote. Devolve "" quando guardou, ou o motivo de não ter guardado:
// "fora-da-lista" (a versão não conhece este caminho: não há como conferir), "outra-publicacao" (os
// bytes não são os que a publicação declarou — o servidor já serve outra versão, ou a resposta veio
// estragada), "ilegivel" (o corpo não pôde ser lido) e "cota" (cache.put recusou). `resp` é consumido.
async function guardarNoPacote(cache, rel, resp) {
  const esperado = HASH_DO.get(rel);
  if (!esperado) return "fora-da-lista";
  let visto;
  try { visto = await hashDe(resp.clone()); } catch (_e) { return "ilegivel"; }
  if (visto !== esperado) return "outra-publicacao";
  try { await cache.put(chaveDe(rel), resp); } catch (_e) { return "cota"; }
  return "";
}

// Baixa UM arquivo do pacote para o cache, com retentativa. Devolve "" quando ficou guardado, ou o
// MOTIVO de não ter ficado: "404", "outra-publicacao", "fora-da-lista" e "cota" são definitivos nesta
// rodada (nome errado na lista, o servidor já tem outra publicação, cota cheia — repetir em 1,5 s não
// muda nada); "rede" (caída, prazo estourado, 5xx, resposta imprópria como o portal cativo, corpo
// ilegível) repete com recuo que dobra, até `tentativas`.
async function baixarDoPacote(cache, rel, tentativas) {
  const url = urlCarimbada(rel), chave = chaveDe(rel);
  let motivo = "rede";
  for (let t = 0; t < tentativas; t++) {
    if (t > 0) await dormir(PACOTE_RECUO_MS * Math.pow(2, t - 1));
    // cache:"default": a URL carimbada não tem cópia errada possível no cache HTTP (e o hash confere), e a
    // própria página acabou de baixar a maior parte destes arquivos — o install os pega dali, sem rede.
    // UM prazo por tentativa, do pedido ao ÚLTIMO BYTE (achado da revisão de 22/set/2026, A7): o prazo só
    // nos cabeçalhos deixava um corpo que cala (portal que aceita a conexão, proxy, rede que cai no meio
    // da transferência) prender a descida pela vida inteira do SW — sem retentativa, sem carência, sem
    // rodada nova, e com todo pedido da página pendurado nela pelo waitUntil. Prazo vencido = abort do
    // pedido (a conexão não fica pendurada até o teto do navegador) e conta como rede caída.
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const abortar = () => { if (ctl) { try { ctl.abort(); } catch (_e) { /* já encerrado */ } } };
    const prazo = relogio(PACOTE_PRAZO_ARQUIVO_MS);
    try {
      let resp;
      try {
        const pedido = fetch(new Request(url, ctl ? { cache: "default", signal: ctl.signal } : { cache: "default" }));
        pedido.catch(() => {});   // se o prazo vencer primeiro, a rejeição do abort não pode ficar sem dono
        resp = await Promise.race([pedido, prazo.venceu]);
      } catch (_e) { continue; }
      if (resp === null) { abortar(); continue; }
      if (resp.status === 404) return "404";
      const propria = respostaPropria({
        navegacao: false, chave, status: resp.status, tipo: resp.type, contentType: resp.headers.get("content-type"),
      });
      if (!propria) { abortar(); continue; }
      // O corpo inteiro (hash + gravação) sob o MESMO prazo.
      motivo = await Promise.race([guardarNoPacote(cache, rel, resp), prazo.venceu]);
      if (motivo === null) { abortar(); motivo = "rede"; continue; }
      if (motivo !== "ilegivel") return motivo;   // "" = guardado; o resto é definitivo na rodada
      motivo = "rede";
    } finally { prazo.parar(); }
  }
  return motivo;
}

// Baixa o que FALTA de uma lista (o que já está no cache não é pedido de novo — é a retomada), em
// lotes de PACOTE_LOTE. Devolve { falhas, outra }: os caminhos que não ficaram guardados e se algum
// veio de OUTRA publicação — aí a descida PARA na hora (nenhum operário pega mais nada): o servidor já
// não tem esta versão, e o resto da lista viria igual, só para ser recusado (A2; em produção são 81
// itens, ~1,7 MB, por rodada).
async function baixarLista(cache, rels, tentativas) {
  const faltam = [];
  for (const rel of rels) if (!(await cache.match(chaveDe(rel)))) faltam.push(rel);
  const falhas = [];
  let i = 0, outra = false;
  const operario = async () => {
    for (;;) {
      if (outra) return;
      const rel = faltam[i++];
      if (rel === undefined) return;
      const motivo = await baixarDoPacote(cache, rel, tentativas);
      if (motivo) falhas.push(rel);
      if (motivo === "outra-publicacao") outra = true;
    }
  };
  await Promise.all(Array.from({ length: Math.min(PACOTE_LOTE, faltam.length) }, operario));
  if (outra) for (const rel of faltam.slice(i)) falhas.push(rel);   // o que ninguém chegou a pedir
  return { falhas, outra };
}

// O estado do pacote desta vida do SW (zera quando o navegador o encerra; a marca no cache é o que
// sobrevive). Exposto em self.CB_SW._pacote para o teste e o DevTools.
const _pacote = { completo: false, emCurso: null, proxima: 0, rodadas: 0 };
self.CB_SW._pacote = _pacote;
// O pacote DESTA versão sumiu do aparelho depois do install: quem o apagou foi a faxina de um SW MAIS
// NOVO, e esta geração já foi substituída sem ter como saber. Ver baixarPacote(). Latch de propósito:
// o caches.open de doPacote pode recriar o NOME, e aí a pergunta "existe?" voltaria a dizer que sim.
let _pacoteApagadoPorOutro = false;
const _usoGravado = Object.create(null);   // versão → ms da última marca de uso regravada nesta vida do SW

// Anota na marca do pacote que ele acabou de servir alguém (é o que a faxina lê), no máximo uma vez a
// cada PACOTE_USO_INTERVALO_MS por versão. Nunca segura a resposta; nunca falha para fora.
function registrarUso(evento, cache, versao) {
  const agora = Date.now();
  if (agora - (_usoGravado[versao] || 0) < PACOTE_USO_INTERVALO_MS) return;
  _usoGravado[versao] = agora;
  const p = atualizarMarca(cache, nomePacote(versao), (m) => (m ? { ...m, usado: agora } : null)).catch(() => {});
  try { evento.waitUntil(p); } catch (_e) { /* evento encerrado */ }
}

// Garante o pacote desta versão, em segundo plano: idempotente (uma descida por vez), com carência
// depois de rodada com falha e teto de rodadas por vida do SW. Devolve true quando o pacote está
// completo. NUNCA rejeita.
function garantirPacote() {
  if (!VERSAO_SW || _pacote.completo) return Promise.resolve(!!VERSAO_SW && _pacote.completo);
  if (_pacote.emCurso) return _pacote.emCurso;
  if (Date.now() < _pacote.proxima || _pacote.rodadas >= PACOTE_RODADAS_MAX) return Promise.resolve(false);
  const falhou = () => { _pacote.rodadas++; _pacote.proxima = Math.max(_pacote.proxima, Date.now() + PACOTE_CARENCIA_MS); return false; };
  _pacote.emCurso = baixarPacote()
    .then((ok) => { if (ok) { _pacote.completo = true; return true; } if (ok === null) return false; return falhou(); }, falhou)
    .finally(() => { _pacote.emCurso = null; });
  return _pacote.emCurso;
}
self.CB_SW.garantirPacote = garantirPacote;

// A descida: lê a marca (pacote já completo → nada a fazer; recebeu arquivo de OUTRA publicação há
// menos de PACOTE_CARENCIA_OUTRA_MS → nada a tentar), baixa o que falta da lista inteira e SÓ ENTÃO
// grava a marca de completo. A marca "parcial" nasce na primeira descida, com a data — é ela que diz à
// faxina qual pacote é o mais recente. Devolve true (completo), false (rodada com falha) ou null (nada
// foi tentado: não conta como rodada).
// OUTRA PUBLICAÇÃO É DEFINITIVA, E GRAVADA NA MARCA (achado da revisão de 22/set/2026, A2): "definitivo
// na rodada" com a memória zerando a cada vida do SW fazia cada vida refazer 3 rodadas baixando os
// arquivos INTEIROS só para recusá-los pelo hash — até ~5 MB por vida, enquanto a aba antiga vivesse.
// Agora a descida PARA no primeiro arquivo de outra publicação (baixarLista) e a marca guarda quando
// foi; a próxima tentativa só depois de PACOTE_CARENCIA_OUTRA_MS (o TTL da borda: é o único caso em que
// os bytes de `?v=<esta>` ainda podem voltar a ser os desta versão).
// PACOTE QUE SUMIU NÃO É RECRIADO (conserto de 22/set/2026, achado A1 da revisão): esta é a única porta
// que ENCHE o pacote desta versão e grava marca NOVA nele — o install (instalarAbertura) é quem o cria, e
// mais ninguém. Se ele sumiu, foi a faxina de um SW MAIS NOVO que o apagou; esta geração já foi
// substituída e não tem como saber (o _apagadosPelaFaxina é por vida de SW). Recriá-lo aqui era o pior
// dos zumbis: voltava COM arquivos e com `criado` de agora, e marca nova faz a faxina SEGUINTE mantê-lo
// como "o mais recente dos outros" — no lugar do pacote de uma aba VIVA. Desistir é definitivo nesta
// vida do SW (_pacoteApagadoPorOutro): sem o latch, o caches.open de doPacote recriaria o nome e a
// pergunta voltaria a responder "existe". Fica declarado o que isto NÃO fecha: (1) entre este
// `caches.has` e o `caches.open` da linha seguinte ainda cabe o delete de um SW mais novo — janela de
// duas mensagens, contra a vida inteira do SW antigo, que era a de antes; (2) se quem apagou o pacote
// foi o NAVEGADOR (cota), esta vida do SW passa a servir tudo da rede em vez de baixar o pacote de
// novo — é o comportamento de antes do passo 3, e a vida seguinte do SW (ou a publicação seguinte)
// recomeça; não há como distinguir os dois casos daqui.
async function baixarPacote() {
  const nome = nomePacote(VERSAO_SW);
  if (_pacoteApagadoPorOutro || !(await caches.has(nome))) { _pacoteApagadoPorOutro = true; return null; }
  const cache = await caches.open(nome);
  const marca = await lerMarca(cache);
  if (marca && marca.completo) return true;
  if (marca && marca.outra && Date.now() - marca.outra < PACOTE_CARENCIA_OUTRA_MS) {
    _pacote.proxima = Math.max(_pacote.proxima, marca.outra + PACOTE_CARENCIA_OUTRA_MS);
    return null;
  }
  const criado = marca ? marca.criado : Date.now();
  if (!marca) await atualizarMarca(cache, nome, (m) => m || { completo: false, criado });
  const { falhas, outra } = await baixarLista(cache, listaDoPacote(), PACOTE_TENTATIVAS);
  if (outra) {
    const agora = Date.now();
    _pacote.proxima = Math.max(_pacote.proxima, agora + PACOTE_CARENCIA_OUTRA_MS);
    await atualizarMarca(cache, nome, (m) => ({ ...(m || { completo: false, criado }), outra: agora }));
  }
  if (falhas.length) return false;
  await atualizarMarca(cache, nome, (m) => ({ ...(m || {}), completo: true, criado }));
  return true;
}

// A ABERTURA da versão no install: tudo-ou-nada, como o CORE. Rejeita com a lista do que não chegou.
async function instalarAbertura() {
  const nome = nomePacote(VERSAO_SW);
  const cache = await caches.open(nome);
  await atualizarMarca(cache, nome, (m) => m || { completo: false, criado: Date.now() });
  const { falhas, outra } = await baixarLista(cache, caminhosDe(PACOTE.abertura), PACOTE_TENTATIVAS);
  if (falhas.length) throw new TypeError("ABERTURA " + falhas.join(", ") + (outra ? ": o servidor já tem outra publicação" : ": não chegou"));
}

// Diagnóstico (DevTools: await self.CB_SW.estadoDoPacote()): versão, se está completo e o que falta.
self.CB_SW.estadoDoPacote = async () => {
  if (!VERSAO_SW) return { versao: "", completo: false, faltam: [] };
  const cache = await caches.open(nomePacote(VERSAO_SW));
  const marca = await lerMarca(cache);
  const faltam = [];
  for (const rel of listaDoPacote()) if (!(await cache.match(chaveDe(rel)))) faltam.push(rel);
  return {
    versao: VERSAO_SW, completo: !!(marca && marca.completo), criado: marca ? marca.criado : 0,
    usado: marca ? marca.usado : 0, outra: marca ? marca.outra : 0, faltam,
  };
};

// Quais pacotes ficam: o desta versão, o mais recente dos outros e os usados há pouco (ver escolherPacotes).
async function pacotesAManter(nomes) {
  const pacotes = [];
  for (const n of nomes) {
    if (!n.startsWith(PREFIXO_PACOTE)) continue;
    let criado = 0, usado = 0;
    try {
      const m = await lerMarca(await caches.open(n));
      if (m) { criado = m.criado; usado = m.usado; }
    } catch (_e) { /* pacote ilegível: não fica */ }
    pacotes.push({ nome: n, criado, usado });
  }
  return escolherPacotes(pacotes, VERSAO_SW ? nomePacote(VERSAO_SW) : "");
}

// Apaga o que VOLTOU depois da faxina, e só o que ESTA faxina apagou: um SW da geração anterior ainda
// pode ter um doPacote em voo (o `caches.has` dele respondeu "existe" antes do delete) e ele não conhece
// o _apagadosPelaFaxina DESTE SW — o cache volta VAZIO, sem marca, servindo nada. Esta varredura não
// decide política nenhuma (quem decide é escolherPacotes): ela só repete o delete dos mesmos nomes.
// NUNCA rejeita — faxina é higiene, não pode derrubar o activate.
// O QUE NÃO FECHA, declarado: o doPacote da geração anterior pode recriar o cache DEPOIS desta
// varredura (corrida em navegador não se fecha por completo). O zumbi que sobrar nasce SEM MARCA —
// doPacote e registrarUso nunca criam uma (registrarUso só regrava a que existe; guardarNoPacote só
// grava arquivo) —, então ele não vira "o mais recente dos outros" e a faxina seguinte o apaga, porque
// escolherPacotes descarta pacote com `criado` 0. Quem gravaria marca nova é a descida, e ela desistiu:
// ver baixarPacote (pacote que sumiu não é recriado). Até 22/set/2026 essa porta ficava aberta e o
// zumbi voltava COM arquivos e COM marca, sobrevivendo à faxina seguinte no lugar do pacote de uma aba
// viva (achado A1 da revisão). Sobra a janela de duas mensagens do has→open, e sobra a TRANSIÇÃO: um SW
// já instalado no aparelho HOJE não tem nada disto, então a primeira publicação depois deste conserto
// ainda pode ver o zumbi antigo; da seguinte em diante, não.
async function varrerZumbis() {
  if (!_apagadosPelaFaxina.size) return;
  try {
    const voltaram = (await caches.keys()).filter((n) => _apagadosPelaFaxina.has(n));
    await Promise.all(voltaram.map((n) => caches.delete(n)));
  } catch (_e) { /* a faxina da próxima publicação apaga */ }
}

// Antes de apagar os caches de outra versão, aproveita as cópias BOAS deles. Sem isto, a 1ª abertura
// depois de uma troca de versão não tinha cópia de nenhum JS: offline dava casca + "Tentar de novo", e
// com sinal ruim voltava a espera SEM prazo (só há prazo quando há cópia) — justo o relato de
// 17/set/2026, por mais uma abertura. A régua é a mesma da rede: só 200 do próprio site, nunca HTML no
// lugar de JS/CSS (o legado "civilbook-v2" guardava 404 e página de erro), chave sem query, e o que
// a versão nova já guardou (CORE do install) vale mais. Cópia migrada pode estar velha: é revalidada
// na 1ª abertura online, como qualquer cópia de deploy anterior. NUNCA rejeita: migração é bônus, a
// troca de versão acontece de qualquer jeito.
// PACOTE não migra, nem de nem para (a52 passo 3): cópia migrada seria arquivo de outra geração
// dentro de um pacote — e no sentido DE, o icon.svg de um pacote apagado entraria no cache de
// estáticos e viraria o ícone do PWA (o manifesto o pede sem carimbo) até a revalidação. E, havendo
// pacote (VERSAO_SW), código sem versão (js/css/data) também não migra para o cache do app: em
// produção ninguém o pede sem carimbo, e a cópia viraria órfã. PÁGINA, havendo pacote, também não:
// ela mora no pacote da versão (A1) e o install já a guardou lá, na versão certa — a do cache velho
// pode ser de outra.
async function migrarCopias(antigos) {
  if (!APROVEITAR_ANTIGO || !antigos.length) return;
  try {
    for (const nome of antigos) {
      if (nome.startsWith(PREFIXO_PACOTE)) continue;
      const velho = await caches.open(nome);
      for (const pedido of await velho.keys()) {
        try {
          const d = destinoDe(pedido.url);
          if (!d || !vaiMigrar(d)) continue;
          const destino = await caches.open(d.cache);
          if (await destino.match(d.chave)) continue;
          const resp = await velho.match(pedido);
          const serve = resp && respostaPropria({
            navegacao: false, chave: d.chave,
            status: resp.status, tipo: resp.type, contentType: resp.headers.get("content-type"),
          });
          if (serve) await destino.put(d.chave, resp);
        } catch (_e) { /* uma cópia que não migra (Vary: *, cota cheia) não impede as outras */ }
      }
    }
  } catch (_e) { /* sem migração: o cache enche de novo na próxima abertura online */ }
}
function vaiMigrar(d) {
  if (d.cache.startsWith(PREFIXO_PACOTE)) return false;    // pacote nunca recebe migração (e a página, com pacote, mora nele)
  if (!VERSAO_SW || d.cache !== CACHE_APP) return true;
  return /\.(json|webmanifest)$/i.test(d.chave);   // manifesto sim; código sem versão não
}

// Em QUAL cache (e com que chave) o fetch vai procurar esta URL. Install e migração gravam por aqui,
// para nunca guardar num cache o que é lido no outro: o icon.svg do CORE ia para o cache do app e o
// fetch o procurava no de estáticos — offline logo após instalar, o ícone não existia. Só a URL decide
// (o modo de um pedido guardado não é confiável): app.html cai em ".html". null = o SW não guarda.
// URL carimbada cai no PACOTE da versão dela; PÁGINA, havendo pacote, no pacote da versão deste SW
// (o mesmo lugar em que redeComPrazo a lê e grava: cacheDaCopia), e `pagina: true` diz ao install que a
// versão dela tem de ser conferida.
function destinoDe(url) {
  const plano = estrategiaPara({ url, method: "GET", mode: "same-origin", destination: "", cache: "default", temRange: false }, ESCOPO);
  if (plano.estrategia === ESTRATEGIA.IGNORAR) return null;
  if (plano.estrategia === ESTRATEGIA.PACOTE) return { cache: nomePacote(plano.versao), chave: plano.chave };
  if (plano.estrategia === ESTRATEGIA.CACHE_REVALIDA) return { cache: CACHE_ESTATICO, chave: plano.chave };
  const pagina = !!VERSAO_SW && ehPagina(plano);
  return { cache: pagina ? nomePacote(VERSAO_SW) : CACHE_APP, chave: plano.chave, pagina };
}

// Guarda um item do CORE na CHAVE em que o fetch vai procurá-lo (destinoDe → chaveDeCache, SEM query).
// Era cache.add(), que grava na URL PEDIDA: com o carimbo, gravaria "css/style.css?v=abc" e o fetch,
// que procura "css/style.css", nunca acharia — offline logo após instalar, o app ficava sem CSS.
// Havendo pacote, os itens de CARIMBAVEL NÃO passam por aqui: vêm pela abertura do pacote, carimbados e
// com o hash conferido (instalarAbertura) — é a publicação que garante que estão na lista.
// O MODO DE BUSCA depende da URL: o PONTEIRO (página, manifesto) vai com cache:"reload", que fura o
// cache HTTP (a casca guardada de um deploy anterior registra o carimbo velho, e o ponteiro tem de ser
// o de agora); a FONTE dos ícones vai com cache:"default" — o nome dela é o conteúdo (soma dos
// codepoints), então a cópia do cache HTTP para esse nome é a certa por construção, e o reload fazia a
// fonte descer duas vezes na mesma visita (achado da revisão de 22/set/2026); sem pacote, os itens de
// CARIMBAVEL vão crus, com reload, para o cache do app, como antes do passo 3.
// Rejeita como o add(): 404, 5xx ou rede caída derrubam quem não tolera falha.
// E rejeita o que o fetch já rejeitava (correção de 21/set/2026, revisão do passo 1b): 200 NÃO BASTA.
// O install passava qualquer 200 direto para o cache, sem a régua respostaPropria que o resto deste
// arquivo aplica — "nunca HTML no lugar de JS/CSS". Portal cativo de Wi-Fi, proxy corporativo e página
// de erro do host respondem 200 com text/html para QUALQUER URL: o HTML era gravado na chave do
// arquivo, o install SUCEDIA (nada acusava) e a cópia envenenada ficava. Para a fonte dos ícones e o
// icon.svg, que saem de cache-e-revalida (a cópia responde ANTES de olhar a rede), a abertura seguinte
// já com rede boa desenhava a caixa de glifo ausente em todas as telas; e para quem ficasse offline
// depois disso — justo o caso que o passo 1b diz ter fechado — ela ficava. A migração de caches velhos
// (migrarCopias) já usava esta régua; o install era o único caminho de escrita sem ela.
const ehFonte = (u) => /\.(woff2?|ttf|otf)$/i.test(u);
async function guardarNoInstall(u) {
  if (VERSAO_SW && CARIMBAVEL.includes(u)) return;   // vem pela abertura do pacote, com o hash conferido
  const alvo = new URL(u, BASE).href;
  const d = destinoDe(alvo);                 // CORE que o SW ignora = TypeError aqui = não instala
  const cache = await caches.open(d.cache);
  const resp = await fetch(new Request(alvo, { cache: ehFonte(u) ? "default" : "reload" }));
  if (!resp || resp.status !== 200) throw new TypeError("CORE " + u + ": " + (resp ? resp.status : "sem resposta"));
  const propria = respostaPropria({
    navegacao: false, chave: d.chave,
    status: resp.status, tipo: resp.type, contentType: resp.headers.get("content-type"),
  });
  // Página do CORE continua passando: respostaPropria aceita text/html quando a CHAVE é .html.
  if (!propria) throw new TypeError("CORE " + u + ": resposta imprópria (" + resp.type + ", " + resp.headers.get("content-type") + ")");
  // Página, havendo pacote, só entra no pacote se for DESTA versão (A1): o servidor pode já estar em outra
  // publicação quando este install roda (a borda serviu a página que registrou este SW; o `reload` de agora
  // traz a de hoje). Página de outra versão = este SW já nasceu velho: não instala, e o da versão nova vem
  // pela página nova.
  if (d.pagina) {
    const v = versaoDaPagina(await resp.clone().text());
    if (v !== VERSAO_SW) throw new TypeError("CORE " + u + ": página da versão " + v + ", este SW é " + VERSAO_SW);
  }
  await cache.put(d.chave, resp);
}

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    // Tudo-ou-nada: um só que rejeite derruba o install.
    await Promise.all(CORE.map(guardarNoInstall));
    await Promise.all(CORE_EXTRA.map(async (u) => { try { await guardarNoInstall(u); } catch (_e) { /* instala igual */ } }));
    if (VERSAO_SW) {
      await instalarAbertura();                                      // tudo-ou-nada, como o CORE
      await comPrazo(garantirPacote(), PRAZO_INSTALL_MODULOS_MS);    // módulos: melhor esforço, com teto
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const nomes = await caches.keys();
    const ficam = [CACHE_APP, CACHE_ESTATICO, ...(await pacotesAManter(nomes))];
    const antigos = cachesParaApagar(nomes, ficam);
    await migrarCopias(antigos);
    // ANTES do delete: a partir daqui nenhum doPacote deste SW abre (= cria) um pacote condenado.
    for (const n of antigos) if (n.startsWith(PREFIXO_PACOTE)) _apagadosPelaFaxina.add(n);
    // allSettled, e o que REJEITOU sai da lista (achado A2 da revisão de 22/set/2026): delete que falha
    // deixa o cache ÍNTEGRO no aparelho, e mantê-lo na lista fazia o SW recusar ler um pacote inteiro —
    // a aba velha, offline, recebia erro onde antes recebia a cópia. Delete que RESOLVE `false` (o cache
    // não estava lá) fica na lista: não há nada para ler. E uma rejeição não pode mais derrubar o
    // clients.claim() nem a varredura, que vêm depois: faxina é higiene, não é o activate.
    const fim = await Promise.allSettled(antigos.map((n) => caches.delete(n)));
    fim.forEach((r, i) => { if (r.status === "rejected") _apagadosPelaFaxina.delete(antigos[i]); });
    await self.clients.claim();
    await varrerZumbis();   // o que a geração anterior recriou entre o delete e agora
  })());
});

self.addEventListener("fetch", (e) => {
  const r = e.request;
  const plano = estrategiaPara({
    url: r.url, method: r.method, mode: r.mode, destination: r.destination, cache: r.cache,
    temRange: r.headers.has("range"),
  }, ESCOPO);
  if (plano.estrategia === ESTRATEGIA.IGNORAR) return; // o navegador segue direto para a rede
  if (plano.estrategia === ESTRATEGIA.PACOTE) { e.respondWith(doPacote(e, plano)); return; }
  e.respondWith(plano.estrategia === ESTRATEGIA.CACHE_REVALIDA ? cacheERevalida(e, plano) : redeComPrazo(e, plano));
});
