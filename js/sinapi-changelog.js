// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// e27 — SINAPI changelog por competência (sub-aba "Mudanças" da aba Custos). Mostra o DIFF entre duas
// competências da UF/regime ativos (escolhidos na sub-aba SINAPI): composições ACRESCENTADAS, RETIRADAS
// e ALTERADAS (custo), com busca por código/descrição e linha do tempo de um item. Diff sob demanda via
// RPC sinapi_diff (0042); competências e histórico por query direta (tabelas SINAPI são public-read, c1).
// Leitura pública (não-PRO). Degrada com mensagem clara se faltar backend / <2 competências / a migration.
// Q&A em linguagem natural pela IA (assessor/f4) sobre o diff é evolução futura prevista no plano.

let _chgPane = null, _chgDiff = null, _chgFiltro = "";

function chgInfo(msg) { return `<div class="card" style="text-align:center;padding:26px;color:var(--text-2)"><i class="ti ti-info-circle" style="font-size:22px;color:var(--text-3)"></i><p style="margin:8px 0 0">${msg}</p></div>`; }
function chgUFregime() { const m = (typeof SINAPIDB !== "undefined") ? SINAPIDB.meta() : {}; return { uf: m.uf || "PR", regime: m.regime || "SD", label: (typeof SINAPIDB !== "undefined" && SINAPIDB._regimeLabel) ? SINAPIDB._regimeLabel(m.regime || "SD") : (m.regime || "SD") }; }

async function renderSinapiChangelog(pane) {
  _chgPane = pane || _chgPane;
  if (!_chgPane) return;
  if (typeof window === "undefined" || !window.supa) { _chgPane.innerHTML = chgInfo("O changelog compara competências da base SINAPI no servidor (c1). Configure o backend para usar este recurso."); return; }
  _chgPane.innerHTML = `<p class="page-sub">Carregando competências…</p>`;
  try { if (typeof SINAPIDB !== "undefined") await SINAPIDB.ready(); } catch (e) {}
  let comps = [];
  try {
    const { data, error } = await window.supa.from("sinapi_competencias").select("competencia,ativa,emitido_em").order("competencia", { ascending: false });
    if (error) throw error;
    comps = data || [];
  } catch (e) { _chgPane.innerHTML = chgInfo("Não foi possível ler as competências (a base SINAPI multi-UF / c1 foi aplicada e populada?).<br><span style='font-size:12px'>" + esc(e.message || e) + "</span>"); return; }
  if (comps.length < 2) {
    // a17: a carga mensal ROTACIONA (padrão -ManterCompetencias 1) — o histórico só acumula se a
    // importação rodar guardando mais. Dizer "vai aparecer com as importações" seria promessa falsa.
    _chgPane.innerHTML = chgInfo("Há <strong>" + comps.length + "</strong> competência" + (comps.length === 1 ? "" : "s") + " importada" + (comps.length === 1 ? "" : "s") + ". O changelog compara <strong>duas</strong> — e a importação mensal guarda só <strong>uma</strong> por padrão (rotação a17). Para ele despertar, a carga precisa rodar com <code>-ManterCompetencias 2+</code> (com o plano atual do banco há espaço; ver docs/SINAPI.md).");
    return;
  }
  const r = chgUFregime();
  _chgPane.innerHTML = chgFormHTML(comps, r, comps[1].competencia, comps[0].competencia);
}

function chgFormHTML(comps, r, de, para) {
  const opt = (sel) => comps.map(c => `<option value="${esc(c.competencia)}"${c.competencia === sel ? " selected" : ""}>${esc(SINAPIDB.fmtCompet(c.competencia))}${c.ativa ? " (vigente)" : ""}</option>`).join("");
  return `
    <p class="page-sub">Compare duas competências da SINAPI e veja o que foi <strong>acrescentado</strong>, <strong>retirado</strong> ou teve o <strong>custo alterado</strong>. Preços de <strong>${esc(r.uf)} · ${esc(r.label)}</strong> (mude UF/regime na sub-aba SINAPI).</p>
    <div class="filter-bar" style="flex-wrap:wrap;gap:10px">
      <label for="chg-de">De</label>
      <select id="chg-de" class="sinapi-uf" data-cbselect aria-label="Competência base (de)">${opt(de)}</select>
      <label for="chg-para">Para</label>
      <select id="chg-para" class="sinapi-uf" data-cbselect aria-label="Competência comparada (para)">${opt(para)}</select>
      <button class="btn primary sm" onclick="chgComparar()"><i class="ti ti-git-compare"></i> Comparar</button>
    </div>
    <div id="chg-result"></div>`;
}

