// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Compartilhamento (c5): convite por conta (edição) + link de leitura (token) + Realtime.
// Backend: migration 0010 (tabelas compartilhamentos / compartilhamento_links, RPCs
// abrir_por_token / vincular_compartilhamentos). Recursos: 'projeto' | 'os'.
const SHARE = {
  _online() { return !!(window.supa && typeof AUTH !== "undefined" && AUTH.session && AUTH.session()); },
  uid() { const s = (typeof AUTH !== "undefined" && AUTH.session) ? AUTH.session() : null; return s ? s.id : null; },

  // Liga convites feitos ao e-mail do usuário à conta dele (chamar no boot, após login).
  async vincular() { if (!this._online()) return; try { await window.supa.rpc("vincular_compartilhamentos"); } catch (e) {} },

  // ---- Convite por conta ----
  async convidar(tipo, id, email, permissao) {
    email = (email || "").trim().toLowerCase();
    if (!email.includes("@")) return { erro: "E-mail inválido." };
    const { error } = await window.supa.from("compartilhamentos").insert({
      recurso_tipo: tipo, recurso_id: id, owner_id: this.uid(),
      convidado_email: email, permissao: permissao || "edicao"
    });
    if (error) return { erro: /duplicate|unique/i.test(error.message) ? "Este e-mail já foi convidado." : error.message };
    return { ok: true };
  },
  async listar(tipo, id) {
    const { data, error } = await window.supa.from("compartilhamentos")
      .select("id,convidado_email,permissao,convidado_id").eq("recurso_tipo", tipo).eq("recurso_id", id).order("criado_em");
    return error ? [] : (data || []);
  },
  async revogar(shareId) { try { await window.supa.from("compartilhamentos").delete().eq("id", shareId); } catch (e) {} },

  // ---- Link de leitura (token) ----
  _token() { const a = new Uint8Array(18); (window.crypto || crypto).getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2, "0")).join(""); },
  async gerarLink(tipo, id) {
    const token = this._token();
    const { error } = await window.supa.from("compartilhamento_links").insert({ token, recurso_tipo: tipo, recurso_id: id, owner_id: this.uid() });
    if (error) return { erro: error.message };
    return { ok: true, token, url: new URL("app.html?share=" + token, location.href).href };
  },
  async listarLinks(tipo, id) { const { data } = await window.supa.from("compartilhamento_links").select("token,criado_em").eq("recurso_tipo", tipo).eq("recurso_id", id); return data || []; },
  async revogarLink(token) { try { await window.supa.from("compartilhamento_links").delete().eq("token", token); } catch (e) {} },
  async abrirToken(token) { try { const { data } = await window.supa.rpc("abrir_por_token", { p_token: token }); return data; } catch (e) { return null; } },

  // ---- Realtime ----
  assinar(tabela, onChange) {
    if (!window.supa || !window.supa.channel) return null;
    try {
      return window.supa.channel("cb-" + tabela + "-" + Math.random().toString(36).slice(2))
        .on("postgres_changes", { event: "*", schema: "public", table: tabela }, onChange)
        .subscribe();
    } catch (e) { return null; }
  },
  desassinar(ch) { try { if (ch && window.supa) window.supa.removeChannel(ch); } catch (e) {} }
};
window.SHARE = SHARE;

