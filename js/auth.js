// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Autenticação do Civilbook.
// Backend real: Supabase Auth (quando CB_CONFIG.SUPA_READY). Caso contrário,
// fallback em localStorage (modo local, para desenvolvimento/preview e os E2E do ?e2e=1).
// SUPA_READY com o SDK fora, ou o js/config.js fora, NÃO é o modo local: sem sessão (a50, ver boot()).
// Mantém a mesma API pública usada pelo app — porém os métodos são async.
// Após AUTH.boot(), AUTH.session() devolve a sessão em cache de forma síncrona.
//
// a41 (17/set/2026) — PERFIL QUE NÃO REBAIXA + BOOT OTIMISTA. O relato: no PWA do Android o admin
// PRO "virava" gratuito/user e a Início demorava. As causas estavam todas aqui:
//   (1) a consulta a profiles ignorava o `error` do supabase-js (que NÃO lança: devolve
//       { data: null, error }) — qualquer falha virava prof = {} → plano "gratuito", role "user";
//   (2) o onAuthStateChange recarregava o perfil sem await a cada SIGNED_IN, e o SDK emite SIGNED_IN
//       a cada volta do PWA ao primeiro plano — justamente quando a 1ª requisição costuma falhar;
//   (3) SIGNED_OUT no meio da sessão deixava a tela montada com sessão null (paywall em tudo);
//   (4) o boot esperava getUser() (rede; com token vencido, até ~30 s de re-tentativa) + 2 consultas
//       em série antes do 1º desenho.
// Regras de agora:
//   - só um perfil LIDO COM SUCESSO sobrescreve plano/role/nome. Falha (erro, exceção, prazo ou
//     0 linha — que é o que o RLS devolve quando o pedido sai sem token) mantém o que havia (sessão
//     em memória ou cache) e o perfil fica "não confirmado" (perfilConfirmadoEm como estava);
//   - cache "cb-perfil" = { uid, nome, plano (BRUTO), planoAte, testeUsadoEm, role, preferencias, em }: só
//     valores que o servidor já devolveu, só do usuário atual, apagado no logout e no SIGNED_OUT, sem token e sem e-mail. É
//     dado de FORA (localStorage é editável): ou tem o formato que _cacheGravar escreve, ou é
//     descartado inteiro (_cacheBruto);
//   - o boot monta a sessão com getSession() (leitura local enquanto o token vale) + o cache, libera
//     o cbInit e revalida em 2º plano; mudou plano/role/nome → menu + window.cbPerfilMudou (app.html
//     redesenha o módulo atual, para o paywall sumir/aparecer sem reload);
//   - tela ANTES de o SDK responder só com o cache de quem o SDK tem guardado (_cacheOtimista) e nunca
//     depois de um SIGNED_OUT: o que chega DURANTE o getSession do boot conta (_saidas) — refresh token
//     recusado ali dentro era o app zumbi voltando por outra porta.
// SEGURANÇA: gate de plano/role no cliente é só UX — quem manda é o servidor (RLS e Edge Functions).
// O cache não é autoridade: adulterá-lo equivale a escrever AUTH._session.plano no console (sempre
// foi possível), não entrega dado nenhum e é corrigido na revalidação.
//
// PLANO PROTEGIDO (17/set/2026, migration 0098). Até aqui o navegador GRAVAVA profiles.plano (AUTH.upgrade
// fazia update direto) e o "Testar grátis por 7 dias" nunca vencia — e o plano define a cota de IA.
// Regras de agora:
//   - o front NUNCA grava plano. "pro-teste" nasce da RPC iniciar_teste_pro (7 dias, uma vez por conta);
//     plano pago, só do checkout (o webhook do PSP grava com service_role); cortesia, só do Admin
//     (RPC conceder_plano). tests/plano-protegido.check.mjs varre js/ e os .html atrás de update de plano;
//   - PLANO EFETIVO: pro-teste e pro-cortesia valem até plano_ate; vencido → "gratuito". A MESMA regra,
//     com o mesmo nome e os mesmos casos de teste, mora em três lugares: SQL public.plano_efetivo,
//     supabase/functions/_shared/cota.ts planoEfetivo e AUTH._planoEfetivo;
//   - a sessão expõe plano (o EFETIVO — é o que todo gate do app lê), planoBruto e planoAte. O cache
//     guarda o BRUTO + planoAte e o efetivo é recalculado A CADA LEITURA (session()): teste que vence com
//     o app aberto vira gratuito sem rede e sem reload;
//   - banco ainda SEM a 0098 (a ordem de entrada não é atômica: migration → funções → site): a coluna
//     plano_ate não existe (42703) → o perfil é relido sem ela e NINGUÉM é rebaixado por isso; a RPC não
//     existe (PGRST202/404) → "indisponivel", e ninguém é promovido.
//
// BOOT RÁPIDO (19/set/2026, a47). O relato: no app.html o splash dizia SEMPRE "Está demorando mais que o normal", e o
// login pelo Google voltava à landing com "Entrar" (o "Abrir o app" só depois do F5). As causas estavam aqui e no cbInit:
//   (1) boot sem cache de perfil esperava getSession até 3 s + perfil até 4 s = 7 s contra o vigia de 8 s — e o cache
//       some no logout, então TODO login pelo Google era o caminho lento;
//   (2) o teto de 30 s da espera pelo SDK partia de uma premissa falsa ("o orçamento de re-tentativa dele"): no SDK
//       vendorizado (supabase-js 2.45.0 / auth-js 2.64.4) o getSession pede a trava com _acquireLock(-1, …) — sem prazo
//       (está no js/vendor/supabase.js) — e o refresh re-tenta com a trava na mão; num harness local de 19/set/2026
//       (não versionado), com 503 contínuo, ele ficou preso mais de 150 s. O SDK NÃO tem teto;
//   (3) o app.html mandava ao login quem tinha a sessão GUARDADA no SDK, só porque ela não chegou a tempo;
//   (4) na volta do Google o SDK apaga o hash (window.location.hash = "") ANTES de gravar a sessão; o navegador dispara
//       popstate nessa troca de fragmento, e o popstate do js/app.js chamava navigate("home") sem sessão → login. Era o
//       "Session History Item Has Been Marked Skippable" em app.html# do navegador do fundador. Agora o navigate() também
//       só manda ao login com podeIrAoLogin().
// Regras de agora:
//   - o boot lê, SEM rede e sem a trava, o que o SDK guarda no storage que ele USA (_sessaoGuardada: o localStorage ou
//     a memória da página; só id, e-mail e validade; nunca o token). Havendo sessão guardada OU cache de perfil, o prazo do getSession é curto (_PRAZO_SESSAO_CURTO_MS):
//     com token válido ele responde em milissegundos; estourou → abre com a sessão guardada, marcada naoConfirmada (com
//     o cache, se houver; sem cache, com o perfil PROVISÓRIO — o padrão gratuito/user, que nunca vai para o cache) e o
//     SDK confirma ou encerra depois, pelos caminhos de sempre (_sessaoTardia, _reconferirSessao, SIGNED_OUT → login);
//   - na VOLTA DO GOOGLE (window._cbRetornoOAuth, gravado pelo <head> do app.html antes de o SDK apagar o hash) o que
//     está guardado é de ANTES e pode ser de outra conta: não abre otimista, espera o SDK processar a URL. A volta com
//     ERRO (window._cbRetornoOAuthErro) também: nela o SDK APAGA a sessão guardada, e o app.html precisa cair no ramo
//     do erro (login com o motivo), não montar por um instante a conta que está saindo. Sem as flags (app.html velho do
//     service worker), vale a URL lida no início do boot;
//   - sem cache, o perfil tem prazo curto no boot (_PRAZO_PERFIL_MS, 1,5 s): estourou → entra com o provisório e troca
//     quando chegar. Quem DECIDE por perfil ("não é admin", "não é PRO") espera o perfil lido: perfilPendente() e
//     depoisDoPerfil();
//   - página que exige sessão só manda ao login com podeIrAoLogin(): o SDK já disse que não há sessão E o storage
//     está vazio (o cbInit do app.html e do admin.html, o navigate() do js/app.js e o exigirLogin()). aoMudarSessao() avisa quem
//     desenhou antes de a sessão chegar ou de o SDK confirmar a otimista (a landing troca "Entrar" por "Abrir o app");
//   - o boot deixa um diário sem dado pessoal (cb-boot-log, os últimos 5; window.cbBootLog()), porque a causa exata
//     da lentidão no navegador do fundador NÃO está provada. Só quando há sessão em jogo: o visitante sem nada
//     guardado (a landing anônima) não ganha registro.
// RECUSA DEFINITIVA DO TOKEN (19-20/set/2026, a61). O relato (medido no preview em 19/set/2026): com uma sessão
// escrita à mão no storage do SDK o app ABRIA e FICAVA aberto — toda leitura voltava 401/403 e este arquivo as
// tratava como FALHA, pela regra de cima ("o perfil nunca rebaixa por falha de rede"). Falha e recusa não são a
// mesma coisa, e a diferença é a única que importa aqui:
//   - FALHA = o servidor não respondeu, ou respondeu que ELE está mal (rede, prazo, 5xx, PostgREST fora do ar). Não
//     derruba ninguém: é exatamente o caso que a a41/a47 protegem (PWA voltando ao primeiro plano, metrô, 3G).
//   - RECUSA = o servidor entendeu o pedido e disse que ESTE TOKEN não serve. Aí vem a pergunta seguinte, que é a
//     que decide tudo (leia o parágrafo abaixo): dá para trocar o token?
// TOKEN NÃO É SESSÃO, e confundir os dois é o erro que mais caro custaria aqui. O access_token dura ~1 h, o SDK o
// renova sozinho e a sessão sobrevive a ele: uma leitura que sai na corrida com a renovação volta "JWT expired" em
// dia absolutamente normal, e a chave de assinatura do projeto pode ser rotacionada a qualquer momento (o
// docs/ROTACAO-SEGREDOS.md §3 descreve o procedimento, e diz que quem não espera a janela derruba os logados) —
// nos dois casos o token de agora é recusado e a SESSÃO está viva. Por isso a régua tem DOIS passos e o segundo é
// o que condena:
//   1) o servidor recusou este token (_vereditoDoToken: "recusa" pelo código, "renovar" quando a frase é de prazo
//      ou de relógio). Sozinho, isso não derruba ninguém;
//   2) PEDE UM TOKEN NOVO ao SDK (_sessaoInsalvavel → refreshSession). Veio token novo = a sessão vive, e ninguém
//      sai: a chave trocou, o token tinha vencido, um intermediário comeu o cabeçalho — todos curados de graça, em
//      vez de apenas tolerados. O /token recusou em definitivo (4xx que não é de rede) = morreu a SESSÃO, não só o
//      token, e aí sim a saída (_derrubarSessaoForjada → signOut local com PRAZO + apaga o guardado do SDK +
//      _encerrar → limpa cache e leva ao login). Rede, prazo, exceção ou carência = "não sei", e "não sei" NUNCA
//      derruba ninguém.
// O passo 2 é também o que separa forja de azar: quem escreve uma sessão à mão não tem refresh_token que o servidor
// aceite. Custa UMA requisição no caminho suspeito (e nenhuma no caminho feliz), com carência (_CARENCIA_RENOVACAO_MS)
// para que um servidor que recusa tudo não vire um laço de renovação.
// A LISTA DE CÓDIGOS VIVE AQUI (_CODIGOS_TOKEN_MAU / _CODIGOS_CONTA_MORTA / _MSG_NAO_DEFINITIVA) e é a fonte de
// verdade: o CLAUDE.md e o docs/SECURITY.md §13.1 APONTAM para cá em vez de repetir a lista — lição da lista
// --no-verify-jwt, que envelheceu em prosa sem nada reprovar. De onde veio cada código:
//   - PGRST301 — PostgREST, `src/library/PostgREST/Error.hs`: é o JwtDecodeErr, o token que não se consegue sequer
//     decodificar/verificar (Bearer vazio, número de partes errado, nenhuma chave serve = assinatura inválida,
//     algoritmo errado, falha de cripto, tipo de token não suportado). 401. Conferido contra o servidor DESTE projeto
//     (curl anônimo, só leitura, 19-20/set/2026): token "lixo" → 401 PGRST301 "Expected 3 parts in JWT; got 1"; JWT bem
//     formado com assinatura falsa → 401 PGRST301 "No suitable key or wrong key type".
//   - bad_jwt — GoTrue (supabase/auth, `internal/api/auth.go`, parseJWTClaims): 403 no /auth/v1/user. Conferido no
//     mesmo curl: assinatura falsa → 403 bad_jwt "…token signature is invalid".
//   - no_authorization — GoTrue, 401 no /auth/v1/user ("This endpoint requires a valid Bearer token"): é o que o
//     servidor responde quando o Bearer não é token de usuário nenhum. Medido em 20/set/2026. ELE É AMBÍGUO, e por
//     isso é o melhor argumento a favor do passo 2: o servidor responde a MESMA coisa quando o cabeçalho
//     Authorization simplesmente não chegou (proxy da empresa, extensão que reescreve cabeçalhos) — caso em que a
//     sessão é legítima. Quem separa os dois não é o código: é a renovação. O /token não usa Authorization (apikey
//     + corpo), então o legítimo renova e fica; quem não tem refresh_token bom, sai.
//   - session_not_found / user_not_found / user_banned — já estavam aqui (a41), pelo getUser().
// O QUE FICOU DE FORA, de propósito, e por quê:
//   - RELÓGIO, em todas as frases que os DOIS servidores usam, porque as frases são diferentes e a ordem das
//     palavras engana. PostgREST (PGRST303, e PGRST301 nas versões anteriores à 13): "JWT expired", "JWT not yet
//     valid", "JWT issued at future" (esta chegou a ser BUG do próprio PostgREST, corrigido no #5196). GoTrue:
//     embrulha o golang-jwt, então as frases são as DELE — "token is expired", "token is not valid yet", "token used
//     before issued" (lidas em golang-jwt/jwt, errors.go, 20/set/2026). Repare: o PostgREST diz "not yet valid" e o
//     golang-jwt diz "not valid yet". A régua conhece as duas — as alternativas que parecem repetidas não são.
//   - PGRST303 (JwtClaimsErr) inteira, mesmo nas frases que não falam de prazo: "JWT not in audience" muda quando o
//     servidor muda de configuração e derrubaria todo mundo de uma vez, sem forja nenhuma.
//   - PGRST300 ("Server lacks JWT secret", 500) e PGRST302 ("Anonymous access is disabled"): problema do servidor, ou
//     pedido que saiu SEM token (corrida com a trava de auth do SDK) — nunca do token de alguém.
//   - PGRST116 (0 linha) e 42501: é o RLS falando de LINHA, não de token. Continua sendo falha de perfil, como sempre.
//   - status 0 (rede), 5xx, 408, 429, e qualquer 401/403 cujo corpo não traga um código que conhecemos (uma página de
//     erro de proxy, por exemplo): não derrubam. Nega por padrão ao contrário do usual — na dúvida, ninguém sai.
// A CONFERÊNCIA NÃO É DE UMA VEZ SÓ (_verificarRevogada + _reconferirRevogada): getUser que não trouxe resposta é
// re-tentado pela escada de sempre (_RETENTATIVAS_MS), porque há forja que NENHUMA consulta de perfil enxerga e só
// este caminho pega. Uma conferência de tiro único que falhasse deixaria a tela aberta até a próxima abertura.
// LIMITE, e ele é o principal: isto fecha o CAMINHO FÁCIL, não o problema. Quem edita o código servido roda o que
// quiser no próprio navegador, e num site estático não há como impedir — o portão de verdade é hospedagem com
// portão (tarefa d27). O detalhe (o que ainda escapa, o como e o que foi medido) fica em docs/SECURITY.md §13, não
// aqui: js/ vai ao site publicado e docs/ não (mesma disciplina da a58).
// Travado em tests/auth-perfil.check.mjs (seção o, com mutantes embutidos) e tests/boot-sessao.check.mjs (o cbInit real
// do app.html, do index.html e do admin.html rodando sobre este arquivo).
const AUTH = {
  // { id, email, nome, plano (EFETIVO), planoBruto, planoAte, testeUsadoEm, role, preferencias?,
  //   perfilConfirmadoEm, naoConfirmada? } | null — no modo local: { id, email, nome, plano, role }
  _session: null,
  _ready: false,

  _PERFIL_KEY: "cb-perfil",
  _PERFIL_TTL_MS: 10 * 60 * 1000,        // evento de auth só vai à rede se o perfil confirmado passou disto
  _PRAZO_SESSAO_MS: 3000,                // getSession() no boot SEM nada guardado: depois disto o boot segue sem esperar o SDK
  _PRAZO_SESSAO_CURTO_MS: 500,           // …e COM sessão guardada ou cache: o token válido responde em ms (medido: 4 ms)
  // Teto NOSSO da espera pelo SDK (sessaoPendente, e o splash do app.html, contado do início da página). O SDK não tem
  // teto nenhum: o getSession pede a trava com _acquireLock(-1) (sem prazo; js/vendor/supabase.js) e, num harness local
  // de 19/set/2026 (não versionado) com 503 contínuo, ficou preso mais de 150 s. Passado isto a página para de esperar
  // calada: o app.html diz "Não consegui confirmar sua sessão" e oferece Tentar de novo e Entrar de novo. Travado entre
  // 15 s e 60 s em tests/auth-perfil.check.mjs (o1): acima do vigia de 8 s e da volta do Google lenta, abaixo da paciência.
  _PRAZO_SESSAO_MAX_MS: 30000,
  _PRAZO_PERFIL_MS: 1500,                // 1º acesso no aparelho (sem cache): espera do perfil no boot (depois: provisório)
  _PRAZO_RELEITURA_MS: 4000,             // releitura do perfil depois da RPC do teste grátis (upgrade)
  _PRAZO_CONSULTA_MS: 15000,             // cada consulta a profiles: depois disto conta como falha (mantém)
  _RETENTATIVAS_MS: [3000, 10000, 30000],
  _ESPERA_REVOGADA_MS: 6000,             // getUser() (sessão revogada) só depois de o app carregar — ver _verificarRevogadaDepois
  _PRAZO_SAIDA_MS: 3000,                 // a61: teto do signOut da derrubada — o SDK pede a trava de auth SEM prazo
  _CARENCIA_RENOVACAO_MS: 60000,         // a61: uma tentativa de renovar por minuto (senão vira laço com servidor teimoso)
  // Senha: SENHA_MIN = Supabase → Authentication → Sign In / Providers → Email → Minimum password length (8, visto
  // em 18/set/2026); SENHA_MAX_BYTES = o teto do servidor (bcrypt: "Password cannot be longer than 72 characters",
  // contado em bytes). O cadastro (js/auth-modal.js) e Minha conta (js/conta.js) conferem por validarSenhaNova; a
  // acesso.html/js/acesso.js repete os números. tests/acesso.check.mjs trava as 3 telas rodando (e o index.html
  // pela forma), com mutantes embutidos.
  SENHA_MIN: 8,
  SENHA_MAX_BYTES: 72,
  // SENHA_TIPOS = o mesmo painel → Password requirements = "Lowercase, uppercase letters, digits and symbols" (visto em
  // 18/set/2026): um caractere de CADA conjunto. MUDOU NO PAINEL, MUDA AQUI — e no var SENHA_TIPOS de js/acesso.js,
  // no texto das 3 telas (cadastro, acesso.html, Minha conta) e, em tests/acesso.check.mjs, no PAINEL_REQUIRED_CHARACTERS
  // e nas expectativas do bloco dos tipos (que supõem esta opção, de 4 tipos com símbolos; o check diz onde).
  // Os conjuntos são os do servidor, caractere por caractere (código-fonte do supabase/auth, lido em 19/set/2026):
  // internal/api/password.go confere com strings.ContainsAny(senha, conjunto), e internal/conf/configuration.go
  // (PasswordRequiredCharacters.Decode) separa o valor da opção em ":" — "\:" vale como dois-pontos dentro do
  // conjunto. O valor que essa opção grava é o do enum password_required_characters do Management API (o mesmo que o
  // supabase/cli usa): abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789:!@#$%^&*()_+-=[]{};'\\:"|<>?,./`~
  // Só ASCII: espaço, ç, letra com acento, emoji e sinais como º, °, § e € entram na senha, mas não contam como tipo
  // nenhum — e o erro e as 3 telas dizem isso com a MESMA frase (tests/acesso.check.mjs, FORA_TEXTO).
  // LIMITE: o que o painel hospedado repassa ao servidor não é código aberto; a frase de recusa do servidor lista os
  // conjuntos que ele usa, e a tela da recusa continua lendo os tipos DELA (_tiposExigidos), nunca desta lista.
  SENHA_TIPOS: [
    { falta: "uma letra minúscula", conjunto: "abcdefghijklmnopqrstuvwxyz" },
    { falta: "uma letra maiúscula", conjunto: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" },
    { falta: "um número", conjunto: "0123456789" },
    { falta: "um símbolo", conjunto: "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~", listar: true }
  ],
  _tRevogada: null,
  _perfilGen: 0,      // geração de cada carga de perfil…
  _genBase: 0,        // …e a geração da última LEITURA BOA aplicada (perfil base / preferências):
  _genPref: 0,        //    carga mais velha não sobrescreve leitura mais nova; falha não sobrescreve nada
  _uidAtual: null,    // de quem é a carga mais recente (null = saiu): resposta de outro usuário é descartada
  _emVoo: null,       // { uid, p } — revalidação em curso, dividida por quem pedir o mesmo usuário
  _pendente: null,    // promessa viva enquanto o SDK não disse se há sessão (boot sem cache que estourou o prazo)
  _saindo: false,     // logout() em curso: o SIGNED_OUT que ele provoca não redireciona de novo
  _derrubando: false, // a61: derrubada por token recusado em curso (as duas consultas recusam juntas: uma só derruba)
  _renovadoEm: 0,     // a61: quando a última tentativa de renovar o token saiu (carência: ver _sessaoInsalvavel)
  _tentativaRevogada: 0,   // a61: quantas vezes a conferência de sessão foi re-agendada por não ter tido resposta
  _uidEncerrado: null,     // a61: de quem foi a última sessão encerrada — carga de perfil atrasada não a ressuscita
  _saidas: 0,         // quantas vezes _encerrar() rodou: o boot compara antes/depois do await (SIGNED_OUT no meio)
  _ouvindo: false,
  _tentativa: 0,
  _tRetry: null,
  _tSessao: null,     // nova pergunta ao SDK enquanto a sessão está aberta só com o cache (_reconferirSessao)
  _testeUsadoUid: null,   // a RPC respondeu "ja_usado" para este uid (memória da página; ver testeGratis)
  _respostaSdk: null,     // a última resposta FIRME do SDK nesta página: null (ainda não) | "user" | "nenhuma" | "indefinida"
  _ouvintesSessao: [],    // aoMudarSessao(): quem desenhou antes de a sessão chegar (ou sair)
  _avisada: undefined,    // a sessão que os ouvintes já conhecem: _chaveAviso (undefined = boot ainda não terminou)
  _esperaPerfil: [],      // depoisDoPerfil(): decisões que esperam o perfil LIDO (não o provisório)

  _PLANOS_COM_PRAZO: ["pro-teste", "pro-cortesia"],
  _TESTE_DIAS: 7,         // duração do teste grátis — a RPC é quem manda; aqui só para dizer quando terminou
  _COLS_PERFIL: "nome,plano,role,empresa",
  _COLS_PLANO_0098: "plano_ate,teste_usado_em",   // colunas da 0098: pedidas junto; se o banco ainda não as tem, o perfil é relido sem elas

  isSupa() { return !!(window.CB_CONFIG && window.CB_CONFIG.SUPA_READY && window.supa); },
  // a50: o modo local (desenvolvimento e os E2E do ?e2e=1) exige o sinal POSITIVO do js/config.js: carregado E dizendo
  // SUPA_READY falso. Sem o config.js (arquivo bloqueado no DevTools, falha de rede) não há como saber se é produção:
  // vale como produção (céticos da a50: bloquear o config.js em vez do SDK reabria o modo local).
  _modoLocal() { return !!(window.CB_CONFIG && !window.CB_CONFIG.SUPA_READY); },
  // Supabase INUTILIZÁVEL e fora do modo local (o SDK não carregou; ou o config.js não carregou, com ou sem SDK): NÃO
  // cair em modo local — senão um usuário com conta real receberia "senha incorreta" enganosamente, e (a50) o boot
  // aceitaria a sessão escrita à mão no cb-session. Vale no boot, no login (e-mail e Google), no cadastro, no plano etc.
  // É o NEGATIVO do par isSupa()/_modoLocal(), e não "sem window.supa": com o config.js fora e um SDK que apareceu por
  // outra via (extensão, Overrides), `!window.supa` era falso e o boot voltava a ler o cb-session (céticos, 19/set/2026).
  _supaIndisponivel() { return !this.isSupa() && !this._modoLocal(); },

  // ---------- Boot: resolve a sessão atual ----------
  // Modo local: igual a sempre. Supabase: NADA de rede no caminho do 1º desenho quando há sessão guardada ou cache.
  // a50 (19/set/2026): Supabase CONFIGURADO e o SDK fora (bloqueado no DevTools ou por extensão, falha de rede) NÃO é o
  // modo local — nem o js/config.js fora (sem ele não há SUPA_READY nenhum). Antes o boot decidia só por !isSupa() e
  // aceitava a sessão escrita à mão em localStorage "cb-session", com o plano e o papel que a pessoa quisesse: as telas
  // do app (e o painel admin) abriam sem convite — sem dado do servidor, que exige token, mas abriam. Agora não há
  // sessão: a página que exige sessão vai ao login (podeIrAoLogin: não há SDK a esperar), onde entrar (e-mail ou Google)
  // e criar conta dizem que o serviço está indisponível, e os Detalhes do boot dizem o que não carregou. O modo local
  // continua só com o config.js carregado e SUPA_READY falso: o ?e2e=1 dos specs, que o js/config.js só aceita em
  // localhost/127.0.0.1. LIMITES (declarados em docs/MODO-PILOTO.md, limite 8): isto fecha só o BLOQUEIO de arquivo.
  // Segue aberto, e NÃO é fechado aqui: quem EDITA o código servido (Overrides do DevTools: o config.js com
  // SUPA_READY falso, um SDK de mentira). Quem forja a sessão pelo caminho do próprio SDK era o outro caminho
  // aberto e foi ENDURECIDO pela a61 — a régua está no cabeçalho deste arquivo (RECUSA DEFINITIVA DO TOKEN), não
  // aqui. O COMO e o que segue aberto moram no docs/SECURITY.md, seção 13, DE PROPÓSITO: js/ vai para o site
  // publicado e docs/ não (mesma disciplina da a58). Em nenhum dos casos sai dado do servidor: o banco continua
  // exigindo um token de verdade.
  // Travado em tests/auth-perfil.check.mjs (o14) e tests/boot-sessao.check.mjs (A13 a A17), com mutantes embutidos.
  async boot() {
    if (this._supaIndisponivel()) {
      this._session = null;   // nem a do cb-session: o localStorage é editável (plano e papel escritos à mão)
      this._ready = true;
      return null;
    }
    if (!this.isSupa()) {
      this._session = this._localSession();
      this._ready = true;
      return this._session;
    }
    try {
      this._ouvirAuth();   // ANTES de qualquer await: evento emitido durante o boot não se perde
      const saidas0 = this._saidas;
      // Volta do Google: o que o SDK tem guardado é de ANTES (pode ser outra conta) e o cache também. Nada de
      // tela otimista: espera o SDK processar a URL (ele grava a sessão nova e só então o getSession responde). Na
      // volta com ERRO o SDK apaga o guardado: também espera, e o app.html cai no ramo do erro (login com o motivo).
      const retorno = this._retornoOAuth();
      // Leitura LOCAL (sem rede e sem a trava): só decide o PRAZO. A decisão de abrir relê depois do await.
      const guardada0 = retorno ? undefined : this._sessaoGuardada();
      const temCache = !!this._cacheBruto();
      const prazo = !retorno && (guardada0 || temCache) ? this._PRAZO_SESSAO_CURTO_MS : this._PRAZO_SESSAO_MS;
      this._diagInicio({
        oauth: retorno, oauthErro: this._flagJanela("_cbRetornoOAuthErro"),
        guardada: guardada0 === undefined ? "?" : guardada0 ? "sim" : "nao",
        vencida: guardada0 && guardada0.expiraEm ? guardada0.expiraEm * 1000 <= Date.now() : null,
        cache: temCache, prazoMs: prazo,
      }, retorno || guardada0 !== null || temCache);   // o diário só grava com sessão em jogo (ver _diagSalvar)
      const t0 = Date.now();
      const pSess = this._sessaoSdk();
      let r = await this._comPrazo(pSess, prazo);
      this._diagSessao("sessao", r, Date.now() - t0);
      if (r.estourou) {
        this._diagTravas();   // retrato de navigator.locks: quem segura a trava de auth do SDK agora
        pSess.then((t) => this._diagSessao("tardia", t, Date.now() - t0));
      }
      // SIGNED_OUT que chegou DURANTE a espera (refresh token recusado dentro do getSession: o SDK apaga
      // a sessão, emite SIGNED_OUT e devolve { session: null, error }): _encerrar() já rodou, SEM sessão
      // montada — logo, sem redirect. Abrir a tela com o cache agora seria o app zumbi por outra porta:
      // badge PRO e link Admin sem sessão no SDK, e ninguém levando ao login. Vale como "não há sessão".
      if (!r.user && this._saidas !== saidas0) r = { user: null };
      // O cache e a sessão guardada são lidos DEPOIS do await, pelo mesmo motivo: vale o que sobrou, não o que
      // havia antes (logout em outra aba apaga os dois; o SDK apaga a sessão quando o refresh é recusado).
      const cache = r.user || r.user === null || retorno ? null : this._cacheOtimista();
      const guardada = r.user || r.user === null || retorno ? null : this._sessaoGuardada();
      if (r.user) { await this._entrarCom(r.user); this._diagNota({ abriu: "confirmada" }); }
      else if (r.user === null) { this._session = null; this._cacheLimpar(); this._diagNota({ abriu: "sem-sessao" }); }   // o SDK respondeu: não há sessão
      else if (cache) {
        // Prazo estourou (refresh de token lento) ou o SDK não soube dizer (refresh falhou por rede).
        // NÃO é "deslogado" e ninguém é deslogado: abre com o cache, marcado como não confirmado; a
        // resposta do SDK (tardia, por evento de auth ou perguntando de novo) confirma ou encerra.
        const email = guardada && guardada.id === cache.uid ? guardada.email : "";
        this._session = this._sessaoDe({ id: cache.uid, email }, cache);
        this._session.naoConfirmada = true;
        this._diagNota({ abriu: "cache", perfil: "cache" });
        if (r.estourou) pSess.then((t) => this._sessaoTardia(t, saidas0));
        else this._reconferirSessao(0);
      } else if (guardada && guardada.id) {
        // a47: SEM cache, mas o SDK tem a sessão guardada (a leitura do perfil nunca deu certo neste aparelho, ou o
        // cache sumiu). Antes: splash até o SDK responder — ou login, se ele "não soube". Agora abre com o perfil
        // PROVISÓRIO (o padrão, nunca gravado no cache) e busca o perfil em 2º plano; quem decide por perfil espera
        // o lido (depoisDoPerfil). O SDK confirma ou encerra depois, como no caminho do cache.
        const user = { id: guardada.id, email: guardada.email || "" };
        this._session = this._sessaoDe(user, null);
        this._session.naoConfirmada = true;
        this._diagNota({ abriu: "guardada" });
        this._revalidar(user, true).catch(() => {});
        if (r.estourou) pSess.then((t) => this._sessaoTardia(t, saidas0));
        else this._reconferirSessao(0);
      } else {
        // Sem cache e sem sessão guardada (ou na volta do Google) não há tela otimista: segue SEM sessão confirmada
        // e sem deslogar ninguém. A resposta do SDK continua sendo esperada em sessaoPendente() — a landing abre já
        // como visitante (e troca para "Abrir o app" quando a sessão chegar: aoMudarSessao); o app (que exige
        // sessão) segura o splash em vez de mandar para o login.
        this._session = null;
        this._diagNota({ abriu: r.estourou ? "pendente" : "sem-sessao" });
        if (r.estourou) {
          const p = this._comPrazo(pSess, this._PRAZO_SESSAO_MAX_MS)
            .then((t) => {
              if (t && t.user) return this._entrarCom(t.user);
              if (t && t.user === null) this._cacheLimpar();   // não havia sessão: cache que sobrou é órfão
              // Passou do nosso teto e o SDK segue calado: a página para de esperar (o app.html diz que não conseguiu
              // confirmar), mas a resposta, quando vier, ainda entra — o app abre sozinho, como o splash promete.
              if (t && t.estourou) {
                pSess.then((tarde) => {
                  if (tarde && tarde.user && !this._session && this._saidas === saidas0) return this._entrarCom(tarde.user);
                }).catch((e) => console.error("auth.boot (sessão muito tardia):", e));
              }
              return null;
            })
            .catch((e) => console.error("auth.boot (sessão tardia):", e))
            .then(() => { if (this._pendente === p) this._pendente = null; });
          this._pendente = p;
        }
      }
    } catch (e) { console.error("auth.boot:", e); }
    this._ready = true;
    this._avisada = this._chaveAviso(this._session);   // o cbInit lê AUTH.session() direto; daqui em diante, aviso
    this._diagSalvar();
    return this._session;
  },

  // Boot sem cache cujo prazo de sessão estourou: promessa que resolve quando o SDK responder (ou null
  // se não há nada pendente). Página que EXIGE sessão espera por ela em vez de mandar para o login.
  sessaoPendente() { return this._pendente; },

  // a47: página que EXIGE sessão (app.html, admin.html) só manda ao login com isto verdadeiro: o SDK JÁ respondeu que
  // não há sessão E o storage que ele USA está vazio (_sessaoGuardada). Sessão guardada que o SDK ainda não confirmou,
  // ou a volta do Google em curso (o SDK ainda não respondeu), NÃO é "deslogado" — a página espera, e diz quando cansou
  // (app.html, splash). Modo local e SDK fora do ar: como sempre (não há o que esperar). Storage do SDK ilegível ("não
  // sei") conta como guardado.
  podeIrAoLogin() {
    if (!this.isSupa()) return true;
    if (this._session) return false;
    return this._respostaSdk === "nenhuma" && this._sessaoGuardada() === null;
  },

  // a47: a volta do Google, marcada pelo <head> do app.html ANTES de o SDK apagar o hash (window._cbRetornoOAuth: só
  // um booleano, nunca a URL com o token) — boa ou com ERRO (window._cbRetornoOAuthErro): nas duas, o que o SDK tem
  // guardado é de antes (na do erro, o SDK o apaga).
  // SEM a flag no window (céticos, 19/set/2026): um app.html VELHO, cópia do service worker, com este js/auth.js novo
  // (o sw.js serve cada arquivo pela rede com prazo, e a 1ª abertura depois de publicar pode misturar versões) — ou as
  // outras páginas. Aí vale a URL, lida AGORA: o boot começa na mesma volta do laço em que o js/supa.js cria o cliente, e
  // o SDK só apaga o hash depois do /user da volta (rede). Sem isto, a conta guardada de antes abria por um instante.
  _retornoOAuth() {
    if (this._flagDefinida("_cbRetornoOAuth") || this._flagDefinida("_cbRetornoOAuthErro")) return this._flagJanela("_cbRetornoOAuth") || this._flagJanela("_cbRetornoOAuthErro");
    try { return /[?&#](code|access_token|error)=/.test(String(window.location.search || "") + String(window.location.hash || "")); } catch (e) { return false; }
  },
  _flagDefinida(nome) {
    try { return !!(window && typeof window[nome] === "boolean"); } catch (e) { return false; }
  },
  _flagJanela(nome) {
    try { return !!(window && window[nome] === true); } catch (e) { return false; }
  },

  // a47: avisa quem desenhou antes de a sessão chegar (ou depois de ela sair): fn(sessão | null), a cada troca de
  // usuário (null → uid, uid → null, uid → outro) e quando o SDK CONFIRMA a sessão otimista do boot (a landing fecha o
  // login que o #entrar abriu por cima dela). A landing troca "Entrar" por "Abrir o app" quando a sessão pendente do
  // boot resolve ou um evento de auth a traz. Só depois do boot (o cbInit lê AUTH.session() direto).
  aoMudarSessao(fn) { if (typeof fn === "function") this._ouvintesSessao.push(fn); },
  _chaveAviso(s) { return s ? s.id + (s.naoConfirmada ? "?" : "") : null; },
  _notificarSessao() {
    if (!this._ready || this._avisada === undefined) return;
    const chave = this._chaveAviso(this._session);
    if (chave === this._avisada) return;
    this._avisada = chave;
    const s = this._session;
    for (const fn of this._ouvintesSessao.slice()) {
      try { fn(s); } catch (e) { console.error("aoMudarSessao:", e); }
    }
  },

  // ---------- Perfil provisório (a47) ----------
  // Sessão do Supabase cujo perfil NUNCA foi lido neste aparelho (sem cache e a 1ª leitura ainda no ar, ou falhou):
  // plano/role são o padrão (gratuito/user). Serve para desenhar; NÃO serve para decidir que alguém "não é admin" ou
  // "não é PRO". Sessão do modo local não tem perfil a esperar.
  perfilProvisorio() {
    const s = this._session;
    return !!(s && this.isSupa() && !s.perfilConfirmadoEm);
  },
  // Promessa que resolve (com a sessão) quando a carga de perfil EM CURSO terminar, dando certo ou não — ou null se o
  // perfil não é provisório ou não há carga no ar. Como sessaoPendente(): quem decide por perfil espera por ela; depois
  // dela decide com o que houver (a re-tentativa, se vier, avisa por cbPerfilMudou).
  perfilPendente() {
    const s = this._session;
    if (!this.perfilProvisorio() || !this._emVoo || this._emVoo.uid !== s.id) return null;
    return this._emVoo.p.then(() => this._session, () => this._session);
  },
  // Roda fn com o perfil LIDO: na hora, se já foi lido alguma vez (ou no modo local); senão, UMA vez, quando a 1ª
  // leitura boa chegar. Para decisão que TIRA algo da tela (a aba do corpo técnico, os anúncios): com o provisório ela
  // tiraria de quem tem direito, até o reload. Se o perfil nunca chegar, fn não roda — o que depende dele fica como está.
  depoisDoPerfil(fn) {
    if (typeof fn !== "function") return;
    if (!this.perfilProvisorio()) { fn(); return; }
    this._esperaPerfil.push(fn);
  },
  _soltarEsperaPerfil() {
    if (!this._esperaPerfil.length || !this._session || this.perfilProvisorio()) return;
    const fila = this._esperaPerfil.splice(0);
    for (const fn of fila) { try { fn(); } catch (e) { console.error("depoisDoPerfil:", e); } }
  },

  _comPrazo(promessa, ms) {
    let t;
    const prazo = new Promise((ok) => { t = setTimeout(() => ok({ estourou: true }), ms); });
    return Promise.race([promessa, prazo]).finally(() => clearTimeout(t));
  },

  // getSession() lê do storage; só vai à rede se o token venceu (refresh). Nunca rejeita.
  // { user } = há sessão · { user: null } = não há · { indefinida } = o SDK não soube (erro de rede).
  async _sessaoSdk() {
    const r = await this._perguntarSdk();
    this._respostaSdk = r.user ? "user" : r.user === null ? "nenhuma" : "indefinida";   // podeIrAoLogin lê isto
    return r;
  },
  async _perguntarSdk() {
    try {
      const { data, error } = await window.supa.auth.getSession();
      const user = data && data.session && data.session.user;
      if (user) return { user };
      // Sem sessão E com erro, há dois mundos (js/vendor/supabase.js, _callRefreshToken): falha de REDE
      // no refresh (AuthRetryableFetchError, status 0/502–504) — o SDK MANTÉM a sessão guardada e segue
      // tentando → "indefinida"; recusa do servidor (4xx: refresh token inválido, já usado, revogado) —
      // o SDK já APAGOU a sessão e emitiu SIGNED_OUT → não há sessão. Na dúvida (erro sem status), é
      // indefinida: errar para cá não desloga ninguém, e o SIGNED_OUT (_saidas) cobre o engano.
      return error && !this._recusaDoServidor(error) ? { indefinida: true } : { user: null };
    } catch (e) { return { indefinida: true }; }
  },
  _recusaDoServidor(error) {
    const st = error && error.status;
    return error.name !== "AuthRetryableFetchError" && typeof st === "number" && st >= 400 && st < 500;
  },

  async _entrarCom(user) {
    if (this._uidEncerrado === user.id) this._uidEncerrado = null;   // a61: o SDK reabriu — a marca de saída caduca
    const cache = this._cacheLer(user.id);
    if (cache) {
      this._session = this._sessaoDe(user, cache);
      this._diagPerfil("cache", 0);
      this._revalidarFundo(user);
      this._notificarSessao();
      return;
    }
    // 1º acesso neste aparelho: não há o que mostrar de otimista — espera o perfil, mas com prazo (a47: 1,5 s, não 4).
    // Estourou → entra com o PROVISÓRIO; a carga segue no ar e, quando chegar, atualiza a tela (cbPerfilMudou).
    const saidas0 = this._saidas;
    const t0 = Date.now();
    const r = await this._comPrazo(this._revalidar(user, true), this._PRAZO_PERFIL_MS);
    this._diagPerfil(r && r.estourou ? "estourou" : r && r.confirmado ? "lido" : "falhou", Date.now() - t0);
    // a61: a sessão MORREU durante a espera (token recusado pelo servidor, ou SIGNED_OUT de outra aba). Sem esta
    // guarda a linha de baixo a ressuscitaria com o perfil provisório — e o app abriria depois de já ter saído.
    if (this._saidas !== saidas0) return;
    if (!this._session || this._session.id !== user.id) this._session = this._sessaoDe(user, null);
    this._verificarRevogadaDepois();
    this._notificarSessao();
  },

  _revalidarFundo(user) {
    this._revalidar(user, true).catch(() => {});
    this._verificarRevogadaDepois();
  },

  // A conferência de sessão revogada ESPERA o app carregar: getUser() segura a trava de auth do SDK
  // enquanto vai à rede, e toda requisição (supa.from, functions) passa por essa trava para pegar o
  // token. Medido em 17/set/2026: com o getUser logo depois do boot, as primeiras consultas do app só
  // saíam quando ele voltava (+260 ms no desktop; no celular, o RTT inteiro).
  _verificarRevogadaDepois(ms) {
    clearTimeout(this._tRevogada);
    this._tRevogada = setTimeout(() => { this._verificarRevogada(); }, typeof ms === "number" ? ms : this._ESPERA_REVOGADA_MS);
  },
  // a61 (corretor, 20/set/2026): a conferência NÃO pode ser de tiro único. Há forja que nenhuma consulta de perfil
  // enxerga — o PostgREST responde a ela como ANÔNIMO, sem recusa nenhuma — e só este getUser a pega. Se a única
  // chamada cair (rede fora por 1 s, 5xx do Auth, prazo), sem isto ela nunca mais seria refeita e a tela ficaria
  // aberta até a próxima abertura da página. Escada de sempre (3 s, 10 s, 30 s) e FIM: re-tentar para sempre
  // seguraria a trava de auth do SDK de tempos em tempos sem nada a mostrar.
  _reconferirRevogada() {
    if (this._tentativaRevogada >= this._RETENTATIVAS_MS.length) return;
    this._verificarRevogadaDepois(this._RETENTATIVAS_MS[this._tentativaRevogada++]);
  },

  // O SDK respondeu DEPOIS do prazo do boot (a tela já abriu com o cache ou com a sessão guardada).
  // `saidas0` = quantas saídas havia quando esta espera foi armada. Diferente agora = a sessão morreu no meio
  // (SIGNED_OUT de outra aba, token recusado) e esta resposta é de ANTES: reabri-la traria de volta o usuário que
  // acabou de sair — a mesma armadilha que o boot já evita no caminho da resposta muito tardia.
  _sessaoTardia(t, saidas0) {
    if (typeof saidas0 === "number" && this._saidas !== saidas0) return;
    if (t && t.user) {
      // Confirma ANTES de revalidar: a carga de perfil não confirma sessão (a47 — ela pode ter saído antes, com a
      // sessão otimista, e conta só como perfil). Usuário diferente do otimista: a carga troca a sessão inteira.
      if (this._confirmarSessao(t.user)) this._atualizarTela(null);
      this._revalidarFundo(t.user);
    }
    else if (t && t.user === null) this._encerrar();   // não havia sessão: a tela otimista sai de cena
    else this._reconferirSessao(0);                    // indefinida: o SDK segue tentando; o app também pergunta
  },

  // Sessão aberta SÓ com o cache porque o SDK não soube dizer (refresh falhou por rede). O SDK re-tenta
  // sozinho e avisa por evento (TOKEN_REFRESHED/SIGNED_OUT), mas a tela não fica na dependência disso:
  // pergunta de novo (3 s, 10 s, 30 s). Resposta firme confirma (perfil revalidado, e-mail) ou encerra.
  _reconferirSessao(n) {
    clearTimeout(this._tSessao);
    if (n >= this._RETENTATIVAS_MS.length) return;
    this._tSessao = setTimeout(async () => {
      if (!this._session || !this._session.naoConfirmada) return;   // um evento de auth já resolveu (ou saiu)
      const t = await this._sessaoSdk();
      if (!this._session || !this._session.naoConfirmada) return;
      if (t.indefinida) this._reconferirSessao(n + 1); else this._sessaoTardia(t);
    }, this._RETENTATIVAS_MS[n]);
  },

  // getUser() vai ao servidor: é o que enxerga sessão REVOGADA (logout global em outro aparelho,
  // conta removida/banida). Só age com o servidor dizendo isso com todas as letras — falha de rede,
  // 5xx e token vencido NÃO deslogam ninguém.
  // a61 (corretor, 20/set/2026): recusa aqui é o passo 1, nunca o veredito — antes era, e o preço estava à vista:
  // uma chave de assinatura rotacionada, ou um intermediário que come o cabeçalho Authorization, faria ESTA linha
  // deslogar a base inteira de uma vez, cada aparelho perdendo o cache de perfil, com o refresh_token de todos
  // ainda bom. Quem condena é o passo 2 (_sessaoInsalvavel). E sem resposta não há passo nenhum: volta a conferir.
  async _verificarRevogada() {
    if (!this._session) return;   // saiu enquanto a conferência esperava a vez
    try {
      const r = await this._comPrazo(window.supa.auth.getUser(), this._PRAZO_CONSULTA_MS);
      if (!r || r.estourou) { this._reconferirRevogada(); return; }   // sem resposta: não é recusa, e não é o fim
      if (!r.error) { this._tentativaRevogada = 0; return; }          // o Auth aceitou o token: nada a fazer
      if (this._vereditoDoToken(r.error, r.error.status) === "nada") { this._reconferirRevogada(); return; }
      // a61: a MESMA saída do token recusado, inclusive apagando o guardado do SDK à mão. O signOut local, sem
      // rede, devolve erro SEM apagar nada (js/vendor/supabase.js, _signOut): sem isto a sessão recusada ficava
      // no storage e a recarga reabria a tela otimista com ela.
      if (await this._sessaoInsalvavel()) { await this._derrubarSessaoForjada(); return; }
      this._reconferirRevogada();   // o token era trocável (ou não deu para saber): confere de novo mais tarde
    } catch (e) { this._reconferirRevogada(); }
  },
  _sessaoMorta(error) {
    if (!error) return false;
    if (this._tokenRecusado(error, error.status)) return true;
    const m = String(error.message || "").toLowerCase();
    // Cinto e suspensório: o _tokenRecusado acima já inocenta o relógio, e nenhuma mensagem real chega aqui com
    // "expired" E "session not found" ao mesmo tempo — então NÃO há teste que mate um mutante que apague esta
    // linha, e isso está declarado de propósito em vez de disfarçado num caso artificial. Ela fica porque a régua
    // de baixo casa por FRASE, e uma frase nova do servidor com "session expired" cairia nela.
    if (this._MSG_NAO_DEFINITIVA.test(m)) return false;
    return (error.status === 401 || error.status === 403 || error.status === 404) &&
      (/session .*(not found|does not exist)/.test(m) || /user .*(not found|does not exist)/.test(m));
  },

  // ---------- Recusa DEFINITIVA do token (a61) ----------
  // A régua ÚNICA: PostgREST (profiles) e GoTrue (getUser) passam pelos mesmos olhos. O cabeçalho deste arquivo diz
  // de onde veio cada código e o que ficou de fora. Ordem de propósito: primeiro a MENSAGEM que inocenta, depois o
  // código que condena — no PostgREST anterior ao 13 o "JWT expired" saía com o MESMO código de uma assinatura
  // inválida (PGRST301), e é o texto que separa os dois.
  // `status` vem à parte porque o supabase-js NÃO o põe no erro do PostgREST: o corpo JSON do PostgREST vira o
  // `error` ({ code, message, details, hint }) e o status fica IRMÃO dele na resposta ({ error, data, status }) —
  // é o js/vendor/supabase.js quem faz isso. O erro do GoTrue (AuthApiError), esse traz `status` em si.
  // Códigos que já dizem que a CONTA/SESSÃO não existe mais: valem em qualquer status (o servidor foi categórico).
  _CODIGOS_CONTA_MORTA: ["session_not_found", "user_not_found", "user_banned"],
  // Códigos que dizem que o TOKEN não se sustenta; só valem com o servidor recusando (401/403).
  _CODIGOS_TOKEN_MAU: ["PGRST301", "bad_jwt", "no_authorization"],
  // O que NUNCA é definitivo, mesmo com o código certo: prazo e relógio. Duas famílias de frases, e elas NÃO são
  // as mesmas — conferir o cabeçalho antes de mexer, porque a ordem das palavras engana:
  //   - PostgREST:  "JWT expired" · "JWT not yet valid" · "JWT issued at future" (+ as JwtClaimsErr de nbf/iat)
  //   - golang-jwt, dentro da frase do GoTrue: "token is expired" · "token is not valid yet" · "token used before
  //     issued"  (github.com/golang-jwt/jwt, errors.go — lido em 20/set/2026)
  // "expir" cobre os dois lados de uma vez (e "session expired").
  _MSG_NAO_DEFINITIVA: /expir|not yet valid|not valid yet|issued at future|used before issued|nbf claim|iat claim/i,
  _tokenRecusado(erro, status) {
    if (!erro || typeof erro !== "object") return false;
    const txt = String(erro.message || "") + " " + String(erro.details || "") + " " + String(erro.hint || "");
    if (this._MSG_NAO_DEFINITIVA.test(txt)) return false;
    const c = String(erro.code || erro.error_code || "");
    if (!c) return false;                                              // 401 sem corpo conhecido (proxy): não derruba
    if (this._CODIGOS_CONTA_MORTA.indexOf(c) >= 0) return true;
    const st = typeof status === "number" ? status : erro.status;
    return this._CODIGOS_TOKEN_MAU.indexOf(c) >= 0 && (st === 401 || st === 403);
  },

  // Passo 1 da régua, em três palavras. "recusa" = o servidor disse que este token não presta (código conhecido,
  // e a frase não é de relógio). "renovar" = ele disse que o token VENCEU, ou que o relógio não fecha — recusa
  // também, mas de uma coisa que se troca. "nada" = o resto, inclusive erro nenhum: aqui não se faz nada.
  // Nenhum dos três derruba ninguém sozinho; quem derruba é o passo 2.
  _vereditoDoToken(erro, status) {
    if (!erro || typeof erro !== "object") return "nada";
    if (this._tokenRecusado(erro, status) || this._sessaoMorta(erro)) return "recusa";
    if (this._tokenParaRenovar(erro, status)) return "renovar";
    return "nada";
  },
  // O servidor refugou por PRAZO ou RELÓGIO (as frases de _MSG_NAO_DEFINITIVA, num 401/403). Não é prova de nada
  // — é o dia normal de um access_token de 1 h — mas é o gatilho certo para pedir um token novo: o SDK só renova
  // sozinho quando o `expires_at` que ELE guarda diz que a hora chegou, e esse campo é dado de fora como qualquer
  // outro no storage. Sem este gatilho, uma sessão cujo token o servidor recusa por vencido e cujo envelope diz
  // "ainda vale" nunca seria renovada nem conferida: ficaria aberta, com o servidor negando tudo.
  _tokenParaRenovar(erro, status) {
    if (!erro || typeof erro !== "object") return false;
    const txt = String(erro.message || "") + " " + String(erro.details || "") + " " + String(erro.hint || "");
    if (!this._MSG_NAO_DEFINITIVA.test(txt)) return false;
    const st = typeof status === "number" ? status : erro.status;
    return st === 401 || st === 403;
  },

  // Passo 2, o que condena. TOKEN NÃO É SESSÃO: pede um token novo e deixa o servidor responder qual dos dois
  // morreu. Token novo em mãos → a sessão vive e NINGUÉM sai (chave rotacionada, token vencido numa corrida,
  // cabeçalho comido por um proxy: curados, não só tolerados). Recusa definitiva do /token (4xx que não é de rede;
  // o /token nem usa o cabeçalho Authorization, só apikey e corpo) → morreu a SESSÃO. Rede, prazo, exceção ou
  // carência → false, porque "não sei" nunca derruba ninguém.
  // A CARÊNCIA é o que impede o laço: o SDK emite TOKEN_REFRESHED a cada renovação, o evento releva o perfil, e um
  // servidor que recuse até token novo faria isso girar. Dentro da carência a resposta é "não sei" — e o forjador
  // não escapa por ela, porque a PRIMEIRA tentativa já o pega.
  async _sessaoInsalvavel() {
    const agora = Date.now();
    if (this._renovadoEm && agora - this._renovadoEm < this._CARENCIA_RENOVACAO_MS) return false;
    this._renovadoEm = agora;
    try {
      const r = await this._comPrazo(window.supa.auth.refreshSession(), this._PRAZO_CONSULTA_MS);
      if (!r || r.estourou) return false;
      if (r.data && r.data.session) return false;   // veio token novo: a sessão está viva
      return !!(r.error && this._recusaDoServidor(r.error));
    } catch (e) { return false; }
  },

  // O servidor recusou o token E ele não era trocável: mesma saída de sessão morta, mais o storage DO SDK.
  // Idempotente e sem depender da rede para o que importa — o signOut({ scope: "local" }) deste SDK ainda dá um
  // pulo no servidor antes de apagar (js/vendor/supabase.js, _signOut) e, sem rede, devolve erro SEM apagar nada;
  // por isso o guardado é apagado à mão depois. Sem isto, recarregar reabriria a tela com a mesma sessão recusada.
  // O signOut vai COM PRAZO (corretor, 20/set/2026): ele pede a trava de auth com _acquireLock(-1), sem teto
  // nenhum (a mesma armadilha das linhas do _PRAZO_SESSAO_MAX_MS). Com a trava presa num refresh em curso, o await
  // sem prazo nunca assentava: não se apagava o guardado, não se encerrava, e o `finally` não rodava — o
  // _derrubando ficava true PARA SEMPRE e matava a segunda chance (a conferência de sessão).
  async _derrubarSessaoForjada() {
    if (this._derrubando) return;
    this._derrubando = true;
    try {
      try { await this._comPrazo(window.supa.auth.signOut({ scope: "local" }), this._PRAZO_SAIDA_MS); } catch (e) {}
      this._apagarSessaoGuardada();
      this._encerrar();   // idempotente: se o SIGNED_OUT do signOut já passou por aqui, não redireciona 2x
    } finally { this._derrubando = false; }
  },
  // Apaga o que o SDK guarda, no storage que ele USA (memória da página quando o localStorage não grava).
  _apagarSessaoGuardada() {
    try {
      const auth = window.supa.auth;
      const k = auth.storageKey;
      if (typeof k !== "string" || !k) return;
      const st = auth.storage && typeof auth.storage.removeItem === "function" ? auth.storage : localStorage;
      st.removeItem(k);
    } catch (e) {}
  },

  // ---------- Eventos de auth ----------
  _ouvirAuth() {
    if (this._ouvindo) return;
    this._ouvindo = true;
    window.supa.auth.onAuthStateChange((evt, sess) => {
      // NADA de await aqui dentro: o SDK espera este callback com a trava de auth na mão, e chamar o
      // próprio SDK daqui é o deadlock documentado por ele. O trabalho sai da pilha e lá tem await.
      setTimeout(() => { this._aoEventoAuth(evt, sess).catch((e) => console.error("auth.evento:", e)); }, 0);
    });
  },

  async _aoEventoAuth(evt, sess) {
    if (evt === "SIGNED_OUT") { this._respostaSdk = "nenhuma"; this._encerrar(); return; }
    if (!(sess && sess.user)) return;   // INITIAL_SESSION sem sessão não é "saiu": quem decide é o boot
    this._respostaSdk = "user";
    if (this._uidEncerrado === sess.user.id) this._uidEncerrado = null;   // a61: o SDK reabriu — a marca caduca
    // O SDK falou com uma sessão: a tela otimista (cache ou sessão guardada) está confirmada — ANTES da carga, que
    // não confirma nada sozinha (a47).
    const confirmou = this._confirmarSessao(sess.user);
    // SIGNED_IN chega a cada volta do PWA ao primeiro plano; TOKEN_REFRESHED, de hora em hora. Só vai
    // à rede se o usuário mudou ou o perfil confirmado envelheceu — e, indo, espera e SÓ DEPOIS mexe
    // na tela (_revalidar atualiza o menu no fim da carga).
    const r = await this._revalidar(sess.user, false);
    if (r && r.pulou && confirmou) this._atualizarTela(null);
  },

  // Sessão aberta só com o cache (boot com prazo estourado) e agora confirmada pelo SDK: ganha o e-mail.
  _confirmarSessao(user) {
    const s = this._session;
    if (!s || s.id !== user.id) return false;
    let mexeu = false;
    if (user.email && s.email !== user.email) { s.email = user.email; mexeu = true; }
    if (s.naoConfirmada) { delete s.naoConfirmada; mexeu = true; }
    return mexeu;
  },

  // Fim de sessão que NÃO veio do botão Sair (token revogado, logout em outra aba): antes a tela ficava
  // montada com sessão null — "app zumbi", paywall em tudo. Agora limpa e leva ao login.
  _encerrar() {
    const tinha = !!this._session;
    if (tinha) this._uidEncerrado = this._session.id;   // a61: carga de perfil atrasada não ressuscita quem saiu
    this._saidas++;          // o boot confere: saída no meio do getSession dele não abre tela com o cache
    this._session = null;
    this._uidAtual = null;   // carga de perfil ainda no ar morre ao chegar
    this._emVoo = null;
    this._testeUsadoUid = null;
    clearTimeout(this._tRetry); clearTimeout(this._tRevogada); clearTimeout(this._tSessao); this._tentativa = 0;
    this._esperaPerfil = [];   // decisão que esperava o perfil de quem saiu não roda mais
    this._cacheLimpar();
    this._notificarSessao();
    if (tinha && !this._saindo) this._irParaLogin();
  },
  _irParaLogin() {
    try {
      const l = window.location;
      if (/[?&]share=/.test(l.search || "")) return;                  // leitura pública por link não exige login
      if (/(^|\/)(index\.html)?$/.test(l.pathname || "")) return;     // já está na landing
      this._diagIrLogin("encerrou");
      l.href = "index.html#entrar";
    } catch (e) {}
  },

  // ---------- Cache de perfil (localStorage; try/catch em tudo: modo privado lança) ----------
  // O cache é dado de FORA (localStorage é editável; extensão ou versão futura podem gravar outra coisa):
  // ou tem exatamente o formato que _cacheGravar escreve, ou é descartado INTEIRO — plano numérico,
  // role objeto ou nome lista viravam a sessão do boot otimista e quebravam o 1º desenho
  // (renderUserMenu faz sess.nome.split). Descartado = 1º acesso no aparelho: espera o perfil lido.
  _cacheBruto() {
    try {
      const c = JSON.parse(localStorage.getItem(this._PERFIL_KEY));
      const txt = (v) => typeof v === "string" && v.length > 0;
      if (!c || typeof c !== "object" || Array.isArray(c)) return null;
      if (!txt(c.uid) || !txt(c.nome) || !txt(c.plano) || !txt(c.role)) return null;
      if (typeof c.em !== "number" || !isFinite(c.em) || c.em <= 0) return null;
      if (c.preferencias != null && (typeof c.preferencias !== "object" || Array.isArray(c.preferencias))) return null;
      // planoAte / testeUsadoEm: ausentes (cache de antes da 0098), null ou data ISO legível. Data ilegível
      // não é "sem prazo": é cache que o app não gravou → descartado inteiro, como o resto.
      const data = (v) => v == null || (txt(v) && isFinite(Date.parse(v)));
      if (!data(c.planoAte) || !data(c.testeUsadoEm)) return null;
      return c;
    } catch (e) { return null; }
  },
  // Cache para abrir a tela ANTES de o SDK responder (prazo estourado / refresh falhou por rede). Ali
  // ainda não há uid confirmado, então confere com o uid que o SDK tem GUARDADO: outro uid → o cache é
  // de quem já não está logado (apaga, não usa: a tela não abre com id/nome/role do usuário anterior);
  // sem sessão guardada → não há o que antecipar; não deu para ler (formato do storage mudou) → vale
  // o cache, como antes — a conferência só RECUSA com prova, nunca piora o boot.
  _cacheOtimista() {
    const c = this._cacheBruto();
    if (!c) return null;
    const uid = this._uidDoSdk();
    if (uid === undefined || uid === c.uid) return c;
    if (uid) this._cacheLimpar();
    return null;
  },
  // A sessão que o SDK guarda no storage dele (supabase-js 2.x: a sessão inteira em JSON sob auth.storageKey).
  // Leitura LOCAL, sem rede e sem a trava de auth. Só saem daqui o id, o e-mail e a validade (expires_at, em
  // segundos) — o token não é lido para nada, copiado nem guardado; o e-mail fica só na memória da página (a sessão),
  // nunca no cache nem no diário do boot. { id, email, expiraEm } = há sessão guardada · null = o SDK não guarda
  // sessão nenhuma · undefined = não sei (formato do storage mudou, storage assíncrono ou ilegível).
  // Lê do storage que o SDK USA (auth.storage), não do localStorage direto (céticos de 19/set/2026): quando o
  // localStorage não aceita gravação (cheio — o js/store.js espelha os dados nele —, bloqueado, modo privado) o SDK
  // guarda a sessão na MEMÓRIA da página. Lendo o localStorage, uma sessão VELHA que ficou lá (ou o "não sei" do
  // storage bloqueado) segurava o podeIrAoLogin falso para sempre: quem estava deslogado nunca ia ao login e via o
  // aviso do teto. Sem auth.storage (outro SDK), o localStorage, como antes.
  _sessaoGuardada() {
    try {
      const auth = window.supa.auth;
      const k = auth.storageKey;
      if (typeof k !== "string" || !k) return undefined;
      const st = auth.storage && typeof auth.storage.getItem === "function" ? auth.storage : localStorage;
      const bruto = st.getItem(k);
      if (bruto && typeof bruto.then === "function") return undefined;   // storage assíncrono: sem esperar, não sei
      if (bruto == null) return null;
      const v = JSON.parse(bruto);
      const u = v && v.user;
      const id = u && u.id;
      if (typeof id !== "string" || !id) return undefined;
      if (!this._tokenPlausivel(v)) return null;   // a61: lixo no storage vale como "o SDK não guarda sessão"
      const exp = v.expires_at;
      return { id, email: typeof u.email === "string" ? u.email : "", expiraEm: typeof exp === "number" && isFinite(exp) ? exp : null };
    } catch (e) { return undefined; }
  },
  // a61: HIGIENE do que está guardado — e a palavra é higiene, não segurança. Nada aqui confere ASSINATURA (a chave
  // é do servidor; no navegador ninguém confere) e quem edita o código servido pula isto inteiro. Serve para UMA
  // coisa: não abrir a tela de forma otimista com um conteúdo que este SDK, neste projeto, nunca escreveu — colagem
  // descuidada, storage de outro projeto, sobra de uma versão antiga. Quem fecha o caminho é a resposta do servidor
  // (_tokenRecusado). Reprovado = "o SDK não guarda sessão" (null), e não "não sei": assim o boot segue o caminho de
  // quem não tem nada guardado (o SDK decide) e, principalmente, o storage inválido NUNCA prende ninguém fora do
  // login — podeIrAoLogin volta a poder ser verdadeiro.
  // O token NÃO é lido para mais nada: só a forma, o `exp` e o `iss` saem daqui, e nenhum deles vai para o diário.
  _tokenPlausivel(v) {
    try {
      const t = v && v.access_token;
      if (typeof t !== "string" || !t) return false;
      const partes = t.split(".");
      if (partes.length !== 3 || !partes[0] || !partes[1] || !partes[2]) return false;
      const p = JSON.parse(this._base64url(partes[1]));
      if (!p || typeof p !== "object" || Array.isArray(p)) return false;
      // Emissor: só a PROVA recusa — um `iss` que é de OUTRO projeto Supabase. Ausente, ou numa forma que não
      // reconhecemos (domínio próprio, chave assimétrica, projeto de outra era), PASSA: sem a chave do servidor não
      // dá para saber como é todo token legítimo que este projeto já emitiu, e recusar por não reconhecer
      // derrubaria login de verdade — que é o defeito que não se pode cometer aqui.
      const nosso = this._emissorDoProjeto();
      const iss = String(p.iss || "");
      if (nosso && /^https:\/\/[a-z0-9-]+\.supabase\.co\/auth\/v1\/?$/i.test(iss) && iss.replace(/\/+$/, "") !== nosso) return false;
      const exp = p.exp;
      if (typeof exp !== "number" || !isFinite(exp) || exp <= 0) return false;
      // TOKEN VENCIDO NÃO É TOKEN INVÁLIDO: o access_token dura ~1 h e quem fechou a aba ontem tem, no storage,
      // exatamente um token vencido — com refresh_token para renová-lo. Vencido só reprova quando NÃO HÁ com que
      // renovar; reprovar todo vencido mandaria ao splash (ou ao login) justamente quem a a47 protege.
      if (exp * 1000 <= Date.now() && !(typeof v.refresh_token === "string" && v.refresh_token)) return false;
      return true;
    } catch (e) { return false; }
  },
  // base64url → texto. O `atob` devolve bytes: acento no nome vira sujeira, e tudo bem — daqui só saem números e o
  // `iss`, que é ASCII. Comprimento inválido faz o atob lançar, e quem chama trata como reprovado.
  _base64url(s) {
    const b = String(s).replace(/-/g, "+").replace(/_/g, "/");
    return atob(b + "===".slice((b.length + 3) % 4));
  },
  // O emissor que ESTE projeto usa. Sem o js/config.js não há com o que comparar — e não comparar é melhor que
  // recusar às cegas. Só vale como régua quando o NOSSO endereço tem a mesma forma que o `iss` dos tokens
  // (https://<ref>.supabase.co): com domínio próprio — recurso do Supabase, e este projeto já tem o
  // civilbook.com.br — o SUPABASE_URL passaria a ser api.civilbook.com.br enquanto o GoTrue continua assinando
  // com o `iss` do supabase.co, e comparar reprovaria TODA sessão legítima. Forma diferente = sem régua.
  _emissorDoProjeto() {
    try {
      const u = window.CB_CONFIG && window.CB_CONFIG.SUPABASE_URL;
      if (typeof u !== "string" || !u) return "";
      const url = u.replace(/\/+$/, "");
      return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) ? url + "/auth/v1" : "";
    } catch (e) { return ""; }
  },

  // string = uid · null = o SDK não tem sessão guardada · undefined = não sei.
  _uidDoSdk() {
    const g = this._sessaoGuardada();
    return g ? g.id : g;
  },
  // Só serve o cache do PRÓPRIO usuário; o de outro uid é ignorado e apagado (não pode sobrar para
  // um boot otimista futuro abrir a tela com o perfil de quem já não está logado).
  _cacheLer(uid) {
    const c = this._cacheBruto();
    if (!c) return null;
    if (c.uid !== uid) { this._cacheLimpar(); return null; }
    return c;
  },
  // O cache guarda o plano BRUTO + o prazo, nunca o efetivo: "gratuito por ter vencido" é conta que se
  // refaz na leitura (o relógio anda; o que o servidor disse, não).
  _cacheGravar(s) {
    try {
      localStorage.setItem(this._PERFIL_KEY, JSON.stringify({
        uid: s.id, nome: s.nome, plano: s.planoBruto || s.plano, planoAte: s.planoAte || null,
        testeUsadoEm: s.testeUsadoEm || null, role: s.role,
        preferencias: s.preferencias || null, em: s.perfilConfirmadoEm
      }));
    } catch (e) {}
  },
  _cacheLimpar() { try { localStorage.removeItem(this._PERFIL_KEY); } catch (e) {} },

  // ---------- Plano efetivo (0098) ----------
  // A MESMA regra de public.plano_efetivo (SQL) e de planoEfetivo (supabase/functions/_shared/cota.ts), com
  // os MESMOS casos de teste (tests/plano-protegido.check.mjs (a) ↔ _shared/cota.test.ts): plano com prazo
  // (pro-teste, pro-cortesia — caixa e espaços não são brecha) cujo plano_ate JÁ PASSOU vale "gratuito";
  // vencido ⇔ plano_ate < agora (no instante exato ainda vale, como o `p_ate < now()` do SQL); plano_ate
  // nulo = sem prazo (admin isento); plano pago e ia* nem olham o prazo (quem os rebaixa é o webhook);
  // prazo ILEGÍVEL num plano com prazo → "gratuito" (na dúvida, não dá PRO por engano). Pura: `agora` vem
  // de quem chama (ms ou Date); só cai no relógio do aparelho se ninguém disser.
  _planoEfetivo(plano, planoAte, agora) {
    const bruto = plano == null ? "" : String(plano);
    const p = bruto.trim().toLowerCase();
    if (!p) return "gratuito";
    if (this._PLANOS_COM_PRAZO.indexOf(p) < 0) return bruto;
    if (planoAte == null || planoAte === "") return bruto;
    const ms = (v) => (v instanceof Date ? v.getTime() : typeof v === "number" ? v : Date.parse(v));
    const fim = ms(planoAte), t = agora == null ? Date.now() : ms(agora);
    if (!isFinite(fim) || !isFinite(t)) return "gratuito";
    return fim < t ? "gratuito" : bruto;
  },
  // timestamptz do servidor → texto ISO legível, ou null (é o que o cache aceita de volta em _cacheBruto)
  _dataOuNull(v) { return typeof v === "string" && v && isFinite(Date.parse(v)) ? v : null; },
  // plano_ate como o servidor mandou. Texto ilegível NÃO vira null: null é "sem prazo" (PRO para sempre);
  // o ilegível segue adiante e _planoEfetivo responde "gratuito" — a mesma escolha do cota.ts.
  _prazoLido(v) { return v == null || v === "" ? null : String(v); },

  // O efetivo é refeito A CADA LEITURA da sessão: teste/cortesia que vence com o app aberto passa a
  // gratuito na próxima tela, sem rede. Sessão do modo local não tem planoBruto e passa direto.
  _vigente(s) {
    if (s && s.planoBruto) {
      const ef = this._planoEfetivo(s.planoBruto, s.planoAte, Date.now());
      if (ef !== s.plano) s.plano = ef;
    }
    return s;
  },

  // `base` é o cache ({ plano: BRUTO, planoAte }), uma sessão anterior ({ plano: efetivo, planoBruto,
  // planoAte }) ou o perfil recém-lido ({ plano: BRUTO, planoAte }): o bruto sai de planoBruto quando
  // existe; senão, de plano.
  _sessaoDe(user, base) {
    base = base || {};
    const bruto = base.planoBruto || base.plano || "gratuito";
    const ate = base.planoAte || null;
    const s = {
      id: user.id,
      email: user.email,
      nome: base.nome || (user.email ? user.email.split("@")[0] : "Usuário"),
      plano: this._planoEfetivo(bruto, ate, Date.now()),
      planoBruto: bruto,
      planoAte: ate,
      testeUsadoEm: base.testeUsadoEm || null,
      role: base.role || "user",
      perfilConfirmadoEm: base.perfilConfirmadoEm || base.em || null
    };
    if (base.preferencias) s.preferencias = base.preferencias;
    return s;
  },

  // ---------- Perfil ----------
  // Uma consulta a profiles, isolada: nunca rejeita, e só é "ok" com linha lida e sem erro.
  async _consulta(colunas, uid) {
    try {
      const r = await this._comPrazo(
        window.supa.from("profiles").select(colunas).eq("id", uid).single(), this._PRAZO_CONSULTA_MS);
      if (r && !r.estourou && !r.error && r.data) return { ok: true, data: r.data };
      // a61: o status vem JUNTO, não dentro do erro (é assim que o postgrest-js devolve) — sem ele não dá para
      // separar "o servidor recusou o token" de "o servidor caiu". Prazo estourado não tem status: é falha.
      return { ok: false, erro: (r && r.error) || null, status: r && !r.estourou ? r.status : undefined };
    } catch (e) { return { ok: false, erro: null }; }
  },

  // Perfil base COM as colunas da 0098 (plano_ate, teste_usado_em). Banco ainda sem a migration: o
  // Postgres recusa a consulta INTEIRA (42703 — coluna não existe; PGRST204 é o mesmo aviso vindo do
  // cache de esquema do PostgREST) → relê sem elas e segue, com `semPrazo`. Coluna ausente NÃO é falha de
  // perfil: tratá-la como falha congelaria plano/role/nome no cache até a migration entrar. Sem memória
  // de propósito: a cada carga pergunta de novo, e no dia em que a 0098 entrar o prazo aparece sozinho
  // (custa 1 pedido recusado por carga, só enquanto o banco estiver na versão antiga).
  async _consultaBase(uid) {
    const r = await this._consulta(this._COLS_PERFIL + "," + this._COLS_PLANO_0098, uid);
    if (r.ok || !this._colunaAusente(r.erro)) return r;
    const r2 = await this._consulta(this._COLS_PERFIL, uid);
    if (r2.ok) r2.semPrazo = true;
    return r2;
  },
  _colunaAusente(erro) {
    const c = String((erro && erro.code) || "");
    return c === "42703" || c === "PGRST204";
  },

  // Revalida o perfil de `user`. Sem `forcar`, só vai à rede se o usuário mudou ou o perfil confirmado
  // passou do TTL. Pedidos simultâneos para o mesmo usuário dividem UMA carga. No fim — e só no fim —
  // atualiza a tela.
  _revalidar(user, forcar) {
    const s = this._session;
    if (!forcar && s && s.id === user.id && this._perfilFresco(s)) return Promise.resolve({ pulou: true });
    if (this._emVoo && this._emVoo.uid === user.id) return this._emVoo.p;
    const t0 = Date.now();
    const p = this._loadProfile(user).then(
      (r) => {
        this._fimDaCarga(p);
        if (r && !r.descartada) { this._atualizarTela(r); this._diagPerfilCarga(r, Date.now() - t0); }
        this._soltarEsperaPerfil();   // a47: decisões que esperavam o perfil LIDO (depoisDoPerfil)
        return r;
      },
      (e) => { this._fimDaCarga(p); console.error("auth.perfil:", e); return { confirmado: false, mudou: false }; });
    this._emVoo = { uid: user.id, p };
    return p;
  },
  _fimDaCarga(p) { if (this._emVoo && this._emVoo.p === p) this._emVoo = null; },
  // Idade NEGATIVA conta como vencida: `em` no futuro (cache gravado com o relógio do aparelho adiantado,
  // ou relógio que recuou no meio da sessão) faria `agora - em < TTL` valer para sempre, e nenhum evento
  // de auth voltaria a conferir o perfil nesta página.
  _perfilFresco(s) {
    if (!s.perfilConfirmadoEm) return false;
    const idade = Date.now() - s.perfilConfirmadoEm;
    return idade >= 0 && idade < this._PERFIL_TTL_MS;
  },

  // Menu sempre (barato, idempotente); o módulo atual só se plano/role/nome MUDARAM.
  _atualizarTela(r) {
    if (!this._ready) return;   // antes do cbInit não há tela para atualizar
    this._notificarSessao();    // a47: sessão que chegou por evento de auth (ex.: volta do Google) ou por outra conta
    try { if (typeof renderUserMenu === "function") renderUserMenu(); } catch (e) {}
    if (r && r.mudou && typeof window.cbPerfilMudou === "function") {
      try { window.cbPerfilMudou(this._session); } catch (e) { console.error("cbPerfilMudou:", e); }
    }
  },

  async _loadProfile(user) {
    const uid = user.id, gen = ++this._perfilGen;
    const saidas0 = this._saidas;   // a61: a sessão pode MORRER durante os awaits daqui — ver a guarda lá embaixo
    // a61 (corretor, 20/set/2026): …e pode ter morrido ANTES desta carga começar. A guarda de baixo compara o
    // ANTES com o DEPOIS e, para quem começa depois, os dois são iguais: a carga montava a sessão do usuário que
    // acabou de sair (plano e papel inteiros, isAdmin e tudo) e REGRAVAVA o cb-perfil que o _encerrar tinha
    // apagado — o que sobrevive à navegação. Só o SDK reabre uma sessão encerrada (_entrarCom, evento de auth).
    if (this._uidEncerrado === uid && !this._session) return { descartada: true };
    this._uidAtual = uid;
    // e30: as preferências vêm em consulta SEPARADA, de propósito. Somá-las ao select do perfil
    // faria a query INTEIRA falhar com 42703 enquanto a 0083 não estivesse aplicada — e o usuário
    // perderia nome, PLANO e ROLE de carona. Seguem separadas e agora em PARALELO, cada uma com o
    // próprio tratamento: a falha de uma não derruba a outra.
    const [rBase, rPref] = await Promise.all([
      this._consultaBase(uid),
      this._consulta("preferencias", uid)
    ]);
    if (this._uidAtual !== uid) return { descartada: true };   // saiu ou trocou de usuário com a consulta no ar

    // a61: o servidor RECUSOU o token (não falhou: entendeu o pedido e disse que o token não serve). Vem ANTES de
    // qualquer coisa mexer na sessão: aqui não se rebaixa plano nem papel — ou a sessão se renova, ou ela acaba.
    // Basta UMA das duas consultas recusar: as duas levam o mesmo token. E "recusou" é só o passo 1: quem condena
    // é a renovação (_sessaoInsalvavel), senão uma 401 de troca de chave de assinatura — ou um token que apenas
    // venceu — deslogaria todo mundo de uma vez. Renovou (ou não deu para saber): segue o caminho normal, e o
    // normal é não rebaixar nada e re-tentar.
    const vBase = this._vereditoDoToken(rBase.erro, rBase.status);
    const vPref = this._vereditoDoToken(rPref.erro, rPref.status);
    if (vBase !== "nada" || vPref !== "nada") {
      if (await this._sessaoInsalvavel()) {
        await this._derrubarSessaoForjada();
        return { descartada: true };   // nada de re-tentativa: não há o que re-tentar com uma sessão morta
      }
      if (this._uidAtual !== uid) return { descartada: true };   // saiu ou trocou de usuário durante a conferência
    }

    // `anterior` é lido DEPOIS do await: é o estado mais novo, inclusive o de uma carga concorrente.
    const anterior = this._session;
    const ant = anterior && anterior.id === uid ? anterior : null;
    const base = ant || this._cacheLer(uid) || {};
    const leuBase = rBase.ok && gen > this._genBase;   // lido com sucesso E mais novo que o último aplicado
    const leuPref = rPref.ok && gen > this._genPref;

    // SÓ PERFIL LIDO SOBRESCREVE. Sem leitura boa, plano/role/nome ficam como estavam (sessão ou
    // cache); "gratuito"/"user" só aparecem para quem nunca teve perfil lido neste aparelho.
    // Lido sem as colunas da 0098 (semPrazo): não há prazo no servidor → planoAte null, e o plano vale
    // como veio. Nunca "gratuito" por falta de coluna.
    const s = this._sessaoDe(user, leuBase
      ? { nome: rBase.data.nome, plano: rBase.data.plano, role: rBase.data.role,
          planoAte: rBase.semPrazo ? null : this._prazoLido(rBase.data.plano_ate),
          testeUsadoEm: rBase.semPrazo ? null : this._dataOuNull(rBase.data.teste_usado_em) }
      : base);
    if (!s.email && base.email) s.email = base.email;
    s.perfilConfirmadoEm = leuBase ? Date.now() : (base.perfilConfirmadoEm || base.em || null);
    const prefs = leuPref ? rPref.data.preferencias : base.preferencias;
    if (prefs) s.preferencias = prefs; else delete s.preferencias;
    if (leuBase) { this._genBase = gen; this._tentativa = 0; }
    if (leuPref) this._genPref = gen;

    const mudou = ant ? (ant.plano !== s.plano || ant.role !== s.role || ant.nome !== s.nome) : !!anterior;
    // a47: perfil não confirma SESSÃO. A carga pode ter saído com a sessão otimista (sessão guardada, sem cache) antes
    // de o SDK responder: a marca segue até o SDK falar (_confirmarSessao), senão _reconferirSessao pararia de perguntar.
    if (ant && ant.naoConfirmada) s.naoConfirmada = true;
    // a61: a sessão MORREU enquanto esta carga estava no ar (token recusado, SIGNED_OUT de outra aba). Sem esta
    // guarda a linha de baixo a RESSUSCITARIA com o padrão gratuito/user — e o _encerrar seguinte acharia
    // "tinha sessão" e mandaria ao login uma segunda vez. O _uidAtual sozinho não pega: uma carga que COMEÇA
    // depois do _encerrar o regrava logo na entrada. A guarda gêmea, do lado do boot, está em _entrarCom.
    if (this._saidas !== saidas0) return { descartada: true };
    this._session = s;
    // O cache só guarda o que o servidor já devolveu alguma vez — padrão ("gratuito") nunca entra.
    if (s.perfilConfirmadoEm && (leuBase || leuPref)) this._cacheGravar(s);
    try { if (typeof THEME !== "undefined" && THEME.aplicarDaConta) THEME.aplicarDaConta(s.preferencias); } catch (e) {}
    if (!rBase.ok && gen === this._perfilGen) this._agendarRetentativa(user);
    return { confirmado: leuBase, mudou };
  },

  // Perfil não lido: tenta de novo sozinho (3 s, 10 s, 30 s) — no celular a 1ª requisição depois de
  // voltar ao primeiro plano falha com frequência e a seguinte passa.
  _agendarRetentativa(user) {
    if (this._tentativa >= this._RETENTATIVAS_MS.length) return;
    const ms = this._RETENTATIVAS_MS[this._tentativa++];
    clearTimeout(this._tRetry);
    this._tRetry = setTimeout(() => {
      if (this._uidAtual === user.id && this._session) this._revalidar(user, true).catch(() => {});
    }, ms);
  },

  // e30: grava uma preferência na conta (best-effort — nunca derruba a interação).
  async salvarPreferencia(chave, valor) {
    const s = this._session;
    if (!s || !this.isSupa()) return false;
    s.preferencias = Object.assign({}, s.preferencias, { [chave]: valor });
    try {
      const { error } = await window.supa.from("profiles").update({ preferencias: s.preferencias }).eq("id", s.id);
      if (!error && s.perfilConfirmadoEm && this._cacheLer(s.id)) this._cacheGravar(s);   // o cache acompanha
      return !error;
    } catch (e) { return false; }
  },

  session() { return this._vigente(this._session); },
  isAdmin() { return !!(this._session && this._session.role === "admin"); },

  // ---------- Rate limiting client-side (cooldown anti-força-bruta) ----------
  // Camada de UX/dissuasão SOBRE os limites server-side do Supabase Auth (+ CAPTCHA opcional).
  // Após 5 falhas seguidas no mesmo e-mail, impõe espera escalonada (30s→60s→…→5min máx).
  // Persistido em localStorage para não zerar com um reload da página.
  _throttleKey: "cb-auth-throttle",
  _throttle() { try { return JSON.parse(localStorage.getItem(this._throttleKey)) || {}; } catch { return {}; } },
  _saveThrottle(t) { try { localStorage.setItem(this._throttleKey, JSON.stringify(t)); } catch {} },
  cooldownRestante(email) {
    const rec = this._throttle()[(email || "").trim().toLowerCase()];
    return rec && rec.until ? Math.max(0, Math.ceil((rec.until - Date.now()) / 1000)) : 0;
  },
  _registrarFalha(email) {
    email = (email || "").trim().toLowerCase();
    const LIMIAR = 5, t = this._throttle(), rec = t[email] || { fails: 0, until: 0 };
    rec.fails++;
    if (rec.fails >= LIMIAR) rec.until = Date.now() + Math.min(300, 30 * Math.pow(2, rec.fails - LIMIAR)) * 1000;
    t[email] = rec; this._saveThrottle(t);
  },
  _limparThrottle(email) {
    email = (email || "").trim().toLowerCase();
    const t = this._throttle(); if (t[email]) { delete t[email]; this._saveThrottle(t); }
  },

  // ---------- Login ----------
  async login(email, senha, captchaToken) {
    email = (email || "").trim().toLowerCase();
    const espera = this.cooldownRestante(email);
    if (espera > 0) return { erro: `Muitas tentativas seguidas. Aguarde ${espera}s antes de tentar de novo.`, cooldown: espera };

    let res;
    if (this.isSupa()) {
      const cred = { email, password: senha };
      if (captchaToken) cred.options = { captchaToken };   // CAPTCHA nativo do Supabase (se ativo)
      const { data, error } = await window.supa.auth.signInWithPassword(cred);
      if (error) res = { erro: this._msg(error) };
      // _revalidar (e não _loadProfile direto): o SIGNED_IN que o SDK emite agora divide ESTA carga.
      else { await this._revalidar(data.user, true); res = { ok: true, sessao: this._session }; }
    } else if (this._supaIndisponivel()) {
      return { erro: "Serviço de login indisponível no momento. Verifique sua conexão e recarregue a página." };
    } else {
      res = this._localLogin(email, senha);
    }

    if (res.erro) { this._registrarFalha(email); const r = this.cooldownRestante(email); if (r > 0) res.cooldown = r; }
    else this._limparThrottle(email);
    return res;
  },

  // ---------- Login social (b7) — OAuth via Supabase ----------
  // Redireciona ao Google e volta para app.html; a sessão é resolvida no boot()
  // (detectSessionInUrl + onAuthStateChange) — não há retorno síncrono em caso de sucesso.
  // Requer o provedor Google HABILITADO no Supabase (Auth → Providers) + credencial OAuth.
  async loginGoogle() {
    // a50: sem o SDK em produção, o mesmo aviso do login por e-mail (não a frase de desenvolvimento abaixo)
    if (this._supaIndisponivel()) return { erro: "Serviço de login indisponível no momento. Verifique sua conexão e recarregue a página." };
    if (!this.isSupa()) return { erro: "Login com Google requer o backend configurado." };
    const redirectTo = new URL("app.html", window.location.href).href;
    const { error } = await window.supa.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    return error ? { erro: this._msg(error) } : { ok: true };
  },

  // ---------- Senha nova (cadastro e Minha conta) ----------
  // Confere ANTES da rede, com os números e os tipos do servidor: "" = pode enviar; senão, o texto da tela. `confirma` é
  // opcional (o cadastro não tem o campo de repetir). Travado por execução em tests/acesso.check.mjs.
  _bytes(s) {
    try { return new TextEncoder().encode(String(s || "")).length; } catch (e) { return String(s || "").length; }
  },
  // O teto é de BYTES (o do servidor), não de letras: dizer "até 72 caracteres" enganava quem usa € ou emoji.
  _textoTeto() {
    return `A senha é longa demais: o limite é de ${this.SENHA_MAX_BYTES} bytes (letras sem acento contam 1; letras acentuadas, 2; símbolos como € e emojis, 3 ou 4).`;
  },
  // Os tipos que o servidor EXIGE, lidos da frase dele ("…at least one character of each: abc…, ABC…, 012…."),
  // em português: "letras minúsculas, letras maiúsculas e números". "" se a frase não vier nesse formato. O
  // servidor junta as frases dos motivos com espaço e a da senha vazada vem DEPOIS ("… 0123456789. Password is
  // known to be weak…"): a lista termina no ". Password" seguinte ou no fim (código-fonte do supabase/auth). O corpo
  // é IDÊNTICO ao de tiposExigidos() em js/acesso.js (tests/acesso.check.mjs compara e roda os dois).
  _tiposExigidos(frase) {
    var m = String(frase || "").match(/at least one character of each:\s*([\s\S]*?)(?:\.\s+Password\b[\s\S]*|\.?\s*)$/i);
    if (!m) return "";
    var partes = m[1].split(/,\s+/), nomes = [];
    for (var i = 0; i < partes.length; i++) {
      var p = partes[i], nome;
      if (!p) continue;
      if (/^[a-z]+$/.test(p)) nome = "letras minúsculas";
      else if (/^[A-Z]+$/.test(p)) nome = "letras maiúsculas";
      else if (/^[a-zA-Z]+$/.test(p)) nome = "letras";
      else if (/^[0-9]+$/.test(p)) nome = "números";
      else nome = "símbolos";
      if (nomes.indexOf(nome) < 0) nomes.push(nome);
    }
    if (!nomes.length) return "";
    return nomes.length === 1 ? nomes[0] : nomes.slice(0, -1).join(", ") + " e " + nomes[nomes.length - 1];
  },
  // Os tipos que FALTAM na senha nova, conferidos como o servidor confere (algum caractere de cada conjunto de
  // `tipos`, sem acento nem normalização), em texto de gente; "" = tem todos. Quando falta o símbolo, o texto lista os
  // que valem. O corpo é IDÊNTICO ao de faltaTipos() em js/acesso.js (tests/acesso.check.mjs compara e roda os dois).
  _faltaTipos(senha, tipos) {
    var s = String(senha || ""), faltam = [], listar = "", todos = "", fora = false, i, j, tem;
    for (i = 0; i < tipos.length; i++) {
      tem = false;
      for (j = 0; j < s.length && !tem; j++) tem = tipos[i].conjunto.indexOf(s.charAt(j)) >= 0;
      if (!tem) { faltam.push(tipos[i].falta); if (tipos[i].listar) listar = tipos[i].conjunto; }
      todos += tipos[i].conjunto;
    }
    if (!faltam.length) return "";
    for (j = 0; j < s.length && !fora; j++) fora = todos.indexOf(s.charAt(j)) < 0;
    var texto = "A senha precisa ter também " + (faltam.length === 1 ? faltam[0] : faltam.slice(0, -1).join(", ") + " e " + faltam[faltam.length - 1]) + ".";
    if (fora) texto += " Espaço, ç, letras com acento, emojis e sinais como º, °, § e € podem entrar, mas não contam.";
    if (listar) texto += " Valem como símbolo: " + listar.split("").join(" ");
    return texto;
  },
  validarSenhaNova(senha, confirma) {
    const s = String(senha || "");
    if (s.length < this.SENHA_MIN) return `A senha precisa ter pelo menos ${this.SENHA_MIN} caracteres.`;
    if (this._bytes(s) > this.SENHA_MAX_BYTES) return this._textoTeto();
    const faltam = this._faltaTipos(s, this.SENHA_TIPOS);
    if (faltam) return faltam;
    if (confirma !== undefined && s !== String(confirma || "")) return "As senhas não conferem.";
    return "";
  },

  // ---------- Cadastro ----------
  async register(nome, email, senha, plano, extra, captchaToken) {
    email = (email || "").trim().toLowerCase();
    if (!nome || !nome.trim() || !email.includes("@")) return { erro: "Preencha o nome e um e-mail válido." };
    const erroSenha = this.validarSenhaNova(senha);
    if (erroSenha) return { erro: erroSenha };
    if (this.isSupa()) {
      // 0098: `plano` NÃO vai no metadado do cadastro. raw_user_meta_data é escrito pelo cliente — o
      // handle_new_user antigo lia o plano dali (conta nascia PRO sem pagar); o novo ignora e este lado
      // deixa de mandar. O parâmetro `plano` segue na assinatura só para o modo local (dev/E2E).
      const meta = { nome: nome.trim(), lgpd_consent: "true" };
      if (extra) Object.assign(meta, extra);
      delete meta.plano;
      const options = { data: meta };
      if (captchaToken) options.captchaToken = captchaToken;   // CAPTCHA nativo do Supabase (se ativo)
      const { data, error } = await window.supa.auth.signUp({ email, password: senha, options });
      if (error) return { erro: this._msg(error) };
      if (!data.session) return { ok: true, confirmar: true }; // confirmação de e-mail ativa
      await this._revalidar(data.user, true);
      return { ok: true, sessao: this._session };
    }
    if (this._supaIndisponivel()) return { erro: "Cadastro indisponível no momento. Verifique sua conexão e recarregue a página." };
    return this._localRegister(nome, email, senha, plano);
  },

  // ---------- Logout ----------
  // TODA saída deve passar por aqui: quem chama supa.auth.signOut direto provoca o SIGNED_OUT sem o
  // _saindo e ganha um 2º redirect (#entrar) concorrendo com o dele. opts.scope ("global" | "local")
  // existe para isso — sem opts vale o padrão do SDK, como sempre.
  async logout(opts) {
    this._saindo = true;   // o SIGNED_OUT que o signOut provoca limpa, mas quem redireciona é só aqui
    if (this.isSupa()) {
      const escopo = opts && (opts.scope === "global" || opts.scope === "local") ? { scope: opts.scope } : undefined;
      try { await window.supa.auth.signOut(escopo); } catch (e) {}
      // Limpa AQUI também, e não só no SIGNED_OUT: sem rede o signOut devolve erro e NÃO emite o evento.
      this._cacheLimpar();
    }
    else localStorage.removeItem("cb-session");
    this._session = null;
    window.location.href = "index.html";
  },

  // ---------- Plano (0098): o navegador NÃO grava plano ----------
  // Devolve SEMPRE { ok, motivo, plano, planoAte } (plano = o efetivo da sessão depois da chamada).
  //   modo local (dev/E2E, sem servidor para proteger): concede na hora pelo localStorage, como sempre;
  //   "pro-teste" → RPC iniciar_teste_pro (7 dias, uma vez por conta) e depois relê o perfil;
  //   qualquer outro plano → NADA é gravado: motivo "so_por_pagamento" (plano pago nasce do checkout).
  // motivo: null | "ja_usado" | "ja_pro" | "sem_sessao" (os três vêm da RPC) | "so_por_pagamento" |
  //   "indisponivel" (a RPC ainda não existe no banco, ou o SDK não carregou) | "rede" | "erro".
  // Em NENHUM desfecho a sessão muda sem o servidor ter dito: falha, recusa e RPC ausente não promovem.
  async upgrade(plano) {
    const s = this._session;
    const resp = (ok, motivo) => {
      const v = this._vigente(this._session);
      return { ok, motivo: motivo || null, plano: v ? v.plano : "gratuito", planoAte: (v && v.planoAte) || null };
    };
    if (!s) return resp(false, "sem_sessao");
    if (!this.isSupa()) {
      if (this._supaIndisponivel()) return resp(false, "indisponivel");   // produção sem SDK não é "modo local"
      s.plano = plano;
      this._localUpgrade(plano);
      return resp(true, null);
    }
    if (plano !== "pro-teste") return resp(false, "so_por_pagamento");

    let r;
    try { r = await this._comPrazo(window.supa.rpc("iniciar_teste_pro"), this._PRAZO_CONSULTA_MS); }
    catch (e) { console.error("upgrade:", e); return resp(false, "rede"); }
    if (!r || r.estourou) return resp(false, "rede");
    if (r.error) {
      if (this._rpcAusente(r)) return resp(false, "indisponivel");
      console.error("upgrade:", r.error);
      return resp(false, this._erroDeRede(r) ? "rede" : "erro");
    }
    if (!this._session || this._session.id !== s.id) return resp(false, "sem_sessao");   // saiu/trocou com a RPC no ar

    const d = r.data && typeof r.data === "object" ? r.data : {};
    const ok = d.ok === true;
    const motivo = ok ? null : (typeof d.motivo === "string" && d.motivo ? d.motivo : "erro");
    if (motivo === "ja_usado") this._testeUsadoUid = s.id;
    // Extra ao contrato (a 0098 manda; se não vier, a releitura do perfil traz): QUANDO o teste foi usado.
    const usadoEm = this._dataOuNull(d.teste_usado_em);
    if (usadoEm) this._session.testeUsadoEm = usadoEm;
    // A resposta da RPC É o servidor falando: vale como leitura de plano/prazo (só isso). Sem aplicá-la,
    // uma releitura de perfil que falhasse logo em seguida devolveria o clique ao paywall com o teste já
    // gasto. "ja_pro" entra pelo mesmo motivo: o servidor diz que já há PRO e a sessão daqui está velha.
    if ((ok || motivo === "ja_pro") && typeof d.plano === "string" && d.plano) {
      const atual = this._session;
      atual.planoBruto = d.plano;
      atual.planoAte = this._prazoLido(d.plano_ate);
      atual.plano = this._planoEfetivo(atual.planoBruto, atual.planoAte, Date.now());
      // Conta como a leitura MAIS NOVA: carga de perfil que saiu antes da RPC e chega depois (rede lenta)
      // traz o plano de antes do teste — sem isto ela devolveria o usuário ao paywall por ~10 min (TTL).
      this._genBase = ++this._perfilGen;
      if (atual.perfilConfirmadoEm) this._cacheGravar(atual);
    }
    // Releitura do perfil (teste_usado_em, prazo, cache). A carga em voo, se houver, saiu ANTES da RPC e
    // não serve de releitura: sai da frente (ela termina sozinha e a geração a descarta) e pede-se outra.
    // Com prazo: a tela não fica presa numa rede lenta — a carga segue no ar e atualiza ao chegar.
    if (motivo !== "sem_sessao") {
      const user = { id: s.id, email: s.email };
      try {
        if (this._emVoo && this._emVoo.uid === s.id) this._emVoo = null;
        await this._comPrazo(this._revalidar(user, true), this._PRAZO_RELEITURA_MS);
      } catch (e) { console.error("upgrade (releitura):", e); }
    }
    return resp(ok, motivo);
  },

  // A função não existe no banco (0098 ainda não aplicada): o PostgREST responde PGRST202 com HTTP 404
  // ("Could not find the function … in the schema cache"); 42883 é o mesmo aviso vindo do Postgres.
  _rpcAusente(r) {
    const e = (r && r.error) || {};
    const c = String(e.code || "");
    return c === "PGRST202" || c === "42883" || r.status === 404 || /could not find the function/i.test(String(e.message || ""));
  },
  _erroDeRede(r) {
    const m = String((r && r.error && r.error.message) || "").toLowerCase();
    return r.status === 0 || m.includes("failed to fetch") || m.includes("networkerror") || m.includes("network request") || m.includes("load failed");
  },

  // Estado do "Testar grátis" para a tela de plano: { usado, fimMs }. usado = o servidor registrou o teste
  // desta conta (profiles.teste_usado_em), o plano bruto ainda é o teste (vencido) ou a RPC acabou de
  // responder "ja_usado". fimMs = quando o teste terminou (ou termina), para a tela dizer a data.
  testeGratis() {
    const s = this._session;
    if (!s) return { usado: false, fimMs: null };
    const ini = s.testeUsadoEm ? Date.parse(s.testeUsadoEm) : NaN;
    const usado = isFinite(ini) || s.planoBruto === "pro-teste" || this._testeUsadoUid === s.id;
    let fim = NaN;
    if (s.planoBruto === "pro-teste" && s.planoAte) fim = Date.parse(s.planoAte);
    else if (isFinite(ini)) fim = ini + this._TESTE_DIAS * 24 * 60 * 60 * 1000;
    return { usado, fimMs: isFinite(fim) ? fim : null };
  },

  // "Esqueci a senha" (18/set/2026). Devolve { ok: true } ou { ok: false, motivo } — NUNCA a mensagem do
  // servidor. ANTI-ENUMERAÇÃO NA TELA: o /recover do Supabase Auth responde 200 na hora quando o e-mail não
  // tem conta, então tudo o que só acontece DEPOIS de achar a conta denunciaria que ela existe. Por isso
  // motivo próprio SÓ para o que o servidor confere ANTES de procurar a conta, ou que nem chega a ele:
  //   "limite"  = o limite POR IP (429 over_request_rate_limit, "Request rate limit reached");
  //   "captcha" = captcha_failed;  "formato" = validation_failed (o formato do e-mail);
  //   "rede"    = sem resposta do servidor (status 0, sem conexão) ou o serviço inteiro fora (502/503);
  //   "sem_backend" (modo local/E2E), "indisponivel" (produção com o SDK fora) e "falha" (exceção DENTRO do
  //   navegador: o auth-js devolve TODA resposta do servidor como { error } e só lança o que é daqui).
  // TODO o resto é "outro", que a tela (js/auth-modal.js) mostra com a MESMA frase do sucesso. Exemplos:
  // os dois 429 de code over_email_send_rate_limit — o limite por conta ("For security purposes, you can only
  // request this after N seconds") e a COTA de e-mails do projeto ("Email rate limit exceeded", conferida no
  // envio, que só roda quando há a quem enviar); a falha do envio (500); o endereço recusado no envio
  // (email_address_invalid/_not_authorized); e a DEMORA (504 do gateway ou o nosso prazo estourado: o que
  // demora no /recover é o SMTP, que também só roda com conta). 429 que não é o do IP e erro desconhecido
  // também: na dúvida, a frase única é o lado seguro. A regra vale para a TELA — quem chama a API direto (a
  // anon key é pública) ainda lê o 429 por conta e o tempo de resposta; isso só o servidor fecha (Rate
  // Limits e CAPTCHA, docs/SECURITY.md §7). Travado em tests/recuperar-senha.check.mjs (este código rodando
  // com um SDK falso).
  async resetSenha(email, captchaToken) {
    if (!this.isSupa()) return { ok: false, motivo: this._supaIndisponivel() ? "indisponivel" : "sem_backend" };
    const opcoes = captchaToken ? { captchaToken } : undefined;   // CAPTCHA nativo do Supabase (se ativo)
    const classificar = (e) => {
      const nome = String((e && e.name) || ""), cod = String((e && e.code) || ""), st = e && e.status;
      const m = String((e && e.message) || "").toLowerCase();
      if (st === 504) return "outro";   // o gateway cansou de esperar: o envio demorou (só há envio com conta)
      if (st === 0 || nome === "AuthRetryableFetchError" || m.includes("failed to fetch") || m.includes("networkerror") || m.includes("network request") || m.includes("load failed")) return "rede";
      if (cod === "over_request_rate_limit" || m.includes("request rate limit")) return "limite";   // por IP
      if (cod === "captcha_failed" || m.includes("captcha")) return "captcha";
      if (cod === "validation_failed" || m.includes("invalid format")) return "formato";
      return "outro";
    };
    let r;
    try {
      r = await this._comPrazo(window.supa.auth.resetPasswordForEmail((email || "").trim().toLowerCase(), opcoes), this._PRAZO_CONSULTA_MS);
    } catch (e) {
      const motivo = classificar(e);
      return { ok: false, motivo: motivo === "outro" ? "falha" : motivo };
    }
    if (!r || r.estourou) {
      // O pedido saiu e a resposta não veio no prazo: a demora é o envio, que só existe com conta ("outro").
      console.warn("resetSenha: sem resposta no prazo, tratada como envio (anti-enumeração)");
      return { ok: false, motivo: "outro" };
    }
    if (!r.error) return { ok: true };
    const motivo = classificar(r.error);
    // Diagnóstico sem a frase do servidor (a aba Rede do navegador mostra a resposta inteira de qualquer jeito).
    if (motivo === "outro") console.warn("resetSenha: resposta tratada como envio (anti-enumeração):", r.error.status, r.error.code);
    return { ok: false, motivo };
  },

  // a47 (céticos, 19/set/2026): a mesma regra das páginas que exigem sessão — só leva ao login quem PODE ir.
  exigirLogin() {
    if (!this._ready || this._session || !this.podeIrAoLogin()) return;
    this._diagIrLogin("exigir");
    window.location.href = "index.html#entrar";
  },

  // ---------- Diário do boot (a47, 19/set/2026) ----------
  // A causa exata do "Está demorando mais que o normal" no navegador do fundador NÃO está provada (o banco e a rede
  // respondem em décimos de segundo medidos do mesmo PC). Por isso cada boot deixa um registro em localStorage
  // ("cb-boot-log", os últimos 5): as marcas performance cb:* (sdk-pronto, sessao-fim:<tipo>, perfil-fim:<tipo>, cbinit,
  // ir-login:<motivo>), o retrato de navigator.locks quando o getSession estoura o prazo (só nomes e contagens) e os
  // tempos dos pedidos ao Supabase (Resource Timing: SÓ o caminho, sem query — a do perfil leva o uid — com a duração
  // e o protocolo). SEM DADO PESSOAL: nada de token, e-mail, uid ou URL com query/fragmento. window.cbBootLog()
  // devolve o JSON para colar; o splash lento do app.html mostra um resumo numa linha "Detalhes". Tudo em try/catch:
  // o diário nunca atrapalha o boot. Pedido ainda no ar não aparece (o Resource Timing só lista o que terminou).
  // SÓ COM SESSÃO EM JOGO (revisão de 19/set/2026): o registro serve ao login e à sessão — a finalidade essencial da
  // privacidade.html —, então o visitante sem nada guardado (nem sessão no SDK, nem cache, nem volta do Google) não
  // ganha registro no aparelho: a landing anônima não grava nada. Passa a gravar quando uma sessão aparece, quando o
  // splash lento pede os Detalhes ou quando alguém chama window.cbBootLog(). Se isto é "essencial" ou "de análise" na
  // política é decisão do fundador (a47).
  _BOOT_LOG_KEY: "cb-boot-log",
  _BOOT_LOG_MAX: 5,
  _diag: null,
  _diagPersistir: false,
  _diagInicio(extra, persistir) {
    const d = { id: Math.random().toString(36).slice(2, 8), em: new Date().toISOString(), pagina: "?" };
    try { d.pagina = String(window.location.pathname || "").split("/").pop() || "index.html"; } catch (e) {}
    try { d.online = typeof navigator !== "undefined" && typeof navigator.onLine === "boolean" ? navigator.onLine : null; } catch (e) {}
    try { d.sw = !!(typeof navigator !== "undefined" && navigator.serviceWorker && navigator.serviceWorker.controller); } catch (e) {}
    try { Object.assign(d, extra || {}); } catch (e) {}
    this._diag = d;
    this._diagPersistir = !!persistir;
    this._diagSalvar();
  },
  _diagNota(o) {
    if (!this._diag) return;
    try { Object.assign(this._diag, o); } catch (e) {}
    this._diagSalvar();
  },
  _marca(nome) { try { performance.mark(nome); } catch (e) { /* sem User Timing: segue */ } },
  _tipoResposta(t) { return !t ? "?" : t.user ? "user" : t.user === null ? "null" : t.estourou ? "estourou" : t.indefinida ? "indefinida" : "?"; },
  // campo "sessao" (a resposta dentro do prazo do boot) ou "tardia" (a que veio depois do prazo)
  _diagSessao(campo, t, ms) {
    const tipo = this._tipoResposta(t);
    this._marca(`cb:${campo === "sessao" ? "sessao-fim" : "sessao-tardia"}:${tipo}`);
    this._diagNota({ [campo]: tipo, [campo + "Ms"]: ms });
  },
  _diagPerfil(tipo, ms) {
    this._marca(`cb:perfil-fim:${tipo}`);
    this._diagNota({ perfil: tipo, perfilMs: ms });
  },
  // A 1ª carga de perfil DESTE boot que terminou (em 2º plano, depois do prazo): lida ou não.
  _diagPerfilCarga(r, ms) {
    if (!this._diag || this._diag.perfilCarga) return;
    this._diagNota({ perfilCarga: r && r.confirmado ? "lido" : "falhou", perfilCargaMs: ms });
  },
  _diagIrLogin(motivo) {
    this._marca(`cb:ir-login:${motivo}`);
    this._diagNota({ irLogin: motivo });
  },
  _diagMarcas() {
    const o = {};
    try {
      for (const m of performance.getEntriesByType("mark")) if (/^cb:/.test(m.name)) o[m.name] = Math.round(m.startTime);
    } catch (e) {}
    return o;
  },
  // Só o caminho do pedido, e só de *.supabase.co: /auth/v1/token, /rest/v1/profiles, /rest/v1/rpc/<nome>,
  // /functions/v1/<nome>; o resto (storage, que pode ter id no caminho) vira os 2 primeiros pedaços + "/…".
  _diagCaminho(url) {
    let p = "";
    try { p = new URL(url).pathname; } catch (e) { p = String(url || "").split(/[?#]/)[0]; }
    p = p.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id");
    const m = p.match(/^\/(?:auth|rest|functions)\/v1\/(?:rpc\/)?[A-Za-z0-9_-]+/);
    return m ? m[0] : p.split("/").slice(0, 3).join("/") + "/…";
  },
  _diagPedidos() {
    try {
      return performance.getEntriesByType("resource")
        .filter((e) => { try { return /\.supabase\.co$/i.test(new URL(e.name).hostname); } catch (x) { return false; } })
        .slice(0, 20)
        .map((e) => ({ caminho: this._diagCaminho(e.name), ms: Math.round(e.duration), proto: String(e.nextHopProtocol || ""), inicio: Math.round(e.startTime) }));
    } catch (e) { return []; }
  },
  _diagNomeTrava(n) { return String(n || "?").replace(/sb-[A-Za-z0-9]+-auth-token/g, "sb-auth-token").slice(0, 60); },
  // Retrato de navigator.locks (a trava de auth do SDK é compartilhada entre as abas): só nomes e contagens.
  _diagTravas() {
    try {
      if (typeof navigator === "undefined" || !navigator.locks || typeof navigator.locks.query !== "function") return Promise.resolve(null);
      return Promise.resolve(navigator.locks.query()).then((q) => {
        const contar = (lista) => {
          const o = {};
          for (const x of lista || []) { const n = this._diagNomeTrava(x && x.name); o[n] = (o[n] || 0) + 1; }
          return o;
        };
        let em = null;
        try { em = Math.round(performance.now()); } catch (e) {}
        const t = { em, emUso: contar(q && q.held), naFila: contar(q && q.pending) };
        this._diagNota({ travas: t });
        return t;
      }).catch(() => null);
    } catch (e) { return Promise.resolve(null); }
  },
  _diagSalvar() {
    const d = this._diag;
    if (!d) return;
    if (this._session) this._diagPersistir = true;   // a sessão apareceu: daqui em diante há o que diagnosticar
    if (!this._diagPersistir) return;                // visitante sem sessão em jogo: nada gravado no aparelho
    try {
      d.marcas = this._diagMarcas();
      d.pedidos = this._diagPedidos();
      let lista = [];
      try { lista = JSON.parse(localStorage.getItem(this._BOOT_LOG_KEY)) || []; } catch (e) { lista = []; }
      if (!Array.isArray(lista)) lista = [];
      lista = lista.filter((x) => x && typeof x === "object" && x.id !== d.id);
      lista.push(d);
      localStorage.setItem(this._BOOT_LOG_KEY, JSON.stringify(lista.slice(-this._BOOT_LOG_MAX)));
    } catch (e) {}
  },
  // Os últimos boots, em JSON, para o fundador colar (window.cbBootLog()). Pedir o diário é motivo para gravá-lo.
  bootLog() {
    this._diagPersistir = true;
    this._diagSalvar();
    try {
      const lista = JSON.parse(localStorage.getItem(this._BOOT_LOG_KEY));
      return JSON.stringify(Array.isArray(lista) ? lista : this._diag ? [this._diag] : []);
    } catch (e) { return JSON.stringify(this._diag ? [this._diag] : []); }
  },
  // Uma linha em português para o splash lento: em que etapa o boot está, há quanto tempo e o que se sabe da trava.
  resumoBoot() {
    const d = this._diag || {};
    const seg = (ms) => String(Math.round((ms || 0) / 100) / 10).replace(".", ",") + " s";
    let etapa;
    // Antes do boot (os scripts depois deste ainda chegando) o window.supa também não existe: isso é demora de
    // download, não falha do SDK (céticos, 19/set/2026). Só depois do boot "sem SDK" quer dizer que ele não carregou.
    // a50: sem o window.CB_CONFIG o js/config.js (no <head>, antes deste arquivo) não carregou — não é demora.
    if (!this.isSupa()) etapa = !this._supaIndisponivel() ? "modo local" : !window.CB_CONFIG ? "a configuração do app não carregou" : this._ready ? "o SDK de login não carregou" : "os arquivos do app ainda estão chegando";
    else if (d.cbinit === "espera") etapa = d.oauth ? "esperando a volta do Google virar sessão" : "esperando o SDK confirmar a sessão";
    else if (d.sessao === undefined) etapa = "esperando o SDK dizer se há sessão";
    else if (d.sessao === "estourou" && d.tardia === undefined) etapa = `o SDK não respondeu em ${seg(d.prazoMs)}; esperando`;
    else if ((d.sessao === "user" || d.tardia === "user") && d.perfil === undefined && d.perfilCarga === undefined) etapa = "esperando o perfil";
    else etapa = `sessão ${d.tardia || d.sessao}, tela ${d.abriu || "?"}`;
    const partes = [`Etapa: ${etapa}`];
    try { partes.push(`há ${seg(performance.now())}`); } catch (e) {}
    const t = d.travas;
    if (t) {
      const soma = (o) => Object.keys(o || {}).reduce((n, k) => n + o[k], 0);
      partes.push(`trava: ${soma(t.emUso)} em uso, ${soma(t.naFila)} na fila`);
    }
    if (d.oauth) partes.push(d.oauthErro ? "volta do Google com erro" : "volta do Google");
    if (d.guardada === "sim") partes.push(d.vencida ? "sessão guardada (token vencido)" : "sessão guardada");
    if (d.online === false) partes.push("sem internet");
    if (d.espera === "teto") partes.push("teto de espera atingido");
    return partes.join(" · ");
  },
  // Para o splash lento: tira o retrato da trava agora, grava e devolve { texto, json }.
  diagnosticoBoot() {
    this._diagPersistir = true;   // o splash lento pediu os Detalhes: é o boot a diagnosticar
    return this._diagTravas().then(() => {
      this._diagSalvar();
      return { texto: this.resumoBoot(), json: this.bootLog() };
    }, () => ({ texto: this.resumoBoot(), json: this.bootLog() }));
  },

  // ---------- Volta do Google RECUSADA (18/set/2026, piloto só por convite) ----------
  // Conta Google sem convite: com o cadastro fechado, o Supabase não cria o usuário e devolve o app.html com error= na
  // URL (?… ou #…, conforme o fluxo). O app.html mandava ao login (index.html#entrar) sem repassar nada, e a pessoa
  // voltava ao modal sem saber por quê. Agora o app.html chama guardarAvisoOAuth() antes do redirect e o login chama
  // consumirAvisoOAuth() ao abrir. O que atravessa a página é só um RÓTULO ("cadastro_fechado" | "falha") em
  // sessionStorage: nada da URL, nenhum dado pessoal e nunca a frase do servidor. A frase do cadastro fechado é a do
  // _msg (fonte única); o resto ganha uma frase genérica. Vale uma vez. Travado em tests/portas-convite.check.mjs.
  _AVISO_OAUTH_KEY: "cb-aviso-oauth",
  _AVISO_OAUTH_FALHA: "O login com o Google não foi concluído. Tente de novo ou entre com e-mail e senha.",
  _motivoOAuth(retorno) {
    let p;
    try { p = new URLSearchParams(String(retorno || "").replace(/[?#]/g, "&")); } catch (e) { return ""; }
    if (!p.has("error") && !p.has("error_code")) return "";
    const cod = String(p.get("error_code") || "").toLowerCase();
    const desc = String(p.get("error_description") || "").toLowerCase();
    if (cod === "signup_disabled" || desc.includes("signups not allowed")) return "cadastro_fechado";
    return "falha";
  },
  guardarAvisoOAuth(retorno) {
    const motivo = this._motivoOAuth(retorno);
    if (motivo) { try { sessionStorage.setItem(this._AVISO_OAUTH_KEY, motivo); } catch (e) { /* sem storage: sai sem aviso, como antes */ } }
    return motivo;
  },
  consumirAvisoOAuth() {
    let motivo = "";
    try { motivo = sessionStorage.getItem(this._AVISO_OAUTH_KEY) || ""; sessionStorage.removeItem(this._AVISO_OAUTH_KEY); } catch (e) { return ""; }
    if (motivo === "cadastro_fechado") return this._msg({ code: "signup_disabled" });
    if (motivo === "falha") return this._AVISO_OAUTH_FALHA;
    return "";   // valor que este código não grava (storage editado): nada na tela
  },

  _msg(error) {
    const m = ((error && error.message) || "").toLowerCase();
    if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
    if (m.includes("not confirmed") || m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar — verifique sua caixa de entrada (e o spam).";
    const cod = String((error && error.code) || "");
    if (m.includes("already registered") || m.includes("already exists") || m.includes("duplicate") || cod === "email_exists" || cod === "user_already_exists") return "Este e-mail já está cadastrado. Faça login.";
    if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas. Aguarde um momento e tente de novo.";
    // Cadastro fechado no Supabase (piloto só por convite, 18/set/2026): sem isto a aba "Criar conta" mostrava a
    // frase do servidor em inglês.
    if (cod === "signup_disabled" || m.includes("signups not allowed")) return "Os cadastros estão fechados no momento: o Civilbook está em piloto, só por convite. Se você recebeu um convite, use o link do e-mail.";
    if (cod === "email_provider_disabled") return "O acesso por e-mail está desligado no momento. Use Entrar com Google.";
    if ((error && error.name === "AuthSessionMissingError") || cod === "session_not_found") return "A sua sessão expirou. Saia e entre de novo para continuar.";
    const senha = this._msgSenha(error);
    if (senha) return senha;
    if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("network request") || m.includes("load failed")) return "Falha de conexão. Verifique sua internet e tente novamente.";
    return (error && error.message) || "Erro de autenticação.";
  },
  // Recusa de SENHA pelo servidor em texto de gente, ou "" quando o erro não é um destes. Só casa o que se sabe o
  // que é — o code ou a frase exata do Supabase Auth (conferidos no código-fonte dele, supabase/auth, em
  // 18/set/2026); o resto segue com a frase do servidor, porque traduzir errado é pior que não traduzir (a 1ª
  // versão casava qualquer "password" e dizia "use pelo menos 8" para uma senha de 80 caracteres).
  _msgSenha(error) {
    const m = ((error && error.message) || "").toLowerCase();
    const cod = String((error && error.code) || "");
    if (cod === "same_password" || m.includes("should be different from the old password")) return "A senha nova precisa ser diferente da senha atual.";
    if (m.includes("cannot be longer than")) return this._textoTeto();
    if (cod === "reauthentication_needed" || m.includes("requires reauthentication")) return "Por segurança, o servidor pediu que você entre de novo antes de trocar a senha. Saia, entre de novo (com a senha atual ou com o Google) e tente outra vez.";
    if (cod === "current_password_required" || cod === "current_password_invalid") return "O servidor passou a exigir a senha atual para trocar a senha, e esta tela ainda não a pede. Avise o suporte do Civilbook.";
    const fraca = cod === "weak_password" || (error && error.name === "AuthWeakPasswordError");
    if (fraca || m.includes("password should be at least") || m.includes("password should contain") || m.includes("known to be weak")) {
      const motivos = (error && Array.isArray(error.reasons)) ? error.reasons : [];
      // O servidor confere TUDO e manda os motivos juntos (tamanho, tipos e vazada): a tela diz todos de uma vez,
      // com o número e os tipos que vêm na frase dele — se o painel mudar antes do código, a tela não mente nem pede
      // o que ninguém exigiu.
      const vazada = motivos.includes("pwned") || m.includes("known to be weak");
      const exigencias = [];
      if (motivos.includes("length") || m.includes("password should be at least")) {
        const minServidor = Number((m.match(/at least (\d+) characters/) || [])[1]) || this.SENHA_MIN;
        exigencias.push(`ter pelo menos ${minServidor} caracteres`);
      }
      if (motivos.includes("characters") || m.includes("password should contain")) {
        const tipos = this._tiposExigidos((error && error.message) || "");
        exigencias.push(tipos ? `ter pelo menos um caractere de cada tipo: ${tipos}` : "ter todos os tipos de caractere que o servidor exige");
      }
      if (exigencias.length) return `A senha precisa ${exigencias.join(" e ")}.` + (vazada ? " Ela também aparece em listas de senhas vazadas na internet: escolha outra." : "");
      if (vazada) return "Esta senha aparece em listas de senhas vazadas na internet. Escolha outra.";
      return "Esta senha é fraca demais. Use uma senha mais longa, misturando letras, números e símbolos.";
    }
    return "";
  },

  // ============================================================
  // Fallback localStorage (modo sem backend)
  // ============================================================
  _localSession() { try { return JSON.parse(localStorage.getItem("cb-session")); } catch { return null; } },
  _localUsers() { try { return JSON.parse(localStorage.getItem("cb-users")) || []; } catch { return []; } },
  hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return "h" + (h >>> 0).toString(36);
  },
  _localRegister(nome, email, senha, plano) {
    const users = this._localUsers();
    if (users.some(u => u.email === email)) return { erro: "Este e-mail já está cadastrado. Faça login." };
    users.push({ nome: nome.trim(), email, senha: this.hash(senha), plano: plano || "gratuito", role: "user", criadoEm: Date.now() });
    localStorage.setItem("cb-users", JSON.stringify(users));
    return this._localLogin(email, senha);
  },
  _localLogin(email, senha) {
    const u = this._localUsers().find(u => u.email === email && u.senha === this.hash(senha));
    if (!u) return { erro: "E-mail ou senha incorretos." };
    this._session = { id: email, email: u.email, nome: u.nome, plano: u.plano, role: u.role || "user" };
    localStorage.setItem("cb-session", JSON.stringify(this._session));
    return { ok: true, sessao: this._session };
  },
  _localUpgrade(plano) {
    const sess = this._localSession();
    if (sess) { sess.plano = plano; localStorage.setItem("cb-session", JSON.stringify(sess)); }
    const users = this._localUsers().map(u => u.email === (sess && sess.email) ? { ...u, plano } : u);
    localStorage.setItem("cb-users", JSON.stringify(users));
  }
};

// Ver a nota em js/store.js: `const AUTH` não vira window.AUTH sozinho.
// window.cbBootLog(): o diário dos últimos boots (a47), em JSON, para o fundador colar no suporte. O de reserva que o
// <head> do app.html define (quais arquivos ainda não chegaram + os boots anteriores) segue valendo ATÉ o boot começar:
// antes disso o diário daqui não tem o boot atual (céticos, 19/set/2026 — o Copiar detalhes perdia a lista do que falta).
if (typeof window !== "undefined") {
  window.AUTH = AUTH;
  const reservaBootLog = typeof window.cbBootLog === "function" ? window.cbBootLog : null;
  window.cbBootLog = function () { return !AUTH._ready && !AUTH._diag && reservaBootLog ? reservaBootLog() : AUTH.bootLog(); };
}
