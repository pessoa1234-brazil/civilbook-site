// Civilbook — SAÚDE DO SISTEMA (f47): o motor PURO por trás da aba Saúde do Admin.
//
// Por que existe: o "está tudo funcionando?" era respondido por um teste manual que só acontecia
// quando alguém lembrava — e foi assim que o agente SINAPI ficou dois meses falhando sem ninguém
// ver. Aqui as sondas viram semáforo, e a régua de cada uma mora NESTE arquivo, puro e testável,
// separada do HTML (js/admin.js) e da rede.
//
// REGRA DE HONESTIDADE que atravessa o módulo: "não consegui medir" NUNCA é pintado de verde.
// Estados: ok · atencao · ruim · desconhecido — e "desconhecido" sempre carrega o MOTIVO.
// (A lição é do f48: erro de leitura do backup não pode virar "nunca rodou", são coisas
// diferentes; e a f50 ensinou a não afirmar o que não foi aberto.)

const SAUDE = {
  // Teto do plano Supabase (Free = 500 MB). tools/free-tier.sql documenta a régua.
  TETO_BANCO_MB: 500,

  // ── (1) BANCO: quanto do teto do plano já foi usado ──────────────────────────────────────
  // Verde até 70%, atenção até 85%, ruim acima — a faixa amarela existe para dar tempo de agir
  // (a alavanca do halfvec/f35 leva semanas de decisão, não horas).
  banco(bytes, tetoMB) {
    const teto = (tetoMB || this.TETO_BANCO_MB) * 1024 * 1024;
    if (!Number.isFinite(bytes) || bytes <= 0) return { estado: "desconhecido", motivo: "a RPC ia_escala_medir não devolveu o tamanho do banco (migration 0061 aplicada? sessão de admin?)" };
    const pct = bytes / teto * 100;
    const estado = pct >= 85 ? "ruim" : pct >= 70 ? "atencao" : "ok";
    return {
      estado, pct, bytes, teto,
      texto: `${this.mb(bytes)} de ${tetoMB || this.TETO_BANCO_MB} MB (${pct.toFixed(1).replace(".", ",")}%)`,
      motivo: estado === "ruim" ? "acima de 85% do teto do plano — o banco para de aceitar escrita quando estoura"
        : estado === "atencao" ? "acima de 70% do teto — hora de decidir a alavanca (halfvec/f35) ou o upgrade de plano"
          : "dentro da folga do plano",
    };
  },
  mb(bytes) { return (bytes / 1048576).toFixed(1).replace(".", ",") + " MB"; },

  // ── (2) FRESCOR: uma automação que deveria rodar a cada N dias rodou? ────────────────────
  // `ultimo` = ISO da última execução com SUCESSO (não a última tentativa — a diferença importa).
  frescor(ultimoISO, periodoDias, agora) {
    const hoje = agora ? new Date(agora).getTime() : Date.now();
    if (!ultimoISO) return { estado: "ruim", dias: null, texto: "nunca registrou sucesso", motivo: "sem nenhuma execução bem-sucedida no registro" };
    const t = new Date(ultimoISO).getTime();
    if (!Number.isFinite(t)) return { estado: "desconhecido", motivo: "data de execução ilegível no registro" };
    const dias = Math.floor((hoje - t) / 86400000);
    // tolerância de 15% do período (uma rodada pode atrasar um dia sem virar alarme)
    const limite = periodoDias * 1.15;
    const estado = dias > periodoDias * 2 ? "ruim" : dias > limite ? "atencao" : "ok";
    return {
      estado, dias,
      texto: dias === 0 ? "hoje" : dias === 1 ? "há 1 dia" : `há ${dias} dias`,
      motivo: estado === "ok" ? `dentro do ciclo de ${periodoDias} dias`
        : estado === "atencao" ? `passou do ciclo de ${periodoDias} dias`
          : `mais que o dobro do ciclo de ${periodoDias} dias — provavelmente parou`,
    };
  },

  // ── (3) SONDA HTTP: o que a resposta de um preflight (OPTIONS) significa ─────────────────
  // Uma Edge Function no ar responde ao OPTIONS com 2xx. 401/403 TAMBÉM significa "está no ar"
  // (é o gate autenticando) — o que denuncia função fora é 404/5xx ou a falha de rede.
  sonda(status, ms, erroRede) {
    if (erroRede) return { estado: "desconhecido", texto: "sem resposta", motivo: erroRede };
    if (!Number.isFinite(status)) return { estado: "desconhecido", texto: "—", motivo: "sem status" };
    if (status >= 500) return { estado: "ruim", texto: status + "", motivo: "a função respondeu com erro do servidor" };
    if (status === 404) return { estado: "ruim", texto: "404", motivo: "não existe nessa URL — deployada?" };
    if (status === 401 || status === 403) return { estado: "ok", texto: status + " (gate ativo)", motivo: "está no ar e exigindo credencial — é o esperado" };
    if (status >= 200 && status < 400) return { estado: "ok", texto: status + "", motivo: ms != null ? `respondeu em ${Math.round(ms)} ms` : "no ar" };
    return { estado: "atencao", texto: status + "", motivo: "resposta fora do previsto" };
  },

  // ── (3b) FRESCOR DA BASE DE NORMAS (f11): a idade das versões indexadas ──────────────────
  // A base não SABE quando a ABNT publica revisão (não há API pública); esta régua mede o que
  // dá para medir sozinho — a IDADE da versão que temos de cada norma — e devolve a FILA de
  // conferência manual (as mais antigas primeiro). Detectar revisão de verdade é a v2 (fonte
  // externa/agente), dita na tarefa f11 — prometer detecção aqui seria mentir.
  // linhas: [{ norma_codigo, ano, chunks }] (uma por norma; ano = o da versão na base).
  frescorNormas(linhas, anoAtual) {
    const ano = anoAtual || new Date().getFullYear();
    const l = (linhas || []).filter((x) => x && x.norma_codigo);
    if (!l.length) return { estado: "desconhecido", motivo: "sem normas com norma_codigo publicadas — ou a RPC frescor_normas (0088) ainda não foi aplicada" };
    const comAno = l.filter((x) => Number.isFinite(x.ano) && x.ano >= 1900 && x.ano <= ano + 1);
    const semAno = l.length - comAno.length;
    const pctSemAno = semAno / l.length * 100;
    const idades = comAno.map((x) => ano - x.ano).sort((a, b) => a - b);
    const mediana = idades.length ? idades[Math.floor(idades.length / 2)] : null;
    const antigas15 = comAno.filter((x) => ano - x.ano >= 15).length;
    const fila = [...comAno].sort((a, b) => a.ano - b.ano).slice(0, 10);
    // Régua: mediana de idade até 8 anos = ok; até 15 = atenção; acima = ruim (base envelheceu).
    // Sem-ano acima de 20% rebaixa ok→atenção: não dá para medir o que não tem rótulo.
    let estado = mediana == null ? "desconhecido" : mediana > 15 ? "ruim" : mediana > 8 ? "atencao" : "ok";
    if (estado === "ok" && pctSemAno > 20) estado = "atencao";
    return {
      estado, total: l.length, comAno: comAno.length, semAno, mediana, antigas15, fila,
      texto: mediana == null ? `${l.length} norma(s), nenhuma com ano rotulado`
        : `${l.length} norma(s) · idade mediana ${mediana} ano(s) · ${antigas15} com 15+ anos${semAno ? ` · ${semAno} sem ano` : ""}`,
      motivo: estado === "ok" ? "base majoritariamente recente"
        : estado === "atencao" ? (mediana != null && mediana > 8 ? "a mediana passou de 8 anos — vale uma rodada de conferência no catálogo" : "mais de 20% das normas sem ano rotulado — rotular antes de confiar na régua")
          : estado === "ruim" ? "mediana acima de 15 anos — a base envelheceu; priorizar a fila de conferência"
            : "sem dado para medir",
    };
  },

  // ── (4) RESUMO: o pior estado manda, e o texto conta o que está ruim ─────────────────────
  // Ordem deliberada: ruim > desconhecido > atencao > ok. "Desconhecido" pesa MAIS que "atenção"
  // porque não saber é pior que saber que está mais ou menos — é onde moram as surpresas.
  ORDEM: { ruim: 3, desconhecido: 2, atencao: 1, ok: 0 },
  pior(estados) {
    let p = "ok";
    for (const e of estados) if ((this.ORDEM[e] ?? 0) > (this.ORDEM[p] ?? 0)) p = e;
    return p;
  },
  resumo(itens) {
    const conta = { ok: 0, atencao: 0, ruim: 0, desconhecido: 0 };
    itens.forEach((i) => { conta[i.estado] = (conta[i.estado] || 0) + 1; });
    const geral = this.pior(itens.map((i) => i.estado));
    const problemas = itens.filter((i) => i.estado === "ruim" || i.estado === "atencao").map((i) => i.nome);
    const naoMedidos = itens.filter((i) => i.estado === "desconhecido").map((i) => i.nome);
    let texto;
    if (geral === "ok") texto = `${conta.ok} verificações, todas em ordem`;
    else {
      const partes = [];
      if (problemas.length) partes.push(`${problemas.length} com problema (${problemas.join(", ")})`);
      if (naoMedidos.length) partes.push(`${naoMedidos.length} sem medição (${naoMedidos.join(", ")})`);
      texto = partes.join(" · ");
    }
    return { geral, conta, texto, problemas, naoMedidos };
  },

  ROTULO: { ok: "em ordem", atencao: "atenção", ruim: "problema", desconhecido: "não medido" },
  PILL: { ok: "pill-teal", atencao: "pill-amber", ruim: "pill-red", desconhecido: "pill-gray" },
};

if (typeof window !== "undefined") window.SAUDE = SAUDE;
if (typeof module !== "undefined" && module.exports) module.exports = { SAUDE };
