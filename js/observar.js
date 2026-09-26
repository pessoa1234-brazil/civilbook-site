// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).

// OBSERVAR — observabilidade de front. A auditoria de 07/ago/2026 apontou que NADA capturava erro de
// JavaScript: uma exceção não tratada quebrava a tela em silêncio, e o admin só descobria pelo
// relato do usuário. Este módulo fecha isso.
//
// PRIVACIDADE POR DESENHO (o mesmo padrão que a auditoria elogiou em ia_uso/ia_temas_seq): o beacon
// NÃO carrega a MENSAGEM do erro nem o STACK nem a URL — só o NOME da classe do erro (TypeError…), o
// módulo onde ocorreu e a linha:coluna. Mensagem de erro pode conter dado do usuário (um nome num
// template que quebrou); stack pode conter caminho. Guardamos o mínimo que serve para diagnosticar
// "onde e que tipo", nunca "o quê". Reusa usage_events (0001) — RLS insere-só-o-seu, admin agrega.
const OBSERVAR = {
  _K: "cb-obs-erros",          // ring buffer local (só nesta aba; ajuda o suporte a ver "ao vivo")
  _MAX: 30,                    // teto do buffer
  _ultimos: {},                // dedup: assinatura -> timestamp (não repetir o mesmo erro em rajada)
  _JANELA: 60000,              // 1 min: o mesmo erro só loga 1x por minuto (anti-flood de beacon)
  _ligado: false,

  iniciar() {
    if (this._ligado || typeof window === "undefined") return;
    this._ligado = true;
    window.addEventListener("error", (e) => {
      // Erro de recurso (img/script 404) tem e.error null e target != window — ignora, é ruído.
      if (!e || (e.target && e.target !== window && !e.error)) return;
      this._registrar(e.error || e.message, e.filename, e.lineno, e.colno);
    });
    window.addEventListener("unhandledrejection", (e) => {
      const r = e && e.reason;
      this._registrar(r, null, null, null, true);
    });
  },

  // Extrai SÓ metadados seguros. Nunca persiste a mensagem.
  _registrar(err, filename, lineno, colno, promessa) {
    try {
      const nome = (err && err.name) ? String(err.name)
                 : (err instanceof Error ? err.constructor.name : "Error");
      // módulo atual da SPA (rota) — sem query string, sem PII.
      const modulo = (typeof currentModule !== "undefined" && currentModule)
        ? currentModule
        : ((location.hash || "").replace(/^#/, "").split("/")[0] || "app");
      const local = (filename ? String(filename).split("/").pop() : "") + (lineno ? `:${lineno}${colno ? ":" + colno : ""}` : "");
      const assinatura = `${nome}|${modulo}|${local}`;

      // Dedup por janela — não floodar o banco nem o buffer com o mesmo erro repetido.
      const agora = Date.now();
      if (this._ultimos[assinatura] && agora - this._ultimos[assinatura] < this._JANELA) return;
      this._ultimos[assinatura] = agora;

      // (1) buffer local para o suporte ver na sessão (não sai da máquina por si só).
      this._push({ nome, modulo, local, promessa: !!promessa, em: new Date().toISOString() });

      // (2) beacon MÍNIMO ao servidor — nome + módulo + linha, jamais a mensagem/stack.
      if (typeof METRICS !== "undefined" && METRICS.event) {
        METRICS.event("js_error", modulo, local || null, { erro: nome, promessa: !!promessa });
      }

      // (3) sinal discreto ao usuário só em erro DURO (não em rejeição de promessa best-effort).
      if (!promessa && typeof toast === "function") {
        toast("Algo não carregou como esperado nesta tela. Se persistir, recarregue a página.", "info");
      }
    } catch (e) { /* observabilidade nunca pode virar a causa de um erro */ }
  },

  _push(item) {
    try {
      const buf = this.buffer();
      buf.unshift(item);
      sessionStorage.setItem(this._K, JSON.stringify(buf.slice(0, this._MAX)));
    } catch (e) {}
  },
  buffer() {
    try { return JSON.parse(sessionStorage.getItem(this._K) || "[]"); } catch (e) { return []; }
  },
};
if (typeof window !== "undefined") window.OBSERVAR = OBSERVAR;
