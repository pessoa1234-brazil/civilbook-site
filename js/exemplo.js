const EXEMPLO={_opts:{},_dados:null,dados(){if(!this._dados&&typeof EXEMPLO_OBRA!=="undefined")this._dados=EXEMPLO_OBRA.gerar();return this._dados},_ev(a,t){try{if(typeof METRICS!=="undefined")METRICS.event(a,t,"exemplo")}catch(s){}},vazioHTML(a,t){this._opts[a]=t||{};const s=this._opts[a];const e=typeof EXEMPLO_OBRA!=="undefined"&&this._temPainel(a);return`<div class="card ex-vazio" id="ex-host-${a}">
      <div class="ex-vazio-icone"><i class="ti ${s.icone||"ti-sparkles"}"></i></div>
      <strong class="ex-vazio-tit">${esc(s.titulo||"Comece por aqui")}</strong>
      <p class="ex-vazio-txt">${esc(s.texto||"")}</p>
      <div class="ex-vazio-acoes">
        ${s.ctaAcao?`<button class="btn primary" onclick="EXEMPLO._cta('${a}');${s.ctaAcao}"><i class="ti ti-plus"></i> ${esc(s.ctaLabel||"Criar o primeiro")}</button>`:""}
        ${e?`<button class="btn" onclick="EXEMPLO.abrir('${a}')"><i class="ti ti-eye"></i> Ver com dados de exemplo</button>`:""}
      </div>
    </div>`},_cta(a){this._ev("exemplo_cta",a)},_temPainel(a){return["rdo","cronograma","orcamento","ativos","agendamentos","garantias"].includes(a)},abrir(a){const t=document.getElementById("ex-host-"+a);if(!t)return;const s=this.dados();if(!s)return;this._ev("exemplo_abrir",a);const e=this._opts[a]||{};t.outerHTML=`<div class="card ex-painel" id="ex-host-${a}">
      <div class="ex-faixa">
        <span><i class="ti ti-flask"></i> <strong>Exemplo</strong> — obra fictícia “${esc(s.obra)}”. Nada aqui é seu e nada é gravado.</span>
        <button class="btn sm" onclick="EXEMPLO.fechar('${a}')"><i class="ti ti-x"></i> Fechar exemplo</button>
      </div>
      <div class="ex-corpo">${this._painel(a,s)}</div>
      <div class="ex-rodape">
        ${e.ctaAcao?`<button class="btn primary" onclick="EXEMPLO._cta('${a}');${e.ctaAcao}"><i class="ti ti-plus"></i> ${esc(e.ctaLabel||"Criar o meu")}</button>`:""}
        <span class="page-sub" style="font-size:12px">Os números acima são de demonstração — validam a tela, não a sua obra.</span>
      </div>
    </div>`},fechar(a){const t=document.getElementById("ex-host-"+a);if(!t)return;this._ev("exemplo_fechar",a);t.outerHTML=this.vazioHTML(a,this._opts[a])},_painel(a,t){if(a==="rdo")return this._pRdo(t);if(a==="cronograma")return this._pCrono(t);if(a==="orcamento")return this._pOrc(t);if(a==="ativos")return this._pAtivos(t);if(a==="agendamentos")return this._pAgend(t);if(a==="garantias")return this._pGarantias(t);return""},_dataBR(a){return a?new Date(a+"T12:00").toLocaleDateString("pt-BR"):"—"},_brl(a){return(Number(a)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})},_dias(a){return Math.round((new Date(a+"T12:00")-new Date().setHours(12,0,0,0))/864e5)},_pRdo(a){return a.rdos.map(t=>{const s=(t.efetivo||[]).reduce((e,i)=>e+(Number(i.qtd)||0),0);return`<div class="ex-item">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <strong>${this._dataBR(t.data)}</strong>
          <span class="pill pill-blue">${esc(t.obra)}</span>
          <span class="pill" style="background:var(--bg);color:var(--text-2)">${esc(t.clima.manha)}${t.clima.tarde&&t.clima.tarde!==t.clima.manha?" / "+esc(t.clima.tarde):""}</span>
        </div>
        <p class="ex-p"><i class="ti ti-users"></i> ${s} no efetivo · ${esc((t.efetivo||[]).map(e=>e.funcao+" "+e.qtd).join(", "))}</p>
        <p class="ex-p"><strong>Atividades:</strong> ${esc(t.atividades)}</p>
        ${t.ocorrencias?`<p class="ex-p"><strong>Ocorrências:</strong> ${esc(t.ocorrencias)}</p>`:""}
        ${t.obs?`<p class="ex-p" style="color:var(--text-3)">${esc(t.obs)}</p>`:""}
      </div>`}).join("")},_pCrono(a){const t=a.cronograma;const s=typeof cronoVisuaisHTML==="function"?cronoVisuaisHTML(t):"";return`${s}
      <table class="tbl ex-tbl"><thead><tr><th>Etapa</th><th>Atividade</th><th>Início</th><th>Dias</th><th>Valor</th><th>Avanço</th></tr></thead><tbody>
      ${t.atividades.map(e=>`<tr>
        <td>${esc(e.etapa)}</td><td>${esc(e.nome)}${e.marco?' <span class="pill" style="background:var(--bg)">marco</span>':""}</td>
        <td>${this._dataBR(e.inicio)}</td><td>${e.dur}</td><td>${this._brl(e.valor)}</td>
        <td>${e.avanco}%</td></tr>`).join("")}
      </tbody></table>`},_pOrc(a){const t=a.orcamento;const s=t.itens.reduce((i,n)=>i+n.qtd*n.valor_unit,0);const e=s*(1+t.bdi/100);return`<div class="ex-stats">
        <div><span>Itens</span><strong>${t.itens.length}</strong></div>
        <div><span>Custo direto</span><strong>${this._brl(s)}</strong></div>
        <div><span>BDI</span><strong>${t.bdi}%</strong></div>
        <div><span>Total</span><strong>${this._brl(e)}</strong></div>
      </div>
      <table class="tbl ex-tbl"><thead><tr><th>Etapa</th><th>Descrição</th><th>Un</th><th>Qtd</th><th>Unitário</th><th>Total</th></tr></thead><tbody>
      ${t.itens.map(i=>`<tr><td>${esc(i.etapa)}</td><td>${esc(i.descricao)}</td><td>${esc(i.un)}</td>
        <td>${i.qtd.toLocaleString("pt-BR")}</td><td>${this._brl(i.valor_unit)}</td><td>${this._brl(i.qtd*i.valor_unit)}</td></tr>`).join("")}
      </tbody></table>
      <p class="page-sub" style="font-size:12px;margin-top:8px">No seu orçamento, cada linha pode vir de uma composição SINAPI da UF e do regime que você escolher — aqui os itens são avulsos de propósito, para não ensinar um código que não é o seu.</p>`},_pAtivos(a){return a.ativos.map(t=>{const s=this._dias(t.garantia_ate);const e=s<0?"red":s<=30?"amber":"teal";return`<div class="ex-item">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <strong>${esc(t.nome)}</strong>
          <span class="pill pill-blue">${esc(t.unidade)}</span>
          <span class="pill pill-${e}">${s<0?`garantia vencida há ${-s}d`:`garantia vence em ${s}d`}</span>
        </div>
        <p class="ex-p">${esc(t.categoria)} · ${esc(t.modelo)} · instalado em ${this._dataBR(t.instalado_em)} · ${esc(t.local)}</p>
        ${t.obs?`<p class="ex-p" style="color:var(--text-3)">${esc(t.obs)}</p>`:""}
      </div>`}).join("")},_pAgend(a){return a.agendamentos.map(t=>{const s=this._dias(t.data);const e=s<0;return`<div class="ex-item">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <strong>${esc(t.titulo)}</strong>
          <span class="pill pill-${e?"red":"teal"}">${e?`vencido há ${-s}d`:`em ${s}d`}</span>
          <span class="pill" style="background:var(--bg);color:var(--text-2)">a cada ${t.periodicidade_meses} ${t.periodicidade_meses===1?"mês":"meses"}</span>
        </div>
        <p class="ex-p">${this._dataBR(t.data)} · ${esc(t.resp)} — ${esc(t.atividade)}</p>
      </div>`}).join("")},_pGarantias(a){return a.garantias.map(t=>{const s=new Date(t.inicio+"T12:00");s.setFullYear(s.getFullYear()+t.prazo_anos);const e=Math.round((s-new Date().setHours(12,0,0,0))/864e5);return`<div class="ex-item">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <strong>${esc(t.sistema)}</strong>
          <span class="pill pill-teal">${t.prazo_anos} ${t.prazo_anos===1?"ano":"anos"}</span>
          <span class="pill" style="background:var(--bg);color:var(--text-2)">vigente · faltam ${e} dias</span>
        </div>
        <p class="ex-p">${esc(t.descricao)} · início ${this._dataBR(t.inicio)} · vence ${s.toLocaleDateString("pt-BR")}</p>
        ${t.obs?`<p class="ex-p" style="color:var(--text-3)">${esc(t.obs)}</p>`:""}
      </div>`}).join("")},botaoUpsellHTML(a){if(typeof EXEMPLO_OBRA==="undefined"||!this._temPainel(a))return"";return`<button class="btn" style="margin-top:10px" onclick="EXEMPLO.abrirModal('${a}')"><i class="ti ti-eye"></i> Ver como fica, com dados de exemplo</button>`},botaoBarraHTML(a){if(typeof EXEMPLO_OBRA==="undefined"||!this._temPainel(a))return"";return`<button class="btn" onclick="EXEMPLO.abrirModal('${a}','barra')" title="Ver esta tela cheia, com a obra fictícia de demonstração"><i class="ti ti-flask"></i> Ver exemplo</button>`},abrirModal(a,t){const s=this.dados();if(!s)return;this._ev("exemplo_abrir",a+":"+(t||"upsell"));const e=document.createElement("div");e.className="cb-modal-ov";e.innerHTML=`<div class="card cb-modal-box ex-modal">
      <div class="ex-faixa">
        <span><i class="ti ti-flask"></i> <strong>Exemplo</strong> — obra fictícia “${esc(s.obra)}”.</span>
        <button class="btn sm" data-fechar><i class="ti ti-x"></i> Fechar</button>
      </div>
      <div class="ex-corpo">${this._painel(a,s)}</div>
    </div>`;e.addEventListener("click",i=>{if(i.target===e||i.target.closest("[data-fechar]"))e.remove()});document.body.appendChild(e)}};if(typeof window!=="undefined")window.EXEMPLO=EXEMPLO;
