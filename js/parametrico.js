// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).

// f38 — Orçamento paramétrico (PROTÓTIPO). Engine PURA (sem DOM): a partir de poucos "drivers"
// do briefing (área construída, etc.), aplica um modelo por tipologia (coef × driver → quantidade)
// e precifica cada serviço para gerar uma planilha SINTÉTICA + resumo por macro-item + BDI.
// Reaproveita a base SINAPI existente para o preço unitário (precoFn) com fallback ao pu_seed
// (fev/2025). O resultado (linhas) tem o mesmo formato de item usado por js/orcamento.js
// (obra_orcamentos), então serve de pré-montagem do e23 e, por ele, do cronograma (e24).
// Determinística e testável (tests/param-pam.check.mjs). Não substitui o orçamento do RT.

(function (root) {
  "use strict";

  // Coeficiente técnico = quantidade do exemplar de referência ÷ sua área. Independe da obra-alvo.
  function paramCoef(linha, areaRef) {
    return (Number(linha.qtd_ref) || 0) / (Number(areaRef) || 1);
  }

  // Preço unitário do serviço: usa a base dinâmica (SINAPI UF/regime/competência ativos) quando
  // disponível via precoFn(codigo); senão cai no pu_seed congelado do modelo. Mantém rastreável
  // de onde veio o preço (fonte: "dinamico" | "seed").
  function paramPreco(linha, precoFn) {
    if (typeof precoFn === "function") {
      var p = precoFn(linha.codigo);
      if (p != null && isFinite(p) && Number(p) > 0) return { pu: Number(p), fonte: "dinamico" };
    }
    return { pu: Number(linha.pu_seed) || 0, fonte: "seed" };
  }

  // Área de referência do driver (o exemplar do acervo foi levantado nessa área).
  function paramRefArea(modelo, driver) {
    if (driver === "area_reforma") return Number(modelo.area_ref_reforma) || 0;
    if (driver === "area_total") return (Number(modelo.area_ref_nova) || 0) + (Number(modelo.area_ref_reforma) || 0) || Number(modelo.area_ref) || 0;
    return Number(modelo.area_ref_nova) || Number(modelo.area_ref) || 0; // area_nova (default)
  }
  // Fração de custo fixo (φ) do bloco, na área de referência: opts.escalaFixo[driver] sobrepõe o
  // modelo.escala[driver].fixo_frac. opts.escala === false desliga (φ=0 → linear).
  function paramFixoFrac(modelo, driver, opts) {
    if (opts && opts.escala === false) return 0;
    var ov = opts && opts.escalaFixo;
    if (ov && ov[driver] != null) return Math.max(0, Number(ov[driver]) || 0);
    var e = modelo.escala && modelo.escala[driver];
    return (e && e.fixo_frac != null) ? Math.max(0, Number(e.fixo_frac) || 0) : 0;
  }
  // ECONOMIA DE ESCALA (gradiente de tamanho): parte do custo do bloco é FIXA (cozinha, banheiros,
  // entrada, infra, projeto) e não escala com a área — dilui-se em mais m². Modela-se o custo do bloco
  // como C(A) = F + v·A. Como o motor já calcula o custo LINEAR L(A)=C_ref·(A/Aref), aplica-se o fator
  //   fator(A) = (1-φ) + φ·(Aref/A)   [φ = F/C_ref na área de referência]
  // que preserva a reprodução exata em A=Aref (fator=1), encarece o R$/m² em áreas menores e o barateia
  // em áreas maiores. φ é adimensional (vale para custo direto ou com BDI). Calibrado no acervo.
  function paramEscalaFator(modelo, driver, area, opts) {
    if (!driver || driver === "fixo") return 1;              // lump (equipamentos) já é fixo
    var phi = paramFixoFrac(modelo, driver, opts);
    var aref = paramRefArea(modelo, driver);
    if (!(phi > 0) || !(area > 0) || !(aref > 0)) return 1;
    return (1 - phi) + phi * (aref / area);
  }

  // Catálogo de ADD-ONS DE PROGRAMA (Q4 do briefing) — lumps que NÃO escalam com a área de sala e
  // explicam o espalhamento de 2,6× entre escolas (ex.: quadra coberta no Victor Belot). Valores são
  // DIRETO (sem BDI), ancorados no acervo (Curva ABC do Belot) e EDITÁVEIS na UI. bloco "programa".
  var PARAM_ADDONS = {
    escola: [
      { codigo: "PROG.QUADRA", nome: "Quadra poliesportiva coberta", valor: 1300000, ajuda: "estrutura metálica + telha + piso + fundação (Belot: só metálica+telha ≈ R$1,1mi c/ BDI)" },
      { codigo: "PROG.COZINHA", nome: "Cozinha industrial / refeitório", valor: 250000, ajuda: "coifa lavadora, tanques inox, exaustão e instalações" },
      { codigo: "PROG.HVAC", nome: "Climatização central / exaustão (dutos)", valor: 300000, ajuda: "gabinetes ventiladores, dutos TDC, dampers, difusores" },
      { codigo: "PROG.RESERV", nome: "Reservatório elevado (≈30 mil L)", valor: 190000, ajuda: "reservatório pré-moldado + casa de máquinas (Belot ≈ R$230k c/ BDI)" },
      { codigo: "PROG.ELEV", nome: "Elevador / plataforma acessível", valor: 150000, ajuda: "acessibilidade vertical (2 pavimentos)" },
      { codigo: "PROG.AUDIT", nome: "Auditório / sala multiuso", valor: 400000, ajuda: "varia muito com acabamento acústico e capacidade" },
      { codigo: "PROG.LAB", nome: "Laboratórios (informática/ciências)", valor: 200000, ajuda: "bancadas, pontos e mobiliário fixo" },
      { codigo: "PROG.URB", nome: "Urbanização externa (quadra descoberta, estac., muro, paisagismo)", valor: 350000, ajuda: "pavimentação, drenagem, gradil, gramado" }
    ],
    saude: [
      { codigo: "PROG.GERADOR", nome: "Grupo gerador / no-break", valor: 180000, ajuda: "energia de emergência para UBS" },
      { codigo: "PROG.HVAC", nome: "Climatização central / exaustão", valor: 250000, ajuda: "dutos e exaustão de ambientes críticos" },
      { codigo: "PROG.URB", nome: "Urbanização externa (estac., muro, paisagismo)", valor: 250000, ajuda: "pavimentação, drenagem, gradil" }
    ]
  };

  // CRONOGRAMA BÁSICO (Q10) — a partir do total estimado. Se o prazo não for informado, estima por
  // valor (âncoras reais: R$5,3mi→360d, R$13,5mi→720d faseado, R$14,3mi→450d) e distribui em macro-fases
  // com pesos típicos de custo (curva-S). Determinístico e testável. opts: { prazo?, faseado? }.
  function paramCronograma(total, opts) {
    opts = opts || {};
    total = Number(total) || 0;
    var prazo = Number(opts.prazo) || 0, fonte = "informado";
    if (!(prazo > 0)) {
      prazo = Math.round(150 + total / 30000);
      if (opts.faseado) prazo = Math.round(prazo * 1.25);   // obra em funcionamento → faseamento alonga
      prazo = Math.max(180, Math.min(900, prazo));
      fonte = "estimado";
    }
    var defs = [
      ["Serviços preliminares / canteiro", 3],
      ["Fundação / infraestrutura", 10],
      ["Superestrutura", 15],
      ["Alvenaria e cobertura", 15],
      ["Instalações (elétrica/hidráulica/climatização)", 25],
      ["Acabamentos (revestimento/pintura/esquadrias)", 27],
      ["Complementares / entrega / limpeza", 5]
    ];
    var acc = 0, cum = 0;
    var fases = defs.map(function (d) {
      var dias = Math.round(prazo * d[1] / 100);
      var ini = acc; acc += dias; cum += d[1];
      return { nome: d[0], pctCusto: d[1], dias: dias, ini: ini, fim: acc, custo: total * d[1] / 100, acumuladoPct: cum };
    });
    if (fases.length) fases[fases.length - 1].fim = prazo;   // fecha no prazo total
    return { prazoDias: prazo, fonte: fonte, fases: fases };
  }

  // Gera a sintética paramétrica.
  //   modelo:  window.PARAM_PAM (tipologia, area_ref, bdi, bdi_natureza, modelo[])
  //   drivers: { area_construida: <m2>, area_terreno?: <m2>, ... }
  //   opts:    { precoFn?, bdi?, bdi_natureza? }
  // Blocos: 'natureza' (equipamentos) é lump — driver "fixo", NÃO escala com a área e leva BDI
  // diferenciado (bdi_natureza). Demais (edificação/implantação) escalam pelo seu driver e levam
  // o BDI convencional. Retorna { linhas[], porMacro[], porBloco{}, direto, bdiVal, bdiPct, total, area }.
  function paramGerar(modelo, drivers, opts) {
    opts = opts || {};
    drivers = drivers || {};
    var areaRef = Number(modelo.area_ref) || 1;
    var bdiConv = (opts.bdi != null) ? Number(opts.bdi) : (Number(modelo.bdi) || 0);
    var bdiNat = (opts.bdi_natureza != null) ? Number(opts.bdi_natureza) : (modelo.bdi_natureza != null ? Number(modelo.bdi_natureza) : bdiConv);
    // Topografia do terreno → fator sobre o bloco de implantação (terraplanagem/arrimo/mov. de terra).
    var topoTab = modelo.topografia || {};
    var topoFat = (drivers.topografia && topoTab[drivers.topografia] != null) ? Number(topoTab[drivers.topografia]) : 1;
    // Áreas: nova (estrutura + implantação) e reforma (só acabamentos/instalações). Compat.: se vier
    // só "area_construida", trata como toda nova.
    var areaNova = Number(drivers.area_nova != null ? drivers.area_nova : drivers.area_construida) || 0;
    var areaReforma = Number(drivers.area_reforma) || 0;
    var areaTotal = areaNova + areaReforma;

    var linhas = (modelo.modelo || []).map(function (l) {
      // coef normalizado: usa l.coef (novo esquema, já dividido pela área do bloco) ou deriva de qtd_ref/area_ref.
      var coef = (l.coef != null) ? Number(l.coef) : paramCoef(l, areaRef);
      var driverArea = (l.driver === "area_reforma") ? areaReforma
                     : (l.driver === "area_total") ? areaTotal
                     : areaNova;                              // area_nova (default): estrutura/ampliação
      var qtd, escFat = 1;
      if (l.driver === "fixo") {
        qtd = Number(l.qtd_ref) || 0;                       // lump: independe da área
      } else {
        qtd = coef * driverArea;
        if (l.bloco === "implantacao") qtd *= topoFat;      // terreno em aclive/declive → mais implantação
        escFat = paramEscalaFator(modelo, l.driver, driverArea, opts); // economia de escala (custo fixo diluído)
      }
      var pr = paramPreco(l, opts.precoFn);
      var total = qtd * pr.pu * escFat;
      // Profundidade da reforma (Q5): escala só o bloco de reforma (leve=1 · média≈2 · pesada≈2,8).
      if (l.driver === "area_reforma" && opts.reformaFator) total *= (Number(opts.reformaFator) || 1);
      // BDI diferenciado: por linha (l.bdiDif) ou, no modelo antigo, para o bloco "natureza" (equipamentos).
      var dif = (l.bdiDif != null) ? !!l.bdiDif : (l.bloco === "natureza");
      return {
        codigo: l.codigo, origem: l.origem, descricao: l.desc, unidade: l.un, macro: l.macro, bloco: l.bloco || "edificacao", bdiDif: dif,
        coef: coef, qtd: qtd, pu: pr.pu, fontePreco: pr.fonte, total: total,
        // formato compatível com um item de obra_orcamentos (js/orcamento.js):
        etapa: l.macro, tipo: (l.origem === "sinapi" ? "sinapi" : "avulso")
      };
    });

    // Adicional de reforma (demolição/tratamento de patologia) — quando o modelo não traz esse custo;
    // entra como R$/m² editável aplicado à área de reforma.
    var reformaRM2 = Number(opts.reforma_rm2) || 0;
    if (areaReforma > 0 && reformaRM2 > 0) {
      linhas.push({
        codigo: "REFORMA", origem: "secid", descricao: "Adicional de reforma (demolição/patologia)", unidade: "m2",
        macro: "Demolições e patologia (reforma)", bloco: "reforma", bdiDif: false,
        coef: 0, qtd: areaReforma, pu: reformaRM2, fontePreco: "manual", total: areaReforma * reformaRM2,
        etapa: "Reforma", tipo: "avulso"
      });
    }

    // Add-ons de programa (Q4): lumps (quadra coberta, cozinha industrial, HVAC…) — não escalam com a área.
    (opts.addons || []).forEach(function (a) {
      var v = Number(a.valor) || 0;
      if (v <= 0) return;
      linhas.push({
        codigo: a.codigo || "PROG", origem: "secid", descricao: a.nome || a.descricao || "Item de programa", unidade: "vb",
        macro: "Programa · " + (a.nome || a.descricao || "ambiente especial"), bloco: "programa", bdiDif: !!a.bdiDif,
        coef: 0, qtd: 1, pu: v, fontePreco: "manual", total: v, etapa: "Programa", tipo: "avulso"
      });
    });

    // Contingência de fundação/solo (Q8): % sobre o custo direto acumulado (inclui add-ons).
    var contPct = Number(opts.contingenciaPct) || 0;
    if (contPct > 0) {
      var somaProv = linhas.reduce(function (s, x) { return s + x.total; }, 0);
      linhas.push({
        codigo: "CONTINGENCIA", origem: "secid", descricao: "Contingência de fundação/solo (" + contPct + "%)", unidade: "vb",
        macro: "Contingência (fundação/solo)", bloco: "contingencia", bdiDif: false,
        coef: 0, qtd: 1, pu: somaProv * contPct / 100, fontePreco: "manual", total: somaProv * contPct / 100, etapa: "Contingência", tipo: "avulso"
      });
    }

    var mapa = {}, porBloco = {}, direto = 0, diretoNat = 0, diretoConv = 0;
    linhas.forEach(function (x) {
      mapa[x.macro] = (mapa[x.macro] || 0) + x.total;
      porBloco[x.bloco] = (porBloco[x.bloco] || 0) + x.total;
      direto += x.total;
      if (x.bdiDif) diretoNat += x.total; else diretoConv += x.total;
    });
    var porMacro = Object.keys(mapa).map(function (m) {
      return { macro: m, total: mapa[m], pct: direto ? (mapa[m] / direto * 100) : 0 };
    }).sort(function (a, b) { return b.total - a.total; });

    var bdiVal = diretoConv * bdiConv / 100 + diretoNat * bdiNat / 100;

    // Info de economia de escala aplicada (por driver com φ>0) — para a UI mostrar o gradiente.
    var escala = { aplicada: false, porDriver: {} };
    [["area_nova", areaNova], ["area_reforma", areaReforma], ["area_total", areaTotal]].forEach(function (par) {
      var phi = paramFixoFrac(modelo, par[0], opts);
      if (phi > 0) {
        escala.porDriver[par[0]] = { phi: phi, aref: paramRefArea(modelo, par[0]), fator: paramEscalaFator(modelo, par[0], par[1], opts), area: par[1] };
        if (par[1] > 0) escala.aplicada = true;
      }
    });

    return {
      area: areaTotal, areaNova: areaNova, areaReforma: areaReforma,
      topografia: drivers.topografia || null, topoFator: topoFat,
      linhas: linhas, porMacro: porMacro, porBloco: porBloco,
      direto: direto, bdiVal: bdiVal, bdiPct: direto ? (bdiVal / direto * 100) : 0,
      bdiConv: bdiConv, bdiNat: bdiNat, total: direto + bdiVal, escala: escala
    };
  }

  root.paramCoef = paramCoef;
  root.paramPreco = paramPreco;
  root.paramGerar = paramGerar;
  root.paramEscalaFator = paramEscalaFator;
  root.paramCronograma = paramCronograma;
  root.PARAM_ADDONS = PARAM_ADDONS;
  if (typeof module !== "undefined" && module.exports) module.exports = { paramCoef: paramCoef, paramPreco: paramPreco, paramGerar: paramGerar, paramEscalaFator: paramEscalaFator, paramCronograma: paramCronograma, PARAM_ADDONS: PARAM_ADDONS };
})(typeof window !== "undefined" ? window : globalThis);

