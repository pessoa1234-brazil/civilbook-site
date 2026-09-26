// Civilbook — INSIGHTS SEMANAIS (ag5): o motor puro do relatório de uso.
//
// O que a tarefa pede: churn, módulos populares e horários de pico. O que o produto precisa de
// verdade, com 7 usuários: menos "dashboard" e mais PERGUNTA RESPONDIDA — quem sumiu, o que
// ninguém usa, e quando as pessoas trabalham (que define quando é seguro deployar).
//
// Aqui só há função pura sobre uma lista de eventos: nada de rede, nada de DOM. Assim o painel
// do Admin e um futuro agente por e-mail (Edge Function + Resend, como o manutencao-alertas)
// usam exatamente a MESMA conta — relatório que diverge do painel é relatório que ninguém crê.
//
// HONESTIDADE ESTATÍSTICA embutida: com base pequena, porcentagem engana. Toda saída carrega o
// número absoluto, e o módulo diz explicitamente quando a amostra é pequena demais para
// conclusão (`amostraPequena`). É melhor dizer "são 3 usuários, não dá para concluir" do que
// exibir "queda de 66%" com cara de ciência.

const INSIGHTS = {
  AMOSTRA_MINIMA: 8,          // abaixo disso, o relatório não conclui — só descreve
  DIAS_INATIVO: 14,           // sem nenhum evento há 14 dias = provável churn

  // Divide a linha do tempo em duas janelas de 7 dias para comparar semana a semana.
  janelas(agoraMs) {
    const fim = agoraMs;
    const ini = fim - 7 * 86400000;
    return { atualIni: ini, atualFim: fim, anteriorIni: ini - 7 * 86400000, anteriorFim: ini };
  },

  // eventos: [{ user_id, module, event_type, occurred_at }] — linha CRUA de usage_events — OU
  // (a16) a linha AGREGADA da RPC insights_uso_agregado: { user_id, module, occurred_at, n },
  // onde n é a contagem daquele grupo (hora × módulo × usuário). O peso `n` conta como n eventos;
  // usuários distintos, churn e pico funcionam igual porque user_id e a hora sobrevivem à
  // agregação. UMA régua para as duas entradas — o card e o futuro agente por e-mail não divergem.
  semanal(eventos, agoraMs) {
    const evs = (eventos || []).map((e) => ({ ...e, t: new Date(e.occurred_at).getTime() })).filter((e) => Number.isFinite(e.t));
    const j = this.janelas(agoraMs || Date.now());
    const naJanela = (e, ini, fim) => e.t >= ini && e.t < fim;
    const w = (e) => (Number.isFinite(e.n) && e.n > 0 ? e.n : 1);   // peso da linha (1 = linha crua)
    const soma = (lista) => lista.reduce((s, e) => s + w(e), 0);

    const atual = evs.filter((e) => naJanela(e, j.atualIni, j.atualFim));
    const anterior = evs.filter((e) => naJanela(e, j.anteriorIni, j.anteriorFim));
    const uniq = (lista) => new Set(lista.map((e) => e.user_id).filter(Boolean));

    const ativosAtual = uniq(atual), ativosAnterior = uniq(anterior);
    const novos = [...ativosAtual].filter((u) => !ativosAnterior.has(u));
    const sumiram = [...ativosAnterior].filter((u) => !ativosAtual.has(u));

    // Módulos: contagem de eventos E de usuários distintos — 40 eventos de uma pessoa só não é
    // "módulo popular", é uma pessoa. Sem essa distinção o relatório mente.
    const porModulo = {};
    atual.forEach((e) => {
      const m = e.module || "(sem módulo)";
      (porModulo[m] = porModulo[m] || { modulo: m, eventos: 0, usuarios: new Set() });
      porModulo[m].eventos += w(e);
      if (e.user_id) porModulo[m].usuarios.add(e.user_id);
    });
    const modulos = Object.values(porModulo)
      .map((m) => ({ modulo: m.modulo, eventos: m.eventos, usuarios: m.usuarios.size }))
      .sort((a, b) => b.usuarios - a.usuarios || b.eventos - a.eventos);

    // Horas de pico no fuso de quem usa (o navegador do admin é o mesmo fuso da obra, na prática).
    const horas = new Array(24).fill(0);
    atual.forEach((e) => { horas[new Date(e.t).getHours()] += w(e); });
    const pico = horas.map((n, h) => ({ hora: h, n })).sort((a, b) => b.n - a.n).slice(0, 3).filter((x) => x.n > 0);

    // Churn: quem tem evento no histórico mas nada nos últimos DIAS_INATIVO dias.
    const ultimoDe = {};
    evs.forEach((e) => { if (e.user_id) ultimoDe[e.user_id] = Math.max(ultimoDe[e.user_id] || 0, e.t); });
    const limite = (agoraMs || Date.now()) - this.DIAS_INATIVO * 86400000;
    const inativos = Object.entries(ultimoDe).filter(([, t]) => t < limite)
      .map(([u, t]) => ({ user_id: u, diasSemUsar: Math.floor(((agoraMs || Date.now()) - t) / 86400000) }))
      .sort((a, b) => a.diasSemUsar - b.diasSemUsar);

    const base = Object.keys(ultimoDe).length;
    return {
      periodo: { de: new Date(j.atualIni).toISOString().slice(0, 10), ate: new Date(j.atualFim).toISOString().slice(0, 10) },
      ativos: ativosAtual.size,
      ativosAnterior: ativosAnterior.size,
      variacao: ativosAtual.size - ativosAnterior.size,
      novos: novos.length,
      sumiram: sumiram.length,
      eventos: soma(atual),
      eventosAnterior: soma(anterior),
      modulos,
      modulosMortos: [],   // preenchido por quem sabe a lista de módulos do app (ver abaixo)
      pico,
      inativos,
      base,
      amostraPequena: base < this.AMOSTRA_MINIMA,
    };
  },

  // Módulos que EXISTEM no app e ninguém abriu na janela — o dado mais acionável do relatório
  // (é o que decide o que melhorar ou o que aposentar). Precisa da lista de fora: o motor não
  // conhece o app.
  mortos(resumo, todosOsModulos) {
    const usados = new Set((resumo.modulos || []).map((m) => m.modulo));
    return (todosOsModulos || []).filter((m) => !usados.has(m));
  },

  // Texto curto em pt-BR — serve ao card do Admin e ao corpo do e-mail do agente, sem duplicar
  // regra. Sempre com número absoluto ao lado da variação.
  resumoTexto(r) {
    const p = [];
    p.push(`${r.ativos} usuário(s) ativo(s) na semana (${r.variacao >= 0 ? "+" : ""}${r.variacao} vs a anterior), ${r.eventos} ação(ões).`);
    if (r.novos) p.push(`${r.novos} apareceu(ram) pela primeira vez nesta janela.`);
    if (r.sumiram) p.push(`${r.sumiram} estava(m) ativo(s) na semana passada e não voltou(aram).`);
    if (r.inativos.length) p.push(`${r.inativos.length} sem usar há mais de ${this.DIAS_INATIVO} dias.`);
    if (r.modulos.length) p.push(`Mais usado: ${r.modulos[0].modulo} (${r.modulos[0].usuarios} usuário(s), ${r.modulos[0].eventos} ações).`);
    if (r.pico.length) p.push(`Pico às ${r.pico.map((x) => x.hora + "h").join(", ")}.`);
    if (r.amostraPequena) p.push(`Base de ${r.base} usuário(s) — números pequenos demais para conclusão; leia como descrição, não como tendência.`);
    return p.join(" ");
  },
};

if (typeof window !== "undefined") window.INSIGHTS = INSIGHTS;
if (typeof module !== "undefined" && module.exports) module.exports = { INSIGHTS };
