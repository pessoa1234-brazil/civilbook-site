// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// e19 — Repositório documental: documentos jurídicos/institucionais (Termos, Privacidade, Cookies,
// LICENSE/PI, SLA) com VERSÃO + VIGÊNCIA + hash + changelog. Gestão RLS admin-only (migration 0021);
// páginas públicas leem a VERSÃO VIGENTE pela view anon v_repo_vigente (fonte única da verdade).
// Aceite (prova jurídica): registra qual usuário aceitou qual versão (integra d9/cadastro).
const REPO = {
  TIPOS: { termos_uso: "Termos de Uso", privacidade: "Política de Privacidade", cookies: "Política de Cookies", aviso_legal: "Aviso legal", licenca_pi: "Licença / PI", sla: "Contrato de SLA", outro: "Outro" },
  STATUS: { rascunho: ["Rascunho", "pill-gray"], em_revisao: ["Em revisão", "pill-amber"], vigente: ["Vigente", "pill-teal"], arquivado: ["Arquivado", "pill-gray"] },

  _supaOk() { return !!(typeof window !== "undefined" && window.supa); },
  _esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); },
  corpoHTML(txt) { return String(txt || "").split(/\n{2,}/).map(p => `<p>${this._esc(p).replace(/\n/g, "<br>")}</p>`).join("") || "<p>—</p>"; },

  async hash(texto) {
    try {
      if (!window.crypto || !crypto.subtle) return null;
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto || ""));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    } catch (e) { return null; }
  },

  // ---- Público: versão VIGENTE de um documento público (view anon) ----
  async vigente(chave) {
    if (!this._supaOk()) return null;
    try {
      const { data, error } = await window.supa.from("v_repo_vigente").select("*").eq("chave", chave).maybeSingle();
      if (error) return null;
      return data || null;
    } catch (e) { return null; }
  },
  // Renderiza a versão vigente num container (páginas públicas). Mantém o fallback estático se não houver.
  async renderPublico(chave, containerId) {
    const el = typeof containerId === "string" ? document.getElementById(containerId) : containerId;
    if (!el) return;
    const v = await this.vigente(chave);
    if (!v || !v.conteudo) return;   // sem versão publicada → mantém o conteúdo estático do HTML
    const dt = v.vigencia_inicio ? new Date(v.vigencia_inicio + "T00:00:00").toLocaleDateString("pt-BR") : "";
    el.innerHTML = `<p class="page-sub" style="margin:-6px 0 16px"><i class="ti ti-file-certificate" aria-hidden="true"></i> Versão ${this._esc(v.versao)}${dt ? " · vigente desde " + dt : ""}</p>` + this.corpoHTML(v.conteudo);
  },

  // ---- Admin ----
  async documentos() {
    const { data, error } = await window.supa.from("repo_documentos").select("*").order("created_at"); if (error) throw error; return data || [];
  },
  async criarDocumento(d) {
    const { data, error } = await window.supa.from("repo_documentos").insert({ chave: d.chave, titulo: d.titulo, tipo: d.tipo || "outro", publico: !!d.publico, requer_aceite: !!d.requer_aceite }).select().single();
    if (error) throw error; return data;
  },
  async versoes(documentoId) {
    const { data, error } = await window.supa.from("repo_versoes").select("*").eq("documento_id", documentoId).order("created_at", { ascending: false }); if (error) throw error; return data || [];
  },
  async criarVersao(v) {
    const hash = await this.hash(v.conteudo || "");
    const { error } = await window.supa.from("repo_versoes").insert({ documento_id: v.documento_id, versao: v.versao, conteudo: v.conteudo || null, changelog: v.changelog || null, status: "rascunho", hash, autor_id: (typeof AUTH !== "undefined" && AUTH.session() || {}).id });
    if (error) throw error;
  },
  async mudarStatus(versaoId, status) {
    const patch = { status };
    if (status === "vigente") patch.vigencia_inicio = new Date().toISOString().slice(0, 10);
    const { error } = await window.supa.from("repo_versoes").update(patch).eq("id", versaoId); if (error) throw error;
  },
  // Publicar: arquiva a vigente atual (respeita o índice único) e marca esta como vigente.
  async publicar(documentoId, versaoId) {
    await window.supa.from("repo_versoes").update({ status: "arquivado" }).eq("documento_id", documentoId).eq("status", "vigente");
    await this.mudarStatus(versaoId, "vigente");
  },
  async aceitesContagem(versaoId) {
    const { count } = await window.supa.from("repo_aceites").select("id", { count: "exact", head: true }).eq("versao_id", versaoId);
    return count || 0;
  },

  // ---- Aceite (prova jurídica): registra o aceite da versão VIGENTE pelo usuário logado ----
  // UPSERT com ignoreDuplicates, e não insert: o cbInit chama isto a CADA carga do app, então a
  // partir da segunda vez o insert batia no unique (user_id, versao_id) e voltava 409. O erro era
  // engolido pelo catch — funcionalmente inofensivo, mas eram duas requisições condenadas por sessão
  // e dois erros vermelhos no console mascarando os de verdade. Ficou invisível enquanto o
  // repositório estava vazio (sem versão vigente, nem chegava a inserir); apareceu em 07/ago/2026,
  // ao preencher os documentos. Com `resolution=ignore-duplicates` o servidor devolve 200 e o
  // primeiro aceite — o que tem valor jurídico — continua sendo o gravado.
  async registrarAceite(chave) {
    if (!this._supaOk() || !(typeof AUTH !== "undefined" && AUTH.session && AUTH.session())) return;
    try {
      const v = await this.vigente(chave);
      if (!v || !v.versao_id || !v.requer_aceite) return;
      await window.supa.from("repo_aceites").upsert(
        { user_id: AUTH.session().id, documento_chave: chave, versao_id: v.versao_id, versao: v.versao },
        { onConflict: "user_id,versao_id", ignoreDuplicates: true },
      );
    } catch (e) { /* aceite é trilha auxiliar: nunca pode atrapalhar o boot do app */ }
  }
};
if (typeof window !== "undefined") window.REPO = REPO;
