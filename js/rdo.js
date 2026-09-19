// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// e4 — Diário de Obra (RDO). Acompanhamento da obra por DATA: efetivo, clima (manhã/tarde),
// atividades executadas, ocorrências e fotos. Offline-first (cbColecao): os campos funcionam em
// localStorage; as FOTOS vão para o bucket PRIVADO 'rdo' (0034), comprimidas no cliente. Vínculo
// opcional ao Projeto (f3). Documento imprimível. Base para o f7 (RDO inteligente, IA por cima).

const RDO_BUCKET = "rdo";
const RDO_CLIMA = [
  { id: "bom", label: "Bom", icone: "ti-sun" },
  { id: "nublado", label: "Nublado", icone: "ti-cloud" },
  { id: "chuvoso", label: "Chuvoso", icone: "ti-cloud-rain" },
  { id: "impraticavel", label: "Impraticável", icone: "ti-cloud-bolt" }
];

function rowToRdo(r) {
  return {
    id: r.id, projeto_id: r.projeto_id || "", obra: r.obra || "", data: r.data || "",
    clima: r.clima || {}, efetivo: r.efetivo || [], atividades: r.atividades || "",
    ocorrencias: r.ocorrencias || "", fotos: r.fotos || [], obs: r.obs || "", dono: r.user_id
  };
}
function rdoToRow(d) {
  return {
    id: d.id, user_id: d.dono || CBStore.uid(), projeto_id: d.projeto_id || null, obra: d.obra || null,
    data: d.data, clima: d.clima || {}, efetivo: d.efetivo || [], atividades: d.atividades || null,
    ocorrencias: d.ocorrencias || null, fotos: d.fotos || [], obs: d.obs || null
  };
}
const RDO = cbColecao("rdo", "cb-rdo", rowToRdo, rdoToRow);
async function rdoReady() { await RDO.ready(); }

function rdoSlug(nome) {
  return String(nome || "foto.jpg").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(-60) || "foto.jpg";
}
function climaLabel(id) { const c = RDO_CLIMA.find(x => x.id === id); return c ? c.label : "—"; }
function climaIcone(id) { const c = RDO_CLIMA.find(x => x.id === id); return c ? c.icone : "ti-help"; }
function efetivoTotal(ef) { return (ef || []).reduce((s, e) => s + (Number(e.qtd) || 0), 0); }
function rdoObraNome(r) {
  if (r.projeto_id && typeof PROJ !== "undefined" && PROJ.get(r.projeto_id)) return PROJ.get(r.projeto_id).nome;
  return r.obra || "Obra";
}

