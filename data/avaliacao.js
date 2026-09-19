// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// e3 — Dados de referência do módulo de Avaliação de imóveis (NBR 14653).
// Conteúdo ORIENTATIVO (descrição de procedimento), sem reproduzir o texto integral da norma.

// Fatores de homogeneização padrão do método comparativo (tratamento por fatores).
// Cada fator converte o dado de mercado à condição do imóvel avaliando (referência = 1,000).
// A NBR 14653-2 limita cada fator ao intervalo [0,50; 2,00].
const AVAL_FATORES = [
  { id: "oferta", label: "Oferta", hint: "Elasticidade de preço (oferta × transação). Usual ≈ 0,90." },
  { id: "local", label: "Localização", hint: "Diferença de localização entre o dado e o avaliando." },
  { id: "area", label: "Área", hint: "Ajuste por diferença de área/aproveitamento." },
  { id: "padrao", label: "Padrão/Conservação", hint: "Padrão construtivo e estado de conservação." }
];

// Limites do fator individual (NBR 14653-2) — fora disso, sinaliza alerta.
const AVAL_FATOR_MIN = 0.50;
const AVAL_FATOR_MAX = 2.00;

// Campo de arbítrio: a norma admite arbitrar o valor final dentro de ±15% do valor central
// saneado, desde que justificado. Amostras que divergem mais de 30% da média são candidatas
// a saneamento (descarte), à luz do julgamento do avaliador.
const AVAL_ARBITRIO = 0.15;
const AVAL_SANEAMENTO = 0.30;

// Grau de fundamentação no tratamento por FATORES (NBR 14653-2, simplificado) — chave principal:
// quantidade de dados de mercado efetivamente utilizados. Orientativo.
const AVAL_GRAU_FATORES = [
  { grau: "III", minDados: 12, desc: "Grau III — máximo (≥ 12 dados utilizados)" },
  { grau: "II", minDados: 5, desc: "Grau II (≥ 5 dados utilizados)" },
  { grau: "I", minDados: 3, desc: "Grau I — mínimo (≥ 3 dados utilizados)" }
];

// Grau de fundamentação no tratamento por REGRESSÃO (NBR 14653-2, simplificado) — chave:
// nº de dados em função do nº de variáveis independentes (k). Orientativo.
const AVAL_GRAU_REGRESSAO = [
  { grau: "III", fator: 6, desc: "Grau III (n ≥ 6·(k+1) dados)" },
  { grau: "II", fator: 4, desc: "Grau II (n ≥ 4·(k+1) dados)" },
  { grau: "I", fator: 3, desc: "Grau I (n ≥ 3·(k+1) dados)" }
];

// Grau de precisão pela dispersão (coeficiente de variação dos valores homogeneizados). Orientativo.
const AVAL_PRECISAO_CV = [
  { max: 0.30, grau: "III", desc: "Grau III — CV ≤ 30%" },
  { max: 0.40, grau: "II", desc: "Grau II — CV ≤ 40%" },
  { max: 0.50, grau: "I", desc: "Grau I — CV ≤ 50%" }
];

// Pontos-chave da NBR 14653 (orientativo, para o painel "Como funciona").
const AVAL_NBR_PONTOS = [
  "NBR 14653-1: procedimentos gerais da avaliação de bens (identificação do objetivo, vistoria, coleta e tratamento de dados, especificação e laudo).",
  "NBR 14653-2: imóveis urbanos. Método preferencial = comparativo direto de dados de mercado (compara o avaliando a dados semelhantes efetivamente transacionados/ofertados).",
  "Tratamento por fatores: homogeneíza cada dado por fatores (oferta, localização, área, padrão…) trazendo-o à condição do avaliando; analisa-se a média saneada.",
  "Tratamento por regressão (inferência estatística): modela o valor em função das características; exige testes de significância e atende a graus de fundamentação mais altos.",
  "Saneamento: descartam-se outliers; cada fator deve ficar entre 0,50 e 2,00; o campo de arbítrio admite ±15% sobre o valor central, com justificativa.",
  "Especificação: grau de fundamentação e grau de precisão decorrem da quantidade/qualidade dos dados e da dispersão (CV).",
  "O laudo deve conter identificação, metodologia, dados, tratamento, resultado e ressalvas — e é assinado pelo responsável técnico (engenheiro/arquiteto com ART/RRT)."
];

if (typeof window !== "undefined") {
  window.AVAL_FATORES = AVAL_FATORES;
  window.AVAL_NBR_PONTOS = AVAL_NBR_PONTOS;
}
