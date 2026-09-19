// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Autenticação do Civilbook.
// Backend real: Supabase Auth (quando CB_CONFIG.SUPA_READY). Caso contrário,
// fallback em localStorage (modo local, para desenvolvimento/preview).
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
const AUTH = {
  // { id, email, nome, plano (EFETIVO), planoBruto, planoAte, testeUsadoEm, role, preferencias?,
  //   perfilConfirmadoEm, naoConfirmada? } | null — no modo local: { id, email, nome, plano, role }
  _session: null,
  _ready: false,

  _PERFIL_KEY: "cb-perfil",
  _PERFIL_TTL_MS: 10 * 60 * 1000,        // evento de auth só vai à rede se o perfil confirmado passou disto
  _PRAZO_SESSAO_MS: 3000,                // getSession() no boot: depois disto o boot segue sem esperar o SDK
  _PRAZO_SESSAO_MAX_MS: 30000,           // sessaoPendente(): teto da espera pelo SDK (o orçamento de re-tentativa dele)
  _PRAZO_PERFIL_MS: 4000,                // 1º acesso no aparelho (sem cache): espera do perfil no boot
  _PRAZO_CONSULTA_MS: 15000,             // cada consulta a profiles: depois disto conta como falha (mantém)
  _RETENTATIVAS_MS: [3000, 10000, 30000],
  _ESPERA_REVOGADA_MS: 6000,             // getUser() (sessão revogada) só depois de o app carregar — ver _verificarRevogadaDepois
  // Senha: SENHA_MIN = Supabase → Authentication → Sign In / Providers → Email → Minimum password length (8, visto
  // em 18/set/2026); SENHA_MAX_BYTES = o teto do servidor (bcrypt: "Password cannot be longer than 72 characters",
  // contado em bytes). O cadastro (js/auth-modal.js) e Minha conta (js/conta.js) conferem por validarSenhaNova; a
  // acesso.html/js/acesso.js repete os números. tests/acesso.check.mjs trava as 3 telas rodando (e o index.html
  // pela forma), com mutantes embutidos.
  SENHA_MIN: 8,
  SENHA_MAX_BYTES: 72,
  _tRevogada: null,
  _perfilGen: 0,      // geração de cada carga de perfil…
  _genBase: 0,        // …e a geração da última LEITURA BOA aplicada (perfil base / preferências):
  _genPref: 0,        //    carga mais velha não sobrescreve leitura mais nova; falha não sobrescreve nada
  _uidAtual: null,    // de quem é a carga mais recente (null = saiu): resposta de outro usuário é descartada
  _emVoo: null,       // { uid, p } — revalidação em curso, dividida por quem pedir o mesmo usuário
  _pendente: null,    // promessa viva enquanto o SDK não disse se há sessão (boot sem cache que estourou o prazo)
  _saindo: false,     // logout() em curso: o SIGNED_OUT que ele provoca não redireciona de novo
  _saidas: 0,         // quantas vezes _encerrar() rodou: o boot compara antes/depois do await (SIGNED_OUT no meio)
  _ouvindo: false,
  _tentativa: 0,
  _tRetry: null,
  _tSessao: null,     // nova pergunta ao SDK enquanto a sessão está aberta só com o cache (_reconferirSessao)
  _testeUsadoUid: null,   // a RPC respondeu "ja_usado" para este uid (memória da página; ver testeGratis)

  _PLANOS_COM_PRAZO: ["pro-teste", "pro-cortesia"],
  _TESTE_DIAS: 7,         // duração do teste grátis — a RPC é quem manda; aqui só para dizer quando terminou
  _COLS_PERFIL: "nome,plano,role,empresa",
  _COLS_PLANO_0098: "plano_ate,teste_usado_em",   // colunas da 0098: pedidas junto; se o banco ainda não as tem, o perfil é relido sem elas

  isSupa() { return !!(window.CB_CONFIG && window.CB_CONFIG.SUPA_READY && window.supa); },
  // Supabase configurado mas SDK não carregou (falha de CDN/rede): NÃO cair em modo
  // local — senão um usuário com conta real receberia "senha incorreta" enganosamente.
  _supaIndisponivel() { return !!(window.CB_CONFIG && window.CB_CONFIG.SUPA_READY) && !window.supa; },

  // ---------- Boot: resolve a sessão atual ----------
  // Modo local: igual a sempre. Supabase: NADA de rede no caminho do 1º desenho quando há cache.
  async boot() {
    if (!this.isSupa()) {
      this._session = this._localSession();
      this._ready = true;
      return this._session;
    }
    try {
      this._ouvirAuth();   // ANTES de qualquer await: evento emitido durante o boot não se perde
      const saidas0 = this._saidas;
      const pSess = this._sessaoSdk();
      let r = await this._comPrazo(pSess, this._PRAZO_SESSAO_MS);
      // SIGNED_OUT que chegou DURANTE a espera (refresh token recusado dentro do getSession: o SDK apaga
      // a sessão, emite SIGNED_OUT e devolve { session: null, error }): _encerrar() já rodou, SEM sessão
      // montada — logo, sem redirect. Abrir a tela com o cache agora seria o app zumbi por outra porta:
      // badge PRO e link Admin sem sessão no SDK, e ninguém levando ao login. Vale como "não há sessão".
      if (!r.user && this._saidas !== saidas0) r = { user: null };
      // O cache é lido DEPOIS do await, pelo mesmo motivo: vale o que sobrou, não o que havia antes.
      const cache = r.user || r.user === null ? null : this._cacheOtimista();
      if (r.user) await this._entrarCom(r.user);
      else if (r.user === null) { this._session = null; this._cacheLimpar(); }   // o SDK respondeu: não há sessão
      else if (cache) {
        // Prazo estourou (refresh de token lento) ou o SDK não soube dizer (refresh falhou por rede).
        // NÃO é "deslogado" e ninguém é deslogado: abre com o cache, marcado como não confirmado; a
        // resposta do SDK (tardia, por evento de auth ou perguntando de novo) confirma ou encerra.
        this._session = this._sessaoDe({ id: cache.uid, email: "" }, cache);
        this._session.naoConfirmada = true;
        if (r.estourou) pSess.then((t) => this._sessaoTardia(t));
        else this._reconferirSessao(0);
      } else {
        // Sem cache não há tela otimista: segue SEM sessão confirmada e sem deslogar ninguém. A
        // resposta do SDK continua sendo esperada em sessaoPendente() — a landing abre já como
        // visitante; o app (que exige sessão) segura o splash em vez de mandar para o login.
        this._session = null;
        if (r.estourou) {
          const p = this._comPrazo(pSess, this._PRAZO_SESSAO_MAX_MS)
            .then((t) => {
              if (t && t.user) return this._entrarCom(t.user);
              if (t && t.user === null) this._cacheLimpar();   // não havia sessão: cache que sobrou é órfão
              return null;
            })
            .catch((e) => console.error("auth.boot (sessão tardia):", e))
            .then(() => { if (this._pendente === p) this._pendente = null; });
          this._pendente = p;
        }
      }
    } catch (e) { console.error("auth.boot:", e); }
    this._ready = true;
    return this._session;
  },

  // Boot sem cache cujo prazo de sessão estourou: promessa que resolve quando o SDK responder (ou null
  // se não há nada pendente). Página que EXIGE sessão espera por ela em vez de mandar para o login.
  sessaoPendente() { return this._pendente; },

  _comPrazo(promessa, ms) {
    let t;
    const prazo = new Promise((ok) => { t = setTimeout(() => ok({ estourou: true }), ms); });
    return Promise.race([promessa, prazo]).finally(() => clearTimeout(t));
  },

  // getSession() lê do storage; só vai à rede se o token venceu (refresh). Nunca rejeita.
  // { user } = há sessão · { user: null } = não há · { indefinida } = o SDK não soube (erro de rede).
  async _sessaoSdk() {
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
    const cache = this._cacheLer(user.id);
    if (cache) {
      this._session = this._sessaoDe(user, cache);
      this._revalidarFundo(user);
      return;
    }
    // 1º acesso neste aparelho: não há o que mostrar de otimista — espera o perfil, mas com prazo.
    // Estourou → entra com o que tem; a carga segue no ar e, quando chegar, atualiza a tela.
    await this._comPrazo(this._revalidar(user, true), this._PRAZO_PERFIL_MS);
    if (!this._session || this._session.id !== user.id) this._session = this._sessaoDe(user, null);
    this._verificarRevogadaDepois();
  },

  _revalidarFundo(user) {
    this._revalidar(user, true).catch(() => {});
    this._verificarRevogadaDepois();
  },

  // A conferência de sessão revogada ESPERA o app carregar: getUser() segura a trava de auth do SDK
  // enquanto vai à rede, e toda requisição (supa.from, functions) passa por essa trava para pegar o
  // token. Medido em 17/set/2026: com o getUser logo depois do boot, as primeiras consultas do app só
  // saíam quando ele voltava (+260 ms no desktop; no celular, o RTT inteiro).
  _verificarRevogadaDepois() {
    clearTimeout(this._tRevogada);
    this._tRevogada = setTimeout(() => { this._verificarRevogada(); }, this._ESPERA_REVOGADA_MS);
  },

  // O SDK respondeu DEPOIS do prazo do boot (a tela já abriu com o cache).
  _sessaoTardia(t) {
    if (t && t.user) this._revalidarFundo(t.user);
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
  async _verificarRevogada() {
    if (!this._session) return;   // saiu enquanto a conferência esperava a vez
    try {
      const { error } = await window.supa.auth.getUser();
      if (!this._sessaoMorta(error)) return;
      try { await window.supa.auth.signOut({ scope: "local" }); } catch (e) {}
      this._encerrar();   // idempotente: se o SIGNED_OUT do signOut já passou por aqui, não redireciona 2x
    } catch (e) {}
  },
  _sessaoMorta(error) {
    if (!error) return false;
    const c = String(error.code || ""), m = String(error.message || "").toLowerCase();
    if (c === "session_not_found" || c === "user_not_found" || c === "user_banned") return true;
    return (error.status === 401 || error.status === 403 || error.status === 404) &&
      (/session .*(not found|does not exist)/.test(m) || /user .*(not found|does not exist)/.test(m));
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
    if (evt === "SIGNED_OUT") { this._encerrar(); return; }
    if (!(sess && sess.user)) return;   // INITIAL_SESSION sem sessão não é "saiu": quem decide é o boot
    // SIGNED_IN chega a cada volta do PWA ao primeiro plano; TOKEN_REFRESHED, de hora em hora. Só vai
    // à rede se o usuário mudou ou o perfil confirmado envelheceu — e, indo, espera e SÓ DEPOIS mexe
    // na tela (_revalidar atualiza o menu no fim da carga).
    const r = await this._revalidar(sess.user, false);
    if (r && r.pulou && this._confirmarSessao(sess.user)) this._atualizarTela(null);
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
    this._saidas++;          // o boot confere: saída no meio do getSession dele não abre tela com o cache
    this._session = null;
    this._uidAtual = null;   // carga de perfil ainda no ar morre ao chegar
    this._emVoo = null;
    this._testeUsadoUid = null;
    clearTimeout(this._tRetry); clearTimeout(this._tRevogada); clearTimeout(this._tSessao); this._tentativa = 0;
    this._cacheLimpar();
    if (tinha && !this._saindo) this._irParaLogin();
  },
  _irParaLogin() {
    try {
      const l = window.location;
      if (/[?&]share=/.test(l.search || "")) return;                  // leitura pública por link não exige login
      if (/(^|\/)(index\.html)?$/.test(l.pathname || "")) return;     // já está na landing
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
  // uid da sessão que o SDK guarda no storage dele (supabase-js 2.x: a sessão inteira em JSON sob
  // auth.storageKey). Leitura LOCAL, sem rede e sem a trava de auth; só o id sai daqui — o token não é
  // lido, copiado nem guardado. string = uid · null = o SDK não tem sessão guardada · undefined = não sei.
  _uidDoSdk() {
    try {
      const k = window.supa.auth.storageKey;
      if (typeof k !== "string" || !k) return undefined;
      const bruto = localStorage.getItem(k);
      if (bruto == null) return null;
      const v = JSON.parse(bruto);
      const id = v && v.user && v.user.id;
      return typeof id === "string" && id ? id : undefined;
    } catch (e) { return undefined; }
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
      return { ok: false, erro: (r && r.error) || null };
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
    const p = this._loadProfile(user).then(
      (r) => { this._fimDaCarga(p); if (r && !r.descartada) this._atualizarTela(r); return r; },
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
    try { if (typeof renderUserMenu === "function") renderUserMenu(); } catch (e) {}
    if (r && r.mudou && typeof window.cbPerfilMudou === "function") {
      try { window.cbPerfilMudou(this._session); } catch (e) { console.error("cbPerfilMudou:", e); }
    }
  },

  async _loadProfile(user) {
    const uid = user.id, gen = ++this._perfilGen;
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
    if (!this.isSupa()) return { erro: "Login com Google requer o backend configurado." };
    const redirectTo = new URL("app.html", window.location.href).href;
    const { error } = await window.supa.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    return error ? { erro: this._msg(error) } : { ok: true };
  },

  // ---------- Senha nova (cadastro e Minha conta) ----------
  // Confere ANTES da rede, com os números do servidor: "" = pode enviar; senão, o texto da tela. `confirma` é
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
  validarSenhaNova(senha, confirma) {
    const s = String(senha || "");
    if (s.length < this.SENHA_MIN) return `A senha precisa ter pelo menos ${this.SENHA_MIN} caracteres.`;
    if (this._bytes(s) > this.SENHA_MAX_BYTES) return this._textoTeto();
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
        await this._comPrazo(this._revalidar(user, true), this._PRAZO_PERFIL_MS);
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

  exigirLogin() { if (this._ready && !this._session) window.location.href = "index.html#entrar"; },

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
if (typeof window !== "undefined") window.AUTH = AUTH;
