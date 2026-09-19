// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Ver LICENSE (Lei 9.609/98 e 9.610/98).
//
// f35 — ESCALA & CUSTOS da base integral. Motor puro: mede → projeta → orça.
//
// POR QUE ESTE ARQUIVO EXISTE
// O docs/ARQUITETURA-RAG.md §4 dimensionou a base ANTES de existir base: "100–500 chunks por norma",
// "300 mil a 1,5 milhão de chunks", "~6 GB só de embeddings", "centenas de milhões de tokens na
// Voyage". Eram palpites honestos de quem ainda não tinha um número. Hoje há 81 normas integrais
// medidas — e a medição desmente o palpite em duas casas decimais que MUDAM a decisão. Este motor
// substitui a estimativa pela extrapolação do que existe.
//
// A REGRA DA CASA: nada aqui é chutado a partir de "quanto costuma ser". Tudo que dá para medir vem
// da RPC ia_escala_medir() (migration 0061) — inclusive as razões (quanto o HNSW infla sobre o vetor
// cru, quanto o resto da linha pesa). O que NÃO dá para medir sem gastar (tokens por caractere,
// folga de RAM) é constante nomeada, com o raciocínio ao lado e sensibilidade documentada.
//
// Puro: sem DOM, sem rede, sem storage. Roda no navegador (painel do Admin) e no Deno (testes) —
// mesmo padrão do js/parametrico.js (f38).
(function (root) {
  "use strict";

  // ══ PREÇOS ════════════════════════════════════════════════════════════════════════════════
  // Conferidos em 06/ago/2026 nas páginas oficiais. Estão aqui, num lugar só, porque preço muda e
  // conta errada por preço velho é pior que conta não feita — o painel mostra a data.
  var PRECOS = {
    conferido_em: "2026-08-06",

    // docs.voyageai.com/docs/pricing — USD por 1 milhão de tokens.
    // voyage-3.5 é o modelo EM USO (1024 dims, ver 0027). Os "older models" não têm cota grátis.
    voyage: {
      "voyage-3.5": 0.06,
      "voyage-3.5-lite": 0.02,
      rerank_2_5: 0.05
    },
    // Batch API: "33% discount" sobre o endpoint padrão. Ingestão em lote é o caso de uso exato.
    voyage_batch_desconto: 0.33,

    // supabase.com/pricing — plano + disco.
    supabase: {
      free_teto_bytes: 500 * 1024 * 1024,        // 500 MB — o teto de hoje
      pro_mensal: 25,
      pro_disco_incluso_gb: 8,
      pro_disco_extra_usd_gb: 0.125,
      // "Paid plans include $10 in Compute Credits, which cover one project running on the
      // Micro/Nano Compute size or portions of other Compute sizes."
      // É por isso que Small sai por US$ 5 líquidos, e não 15 — detalhe que troca a recomendação.
      credito_compute_usd: 10
    }
  };

  // supabase.com/docs/guides/platform/compute-and-disk (RAM) + .../manage-your-usage/compute (preço)
  var COMPUTE = [
    { id: "nano",   nome: "Nano",   ram_gb: 0.5, mensal: 0 },
    { id: "micro",  nome: "Micro",  ram_gb: 1,   mensal: 10 },
    { id: "small",  nome: "Small",  ram_gb: 2,   mensal: 15 },
    { id: "medium", nome: "Medium", ram_gb: 4,   mensal: 60 },
    { id: "large",  nome: "Large",  ram_gb: 8,   mensal: 111 },
    { id: "xl",     nome: "XL",     ram_gb: 16,  mensal: 210 },
    { id: "2xl",    nome: "2XL",    ram_gb: 32,  mensal: 410 },
    { id: "4xl",    nome: "4XL",    ram_gb: 64,  mensal: 960 }
  ];

  // ══ CONSTANTES QUE NÃO DÁ PARA MEDIR SEM GASTAR ═══════════════════════════════════════════
  // CHARS_POR_TOKEN: o tokenizador da Voyage em português técnico. 3,7 é o meio da faixa usual
  // (3,5–4,0). Vale dizer: ±30% aqui move o custo de embedding de ~US$ 3,5 para ~US$ 6,5 — não
  // muda NENHUMA decisão. Por isso não vale gastar chamada de API para calibrar.
  var CHARS_POR_TOKEN = 3.7;

  // FOLGA_RAM: o índice HNSW precisa caber na memória, e a memória não é só dele (Postgres,
  // conexões, cache das outras tabelas). 1,4× é margem de engenharia, não medição — está exposta
  // como parâmetro para quem quiser apertar ou afrouxar.
  var FOLGA_RAM = 1.4;

  var GB = 1024 * 1024 * 1024;

  // ══ MEDIÇÃO PADRÃO ════════════════════════════════════════════════════════════════════════
  // Retrato de 06/ago/2026 lido do PRÓPRIO banco (contagens via PostgREST). Serve de ponto de
  // partida enquanto a 0061 não estiver aplicada — o painel DIZ quando está usando isto em vez do
  // medido. Os campos de BYTES ficam nulos de propósito: PostgREST não lê catálogo, então eu não
  // tinha como medi-los, e inventá-los seria repetir o erro do §4.
  var PADRAO = {
    medido_em: "2026-08-06",
    origem: "contagens reais; bytes por razão documentada (a 0061 substitui por medição)",
    trechos: 8945,
    trechos_integral: 7388,
    normas_integrais: 81,
    chars_integral: 7864367,
    dim: 1024,
    tipo_coluna: "vector",
    banco_bytes: null,
    base_total_bytes: null,
    hnsw_bytes: null,
    // Razões de recurso quando não há medição — CALIBRADAS na medição de 06/ago/2026, não deduzidas.
    // A primeira versão deste arquivo trazia 1,25 e 2,2, tirados do funcionamento do pgvector e do
    // tamanho do texto. Quando a 0061 entrou no ar, o banco disse outra coisa: o índice HNSW ocupa
    // 70 MB para 8.945 trechos = 8.208 B/trecho, ou seja **2,0× o vetor cru** (o custo das listas de
    // vizinhos é muito maior do que "sobra em cima do vetor"), e o resto da linha dá 5.274 B — 2,25×
    // o que eu supunha, porque a coluna `fts` (tsvector gerado, 0045) e os dois GIN pesam.
    // Subestimar aqui não é detalhe: com 1,25 a projeção pedia Small (US$ 30/mês) onde o real pede
    // Medium (US$ 75/mês). Ficam as razões medidas — e o painel continua dizendo quando é estimativa.
    razao_hnsw_fallback: 2.0,     // 8208 / 4104, medido
    razao_resto_fallback: 4.96    // 5274 B / 1064 chars, medido
  };

  // ══ MEDIDAS ═══════════════════════════════════════════════════════════════════════════════

  /** Bytes de UM vetor no Postgres. pgvector: 4 bytes/dim (vector) ou 2 (halfvec), + 8 de cabeçalho. */
  function bytesVetor(dim, tipo) {
    var porDim = (tipo === "halfvec") ? 2 : 4;
    return porDim * dim + 8;
  }

  /**
   * Converte o JSON da RPC ia_escala_medir() nas medidas que a projeção usa.
   * Aceita também o PADRAO (campos de bytes nulos) — aí cai nas razões de fallback e marca
   * `medido:false`, para o painel não apresentar estimativa com cara de medição.
   */
  function medidas(retrato) {
    var r = retrato || PADRAO;
    var conteudo = r.conteudo || r;
    var trechos = num(conteudo.trechos) || 1;
    var trechosInt = num(conteudo.trechos_integral) || trechos;
    var normas = num(conteudo.normas_integrais) || 1;
    var charsInt = num(conteudo.chars_integral) || 0;
    var dim = normalizarDim(conteudo.dim_embedding != null ? conteudo.dim_embedding : r.dim);
    var tipoCol = (r.vetor && r.vetor.tipo_coluna) || r.tipo_coluna || "vector";

    var base = r.base || {};
    var baseTotal = num(base.total_bytes) || num(r.base_total_bytes);
    var hnsw = num(hnswDosIndices(r.indices)) || num(r.hnsw_bytes);
    var vetorAtual = bytesVetor(dim, tipoCol);
    var charsPorChunk = trechosInt ? charsInt / trechosInt : 0;

    var medido = !!(baseTotal && hnsw);
    var hnswPorTrecho, restoPorTrecho;
    if (medido) {
      hnswPorTrecho = hnsw / trechos;
      // Tudo que não é HNSW, menos o vetor guardado: texto + fts + GIN + trigrama + overhead.
      // Nunca negativo: se o vetor comprimiu no TOAST mais do que o modelo prevê, o resto é 0 e o
      // total continua ancorado na medição.
      restoPorTrecho = Math.max(0, (baseTotal - hnsw) / trechos - vetorAtual);
    } else {
      hnswPorTrecho = vetorAtual * PADRAO.razao_hnsw_fallback;
      restoPorTrecho = charsPorChunk * PADRAO.razao_resto_fallback;
    }

    return {
      medido: medido,
      medido_em: r.medido_em || PADRAO.medido_em,
      trechos: trechos,
      trechosIntegral: trechosInt,
      normas: normas,
      chunksPorNorma: trechosInt / normas,
      charsPorChunk: charsPorChunk,
      dim: dim,
      tipoColuna: tipoCol,
      bytesVetorAtual: vetorAtual,
      hnswPorTrecho: hnswPorTrecho,
      restoPorTrecho: restoPorTrecho,
      baseTotalBytes: baseTotal || null,
      bancoBytes: num(r.banco_bytes) || num(r.bancoBytes) || null,
      pgvector: (r.vetor && r.vetor.pgvector) || null,
      halfvecDisponivel: !!(r.vetor && r.vetor.halfvec_disponivel)
    };
  }

  /** atttypmod do pgvector guarda a dimensão; em tabela vazia pode vir -1. */
  function normalizarDim(v) {
    var n = num(v);
    return (n && n > 0) ? n : 1024;
  }
  function hnswDosIndices(indices) {
    if (!indices || !indices.length) return 0;
    for (var i = 0; i < indices.length; i++) {
      if (indices[i] && indices[i].metodo === "hnsw") return num(indices[i].bytes);
    }
    return 0;
  }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  // ══ PROJEÇÃO ══════════════════════════════════════════════════════════════════════════════

  /**
   * Projeta a base para `normasAlvo` normas integrais num CENÁRIO de vetor (dimensão × tipo).
   *
   * O HNSW escala junto com o tamanho do vetor (ele guarda o vetor dentro do índice); as listas de
   * vizinhos não encolhem, então a regra de três erra para MAIS — o lado seguro de errar quando o
   * número vira fatura.
   */
  function projetar(opts) {
    var o = opts || {};
    var med = o.medidas || medidas(o.retrato);
    var normasAlvo = num(o.normasAlvo) || 3000;
    var dim = num(o.dim) || med.dim;
    var tipo = o.tipo || med.tipoColuna || "vector";
    var folgaRam = num(o.folgaRam) || FOLGA_RAM;

    var chunks = Math.round(normasAlvo * med.chunksPorNorma);
    var vetor = bytesVetor(dim, tipo);
    var escala = med.bytesVetorAtual ? (vetor / med.bytesVetorAtual) : 1;
    var hnswPorTrecho = med.hnswPorTrecho * escala;
    var porTrecho = vetor + hnswPorTrecho + med.restoPorTrecho;

    var baseBytes = chunks * porTrecho;
    var hnswBytes = chunks * hnswPorTrecho;
    var vetorBytes = chunks * vetor;
    // O resto do banco (SINAPI, projetos, usuários) continua onde está.
    var outroBanco = (med.bancoBytes && med.baseTotalBytes) ? Math.max(0, med.bancoBytes - med.baseTotalBytes) : 0;
    var discoBytes = baseBytes + outroBanco;

    var ramNecessariaGb = (hnswBytes * folgaRam) / GB;
    var compute = computePara(ramNecessariaGb);
    var discoGb = discoBytes / GB;
    var discoExtraGb = Math.max(0, discoGb - PRECOS.supabase.pro_disco_incluso_gb);

    var custoCompute = Math.max(0, compute.mensal - PRECOS.supabase.credito_compute_usd);
    var custoDisco = discoExtraGb * PRECOS.supabase.pro_disco_extra_usd_gb;
    var mensal = PRECOS.supabase.pro_mensal + custoCompute + custoDisco;

    return {
      cenario: rotulo(dim, tipo),
      dim: dim, tipo: tipo,
      chunks: chunks,
      bytesPorTrecho: porTrecho,
      vetorBytes: vetorBytes,
      hnswBytes: hnswBytes,
      baseBytes: baseBytes,
      discoBytes: discoBytes,
      discoGb: discoGb,
      discoExtraGb: discoExtraGb,
      ramNecessariaGb: ramNecessariaGb,
      compute: compute,
      // Até quantas normas este compute aguenta — o "fôlego" que a escolha de vetor compra.
      tetoNormas: normasNaRam(med, dim, tipo, compute.ram_gb, folgaRam),
      mensalUSD: mensal,
      detalheMensal: { plano: PRECOS.supabase.pro_mensal, compute: custoCompute, disco: custoDisco },
      cabeNoFree: discoBytes <= PRECOS.supabase.free_teto_bytes,
      embedding: custoEmbedding(chunks, med.charsPorChunk, o)
    };
  }

  /**
   * Quantas normas cabem numa dada RAM, neste cenário de vetor. É a pergunta que o painel responde
   * melhor que "quanto custa em 3.000": o custo é uma ESCADA, não uma reta — dentro do degrau, o
   * preço não muda; a alavanca do vetor não economiza centavos, ela ADIA o degrau. Sem este número
   * halfvec parece render US$ 5/mês (verdade em 3.000, e enganoso como conclusão).
   */
  function normasNaRam(med, dim, tipo, ramGb, folgaRam) {
    var vetor = bytesVetor(dim, tipo);
    var escala = med.bytesVetorAtual ? (vetor / med.bytesVetorAtual) : 1;
    var hnswPorTrecho = med.hnswPorTrecho * escala;
    var folga = num(folgaRam) || FOLGA_RAM;
    if (!hnswPorTrecho || !med.chunksPorNorma) return Infinity;
    return (ramGb * GB) / (folga * hnswPorTrecho) / med.chunksPorNorma;
  }

  /** O menor compute cuja RAM atende. Acima do maior, devolve o maior com `suficiente:false`. */
  function computePara(ramGb) {
    for (var i = 0; i < COMPUTE.length; i++) {
      if (COMPUTE[i].ram_gb >= ramGb) return Object.assign({ suficiente: true }, COMPUTE[i]);
    }
    return Object.assign({ suficiente: false }, COMPUTE[COMPUTE.length - 1]);
  }

  /**
   * Custo ÚNICO de embeddar o lote. É o número que mais desmente o §4 — e o que torna a escolha de
   * dimensão REVERSÍVEL: se o recall cair, re-embeddar custa outra vez o mesmo (café), não um
   * projeto. Por isso a recomendação pode ser agressiva sem ser irresponsável.
   */
  function custoEmbedding(chunks, charsPorChunk, opts) {
    var o = opts || {};
    var modelo = o.modelo || "voyage-3.5";
    var preco = PRECOS.voyage[modelo];
    if (preco == null) preco = PRECOS.voyage["voyage-3.5"];
    var charsPorToken = num(o.charsPorToken) || CHARS_POR_TOKEN;
    var tokens = (chunks * charsPorChunk) / charsPorToken;
    var cheio = (tokens / 1e6) * preco;
    return {
      modelo: modelo,
      tokens: tokens,
      usd: cheio,
      usdBatch: cheio * (1 - PRECOS.voyage_batch_desconto)
    };
  }

  function rotulo(dim, tipo) {
    return (tipo === "halfvec" ? "halfvec" : "vector") + "(" + dim + ")" +
           (tipo === "halfvec" ? " · 2 B/dim" : " · 4 B/dim");
  }

  // ══ COMPARAÇÃO DE CENÁRIOS ════════════════════════════════════════════════════════════════
  // Os quatro que valem a pena discutir. int8/binário ficaram FORA de propósito: o pgvector guarda
  // int8 dentro de halfvec (2 bytes do mesmo jeito — não economiza), e `bit` (binário) muda a
  // métrica de distância e exigiria repensar o híbrido (0045). Nenhum dos dois é troca de uma
  // linha; halfvec e dimensão são.
  // As notas descrevem o CENÁRIO, nunca o estado — quem está em uso vem da medição (`atual`). A
  // primeira versão trazia "hoje" fixo na linha do vector(1024); depois da 0062 virou mentira.
  var CENARIOS = [
    { dim: 1024, tipo: "vector",  nota: "float32 — o padrão do pgvector" },
    { dim: 1024, tipo: "halfvec", nota: "metade do vetor, mesma dimensão" },
    { dim: 512,  tipo: "halfvec", nota: "Matryoshka 512 + halfvec" },
    { dim: 256,  tipo: "halfvec", nota: "agressivo — só com recall medido (f34)" }
  ];

  /**
   * A tabela do painel. A linha de base é O CENÁRIO EM USO — não a primeira da lista.
   *
   * Isso deixou de ser detalhe quando a 0062 converteu a coluna para halfvec: com a base fixa no
   * índice 0, o painel passou a marcar `vector(1024)` como "em uso" e a calcular economia contra um
   * cenário que não existe mais. Quem lê acredita no selo. `atual` sai da medição.
   */
  function comparar(opts) {
    var o = opts || {};
    var med = o.medidas || medidas(o.retrato);
    var linhas = CENARIOS.map(function (c) {
      var p = projetar(Object.assign({}, o, { medidas: med, dim: c.dim, tipo: c.tipo }));
      p.nota = c.nota;
      p.atual = (c.tipo === med.tipoColuna && c.dim === med.dim);
      return p;
    });
    // Sem correspondência exata (ex.: dimensão fora da lista), a 1ª serve de referência — mas nenhuma
    // linha fica marcada como "em uso", que é melhor que marcar a errada.
    var base = linhas.filter(function (l) { return l.atual; })[0] || linhas[0];
    linhas.forEach(function (l) {
      l.economiaMensal = base.mensalUSD - l.mensalUSD;
      l.fatorDisco = base.baseBytes ? (base.baseBytes / l.baseBytes) : 1;
    });
    return { medidas: med, linhas: linhas, base: base };
  }

  // ══ FORMATAÇÃO (pt-BR) ════════════════════════════════════════════════════════════════════
  function fmtBytes(b) {
    if (b == null || !isFinite(b)) return "—";
    var u = ["B", "KB", "MB", "GB", "TB"], i = 0, v = Math.abs(b);
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    var casas = v < 10 && i > 1 ? 2 : (v < 100 && i > 1 ? 1 : 0);
    return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }) + " " + u[i];
  }
  function fmtUSD(v) {
    if (v == null || !isFinite(v)) return "—";
    return "US$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtInt(v) {
    if (v == null || !isFinite(v)) return "—";
    return Math.round(v).toLocaleString("pt-BR");
  }
  /** Decimal em pt-BR (vírgula). O toFixed() do JS devolve ponto e vaza para a tela. */
  function fmtDec(v, casas) {
    if (v == null || !isFinite(v)) return "—";
    var c = (casas == null) ? 1 : casas;
    return v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
  }

  var API = {
    PRECOS: PRECOS, COMPUTE: COMPUTE, PADRAO: PADRAO, CENARIOS: CENARIOS,
    CHARS_POR_TOKEN: CHARS_POR_TOKEN, FOLGA_RAM: FOLGA_RAM,
    bytesVetor: bytesVetor, medidas: medidas, projetar: projetar, comparar: comparar,
    computePara: computePara, custoEmbedding: custoEmbedding, normasNaRam: normasNaRam,
    fmtBytes: fmtBytes, fmtUSD: fmtUSD, fmtInt: fmtInt, fmtDec: fmtDec
  };
  root.ESCALA = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
