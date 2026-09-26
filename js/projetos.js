// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// f3 — Ingestão de Projeto/Obra do usuário. O profissional cria um "Projeto" (obra) e envia
// documentos (plantas, memoriais, PDFs) e fotos para um bucket PRIVADO por usuário (0033). O TEXTO
// dos PDFs é extraído no cliente (PDF.js reaproveitado do e6/e10) e guardado — vira CONTEXTO da IA:
// o Assessor passa a responder "com base no SEU projeto" (ai-gateway aceita contextoProjeto).
// Offline-first (cbColecao): metadados + texto funcionam em localStorage; o ARQUIVO em si vai ao
// Storage quando online + bucket aplicado (degrada com aviso, sem perder o texto/contexto).

const PROJ_BUCKET = "projetos";
const PROJ_MAX_BYTES = 15 * 1024 * 1024;   // guarda de tamanho por arquivo (free tier 500 MB)
const PROJ_CTX_MAX = 30000;                // teto do contexto enviado à IA (tokens/custo)

function rowToProj(r) {
  return { id: r.id, nome: r.nome, descricao: r.descricao || "", local: r.local || "", dono: r.user_id };
}
function projToRow(p) {
  return { id: p.id, user_id: p.dono || CBStore.uid(), nome: p.nome, descricao: p.descricao || null, local: p.local || null };
}
function rowToPDoc(r) {
  return {
    id: r.id, projeto_id: r.projeto_id, tipo: r.tipo || "documento", nome: r.nome,
    arquivo_path: r.arquivo_path || "", texto: r.texto || "", tamanho_bytes: r.tamanho_bytes || 0, dono: r.user_id,
    // f61-B (0070): metadados ISO 19650 gravados pelo webhook ao arquivar — o app LÊ (badge/filtro).
    nome_iso: r.nome_iso || "", estado_cde: r.estado_cde || "", disciplina: r.disciplina || "",
    // f61-A3 (0071): link do espelho no Drive ("o Drive manda" — o app só registra e aponta).
    drive_file_id: r.drive_file_id || ""
  };
}
function pdocToRow(d) {
  return {
    id: d.id, user_id: d.dono || CBStore.uid(), projeto_id: d.projeto_id, tipo: d.tipo || "documento",
    nome: d.nome, arquivo_path: d.arquivo_path || null, texto: d.texto || null, tamanho_bytes: d.tamanho_bytes || null,
    // f61-B: só entram no upsert quando EXISTEM — upload feito pelo app não zera o que o webhook
    // gravou, e um ambiente ainda sem a 0070 não quebra o sync por coluna desconhecida.
    ...(d.nome_iso ? { nome_iso: d.nome_iso } : {}),
    ...(d.estado_cde ? { estado_cde: d.estado_cde } : {}),
    ...(d.disciplina ? { disciplina: d.disciplina } : {}),
    ...(d.drive_file_id ? { drive_file_id: d.drive_file_id } : {})
  };
}

// f61-B: filtro da "árvore CDE como visão" (pasta ISO + disciplina) na tela do projeto.
// Clicar no chip ativo desliga o filtro; trocar de projeto zera (abrirProjeto).
let _projFiltroIso = { cde: "", disc: "" };
function projFiltrarIso(campo, valor) {
  _projFiltroIso[campo] = _projFiltroIso[campo] === valor ? "" : valor;
  if (_projAberto) renderProjetoDetalhe(_projAberto);
}

// a59 (22/set/2026): "projetos" é a MESMA tabela da Conferência, com a política "dono OU is_admin() OU
// tem_acesso(...)" (0010) — sem a opção `compartilhavel`, o select("*") da fábrica devolvia ao ADMIN os
// projetos de todas as contas nesta tela também (e o `dono` do rowToProj marcava cada um como de outro).
const PROJ = cbColecao("projetos", "cb-projetos", rowToProj, projToRow, { compartilhavel: "projeto" });
const PDOC = cbColecao("projeto_docs", "cb-projeto-docs", rowToPDoc, pdocToRow);
async function proj2Ready() { await Promise.all([PROJ.ready(), PDOC.ready()]); }