// Comprime a imagem no cliente (≤1280px, JPEG) → Blob. Null se não for imagem.
function rdoComprimir(file) {
  return new Promise(function (res) {
    if (!/^image\//.test(file.type || "")) { res(null); return; }
    const reader = new FileReader();
    reader.onload = function () {
      const img = new Image();
      img.onload = function () {
        const max = 1280;
        let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        if (w > max || h > max) { const r = Math.min(max / w, max / h); w = Math.round(w * r); h = Math.round(h * r); }
        const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
        cv.getContext("2d").drawImage(img, 0, 0, w, h);
        cv.toBlob(function (b) { res(b); }, "image/jpeg", 0.8);
      };
      img.onerror = function () { res(null); };
      img.src = reader.result;
    };
    reader.onerror = function () { res(null); };
    reader.readAsDataURL(file);
  });
}
async function rdoUploadFoto(rdoId, blob, nome) {
  const path = CBStore.uid() + "/" + rdoId + "/" + Date.now() + "-" + rdoSlug(nome);
  const up = await window.supa.storage.from(RDO_BUCKET).upload(path, blob, { upsert: true, contentType: "image/jpeg" });
  if (up.error) throw up.error;
  return path;
}

// ════════════════════════════ Render ════════════════════════════
let _rdoForm = null;   // { id, novo, efetivo:[{funcao,qtd}], fotos:[{path,nome}], fotosNovas:[File] }

async function renderRdo(param) {
  if (!planoEhPro()) return renderRdoUpsell();
  if (!RDO._loaded) { app.innerHTML = CBStore.loadingCard("Carregando o diário de obra…"); await rdoReady(); }
  if (typeof PROJ !== "undefined" && !PROJ._loaded && typeof proj2Ready === "function") { try { await proj2Ready(); } catch (e) {} }
  app.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <h2 class="page-title" style="margin-right:auto">Diário de Obra</h2>
      ${typeof EXEMPLO !== "undefined" ? EXEMPLO.botaoBarraHTML("rdo") : ""}
      <button class="btn" onclick="typeof ASSIST!=='undefined'&&ASSIST.abrirCom('rdo')" title="Abrir o assessor já sabendo que você está no RDO (f40)"><i class="ti ti-sparkles" aria-hidden="true"></i> Perguntar à IA</button>
    </div>
    <p class="page-sub">Relatório Diário de Obra (RDO): registre por data o efetivo, o clima, as atividades executadas, ocorrências e fotos. Documento imprimível.</p>
    <div id="rdo-body"></div>`;
  if (param && RDO.get(param)) renderRdoView(param);
  else renderRdoLista();
}

function renderRdoUpsell() {
  app.innerHTML = `
    <div class="card" style="max-width:560px;margin:40px auto;text-align:center;padding:36px">
      <div class="card-icon" style="background:var(--blue-light);color:var(--blue);margin:0 auto 16px"><i class="ti ti-lock"></i></div>
      <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">Diário de Obra é um recurso PRO</h2>
      <p style="color:var(--text-2);margin-bottom:20px">Registre o RDO por data — efetivo, clima, atividades, ocorrências e fotos — com documento imprimível.</p>
      ${typeof cbTesteBotaoHTML === "function" ? cbTesteBotaoHTML('rdo', null, 'btn primary lg') : ""}
      ${typeof EXEMPLO !== "undefined" ? EXEMPLO.botaoUpsellHTML("rdo") : ""}
    </div>`;
}

function renderRdoLista() {
  const body = document.getElementById("rdo-body");
  if (!body) return;
  const itens = RDO.listar().slice().sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  body.innerHTML = `
    ${_rdoForm ? rdoFormHTML() : `<div style="margin-bottom:14px"><button class="btn primary" onclick="abrirRdoForm()"><i class="ti ti-plus"></i> Novo RDO</button></div>`}
    ${(!_rdoForm && typeof RAO_UI !== "undefined") ? RAO_UI.cardHTML() : ""}
    ${(!_rdoForm && itens.length) ? rdoInteligenciaCardHTML() + '<div id="rdo-confer-host"></div>' : ""}
    ${itens.length === 0 ? (typeof EXEMPLO !== "undefined" ? EXEMPLO.vazioHTML("rdo", {
        icone: "ti-notebook", titulo: "Seu diário de obra começa aqui",
        texto: "O RDO registra por data o efetivo, o clima, as atividades, as ocorrências e as fotos — e vira documento imprimível. Leva um minuto por dia e é a memória da obra quando alguém pergunta “o que aconteceu no dia 12?”.",
        ctaLabel: "Criar o primeiro RDO", ctaAcao: "abrirRdoForm()",
      }) : `<p class="page-sub" style="text-align:center;padding:18px">Nenhum RDO lançado ainda.</p>`) : itens.map(rdoCardHTML).join("")}`;
  if (_rdoForm) { rdoRenderEfetivo(); rdoRenderFotosForm(); }
  if (!_rdoForm && itens.length && typeof CONFER !== "undefined") {   // f17: conferência do RDO mais recente
    const r0 = itens[0];
    CONFER.montarCard("rdo-confer-host", {
      alvoTipo: "rdo", alvoId: r0.id, projetoId: r0.projeto_id || null,
      titulo: "RDO " + (r0.data ? new Date(r0.data + "T12:00").toLocaleDateString("pt-BR") : ""),
      dados: () => rdoDadosConferencia(r0),
    });
  }
}

function rdoCardHTML(r) {
  const tot = efetivoTotal(r.efetivo);
  const nFotos = (r.fotos || []).length;
  return `
  <div class="ativo-item">
    <div style="flex:1;min-width:200px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <strong>${r.data ? new Date(r.data + "T12:00").toLocaleDateString("pt-BR") : "—"}</strong>
        <span class="pill pill-blue">${esc(rdoObraNome(r))}</span>
        ${r.clima && r.clima.manha ? `<span class="pill" style="background:var(--bg);color:var(--text-2)"><i class="ti ${climaIcone(r.clima.manha)}"></i> ${climaLabel(r.clima.manha)}${r.clima.tarde && r.clima.tarde !== r.clima.manha ? " / " + climaLabel(r.clima.tarde) : ""}</span>` : ""}
      </div>
      <p style="font-size:12.5px;color:var(--text-2);margin-top:3px">
        ${tot ? `<i class="ti ti-users"></i> ${tot} no efetivo · ` : ""}${nFotos ? `<i class="ti ti-photo"></i> ${nFotos} foto(s) · ` : ""}${r.atividades ? esc(r.atividades.slice(0, 80)) + (r.atividades.length > 80 ? "…" : "") : "sem atividades"}
      </p>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start">
      <button class="btn" onclick="navigate('rdo','${r.id}')"><i class="ti ti-eye"></i> Ver</button>
      <button class="btn" onclick="abrirRdoForm('${r.id}')"><i class="ti ti-edit"></i></button>
      <button class="btn icon-only" title="Excluir" onclick="excluirRdo('${r.id}')"><i class="ti ti-trash"></i></button>
    </div>
  </div>`;
}

function abrirRdoForm(id) {
  const r = id ? RDO.get(id) : null;
  _rdoForm = {
    id: id || CBStore.uuid(), novo: !id,
    efetivo: r ? JSON.parse(JSON.stringify(r.efetivo || [])) : [],
    fotos: r ? JSON.parse(JSON.stringify(r.fotos || [])) : [],
    fotosNovas: []
  };
  renderRdoLista();
  const el = document.getElementById("rdo-form-host"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function rdoFormHTML() {
  const r = _rdoForm.novo ? null : RDO.get(_rdoForm.id);
  const v = (k, d) => esc(r && r[k] != null ? r[k] : (d || ""));
  const projs = (typeof PROJ !== "undefined") ? PROJ.listar() : [];
  const clima = r && r.clima ? r.clima : {};
  const climaSel = (per) => RDO_CLIMA.map(c => `<option value="${c.id}"${clima[per] === c.id ? " selected" : ""}>${c.label}</option>`).join("");
  return `
    <div class="card" id="rdo-form-host" style="margin-bottom:14px;border:1.5px solid var(--blue)">
      <h3 style="margin:0 0 12px"><i class="ti ti-${_rdoForm.novo ? "plus" : "edit"}"></i> ${_rdoForm.novo ? "Novo RDO" : "Editar RDO"}</h3>
      <div class="field-row">
        <div class="field"><label>Data *</label><input type="date" id="rdo-data" value="${v("data", new Date().toISOString().slice(0, 10))}"></div>
        <div class="field"><label>Obra / projeto</label>
          ${projs.length ? `<select id="rdo-projeto"><option value="">— obra avulsa —</option>${projs.map(p => `<option value="${p.id}"${r && r.projeto_id === p.id ? " selected" : ""}>${esc(p.nome)}</option>`).join("")}</select>` : `<input type="text" id="rdo-obra" value="${v("obra")}" placeholder="ex.: Residencial Aurora">`}
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label>Clima — manhã</label><select id="rdo-clima-manha"><option value="">—</option>${climaSel("manha")}</select></div>
        <div class="field"><label>Clima — tarde</label><select id="rdo-clima-tarde"><option value="">—</option>${climaSel("tarde")}</select></div>
      </div>
      <div class="field"><label>Efetivo (mão de obra)</label><div id="rdo-efetivo"></div>
        <button class="btn sm" type="button" onclick="rdoAddEfetivo()"><i class="ti ti-plus"></i> Adicionar função</button></div>
      <div class="field"><label>Atividades executadas</label><textarea id="rdo-ativ" rows="3" placeholder="ex.: Concretagem da laje do 2º pavimento; alvenaria do térreo…">${v("atividades")}</textarea></div>
      <div class="field"><label>Ocorrências</label><textarea id="rdo-ocor" rows="2" placeholder="ex.: Chuva à tarde paralisou a concretagem; falta de material X.">${v("ocorrencias")}</textarea></div>
      <div class="field"><label>Fotos da obra</label>
        <input type="file" id="rdo-fotos-input" accept="image/*" capture="environment" multiple onchange="rdoFotosSelecionadas(this)">
        <div id="rdo-fotos" style="margin-top:8px"></div>
      </div>
      <div class="field"><label>Observações</label><textarea id="rdo-obs" rows="2">${v("obs")}</textarea></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <button class="btn primary" onclick="salvarRdo()"><i class="ti ti-device-floppy"></i> Salvar RDO</button>
        <button class="btn" onclick="_rdoForm=null;renderRdoLista()">Cancelar</button>
        <span id="rdo-save-status" class="page-sub" style="margin:0;font-size:12px"></span>
      </div>
    </div>`;
}

// ---- Efetivo (linhas função + quantidade) ----
function rdoLerEfetivo() {
  if (!_rdoForm) return;
  _rdoForm.efetivo = [...document.querySelectorAll("#rdo-efetivo .rdo-ef-row")].map(row => ({
    funcao: row.querySelector(".ef-func").value, qtd: Number(row.querySelector(".ef-qtd").value) || 0
  }));
}
function rdoRenderEfetivo() {
  const host = document.getElementById("rdo-efetivo"); if (!host) return;
  host.innerHTML = (_rdoForm.efetivo.length ? _rdoForm.efetivo : []).map((e, i) => `
    <div class="rdo-ef-row" style="display:flex;gap:8px;margin-bottom:6px">
      <input type="text" class="aval-in ef-func" placeholder="Função (ex.: Pedreiro)" value="${esc(e.funcao || "")}" style="flex:1">
      <input type="number" class="aval-in ef-qtd" placeholder="Qtd" min="0" value="${e.qtd != null ? e.qtd : ""}" style="width:90px">
      <button class="btn icon-only" type="button" title="Remover" onclick="rdoDelEfetivo(${i})"><i class="ti ti-x"></i></button>
    </div>`).join("") || `<p class="page-sub" style="margin:0 0 6px">Nenhuma função. Some pedreiros, serventes, etc.</p>`;
}
function rdoAddEfetivo() { rdoLerEfetivo(); _rdoForm.efetivo.push({ funcao: "", qtd: "" }); rdoRenderEfetivo(); }
function rdoDelEfetivo(i) { rdoLerEfetivo(); _rdoForm.efetivo.splice(i, 1); rdoRenderEfetivo(); }

// ---- Fotos no formulário ----
function rdoFotosSelecionadas(input) {
  const files = input && input.files ? Array.from(input.files) : [];
  if (input) input.value = "";
  files.forEach(f => { if (/^image\//.test(f.type || "")) _rdoForm.fotosNovas.push(f); });
  rdoRenderFotosForm();
}
function rdoRenderFotosForm() {
  const host = document.getElementById("rdo-fotos"); if (!host) return;
  const exist = _rdoForm.fotos.map((f, i) => `<span class="pill" style="background:var(--bg);color:var(--text-2)"><i class="ti ti-photo"></i> ${esc(f.nome || "foto")} <a href="#" onclick="rdoDelFotoExistente(${i});return false" title="Remover" style="color:var(--red)">×</a></span>`).join("");
  const novas = _rdoForm.fotosNovas.map((f, i) => `<span class="pill pill-teal"><i class="ti ti-upload"></i> ${esc(f.name)} <a href="#" onclick="rdoDelFotoNova(${i});return false" title="Remover" style="color:var(--red)">×</a></span>`).join("");
  host.innerHTML = (exist || novas) ? `<div style="display:flex;gap:8px;flex-wrap:wrap">${exist}${novas}</div>` : `<p class="page-sub" style="margin:0">Nenhuma foto. As novas são enviadas ao salvar.</p>`;
}
function rdoDelFotoExistente(i) { _rdoForm.fotos.splice(i, 1); rdoRenderFotosForm(); }
function rdoDelFotoNova(i) { _rdoForm.fotosNovas.splice(i, 1); rdoRenderFotosForm(); }

async function salvarRdo() {
  const data = document.getElementById("rdo-data").value;
  if (!data) { document.getElementById("rdo-data").focus(); toast("Informe a data do RDO.", "warn"); return; }
  rdoLerEfetivo();
  const status = document.getElementById("rdo-save-status");
  const projetoEl = document.getElementById("rdo-projeto");
  const obraEl = document.getElementById("rdo-obra");
  // envia as fotos novas (best-effort: sem backend/bucket, ignora e avisa)
  const fotos = _rdoForm.fotos.slice();
  let falhaFoto = 0;
  if (_rdoForm.fotosNovas.length) {
    if (window.supa && CBStore.online()) {
      for (let i = 0; i < _rdoForm.fotosNovas.length; i++) {
        const f = _rdoForm.fotosNovas[i];
        if (status) status.innerHTML = `<i class="ti ti-loader"></i> Enviando foto ${i + 1}/${_rdoForm.fotosNovas.length}…`;
        try { const blob = await rdoComprimir(f) || f; const path = await rdoUploadFoto(_rdoForm.id, blob, f.name); fotos.push({ path, nome: f.name }); }
        catch (e) { console.warn("rdoUploadFoto:", e && e.message); falhaFoto++; }
      }
    } else { falhaFoto = _rdoForm.fotosNovas.length; }
  }
  const base = _rdoForm.novo ? null : RDO.get(_rdoForm.id);
  RDO.upsert({
    id: _rdoForm.id, dono: base ? base.dono : CBStore.uid(),
    projeto_id: projetoEl ? projetoEl.value : (base ? base.projeto_id : ""),
    obra: obraEl ? obraEl.value.trim() : (base ? base.obra : ""),
    data,
    clima: { manha: document.getElementById("rdo-clima-manha").value, tarde: document.getElementById("rdo-clima-tarde").value },
    efetivo: _rdoForm.efetivo.filter(e => (e.funcao || "").trim() || e.qtd),
    atividades: document.getElementById("rdo-ativ").value.trim(),
    ocorrencias: document.getElementById("rdo-ocor").value.trim(),
    fotos, obs: document.getElementById("rdo-obs").value.trim()
  });
  const projetoIdSalvo = projetoEl ? projetoEl.value : (base ? base.projeto_id : "");
  _rdoForm = null;
  toast(base ? "RDO atualizado." : "RDO lançado." + (falhaFoto ? ` (${falhaFoto} foto(s) não enviada(s) — backend?)` : ""), falhaFoto ? "warn" : "success");
  renderRdoLista();
  // f57: as fotos NOVAS vão à classificação em background (best-effort — o RDO já está salvo;
  // o cache por hash e o teto diário são da função). Resultado aparece no card do RDO.
  const novas = fotos.slice(fotos.length - (fotos.length - (base && base.fotos ? base.fotos.length : 0)));
  if (novas.length && typeof rdoClassificarFotos === "function") rdoClassificarFotos(novas, projetoIdSalvo);
}

// f57 — dispara a Edge Function classificar-foto p/ cada foto (sequencial, silencioso). O upload
// É o evento (no FrankSherlock era o scan de diretório); no Supabase, dispara aqui.
async function rdoClassificarFotos(fotos, projetoId) {
  const C = window.CB_CONFIG || {};
  if (!window.supa || !C.FUNCTIONS_URL) return;
  try {
    const { data: { session } } = await window.supa.auth.getSession();
    const token = session && session.access_token;
    if (!token) return;
    let n = 0;
    for (const f of fotos) {
      try {
        const r = await fetch(C.FUNCTIONS_URL + "/classificar-foto", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, "apikey": C.SUPABASE_ANON_KEY },
          body: JSON.stringify({ arquivoPath: f.path, bucket: RDO_BUCKET, projetoId: projetoId || null, origem: "rdo", nome: f.nome || null }),
        });
        if (r.ok) n++;
        else if (r.status === 429) { const d = await r.json().catch(() => ({})); toast(d.error || "Teto de classificação de fotos atingido.", "warn"); break; }
      } catch (e) { console.warn("classificar-foto:", e && e.message); }
    }
    if (n) { toast(`${n} foto(s) classificada(s) pela IA — veja no card do RDO.`, "success"); renderRdoLista(); }
  } catch (e) { console.warn("classificar-foto:", e && e.message); }
}

// f57 — botão "Classificar fotos com IA" no RDO aberto (lote sob demanda; cache por hash faz o
// já-classificado sair de graça). Depois re-renderiza a view p/ pintar os resultados.
async function rdoClassificarDoRdo(id) {
  const r = RDO.get(id);
  if (!r || !(r.fotos || []).length) return;
  await rdoClassificarFotos(r.fotos, r.projeto_id || "");
  renderRdoView(id);
}

// f57 — lê as classificações das fotos de um RDO (RLS do dono; tolerante à 0081 ausente).
async function rdoClassificacoes(paths) {
  if (!window.supa || !paths.length) return new Map();
  try {
    const { data, error } = await window.supa.from("foto_classificacoes").select("arquivo_path,categoria,descricao,confianca,tags,patologia,documento").in("arquivo_path", paths);
    if (error || !data) return new Map();
    return new Map(data.map(r => [r.arquivo_path, r]));
  } catch (e) { return new Map(); }
}
const RDO_CAT_ROTULO = { estrutura: "Estrutura", alvenaria_vedacao: "Alvenaria/vedação", instalacoes: "Instalações", acabamento: "Acabamento", patologia: "Patologia", seguranca_epi: "Segurança/EPI", canteiro_logistica: "Canteiro", documento: "Documento", outro: "Outro" };

async function excluirRdo(id) {
  const r = RDO.get(id); if (!r) return;
  if (!await cbConfirmar(`Excluir o RDO de ${r.data ? new Date(r.data + "T12:00").toLocaleDateString("pt-BR") : ""}?`)) return;
  if ((r.fotos || []).length && window.supa && CBStore.online()) {
    try { window.supa.storage.from(RDO_BUCKET).remove(r.fotos.map(f => f.path).filter(Boolean)); } catch (e) { /* segue */ }
  }
  RDO.remover(id);
  toast("RDO excluído.", "info");
  renderRdoLista();
}

// ---- Visão imprimível ----
function renderRdoView(id) {
  const r = RDO.get(id);
  const body = document.getElementById("rdo-body");
  if (!r || !body) { renderRdoLista(); return; }
  const tot = efetivoTotal(r.efetivo);
  body.innerHTML = `
    <div class="no-print" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
      <button class="btn" onclick="navigate('rdo')"><i class="ti ti-arrow-left"></i> Voltar</button>
      <button class="btn" onclick="abrirRdoForm('${r.id}')"><i class="ti ti-edit"></i> Editar</button>
      <button class="btn primary" onclick="window.print()"><i class="ti ti-printer"></i> Imprimir / salvar PDF</button>
    </div>
    <div class="card laudo-print" data-cb-view="rdo-doc">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;border-bottom:2px solid var(--blue);padding-bottom:10px;margin-bottom:14px">
        <div><div style="font-size:13px;color:var(--blue);font-weight:700;letter-spacing:.04em">CIVILBOOK</div>
          <h2 style="margin:2px 0 0">Relatório Diário de Obra</h2></div>
        <div style="text-align:right;font-size:12.5px;color:var(--text-2)">
          <div><strong>${esc(rdoObraNome(r))}</strong></div>
          <div>Data: ${r.data ? new Date(r.data + "T12:00").toLocaleDateString("pt-BR") : "—"}</div>
        </div>
      </div>
      <div class="grid grid-3" style="margin-bottom:12px">
        <div class="card" style="text-align:center"><div style="font-size:22px;font-weight:600"><i class="ti ${climaIcone(r.clima && r.clima.manha)}"></i></div><p>Manhã: ${climaLabel(r.clima && r.clima.manha)}</p></div>
        <div class="card" style="text-align:center"><div style="font-size:22px;font-weight:600"><i class="ti ${climaIcone(r.clima && r.clima.tarde)}"></i></div><p>Tarde: ${climaLabel(r.clima && r.clima.tarde)}</p></div>
        <div class="card" style="text-align:center"><div style="font-size:22px;font-weight:600;color:var(--blue)">${tot}</div><p>Efetivo total</p></div>
      </div>
      ${(r.efetivo || []).length ? `<h3 style="margin:8px 0 6px"><i class="ti ti-users"></i> Efetivo</h3>
        <table class="spec-table">${r.efetivo.map(e => `<tr><td>${esc(e.funcao || "—")}</td><td style="text-align:right">${esc(String(e.qtd || 0))}</td></tr>`).join("")}</table>` : ""}
      <h3 style="margin:16px 0 6px"><i class="ti ti-checkbox"></i> Atividades executadas</h3>
      <p style="font-size:13.5px;white-space:pre-wrap">${esc(r.atividades || "—")}</p>
      <h3 style="margin:16px 0 6px"><i class="ti ti-alert-triangle"></i> Ocorrências</h3>
      <p style="font-size:13.5px;white-space:pre-wrap">${esc(r.ocorrencias || "Sem ocorrências.")}</p>
      ${(r.fotos || []).length ? `<h3 style="margin:16px 0 6px"><i class="ti ti-photo"></i> Fotos</h3>
        <div id="rdo-thumbs" style="display:flex;gap:10px;flex-wrap:wrap">${r.fotos.map((f, i) => `<div style="text-align:center;max-width:160px"><img data-rdo-thumb="${i}" alt="${esc(f.nome || "foto")}" style="width:160px;height:120px;object-fit:cover;border-radius:8px;border:1px solid var(--border);background:var(--bg)"><div style="font-size:11px;color:var(--text-3)">${esc(f.nome || "")}</div><div data-rdo-class="${esc(f.path || "")}" style="font-size:11px;text-align:left"></div></div>`).join("")}</div>
        <p class="no-print" style="font-size:12px;margin-top:6px"><button class="btn sm" onclick="rdoClassificarDoRdo('${r.id}')"><i class="ti ti-sparkles"></i> Classificar fotos com IA</button> <span class="page-sub" style="font-size:12px">— categoria, descrição e, em patologia, manifestação/severidade aparente (confirmar em campo). Foto já classificada não gasta.</span></p>` : ""}
      ${r.obs ? `<h3 style="margin:16px 0 6px"><i class="ti ti-note"></i> Observações</h3><p style="font-size:13.5px;white-space:pre-wrap">${esc(r.obs)}</p>` : ""}
      <p style="font-size:11.5px;color:var(--text-3);margin-top:18px;border-top:1px solid var(--border);padding-top:10px">
        RDO gerado pelo Civilbook. Documento de acompanhamento de obra — confira e valide com o responsável técnico (RT).
      </p>
    </div>`;
  rdoCarregarThumbs(r);
  rdoMostrarClassificacoes(r);   // f57
}

// f57 — pinta a classificação (se houver) sob cada thumb: pill da categoria + descrição; em
// patologia, manifestação/elemento/severidade aparente com o lembrete de confirmar em campo.
async function rdoMostrarClassificacoes(r) {
  const paths = (r.fotos || []).map(f => f.path).filter(Boolean);
  const mapa = await rdoClassificacoes(paths);
  if (!mapa.size) return;
  document.querySelectorAll("[data-rdo-class]").forEach(el => {
    const c = mapa.get(el.getAttribute("data-rdo-class"));
    if (!c) return;
    const pat = c.patologia ? `<div style="color:#b3261e">${esc(c.patologia.manifestacao)} · ${esc(c.patologia.elemento)} · ${esc(c.patologia.severidade_aparente)} <span style="color:var(--text-3)">(confirmar em campo)</span></div>` : "";
    const doc = c.documento ? `<div style="color:var(--text-2)">${esc(c.documento.tipo_documento)}${Object.keys(c.documento.campos || {}).length ? " · " + Object.entries(c.documento.campos).slice(0, 3).map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(" · ") : ""}</div>` : "";
    el.innerHTML = `<span class="pill ${c.categoria === "patologia" ? "pill-red" : "pill-blue"}" title="confiança ${Math.round((c.confianca || 0) * 100)}%">${esc(RDO_CAT_ROTULO[c.categoria] || c.categoria)}</span> <span style="color:var(--text-2)">${esc(c.descricao || "")}</span>${pat}${doc}`;
  });
}

// Carrega as miniaturas das fotos (URLs assinadas do bucket privado), best-effort.
async function rdoCarregarThumbs(r) {
  if (!window.supa || !(r.fotos || []).length) return;
  for (let i = 0; i < r.fotos.length; i++) {
    const f = r.fotos[i];
    if (!f.path) continue;
    try {
      const { data, error } = await window.supa.storage.from(RDO_BUCKET).createSignedUrl(f.path, 3600);
      if (error) continue;
      const img = document.querySelector(`[data-rdo-thumb="${i}"]`);
      if (img) img.src = data.signedUrl;
    } catch (e) { /* segue */ }
  }
}

// ════════════════════════════ f7 — RDO inteligente (insights + memória pesquisável) ════════════════════════════
function rdoHistoricoTexto() {
  const itens = RDO.listar().slice().sort((a, b) => (a.data || "").localeCompare(b.data || ""));
  let out = "";
  for (const r of itens) {
    const ef = (r.efetivo || []).filter(e => e.funcao || e.qtd).map(e => `${e.funcao || "?"} ${e.qtd || 0}`).join(", ");
    const bloco = `RDO ${r.data ? new Date(r.data + "T12:00").toLocaleDateString("pt-BR") : "?"} — ${rdoObraNome(r)}\n`
      + `Clima: manhã ${climaLabel(r.clima && r.clima.manha)} / tarde ${climaLabel(r.clima && r.clima.tarde)}\n`
      + (ef ? `Efetivo: ${ef}\n` : "")
      + (r.atividades ? `Atividades: ${r.atividades}\n` : "")
      + (r.ocorrencias ? `Ocorrências: ${r.ocorrencias}\n` : "")
      + (r.obs ? `Obs: ${r.obs}\n` : "") + "\n";
    if (out.length + bloco.length > 30000) break;
    out += bloco;
  }
  return out.trim();
}

// f17 — dados estruturados de UM RDO para a conferência de conformidade.
function rdoDadosConferencia(r) {
  if (!r) return "";
  const ef = (r.efetivo || []).filter(e => e.funcao || e.qtd).map(e => `${e.funcao || "?"} ${e.qtd || 0}`).join(", ");
  return `RDO de ${r.data ? new Date(r.data + "T12:00").toLocaleDateString("pt-BR") : "?"} — ${rdoObraNome(r)}\n`
    + `Clima: manhã ${climaLabel(r.clima && r.clima.manha)} / tarde ${climaLabel(r.clima && r.clima.tarde)}\n`
    + (ef ? `Efetivo: ${ef}\n` : "")
    + (r.atividades ? `Atividades executadas: ${r.atividades}\n` : "")
    + (r.ocorrencias ? `Ocorrências: ${r.ocorrencias}\n` : "")
    + (r.obs ? `Observações: ${r.obs}\n` : "");
}

function rdoInteligenciaCardHTML() {
  const cached = rdoInsightsGet();
  return `<div class="card" style="margin-bottom:14px;border-left:3px solid var(--blue)">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <h3 style="margin:0"><i class="ti ti-sparkles"></i> Inteligência da obra (IA)</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn primary" onclick="gerarInsightsRdo()"><i class="ti ti-bulb"></i> ${cached && cached.length ? "Reanalisar" : "Gerar insights"}</button>
        <button class="btn" onclick="perguntarIARdo()"><i class="ti ti-message-2"></i> Perguntar à IA sobre a obra</button>
      </div>
    </div>
    <p class="page-sub" style="margin:6px 0 0">A IA lê o diário (pendências, desvios, clima × atividade, produtividade) e gera alertas; ou pergunte sobre o histórico da obra. Apoio; confirme com o RT.</p>
    <div id="rdo-insights">${cached && cached.length ? rdoInsightsHTML(cached) : ""}</div>
  </div>`;
}

function rdoInsightsGet() { try { return JSON.parse(localStorage.getItem("cb-rdo-insights") || "null"); } catch (e) { return null; } }
function rdoInsightsSet(insights) { try { localStorage.setItem("cb-rdo-insights", JSON.stringify(insights || [])); } catch (e) {} }

function rdoInsightsHTML(insights) {
  if (!insights || !insights.length) return `<p class="page-sub" style="padding:8px 0;color:var(--text-3)">Nenhum insight — registre mais dias no diário.</p>`;
  const sevOrd = { alta: 0, media: 1, baixa: 2 }, sevCor = { alta: "red", media: "amber", baixa: "teal" }, sevLab = { alta: "Alta", media: "Média", baixa: "Baixa" };
  const catLab = { pendencia: "Pendência", desvio: "Desvio", clima_atividade: "Clima × atividade", produtividade: "Produtividade", recomendacao: "Recomendação" };
  const arr = insights.slice().sort((a, b) => (sevOrd[a.severidade] != null ? sevOrd[a.severidade] : 1) - (sevOrd[b.severidade] != null ? sevOrd[b.severidade] : 1));
  return arr.map(i => `
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
    `<p class="page-sub" style="font-size:11.5px;margin-top:10px"><i class="ti ti-info-circle"></i> Material de apoio — não substitui o responsável técnico.</p>`;
}

async function gerarInsightsRdo() {
  const texto = rdoHistoricoTexto();
  const host = document.getElementById("rdo-insights");
  const aviso = (m) => `<p class="page-sub" style="color:var(--amber);margin-top:10px"><i class="ti ti-alert-triangle"></i> ${esc(m)}</p>`;
  if (!texto) { toast("Lance ao menos um RDO com atividades.", "warn"); return; }
  const C = window.CB_CONFIG || {};
  if (!window.supa || !C.FUNCTIONS_URL) { if (host) host.innerHTML = aviso("Os insights por IA exigem a conta conectada ao backend."); return; }
  if (host) host.innerHTML = `<p class="page-sub" style="margin-top:10px"><i class="ti ti-loader"></i> A IA está analisando o diário da obra…</p>`;
  try {
    const { data: { session } } = await window.supa.auth.getSession();
    const token = session && session.access_token;
    if (!token) { if (host) host.innerHTML = aviso("Faça login."); return; }
    const r = await fetch(C.FUNCTIONS_URL + "/rdo-insights", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, "apikey": C.SUPABASE_ANON_KEY },
      body: JSON.stringify({ rdoTexto: texto, nome: "Diário da obra" }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { if (host) host.innerHTML = aviso(d.error || ("Falha (erro " + r.status + "). A função rdo-insights está deployada?")); return; }
    const insights = d.insights || [];
    rdoInsightsSet(insights);
    if (host) host.innerHTML = rdoInsightsHTML(insights);
    toast(insights.length + " insight(s) do diário.", insights.length ? "success" : "info");
  } catch (e) { if (host) host.innerHTML = aviso("Não foi possível analisar agora. Tente novamente."); }
}

function perguntarIARdo() {
  const texto = rdoHistoricoTexto();
  if (!texto) { toast("Lance ao menos um RDO.", "warn"); return; }
  let ctx = "DIÁRIO DE OBRA (RDO):\n" + texto;
  const comProj = RDO.listar().find(r => r.projeto_id);
  if (comProj && typeof projetoContexto === "function") {
    const pc = projetoContexto(comProj.projeto_id);
    if (pc) ctx += "\n\nPROJETO VINCULADO:\n" + pc;
  }
  if (typeof ASSIST !== "undefined" && ASSIST.consultarProjeto) ASSIST.consultarProjeto("Diário da obra", null, ctx.slice(0, 30000));
  else toast("Assessor indisponível.", "warn");
}

if (typeof window !== "undefined") { window.RDO = RDO; window.rdoReady = rdoReady; window.renderRdo = renderRdo; window.rdoClassificarFotos = rdoClassificarFotos; window.rdoClassificarDoRdo = rdoClassificarDoRdo; }
