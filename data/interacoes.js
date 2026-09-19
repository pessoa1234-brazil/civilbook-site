// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Base de interações entre materiais de construção (inspirada nas bases de
// interação medicamentosa do Whitebook). Cada par documentado traz o mecanismo,
// a recomendação técnica e as referências. Quando o par não consta na base,
// o módulo informa que não há interação relevante documentada na literatura.
//
// nivel: "grave" (incompatível/contraindicado) | "moderada" (requer cuidado)
//        | "leve" (atenção/ressalva) | "compativel" (uso consagrado)
// Conteúdo autoral, em palavras próprias, com citação das fontes (sem reprodução
// de texto de norma). Sempre confirmar com a ficha técnica do fabricante e ensaios.

const MATERIAIS_INTERACAO = [
  { id: "concreto",        nome: "Concreto / argamassa de cimento" },
  { id: "aco_armadura",    nome: "Aço de armadura (CA-50/CA-60)" },
  { id: "aco_galv",        nome: "Aço galvanizado (zinco)" },
  { id: "aco_inox",        nome: "Aço inoxidável" },
  { id: "aluminio",        nome: "Alumínio" },
  { id: "cobre",           nome: "Cobre" },
  { id: "gesso",           nome: "Gesso" },
  { id: "cal",             nome: "Cal hidratada" },
  { id: "madeira",         nome: "Madeira" },
  { id: "eps",             nome: "EPS / poliestireno (XPS)" },
  { id: "asfalto",         nome: "Asfalto / manta betuminosa" },
  { id: "tinta_alquidica", nome: "Tinta alquídica (esmalte/óleo)" },
  { id: "cloretos",        nome: "Cloretos (CaCl₂, água do mar, maresia)" },
  { id: "sulfatos",        nome: "Sulfatos (solo/água agressiva, gesso)" },
  { id: "agregado_reativo", nome: "Agregado reativo (sílica amorfa)" },
  { id: "materia_organica", nome: "Açúcar / matéria orgânica" },
  { id: "acido",           nome: "Ácidos (industrial/esgoto)" },
  { id: "oleo",            nome: "Óleo / graxa / desmoldante" },
  { id: "pvc",             nome: "PVC (eletroduto/tubo)" },
  { id: "epoxi",           nome: "Sistema epóxi (revestimento/cola)" },
  { id: "porcelanato",     nome: "Porcelanato (placa de baixa absorção)" },
  { id: "arg_colante",     nome: "Argamassa colante (AC)" }
];

