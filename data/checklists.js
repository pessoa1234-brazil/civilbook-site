// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Checklists de obra e inspeção. warn = item crítico/de atenção.
const CHECKLISTS = [
  {
    id: "concreto-usinado",
    titulo: "Recebimento de concreto usinado",
    normas: "NBR 12655 · NBR 7212",
    icone: "ti-truck",
    itens: [
      { texto: "Conferir nota fiscal: fck, slump especificado, volume, hora de saída da central" },
      { texto: "Medir abatimento (slump test) na chegada — comparar com o pedido (tolerância típica ±20 mm para slump 100)" },
      { texto: "Tempo máximo entre mistura e fim da descarga: 2h30 (ou conforme contrato)", warn: true },
      { texto: "Proibido adicionar água após início da descarga sem autorização do responsável técnico", warn: true },
      { texto: "Moldar corpos de prova: mínimo 2 CPs por amassada para ensaio aos 28 dias" },
      { texto: "Identificar CPs: data, caminhão, peça concretada" },
      { texto: "Registrar no diário de obra: caminhão, lacre, horários, slump medido" },
      { texto: "Verificar condições de cura previstas (água, manta, película química)" }
    ]
  },
  {
    id: "formas-escoramento",
    titulo: "Fôrmas e escoramento — liberação para concretagem",
    normas: "NBR 14931",
    icone: "ti-box",
    itens: [
      { texto: "Conferir geometria e prumo das fôrmas com o projeto (seções, níveis, alinhamentos)" },
      { texto: "Verificar estanqueidade das juntas (evitar fuga de nata)" },
      { texto: "Conferir travamento e contraventamento do escoramento", warn: true },
      { texto: "Apoio do escoramento em base firme (sem solo fofo, sem calços improvisados)", warn: true },
      { texto: "Aplicar desmoldante antes da armação (nunca sobre a armadura)" },
      { texto: "Conferir contraflecha quando especificada em projeto" },
      { texto: "Limpeza interna das fôrmas (serragem, arame, pontas de vergalhão)" }
    ]
  },
  {
    id: "armacao",
    titulo: "Conferência de armação",
    normas: "NBR 6118 · NBR 14931",
    icone: "ti-grid-dots",
    itens: [
      { texto: "Conferir bitolas, quantidades e espaçamentos com o projeto estrutural" },
      { texto: "Verificar cobrimento com espaçadores adequados (CAA II: laje 25 mm, viga/pilar 30 mm)", warn: true },
      { texto: "Conferir comprimento de ancoragem e transpasse das emendas" },
      { texto: "Verificar amarração e rigidez do conjunto (não pode deslocar na concretagem)" },
      { texto: "Armadura limpa: sem ferrugem escamosa, óleo ou desmoldante" },
      { texto: "Conferir esperas de pilares e arranques de escadas" },
      { texto: "Verificar passagem de eletrodutos e furações previstas (não cortar armadura)", warn: true }
    ]
  },
  {
    id: "fundacao-estacas",
    titulo: "Execução de estacas hélice contínua",
    normas: "NBR 6122",
    icone: "ti-stack-2",
    itens: [
      { texto: "Conferir locação topográfica das estacas (tolerância usual: 10% do diâmetro)" },
      { texto: "Verificar diâmetro, profundidade e cota de arrasamento do projeto" },
      { texto: "Monitorar perfuração (torque, velocidade, profundidade) via sistema da perfuratriz" },
      { texto: "Concretagem ascendente contínua — pressão positiva durante extração do trado", warn: true },
      { texto: "Conferir sobreconsumo de concreto (indicador de solo mole ou cavidade)", warn: true },
      { texto: "Colocar armadura imediatamente após concretagem" },
      { texto: "Arquivar boletim de cada estaca (profundidade, consumo, horários)" }
    ]
  },
  {
    id: "alvenaria",
    titulo: "Execução de alvenaria de vedação",
    normas: "NBR 8545",
    icone: "ti-wall",
    itens: [
      { texto: "Conferir marcação da 1ª fiada com projeto (esquadro e alinhamento)" },
      { texto: "Verificar prumo e nível a cada fiada (tolerância usual: 5 mm/m)" },
      { texto: "Juntas de argamassa: 10–15 mm, preenchimento completo" },
      { texto: "Amarração entre paredes e com pilares (ferro-cabelo ou tela)" },
      { texto: "Verga e contraverga em vãos: transpasse mínimo 30 cm de cada lado", warn: true },
      { texto: "Encunhamento (fixação) só após 7+ dias da elevação", warn: true },
      { texto: "Conferir vãos de esquadrias com folga de projeto" }
    ]
  },
  {
    id: "entrega-obra",
    titulo: "Vistoria de entrega de obra (unidade)",
    normas: "NBR 15575",
    icone: "ti-key",
    itens: [
      { texto: "Testar todas as torneiras, registros e válvulas (vazão e estanqueidade)" },
      { texto: "Testar pontos elétricos, disjuntores identificados no QDC" },
      { texto: "Verificar caimento de pisos de áreas molhadas (sem empoçamento)" },
      { texto: "Teste de estanqueidade em ralos e esgoto (sem retorno de odor)" },
      { texto: "Conferir funcionamento de portas e janelas (vedação, fechos, chaves)" },
      { texto: "Inspecionar revestimentos: trincas, som cavo em cerâmica, manchas", warn: true },
      { texto: "Entregar manual de uso e operação da unidade (obrigatório NBR 15575)", warn: true },
      { texto: "Registrar leitura inicial de medidores (água, energia, gás)" }
    ]
  },
  {
    id: "fluxo-projetos",
    titulo: "Fluxo de projetos — novo empreendimento",
    normas: "Modelo de entregas de projeto",
    icone: "ti-list-check",
    itens: [
      { texto: "Due diligence: leis, normas e regulamentos do terreno levantados", warn: true },
      { texto: "Inspeção predial do imóvel existente (quando reforma/retrofit)" },
      { texto: "Programa de necessidades elaborado e briefing preenchido" },
      { texto: "Guide/manual de marca atualizado solicitado (quando franquia)" },
      { texto: "Estudo preliminar: planta de situação e quadro resumo de áreas" },
      { texto: "Estudo preliminar: implantação/cobertura e plantas baixas" },
      { texto: "Estudo preliminar: cortes e modelo tridimensional" },
      { texto: "Anteprojeto aprovado pelo cliente" },
      { texto: "Levantamento planialtimétrico cadastral executado" },
      { texto: "Ensaio de sondagem SPT executado", warn: true },
      { texto: "Projeto de terraplenagem" },
      { texto: "Projeto estrutural — fundações" },
      { texto: "Projeto estrutural — concreto" },
      { texto: "Projeto estrutural — metálico (quando aplicável)" },
      { texto: "Projeto de instalações elétricas" },
      { texto: "Projeto de SPDA" },
      { texto: "Projeto de telefônica / rede estruturada" },
      { texto: "Projeto de instalações hidrossanitárias" },
      { texto: "Projeto de drenagem de águas pluviais" },
      { texto: "Projeto de pavimentação e de acesso" },
      { texto: "Projeto de prevenção e combate a incêndio (PCI)", warn: true },
      { texto: "Projeto de climatização" },
      { texto: "Projeto de impermeabilização" },
      { texto: "Projeto de rede de GLP" },
      { texto: "Projeto de ar comprimido e de lubrificação (quando oficina/posto)" },
      { texto: "Projeto de comunicação visual" },
      { texto: "Projeto executivo com detalhamentos consolidado" },
      { texto: "Compatibilização entre todas as disciplinas concluída", warn: true },
      { texto: "Cronograma físico-financeiro elaborado" },
      { texto: "Planilha orçamentária elaborada (base SINAPI)" }
    ]
  },
  {
    id: "licenciamento-obra",
    titulo: "Licenciamento e documentação",
    normas: "Aprovações e órgãos",
    icone: "ti-stamp",
    itens: [
      { texto: "Alvará de construção obtido", warn: true },
      { texto: "Licença ambiental obtida (quando exigida)", warn: true },
      { texto: "Ligação de água/esgoto solicitada à concessionária" },
      { texto: "Ligação de energia solicitada à concessionária" },
      { texto: "Licença de instalação obtida" },
      { texto: "Aprovação do projeto no Corpo de Bombeiros", warn: true },
      { texto: "Licença sanitária / vigilância (quando aplicável)" },
      { texto: "Inscrição estadual / alvará provisório de funcionamento" },
      { texto: "Alvará de funcionamento obtido" },
      { texto: "Habite-se / certificado de conclusão emitido", warn: true },
      { texto: "ART/RRT das disciplinas recolhidas e arquivadas", warn: true }
    ]
  },

  // ───────────────── Segurança do Trabalho (e21) — inspeção por frente de serviço ─────────────
  {
    id: "seg-altura-andaime",
    titulo: "Trabalho em altura e andaimes — inspeção",
    normas: "NR-35 · NR-18",
    icone: "ti-ladder",
    itens: [
      { texto: "Atividade acima de 2,00 m: Análise de Risco elaborada e PT emitida quando aplicável", warn: true },
      { texto: "Trabalhadores capacitados em altura (NR-35) e aptos (ASO em dia)" },
      { texto: "Proteção coletiva instalada: guarda-corpo (~1,20 m) com rodapé e travessa intermediária", warn: true },
      { texto: "Cinturão paraquedista, talabarte/trava-quedas inspecionados antes do uso", warn: true },
      { texto: "Ponto de ancoragem confiável e independente da estrutura de apoio" },
      { texto: "Andaime nivelado, contraventado e com forração/piso completo (sem vãos)", warn: true },
      { texto: "Rodízios travados / base com sapatas; acesso seguro (escada fixada)" },
      { texto: "Distância segura de redes elétricas; isolamento e sinalização da área inferior" },
      { texto: "Plano de resgate definido e meios de comunicação disponíveis" }
    ]
  },
  {
    id: "seg-eletrica",
    titulo: "Instalações elétricas do canteiro — inspeção",
    normas: "NR-10 · NR-18",
    icone: "ti-plug-connected",
    itens: [
      { texto: "Quadros provisórios com disjuntor DR e proteção contra contato direto", warn: true },
      { texto: "Aterramento das estruturas, quadros e máquinas verificado", warn: true },
      { texto: "Cabos/extensões íntegros, sem emendas improvisadas; afastados de água e tráfego" },
      { texto: "Prontuário das instalações elétricas disponível e atualizado" },
      { texto: "Trabalhadores capacitados (NR-10) para os serviços elétricos" },
      { texto: "Desenergização segura para manutenção: bloqueio, teste de ausência de tensão e sinalização", warn: true },
      { texto: "PT emitida para serviços energizados ou na proximidade do SEP" },
      { texto: "Distâncias de segurança das redes energizadas respeitadas", warn: true }
    ]
  },
  {
    id: "seg-escavacao",
    titulo: "Escavações e contenções — segurança",
    normas: "NR-18",
    icone: "ti-shovel",
    itens: [
      { texto: "Cadastro de interferências (redes de gás, água, energia, esgoto) antes de escavar", warn: true },
      { texto: "Talude estável ou escoramento/contenção dimensionado para a profundidade", warn: true },
      { texto: "Material escavado e cargas afastados ≥ da borda; sem sobrecarga no talude" },
      { texto: "Acesso seguro (escada) em valas com profundidade superior a 1,25 m" },
      { texto: "Sinalização, isolamento e barreiras no perímetro da escavação", warn: true },
      { texto: "Inspeção diária e após chuvas/alterações do terreno" },
      { texto: "Drenagem da água acumulada; monitoramento de estruturas vizinhas" }
    ]
  },
  {
    id: "seg-epi",
    titulo: "EPI por atividade — conferência e entrega",
    normas: "NR-6",
    icone: "ti-shield-check",
    itens: [
      { texto: "EPI selecionado conforme o risco da atividade (inventário do PGR)", warn: true },
      { texto: "Certificado de Aprovação (CA) válido para cada EPI", warn: true },
      { texto: "Ficha de Controle de Entrega de EPI preenchida e assinada pelo trabalhador" },
      { texto: "Trabalhador treinado quanto ao uso, guarda e conservação" },
      { texto: "EPI em perfeito estado; substituição imediata do danificado/extraviado", warn: true },
      { texto: "Uso efetivo fiscalizado durante a atividade" },
      { texto: "Estoque mínimo de EPI disponível no canteiro" }
    ]
  },
  {
    id: "seg-maquinas",
    titulo: "Máquinas e equipamentos do canteiro — inspeção",
    normas: "NR-12",
    icone: "ti-engine",
    itens: [
      { texto: "Proteções das partes móveis instaladas (serra: coifa e cutelo divisor; betoneira: proteção da coroa/polia)", warn: true },
      { texto: "Botão de parada de emergência acessível e funcional", warn: true },
      { texto: "Dispositivo de partida que evita acionamento acidental" },
      { texto: "Aterramento elétrico do equipamento verificado" },
      { texto: "Operador capacitado e autorizado para a máquina" },
      { texto: "Manutenção preventiva registrada; sem improvisos/“gambiarras”", warn: true },
      { texto: "Gruas e elevadores de obra: ART de montagem, inspeção e controle de acesso à base", warn: true }
    ]
  },
  {
    id: "seg-confinado",
    titulo: "Entrada em espaço confinado",
    normas: "NR-33",
    icone: "ti-arrow-down-circle",
    itens: [
      { texto: "Espaço confinado identificado e sinalizado; entrada não autorizada proibida", warn: true },
      { texto: "Permissão de Entrada e Trabalho (PET) emitida para esta entrada", warn: true },
      { texto: "Medição prévia e contínua da atmosfera (O₂, gases inflamáveis e tóxicos)", warn: true },
      { texto: "Ventilação/purga do ambiente realizada antes e durante" },
      { texto: "Bloqueio de energias e fontes (lockout/tagout) executado" },
      { texto: "Supervisor de entrada e vigia presentes; comunicação contínua" },
      { texto: "Equipe e equipamentos de resgate disponíveis durante a tarefa", warn: true },
      { texto: "Trabalhadores capacitados (NR-33) e aptos" }
    ]
  }
];