// ── UI (sub-aba "Paramétrico" dentro de Custos) ──────────────────────────────────
// Só roda no browser (depende do DOM e dos globais do app). Mantida separada da engine
// pura acima para que os testes (Deno) não precisem de DOM.
if (typeof document !== "undefined") {

  let _parPane = null;
  let _parModeloId = null;   // tipologia ativa (id no registry PARAM_MODELOS)
  function parBRL(n) { return (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

  // Registry de tipologias: { id: modelo }. Cai para PARAM_PAM se o registry não existir.
  function parModelos() {
    if (typeof PARAM_MODELOS !== "undefined" && PARAM_MODELOS && Object.keys(PARAM_MODELOS).length) return PARAM_MODELOS;
    if (typeof PARAM_PAM !== "undefined" && PARAM_PAM) return { saude: PARAM_PAM };
    return {};
  }
  function parModelo() {
    const ms = parModelos(), keys = Object.keys(ms);
    if (_parModeloId && ms[_parModeloId]) return ms[_parModeloId];
    return keys.length ? ms[keys[0]] : null;
  }
  function parTrocaModelo(id) { _parModeloId = id; if (_parPane) { _parPane.innerHTML = parFormHTML(); parCalc(); } }

  // precoFn: indexa o catálogo SINAPI ativo (UF/regime/competência) por código. Serviços fora
  // da SINAPI (SECID/próprias: C…, CON…) retornam null → engine usa o pu_seed (fev/2025).
  function parPrecoFn() {
    if (typeof SINAPIDB === "undefined") return null;
    let lista = null;
    try { lista = SINAPIDB.lista(); } catch (e) { return null; }
    if (!lista || !lista.length) return null;
    const idx = Object.create(null);
    for (let i = 0; i < lista.length; i++) if (lista[i].preco != null) idx[lista[i].codigo] = lista[i].preco;
    return function (cod) { return idx[cod] != null ? idx[cod] : null; };
  }

  async function renderParametrico(pane) {
    _parPane = pane || _parPane;
    if (!_parPane) return;
    if (typeof planoEhPro === "function" && !planoEhPro()) { _parPane.innerHTML = parUpsellHTML(); return; }
    if (!parModelo()) { _parPane.innerHTML = `<p class="page-sub">Modelo paramétrico indisponível.</p>`; return; }
    _parPane.innerHTML = `<p class="page-sub">Carregando…</p>`;
    // garante a base SINAPI (lazy ~1,7 MB) antes de renderizar — SINAPIDB.meta()/lista() dependem dela
    try { if (typeof SINAPIDB !== "undefined") await SINAPIDB.ready(); } catch (e) {}
    if (!document.body.contains(_parPane)) return;   // trocou de aba durante o await
    _parPane.innerHTML = parFormHTML();
    parCalc();
  }

  // contexto de preços (defensivo: se a base SINAPI ainda não carregou, cai no seed sem quebrar)
  function parCtxPreco(m) {
    try {
      if (typeof SINAPIDB !== "undefined") {
        const meta = SINAPIDB.meta();
        if (meta && meta.uf) return `SINAPI ${esc(meta.uf)}${meta.competencia ? " · " + esc(SINAPIDB.fmtCompet(meta.competencia)) : ""}`;
      }
    } catch (e) {}
    return `seed fev/2025 (${esc(m.uf)})`;
  }

  function parUpsellHTML() {
    return `<div class="card" style="max-width:560px;margin:30px auto;text-align:center;padding:32px">
      <div class="card-icon" style="background:var(--blue-light);color:var(--blue);margin:0 auto 14px"><i class="ti ti-wand"></i></div>
      <h3 style="font-size:18px;font-weight:600;margin-bottom:8px">Orçamento paramétrico é um recurso PRO</h3>
      <p style="color:var(--text-2);margin-bottom:18px">Estime uma planilha sintética por macro-item a partir de poucas perguntas (tipologia + área), com preços SINAPI e BDI.</p>
      ${typeof cbTesteBotaoHTML === "function" ? cbTesteBotaoHTML('sinapi', 'par:', 'btn primary') : ""}
    </div>`;
  }

  function parFormHTML() {
    const m = parModelo();
    const ctx = parCtxPreco(m);
    const ms = parModelos();
    const ativoId = m.id || Object.keys(ms).find(function (k) { return ms[k] === m; });
    const tipoOpts = Object.keys(ms).map(function (k) { return `<option value="${esc(k)}"${k === ativoId ? " selected" : ""}>${esc(ms[k].tipologia)}</option>`; }).join("");
    const temImplant = (m.modelo || []).some(function (l) { return l.bloco === "implantacao"; });
    const topoOpts = [["plano", "Plano"], ["aclive", "Aclive (terreno acima da rua)"], ["declive", "Declive (terreno abaixo da rua)"]]
      .map(function (o) { return `<option value="${o[0]}">${o[1]}</option>`; }).join("");
    const novaDefault = (m.area_ref_nova != null) ? m.area_ref_nova : m.area_ref;
    const reformaDefault = (m.area_ref_reforma != null) ? m.area_ref_reforma : 0;
    // fração de custo fixo (economia de escala) da ampliação, sugerida pelo modelo (calibrada no acervo)
    const escalaFixoPct = Math.round(((m.escala && m.escala.area_nova && m.escala.area_nova.fixo_frac) || 0) * 1000) / 10;
    return `
      <p class="page-sub">Estimativa <strong>paramétrica</strong> a partir de poucas perguntas: aplica um modelo por tipologia (coeficientes por m² do acervo) e precifica com a base SINAPI para gerar uma <strong>planilha sintética</strong>. Modelo: <strong>${esc(m.tipologia)}</strong> (${(m.modelo || []).length} serviços). Apoio ao planejamento, não substitui o orçamento do RT.</p>
      <div class="card" style="margin-bottom:14px">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
          <div class="field" style="flex:2;min-width:180px"><label>Tipologia</label>
            <select class="sinapi-uf" id="par-tipo" onchange="parTrocaModelo(this.value)">${tipoOpts}</select></div>
          <div class="field" style="width:140px"><label>Área nova (m²)</label>
            <input type="number" id="par-area-nova" min="0" step="any" value="${novaDefault}" oninput="parCalc()"></div>
          <div class="field" style="width:150px"><label>Área de reforma (m²)</label>
            <input type="number" id="par-area-reforma" min="0" step="any" value="${reformaDefault}" oninput="parCalc()"></div>
          ${temImplant ? `<div class="field" style="flex:1;min-width:190px"><label>Topografia do terreno</label>
            <select class="sinapi-uf" id="par-topo" onchange="parCalc()">${topoOpts}</select></div>` : ""}
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-top:10px">
          <div class="field" style="width:140px"><label>BDI obra (%)</label>
            <input type="number" id="par-bdi" min="0" step="0.01" value="${m.bdi}" placeholder="${m.bdi}" oninput="parCalc()"></div>
          <div class="field" style="width:170px"><label>BDI diferenciado (%)</label>
            <input type="number" id="par-bdi-nat" min="0" step="0.01" value="${m.bdi_natureza}" placeholder="${m.bdi_natureza}" oninput="parCalc()"></div>
          <div class="field" style="width:190px"><label>Adicional reforma (R$/m²)</label>
            <input type="number" id="par-reforma-rm2" min="0" step="1" value="0" placeholder="demolição/patologia" oninput="parCalc()"></div>
          <div class="field" style="width:180px"><label title="Parcela do custo da ampliação que é fixa (cozinha, banheiros, entrada, infra, projeto) e se dilui em mais m² — economia de escala.">Custo fixo diluído (%)</label>
            <input type="number" id="par-escala-fixo" min="0" max="60" step="0.1" value="${escalaFixoPct}" placeholder="0" oninput="parCalc()"></div>
        </div>
        <p class="page-sub" style="margin:8px 0 0;font-size:12px"><i class="ti ti-info-circle"></i> BDI é <strong>sugestão</strong> (${m.bdi}% / ${m.bdi_natureza}% diferenciado), editável. <strong>Reforma</strong> reaproveita a estrutura (só acabamentos/instalações); demolição/patologia extra → informe o <strong>adicional R$/m²</strong>.</p>
        <p class="page-sub" style="margin:6px 0 0;font-size:12px"><i class="ti ti-chart-arrows-vertical"></i> <strong>Economia de escala</strong>: parte da ampliação é <strong>custo fixo</strong> (não escala) e se dilui em mais área → o <strong>R$/m² cai</strong> em obras maiores. Padrão <strong>${escalaFixoPct.toLocaleString("pt-BR")}%</strong> ${escalaFixoPct > 0 ? "(calibrado no acervo — 2 escolas reais)" : "(sem calibração de porte para esta tipologia — linear)"}; edite para o seu caso. 0% = linear.</p>
        <p class="page-sub" style="margin:6px 0 0;font-size:12px"><i class="ti ti-receipt"></i> Preços: <strong>${ctx}</strong> · referência: ${novaDefault} m² nova${reformaDefault ? " + " + reformaDefault + " m² reforma" : ""}. Serviços fora da SINAPI usam o seed do modelo.</p>
      </div>
      ${parBriefingHTML(m)}
      <div id="par-out"></div>`;
  }

  // Índice para estimar a área a partir da capacidade (Q3), por tipologia.
  function parCapIndice(m) {
    const map = { escola: { idx: 9, label: "Nº de alunos", unidade: "aluno" }, saude: { idx: 35, label: "Nº de consultórios", unidade: "consultório" } };
    return map[(m && m.id) || ""] || { idx: 10, label: "Nº de unidades", unidade: "unidade" };
  }
  // Catálogo de add-ons de programa da tipologia ativa (window.PARAM_ADDONS, exposto pela engine).
  function parAddonsCat() {
    const id = parModelo() && parModelo().id;
    if (typeof PARAM_ADDONS !== "undefined" && PARAM_ADDONS && id && PARAM_ADDONS[id]) return PARAM_ADDONS[id];
    return [];
  }
  function parAddonsSelecionados() {
    return parAddonsCat().filter(function (a) { const cb = document.getElementById("par-addon-" + a.codigo); return cb && cb.checked; })
      .map(function (a) { const v = parNum("par-addonv-" + a.codigo); return { codigo: a.codigo, nome: a.nome, valor: (v != null ? v : a.valor) }; });
  }

  // Briefing guiado (Q3–Q10): capacidade→área, profundidade da reforma, fundação/contingência,
  // terreno/ocupação/externa, prazo/faseamento e add-ons de programa. Alimenta a mesma engine.
  function parBriefingHTML(m) {
    const ci = parCapIndice(m);
    const addonRows = parAddonsCat().map(function (a) {
      return `<label style="display:flex;align-items:center;gap:8px;padding:3px 0;break-inside:avoid">
        <input type="checkbox" id="par-addon-${esc(a.codigo)}" onchange="parCalc()">
        <span style="flex:1;font-size:12.5px" title="${esc(a.ajuda || "")}">${esc(a.nome)}</span>
        <input type="number" class="par-addon-v" id="par-addonv-${esc(a.codigo)}" value="${a.valor}" min="0" step="1000" oninput="parCalc()"></label>`;
    }).join("");
    return `<div class="card" style="margin-bottom:14px">
      <h3 class="fin-h" style="margin:0 0 4px"><i class="ti ti-clipboard-list"></i> Briefing guiado <span class="page-sub" style="font-size:12px;font-weight:400">— programa, terreno e prazo</span></h3>
      <p class="page-sub" style="margin:0 0 10px;font-size:12px">Complementa tipologia/áreas/BDI acima. O <strong>programa</strong> (add-ons) é o que mais mexe no R$/m².</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
        <div class="field" style="width:230px"><label>Estimar área pela capacidade</label>
          <div style="display:flex;gap:6px"><input type="number" id="par-capacidade" min="0" step="1" placeholder="${esc(ci.label)}" style="flex:1">
          <button class="btn sm" onclick="parEstimarArea()" title="Área nova ≈ ${ci.idx} m² por ${esc(ci.unidade)}">→ área</button></div></div>
        <div class="field" style="width:190px"><label>Profundidade da reforma</label>
          <select class="sinapi-uf" id="par-reforma-prof" onchange="parCalc()">
            <option value="1">Leve (pintura/piso)</option><option value="2">Média (+ esquadrias/instal.)</option><option value="2.8">Pesada / gut</option></select></div>
        <div class="field" style="width:210px"><label>Fundação / solo (contingência)</label>
          <select class="sinapi-uf" id="par-fundacao" onchange="parCalc()">
            <option value="0">Solo firme (0%)</option><option value="10">Aterro/rocha (+10%)</option><option value="15">Sondagem pendente (+15%)</option></select></div>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-top:10px">
        <div class="field" style="width:150px"><label>Taxa de ocupação (%)</label><input type="number" id="par-ocupacao" min="5" max="100" step="1" value="40" oninput="parCalc()"></div>
        <div class="field" style="width:170px"><label>Área externa (m²)</label><input type="number" id="par-externa" min="0" step="1" value="0" placeholder="quadra/pátio/estac." oninput="parCalc()"></div>
        <div class="field" style="width:170px"><label>Terreno conhecido (m²)</label><input type="number" id="par-terreno" min="0" step="1" placeholder="opcional" oninput="parCalc()"></div>
        <div class="field" style="width:150px"><label>Prazo desejado (dias)</label><input type="number" id="par-prazo" min="0" step="30" placeholder="estimar" oninput="parCalc()"></div>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-2);padding-bottom:8px"><input type="checkbox" id="par-faseado" onchange="parCalc()"> Obra em funcionamento (fasear)</label>
      </div>
      ${addonRows ? `<div style="margin-top:12px">
        <label style="font-size:13px;font-weight:600;color:var(--text-2)"><i class="ti ti-building-community"></i> Ambientes especiais — add-ons de programa (lumps, R$ editável)</label>
        <div class="par-addons">${addonRows}</div>
        <p class="page-sub" style="margin:6px 0 0;font-size:11px"><i class="ti ti-alert-triangle"></i> São <strong>lumps</strong> (não escalam com a área) — valores-semente do acervo (Belot), <strong>ajuste</strong> ao seu caso. É o que leva uma escola de R$1.490 a R$3.879/m².</p>
      </div>` : ""}
    </div>`;
  }

  // Q3: estima a área nova pela capacidade (nº alunos/consultórios) e recalcula.
  function parEstimarArea() {
    const ci = parCapIndice(parModelo());
    const n = parNum("par-capacidade");
    if (!n || n <= 0) { if (typeof toast === "function") toast("Informe a capacidade (" + ci.label.toLowerCase() + ").", "warn"); return; }
    const area = Math.round(n * ci.idx);
    const el = document.getElementById("par-area-nova"); if (el) el.value = area;
    if (typeof toast === "function") toast("Área nova estimada: " + area.toLocaleString("pt-BR") + " m² (" + n + " × " + ci.idx + " m²/" + ci.unidade + "). Ajuste se necessário.", "info");
    parCalc();
  }

  // lê um input numérico; vazio → undefined (usa o padrão do modelo)
  function parNum(id) { const el = document.getElementById(id); if (!el) return undefined; const v = String(el.value).trim(); if (v === "") return undefined; const n = Number(v.replace(",", ".")); return isFinite(n) ? n : undefined; }
  function parDrivers() {
    return {
      areaNova: Math.max(0, Number((document.getElementById("par-area-nova") || {}).value) || 0),
      areaReforma: Math.max(0, Number((document.getElementById("par-area-reforma") || {}).value) || 0),
      topografia: (document.getElementById("par-topo") || {}).value || "plano",
      bdi: parNum("par-bdi"), bdi_natureza: parNum("par-bdi-nat"), reforma_rm2: parNum("par-reforma-rm2"),
      escala_fixo: parNum("par-escala-fixo"),
      // briefing (Q3–Q10)
      reformaFator: Number((document.getElementById("par-reforma-prof") || {}).value) || 1,
      contingenciaPct: Number((document.getElementById("par-fundacao") || {}).value) || 0,
      ocupacao: parNum("par-ocupacao"), externa: parNum("par-externa"), terreno: parNum("par-terreno"),
      prazo: parNum("par-prazo"), faseado: !!(document.getElementById("par-faseado") || {}).checked,
      addons: parAddonsSelecionados()
    };
  }
  // opts.escalaFixo por driver, a partir do % informado (aplica à ampliação/área nova).
  function parEscalaOpts(d) {
    if (d.escala_fixo == null) return undefined;
    return { area_nova: Math.max(0, d.escala_fixo) / 100 };
  }

  function parCalc() {
    const host = document.getElementById("par-out"); if (!host) return;
    const d = parDrivers();
    const pf = parPrecoFn();
    const r = paramGerar(parModelo(), { area_nova: d.areaNova, area_reforma: d.areaReforma, topografia: d.topografia }, { precoFn: pf, bdi: d.bdi, bdi_natureza: d.bdi_natureza, reforma_rm2: d.reforma_rm2, escalaFixo: parEscalaOpts(d), reformaFator: d.reformaFator, contingenciaPct: d.contingenciaPct, addons: d.addons });
    const area = r.area;
    const linhas = r.linhas.map(function (l) {
      return `<tr>
        <td><span class="code" style="font-size:11px;color:var(--text-3)">${esc(l.codigo)}</span></td>
        <td>${esc(l.descricao)}${l.fontePreco === "seed" ? ` <span class="page-sub" style="font-size:10px" title="preço-semente fev/2025 (serviço fora da SINAPI ativa)">seed</span>` : ""}</td>
        <td>${esc(l.unidade)}</td>
        <td style="text-align:right">${l.qtd.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
        <td class="price" style="text-align:right;white-space:nowrap">${parBRL(l.pu)}</td>
        <td class="price" style="text-align:right;white-space:nowrap">${parBRL(l.total)}</td></tr>`;
    }).join("");
    const macros = r.porMacro.map(function (mm) {
      return `<tr><td>${esc(mm.macro)}</td><td class="price" style="text-align:right">${parBRL(mm.total)}</td><td style="text-align:right;color:var(--text-3)">${mm.pct.toFixed(1)}%</td></tr>`;
    }).join("");
    const blocoLabel = { edificacao: "Edificação", implantacao: "Implantação (terreno)", natureza: "Equipamentos (natureza específica)", construcao: "Construção (ampliação)", reforma: "Reforma", programa: "Programa (ambientes especiais)", contingencia: "Contingência (fundação/solo)" };
    const blocos = Object.keys(r.porBloco).sort(function (a, b) { return r.porBloco[b] - r.porBloco[a]; }).map(function (b) {
      return `<tr><td>${esc(blocoLabel[b] || b)}</td><td class="price" style="text-align:right">${parBRL(r.porBloco[b])}</td><td style="text-align:right;color:var(--text-3)">${r.direto ? (r.porBloco[b] / r.direto * 100).toFixed(1) : "0"}%</td></tr>`;
    }).join("");
    const custoM2 = area ? r.total / area : 0;

    // Economia de escala: mostra o R$/m² DA AMPLIAÇÃO (bloco construção ÷ área nova) em 3 portes
    // (½× · atual · 2×). Usa o custo unitário da ampliação — não o total misturado com a reforma —
    // para o gradiente refletir só a diluição do custo fixo. Só quando há custo fixo (φ>0) e área nova.
    let escalaHTML = "";
    if (r.escala && r.escala.aplicada && d.areaNova > 0) {
      const inf = r.escala.porDriver.area_nova || {};
      const escOpts = { precoFn: pf, bdi: d.bdi, bdi_natureza: d.bdi_natureza, escalaFixo: parEscalaOpts(d) };
      const bdiG = (d.bdi != null ? d.bdi : parModelo().bdi) || 0, bdiD = (d.bdi_natureza != null ? d.bdi_natureza : parModelo().bdi_natureza) || 0;
      const novaBDI = function (rr) { return rr.linhas.reduce(function (s, l) { return s + (l.bloco === "construcao" || l.bloco === "edificacao" ? l.total * (1 + (l.bdiDif ? bdiD : bdiG) / 100) : 0); }, 0); };
      const pts = [Math.max(1, Math.round(d.areaNova / 2)), Math.round(d.areaNova), Math.round(d.areaNova * 2)];
      const cells = pts.map(function (an, i) {
        const rr = paramGerar(parModelo(), { area_nova: an, area_reforma: 0, topografia: d.topografia }, escOpts);
        const m2 = an ? novaBDI(rr) / an : 0;
        return `<td style="text-align:center;padding:4px 12px;${i === 1 ? "font-weight:600;color:var(--text)" : "color:var(--text-2)"}">${an.toLocaleString("pt-BR")} m²<br><span class="price">${parBRL(m2)}/m²</span></td>`;
      }).join("");
      escalaHTML = `<div style="margin-top:10px;padding:10px 12px;background:var(--surface-2,rgba(0,0,0,.03));border-radius:8px">
        <div style="font-size:12px;color:var(--text-2);margin-bottom:6px"><i class="ti ti-chart-arrows-vertical"></i> <strong>Economia de escala</strong> — ${(inf.phi * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% de custo fixo na ampliação (diluído em mais m²). <strong>R$/m² da ampliação</strong> (só área nova) por porte — cai quando a obra cresce:</div>
        <div class="tbl-scroll"><table class="data" style="width:auto"><tbody><tr>${cells}</tr></tbody></table></div>
      </div>`;
    }
    // Faixa de obras reais (model.refs / faixa_m2): mostra onde o R$/m² estimado cai vs. o intervalo
    // observado no acervo, com o alerta honesto de que o programa (quadra coberta, cozinha etc.) domina.
    let refHTML = "";
    const modAtivo = parModelo();
    if (modAtivo.refs && modAtivo.refs.length && modAtivo.faixa_m2 && custoM2 > 0) {
      const fx = modAtivo.faixa_m2;
      const pos = custoM2 < fx.min ? "abaixo" : custoM2 > fx.max ? "acima" : "dentro";
      const posTxt = pos === "dentro" ? "dentro da faixa" : "<strong>" + pos + "</strong> da faixa observada";
      const rows = modAtivo.refs.slice().sort(function (a, b) { return a.m2 - b.m2; }).map(function (o) {
        return `<tr><td>${esc(o.nome)}</td><td style="text-align:right">${o.area.toLocaleString("pt-BR")} m²</td><td class="price" style="text-align:right">${parBRL(o.m2)}/m²</td><td style="color:var(--text-3);font-size:11px">${esc(o.programa)}</td></tr>`;
      }).join("");
      refHTML = `<div style="margin-top:10px;padding:10px 12px;background:var(--surface-2,rgba(0,0,0,.03));border-radius:8px">
        <div style="font-size:12px;color:var(--text-2);margin-bottom:6px"><i class="ti ti-ruler-2"></i> <strong>Faixa de obras reais</strong> (${fx.n} escolas de Maringá, R$/m² da intervenção com BDI): <strong>${parBRL(fx.min)}</strong> a <strong>${parBRL(fx.max)}</strong> (mediana ${parBRL(fx.mediana)}). Sua estimativa (${parBRL(custoM2)}/m²) está ${posTxt}.</div>
        <div class="tbl-scroll"><table class="data" style="width:auto;font-size:12px"><thead><tr><th>Obra</th><th style="text-align:right">Área</th><th style="text-align:right">R$/m²</th><th>Programa</th></tr></thead><tbody>${rows}</tbody></table></div>
        <p class="page-sub" style="margin:6px 0 0;font-size:11px"><i class="ti ti-alert-triangle"></i> Espalhamento de ${(fx.max / fx.min).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}× é dominado pelo <strong>programa</strong> (quadra coberta, cozinha industrial, reservatório, HVAC), não pelo tamanho. Confira o escopo antes de confiar no número.</p>
      </div>`;
    }

    // Área de projeto + terreno estimado (Q6/Q7): construída = nova+reforma; terreno ≈ construída/ocupação + externa.
    const construida = area;
    const ocup = (d.ocupacao && d.ocupacao > 0) ? d.ocupacao : 40;
    const externa = d.externa || 0;
    const terrenoEst = construida > 0 ? Math.round(construida / (ocup / 100) + externa) : 0;
    const terrenoInf = d.terreno || 0;
    let projTerrHTML = "";
    if (construida > 0) {
      projTerrHTML = `<div style="margin-top:10px;padding:10px 12px;background:var(--surface-2,rgba(0,0,0,.03));border-radius:8px;font-size:12px;color:var(--text-2)">
        <i class="ti ti-ruler-measure"></i> <strong>Área de projeto</strong> (construída): <strong>${construida.toLocaleString("pt-BR")} m²</strong> (${r.areaNova.toLocaleString("pt-BR")} nova${r.areaReforma ? " + " + r.areaReforma.toLocaleString("pt-BR") + " reforma" : ""}). · <strong>Terreno estimado</strong>: <strong>~${terrenoEst.toLocaleString("pt-BR")} m²</strong> (ocupação ${ocup}%${externa ? " + " + externa.toLocaleString("pt-BR") + " m² externos" : ""})${terrenoInf ? ` · informado ${terrenoInf.toLocaleString("pt-BR")} m² → ocupação real ${(construida / terrenoInf * 100).toFixed(0)}%` : ""}.</div>`;
    }

    // Cronograma básico (Q10): prazo (informado ou estimado) distribuído em macro-fases (curva-S).
    const cron = (typeof paramCronograma === "function") ? paramCronograma(r.total, { prazo: d.prazo, faseado: d.faseado }) : null;
    let cronoHTML = "";
    if (cron) {
      const faseRows = cron.fases.map(function (f) {
        return `<tr><td>${esc(f.nome)}</td><td style="text-align:right;white-space:nowrap">${f.ini}–${f.fim} d</td><td style="text-align:right">${f.dias} d</td><td class="price" style="text-align:right">${parBRL(f.custo)}</td><td style="text-align:right;color:var(--text-3)">${f.pctCusto}% · Σ${f.acumuladoPct}%</td></tr>`;
      }).join("");
      cronoHTML = `<div class="card" style="margin-top:14px">
        <h3 class="fin-h" style="margin:0 0 8px"><i class="ti ti-calendar-stats"></i> Cronograma básico <span class="page-sub" style="font-size:12px;font-weight:400">${cron.prazoDias} dias (${cron.fonte === "informado" ? "prazo informado" : "estimado pelo valor"})${d.faseado ? " · obra faseada" : ""}</span></h3>
        <div class="tbl-scroll"><table class="data"><thead><tr><th>Macro-fase</th><th style="text-align:right">Período</th><th style="text-align:right">Duração</th><th style="text-align:right">Custo</th><th style="text-align:right">% · acum.</th></tr></thead><tbody>${faseRows}</tbody></table></div>
        <p class="page-sub" style="margin:8px 0 0;font-size:11px"><i class="ti ti-info-circle"></i> Distribuição por pesos típicos de custo (curva-S). ${cron.fonte === "estimado" ? "Prazo estimado pelo valor (âncoras reais: R$5,3mi→360d · R$14,3mi→450d) — informe o prazo desejado para ajustar." : ""} As macro-fases se sobrepõem na prática; use como baliza de anteprojeto.</p>
      </div>`;
    }

    host.innerHTML = `
      <div class="card" style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px">
          <h3 class="fin-h" style="margin:0">Planilha sintética estimada <span class="page-sub" style="font-size:12px;font-weight:400">${r.linhas.length} serviços</span></h3>
          <button class="btn sm primary no-print" onclick="parSalvar()" title="Cria um orçamento editável (aba Orçamento) com estes itens"><i class="ti ti-file-invoice"></i> Salvar como orçamento</button>
        </div>
        <div style="overflow:auto;max-height:460px"><table class="data" style="min-width:640px"><thead><tr>
          <th style="width:88px">Código</th><th>Serviço</th><th style="width:44px">Un.</th><th style="text-align:right;width:90px">Qtd</th><th style="text-align:right;width:110px">PU</th><th style="text-align:right;width:120px">Total</th>
        </tr></thead><tbody>${linhas}</tbody></table></div>
      </div>
      <div class="card">
        <div style="display:flex;gap:18px;flex-wrap:wrap">
          <div style="flex:1;min-width:260px">
            <h3 class="fin-h">Resumo por bloco</h3>
            <div class="tbl-scroll" style="margin-bottom:14px"><table class="data"><thead><tr><th>Bloco</th><th style="text-align:right">Custo</th><th style="text-align:right">%</th></tr></thead><tbody>${blocos}</tbody></table></div>
          </div>
          <div style="flex:1;min-width:260px">
            <h3 class="fin-h">Maiores macro-itens</h3>
            <div class="tbl-scroll" style="margin-bottom:14px"><table class="data"><thead><tr><th>Macro-item</th><th style="text-align:right">Custo</th><th style="text-align:right">%</th></tr></thead><tbody>${r.porMacro.slice(0, 8).map(function (mm) { return `<tr><td>${esc(mm.macro)}</td><td class="price" style="text-align:right">${parBRL(mm.total)}</td><td style="text-align:right;color:var(--text-3)">${mm.pct.toFixed(1)}%</td></tr>`; }).join("")}</tbody></table></div>
          </div>
        </div>
        <div class="orc-tot">
          <div class="orc-tot-row"><span>Custo direto estimado</span><strong>${parBRL(r.direto)}</strong></div>
          <div class="orc-tot-row"><span>BDI (${r.bdiConv}% obra · ${r.bdiNat}% equipamentos)</span><strong>${parBRL(r.bdiVal)}</strong></div>
          <div class="orc-tot-row orc-tot-total"><span>Total estimado (${r.areaNova.toLocaleString("pt-BR")} m² nova${r.areaReforma ? " + " + r.areaReforma.toLocaleString("pt-BR") + " m² reforma" : ""})</span><strong>${parBRL(r.total)}</strong></div>
          <div class="orc-tot-row"><span>Custo por m² (${area.toLocaleString("pt-BR")} m²)</span><strong>${parBRL(custoM2)}/m²</strong></div>
        </div>
        <p class="page-sub" style="margin-top:10px;font-size:12px"><i class="ti ti-info-circle"></i> Estrutura/ampliação escala pela <strong>área nova</strong>; a <strong>reforma</strong> escala pela área de reforma (reaproveita a estrutura → custo/m² menor).${r.porBloco.natureza ? " Equipamentos são <em>lump</em> (não escalam)." : ""}${r.topoFator && r.topoFator !== 1 ? ` Implantação × <strong>${r.topoFator.toLocaleString("pt-BR")}</strong> (${esc(r.topografia)}).` : ""}</p>
        ${escalaHTML}
        ${projTerrHTML}
        ${refHTML}
      </div>
      ${cronoHTML}`;
  }

  // Gera um orçamento editável (obra_orcamentos / e23) com as linhas do paramétrico e abre-o.
  function parSalvar() {
    if (typeof ORC === "undefined" || typeof CBStore === "undefined") { if (typeof toast === "function") toast("Módulo de orçamento indisponível.", "error"); return; }
    const d = parDrivers();
    if (!d.areaNova && !d.areaReforma) { if (typeof toast === "function") toast("Informe a área (nova e/ou reforma).", "warn"); return; }
    const modelo = parModelo();
    const r = paramGerar(modelo, { area_nova: d.areaNova, area_reforma: d.areaReforma, topografia: d.topografia }, { precoFn: parPrecoFn(), bdi: d.bdi, bdi_natureza: d.bdi_natureza, reforma_rm2: d.reforma_rm2, escalaFixo: parEscalaOpts(d), reformaFator: d.reformaFator, contingenciaPct: d.contingenciaPct, addons: d.addons });
    const meta = (typeof SINAPIDB !== "undefined") ? SINAPIDB.meta() : {};
    const id = CBStore.uuid();
    const itens = r.linhas.map(function (l) {
      return { id: CBStore.uuid(), etapa: l.macro, tipo: l.tipo, codigo: l.codigo, descricao: l.descricao, unidade: l.unidade, qtd: Math.round(l.qtd * 100) / 100, pu: Math.round(l.pu * 100) / 100 };
    });
    const areaTxt = d.areaNova.toLocaleString("pt-BR") + " m² nova" + (d.areaReforma ? " + " + d.areaReforma.toLocaleString("pt-BR") + " m² reforma" : "");
    ORC.upsert({ id: id, nome: modelo.tipologia + " — " + areaTxt, projeto_id: "", uf: meta.uf || modelo.uf, regime: meta.regime || modelo.regime, bdi: r.bdiConv, itens: itens, versao: 1, obs: "Gerado pelo orçamento paramétrico (f38): " + modelo.tipologia + ", " + areaTxt + ".", dono: CBStore.uid() });
    if (typeof toast === "function") toast("Orçamento criado a partir da estimativa paramétrica. Ajuste itens/BDI na aba Orçamento.", "success");
    navigate("sinapi", "orc:");
    setTimeout(function () { if (typeof orcAbrir === "function") orcAbrir(id); }, 60);
  }

  window.renderParametrico = renderParametrico;
  window.parCalc = parCalc;
  window.parSalvar = parSalvar;
  window.parTrocaModelo = parTrocaModelo;
  window.parEstimarArea = parEstimarArea;
}