const INTERACOES = [
  {
    a: "aluminio", b: "concreto", nivel: "grave",
    titulo: "Alumínio embutido em concreto/argamassa",
    mecanismo: "O concreto fresco é fortemente alcalino (pH ≈ 12,5–13) por causa do hidróxido de cálcio liberado na hidratação. O alumínio é um metal anfótero e reage nesse meio, corroendo e liberando hidrogênio gasoso. A reação é expansiva e pode fissurar o cobrimento; na presença de cloretos ou em contato com o aço da armadura (par galvânico), o ataque acelera.",
    recomendacao: "Evitar eletrodutos, perfis, esquadrias e fôrmas de alumínio em contato direto com concreto/argamassa. Quando inevitável, isolar com pintura betuminosa ou epóxi. Não usar peças de alumínio como espaçador ou em contato com a armadura.",
    refs: ["ABNT NBR 6118 — durabilidade de estruturas de concreto", "Mehta & Monteiro, Concreto: Microestrutura, Propriedades e Materiais (IBRACON)", "ACI 318 — boas práticas de durabilidade"]
  },
  {
    a: "gesso", b: "concreto", nivel: "grave",
    titulo: "Gesso em contato com cimento Portland",
    mecanismo: "O gesso é sulfato de cálcio. Em presença de umidade, os íons sulfato reagem com os aluminatos do cimento (C₃A) formando etringita expansiva (ataque interno por sulfatos), com fissuração, perda de aderência e desagregação. O gesso também é higroscópico: retém umidade na interface e favorece a corrosão de armaduras e peças metálicas embutidas.",
    recomendacao: "Não aplicar gesso sobre/encostado em elementos de cimento em áreas úmidas, nem usá-lo como argamassa de assentamento estrutural. Manter o gesso em ambientes internos secos. Onde houver contato, prever barreira e impermeabilização.",
    refs: ["ABNT NBR 12655 — concreto: preparo, controle e recebimento (ataque por sulfatos)", "Neville, Propriedades do Concreto", "ABNT NBR 13207 — gesso para construção civil"]
  },
  {
    a: "cloretos", b: "aco_armadura", nivel: "grave",
    titulo: "Cloretos e a armadura do concreto",
    mecanismo: "Os íons cloreto despassivam a camada protetora do aço dentro do concreto, mesmo com pH elevado, iniciando corrosão por pite. A ferrugem é expansiva (até ~6× o volume), fissura e destaca o cobrimento. Aceleradores à base de cloreto de cálcio (CaCl₂) e agregados/águas com cloreto são as fontes mais comuns.",
    recomendacao: "Proibido o uso de aditivos com cloreto em concreto armado e protendido. Respeitar os limites de íons cloreto da NBR 12655 e a classe de agressividade ambiental. Em ambiente marinho, aumentar cobrimento, reduzir relação a/c e usar adições (sílica/pozolana).",
    refs: ["ABNT NBR 12655 — limites de cloretos e classes de agressividade", "ABNT NBR 6118 — cobrimento e durabilidade", "Helene, Manual para Reparo, Reforço e Proteção de Estruturas de Concreto"]
  },
  {
    a: "sulfatos", b: "concreto", nivel: "grave",
    titulo: "Sulfatos sobre concreto de cimento comum",
    mecanismo: "Sulfatos do solo, de águas agressivas ou de esgoto reagem com os produtos de hidratação formando gesso secundário e etringita expansiva, causando fissuras, perda de resistência e lascamento progressivo (ataque externo por sulfatos).",
    recomendacao: "Em ambientes sulfatados, especificar cimento resistente a sulfatos (RS), reduzir a relação água/cimento e aumentar o consumo de cimento e o cobrimento. Avaliar a agressividade conforme NBR 12655.",
    refs: ["ABNT NBR 5737 — cimentos Portland resistentes a sulfatos", "ABNT NBR 12655", "Mehta & Monteiro, Concreto (IBRACON)"]
  },
  {
    a: "agregado_reativo", b: "concreto", nivel: "grave",
    titulo: "Reação álcali-agregado (RAA)",
    mecanismo: "Agregados com sílica reativa reagem com os álcalis do cimento formando um gel higroscópico que expande ao absorver água, gerando fissuras em mapa (\"craquelê\"), exsudação de gel e perda de monolitismo. É uma patologia lenta e de difícil recuperação.",
    recomendacao: "Caracterizar a reatividade potencial do agregado (NBR 15577-1 a -7). Quando reativo, usar cimento com baixo teor de álcalis e/ou adições pozolânicas (sílica ativa, metacaulim, cinza) e controlar o teor total de álcalis do concreto.",
    refs: ["ABNT NBR 15577 (partes 1 a 7) — reatividade álcali-agregado", "IBRACON — diretrizes sobre RAA", "Hasparyk, estudos sobre RAA em concreto"]
  },
  {
    a: "cobre", b: "aco_galv", nivel: "grave",
    titulo: "Cobre a montante de aço galvanizado (instalações)",
    mecanismo: "Em par galvânico com eletrólito (água), o zinco/aço é o ânodo e corrói preferencialmente em relação ao cobre. Água que passa por tubo de cobre e depois por peça galvanizada carrega íons de cobre que se depositam no zinco e aceleram sua corrosão — falha precoce em conexões e tubos galvanizados.",
    recomendacao: "Não instalar aço galvanizado a jusante do cobre. Separar metais dissimilares com conexões dielétricas/isolantes. Em redes hidráulicas, padronizar o material ou usar PEX/PPR para evitar o par galvânico.",
    refs: ["ABNT NBR 5626 — sistemas prediais de água fria e quente", "Gentil, Corrosão", "Série galvânica — boas práticas de instalações"]
  },
  {
    a: "aluminio", b: "cobre", nivel: "moderada",
    titulo: "Alumínio e cobre (conexões elétricas e hidráulicas)",
    mecanismo: "Par galvânico com diferença de potencial relevante: o alumínio é anódico e corrói no contato com cobre em presença de umidade. Em conexões elétricas, a corrosão e a fluência do alumínio aumentam a resistência de contato, gerando aquecimento e risco de incêndio.",
    recomendacao: "Usar conectores bimetálicos certificados e pastas antioxidantes em emendas Al-Cu; nunca emendar alumínio e cobre diretamente. Em instalações, seguir os terminais/aperto previstos pela NBR 5410.",
    refs: ["ABNT NBR 5410 — instalações elétricas de baixa tensão", "IEC/boas práticas de conexões bimetálicas"]
  },
  {
    a: "aluminio", b: "aco_armadura", nivel: "moderada",
    titulo: "Alumínio em contato com aço (par galvânico)",
    mecanismo: "Em presença de umidade, o alumínio (anódico) corrói no contato com o aço (catódico). O processo é agravado em ambientes salinos e quando há concreto alcalino envolvido.",
    recomendacao: "Isolar os metais (juntas, arruelas e buchas plásticas, pintura). Preferir fixadores de aço inoxidável ou galvanizados compatíveis e evitar furos/contatos sem proteção.",
    refs: ["Série galvânica dos metais", "ABNT NBR 8800 — projeto de estruturas de aço (ligações)"]
  },
  {
    a: "madeira", b: "aco_armadura", nivel: "moderada",
    titulo: "Madeira úmida e fixadores de aço",
    mecanismo: "Os taninos e ácidos orgânicos de algumas madeiras (e a umidade retida) corroem fixadores de aço comum e provocam manchas escuras (reação ferro-tanino) na madeira ao redor do prego/parafuso.",
    recomendacao: "Usar fixadores galvanizados a fogo ou de aço inoxidável em madeira exposta/úmida e em espécies ricas em tanino. Evitar aço comum em decks, telhados e estruturas expostas.",
    refs: ["ABNT NBR 7190 — projeto de estruturas de madeira", "Forest Products Laboratory — Wood Handbook"]
  },
  {
    a: "asfalto", b: "eps", nivel: "moderada",
    titulo: "Asfalto/solventes sobre EPS ou XPS",
    mecanismo: "Solventes e óleos presentes em mantas/primers asfálticos a frio e em colas de base solvente dissolvem o poliestireno (EPS/XPS), que encolhe e perde a função de isolamento/proteção.",
    recomendacao: "Usar produtos asfálticos compatíveis (base água) ou interpor camada separadora. Conferir a compatibilidade química na ficha técnica antes de colar isolante sobre impermeabilização asfáltica.",
    refs: ["ABNT NBR 9575 — impermeabilização: seleção e projeto", "Fichas técnicas de compatibilidade dos fabricantes"]
  },
  {
    a: "tinta_alquidica", b: "concreto", nivel: "moderada",
    titulo: "Tinta alquídica (esmalte/óleo) sobre reboco novo",
    mecanismo: "O substrato cimentício novo é alcalino e ainda libera umidade. A alcalinidade saponifica a resina alquídica (esmalte sintético/óleo), causando descascamento, amarelecimento e perda de aderência.",
    recomendacao: "Aguardar a cura/secagem do reboco (orientativo ~28 dias), aplicar selador/fundo preparador resistente a álcali e preferir tintas acrílicas em superfícies cimentícias. Medir umidade antes de pintar.",
    refs: ["ABNT NBR 13245 — tintas para construção civil (execução de pintura)", "Manuais técnicos de fabricantes de tintas"]
  },
  {
    a: "materia_organica", b: "concreto", nivel: "moderada",
    titulo: "Açúcar / matéria orgânica no concreto",
    mecanismo: "Açúcares e matéria orgânica são retardadores potentes: em pequenas quantidades retardam a pega; em excesso podem inibir o endurecimento. Agregados contaminados por matéria orgânica reduzem a resistência.",
    recomendacao: "Não permitir contato de concreto fresco com açúcar/resíduos orgânicos. Controlar a qualidade dos agregados (impurezas orgânicas) conforme NBR 7211. Em caso de contaminação, ensaiar antes de liberar.",
    refs: ["ABNT NBR 7211 — agregados para concreto (impurezas orgânicas)", "Neville, Propriedades do Concreto"]
  },
  {
    a: "aco_galv", b: "concreto", nivel: "leve",
    titulo: "Aço galvanizado embutido em concreto",
    mecanismo: "No concreto fresco e alcalino, o zinco reage liberando hidrogênio e pode perder parte da camada nos primeiros dias; em seguida tende a passivar. O efeito é pequeno, mas a liberação de gás pode prejudicar a aderência local logo após a concretagem.",
    recomendacao: "Aceitável na maioria dos casos; em concreto, preferir galvanização cromatizada ou tratada. Evitar o contato direto galvanizado–armadura de aço comum para não criar par galvânico no cobrimento.",
    refs: ["ABNT NBR 6118 — durabilidade", "Estudos sobre zinco em meio cimentício (Helene)"]
  },
  {
    a: "aco_inox", b: "concreto", nivel: "compativel",
    titulo: "Aço inoxidável em concreto (uso favorável)",
    mecanismo: "O aço inoxidável mantém a passivação mesmo com presença de cloretos e carbonatação avançada, oferecendo desempenho muito superior ao aço comum em ambientes agressivos.",
    recomendacao: "Indicado como armadura ou conector em zonas críticas (marinhas, respingo, peças esbeltas com baixo cobrimento) e em reforços de durabilidade. Custo maior justificado pela vida útil.",
    refs: ["ABNT NBR 6118 — durabilidade", "fib Bulletin — stainless steel reinforcement", "Helene, durabilidade de estruturas"]
  },
  {
    a: "cal", b: "concreto", nivel: "compativel",
    titulo: "Cal e cimento em argamassas mistas",
    mecanismo: "A cal hidratada melhora a trabalhabilidade, a retenção de água e a capacidade de acomodar pequenas deformações das argamassas de cimento, reduzindo fissuração de retração no revestimento.",
    recomendacao: "Uso consagrado em argamassas mistas cimento-cal-areia, respeitando o traço para cada função (assentamento/emboço/reboco). Não substitui o cimento em funções estruturais.",
    refs: ["ABNT NBR 13281 — argamassas para assentamento e revestimento", "ABNT NBR 7200 — execução de revestimento de argamassa"]
  },
  {
    a: "acido", b: "concreto", nivel: "grave",
    titulo: "Ácidos sobre concreto de cimento Portland",
    mecanismo: "O concreto é alcalino e não resiste a ácidos: eles dissolvem o hidróxido de cálcio e atacam os silicatos da pasta, causando perda de massa, exposição do agregado e da armadura. Comum em pisos industriais, laticínios, indústrias químicas e em esgoto (ácido sulfúrico biogênico).",
    recomendacao: "Proteger o concreto com revestimentos resistentes (epóxi, PRFV, cerâmica antiácida) ou usar concretos especiais. Em redes de esgoto, prever revestimento resistente e ventilação. Avaliar a agressividade do meio antes de especificar.",
    refs: ["ABNT NBR 12655 — classes de agressividade ambiental", "Mehta & Monteiro, Concreto (ataque químico)", "Helene, durabilidade de estruturas"]
  },
  {
    a: "cloretos", b: "aco_galv", nivel: "moderada",
    titulo: "Cloretos sobre aço galvanizado",
    mecanismo: "Em presença de umidade, os cloretos aceleram a corrosão do zinco da galvanização e, depois de consumida a camada, do aço-base, formando produtos volumosos. O efeito é mais severo em ambiente marinho e em par galvânico com metais mais nobres.",
    recomendacao: "Evitar aço galvanizado exposto a cloretos/maresia sem proteção adicional (pintura, sistema dúplex). Em ambiente marinho, preferir aço inoxidável ou alumínio anodizado conforme a aplicação.",
    refs: ["Gentil, Corrosão", "ISO 9223 — corrosividade atmosférica", "Boas práticas em ambiente marinho"]
  },
  {
    a: "oleo", b: "concreto", nivel: "moderada",
    titulo: "Óleo, graxa ou excesso de desmoldante no concreto",
    mecanismo: "Óleos, graxas e o excesso de desmoldante na superfície criam uma barreira que impede a aderência de argamassas, colas e revestimentos, além de mancharem a peça. Em concreto fresco, a contaminação por óleo prejudica a hidratação superficial.",
    recomendacao: "Remover óleo/desmoldante antes de revestir (lixamento, jateamento ou desengraxante). Dosar corretamente o desmoldante nas fôrmas e não estocar concreto fresco em contato com óleos.",
    refs: ["ABNT NBR 14931:2023 — fôrmas e desmoldantes", "ABNT NBR 13749 — revestimento de argamassa (preparo da base)"]
  },
  {
    a: "porcelanato", b: "arg_colante", nivel: "moderada",
    titulo: "Porcelanato com argamassa colante inadequada",
    mecanismo: "O porcelanato tem absorção de água muito baixa, então a ancoragem mecânica por argamassa colante comum (AC-I) é insuficiente e leva a descolamento (\"estufamento\"). Peças grandes e áreas externas exigem maior poder de aderência e dupla colagem.",
    recomendacao: "Usar argamassa colante AC-III (ou AC-II conforme o caso) e dupla colagem para porcelanato, placas grandes e fachadas; respeitar o tempo em aberto, as juntas e o tipo de área. Seguir a NBR 14081 e o manual do fabricante.",
    refs: ["ABNT NBR 14081 — argamassa colante industrializada (AC-I/II/III)", "ABNT NBR 13753/13754/13755 — revestimento com placas cerâmicas", "Manuais técnicos de fabricantes"]
  },
  {
    a: "epoxi", b: "concreto", nivel: "moderada",
    titulo: "Sistema epóxi sobre concreto úmido/novo",
    mecanismo: "Sistemas epóxi exigem substrato seco, curado e com baixa alcalinidade superficial. Aplicados sobre concreto úmido ou \"verde\", falham por bolhas, descolamento e saponificação; a umidade ascendente também desprende o revestimento.",
    recomendacao: "Medir a umidade do substrato e aguardar a cura; usar primer/epóxi tolerante a umidade quando necessário e tratar a umidade ascendente (barreira). Preparar a superfície por lixamento/jateamento.",
    refs: ["ACI 503R — uso de epóxi com concreto", "Helene — proteção de superfícies de concreto", "Manuais técnicos de sistemas epóxi"]
  },
  {
    a: "madeira", b: "concreto", nivel: "moderada",
    titulo: "Madeira em contato com concreto ou solo úmido",
    mecanismo: "A madeira em contato direto com concreto, solo ou alvenaria úmida absorve umidade por capilaridade, criando condição para apodrecimento (fungos) e ataque de insetos, sobretudo em peças não tratadas.",
    recomendacao: "Isolar a madeira do concreto/solo com barreira (impermeabilização, calço metálico/neoprene, peça de transição), garantir ventilação e usar madeira tratada/durável onde houver umidade.",
    refs: ["ABNT NBR 7190 — projeto de estruturas de madeira", "ABNT NBR 16143 — preservação de madeiras", "Forest Products Laboratory — Wood Handbook"]
  },
  {
    a: "pvc", b: "concreto", nivel: "compativel",
    titulo: "PVC embutido em concreto (uso favorável)",
    mecanismo: "O PVC é quimicamente estável no meio alcalino do concreto e não sofre corrosão, ao contrário de metais como o alumínio. Por isso eletrodutos e tubulações de PVC são adequados para embutir.",
    recomendacao: "Uso consagrado de eletrodutos e tubos de PVC embutidos. Atentar apenas à proteção mecânica, ao raio de curvatura e à dilatação térmica em trechos expostos ao sol.",
    refs: ["ABNT NBR 5410 — instalações elétricas de baixa tensão (eletrodutos)", "ABNT NBR 15465 — sistemas de eletrodutos plásticos"]
  },
  {
    a: "cobre", b: "aco_inox", nivel: "leve",
    titulo: "Cobre e aço inoxidável (par de baixo risco)",
    mecanismo: "Cobre e aço inoxidável estão próximos na série galvânica, então o risco de corrosão galvânica entre eles é baixo na maioria dos ambientes — bem menor do que cobre com zinco ou aço comum.",
    recomendacao: "Combinação geralmente aceitável. Ainda assim, em ambientes muito agressivos (marinho, imersão), avaliar isolamento e a razão de áreas ânodo/cátodo.",
    refs: ["Série galvânica dos metais", "Gentil, Corrosão"]
  }
];
