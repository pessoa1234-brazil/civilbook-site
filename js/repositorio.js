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
  // e32 (19/set/2026): o conteúdo do banco é TEXTO PURO (o _esc mostra qualquer tag como está, e endereço não vira
  // link: a vigente com conteúdo perde os links da página estática, inclusive o da Google API Services User Data
  // Policy). Os marcadores <!--email_off--> e <!--/email_off--> do Cloudflare só valem no HTML estático; vindos no texto
  // (colado do código da página), apareceriam à vista em volta do e-mail. Saem antes do escape, e o e-mail fica legível.
  _semEmailOff(txt) { return String(txt || "").replace(/<!--\s*\/?\s*email_off\s*-->/gi, ""); },
  corpoHTML(txt) { return this._semEmailOff(txt).split(/\n{2,}/).map(p => `<p>${this._esc(p).replace(/\n/g, "<br>")}</p>`).join("") || "<p>—</p>"; },

  // ---- e32 (19/set/2026): conteúdo MÍNIMO para uma versão virar VIGENTE ----
  // A vigente com conteúdo TROCA a página pública inteira (renderPublico). Uma Política sem a seção dos dados do Google
  // devolveria o site a uma Política que o verificador do Google (login com Google) reprova. Os itens espelham o que
  // tests/marca-google.check.mjs exige da privacidade.html estática, e o check prova que tirar qualquer um deles do
  // texto completo faz esta guarda recusar. Conteúdo vazio continua valendo: a página fica com o texto estático do site.
  // LIMITE: a guarda confere só este MÍNIMO, não se a Política está inteira. Uma cópia parcial que traga os itens (só
  // até a 3.1, por exemplo) passa; quem publica confere o texto antes.
  EMAIL_CONTATO: "eng.rcpizo@gmail.com",   // o mesmo da privacidade.html e da termos.html (o check confere)
  // Documentos com página pública: a página chama REPO.renderPublico com esta chave (o check confere nos *.html).
  PAGINAS: { privacidade: "privacidade.html", termos: "termos.html" },
  // O e-mail como endereço INTEIRO: com algo a mais colado antes ou depois (uma letra na frente, ".br" no fim) é outro
  // endereço; entre < >, com "mailto:" ou com o ponto final da frase, vale. Sem lookbehind (Safari antigo).
  _reEmail(email) { return new RegExp("(?:^|[^a-z0-9._%+-])" + email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![a-z0-9_-]|\\.[a-z0-9])", "i"); },
  _minimoVigente(chave) {
    const minimo = {
      privacidade: [
        ["o título da seção 3.1: “3.1 Login com Google e Google Drive”", ["3.1 Login com Google e Google Drive"]],
        ["a frase do Uso Limitado: “… obedece à Google API Services User Data Policy, inclusive os requisitos de Uso Limitado (Limited Use)”", ["Google API Services User Data Policy", "Limited Use"]],
        ["o escopo do Google Drive: “drive.file”", ["drive.file"]],
        [`o e-mail de contato escrito por extenso: ${this.EMAIL_CONTATO}`, [this._reEmail(this.EMAIL_CONTATO)]],
      ],
    };
    return minimo[chave] || [];
  },
  // Só tag de verdade conta como código: tag conhecida fechada logo depois do nome (<p>, </p>, <br/>, <h3>) ou com
  // atributo (<a href=…>), qualquer tag com atributo entre aspas (<mark class="…">) ou comentário. "a" e "em" também são
  // palavras: "<a definir>", "<em nomeação>", "<limite>" e "<eng.rcpizo@gmail.com>" são texto e passam.
  _RE_HTML: /<\/?(?:a|abbr|article|aside|b|blockquote|br|button|center|code|dd|div|dl|dt|em|font|footer|form|h[1-6]|header|hr|i|iframe|img|input|label|li|main|nav|ol|p|pre|s|script|section|small|span|strong|style|sub|sup|table|tbody|td|th|thead|tr|u|ul)(?:\s*\/?>|\s+[a-z-]+\s*=)|<[a-z][a-z0-9-]*\s+[a-z-]+\s*=\s*["']|<!--/i,
  // O item leva o primeiro trecho achado (a recusa mostra ONDE está o código, não só que existe).
  _ITEM_HTML: "texto sem código HTML: a página mostra o texto como está, e tags como <p> ou <h3> ficariam à vista",
  // "[email protected]" é o que o Cloudflare mostra no lugar do e-mail quando a página é copiada sem JavaScript. Vale
  // para TODO documento: o endereço se perdeu na cópia, e basta uma ocorrência para a versão vigente (e a página
  // pública, se o documento tiver uma) mostrar isso ao pé da letra.
  _RE_PROTEGIDO: /\[\s*email(?:\s|&nbsp;|&#160;)*protected\s*\]/i,
  _ITEM_PROTEGIDO: "o e-mail escrito por extenso em todos os lugares: o texto traz “[email protected]” (o que o Cloudflare mostra no lugar do e-mail quando a página é copiada sem JavaScript)",
  // Lista do que falta para esta versão poder ficar vigente ([] = pode).
  faltasParaVigente(chave, conteudo) {
    const bruto = this._semEmailOff(conteudo);
    if (!bruto.trim()) return [];   // sem conteúdo: a página pública segue com o texto estático (o padrão da v1.0)
    const faltam = [];
    if (this._RE_PROTEGIDO.test(bruto)) faltam.push(this._ITEM_PROTEGIDO);
    // Código HTML vale para TODO documento, tenha ele mínimo ou não (19/set/2026): o texto é SEMPRE mostrado
    // escapado (corpoHTML), e os Termos também têm página pública. Conferir isto só depois do mínimo deixava passar
    // nos Termos o texto colado do código-fonte, e a página pública mostrava <p> e <h3> à vista.
    const tag = bruto.match(this._RE_HTML);
    if (tag) faltam.push(`${this._ITEM_HTML} (primeiro trecho: “${tag[0].slice(0, 60)}”)`);
    const minimo = this._minimoVigente(chave);
    if (!minimo.length) return faltam;
    const plano = bruto.replace(/\s+/g, " ").toLowerCase();
    for (const [rotulo, trechos] of minimo) {
      if (!trechos.every(t => typeof t === "string" ? plano.includes(t.toLowerCase()) : t.test(plano))) faltam.push(rotulo);
    }
    return faltam;
  },
  // A mensagem diz o PORQUÊ de cada tipo de falta: o texto só com código HTML já está completo (o conserto é tirar a
  // tag), e só a falta de item do mínimo leva ao aviso do Google. "Página pública" só para documento que tem página.
  _msgRecusa(chave, faltam) {
    const nome = { privacidade: "A Política de Privacidade" }[chave] || "Esta versão";
    const html = faltam.some(f => f.startsWith(this._ITEM_HTML));
    const porque = [];
    if (faltam.some(f => !f.startsWith(this._ITEM_HTML) && f !== this._ITEM_PROTEGIDO)) porque.push("Sem isso, o site voltaria a uma Política que o Google reprova na verificação do login com Google.");
    if (html) porque.push("O trecho citado é código HTML. Se o texto veio do código-fonte da página, abra a página no navegador, selecione o texto e copie o texto; se foi digitado, escreva o trecho sem os sinais < e >.");
    if (faltam.includes(this._ITEM_PROTEGIDO)) porque.push("Troque cada “[email protected]” pelo e-mail que estava ali, escrito por extenso.");
    const pagina = this.PAGINAS[chave];
    return `${nome} não pode ficar vigente assim. `
      + (pagina ? `A versão vigente troca o texto inteiro da página pública (${pagina}), e nesta falta:\n` : "Nesta versão falta:\n")
      + faltam.map(f => "• " + f).join("\n")
      + "\n" + porque.concat("Crie uma nova versão corrigida, ou publique uma versão sem conteúdo" + (pagina ? " (a página continua com o texto do site)." : ".")).join(" ");
  },
  // Confere no banco a versão que vai ser publicada: { chave do documento, recusa (a mensagem, ou null quando pode) }.
  async _conferir(documentoId, versaoId) {
    const [d, v] = await Promise.all([
      window.supa.from("repo_documentos").select("chave").eq("id", documentoId).single(),
      window.supa.from("repo_versoes").select("conteudo,documento_id").eq("id", versaoId).single(),
    ]);
    if (d.error) throw d.error;
    if (v.error) throw v.error;
    if (!d.data || !v.data || v.data.documento_id !== documentoId) throw new Error("Versão não encontrada neste documento. Recarregue a página.");
    const faltam = this.faltasParaVigente(d.data.chave, v.data.conteudo);
    return { chave: d.data.chave, recusa: faltam.length ? this._msgRecusa(d.data.chave, faltam) : null };
  },
  async recusaPublicacao(documentoId, versaoId) { return (await this._conferir(documentoId, versaoId)).recusa; },

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
  // Renderiza a versão vigente num container (páginas públicas). Mantém o texto estático do HTML quando não há
  // vigente com texto, e também quando a vigente não traz o mínimo do documento (e32: uma vigente gravada por fora do
  // Admin, pelo SQL ou antes desta guarda, não troca a Política que o Google aprovou por uma que ele reprova).
  async renderPublico(chave, containerId) {
    const el = typeof containerId === "string" ? document.getElementById(containerId) : containerId;
    if (!el) return;
    const v = await this.vigente(chave);
    if (!v || !this._semEmailOff(v.conteudo).trim()) return;   // sem texto publicado → mantém o conteúdo estático do HTML
    const faltam = this.faltasParaVigente(chave, v.conteudo);
    if (faltam.length) {
      try { console.warn(`[repositório] a versão vigente de "${chave}" não traz o mínimo; a página fica com o texto estático. Falta: ${faltam.join(" | ")}`); } catch (e) { /* aviso é só diagnóstico */ }
      return;
    }
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
    // e32: vigente só pelo publicar(), que confere o conteúdo mínimo e arquiva a vigente anterior.
    if (status === "vigente") throw new Error("Para tornar uma versão vigente, use Publicar (ele confere o conteúdo mínimo).");
    const { error } = await window.supa.from("repo_versoes").update({ status }).eq("id", versaoId); if (error) throw error;
  },
  // A data de HOJE em São Paulo (UTC-3 fixo, sem horário de verão desde 2019 — CLAUDE.md). O toISOString é UTC: das
  // 21h à meia-noite ele já está no dia seguinte, e a página mostraria "vigente desde" amanhã.
  _hojeSP() { return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10); },
  // Escrita que não confia no silêncio do PostgREST (regra b10 do CLAUDE.md): erro devolvido ou lançado vira `motivo`.
  async _grava(consulta) {
    try { const { data, error } = await consulta(); return error ? { motivo: error.message || String(error) } : { linhas: data || [] }; }
    catch (e) { return { motivo: (e && e.message) || String(e) }; }
  },
  // As vigentes do documento AGORA, lidas no banco ([] = sem vigente; null = não deu para ler).
  async _vigentes(documentoId) {
    try {
      const { data, error } = await window.supa.from("repo_versoes").select("id,versao").eq("documento_id", documentoId).eq("status", "vigente");
      return error || !Array.isArray(data) ? null : data;
    } catch (e) { return null; }
  },
  // Como o documento ficou depois de uma falha no meio do publicar, dito pelo que o banco mostra AGORA. Um erro de rede
  // não diz se o banco gravou: a resposta pode se perder depois da gravação, e supor pelo erro descreveria outro estado.
  async _comoFicou(documentoId, versaoId, arquivadas, pagina) {
    const vig = await this._vigentes(documentoId);
    if (!vig) return "Não deu para conferir como o documento ficou: recarregue a lista e veja qual versão está vigente.";
    if (vig.some(r => r.id === versaoId)) return "Mesmo assim, o banco mostra esta versão como a vigente (a resposta se perdeu no caminho): recarregue a lista.";
    if (vig.length) return `A versão ${vig.map(r => r.versao || r.id).join(", ")} continua vigente` + (pagina ? ", e a página pública não mudou." : ".");
    return (arquivadas && arquivadas.length ? "A vigente anterior não voltou: o documento" : "O documento") + " está sem vigente"
      + (pagina ? ", e a página pública fica com o texto estático" : "") + ". Recarregue a lista e publique de novo a versão certa.";
  },
  // Publicar: confere o conteúdo mínimo (e32) ANTES de mexer em qualquer linha; recusa = nada muda (a vigente de hoje
  // continua vigente). Depois arquiva a vigente atual (respeita o índice único) e marca esta como vigente. NÃO é
  // transação (são dois updates). Se uma escrita falhar, ele confere no banco antes de concluir: a nova já vigente
  // (a resposta se perdeu) é publicação feita; a nova não vigente e o documento sem vigente devolvem a vigência à que
  // acabou de ser arquivada; e a mensagem (erro com `estadoConferido`) diz como o documento ficou, pelo que o banco mostra.
  async publicar(documentoId, versaoId) {
    const { chave, recusa } = await this._conferir(documentoId, versaoId);
    if (recusa) { const e = new Error(recusa); e.recusaVigente = true; throw e; }
    const pagina = !!this.PAGINAS[chave];   // "página pública" só na mensagem de documento que tem página
    const conferido = (texto) => { const e = new Error(texto); e.estadoConferido = true; return e; };
    const arq = await this._grava(() => window.supa.from("repo_versoes").update({ status: "arquivado" }).eq("documento_id", documentoId).eq("status", "vigente").select("id"));
    if (arq.motivo) throw conferido(`O banco não confirmou o arquivamento da vigente atual (${arq.motivo}), e esta versão não foi publicada. ` + await this._comoFicou(documentoId, versaoId, null, pagina));
    const arquivadas = arq.linhas.map(r => r.id);
    const marca = await this._grava(() => window.supa.from("repo_versoes").update({ status: "vigente", vigencia_inicio: this._hojeSP() }).eq("id", versaoId).select("id"));
    const motivo = marca.motivo || (marca.linhas.length ? null : "nenhuma linha alterada");
    if (!motivo) return;
    // A resposta pode ter se perdido DEPOIS de o banco gravar: confere antes de desfazer.
    const agora = await this._vigentes(documentoId);
    if (agora && agora.length === 1 && agora[0].id === versaoId) return;   // gravou: está publicada
    if (arquivadas.length && !(agora && agora.length)) {
      const dev = await this._grava(() => window.supa.from("repo_versoes").update({ status: "vigente" }).in("id", arquivadas).select("id"));
      if (!dev.motivo && dev.linhas.length === arquivadas.length) throw conferido(`A versão não foi marcada como vigente (${motivo}). A vigente anterior continua vigente` + (pagina ? ", e a página pública não mudou." : "."));
    }
    throw conferido(`O banco não confirmou que esta versão ficou vigente (${motivo}). ` + await this._comoFicou(documentoId, versaoId, arquivadas, pagina));
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
      // e32: a vigente com texto que não traz o mínimo NÃO aparece na página (o renderPublico fica com o texto estático).
      // Gravar o aceite dela seria a prova de um texto que ninguém viu; sem aceite até publicarem uma versão válida.
      if (this.faltasParaVigente(chave, v.conteudo).length) return;
      await window.supa.from("repo_aceites").upsert(
        { user_id: AUTH.session().id, documento_chave: chave, versao_id: v.versao_id, versao: v.versao },
        { onConflict: "user_id,versao_id", ignoreDuplicates: true },
      );
    } catch (e) { /* aceite é trilha auxiliar: nunca pode atrapalhar o boot do app */ }
  }
};
if (typeof window !== "undefined") window.REPO = REPO;
