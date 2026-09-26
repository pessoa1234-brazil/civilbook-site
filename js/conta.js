// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// e20 — Área do usuário (Minha conta): perfil, assinatura/pagamento, suporte, solicitações,
// privacidade (LGPD) e segurança. Autoatendimento do cliente logado. Dados sensíveis em tabelas
// RLS (cada um só o seu): suporte_chamados/suporte_mensagens/solicitacoes (0024), perfil
// (profiles), assinatura (subscriptions — só-leitura no front), aceites (repo_aceites/0021).
// SEGURANÇA: cartão NUNCA passa por aqui (vai à página hospedada do Asaas); o app não apaga
// conta nem cancela assinatura direto — registra SOLICITAÇÃO (trilha) para o admin processar.
const CONTA = {
  _supaOk() { return !!(typeof window !== "undefined" && window.supa && typeof AUTH !== "undefined" && AUTH.session()); },
  _esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); },
  _uid() { return AUTH.session().id; },

  CAT: { conta: "Conta e perfil", pagamento: "Pagamento e assinatura", tecnico: "Problema técnico", sugestao: "Sugestão", outro: "Outro" },
  ST_CHAMADO: { aberto: ["Aberto", "pill-amber"], em_atendimento: ["Em atendimento", "pill-blue"], resolvido: ["Resolvido", "pill-teal"], fechado: ["Fechado", "pill-gray"] },
  ST_SOLIC: { solicitado: ["Solicitado", "pill-amber"], em_andamento: ["Em andamento", "pill-blue"], concluido: ["Concluído", "pill-teal"], recusado: ["Recusado", "pill-gray"] },
  TIPO_SOLIC: { exportar_dados: "Exportação de dados (LGPD)", excluir_conta: "Exclusão de conta (LGPD)", cancelar_assinatura: "Cancelamento de assinatura", trocar_plano: "Troca de plano", corpo_tecnico: "Candidatura ao corpo técnico", outro: "Outro" },
  PLANO_NOME: { gratuito: "Gratuito", "pro-mensal": "PRO Mensal", "pro-anual": "PRO Anual", "pro-teste": "PRO (teste)", "pro-cortesia": "PRO (cortesia)", "ia-mensal": "Civilbook IA", "ia-anual": "Civilbook IA Anual" },
  // b9 (17/set/2026): pro-teste e pro-cortesia TÊM PRAZO (profiles.plano_ate) e NÃO são assinatura paga —
  // quem manda na tela é o plano EFETIVO da sessão (AUTH.session().plano já vem vencido como gratuito).
  planoRotulo(plano, ate) {
    const nome = this.PLANO_NOME[plano] || plano || "—";
    if (!ate || !/^pro-(teste|cortesia)$/.test(String(plano || ""))) return nome;
    const d = new Date(ate);
    if (isNaN(d.getTime())) return nome;
    const q = d.getTime() < Date.now() ? "venceu em " : "até ";
    return nome + " · " + q + d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  },
  ehAssinaturaPaga(plano) { return /^(pro-(mensal|anual)|ia-)/.test(String(plano || "")); },

  // ---- Perfil (profiles, RLS own) ----
  async perfil() {
    const { data, error } = await window.supa.from("profiles")
      .select("nome,empresa,crea_cau,telefone,plano,role,lgpd_consent_at,created_at,email_cache").eq("id", this._uid()).maybeSingle();
    if (error) throw error;
    return data || {};
  },
  async salvarPerfil(p) {
    const patch = { nome: p.nome || null, empresa: p.empresa || null, crea_cau: p.crea_cau || null, telefone: p.telefone || null };
    const { error } = await window.supa.from("profiles").update(patch).eq("id", this._uid());
    if (error) throw error;
    if (AUTH._session && p.nome) AUTH._session.nome = p.nome;   // reflete no menu
  },

  // ---- Assinatura (subscriptions, RLS own; só-leitura no front) ----
  async assinatura() {
    const { data, error } = await window.supa.from("subscriptions")
      .select("plano,status,provider,provider_customer_id,current_period_end,created_at,updated_at")
      .eq("user_id", this._uid()).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data || null;
  },

  // ---- Suporte (chamados + thread) ----
  async meusChamados() {
    const { data, error } = await window.supa.from("suporte_chamados")
      .select("id,assunto,categoria,status,created_at,updated_at").eq("user_id", this._uid()).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return data || [];
  },
  async criarChamado(c) {
    const ctx = (typeof currentModule !== "undefined" && currentModule) ? currentModule : "conta";
    const { data, error } = await window.supa.from("suporte_chamados")
      .insert({ user_id: this._uid(), assunto: c.assunto, categoria: c.categoria || "outro", descricao: c.descricao, contexto: ctx })
      .select("id").single();
    if (error) throw error;
    await window.supa.from("suporte_mensagens").insert({ chamado_id: data.id, autor_id: this._uid(), de_admin: false, texto: c.descricao });
    return data.id;
  },
  async chamado(id) {
    const { data, error } = await window.supa.from("suporte_chamados").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },
  async mensagens(chamadoId) {
    const { data, error } = await window.supa.from("suporte_mensagens").select("*").eq("chamado_id", chamadoId).order("created_at");
    if (error) throw error;
    return data || [];
  },
  async responder(chamadoId, texto, deAdmin) {
    const { error } = await window.supa.from("suporte_mensagens")
      .insert({ chamado_id: chamadoId, autor_id: this._uid(), de_admin: !!deAdmin, texto });
    if (error) throw error;
  },
  // admin
  async listarChamados(filtro) {
    let q = window.supa.from("suporte_chamados").select("*").order("updated_at", { ascending: false }).limit(300);
    if (filtro && filtro.status) q = q.eq("status", filtro.status);
    const { data, error } = await q; if (error) throw error; return data || [];
  },
  async mudarStatusChamado(id, status) {
    const { error } = await window.supa.from("suporte_chamados").update({ status }).eq("id", id);
    if (error) throw error;
  },

  // ---- Solicitações (LGPD / plano) ----
  async minhasSolicitacoes() {
    const { data, error } = await window.supa.from("solicitacoes")
      .select("id,tipo,detalhe,status,created_at,updated_at").eq("user_id", this._uid()).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return data || [];
  },
  async abrirSolicitacao(tipo, detalhe) {
    const { data, error } = await window.supa.from("solicitacoes")
      .insert({ user_id: this._uid(), tipo, detalhe: detalhe || null }).select("id").single();
    if (error) throw error;
    return data.id;
  },
  async listarSolicitacoes(filtro) {
    let q = window.supa.from("solicitacoes").select("*").order("created_at", { ascending: false }).limit(300);
    if (filtro && filtro.status) q = q.eq("status", filtro.status);
    const { data, error } = await q; if (error) throw error; return data || [];
  },
  async atualizarSolicitacao(id, status) {
    const { error } = await window.supa.from("solicitacoes").update({ status }).eq("id", id);
    if (error) throw error;
  },

  // ---- Corpo Técnico (e28): candidatura via solicitacoes (tipo corpo_tecnico) ----
  async minhaCandidaturaCT() {
    const { data, error } = await window.supa.from("solicitacoes")
      .select("id,detalhe,status,created_at,updated_at").eq("user_id", this._uid()).eq("tipo", "corpo_tecnico")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data || null;
  },

  // ---- LGPD ----
  async meusAceites() {
    const { data, error } = await window.supa.from("repo_aceites")
      .select("documento_chave,versao,aceito_em").eq("user_id", this._uid()).order("aceito_em", { ascending: false }).limit(50);
    if (error) throw error;
    return data || [];
  },
  // Reúne os dados pessoais do titular (portabilidade LGPD art. 18). Best-effort por fonte.
  // AMPLIADO (achado L3, ago/2026): a versão anterior exportava só perfil/assinatura/chamados/
  // solicitações/aceites/feedback e ficava com a MAIOR parte das fontes de fora — conteúdo criado
  // pelo titular, WhatsApp, uso de IA, Drive. Tudo abaixo já é legível pelo próprio dono via RLS,
  // então a omissão era só do código. Cada fonte é best-effort (uma tabela ausente não derruba o
  // resto) e limitada, para o JSON não explodir. Colunas escolhidas p/ dar o dado sem lixo interno.
  async exportarDados() {
    const sess = AUTH.session();
    const uid = this._uid();
    const out = { exportado_em: new Date().toISOString(), conta: { id: sess.id, email: sess.email } };
    const seguro = async (k, fn) => { try { out[k] = await fn(); } catch (e) { out[k] = { erro: String(e.message || e) }; } };
    const sel = (tab, cols, extra) => async () => {
      let q = window.supa.from(tab).select(cols).eq("user_id", uid).limit(1000);
      if (extra) q = extra(q);
      const { data, error } = await q; if (error) throw error; return data || [];
    };

    await seguro("perfil", () => this.perfil());
    await seguro("assinatura", () => this.assinatura());
    await seguro("chamados_suporte", () => this.meusChamados());
    // mensagens de suporte que o titular escreveu (o texto ficava de fora). Coluna de dono é
    // `autor_id`, não `user_id` — por isso não passa pelo helper `sel`.
    await seguro("suporte_mensagens", async () => {
      const { data, error } = await window.supa.from("suporte_mensagens")
        .select("chamado_id,texto,de_admin,created_at").eq("autor_id", uid).order("created_at").limit(1000);
      if (error) throw error; return data || [];
    });
    await seguro("solicitacoes", () => this.minhasSolicitacoes());
    await seguro("aceites_documentos", () => this.meusAceites());
    if (typeof FB !== "undefined" && FB.meus) await seguro("feedback", () => FB.meus());
    // projetos e obra que o titular criou
    await seguro("projetos", sel("projetos", "id,nome,created_at"));
    await seguro("projeto_documentos", sel("projeto_docs", "id,projeto_id,nome,tipo,created_at"));
    await seguro("orcamentos_obra", sel("obra_orcamentos", "id,nome,uf,regime,created_at"));
    await seguro("rdo", sel("rdo", "id,data,clima,atividades,ocorrencias,created_at"));
    await seguro("cronogramas", sel("cronogramas", "id,nome,created_at"));
    // WhatsApp: o vínculo (telefone), o texto das conversas e os arquivos enviados
    await seguro("whatsapp_vinculo", sel("wa_vinculos", "telefone,status,vinculado_em"));
    await seguro("whatsapp_conversas", sel("wa_conversas", "trocas,updated_at"));
    await seguro("whatsapp_uploads", sel("wa_uploads", "nome,mime,criado_em"));
    // IA: uso, esquemas gerados, reações
    await seguro("ia_uso", sel("ia_uso", "tipo,modelo,modulo,criado_em"));
    await seguro("ia_esquemas", sel("ia_esquemas", "titulo,citacao,conforme,canal,created_at"));
    await seguro("ia_feedback", sel("ia_feedback", "sinal,tema,created_at"));
    // Google Drive: status da conexão (nunca os tokens — não são legíveis por RLS de coluna)
    await seguro("google_drive", sel("drive_contas", "email,escopo,conectado_em"));
    // Arquivos do titular no Storage (bucket privado 'projetos', pasta = uid)
    await seguro("arquivos_storage", async () => {
      const { data, error } = await window.supa.storage.from("projetos").list(uid, { limit: 1000 });
      if (error) throw error;
      return (data || []).map(f => ({ nome: f.name, tamanho: f.metadata && f.metadata.size, atualizado: f.updated_at }));
    });
    return out;
  },

  // Exclusão DEFINITIVA (LGPD art. 18, VI) — chama a Edge Function excluir-conta, que apaga o
  // Storage do titular, revoga o Drive e roda auth.admin.deleteUser (cascade limpa o banco). Sem
  // `target`, exclui a PRÓPRIA conta; com target (uid), só admin. O JWT prova a identidade no servidor.
  async excluirConta(target) {
    if (!window.supa) return { erro: "Backend indisponível." };
    const token = (await window.supa.auth.getSession()).data?.session?.access_token;
    if (!token) return { erro: "Sessão expirada." };
    const C = window.CB_CONFIG || {};
    try {
      const r = await fetch(C.FUNCTIONS_URL + "/excluir-conta", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, "apikey": C.SUPABASE_ANON_KEY },
        body: JSON.stringify({ confirmar: true, ...(target ? { target } : {}) }),
      });
      const d = await r.json().catch(() => ({}));
      return r.ok ? { ok: true, ...d } : { erro: d.error || ("Erro " + r.status) };
    } catch (e) { return { erro: String(e.message || e) }; }
  },

  // ---- Segurança da conta (Supabase Auth) ----
  async trocarSenha(nova) {
    if (!window.supa) return { erro: "Backend indisponível." };
    const { error } = await window.supa.auth.updateUser({ password: nova });
    // AUTH._msg traduz a recusa do servidor (senha curta, fraca, vazada, igual à atual); antes ia o inglês cru.
    return error ? { erro: AUTH._msg(error) } : { ok: true };
  },
  // a41 (17/set/2026): passa pelo AUTH.logout — ele marca a saída (sem 2º redirect do tratador de SIGNED_OUT),
  // limpa o cache de perfil mesmo sem rede e faz o redirect único para a landing.
  async encerrarSessoes() {
    return AUTH.logout({ scope: "global" });
  }
};
if (typeof window !== "undefined") window.CONTA = CONTA;

