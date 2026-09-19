// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// e6 — Biblioteca: acervo central de referências (normas/livros/manuais/artigos) com PDF em
// Storage PRIVADO (bucket 'biblioteca', migration 0017). Referências cruzadas (N:N) e o link
// para abrir o PDF no ponto exato (visualizador PDF.js — js/pdfviewer.js). Requer backend +
// papel do corpo técnico p/ escrever; leitura por autenticados. Espelha o padrão do CONT (d5).
const BIBLIO = {
  TIPOS: ["norma", "livro", "manual", "artigo", "outro"],
  ALVOS: ["norma", "conteudo", "laudo", "referencia"],
  BUCKET: "biblioteca",

  _supaOk() { return !!(typeof window !== "undefined" && window.supa && typeof AUTH !== "undefined" && AUTH.session()); },
  papel() { try { var s = AUTH.session(); return s ? (s.role || "user") : "user"; } catch (e) { return "user"; } },
  ehCorpoTecnico() { return ["autor", "editor", "admin"].indexOf(this.papel()) >= 0; },

  _slugArquivo(nome) {
    return String(nome || "arquivo.pdf").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(-80) || "arquivo.pdf";
  },

  // ---- Leitura ----
  async listar(q) {
    if (!this._supaOk()) return [];
    let query = window.supa.from("biblioteca_referencias")
      .select("id,titulo,autores,orgao,ano,tipo,arquivo_path,fonte_url,paginas")
      .order("created_at", { ascending: false }).limit(200);
    const termo = (q || "").trim();
    if (termo) query = query.or(`titulo.ilike.%${termo}%,autores.ilike.%${termo}%,orgao.ilike.%${termo}%`);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },
  async ref(id) {
    const { data, error } = await window.supa.from("biblioteca_referencias").select("*").eq("id", id).single();
    if (error) throw error;
    return data;
  },

  // ---- Escrita (corpo técnico) ----
  async criar(meta) {
    const row = {
      titulo: meta.titulo, autores: meta.autores || null, orgao: meta.orgao || null,
      ano: meta.ano || null, tipo: meta.tipo || "outro", fonte_url: meta.fonte_url || null,
      criado_por: AUTH.session().id
    };
    const { data, error } = await window.supa.from("biblioteca_referencias").insert(row).select().single();
    if (error) throw error;
    return data;
  },
  // Envia o PDF para o bucket privado e grava o caminho na referência.
  async enviarArquivo(refId, file) {
    const path = refId + "/" + this._slugArquivo(file.name);
    const up = await window.supa.storage.from(this.BUCKET).upload(path, file, { upsert: true, contentType: file.type || "application/pdf" });
    if (up.error) throw up.error;
    const { error } = await window.supa.from("biblioteca_referencias").update({ arquivo_path: path }).eq("id", refId);
    if (error) throw error;
    return path;
  },
  async atualizar(id, meta) {
    const { error } = await window.supa.from("biblioteca_referencias").update({
      titulo: meta.titulo, autores: meta.autores || null, orgao: meta.orgao || null,
      ano: meta.ano || null, tipo: meta.tipo || "outro", fonte_url: meta.fonte_url || null
    }).eq("id", id);
    if (error) throw error;
  },
  async remover(id, arquivoPath) {
    if (arquivoPath) { try { await window.supa.storage.from(this.BUCKET).remove([arquivoPath]); } catch (e) { /* segue */ } }
    const { error } = await window.supa.from("biblioteca_referencias").delete().eq("id", id);
    if (error) throw error;
  },

  // URL assinada (bucket privado) p/ abrir o PDF. Validade curta (1 h).
  async urlAssinada(path, segundos) {
    const { data, error } = await window.supa.storage.from(this.BUCKET).createSignedUrl(path, segundos || 3600);
    if (error) throw error;
    return data.signedUrl;
  },

  // ---- Referências cruzadas (N:N) ----
  async links(refId) {
    const { data, error } = await window.supa.from("biblioteca_links")
      .select("id,alvo_tipo,alvo_id,rotulo").eq("referencia_id", refId).order("created_at");
    if (error) throw error;
    return data || [];
  },
  async vincular(refId, alvoTipo, alvoId, rotulo) {
    const { error } = await window.supa.from("biblioteca_links").insert({
      referencia_id: refId, alvo_tipo: alvoTipo, alvo_id: String(alvoId), rotulo: rotulo || null
    });
    if (error) throw error;
  },
  async desvincular(linkId) {
    const { error } = await window.supa.from("biblioteca_links").delete().eq("id", linkId);
    if (error) throw error;
  }
};
if (typeof window !== "undefined") window.BIBLIO = BIBLIO;
