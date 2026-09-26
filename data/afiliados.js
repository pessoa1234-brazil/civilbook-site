// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// d11 — Catálogo curado de recomendações de afiliado (ferramentas, EPI, livros, cursos).
// NÃO é conteúdo premium: são categorias genéricas/evergreen úteis a quem está em obra. O que
// monetiza é a TAG de afiliado (config.js), injetada no link em runtime por js/afiliados.js.
//
// Itens "amazon" guardam só um TERMO de busca (não um ASIN fixo, que apodrece): o link vira uma
// busca na Amazon com a tag — a atribuição de comissão vale igual. Itens "hotmart"/"link" guardam
// uma URL (o hotlink do produtor); enquanto vazia, o item é omitido (ver AFIL.bloco).
//
// Estrutura: AFILIADOS[contexto] = [ {titulo, desc, tipo, termo?, url?, icone} ].
// Contextos usados hoje: "geral" (home) e "ferramentas" (Compras). Os demais ficam prontos p/
// reaproveitar em outras telas (materiais, normas de EPI, calculadoras…).

const AFILIADOS = {
  // Home — mix equilibrado (1 medição, 1 EPI, 1 referência), recomendação ampla.
  geral: [
    { titulo: "Trena a laser", desc: "Medição rápida e precisa em vistorias e levantamentos.", tipo: "amazon", termo: "trena a laser medidor de distancia", icone: "ti-ruler-measure" },
    { titulo: "Kit de EPI básico", desc: "Capacete, óculos, luvas e protetor auricular para visita à obra.", tipo: "amazon", termo: "kit epi construcao civil capacete oculos luva", icone: "ti-shield-half" },
    { titulo: "Coleção de normas e manuais técnicos", desc: "Livros de referência de patologias, materiais e execução.", tipo: "amazon", termo: "livro patologia das construcoes", icone: "ti-book-2" }
  ],
  // Compras — ferramentas e instrumentos de medição (alta intenção de compra ali).
  ferramentas: [
    { titulo: "Trena a laser", desc: "Conferência de medidas e área no recebimento de serviço.", tipo: "amazon", termo: "trena a laser medidor de distancia", icone: "ti-ruler-measure" },
    { titulo: "Nível a laser", desc: "Prumo, nível e esquadro para alvenaria, piso e revestimento.", tipo: "amazon", termo: "nivel a laser autonivelante", icone: "ti-line-dashed" },
    { titulo: "Termo-higrômetro / medidor de umidade", desc: "Aferir umidade antes de pintar, revestir ou impermeabilizar.", tipo: "amazon", termo: "medidor de umidade parede madeira", icone: "ti-droplet" },
    { titulo: "Paquímetro", desc: "Conferir bitola de aço, espessura de placa e diâmetro de tubo.", tipo: "amazon", termo: "paquimetro digital 150mm", icone: "ti-dimensions" }
  ],
  // EPI — segurança individual (reutilizável em normas/ações técnicas).
  epi: [
    { titulo: "Capacete com jugular", desc: "Proteção da cabeça conforme NR-6 / NR-18.", tipo: "amazon", termo: "capacete de seguranca com jugular", icone: "ti-helmet" },
    { titulo: "Óculos de proteção", desc: "Contra partículas em corte, furação e demolição.", tipo: "amazon", termo: "oculos de protecao seguranca", icone: "ti-eyeglass" },
    { titulo: "Luvas de proteção", desc: "Conforme o risco (corte, química, abrasão).", tipo: "amazon", termo: "luva de seguranca construcao", icone: "ti-hand-stop" }
  ],
  // Livros — referência técnica (reutilizável em laudos/materiais).
  livros: [
    { titulo: "Patologia das construções", desc: "Diagnóstico de manifestações patológicas e suas causas.", tipo: "amazon", termo: "livro patologia das construcoes", icone: "ti-book-2" },
    { titulo: "Materiais de construção civil", desc: "Propriedades, ensaios e aplicação dos materiais.", tipo: "amazon", termo: "livro materiais de construcao civil", icone: "ti-book" }
  ],
  // Cursos (Hotmart/EAD) — exigem o hotlink do produtor. Sem URL, o item é omitido (placeholder).
  cursos: [
    { titulo: "Curso de orçamento e planejamento de obras", desc: "Curva ABC, composições e cronograma físico-financeiro.", tipo: "hotmart", url: "", icone: "ti-chart-bar" },
    { titulo: "Curso de Revit / BIM", desc: "Modelagem e compatibilização de projetos.", tipo: "hotmart", url: "", icone: "ti-3d-cube-sphere" }
  ]
};

if (typeof window !== "undefined") window.AFILIADOS = AFILIADOS;
