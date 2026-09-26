// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// e10 — Manutenção 2.0: Manual do Proprietário → cronograma por IA. O usuário anexa o Manual de Uso,
// Operação e Manutenção (PDF, bucket PRIVADO 'manuais'); o front extrai o texto com PDF.js
// (PDFV._carregarLib, reaproveitado do e6) e a Edge Function manual-cronograma pede ao Claude um
// PLANO NBR 5674 estruturado, citando a fonte. O usuário revisa e "aplica" cada item como
// agendamento (e8/AGE). Offline-first (cbColecao); Storage + IA degradam com aviso (sem quebrar).
// Origem rastreável: github.com/pessoa1234-brazil/maintenance-flux.

const MANUAL_BUCKET = "manuais";

function rowToManual(r) {
  return {
    id: r.id, empreendimento: r.empreendimento || "", ativo_id: r.ativo_id || "", titulo: r.titulo,
    arquivo_path: r.arquivo_path || "", status: r.status || "rascunho", cronograma: r.cronograma || [],
    obs: r.obs || "", dono: r.user_id
  };
}
function manualToRow(m) {
  return {
    id: m.id, user_id: m.dono || CBStore.uid(), empreendimento: m.empreendimento || null,
    ativo_id: m.ativo_id || null, titulo: m.titulo, arquivo_path: m.arquivo_path || null,
    status: m.status || "rascunho", cronograma: m.cronograma || [], obs: m.obs || null
  };
}
const MANUAIS = cbColecao("manuais", "cb-manuais", rowToManual, manualToRow);
async function manualReady() { await MANUAIS.ready(); }

function manualSlug(nome) {
  return String(nome || "manual.pdf").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(-80) || "manual.pdf";
}
function manualAviso(msg) {
  return `<p class="page-sub" style="margin:8px 0 0;font-size:12.5px;color:var(--amber)"><i class="ti ti-alert-triangle"></i> ${esc(msg)}</p>`;
}

// Extrai o texto do PDF no cliente (PDF.js, sob demanda). Cap de páginas/tamanho p/ limitar tokens.
async function manualExtrairTexto(file) {
  try {
    if (typeof PDFV === "undefined" || !PDFV._carregarLib) return "";
    const lib = await PDFV._carregarLib();
    const buf = new Uint8Array(await file.arrayBuffer());
    const doc = await lib.getDocument({ data: buf }).promise;
    let txt = "";
    const max = Math.min(doc.numPages, 40);
    for (let p = 1; p <= max; p++) {
      const pg = await doc.getPage(p);
      const c = await pg.getTextContent();
      txt += c.items.map(i => i.str).join(" ") + "\n";
      if (txt.length > 40000) break;
    }
    return txt.slice(0, 40000);
  } catch (e) { console.warn("manualExtrairTexto:", e && e.message); return ""; }
}

async function manualUploadPDF(manualId, file) {
  const uid = CBStore.uid();
  const path = uid + "/" + manualId + "/" + manualSlug(file.name);
  const up = await window.supa.storage.from(MANUAL_BUCKET).upload(path, file, { upsert: true, contentType: file.type || "application/pdf" });
  if (up.error) throw up.error;
  return path;
}

// ════════════════════════════ Render (aba "Manual") ════════════════════════════
let _manualExtrair = null;   // id do manual com o painel de extração aberto
let _manualVer = null;       // id do manual com o cronograma expandido

