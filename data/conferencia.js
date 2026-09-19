// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Banco de itens de conferência de projetos por disciplina.
// Estrutura inspirada em fichas de avaliação técnica de editais públicos
// (critérios eliminatórios + itens de verificação) com referências normativas.
// elim: item eliminatório/crítico — reprovação impede aprovação da disciplina.

const FASES_PROJETO = [
  "Estudo preliminar",
  "Anteprojeto",
  "Projeto legal",
  "Projeto básico",
  "Projeto executivo",
  "Detalhamento"
];

const TIPOS_OBRA = [
  "Residencial unifamiliar",
  "Residencial multifamiliar",
  "Comercial / corporativo",
  "Institucional (escola, CMEI, posto de saúde)",
  "Industrial / logístico",
  "Reforma / retrofit"
];

const CONFERENCIA = [
  {
    id: "arquitetonico",
    disciplina: "Arquitetônico",
    icone: "ti-ruler-2",
    itens: [
      { texto: "Programa de necessidades integralmente atendido (ambientes, quantidades e áreas mínimas)", elim: true },
      { texto: "Quadro de áreas presente e consistente entre pranchas, memorial e projeto legal", elim: true },
      { texto: "Implantação compatível com levantamento planialtimétrico e confrontantes", norma: "NBR 13133" },
      { texto: "Atendimento ao código de obras e à lei de zoneamento (recuos, taxa de ocupação, coeficiente)", elim: true },
      { texto: "Acessibilidade: rotas acessíveis, rampas ≤ 8,33%, portas ≥ 80 cm, sanitários acessíveis", norma: "NBR 9050", elim: true },
      { texto: "Vagas de estacionamento PCD e idosos no quantitativo legal", norma: "NBR 9050" },
      { texto: "Desempenho: níveis mínimos definidos para vedações, cobertura e pisos", norma: "NBR 15575" },
      { texto: "Esquadrias com dimensões compatíveis com iluminação e ventilação mínimas exigidas" },
      { texto: "Cotas, níveis e eixos em todas as pranchas; escalas adequadas à fase" },
      { texto: "Especificação de materiais e acabamentos no memorial descritivo" },
      { texto: "Comunicação visual, piso tátil e sinalização (quando aplicável)", norma: "NBR 9050 / NBR 16537" },
      { texto: "Briefing preenchido e guide de marca atualizado incorporados ao partido (quando franquia/marca)" },
      { texto: "Estudo preliminar: planta de situação, implantação/cobertura e planta baixa de demolições, reformas e/ou construções" },
      { texto: "Cortes suficientes para entendimento da proposta e modelo tridimensional apresentado" },
      { texto: "Evolução do estudo preliminar → anteprojeto → projeto executivo com detalhamentos completos" }
    ]
  },
  {
    id: "estrutural",
    disciplina: "Estrutural",
    icone: "ti-building-bridge",
    itens: [
      { texto: "Sondagem do terreno considerada no projeto de fundações (nº de furos adequado)", norma: "NBR 8036 / NBR 6484", elim: true },
      { texto: "Cargas adotadas compatíveis com o uso da edificação", norma: "NBR 6120", elim: true },
      { texto: "Classe de agressividade ambiental definida; fck e cobrimentos coerentes", norma: "NBR 6118", elim: true },
      { texto: "Compatibilidade geométrica com arquitetura (pés-direitos, vãos, alturas de vigas)", elim: true },
      { texto: "Furações e passagens de instalações previstas e verificadas na estrutura" },
      { texto: "Estabilidade global verificada (parâmetros α, γz quando aplicável)", norma: "NBR 6118" },
      { texto: "Detalhamento de armaduras completo: bitolas, espaçamentos, ancoragens, emendas", norma: "NBR 6118" },
      { texto: "Especificação de concreto, aço e controle tecnológico", norma: "NBR 12655" },
      { texto: "Fundações com cotas de assentamento e tensões admissíveis indicadas", norma: "NBR 6122" },
      { texto: "Juntas de dilatação definidas e detalhadas (quando aplicável)" },
      { texto: "Memória de cálculo apresentada e legível" },
      { texto: "Projeto estrutural de fundações entregue e compatível com o relatório de sondagem", norma: "NBR 6122", elim: true },
      { texto: "Projeto estrutural de concreto armado entregue e detalhado", norma: "NBR 6118" },
      { texto: "Projeto estrutural metálico entregue e detalhado (ligações, perfis), quando aplicável", norma: "NBR 8800" }
    ]
  },
  {
    id: "eletrico",
    disciplina: "Instalações elétricas",
    icone: "ti-bolt",
    itens: [
      { texto: "Quadro de cargas completo com demanda calculada e fator de demanda justificado", norma: "NBR 5410", elim: true },
      { texto: "Padrão de entrada conforme norma da concessionária local", elim: true },
      { texto: "Proteção DR em áreas molhadas e tomadas externas", norma: "NBR 5410", elim: true },
      { texto: "DPS no quadro geral; seletividade e coordenação das proteções", norma: "NBR 5410" },
      { texto: "Circuitos dedicados para equipamentos de força (ar-condicionado, bombas, cozinha)" },
      { texto: "Iluminação de emergência e autonomia mínima", norma: "NBR 10898" },
      { texto: "Diagramas unifilares e quadros de distribuição detalhados" },
      { texto: "Eletrodutos e infraestrutura compatibilizados com estrutura e demais disciplinas" },
      { texto: "Aterramento e equipotencialização especificados", norma: "NBR 5410" }
    ]
  },
  {
    id: "spda",
    disciplina: "SPDA",
    icone: "ti-cloud-storm",
    itens: [
      { texto: "Análise de risco apresentada e classe de proteção definida", norma: "NBR 5419-2", elim: true },
      { texto: "Método de proteção (Franklin, gaiola, misto) justificado e detalhado", norma: "NBR 5419-3" },
      { texto: "Descidas, anéis e captores dimensionados e locados" },
      { texto: "Aterramento: resistência alvo, malha e caixas de inspeção" },
      { texto: "Equipotencialização com entrada de energia e telecom", norma: "NBR 5419-4" }
    ]
  },
  {
    id: "redes",
    disciplina: "Rede estruturada / CFTV / alarme",
    icone: "ti-network",
    itens: [
      { texto: "Pontos de voz/dados conforme layout e uso dos ambientes", norma: "NBR 14565" },
      { texto: "Racks, salas técnicas e backbone dimensionados e ventilados" },
      { texto: "Infraestrutura (eletrocalhas, eletrodutos) independente da elétrica de força" },
      { texto: "CFTV: cobertura de áreas críticas, alimentação e gravação especificadas" },
      { texto: "Sonorização e alarme com tubulação prevista (quando exigido pelo programa)" }
    ]
  },
  {
    id: "hidrossanitario",
    disciplina: "Hidrossanitário",
    icone: "ti-droplet",
    itens: [
      { texto: "Reservação dimensionada para o consumo diário + reserva técnica de incêndio", norma: "NBR 5626", elim: true },
      { texto: "Pressões mínimas e máximas verificadas nos pontos de utilização", norma: "NBR 5626" },
      { texto: "Esgoto com ventilação primária/secundária e declividades corretas", norma: "NBR 8160", elim: true },
      { texto: "Destino do esgoto definido (rede pública ou tratamento individual conforme local)" },
      { texto: "Diâmetros, materiais e isométricos apresentados" },
      { texto: "Compatibilização com estrutura (furos em vigas, shafts) verificada" },
      { texto: "Água quente: dimensionamento e sistema de aquecimento especificado (quando houver)" },
      { texto: "Barrilete, registros de manobra e setorização detalhados" }
    ]
  },
  {
    id: "pluviais",
    disciplina: "Águas pluviais e drenagem",
    icone: "ti-cloud-rain",
    itens: [
      { texto: "Período de retorno e intensidade pluviométrica adotados e justificados", norma: "NBR 10844" },
      { texto: "Calhas, condutores e ralos dimensionados para as áreas de contribuição", norma: "NBR 10844", elim: true },
      { texto: "Drenagem do terreno e lançamento (sarjeta, galeria, poço de infiltração) definidos" },
      { texto: "Aproveitamento/retenção de águas pluviais conforme exigência municipal (quando houver)" }
    ]
  },
  {
    id: "ppci",
    disciplina: "Prevenção e combate a incêndio",
    icone: "ti-fire-extinguisher",
    itens: [
      { texto: "Projeto conforme código de segurança contra incêndio do estado (CB local)", elim: true },
      { texto: "Classificação de ocupação, carga de incêndio e grau de risco definidos", elim: true },
      { texto: "Saídas de emergência: largura, distâncias máximas e portas corta-fogo", norma: "NBR 9077" },
      { texto: "Extintores: tipo, capacidade e distribuição", norma: "NBR 12693" },
      { texto: "Hidrantes/mangotinhos com reserva técnica e bomba quando exigidos", norma: "NBR 13714" },
      { texto: "Alarme e detecção conforme área e ocupação", norma: "NBR 17240" },
      { texto: "Iluminação de emergência e sinalização de abandono", norma: "NBR 10898 / NBR 13434" },
      { texto: "Brigada/plano de emergência indicado quando exigido" }
    ]
  },
  {
    id: "climatizacao",
    disciplina: "Climatização",
    icone: "ti-air-conditioning",
    itens: [
      { texto: "Carga térmica calculada por ambiente", norma: "NBR 16401" },
      { texto: "Renovação de ar e qualidade do ar interior atendidas", norma: "NBR 16401-3" },
      { texto: "Posição de condensadoras com ventilação, acesso para manutenção e drenos" },
      { texto: "Interligação elétrica compatibilizada (circuitos dedicados, comando)" }
    ]
  },
  {
    id: "impermeabilizacao",
    disciplina: "Impermeabilização",
    icone: "ti-layers-subtract",
    itens: [
      { texto: "Projeto específico com sistemas definidos por área (laje, reservatório, área fria)", norma: "NBR 9575", elim: true },
      { texto: "Detalhes construtivos: rodapés, ralos, juntas, soleiras e arremates" },
      { texto: "Compatibilidade do sistema com o uso (trânsito, exposição UV, água sob pressão)" },
      { texto: "Especificação de ensaios de estanqueidade antes da proteção mecânica" }
    ]
  },
  {
    id: "compatibilizacao",
    disciplina: "Compatibilização entre disciplinas",
    icone: "ti-arrows-shuffle",
    itens: [
      { texto: "Sobreposição de todas as disciplinas verificada (interferências físicas)", elim: true },
      { texto: "Furos e passagens em estrutura aprovados pelo projetista estrutural", elim: true },
      { texto: "Forros e pés-direitos comportam tubulações, dutos e luminárias" },
      { texto: "Shafts com dimensão e acesso para manutenção" },
      { texto: "Níveis de piso acabado consistentes entre arquitetura e instalações" },
      { texto: "Revisões das disciplinas na mesma base arquitetônica (controle de revisão)", elim: true }
    ]
  },
  {
    id: "orcamento",
    disciplina: "Orçamento e cronograma",
    icone: "ti-receipt",
    itens: [
      { texto: "Planilha orçamentária com composições referenciadas (SINAPI/SICRO ou justificadas)", elim: true },
      { texto: "Quantitativos rastreáveis aos projetos (memória de quantitativos)" },
      { texto: "BDI detalhado e justificado" },
      { texto: "Cronograma físico-financeiro compatível com a sequência executiva" },
      { texto: "Curva ABC para conferência dos itens relevantes" }
    ]
  },
  {
    id: "documentacao",
    disciplina: "Documentação e responsabilidade técnica",
    icone: "ti-file-certificate",
    itens: [
      { texto: "ART/RRT de todas as disciplinas recolhidas e vinculadas", elim: true },
      { texto: "Pranchas assinadas, com carimbo completo e numeração de revisão", elim: true },
      { texto: "Memoriais descritivos e especificações de todas as disciplinas" },
      { texto: "Aprovações legais obtidas (prefeitura, corpo de bombeiros, concessionárias)" },
      { texto: "Arquivos entregues nos formatos exigidos (DWG/PDF/BIM conforme contrato)" }
    ]
  },
  {
    id: "due-diligence",
    disciplina: "Due diligence imobiliária",
    icone: "ti-file-search",
    itens: [
      { texto: "Leis, normas e regulamentos aplicáveis ao terreno levantados (zoneamento, uso e ocupação)", elim: true },
      { texto: "Inspeção predial do imóvel/estrutura existente realizada (quando reforma/retrofit)", norma: "NBR 16747" },
      { texto: "Restrições ambientais, APP, recuos e confrontantes verificados" },
      { texto: "Viabilidade legal do programa no terreno confirmada antes do projeto" }
    ]
  },
  {
    id: "levantamento",
    disciplina: "Levantamento e sondagem",
    icone: "ti-drone",
    itens: [
      { texto: "Levantamento planialtimétrico cadastral executado e amarrado", norma: "NBR 13133", elim: true },
      { texto: "Curvas de nível, RN e confrontantes representados" },
      { texto: "Ensaio de sondagem SPT executado com nº de furos conforme área", norma: "NBR 6484 / NBR 8036", elim: true },
      { texto: "Relatório geotécnico com perfil do solo e nível d'água entregue" }
    ]
  },
  {
    id: "terraplenagem",
    disciplina: "Terraplenagem",
    icone: "ti-mountain",
    itens: [
      { texto: "Projeto de terraplenagem com greide e platôs definidos" },
      { texto: "Volumes de corte e aterro calculados e balanceados (memória)" },
      { texto: "Taludes, drenagem provisória e compactação especificados" }
    ]
  },
  {
    id: "pavimentacao",
    disciplina: "Pavimentação e acessos",
    icone: "ti-road",
    itens: [
      { texto: "Projeto de pavimentação com dimensionamento do pacote estrutural" },
      { texto: "Projeto de acesso (entradas/saídas, raios, faixas) compatível com a via" },
      { texto: "Sinalização viária horizontal e vertical definida", norma: "NBR" },
      { texto: "Acessibilidade nos passeios e rebaixamentos de guia", norma: "NBR 9050" }
    ]
  },
  {
    id: "glp",
    disciplina: "Rede de GLP",
    icone: "ti-flame",
    itens: [
      { texto: "Projeto de rede de GLP com dimensionamento e central de gás", norma: "NBR 13523", elim: true },
      { texto: "Distâncias de segurança e ventilação da central atendidas" },
      { texto: "Teste de estanqueidade previsto", norma: "NBR 15526" }
    ]
  },
  {
    id: "ar-lubrificacao",
    disciplina: "Ar comprimido e lubrificação",
    icone: "ti-engine",
    itens: [
      { texto: "Projeto de instalações de ar comprimido dimensionado (compressor, rede, pontos)" },
      { texto: "Projeto de lubrificação / rede de óleo dimensionado (quando oficina/posto)" },
      { texto: "Compatibilização dos pontos com o layout dos equipamentos" }
    ]
  },
  {
    id: "comunicacao-visual",
    disciplina: "Comunicação visual",
    icone: "ti-signature",
    itens: [
      { texto: "Projeto de comunicação visual conforme manual de identidade da marca" },
      { texto: "Sinalização interna, externa e de segurança especificada" },
      { texto: "Compatibilização de fixações e pontos elétricos para letreiros/totens" }
    ]
  },
  {
    id: "licenciamento",
    disciplina: "Licenciamento e aprovações",
    icone: "ti-stamp",
    itens: [
      { texto: "Alvará de construção obtido", elim: true },
      { texto: "Licença ambiental obtida (quando exigida)", elim: true },
      { texto: "Ligação de água/esgoto solicitada à concessionária" },
      { texto: "Ligação de energia solicitada à concessionária" },
      { texto: "Aprovação do projeto de prevenção de incêndio no Corpo de Bombeiros", elim: true },
      { texto: "Licença sanitária / vigilância (quando aplicável ao uso)" },
      { texto: "Habite-se / certificado de conclusão previsto ao fim da obra" }
    ]
  }
];
