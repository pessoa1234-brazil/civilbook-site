// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Coleta de métricas de uso (padrões de uso + tempo de uso).
// Grava em usage_sessions (sessão = início → último heartbeat) e usage_events.
// No-op quando o Supabase não está configurado ou não há usuário logado.
const METRICS = {
  _sid: null,
  _hb: null,

  _ativo() { return typeof AUTH !== "undefined" && AUTH.isSupa() && AUTH.session(); },

  async start() {
    if (!this._ativo() || this._sid) return;
    try {
      const { data, error } = await window.supa
        .from("usage_sessions")
        .insert({ user_id: AUTH.session().id, user_agent: navigator.userAgent })
        .select("id").single();
      if (error) throw error;
      this._sid = data.id;
      this.event("session_start", "app");

      // Heartbeat: mantém last_seen_at atualizado (base do tempo de uso).
      this._hb = setInterval(() => this._beat(), 45000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") this._beat();
        else this._beat();
      });
      window.addEventListener("pagehide", () => this._end());
    } catch (e) {
      console.warn("metrics.start:", e && e.message);
    }
  },

  async _beat() {
    if (!this._sid || !this._ativo()) return;
    try {
      await window.supa.from("usage_sessions")
        .update({ last_seen_at: new Date().toISOString() }).eq("id", this._sid);
    } catch (e) { /* silencioso */ }
  },

  _end() {
    if (!this._sid || !this._ativo()) return;
    const now = new Date().toISOString();
    // best-effort no fechamento da aba
    try {
      window.supa.from("usage_sessions")
        .update({ last_seen_at: now, ended_at: now }).eq("id", this._sid);
    } catch (e) {}
  },

  // Registra um evento de uso. Falhas nunca quebram a navegação.
  event(event_type, module, ref, metadata) {
    if (!this._ativo()) return;
    try {
      window.supa.from("usage_events").insert({
        user_id: AUTH.session().id,
        session_id: this._sid,
        event_type,
        module: module || null,
        ref: ref || null,
        metadata: metadata || null
      }).then(() => {}, () => {});
    } catch (e) { /* silencioso */ }
  }
};