function projSlug(nome) {
  return String(nome || "arquivo").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(-80) || "arquivo";
}
function projFmtBytes(n) {
  n = Number(n) || 0;
  if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(0) + " KB";
  return (n / 1048576).toFixed(1) + " MB";
}
function projTipoDoArquivo(file) {
  if (/^image\//.test(file.type || "")) return "foto";
  return "documento";
}

// Extrai o texto de um PDF no cliente (PDF.js sob demanda). Vazio se não for PDF ou falhar.
async function projExtrairTextoPDF(file) {
  try {
    if (typeof PDFV === "undefined" || !PDFV._carregarLib) return "";
    if (!/pdf$/i.test(file.type || "") && !/\.pdf$/i.test(file.name || "")) return "";
    const lib = await PDFV._carregarLib();
    const buf = new Uint8Array(await file.arrayBuffer());
    const doc = await lib.getDocument({ data: buf }).promise;
    let txt = "";
    const max = Math.min(doc.numPages, 60);
    for (let p = 1; p <= max; p++) {
      const pg = await doc.getPage(p);
      const c = await pg.getTextContent();
      txt += c.items.map(i => i.str).join(" ") + "\n";
      if (txt.length > PROJ_CTX_MAX) break;
    }
    return txt.slice(0, PROJ_CTX_MAX);
  } catch (e) { console.warn("projExtrairTextoPDF:", e && e.message); return ""; }
}

async function projUploadArquivo(projetoId, file) {
  const uid = CBStore.uid();
  const path = uid + "/" + projetoId + "/" + Date.now() + "-" + projSlug(file.name);
  const up = await window.supa.storage.from(PROJ_BUCKET).upload(path, file, { upsert: true, contentType: file.type || "application/octet-stream" });
  if (up.error) throw up.error;
  return path;
}

function projDocs(projetoId) { return PDOC.listar().filter(d => d.projeto_id === projetoId); }
function projBytes(projetoId) { return projDocs(projetoId).reduce((s, d) => s + (Number(d.tamanho_bytes) || 0), 0); }

// Contexto da IA: concatena o texto extraído dos docs do projeto (com cabeçalho por doc), com teto.
function projetoContexto(projetoId) {
  let out = "", n = 0;
  for (const d of projDocs(projetoId)) {
    if (!d.texto) continue;
    const bloco = `### ${d.nome}\n${d.texto}\n\n`;
    if (out.length + bloco.length > PROJ_CTX_MAX) { out += bloco.slice(0, PROJ_CTX_MAX - out.length); break; }
    out += bloco; n++;
  }
  return out.trim();
}

// ── f65: contas a pagar — o AVISO NO APP (o irmão do aviso do WhatsApp) ────────────────────────
// Lê financeiro_titulos (0072): o webhook ESCREVE ao ler boleto/NF arquivado; o app só LÊ (a RLS
// só dá SELECT ao dono — a baixa é PAGO/comprovante no zap, e o card ensina isso). Degradação
// em silêncio: tabela ausente (0072 não aplicada), offline ou erro → o card não aparece.
async function finTitulosPendentes() {
  try {
    if (!window.supa) return [];
    const { data, error } = await window.supa.from("financeiro_titulos")
      .select("id,projeto_id,nome,tipo,vencimento,valor,status")
      .neq("status", "pago").order("vencimento", { ascending: true }).limit(50);
    return error ? [] : (data || []);
  } catch { return []; }
}

// Dias até o vencimento em data LOCAL (parse manual: new Date("AAAA-MM-DD") seria meia-noite UTC
// e no fuso -03 voltaria um dia — mesma lição do dataPlano do admin).
function finDiasAte(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return null;
  const venc = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return Math.round((venc - hoje) / 86400000);
}
function finDataBr(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "sem data";
}
function finValorBr(v) {
  if (v == null || isNaN(Number(v))) return "";
  return " · R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Preenche o host #proj-contas (lista: todas as obras; detalhe: só a obra aberta). Async por
// cima do render síncrono — o card chega quando a leitura volta, sem segurar a tela.
async function projRenderContas(projetoId) {
  const host = document.getElementById("proj-contas");
  if (!host) return;
  const todos = await finTitulosPendentes();
  const meus = projetoId ? todos.filter(t => t.projeto_id === projetoId) : todos;
  const hostAgora = document.getElementById("proj-contas");   // o usuário pode ter navegado
  if (!hostAgora) return;
  if (!meus.length) { hostAgora.innerHTML = ""; return; }

  const linhas = meus.slice(0, 8).map(t => {
    const dias = finDiasAte(t.vencimento);
    const obra = !projetoId && t.projeto_id && PROJ.get(t.projeto_id) ? ` <span style="color:var(--text-3)">· ${esc(PROJ.get(t.projeto_id).nome)}</span>` : "";
    const envio = t.status === "enviado" ? ` <span class="pill pill-gray" title="Você marcou ENVIADO no WhatsApp — avisos suspensos">enviado p/ pagamento</span>` : "";
    let icone = "•", rotulo = t.vencimento ? `vence ${finDataBr(t.vencimento)}` : "sem vencimento", cor = "var(--text-2)";
    if (dias !== null && t.status !== "enviado") {
      if (dias < 0) { icone = "⚠️"; rotulo = `VENCEU ${finDataBr(t.vencimento)}`; cor = "#c0392b"; }
      else if (dias === 0) { icone = "⚠️"; rotulo = "vence HOJE"; cor = "#c0392b"; }
      else if (dias <= 3) { icone = "⏳"; rotulo = `vence em ${dias} dia${dias > 1 ? "s" : ""} (${finDataBr(t.vencimento)})`; cor = "#c97a00"; }
    }
    return `<div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;padding:4px 0">
      <span>${icone}</span><strong>${esc(t.nome)}</strong>
      <span style="color:${cor}">${rotulo}</span><span>${finValorBr(t.valor)}</span>${obra}${envio}
    </div>`;
  }).join("");
  const urgente = meus.some(t => { const d = finDiasAte(t.vencimento); return t.status !== "enviado" && d !== null && d <= 0; });
  hostAgora.innerHTML = `
    <div class="card" style="margin-bottom:14px;border-left:3px solid ${urgente ? "#c0392b" : "#c97a00"}">
      <h3 style="margin:0 0 6px"><i class="ti ti-cash"></i> Contas a pagar${projetoId ? " desta obra" : ""} (${meus.length})</h3>
      ${linhas}
      ${meus.length > 8 ? `<p class="page-sub" style="margin:4px 0 0;font-size:12px">…e mais ${meus.length - 8}.</p>` : ""}
      <p class="page-sub" style="margin:6px 0 0;font-size:12px">Registradas ao arquivar boleto/NF no WhatsApp (f65). Dar baixa: responda <strong>PAGO</strong> no zap — ou mande o comprovante com a legenda "comprovante".</p>
    </div>`;
}

// ── f64: medidor de COMPLETUDE do Manual do Proprietário — a fatia que anda sozinha ────────────
// Heurística DETERMINÍSTICA sobre o acervo (nome/tipo/disciplina): mostra o que o manual da
// NBR 14037 já teria e o que falta arquivar — o manual vira CHECKLIST enquanto a obra anda
// (docs/MANUAL-PROPRIETARIO-PADRAO.md, a "peça central do fluxo"). Zero IA; as regras de
// detecção são a versão inicial e se refinam nas sessões S1/S2 da f64.
const MANUAL_ITENS = [
  { rotulo: "Projeto arquitetônico", dica: "planta/prancha de arquitetura", tem: (d) => d.disciplina === "A" || (d.tipo === "planta" && /arquitet/i.test(d.nome)) },
  { rotulo: "Projetos complementares (EST/ELE/HID)", dica: "estrutural, elétrico ou hidráulico", tem: (d) => ["S", "E", "H"].includes(d.disciplina) || /estrutur|eletric|hidraul|hidrossanit/i.test(d.nome) },
  // (^|[^a-z]) em vez de \b: nome de arquivo usa underscore, que é "word char" — \bART\b não
  // casaria "ART_eletrica.pdf"; e o [^a-z] ainda barra "quARTo"/"pARTida".
  { rotulo: "ART/RRT dos responsáveis", dica: "a anotação de responsabilidade técnica de cada projeto", tem: (d) => /(^|[^a-z])(a\.?r\.?t|rrt)([^a-z]|$)|responsabilidade.tecnica/i.test(d.nome) },
  { rotulo: "Memorial descritivo", dica: "materiais por ambiente (seção 3.2 do manual)", tem: (d) => d.tipo === "memorial" || /memorial/i.test(d.nome) },
  { rotulo: "Habite-se / auto de conclusão", dica: "ancora os prazos de garantia (NBR 17170)", tem: (d) => /habite|auto.de.conclus/i.test(d.nome) },
  { rotulo: "Notas fiscais e boletos", dica: "alimentam materiais (3.2) e fornecedores (4.1)", tem: (d) => /(^|[^a-z])(nf|danfe)([^a-z]|$)|nota.fiscal|boleto|fatura/i.test(d.nome) },
  { rotulo: "Contratos de execução/fornecimento", dica: "viram a relação de fornecedores (4.1)", tem: (d) => /contrato/i.test(d.nome) },
  { rotulo: "Manuais de equipamentos", dica: "aquecedor, bombas, esquadrias…", tem: (d) => /manual/i.test(d.nome) },
  { rotulo: "Fotos da obra", dica: "o registro do executado (07_FOTOS)", tem: (d) => d.tipo === "foto" },
];
function manualCompletudeHTML(docs, projetoId) {
  if (!docs.length) return "";
  const itens = MANUAL_ITENS.map(it => ({ ...it, n: docs.filter(it.tem).length }));
  const ok = itens.filter(i => i.n).length;
  return `<div class="card" style="margin-bottom:14px">
    <h3 style="margin:0 0 4px"><i class="ti ti-checklist"></i> Manual do Proprietário — cobertura do acervo (${ok}/${itens.length})</h3>
    <p class="page-sub" style="margin:0 0 8px">O manual da NBR 14037 (f64) se preenche com o que a obra arquiva. O que já tem e o que falta:</p>
    ${itens.map(i => `<div style="display:flex;gap:8px;align-items:baseline;padding:2px 0">
      <span style="color:${i.n ? "#1a7a4a" : "var(--text-3)"}">${i.n ? "✓" : "○"}</span>
      <span${i.n ? "" : ' style="color:var(--text-3)"'}>${i.rotulo}${i.n ? ` <span style="color:var(--text-3);font-size:12px">(${i.n})</span>` : ` — <span style="font-size:12px">${i.dica}</span>`}</span>
    </div>`).join("")}
    <p class="page-sub" style="margin:8px 0 0;font-size:12px">Detecção pelo nome/tipo dos arquivos — heurística inicial, refinada nas sessões da f64. Mande pelo WhatsApp que eu arquivo na pasta certa (f61).</p>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px">
      <button class="btn primary" onclick="gerarManualObra('${projetoId}')"><i class="ti ti-file-type-docx"></i> Gerar manual (Word)</button>
      <span id="manual-gerar-aviso" class="page-sub" style="font-size:12px"></span>
    </div>
  </div>`;
}

// f62/f64 S2: CADASTRO da obra (satélite 0078) — o que o RAO imprime no cabeçalho (cliente/
// contratada/contrato) e o Manual usa na 3.1 (endereço/matrícula/áreas/habite-se). Async por
// cima do render (padrão projRenderContas); tolerante à 0078 ausente. Colapsado por padrão.
async function projRenderCadastro(id) {
  const host = document.getElementById("proj-cadastro-host");
  if (!host || !CBStore.online()) return;
  let c = null, semTabela = false;
  try {
    const r = await window.supa.from("projeto_cadastro").select("*").eq("projeto_id", id).maybeSingle();
    if (r.error) semTabela = true; else c = r.data;
  } catch { semTabela = true; }
  const h2 = document.getElementById("proj-cadastro-host");   // re-checa: o usuário pode ter navegado
  if (!h2) return;
  const v = (x) => esc(x == null ? "" : x);
  const areas = (c && c.areas) || {};
  h2.innerHTML = `
  <details class="card" style="margin-bottom:14px" ${c ? "" : "open"}>
    <summary style="cursor:pointer"><strong><i class="ti ti-id"></i> Cadastro da obra</strong>
      <span class="page-sub" style="font-size:12px"> — cabeçalho do RAO (f62) e seção 3.1 do Manual (f64)${c ? " · preenchido" : semTabela ? " · aplique a migration 0078" : " · vazio"}</span></summary>
    <div style="display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-top:10px">
      <label>Cliente (contratante)<br><input class="input" id="cad-cliente" value="${v(c && c.cliente)}"></label>
      <label>Contratada (construtora)<br><input class="input" id="cad-contratada" value="${v(c && c.contratada)}"></label>
      <label>Contrato nº<br><input class="input" id="cad-contrato" value="${v(c && c.contrato)}"></label>
      <label>Endereço<br><input class="input" id="cad-endereco" value="${v(c && c.endereco)}"></label>
      <label>Município/UF<br><input class="input" id="cad-municipio" value="${v(c && c.municipio_uf)}"></label>
      <label>Matrícula do imóvel<br><input class="input" id="cad-matricula" value="${v(c && c.matricula)}"></label>
      <label>Área do terreno (m²)<br><input class="input" id="cad-area-terreno" type="number" step="0.01" value="${v(areas.terreno)}"></label>
      <label>Área construída (m²)<br><input class="input" id="cad-area-construida" type="number" step="0.01" value="${v(areas.construida)}"></label>
      <label>Habite-se (data)<br><input class="input" id="cad-habitese" type="date" value="${v(c && c.habitese_data)}"></label>
      <label style="display:flex;align-items:center;gap:8px;margin-top:18px"><input type="checkbox" id="cad-mobiliada" ${c && c.entrega_mobiliada ? "checked" : ""}> Entrega mobiliada (liga o inventário 3.3–3.10)</label>
    </div>
    <div style="display:flex;gap:8px;align-items:center;margin-top:10px">
      <button class="btn primary" onclick="salvarCadastroObra('${id}')">Salvar cadastro</button>
      <span id="cad-aviso" class="page-sub" style="font-size:12px"></span>
    </div>
  </details>`;
}
async function salvarCadastroObra(id) {
  const g = (i) => { const el = document.getElementById(i); return el && el.value.trim() ? el.value.trim() : null; };
  const aviso = document.getElementById("cad-aviso");
  const areas = {};
  if (g("cad-area-terreno")) areas.terreno = Number(g("cad-area-terreno"));
  if (g("cad-area-construida")) areas.construida = Number(g("cad-area-construida"));
  try {
    const r = await window.supa.from("projeto_cadastro").upsert({
      projeto_id: id, user_id: CBStore.uid(),
      cliente: g("cad-cliente"), contratada: g("cad-contratada"), contrato: g("cad-contrato"),
      endereco: g("cad-endereco"), municipio_uf: g("cad-municipio"), matricula: g("cad-matricula"),
      areas, habitese_data: g("cad-habitese"),
      entrega_mobiliada: !!(document.getElementById("cad-mobiliada") || {}).checked,
    });
    if (aviso) aviso.textContent = r.error ? "Não salvou — a migration 0078 (projeto_cadastro) já foi aplicada?" : "Cadastro salvo — o RAO e o Manual passam a usar estes dados.";
  } catch (e) {
    if (aviso) aviso.textContent = "Erro ao salvar: " + (e && e.message ? e.message : e);
  }
}

// f64 S3: 3.2 MATERIAIS POR AMBIENTE (0080). Esqueleto ÚNICO (a mesma grade p/ todo ambiente —
// o "ambiente sem a linha que os irmãos têm" do manual real morre aqui); marca/linha/referência
// por item; salva por ambiente. Async por cima do render, tolerante à 0080 ausente.
const AMB_ITENS = [["parede", "Parede"], ["piso", "Piso"], ["rodape", "Rodapé"], ["rejunte", "Rejunte"], ["forro", "Forro"], ["bancada", "Bancada"], ["loucas", "Louças"], ["metais", "Metais"], ["esquadrias", "Esquadrias"], ["pintura", "Pintura"]];
async function projRenderAmbientes(id) {
  const host = document.getElementById("proj-ambientes-host");
  if (!host || !CBStore.online()) return;
  let ambs = [], semTabela = false;
  try {
    const r = await window.supa.from("projeto_ambientes").select("id,nome,ordem,itens,obs").eq("projeto_id", id).order("ordem").order("created_at");
    if (r.error) semTabela = true; else ambs = r.data || [];
  } catch { semTabela = true; }
  const h2 = document.getElementById("proj-ambientes-host");
  if (!h2) return;
  const v = (x) => esc(x == null ? "" : x);
  const grade = (a) => `<table class="tbl" style="margin-top:6px"><thead><tr><th>Item</th><th>Marca</th><th>Linha/modelo</th><th>Referência</th></tr></thead><tbody>${AMB_ITENS.map(([k, rot]) => {
    const it = (a.itens || {})[k] || {};
    return `<tr><td>${rot}</td><td><input class="input" data-amb="${a.id}" data-k="${k}" data-f="marca" value="${v(it.marca)}"></td><td><input class="input" data-amb="${a.id}" data-k="${k}" data-f="linha" value="${v(it.linha)}"></td><td><input class="input" data-amb="${a.id}" data-k="${k}" data-f="referencia" value="${v(it.referencia)}"></td></tr>`;
  }).join("")}</tbody></table>`;
  h2.innerHTML = `
  <details class="card" style="margin-bottom:14px">
    <summary style="cursor:pointer"><strong><i class="ti ti-door"></i> Materiais por ambiente</strong>
      <span class="page-sub" style="font-size:12px"> — seção 3.2 do Manual (f64)${semTabela ? " · aplique a migration 0080" : ` · ${ambs.length} ambiente(s)`}</span></summary>
    <p class="page-sub" style="margin:8px 0 0;font-size:12px">A mesma grade para todo ambiente: item sem dado sai como "(não informado)" no manual — lacuna visível, nunca omissão.</p>
    ${ambs.map((a) => `<details class="card" style="margin-top:10px" ${ambs.length <= 2 ? "open" : ""}>
      <summary style="cursor:pointer"><strong>${v(a.nome)}</strong></summary>
      ${grade(a)}
      <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap">
        <input class="input" style="flex:1;min-width:160px" data-amb-obs="${a.id}" placeholder="Observações do ambiente" value="${v(a.obs)}">
        <button class="btn primary sm" onclick="salvarAmbiente('${a.id}')">Salvar</button>
        <button class="btn sm" id="amb-rm-${a.id}" onclick="removerAmbiente('${a.id}','${id}')" title="Remover ambiente"><i class="ti ti-trash"></i></button>
      </div>
    </details>`).join("")}
    <div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap">
      <input class="input" id="amb-novo-nome" style="max-width:220px" placeholder="Novo ambiente (ex.: Sala, Suíte 1)">
      <button class="btn" onclick="novoAmbiente('${id}')"><i class="ti ti-plus"></i> Adicionar ambiente</button>
      <span id="amb-aviso" class="page-sub" style="font-size:12px"></span>
    </div>
  </details>`;
}
async function novoAmbiente(projetoId) {
  const nome = ((document.getElementById("amb-novo-nome") || {}).value || "").trim();
  const aviso = document.getElementById("amb-aviso");
  if (!nome) { if (aviso) aviso.textContent = "Dê um nome ao ambiente."; return; }
  try {
    const r = await window.supa.from("projeto_ambientes").insert({ user_id: CBStore.uid(), projeto_id: projetoId, nome, ordem: Date.now() % 1e9 });
    if (r.error) { if (aviso) aviso.textContent = "Não salvou — a migration 0080 já foi aplicada?"; return; }
    projRenderAmbientes(projetoId);
  } catch (e) { if (aviso) aviso.textContent = "Erro: " + (e && e.message ? e.message : e); }
}
async function salvarAmbiente(ambId) {
  const itens = {};
  document.querySelectorAll(`[data-amb="${ambId}"]`).forEach((el) => {
    const k = el.getAttribute("data-k"), f = el.getAttribute("data-f");
    if (!itens[k]) itens[k] = {};
    itens[k][f] = el.value.trim() || null;
  });
  const obsEl = document.querySelector(`[data-amb-obs="${ambId}"]`);
  const aviso = document.getElementById("amb-aviso");
  try {
    const r = await window.supa.from("projeto_ambientes").update({ itens, obs: obsEl && obsEl.value.trim() ? obsEl.value.trim() : null }).eq("id", ambId);
    if (aviso) aviso.textContent = r.error ? "Erro ao salvar o ambiente." : "Ambiente salvo — o manual passa a imprimir esta grade.";
  } catch (e) { if (aviso) aviso.textContent = "Erro: " + (e && e.message ? e.message : e); }
}
async function removerAmbiente(ambId, projetoId, confirmado) {
  if (!confirmado) {   // confirmação inline (sem diálogo nativo — ver manualValidar): 2º clique remove
    const b = document.getElementById("amb-rm-" + ambId);
    if (b) { b.textContent = "Remover mesmo?"; b.setAttribute("onclick", `removerAmbiente('${ambId}','${projetoId}', true)`); }
    return;
  }
  try { await window.supa.from("projeto_ambientes").delete().eq("id", ambId); } catch { /* segue */ }
  projRenderAmbientes(projetoId);
}

// f64 S3: VALIDAÇÃO FORMAL DO RT (0080). A IA pré-preenche, NUNCA assina: o RT lê o rascunho,
// corrige o que precisar (cadastro/ambientes/acervo), e VALIDA aqui — versão incrementa, e o
// próximo "Gerar manual" sai com a folha de validação (nome/CREA/data) e sufixo "vN VALIDADO".
// Qualquer mudança relevante depois → "Reabrir rascunho" (a v1 fica registrada pelo nº).
async function projRenderManualVal(id) {
  const host = document.getElementById("proj-manual-val-host");
  if (!host || !CBStore.online()) return;
  let m = null, semTabela = false;
  try {
    const r = await window.supa.from("projeto_manual").select("*").eq("projeto_id", id).maybeSingle();
    if (r.error) semTabela = true; else m = r.data;
  } catch { semTabela = true; }
  const h2 = document.getElementById("proj-manual-val-host");
  if (!h2) return;
  const v = (x) => esc(x == null ? "" : x);
  const validado = m && m.status === "validado";
  h2.innerHTML = `
  <div class="card" style="margin-bottom:14px">
    <strong><i class="ti ti-certificate"></i> Validação do Manual pelo RT</strong>
    <span class="page-sub" style="font-size:12px"> — ${semTabela ? "aplique a migration 0080" : validado ? `VALIDADO · versão ${m.versao} · ${v(m.validado_por)}${m.validado_crea ? " · " + v(m.validado_crea) : ""} · ${m.validado_em ? new Date(m.validado_em).toLocaleDateString("pt-BR") : ""}` : "RASCUNHO — pendente de validação"}</span>
    <p class="page-sub" style="margin:6px 0 8px;font-size:12px">O Civilbook pré-preenche; quem valida é o responsável técnico. Ao validar, o próximo "Gerar manual (Word)" sai com a folha de validação (nome, registro, data) e o sufixo da versão — pronto p/ assinatura à caneta e entrega. Nenhum conteúdo é assinado por sistema.</p>
    ${validado ? `<button class="btn" onclick="manualReabrir('${id}')"><i class="ti ti-pencil"></i> Reabrir rascunho (nova versão ao revalidar)</button>` : `
    <div style="display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
      <label>Responsável técnico (nome)<br><input class="input" id="mval-nome" value="${v(m && m.validado_por)}"></label>
      <label>CREA/CAU<br><input class="input" id="mval-crea" value="${v(m && m.validado_crea)}"></label>
    </div>
    <div id="mval-acoes" style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap">
      <button class="btn primary" onclick="manualValidar('${id}')"><i class="ti ti-check"></i> Validar manual (v${(m && m.versao || 0) + 1})</button>
      <span id="mval-aviso" class="page-sub" style="font-size:12px"></span>
    </div>`}
  </div>`;
}
// Confirmação INLINE (dois cliques no próprio botão, sem modal): o diálogo nativo é suprimido no navegador embutido do
// preview e é frágil em PWA standalone/iOS — o botão parecia "não funcionar" (campo, 15/ago).
// 1º clique arma (o botão vira "Confirmar validação" + Cancelar); 2º clique grava.
async function manualValidar(id, confirmado) {
  const nome = ((document.getElementById("mval-nome") || {}).value || "").trim();
  const crea = ((document.getElementById("mval-crea") || {}).value || "").trim();
  const aviso = document.getElementById("mval-aviso");
  if (!nome) { if (aviso) aviso.textContent = "Informe o nome do responsável técnico."; return; }
  if (!confirmado) {
    const acoes = document.getElementById("mval-acoes");
    if (acoes) acoes.innerHTML = `
      <button class="btn primary" onclick="manualValidar('${id}', true)"><i class="ti ti-check"></i> Confirmar validação como RT</button>
      <button class="btn" onclick="projRenderManualVal('${id}')">Cancelar</button>
      <span id="mval-aviso" class="page-sub" style="font-size:12px">${esc(nome)}${crea ? " · " + esc(crea) : ""} — a próxima geração sai marcada como VALIDADA com este nome.</span>`;
    return;
  }
  try {
    let versao = 1;
    try { const r0 = await window.supa.from("projeto_manual").select("versao").eq("projeto_id", id).maybeSingle(); versao = ((r0.data && r0.data.versao) || 0) + 1; } catch { /* primeira */ }
    const r = await window.supa.from("projeto_manual").upsert({ projeto_id: id, user_id: CBStore.uid(), status: "validado", versao, validado_por: nome, validado_crea: crea || null, validado_em: new Date().toISOString() });
    if (r.error) { if (aviso) aviso.textContent = "Não gravou — a migration 0080 já foi aplicada?"; return; }
    projRenderManualVal(id);
  } catch (e) { if (aviso) aviso.textContent = "Erro: " + (e && e.message ? e.message : e); }
}
async function manualReabrir(id) {
  try { await window.supa.from("projeto_manual").update({ status: "rascunho" }).eq("projeto_id", id); } catch { /* segue */ }
  projRenderManualVal(id);
}

// f64 S2: gera o Manual PRÉ-PREENCHIDO em .docx (Edge Function manual-gerar — biblioteca S1 +
// dados desta obra: gatilhos do acervo, cadastro 0078, fornecedores das NFs f65, ARTs, habite-se).
// O RT revisa/edita no Word e valida — a IA nunca assina (f8). Padrão de chamada do analisarProjeto.
async function gerarManualObra(id) {
  const aviso = document.getElementById("manual-gerar-aviso");
  const diz = (t) => { if (aviso) aviso.textContent = t; };
  const C = window.CB_CONFIG || {};
  if (!window.supa || !C.FUNCTIONS_URL) { diz("Gerar o manual exige a conta conectada ao backend."); return; }
  try {
    diz("Montando o manual desta obra…");
    const { data: { session } } = await window.supa.auth.getSession();
    const token = session && session.access_token;
    const r = await fetch(C.FUNCTIONS_URL + "/manual-gerar", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, "apikey": C.SUPABASE_ANON_KEY },
      body: JSON.stringify({ projetoId: id }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { diz(d.error || ("Falha (erro " + r.status + "). A função manual-gerar está deployada?")); return; }
    // f50 (23/set/2026): a frase sai do FATO, nunca da intenção. Até aqui a tela dizia "Baixando…" e chamava
    // window.open — o que o fundador viu no Android foi essa frase sobre uma ABA EM BRANCO. Agora o manual
    // gerado é uma coisa (já está no acervo, dito assim) e o download é outra, com resposta própria.
    const resumo = `${d.nome} — ${(d.sistemas || []).length} sistema(s) condicionais detectados, ${d.resumo && d.resumo.fornecedores || 0} fornecedor(es)`;
    // "está no acervo" é FATO, e quem o responde é o `pdocId` do manual-gerar: lá o insert em projeto_docs é
    // MELHOR-ESFORÇO e o PostgREST DEVOLVE o erro em vez de lançar (b10), então o campo volta null com a
    // função inteira em ok:true. Dizer "baixe por lá" com pdocId null manda a pessoa a uma lista vazia — o
    // mesmo mal do "Baixando…" sobre a aba em branco, só que na frase seguinte (achado da 2ª revisão de
    // 23/set/2026). Sem o campo, o acervo é uma PROMESSA, e a frase não a faz.
    const noAcervo = !!d.pdocId;
    const ondeEsta = noAcervo ? " Ele está no acervo deste projeto — baixe por lá." : " Ele NÃO entrou no acervo deste projeto; gere de novo para baixar.";
    if (!d.url) { diz(`Manual gerado: ${resumo}.${ondeEsta}`); return; }
    diz(`Manual gerado: ${resumo}. Buscando o arquivo…`);
    try {
      await cbBaixarArquivo(d.url, d.nome);
      diz(`Manual baixado: ${d.nome}.`);
    } catch (err) {
      // c9: a frase é da CLASSE do erro (cbFraseDownload só deixa passar a nossa), e a pontuação separa as duas
      // frases — grudadas, a tela lia "…falha desconhecida Ele ficou no acervo".
      const porque = cbFraseDownload(err, "A conexão não completou o download.");
      const saida = noAcervo ? " Ele ficou no acervo deste projeto." : " Toque em Gerar manual de novo.";
      diz(`Manual gerado (${resumo}), mas o download não completou. ${porque}${saida}`);
    }
    if (typeof pdocReady === "function") { /* o doc novo aparece no acervo no próximo render */ }
  } catch (e) {
    // c9 (23/set/2026): a frase é da CLASSE, não a do erro — aqui cai o TypeError do fetch ("Failed to fetch",
    // em inglês) e o do JSON. O detalhe vai ao console, sem nada do pedido.
    try { console.warn("[manual-gerar]", (e && e.name) || "erro"); } catch (x) {}
    diz("Não foi possível gerar o manual agora — confira a conexão e tente de novo.");
  }
}

// ════════════════════════════ Render ════════════════════════════
let _projAberto = null;   // id do projeto aberto (detalhe) | null (lista)

async function renderProjetos(param) {
  if (!planoEhPro()) return renderProjetosUpsell();
  if (!PROJ._loaded || !PDOC._loaded) { app.innerHTML = CBStore.loadingCard("Carregando projetos…"); await proj2Ready(); }
  _projAberto = param || _projAberto;
  app.innerHTML = `
    <h2 class="page-title">Meus projetos</h2>
    <p class="page-sub">Reúna plantas, memoriais e fotos da obra. O texto dos PDFs vira <strong>contexto da IA</strong> — o Assessor responde com base no <strong>seu</strong> projeto. Arquivos privados (só você vê).</p>
    <div id="proj-body"></div>`;
  if (_projAberto && PROJ.get(_projAberto)) renderProjetoDetalhe(_projAberto);
  else { _projAberto = null; renderProjetosLista(); }
}

function renderProjetosUpsell() {
  app.innerHTML = `
    <div class="card" style="max-width:560px;margin:40px auto;text-align:center;padding:36px">
      <div class="card-icon" style="background:var(--blue-light);color:var(--blue);margin:0 auto 16px"><i class="ti ti-lock"></i></div>
      <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">Projetos é um recurso PRO</h2>
      <p style="color:var(--text-2);margin-bottom:20px">Envie plantas, memoriais e fotos da obra para um espaço privado e pergunte à IA <strong>com base no seu projeto</strong>.</p>
      ${typeof cbTesteBotaoHTML === "function" ? cbTesteBotaoHTML('projetos', null, 'btn primary lg') : ""}
    </div>`;
}

function renderProjetosLista() {
  const body = document.getElementById("proj-body");
  if (!body) return;
  const projetos = PROJ.listar().slice().sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
  body.innerHTML = `
    <div id="proj-contas"></div>
    <div class="card" style="margin-bottom:14px">
      <h3 style="margin:0 0 12px"><i class="ti ti-folder-plus"></i> Novo projeto</h3>
      <div class="field-row">
        <div class="field"><label>Nome do projeto / obra *</label><input type="text" id="proj-nome" placeholder="ex.: Residencial Aurora"></div>
        <div class="field"><label>Local (opcional)</label><input type="text" id="proj-local" placeholder="ex.: Maringá/PR"></div>
      </div>
      <div class="field"><label>Descrição (opcional)</label><input type="text" id="proj-desc" placeholder="ex.: edifício residencial, 12 pavimentos"></div>
      <button class="btn primary" onclick="salvarProjeto()"><i class="ti ti-plus"></i> Criar projeto</button>
    </div>
    ${projetos.length === 0 ? `<p class="page-sub" style="text-align:center;padding:18px">Nenhum projeto ainda. Crie o primeiro acima.</p>` :
      `<div class="grid grid-3">${projetos.map(projetoCardHTML).join("")}</div>`}`;
  projRenderContas(null);   // f65: contas de TODAS as obras no topo da lista
}

function projetoCardHTML(p) {
  const docs = projDocs(p.id);
  const comTexto = docs.filter(d => d.texto).length;
  return `<div class="card clickable" onclick="abrirProjeto('${p.id}')">
    <div class="card-icon" style="background:var(--blue-light);color:var(--blue)"><i class="ti ti-folder"></i></div>
    <h3>${esc(p.nome)}</h3>
    <p>${p.local ? esc(p.local) + " · " : ""}${docs.length} arquivo(s)${comTexto ? ` · ${comTexto} com texto p/ IA` : ""}</p>
  </div>`;
}

function renderProjetoDetalhe(id) {
  const body = document.getElementById("proj-body");
  const p = PROJ.get(id);
  if (!body || !p) { _projAberto = null; renderProjetosLista(); return; }
  const docs = projDocs(id).slice().sort((a, b) => (b.id || "").localeCompare(a.id || ""));
  const temCtx = !!projetoContexto(id);
  const cachedAnalise = analiseGet(id);
  // ti-file-vector: o nome "blueprint" não existe no Tabler (conferido na 3.47.0, a52 P1) e a planta vinha sem ícone.
  const tipoIcone = { foto: "ti-photo", planta: "ti-file-vector", memorial: "ti-file-text", documento: "ti-file", outro: "ti-file" };
  // f61-B: a árvore CDE como VISÃO — chips por pasta ISO e disciplina. Só aparecem quando o
  // acervo já tem metadado (0070); acervo antigo (tudo null) vê a tela exatamente como era.
  const DISC_NOME = { A: "Arquitetura", S: "Estrutura", E: "Elétrica", H: "Hidráulica", I: "Interiores" };
  const temIso = docs.some(d => d.estado_cde || d.disciplina);
  const docsVis = docs.filter(d =>
    (!_projFiltroIso.cde || d.estado_cde === _projFiltroIso.cde) &&
    (!_projFiltroIso.disc || d.disciplina === _projFiltroIso.disc));
  const chipsCde = ["01_WIP", "02_COMPARTILHADO", "03_PUBLICADO", "04_ARQUIVO", "05_RECEBIDOS", "06_DOCUMENTOS"]
    .map(e => ({ e, n: docs.filter(d => d.estado_cde === e).length })).filter(x => x.n);
  const chipsDisc = ["A", "S", "E", "H", "I"]
    .map(e => ({ e, n: docs.filter(d => d.disciplina === e).length })).filter(x => x.n);
  const filtroIsoHTML = temIso ? `
    <div class="card" style="margin-bottom:14px">
      <h3 style="margin:0 0 8px"><i class="ti ti-folders"></i> Pastas do CDE (ISO 19650)</h3>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn sm ${!_projFiltroIso.cde ? "primary" : ""}" onclick="projFiltrarIso('cde','')">Todas</button>
        ${chipsCde.map(c => `<button class="btn sm ${_projFiltroIso.cde === c.e ? "primary" : ""}" onclick="projFiltrarIso('cde','${c.e}')">${c.e} (${c.n})</button>`).join("")}
      </div>
      ${chipsDisc.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
        <button class="btn sm ${!_projFiltroIso.disc ? "primary" : ""}" onclick="projFiltrarIso('disc','')">Todas as disciplinas</button>
        ${chipsDisc.map(c => `<button class="btn sm ${_projFiltroIso.disc === c.e ? "primary" : ""}" onclick="projFiltrarIso('disc','${c.e}')">${DISC_NOME[c.e] || c.e} (${c.n})</button>`).join("")}
      </div>` : ""}
      <p class="page-sub" style="margin:8px 0 0;font-size:12px">Pasta e disciplina vêm da classificação ISO 19650 (f28) feita ao arquivar pelo WhatsApp. Arquivos antigos, sem classificação, aparecem em "Todas".</p>
    </div>` : "";
  body.innerHTML = `
    <div id="proj-contas"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
      <button class="btn" onclick="_projAberto=null;renderProjetosLista()"><i class="ti ti-arrow-left"></i> Projetos</button>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn ${temCtx ? "primary" : ""}" onclick="perguntarIAProjeto('${id}')" ${temCtx ? "" : "title='Envie PDFs com texto para habilitar'"}><i class="ti ti-sparkles"></i> Perguntar à IA sobre este projeto</button>
        <button class="btn icon-only" title="Excluir projeto" onclick="excluirProjeto('${id}')"><i class="ti ti-trash"></i></button>
      </div>
    </div>
    <div class="card" style="margin-bottom:14px">
      <h3 style="margin:0 0 2px"><i class="ti ti-folder"></i> ${esc(p.nome)}</h3>
      <p class="page-sub" style="margin:0">${p.local ? esc(p.local) + " · " : ""}${p.descricao ? esc(p.descricao) + " · " : ""}${projFmtBytes(projBytes(id))} em ${docs.length} arquivo(s)</p>
    </div>
    <div class="card" style="margin-bottom:14px;border-left:3px solid var(--blue)">
      <h3 style="margin:0 0 6px"><i class="ti ti-file-pencil"></i> Documento de abertura (IA)</h3>
      <p class="page-sub" style="margin:0 0 10px">Cole as notas/transcrição da reunião de início e a tipologia; a IA estrutura o documento de abertura — ambientes mínimos, normas/legislação, padrões e necessidades complementares — citando a base. Salve no projeto para virar contexto da IA.</p>
      <div class="field"><label>Tipologia</label><input type="text" id="ab-tipologia" placeholder="ex.: residência unifamiliar, clínica odontológica, escola"></div>
      <div class="field"><label>Programa de necessidades / notas da reunião</label><textarea id="ab-programa" rows="4" placeholder="ex.: casa para família de 4, 3 dormitórios (1 suíte), home office, espaço gourmet, 2 vagas; terreno 12×30 em aclive…"></textarea></div>
      <div><button class="btn primary" id="ab-go" onclick="gerarAberturaProjeto('${id}')"><i class="ti ti-wand"></i> Gerar documento de abertura</button></div>
      <div id="ab-resultado" style="margin-top:10px"></div>
    </div>
    <div class="card" style="margin-bottom:14px;border-left:3px solid var(--blue)">
      <h3 style="margin:0 0 6px"><i class="ti ti-microphone-2"></i> Ata de reunião (IA)</h3>
      <p class="page-sub" style="margin:0 0 10px">Suba o <strong>áudio</strong> da reunião (curto) ou <strong>cole a transcrição</strong>. A IA extrai <strong>decisões</strong>, <strong>ações</strong> (responsável e prazo) e <strong>próximos passos</strong> — e você leva para o documento de abertura. <span style="opacity:.8">O bot não entra na chamada (limite do WhatsApp); o caminho é por áudio gravado.</span></p>
      <div class="field"><label>Áudio da reunião (opcional, máx. 15 MB)</label><input type="file" id="ata-audio" accept="audio/*"></div>
      <div class="field"><label>…ou cole a transcrição / anotações</label><textarea id="ata-texto" rows="3" placeholder="Cole aqui a transcrição ou as anotações (para reuniões longas, prefira colar o texto)."></textarea></div>
      <label style="display:flex;align-items:flex-start;gap:8px;font-size:12.5px;margin:2px 0 10px;color:var(--text-2)"><input type="checkbox" id="ata-lgpd" style="margin-top:2px"> <span><i class="ti ti-shield-lock" aria-hidden="true"></i> Confirmo que os participantes têm <strong>ciência da gravação/transcrição</strong> (LGPD).</span></label>
      <button class="btn primary" id="ata-go" onclick="gerarAtaReuniao('${id}')"><i class="ti ti-wand"></i> Gerar ata</button>
      <div id="ata-resultado" style="margin-top:10px"></div>
    </div>
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
        <h3 style="margin:0"><i class="ti ti-upload"></i> Enviar documentos e fotos</h3>
        ${temCtx ? `<button class="btn" onclick="reindexarProjeto('${id}')" title="Reprocessa os PDFs deste projeto para a busca semântica do assessor (RAG / f16)"><i class="ti ti-refresh"></i> Reindexar p/ IA</button>` : ""}
      </div>
      <p class="page-sub" style="margin:0 0 10px">PDFs (plantas, memoriais) têm o texto extraído para a IA. Imagens entram como fotos. Máx. ${projFmtBytes(PROJ_MAX_BYTES)} por arquivo.</p>
      <input type="file" id="proj-files" accept="application/pdf,image/*" multiple>
      <div id="proj-up-status" aria-live="polite" style="margin-top:8px"></div>
    </div>
    <div class="card" style="margin-bottom:14px;border-left:3px solid var(--blue)">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <h3 style="margin:0"><i class="ti ti-radar"></i> Análise do projeto (IA)</h3>
        <button class="btn ${temCtx ? "primary" : ""}" onclick="analisarProjeto('${id}')" ${temCtx ? "" : "title='Envie PDFs com texto para habilitar'"}><i class="ti ti-sparkles"></i> ${cachedAnalise && cachedAnalise.length ? "Reanalisar" : "Analisar projeto"}</button>
      </div>
      <p class="page-sub" style="margin:6px 0 0">A IA revisa o projeto contra normas e boas práticas e aponta interferências, itens faltantes e desvios — com fonte e severidade. Apoio; confirme com o RT.</p>
      <div id="proj-analise">${cachedAnalise && cachedAnalise.length ? analiseInsightsHTML(cachedAnalise) : ""}</div>
    </div>
    <div id="proj-confer-host"></div>
    <div id="proj-confer-doc-host"></div>
    <div id="proj-cadastro-host"></div>
    <div id="proj-ambientes-host"></div>
    ${manualCompletudeHTML(docs, id)}
    <div id="proj-manual-val-host"></div>
    ${filtroIsoHTML}
    ${docs.length === 0 ? `<p class="page-sub" style="text-align:center;padding:14px">Nenhum arquivo enviado ainda.</p>` :
      docsVis.length === 0 ? `<p class="page-sub" style="text-align:center;padding:14px">Nenhum arquivo nessa pasta/disciplina — clique em "Todas" para limpar o filtro.</p>` :
      docsVis.map(d => `
      <div class="ativo-item">
        <div style="flex:1;min-width:200px">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <i class="ti ${tipoIcone[d.tipo] || "ti-file"}" style="color:var(--text-2)"></i>
            <strong>${esc(d.nome)}</strong>
            <span class="pill pill-blue">${esc(d.tipo)}</span>
            ${d.estado_cde ? `<span class="pill pill-gray" title="Pasta do CDE (ISO 19650) decidida pela classificação da f28 ao arquivar">📁 ${esc(d.estado_cde)}</span>` : ""}
            ${d.drive_file_id ? `<a class="pill pill-teal" href="https://drive.google.com/file/d/${esc(d.drive_file_id)}/view" target="_blank" rel="noopener" title="Espelhado no seu Google Drive (f61) — abrir o arquivo lá"><i class="ti ti-brand-google-drive"></i> no Drive ↗</a>` : ""}
            ${d.texto ? `<span class="pill pill-teal" title="${(d.texto || "").length} caracteres p/ IA"><i class="ti ti-sparkles"></i> texto p/ IA</span>` : ""}
            ${(!d.arquivo_path) ? `<span class="pill pill-gray" title="O arquivo não foi enviado ao Storage (offline ou bucket ausente); o texto foi mantido">só texto</span>` : ""}
          </div>
          <p style="font-size:12px;color:var(--text-3);margin-top:3px">${projFmtBytes(d.tamanho_bytes)}${d.nome_iso ? ` · <span title="Nome canônico ISO 19650 (validado ou sugerido pela f28)">${esc(d.nome_iso)}</span>` : ""}${d.disciplina ? ` · ${DISC_NOME[d.disciplina] || esc(d.disciplina)}` : ""}</p>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start">
          ${d.arquivo_path ? `<button class="btn icon-only" title="Baixar" onclick="baixarProjDoc('${d.id}')"><i class="ti ti-download"></i></button>` : ""}
          <button class="btn icon-only" title="Excluir" onclick="excluirProjDoc('${d.id}')"><i class="ti ti-trash"></i></button>
        </div>
      </div>`).join("")}`;
  const fileEl = document.getElementById("proj-files");
  if (fileEl) fileEl.addEventListener("change", (e) => projEnviarArquivos(id, e.target));
  if (temCtx && typeof CONFER !== "undefined") {   // f17: conferir o projeto contra as normas
    CONFER.montarCard("proj-confer-host", { alvoTipo: "projeto", alvoId: id, projetoId: null, titulo: p.nome, dados: () => projetoContexto(id) });
  }
  if (docs.length && typeof CONFER !== "undefined") {   // f29: conferência DOCUMENTAL (padronização) do conjunto de docs
    CONFER.montarCard("proj-confer-doc-host", {
      alvoTipo: "documental", alvoId: id, projetoId: id, titulo: p.nome,
      endpoint: "conferir-documental",
      heading: "Conferência documental — padronização (IA)",
      descricao: "Confere os documentos contra o guia: nome ISO 19650, carimbo/ART, docs faltantes, itens mínimos por disciplina e revisões — pendências por documento, com fonte. Apoio; confirme com o RT.",
      btnLabel: "Conferir documentação",
      dados: () => { const ctx = projetoContexto(id); return ctx || ("Lista de documentos do projeto (sem texto extraído):\n" + projDocs(id).map(d => "- " + d.nome + " (" + d.tipo + ")").join("\n")); },
      extra: { docs: projDocs(id).map(d => ({ nome: d.nome, tipo: d.tipo })) },
    });
  }
  projRenderContas(id);   // f65: contas desta obra — async por cima do render, sem segurar a tela
  projRenderCadastro(id); // f62/f64: cadastro da obra (0078) — cabeçalho do RAO + seção 3.1 do Manual
  projRenderAmbientes(id);   // f64 S3: 3.2 materiais por ambiente (0080)
  projRenderManualVal(id);   // f64 S3: validação formal do RT (0080)
}

function salvarProjeto() {
  const nome = document.getElementById("proj-nome").value.trim();
  if (!nome) { document.getElementById("proj-nome").focus(); toast("Informe o nome do projeto.", "warn"); return; }
  const p = {
    id: CBStore.uuid(), dono: CBStore.uid(), nome,
    descricao: document.getElementById("proj-desc").value.trim(),
    local: document.getElementById("proj-local").value.trim()
  };
  PROJ.upsert(p);
  toast("Projeto criado.", "success");
  abrirProjeto(p.id);
}
function abrirProjeto(id) { _projAberto = id; _projFiltroIso = { cde: "", disc: "" }; navigate("projetos", id); }

async function excluirProjeto(id) {
  const p = PROJ.get(id); if (!p) return;
  if (!await cbConfirmar(`Excluir o projeto "${p.nome}" e todos os seus arquivos? Esta ação não pode ser desfeita.`)) return;
  const docs = projDocs(id);
  if (window.supa && CBStore.online()) {
    const paths = docs.map(d => d.arquivo_path).filter(Boolean);
    if (paths.length) { try { window.supa.storage.from(PROJ_BUCKET).remove(paths); } catch (e) { /* segue */ } }
  }
  docs.forEach(d => PDOC.remover(d.id));
  PROJ.remover(id);
  try { localStorage.removeItem("cb-proj-analise-" + id); } catch (e) {}
  _projAberto = null;
  toast("Projeto excluído.", "info");
  navigate("projetos");
}

async function projEnviarArquivos(projetoId, input) {
  const files = input && input.files ? Array.from(input.files) : [];
  if (input) input.value = "";
  if (!files.length) return;
  const status = document.getElementById("proj-up-status");
  let ok = 0, falhaUp = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (status) status.innerHTML = `<p class="page-sub" style="margin:0"><i class="ti ti-loader"></i> Processando ${i + 1}/${files.length}: ${esc(file.name)}…</p>`;
    if (file.size > PROJ_MAX_BYTES) { if (typeof toast === "function") toast(`"${file.name}" excede ${projFmtBytes(PROJ_MAX_BYTES)} — ignorado.`, "warn"); continue; }
    const texto = await projExtrairTextoPDF(file);
    let arquivo_path = "";
    if (window.supa && CBStore.online()) {
      try { arquivo_path = await projUploadArquivo(projetoId, file); }
      catch (e) { console.warn("projUpload:", e && e.message); falhaUp++; }
    }
    const docId = CBStore.uuid();
    PDOC.upsert({
      id: docId, dono: CBStore.uid(), projeto_id: projetoId,
      tipo: projTipoDoArquivo(file), nome: file.name, arquivo_path, texto, tamanho_bytes: file.size
    });
    if (texto) projIngerirDoc(projetoId, { id: docId, nome: file.name, texto });   // f16: indexa p/ RAG (best-effort)
    ok++;
  }
  if (status) status.innerHTML = "";
  if (ok) toast(`${ok} arquivo(s) adicionado(s)${falhaUp ? ` · ${falhaUp} sem envio ao Storage (texto mantido)` : ""}.`, falhaUp ? "warn" : "success");
  renderProjetoDetalhe(projetoId);
}

async function excluirProjDoc(docId) {
  const d = PDOC.get(docId); if (!d) return;
  if (!await cbConfirmar(`Excluir "${d.nome}"?`)) return;
  if (d.arquivo_path && window.supa && CBStore.online()) { try { window.supa.storage.from(PROJ_BUCKET).remove([d.arquivo_path]); } catch (e) { /* segue */ } }
  const pid = d.projeto_id;
  PDOC.remover(docId);
  toast("Arquivo excluído.", "info");
  renderProjetoDetalhe(pid);
}

// f50 (23/set/2026): BAIXA (cbBaixarArquivo, na casca) em vez de NAVEGAR. O window.open de URL assinada abria
// aba EM BRANCO no host do Supabase para todo formato que o navegador não desenha (.docx, .dwg, .zip), e no
// iPhone o popup depois do await nem abria. `{ download: nome }` põe o Content-Disposition no próprio link.
function projDocNomeArquivo(d) {
  const ext = (String(d.arquivo_path || "").match(/\.[A-Za-z0-9]{1,6}$/) || [""])[0];
  const base = String(d.nome || "arquivo").replace(/[\\/:*?"<>|]+/g, "-").trim() || "arquivo";
  return (!ext || base.toLowerCase().endsWith(ext.toLowerCase())) ? base : base + ext;
}

// Um toque por arquivo: uma planta de 15 MB (PROJ_MAX_BYTES) num 4G ruim leva dezenas de segundos, e sem isto
// o segundo toque baixava o mesmo arquivo duas vezes, com dois avisos (achado da revisão de 23/set/2026).
const PDOC_BAIXANDO = new Set();

async function baixarProjDoc(docId) {
  const d = PDOC.get(docId);
  if (!d || !d.arquivo_path) return;
  if (!window.supa) { toast("Download exige a conta conectada ao backend.", "warn"); return; }
  if (PDOC_BAIXANDO.has(docId)) { toast("Este arquivo já está vindo — aguarde.", "info"); return; }
  const nome = projDocNomeArquivo(d);
  PDOC_BAIXANDO.add(docId);
  try {
    toast("Buscando o arquivo…", "info");   // a tela não fica muda; "buscando" é progresso, não fato (c9)
    const { data, error } = await window.supa.storage.from(PROJ_BUCKET).createSignedUrl(d.arquivo_path, 3600, { download: cbNomeDownload(nome) });
    if (error) throw error;
    await cbBaixarArquivo(data.signedUrl, nome);
    toast("Arquivo baixado: " + nome, "success");   // c9: só DEPOIS de os bytes chegarem
  } catch (e) {
    // c9: a frase é da CLASSE do erro. O `if (error) throw error` acima joga aqui o StorageError do supabase-js
    // ("Object not found" quando a chave do espelho local não existe mais no bucket) — não é texto de tela.
    toast(cbFraseDownload(e, "Não foi possível baixar o arquivo. Tente de novo em instantes."), "warn");
  } finally { PDOC_BAIXANDO.delete(docId); }
}

// f16 — indexa o texto de um doc em projeto_chunks (RAG) via projeto-ingestao. Best-effort (não trava o fluxo).
async function projIngerirDoc(projetoId, doc) {
  try {
    const C = window.CB_CONFIG || {};
    if (!window.supa || !C.FUNCTIONS_URL || !doc || !doc.texto) return;
    const { data: { session } } = await window.supa.auth.getSession();
    const token = session && session.access_token;
    if (!token) return;
    await fetch(C.FUNCTIONS_URL + "/projeto-ingestao", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, "apikey": C.SUPABASE_ANON_KEY },
      body: JSON.stringify({ projetoId, docId: doc.id, fonte: doc.nome || "Documento", texto: doc.texto }),
    });
  } catch (e) { console.warn("projIngerirDoc:", e && e.message); }
}

// f16 — (re)indexa todos os docs com texto do projeto para a busca semântica do assessor.
async function reindexarProjeto(id) {
  const C = window.CB_CONFIG || {};
  if (!window.supa || !C.FUNCTIONS_URL) { toast("Reindexação exige a conta conectada ao backend.", "warn"); return; }
  const docs = projDocs(id).filter(d => d.texto);
  if (!docs.length) { toast("Nenhum documento com texto para indexar.", "warn"); return; }
  toast(`Indexando ${docs.length} documento(s) para a IA…`, "info");
  try {
    const { data: { session } } = await window.supa.auth.getSession();
    const token = session && session.access_token;
    const itens = docs.map(d => ({ docId: d.id, fonte: d.nome || "Documento", texto: d.texto }));
    const r = await fetch(C.FUNCTIONS_URL + "/projeto-ingestao", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, "apikey": C.SUPABASE_ANON_KEY },
      body: JSON.stringify({ projetoId: id, itens }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast("Falha ao indexar: " + (d.error || r.status), "error"); return; }
    toast(`✓ ${d.chunks || 0} trecho(s) indexado(s) para a IA.`, "success");
  } catch (e) { toast("Falha ao indexar (a função projeto-ingestao está deployada?).", "error"); }
}

// Leva ao Assessor IA com o contexto do projeto carregado ("com base no seu projeto").
function perguntarIAProjeto(projetoId) {
  const p = PROJ.get(projetoId);
  const ctx = projetoContexto(projetoId);
  if (!ctx) { toast("Este projeto ainda não tem texto extraído. Envie PDFs com texto selecionável.", "warn"); return; }
  // a52 P2: o Assessor chega quando a aba dele abre — cbAssessor (js/app.js) o busca antes de chamar.
  cbAssessor("consultarProjeto", p ? p.nome : "Projeto", projetoId, ctx);
}

// f5 — Análise de projeto (IA): cache em localStorage por projeto + render por severidade.
function analiseGet(id) { try { return JSON.parse(localStorage.getItem("cb-proj-analise-" + id) || "null"); } catch (e) { return null; } }
function analiseSet(id, insights) { try { localStorage.setItem("cb-proj-analise-" + id, JSON.stringify(insights || [])); } catch (e) {} }

async function analisarProjeto(id) {
  const ctx = projetoContexto(id);
  const host = document.getElementById("proj-analise");
  const aviso = (m) => `<p class="page-sub" style="color:var(--amber);margin-top:10px"><i class="ti ti-alert-triangle"></i> ${esc(m)}</p>`;
  if (!ctx) { toast("Este projeto não tem texto extraído. Envie PDFs com texto selecionável.", "warn"); return; }
  const C = window.CB_CONFIG || {};
  if (!window.supa || !C.FUNCTIONS_URL) { if (host) host.innerHTML = aviso("A análise por IA exige a conta conectada ao backend."); return; }
  if (host) host.innerHTML = `<p class="page-sub" style="margin-top:10px"><i class="ti ti-loader"></i> A IA está analisando o projeto contra normas e boas práticas…</p>`;
  try {
    const { data: { session } } = await window.supa.auth.getSession();
    const token = session && session.access_token;
    if (!token) { if (host) host.innerHTML = aviso("Faça login para usar a análise."); return; }
    const p = PROJ.get(id);
    const r = await fetch(C.FUNCTIONS_URL + "/analise-projeto", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, "apikey": C.SUPABASE_ANON_KEY },
      body: JSON.stringify({ projetoTexto: ctx, nome: p ? p.nome : "" }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { if (host) host.innerHTML = aviso(d.error || ("Falha (erro " + r.status + "). A função analise-projeto está deployada?")); return; }
    const insights = d.insights || [];
    analiseSet(id, insights);
    if (host) host.innerHTML = analiseInsightsHTML(insights);
    toast(insights.length + " insight(s) na análise.", insights.length ? "success" : "info");
  } catch (e) { if (host) host.innerHTML = aviso("Não foi possível analisar agora. Tente novamente."); }
}

function analiseInsightsHTML(insights) {
  if (!insights || !insights.length) return `<p class="page-sub" style="padding:8px 0;color:var(--text-3)">Nenhum insight retornado — o texto do projeto pode estar insuficiente.</p>`;
  const sevOrd = { alta: 0, media: 1, baixa: 2 }, sevCor = { alta: "red", media: "amber", baixa: "teal" }, sevLab = { alta: "Alta", media: "Média", baixa: "Baixa" };
  const catLab = { interferencia: "Interferência", item_faltante: "Item faltante", desvio_norma: "Desvio de norma", legislacao: "Legislação", boa_pratica: "Boa prática" };
  const arr = insights.slice().sort((a, b) => (sevOrd[a.severidade] != null ? sevOrd[a.severidade] : 1) - (sevOrd[b.severidade] != null ? sevOrd[b.severidade] : 1));
  const resumo = { alta: 0, media: 0, baixa: 0 };
  arr.forEach(i => { if (resumo[i.severidade] != null) resumo[i.severidade]++; });
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">
      <span class="pill pill-red">${resumo.alta} alta</span>
      <span class="pill pill-amber">${resumo.media} média</span>
      <span class="pill pill-teal">${resumo.baixa} baixa</span>
    </div>` +
    arr.map(i => `
    <div class="ativo-item" style="border-left:3px solid var(--${sevCor[i.severidade] || "blue"})">
      <div style="flex:1;min-width:200px">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span class="pill pill-${sevCor[i.severidade] || "blue"}">${sevLab[i.severidade] || "—"}</span>
          <span class="pill pill-blue">${esc(catLab[i.categoria] || i.categoria || "")}</span>
          <strong>${esc(i.titulo || "")}</strong>
        </div>
        ${i.descricao ? `<p style="font-size:13px;color:var(--text-2);margin-top:4px">${esc(i.descricao)}</p>` : ""}
        ${i.fonte ? `<p style="font-size:11.5px;color:var(--text-3);margin-top:2px"><i class="ti ti-quote"></i> ${esc(i.fonte)}</p>` : ""}
      </div>
    </div>`).join("") +
    `<p class="page-sub" style="font-size:11.5px;margin-top:10px"><i class="ti ti-info-circle"></i> Material de apoio — não substitui a análise do responsável técnico. Confirme interferências e requisitos nas normas vigentes.</p>`;
}

// f14 — Assistente de start de projeto: gera o Documento de Abertura (IA) e salva como doc do projeto.
async function gerarAberturaProjeto(id) {
  const tipologia = (document.getElementById("ab-tipologia").value || "").trim();
  const programa = (document.getElementById("ab-programa").value || "").trim();
  const go = document.getElementById("ab-go");
  const out = document.getElementById("ab-resultado");
  const aviso = (m) => { if (out) out.innerHTML = `<p class="page-sub" style="color:var(--amber);margin-top:8px"><i class="ti ti-alert-triangle"></i> ${esc(m)}</p>`; };
  if (programa.length < 12) { toast("Cole o programa de necessidades / notas da reunião.", "warn"); return; }
  const C = window.CB_CONFIG || {};
  if (!window.supa || !C.FUNCTIONS_URL) { aviso("O assistente exige a conta conectada ao backend."); return; }
  if (go) { go.disabled = true; go.innerHTML = `<i class="ti ti-loader"></i> Estruturando…`; }
  try {
    const { data: { session } } = await window.supa.auth.getSession();
    const token = session && session.access_token;
    if (!token) { aviso("Faça login para usar o assistente."); return; }
    const r = await fetch(C.FUNCTIONS_URL + "/start-projeto", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, "apikey": C.SUPABASE_ANON_KEY },
      body: JSON.stringify({ tipologia, programa }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { aviso(d.error || ("Falha (erro " + r.status + "). A função start-projeto está deployada?")); return; }
    const fontesHTML = (d.fontes && d.fontes.length) ? `<p style="margin:8px 0 4px;font-weight:600;font-size:13px">Fontes citadas</p><ul style="padding-left:18px;font-size:13px;line-height:1.6">${d.fontes.map(f => `<li>[${f.n}] ${esc(f.fonte || "")}${f.titulo ? " — " + esc(f.titulo) : ""}</li>`).join("")}</ul>` : "";
    if (out) out.innerHTML = `
      <div class="field" style="margin-top:6px"><label>Documento de abertura (editável)</label><textarea id="ab-texto" rows="14" style="font-family:inherit">${esc(d.texto || "")}</textarea></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <button class="btn primary" onclick="salvarAberturaComoDoc('${id}')"><i class="ti ti-device-floppy"></i> Salvar no projeto</button>
        <span class="page-sub" style="margin:0;font-size:12px">Vira contexto da IA + pode ser analisado (f5). Revise e valide (RT).${d.semBase ? " (Base curada limitada.)" : ""}</span>
      </div>
      ${fontesHTML}`;
    toast("Documento de abertura gerado.", "success");
  } catch (e) { aviso("Não foi possível gerar agora. Tente novamente."); }
  finally { if (go) { go.disabled = false; go.innerHTML = `<i class="ti ti-wand"></i> Gerar documento de abertura`; } }
}

function salvarAberturaComoDoc(id) {
  const el = document.getElementById("ab-texto");
  const texto = el ? el.value.trim() : "";
  if (!texto) { toast("Nada a salvar.", "warn"); return; }
  PDOC.upsert({ id: CBStore.uuid(), dono: CBStore.uid(), projeto_id: id, tipo: "documento", nome: "Documento de abertura", arquivo_path: "", texto, tamanho_bytes: texto.length });
  toast("Documento de abertura salvo no projeto.", "success");
  renderProjetoDetalhe(id);
}

// ── f25 — Ata de reunião (IA): áudio/transcrição → decisões, ações (resp.+prazo), próximos passos ──
const _ataCache = {};   // projetoId -> { transcricao, ata } da última geração (p/ "usar no abertura"/copiar)

async function gerarAtaReuniao(id) {
  const lgpd = document.getElementById("ata-lgpd");
  if (!lgpd || !lgpd.checked) { toast("Confirme a ciência dos participantes (LGPD) para gerar a ata.", "warn"); return; }
  const fileEl = document.getElementById("ata-audio"), txtEl = document.getElementById("ata-texto");
  const file = fileEl && fileEl.files && fileEl.files[0];
  const texto = txtEl ? txtEl.value.trim() : "";
  if (!file && texto.length < 20) { toast("Suba um áudio ou cole a transcrição (≥20 caracteres).", "warn"); return; }
  const out = document.getElementById("ata-resultado"), btn = document.getElementById("ata-go");
  const C = window.CB_CONFIG || {};
  if (!window.supa || !C.FUNCTIONS_URL) { if (out) out.innerHTML = `<p class="page-sub">A ata exige a conta conectada ao backend.</p>`; return; }
  if (btn) btn.disabled = true;
  if (out) out.innerHTML = `<p class="page-sub"><i class="ti ti-loader" aria-hidden="true"></i> ${file ? "Transcrevendo e gerando a ata…" : "Gerando a ata…"}</p>`;
  try {
    const payload = { projetoId: id };
    if (file) {
      if (file.size > 15 * 1024 * 1024) { if (out) out.innerHTML = `<p class="page-sub">Áudio maior que 15 MB. Para reuniões longas, cole a transcrição.</p>`; if (btn) btn.disabled = false; return; }
      payload.mime = file.type || "audio/ogg";
      payload.audio = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
    } else { payload.texto = texto; }
    const { data: { session } } = await window.supa.auth.getSession();
    const r = await fetch(C.FUNCTIONS_URL + "/ata-reuniao", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (session && session.access_token), "apikey": C.SUPABASE_ANON_KEY }, body: JSON.stringify(payload) });
    const d = await r.json().catch(() => ({}));
    // 18/set/2026: plano sem IA ou cota esgotada → o botão do caso vem de cbNegacaoIABotaoHTML (js/app.js): com os
    // pagamentos desligados ele leva ao Suporte, não a um "assinar" que não existe (tests/ia-plano.check.mjs (d)).
    if (!r.ok) { if (out) out.innerHTML = `<div class="card" style="margin:0"><p style="margin:0;font-size:13px"><i class="ti ti-alert-triangle" aria-hidden="true"></i> ${esc(d.error || ("Erro " + r.status))}</p></div>` + (typeof cbNegacaoIABotaoHTML === "function" ? cbNegacaoIABotaoHTML(d) : ""); if (btn) btn.disabled = false; return; }
    _ataCache[id] = d;
    if (out) out.innerHTML = ataHTML(id, d);
    if (btn) btn.disabled = false;
  } catch (e) { if (out) out.innerHTML = `<p class="page-sub">Não foi possível gerar a ata (a função ata-reuniao está deployada?).</p>`; if (btn) btn.disabled = false; }
}

function ataHTML(id, d) {
  const a = (d && d.ata) || {};
  const li = (arr) => (Array.isArray(arr) && arr.length) ? `<ul style="margin:4px 0 0;padding-left:18px">${arr.map(x => `<li style="margin:2px 0">${esc(x)}</li>`).join("")}</ul>` : `<p class="page-sub" style="margin:4px 0 0">—</p>`;
  const acoes = (Array.isArray(a.acoes) && a.acoes.length)
    ? `<div style="overflow-x:auto"><table class="data" style="margin-top:4px"><thead><tr><th>Ação</th><th>Responsável</th><th>Prazo</th></tr></thead><tbody>${a.acoes.map(x => `<tr><td>${esc(x.acao)}</td><td>${esc(x.responsavel)}</td><td>${esc(x.prazo)}</td></tr>`).join("")}</tbody></table></div>`
    : `<p class="page-sub" style="margin:4px 0 0">Sem ações registradas.</p>`;
  return `<div class="card" style="margin-top:8px;border-left:3px solid #1a7a4a">
    <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center">
      <strong style="font-size:14px"><i class="ti ti-clipboard-check" aria-hidden="true"></i> Ata da reunião</strong>
      <span style="display:inline-flex;gap:6px">
        <button class="btn sm" onclick="copiarAta('${id}')"><i class="ti ti-copy" aria-hidden="true"></i> Copiar</button>
        <button class="btn sm" onclick="usarAtaNaAbertura('${id}')"><i class="ti ti-file-import" aria-hidden="true"></i> Usar no doc. de abertura</button>
      </span>
    </div>
    ${a.resumo ? `<p style="font-size:13px;margin:8px 0 0">${esc(a.resumo)}</p>` : ""}
    <p style="font-size:12px;font-weight:700;margin:10px 0 0;color:var(--text-2)">Decisões</p>${li(a.decisoes)}
    <p style="font-size:12px;font-weight:700;margin:10px 0 0;color:var(--text-2)">Ações</p>${acoes}
    <p style="font-size:12px;font-weight:700;margin:10px 0 0;color:var(--text-2)">Próximos passos</p>${li(a.proximos_passos)}
    <p style="font-size:11px;color:var(--text-3);margin:10px 0 0"><i class="ti ti-info-circle" aria-hidden="true"></i> Apoio — confirme a ata com os participantes; não substitui o RT.</p>
  </div>`;
}

function ataComoTexto(id) {
  const d = _ataCache[id]; if (!d || !d.ata) return "";
  const a = d.ata;
  let s = "ATA DA REUNIÃO\n\n" + (a.resumo || "") + "\n";
  if (a.decisoes && a.decisoes.length) s += "\nDECISÕES:\n" + a.decisoes.map(x => "- " + x).join("\n") + "\n";
  if (a.acoes && a.acoes.length) s += "\nAÇÕES:\n" + a.acoes.map(x => `- ${x.acao} (resp.: ${x.responsavel}; prazo: ${x.prazo})`).join("\n") + "\n";
  if (a.proximos_passos && a.proximos_passos.length) s += "\nPRÓXIMOS PASSOS:\n" + a.proximos_passos.map(x => "- " + x).join("\n") + "\n";
  return s.trim();
}

function copiarAta(id) {
  const s = ataComoTexto(id); if (!s) return;
  try { navigator.clipboard.writeText(s).then(() => toast("Ata copiada.", "success"), () => toast("Não foi possível copiar.", "warn")); }
  catch (e) { toast("Não foi possível copiar.", "warn"); }
}

function usarAtaNaAbertura(id) {
  const d = _ataCache[id]; if (!d) return;
  const ab = document.getElementById("ab-programa");
  if (!ab) { toast("Abra o card de documento de abertura.", "warn"); return; }
  ab.value = (d.transcricao && d.transcricao.trim()) ? d.transcricao.slice(0, 12000) : ataComoTexto(id);
  ab.dispatchEvent(new Event("input", { bubbles: true }));
  ab.scrollIntoView({ behavior: "smooth", block: "center" });
  toast("Transcrição levada ao documento de abertura. Ajuste e gere.", "success");
}

if (typeof window !== "undefined") {
  window.PROJ = PROJ; window.PDOC = PDOC; window.proj2Ready = proj2Ready;
  window.renderProjetos = renderProjetos; window.projetoContexto = projetoContexto;
  window.gerarAtaReuniao = gerarAtaReuniao; window.copiarAta = copiarAta; window.usarAtaNaAbertura = usarAtaNaAbertura;
  window.gerarManualObra = gerarManualObra;   // f64 S2
  window.salvarCadastroObra = salvarCadastroObra;   // f62/f64 S2 (0078)
  window.novoAmbiente = novoAmbiente; window.salvarAmbiente = salvarAmbiente; window.removerAmbiente = removerAmbiente;   // f64 S3
  window.manualValidar = manualValidar; window.manualReabrir = manualReabrir;   // f64 S3
}
