// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// f17 — Conferência de conformidade (IA), REUTILIZÁVEL. Cruza um ARTEFATO (RDO/OS/garantia/projeto) com
// as normas (base curada/f2) e os trechos do projeto (f16) → ACHADOS (ok/atenção/não-conforme) com
// fonte, persistidos em ia_conferencias (histórico + triagem por item). Consome a Edge Function
// conferir-conformidade. Princípio (f12): cita a fonte; é apoio, não substitui o RT.
const CONFER = {
  _opts: {},   // hostId -> opts (para os botões re-chamarem)
  _STATUS: {
    ok:           ["OK", "#1a7a4a", "rgba(26,122,74,.12)"],
    atencao:      ["Atenção", "#c97a00", "rgba(201,122,0,.12)"],
    nao_conforme: ["Não conforme", "#c0392b", "rgba(192,57,43,.1)"],
  },
  _esc(s) { return (typeof esc === "function") ? esc(s) : String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); },

  _pill(st) {
    const v = this._STATUS[st] || [st || "—", "var(--text-3)", "var(--bg)"];
    return `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:${v[2]};color:${v[1]};white-space:nowrap">${this._esc(v[0])}</span>`;
  },
  _btnMini(label, onclick) {
    return `<button onclick="${onclick}" style="font-size:11px;padding:3px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text-2);cursor:pointer">${this._esc(label)}</button>`;
  },

  _achadoHTML(confId, a, idx) {
    const tratado = a.revisao === "resolvido" || a.revisao === "ignorado";
    const tag = a.revisao === "resolvido" ? `<span class="pill pill-teal" style="font-size:10px">resolvido</span>`
              : a.revisao === "ignorado" ? `<span class="pill pill-gray" style="font-size:10px">ignorado</span>` : "";
    return `<div style="padding:9px 0;border-top:1px solid var(--border);${tratado ? "opacity:.55" : ""}">
      <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap">
        ${this._pill(a.status)}
        <strong style="font-size:13px;flex:1;min-width:160px">${this._esc(a.item)}</strong>${tag}
      </div>
      ${a.justificativa ? `<p style="font-size:12.5px;color:var(--text-2);margin:5px 0 0;line-height:1.5">${this._esc(a.justificativa)}</p>` : ""}
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">
        ${a.fonte ? `<span style="font-size:11px;color:var(--text-3)"><i class="ti ti-quote" aria-hidden="true"></i> ${this._esc(a.fonte)}</span>` : ""}
        <span style="margin-left:auto;display:inline-flex;gap:6px">
          ${a.revisao !== "resolvido" ? this._btnMini("Resolver", `CONFER.setAchado('${confId}',${idx},'resolvido')`) : ""}
          ${a.revisao !== "ignorado" ? this._btnMini("Ignorar", `CONFER.setAchado('${confId}',${idx},'ignorado')`) : ""}
          ${(a.revisao && a.revisao !== "aberto") ? this._btnMini("Reabrir", `CONFER.setAchado('${confId}',${idx},'aberto')`) : ""}
        </span>
      </div>
    </div>`;
  },

  _conferenciaHTML(conf) {
    const achados = Array.isArray(conf.achados) ? conf.achados : [];
    const cont = { nao_conforme: 0, atencao: 0, ok: 0 };
    achados.forEach(a => { if (cont[a.status] != null) cont[a.status]++; });
    const borda = cont.nao_conforme ? "#c0392b" : (cont.atencao ? "#c97a00" : "#1a7a4a");
    const data = conf.created_at ? new Date(conf.created_at).toLocaleString("pt-BR") : "";
    return `<div class="card" style="margin-top:10px;border-left:3px solid ${borda}">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center">
        <strong style="font-size:13px">${this._esc(conf.resumo || "Conferência")}</strong>
        <span style="font-size:11px;color:var(--text-3)">${this._esc(data)}</span>
      </div>
      <div style="display:flex;gap:10px;margin-top:6px;flex-wrap:wrap">
        ${cont.nao_conforme ? `<span style="font-size:11px;color:#c0392b;font-weight:700">${cont.nao_conforme} não conforme</span>` : ""}
        ${cont.atencao ? `<span style="font-size:11px;color:#c97a00;font-weight:700">${cont.atencao} atenção</span>` : ""}
        ${cont.ok ? `<span style="font-size:11px;color:#1a7a4a;font-weight:700">${cont.ok} ok</span>` : ""}
      </div>
      ${achados.length ? achados.map((a, i) => this._achadoHTML(conf.id, a, i)).join("") : `<p class="page-sub" style="margin:8px 0 0">Sem achados — nada a apontar com a base disponível.</p>`}
      <p style="font-size:11px;color:var(--text-3);margin:8px 0 0"><i class="ti ti-info-circle" aria-hidden="true"></i> Apoio — não substitui o responsável técnico.</p>
    </div>`;
  },

  async _historico(alvoTipo, alvoId) {
    if (!window.supa) return [];
    try {
      const { data } = await window.supa.from("ia_conferencias").select("id,resumo,achados,created_at")
        .eq("alvo_tipo", alvoTipo).eq("alvo_id", alvoId).order("created_at", { ascending: false }).limit(5);
      return data || [];
    } catch (e) { return []; }
  },

  // Monta o card completo num container (host). opts: { alvoTipo, alvoId, projetoId?, titulo, dados:()=>string }
  async montarCard(hostId, opts) {
    const host = document.getElementById(hostId);
    if (!host || !opts) return;
    this._opts[hostId] = opts;
    const hist = await this._historico(opts.alvoTipo, opts.alvoId);
    const heading = opts.heading || "Conferência de conformidade (IA)";
    const descricao = opts.descricao || "Cruza com as normas e o projeto e aponta o que está ok, em atenção ou não conforme — com fonte. Apoio; confirme com o RT.";
    const btnBase = opts.btnLabel || "Conferir conformidade";
    host.innerHTML = `<div class="card" style="margin-bottom:14px;border-left:3px solid var(--blue)">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <h3 style="margin:0"><i class="ti ti-clipboard-check" aria-hidden="true"></i> ${this._esc(heading)}</h3>
        <button class="btn primary" onclick="CONFER.conferir('${hostId}')"><i class="ti ti-shield-check" aria-hidden="true"></i> ${this._esc(hist.length ? "Conferir de novo" : btnBase)}</button>
      </div>
      <p class="page-sub" style="margin:6px 0 0">${this._esc(descricao)}</p>
      <div id="${hostId}-res">${hist.length ? this._conferenciaHTML(hist[0]) : ""}</div>
      ${hist.length > 1 ? `<p class="page-sub" style="margin:8px 0 0;font-size:12px">${hist.length - 1} conferência(s) anterior(es).</p>` : ""}
    </div>`;
  },

  async conferir(hostId) {
    const opts = this._opts[hostId];
    if (!opts) return;
    const res = document.getElementById(hostId + "-res");
    const C = window.CB_CONFIG || {};
    const dados = (typeof opts.dados === "function") ? opts.dados() : (opts.dados || "");
    if (!dados || dados.trim().length < 20) { if (res) res.innerHTML = `<p class="page-sub">Sem dados suficientes para conferir.</p>`; return; }
    if (!window.supa || !C.FUNCTIONS_URL) { if (res) res.innerHTML = `<p class="page-sub">A conferência exige a conta conectada ao backend.</p>`; return; }
    if (res) res.innerHTML = `<p class="page-sub" style="margin-top:8px"><i class="ti ti-loader" aria-hidden="true"></i> Conferindo conformidade…</p>`;
    try {
      const { data: { session } } = await window.supa.auth.getSession();
      const token = session && session.access_token;
      const endpoint = opts.endpoint || "conferir-conformidade";   // f29: documental usa conferir-documental
      const r = await fetch(C.FUNCTIONS_URL + "/" + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, "apikey": C.SUPABASE_ANON_KEY },
        body: JSON.stringify({ alvoTipo: opts.alvoTipo, alvoId: opts.alvoId, projetoId: opts.projetoId || null, titulo: opts.titulo || null, dados, ...(opts.extra || {}) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        // 18/set/2026: plano sem IA ou cota esgotada → a frase vem pronta do servidor (cota.ts) e o botão do caso de
        // cbNegacaoIABotaoHTML (js/app.js): com os pagamentos desligados ele leva ao Suporte, não a um "assinar" que
        // não existe; quem já é Civilbook IA não ouve oferta do próprio plano (tests/ia-plano.check.mjs (d)).
        if (res) res.innerHTML = `<div class="card" style="margin:8px 0 0"><p style="margin:0;font-size:13px"><i class="ti ti-alert-triangle" aria-hidden="true"></i> ${this._esc(d.error || ("Erro " + r.status))}</p></div>` + (typeof cbNegacaoIABotaoHTML === "function" ? cbNegacaoIABotaoHTML(d) : "");
        return;
      }
      await this.montarCard(hostId, opts);   // recarrega com a conferência nova no topo
      if (typeof toast === "function") toast((d.achados ? d.achados.length : 0) + " achado(s) na conferência.", "success");
    } catch (e) {
      if (res) res.innerHTML = `<p class="page-sub">Não foi possível conferir agora (a função de conferência está deployada?).</p>`;
    }
  },

  // Triagem por item: marca um achado como resolvido/ignorado/aberto (atualiza o jsonb) e re-renderiza.
  async setAchado(confId, idx, revisao) {
    if (!window.supa) return;
    try {
      const { data } = await window.supa.from("ia_conferencias").select("achados").eq("id", confId).single();
      const achados = (data && Array.isArray(data.achados)) ? data.achados : [];
      if (!achados[idx]) return;
      achados[idx].revisao = revisao;
      const { error } = await window.supa.from("ia_conferencias").update({ achados }).eq("id", confId);
      if (error) { if (typeof toast === "function") toast("Erro: " + error.message, "error"); return; }
      for (const hid in this._opts) { this.montarCard(hid, this._opts[hid]); }   // re-render dos cards montados
    } catch (e) { /* silencioso */ }
  },
};
if (typeof window !== "undefined") window.CONFER = CONFER;
