(function(){"use strict";function r(a){return String(a==null?"":a).replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t])}function h(){return new Date().toLocaleDateString("en-CA")}async function _(){const a=[];if(typeof rdoReady==="function")a.push(rdoReady());if(typeof cronoReady==="function")a.push(cronoReady());if(typeof ORC!=="undefined"&&ORC.ready)a.push(ORC.ready());if(typeof PROJ!=="undefined"&&PROJ.ready)a.push(PROJ.ready());await Promise.all(a)}async function M(a){try{const{data:t}=await window.supa.from("projeto_cadastro").select("*").eq("projeto_id",a).maybeSingle();return t||null}catch{return null}}async function F(a,t){try{const o=await window.supa.from("projeto_cadastro").upsert({projeto_id:a,user_id:CBStore.uid(),...t});return!o.error}catch{return false}}async function j(a,t,o){const s=async d=>{try{const{data:l}=await d;return l&&l[0]||null}catch{return null}};const n=()=>window.supa.from("obra_medicoes").select("data_ref,etapas").eq("projeto_id",a).order("data_ref",{ascending:false}).order("updated_at",{ascending:false}).limit(1);return{atual:await s(n().lte("data_ref",o)),anterior:await s(n().lt("data_ref",t))}}async function k(a,t,o){try{const s=await window.supa.from("obra_medicoes").upsert({user_id:CBStore.uid(),projeto_id:a,data_ref:t,etapas:o},{onConflict:"user_id,projeto_id,data_ref"});return!s.error}catch{return false}}function P(){return`
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:220px">
          <strong><i class="ti ti-file-report"></i> Relatórios da obra (RAO / RSO)</strong>
          <p class="page-sub" style="margin:2px 0 0">Capa com EAP do orçamento e curva S, RSOs semanais montados dos RDOs e folha fotográfica — editável antes de imprimir (padrão aprovado na S1).</p>
        </div>
        <button class="btn primary" onclick="RAO_UI.abrir()">Gerar RAO</button>
      </div>
      <div id="rao-host"></div>
    </div>`}async function z(){const a=document.getElementById("rao-host");if(!a)return;if(!CBStore.online()){a.innerHTML=`<p class="page-sub" style="margin-top:10px">O gerador precisa da conta conectada ao backend.</p>`;return}a.innerHTML=`<p class="page-sub" style="margin-top:10px">Carregando obras, orçamentos e cronogramas…</p>`;await _();const t=(typeof PROJ!=="undefined"?PROJ.listar():[]).slice();if(!t.length){a.innerHTML=`<p class="page-sub" style="margin-top:10px">Cadastre uma obra em Projetos primeiro.</p>`;return}a.innerHTML=`
      <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-top:12px">
        <label>Obra<br><select id="rao-proj" class="input" onchange="RAO_UI.trocaProjeto()">${t.map(o=>`<option value="${o.id}">${r(o.nome)}</option>`).join("")}</select></label>
        <label>Início do período<br><input id="rao-ini" class="input" type="date"></label>
        <label>Fim do período<br><input id="rao-fim" class="input" type="date" value="${h()}"></label>
        <label>Nº deste RAO<br><input id="rao-num" class="input" type="number" min="1" value="1"></label>
      </div>
      <div id="rao-fontes" class="page-sub" style="margin-top:8px"></div>
      <div id="rao-medicao" style="margin-top:10px"></div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="btn" onclick="RAO_UI.salvarMedicaoUI()">Salvar medição</button>
        <button class="btn primary" onclick="RAO_UI.gerar()">Gerar documento</button>
      </div>
      <div id="rao-aviso" class="page-sub" style="margin-top:8px"></div>`;D()}function w(){const a=document.getElementById("rao-proj").value;const t=(typeof ORC!=="undefined"?ORC.listar():[]).filter(n=>n.projeto_id===a).sort((n,d)=>(d.versao||0)-(n.versao||0))[0]||null;const o=(typeof CRONO!=="undefined"?CRONO.listar():[]).filter(n=>n.projeto_id===a)[0]||null;const s=(typeof RDO!=="undefined"?RDO.listar():[]).filter(n=>n.projeto_id===a);return{projetoId:a,projeto:PROJ.get(a),orc:t,crono:o,rdos:s}}async function D(){const a=w();const t=document.getElementById("rao-ini");if(t&&!t.value){t.value=a.crono&&a.crono.inicio||a.rdos.map(s=>s.data).sort()[0]||h()}const o=[];o.push(a.orc?`✔ Orçamento: ${r(a.orc.nome)} (v${a.orc.versao||1})`:"✖ Sem orçamento vinculado — a capa sai sem EAP (crie em Custos → Orçamento e vincule à obra).");o.push(a.crono?`✔ Cronograma: ${r(a.crono.nome)}`:"✖ Sem cronograma — a curva prevista fica de fora.");o.push(`✔ RDOs da obra: ${a.rdos.length}`);document.getElementById("rao-fontes").innerHTML=o.join("<br>");await N()}async function N(){const a=w();const t=document.getElementById("rao-medicao");if(!t)return;if(!a.orc){t.innerHTML="";return}const o=document.getElementById("rao-fim").value||h();const s=document.getElementById("rao-ini").value||o;const n=await j(a.projetoId,s,o);const d=window.DIARIO_MOTOR.eapDoOrcamento(a.orc.itens||[]);const l=n.atual&&n.atual.etapas||{};t.innerHTML=`
      <strong style="font-size:13px">Medição por etapa (% executado do item)${n.atual?` — última: ${r(n.atual.data_ref)}`:""}</strong>
      <table class="tbl" style="margin-top:6px"><thead><tr><th>Etapa</th><th style="width:90px">Incid. %</th><th style="width:110px">Exec. item %</th></tr></thead>
      <tbody>${d.linhas.map(m=>`<tr><td>${r(m.etapa)}</td><td>${m.incidencia.toFixed(2)}</td>
        <td><input class="input" type="number" min="0" max="100" step="1" data-rao-etapa="${r(m.etapa)}" value="${Number(l[m.etapa])||0}"></td></tr>`).join("")}</tbody></table>`}function C(){const a={};document.querySelectorAll("[data-rao-etapa]").forEach(t=>{a[t.getAttribute("data-rao-etapa")]=Number(t.value)||0});return a}async function B(){const a=w();const t=document.getElementById("rao-aviso");if(!a.orc){t.textContent="Sem orçamento não há etapas para medir.";return}const o=document.getElementById("rao-fim").value||h();const s=await k(a.projetoId,o,C());t.textContent=s?`Medição de ${o} salva.`:"Não consegui salvar a medição — a migration 0077 (obra_medicoes) já foi aplicada?"}async function L(){const a=window.DIARIO_MOTOR;const t=w();const o=document.getElementById("rao-aviso");const s=document.getElementById("rao-ini").value;const n=document.getElementById("rao-fim").value||h();const d=Math.max(1,Number(document.getElementById("rao-num").value)||1);if(!s){o.textContent="Informe o início do período.";return}const l=window.open("","_blank");if(!l){o.textContent="O navegador bloqueou a janela do documento — permita pop-ups para este site.";return}l.document.write("<title>RAO — montando…</title><p style='font-family:sans-serif;padding:24px'>Montando o RAO…</p>");o.textContent="Montando o documento…";try{const m=await M(t.projetoId)||{};const x=await j(t.projetoId,s,n);const A=t.orc?a.eapDoOrcamento(t.orc.itens||[]):{linhas:[],total:0};const p=a.linhasCapa(A,C(),x.anterior&&x.anterior.etapas||{});const u=t.crono&&t.crono.inicio||t.rdos.map(g=>g.data).sort()[0]||s;const y=a.periodosQuinzenais(u,n);const O=t.crono?a.curvaPrevista(t.crono.atividades||[],y):y.map(()=>0);const b=a.semanasDoPeriodo(t.rdos,s,n,a.numeroRsoInicial(u,s));const f=[];for(const g of b){for(const $ of g.dias){$.fotosUrl=[];for(const e of($.fotos||[]).slice(0,4)){f.push(window.supa.storage.from("rdo").createSignedUrl(e.path,3600).then(({data:c})=>{if(c&&c.signedUrl)$.fotosUrl.push({url:c.signedUrl,nome:e.nome||"",data:$.data})}).catch(()=>{}))}}}await Promise.all(f);const E=U({s:t,cad:m,capa:p,periodos:y,curva:O,semanas:b,ini:s,fim:n,numRao:d,medidoEm:x.atual?x.atual.data_ref:null});l.document.open();l.document.write(E);l.document.close();o.textContent="Documento aberto em nova aba: revise (é editável), depois Ctrl+P → Salvar como PDF."}catch(m){try{l.close()}catch{}o.textContent="Erro ao montar o documento: "+(m&&m.message?m.message:m)}}function R(a,t,o,s,n,d){return`
    <header class="cab">
      <div class="logo">[LOGO DA<br>CONTRATADA]</div>
      <div class="meio">
        <div class="titulo">${r(o)}</div>
        <div class="sub">${r(t.nome)}${a.municipio_uf?" · "+r(a.municipio_uf):""}${a.contrato?" · Contrato "+r(a.contrato):""}</div>
        <div class="dados" style="margin-top:1.5mm">
          <b>Cliente:</b> ${r(a.cliente||"—")} &nbsp;·&nbsp; <b>Contratada:</b> ${r(a.contratada||"—")}<br>${d||""}
        </div>
      </div>
      <div class="dados"><b>Emissão:</b> ${window.DIARIO_MOTOR.brData(h())}<br><b>FOLHA:</b> ${s} de ${n}</div>
    </header>`}function U(a){const t=window.DIARIO_MOTOR;const o=e=>(Math.round(e*100)/100).toFixed(2).replace(".",",");const s=1+a.semanas.length*2;let n=0;const d=[];n++;const l=a.capa.linhas.map(e=>`<tr><td>${r(e.item)}</td><td>${r(e.etapa)}</td><td class="num">${o(e.incidencia)}</td><td class="num">${o(e.execItem)}</td><td class="num">${o(e.execObra)}</td></tr>`).join("");const m=a.periodos.map((e,c)=>`<tr><td class="centro">${e.n}</td><td class="num">${o(a.curva[c]||0)}</td><td class="num">—</td><td class="num">—</td><td class="centro">${r(e.rotulo)}</td></tr>`).join("");const x=460,A=200,p=34,u=170,y=450,O=20;const b=e=>p+(a.periodos.length>1?e*(y-p)/(a.periodos.length-1):0);const f=e=>u-e*(u-O)/100;const E=a.curva.map((e,c)=>b(c)+","+f(e)).join(" ");const g=a.periodos.length-1;const $=[b(0)+","+f(0),b(g)+","+f(a.capa.acumulado)].join(" ");d.push(`<section class="folha">
      ${R(a.cad,a.s.projeto,"RELATÓRIO DE ACOMPANHAMENTO DE OBRA — RAO Nº "+a.numRao,n,s,`<b>Período:</b> ${t.brData(a.ini)} a ${t.brData(a.fim)}${a.medidoEm?" · medição de "+t.brData(a.medidoEm):""}`)}
      <div class="duas-colunas">
        <div>
          <h2 class="secao">EAP — Execução ponderada pelo orçamento</h2>
          ${a.capa.linhas.length?`<table><thead><tr><th style="width:9mm">Item</th><th>Discriminação do serviço</th><th class="num" style="width:17mm">Incidência %</th><th class="num" style="width:19mm">Execução do item %</th><th class="num" style="width:19mm">Execução da obra %</th></tr></thead>
          <tbody>${l}<tr class="rodape"><td colspan="2">TOTAIS</td><td class="num">${o(a.capa.linhas.reduce((e,c)=>e+c.incidencia,0))}</td><td class="num">—</td><td class="num">${o(a.capa.acumulado)}</td></tr></tbody></table>
          <table style="margin-top:2mm"><tr><td style="width:33%"><b>EXECUTADO ACUMULADO:</b> ${o(a.capa.acumulado)}%</td><td style="width:33%"><b>EXECUTADO ETAPA ANTERIOR:</b> ${o(a.capa.anterior)}%</td><td><b>EXECUTADO NA ETAPA:</b> ${o(a.capa.naEtapa)}%</td></tr></table>
          <div class="nota-rodape">Execução da obra = incidência × execução do item; totais calculados pelo app, nunca digitados.</div>`:`<p style="font-size:10px;border:1px solid var(--grade);padding:3mm">Sem orçamento vinculado a esta obra — vincule um orçamento (Custos → Orçamento) para a EAP aparecer calculada.</p>`}
        </div>
        <div>
          <h2 class="secao">Etapas — previsto × executado (período de referência)</h2>
          <table><thead><tr><th class="centro" style="width:10mm">Etapa</th><th class="num">Acum. previsto %</th><th class="num">Executado %</th><th class="num">Acum. executado %</th><th class="centro">Período de referência</th></tr></thead><tbody>${m}</tbody></table>
          <h2 class="secao" style="margin-top:3mm">Curva de evolução da obra (Curva S)</h2>
          <div class="curva"><svg viewBox="0 0 ${x} ${A}" xmlns="http://www.w3.org/2000/svg">
            <g stroke="#d9dde2" stroke-width="1"><line x1="${p}" y1="${O}" x2="${p}" y2="${u}"/><line x1="${p}" y1="${u}" x2="${y}" y2="${u}"/></g>
            <g font-size="8" fill="#666" text-anchor="end"><text x="${p-4}" y="${u+3}">0</text><text x="${p-4}" y="${f(50)+3}">50</text><text x="${p-4}" y="${O+3}">100</text></g>
            <polyline fill="none" stroke="#666" stroke-width="1.6" stroke-dasharray="5 3" points="${E}"/>
            <polyline fill="none" stroke="#1a1a1a" stroke-width="2" points="${$}"/>
            <circle cx="${b(g)}" cy="${f(a.capa.acumulado)}" r="2.4"/>
            <text x="${b(g)-4}" y="${f(a.capa.acumulado)-6}" font-size="8.5" text-anchor="end">${o(a.capa.acumulado)}% (executado)</text>
          </svg></div>
        </div>
      </div>
      ${I(a.cad)}
    </section>`);for(const e of a.semanas){const c=t.efetivoSemana(e.dias);n++;const T=e.dias.map((i,v)=>`<th class="centro">${["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"][v]} ${i.data.slice(8,10)}</th>`).join("");d.push(`<section class="folha">
        ${R(a.cad,a.s.projeto,"RELATÓRIO SEMANAL DE OBRA — RSO Nº "+e.numero,n,s,`<b>Semana:</b> ${t.brData(e.ini)} a ${t.brData(e.fim)} · Anexo do RAO Nº ${a.numRao}`)}
        <div class="duas-colunas">
          <div>
            <h2 class="secao">Condições climáticas</h2>
            <table class="clima"><thead><tr><th style="width:16mm">Turno</th>${T}</tr></thead><tbody>
              <tr><td>Manhã</td>${e.dias.map(i=>`<td class="${i.clima.manha}"></td>`).join("")}</tr>
              <tr><td>Tarde</td>${e.dias.map(i=>`<td class="${i.clima.tarde}"></td>`).join("")}</tr></tbody></table>
            <div class="legenda"><span><span class="cx bom"></span>Bom</span><span><span class="cx chuva-p"></span>Chuva praticável</span><span><span class="cx chuva-i"></span>Chuva impraticável</span><span><span class="cx molhado"></span>Molhado prejudicado</span></div>
            <h2 class="secao" style="margin-top:3mm">Efetivo de mão-de-obra</h2>
            ${c.funcoes.length?`<table><thead><tr><th>Função</th>${T}</tr></thead><tbody>
              ${c.funcoes.map(i=>`<tr><td>${r(i)}</td>${c.porFuncao.get(i).map(v=>`<td class="centro">${v||"—"}</td>`).join("")}</tr>`).join("")}
              <tr class="rodape"><td>TOTAL</td>${c.totais.map(i=>`<td class="centro">${i||"—"}</td>`).join("")}</tr></tbody></table>`:`<p style="font-size:9px;border:1px solid var(--grade);padding:2mm">Sem efetivo registrado nos RDOs da semana.</p>`}
            <h2 class="secao" style="margin-top:3mm">Metas da semana</h2>
            <div style="font-size:9px;border:1px solid var(--grade);padding:1.5mm 2mm;min-height:8mm">&nbsp;</div>
          </div>
          <div>
            <h2 class="secao">Descrição das atividades</h2>
            ${e.dias.filter(i=>i.atividades).map(i=>`<div class="bloco-dia"><div class="rotulo">${r(i.rotulo)}</div><ul>${r(i.atividades).split("\n").filter(Boolean).map(v=>`<li>${v}</li>`).join("")}</ul></div>`).join("")||`<p style="font-size:9px;border:1px solid var(--grade);padding:2mm">Sem atividades registradas nos RDOs.</p>`}
            <h2 class="secao" style="margin-top:3mm">Paralisações / demoras / críticos / interrupções</h2>
            ${e.dias.filter(i=>i.ocorrencias).map(i=>`<div class="bloco-dia"><div class="rotulo">${r(i.rotulo)}</div><ul>${r(i.ocorrencias).split("\n").filter(Boolean).map(v=>`<li>${v}</li>`).join("")}</ul></div>`).join("")||`<div style="font-size:9px;border:1px solid var(--grade);padding:2mm">Sem ocorrências registradas.</div>`}
          </div>
        </div>
      </section>`);n++;const S=e.dias.flatMap(i=>i.fotosUrl||[]);d.push(`<section class="folha">
        ${R(a.cad,a.s.projeto,"RSO Nº "+e.numero+" · FOLHA FOTOGRÁFICA",n,s,`<b>Semana:</b> ${t.brData(e.ini)} a ${t.brData(e.fim)} · Anexo do RAO Nº ${a.numRao}`)}
        ${S.length?`<div class="grade-fotos">${S.map(i=>`<figure class="foto"><div class="img"><img src="${i.url}" alt="${r(i.nome)}" style="width:100%;height:100%;object-fit:cover"></div><figcaption class="carimbo"><span>${t.brData(i.data)}</span><span>${r(i.nome||a.s.projeto.nome)}</span></figcaption></figure>`).join("")}</div>`:`<p style="font-size:10px;border:1px solid var(--grade);padding:3mm">Sem fotos nos RDOs desta semana. Fotos anexadas ao RDO entram aqui com o carimbo da data.</p>`}
        ${I(a.cad)}
      </section>`)}return`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>RAO Nº ${a.numRao} — ${r(a.s.projeto.nome)}</title><style>${H}</style></head>
      <body><div class="faixa-s1 so-tela">✏️ Documento EDITÁVEL: clique em qualquer texto e ajuste (metas da semana, observações…). <b>Ctrl+P → Salvar como PDF</b> (A4 paisagem, com camada de texto). A aritmética da capa foi calculada pelo app.</div>
      ${d.join("\n")}
      <script>for (const el of document.querySelectorAll("td, th, li, .dados, .titulo, .sub, .assina, figcaption span, .bloco-dia .rotulo, h2.secao, div[style]")) { if (!el.querySelector("svg,img")) { el.setAttribute("contenteditable", "true"); el.setAttribute("spellcheck", "false"); } }<\/script>
      </body></html>`}function I(a){return`<div class="assinaturas">
      <div class="assina"><div class="linha"></div><b>CONTRATADA</b> — ${r(a.contratada||"")}<br>Nome · RG · Data</div>
      <div class="assina"><div class="linha"></div><b>CONTRATANTE</b> — ${r(a.cliente||"")}<br>Nome · RG · Data</div>
    </div>`}const H=`
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
  [contenteditable]:hover{outline:1.5px dashed #9ab;outline-offset:1px;cursor:text}[contenteditable]:focus{outline:2px solid #4a90d9;background:#fffde7}`;window.RAO_UI={cardHTML:P,abrir:z,trocaProjeto:D,salvarMedicaoUI:B,gerar:L}})();