// Modal de compartilhamento (reusa .cb-modal-ov/.cb-modal-box). tipo: 'projeto'|'os'.
async function abrirCompartilhar(tipo, id, nome) {
  if (!SHARE._online()) { (typeof toast === "function" ? toast : alert)("Compartilhamento exige estar logado no backend."); return; }
  document.querySelectorAll(".cb-modal-ov").forEach(e => e.remove());
  const ov = document.createElement("div");
  ov.className = "cb-modal-ov";
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  ov.innerHTML = `<div class="card cb-modal-box" role="dialog" aria-modal="true" style="max-width:520px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
      <h3 style="margin:0;font-size:16px"><i class="ti ti-share"></i> Compartilhar</h3>
      <button class="btn icon-only" aria-label="Fechar" onclick="this.closest('.cb-modal-ov').remove()"><i class="ti ti-x"></i></button>
    </div>
    <p class="page-sub" style="margin:4px 0 14px">${esc(nome || "")}</p>

    <label style="font-size:12px;font-weight:600;color:var(--text-2)">Convidar por e-mail (colabora editando)</label>
    <div class="field-row" style="margin:6px 0 4px">
      <input type="email" id="sh-email" placeholder="email@colega.com" style="flex:1">
      <select id="sh-perm" class="sinapi-uf" style="min-width:104px"><option value="edicao">Edição</option><option value="leitura">Leitura</option></select>
      <button class="btn primary" id="sh-convidar"><i class="ti ti-user-plus"></i>Convidar</button>
    </div>
    <p class="auth-erro hidden" id="sh-erro" style="margin:2px 0"></p>
    <div id="sh-lista" style="margin:8px 0 16px"></div>

    <label style="font-size:12px;font-weight:600;color:var(--text-2)">Link de leitura (qualquer pessoa com o link vê)</label>
    <div class="field-row" style="margin:6px 0">
      <input type="text" id="sh-link" readonly placeholder="(nenhum link gerado)" style="flex:1">
      <button class="btn" id="sh-gerar"><i class="ti ti-link"></i>Gerar</button>
      <button class="btn icon-only" id="sh-copiar" title="Copiar" aria-label="Copiar"><i class="ti ti-copy"></i></button>
    </div>
    <div id="sh-links" style="margin-top:6px"></div>
  </div>`;
  document.body.appendChild(ov);

  const erro = ov.querySelector("#sh-erro");
  const mostrarErro = m => { erro.textContent = m; erro.classList.remove("hidden"); };

  async function pintarMembros() {
    const ms = await SHARE.listar(tipo, id);
    ov.querySelector("#sh-lista").innerHTML = ms.length ? ms.map(m => `
      <div class="hist-item" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <span>${esc(m.convidado_email)} <span style="color:var(--text-3);font-size:11px">· ${m.permissao}${m.convidado_id ? "" : " · pendente"}</span></span>
        <button class="btn icon-only" title="Remover" aria-label="Remover" onclick="SHARE.revogar('${esc(m.id)}').then(()=>this.closest('.hist-item').remove())"><i class="ti ti-trash"></i></button>
      </div>`).join("") : `<p style="font-size:12px;color:var(--text-3);margin:4px 0">Ninguém convidado ainda.</p>`;
  }
  async function pintarLinks() {
    const ls = await SHARE.listarLinks(tipo, id);
    ov.querySelector("#sh-links").innerHTML = ls.map(l => `
      <div class="hist-item" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <span style="font-size:11px;color:var(--text-3);word-break:break-all">…/app.html?share=${esc(l.token.slice(0, 10))}…</span>
        <button class="btn icon-only" title="Revogar" aria-label="Revogar" onclick="SHARE.revogarLink('${esc(l.token)}').then(()=>this.closest('.hist-item').remove())"><i class="ti ti-trash"></i></button>
      </div>`).join("");
  }

  ov.querySelector("#sh-convidar").onclick = async (e) => {
    erro.classList.add("hidden");
    const btn = e.currentTarget; btn.disabled = true;
    const r = await SHARE.convidar(tipo, id, ov.querySelector("#sh-email").value, ov.querySelector("#sh-perm").value);
    btn.disabled = false;
    if (r.erro) return mostrarErro(r.erro);
    ov.querySelector("#sh-email").value = "";
    pintarMembros();
  };
  ov.querySelector("#sh-gerar").onclick = async (e) => {
    const btn = e.currentTarget; btn.disabled = true;
    const r = await SHARE.gerarLink(tipo, id);
    btn.disabled = false;
    if (r.erro) return mostrarErro(r.erro);
    ov.querySelector("#sh-link").value = r.url;
    pintarLinks();
  };
  ov.querySelector("#sh-copiar").onclick = () => {
    const v = ov.querySelector("#sh-link").value; if (!v) return;
    navigator.clipboard && navigator.clipboard.writeText(v);
  };
  pintarMembros(); pintarLinks();
}
window.abrirCompartilhar = abrirCompartilhar;

