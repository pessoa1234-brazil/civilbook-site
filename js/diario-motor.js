// f62 S2 — MOTOR do gerador de RAO/RSO (puro, sem DOM e sem rede; testes em tests/diario.test.mjs).
// A capa do RAO é ARITMÉTICA: EAP ponderada pelo orçamento (incidência × execução por etapa),
// acumulados e curva prevista do cronograma — calculada aqui UMA vez, nunca à mão (mata o erro
// nº 4 do padrão real, percentuais recalculados a cada edição; ver docs/DIARIO-OBRA-PADRAO.md).
// DECISÕES DA S2 registradas:
//   · medição por ETAPA do orçamento (não por item fino) — entrada simples, suficiente p/ a capa;
//   · clima do RDO (bom|nublado|chuvoso|impraticavel) mapeia p/ os 4 estados do padrão:
//     bom/nublado → Bom · chuvoso → Chuva praticável · impraticavel → Chuva impraticável;
//     "Molhado prejudicado" não existe no RDO — fica p/ a edição manual do documento;
//   · numeração de RSO contínua por SEMANAS CIVIS desde o início da obra (segunda a sábado).
(function (root) {
  "use strict";
  const MS_DIA = 86400000;

  function ms(iso) { const [a, m, d] = iso.split("-").map(Number); return Date.UTC(a, m - 1, d); }
  function iso(t) { return new Date(t).toISOString().slice(0, 10); }
  function addDias(isoStr, n) { return iso(ms(isoStr) + n * MS_DIA); }
  function brData(isoStr) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoStr || ""); return m ? m[3] + "/" + m[2] + "/" + m[1] : ""; }
  function diaSemana(isoStr) { return new Date(ms(isoStr)).getUTCDay(); }   // 0=dom … 6=sáb
  const NOMES_DIA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

  // ── EAP por ETAPA do orçamento: incidência = custo da etapa / custo total ──────────────────────
  // BDI multiplica todas as etapas igualmente → não altera a incidência (fica de fora da conta).
  function eapDoOrcamento(itens) {
    const porEtapa = new Map();
    let total = 0;
    for (const it of itens || []) {
      const custo = (Number(it.qtd) || 0) * (Number(it.pu) || 0);
      const etapa = (it.etapa || "Sem etapa").trim() || "Sem etapa";
      porEtapa.set(etapa, (porEtapa.get(etapa) || 0) + custo);
      total += custo;
    }
    const linhas = [...porEtapa.entries()].map(([etapa, custo]) => ({
      etapa, custo, incidencia: total > 0 ? (custo * 100) / total : 0,
    }));
    return { linhas, total };
  }

  // ── Capa: cruza a EAP com as medições {etapa → % executado do item} ────────────────────────────
  // execObra = incidência × execItem / 100; acumulado = Σ execObra. A medição ANTERIOR dá o
  // "executado etapa anterior" do rodapé (0 quando não há).
  function linhasCapa(eap, medicaoAtual, medicaoAnterior) {
    const at = medicaoAtual || {};
    const ant = medicaoAnterior || {};
    const clamp = (v) => Math.max(0, Math.min(100, Number(v) || 0));
    const linhas = eap.linhas.map((l, i) => {
      const execItem = clamp(at[l.etapa]);
      return {
        item: String(i + 1).padStart(2, "0"),
        etapa: l.etapa,
        incidencia: l.incidencia,
        execItem,
        execObra: (l.incidencia * execItem) / 100,
      };
    });
    const soma = (med) => eap.linhas.reduce((s, l) => s + (l.incidencia * clamp(med[l.etapa])) / 100, 0);
    const acumulado = soma(at);
    const anterior = soma(ant);
    return { linhas, acumulado, anterior, naEtapa: acumulado - anterior };
  }

  // ── Períodos QUINZENAIS de referência (etapa 0 = vistoria na data de início) ───────────────────
  function periodosQuinzenais(inicioISO, fimISO) {
    const per = [{ n: 0, ini: inicioISO, fim: inicioISO, rotulo: "Vistoria — " + brData(inicioISO) }];
    let ini = inicioISO, n = 1;
    while (ms(ini) <= ms(fimISO) && n <= 60) {
      const fim = addDias(ini, 14);
      per.push({ n, ini, fim, rotulo: brData(ini) + " – " + brData(fim) });
      ini = addDias(fim, 1);
      n++;
    }
    return per;
  }

  // ── Curva PREVISTA: atividades do cronograma [{inicio, dur, valor}] viram % acumulado por
  // período (proporcional aos dias decorridos de cada atividade até o fim do período) ────────────
  function curvaPrevista(atividades, periodos) {
    const ats = (atividades || []).filter((a) => a.inicio && Number(a.dur) > 0);
    const totalValor = ats.reduce((s, a) => s + (Number(a.valor) || 0), 0);
    return periodos.map((p) => {
      if (!ats.length) return 0;
      let feito = 0;
      for (const a of ats) {
        const v = Number(a.valor) || 0;
        const ini = ms(a.inicio), dur = Number(a.dur);
        const passados = Math.max(0, Math.min(dur, (ms(p.fim) - ini) / MS_DIA + 1));
        feito += (totalValor > 0 ? v : 1) * (passados / dur);
      }
      const base = totalValor > 0 ? totalValor : ats.length;
      return Math.min(100, (feito * 100) / base);
    });
  }

  // ── Clima do RDO → os 4 estados do padrão (classe CSS do template S1) ─────────────────────────
  function mapearClima(estado) {
    if (estado === "bom" || estado === "nublado") return "bom";
    if (estado === "chuvoso") return "chuva-p";
    if (estado === "impraticavel") return "chuva-i";
    return "";   // sem registro → célula vazia (nunca inventar)
  }

  // ── Semanas civis do período, com os RDOs agrupados. A semana vai de SEGUNDA a DOMINGO
  // (revisão S2: o RDO de domingo pertencia à "semana seguinte" e SUMIA do documento, ainda
  // criando um RSO fantasma fora do período — trabalho de domingo é da semana que está
  // terminando). A grade impressa mostra seg–sáb e o domingo só entra quando tem registro. ──────
  function inicioDaSemana(isoStr) {
    const ds = diaSemana(isoStr);                       // 0=dom
    return addDias(isoStr, ds === 0 ? -6 : 1 - ds);     // domingo fecha a semana que COMEÇOU na 2ª anterior
  }
  function diaTemDado(dia) {
    return !!(dia.clima.manha || dia.clima.tarde || (dia.efetivo && dia.efetivo.length) || dia.atividades || dia.ocorrencias || (dia.fotos && dia.fotos.length));
  }
  function numeroRsoInicial(inicioObraISO, iniPeriodoISO) {
    const s0 = ms(inicioDaSemana(inicioObraISO));
    const s1 = ms(inicioDaSemana(iniPeriodoISO));
    return Math.max(1, Math.round((s1 - s0) / (7 * MS_DIA)) + 1);
  }
  function semanasDoPeriodo(rdos, iniISO, fimISO, numeroInicial) {
    const dentro = (rdos || []).filter((r) => r.data >= iniISO && r.data <= fimISO)
      .sort((a, b) => a.data.localeCompare(b.data));
    const porSemana = new Map();
    for (const r of dentro) {
      const seg = inicioDaSemana(r.data);
      if (!porSemana.has(seg)) porSemana.set(seg, []);
      porSemana.get(seg).push(r);
    }
    // só semanas que INTERSECTAM o período (nunca uma folha fantasma fora dele)
    const segundas = [...porSemana.keys()].sort()
      .filter((seg) => ms(seg) <= ms(fimISO) && ms(addDias(seg, 6)) >= ms(iniISO));
    return segundas.map((seg, idx) => {
      const dias = [];
      for (let d = 0; d < 7; d++) {                     // seg..DOM (o domingo se poda na impressão)
        const data = addDias(seg, d);
        const rdo = porSemana.get(seg).find((r) => r.data === data) || null;
        dias.push({
          data,
          rotulo: brData(data) + " — " + NOMES_DIA[diaSemana(data)],
          clima: {
            manha: mapearClima(rdo && rdo.clima ? rdo.clima.manha : ""),
            tarde: mapearClima(rdo && rdo.clima ? rdo.clima.tarde : ""),
          },
          efetivo: (rdo && rdo.efetivo) || [],
          atividades: (rdo && rdo.atividades) || "",
          ocorrencias: (rdo && rdo.ocorrencias) || "",
          fotos: (rdo && rdo.fotos) || [],
        });
      }
      if (!diaTemDado(dias[6])) dias.pop();             // domingo sem registro não imprime
      return { numero: numeroInicial + idx, ini: seg, fim: addDias(seg, dias.length - 1), dias };
    });
  }

  // ── Efetivo função × dia da semana (linhas na ordem de aparição; TOTAL por dia) ───────────────
  function efetivoSemana(dias) {
    const n = dias.length;                              // 6 (seg–sáb) ou 7 (com domingo registrado)
    const funcoes = [];
    const porFuncao = new Map();
    dias.forEach((dia, i) => {
      for (const e of dia.efetivo || []) {
        const f = (e.funcao || "").trim();
        if (!f) continue;
        if (!porFuncao.has(f)) { porFuncao.set(f, new Array(n).fill(0)); funcoes.push(f); }
        porFuncao.get(f)[i] += Number(e.qtd) || 0;
      }
    });
    const totais = new Array(n).fill(0);
    for (const linha of porFuncao.values()) linha.forEach((q, i) => { totais[i] += q; });
    return { funcoes, porFuncao, totais };
  }

  const API = {
    eapDoOrcamento, linhasCapa, periodosQuinzenais, curvaPrevista,
    mapearClima, inicioDaSemana, diaTemDado, numeroRsoInicial, semanasDoPeriodo, efetivoSemana,
    brData, addDias,
  };
  root.DIARIO_MOTOR = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
