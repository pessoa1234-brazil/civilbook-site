// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// e23 — Orçamento de obra (sub-aba da aba Custos / SINAPI). Compõe serviços a partir das composições
// SINAPI (preço da UF/regime ativos — e2) + itens avulsos (cobre CUB/terceiros), com etapa, quantitativo,
// preço unitário, total, BDI configurável e resumo por etapa. Offline-first (cbColecao); itens em JSONB.
// Vínculo opcional ao Projeto (f3). PRO. Exporta CSV/imprime (b1). "Gerar cronograma" alimenta a curva S
// do e24 (1 atividade por etapa, valor com BDI). Custo direto vem da SINAPI; BDI e preços finais são do
// RT. IA pré-preencher a partir da EAP (f5/f14/f16) é evolução futura. Tabela: obra_orcamentos (0041) —
// distinta de 'orcamentos' (que é a captura de leads da landing).

function rowToOrc(r) {
  return { id: r.id, projeto_id: r.projeto_id || "", nome: r.nome || "", uf: r.uf || "", regime: r.regime || "", bdi: r.bdi != null ? r.bdi : 0, itens: r.itens || [], versao: r.versao || 1, obs: r.obs || "", dono: r.user_id };
}
function orcToRow(d) {
  return { id: d.id, user_id: d.dono || CBStore.uid(), projeto_id: d.projeto_id || null, nome: d.nome || "Orçamento", uf: d.uf || null, regime: d.regime || null, bdi: Number(d.bdi) || 0, itens: d.itens || [], versao: d.versao || 1, obs: d.obs || null };
}
const ORC = cbColecao("obra_orcamentos", "cb-obra-orcamentos", rowToOrc, orcToRow);

let _orcPane = null;     // contêiner (a sub-aba "orcamento-pane")
let _orcAberto = null;   // id do orçamento aberto (null = lista)
let _orcBusca = "";      // último termo de busca SINAPI