// Vista somente-leitura aberta por um link de token (?share=…), funciona sem login.
async function renderSharedToken(token) {
  const app = document.getElementById("app");
  if (!app) return;
  app.innerHTML = CBStore && CBStore.loadingCard ? CBStore.loadingCard("Abrindo…") : "<p>Abrindo…</p>";
  const r = await SHARE.abrirToken(token);
  if (!r || !r.recurso) {
    app.innerHTML = `<div class="card" style="max-width:520px;margin:48px auto;text-align:center;padding:32px">
      <div class="card-icon" style="background:var(--purple-light);color:var(--purple);margin:0 auto 12px"><i class="ti ti-link-off"></i></div>
      <h2 style="font-size:20px">Link indisponível</h2>
      <p style="color:var(--text-2)">Este link de compartilhamento é inválido ou expirou.</p>
      <a class="btn primary" href="index.html" style="margin-top:12px"><i class="ti ti-home"></i>Ir ao Civilbook</a></div>`;
    return;
  }
  const banner = `<div class="result" style="background:var(--purple-light);color:var(--purple);margin-bottom:16px"><div class="r-label"><i class="ti ti-eye"></i> Visualização compartilhada — somente leitura</div></div>`;
  if (r.tipo === "projeto" && typeof CONF !== "undefined") {
    const p = CONF._fromRow(r.recurso), s = CONF.statsProjeto(p);
    app.innerHTML = banner +
      `<h2 class="page-title" style="margin-bottom:2px">${esc(p.nome)}</h2>
      <p class="page-sub">${esc(p.tipo || "")}${p.fase ? " · " + esc(p.fase) : ""}${p.rev ? " · Rev. " + esc(p.rev) : ""}${p.rt ? " · RT: " + esc(p.rt) : ""}</p>
      <div class="grid grid-3" style="margin:16px 0">
        <div class="card" style="text-align:center"><div style="font-size:32px;font-weight:600;color:var(--blue)">${s.pct}%</div><p>Conferido (${s.respondidos}/${s.total})</p></div>
        <div class="card" style="text-align:center"><div style="font-size:32px;font-weight:600;color:${s.nc ? "var(--coral)" : "var(--teal)"}">${s.nc}</div><p>Não conformidades</p></div>
        <div class="card" style="text-align:center"><div style="font-size:32px;font-weight:600;color:${s.ncElim ? "var(--red)" : "var(--teal)"}">${s.ncElim}</div><p>NCs eliminatórias</p></div>
      </div>` +
      (p.disciplinas || []).map(dId => {
        const d = CONFERENCIA.find(x => x.id === dId); if (!d) return "";
        const ds = CONF.statsDisciplina(p, dId);
        const cor = ds.ncElim ? "red" : ds.nc ? "coral" : ds.pct === 100 ? "teal" : "blue";
        const txt = ds.ncElim ? "Eliminatório NC" : ds.pct === 100 ? (ds.nc ? ds.nc + " NC" : "Conforme") : ds.respondidos + "/" + ds.total;
        return `<div class="card" style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center"><span>${esc(d.nome)}</span><span class="pill pill-${cor}">${txt}</span></div>`;
      }).join("");
  } else {
    const o = r.recurso;
    app.innerHTML = banner +
      `<h2 class="page-title" style="margin-bottom:2px">${esc(o.titulo || "Ordem de serviço")}</h2>
      <p class="page-sub">${esc(o.tipo || "")}${o.local ? " · " + esc(o.local) : ""}${o.prazo ? " · prazo " + esc(o.prazo) : ""}</p>
      <div class="card" style="margin-top:12px">
        <p><strong>Status:</strong> ${esc(o.status || "—")}</p>
        ${o.prioridade ? `<p><strong>Prioridade:</strong> ${esc(o.prioridade)}</p>` : ""}
        ${o.resp ? `<p><strong>Responsável:</strong> ${esc(o.resp)}</p>` : ""}
        ${o.descricao ? `<p style="margin-top:8px;white-space:pre-wrap">${esc(o.descricao)}</p>` : ""}
      </div>`;
  }
}
window.renderSharedToken = renderSharedToken;
