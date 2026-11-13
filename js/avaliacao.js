// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.
const AVAL={LS:"cb-aval-v1",tab:"fatores",s:null,_vazio(){return{subj:{ident:"",endereco:"",area:null},fat:{amostras:[novaAmostra(),novaAmostra(),novaAmostra()]},reg:{dep:"Valor unitário (R$/m²)",vars:["Área (m²)","Idade (anos)"],rows:[],subj:[null,null]},laudo:{finalidade:"Valor de mercado para compra e venda",solicitante:"",rt:"",crea:"",art:"",data:"",cidade:"",metodo:"fatores"}}},load(){if(this.s)return this.s;try{this.s=JSON.parse(localStorage.getItem(this.LS))||null}catch{this.s=null}if(!this.s)this.s=this._vazio();return this.s},save(){try{localStorage.setItem(this.LS,JSON.stringify(this.s))}catch{}}};function novaAmostra(){return{desc:"",valor:null,area:null,f:{oferta:1,local:1,area:1,padrao:1},on:true}}function avalStats(s){const a=s.length;if(!a)return null;const t=s.reduce((o,i)=>o+i,0)/a;const r=a>1?s.reduce((o,i)=>o+(i-t)*(i-t),0)/(a-1):0;const e=Math.sqrt(r);return{n:a,mean:t,sd:e,cv:t!==0?e/Math.abs(t):0,min:Math.min(...s),max:Math.max(...s)}}function computeFatores(){const s=AVAL.load();const a=Number(s.subj.area)||0;const t=s.fat.amostras.map(c=>{const h=Number(c.valor)||0;const v=Number(c.area)||0;const f=AVAL_FATORES.map(m=>Number(c.f[m.id])||0);const g=f.reduce((m,$)=>m*$,1);const b=v>0?h/v:null;const p=b!=null?b*g:null;const y=f.some(m=>m>0&&(m<AVAL_FATOR_MIN||m>AVAL_FATOR_MAX));return{...c,valor:h,ar:v,fs:f,prod:g,vu:b,vh:p,foraLimite:y,valido:c.on&&p!=null&&isFinite(p)&&p>0}});const r=t.filter(c=>c.valido).map(c=>c.vh);const e=avalStats(r);if(!e)return{amostras:t,stats:null,area:a};t.forEach(c=>{c.outlier=c.valido&&Math.abs(c.vh-e.mean)/e.mean>AVAL_SANEAMENTO});const o={min:e.mean*(1-AVAL_ARBITRIO),max:e.mean*(1+AVAL_ARBITRIO)};const i=a>0?e.mean*a:null;const l=AVAL_GRAU_FATORES.find(c=>e.n>=c.minDados)||null;const n=AVAL_PRECISAO_CV.find(c=>e.cv<=c.max)||null;return{amostras:t,stats:e,arbitrio:o,valorTotal:i,area:a,grauFund:l,grauPrec:n}}function mT(s){return s[0].map((a,t)=>s.map(r=>r[t]))}function mMul(s,a){const t=mT(a);return s.map(r=>t.map(e=>r.reduce((o,i,l)=>o+i*e[l],0)))}function mVec(s,a){return s.map(t=>t.reduce((r,e,o)=>r+e*a[o],0))}function vDot(s,a){return s.reduce((t,r,e)=>t+r*a[e],0)}function mInv(s){const a=s.length;const t=s.map((r,e)=>[...r,...Array.from({length:a},(o,i)=>e===i?1:0)]);for(let r=0;r<a;r++){let e=r;for(let i=r+1;i<a;i++)if(Math.abs(t[i][r])>Math.abs(t[e][r]))e=i;if(Math.abs(t[e][r])<1e-12)return null;[t[r],t[e]]=[t[e],t[r]];const o=t[r][r];for(let i=0;i<2*a;i++)t[r][i]/=o;for(let i=0;i<a;i++){if(i===r)continue;const l=t[i][r];for(let n=0;n<2*a;n++)t[i][n]-=l*t[r][n]}}return t.map(r=>r.slice(a))}function computeRegressao(){const s=AVAL.load();const a=s.reg.vars.length;const t=s.reg.rows.map(d=>({y:Number(d.y),x:(d.x||[]).map(Number)})).filter(d=>isFinite(d.y)&&d.x.length===a&&d.x.every(isFinite));const r=t.length,e=a+1;if(r<e)return{error:`Dados insuficientes: informe ao menos ${e} amostras completas (nº de parâmetros = ${e}).`,n:r,p:e,k:a};const o=t.map(d=>[1,...d.x]);const i=t.map(d=>d.y);const l=mInv(mMul(mT(o),o));if(!l)return{error:"Não foi possível ajustar (matriz singular — variáveis colineares ou repetidas).",n:r,p:e,k:a};const n=mVec(l,mVec(mT(o),i));const c=o.map(d=>vDot(d,n));const h=i.map((d,u)=>d-c[u]);const v=i.reduce((d,u)=>d+u,0)/r;const f=i.reduce((d,u)=>d+(u-v)*(u-v),0);const g=h.reduce((d,u)=>d+u*u,0);const b=f-g;const p=r-e,y=e-1;const m=f>0?b/f:0;const $=p>0&&r>1?1-g/p/(f/(r-1)):NaN;const x=p>0?g/p:NaN;const L=Math.sqrt(x);const w=y>0&&x>0?b/y/x:NaN;const A=n.map((d,u)=>Math.sqrt(x*l[u][u]));const N=n.map((d,u)=>A[u]>0?d/A[u]:NaN);const E=(s.reg.subj||[]).map(Number);let _=null;if(E.length===a&&E.every(isFinite)){const d=[1,...E];const u=vDot(d,n);const F=vDot(d,mVec(l,d));const R=L*Math.sqrt(1+Math.max(F,0));_={y:u,sePred:R,lo:u-2*R,hi:u+2*R}}const I=AVAL_GRAU_REGRESSAO.find(d=>r>=d.fator*e)||null;return{beta:n,r2:m,r2adj:$,se:L,F:w,mse:x,n:r,p:e,k:a,dfE:p,dfR:y,seBeta:A,tBeta:N,dep:s.reg.dep,vars:s.reg.vars,pred:_,grauFund:I}}function renderAvaliacao(s){AVAL.load();if(s==="regressao"||s==="laudo"||s==="fatores")AVAL.tab=s;const a=(t,r,e)=>`<button data-t="${t}" class="${AVAL.tab===t?"active":""}"><i class="ti ${r}"></i> ${e}</button>`;app.innerHTML=`
    <h2 class="page-title">Avaliação de imóveis</h2>
    <p class="page-sub">Valor de mercado pela <strong>NBR 14653</strong> — método comparativo (fatores/regressão) e laudo. Ferramenta de apoio; os resultados não substituem o responsável técnico.</p>
    <details class="sinapi-howto">
      <summary><i class="ti ti-info-circle"></i> Como funciona a avaliação (NBR 14653)</summary>
      <ul>${AVAL_NBR_PONTOS.map(t=>`<li>${esc(t)}</li>`).join("")}</ul>
      <p class="howto-src">Resumo orientativo do procedimento — não reproduz o texto integral. Obtenha a norma vigente junto à ABNT.</p>
    </details>
    <div class="tabs-bar" id="aval-tabs">
      ${a("fatores","ti-table","Comparativo (fatores)")}
      ${a("regressao","ti-chart-dots","Regressão")}
      ${a("laudo","ti-file-description","Laudo")}
    </div>
    <div id="aval-pane"></div>`;document.querySelectorAll("#aval-tabs button").forEach(t=>t.addEventListener("click",()=>{AVAL.tab=t.dataset.t;renderAvaliacao(AVAL.tab)}));renderAvalPane()}function renderAvalPane(){const s=document.getElementById("aval-pane");if(!s)return;if(AVAL.tab==="regressao"){paneRegressao(s);return}if(AVAL.tab==="laudo"){paneLaudo(s);return}paneFatores(s)}const avalDisclaimer=`<div class="card no-print" style="margin-top:14px;border-left:3px solid var(--amber)">
  <p style="margin:0;font-size:13px"><i class="ti ti-alert-triangle" aria-hidden="true" style="color:var(--amber)"></i>
  Resultado <strong>orientativo</strong>. A avaliação formal deve seguir a NBR 14653 vigente e ser assinada por profissional habilitado (engenheiro/arquiteto com ART/RRT). Confira os dados, o saneamento e o grau de fundamentação.</p></div>`;function paneFatores(s){const a=AVAL.load();s.innerHTML=`
    <div class="card">
      <div class="field" style="max-width:340px">
        <label for="avf-area">Área do imóvel avaliando (m²)</label>
        <input type="number" id="avf-area" step="any" min="0" value="${a.subj.area!=null?a.subj.area:""}" placeholder="ex.: 120">
        <span class="hint">Base para converter o valor unitário (R$/m²) em valor total.</span>
      </div>
      <h3 style="margin:6px 0 4px">Dados de mercado</h3>
      <p class="page-sub" style="margin:0 0 10px">Informe valor total, área e os fatores de homogeneização (referência = 1,000; cada fator deve ficar entre ${fmtNum(AVAL_FATOR_MIN,2)} e ${fmtNum(AVAL_FATOR_MAX,2)}). Desmarque para excluir uma amostra do saneamento.</p>
      <div class="aval-scroll">
        <table class="data aval-table" id="avf-table">
          <thead><tr>
            <th style="width:30px" title="Incluir no cálculo">✓</th>
            <th style="min-width:120px">Descrição</th>
            <th style="width:120px;text-align:right">Valor total (R$)</th>
            <th style="width:90px;text-align:right">Área (m²)</th>
            <th style="width:96px;text-align:right">V. unit.</th>
            ${AVAL_FATORES.map(r=>`<th style="width:78px;text-align:right" title="${esc(r.hint)}">${esc(r.label)}</th>`).join("")}
            <th style="width:108px;text-align:right">V. homog.</th>
            <th style="width:34px"></th>
          </tr></thead>
          <tbody id="avf-body">${rowsFatoresHTML()}</tbody>
        </table>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
        <button class="btn" id="avf-add"><i class="ti ti-plus"></i> Adicionar amostra</button>
        <button class="btn" id="avf-exemplo"><i class="ti ti-flask"></i> Carregar exemplo</button>
        <button class="btn" id="avf-limpar"><i class="ti ti-eraser"></i> Limpar</button>
      </div>
    </div>
    <div id="avf-result"></div>
    ${avalDisclaimer}`;const t=document.getElementById("avf-body");document.getElementById("avf-area").addEventListener("input",r=>{a.subj.area=r.target.value===""?null:parseFloat(r.target.value);AVAL.save();recalcFatores()});t.addEventListener("input",r=>{const e=r.target.closest("tr[data-i]");if(!e)return;const o=+e.dataset.i,i=r.target.dataset.c;if(!i)return;const l=a.fat.amostras[o];if(!l)return;if(i==="desc")l.desc=r.target.value;else if(i==="valor")l.valor=r.target.value===""?null:parseFloat(r.target.value);else if(i==="area")l.area=r.target.value===""?null:parseFloat(r.target.value);else if(i.indexOf("f-")===0)l.f[i.slice(2)]=r.target.value===""?null:parseFloat(r.target.value);AVAL.save();recalcFatores()});t.addEventListener("change",r=>{const e=r.target.closest("tr[data-i]");if(!e||!r.target.matches(".avf-on"))return;a.fat.amostras[+e.dataset.i].on=r.target.checked;AVAL.save();recalcFatores()});t.addEventListener("click",r=>{const e=r.target.closest(".avf-del");if(!e)return;a.fat.amostras.splice(+e.closest("tr[data-i]").dataset.i,1);if(!a.fat.amostras.length)a.fat.amostras.push(novaAmostra());AVAL.save();paneFatores(s)});document.getElementById("avf-add").addEventListener("click",()=>{a.fat.amostras.push(novaAmostra());AVAL.save();paneFatores(s)});document.getElementById("avf-limpar").addEventListener("click",()=>{a.subj.area=null;a.fat.amostras=[novaAmostra(),novaAmostra(),novaAmostra()];AVAL.save();paneFatores(s)});document.getElementById("avf-exemplo").addEventListener("click",()=>{carregarExemploFatores();paneFatores(s)});recalcFatores()}function rowsFatoresHTML(){const s=AVAL.s.fat.amostras;return s.map((a,t)=>`
    <tr data-i="${t}">
      <td style="text-align:center"><input type="checkbox" class="avf-on" ${a.on?"checked":""} aria-label="Incluir amostra ${t+1}"></td>
      <td><input type="text" class="aval-in" data-c="desc" value="${esc(a.desc||"")}" placeholder="ex.: Apto 3 dorm., bairro X"></td>
      <td><input type="number" class="aval-in t-right" data-c="valor" step="any" min="0" value="${a.valor!=null?a.valor:""}"></td>
      <td><input type="number" class="aval-in t-right" data-c="area" step="any" min="0" value="${a.area!=null?a.area:""}"></td>
      <td class="t-right" id="avf-vu-${t}" style="color:var(--text-2)">—</td>
      ${AVAL_FATORES.map(r=>`<td><input type="number" class="aval-in t-right avf-f" data-c="f-${r.id}" step="0.001" value="${a.f[r.id]!=null?a.f[r.id]:""}"></td>`).join("")}
      <td class="t-right price" id="avf-vh-${t}">—</td>
      <td style="text-align:center"><button class="btn icon-only avf-del" aria-label="Remover amostra ${t+1}" title="Remover"><i class="ti ti-trash"></i></button></td>
    </tr>`).join("")}function recalcFatores(){const s=computeFatores();s.amostras.forEach((e,o)=>{const i=document.getElementById("avf-vu-"+o);const l=document.getElementById("avf-vh-"+o);if(i)i.textContent=e.vu!=null?brl(e.vu):"—";if(l){l.textContent=e.vh!=null?brl(e.vh):"—";l.style.opacity=e.valido?"1":".4"}const n=document.querySelector(`#avf-body tr[data-i="${o}"]`);if(n){n.querySelectorAll(".avf-f").forEach((c,h)=>{const v=parseFloat(c.value);c.style.color=isFinite(v)&&(v<AVAL_FATOR_MIN||v>AVAL_FATOR_MAX)?"var(--red)":""});n.style.background=e.outlier?"var(--amber-light)":""}});const a=document.getElementById("avf-result");if(!a)return;const t=s.stats;if(!t){a.innerHTML=`<p class="page-sub" style="margin-top:14px">Informe ao menos uma amostra válida (valor e área) para ver o resultado.</p>`;return}const r=s.amostras.some(e=>e.outlier);a.innerHTML=`
    <div class="card" style="margin-top:14px">
      <h3 style="margin-bottom:10px"><i class="ti ti-calculator"></i> Resultado — valor de mercado</h3>
      <div class="result ok">
        <div><div class="r-label">Valor unitário homogeneizado (média de ${t.n} dado${t.n>1?"s":""})</div></div>
        <div><span class="r-value">${brl(t.mean)}</span><span class="r-unit"> /m²</span></div>
      </div>
      ${s.valorTotal!=null?`<div class="result">
        <div><div class="r-label">Valor total estimado (× ${fmtNum(s.area)} m²)</div></div>
        <div><span class="r-value">${brl(s.valorTotal)}</span></div>
      </div>`:`<p class="page-sub" style="margin:6px 0">Informe a área do avaliando para obter o valor total.</p>`}
      <table class="spec-table" style="margin-top:8px">
        <tr><td>Campo de arbítrio (±${fmtNum(AVAL_ARBITRIO*100,0)}%)</td><td>${brl(s.arbitrio.min)} a ${brl(s.arbitrio.max)} /m²</td></tr>
        <tr><td>Amplitude da amostra</td><td>${brl(t.min)} a ${brl(t.max)} /m²</td></tr>
        <tr><td>Desvio-padrão</td><td>${brl(t.sd)} /m²</td></tr>
        <tr><td>Coeficiente de variação (CV)</td><td>${fmtNum(t.cv*100,1)}%</td></tr>
        <tr><td>Grau de fundamentação (por nº de dados)</td><td>${s.grauFund?esc(s.grauFund.desc):"Insuficiente (mín. 3 dados)"}</td></tr>
        <tr><td>Grau de precisão (pela dispersão)</td><td>${s.grauPrec?esc(s.grauPrec.desc):"Fora dos graus (CV > 50%)"}</td></tr>
      </table>
      ${r?`<p class="page-sub" style="margin:10px 0 0;color:var(--coral)"><i class="ti ti-alert-triangle"></i> Amostras destacadas divergem mais de ${fmtNum(AVAL_SANEAMENTO*100,0)}% da média — avalie o saneamento (desmarque para excluir).</p>`:""}
      <p class="page-sub" style="margin:10px 0 0"><i class="ti ti-arrow-right"></i> Use estes números no <a href="#" onclick="AVAL.s.laudo.metodo='fatores';AVAL.save();renderAvaliacao('laudo');return false;">Laudo</a>.</p>
    </div>`}function carregarExemploFatores(){const s=AVAL.load();s.subj.area=120;s.fat.amostras=[{desc:"Apto 3 dorm., mesmo bairro",valor:54e4,area:110,f:{oferta:.9,local:1,area:1.02,padrao:1},on:true},{desc:"Apto 3 dorm., bairro vizinho",valor:62e4,area:128,f:{oferta:.9,local:1.05,area:.98,padrao:1.03},on:true},{desc:"Apto 2 dorm., mesma rua",valor:48e4,area:95,f:{oferta:.9,local:1,area:1.05,padrao:.97},on:true},{desc:"Apto 3 dorm., oferta antiga",valor:7e5,area:130,f:{oferta:.9,local:1.02,area:.98,padrao:1.05},on:true},{desc:"Apto 4 dorm., padrão alto",valor:82e4,area:150,f:{oferta:.9,local:1.03,area:.95,padrao:1.1},on:true}];AVAL.save()}function paneRegressao(s){const a=AVAL.load();const t=a.reg.vars.length;s.innerHTML=`
    <div class="card">
      <p class="page-sub" style="margin:0 0 12px">Regressão linear múltipla (mínimos quadrados): modela o valor em função das características. Informe as variáveis, os dados de mercado e os valores do imóvel avaliando.</p>
      <div class="field-row" style="grid-template-columns:1fr auto">
        <div class="field" style="margin:0">
          <label for="avr-dep">Variável dependente (o que se quer estimar)</label>
          <input type="text" id="avr-dep" value="${esc(a.reg.dep)}">
        </div>
        <div class="field" style="margin:0">
          <label for="avr-nvars">Nº de variáveis</label>
          <select id="avr-nvars" class="sinapi-uf">${[1,2,3,4].map(e=>`<option value="${e}"${e===t?" selected":""}>${e}</option>`).join("")}</select>
        </div>
      </div>
      <div class="aval-scroll">
        <table class="data aval-table" id="avr-table">
          <thead><tr>
            <th style="width:30px">#</th>
            ${a.reg.vars.map((e,o)=>`<th style="min-width:110px"><input type="text" class="aval-in avr-vname" data-j="${o}" value="${esc(e)}" placeholder="Variável ${o+1}"></th>`).join("")}
            <th style="min-width:130px;text-align:right">${esc(a.reg.dep)}</th>
            <th style="width:34px"></th>
          </tr></thead>
          <tbody id="avr-body">${rowsRegressaoHTML()}</tbody>
          <tfoot><tr style="background:var(--blue-light)">
            <td style="font-weight:600;color:var(--blue-dark)" title="Imóvel avaliando">A.</td>
            ${a.reg.vars.map((e,o)=>`<td><input type="number" class="aval-in t-right avr-subj" data-j="${o}" step="any" value="${a.reg.subj[o]!=null?a.reg.subj[o]:""}" placeholder="avaliando"></td>`).join("")}
            <td class="t-right" id="avr-pred-cell" style="font-weight:600;color:var(--blue-dark)">—</td>
            <td></td>
          </tr></tfoot>
        </table>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
        <button class="btn" id="avr-add"><i class="ti ti-plus"></i> Adicionar dado</button>
        <button class="btn primary" id="avr-calc"><i class="ti ti-equal"></i> Calcular regressão</button>
        <button class="btn" id="avr-exemplo"><i class="ti ti-flask"></i> Carregar exemplo</button>
        <button class="btn" id="avr-limpar"><i class="ti ti-eraser"></i> Limpar</button>
      </div>
    </div>
    <div id="avr-result"></div>
    ${avalDisclaimer}`;const r=document.getElementById("avr-body");document.getElementById("avr-dep").addEventListener("input",e=>{a.reg.dep=e.target.value;AVAL.save()});document.getElementById("avr-nvars").addEventListener("change",e=>{ajustarNVars(+e.target.value);paneRegressao(s)});s.querySelectorAll(".avr-vname").forEach(e=>e.addEventListener("input",o=>{a.reg.vars[+o.target.dataset.j]=o.target.value;AVAL.save()}));s.querySelectorAll(".avr-subj").forEach(e=>e.addEventListener("input",o=>{a.reg.subj[+o.target.dataset.j]=o.target.value===""?null:parseFloat(o.target.value);AVAL.save()}));r.addEventListener("input",e=>{const o=e.target.closest("tr[data-i]");if(!o)return;const i=+o.dataset.i,l=e.target.dataset.c,n=e.target.value===""?null:parseFloat(e.target.value);if(l==="y")a.reg.rows[i].y=n;else if(l&&l.indexOf("x-")===0)a.reg.rows[i].x[+l.slice(2)]=n;AVAL.save()});r.addEventListener("click",e=>{const o=e.target.closest(".avr-del");if(!o)return;a.reg.rows.splice(+o.closest("tr[data-i]").dataset.i,1);AVAL.save();paneRegressao(s)});document.getElementById("avr-add").addEventListener("click",()=>{a.reg.rows.push({y:null,x:Array(t).fill(null)});AVAL.save();paneRegressao(s)});document.getElementById("avr-calc").addEventListener("click",()=>renderRegressaoResult());document.getElementById("avr-exemplo").addEventListener("click",()=>{carregarExemploRegressao();paneRegressao(s);renderRegressaoResult()});document.getElementById("avr-limpar").addEventListener("click",()=>{a.reg.rows=[];a.reg.subj=Array(t).fill(null);AVAL.save();paneRegressao(s)})}function ajustarNVars(s){const a=AVAL.load();const t=a.reg.vars.length;if(s>t){for(let r=t;r<s;r++){a.reg.vars.push("Variável "+(r+1));a.reg.subj.push(null);a.reg.rows.forEach(e=>e.x.push(null))}}else if(s<t){a.reg.vars.length=s;a.reg.subj.length=s;a.reg.rows.forEach(r=>r.x.length=s)}AVAL.save()}function rowsRegressaoHTML(){const s=AVAL.s;if(!s.reg.rows.length)return`<tr><td colspan="${s.reg.vars.length+3}" style="color:var(--text-3);padding:14px">Nenhum dado ainda. Clique em "Adicionar dado" ou "Carregar exemplo".</td></tr>`;return s.reg.rows.map((a,t)=>`
    <tr data-i="${t}">
      <td style="color:var(--text-3)">${t+1}</td>
      ${a.x.map((r,e)=>`<td><input type="number" class="aval-in t-right" data-c="x-${e}" step="any" value="${r!=null?r:""}"></td>`).join("")}
      <td><input type="number" class="aval-in t-right" data-c="y" step="any" value="${a.y!=null?a.y:""}"></td>
      <td style="text-align:center"><button class="btn icon-only avr-del" aria-label="Remover dado ${t+1}" title="Remover"><i class="ti ti-trash"></i></button></td>
    </tr>`).join("")}function renderRegressaoResult(){const s=document.getElementById("avr-result");if(!s)return;const a=computeRegressao();const t=document.getElementById("avr-pred-cell");if(a.error){if(t)t.textContent="—";s.innerHTML=`<div class="card" style="margin-top:14px"><p style="margin:0;font-size:14px"><i class="ti ti-alert-triangle" style="color:var(--coral)"></i> ${esc(a.error)}</p></div>`;return}if(t)t.textContent=a.pred?brl(a.pred.y):"—";const r=`${esc(a.dep)} = ${fmtNum(a.beta[0],2)} `+a.vars.map((o,i)=>`${a.beta[i+1]>=0?"+ ":"− "}${fmtNum(Math.abs(a.beta[i+1]),4)}·(${esc(o)})`).join(" ");const e=a.beta.map((o,i)=>{const l=i===0?"Intercepto (β₀)":esc(a.vars[i-1]);const n=a.tBeta[i];const c=isFinite(n)&&Math.abs(n)>=2?`<span class="pill pill-teal">|t|≥2</span>`:`<span class="pill pill-gray">baixa</span>`;return`<tr><td>${l}</td><td class="t-right">${fmtNum(o,4)}</td><td class="t-right">${isFinite(a.seBeta[i])?fmtNum(a.seBeta[i],4):"—"}</td><td class="t-right">${isFinite(n)?fmtNum(n,2):"—"} ${c}</td></tr>`}).join("");s.innerHTML=`
    <div class="card" style="margin-top:14px">
      <h3 style="margin-bottom:10px"><i class="ti ti-chart-dots"></i> Modelo de regressão</h3>
      ${a.pred?`<div class="result ok">
        <div><div class="r-label">Estimativa para o avaliando</div><div class="r-label" style="font-weight:400;opacity:.85">Intervalo ~95%: ${brl(a.pred.lo)} a ${brl(a.pred.hi)}</div></div>
        <div><span class="r-value">${brl(a.pred.y)}</span></div>
      </div>`:`<p class="page-sub">Preencha os valores do <strong>avaliando</strong> (linha "A.") para obter a estimativa.</p>`}
      <p style="font-size:13px;background:var(--bg-2,#f6f6f6);padding:10px 12px;border-radius:8px;overflow-x:auto"><strong>Equação:</strong> ${r}</p>
      <table class="spec-table">
        <tr><td>Coeficiente de determinação (R²)</td><td>${fmtNum(a.r2*100,2)}%</td></tr>
        <tr><td>R² ajustado</td><td>${isFinite(a.r2adj)?fmtNum(a.r2adj*100,2)+"%":"—"}</td></tr>
        <tr><td>Erro-padrão da estimativa</td><td>${brl(a.se)}</td></tr>
        <tr><td>Estatística F</td><td>${isFinite(a.F)?fmtNum(a.F,2):"—"} (gl ${a.dfR}, ${a.dfE})</td></tr>
        <tr><td>Nº de dados / parâmetros</td><td>${a.n} / ${a.p}</td></tr>
        <tr><td>Grau de fundamentação (por nº de dados)</td><td>${a.grauFund?esc(a.grauFund.desc):"Abaixo do Grau I (n < 3·(k+1))"}</td></tr>
      </table>
      <h4 style="margin:14px 0 6px;font-size:14px">Coeficientes</h4>
      <div class="aval-scroll"><table class="data" style="font-size:13px">
        <thead><tr><th>Variável</th><th class="t-right">Coef.</th><th class="t-right">Erro-padrão</th><th class="t-right">t (signif.)</th></tr></thead>
        <tbody>${e}</tbody>
      </table></div>
      <p class="page-sub" style="margin:10px 0 0">|t| ≥ 2 indica variável estatisticamente relevante (aprox.). Banda da estimativa é aproximada (t≈2). Confira os pressupostos da regressão e os graus da NBR 14653.</p>
      <p class="page-sub" style="margin:6px 0 0"><i class="ti ti-arrow-right"></i> Use no <a href="#" onclick="AVAL.s.laudo.metodo='regressao';AVAL.save();renderAvaliacao('laudo');return false;">Laudo</a>.</p>
    </div>`}function carregarExemploRegressao(){const s=AVAL.load();s.reg.dep="Valor total (R$)";s.reg.vars=["Área (m²)","Idade (anos)"];s.reg.subj=[120,5];s.reg.rows=[{y:478e3,x:[110,8]},{y:585e3,x:[128,3]},{y:386e3,x:[95,12]},{y:604e3,x:[130,2]},{y:689e3,x:[150,1]},{y:342e3,x:[90,15]},{y:527e3,x:[118,6]},{y:418e3,x:[100,10]},{y:625e3,x:[140,4]},{y:466e3,x:[105,7]}];AVAL.save()}function paneLaudo(s){const a=AVAL.load();const t=a.laudo;const r=(o,i,l)=>`<div class="field"><label for="avl-${o}">${i}</label><input type="text" id="avl-${o}" value="${esc(t[o]||"")}" placeholder="${esc(l||"")}"></div>`;s.innerHTML=`
    <div class="card no-print">
      <h3 style="margin-bottom:10px">Dados do laudo</h3>
      <div class="field-row">
        ${r("solicitante","Solicitante","Nome / CPF-CNPJ")}
        ${r("finalidade","Finalidade","ex.: compra e venda")}
      </div>
      <div class="field"><label for="avl-endereco">Endereço do imóvel avaliando</label><input type="text" id="avl-endereco" value="${esc(a.subj.endereco||"")}" placeholder="Endereço completo"></div>
      <div class="field-row">
        ${r("rt","Responsável técnico","Nome do eng./arquiteto")}
        ${r("crea","CREA/CAU nº","")}
      </div>
      <div class="field-row">
        ${r("art","ART/RRT nº","")}
        ${r("cidade","Cidade","")}
      </div>
      <div class="field-row">
        <div class="field"><label for="avl-data">Data</label><input type="date" id="avl-data" value="${esc(t.data||"")}"></div>
        <div class="field"><label for="avl-metodo">Método empregado</label>
          <select id="avl-metodo" class="sinapi-uf">
            <option value="fatores"${t.metodo==="fatores"?" selected":""}>Comparativo — tratamento por fatores</option>
            <option value="regressao"${t.metodo==="regressao"?" selected":""}>Comparativo — regressão linear</option>
          </select>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">
        <button class="btn primary" id="avl-print"><i class="ti ti-printer"></i> Imprimir / salvar PDF</button>
      </div>
    </div>
    <div id="avl-preview"></div>`;const e=(o,i,l)=>document.getElementById("avl-"+o).addEventListener("input",n=>{l[i]=n.target.value;AVAL.save();renderLaudoPreview()});["solicitante","finalidade","rt","crea","art","cidade","data"].forEach(o=>e(o,o,t));document.getElementById("avl-endereco").addEventListener("input",o=>{a.subj.endereco=o.target.value;AVAL.save();renderLaudoPreview()});document.getElementById("avl-metodo").addEventListener("change",o=>{t.metodo=o.target.value;AVAL.save();renderLaudoPreview()});document.getElementById("avl-print").addEventListener("click",()=>window.print());renderLaudoPreview()}function renderLaudoPreview(){const s=document.getElementById("avl-preview");if(!s)return;const a=AVAL.load(),t=a.laudo;const r=t.data?new Date(t.data+"T00:00").toLocaleDateString("pt-BR"):new Date().toLocaleDateString("pt-BR");const e=(l,n)=>`<tr><td>${esc(l)}</td><td>${n}</td></tr>`;let o="",i="";if(t.metodo==="regressao"){const l=computeRegressao();o=`<p>Empregou-se o <strong>método comparativo direto de dados de mercado</strong> com <strong>tratamento por regressão linear múltipla</strong> (inferência estatística), modelando ${esc(a.reg.dep)} em função de ${a.reg.vars.map(n=>esc(n)).join(", ")}.</p>`;if(l.error){i=`<p style="color:#922b21">${esc(l.error)} Complete os dados na aba Regressão.</p>`}else{o+=`<table class="spec-table" style="margin:8px 0">
        ${e("Nº de dados de mercado",l.n)}
        ${e("R² / R² ajustado",`${fmtNum(l.r2*100,2)}% / ${isFinite(l.r2adj)?fmtNum(l.r2adj*100,2)+"%":"—"}`)}
        ${e("Erro-padrão da estimativa",brl(l.se))}
        ${e("Grau de fundamentação",l.grauFund?esc(l.grauFund.desc):"Abaixo do Grau I")}</table>`;i=l.pred?`<p>Pela aplicação do modelo às características do imóvel avaliando, o <strong>valor de mercado</strong> resulta em:</p>
           <p class="aval-laudo-val">${brl(l.pred.y)}</p>
           <p style="font-size:13px">Intervalo de confiança aproximado (~95%): ${brl(l.pred.lo)} a ${brl(l.pred.hi)}.</p>`:`<p style="color:#922b21">Informe os valores do imóvel avaliando na aba Regressão para concluir a estimativa.</p>`}}else{const l=computeFatores();o=`<p>Empregou-se o <strong>método comparativo direto de dados de mercado</strong> com <strong>tratamento por fatores</strong>, homogeneizando ${l.stats?l.stats.n:0} dado(s) de mercado por meio dos fatores de ${AVAL_FATORES.map(n=>n.label.toLowerCase()).join(", ")} (referência = 1,000).</p>`;if(!l.stats){i=`<p style="color:#922b21">Informe ao menos uma amostra válida na aba Comparativo (fatores) para concluir a avaliação.</p>`}else{o+=`<table class="spec-table" style="margin:8px 0">
        ${e("Nº de dados utilizados",l.stats.n)}
        ${e("Valor unitário médio homogeneizado",brl(l.stats.mean)+" /m²")}
        ${e("Coeficiente de variação (CV)",fmtNum(l.stats.cv*100,1)+"%")}
        ${e("Campo de arbítrio (±"+fmtNum(AVAL_ARBITRIO*100,0)+"%)",brl(l.arbitrio.min)+" a "+brl(l.arbitrio.max)+" /m²")}
        ${e("Grau de fundamentação",l.grauFund?esc(l.grauFund.desc):"Insuficiente")}
        ${e("Grau de precisão",l.grauPrec?esc(l.grauPrec.desc):"Fora dos graus")}</table>`;i=l.valorTotal!=null?`<p>Considerando a área de ${fmtNum(l.area)} m² do imóvel avaliando, o <strong>valor de mercado</strong> resulta em:</p>
           <p class="aval-laudo-val">${brl(l.valorTotal)}</p>
           <p style="font-size:13px">Valor unitário de referência: ${brl(l.stats.mean)} /m².</p>`:`<p>Valor unitário de mercado: <span class="aval-laudo-val" style="font-size:20px">${brl(l.stats.mean)} /m²</span>. Informe a área do avaliando para o valor total.</p>`}}s.innerHTML=`
    <div class="card laudo-print" style="margin-top:14px">
      <div class="laudo-print-head"><span class="t">LAUDO DE AVALIAÇÃO DE IMÓVEL — VALOR DE MERCADO</span><span class="m">Conforme diretrizes da ABNT NBR 14653 · gerado pelo Civilbook em ${r}</span></div>
      <h3 style="font-size:15px;margin:4px 0 6px">1. Identificação</h3>
      <table class="spec-table">
        ${e("Solicitante",esc(t.solicitante||"—"))}
        ${e("Finalidade",esc(t.finalidade||"—"))}
        ${e("Imóvel avaliando",esc(a.subj.endereco||"—"))}
        ${e("Responsável técnico",esc(t.rt||"—")+(t.crea?" — CREA/CAU "+esc(t.crea):""))}
        ${e("ART/RRT",esc(t.art||"—"))}
        ${e("Data",r+(t.cidade?" · "+esc(t.cidade):""))}
      </table>
      <h3 style="font-size:15px;margin:14px 0 6px">2. Objetivo e pressupostos</h3>
      <p>Determinar o valor de mercado do imóvel para a finalidade indicada, com base em pesquisa de dados de mercado e tratamento conforme a NBR 14653. Pressupõe-se a veracidade das informações fornecidas e a inexistência de ônus não declarados.</p>
      <h3 style="font-size:15px;margin:14px 0 6px">3. Metodologia e tratamento</h3>
      ${o}
      <h3 style="font-size:15px;margin:14px 0 6px">4. Resultado</h3>
      ${i}
      <h3 style="font-size:15px;margin:14px 0 6px">5. Ressalvas</h3>
      <p style="font-size:13px">Avaliação de apoio, válida na data de referência e para a finalidade declarada. O grau de fundamentação/precisão depende da quantidade e qualidade dos dados. Este documento deve ser conferido e assinado por profissional habilitado (engenheiro/arquiteto) com a respectiva ART/RRT, sob pena de não ter validade técnica.</p>
      <p style="margin-top:26px">${esc(t.cidade||"[Cidade]")}, ${r}.</p>
      <p style="margin-top:30px">_________________________________________<br>${esc(t.rt||"[Responsável técnico]")}${t.crea?" — CREA/CAU "+esc(t.crea):" — CREA/CAU [nº]"}</p>
    </div>`}if(typeof window!=="undefined"){window.AVAL=AVAL;window.renderAvaliacao=renderAvaliacao}