async function chgComparar() {
  const host = document.getElementById("chg-result"); if (!host) return;
  const de = document.getElementById("chg-de").value, para = document.getElementById("chg-para").value;
  if (de === para) { host.innerHTML = chgInfo("Escolha competências diferentes em <em>De</em> e <em>Para</em>."); return; }
  const r = chgUFregime();
  host.innerHTML = `<p class="page-sub">Comparando ${esc(SINAPIDB.fmtCompet(de))} → ${esc(SINAPIDB.fmtCompet(para))}…</p>`;
  try {
    // Pagina (o PostgREST limita a 1000 linhas/resposta; um diff mensal pode ter milhares).
    const PAGE = 1000; let rows = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await window.supa.rpc("sinapi_diff", { p_uf: r.uf, p_regime: r.regime, p_de: de, p_para: para }).range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || !data.length) break;
      rows = rows.concat(data);
      if (data.length < PAGE || rows.length >= 20000) break;   // teto de segurança
    }
    _chgDiff = { de, para, uf: r.uf, regime: r.regime, rows };
    _chgFiltro = "";
    chgRenderResult();
  } catch (e) {
    const m = String(e.message || e);
    const amigavel = /sinapi_diff|function|does not exist|schema cache|not find/i.test(m)
      ? "Este recurso requer a migration <strong>0042_sinapi_changelog.sql</strong> (RPC <code>sinapi_diff</code>). Aplique no SQL Editor do Supabase."
      : ("Erro ao comparar: " + esc(m));
    host.innerHTML = chgInfo(amigavel);
  }
}

function chgRenderResult() {
  const host = document.getElementById("chg-result"); if (!host || !_chgDiff) return;
  const rows = _chgDiff.rows;
  const n = { add: 0, rem: 0, alt: 0 };
  rows.forEach(x => { n[x.tipo] = (n[x.tipo] || 0) + 1; });
  host.innerHTML = `
    <div class="grid grid-3" style="margin:12px 0">
      ${chgCard("Acrescentadas", n.add, "#1a7a4a", "ti-plus")}
      ${chgCard("Retiradas", n.rem, "#b3261e", "ti-minus")}
      ${chgCard("Custo alterado", n.alt, "#c97a00", "ti-arrows-up-down")}
    </div>
    ${rows.length === 0 ? `<p class="page-sub">Nenhuma diferença entre ${esc(SINAPIDB.fmtCompet(_chgDiff.de))} e ${esc(SINAPIDB.fmtCompet(_chgDiff.para))} nesta UF/regime.</p>`
      : `<div style="margin-bottom:8px"><input id="chg-busca" placeholder="Filtrar por código ou descrição…" value="${esc(_chgFiltro)}" oninput="chgFiltrar(this.value)" style="width:100%"></div>
         <div id="chg-table-host">${chgTableHTML()}</div>`}`;
}
function chgCard(lbl, val, cor, icone) { return `<div class="card" style="padding:12px 14px;display:flex;align-items:center;gap:10px"><i class="ti ${icone}" style="font-size:20px;color:${cor}"></i><div><div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em">${lbl}</div><div style="font-size:18px;font-weight:700;color:${cor}">${val.toLocaleString("pt-BR")}</div></div></div>`; }

function chgFiltrar(q) { _chgFiltro = q; const h = document.getElementById("chg-table-host"); if (h) h.innerHTML = chgTableHTML(); }

