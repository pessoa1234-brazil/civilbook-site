// Civilbook — MODO EXEMPLO (e29): módulo de obra nunca nasce vazio.
//
// O problema medido em ago/2026: rdo, cronogramas, ativos/garantias e orçamentos com ZERO
// registros. O usuário novo abre o módulo, encontra uma linha de texto cinza ("Nenhum RDO
// lançado ainda.") e não vê valor nenhum — nem as ferramentas do assessor (f39) têm o que
// responder. Aqui o vazio vira DUAS coisas: um convite para o primeiro registro (CTA) e um
// botão que mostra a tela CHEIA, com a obra fictícia "Residencial Aurora".
//
// SEGURANÇA DO DADO (o ponto delicado desta tarefa): o exemplo NÃO passa pelas coleções.
// cbColecao grava em localStorage e replica no Supabase — um item fictício injetado em _items
// viraria registro de verdade na primeira gravação. Pior: os cartões reais têm botões
// (abrirRdoForm(id), excluir…) que, com id inexistente, ABREM FORMULÁRIO NOVO e gravam. Por
// isso o painel de exemplo é um caminho de render à parte, SÓ LEITURA, sem um único botão que
// escreva. A única exceção é o CTA "criar o meu" — que abre o formulário VAZIO de verdade.
//
// Dados: data/exemplo-obra.js (função de hoje, nunca JSON fixo).
// Medição (item 4 da e29): usage_events exemplo_abrir / exemplo_fechar / exemplo_cta.