function renderMntManual() {
  const body = document.getElementById("mnt-body");
  if (!body) return;
  const manuais = MANUAIS.listar();
  const emps = (typeof ATV !== "undefined" ? [...new Set(ATV.listar().map(a => a.empreendimento).filter(Boolean))] : []);
  body.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <h3 style="margin:0 0 4px"><i class="ti ti-book"></i> Manual do proprietário → cronograma por IA</h3>
      <p class="page-sub" style="margin:0 0 12px">Anexe o Manual de Uso, Operação e Manutenção (PDF). A IA monta o plano de manutenção preventiva (NBR 5674) com a fonte citada — você revisa e envia cada item para os <strong>Agendamentos</strong>.</p>
      <div class="field-row">
        <div class="field"><label>Título *</label><input type="text" id="man-titulo" placeholder="ex.: Manual do Edifício Aurora"></div>
        <div class="field"><label>Empreendimento</label><input type="text" id="man-emp" list="man-emps" placeholder="ex.: Edifício Aurora"><datalist id="man-emps">${emps.map(e => `<option value="${esc(e)}">`).join("")}</datalist></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Ativo (opcional)</label><select id="man-ativo">${typeof ativoOptions === "function" ? ativoOptions("") : `<option value="">— sem ativo —</option>`}</select></div>
        <div class="field"><label>Arquivo do manual (PDF)</label><input type="file" id="man-file" accept="application/pdf"></div>
      </div>
      <button class="btn primary" onclick="salvarManual()"><i class="ti ti-plus"></i> Adicionar manual</button>
      <span id="man-save-status"></span>
    </div>
    ${manuais.length === 0 ? `<p class="page-sub" style="text-align:center;padding:18px">Nenhum manual cadastrado ainda.</p>` : manualListaHTML(manuais)}`;
}

function manualListaHTML(manuais) {
  const stPill = { rascunho: ["Rascunho", "gray"], enviado: ["PDF anexado", "blue"], processado: ["Cronograma pronto", "teal"] };
  const grupos = {};
  manuais.forEach(m => { const e = m.empreendimento || "Sem empreendimento"; (grupos[e] = grupos[e] || []).push(m); });
  return Object.keys(grupos).sort().map(emp => `
    <div class="card" style="margin-bottom:12px">
      <h3 style="margin-bottom:8px"><i class="ti ti-building-community" style="color:var(--text-2)"></i> ${esc(emp)}</h3>
      ${grupos[emp].map(m => {
        const st = stPill[m.status] || stPill.rascunho;
        const nItens = (m.cronograma || []).length;
        const at = m.ativo_id && typeof ATV !== "undefined" ? ATV.get(m.ativo_id) : null;
        return `
        <div class="ativo-item" style="flex-direction:column;align-items:stretch">
          <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start">
            <div style="flex:1;min-width:200px">
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <strong>${esc(m.titulo)}</strong>
                <span class="pill pill-${st[1]}">${st[0]}</span>
                ${nItens ? `<span class="pill pill-blue">${nItens} atividade(s)</span>` : ""}
              </div>
              ${at ? `<p style="font-size:12.5px;color:var(--text-2);margin-top:3px"><i class="ti ti-package"></i> ${esc(at.nome)}</p>` : ""}
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start">
              <button class="btn" onclick="_manualExtrair=(_manualExtrair==='${m.id}'?null:'${m.id}');_manualVer=null;renderMntManual()"><i class="ti ti-sparkles"></i> ${nItens ? "Refazer" : "Gerar"} cronograma (IA)</button>
              ${nItens ? `<button class="btn" onclick="_manualVer=(_manualVer==='${m.id}'?null:'${m.id}');_manualExtrair=null;renderMntManual()"><i class="ti ti-list-check"></i> Cronograma (${nItens})</button>` : ""}
              ${m.arquivo_path ? `<button class="btn icon-only" title="Baixar PDF" onclick="baixarManualPDF('${m.id}')"><i class="ti ti-download"></i></button>` : ""}
              <button class="btn icon-only" title="Excluir" onclick="excluirManual('${m.id}')"><i class="ti ti-trash"></i></button>
            </div>
          </div>
          ${_manualExtrair === m.id ? manualExtrairHTML(m) : ""}
          ${_manualVer === m.id ? manualCronogramaHTML(m) : ""}
        </div>`;
      }).join("")}
    </div>`).join("");
}

function manualExtrairHTML(m) {
  return `
    <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
      <p class="page-sub" style="margin:0 0 8px">A IA lê o texto do manual e monta o plano NBR 5674. Anexe o PDF (lido aqui no navegador) ou cole o texto do manual.</p>
      <div class="field"><label>PDF do manual</label><input type="file" id="man-ex-file" accept="application/pdf"></div>
      <div class="field"><label>…ou cole o texto do manual</label><textarea id="man-ex-texto" rows="3" placeholder="Cole aqui o texto do manual, se preferir."></textarea></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn primary" onclick="manualExecutarExtracao('${m.id}')"><i class="ti ti-sparkles"></i> Extrair cronograma com IA</button>
        <button class="btn" onclick="_manualExtrair=null;renderMntManual()">Cancelar</button>
      </div>
      <div id="man-ex-status" aria-live="polite"></div>
      <p class="page-sub" style="font-size:11.5px;margin-top:8px"><i class="ti ti-info-circle"></i> Material de apoio — não substitui o responsável técnico. Revise os prazos no manual e na NBR 5674 vigente.</p>
    </div>`;
}

function manualCronogramaHTML(m) {
  const itens = m.cronograma || [];
  const pendentes = itens.filter(i => !i.aplicado).length;
  return `
    <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:6px">
        <strong style="font-size:13.5px">Plano de manutenção (NBR 5674)</strong>
        ${pendentes ? `<button class="btn sm primary" onclick="manualAplicarTodos('${m.id}')"><i class="ti ti-calendar-plus"></i> Aplicar todos (${pendentes})</button>` : `<span class="pill pill-teal">Todos aplicados</span>`}
      </div>
      ${itens.map((it, i) => `
        <div class="cron-item">
          <div style="flex:1;min-width:200px">
            <p style="font-size:14px;font-weight:500">${esc(it.atividade || "")}</p>
            <p style="font-size:12.5px;color:var(--text-2)">${esc(it.sistema || "")} · ${periodicidadeLabel(Number(it.periodicidade_meses) || 12)}${it.responsavel ? " · " + esc(it.responsavel) : ""}</p>
            ${it.fonte ? `<p style="font-size:11.5px;color:var(--text-3)"><i class="ti ti-quote"></i> ${esc(it.fonte)}</p>` : ""}
          </div>
          ${it.aplicado ? `<span class="pill pill-teal"><i class="ti ti-check"></i> Agendado</span>` : `<button class="btn sm" onclick="manualAplicarItem('${m.id}',${i})"><i class="ti ti-calendar-plus"></i> Aplicar</button>`}
        </div>`).join("")}
    </div>`;
}

function salvarManual() {
  const titulo = document.getElementById("man-titulo").value.trim();
  if (!titulo) { document.getElementById("man-titulo").focus(); toast("Informe o título do manual.", "warn"); return; }
  const id = CBStore.uuid();
  const fileEl = document.getElementById("man-file");
  const file = fileEl && fileEl.files && fileEl.files[0];
  const manual = {
    id, dono: CBStore.uid(),
    empreendimento: document.getElementById("man-emp").value.trim(),
    ativo_id: document.getElementById("man-ativo").value,
    titulo, arquivo_path: "", status: "rascunho", cronograma: [], obs: ""
  };
  MANUAIS.upsert(manual);
  // Upload do PDF (online). Degrada: sem backend, fica como rascunho (extração por texto colado).
  if (file && window.supa && CBStore.online()) {
    const status = document.getElementById("man-save-status");
    if (status) status.innerHTML = ` <span class="page-sub" style="font-size:12px"><i class="ti ti-loader"></i> enviando PDF…</span>`;
    manualUploadPDF(id, file).then(path => {
      const m = MANUAIS.get(id); if (m) { m.arquivo_path = path; m.status = "enviado"; MANUAIS.upsert(m); }
      toast("Manual adicionado com PDF.", "success"); renderMntManual();
    }).catch(e => {
      console.warn("manualUpload:", e && e.message);
      toast("Manual salvo (o envio do PDF falhou — bucket 'manuais' criado?).", "warn"); renderMntManual();
    });
  } else {
    if (file) toast("Manual salvo. O PDF será anexado quando o backend estiver disponível.", "info");
    else toast("Manual adicionado.", "success");
    renderMntManual();
  }
}

async function excluirManual(id) {
  const m = MANUAIS.get(id); if (!m) return;
  if (!await cbConfirmar(`Excluir o manual "${m.titulo}"? O cronograma já aplicado nos Agendamentos é mantido.`)) return;
  if (m.arquivo_path && window.supa && CBStore.online()) {
    try { window.supa.storage.from(MANUAL_BUCKET).remove([m.arquivo_path]); } catch (e) { /* segue */ }
  }
  MANUAIS.remover(id);
  toast("Manual excluído.", "info");
  renderMntManual();
}

// f50 (23/set/2026): BAIXA o PDF (cbBaixarArquivo, na casca) em vez de NAVEGAR até ele — window.open de URL
// assinada abria aba em branco no host do Supabase, e no iPhone o popup fora do gesto nem abria. O
// `{ download: nome }` faz o Storage mandar Content-Disposition: attachment (vale para quem receber o link
// direto); o nome bonito é o título do manual, não a chave ASCII do Storage.
function manualNomeArquivo(m) {
  const ext = (String(m.arquivo_path || "").match(/\.[A-Za-z0-9]{1,6}$/) || [".pdf"])[0];
  const base = String(m.titulo || "manual").replace(/[\\/:*?"<>|]+/g, "-").trim() || "manual";
  return base.toLowerCase().endsWith(ext.toLowerCase()) ? base : base + ext;
}

// Um toque por arquivo: entre o toque e o fim do download passam dezenas de segundos num 4G ruim, e sem isto o
// segundo toque disparava um SEGUNDO fetch do mesmo arquivo — dois downloads e dois avisos (achado da revisão).
const MANUAL_BAIXANDO = new Set();

async function baixarManualPDF(id) {
  const m = MANUAIS.get(id);
  if (!m || !m.arquivo_path) return;
  if (!window.supa) { toast("Download exige a conta conectada ao backend.", "warn"); return; }
  if (MANUAL_BAIXANDO.has(id)) { toast("Este PDF já está vindo — aguarde.", "info"); return; }
  const nome = manualNomeArquivo(m);
  MANUAL_BAIXANDO.add(id);
  try {
    toast("Buscando o PDF…", "info");   // a tela não fica muda; "buscando" é progresso, não fato (c9)
    const { data, error } = await window.supa.storage.from(MANUAL_BUCKET).createSignedUrl(m.arquivo_path, 3600, { download: cbNomeDownload(nome) });
    if (error) throw error;
    await cbBaixarArquivo(data.signedUrl, nome);
    toast("PDF baixado: " + nome, "success");   // c9: só DEPOIS de os bytes chegarem
  } catch (e) {
    // c9: a frase é da CLASSE do erro. O `if (error) throw error` acima joga aqui o StorageError do supabase-js
    // ("Object not found" quando o arquivo sumiu do bucket) — texto de servidor não vai à tela.
    toast(cbFraseDownload(e, "Não foi possível baixar o PDF. Tente de novo em instantes."), "warn");
  } finally { MANUAL_BAIXANDO.delete(id); }
}

async function manualExecutarExtracao(id) {
  const m = MANUAIS.get(id); if (!m) return;
  const fileEl = document.getElementById("man-ex-file");
  const txtEl = document.getElementById("man-ex-texto");
  const status = document.getElementById("man-ex-status");
  let texto = (txtEl && txtEl.value.trim()) || "";
  const file = fileEl && fileEl.files && fileEl.files[0];
  if (!texto && file) { if (status) status.innerHTML = `<p class="page-sub" style="margin:8px 0 0"><i class="ti ti-loader"></i> Lendo o PDF…</p>`; texto = await manualExtrairTexto(file); }
  if (!texto || texto.length < 40) { if (status) status.innerHTML = manualAviso("Anexe o PDF do manual (com texto selecionável) ou cole o texto para a IA analisar."); return; }
  const C = window.CB_CONFIG || {};
  if (!window.supa || !C.FUNCTIONS_URL) { if (status) status.innerHTML = manualAviso("A extração por IA exige a conta conectada ao backend."); return; }
  try {
    const { data: { session } } = await window.supa.auth.getSession();
    const token = session && session.access_token;
    if (!token) { if (status) status.innerHTML = manualAviso("Faça login para usar a IA."); return; }
    if (status) status.innerHTML = `<p class="page-sub" style="margin:8px 0 0"><i class="ti ti-loader"></i> A IA está montando o cronograma NBR 5674…</p>`;
    const r = await fetch(C.FUNCTIONS_URL + "/manual-cronograma", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, "apikey": C.SUPABASE_ANON_KEY },
      body: JSON.stringify({ texto, titulo: m.titulo }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { if (status) status.innerHTML = manualAviso(d.error || ("Falha (erro " + r.status + "). A função manual-cronograma está deployada?")); return; }
    const itens = (d.itens || []).map(it => ({
      sistema: it.sistema || "", atividade: it.atividade || "",
      periodicidade_meses: Number(it.periodicidade_meses) || 12,
      responsavel: it.responsavel || "", fonte: it.fonte || "Manual", aplicado: false
    }));
    if (!itens.length) { if (status) status.innerHTML = manualAviso("A IA não encontrou atividades no texto enviado."); return; }
    m.cronograma = itens; m.status = "processado"; MANUAIS.upsert(m);
    toast(itens.length + " atividades extraídas do manual.", "success");
    _manualExtrair = null; _manualVer = id; renderMntManual();
  } catch (e) { if (status) status.innerHTML = manualAviso("Não foi possível extrair agora. Tente novamente."); }
}

// Aplica um item do cronograma → cria um agendamento (e8/AGE) datado a partir de hoje.
function manualAplicarItem(id, idx) {
  const m = MANUAIS.get(id); if (!m || !m.cronograma[idx]) return;
  if (typeof AGE === "undefined") { toast("Agendamentos indisponíveis.", "warn"); return; }
  const it = m.cronograma[idx];
  AGE.upsert({
    id: CBStore.uuid(), dono: CBStore.uid(),
    titulo: it.atividade || it.sistema || "Manutenção preventiva",
    ativo_id: m.ativo_id || "",
    data: new Date().toISOString().slice(0, 10),
    periodicidade_meses: it.periodicidade_meses || "",
    resp: it.responsavel || "",
    atividade: (it.sistema ? it.sistema + ": " : "") + (it.atividade || ""),
    status: "agendado"
  });
  m.cronograma[idx] = { ...it, aplicado: true };
  MANUAIS.upsert(m);
  toast("Atividade enviada para os Agendamentos.", "success");
  renderMntManual();
}
function manualAplicarTodos(id) {
  const m = MANUAIS.get(id); if (!m) return;
  if (typeof AGE === "undefined") { toast("Agendamentos indisponíveis.", "warn"); return; }
  const hoje = new Date().toISOString().slice(0, 10);
  let n = 0;
  m.cronograma = (m.cronograma || []).map(it => {
    if (it.aplicado) return it;
    AGE.upsert({
      id: CBStore.uuid(), dono: CBStore.uid(), titulo: it.atividade || it.sistema || "Manutenção preventiva",
      ativo_id: m.ativo_id || "", data: hoje, periodicidade_meses: it.periodicidade_meses || "",
      resp: it.responsavel || "", atividade: (it.sistema ? it.sistema + ": " : "") + (it.atividade || ""), status: "agendado"
    });
    n++;
    return { ...it, aplicado: true };
  });
  MANUAIS.upsert(m);
  toast(n + " atividade(s) enviada(s) para os Agendamentos.", "success");
  renderMntManual();
}

if (typeof window !== "undefined") { window.MANUAIS = MANUAIS; window.manualReady = manualReady; window.renderMntManual = renderMntManual; }
