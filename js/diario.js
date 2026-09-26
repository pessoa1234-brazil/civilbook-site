// f62 S2 — UI do GERADOR de RAO/RSO (card no módulo RDO). O documento sai no template aprovado
// na S1 (docs/modelos/rao-s1.html): editável (contenteditable) e com CSS de impressão — Ctrl+P
// vira o PDF com texto. A aritmética vem TODA do motor puro (js/diario-motor.js, testado):
// EAP do orçamento × medições (0077) → capa; cronograma → curva prevista; RDOs → RSOs semanais
// com numeração contínua; fotos dos RDOs → folha fotográfica com carimbo.
// Tolerâncias: sem 0077 (medições) a capa sai zerada e avisa; sem 0078 (cadastro) o cabeçalho
// fica editável à mão; sem orçamento/cronograma, as partes correspondentes degradam com aviso.
(function () {
  "use strict";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function hoje() { return new Date().toLocaleDateString("en-CA"); }

  // ── dados (padrão da casa: coleções cbColecao já carregadas por seus módulos + leitura direta
  // tolerante p/ tabelas novas — como finTitulosPendentes faz) ─────────────────────────────────
  async function prontos() {
    const esperas = [];
    if (typeof rdoReady === "function") esperas.push(rdoReady());
    if (typeof cronoReady === "function") esperas.push(cronoReady());
    if (typeof ORC !== "undefined" && ORC.ready) esperas.push(ORC.ready());
    if (typeof PROJ !== "undefined" && PROJ.ready) esperas.push(PROJ.ready());
    await Promise.all(esperas);
  }
  async function cadastroDe(projetoId) {
    try {
      const { data } = await window.supa.from("projeto_cadastro").select("*").eq("projeto_id", projetoId).maybeSingle();
      return data || null;
    } catch { return null; }
  }
  async function salvarCadastro(projetoId, campos) {
    try {
      const r = await window.supa.from("projeto_cadastro").upsert({ projeto_id: projetoId, user_id: CBStore.uid(), ...campos });
      return !r.error;
    } catch { return false; }
  }
  async function medicoes(projetoId, iniISO, fimISO) {
    // desempate por updated_at: mesmo com o unique da 0077, instalação antiga pode ter duplicata
    const pega = async (q) => { try { const { data } = await q; return (data && data[0]) || null; } catch { return null; } };
    const base = () => window.supa.from("obra_medicoes").select("data_ref,etapas").eq("projeto_id", projetoId)
      .order("data_ref", { ascending: false }).order("updated_at", { ascending: false }).limit(1);
    return {
      atual: await pega(base().lte("data_ref", fimISO)),
      anterior: await pega(base().lt("data_ref", iniISO)),
    };
  }
  async function salvarMedicao(projetoId, dataRef, etapas) {
    // UPSERT: re-salvar o mesmo dia CORRIGE a medição (revisão S2 — o insert puro duplicava e a
    // capa podia pré-carregar a versão velha; o unique da 0077 sustenta o onConflict)
    try {
      const r = await window.supa.from("obra_medicoes").upsert(
        { user_id: CBStore.uid(), projeto_id: projetoId, data_ref: dataRef, etapas },
        { onConflict: "user_id,projeto_id,data_ref" },
      );
      return !r.error;
    } catch { return false; }
  }

  // ── card no módulo RDO ────────────────────────────────────────────────────────────────────────
  function cardHTML() {
    return `
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:220px">
          <strong><i class="ti ti-file-report"></i> Relatórios da obra (RAO / RSO)</strong>
          <p class="page-sub" style="margin:2px 0 0">Capa com EAP do orçamento e curva S, RSOs semanais montados dos RDOs e folha fotográfica — editável antes de imprimir (padrão aprovado na S1).</p>
        </div>
        <button class="btn primary" onclick="RAO_UI.abrir()">Gerar RAO</button>
      </div>
      <div id="rao-host"></div>
    </div>`;
  }

  async function abrir() {
    const host = document.getElementById("rao-host");
    if (!host) return;
    if (!CBStore.online()) { host.innerHTML = `<p class="page-sub" style="margin-top:10px">O gerador precisa da conta conectada ao backend.</p>`; return; }
    host.innerHTML = `<p class="page-sub" style="margin-top:10px">Carregando obras, orçamentos e cronogramas…</p>`;
    await prontos();
    const projs = (typeof PROJ !== "undefined" ? PROJ.listar() : []).slice();
    if (!projs.length) { host.innerHTML = `<p class="page-sub" style="margin-top:10px">Cadastre uma obra em Projetos primeiro.</p>`; return; }
    host.innerHTML = `
      <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-top:12px">
        <label>Obra<br><select id="rao-proj" class="input" onchange="RAO_UI.trocaProjeto()">${projs.map((p) => `<option value="${p.id}">${esc(p.nome)}</option>`).join("")}</select></label>
        <label>Início do período<br><input id="rao-ini" class="input" type="date"></label>
        <label>Fim do período<br><input id="rao-fim" class="input" type="date" value="${hoje()}"></label>
        <label>Nº deste RAO<br><input id="rao-num" class="input" type="number" min="1" value="1"></label>
      </div>
      <div id="rao-fontes" class="page-sub" style="margin-top:8px"></div>
      <div id="rao-medicao" style="margin-top:10px"></div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="btn" onclick="RAO_UI.salvarMedicaoUI()">Salvar medição</button>
        <button class="btn primary" onclick="RAO_UI.gerar()">Gerar documento</button>
      </div>
      <div id="rao-aviso" class="page-sub" style="margin-top:8px"></div>`;
    trocaProjeto();
  }

  function selecionados() {
    const projetoId = document.getElementById("rao-proj").value;
    const orc = (typeof ORC !== "undefined" ? ORC.listar() : []).filter((o) => o.projeto_id === projetoId)
      .sort((a, b) => (b.versao || 0) - (a.versao || 0))[0] || null;
    const crono = (typeof CRONO !== "undefined" ? CRONO.listar() : []).filter((c) => c.projeto_id === projetoId)[0] || null;
    const rdos = (typeof RDO !== "undefined" ? RDO.listar() : []).filter((r) => r.projeto_id === projetoId);
    return { projetoId, projeto: PROJ.get(projetoId), orc, crono, rdos };
  }

  async function trocaProjeto() {
    const s = selecionados();
    const iniEl = document.getElementById("rao-ini");
    if (iniEl && !iniEl.value) {
      iniEl.value = (s.crono && s.crono.inicio) || (s.rdos.map((r) => r.data).sort()[0]) || hoje();
    }
    const f = [];
    f.push(s.orc ? `✔ Orçamento: ${esc(s.orc.nome)} (v${s.orc.versao || 1})` : "✖ Sem orçamento vinculado — a capa sai sem EAP (crie em Custos → Orçamento e vincule à obra).");
    f.push(s.crono ? `✔ Cronograma: ${esc(s.crono.nome)}` : "✖ Sem cronograma — a curva prevista fica de fora.");
    f.push(`✔ RDOs da obra: ${s.rdos.length}`);
    document.getElementById("rao-fontes").innerHTML = f.join("<br>");
    await montarMedicao();
  }

  async function montarMedicao() {
    const s = selecionados();
    const alvo = document.getElementById("rao-medicao");
    if (!alvo) return;
    if (!s.orc) { alvo.innerHTML = ""; return; }
    const fim = document.getElementById("rao-fim").value || hoje();
    const ini = document.getElementById("rao-ini").value || fim;
    const med = await medicoes(s.projetoId, ini, fim);
    const eap = window.DIARIO_MOTOR.eapDoOrcamento(s.orc.itens || []);
    const at = (med.atual && med.atual.etapas) || {};
    alvo.innerHTML = `
      <strong style="font-size:13px">Medição por etapa (% executado do item)${med.atual ? ` — última: ${esc(med.atual.data_ref)}` : ""}</strong>
      <table class="tbl" style="margin-top:6px"><thead><tr><th>Etapa</th><th style="width:90px">Incid. %</th><th style="width:110px">Exec. item %</th></tr></thead>
      <tbody>${eap.linhas.map((l) => `<tr><td>${esc(l.etapa)}</td><td>${l.incidencia.toFixed(2)}</td>
        <td><input class="input" type="number" min="0" max="100" step="1" data-rao-etapa="${esc(l.etapa)}" value="${Number(at[l.etapa]) || 0}"></td></tr>`).join("")}</tbody></table>`;
  }

  function lerMedicaoUI() {
    const etapas = {};
    document.querySelectorAll("[data-rao-etapa]").forEach((el) => { etapas[el.getAttribute("data-rao-etapa")] = Number(el.value) || 0; });
    return etapas;
  }

  async function salvarMedicaoUI() {
    const s = selecionados();
    const aviso = document.getElementById("rao-aviso");
    if (!s.orc) { aviso.textContent = "Sem orçamento não há etapas para medir."; return; }
    const fim = document.getElementById("rao-fim").value || hoje();
    const ok = await salvarMedicao(s.projetoId, fim, lerMedicaoUI());
    aviso.textContent = ok ? `Medição de ${fim} salva.` : "Não consegui salvar a medição — a migration 0077 (obra_medicoes) já foi aplicada?";
  }

  // ── geração do documento (template S1 aprovado, preenchido pelo motor) ───────────────────────
  async function gerar() {
    const M = window.DIARIO_MOTOR;
    const s = selecionados();
    const aviso = document.getElementById("rao-aviso");
    const ini = document.getElementById("rao-ini").value;
    const fim = document.getElementById("rao-fim").value || hoje();
    const numRao = Math.max(1, Number(document.getElementById("rao-num").value) || 1);
    if (!ini) { aviso.textContent = "Informe o início do período."; return; }

    // a JANELA abre SÍNCRONA no clique (revisão S2: abrir depois dos awaits estourava a ativação
    // transitória e o navegador bloqueava o pop-up — no celular, sempre) e recebe o documento no fim
    const win = window.open("", "_blank");
    if (!win) { aviso.textContent = "O navegador bloqueou a janela do documento — permita pop-ups para este site."; return; }
    win.document.write("<title>RAO — montando…</title><p style='font-family:sans-serif;padding:24px'>Montando o RAO…</p>");
    aviso.textContent = "Montando o documento…";

    try {
      const cad = await cadastroDe(s.projetoId) || {};
      const med = await medicoes(s.projetoId, ini, fim);
      const eap = s.orc ? M.eapDoOrcamento(s.orc.itens || []) : { linhas: [], total: 0 };
      const capa = M.linhasCapa(eap, lerMedicaoUI(), (med.anterior && med.anterior.etapas) || {});
      const inicioObra = (s.crono && s.crono.inicio) || (s.rdos.map((r) => r.data).sort()[0]) || ini;
      const periodos = M.periodosQuinzenais(inicioObra, fim);
      const curva = s.crono ? M.curvaPrevista(s.crono.atividades || [], periodos) : periodos.map(() => 0);
      const semanas = M.semanasDoPeriodo(s.rdos, ini, fim, M.numeroRsoInicial(inicioObra, ini));

      // fotos: signed URLs (1h) em PARALELO — o laço sequencial segurava o documento em rede de campo
      const pedidos = [];
      for (const sem of semanas) {
        for (const dia of sem.dias) {
          dia.fotosUrl = [];
          for (const f of (dia.fotos || []).slice(0, 4)) {
            // download-inline: a URL entra como `src` de um <img> DENTRO do documento gerado (o relatório que
            // abre em nova aba para o RT revisar e imprimir). Com `{ download }` o Storage manda attachment e
            // a foto não desenha — o documento sairia com todas as imagens quebradas.
            pedidos.push(
              window.supa.storage.from("rdo").createSignedUrl(f.path, 3600)
                .then(({ data }) => { if (data && data.signedUrl) dia.fotosUrl.push({ url: data.signedUrl, nome: f.nome || "", data: dia.data }); })
                .catch(() => { /* foto fora do ar não derruba o documento */ }),
            );
          }
        }
      }
      await Promise.all(pedidos);

      const html = documentoHTML({ s, cad, capa, periodos, curva, semanas, ini, fim, numRao, medidoEm: med.atual ? med.atual.data_ref : null });
      win.document.open();
      win.document.write(html);
      win.document.close();
      aviso.textContent = "Documento aberto em nova aba: revise (é editável), depois Ctrl+P → Salvar como PDF.";
    } catch (e) {
      try { win.close(); } catch { /* janela já fechada pelo usuário */ }
      aviso.textContent = "Erro ao montar o documento: " + (e && e.message ? e.message : e);
    }
  }

  function cabecalhoHTML(cad, projeto, titulo, folha, totalFolhas, extra) {
    return `
    <header class="cab">
      <div class="logo">[LOGO DA<br>CONTRATADA]</div>
      <div class="meio">
        <div class="titulo">${esc(titulo)}</div>
        <div class="sub">${esc(projeto.nome)}${cad.municipio_uf ? " · " + esc(cad.municipio_uf) : ""}${cad.contrato ? " · Contrato " + esc(cad.contrato) : ""}</div>
        <div class="dados" style="margin-top:1.5mm">
          <b>Cliente:</b> ${esc(cad.cliente || "—")} &nbsp;·&nbsp; <b>Contratada:</b> ${esc(cad.contratada || "—")}<br>${extra || ""}
        </div>
      </div>
      <div class="dados"><b>Emissão:</b> ${window.DIARIO_MOTOR.brData(hoje())}<br><b>FOLHA:</b> ${folha} de ${totalFolhas}</div>
    </header>`;
  }

  function documentoHTML(d) {
    const M = window.DIARIO_MOTOR;
    const fmt = (n) => (Math.round(n * 100) / 100).toFixed(2).replace(".", ",");
    const totalFolhas = 1 + d.semanas.length * 2;
    let folha = 0;
    const partes = [];

    // ── capa ──
    folha++;
    const linhasEap = d.capa.linhas.map((l) => `<tr><td>${esc(l.item)}</td><td>${esc(l.etapa)}</td><td class="num">${fmt(l.incidencia)}</td><td class="num">${fmt(l.execItem)}</td><td class="num">${fmt(l.execObra)}</td></tr>`).join("");
    const linhasEtapas = d.periodos.map((p, i) => `<tr><td class="centro">${p.n}</td><td class="num">${fmt(d.curva[i] || 0)}</td><td class="num">—</td><td class="num">—</td><td class="centro">${esc(p.rotulo)}</td></tr>`).join("");
    // curva S em SVG: previsto (tracejado) + executado até o acumulado atual no último período
    const W = 460, H = 200, x0 = 34, y0 = 170, x1 = 450, y1 = 20;
    const nx = (i) => x0 + (d.periodos.length > 1 ? (i * (x1 - x0)) / (d.periodos.length - 1) : 0);
    const ny = (v) => y0 - (v * (y0 - y1)) / 100;
    const ptsPrev = d.curva.map((v, i) => nx(i) + "," + ny(v)).join(" ");
    const ultimo = d.periodos.length - 1;
    const ptsExec = [nx(0) + "," + ny(0), nx(ultimo) + "," + ny(d.capa.acumulado)].join(" ");
    partes.push(`<section class="folha">
      ${cabecalhoHTML(d.cad, d.s.projeto, "RELATÓRIO DE ACOMPANHAMENTO DE OBRA — RAO Nº " + d.numRao, folha, totalFolhas, `<b>Período:</b> ${M.brData(d.ini)} a ${M.brData(d.fim)}${d.medidoEm ? " · medição de " + M.brData(d.medidoEm) : ""}`)}
      <div class="duas-colunas">
        <div>
          <h2 class="secao">EAP — Execução ponderada pelo orçamento</h2>
          ${d.capa.linhas.length ? `<table><thead><tr><th style="width:9mm">Item</th><th>Discriminação do serviço</th><th class="num" style="width:17mm">Incidência %</th><th class="num" style="width:19mm">Execução do item %</th><th class="num" style="width:19mm">Execução da obra %</th></tr></thead>
          <tbody>${linhasEap}<tr class="rodape"><td colspan="2">TOTAIS</td><td class="num">${fmt(d.capa.linhas.reduce((s, l) => s + l.incidencia, 0))}</td><td class="num">—</td><td class="num">${fmt(d.capa.acumulado)}</td></tr></tbody></table>
          <table style="margin-top:2mm"><tr><td style="width:33%"><b>EXECUTADO ACUMULADO:</b> ${fmt(d.capa.acumulado)}%</td><td style="width:33%"><b>EXECUTADO ETAPA ANTERIOR:</b> ${fmt(d.capa.anterior)}%</td><td><b>EXECUTADO NA ETAPA:</b> ${fmt(d.capa.naEtapa)}%</td></tr></table>
          <div class="nota-rodape">Execução da obra = incidência × execução do item; totais calculados pelo app, nunca digitados.</div>`
          : `<p style="font-size:10px;border:1px solid var(--grade);padding:3mm">Sem orçamento vinculado a esta obra — vincule um orçamento (Custos → Orçamento) para a EAP aparecer calculada.</p>`}
        </div>
        <div>
          <h2 class="secao">Etapas — previsto × executado (período de referência)</h2>
          <table><thead><tr><th class="centro" style="width:10mm">Etapa</th><th class="num">Acum. previsto %</th><th class="num">Executado %</th><th class="num">Acum. executado %</th><th class="centro">Período de referência</th></tr></thead><tbody>${linhasEtapas}</tbody></table>
          <h2 class="secao" style="margin-top:3mm">Curva de evolução da obra (Curva S)</h2>
          <div class="curva"><svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
            <g stroke="#d9dde2" stroke-width="1"><line x1="${x0}" y1="${y1}" x2="${x0}" y2="${y0}"/><line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}"/></g>
            <g font-size="8" fill="#666" text-anchor="end"><text x="${x0 - 4}" y="${y0 + 3}">0</text><text x="${x0 - 4}" y="${ny(50) + 3}">50</text><text x="${x0 - 4}" y="${y1 + 3}">100</text></g>
            <polyline fill="none" stroke="#666" stroke-width="1.6" stroke-dasharray="5 3" points="${ptsPrev}"/>
            <polyline fill="none" stroke="#1a1a1a" stroke-width="2" points="${ptsExec}"/>
            <circle cx="${nx(ultimo)}" cy="${ny(d.capa.acumulado)}" r="2.4"/>
            <text x="${nx(ultimo) - 4}" y="${ny(d.capa.acumulado) - 6}" font-size="8.5" text-anchor="end">${fmt(d.capa.acumulado)}% (executado)</text>
          </svg></div>
        </div>
      </div>
      ${assinaturasHTML(d.cad)}
    </section>`);

    // ── RSOs (folha de dados + folha fotográfica por semana) ──
    for (const sem of d.semanas) {
      const ef = M.efetivoSemana(sem.dias);
      folha++;
      const cabDias = sem.dias.map((dia, i) => `<th class="centro">${["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][i]} ${dia.data.slice(8, 10)}</th>`).join("");
      partes.push(`<section class="folha">
        ${cabecalhoHTML(d.cad, d.s.projeto, "RELATÓRIO SEMANAL DE OBRA — RSO Nº " + sem.numero, folha, totalFolhas, `<b>Semana:</b> ${M.brData(sem.ini)} a ${M.brData(sem.fim)} · Anexo do RAO Nº ${d.numRao}`)}
        <div class="duas-colunas">
          <div>
            <h2 class="secao">Condições climáticas</h2>
            <table class="clima"><thead><tr><th style="width:16mm">Turno</th>${cabDias}</tr></thead><tbody>
              <tr><td>Manhã</td>${sem.dias.map((dia) => `<td class="${dia.clima.manha}"></td>`).join("")}</tr>
              <tr><td>Tarde</td>${sem.dias.map((dia) => `<td class="${dia.clima.tarde}"></td>`).join("")}</tr></tbody></table>
            <div class="legenda"><span><span class="cx bom"></span>Bom</span><span><span class="cx chuva-p"></span>Chuva praticável</span><span><span class="cx chuva-i"></span>Chuva impraticável</span><span><span class="cx molhado"></span>Molhado prejudicado</span></div>
            <h2 class="secao" style="margin-top:3mm">Efetivo de mão-de-obra</h2>
            ${ef.funcoes.length ? `<table><thead><tr><th>Função</th>${cabDias}</tr></thead><tbody>
              ${ef.funcoes.map((f) => `<tr><td>${esc(f)}</td>${ef.porFuncao.get(f).map((q) => `<td class="centro">${q || "—"}</td>`).join("")}</tr>`).join("")}
              <tr class="rodape"><td>TOTAL</td>${ef.totais.map((q) => `<td class="centro">${q || "—"}</td>`).join("")}</tr></tbody></table>` : `<p style="font-size:9px;border:1px solid var(--grade);padding:2mm">Sem efetivo registrado nos RDOs da semana.</p>`}
            <h2 class="secao" style="margin-top:3mm">Metas da semana</h2>
            <div style="font-size:9px;border:1px solid var(--grade);padding:1.5mm 2mm;min-height:8mm">&nbsp;</div>
          </div>
          <div>
            <h2 class="secao">Descrição das atividades</h2>
            ${sem.dias.filter((dia) => dia.atividades).map((dia) => `<div class="bloco-dia"><div class="rotulo">${esc(dia.rotulo)}</div><ul>${esc(dia.atividades).split("\n").filter(Boolean).map((a) => `<li>${a}</li>`).join("")}</ul></div>`).join("") || `<p style="font-size:9px;border:1px solid var(--grade);padding:2mm">Sem atividades registradas nos RDOs.</p>`}
            <h2 class="secao" style="margin-top:3mm">Paralisações / demoras / críticos / interrupções</h2>
            ${sem.dias.filter((dia) => dia.ocorrencias).map((dia) => `<div class="bloco-dia"><div class="rotulo">${esc(dia.rotulo)}</div><ul>${esc(dia.ocorrencias).split("\n").filter(Boolean).map((o) => `<li>${o}</li>`).join("")}</ul></div>`).join("") || `<div style="font-size:9px;border:1px solid var(--grade);padding:2mm">Sem ocorrências registradas.</div>`}
          </div>
        </div>
      </section>`);
      folha++;
      const fotos = sem.dias.flatMap((dia) => dia.fotosUrl || []);
      partes.push(`<section class="folha">
        ${cabecalhoHTML(d.cad, d.s.projeto, "RSO Nº " + sem.numero + " · FOLHA FOTOGRÁFICA", folha, totalFolhas, `<b>Semana:</b> ${M.brData(sem.ini)} a ${M.brData(sem.fim)} · Anexo do RAO Nº ${d.numRao}`)}
        ${fotos.length ? `<div class="grade-fotos">${fotos.map((f) => `<figure class="foto"><div class="img"><img src="${f.url}" alt="${esc(f.nome)}" style="width:100%;height:100%;object-fit:cover"></div><figcaption class="carimbo"><span>${M.brData(f.data)}</span><span>${esc(f.nome || d.s.projeto.nome)}</span></figcaption></figure>`).join("")}</div>`
        : `<p style="font-size:10px;border:1px solid var(--grade);padding:3mm">Sem fotos nos RDOs desta semana. Fotos anexadas ao RDO entram aqui com o carimbo da data.</p>`}
        ${assinaturasHTML(d.cad)}
      </section>`);
    }

    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>RAO Nº ${d.numRao} — ${esc(d.s.projeto.nome)}</title><style>${CSS_DOC}</style></head>
      <body><div class="faixa-s1 so-tela">✏️ Documento EDITÁVEL: clique em qualquer texto e ajuste (metas da semana, observações…). <b>Ctrl+P → Salvar como PDF</b> (A4 paisagem, com camada de texto). A aritmética da capa foi calculada pelo app.</div>
      ${partes.join("\n")}
      <script>for (const el of document.querySelectorAll("td, th, li, .dados, .titulo, .sub, .assina, figcaption span, .bloco-dia .rotulo, h2.secao, div[style]")) { if (!el.querySelector("svg,img")) { el.setAttribute("contenteditable", "true"); el.setAttribute("spellcheck", "false"); } }<\/script>
      </body></html>`;
  }

  function assinaturasHTML(cad) {
    return `<div class="assinaturas">
      <div class="assina"><div class="linha"></div><b>CONTRATADA</b> — ${esc(cad.contratada || "")}<br>Nome · RG · Data</div>
      <div class="assina"><div class="linha"></div><b>CONTRATANTE</b> — ${esc(cad.cliente || "")}<br>Nome · RG · Data</div>
    </div>`;
  }

  // CSS do documento — o MESMO do modelo S1 aprovado (docs/modelos/rao-s1.html), enxugado.
  const CSS_DOC = `
  :root{--tinta:#1a1a1a;--grade:#444;--suave:#666;--fundo-cab:#eef1f4;--verde:#2e7d32;--amarelo:#f9a825;--vermelho:#c62828;--preto:#212121}
  *{box-sizing:border-box;margin:0;padding:0}body{font-family:"Segoe UI",Arial,sans-serif;color:var(--tinta);background:#9aa2ab}
  .folha{width:297mm;min-height:209mm;background:#fff;margin:10mm auto;padding:10mm 12mm;position:relative;box-shadow:0 2px 12px rgba(0,0,0,.35)}
  @media print{@page{size:A4 landscape;margin:0}body{background:#fff}.folha{width:auto;min-height:auto;margin:0;padding:10mm 12mm;box-shadow:none;page-break-after:always}.so-tela{display:none!important}[contenteditable]{outline:none!important;background:transparent!important}}
  .faixa-s1{max-width:297mm;margin:8mm auto 0;background:#fff8e1;border:1px solid #f0c440;padding:10px 14px;font-size:13px;border-radius:6px}
  .cab{display:grid;grid-template-columns:34mm 1fr 42mm;border:1.2px solid var(--grade);margin-bottom:4mm}.cab>div{padding:2.5mm 3mm}
  .cab .logo{border-right:1.2px solid var(--grade);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;color:var(--suave);text-align:center}
  .cab .meio{border-right:1.2px solid var(--grade)}.cab .titulo{font-size:15px;font-weight:700;letter-spacing:.4px}.cab .sub{font-size:10px;color:var(--suave);margin-top:1mm}
  .cab .dados{font-size:10px;line-height:1.55}
  h2.secao{font-size:11px;letter-spacing:.3px;background:var(--fundo-cab);border:1px solid var(--grade);border-bottom:none;padding:1.6mm 2.5mm;text-transform:uppercase}
  table{border-collapse:collapse;width:100%;font-size:9px}th,td{border:1px solid var(--grade);padding:1.1mm 1.6mm;text-align:left;vertical-align:top}
  th{background:var(--fundo-cab);font-size:8.5px;text-transform:uppercase}td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}td.centro,th.centro{text-align:center}
  tr.rodape td{font-weight:700;background:var(--fundo-cab)}.duas-colunas{display:grid;grid-template-columns:1.25fr 1fr;gap:4mm;align-items:start}
  .clima td{height:6mm}.cx{display:inline-block;width:4mm;height:4mm;border:1px solid var(--grade);vertical-align:-0.8mm;margin-right:1.2mm}
  .bom{background:var(--verde)}.chuva-p{background:var(--amarelo)}.chuva-i{background:var(--vermelho)}.molhado{background:var(--preto)}
  .legenda{font-size:8.5px;display:flex;gap:5mm;padding:1.6mm 0;flex-wrap:wrap}
  .bloco-dia{margin-top:1.6mm}.bloco-dia .rotulo{font-weight:700;font-size:9px;background:#f7f8fa;border:1px solid var(--grade);border-bottom:none;padding:1mm 2mm}
  .bloco-dia ul{border:1px solid var(--grade);list-style:none;padding:1mm 2mm;font-size:9px}.bloco-dia li::before{content:"— "}
  .grade-fotos{display:grid;grid-template-columns:1fr 1fr;gap:4mm}.foto{border:1px solid var(--grade)}
  .foto .img{height:58mm;background:#eef1f4;display:flex;align-items:center;justify-content:center;color:var(--suave);font-size:10px;overflow:hidden}
  .foto .carimbo{border-top:1px solid var(--grade);font-size:8.5px;padding:1.2mm 2mm;display:flex;justify-content:space-between;background:var(--fundo-cab)}
  .assinaturas{display:grid;grid-template-columns:1fr 1fr;gap:12mm;margin-top:9mm}.assina{text-align:center;font-size:9px}.assina .linha{border-top:1px solid var(--tinta);margin:11mm 6mm 1.5mm}
  .curva{border:1px solid var(--grade)}.curva svg{display:block;width:100%;height:auto}.nota-rodape{font-size:8px;color:var(--suave);margin-top:2mm}
  [contenteditable]:hover{outline:1.5px dashed #9ab;outline-offset:1px;cursor:text}[contenteditable]:focus{outline:2px solid #4a90d9;background:#fffde7}`;

  window.RAO_UI = { cardHTML, abrir, trocaProjeto, salvarMedicaoUI, gerar };
})();
