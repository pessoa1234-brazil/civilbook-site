// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.
function rowToGarReg(e){return{id:e.id,ativo_id:e.ativo_id||"",empreendimento:e.empreendimento||"",unidade:e.unidade||"",sistema:e.sistema,categoria:e.categoria||"",catalogo_id:e.catalogo_id||"",tipo:e.tipo||"oferecida",prazo_anos:e.prazo_anos!=null?Number(e.prazo_anos):1,inicio:e.inicio||"",fornecedor_id:e.fornecedor_id||"",observacoes:e.observacoes||"",dono:e.user_id}}function garRegToRow(e){return{id:e.id,user_id:e.dono||CBStore.uid(),ativo_id:e.ativo_id||null,empreendimento:e.empreendimento||null,unidade:e.unidade||null,sistema:e.sistema,categoria:e.categoria||null,catalogo_id:e.catalogo_id||null,tipo:e.tipo||"oferecida",prazo_anos:Number(e.prazo_anos)||1,inicio:e.inicio||null,fornecedor_id:e.fornecedor_id||null,observacoes:e.observacoes||null}}function rowToRelConf(e){return{id:e.id,titulo:e.titulo,empreendimento:e.empreendimento||"",referencia_em:e.referencia_em||"",dados:e.dados||{},observacoes:e.observacoes||"",created_at:e.created_at||"",dono:e.user_id}}function relConfToRow(e){return{id:e.id,user_id:e.dono||CBStore.uid(),titulo:e.titulo,empreendimento:e.empreendimento||null,referencia_em:e.referencia_em||new Date().toISOString().slice(0,10),dados:e.dados||{},observacoes:e.observacoes||null}}const GREG=cbColecao("garantias_registro","cb-gar-registro",rowToGarReg,garRegToRow);const RELC=cbColecao("relatorios_conformidade","cb-rel-conformidade",rowToRelConf,relConfToRow);async function conf2Ready(){await Promise.all([GREG.ready(),RELC.ready()])}function vigenciaCalc(e,a){if(!e)return{status:"sem-data"};const t=new Date(e+"T12:00");if(isNaN(t.getTime()))return{status:"sem-data"};const o=new Date(t);o.setFullYear(o.getFullYear()+Number(a||0));const s=new Date;s.setHours(0,0,0,0);const i=Math.ceil((o-s)/864e5);if(i<0)return{status:"vencida",dias:-i,vence:o};if(i<=90)return{status:"vencendo",dias:i,vence:o};return{status:"vigente",dias:i,vence:o}}function garRegInicio(e){if(e.inicio)return e.inicio;const a=e.ativo_id&&typeof ATV!=="undefined"?ATV.get(e.ativo_id):null;if(a&&a.instalado_em)return a.instalado_em;return typeof GAR!=="undefined"&&GAR.inicioGarantias?GAR.inicioGarantias()||"":""}function garRegStats(e){const a=e||GREG.listar();const t={total:0,vigentes:0,vencendo:0,vencidas:0,semData:0,listaVencendo:[],listaVencidas:[]};a.forEach(o=>{t.total++;const s=vigenciaCalc(garRegInicio(o),o.prazo_anos);if(s.status==="vigente")t.vigentes++;else if(s.status==="vencendo"){t.vigentes++;t.vencendo++;t.listaVencendo.push({sistema:o.sistema,dias:s.dias})}else if(s.status==="vencida"){t.vencidas++;t.listaVencidas.push({sistema:o.sistema,dias:s.dias})}else t.semData++});return t}let _garRegEdit=null;function renderGarantiasRegistro(){const e=document.getElementById("gar-registro-host");if(!e)return;const a=GREG.listar();const t=garRegStats(a);e.innerHTML=`
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:4px">
        <h3 style="margin:0"><i class="ti ti-shield-check"></i> Garantias registradas (por ativo/unidade)</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${typeof EXEMPLO!=="undefined"?EXEMPLO.botaoBarraHTML("garantias"):""}
          ${_garRegEdit?"":`<button class="btn primary" onclick="_garRegEdit='new';renderGarantiasRegistro()"><i class="ti ti-plus"></i> Registrar garantia</button>`}
        </div>
      </div>
      <p class="page-sub" style="margin:0 0 10px">Garantias reais do empreendimento vinculadas a um ativo/unidade, com início, prazo, fornecedor e alerta de vigência próprios.${a.length?` <strong style="color:var(--teal)">${t.vigentes}</strong> vigentes${t.vencendo?` · <strong style="color:var(--amber)">${t.vencendo}</strong> vencendo`:""} · <strong style="color:${t.vencidas?"var(--red)":"var(--text-2)"}">${t.vencidas}</strong> vencidas.`:""}</p>
      ${_garRegEdit?garRegFormHTML(_garRegEdit==="new"?null:GREG.get(_garRegEdit)):""}
      ${a.length?garRegListaHTML(a):_garRegEdit?"":typeof EXEMPLO!=="undefined"?EXEMPLO.vazioHTML("garantias",{icone:"ti-shield-check",titulo:"Registre as garantias da obra",texto:"Prazo por sistema (impermeabilização, esquadrias, instalações…), contado do habite-se ou da entrega. O catálogo da NBR 17170 preenche em um clique e o Civilbook mostra o que está vencendo.",ctaLabel:"Registrar a primeira garantia",ctaAcao:"_garRegEdit='new';renderGarantiasRegistro()"}):`<p class="page-sub" style="padding:6px 0;color:var(--text-3)">Nenhuma garantia registrada. Clique em “Registrar garantia” — use “Aplicar do catálogo NBR 17170” para preencher rápido.</p>`}
    </div>
    <div id="gar-confer-host"></div>`;if(a.length&&!_garRegEdit&&typeof CONFER!=="undefined"){const o=a[0];CONFER.montarCard("gar-confer-host",{alvoTipo:"garantia",alvoId:o.id,projetoId:null,titulo:"Garantia: "+(o.sistema||""),dados:()=>garRegDadosConferencia(o)})}}function garRegDadosConferencia(e){if(!e)return"";return`Garantia registrada — ${e.sistema||"?"}
`+(e.categoria?`Categoria: ${e.categoria}
`:"")+`Tipo: ${e.tipo==="legal"?"legal (solidez/seguranca)":"oferecida"}
Prazo: ${e.prazo_anos} ano(s)
`+(e.inicio?`Inicio: ${e.inicio}
`:"")+(e.empreendimento?`Empreendimento: ${e.empreendimento}
`:"")+(e.unidade?`Unidade: ${e.unidade}
`:"")+(e.observacoes?`Observacoes: ${e.observacoes}
`:"")}function garRegListaHTML(e){const a=s=>{const i=(typeof GAR!=="undefined"?GAR.fornecedores():[]).find(r=>r.id===s);return i?i.empresa||i.servico:""};const t={vigente:"teal",vencendo:"amber",vencida:"red","sem-data":"gray"};const o={};e.forEach(s=>{const i=s.ativo_id&&typeof ATV!=="undefined"?ATV.get(s.ativo_id):null;const r=s.empreendimento||i&&i.empreendimento||"Sem empreendimento";(o[r]=o[r]||[]).push(s)});return Object.keys(o).sort().map(s=>`
    <div style="margin-top:8px">
      <div class="ativo-uni" style="margin-bottom:6px"><i class="ti ti-building-community"></i> ${esc(s)}</div>
      ${o[s].map(i=>{const r=garRegInicio(i);const d=vigenciaCalc(r,i.prazo_anos);const c=i.ativo_id&&typeof ATV!=="undefined"?ATV.get(i.ativo_id):null;const n=a(i.fornecedor_id);const l=d.status==="vencida"?`Vencida há ${d.dias}d`:d.status==="vencendo"?`Vence em ${d.dias}d`:d.status==="vigente"?"Vigente":"Defina o início";return`<div class="ativo-item">
          <div style="flex:1;min-width:200px">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <strong>${esc(i.sistema)}</strong>
              ${i.tipo==="legal"?`<span class="pill pill-red">Legal · 5 anos</span>`:`<span class="pill pill-blue">Oferecida</span>`}
              <span class="pill pill-${t[d.status]}">${l}</span>
            </div>
            <p style="font-size:12.5px;color:var(--text-2);margin-top:3px">
              ${i.unidade?`<i class="ti ti-stack-2"></i> ${esc(i.unidade)} · `:""}${c?`<i class="ti ti-package"></i> ${esc(c.nome)} · `:""}${i.prazo_anos} ${Number(i.prazo_anos)===1?"ano":"anos"}${r?` · início ${new Date(r+"T12:00").toLocaleDateString("pt-BR")}`:""}${d.vence?` · vence ${d.vence.toLocaleDateString("pt-BR")}`:""}
            </p>
            ${n?`<p style="font-size:12.5px;color:var(--text-3)"><i class="ti ti-truck"></i> ${esc(n)}</p>`:""}
            ${i.observacoes?`<p style="font-size:12.5px;color:var(--text-3)">${esc(i.observacoes)}</p>`:""}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start">
            <button class="btn" onclick="_garRegEdit='${i.id}';renderGarantiasRegistro()"><i class="ti ti-edit"></i></button>
            <button class="btn icon-only" title="Excluir" onclick="excluirGarReg('${i.id}')"><i class="ti ti-trash"></i></button>
          </div>
        </div>`}).join("")}
    </div>`).join("")}function garRegFormHTML(e){const a=(i,r)=>esc(e&&e[i]!=null&&e[i]!==""?e[i]:r||"");const t=typeof GAR!=="undefined"?GAR.fornecedores():[];const o=typeof GARANTIAS_CATEGORIAS!=="undefined"?GARANTIAS_CATEGORIAS.concat(["Personalizado"]):["Personalizado"];const s=typeof GAR!=="undefined"&&GAR.listarGarantias?GAR.listarGarantias():[];return`
    <div class="card" style="border:1.5px solid var(--blue);margin:6px 0 12px">
      <h4 style="margin:0 0 10px">${e?"Editar":"Nova"} garantia registrada</h4>
      <div class="field">
        <label>Aplicar do catálogo NBR 17170 (opcional — preenche os campos abaixo)</label>
        <select id="greg-cat" onchange="garRegAplicarCatalogo(this.value)">
          <option value="">— escolher um sistema do catálogo —</option>
          ${s.map(i=>`<option value="${esc(i.id)}">${esc(i.sistema)} · ${i.prazo} ${i.prazo===1?"ano":"anos"}${i.tipo==="legal"?" (legal)":""}</option>`).join("")}
        </select>
      </div>
      <div class="field-row">
        <div class="field"><label>Ativo (opcional)</label><select id="greg-ativo" onchange="garRegAtivoChange(this.value)">${typeof ativoOptions==="function"?ativoOptions(e?e.ativo_id:""):`<option value="">— sem ativo —</option>`}</select></div>
        <div class="field"><label>Sistema / item *</label><input type="text" id="greg-sistema" value="${a("sistema")}" placeholder="ex.: Impermeabilização da laje"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Empreendimento</label><input type="text" id="greg-emp" value="${a("empreendimento")}" placeholder="ex.: Edifício Aurora"></div>
        <div class="field"><label>Unidade / setor</label><input type="text" id="greg-uni" value="${a("unidade")}" placeholder="ex.: Torre A / Cobertura"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Categoria</label><select id="greg-categoria">${o.map(i=>`<option${e&&e.categoria===i?" selected":""}>${i}</option>`).join("")}</select></div>
        <div class="field"><label>Tipo</label><select id="greg-tipo"><option value="oferecida"${e&&e.tipo==="oferecida"?" selected":""}>Oferecida</option><option value="legal"${e&&e.tipo==="legal"?" selected":""}>Legal (solidez/segurança · 5 anos)</option></select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Prazo (anos) *</label><input type="number" id="greg-prazo" min="0" step="0.5" value="${a("prazo_anos","1")}"></div>
        <div class="field"><label>Início da garantia</label><input type="date" id="greg-inicio" value="${a("inicio")}"><span style="font-size:11.5px;color:var(--text-3)">Vazio = herda do ativo (instalação) ou da entrega do projeto.</span></div>
      </div>
      <div class="field"><label>Fornecedor responsável (opcional)</label>
        <select id="greg-forn"><option value="">— nenhum —</option>${t.map(i=>`<option value="${esc(i.id)}"${e&&e.fornecedor_id===i.id?" selected":""}>${esc(i.empresa||i.servico)}${i.empresa&&i.servico?" · "+esc(i.servico):""}</option>`).join("")}</select>
      </div>
      <div class="field"><label>Observações</label><textarea id="greg-obs" rows="2">${a("observacoes")}</textarea></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn primary" onclick="salvarGarReg()"><i class="ti ti-device-floppy"></i> ${e?"Salvar":"Registrar"}</button>
        <button class="btn" onclick="_garRegEdit=null;renderGarantiasRegistro()">Cancelar</button>
      </div>
    </div>`}function garRegAplicarCatalogo(e){if(!e||typeof GAR==="undefined"||!GAR.listarGarantias)return;const a=GAR.listarGarantias().find(r=>r.id===e);if(!a)return;const t=(r,d)=>{const c=document.getElementById(r);if(c)c.value=d};t("greg-sistema",a.sistema);t("greg-prazo",a.prazo);const o=document.getElementById("greg-tipo");if(o)o.value=a.tipo==="legal"?"legal":"oferecida";const s=document.getElementById("greg-categoria");if(s&&a.categoria)[...s.options].forEach(r=>{if(r.value===a.categoria||r.text===a.categoria)s.value=r.value});const i=document.getElementById("greg-sistema");if(i)i.dataset.catalogoId=e}function garRegAtivoChange(e){if(!e||typeof ATV==="undefined")return;const a=ATV.get(e);if(!a)return;const t=document.getElementById("greg-emp"),o=document.getElementById("greg-uni");if(t&&!t.value&&a.empreendimento)t.value=a.empreendimento;if(o&&!o.value&&a.unidade)o.value=a.unidade}function salvarGarReg(){const e=document.getElementById("greg-sistema");const a=e.value.trim();if(!a){e.focus();toast("Informe o sistema/item da garantia.","warn");return}const t=_garRegEdit&&_garRegEdit!=="new"?GREG.get(_garRegEdit):null;GREG.upsert({id:t?t.id:CBStore.uuid(),dono:t?t.dono:CBStore.uid(),ativo_id:document.getElementById("greg-ativo").value,empreendimento:document.getElementById("greg-emp").value.trim(),unidade:document.getElementById("greg-uni").value.trim(),sistema:a,categoria:document.getElementById("greg-categoria").value,catalogo_id:e.dataset.catalogoId||(t?t.catalogo_id:""),tipo:document.getElementById("greg-tipo").value,prazo_anos:Number(document.getElementById("greg-prazo").value)||1,inicio:document.getElementById("greg-inicio").value,fornecedor_id:document.getElementById("greg-forn").value,observacoes:document.getElementById("greg-obs").value.trim()});_garRegEdit=null;toast(t?"Garantia atualizada.":"Garantia registrada.","success");renderGarantiasRegistro()}async function excluirGarReg(e){const a=GREG.get(e);if(!a)return;if(!await cbConfirmar(`Excluir a garantia registrada "${a.sistema}"?`))return;GREG.remover(e);toast("Garantia excluída.","info");renderGarantiasRegistro()}let _confEmp="";function conformidadeSnapshot(e){const a=typeof MNT!=="undefined"&&MNT.conformidade?MNT.conformidade():{total:0,emDia:0,vencidas:0,semRegistro:0,pct:0};let t=GREG.listar();if(e)t=t.filter(n=>{const l=n.ativo_id&&typeof ATV!=="undefined"?ATV.get(n.ativo_id):null;return(n.empreendimento||l&&l.empreendimento||"")===e});const o=garRegStats(t);const s=new Date().toISOString().slice(0,10);const i=typeof AGE!=="undefined"?AGE.listar():[];const r={abertos:i.filter(n=>n.status==="agendado").length,atrasados:i.filter(n=>n.status==="agendado"&&n.data&&n.data<s).length};const d=typeof MNT!=="undefined"&&MNT.osAtencao?MNT.osAtencao():{vencidas:[],proximas:[]};const c=typeof MNT!=="undefined"?MNT.listarOS().filter(n=>n.status==="aberta"||n.status==="andamento").length:0;return{mnt:a,garantias:o,agendamentos:r,os:{abertas:c,vencidas:d.vencidas.length,proximas:d.proximas.length}}}function conformidadeEmpreendimentos(){const e=new Set;if(typeof ATV!=="undefined")ATV.listar().forEach(a=>{if(a.empreendimento)e.add(a.empreendimento)});GREG.listar().forEach(a=>{if(a.empreendimento)e.add(a.empreendimento)});return[...e].sort()}function renderMntConformidade(){const e=document.getElementById("mnt-body");if(!e)return;const a=conformidadeSnapshot(_confEmp);const t=a.mnt,o=a.garantias;const s=t.pct>=80?"var(--teal)":t.pct>=50?"var(--amber)":"var(--red)";const i=conformidadeEmpreendimentos();const r=new Date().toISOString().slice(0,10);const d=RELC.listar().slice().sort((n,l)=>(l.created_at||"").localeCompare(n.created_at||"")||(l.referencia_em||"").localeCompare(n.referencia_em||""));const c=(n,l,p,m)=>`<div class="card" style="text-align:center"><div style="font-size:32px;font-weight:600;color:${p}">${n}</div><p>${l}${m||""}</p></div>`;e.innerHTML=`
    <div class="card" style="margin-bottom:14px">
      <h3 style="margin:0 0 4px"><i class="ti ti-clipboard-check"></i> Relatório de conformidade</h3>
      <p class="page-sub" style="margin:0 0 12px">Consolida a manutenção preventiva (NBR 5674) e as garantias (NBR 17170) do empreendimento em um documento exportável (imprimir / salvar PDF).</p>
      <div class="field-row">
        <div class="field"><label>Título do relatório</label><input type="text" id="conf-titulo" value="Relatório de conformidade — manutenção e garantias"></div>
        <div class="field"><label>Empreendimento</label>
          <select id="conf-emp" onchange="_confEmp=this.value;renderMntConformidade()">
            <option value=""${_confEmp===""?" selected":""}>Todos</option>
            ${i.map(n=>`<option value="${esc(n)}"${_confEmp===n?" selected":""}>${esc(n)}</option>`).join("")}
          </select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Data-base</label><input type="date" id="conf-data" value="${r}"></div>
        <div class="field"><label>Observações (opcional)</label><input type="text" id="conf-obs" placeholder="ex.: pendências priorizadas para o próximo mês"></div>
      </div>
      <button class="btn primary" onclick="gerarRelatorioConformidade()"><i class="ti ti-file-plus"></i> Gerar e salvar relatório</button>
    </div>

    <div class="grid grid-3" style="margin-bottom:14px">
      ${c(t.pct+"%","Aderência ao plano preventivo",s)}
      ${c(o.vigentes,"Garantias vigentes","var(--teal)",o.vencendo?` <span class="pill pill-amber">${o.vencendo} vencendo</span>`:"")}
      ${c(o.vencidas,"Garantias vencidas",o.vencidas?"var(--red)":"var(--teal)")}
    </div>
    <div class="grid grid-3" style="margin-bottom:14px">
      ${c(t.vencidas,"Atividades preventivas vencidas",t.vencidas?"var(--red)":"var(--teal)")}
      ${c(a.agendamentos.atrasados,"Agendamentos atrasados",a.agendamentos.atrasados?"var(--red)":"var(--blue)")}
      ${c(a.os.vencidas,"OS com prazo vencido",a.os.vencidas?"var(--red)":"var(--blue)")}
    </div>

    <div class="card">
      <h3 style="margin:0 0 8px"><i class="ti ti-history"></i> Relatórios salvos</h3>
      ${d.length?d.map(n=>`
        <div class="ativo-item">
          <div style="flex:1;min-width:200px">
            <strong>${esc(n.titulo)}</strong>
            <p style="font-size:12.5px;color:var(--text-2);margin-top:2px">${n.empreendimento?esc(n.empreendimento)+" · ":""}Data-base ${n.referencia_em?new Date(n.referencia_em+"T12:00").toLocaleDateString("pt-BR"):"—"}${n.created_at?" · emitido "+new Date(n.created_at).toLocaleDateString("pt-BR"):""}</p>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn" onclick="verRelatorioConformidade('${n.id}')"><i class="ti ti-eye"></i> Ver</button>
            <button class="btn icon-only" title="Excluir" onclick="excluirRelatorioConformidade('${n.id}')"><i class="ti ti-trash"></i></button>
          </div>
        </div>`).join(""):`<p class="page-sub" style="padding:8px 0;color:var(--text-3)">Nenhum relatório salvo. Gere o primeiro acima.</p>`}
    </div>`}function gerarRelatorioConformidade(){const e=(document.getElementById("conf-titulo").value||"").trim()||"Relatório de conformidade";const a=_confEmp;const t=document.getElementById("conf-data").value||new Date().toISOString().slice(0,10);const o=(document.getElementById("conf-obs").value||"").trim();const s={id:CBStore.uuid(),dono:CBStore.uid(),titulo:e,empreendimento:a,referencia_em:t,dados:conformidadeSnapshot(a),observacoes:o,created_at:new Date().toISOString()};RELC.upsert(s);toast("Relatório gerado e salvo.","success");verRelatorioConformidade(s.id)}function verRelatorioConformidade(e){const a=RELC.get(e);if(!a){toast("Relatório não encontrado.","warn");return}const t=document.getElementById("mnt-body");if(!t)return;t.innerHTML=`
    <div class="no-print" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
      <button class="btn" onclick="renderMntConformidade()"><i class="ti ti-arrow-left"></i> Voltar</button>
      <button class="btn primary" onclick="window.print()"><i class="ti ti-printer"></i> Imprimir / salvar PDF</button>
    </div>
    ${relatorioDocHTML(a)}`;t.scrollIntoView({behavior:"smooth",block:"start"})}async function excluirRelatorioConformidade(e){if(!await cbConfirmar("Excluir este relatório salvo?"))return;RELC.remover(e);toast("Relatório excluído.","info");renderMntConformidade()}function relatorioDocHTML(e){const a=e.dados||{};const t=a.mnt||{},o=a.garantias||{},s=a.agendamentos||{},i=a.os||{};const r=e.referencia_em?new Date(e.referencia_em+"T12:00").toLocaleDateString("pt-BR"):"—";const d=e.created_at?new Date(e.created_at).toLocaleDateString("pt-BR"):new Date().toLocaleDateString("pt-BR");const c=(t.pct||0)>=80?"var(--teal)":(t.pct||0)>=50?"var(--amber)":"var(--red)";const n=(l,p,m)=>`<div class="conf-item" style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text-2)">${l}</span><strong style="color:${m||"var(--text)"}">${p}</strong></div>`;return`
    <div class="card laudo-print" data-cb-view="conf-doc">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;border-bottom:2px solid var(--blue);padding-bottom:10px;margin-bottom:14px">
        <div><div style="font-size:13px;color:var(--blue);font-weight:700;letter-spacing:.04em">CIVILBOOK</div>
          <h2 style="margin:2px 0 0">${esc(e.titulo||"Relatório de conformidade")}</h2></div>
        <div style="text-align:right;font-size:12.5px;color:var(--text-2)">
          ${e.empreendimento?`<div><strong>${esc(e.empreendimento)}</strong></div>`:`<div>Todos os empreendimentos</div>`}
          <div>Data-base: ${r}</div>
          <div>Emitido em: ${d}</div>
        </div>
      </div>

      <h3 style="margin:0 0 8px"><i class="ti ti-gauge"></i> Manutenção preventiva — NBR 5674</h3>
      ${n("Aderência ao plano preventivo",(t.pct||0)+"%",c)}
      ${n("Atividades em dia",(t.emDia||0)+" de "+(t.total||0))}
      ${n("Atividades vencidas",t.vencidas||0,t.vencidas?"var(--red)":"var(--teal)")}
      ${n("Sem registro de execução",t.semRegistro||0)}

      <h3 style="margin:16px 0 8px"><i class="ti ti-shield-check"></i> Garantias — NBR 17170</h3>
      ${n("Garantias registradas",o.total||0)}
      ${n("Vigentes",(o.vigentes||0)+(o.vencendo?` (${o.vencendo} vencendo em ≤90 dias)`:""),"var(--teal)")}
      ${n("Vencidas",o.vencidas||0,o.vencidas?"var(--red)":"var(--teal)")}
      ${o.listaVencendo&&o.listaVencendo.length?`<p style="font-size:12.5px;color:var(--amber);margin:6px 0 0"><strong>Vencendo:</strong> ${o.listaVencendo.map(l=>esc(l.sistema)+" ("+l.dias+"d)").join("; ")}</p>`:""}
      ${o.listaVencidas&&o.listaVencidas.length?`<p style="font-size:12.5px;color:var(--red);margin:6px 0 0"><strong>Vencidas:</strong> ${o.listaVencidas.map(l=>esc(l.sistema)+" (há "+l.dias+"d)").join("; ")}</p>`:""}

      <h3 style="margin:16px 0 8px"><i class="ti ti-calendar"></i> Agendamentos e ordens de serviço</h3>
      ${n("Agendamentos abertos",(s.abertos||0)+(s.atrasados?` (${s.atrasados} atrasados)`:""),s.atrasados?"var(--red)":"var(--text)")}
      ${n("OS abertas ou em andamento",i.abertas||0)}
      ${n("OS com prazo vencido",i.vencidas||0,i.vencidas?"var(--red)":"var(--teal)")}
      ${n("OS vencendo (≤7 dias)",i.proximas||0)}

      ${e.observacoes?`<h3 style="margin:16px 0 8px"><i class="ti ti-note"></i> Observações</h3><p style="font-size:13.5px;white-space:pre-wrap">${esc(e.observacoes)}</p>`:""}

      <p style="font-size:11.5px;color:var(--text-3);margin-top:18px;border-top:1px solid var(--border);padding-top:10px">
        Relatório gerado pelo Civilbook a partir dos registros de manutenção (NBR 5674) e de garantias (NBR 17170) do usuário, na data-base indicada. Documento de apoio — não substitui a vistoria nem o parecer de um profissional habilitado (responsável técnico). Os prazos de garantia são de referência (ABNT NBR 17170:2022); confirme no contrato e no manual de uso, operação e manutenção da obra.
      </p>
    </div>`}if(typeof window!=="undefined"){window.GREG=GREG;window.RELC=RELC;window.conf2Ready=conf2Ready;window.renderGarantiasRegistro=renderGarantiasRegistro;window.renderMntConformidade=renderMntConformidade}
