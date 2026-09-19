// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// e7 — Roadmap público de novidades (curadoria OPT-IN). A HOME lê a view v_roadmap_publico
// (migration 0019), que expõe SOMENTE itens publicados e SOMENTE os campos de divulgação
// (titulo/descricao/status) — sem vazar nada técnico. A curadoria fica no admin (junto ao PLANO):
// o admin liga "publicado" e escreve o texto amigável. Allow-list de fases (defesa em profundidade).
const ROADMAP = {
  STATUS: { em_breve: ["Em breve", "pill-gray"], em_desenvolvimento: ["Em desenvolvimento", "pill-amber"], lancado: ["Lançado", "pill-teal"] },
  _ORD: { lancado: 0, em_desenvolvimento: 1, em_breve: 2 },
  ELIGIVEL_FASES: ["C", "E"],   // só fases voltadas ao cliente (Crescimento, Novos módulos). A/B/D ficam fora.

  _supaOk() { return !!(typeof window !== "undefined" && window.supa); },
  _esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); },
  elegivel(faseId) { return this.ELIGIVEL_FASES.indexOf(String(faseId || "").toUpperCase()) >= 0; },

  // ---- Público (home): lê a VIEW (só publicados, só campos de divulgação) ----
  async publicados() {
    if (!this._supaOk()) return [];
    const { data, error } = await window.supa.from("v_roadmap_publico").select("titulo,descricao,status,ordem").limit(50);
    if (error) return [];   // view ausente (0019 não aplicada) → roadmap simplesmente não aparece
    const self = this;
    return (data || []).slice().sort((a, b) => (self._ORD[a.status] - self._ORD[b.status]) || (a.ordem - b.ordem));
  },

  // ---- Admin ----
  async listarAdmin() {
    const { data, error } = await window.supa.from("roadmap_publico").select("*").order("ordem").order("created_at");
    if (error) throw error;
    return data || [];
  },
  async porTarefa(tarefaId) {
    const { data } = await window.supa.from("roadmap_publico").select("*").eq("tarefa_id", tarefaId).maybeSingle();
    return data || null;
  },
  async salvar(item) {
    // defesa em profundidade: além da allow-list na UI, recusa aqui itens ligados a fase não elegível.
    if (item.tarefa_id && !this.elegivel(String(item.tarefa_id)[0])) throw new Error("Fase não elegível para divulgação pública.");
    const row = {
      tarefa_id: item.tarefa_id || null, titulo: item.titulo, descricao: item.descricao || null,
      status: item.status || "em_breve", publicado: !!item.publicado, ordem: item.ordem || 0
    };
    if (item.id) {
      const { error } = await window.supa.from("roadmap_publico").update(row).eq("id", item.id);
      if (error) throw error;
    } else if (row.tarefa_id) {
      // Sem id, mas com tarefa_id: pode já haver um item para essa tarefa. O índice único é
      // PARCIAL (where tarefa_id is not null) e NÃO casa com ON CONFLICT — então resolvemos no
      // cliente (atualiza se existir, senão insere) em vez de usar upsert.
      const existente = await this.porTarefa(row.tarefa_id);
      if (existente) {
        const { error } = await window.supa.from("roadmap_publico").update(row).eq("id", existente.id);
        if (error) throw error;
      } else {
        const { error } = await window.supa.from("roadmap_publico").insert(row);
        if (error) throw error;
      }
    } else {
      const { error } = await window.supa.from("roadmap_publico").insert(row);
      if (error) throw error;
    }
  },
  async toggle(id, val) { const { error } = await window.supa.from("roadmap_publico").update({ publicado: !!val }).eq("id", id); if (error) throw error; },
  async remover(id) { const { error } = await window.supa.from("roadmap_publico").delete().eq("id", id); if (error) throw error; },

  // ---- Render na home (app/anon). No-op se vazio ou sem backend ----
  render(containerId) {
    const el = typeof containerId === "string" ? document.getElementById(containerId) : containerId;
    if (!el) return;
    const self = this;
    this.publicados().then(items => {
      if (!items.length) { el.innerHTML = ""; return; }
      el.innerHTML = `<div class="cb-roadmap-card">
        <div class="cb-roadmap-head"><i class="ti ti-rocket" aria-hidden="true"></i><span>Novidades e próximos passos</span></div>
        <div class="cb-roadmap-list">${items.map(it => {
          const st = self.STATUS[it.status] || [it.status, "pill-gray"];
          return `<div class="cb-roadmap-item">
            <span class="pill ${st[1]} cb-roadmap-st">${self._esc(st[0])}</span>
            <div class="cb-roadmap-txt"><strong>${self._esc(it.titulo)}</strong>${it.descricao ? `<span>${self._esc(it.descricao)}</span>` : ""}</div>
          </div>`;
        }).join("")}</div>
      </div>`;
    }).catch(() => { el.innerHTML = ""; });
  }
};
if (typeof window !== "undefined") window.ROADMAP = ROADMAP;