const EXEMPLO = {
  _opts: {},          // modulo → opções do estado vazio (para poder voltar ao fechar)
  _dados: null,

  dados() { if (!this._dados && typeof EXEMPLO_OBRA !== "undefined") this._dados = EXEMPLO_OBRA.gerar(); return this._dados; },
  _ev(tipo, modulo) { try { if (typeof METRICS !== "undefined") METRICS.event(tipo, modulo, "exemplo"); } catch (e) { /* medir nunca quebra a tela */ } },

  // Estado vazio com CONVITE (item 2) + porta para o exemplo (item 1).
  // o = { titulo, texto, ctaLabel, ctaAcao (string de onclick), icone }
  vazioHTML(modulo, o) {
    this._opts[modulo] = o || {};
    const x = this._opts[modulo];
    const temExemplo = typeof EXEMPLO_OBRA !== "undefined" && this._temPainel(modulo);
    return `<div class="card ex-vazio" id="ex-host-${modulo}">
      <div class="ex-vazio-icone"><i class="ti ${x.icone || "ti-sparkles"}"></i></div>
      <strong class="ex-vazio-tit">${esc(x.titulo || "Comece por aqui")}</strong>
      <p class="ex-vazio-txt">${esc(x.texto || "")}</p>
      <div class="ex-vazio-acoes">
        ${x.ctaAcao ? `<button class="btn primary" onclick="EXEMPLO._cta('${modulo}');${x.ctaAcao}"><i class="ti ti-plus"></i> ${esc(x.ctaLabel || "Criar o primeiro")}</button>` : ""}
        ${temExemplo ? `<button class="btn" onclick="EXEMPLO.abrir('${modulo}')"><i class="ti ti-eye"></i> Ver com dados de exemplo</button>` : ""}
      </div>
    </div>`;
  },
  _cta(modulo) { this._ev("exemplo_cta", modulo); },

  _temPainel(modulo) { return ["rdo", "cronograma", "orcamento", "ativos", "agendamentos", "garantias"].includes(modulo); },

  abrir(modulo) {
    const host = document.getElementById("ex-host-" + modulo);
    if (!host) return;
    const d = this.dados();
    if (!d) return;
    this._ev("exemplo_abrir", modulo);
    const x = this._opts[modulo] || {};
    host.outerHTML = `<div class="card ex-painel" id="ex-host-${modulo}">
      <div class="ex-faixa">
        <span><i class="ti ti-flask"></i> <strong>Exemplo</strong> — obra fictícia “${esc(d.obra)}”. Nada aqui é seu e nada é gravado.</span>
        <button class="btn sm" onclick="EXEMPLO.fechar('${modulo}')"><i class="ti ti-x"></i> Fechar exemplo</button>
      </div>
      <div class="ex-corpo">${this._painel(modulo, d)}</div>
      <div class="ex-rodape">
        ${x.ctaAcao ? `<button class="btn primary" onclick="EXEMPLO._cta('${modulo}');${x.ctaAcao}"><i class="ti ti-plus"></i> ${esc(x.ctaLabel || "Criar o meu")}</button>` : ""}
        <span class="page-sub" style="font-size:12px">Os números acima são de demonstração — validam a tela, não a sua obra.</span>
      </div>
    </div>`;
  },

  fechar(modulo) {
    const host = document.getElementById("ex-host-" + modulo);
    if (!host) return;
    this._ev("exemplo_fechar", modulo);
    host.outerHTML = this.vazioHTML(modulo, this._opts[modulo]);
  },

  // ── painéis (SÓ LEITURA — nenhum onclick que grave) ──────────────────────────────────────
  _painel(modulo, d) {
    if (modulo === "rdo") return this._pRdo(d);
    if (modulo === "cronograma") return this._pCrono(d);
    if (modulo === "orcamento") return this._pOrc(d);
    if (modulo === "ativos") return this._pAtivos(d);
    if (modulo === "agendamentos") return this._pAgend(d);
    if (modulo === "garantias") return this._pGarantias(d);
    return "";
  },

  _dataBR(iso) { return iso ? new Date(iso + "T12:00").toLocaleDateString("pt-BR") : "—"; },
  _brl(n) { return (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); },
  _dias(iso) { return Math.round((new Date(iso + "T12:00") - new Date().setHours(12, 0, 0, 0)) / 86400000); },

  _pRdo(d) {
    return d.rdos.map((r) => {
      const tot = (r.efetivo || []).reduce((s, e) => s + (Number(e.qtd) || 0), 0);
      return `<div class="ex-item">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <strong>${this._dataBR(r.data)}</strong>
          <span class="pill pill-blue">${esc(r.obra)}</span>
          <span class="pill" style="background:var(--bg);color:var(--text-2)">${esc(r.clima.manha)}${r.clima.tarde && r.clima.tarde !== r.clima.manha ? " / " + esc(r.clima.tarde) : ""}</span>
        </div>
        <p class="ex-p"><i class="ti ti-users"></i> ${tot} no efetivo · ${esc((r.efetivo || []).map((e) => e.funcao + " " + e.qtd).join(", "))}</p>
        <p class="ex-p"><strong>Atividades:</strong> ${esc(r.atividades)}</p>
        ${r.ocorrencias ? `<p class="ex-p"><strong>Ocorrências:</strong> ${esc(r.ocorrencias)}</p>` : ""}
        ${r.obs ? `<p class="ex-p" style="color:var(--text-3)">${esc(r.obs)}</p>` : ""}
      </div>`;
    }).join("");
  },

  // Reusa os visuais REAIS do cronograma (cronoVisuaisHTML é puro: stats + Gantt + curva S).
  _pCrono(d) {
    const c = d.cronograma;
    const visuais = typeof cronoVisuaisHTML === "function" ? cronoVisuaisHTML(c) : "";
    return `${visuais}
      <table class="tbl ex-tbl"><thead><tr><th>Etapa</th><th>Atividade</th><th>Início</th><th>Dias</th><th>Valor</th><th>Avanço</th></tr></thead><tbody>
      ${c.atividades.map((a) => `<tr>
        <td>${esc(a.etapa)}</td><td>${esc(a.nome)}${a.marco ? ' <span class="pill" style="background:var(--bg)">marco</span>' : ""}</td>
        <td>${this._dataBR(a.inicio)}</td><td>${a.dur}</td><td>${this._brl(a.valor)}</td>
        <td>${a.avanco}%</td></tr>`).join("")}
      </tbody></table>`;
  },

  _pOrc(d) {
    const o = d.orcamento;
    const sub = o.itens.reduce((s, i) => s + i.qtd * i.valor_unit, 0);
    const total = sub * (1 + o.bdi / 100);
    return `<div class="ex-stats">
        <div><span>Itens</span><strong>${o.itens.length}</strong></div>
        <div><span>Custo direto</span><strong>${this._brl(sub)}</strong></div>
        <div><span>BDI</span><strong>${o.bdi}%</strong></div>
        <div><span>Total</span><strong>${this._brl(total)}</strong></div>
      </div>
      <table class="tbl ex-tbl"><thead><tr><th>Etapa</th><th>Descrição</th><th>Un</th><th>Qtd</th><th>Unitário</th><th>Total</th></tr></thead><tbody>
      ${o.itens.map((i) => `<tr><td>${esc(i.etapa)}</td><td>${esc(i.descricao)}</td><td>${esc(i.un)}</td>
        <td>${i.qtd.toLocaleString("pt-BR")}</td><td>${this._brl(i.valor_unit)}</td><td>${this._brl(i.qtd * i.valor_unit)}</td></tr>`).join("")}
      </tbody></table>
      <p class="page-sub" style="font-size:12px;margin-top:8px">No seu orçamento, cada linha pode vir de uma composição SINAPI da UF e do regime que você escolher — aqui os itens são avulsos de propósito, para não ensinar um código que não é o seu.</p>`;
  },

  _pAtivos(d) {
    return d.ativos.map((a) => {
      const dias = this._dias(a.garantia_ate);
      const cor = dias < 0 ? "red" : dias <= 30 ? "amber" : "teal";
      return `<div class="ex-item">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <strong>${esc(a.nome)}</strong>
          <span class="pill pill-blue">${esc(a.unidade)}</span>
          <span class="pill pill-${cor}">${dias < 0 ? `garantia vencida há ${-dias}d` : `garantia vence em ${dias}d`}</span>
        </div>
        <p class="ex-p">${esc(a.categoria)} · ${esc(a.modelo)} · instalado em ${this._dataBR(a.instalado_em)} · ${esc(a.local)}</p>
        ${a.obs ? `<p class="ex-p" style="color:var(--text-3)">${esc(a.obs)}</p>` : ""}
      </div>`;
    }).join("");
  },

  _pAgend(d) {
    return d.agendamentos.map((g) => {
      const dias = this._dias(g.data);
      const venc = dias < 0;
      return `<div class="ex-item">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <strong>${esc(g.titulo)}</strong>
          <span class="pill pill-${venc ? "red" : "teal"}">${venc ? `vencido há ${-dias}d` : `em ${dias}d`}</span>
          <span class="pill" style="background:var(--bg);color:var(--text-2)">a cada ${g.periodicidade_meses} ${g.periodicidade_meses === 1 ? "mês" : "meses"}</span>
        </div>
        <p class="ex-p">${this._dataBR(g.data)} · ${esc(g.resp)} — ${esc(g.atividade)}</p>
      </div>`;
    }).join("");
  },

  _pGarantias(d) {
    return d.garantias.map((g) => {
      const fim = new Date(g.inicio + "T12:00"); fim.setFullYear(fim.getFullYear() + g.prazo_anos);
      const dias = Math.round((fim - new Date().setHours(12, 0, 0, 0)) / 86400000);
      return `<div class="ex-item">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <strong>${esc(g.sistema)}</strong>
          <span class="pill pill-teal">${g.prazo_anos} ${g.prazo_anos === 1 ? "ano" : "anos"}</span>
          <span class="pill" style="background:var(--bg);color:var(--text-2)">vigente · faltam ${dias} dias</span>
        </div>
        <p class="ex-p">${esc(g.descricao)} · início ${this._dataBR(g.inicio)} · vence ${fim.toLocaleDateString("pt-BR")}</p>
        ${g.obs ? `<p class="ex-p" style="color:var(--text-3)">${esc(g.obs)}</p>` : ""}
      </div>`;
    }).join("");
  },

  // Botão para a tela de UPSELL (o usuário GRATUITO nunca chega no estado vazio — ele vê a
  // trava do PRO; é ali que o exemplo convence). Painel abre em modal só-leitura.
  botaoUpsellHTML(modulo) {
    if (typeof EXEMPLO_OBRA === "undefined" || !this._temPainel(modulo)) return "";
    return `<button class="btn" style="margin-top:10px" onclick="EXEMPLO.abrirModal('${modulo}')"><i class="ti ti-eye"></i> Ver como fica, com dados de exemplo</button>`;
  },

  // Botão PERMANENTE na barra do módulo — a correção do achado de campo de 16/ago/2026.
  //
  // A e29 nasceu com uma premissa errada, escrita no comentário lá em cima: a de que quem tem dados
  // não precisa de exemplo. Só que o convite do estado vazio vive DENTRO de `if (lista.length===0)`
  // nos seis módulos — então ele some no instante em que entra o primeiro registro, e foi
  // exatamente aí que o fundador foi procurar. Diário, Orçamento, Agendamentos e Garantias: "não
  // achei o botão". Cronograma e Ativos "funcionaram" só porque estavam zerados — mesmo código,
  // estado diferente.
  //
  // Abre em MODAL, nunca inline: com a lista real na tela, trocar o conteúdo por dados fictícios
  // confundiria quem tem obra em andamento (e o host `ex-host-<modulo>` do `abrir()` nem existe
  // quando o estado vazio não foi renderizado).
  botaoBarraHTML(modulo) {
    if (typeof EXEMPLO_OBRA === "undefined" || !this._temPainel(modulo)) return "";
    return `<button class="btn" onclick="EXEMPLO.abrirModal('${modulo}','barra')" title="Ver esta tela cheia, com a obra fictícia de demonstração"><i class="ti ti-flask"></i> Ver exemplo</button>`;
  },

  // `origem` separa quem veio da trava do PRO de quem veio da barra do módulo — sem isso a medição
  // de e29 contaria as duas coisas como upsell e não daria para saber qual porta funciona.
  abrirModal(modulo, origem) {
    const d = this.dados();
    if (!d) return;
    this._ev("exemplo_abrir", modulo + ":" + (origem || "upsell"));
    const ov = document.createElement("div");
    ov.className = "cb-modal-ov";
    ov.innerHTML = `<div class="card cb-modal-box ex-modal">
      <div class="ex-faixa">
        <span><i class="ti ti-flask"></i> <strong>Exemplo</strong> — obra fictícia “${esc(d.obra)}”.</span>
        <button class="btn sm" data-fechar><i class="ti ti-x"></i> Fechar</button>
      </div>
      <div class="ex-corpo">${this._painel(modulo, d)}</div>
    </div>`;
    ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-fechar]")) ov.remove(); });
    document.body.appendChild(ov);
  },
};

if (typeof window !== "undefined") window.EXEMPLO = EXEMPLO;