// ══════════════════════════════════════════════════════════════════════════
// Render — "Minha conta" (app.html, via menu do usuário). Sub-abas no cliente.
// ══════════════════════════════════════════════════════════════════════════
let _contaSub = "perfil";
function contaIniciais(nome) { return String(nome || "U").split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase(); }
function contaPaneEl() { return document.getElementById("conta-pane"); }
function contaData(d) { try { return new Date(d).toLocaleDateString("pt-BR"); } catch (e) { return ""; } }
function contaDataHora(d) { try { return new Date(d).toLocaleString("pt-BR"); } catch (e) { return ""; } }

function renderConta(sub) {
  const el = document.getElementById("app");
  if (!CONTA._supaOk()) {
    el.innerHTML = `<div class="card" style="max-width:560px;margin:32px auto;text-align:center;padding:32px">
      <div class="card-icon" style="margin:0 auto 12px"><i class="ti ti-user-cog"></i></div>
      <h2 style="font-size:19px;margin-bottom:6px">Minha conta</h2>
      <p class="page-sub">Esta área exige a conta conectada (backend Supabase).</p></div>`;
    return;
  }
  _contaSub = sub || _contaSub || "perfil";
  const sess = AUTH.session();
  const tabs = [
    ["perfil", "Perfil", "ti-user"],
    ["assinatura", "Assinatura", "ti-credit-card"],
    ["suporte", "Suporte", "ti-lifebuoy"],
    ["solicitacoes", "Solicitações", "ti-list-check"],
    ["privacidade", "Privacidade", "ti-shield-lock"],
    ["whatsapp", "WhatsApp IA", "ti-brand-whatsapp"],
    ["corpo", "Corpo Técnico", "ti-certificate"],
    ["drive", "Google Drive", "ti-brand-google-drive"],
    ["seguranca", "Segurança", "ti-key"]
  ];
  el.innerHTML = `
    <div class="conta-wrap">
      <div class="conta-head">
        <div class="user-avatar conta-avatar">${contaIniciais(sess.nome)}</div>
        <div><h1 class="page-title" style="margin:0">Minha conta</h1>
        <p class="page-sub" style="margin:0">${CONTA._esc(sess.nome)} · ${CONTA._esc(sess.email)}</p></div>
      </div>
      <div class="conta-tabs" role="tablist">
        ${tabs.map(t => `<button class="conta-tab${_contaSub === t[0] ? " active" : ""}" role="tab" aria-selected="${_contaSub === t[0]}" onclick="contaIr('${t[0]}')"><i class="ti ${t[2]}" aria-hidden="true"></i><span>${t[1]}</span></button>`).join("")}
      </div>
      <div id="conta-pane" class="conta-pane"><p class="page-sub">Carregando…</p></div>
    </div>`;
  contaRenderPane();
}
function contaIr(sub) { _contaSub = sub; renderConta(sub); }
function contaRenderPane() {
  const m = { perfil: contaPerfil, assinatura: contaAssinatura, suporte: contaSuporte, solicitacoes: contaSolicitacoes, privacidade: contaPrivacidade, whatsapp: contaWhatsApp, corpo: contaCorpoTecnico, drive: contaDrive, seguranca: contaSeguranca };
  (m[_contaSub] || contaPerfil)();
}
function contaErro(e) { return `<div class="card"><p class="page-sub" style="margin:0">Erro (a migration 0024_conta.sql foi aplicada?): ${CONTA._esc(e.message || e)}</p></div>`; }

