// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// CUB/m² — Custo Unitário Básico de Construção (ABNT NBR 12.721:2006).
// Índice mensal de custo por metro quadrado de obra, calculado por cada Sinduscon e
// divulgado no portal cub.org.br (CBIC). É a referência macro para estimar o custo de
// construção e para reajuste de contratos/incorporações (Lei Federal 4.591/1964).
//
// O catálogo de projetos-padrão (CUB_PROJETOS) é fixo (definido na norma) e UF-independente;
// só os VALORES (R$/m²) mudam por estado/competência. Base estática abaixo = Paraná
// (Sinduscon-Noroeste-PR), competência Março/2026 — usada como fallback offline; quando o
// backend (tabela cub_valores) está populado, js/cub.js sobrepõe os valores da UF escolhida.
//
// Atualização: os valores são publicados mensalmente. Para alimentar o banco com novos meses/UFs,
// inserir em public.cub_valores + marcar a competência ativa (ver supabase/migrations/0012_cub.sql).

const CUB_UF_BASE = "PR";                 // UF da base estática
const CUB_COMPETENCIA = "2026-03";        // competência da base estática (AAAA-MM, ordenável)
const CUB_SINDUSCON = "Sinduscon-Noroeste-PR";
const CUB_REFERENCIA = "Fonte: CUB/m² Março/2026, Paraná (Sinduscon-Noroeste-PR), conforme ABNT NBR 12.721:2006 — confira a competência/UF do seu projeto";

// Como funciona o CUB (resumo factual, em texto próprio).
const CUB_PROCESSO = [
  "O CUB/m² (Custo Unitário Básico) é o custo por metro quadrado de um projeto-padrão de edificação, calculado mensalmente conforme a ABNT NBR 12.721:2006.",
  "Serve para estimar rapidamente o custo de uma obra, reajustar contratos e balizar incorporações imobiliárias (Lei Federal 4.591/1964).",
  "Cada projeto-padrão (R-1, R-8, R-16, PP-4, CAL-8, CSL, GI…) representa um tipo de edificação; o padrão de acabamento é baixo, normal ou alto.",
  "O valor muda por estado: cada Sinduscon coleta os preços locais de materiais, mão de obra e despesas administrativas (no Paraná e em Minas Gerais há mais de um Sinduscon calculando o CUB).",
  "É uma estimativa PARCIAL: o CUB não inclui fundações especiais, elevadores, projetos, ligações, impostos cartoriais nem a remuneração do construtor/incorporador (ver lista completa abaixo).",
  "Para orçamento detalhado por serviço, use a SINAPI (aba ao lado); o CUB é o indicador macro de custo por m²."
];

// O que o CUB NÃO considera (conforme a publicação do Sinduscon) — deve ser orçado à parte.
const CUB_EXCLUSOES = [
  "Fundações especiais, contenções, tirantes e rebaixamento de lençol freático",
  "Elevadores",
  "Equipamentos e instalações: ar-condicionado, calefação, ventilação/exaustão, bombas de recalque, aquecedores, incineração",
  "Playground, obras e serviços complementares",
  "Urbanização, paisagismo e recreação (piscinas, quadras, campos de esporte)",
  "Instalação e regularização do condomínio",
  "Impostos, taxas e emolumentos cartoriais",
  "Projetos: arquitetônico, estrutural, de instalações e projetos especiais",
  "Remuneração do construtor e do incorporador (e o BDI/lucro do orçamento)"
];

// Grupos para exibição.
const CUB_GRUPOS = ["Residencial", "Comercial", "Outros padrões"];

// Catálogo de projetos-padrão da NBR 12.721 (descrições factuais).
// grupo: chave de agrupamento na tela; unico=true → padrão único (sem baixo/normal/alto).
const CUB_PROJETOS = [
  { codigo: "R-1",    grupo: "Residencial",     nome: "R-1 — Residência unifamiliar",       desc: "Casa unifamiliar, 1 pavimento." },
  { codigo: "PP-4",   grupo: "Residencial",     nome: "PP-4 — Prédio popular",              desc: "Edifício multifamiliar popular, até 4 pavimentos." },
  { codigo: "R-8",    grupo: "Residencial",     nome: "R-8 — Multifamiliar",                desc: "Edifício residencial, 8 pavimentos." },
  { codigo: "R-16",   grupo: "Residencial",     nome: "R-16 — Multifamiliar",               desc: "Edifício residencial, 16 pavimentos." },
  { codigo: "PIS",    grupo: "Residencial",     nome: "PIS — Projeto de interesse social",  desc: "Habitação de interesse social, 1 pavimento." },
  { codigo: "CAL-8",  grupo: "Comercial",       nome: "CAL-8 — Comercial andares livres",   desc: "Edifício comercial com andares livres, 8 pavimentos." },
  { codigo: "CSL-8",  grupo: "Comercial",       nome: "CSL-8 — Comercial salas e lojas",    desc: "Edifício comercial de salas e lojas, 8 pavimentos." },
  { codigo: "CSL-16", grupo: "Comercial",       nome: "CSL-16 — Comercial salas e lojas",   desc: "Edifício comercial de salas e lojas, 16 pavimentos." },
  { codigo: "RP1Q",   grupo: "Outros padrões",  nome: "RP1Q — Residência popular",          desc: "Residência popular de 1 quarto (padrão único).", unico: true },
  { codigo: "GI",     grupo: "Outros padrões",  nome: "GI — Galpão industrial",             desc: "Galpão industrial (padrão único).", unico: true }
];

// Padrões de acabamento (ordem de exibição das colunas).
const CUB_PADROES = ["baixo", "normal", "alto"];
const CUB_PADRAO_LABEL = { baixo: "Baixo", normal: "Normal", alto: "Alto", "único": "Único" };

// Valores R$/m² da base estática (PR, Março/2026). [codigo, padrao, valor]
// Padrões ausentes (ex.: PP-4 não tem "alto"; R-16 não tem "baixo") simplesmente não existem.
const CUB_RAW = [
  ["R-1",    "baixo", 2665.42], ["R-1",    "normal", 3086.60], ["R-1",    "alto", 3883.20],
  ["PP-4",   "baixo", 2541.70], ["PP-4",   "normal", 2935.33],
  ["R-8",    "baixo", 2420.45], ["R-8",    "normal", 2590.39], ["R-8",    "alto", 3144.28],
  ["R-16",   "normal", 2525.54], ["R-16",  "alto", 3250.74],
  ["PIS",    "baixo", 1919.07],
  ["CAL-8",  "normal", 3002.37], ["CAL-8",  "alto", 3262.92],
  ["CSL-8",  "normal", 2541.79], ["CSL-8",  "alto", 2862.43],
  ["CSL-16", "normal", 3402.52], ["CSL-16", "alto", 3804.19],
  ["RP1Q",   "único", 2734.14],
  ["GI",     "único", 1409.85]
];

const CUB = CUB_RAW.map(function (r) { return { projeto: r[0], padrao: r[1], valor: r[2] }; });

if (typeof window !== "undefined") {
  window.CUB = CUB;
  window.CUB_PROJETOS = CUB_PROJETOS;
}