function orcBRL(n) { return (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function orcNum(n) { return String(Number(n) || 0).replace(".", ","); }   // p/ CSV pt-BR
function orcNorm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }

async function renderOrcamento(pane) {
  _orcPane = pane || _orcPane;
  if (!_orcPane) return;
  if (!planoEhPro()) { _orcPane.innerHTML = orcUpsellHTML(); return; }
  _orcPane.innerHTML = `<p class="page-sub">Carregando…</p>`;
  if (!ORC._loaded) await ORC.ready();
  try { if (typeof SINAPIDB !== "undefined") await SINAPIDB.ready(); } catch (e) {}
  // a52 P2 (21/set/2026): o editor lista as OBRAS (PROJ, js/projetos.js) no seletor "projeto", e o js/projetos.js
  // deixou de vir na abertura. Sem ele o seletor ficaria só com "— sem projeto —", sem erro nenhum: o vínculo
  // orçamento↔obra sumiria em silêncio. Falhou a rede: segue sem o seletor, que é o que já acontecia offline.
  if (typeof MODULOS !== "undefined") { try { await MODULOS.garantir("projetos"); } catch (e) {} }
  if (typeof PROJ !== "undefined" && !PROJ._loaded && typeof proj2Ready === "function") { try { await proj2Ready(); } catch (e) {} }
  orcRender();
}
function orcRender() {
  if (!_orcPane) return;
  if (_orcAberto && ORC.get(_orcAberto)) _orcPane.innerHTML = orcEditorHTML(ORC.get(_orcAberto));
  else { _orcAberto = null; _orcPane.innerHTML = orcListaHTML(); }
}

function orcUpsellHTML() {
  return `<div class="card" style="max-width:560px;margin:30px auto;text-align:center;padding:32px">
    <div class="card-icon" style="background:var(--blue-light);color:var(--blue);margin:0 auto 14px"><i class="ti ti-file-invoice"></i></div>
    <h3 style="font-size:18px;font-weight:600;margin-bottom:8px">Orçamento de obra é um recurso PRO</h3>
    <p style="color:var(--text-2);margin-bottom:18px">Componha o orçamento com composições SINAPI + itens avulsos, BDI e resumo por etapa, salve por obra e exporte.</p>
    ${typeof cbTesteBotaoHTML === "function" ? cbTesteBotaoHTML('sinapi', 'orc:', 'btn primary') : ""}
    ${typeof EXEMPLO !== "undefined" ? EXEMPLO.botaoUpsellHTML("orcamento") : ""}
  </div>`;
}

function orcListaHTML() {
  const itens = ORC.listar().slice().sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
  return `
    <p class="page-sub">Componha o orçamento da obra a partir das composições SINAPI (preço da UF/regime escolhidos acima na aba SINAPI) e de itens avulsos, com BDI e resumo por etapa. Material de apoio — BDI e preços finais são responsabilidade do RT.</p>
    <div style="margin:12px 0;display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" onclick="orcNovo()"><i class="ti ti-plus"></i> Novo orçamento</button>${typeof EXEMPLO !== "undefined" ? EXEMPLO.botaoBarraHTML("orcamento") : ""}<button class="btn" onclick="cbAssessor('abrirCom','orcamento')" title="Abrir o assessor já sabendo que você está no Orçamento (f40)"><i class="ti ti-sparkles" aria-hidden="true"></i> Perguntar à IA</button></div>
    ${itens.length === 0 ? (typeof EXEMPLO !== "undefined" ? EXEMPLO.vazioHTML("orcamento", {
        icone: "ti-calculator", titulo: "Monte o orçamento da obra",
        texto: "Puxe composições da base SINAPI (na UF e no regime que você escolher), acrescente itens avulsos, aplique o BDI e veja o resumo por etapa — pronto para imprimir e para comparar com o realizado.",
        ctaLabel: "Criar o primeiro orçamento", ctaAcao: "orcNovo()",
      }) : `<p class="page-sub" style="text-align:center;padding:18px">Nenhum orçamento ainda.</p>`)
      : itens.map(o => { const t = orcTotais(o); return `<div class="card clickable" onclick="orcAbrir('${o.id}')" style="display:flex;justify-content:space-between;align-items:center;gap:12px">
          <div><div style="font-weight:600">${esc(o.nome || "Orçamento")} <span class="page-sub" style="font-size:11px">v${o.versao || 1}</span></div>
            <div class="page-sub" style="margin:2px 0 0;font-size:12px">${esc(orcProjNome(o))} · ${t.n} ${t.n === 1 ? "item" : "itens"} · ${orcBRL(t.total)} (c/ BDI ${t.bdiPct}%)</div></div>
          <i class="ti ti-chevron-right" style="color:var(--text-3)"></i></div>`; }).join("")}`;
}
function orcProjNome(o) { if (o.projeto_id && typeof PROJ !== "undefined" && PROJ.get(o.projeto_id)) return PROJ.get(o.projeto_id).nome; return o.nome || "Obra"; }

function orcNovo() {
  const m = (typeof SINAPIDB !== "undefined") ? SINAPIDB.meta() : {};
  const id = CBStore.uuid();
  ORC.upsert({ id, nome: "Orçamento " + (ORC.listar().length + 1), projeto_id: "", uf: m.uf || "", regime: m.regime || "SD", bdi: 0, itens: [], versao: 1, obs: "", dono: CBStore.uid() });
  _orcAberto = id; orcRender();
}
function orcAbrir(id) { _orcAberto = id; _orcBusca = ""; orcRender(); }
function orcVoltar() { _orcAberto = null; orcRender(); }
async function orcExcluir(id) { if (!await cbConfirmar("Excluir este orçamento? A ação não pode ser desfeita.")) return; ORC.remover(id); _orcAberto = null; orcRender(); }
function orcDuplicar(id) {
  const o = ORC.get(id); if (!o) return;
  const nid = CBStore.uuid();
  ORC.upsert({ id: nid, nome: o.nome, projeto_id: o.projeto_id, uf: o.uf, regime: o.regime, bdi: o.bdi, itens: (o.itens || []).map(it => Object.assign({}, it, { id: CBStore.uuid() })), versao: (o.versao || 1) + 1, obs: o.obs, dono: CBStore.uid() });
  toast("Nova versão criada (v" + ((o.versao || 1) + 1) + ").", "success");
  _orcAberto = nid; orcRender();
}
function orcMeta(id, campo, valor) { const o = ORC.get(id); if (!o) return; o[campo] = (campo === "bdi") ? Math.max(0, Number(valor) || 0) : valor; ORC.upsert(o); orcRender(); }

// ── Itens ────────────────────────────────────────────────────────────────────
function orcItemAvulso(id) {
  const o = ORC.get(id); if (!o) return;
  o.itens = (o.itens || []).concat([{ id: CBStore.uuid(), etapa: "", tipo: "avulso", codigo: "", descricao: "Item avulso", unidade: "un", qtd: 1, pu: 0 }]);
  ORC.upsert(o); orcRender();
}
function orcAddSinapi(id, codigo) {
  const o = ORC.get(id); if (!o) return;
  const item = (typeof SINAPIDB !== "undefined") ? SINAPIDB.lista().find(s => s.codigo === codigo) : null;
  if (!item) return;
  o.itens = (o.itens || []).concat([{ id: CBStore.uuid(), etapa: "", tipo: "sinapi", codigo: item.codigo, descricao: item.descricao, unidade: item.unidade || "un", qtd: 1, pu: item.preco != null ? item.preco : 0 }]);
  ORC.upsert(o); _orcBusca = ""; orcRender();
}
function orcItemRemove(id, itId) { const o = ORC.get(id); if (!o) return; o.itens = (o.itens || []).filter(x => x.id !== itId); ORC.upsert(o); orcRender(); }
function orcItemSet(id, itId, campo, valor) {
  const o = ORC.get(id); if (!o) return;
  const it = (o.itens || []).find(x => x.id === itId); if (!it) return;
  it[campo] = (campo === "qtd" || campo === "pu") ? Math.max(0, Number(valor) || 0) : valor;
  ORC.upsert(o); orcRenderResumo(id);   // só os totais (mantém o foco nos inputs)
}
function orcRenderResumo(id) { const o = ORC.get(id), host = document.getElementById("orc-resumo"); if (o && host) host.innerHTML = orcResumoHTML(o); }

// Busca SINAPI (debounced) — filtra o catálogo ativo por código/descrição.
let _orcBuscaTO = null;
function orcBuscar(id, q) {
  _orcBusca = q;
  clearTimeout(_orcBuscaTO);
  _orcBuscaTO = setTimeout(() => {
    const host = document.getElementById("orc-result"); if (!host) return;
    const nq = orcNorm(q).trim();
    if (nq.length < 2 || typeof SINAPIDB === "undefined") { host.innerHTML = ""; return; }
    const lista = SINAPIDB.lista() || [];
    const hits = [];
    for (let i = 0; i < lista.length && hits.length < 25; i++) {
      const s = lista[i];
      if (orcNorm(s.codigo).indexOf(nq) >= 0 || orcNorm(s.descricao).indexOf(nq) >= 0) hits.push(s);
    }
    host.innerHTML = hits.length
      ? hits.map(s => `<div class="orc-hit" onclick="orcAddSinapi('${id}','${esc(s.codigo)}')" role="button" tabindex="0">
          <span class="orc-hit-cod">${esc(s.codigo)}</span>
          <span class="orc-hit-desc">${esc(s.descricao)}</span>
          <span class="orc-hit-pu">${s.preco != null ? orcBRL(s.preco) + "/" + esc(s.unidade || "un") : "sem preço"}</span></div>`).join("")
      : `<div class="page-sub" style="padding:8px">Nenhuma composição para “${esc(q)}”.</div>`;
  }, 220);
}

// ── Cálculo ───────────────────────────────────────────────────────────────────
function orcTotais(o) {
  const itens = o.itens || [], porEtapa = {};
  let direto = 0;
  itens.forEach(it => { const t = (Number(it.qtd) || 0) * (Number(it.pu) || 0); const e = it.etapa || "(sem etapa)"; porEtapa[e] = (porEtapa[e] || 0) + t; direto += t; });
  const bdiPct = Number(o.bdi) || 0, bdiVal = direto * bdiPct / 100;
  return { porEtapa, direto, bdiPct, bdiVal, total: direto + bdiVal, n: itens.length };
}

// ── Editor ─────────────────────────────────────────────────────────────────────
function orcEditorHTML(o) {
  const projs = (typeof PROJ !== "undefined") ? PROJ.listar() : [];
  const projOpts = `<option value="">— sem projeto —</option>` + projs.map(p => `<option value="${esc(p.id)}"${p.id === o.projeto_id ? " selected" : ""}>${esc(p.nome)}</option>`).join("");
  const m = (typeof SINAPIDB !== "undefined") ? SINAPIDB.meta() : {};
  const ctx = m.uf ? `SINAPI ${esc(m.uf)} · ${esc(SINAPIDB._regimeLabel ? SINAPIDB._regimeLabel(m.regime) : (m.regime || ""))}${m.competencia ? " · " + esc(SINAPIDB.fmtCompet(m.competencia)) : ""}` : "base estática";
  return `
    <div class="no-print" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
      <button class="back-link" onclick="orcVoltar()"><i class="ti ti-arrow-left"></i> Todos os orçamentos</button>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn sm" onclick="orcCSV('${o.id}')"><i class="ti ti-table-export"></i> CSV (Excel)</button>
        <button class="btn sm" onclick="window.print()"><i class="ti ti-printer"></i> Imprimir / PDF</button>
        <button class="btn sm" onclick="orcGerarCronograma('${o.id}')" title="Cria um cronograma (e24) com 1 atividade por etapa, valor com BDI"><i class="ti ti-timeline-event"></i> Gerar cronograma</button>
        <button class="btn sm" onclick="orcDuplicar('${o.id}')" title="Duplicar como nova versão"><i class="ti ti-copy"></i> Nova versão</button>
        <button class="btn sm" style="color:#b3261e" onclick="orcExcluir('${o.id}')"><i class="ti ti-trash"></i> Excluir</button>
      </div>
    </div>
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
        <div class="field" style="flex:2;min-width:200px"><label>Nome</label><input value="${esc(o.nome)}" onchange="orcMeta('${o.id}','nome',this.value)"></div>
        <div class="field" style="flex:1;min-width:170px"><label>Projeto vinculado</label><select class="sinapi-uf" onchange="orcMeta('${o.id}','projeto_id',this.value)">${projOpts}</select></div>
        <div class="field" style="width:120px"><label>BDI (%)</label><input type="number" min="0" step="0.1" value="${o.bdi != null ? o.bdi : 0}" onchange="orcMeta('${o.id}','bdi',this.value)"></div>
      </div>
      <p class="page-sub" style="margin:8px 0 0;font-size:12px"><i class="ti ti-receipt"></i> Preços de referência: <strong>${ctx}</strong> (mude UF/regime na sub-aba SINAPI). Custo direto vem da SINAPI; BDI e preços finais são do RT.</p>
    </div>
    <div class="card" style="margin-bottom:14px">
      <h3 class="fin-h">Adicionar itens</h3>
      <div class="no-print" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
        <input id="orc-busca" placeholder="Buscar composição SINAPI (código ou descrição)…" value="${esc(_orcBusca)}" oninput="orcBuscar('${o.id}',this.value)" style="flex:1;min-width:240px">
        <button class="btn sm" onclick="orcItemAvulso('${o.id}')"><i class="ti ti-plus"></i> Item avulso</button>
      </div>
      <div id="orc-result" class="orc-result"></div>
      ${orcTabelaHTML(o)}
    </div>
    <div class="card" id="orc-resumo">${orcResumoHTML(o)}</div>
    <p class="page-sub" style="margin-top:12px;font-size:12px"><i class="ti ti-info-circle"></i> Apoio ao planejamento — não substitui o orçamento do responsável técnico. A pré-montagem por IA a partir do projeto/EAP (f5/f14/f16) é evolução prevista no plano.</p>`;
}

function orcTabelaHTML(o) {
  const itens = o.itens || [];
  if (!itens.length) return `<p class="page-sub" style="margin:0">Sem itens. Busque uma composição SINAPI acima ou adicione um item avulso.</p>`;
  const linhas = itens.map(it => {
    const total = (Number(it.qtd) || 0) * (Number(it.pu) || 0);
    return `<tr>
      <td><input value="${esc(it.etapa || "")}" onchange="orcItemSet('${o.id}','${it.id}','etapa',this.value)" placeholder="etapa" style="min-width:90px"></td>
      <td>${it.tipo === "sinapi" ? `<span class="code" style="font-size:11px;color:var(--text-3)">${esc(it.codigo)}</span> ` : ""}<input value="${esc(it.descricao || "")}" onchange="orcItemSet('${o.id}','${it.id}','descricao',this.value)" style="min-width:170px"></td>
      <td><input value="${esc(it.unidade || "")}" onchange="orcItemSet('${o.id}','${it.id}','unidade',this.value)" style="width:54px"></td>
      <td><input type="number" min="0" step="0.01" value="${it.qtd != null ? it.qtd : ""}" onchange="orcItemSet('${o.id}','${it.id}','qtd',this.value)" style="width:72px"></td>
      <td><input type="number" min="0" step="0.01" value="${it.pu != null ? it.pu : ""}" onchange="orcItemSet('${o.id}','${it.id}','pu',this.value)" style="width:96px"></td>
      <td class="price" style="text-align:right;white-space:nowrap">${orcBRL(total)}</td>
      <td class="no-print"><button class="btn sm icon-only" title="Remover" onclick="orcItemRemove('${o.id}','${it.id}')"><i class="ti ti-x"></i></button></td>
    </tr>`;
  }).join("");
  return `<div style="overflow-x:auto"><table class="data" style="min-width:640px"><thead><tr>
    <th>Etapa</th><th>Descrição</th><th>Unid.</th><th>Qtd</th><th>PU</th><th style="text-align:right">Total</th><th class="no-print"></th>
    </tr></thead><tbody>${linhas}</tbody></table></div>`;
}

function orcResumoHTML(o) {
  const t = orcTotais(o);
  const etapas = Object.keys(t.porEtapa);
  const linhasEtapa = etapas.length
    ? etapas.map(e => `<tr><td>${esc(e)}</td><td class="price" style="text-align:right">${orcBRL(t.porEtapa[e])}</td><td style="text-align:right;color:var(--text-3)">${t.direto ? (t.porEtapa[e] / t.direto * 100).toFixed(1) : "0"}%</td></tr>`).join("")
    : `<tr><td colspan="3" class="page-sub">Sem itens.</td></tr>`;
  return `<h3 class="fin-h">Resumo por etapa</h3>
    <table class="data" style="margin-bottom:14px"><thead><tr><th>Etapa</th><th style="text-align:right">Custo direto</th><th style="text-align:right">%</th></tr></thead><tbody>${linhasEtapa}</tbody></table>
    <div class="orc-tot">
      <div class="orc-tot-row"><span>Custo direto (SINAPI + avulsos)</span><strong>${orcBRL(t.direto)}</strong></div>
      <div class="orc-tot-row"><span>BDI (${t.bdiPct}%)</span><strong>${orcBRL(t.bdiVal)}</strong></div>
      <div class="orc-tot-row orc-tot-total"><span>Total do orçamento</span><strong>${orcBRL(t.total)}</strong></div>
    </div>`;
}

// ── Export CSV ───────────────────────────────────────────────────────────────
function orcCsvCell(v) { const s = String(v == null ? "" : v); return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function orcCSV(id) {
  const o = ORC.get(id); if (!o) return;
  const t = orcTotais(o);
  const rows = [["Etapa", "Tipo", "Codigo", "Descricao", "Unidade", "Qtd", "PU", "Total"]];
  (o.itens || []).forEach(it => rows.push([it.etapa || "", it.tipo || "", it.codigo || "", it.descricao || "", it.unidade || "", orcNum(it.qtd), orcNum(it.pu), orcNum((Number(it.qtd) || 0) * (Number(it.pu) || 0))]));
  rows.push([], ["", "", "", "", "", "", "Custo direto", orcNum(t.direto)], ["", "", "", "", "", "", "BDI " + t.bdiPct + "%", orcNum(t.bdiVal)], ["", "", "", "", "", "", "TOTAL", orcNum(t.total)]);
  const csv = "﻿" + rows.map(r => r.map(orcCsvCell).join(";")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (o.nome || "orcamento").replace(/[^\w\-]+/g, "_") + "_v" + (o.versao || 1) + ".csv";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ── Integração e24: gera um cronograma com 1 atividade por etapa (valor com BDI) ──
async function orcGerarCronograma(id) {
  // a52 P2 (21/set/2026): o js/cronograma.js chega quando o Cronograma abre — e este botão é o caminho em que
  // alguém o usa SEM ter aberto. Buscá-lo aqui é o que mantém o botão funcionando; a frase de indisponível, que
  // antes era inalcançável, passou a ser a resposta honesta para a rede que não trouxe o arquivo.
  if (typeof MODULOS !== "undefined") { try { await MODULOS.garantir("cronograma"); } catch (e) {} }
  if (typeof CRONO === "undefined" || typeof cAddDias !== "function") { toast("Módulo de cronograma indisponível.", "error"); return; }
  const o = ORC.get(id); if (!o) return;
  const t = orcTotais(o);
  const etapas = Object.keys(t.porEtapa).filter(e => e !== "(sem etapa)");
  if (!etapas.length) { toast("Defina a etapa dos itens antes de gerar o cronograma.", "warn"); return; }
  const fator = 1 + t.bdiPct / 100;
  let d = cHoje();
  const ats = etapas.map(e => { const a = { id: CBStore.uuid(), etapa: e, nome: e, inicio: d, dur: 15, valor: Math.round(t.porEtapa[e] * fator), avanco: 0, marco: false, dep: "" }; d = cAddDias(d, 15); return a; });
  const cid = CBStore.uuid();
  CRONO.upsert({ id: cid, nome: (o.nome || "Obra") + " — cronograma", inicio: cHoje(), projeto_id: o.projeto_id || "", obs: "Gerado do orçamento " + (o.nome || ""), atividades: ats, dono: CBStore.uid() });
  toast("Cronograma criado a partir das etapas do orçamento. Ajuste as durações em Cronograma de obra.", "success");
}