// ---- Assessor via WhatsApp (f15) — vínculo opt-in do número à conta ----
async function contaWhatsApp() {
  const pane = contaPaneEl(); if (!pane) return;
  const zap = (window.CB_CONFIG && window.CB_CONFIG.WHATSAPP_NUMERO) || "";
  let v = null;
  try { const { data, error } = await window.supa.from("wa_vinculos").select("telefone,codigo,status").eq("user_id", AUTH.session().id).maybeSingle(); if (error) throw error; v = data; }
  catch (e) { pane.innerHTML = `<div class="card"><p class="page-sub" style="margin:0">Erro (a migration 0043_wa_assessor.sql foi aplicada?): ${CONTA._esc(e.message || e)}</p></div>`; return; }
  const ativo = v && v.status === "ativo" && v.telefone;
  const codeBox = (c) => `<div style="font-family:ui-monospace,monospace;font-size:22px;font-weight:700;letter-spacing:2px;background:var(--bg-2,#f1f5f9);border:1px dashed var(--border);border-radius:10px;padding:12px;text-align:center;margin:10px 0">${CONTA._esc(c)}</div>`;
  // 18/set/2026 — IA fora do plano Gratuito (servidor: _shared/cota.ts). Quem é gratuito fica sabendo AQUI,
  // antes de conectar, o que o WhatsApp faz por ele (arquivar) e o que exige plano pago (a IA). Revisão de
  // 18/set: o cartão inteiro fala a língua do plano — antes o convite ("pergunte de onde estiver", "receba
  // respostas citadas", "entra na cota de IA do seu plano") seguia ao lado do aviso de que não há IA.
  const semIA = typeof cbPlanoSemIA === "function" && cbPlanoSemIA();
  let corpo;
  if (ativo) {
    corpo = semIA
      ? `<p class="page-sub">Conectado: <strong>+${CONTA._esc(v.telefone)}</strong>. Mande fotos e arquivos da obra pelo WhatsApp que eles são arquivados na obra certa.</p>
      <button class="btn" id="ct-wa-off"><i class="ti ti-unlink"></i> Desconectar este número</button>`
      : `<p class="page-sub">Conectado: <strong>+${CONTA._esc(v.telefone)}</strong>. Mande perguntas de engenharia (ou fotos da obra) pelo WhatsApp e receba respostas citadas do assessor.</p>
      <button class="btn" id="ct-wa-off"><i class="ti ti-unlink"></i> Desconectar este número</button>`;
  } else if (v && v.codigo) {
    corpo = `<p class="page-sub">Envie este código pelo WhatsApp para o número do Civilbook${zap ? " (<strong>+" + CONTA._esc(zap) + "</strong>)" : ""} para conectar seu número:</p>
      ${codeBox(v.codigo)}
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${zap ? `<a class="btn primary" href="https://wa.me/${CONTA._esc(zap)}?text=${encodeURIComponent(v.codigo)}" target="_blank" rel="noopener"><i class="ti ti-brand-whatsapp"></i> Abrir WhatsApp com o código</a>` : ""}
        <button class="btn" id="ct-wa-novo"><i class="ti ti-refresh"></i> Gerar outro código</button>
      </div>
      ${zap ? "" : `<p class="page-sub" style="font-size:12px;margin-top:8px">Defina o número do Civilbook em <code>config.js</code> (WHATSAPP_NUMERO) para o link direto.</p>`}`;
  } else {
    corpo = semIA
      ? `<p class="page-sub">Conecte seu WhatsApp para arquivar fotos e arquivos da obra direto do canteiro. Gere um código e envie ao número do Civilbook para conectar.</p>
      <button class="btn primary" id="ct-wa-novo"><i class="ti ti-plus"></i> Gerar código de conexão</button>`
      : `<p class="page-sub">Use o Civilbook IA pelo WhatsApp — pergunte de onde estiver (no canteiro), por texto ou foto. Gere um código e envie ao número do Civilbook para conectar.</p>
      <button class="btn primary" id="ct-wa-novo"><i class="ti ti-plus"></i> Gerar código de conexão</button>`;
  }
  const avisoPlano = semIA
    ? `<p class="page-sub" style="margin:10px 0 0;padding:10px 12px;border:1px solid var(--border);border-radius:10px"><i class="ti ti-lock" aria-hidden="true"></i> No plano <strong>Gratuito</strong> a IA não está incluída: pelo WhatsApp você arquiva fotos e arquivos na obra, mas perguntas, análise de foto e conferência de arquivos fazem parte dos planos pagos. <a href="#" onclick="contaIr('assinatura');return false;">Ver planos</a></p>`
    : "";
  const rodapeWa = semIA
    ? `Requer o backend do WhatsApp configurado (admin).`
    : `O uso pelo WhatsApp entra na mesma cota mensal de IA do seu plano. Requer o backend do WhatsApp configurado (admin). As orientações são um apoio técnico e não substituem o responsável técnico (RT) e a consulta ao texto integral da norma.`;
  pane.innerHTML = `<div class="card conta-card"><h3 class="fin-h"><i class="ti ti-brand-whatsapp"></i> ${semIA ? "Civilbook no WhatsApp" : "Civilbook IA no WhatsApp"}</h3>
    ${corpo}
    ${avisoPlano}
    <p class="page-sub" style="font-size:12px;margin-top:10px"><i class="ti ti-info-circle"></i> ${rodapeWa}</p></div>`;
  const bNovo = document.getElementById("ct-wa-novo");
  if (bNovo) bNovo.onclick = async function () {
    this.disabled = true;
    const codigo = "CB-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    try { const { error } = await window.supa.from("wa_vinculos").upsert({ user_id: AUTH.session().id, codigo, status: "pendente", telefone: null, vinculado_em: null }, { onConflict: "user_id" }); if (error) throw error; toast("Código gerado.", "success"); contaWhatsApp(); }
    catch (e) { toast("Erro ao gerar (migration 0043 aplicada?): " + (e.message || e), "error"); this.disabled = false; }
  };
  const bOff = document.getElementById("ct-wa-off");
  if (bOff) bOff.onclick = async function () {
    if (!await cbConfirmar("Desconectar este número do Civilbook IA?")) return;
    this.disabled = true;
    try { const { error } = await window.supa.from("wa_vinculos").delete().eq("user_id", AUTH.session().id); if (error) throw error; toast("Desconectado.", "success"); contaWhatsApp(); }
    catch (e) { toast("Erro: " + (e.message || e), "error"); this.disabled = false; }
  };
}

