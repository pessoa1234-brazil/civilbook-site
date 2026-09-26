// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Índice de normas técnicas usadas em engenharia civil — ABNT e demais órgãos emissores
// (DNIT, CONAMA, DER estaduais, NR/MTP…). O campo "orgao" alimenta o filtro por emissor na
// tela; entradas sem "orgao" são tratadas como ABNT. resumo: pontos-chave para consulta
// rápida (não substitui o texto integral da norma — obtenha junto ao órgão emissor).
const NORMAS = [
  {
    codigo: "NBR 6118:2023",
    titulo: "Projeto de estruturas de concreto — Procedimento",
    area: "Estruturas",
    ano: 2023,
    resumo: [
      "Define requisitos para projeto de estruturas de concreto simples, armado e protendido.",
      "Classes de agressividade ambiental (CAA I a IV) definem cobrimento mínimo e classe mínima do concreto.",
      "Cobrimentos nominais (CAA II): laje 25 mm, viga/pilar 30 mm.",
      "Concreto mínimo: C20 (CAA I), C25 (CAA II), C30 (CAA III), C40 (CAA IV).",
      "Índice de esbeltez limite de pilares: λ ≤ 200 (λ ≤ 140 com restrições de cálculo).",
      "Dimensão mínima de pilar: 19 cm (14 cm com coeficiente adicional γn).",
      "Flechas-limite: L/250 para aceitabilidade sensorial visual."
    ]
  },
  {
    codigo: "NBR 6120:2019",
    titulo: "Ações para o cálculo de estruturas de edificações",
    area: "Estruturas",
    ano: 2019,
    resumo: [
      "Define cargas permanentes e variáveis para projeto.",
      "Sobrecargas usuais: dormitórios/salas residenciais 1,5 kN/m², escritórios 2,5 kN/m², lojas 4,0 kN/m², garagens 3,0 kN/m².",
      "Peso específico: concreto armado 25 kN/m³, alvenaria cerâmica furada 13 kN/m³, argamassa 21 kN/m³.",
      "Revestimento de piso usual: 0,8 a 1,2 kN/m²."
    ]
  },
  {
    codigo: "NBR 6122:2022",
    titulo: "Projeto e execução de fundações",
    area: "Fundações",
    ano: 2022,
    resumo: [
      "Define critérios para fundações rasas (sapatas, radier) e profundas (estacas, tubulões).",
      "Exige investigação geotécnica (SPT mínimo conforme área e tipo de obra).",
      "Fator de segurança global mínimo: 3,0 para fundações rasas, 2,0 para estacas (métodos semi-empíricos).",
      "Prova de carga obrigatória em estacas conforme quantidade e tipo da obra.",
      "Recalques admissíveis devem ser verificados em serviço."
    ]
  },
  {
    codigo: "NBR 8800:2008",
    titulo: "Projeto de estruturas de aço e mistas de aço e concreto",
    area: "Estruturas",
    ano: 2008,
    resumo: [
      "Método dos estados-limites para estruturas de aço.",
      "Esbeltez máxima: 200 para barras comprimidas, 300 para tracionadas.",
      "Flechas-limite: L/350 (vigas de piso), L/250 (vigas de cobertura).",
      "Define curvas de flambagem e fatores de redução χ."
    ]
  },
  {
    codigo: "NBR 7190-1:2022",
    titulo: "Projeto de estruturas de madeira",
    area: "Estruturas",
    ano: 2022,
    resumo: [
      "Método dos estados-limites para madeira serrada, roliça e MLC.",
      "Classes de resistência de coníferas (C) e folhosas (D).",
      "Kmod considera duração do carregamento, umidade e categoria da madeira."
    ]
  },
  {
    codigo: "NBR 15575:2021",
    titulo: "Edificações habitacionais — Desempenho",
    area: "Desempenho",
    ano: 2021,
    resumo: [
      "Define níveis de desempenho mínimo (M), intermediário (I) e superior (S).",
      "Vida útil de projeto mínima: estrutura 50 anos, vedações 40 anos, cobertura 20 anos, pisos internos 13 anos.",
      "Critérios de desempenho térmico, acústico, lumínico, estanqueidade e segurança contra incêndio.",
      "Incumbências definidas para construtor, projetista e usuário (manual de uso e operação)."
    ]
  },
  {
    codigo: "NBR 9050:2020",
    titulo: "Acessibilidade a edificações, mobiliário, espaços e equipamentos urbanos",
    area: "Acessibilidade",
    ano: 2020,
    resumo: [
      "Rampa: inclinação máxima 8,33% (1:12) para desnível até 80 cm por segmento.",
      "Porta: vão livre mínimo 80 cm; corredores 90 cm (até 4 m) a 150 cm.",
      "Sanitário acessível: giro de 360° (Ø 1,50 m), barras de apoio a 75 cm do piso.",
      "Piso tátil de alerta e direcional conforme NBR 16537."
    ]
  },
  {
    codigo: "NBR 12655:2022",
    titulo: "Concreto de cimento Portland — Preparo, controle, recebimento e aceitação",
    area: "Materiais",
    ano: 2022,
    resumo: [
      "Define responsabilidades no preparo e recebimento do concreto.",
      "Amostragem: moldar no mínimo 2 CPs por amassada/lote para fck 28 dias.",
      "Lotes de no máximo 100 m³ ou 500 m² (estruturas usuais).",
      "Aceitação: fck,est ≥ fck."
    ]
  },
  {
    codigo: "NBR 14931:2025",
    titulo: "Execução de estruturas de concreto — Procedimento",
    area: "Execução",
    ano: 2025,
    resumo: [
      "Requisitos de execução: fôrmas, escoramento, armação, concretagem e cura.",
      "Tolerâncias de execução de pilares, vigas e lajes.",
      "Prazo de retirada de escoramento vinculado à resistência atingida.",
      "Cura mínima exigida conforme relação a/c e agressividade."
    ]
  },
  {
    codigo: "NBR 16280:2020",
    titulo: "Reforma em edificações — Sistema de gestão de reformas",
    area: "Gestão",
    ano: 2020,
    resumo: [
      "Toda reforma que altere sistemas da edificação exige plano de reforma e ART/RRT.",
      "Síndico é responsável por exigir e arquivar a documentação.",
      "Define escopo mínimo do plano de reforma."
    ]
  },
  {
    codigo: "NBR 5626:2020",
    titulo: "Sistemas prediais de água fria e água quente — Projeto, execução e manutenção",
    area: "Instalações",
    ano: 2020,
    resumo: [
      "Pressão estática máxima: 400 kPa; pressão dinâmica mínima: 10 kPa nos pontos.",
      "Velocidade máxima nas tubulações: 3 m/s.",
      "Reservação dimensionada conforme consumo diário estimado."
    ]
  },
  {
    codigo: "NBR 10844:1989",
    titulo: "Instalações prediais de águas pluviais",
    area: "Instalações",
    ano: 1989,
    resumo: [
      "Período de retorno: 1 ano (áreas pavimentadas), 5 anos (coberturas), 25 anos (áreas onde empoçamento não é tolerado).",
      "Intensidade pluviométrica mínima de cálculo: 150 mm/h para áreas até 100 m².",
      "Vazão de projeto: Q = I·A/60 (L/min)."
    ]
  },
  {
    codigo: "NBR 5410:2004",
    titulo: "Instalações elétricas de baixa tensão",
    area: "Instalações",
    ano: 2004,
    resumo: [
      "Aplica-se a instalações alimentadas em tensão até 1000 V (CA).",
      "Exige dispositivo DR de alta sensibilidade (≤ 30 mA) em tomadas de áreas molhadas, externas e cozinhas.",
      "Seção mínima de condutores: 1,5 mm² para iluminação, 2,5 mm² para tomadas de uso geral.",
      "Tomadas: mínimo de uma a cada 5 m de perímetro em salas/dormitórios; quantidades específicas em cozinha e área de serviço.",
      "Prevê esquema de aterramento, equipotencialização e proteção contra sobrecorrentes."
    ]
  },
  {
    codigo: "NBR 5419:2015",
    titulo: "Proteção contra descargas atmosféricas (SPDA)",
    area: "Instalações",
    ano: 2015,
    resumo: [
      "Dividida em 4 partes: gerais, gerenciamento de risco, danos físicos e proteção de sistemas internos.",
      "A necessidade e a classe do SPDA (I a IV) resultam da análise de risco da Parte 2.",
      "Métodos de captação: Franklin, gaiola de Faraday (malha) e esfera rolante.",
      "Exige equipotencialização das descidas com a entrada de energia e telecom.",
      "Substituiu a versão de 2005, introduzindo o gerenciamento de risco quantitativo."
    ]
  },
  {
    codigo: "NBR 8160:1999",
    titulo: "Sistemas prediais de esgoto sanitário",
    area: "Instalações",
    ano: 1999,
    resumo: [
      "Define dimensionamento de ramais, tubos de queda e ventilação do esgoto.",
      "Cada aparelho tem unidade Hunter de contribuição (UHC) para o cálculo dos coletores.",
      "Exige fecho hídrico (sifão) em todos os aparelhos contra retorno de gases.",
      "Declividade mínima usual: 2% para tubos até DN 75 e 1% para DN 100 ou maiores.",
      "Ventilação dimensionada para manter o fecho hídrico estável."
    ]
  },
  {
    codigo: "NBR 9077:2001",
    titulo: "Saídas de emergência em edifícios",
    area: "Incêndio",
    ano: 2001,
    resumo: [
      "Define largura, quantidade e distância máxima a percorrer até a saída.",
      "Largura das saídas calculada por unidades de passagem (55 cm cada).",
      "Classifica edificações por ocupação e altura para definir o tipo de escada exigido.",
      "Trata de escadas enclausuradas, à prova de fumaça e pressurizadas.",
      "Geralmente complementada por instruções técnicas do Corpo de Bombeiros estadual."
    ]
  },
  {
    codigo: "NBR 9575:2010",
    titulo: "Impermeabilização — Seleção e projeto",
    area: "Execução",
    ano: 2010,
    resumo: [
      "Exige projeto específico de impermeabilização, com detalhes construtivos.",
      "Classifica sistemas por tipo (rígido, flexível) e por exposição (água sob pressão, percolação, umidade).",
      "Pede ensaio de estanqueidade antes da execução da proteção mecânica.",
      "Detalhamento de arremates: ralos, soleiras, juntas, rodapés e tubos emergentes."
    ]
  },
  {
    codigo: "NBR 8036:1983",
    titulo: "Programação de sondagens de simples reconhecimento do solo",
    area: "Fundações",
    ano: 1983,
    resumo: [
      "Define o número mínimo de furos de sondagem por área de projeção da edificação.",
      "Até 1.200 m²: 1 furo a cada 200 m², com mínimo de 2 (recomendável 3).",
      "Acima de 1.200 m²: critério adicional para a área excedente.",
      "Mínimo de 3 furos quando a área é suficiente para mais de um.",
      "Usada em conjunto com a NBR 6484 (ensaio SPT)."
    ]
  },
  {
    codigo: "NBR 14724:2011",
    titulo: "Informação e documentação — Trabalhos acadêmicos — Apresentação",
    area: "Documentação",
    ano: 2011,
    resumo: [
      "Define a estrutura do trabalho: elementos pré-textuais, textuais e pós-textuais.",
      "Formatação usual: papel A4, fonte tamanho 12 no texto e menor em citações longas e notas.",
      "Margens: 3 cm (esquerda e superior) e 2 cm (direita e inferior).",
      "Espaçamento 1,5 entre linhas no texto; citações longas com recuo de 4 cm.",
      "Complementada pela NBR 6023 (referências) e NBR 10520 (citações)."
    ]
  },
  {
    codigo: "NBR 6524",
    titulo: "Fios e cordoalhas de aço zincados para aterramento e SPDA",
    area: "Instalações",
    ano: 2019,
    resumo: [
      "Especifica fios e cordoalhas de aço zincado para aterramento e proteção contra descargas atmosféricas.",
      "Define diâmetros nominais, resistência mecânica e espessura mínima da camada de zinco.",
      "A zincagem garante resistência à corrosão nos subsistemas enterrados e expostos.",
      "Aplicada nas descidas e captação do SPDA quando se adota aço zincado em vez de cobre.",
      "Citada nas especificações de SPDA do edital (Anexo B — CMEI Maringá)."
    ]
  },
  {
    codigo: "NBR 16537:2016",
    titulo: "Acessibilidade — Sinalização tátil no piso",
    area: "Acessibilidade",
    ano: 2016,
    resumo: [
      "Estabelece diretrizes para projeto e instalação da sinalização tátil no piso.",
      "Sinalização de alerta: textura tronco-cônica que indica obstáculos, bordas, início/fim de escadas e rampas.",
      "Sinalização direcional: relevo em barras paralelas ao sentido do caminhamento, orientando a rota acessível.",
      "Exige contraste de cor e de luminância entre a sinalização e o piso adjacente.",
      "Complementa a NBR 9050; ambas exigidas no Anexo A de diretrizes do edital."
    ]
  },
  {
    codigo: "NBR 14565:2019",
    titulo: "Cabeamento estruturado para edifícios e data centers",
    area: "Instalações",
    ano: 2019,
    resumo: [
      "Norma brasileira de cabeamento estruturado de telecomunicações (voz, dados e imagem).",
      "Equivalente nacional às referências internacionais ANSI/TIA-568 e ISO/IEC 11801, citadas no Anexo C.",
      "Define os subsistemas: entrada, sala de equipamentos, backbone, cabeamento horizontal e área de trabalho.",
      "Categorias de desempenho usuais: Cat 5e, 6 e 6A; lance horizontal limitado a 90 m (+ até 10 m de cordões).",
      "Exige certificação dos enlaces por ensaio (atenuação, NEXT, ACR, return loss)."
    ]
  },

  // ───────────────────────── DNIT — especificações/terminologia rodoviárias (texto público) ─
  {
    codigo: "DNIT 031/2006-ES", orgao: "DNIT",
    titulo: "Pavimentos flexíveis — Concreto asfáltico (CBUQ) — Especificação de serviço",
    area: "Pavimentação", ano: 2006,
    resumo: [
      "Especifica a execução de camadas de concreto asfáltico usinado a quente (CAUQ/CBUQ).",
      "Define faixas granulométricas dos agregados (A, B e C) conforme a camada e a espessura.",
      "Teor de ligante determinado por dosagem Marshall (estabilidade, fluência e vazios).",
      "Controla temperaturas de usinagem, transporte, espalhamento e compactação.",
      "Aceitação por grau de compactação, teor de ligante e enquadramento granulométrico."
    ]
  },
  {
    codigo: "DNIT 141/2010-ES", orgao: "DNIT",
    titulo: "Pavimentação — Base estabilizada granulometricamente — Especificação de serviço",
    area: "Pavimentação", ano: 2010,
    resumo: [
      "Trata da execução de base e sub-base de solos ou britas estabilizados por granulometria.",
      "Estabelece requisitos de granulometria, limite de liquidez (LL) e índice de plasticidade (IP).",
      "Compactação na energia especificada (Proctor), com controle de grau de compactação e umidade.",
      "Verifica CBR e expansão mínimos conforme a função da camada."
    ]
  },
  {
    codigo: "DNIT 143/2010-ES", orgao: "DNIT",
    titulo: "Pavimentação — Base de solo-cimento — Especificação de serviço",
    area: "Pavimentação", ano: 2010,
    resumo: [
      "Execução de camada de solo-cimento como base/sub-base de pavimentos.",
      "Teor de cimento definido em dosagem para atingir a resistência de projeto.",
      "Controle de mistura, umidade, compactação e cura úmida da camada.",
      "Aceitação por resistência à compressão simples e grau de compactação."
    ]
  },
  {
    codigo: "DNIT 055/2004-ES", orgao: "DNIT",
    titulo: "Pavimento rígido de concreto de cimento Portland — Especificação de serviço",
    area: "Pavimentação", ano: 2004,
    resumo: [
      "Execução de pavimento rígido de concreto de cimento Portland.",
      "Define resistência (tração na flexão), juntas e barras de transferência/ligação.",
      "Controla preparo da sub-base, lançamento, adensamento, acabamento e cura.",
      "Aceitação por resistência e geometria das placas e das juntas."
    ]
  },
  {
    codigo: "DNIT 108/2009-ES", orgao: "DNIT",
    titulo: "Terraplenagem — Aterros — Especificação de serviço",
    area: "Terraplenagem", ano: 2009,
    resumo: [
      "Execução de aterros: seleção de materiais, lançamento em camadas e compactação.",
      "Corpo do aterro e camada final com graus de compactação distintos (energia normal/intermediária).",
      "Controle de umidade próxima à ótima e do grau de compactação por camada.",
      "Define tratamento da fundação do aterro e conformação dos taludes."
    ]
  },
  {
    codigo: "DNIT 104/2009-ES", orgao: "DNIT",
    titulo: "Terraplenagem — Cortes — Especificação de serviço",
    area: "Terraplenagem", ano: 2009,
    resumo: [
      "Execução de cortes em solo e em rocha, com geometria e taludes de projeto.",
      "Regulariza o greide e prepara o fundo de corte para as camadas seguintes.",
      "Define aproveitamento de materiais (x bota-fora) e a drenagem do corte."
    ]
  },
  {
    codigo: "DNIT 005/2003-TER", orgao: "DNIT",
    titulo: "Defeitos nos pavimentos flexíveis e semirrígidos — Terminologia",
    area: "Pavimentação", ano: 2003,
    resumo: [
      "Padroniza a terminologia dos defeitos de pavimentos (fissuras, trincas, panela, afundamento, etc.).",
      "Base para o levantamento de condição e índices de gestão da via (IGG/IRI).",
      "Referência para inspeção visual e planejamento de manutenção rodoviária."
    ]
  },

  // ───────────────────────── CONAMA — resoluções ambientais (texto público) ─────────────────
  {
    codigo: "Resolução CONAMA 307/2002", orgao: "CONAMA",
    titulo: "Gestão dos resíduos da construção civil (RCC)",
    area: "Meio ambiente", ano: 2002,
    resumo: [
      "Estabelece diretrizes, critérios e procedimentos para a gestão dos resíduos da construção civil.",
      "Classifica os RCC: Classe A (reutilizáveis/recicláveis como agregado), B (recicláveis: plástico, papel, metal, madeira, gesso), C (sem reciclagem viável) e D (perigosos).",
      "Proíbe destinação em aterros domiciliares, bota-foras, encostas e corpos d'água.",
      "Responsabiliza o gerador pela destinação; municípios devem ter Plano de Gestão de RCC.",
      "Alterada pelas Resoluções 348/2004, 431/2011, 448/2012 e 469/2015."
    ]
  },
  {
    codigo: "Resolução CONAMA 237/1997", orgao: "CONAMA",
    titulo: "Licenciamento ambiental — competências e procedimentos",
    area: "Meio ambiente", ano: 1997,
    resumo: [
      "Disciplina o licenciamento ambiental e define as licenças: Prévia (LP), de Instalação (LI) e de Operação (LO).",
      "Lista atividades sujeitas a licenciamento e define competências (federal, estadual, municipal).",
      "Permite a exigência de estudos ambientais conforme o porte e o impacto do empreendimento."
    ]
  },
  {
    codigo: "Resolução CONAMA 001/1986", orgao: "CONAMA",
    titulo: "Estudo de Impacto Ambiental (EIA) e respectivo RIMA",
    area: "Meio ambiente", ano: 1986,
    resumo: [
      "Torna obrigatório o EIA e o respectivo RIMA para atividades modificadoras do meio ambiente.",
      "Relaciona empreendimentos que exigem EIA (rodovias, ferrovias, portos, aterros, barragens, etc.).",
      "Define diretrizes gerais e o conteúdo mínimo do estudo de impacto."
    ]
  },
  {
    codigo: "Resolução CONAMA 357/2005", orgao: "CONAMA",
    titulo: "Classificação dos corpos d'água e lançamento de efluentes",
    area: "Meio ambiente", ano: 2005,
    resumo: [
      "Classifica águas doces, salobras e salinas segundo os usos preponderantes.",
      "Estabelece padrões de qualidade por classe e condições de lançamento de efluentes.",
      "Referência para drenagem, ETE e licenciamento de empreendimentos.",
      "Complementada pela Resolução CONAMA 430/2011 (condições de lançamento de efluentes)."
    ]
  },
  {
    codigo: "Resolução CONAMA 275/2001", orgao: "CONAMA",
    titulo: "Código de cores para a coleta seletiva de resíduos",
    area: "Meio ambiente", ano: 2001,
    resumo: [
      "Define o padrão de cores dos coletores na coleta seletiva.",
      "Azul: papel/papelão; vermelho: plástico; verde: vidro; amarelo: metal; preto: madeira.",
      "Marrom: resíduos orgânicos; branco: resíduos de serviços de saúde; cinza: não reciclável/contaminado.",
      "Aplicável à sinalização de canteiros e ao Plano de Gestão de RCC."
    ]
  },

  // ───────────────────────── NR — Normas Regulamentadoras (MTP, texto público) ──────────────
  {
    codigo: "NR-18", orgao: "MTP (NR)",
    titulo: "Segurança e saúde no trabalho na indústria da construção",
    area: "Segurança do trabalho", ano: 2020,
    resumo: [
      "Estabelece as diretrizes de segurança e saúde no trabalho nos canteiros de obras.",
      "Exige Programa de Gerenciamento de Riscos (PGR) específico para a construção.",
      "Define proteções coletivas: guarda-corpos, fechamento de periferia e de aberturas, plataformas.",
      "Regula áreas de vivência, instalações elétricas, escadas, andaimes e movimentação de cargas."
    ]
  },
  {
    codigo: "NR-35", orgao: "MTP (NR)",
    titulo: "Trabalho em altura",
    area: "Segurança do trabalho", ano: 2012,
    resumo: [
      "Aplica-se a trabalhos acima de 2,00 m do nível inferior, com risco de queda.",
      "Exige Análise de Risco e, quando aplicável, Permissão de Trabalho (PT).",
      "Capacitação específica e sistema de proteção contra quedas (cinturão paraquedista, talabarte, ancoragem).",
      "Define responsabilidades do empregador e do trabalhador."
    ]
  },
  {
    codigo: "NR-06", orgao: "MTP (NR)",
    titulo: "Equipamento de Proteção Individual (EPI)",
    area: "Segurança do trabalho", ano: 2018,
    resumo: [
      "Obriga o fornecimento gratuito de EPI adequado ao risco e em perfeito estado de conservação.",
      "Exige EPI com Certificado de Aprovação (CA) válido.",
      "Define deveres do empregador (treinamento, troca, higienização) e do trabalhador (uso e guarda)."
    ]
  },
  {
    codigo: "NR-12", orgao: "MTP (NR)",
    titulo: "Segurança no trabalho em máquinas e equipamentos",
    area: "Segurança do trabalho", ano: 2019,
    resumo: [
      "Define proteções e dispositivos de segurança em máquinas e equipamentos.",
      "Exige proteções fixas/móveis, parada de emergência e dispositivos de intertravamento.",
      "Relevante para centrais de concreto, serras, betoneiras, gruas e elevadores de obra."
    ]
  },

  // ───────────────────────── DER — Departamentos de Estradas de Rodagem (estaduais) ─────────
  // Especificações estaduais que complementam/adaptam as normas DNIT; variam por estado.
  {
    codigo: "DER/PR — Especificações de Serviço", orgao: "DER",
    titulo: "Especificações de serviço rodoviário do DER/PR (Paraná)",
    area: "Rodovias",
    resumo: [
      "Conjunto de especificações do DER/PR para terraplenagem, pavimentação, drenagem e obras de arte.",
      "Séries usuais: ES-T (terraplenagem), ES-P (pavimentação), ES-OC/ES-OAC (drenagem e obras complementares), ES-OAE (obras de arte especiais).",
      "Complementam e adaptam as normas DNIT no âmbito das rodovias estaduais do Paraná.",
      "Consulte a especificação específica no portal do DER/PR."
    ]
  },
  {
    codigo: "DER/SP — Especificações Técnicas (ET-DE)", orgao: "DER",
    titulo: "Especificações técnicas de serviços rodoviários do DER/SP (São Paulo)",
    area: "Rodovias",
    resumo: [
      "Especificações técnicas (códigos ET-DE-…) do DER de São Paulo.",
      "Cobrem terraplenagem, pavimentação, drenagem, obras de arte e serviços complementares.",
      "Complementam e adaptam as normas DNIT no âmbito estadual.",
      "Consulte a especificação específica no portal do DER/SP."
    ]
  }
];
