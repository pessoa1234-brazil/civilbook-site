// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Biblioteca de Ações Técnicas (procedimentos de engenharia), estruturada como as
// fichas de procedimento do Whitebook: introdução, definição, indicações,
// contraindicações, materiais, técnica de execução, cuidados, complicações e
// referências. Conteúdo autoral em palavras próprias, com citação das fontes.

const TECNICAS_AREAS = [
  { id: "estruturas",        nome: "Estruturas e concreto",        icone: "ti-building-bridge" },
  { id: "fundacoes",         nome: "Fundações e geotecnia",        icone: "ti-stack-2" },
  { id: "terraplenagem",     nome: "Terraplenagem e pavimentação", icone: "ti-road" },
  { id: "alvenaria",         nome: "Alvenaria e vedações",         icone: "ti-wall" },
  { id: "acabamentos",       nome: "Acabamentos e revestimentos",  icone: "ti-paint" },
  { id: "impermeabilizacao", nome: "Impermeabilização",            icone: "ti-droplet" },
  { id: "patologia",         nome: "Patologia e recuperação",      icone: "ti-bandage" },
  { id: "instalacoes",       nome: "Instalações prediais",         icone: "ti-plug" }
];

const TECNICAS = [
  {
    id: "cura-concreto", area: "estruturas", titulo: "Cura do concreto",
    verificacoes: [
      "Há água disponível, em quantidade, para manter a umidade por todo o período de cura?",
      "Mantas/lonas ou composto de cura já estão no canteiro?",
      "Proteção contra sol forte e vento garantida na peça recém-concretada?"
    ],
    introducao: "A cura é o conjunto de medidas para manter umidade e temperatura adequadas no concreto recém-lançado, garantindo a hidratação do cimento nas primeiras idades.",
    definicao: "Procedimento de proteção do concreto após o lançamento para evitar a perda prematura de água, assegurando o desenvolvimento de resistência, a durabilidade e a baixa permeabilidade do cobrimento.",
    indicacoes: [
      "Toda peça de concreto estrutural moldada in loco ou pré-moldada.",
      "Lajes, pisos e grandes superfícies expostas (alta relação área/volume).",
      "Clima quente, seco ou com vento — alta taxa de evaporação.",
      "Concretos de alta resistência e com adições pozolânicas (cura prolongada)."
    ],
    contraindicacoes: [
      "Cura por lâmina d'água em peças que não suportam a carga ou ainda sem estanqueidade.",
      "Uso de água contaminada ou com cloretos.",
      "Compostos de cura (formadores de membrana) onde haverá aderência de revestimento, sem prever a remoção do agente."
    ],
    materiais: [
      "Água limpa; mangueira com aspersor ou sistema de nebulização.",
      "Mantas geotêxtil, sacos de aniagem ou tecidos para reter umidade.",
      "Lona/filme plástico; composto químico de cura (membrana).",
      "Termômetro/controle em peças massivas."
    ],
    tecnica: [
      "Iniciar a cura logo após o acabamento/início de pega, antes de a superfície secar.",
      "Manter a superfície continuamente úmida por, orientativamente, no mínimo 7 dias (ajustar ao tipo de cimento e ao fck).",
      "Escolher o método: aspersão/molhagem frequente, cobertura com mantas úmidas, lâmina d'água, lona plástica ou composto formador de membrana.",
      "Proteger contra sol direto e vento; em pré-moldados, cura térmica controlada.",
      "Registrar início, método e duração da cura."
    ],
    cuidados: [
      "Evitar ciclos de molhagem e secagem (agravam a fissuração).",
      "Prevenir choque térmico e controlar a evaporação (risco de fissuração plástica).",
      "Prolongar a cura em concretos com adições/pozolânicos.",
      "Garantir cobertura uniforme, sem trechos secos."
    ],
    complicacoes: [
      "Fissuras de retração plástica e por secagem.",
      "Baixa resistência superficial e 'farinhamento' (dusting).",
      "Maior permeabilidade do cobrimento e corrosão futura da armadura.",
      "Fissuras térmicas em peças massivas."
    ],
    refs: ["ABNT NBR 14931:2023 — execução de estruturas de concreto", "ABNT NBR 6118 — projeto de estruturas de concreto", "Mehta & Monteiro, Concreto: Microestrutura, Propriedades e Materiais (IBRACON)"]
  },

  {
    id: "ensaio-slump", area: "estruturas", titulo: "Ensaio de abatimento (slump test)",
    introducao: "Ensaio de campo mais usado para medir a consistência (trabalhabilidade) do concreto fresco e controlar o recebimento.",
    definicao: "Medida, em milímetros, do abatimento de um tronco de cone de concreto fresco após a retirada do molde, indicando a consistência do material.",
    indicacoes: [
      "Controle de recebimento de concreto dosado em central.",
      "Verificação de uniformidade entre betonadas.",
      "Antes da moldagem de corpos de prova para controle do fck."
    ],
    contraindicacoes: [
      "Concretos de consistência seca ou autoadensáveis (usar ensaio de espalhamento/flow).",
      "Concreto com agregado graúdo acima de 37,5 mm (peneirar antes)."
    ],
    materiais: [
      "Molde tronco-cônico (cone de Abrams) e placa de base metálica.",
      "Haste de socamento Ø16 mm com ponta hemisférica.",
      "Régua/trena, concha e pano úmido."
    ],
    tecnica: [
      "Umedecer o molde e a base, apoiados em superfície plana e firme.",
      "Preencher em 3 camadas de igual volume, aplicando 25 golpes por camada com a haste.",
      "Rasar o topo e limpar a base.",
      "Retirar o molde na vertical, em 5 a 10 segundos, sem movimento lateral.",
      "Medir a diferença entre a altura do molde e o ponto central do concreto abatido."
    ],
    cuidados: [
      "Amostra representativa e ensaio dentro do tempo-limite após a chegada.",
      "Operação contínua por um único operador.",
      "Descartar e repetir se houver desmoronamento por cisalhamento.",
      "Proibido adicionar água na obra para 'recuperar' o abatimento."
    ],
    complicacoes: [
      "Aceitar ou recusar a carga com base em leitura não representativa.",
      "Perda de trabalhabilidade ao longo do tempo de transporte.",
      "Segregação se o concreto for muito fluido."
    ],
    refs: ["ABNT NBR 16889:2020 — abatimento do tronco de cone (cancelou a NBR NM 67:1998)", "ABNT NBR 12655 — concreto: preparo, controle e recebimento", "ABNT NBR 7212 — concreto dosado em central"]
  },

  {
    id: "concretagem", area: "estruturas", titulo: "Lançamento e adensamento do concreto",
    verificacoes: [
      "Há vibrador de imersão disponível (e um reserva)? Tem energia elétrica próxima ou será necessário vibrador a gasolina?",
      "Como o concreto chega à peça (bomba, grua, jerica) e a altura de lançamento está controlada?",
      "Trabalho em altura (laje/pilar alto): andaime/plataforma, guarda-corpo e cinto/linha de vida (NR-35)?",
      "Equipe, iluminação e tempo suficientes para concretar sem junta fria?",
      "Previsão do tempo conferida e proteção contra chuva/sol disponível?"
    ],
    introducao: "Etapa de transporte, lançamento, adensamento e acabamento do concreto nas fôrmas, decisiva para a qualidade final da peça.",
    definicao: "Conjunto de operações para colocar o concreto na fôrma e adensá-lo, eliminando vazios e levando-o à posição final antes do início da pega.",
    indicacoes: [
      "Execução de qualquer elemento estrutural de concreto moldado in loco."
    ],
    contraindicacoes: [
      "Lançar concreto já em início de pega.",
      "Altura de queda livre excessiva (provoca segregação).",
      "Concretar sob chuva forte sem proteção.",
      "Fôrmas e armaduras não conferidas/liberadas."
    ],
    materiais: [
      "Vibrador de imersão (agulha) com diâmetro adequado à peça.",
      "Fôrmas estanques, escoradas e desmoldadas; espaçadores de cobrimento.",
      "Calha, bomba ou grua/caçamba; trombas/funis para limitar a queda.",
      "Réguas, desempenadeiras e EPI."
    ],
    tecnica: [
      "Conferir fôrmas, armadura, cobrimento, limpeza e estanqueidade.",
      "Lançar em camadas de ~30 a 50 cm, o mais próximo possível da posição final.",
      "Adensar por imersão vertical da agulha, ponto a ponto, sem encostar em fôrmas/armaduras, retirando lentamente até cessar a saída de bolhas.",
      "Planejar e executar as juntas de concretagem nos pontos definidos.",
      "Acabar a superfície e iniciar a cura imediatamente."
    ],
    cuidados: [
      "Limitar a altura de queda (funil/tromba).",
      "Não usar o vibrador para transportar o concreto na fôrma.",
      "Controlar o abatimento por betonada e respeitar o plano de concretagem.",
      "Proteger a peça contra perda de água logo após o acabamento."
    ],
    complicacoes: [
      "Segregação e exsudação.",
      "Ninhos de concretagem (bicheiras) e juntas frias.",
      "Deslocamento de armadura e perda de cobrimento.",
      "Desvios de nível e prumo."
    ],
    refs: ["ABNT NBR 14931:2023 — execução de estruturas de concreto", "ABNT NBR 6118", "ABNT NBR 7212"]
  },

  {
    id: "sondagem-spt", area: "fundacoes", titulo: "Sondagem à percussão (SPT)",
    verificacoes: [
      "Acesso do equipamento (tripé/perfuratriz) até cada ponto de furo?",
      "Água disponível para a circulação durante a perfuração?",
      "Locação dos furos conferida e interferências enterradas (redes) verificadas?"
    ],
    introducao: "Investigação geotécnica básica para reconhecimento do subsolo e obtenção do índice de resistência à penetração (N_SPT).",
    definicao: "Sondagem de simples reconhecimento que mede o número de golpes para cravar 30 cm do amostrador-padrão sob queda de martelo de 65 kg a 75 cm, com coleta de amostras e medição do nível d'água.",
    indicacoes: [
      "Projeto de fundações de edificações e obras de terra.",
      "Definição do tipo e da cota de apoio da fundação.",
      "Caracterização do perfil estratigráfico e do nível d'água."
    ],
    contraindicacoes: [
      "Maciços com matacões/rocha — complementar com sondagem rotativa.",
      "Não fornece parâmetros de adensamento/permeabilidade (exige ensaios específicos).",
      "Por si só, não substitui investigação especial em obras de grande porte."
    ],
    materiais: [
      "Tripé/torre com roldana e martelo padronizado de 65 kg.",
      "Amostrador-padrão (Terzaghi-Peck / Raymond) e hastes.",
      "Trado, tubos de revestimento e equipamento de circulação d'água.",
      "Frascos para amostras e ficha de campo."
    ],
    tecnica: [
      "Locar os furos conforme a área e o tipo de obra.",
      "Avançar a perfuração com trado e/ou circulação de água.",
      "A cada metro, cravar o amostrador em três segmentos de 15 cm, contando os golpes.",
      "Registrar N = soma dos golpes do 2º e 3º segmentos; coletar e classificar a amostra.",
      "Medir o nível d'água e encerrar pelos critérios de impenetrabilidade."
    ],
    cuidados: [
      "Número e profundidade dos furos conforme a norma e a área construída.",
      "Aferição do martelo e padronização da energia de cravação.",
      "Identificação correta do nível d'água.",
      "Relatório com perfil individual de cada furo e planta de locação."
    ],
    complicacoes: [
      "Investigação subdimensionada (furos insuficientes).",
      "Interpretação equivocada de N por variação de energia/equipamento.",
      "Desmoronamento de furo em areia submersa sem revestimento.",
      "Amostras não representativas."
    ],
    refs: ["ABNT NBR 6484 — sondagem de simples reconhecimento com SPT", "ABNT NBR 6122 — projeto e execução de fundações", "Hachich et al., Fundações: Teoria e Prática (ABMS/ABEF)"]
  },

  {
    id: "helice-continua", area: "fundacoes", titulo: "Estaca hélice contínua monitorada",
    verificacoes: [
      "Acesso e plataforma nivelada para a perfuratriz (equipamento pesado)?",
      "Bomba e concreto bombeável (abatimento alto) programados na quantidade certa?",
      "Energia/combustível e destino do solo retirado definidos?",
      "Sistema de monitoramento eletrônico operante?"
    ],
    introducao: "Estaca moldada in loco executada por trado helicoidal contínuo, de alta produtividade e baixa vibração.",
    definicao: "Estaca de concreto moldada pela perfuração com hélice contínua até a cota de projeto, seguida de concretagem bombeada pela haste central durante a extração da hélice e posterior introdução da armadura.",
    indicacoes: [
      "Solos variados, acima e abaixo do nível d'água.",
      "Áreas urbanas (baixa vibração e ruído).",
      "Cargas médias a altas e grande número de estacas."
    ],
    contraindicacoes: [
      "Presença de matacões, rocha ou obstruções.",
      "Acesso/pé-direito insuficiente para o equipamento.",
      "Lençol artesiano sem cuidados especiais."
    ],
    materiais: [
      "Perfuratriz com hélice contínua e mastro guiado.",
      "Bomba de concreto e concreto/argamassa bombeável (alto abatimento).",
      "Armação em gaiola e espaçadores.",
      "Sistema de monitoramento eletrônico (torque, profundidade, pressão, consumo)."
    ],
    tecnica: [
      "Locar e nivelar o equipamento sobre o piquete.",
      "Perfurar por rotação contínua até a cota, sem retirar o solo.",
      "Ao atingir a profundidade, bombear o concreto pela haste mantendo pressão positiva enquanto se extrai a hélice.",
      "Arrasar o topo e introduzir a armadura no concreto ainda fresco.",
      "Registrar os parâmetros de execução de cada estaca."
    ],
    cuidados: [
      "Manter pressão de concretagem positiva para evitar estrangulamento do fuste.",
      "Compatibilizar a velocidade de extração com a vazão de concreto.",
      "Monitorar o consumo (sobre/subconsumo) e limpar o topo.",
      "Acompanhar por monitoramento eletrônico e prever provas de carga."
    ],
    complicacoes: [
      "Estrangulamento ou seccionamento do fuste.",
      "Falta de concreto no topo e desvio de prumo.",
      "Armadura que não desce até a cota.",
      "Capacidade de carga abaixo do previsto."
    ],
    refs: ["ABNT NBR 6122 — projeto e execução de fundações", "ABNT NBR 6484", "Velloso & Lopes, Fundações; Hachich et al., Fundações: Teoria e Prática"]
  },

  {
    id: "alvenaria-estrutural", area: "alvenaria", titulo: "Execução de alvenaria estrutural",
    verificacoes: [
      "Andaime/plataforma de trabalho para a elevação acima de ~1,5 m (NR-18)?",
      "Blocos, argamassa, graute e armaduras disponíveis no pavimento?",
      "Projeto de modulação e a indicação dos pontos de graute em mãos?",
      "Prumo, nível e linha conferidos?"
    ],
    introducao: "Sistema construtivo em que as paredes de blocos cumprem função estrutural, dispensando pilares e vigas convencionais.",
    definicao: "Execução de paredes resistentes com blocos (de concreto ou cerâmicos) assentados com argamassa, com grauteamento e armaduras nos pontos definidos pelo projeto.",
    indicacoes: [
      "Edifícios residenciais de múltiplos pavimentos com paredes alinhadas entre os pisos.",
      "Obras com repetição e racionalização (projeto modular/compatibilizado)."
    ],
    contraindicacoes: [
      "Plantas muito flexíveis e grandes vãos livres.",
      "Abertura/remoção de paredes estruturais sem projeto.",
      "Execução sem projeto estrutural específico de alvenaria."
    ],
    materiais: [
      "Blocos estruturais com resistência especificada.",
      "Argamassa de assentamento e graute.",
      "Armaduras (verticais, horizontais e em canaletas) e espaçadores.",
      "Nível, prumo, linha, colher, bisnaga e EPI."
    ],
    tecnica: [
      "Marcar a primeira fiada sobre laje nivelada, a partir dos eixos do projeto.",
      "Assentar os blocos com argamassa, com amarração entre fiadas e nas interseções.",
      "Posicionar armaduras e grautear os pontos indicados (cintas, vergas, pontos de concentração de tensão).",
      "Executar vergas e contravergas em portas e janelas.",
      "Conferir prumo, nível e esquadro a cada fiada e respeitar a modulação."
    ],
    cuidados: [
      "Não rasgar paredes estruturais para instalações — usar shafts e blocos canaleta previstos.",
      "Controlar a resistência dos blocos e a espessura das juntas.",
      "Grautear conforme o projeto e respeitar a sequência de elevação.",
      "Cimbrar vergas até a cura."
    ],
    complicacoes: [
      "Fissuras por recalque diferencial ou movimentação térmica.",
      "Sobrecarga indevida e juntas mal preenchidas.",
      "Perda de resistência por blocos fora de especificação.",
      "Patologias decorrentes de cortes indevidos."
    ],
    refs: ["ABNT NBR 16868-1/2/3:2020 — alvenaria estrutural (projeto, execução e ensaios)", "Substituiu as NBR 15812 e NBR 15961", "Ramalho & Corrêa, Projeto de Edifícios de Alvenaria Estrutural"]
  },

  {
    id: "manta-asfaltica", area: "impermeabilizacao", titulo: "Impermeabilização com manta asfáltica",
    verificacoes: [
      "Trabalho em altura na laje/cobertura: guarda-corpo e proteção das aberturas (NR-35/NR-18)?",
      "Maçarico, GLP e extintor disponíveis (serviço a quente)?",
      "Caimento e ralos conferidos antes de aplicar?",
      "Tempo firme (sem chuva) e substrato seco?"
    ],
    introducao: "Impermeabilização flexível em mantas pré-fabricadas de asfalto modificado, aplicada por aderência em áreas molhadas e expostas.",
    definicao: "Execução de camada impermeável contínua com mantas asfálticas sobre substrato regularizado, com primer, sobreposições e arremates, protegendo a estrutura da ação da água.",
    indicacoes: [
      "Lajes de cobertura, terraços e áreas expostas.",
      "Reservatórios, áreas frias (banheiros/cozinhas), jardineiras e baldrames."
    ],
    contraindicacoes: [
      "Substrato úmido, sujo ou irregular.",
      "Uso de maçarico próximo a materiais inflamáveis/EPS sem proteção.",
      "Superfícies sem caimento ou sem ralo (empoçamento).",
      "Aplicação direta sobre poliestireno sem camada separadora."
    ],
    materiais: [
      "Manta asfáltica com espessura adequada ao uso.",
      "Primer asfáltico, maçarico e GLP.",
      "Argamassa para regularização e caimento; reforço para cantos/ralos.",
      "Proteção mecânica e EPI."
    ],
    tecnica: [
      "Regularizar o substrato com caimento mínimo (orientativo ~1%) e arredondar os cantos (meia-cana).",
      "Aplicar primer e aguardar a secagem.",
      "Aquecer e colar a manta com sobreposição (~10 cm) e biselamento das emendas.",
      "Subir e fixar os arremates em rodapés/ralos (~20 a 30 cm).",
      "Executar teste de estanqueidade (lâmina d'água por ~72 h) e aplicar a proteção mecânica."
    ],
    cuidados: [
      "Garantir aderência total, sem bolhas ou borbulhamento.",
      "Tratar ralos, tubos emergentes e cantos com reforço.",
      "Respeitar caimentos e a altura dos arremates.",
      "Proteger a manta antes de liberar tráfego ou contrapiso."
    ],
    complicacoes: [
      "Infiltrações por emenda mal executada ou arremate baixo.",
      "Bolhas e descolamento.",
      "Perfuração da manta na fase de proteção.",
      "Empoçamento por ponto baixo sem ralo."
    ],
    refs: ["ABNT NBR 9575 — impermeabilização: seleção e projeto", "ABNT NBR 9574 — execução de impermeabilização", "ABNT NBR 9952 — mantas asfálticas para impermeabilização"]
  },

  {
    id: "injecao-fissuras", area: "patologia", titulo: "Injeção de fissuras com resina",
    introducao: "Técnica de recuperação que preenche e cola fissuras com resina, restaurando o monolitismo ou vedando a passagem de água.",
    definicao: "Injeção sob pressão de resina através de bicos/portas — epóxi rígida para fissuras estruturais já estabilizadas; poliuretano flexível para fissuras ativas com percolação de água.",
    indicacoes: [
      "Fissuras estruturais estabilizadas que exijam recuperação de aderência (epóxi).",
      "Fissuras com percolação de água (poliuretano expansivo).",
      "Colagem de delaminações."
    ],
    contraindicacoes: [
      "Fissuras ativas/em movimento com resina rígida (vai re-fissurar — tratar a causa antes).",
      "Injetar sem diagnosticar a causa da fissuração.",
      "Substrato saturado para epóxi de baixa tolerância à umidade."
    ],
    materiais: [
      "Resina epóxi (ou poliuretano) de injeção.",
      "Bicos/portas de injeção e selante de superfície (epóxi tixotrópico).",
      "Bomba de injeção (manual ou elétrica) e ar comprimido para limpeza.",
      "EPI."
    ],
    tecnica: [
      "Diagnosticar e estabilizar a causa da fissura.",
      "Limpar a fissura e fixar os bicos espaçados ao longo dela.",
      "Selar a superfície entre os bicos.",
      "Injetar a resina a partir do ponto mais baixo até refluir no bico seguinte, avançando bico a bico.",
      "Após a cura, remover os bicos e regularizar a superfície."
    ],
    cuidados: [
      "Confirmar que a fissura está estabilizada (monitorar com selo/pino antes).",
      "Compatibilizar a viscosidade da resina com a abertura da fissura.",
      "Controlar a pressão e registrar o consumo.",
      "Verificar a eficácia (extração/ultrassom) em casos críticos."
    ],
    complicacoes: [
      "Reabertura por não tratar a causa.",
      "Preenchimento incompleto (vazios).",
      "Vazamento de resina pela superfície.",
      "Escolha errada de resina (rígida em fissura ativa)."
    ],
    refs: ["Souza & Ripper, Patologia, Recuperação e Reforço de Estruturas de Concreto", "Helene, Manual para Reparo, Reforço e Proteção de Estruturas de Concreto", "ACI 224.1R — controle de fissuração"]
  },

  {
    id: "reforco-frp", area: "patologia", titulo: "Reforço com fibra de carbono (PRFC)",
    verificacoes: [
      "Andaime/acesso seguro à face a ser reforçada?",
      "Temperatura e umidade dentro da faixa especificada para a resina?",
      "Substrato recuperado e preparado antes da colagem da fibra?",
      "Proteção contra fogo prevista, se exigida em projeto?"
    ],
    introducao: "Reforço estrutural por colagem externa de polímeros reforçados com fibras de carbono — alta resistência, baixo peso e rapidez de execução.",
    definicao: "Aumento de capacidade de flexão, cisalhamento ou confinamento pela colagem de mantas ou laminados de fibra de carbono com resina epóxi na face tracionada ou no contorno do elemento.",
    indicacoes: [
      "Aumento de carga, correção de armadura insuficiente, recuperação após dano/corrosão.",
      "Confinamento de pilares.",
      "Situações que exijam rapidez e baixo acréscimo de seção."
    ],
    contraindicacoes: [
      "Substrato deteriorado/sem resistência (recuperar antes).",
      "Risco de incêndio sem proteção (a resina perde desempenho com o calor).",
      "Ancoragem insuficiente ou necessidade de grande ductilidade sem detalhamento adequado."
    ],
    materiais: [
      "Manta ou laminado de fibra de carbono.",
      "Resina epóxi (primer, regularizadora e de saturação).",
      "Rolos/discos de impregnação e materiais de preparo de superfície.",
      "EPI."
    ],
    tecnica: [
      "Dimensionar conforme norma (ACI 440 / fib).",
      "Recuperar e preparar a superfície (lixamento/jateamento; arredondar cantos).",
      "Aplicar primer e regularizar o substrato.",
      "Impregnar e colar a fibra na direção das tensões, eliminando bolhas; prever ancoragem/sobreposição.",
      "Curar e, se exigido, aplicar proteção térmica/UV."
    ],
    cuidados: [
      "Garantir aderência e limpeza do substrato.",
      "Respeitar a direção das fibras e a relação de resina.",
      "Verificar a deformação-limite e o modo de ruptura (descolamento).",
      "Prever proteção contra fogo onde necessário."
    ],
    complicacoes: [
      "Descolamento prematuro (debonding).",
      "Ruptura frágil se mal dimensionado.",
      "Perda de desempenho com o fogo.",
      "Aplicação sobre substrato fraco que se desprende junto com a fibra."
    ],
    refs: ["ACI 440.2R — reforço com FRP colado externamente", "fib Bulletin 90 — FRP reinforcement", "Machado, Reforço de Estruturas de Concreto com Fibras de Carbono; ABNT NBR 6118 (base de projeto)"]
  },

  {
    id: "teste-estanqueidade", area: "instalacoes", titulo: "Teste de estanqueidade de tubulações",
    introducao: "Ensaio que verifica a ausência de vazamentos em tubulações antes de fechá-las ou embuti-las.",
    definicao: "Teste de pressão (água fria/quente) ou de coluna d'água/fumaça (esgoto e águas pluviais) aplicado às tubulações para comprovar a estanqueidade do sistema.",
    indicacoes: [
      "Toda rede hidráulica e sanitária antes do revestimento.",
      "Após reparos e no recebimento das instalações."
    ],
    contraindicacoes: [
      "Testar antes de a tubulação estar ancorada.",
      "Aplicar pressão acima da prevista (pode danificar conexões).",
      "Incluir aparelhos/peças finais que não suportam a pressão de ensaio.",
      "Ambiente sujeito a congelamento."
    ],
    materiais: [
      "Bomba de teste com manômetro.",
      "Bujões/caps e registros para isolar trechos.",
      "Fonte de água e cronômetro.",
      "Para esgoto: plugues infláveis e/ou gerador de fumaça."
    ],
    tecnica: [
      "Água fria: fechar as extremidades e encher eliminando o ar.",
      "Pressurizar à pressão de ensaio (orientativo ≥ 1,5× a de serviço, respeitado o mínimo da norma).",
      "Manter pelo tempo previsto, observando o manômetro e as juntas.",
      "Localizar e sanar vazamentos; repetir até a aprovação.",
      "Esgoto/pluviais: ensaiar por trecho com coluna d'água ou fumaça."
    ],
    cuidados: [
      "Purgar todo o ar antes de pressurizar (evita falsa leitura e golpe).",
      "Isolar aparelhos sensíveis e testar por trechos.",
      "Registrar pressão, tempo e resultado.",
      "Não embutir/fechar antes da aprovação."
    ],
    complicacoes: [
      "Vazamentos em juntas e roscas.",
      "Golpe de aríete por enchimento rápido.",
      "Danos a conexões por sobrepressão.",
      "Infiltrações futuras se a rede for liberada sem teste."
    ],
    refs: ["ABNT NBR 5626 — sistemas prediais de água fria e quente", "ABNT NBR 8160 — sistemas prediais de esgoto sanitário", "ABNT NBR 10844 — instalações prediais de águas pluviais"]
  },

  {
    id: "corpos-de-prova", area: "estruturas", titulo: "Moldagem e ruptura de corpos de prova",
    verificacoes: [
      "Moldes, haste de socamento e tanque/câmara úmida disponíveis?",
      "Laboratório com prensa aferida contratado para as idades de ruptura?",
      "Transporte dos corpos de prova ao laboratório sem causar dano?"
    ],
    introducao: "Controle da resistência do concreto por meio de corpos de prova moldados na obra e rompidos em laboratório.",
    definicao: "Procedimento de amostragem, moldagem, cura e ensaio de compressão de corpos de prova cilíndricos para verificar a resistência característica (fck).",
    indicacoes: [
      "Controle de recebimento e aceitação do concreto por lote.",
      "Verificação da resistência antes da desforma, protensão ou aplicação de carga."
    ],
    contraindicacoes: [
      "Amostra não representativa do lote.",
      "Corpos de prova mal adensados ou mal curados (resultado inválido).",
      "Decisão estrutural sem plano de amostragem definido."
    ],
    materiais: [
      "Moldes cilíndricos (10×20 ou 15×30 cm) e desmoldante.",
      "Haste de socamento ou mesa vibratória; concha.",
      "Tanque/câmara úmida de cura; equipamento de capeamento ou retífica.",
      "Prensa aferida e EPI."
    ],
    tecnica: [
      "Coletar a amostra conforme o lote, descartando o início da descarga.",
      "Moldar em camadas, adensando por socamento ou vibração; identificar o corpo de prova.",
      "Curar protegido nas primeiras horas e depois em câmara úmida/tanque saturado de cal.",
      "Capear ou retificar as faces para garantir o paralelismo.",
      "Romper na prensa nas idades previstas (ex.: 7 e 28 dias) e calcular a resistência."
    ],
    cuidados: [
      "Número de exemplares e amostragem conforme a NBR 12655.",
      "Cura padronizada — não confundir com a cura da estrutura.",
      "Centragem e velocidade de carregamento corretas na prensa.",
      "Tratar resultados espúrios conforme critério estatístico."
    ],
    complicacoes: [
      "Resistência baixa por moldagem/cura deficientes (não confundir com concreto ruim).",
      "Aceitação ou rejeição equivocada do lote.",
      "Corpos de prova danificados ou mal identificados."
    ],
    refs: ["ABNT NBR 5738 — moldagem e cura de corpos de prova", "ABNT NBR 5739 — ensaio de compressão de corpos de prova cilíndricos", "ABNT NBR 12655"]
  },

  {
    id: "prova-carga", area: "fundacoes", titulo: "Prova de carga estática em fundação profunda",
    verificacoes: [
      "Sistema de reação montado, ancorado e conferido?",
      "Carga de reação suficiente e com margem de segurança?",
      "Instrumentos aferidos e viga de referência isolada do carregamento?"
    ],
    introducao: "Ensaio que verifica o comportamento carga × recalque de uma fundação profunda, confirmando a capacidade de carga de projeto.",
    definicao: "Aplicação de carga estática crescente sobre uma estaca ou tubulão, medindo os recalques, para avaliar a capacidade de carga e o desempenho da fundação.",
    indicacoes: [
      "Confirmação de projeto em obras de grande porte ou com grande número de estacas.",
      "Estacas atípicas ou novas metodologias executivas.",
      "Verificação de desempenho/aceitação e esclarecimento de dúvidas."
    ],
    contraindicacoes: [
      "Ensaiar antes da cura do concreto da estaca.",
      "Sistema de reação subdimensionado.",
      "Instrumentação ou referência inadequadas."
    ],
    materiais: [
      "Sistema de reação (cargueira, estacas de reação ou tirantes).",
      "Macaco hidráulico, bomba e célula de carga/manômetro aferido.",
      "Relógios comparadores ou transdutores de deslocamento.",
      "Viga de referência independente do carregamento."
    ],
    tecnica: [
      "Montar o sistema de reação e a instrumentação.",
      "Aplicar a carga em estágios (ensaio lento ou rápido), aguardando a estabilização dos recalques.",
      "Registrar a curva carga × recalque até a carga máxima prevista.",
      "Descarregar em estágios, medindo a recuperação.",
      "Interpretar a curva e a capacidade de carga."
    ],
    cuidados: [
      "Viga de referência livre da influência do carregamento e da temperatura.",
      "Aferição e zeragem dos instrumentos.",
      "Segurança do sistema de reação (cargas elevadas).",
      "Seguir os critérios de estabilização e os estágios da norma."
    ],
    complicacoes: [
      "Instabilidade ou ruptura do sistema de reação.",
      "Leituras afetadas por temperatura/movimento da referência.",
      "Interpretação equivocada da capacidade de carga.",
      "Danos à estaca ensaiada."
    ],
    refs: ["ABNT NBR 16903:2020 — prova de carga estática em fundação profunda (cancelou a NBR 12131:2006)", "ABNT NBR 6122 — projeto e execução de fundações", "Cintra & Aoki, Fundações por Estacas"]
  },

  {
    id: "compactacao-aterro", area: "terraplenagem", titulo: "Compactação e controle de aterro",
    verificacoes: [
      "Rolo/placa compatível com o tipo de material e com o local (confinado ou aberto)?",
      "Caminhão-pipa disponível para corrigir a umidade do solo?",
      "Laboratório/equipe para o controle de compactação (Proctor) contratado?"
    ],
    introducao: "Densificação controlada do solo em camadas para formar aterros e plataformas estáveis, com controle do grau de compactação.",
    definicao: "Lançamento e compactação do solo em camadas, na umidade ótima, atingindo o grau de compactação especificado em relação ao ensaio de Proctor.",
    indicacoes: [
      "Aterros de edificação e de via, reforço de subleito.",
      "Reaterro de valas e plataformas; bases e sub-bases de pavimento."
    ],
    contraindicacoes: [
      "Compactar solo muito acima ou abaixo da umidade ótima.",
      "Camadas espessas demais para o equipamento.",
      "Aterrar sobre solo mole/orgânico sem tratamento.",
      "Material inadequado (expansivo ou contaminado)."
    ],
    materiais: [
      "Rolo compactador (liso, pé-de-carneiro ou pneumático) ou placa/compactador de percussão em áreas confinadas.",
      "Caminhão-pipa e equipamento de espalhamento.",
      "Equipamentos de controle (frasco de areia/densímetro) e laboratório (Proctor)."
    ],
    tecnica: [
      "Caracterizar o solo e obter a umidade ótima e a massa específica seca máxima (Proctor).",
      "Lançar o solo em camadas de espessura compatível com o equipamento.",
      "Corrigir a umidade para a faixa de projeto.",
      "Compactar com o número de passadas/energia definidos.",
      "Controlar o grau de compactação por camada antes de liberar a próxima."
    ],
    cuidados: [
      "Manter a umidade dentro da faixa especificada.",
      "Espessura de camada compatível com o rolo.",
      "Grau de compactação mínimo (ex.: ≥ 95% do Proctor, conforme o projeto).",
      "Homogeneidade, drenagem e cuidado especial em reaterro confinado de valas."
    ],
    complicacoes: [
      "Recalques e trincas por compactação deficiente.",
      "Instabilidade ou escorregamento de taludes.",
      "Expansão de solos argilosos.",
      "Borrachudo (\"bombeamento\") por excesso de umidade."
    ],
    refs: ["ABNT NBR 7182 — ensaio de compactação (Proctor)", "ABNT NBR 6457 — preparo de amostras de solo", "ABNT NBR 5681 — controle tecnológico da execução de aterros; especificações DNIT"]
  },

  {
    id: "revestimento-argamassa", area: "acabamentos", titulo: "Revestimento de argamassa (chapisco, emboço e reboco)",
    introducao: "Camadas de argamassa que regularizam e protegem paredes e tetos, preparando a superfície para o acabamento.",
    definicao: "Execução das camadas de chapisco (ponte de aderência), emboço (regularização) e reboco/massa única sobre a base de alvenaria ou estrutura.",
    indicacoes: [
      "Revestimento de paredes e tetos internos e externos.",
      "Regularização para pintura ou cerâmica e proteção da vedação."
    ],
    contraindicacoes: [
      "Base suja, lisa, úmida ou sem chapisco.",
      "Espessuras excessivas em camada única.",
      "Revestir alvenaria sem o assentamento concluído/curado."
    ],
    materiais: [
      "Argamassa industrializada ou dosada (cimento-cal-areia) e chapisco.",
      "Desempenadeira, colher, régua/sarrafo de sarrafeamento.",
      "Prumo, nível, linha e broxa; EPI."
    ],
    tecnica: [
      "Preparar e umedecer a base; aplicar o chapisco e aguardar a cura.",
      "Taliscar/mestrar para definir espessura, prumo e planeza.",
      "Aplicar o emboço e sarrafear entre as mestras.",
      "Após a 'puxada', desempenar; executar o reboco/acabamento.",
      "Curar o revestimento."
    ],
    cuidados: [
      "Respeitar a espessura por camada e o intervalo entre elas.",
      "O revestimento não deve ser mais resistente que a base.",
      "Reforçar com tela os encontros de materiais diferentes.",
      "Prever juntas em panos extensos."
    ],
    complicacoes: [
      "Fissuras por retração ou traço forte.",
      "Descolamento/som cavo e eflorescência.",
      "Falta de prumo/planeza.",
      "Empolamento por cal/gesso mal hidratados."
    ],
    refs: ["ABNT NBR 7200 — execução de revestimento de paredes e tetos com argamassas", "ABNT NBR 13749 — revestimento de paredes e tetos (especificação)", "ABNT NBR 13281 — argamassas (requisitos)"]
  },

  {
    id: "revestimento-ceramico", area: "acabamentos", titulo: "Assentamento de revestimento cerâmico/porcelanato",
    verificacoes: [
      "Em fachada/altura: andaime fachadeiro ou balancim, guarda-corpo e cinto (NR-35/NR-18)?",
      "Argamassa colante correta (AC), desempenadeira denteada e cortadora/disco no local?",
      "Base curada, no prumo e com caimento (áreas molhadas) conferido?"
    ],
    introducao: "Fixação de placas cerâmicas e porcelanato em pisos e paredes com argamassa colante, garantindo aderência e estanqueidade das juntas.",
    definicao: "Execução do assentamento de placas com a argamassa colante (AC) adequada, juntas e rejunte, conforme o ambiente e o tipo de placa.",
    indicacoes: [
      "Revestimento de pisos e paredes internos e externos e áreas molhadas.",
      "Fachadas (com a AC e a técnica adequadas)."
    ],
    contraindicacoes: [
      "Base fora de prumo/caimento ou sem cura.",
      "Argamassa colante incompatível (ex.: AC-I em porcelanato/área externa).",
      "Assentar sem juntas ou com a placa contaminada/molhada."
    ],
    materiais: [
      "Argamassa colante AC-I/II/III conforme o uso.",
      "Desempenadeira denteada, espaçadores e rejunte.",
      "Martelo de borracha, nível, cortador/serra; EPI."
    ],
    tecnica: [
      "Preparar e regularizar a base; escolher a AC pelo tipo de placa e área.",
      "Estender e frisar a argamassa com a desempenadeira denteada, respeitando o tempo em aberto.",
      "Assentar pressionando; usar dupla colagem em porcelanato, placas grandes e áreas externas.",
      "Manter as juntas de assentamento e de movimentação.",
      "Após a cura, rejuntar e limpar."
    ],
    cuidados: [
      "Não assentar sobre a 'pele' já formada (tempo em aberto vencido).",
      "Usar dupla colagem onde exigido e prever juntas de movimentação/dessolidarização.",
      "Controlar caimentos em áreas molhadas.",
      "Seguir a NBR 14081 e o manual do fabricante."
    ],
    complicacoes: [
      "Descolamento/estufamento por AC inadequada ou tempo em aberto vencido.",
      "Som cavo e fissura no rejunte.",
      "Infiltração por junta mal executada."
    ],
    refs: ["ABNT NBR 14081 — argamassa colante industrializada (AC-I/II/III)", "ABNT NBR 13753/13754/13755 — revestimento de piso/parede interno e de fachada com placas cerâmicas", "Manuais técnicos de fabricantes"]
  },

  {
    id: "imper-cimenticia", area: "impermeabilizacao", titulo: "Impermeabilização com argamassa polimérica",
    introducao: "Impermeabilização semiflexível à base de cimento modificado com polímeros, aplicada com trincha/rolo em áreas molhadas e estruturas em contato com a água.",
    definicao: "Execução de membrana impermeável por aplicação de argamassa polimérica em demãos cruzadas sobre substrato preparado.",
    indicacoes: [
      "Boxes, banheiros e cozinhas; reservatórios e piscinas.",
      "Baldrames e lajes com baixa movimentação."
    ],
    contraindicacoes: [
      "Superfícies com fissuras ativas/grande movimentação (usar sistema flexível).",
      "Substrato sujo, solto ou saturado.",
      "Aplicação fora das condições de temperatura/umidade do fabricante."
    ],
    materiais: [
      "Argamassa polimérica (componentes A + B).",
      "Trincha, rolo ou desempenadeira; tela de reforço para cantos.",
      "Primer quando indicado; EPI."
    ],
    tecnica: [
      "Preparar e umedecer o substrato (superfície saturada, sem empoçamento).",
      "Arredondar os cantos (meia-cana).",
      "Aplicar demãos cruzadas, respeitando o intervalo e o consumo do fabricante.",
      "Reforçar cantos, ralos e tubos com tela.",
      "Testar a estanqueidade (lâmina d'água) e aplicar a proteção/revestimento após a cura."
    ],
    cuidados: [
      "Número de demãos e consumo conforme o fabricante.",
      "Demãos em sentidos cruzados, sem falhas.",
      "Tratar pontos críticos com reforço.",
      "Respeitar a cura antes do revestimento."
    ],
    complicacoes: [
      "Infiltração por consumo/demão insuficiente.",
      "Fissuração em base muito deformável.",
      "Descolamento por substrato mal preparado."
    ],
    refs: ["ABNT NBR 9575 — impermeabilização: seleção e projeto", "ABNT NBR 9574 — execução de impermeabilização", "Manuais técnicos (argamassa polimérica)"]
  },

  {
    id: "recuperacao-armadura", area: "patologia", titulo: "Diagnóstico e recuperação de armadura corroída",
    introducao: "Conjunto de etapas para diagnosticar a corrosão da armadura e recuperar o concreto deteriorado, restabelecendo a proteção do aço.",
    definicao: "Remoção do concreto contaminado/deteriorado, limpeza e tratamento da armadura e reconstituição da seção com material de reparo, com proteção adicional quando necessário.",
    indicacoes: [
      "Estruturas com fissuras/destacamentos, manchas de ferrugem e armadura exposta.",
      "Perda de seção do aço por corrosão (carbonatação ou cloretos)."
    ],
    contraindicacoes: [
      "Reparar sem diagnosticar a causa (a corrosão continua).",
      "Remover concreto sem escoramento quando há perda de capacidade.",
      "Usar material de reparo incompatível com o substrato."
    ],
    materiais: [
      "Ferramentas de remoção (ponteiro, martelete, hidrojato).",
      "Escova/jateamento para limpeza do aço; inibidor/primer de armadura.",
      "Argamassa de reparo (polimérica/grout).",
      "Fenolftaleína e testes de cloreto para diagnóstico; EPI."
    ],
    tecnica: [
      "Diagnosticar: profundidade de carbonatação (fenolftaleína), teor de cloretos e potencial de corrosão.",
      "Delimitar e remover o concreto deteriorado, inclusive atrás da armadura.",
      "Limpar o aço ao metal e tratar (primer/inibidor).",
      "Reconstituir a seção com argamassa de reparo.",
      "Aplicar proteção de superfície (anticarbonatação ou barreira a cloretos)."
    ],
    cuidados: [
      "Tratar a causa, não apenas o sintoma.",
      "Remover concreto contaminado suficiente (atrás da barra).",
      "Compatibilizar o material de reparo com o substrato.",
      "Escorar quando houver perda de capacidade estrutural."
    ],
    complicacoes: [
      "Reincidência por causa não tratada.",
      "Corrosão por 'efeito anódico incipiente' nas bordas do reparo.",
      "Baixa aderência do material de reparo.",
      "Comprometimento estrutural durante a remoção."
    ],
    refs: ["Souza & Ripper, Patologia, Recuperação e Reforço de Estruturas de Concreto", "Helene, Manual para Reparo, Reforço e Proteção de Estruturas de Concreto", "ABNT NBR 6118 — durabilidade"]
  },

  {
    id: "spda", area: "instalacoes", titulo: "Sistema de proteção contra descargas atmosféricas (SPDA)",
    verificacoes: [
      "Trabalho em altura/cobertura: andaime, linha de vida e cinto (NR-35)?",
      "Terrômetro disponível para medir a resistência de aterramento?",
      "Materiais anticorrosivos para proteger as conexões?"
    ],
    introducao: "Conjunto de captação, descidas e aterramento que protege a edificação e seus ocupantes dos efeitos das descargas atmosféricas (raios).",
    definicao: "Execução do SPDA (Franklin, gaiola de Faraday ou estrutural) conforme o nível de proteção definido pela análise de risco, integrando captação, descidas e aterramento.",
    indicacoes: [
      "Edificações conforme a análise de risco da NBR 5419.",
      "Estruturas altas, com público, com materiais inflamáveis ou serviços essenciais."
    ],
    contraindicacoes: [
      "Executar sem projeto/análise de risco.",
      "Descidas insuficientes ou mal distribuídas.",
      "Aterramento sem medição; conexões de metais incompatíveis sem proteção."
    ],
    materiais: [
      "Captores (terminais aéreos/mastros) ou malha de captação.",
      "Condutores de descida e conectores; hastes de aterramento.",
      "Caixas de inspeção; DPS para a parte elétrica; materiais anticorrosivos."
    ],
    tecnica: [
      "Definir o método e o nível de proteção pela análise de risco.",
      "Instalar a captação cobrindo o volume a proteger.",
      "Executar as descidas pelo caminho mais curto e bem distribuído.",
      "Executar e interligar o aterramento; medir a resistência.",
      "Instalar DPS e fazer a equipotencialização."
    ],
    cuidados: [
      "Equipotencialização e distâncias de segurança.",
      "Proteger as conexões contra corrosão galvânica.",
      "Medir e registrar a resistência de aterramento.",
      "Inspeção e manutenção periódicas."
    ],
    complicacoes: [
      "Danos a pessoas e equipamentos por SPDA deficiente.",
      "Corrosão de conexões e aterramento de alta resistência.",
      "Centelhamento por falta de equipotencialização."
    ],
    refs: ["ABNT NBR 5419-1 a -4 — proteção contra descargas atmosféricas", "ABNT NBR 5410 — instalações elétricas de baixa tensão (equipotencialização/DPS)"]
  }
];