// ---- Google Drive (f36) — conectar/desconectar via OAuth (tokens só no servidor) ----
async function contaDrive() {
  const pane = contaPaneEl(); if (!pane) return;
  let st = null, erro = null;
  try { st = await driveChamar("status"); } catch (e) { erro = e.message || String(e); }
  const conectado = st && st.conectado;
  pane.innerHTML = `<div class="card conta-card">
    <h3 class="fin-h"><i class="ti ti-brand-google-drive"></i> Google Drive</h3>
    ${conectado
      ? `<p class="page-sub">Conectado: <strong>${CONTA._esc(st.email || "conta Google")}</strong> · escopo <code>${CONTA._esc(String(st.escopo || "").split("/").pop())}</code>.</p>
         <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 4px">
           <button class="btn primary" id="ct-drive-cde"><i class="ti ti-folders"></i> Criar/atualizar estrutura ISO 19650</button>
           <button class="btn" id="ct-drive-up"><i class="ti ti-upload"></i> Enviar arquivo padronizado</button>
           <button class="btn" id="ct-drive-off"><i class="ti ti-unlink"></i> Desconectar</button>
         </div>
         <div id="ct-drive-msg" class="page-sub" style="font-size:12px;margin:0"></div>`
      : `<p class="page-sub">Conecte seu Google Drive para o Civilbook criar e organizar os arquivos do projeto. Os tokens ficam <strong>só no servidor</strong>; o app vê apenas o que ELE cria (escopo <code>drive.file</code>).</p>
         <button class="btn primary" id="ct-drive-on"><i class="ti ti-plug"></i> Conectar Google Drive</button>`}
    ${erro ? `<p class="page-sub" style="font-size:12px;color:var(--text-3);margin-top:8px">Backend do Drive indisponível (falta deploy da função <code>drive-sync</code> + secrets?): ${CONTA._esc(erro)}</p>` : ""}
    <p class="page-sub" style="font-size:12px;margin-top:10px"><i class="ti ti-shield-lock"></i> Nunca apagamos arquivos do seu Drive — versões superadas vão para a pasta ARQUIVO (ISO 19650).</p>
  </div>`;
  const bOn = document.getElementById("ct-drive-on");
  if (bOn) bOn.onclick = async function () {
    this.disabled = true;
    try {
      const redirectUri = new URL("drive-callback.html", location.href).href;
      const r = await driveChamar("oauth_url", { redirect_uri: redirectUri });
      if (r && r.url) location.href = r.url; else throw new Error((r && r.error) || "sem URL");
    } catch (e) { toast("Erro ao iniciar (drive-sync no ar?): " + (e.message || e), "error"); this.disabled = false; }
  };
  const bOff = document.getElementById("ct-drive-off");
  if (bOff) bOff.onclick = async function () {
    if (!await cbConfirmar("Desconectar o Google Drive? (não apaga nenhum arquivo)")) return;
    this.disabled = true;
    try { await driveChamar("disconnect"); toast("Google Drive desconectado.", "success"); contaDrive(); }
    catch (e) { toast("Erro: " + (e.message || e), "error"); this.disabled = false; }
  };
  const bCde = document.getElementById("ct-drive-cde"); if (bCde) bCde.onclick = driveCriarCDE;
  const bUp = document.getElementById("ct-drive-up"); if (bUp) bUp.onclick = driveFormUpload;
}
// f37: provisiona/atualiza a árvore CDE ISO 19650 no Drive (via drive-sync ensureCDE).
async function driveCriarCDE() {
  const msg = document.getElementById("ct-drive-msg");
  if (msg) msg.textContent = "Criando a estrutura no Drive…";
  try {
    const r = await driveChamar("op", { op: "ensureCDE", projeto: "Civilbook" });
    if (msg) msg.innerHTML = `Estrutura pronta na pasta <strong>${CONTA._esc(r.projeto)}</strong> (01_WIP/{ARQ,EST,ELE,HID,INT}, 02_COMPARTILHADO, 03_PUBLICADO, 04_ARQUIVO, 05_RECEBIDOS, 06_DOCUMENTOS). <a href="https://drive.google.com/drive/folders/${CONTA._esc(r.root)}" target="_blank" rel="noopener">Abrir no Drive ↗</a>`;
    toast("Estrutura ISO 19650 criada/atualizada.", "success");
  } catch (e) { if (msg) msg.textContent = "Erro: " + (e.message || e); toast("Erro ao criar estrutura: " + (e.message || e), "error"); }
}
// f37/f28: envia um arquivo ao Drive com NOME padronizado ISO 19650, roteado p/ a pasta do CDE.
// O botão "Sugerir (IA)" (f28) lê o conteúdo + contexto e pré-preenche os campos + o estado da pasta.
function driveFormUpload() {
  const DISC = { A: "Arquitetura (ARQ)", S: "Estrutura (EST)", E: "Elétrica (ELE)", H: "Hidráulica (HID)", I: "Interiores (INT)" };
  const DF = { A: "ARQ", S: "EST", E: "ELE", H: "HID", I: "INT" };
  const TIPO = { DR: "Desenho (DR)", M3: "Modelo 3D (M3)", SP: "Especificação (SP)", SH: "Planilha (SH)" };
  const ESTADO = { "01_WIP": "01 WIP (em elaboração)", "02_COMPARTILHADO": "02 Compartilhado", "03_PUBLICADO": "03 Publicado", "04_ARQUIVO": "04 Arquivo", "05_RECEBIDOS": "05 Recebidos (terceiros)", "06_DOCUMENTOS": "06 Documentos" };
  document.querySelectorAll(".cb-modal-ov").forEach(e => e.remove());
  // 18/set/2026 (IA fora do Gratuito; revisão da frente B): a sugestão chama a nomear-iso, que nega o gratuito
  // — mas só DEPOIS de o front baixar o pdf.js e ler até 8 páginas, e o "não" saía num toast de erro. Para o
  // plano sem IA, o botão dá lugar a uma linha que diz isso antes; o envio padronizado (sem IA) segue igual.
  const semIA = typeof cbPlanoSemIA === "function" && cbPlanoSemIA();
  const sugerirHTML = semIA
    ? `<p class="page-sub" style="margin:2px 0 10px;font-size:12.5px"><i class="ti ti-lock" aria-hidden="true"></i> Sugerir nome e pasta por IA faz parte dos planos pagos — preencha os campos abaixo. <a href="#" onclick="this.closest('.cb-modal-ov').remove();contaIr('assinatura');return false;">Ver planos</a></p>`
    : `<div style="margin:2px 0 10px"><button class="btn" id="dv-suggest" type="button"><i class="ti ti-sparkles"></i> Sugerir nome e pasta (IA)</button></div>`;
  const ov = document.createElement("div"); ov.className = "cb-modal-ov"; ov.onclick = e => { if (e.target === ov) ov.remove(); };
  ov.innerHTML = `<div class="card cb-modal-box" role="dialog" aria-modal="true" style="max-width:580px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><h3 style="margin:0;font-size:17px">Enviar arquivo padronizado (ISO 19650)</h3><button class="btn icon-only" aria-label="Fechar" onclick="this.closest('.cb-modal-ov').remove()"><i class="ti ti-x"></i></button></div>
    <div class="field"><label>Arquivo</label><input type="file" id="dv-file"></div>
    ${sugerirHTML}
    <div class="conta-grid2">
      <div class="field"><label>Projeto</label><input type="text" id="dv-proj" value="CASA01" placeholder="ex.: CASA01"></div>
      <div class="field"><label>Originador</label><input type="text" id="dv-orig" value="ESCR" placeholder="ex.: ESCR"></div>
      <div class="field"><label>Disciplina</label><select id="dv-disc" class="sinapi-uf" data-cbselect>${Object.keys(DISC).map(k => `<option value="${k}">${DISC[k]}</option>`).join("")}</select></div>
      <div class="field"><label>Tipo</label><select id="dv-tipo" class="sinapi-uf" data-cbselect>${Object.keys(TIPO).map(k => `<option value="${k}">${TIPO[k]}</option>`).join("")}</select></div>
      <div class="field"><label>Volume/Sistema</label><input type="text" id="dv-vol" value="XX" placeholder="ex.: Z1 / XX"></div>
      <div class="field"><label>Nível/Pavimento</label><input type="text" id="dv-niv" value="00" placeholder="ex.: 00 / B1 / ZZ"></div>
      <div class="field"><label>Número</label><input type="text" id="dv-num" value="101" placeholder="ex.: 101"></div>
      <div class="field"><label>Pasta (estado CDE)</label><select id="dv-estado" class="sinapi-uf" data-cbselect>${Object.keys(ESTADO).map(k => `<option value="${k}">${ESTADO[k]}</option>`).join("")}</select></div>
    </div>
    <p class="page-sub" id="dv-prev" style="font-size:12px"></p>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" onclick="this.closest('.cb-modal-ov').remove()">Cancelar</button><button class="btn primary" id="dv-go"><i class="ti ti-upload"></i>Enviar ao Drive</button></div>
  </div>`;
  document.body.appendChild(ov);
  const val = id => (document.getElementById(id).value || "").trim();
  const selVal = id => document.getElementById(id).value;
  const pastaChave = () => { const est = selVal("dv-estado"); return est === "01_WIP" ? ("01_WIP/" + DF[selVal("dv-disc")]) : est; };
  const nomeBase = () => `${val("dv-proj").toUpperCase()}-${val("dv-orig").toUpperCase()}-${(val("dv-vol") || "XX").toUpperCase()}-${(val("dv-niv") || "00").toUpperCase()}-${selVal("dv-tipo")}-${selVal("dv-disc")}-${val("dv-num")}`;
  const prev = () => { const f = document.getElementById("dv-file").files[0]; const ext = f && f.name.includes(".") ? "." + f.name.split(".").pop() : ""; document.getElementById("dv-prev").textContent = "Nome no Drive: " + nomeBase() + ext + "  →  " + pastaChave(); };
  ov.addEventListener("input", prev); ov.addEventListener("change", prev); prev();

  // f28: pré-preenche os campos com a sugestão da IA (lê o conteúdo do arquivo escolhido). Editável.
  const bSug = ov.querySelector("#dv-suggest");   // ausente no plano sem IA (ver sugerirHTML acima)
  if (bSug) bSug.onclick = async function () {
    const f = document.getElementById("dv-file").files[0]; if (!f) { toast("Escolha o arquivo primeiro.", "error"); return; }
    const btn = this, msg = document.getElementById("dv-prev"); btn.disabled = true; if (msg) msg.textContent = "Lendo o arquivo e sugerindo nome/pasta (IA)…";
    try {
      const texto = await iaExtrairTexto(f);
      const s = await iaNomear({ nome: f.name, texto, projeto: val("dv-proj"), originador: val("dv-orig") });
      const setInp = (id, v) => { const e = document.getElementById(id); if (e && v != null && v !== "") e.value = v; };
      const setSel = (id, v) => { const e = document.getElementById(id); if (e && v) { e.value = v; e.dispatchEvent(new Event("change", { bubbles: true })); } };
      setInp("dv-proj", s.campos.projeto); setInp("dv-orig", s.campos.originador); setInp("dv-vol", s.campos.volume); setInp("dv-niv", s.campos.nivel); setInp("dv-num", s.campos.numero);
      setSel("dv-tipo", s.campos.tipo); setSel("dv-disc", s.campos.disciplina); setSel("dv-estado", s.estado);
      prev();
      const pq = (s.perguntas && s.perguntas.length) ? `<br><span style="color:#c97a00">⚠️ Confirme: ${s.perguntas.map(CONTA._esc).join(" · ")}</span>` : "";
      if (msg) msg.innerHTML = `✨ Sugestão (confiança ${CONTA._esc(s.confianca)}): <strong>${CONTA._esc(s.nome)}</strong> → ${CONTA._esc(pastaChave())}. Edite se precisar.${pq}`;
    } catch (e) { toast("Não consegui sugerir: " + (e.message || e), "error"); if (msg) prev(); }
    finally { btn.disabled = false; }
  };

  ov.querySelector("#dv-go").onclick = async function () {
    const f = document.getElementById("dv-file").files[0]; if (!f) { toast("Escolha um arquivo.", "error"); return; }
    this.disabled = true;
    try {
      const cde = await driveChamar("op", { op: "ensureCDE", projeto: val("dv-proj") || "Civilbook" });
      const pasta = cde.estrutura[pastaChave()];
      if (!pasta) { toast("Pasta de destino não encontrada na estrutura do Drive.", "error"); this.disabled = false; return; }
      const ext = f.name.includes(".") ? "." + f.name.split(".").pop() : "";
      const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(f); });
      await driveChamar("op", { op: "upload", name: nomeBase() + ext, mime: f.type || "application/octet-stream", data, parent: pasta });
      toast("Enviado ao Drive: " + nomeBase() + ext, "success"); ov.remove();
    } catch (e) { toast("Erro ao enviar: " + (e.message || e), "error"); this.disabled = false; }
  };
}
// Chama a Edge Function drive-sync com o JWT do usuário.
async function driveChamar(action, extra) {
  const fnUrl = window.CB_CONFIG && window.CB_CONFIG.FUNCTIONS_URL;
  if (!fnUrl || !window.supa) throw new Error("backend indisponível");
  const { data: { session } } = await window.supa.auth.getSession();
  const tok = session && session.access_token;
  const r = await fetch(fnUrl + "/drive-sync", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify({ action, ...(extra || {}) }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ("HTTP " + r.status));
  return j;
}

// f28: extrai uma amostra de texto do arquivo no cliente (PDF e texto) p/ alimentar a sugestão de nome.
// Tipos sem texto (DWG/imagem/planilha binária) caem no nome do arquivo + contexto (a IA lida com isso).
async function iaExtrairTexto(file) {
  const nome = (file.name || "").toLowerCase(), t = file.type || "";
  try {
    if (/\.pdf$/.test(nome) || /pdf$/.test(t)) {
      const m = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.min.mjs");
      const lib = (m && m.getDocument) ? m : (m.default || m);
      try { lib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@" + (lib.version || "4") + "/build/pdf.worker.min.mjs"; } catch (e) {}
      const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      let txt = ""; const max = Math.min(doc.numPages, 8);
      for (let p = 1; p <= max; p++) { const pg = await doc.getPage(p); const c = await pg.getTextContent(); txt += c.items.map(i => i.str).join(" ") + "\n"; if (txt.length > 16000) break; }
      return txt.trim();
    }
    if (/\.(txt|md|csv|tsv)$/.test(nome) || /^text\//.test(t)) return (await file.text()).slice(0, 16000);
  } catch (e) { /* sem texto → a IA usa o nome do arquivo */ }
  return "";
}

// f28: chama a Edge Function nomear-iso (JWT do usuário). Devolve { nome, campos, estado, confianca, perguntas }.
async function iaNomear(payload) {
  const fnUrl = window.CB_CONFIG && window.CB_CONFIG.FUNCTIONS_URL;
  if (!fnUrl || !window.supa) throw new Error("backend indisponível");
  const { data: { session } } = await window.supa.auth.getSession();
  const tok = session && session.access_token;
  const r = await fetch(fnUrl + "/nomear-iso", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify(payload || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ("HTTP " + r.status));
  return j;
}

// ---- Corpo Técnico (e28) — adesão + painel do colaborador, dentro da área do usuário ----
function contaCorpoTecnico() {
  const pane = contaPaneEl(); if (!pane) return;
  // a52 P2 (21/set/2026): a régua vem da CASCA (cbEhCorpoTecnico, js/app.js) — o js/conteudo.js, dono do CONT,
  // só chega quando a aba "Corpo técnico" abre, e o typeof deixaria TODO colaborador na tela de adesão. Sem
  // reserva pelo CONT de propósito: o js/app.js é da casca e sempre carrega antes deste arquivo.
  const ehCT = cbEhCorpoTecnico();
  return ehCT ? contaCTPainel(pane) : contaCTAdesao(pane);
}
function contaCTErro(e) { return `<div class="card"><p class="page-sub" style="margin:0">Erro (a migration 0044_corpo_tecnico.sql foi aplicada?): ${CONTA._esc(e.message || e)}</p></div>`; }

// Painel do colaborador (autor/editor/admin): papel, pendências reais e atalhos.
async function contaCTPainel(pane) {
  // a52 P2 (21/set/2026): este painel lê o CONT (js/conteudo.js) para as pendências reais, e esse arquivo só
  // chega quando a aba "Corpo técnico" abre. Aqui é a Minha conta: pede o módulo antes. Falhou a rede, o
  // painel abre com o papel da sessão e as listas vazias, como já fazia quando as consultas falhavam.
  if (typeof MODULOS !== "undefined") { try { await MODULOS.garantir("corpo"); } catch (e) {} }
  const papel = (typeof CONT !== "undefined" && CONT.papel) ? CONT.papel() : ((AUTH.session() || {}).role || "user");
  const ehEditor = (typeof CONT !== "undefined" && CONT.ehEditor && CONT.ehEditor());
  const ehAdmin = (typeof AUTH !== "undefined" && AUTH.isAdmin && AUTH.isAdmin());
  const PAPEL_NOME = { autor: "Autor", editor: "Editor/revisor", admin: "Administrador" };
  let meus = [], fila = [];
  try { meus = await CONT.meus(); } catch (e) {}
  if (ehEditor) { try { fila = await CONT.fila(); } catch (e) {} }   // (CONT ausente cai no catch: listas vazias)
  const naRetomada = meus.filter(c => c.status === "rascunho" || c.status === "rejeitado").length;
  const emRev = meus.filter(c => c.status === "em_revisao").length;
  const publicados = meus.filter(c => c.status === "publicado").length;
  const stat = (n, lbl, ic) => `<div class="conta-ct-stat"><i class="ti ${ic}" aria-hidden="true"></i><strong>${n}</strong><span>${lbl}</span></div>`;
  // 18/set/2026 (revisão da 0100 + "IA fora do Gratuito"): este painel e o formulário de adesão (contaCTAdesao)
  // prometem só o que é verdade HOJE — o corpo técnico produz e revisa o CONTEÚDO de engenharia (Meus conteúdos,
  // Fila de revisão). A base de conhecimento da IA é do ADMIN: a 0100 fechou ia_conhecimento (texto, busca e
  // figuras) a todo não-admin, e com a cota 0 do Gratuito o corpo técnico no plano Gratuito nem pergunta à IA —
  // antes o texto dizia "você revisa/cura a base da IA (f19) e amostra a qualidade das respostas (f12)", que não
  // correspondia a caminho nenhum. SE o fundador abrir a base ao corpo técnico (política de revisão para
  // is_corpo_tecnico, ou IA/cortesia para quem revisa), a promessa volta AQUI e na adesão, junto com o caminho real.
  // tests/ia-plano.check.mjs (g) reprova, na tela de quem NÃO é admin (editor e autor) e na adesão, qualquer menção à
  // base da IA — pelo assunto, não por frase — e o atalho da Base de Conhecimento; o admin segue com o atalho.
  pane.innerHTML = `
    <div class="card conta-card">
      <h3 class="fin-h"><i class="ti ti-certificate"></i> Você faz parte do Corpo Técnico</h3>
      <p class="page-sub" style="margin:0">Seu papel: <strong>${CONTA._esc(PAPEL_NOME[papel] || papel)}</strong>. Você produz e cura o conteúdo técnico que sustenta a confiança da plataforma — a “fonte única”.</p>
      <div class="conta-ct-stats">
        ${stat(naRetomada, "a retomar", "ti-pencil")}
        ${stat(emRev, "em revisão", "ti-clock")}
        ${stat(publicados, "publicados", "ti-circle-check")}
        ${ehEditor ? stat(fila.length, "na fila de revisão", "ti-eye-check") : ""}
      </div>
    </div>
    <div class="card conta-card" style="margin-top:14px">
      <h3 class="fin-h">Minhas pendências e atalhos</h3>
      <div class="conta-ct-links">
        <button class="btn" onclick="navigate('corpo','meus')"><i class="ti ti-files"></i> Meus conteúdos (autoria)</button>
        ${ehEditor ? `<button class="btn" onclick="navigate('corpo','revisao')"><i class="ti ti-eye-check"></i> Fila de revisão de conteúdo (d5)</button>` : ""}
        <button class="btn" onclick="navigate('corpo','conteudo')"><i class="ti ti-article"></i> Biblioteca técnica</button>
        ${ehAdmin ? `<a class="btn" href="admin.html"><i class="ti ti-database-cog"></i> Base de Conhecimento da IA — revisão (f19) e amostragem (f12)</a>` : ""}
      </div>
      <p class="page-sub" style="font-size:12px;margin:10px 0 0"><i class="ti ti-info-circle"></i> Como membro do corpo técnico você produz e revisa o conteúdo de engenharia do Civilbook. O conteúdo que você publica leva o selo <strong>“revisado pelo corpo técnico”</strong> para o usuário comum.</p>
    </div>`;
}

// Adesão: para quem ainda não é do corpo técnico — candidatura (status) ou formulário.
async function contaCTAdesao(pane) {
  let cand = null, perfil = {};
  try { cand = await CONTA.minhaCandidaturaCT(); } catch (e) { pane.innerHTML = contaCTErro(e); return; }
  try { perfil = await CONTA.perfil(); } catch (e) {}
  if (cand && (cand.status === "solicitado" || cand.status === "em_andamento")) {
    const st = CONTA.ST_SOLIC[cand.status] || [cand.status, "pill-gray"];
    pane.innerHTML = `<div class="card conta-card">
      <h3 class="fin-h"><i class="ti ti-certificate"></i> Candidatura ao Corpo Técnico</h3>
      <p class="page-sub">Sua candidatura foi enviada e está <span class="pill ${st[1]}">${st[0]}</span>. Nossa equipe avalia e, se aprovada, você recebe o papel de <strong>autor</strong> ou <strong>editor</strong>. Acompanhe também em <a href="#" onclick="contaIr('solicitacoes');return false;">Solicitações</a>.</p>
      <div class="conta-ct-detalhe">${CONTA._esc(cand.detalhe || "")}</div>
      <p class="page-sub" style="font-size:12px;margin-top:8px">Enviada em ${contaData(cand.created_at)}.</p>
    </div>`;
    return;
  }
  const reenvio = cand && cand.status === "recusado";
  pane.innerHTML = `
    <div class="card conta-card">
      <h3 class="fin-h"><i class="ti ti-certificate"></i> Faça parte do Corpo Técnico</h3>
      <p class="page-sub" style="margin:0 0 10px">O corpo técnico do Civilbook produz e revisa o conteúdo de engenharia e garante a confiança da plataforma. É engenheiro(a), arquiteto(a) ou técnico(a) com registro? Candidate-se — um administrador avalia e atribui seu papel (autor ou editor).</p>
      ${reenvio ? `<p class="page-sub" style="font-size:12px;color:var(--text-3)">Sua candidatura anterior não foi aprovada. Você pode enviar uma nova.</p>` : ""}
      <div class="field"><label>Conselho e registro</label><input type="text" id="ct-ct-reg" value="${CONTA._esc(perfil.crea_cau || "")}" placeholder="Ex.: CREA-SP 123456 / CAU A12345-6 / CFT 0001"></div>
      <div class="field"><label>Áreas de expertise</label><input type="text" id="ct-ct-areas" maxlength="200" placeholder="Ex.: Estruturas, Patologias, Instalações hidráulicas"></div>
      <div class="field"><label>Amostra / portfólio (link ou resumo)</label><textarea id="ct-ct-port" rows="3" maxlength="1500" placeholder="Link do portfólio/Lattes/LinkedIn e/ou um resumo da sua experiência e do que gostaria de contribuir."></textarea></div>
      <div style="display:flex;justify-content:flex-end"><button class="btn primary" id="ct-ct-enviar"><i class="ti ti-send"></i> Enviar candidatura</button></div>
      <p class="page-sub" style="font-size:12px;margin-top:8px"><i class="ti ti-lock"></i> Enviar a candidatura <strong>não</strong> concede acesso — o papel só muda após a aprovação de um administrador.</p>
    </div>`;
  const btn = pane.querySelector("#ct-ct-enviar");
  if (btn) btn.onclick = async function () {
    const reg = (document.getElementById("ct-ct-reg").value || "").trim();
    const areas = (document.getElementById("ct-ct-areas").value || "").trim();
    const port = (document.getElementById("ct-ct-port").value || "").trim();
    if (!reg || !areas) { toast("Informe ao menos o conselho/registro e as áreas de expertise.", "error"); return; }
    const detalhe = `Conselho/registro: ${reg} | Áreas: ${areas}${port ? " | Portfólio/exp.: " + port : ""}`;
    this.disabled = true;
    try { await CONTA.abrirSolicitacao("corpo_tecnico", detalhe); toast("Candidatura enviada! Acompanhe aqui ou em Solicitações.", "success"); contaCorpoTecnico(); }
    catch (e) { toast("Erro ao enviar (migration 0044_corpo_tecnico.sql aplicada?): " + (e.message || e), "error"); this.disabled = false; }
  };
}

// ---- 1) Perfil ----
async function contaPerfil() {
  const pane = contaPaneEl(); if (!pane) return;
  let p; try { p = await CONTA.perfil(); } catch (e) { pane.innerHTML = contaErro(e); return; }
  const sess = AUTH.session();
  const f = (id, lbl, v, ph, extra) => `<div class="field"><label>${lbl}</label><input type="text" id="${id}" value="${CONTA._esc(v || "")}" ${extra || ""} placeholder="${ph || ""}"></div>`;
  pane.innerHTML = `
    <div class="card conta-card">
      <h3 class="fin-h">Dados do perfil</h3>
      <div class="conta-grid2">
        ${f("ct-nome", "Nome completo", p.nome, "Seu nome")}
        ${f("ct-email", "E-mail", sess.email, "", "disabled title='O e-mail é gerenciado no login'")}
        ${f("ct-empresa", "Empresa", p.empresa, "Empresa ou escritório")}
        ${f("ct-tel", "Telefone", p.telefone, "(00) 00000-0000")}
        ${f("ct-crea", "Conselho e registro", p.crea_cau, "Ex.: CREA-SP 123456 / CAU A12345-6")}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px">
        <span class="page-sub" style="margin:0;font-size:12px">Cadastro desde ${contaData(p.created_at)} · plano atual: <strong>${CONTA._esc(CONTA.planoRotulo(sess.plano, sess.planoAte) || CONTA.PLANO_NOME[p.plano] || p.plano || "—")}</strong></span>
        <button class="btn primary" id="ct-perfil-save"><i class="ti ti-device-floppy"></i>Salvar perfil</button>
      </div>
    </div>`;
  pane.querySelector("#ct-perfil-save").onclick = async function () {
    const dados = {
      nome: (document.getElementById("ct-nome").value || "").trim(),
      empresa: (document.getElementById("ct-empresa").value || "").trim(),
      telefone: (document.getElementById("ct-tel").value || "").trim(),
      crea_cau: (document.getElementById("ct-crea").value || "").trim()
    };
    if (!dados.nome) { toast("Informe seu nome.", "error"); return; }
    this.disabled = true;
    try { await CONTA.salvarPerfil(dados); toast("Perfil atualizado.", "success"); if (typeof renderUserMenu === "function") renderUserMenu(); }
    catch (e) { toast("Erro ao salvar: " + (e.message || e), "error"); }
    finally { this.disabled = false; }
  };
}

// ---- 2) Assinatura e pagamento ----
async function contaAssinatura() {
  const pane = contaPaneEl(); if (!pane) return;
  const sess = AUTH.session();
  let sub = null; try { sub = await CONTA.assinatura(); } catch (e) { pane.innerHTML = contaErro(e); return; }
  // b9: o plano da SESSÃO é o efetivo (teste/cortesia vencidos já viram gratuito); a assinatura só manda
  // quando existe de verdade. "ehPro" aqui significa ASSINATURA PAGA — teste e cortesia não escondem os
  // botões de assinar nem oferecem cancelamento (não há o que cancelar).
  const planoAtual = (sub && sub.plano) || sess.plano || "gratuito";
  const ehPro = CONTA.ehAssinaturaPaga(planoAtual);
  const stMap = { ativa: ["Ativa", "pill-teal"], trial: ["Em teste", "pill-blue"], inativa: ["Inativa", "pill-gray"], cancelada: ["Cancelada", "pill-gray"], inadimplente: ["Inadimplente", "pill-amber"] };
  const st = sub ? (stMap[sub.status] || [sub.status, "pill-gray"]) : null;
  const payAtivo = (typeof PAY !== "undefined" && PAY.ativo && PAY.ativo());
  const rot = p => (typeof PRECOS !== "undefined" && PRECOS.rotulo) ? PRECOS.rotulo(p) : "";
  // Só com o pagamento ligado (ver acoesPlano abaixo): desligado, não há "Assinar" nenhum.
  const btnPlano = (p, lbl) => `<button class="btn primary" onclick="PAY.checkout('${p}')"><i class="ti ti-rocket"></i>${lbl} ${CONTA._esc(rot(p))}</button>`;
  // 18/set/2026 (IA fora do Gratuito; revisão da frente B): TODA negação de IA ao gratuito — servidor, WhatsApp,
  // convites do app — aponta para ESTA aba. Com o pagamento desligado, "Assinar" dá a volta pela landing e cai
  // de novo no app ("Pagamentos ainda não estão ativos"): sem o bloco abaixo, o destino era um beco. Ele usa o
  // MESMO botão dos paywalls (cbTesteBotaoHTML, js/app.js): teste grátis de 7 dias se a conta nunca testou;
  // teste já usado → suporte (pagamento desligado) ou planos (ligado). O teste volta a esta aba.
  const semIA = typeof cbPlanoSemIA === "function" && cbPlanoSemIA();
  const blocoIA = semIA && typeof cbTesteBotaoHTML === "function"
    ? `<div class="conta-ia-convite" style="margin-top:14px;padding:12px 14px;border:1px solid var(--border);border-radius:10px">
        <p class="page-sub" style="margin:0 0 10px"><i class="ti ti-sparkles" aria-hidden="true"></i> A IA do Civilbook — assessor no app e no WhatsApp, laudo, análise de fotos e conferência de arquivos — <strong>não está incluída no plano Gratuito</strong>: ela faz parte dos planos pagos.</p>
        ${cbTesteBotaoHTML("conta", "assinatura", "btn primary")}
      </div>`
    : "";
  // Revisão de 18/set/2026 (jornadas): com o pagamento DESLIGADO, os "Assinar …" eram links para a landing, que não
  // vende o Civilbook IA e devolve ao app com "Pagamentos ainda não estão ativos" — beco para quem chega aqui por um
  // botão de IA (cota do PRO/cortesia esgotada, "Ver planos" de uma negação). Sem pagamento, esta aba não oferece
  // assinar o que não dá para assinar: diz que as assinaturas online abrem em breve e leva ao caminho que existe, o
  // Suporte (quem é gratuito ainda tem, no blocoIA acima, o teste grátis — ou o suporte, se já testou). Com o
  // pagamento ligado, os botões de checkout de sempre. Travado em tests/ia-plano.check.mjs (e).
  // O BOTÃO "Falar com o suporte" sai sempre que não há o blocoIA (quem não é gratuito — PRO, cortesia, teste
  // vigente, Civilbook IA — e chega aqui com a cota esgotada; ou o bloco que não montou): o link "Suporte" do
  // rodapé sozinho não é o caminho que a negação prometeu (revisão de 18/set; o check (e) conta o botão).
  // Modo piloto (18/set/2026, docs/MODO-PILOTO.md): o site publicado não tem a página de planos (index.html#planos), e
  // o link seria um beco. A chave chega por CB_CONFIG.MODO_PILOTO, que só a publicação liga (tools/modo-piloto.ts).
  const piloto = !!(window.CB_CONFIG && window.CB_CONFIG.MODO_PILOTO === true);
  const ondePlanos = piloto ? "" : ` Os planos e valores ficam na <a href="index.html#planos">página de planos</a>.`;
  const acoesPlano = payAtivo
    ? `${ehPro ? "" : btnPlano("pro-mensal", "Assinar PRO Mensal") + btnPlano("pro-anual", "Assinar PRO Anual")}
        ${ehPro ? btnPlano("pro-anual", "Mudar para PRO Anual") : ""}
        ${/^ia/.test(planoAtual || "") ? "" : btnPlano("ia-mensal", "Assinar Civilbook IA")}`
    : (blocoIA ? "" : `<button class="btn primary" onclick="contaIr('suporte')"><i class="ti ti-lifebuoy"></i>Falar com o suporte</button>`);

  pane.innerHTML = `
    <div class="card conta-card">
      <h3 class="fin-h">Plano e assinatura</h3>
      <div class="conta-plan">
        <div>
          <div class="conta-plan-nome">${CONTA._esc(CONTA.planoRotulo(planoAtual, sess.planoAte))}</div>
          ${st ? `<span class="pill ${st[1]}">${st[0]}</span>` : `<span class="pill pill-gray">sem assinatura paga</span>`}
          ${sub && sub.current_period_end ? `<span class="page-sub" style="font-size:12px;margin-left:8px">próx. ciclo: ${contaData(sub.current_period_end)}</span>` : ""}
        </div>
      </div>
      <div class="conta-plan-acoes">
        ${acoesPlano}
        ${ehPro ? `<button class="btn" onclick="contaCancelar()"><i class="ti ti-x"></i>Solicitar cancelamento</button>` : ""}
      </div>
      ${blocoIA}
      ${!payAtivo ? `<p class="page-sub" style="font-size:12px;margin-top:10px"><i class="ti ti-info-circle"></i> As assinaturas online abrem em breve — por enquanto não dá para assinar nem mudar de plano pelo app. Enquanto isso, fale com a gente pelo <a href="#" onclick="contaIr('suporte');return false;">Suporte</a>.${ondePlanos}</p>` : ""}
    </div>
    <div class="card conta-card" style="margin-top:14px">
      <h3 class="fin-h">Forma de pagamento</h3>
      <p class="page-sub" style="margin:0">Por segurança (PCI-DSS), <strong>dados de cartão nunca são digitados nem armazenados aqui</strong>. O pagamento e a troca do cartão acontecem na página segura do <strong>Asaas</strong>, onde você escolhe PIX, boleto ou cartão. Suas faturas e recibos ficam disponíveis lá.</p>
      ${sub && sub.provider ? `<p class="page-sub" style="font-size:12px;margin-top:8px">Provedor: <strong>${CONTA._esc(sub.provider)}</strong>${sub.provider_customer_id ? " · cliente #" + CONTA._esc(sub.provider_customer_id) : ""}</p>` : ""}
    </div>`;
}
async function contaCancelar() {
  if (!await cbConfirmar("Solicitar o cancelamento da assinatura? Registramos seu pedido e nossa equipe processa o cancelamento (você mantém o acesso até o fim do ciclo pago).")) return;
  try { await CONTA.abrirSolicitacao("cancelar_assinatura", "Pedido de cancelamento via Minha conta."); toast("Cancelamento solicitado. Acompanhe em Solicitações.", "success"); }
  catch (e) { toast("Erro ao solicitar (migration 0024 aplicada?): " + (e.message || e), "error"); }
}

// ---- 3) Suporte ----
async function contaSuporte() {
  const pane = contaPaneEl(); if (!pane) return;
  let chamados; try { chamados = await CONTA.meusChamados(); } catch (e) { pane.innerHTML = contaErro(e); return; }
  pane.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
      <p class="page-sub" style="margin:0">Atendimento 1:1 com nossa equipe. Para elogios e ideias gerais, use o <strong>feedback</strong> (❤ no topo).</p>
      <button class="btn primary" onclick="contaNovoChamado()"><i class="ti ti-plus"></i>Abrir chamado</button>
    </div>
    ${chamados.length ? `<div class="conta-list">${chamados.map(c => {
      const st = CONTA.ST_CHAMADO[c.status] || [c.status, "pill-gray"];
      return `<button class="conta-row" onclick="contaAbrirChamado('${c.id}')">
        <span class="conta-row-main"><strong>${CONTA._esc(c.assunto)}</strong><span class="conta-row-sub">${CONTA._esc(CONTA.CAT[c.categoria] || c.categoria)} · ${contaData(c.created_at)}</span></span>
        <span class="pill ${st[1]}">${st[0]}</span>
        <i class="ti ti-chevron-right" aria-hidden="true"></i>
      </button>`;
    }).join("")}</div>` : `<div class="card"><p class="page-sub" style="margin:0">Você ainda não abriu chamados. Use “Abrir chamado” se precisar de ajuda.</p></div>`}`;
}
function contaNovoChamado() {
  document.querySelectorAll(".cb-modal-ov").forEach(e => e.remove());
  const ov = document.createElement("div"); ov.className = "cb-modal-ov"; ov.onclick = e => { if (e.target === ov) ov.remove(); };
  ov.innerHTML = `<div class="card cb-modal-box" role="dialog" aria-modal="true" style="max-width:560px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><h3 style="margin:0;font-size:17px">Abrir chamado</h3><button class="btn icon-only" aria-label="Fechar" onclick="this.closest('.cb-modal-ov').remove()"><i class="ti ti-x"></i></button></div>
    <div class="field"><label>Assunto</label><input type="text" id="sc-assunto" maxlength="120" placeholder="Resuma o que você precisa"></div>
    <div class="field"><label>Categoria</label><select id="sc-cat" class="sinapi-uf" data-cbselect aria-label="Categoria">${Object.keys(CONTA.CAT).map(k => `<option value="${k}">${CONTA._esc(CONTA.CAT[k])}</option>`).join("")}</select></div>
    <div class="field"><label>Descrição</label><textarea id="sc-desc" rows="5" maxlength="3000" placeholder="Descreva com detalhes (passos, mensagens de erro, etc.)."></textarea></div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" onclick="this.closest('.cb-modal-ov').remove()">Cancelar</button><button class="btn primary" id="sc-save"><i class="ti ti-send"></i>Enviar chamado</button></div>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelector("#sc-save").onclick = async function () {
    const assunto = (document.getElementById("sc-assunto").value || "").trim();
    const descricao = (document.getElementById("sc-desc").value || "").trim();
    const categoria = document.getElementById("sc-cat").value;
    if (!assunto || !descricao) { toast("Preencha assunto e descrição.", "error"); return; }
    this.disabled = true;
    try { await CONTA.criarChamado({ assunto, categoria, descricao }); ov.remove(); toast("Chamado aberto! Acompanhe aqui.", "success"); contaSuporte(); }
    catch (e) { toast("Erro ao abrir (migration 0024 aplicada?): " + (e.message || e), "error"); this.disabled = false; }
  };
}
async function contaAbrirChamado(id) {
  let ch, msgs;
  try { ch = await CONTA.chamado(id); msgs = await CONTA.mensagens(id); }
  catch (e) { toast("Erro ao abrir o chamado: " + (e.message || e), "error"); return; }
  if (!ch) return;
  const st = CONTA.ST_CHAMADO[ch.status] || [ch.status, "pill-gray"];
  const fechado = ch.status === "fechado";
  document.querySelectorAll(".cb-modal-ov").forEach(e => e.remove());
  const ov = document.createElement("div"); ov.className = "cb-modal-ov"; ov.onclick = e => { if (e.target === ov) ov.remove(); };
  ov.innerHTML = `<div class="card cb-modal-box" role="dialog" aria-modal="true" style="max-width:620px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px">
      <div><h3 style="margin:0;font-size:17px">${CONTA._esc(ch.assunto)}</h3><div class="page-sub" style="font-size:12px">${CONTA._esc(CONTA.CAT[ch.categoria] || ch.categoria)} · aberto em ${contaData(ch.created_at)} · <span class="pill ${st[1]}">${st[0]}</span></div></div>
      <button class="btn icon-only" aria-label="Fechar" onclick="this.closest('.cb-modal-ov').remove()"><i class="ti ti-x"></i></button>
    </div>
    <div class="conta-thread" id="sc-thread">${msgs.map(m => contaMsgHTML(m)).join("")}</div>
    ${fechado ? `<p class="page-sub" style="font-size:12px;margin-top:10px">Este chamado está fechado.</p>` : `
    <div class="field" style="margin-top:10px"><textarea id="sc-reply" rows="3" maxlength="3000" placeholder="Escreva uma resposta…"></textarea></div>
    <div style="display:flex;justify-content:flex-end"><button class="btn primary" id="sc-reply-btn"><i class="ti ti-send"></i>Responder</button></div>`}
  </div>`;
  document.body.appendChild(ov);
  const tEl = ov.querySelector("#sc-thread"); if (tEl) tEl.scrollTop = tEl.scrollHeight;
  const rb = ov.querySelector("#sc-reply-btn");
  if (rb) rb.onclick = async function () {
    const txt = (document.getElementById("sc-reply").value || "").trim();
    if (!txt) return;
    this.disabled = true;
    try {
      await CONTA.responder(id, txt, false);
      document.getElementById("sc-reply").value = "";
      const novas = await CONTA.mensagens(id);
      tEl.innerHTML = novas.map(m => contaMsgHTML(m)).join(""); tEl.scrollTop = tEl.scrollHeight;
      toast("Mensagem enviada.", "success");
    } catch (e) { toast("Erro ao responder: " + (e.message || e), "error"); }
    finally { this.disabled = false; }
  };
}
function contaMsgHTML(m) {
  return `<div class="conta-msg${m.de_admin ? " conta-msg-admin" : ""}">
    <div class="conta-msg-autor">${m.de_admin ? "Suporte Civilbook" : "Você"} · ${contaDataHora(m.created_at)}</div>
    <div class="conta-msg-txt">${CONTA._esc(m.texto)}</div>
  </div>`;
}

// ---- 4) Acompanhamento de solicitações (unificado, só-leitura) ----
async function contaSolicitacoes() {
  const pane = contaPaneEl(); if (!pane) return;
  let chamados = [], solic = [];
  try { chamados = await CONTA.meusChamados(); solic = await CONTA.minhasSolicitacoes(); }
  catch (e) { pane.innerHTML = contaErro(e); return; }
  const itens = []
    .concat(chamados.map(c => ({ quando: c.updated_at || c.created_at, tipo: "Chamado de suporte", titulo: c.assunto, st: CONTA.ST_CHAMADO[c.status] || [c.status, "pill-gray"], id: c.id, ehChamado: true })))
    .concat(solic.map(s => ({ quando: s.updated_at || s.created_at, tipo: CONTA.TIPO_SOLIC[s.tipo] || s.tipo, titulo: s.detalhe || CONTA.TIPO_SOLIC[s.tipo] || s.tipo, st: CONTA.ST_SOLIC[s.status] || [s.status, "pill-gray"], ehChamado: false })))
    .sort((a, b) => new Date(b.quando) - new Date(a.quando));
  pane.innerHTML = `
    <p class="page-sub" style="margin:0 0 12px">Tudo o que você pediu — chamados de suporte, troca/cancelamento de plano e pedidos de LGPD — com o status atual.</p>
    ${itens.length ? `<div class="conta-list">${itens.map(it => `
      <div class="conta-row${it.ehChamado ? " conta-row-link" : ""}"${it.ehChamado ? ` onclick="contaAbrirChamado('${it.id}')" role="button" tabindex="0"` : ""}>
        <span class="conta-row-main"><strong>${CONTA._esc(it.titulo)}</strong><span class="conta-row-sub">${CONTA._esc(it.tipo)} · ${contaData(it.quando)}</span></span>
        <span class="pill ${it.st[1]}">${it.st[0]}</span>
        ${it.ehChamado ? `<i class="ti ti-chevron-right" aria-hidden="true"></i>` : `<i class="ti ti-clock" aria-hidden="true" style="color:var(--text-3)"></i>`}
      </div>`).join("")}</div>` : `<div class="card"><p class="page-sub" style="margin:0">Nenhuma solicitação ainda.</p></div>`}`;
}

// ---- 5) Privacidade (LGPD) ----
async function contaPrivacidade() {
  const pane = contaPaneEl(); if (!pane) return;
  let p = {}, aceites = [];
  try { p = await CONTA.perfil(); aceites = await CONTA.meusAceites().catch(() => []); } catch (e) { pane.innerHTML = contaErro(e); return; }
  const cookie = (typeof cbCookies !== "undefined" && cbCookies.estado) ? cbCookies.estado() : null;
  const cookieLbl = cookie === "accepted" ? "Aceitos (análise/marketing)" : cookie === "rejected" ? "Recusados (só essenciais)" : "Pendente";
  pane.innerHTML = `
    <div class="card conta-card">
      <h3 class="fin-h">Seus dados (LGPD)</h3>
      <p class="page-sub" style="margin:0 0 10px">Você pode baixar uma cópia dos seus dados pessoais (portabilidade) e solicitar a exclusão da conta (direito do titular — LGPD art. 18).</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" id="ct-export"><i class="ti ti-download"></i>Exportar meus dados (JSON)</button>
        <button class="btn" style="color:var(--red)" onclick="contaExcluir()"><i class="ti ti-user-x"></i>Solicitar exclusão da conta</button>
      </div>
    </div>
    <div class="card conta-card" style="margin-top:14px">
      <h3 class="fin-h">Consentimento</h3>
      <div class="conta-kv"><span>Consentimento de cadastro (LGPD)</span><strong>${p.lgpd_consent_at ? "aceito em " + contaData(p.lgpd_consent_at) : "—"}</strong></div>
      <div class="conta-kv"><span>Cookies de análise/marketing</span><strong>${cookieLbl} <a href="#" onclick="if(typeof cbCookies!=='undefined')cbCookies.abrir();return false;" style="font-weight:400;font-size:12px">(gerenciar)</a></strong></div>
    </div>
    <div class="card conta-card" style="margin-top:14px">
      <h3 class="fin-h">Termos aceitos</h3>
      ${aceites.length ? `<div class="conta-list">${aceites.map(a => `<div class="conta-kv"><span>${CONTA._esc((typeof REPO !== "undefined" && REPO.TIPOS[a.documento_chave]) || a.documento_chave)}</span><strong>v${CONTA._esc(a.versao || "?")} · ${contaData(a.aceito_em)}</strong></div>`).join("")}</div>` : `<p class="page-sub" style="margin:0">Nenhum aceite registrado ainda.</p>`}
    </div>`;
  pane.querySelector("#ct-export").onclick = contaExportar;
}
async function contaExportar() {
  const btn = document.getElementById("ct-export"); if (btn) { btn.disabled = true; btn.innerHTML = `<i class="ti ti-loader-2"></i>Reunindo…`; }
  try {
    const dados = await CONTA.exportarDados();
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "civilbook-meus-dados-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast("Arquivo gerado e baixado.", "success");
  } catch (e) { toast("Erro ao exportar: " + (e.message || e), "error"); }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = `<i class="ti ti-download"></i>Exportar meus dados (JSON)`; } }
}
async function contaExcluir() {
  if (!await cbConfirmar("Solicitar a exclusão da sua conta e dos seus dados?\n\nRegistramos o pedido e nossa equipe processa conforme a LGPD (alguns dados podem ser retidos por obrigação legal/fiscal). Você receberá retorno por e-mail. Esta ação NÃO apaga sua conta imediatamente.")) return;
  const motivo = prompt("Se quiser, conte o motivo (opcional):") || "";
  try { await CONTA.abrirSolicitacao("excluir_conta", motivo.trim() || "Pedido de exclusão de conta via Minha conta."); toast("Pedido registrado. Acompanhe em Solicitações.", "success"); }
  catch (e) { toast("Erro ao solicitar (migration 0024 aplicada?): " + (e.message || e), "error"); }
}

// ---- 6) Segurança da conta ----
async function contaSeguranca() {
  const pane = contaPaneEl(); if (!pane) return;
  pane.innerHTML = `
    <div class="card conta-card">
      <h3 class="fin-h">Trocar senha</h3>
      <div class="conta-grid2">
        <div class="field"><label>Nova senha</label><input aria-describedby="ct-pw-regra" type="password" id="ct-pw1" autocomplete="new-password" placeholder="Mínimo 8 caracteres"></div>
        <div class="field"><label>Confirmar nova senha</label><input type="password" id="ct-pw2" autocomplete="new-password" placeholder="Repita a senha"></div>
      </div>
      <p class="page-sub" id="ct-pw-regra" style="margin:0 0 12px">Mínimo 8 caracteres, com pelo menos uma letra minúscula, uma letra maiúscula, um número e um símbolo. Espaço, ç, letras com acento, emojis e sinais como º, °, § e € podem entrar, mas não contam. Valem como símbolo: <span class="senha-simbolos">! @ # $ % ^ &amp; * ( ) _ + - = [ ] { } ; ' &#92; : &quot; | &lt; &gt; ? , . / &#96; ~</span></p>
      <div style="display:flex;justify-content:flex-end"><button class="btn primary" id="ct-pw-save"><i class="ti ti-key"></i>Atualizar senha</button></div>
    </div>
    <div class="card conta-card" style="margin-top:14px">
      <h3 class="fin-h">Sessões</h3>
      <p class="page-sub" style="margin:0 0 10px">Encerrar a sessão em <strong>todos</strong> os dispositivos (você precisará entrar de novo).</p>
      <button class="btn" onclick="contaEncerrarSessoes()"><i class="ti ti-logout-2"></i>Encerrar todas as sessões</button>
    </div>`;
  pane.querySelector("#ct-pw-save").onclick = async function () {
    const a = document.getElementById("ct-pw1").value || "", b = document.getElementById("ct-pw2").value || "";
    // Mínimo, teto de 72 bytes, tipos e confirmação: a mesma regra do cadastro (AUTH.validarSenhaNova, js/auth.js).
    const erroSenha = AUTH.validarSenhaNova(a, b);
    if (erroSenha) { toast(erroSenha, "error"); return; }
    this.disabled = true;
    const r = await CONTA.trocarSenha(a);
    if (r && r.ok) { toast("Senha atualizada.", "success"); document.getElementById("ct-pw1").value = ""; document.getElementById("ct-pw2").value = ""; }
    else toast("Erro: " + ((r && r.erro) || "tente sair e entrar de novo antes."), "error");
    this.disabled = false;
  };
}
async function contaEncerrarSessoes() {
  if (!await cbConfirmar("Encerrar a sessão em todos os dispositivos agora?")) return;
  CONTA.encerrarSessoes();
}