function chgTableHTML() {
  if (!_chgDiff) return "";
  const nq = String(_chgFiltro || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  let rows = _chgDiff.rows;
  if (nq) rows = rows.filter(x => String(x.codigo).toLowerCase().indexOf(nq) >= 0 || String(x.descricao || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").indexOf(nq) >= 0);
  const LIM = 300, total = rows.length, mostra = rows.slice(0, LIM);
  const badge = t => t === "add" ? `<span class="pill" style="background:rgba(26,122,74,.1);color:#1a7a4a">add</span>` : t === "rem" ? `<span class="pill" style="background:rgba(179,38,30,.1);color:#b3261e">retirada</span>` : `<span class="pill" style="background:rgba(201,122,0,.1);color:#c97a00">alterada</span>`;
  const money = v => v == null ? "<span style='color:var(--text-3)'>—</span>" : brl(v);
  const varc = v => v == null ? "" : `<span style="color:${v > 0 ? "#b3261e" : v < 0 ? "#1a7a4a" : "var(--text-2)"}">${v > 0 ? "+" : ""}${Number(v).toFixed(1).replace(".", ",")}%</span>`;
  const linhas = mostra.map(x => `<tr>
    <td>${badge(x.tipo)}</td>
    <td><button class="link-btn code" onclick="chgHistorico('${esc(x.codigo)}')" title="Linha do tempo do item">${esc(x.codigo)}</button></td>
    <td>${esc(x.descricao || "—")}</td>
    <td style="text-align:right">${money(x.custo_de)}</td>
    <td style="text-align:right">${money(x.custo_para)}</td>
    <td style="text-align:right;white-space:nowrap">${varc(x.var_pct)}</td>
  </tr>`).join("");
  return `<div style="overflow-x:auto"><table class="data" style="min-width:640px"><thead><tr>
    <th>Tipo</th><th>Código</th><th>Descrição</th><th style="text-align:right">Custo (de)</th><th style="text-align:right">Custo (para)</th><th style="text-align:right">Δ%</th>
    </tr></thead><tbody>${linhas}</tbody></table></div>
    ${total > LIM ? `<p class="page-sub" style="font-size:12px;margin-top:6px">Mostrando ${LIM} de ${total.toLocaleString("pt-BR")} — refine a busca.</p>` : ""}`;
}

// Linha do tempo de um item: custo por competência (UF/regime ativos).
async function chgHistorico(codigo) {
  const r = chgUFregime();
  document.querySelectorAll(".cb-modal-ov").forEach(e => e.remove());
  const ov = document.createElement("div"); ov.className = "cb-modal-ov"; ov.onclick = e => { if (e.target === ov) ov.remove(); };
  ov.innerHTML = `<div class="card cb-modal-box" role="dialog" aria-modal="true" style="max-width:480px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0;font-size:16px">Linha do tempo · <span class="code">${esc(codigo)}</span></h3><button class="btn icon-only" aria-label="Fechar" onclick="this.closest('.cb-modal-ov').remove()"><i class="ti ti-x"></i></button></div>
    <p class="page-sub" style="margin:0 0 10px;font-size:12px">${esc(r.uf)} · ${esc(r.label)}</p>
    <div id="chg-hist-body"><p class="page-sub" style="margin:0">Carregando…</p></div></div>`;
  document.body.appendChild(ov);
  try {
    const { data, error } = await window.supa.from("sinapi_comp_precos").select("competencia,custo").eq("uf", r.uf).eq("regime", r.regime).eq("codigo", codigo).order("competencia");
    if (error) throw error;
    const body = document.getElementById("chg-hist-body"); if (!body) return;
    if (!data || !data.length) { body.innerHTML = `<p class="page-sub" style="margin:0">Sem histórico de preço para este item nesta UF/regime.</p>`; return; }
    let prev = null;
    body.innerHTML = `<div class="chg-hist">${data.map(d => {
      const v = d.custo, delta = (prev != null && prev !== 0 && v != null) ? (v - prev) / prev * 100 : null; prev = v != null ? v : prev;
      return `<div class="chg-hist-row"><span>${esc(SINAPIDB.fmtCompet(d.competencia))}</span><strong>${v == null ? "—" : brl(v)}</strong><span style="color:${delta == null ? "var(--text-3)" : delta > 0 ? "#b3261e" : delta < 0 ? "#1a7a4a" : "var(--text-2)"};font-size:12px">${delta == null ? "" : (delta > 0 ? "+" : "") + delta.toFixed(1).replace(".", ",") + "%"}</span></div>`;
    }).join("")}</div>`;
  } catch (e) {
    const body = document.getElementById("chg-hist-body"); if (body) body.innerHTML = `<p class="page-sub" style="margin:0">Erro: ${esc(e.message || e)}</p>`;
  }
}
