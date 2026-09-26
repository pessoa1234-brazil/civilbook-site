// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// e21 — Segurança do Trabalho na obra: Normas Regulamentadoras (MTE) aplicáveis à construção.
// Conteúdo AUTORAL e ORIENTATIVO (resumo + exigências práticas em obra) — NÃO reproduz o texto
// integral das NRs (público no gov.br). Material de referência: não substitui o SESMT nem o
// responsável técnico de segurança. Confira sempre a redação VIGENTE no portal do MTE.
//
// Cada NR: { id, codigo, titulo, ano, foco, atividades:[...], resumo:[...], exigencias:[...],
//            epis?:[...], documentos?:[...], normaRef?:<codigo em NORMAS>, checklists:[ids], modelos:[ids] }

const NRS = [
  {
    id: "nr-1", codigo: "NR-1", titulo: "Disposições gerais e Gerenciamento de Riscos (GRO/PGR)",
    ano: 2020, foco: "Base de todas as NRs — exige o gerenciamento de riscos ocupacionais.",
    atividades: ["Gestão / GRO-PGR"],
    resumo: [
      "Estabelece o campo de aplicação das NRs e os direitos/deveres de empregador e trabalhadores.",
      "Cria o GRO (Gerenciamento de Riscos Ocupacionais), materializado no PGR (Programa de Gerenciamento de Riscos).",
      "Exige Ordem de Serviço (OS) de segurança e capacitação/treinamento dos trabalhadores."
    ],
    exigencias: [
      "Elaborar o PGR: inventário de riscos (por função/atividade) + plano de ação com prazos e responsáveis.",
      "Emitir Ordem de Serviço de Segurança por função, com os riscos e as medidas de prevenção.",
      "Capacitar os trabalhadores (admissional, periódica e por mudança de função/procedimento) e registrar.",
      "Manter os documentos do GRO/PGR acessíveis à fiscalização e revisá-los (bienal, ou após acidente/mudança).",
      "Na construção, o PGR específico segue as exigências da NR-18."
    ],
    documentos: ["PGR (inventário de riscos + plano de ação)", "Ordem de Serviço de Segurança", "Registros de capacitação"],
    checklists: ["seg-epi"], modelos: ["os-seguranca", "pgr-construcao", "apr-ast"]
  },
  {
    id: "nr-5", codigo: "NR-5", titulo: "CIPA — Comissão Interna de Prevenção de Acidentes",
    ano: 2022, foco: "Comissão paritária de prevenção (e de combate ao assédio, Lei 14.457/22).",
    atividades: ["Gestão / GRO-PGR"],
    resumo: [
      "Define a constituição, o dimensionamento e as atribuições da CIPA conforme nº de empregados e grau de risco.",
      "Inclui ações de prevenção e combate ao assédio sexual e demais violências no trabalho.",
      "Onde não há CIPA, designa-se representante; na construção há regras próprias de dimensionamento."
    ],
    exigencias: [
      "Dimensionar e constituir a CIPA (ou designar responsável) conforme o quadro de empregados do canteiro.",
      "Realizar reuniões mensais com ata; manter o Mapa de Riscos quando aplicável.",
      "Promover a SIPAT (Semana Interna de Prevenção de Acidentes) e investigar acidentes com a CIPA.",
      "Eleição da representação dos empregados e registro/treinamento dos cipeiros."
    ],
    documentos: ["Atas de reunião da CIPA", "Calendário da SIPAT", "Registro de eleição e treinamento"],
    checklists: [], modelos: ["os-seguranca"]
  },
  {
    id: "nr-6", codigo: "NR-6", titulo: "Equipamento de Proteção Individual (EPI)",
    ano: 2018, foco: "Fornecimento gratuito de EPI adequado, com CA válido.",
    atividades: ["EPI"],
    resumo: [
      "Obriga o fornecimento gratuito de EPI adequado ao risco e em perfeito estado de conservação e funcionamento.",
      "Exige EPI com Certificado de Aprovação (CA) válido emitido pelo órgão competente.",
      "Define deveres do empregador (treinar, fornecer, exigir uso, substituir, higienizar) e do trabalhador (usar e guardar)."
    ],
    exigencias: [
      "Selecionar o EPI conforme o risco de cada atividade (inventário do PGR) e conferir a validade do CA.",
      "Registrar a entrega na Ficha de Controle de EPI (com assinatura do trabalhador).",
      "Treinar quanto ao uso, guarda e conservação; substituir imediatamente o EPI danificado/extraviado.",
      "Fiscalizar o uso efetivo durante as atividades; manter estoque mínimo no canteiro."
    ],
    epis: ["Capacete com jugular", "Calçado de segurança", "Óculos de proteção", "Luvas conforme o agente", "Protetor auricular", "Proteção respiratória (quando aplicável)", "Cinturão paraquedista (altura)"],
    documentos: ["Ficha de Controle de Entrega de EPI", "Relação de CAs"],
    normaRef: "NR-06", checklists: ["seg-epi"], modelos: ["ficha-epi"]
  },
  {
    id: "nr-7", codigo: "NR-7", titulo: "PCMSO — Programa de Controle Médico de Saúde Ocupacional",
    ano: 2020, foco: "Saúde ocupacional: exames médicos (ASO) ao longo do vínculo.",
    atividades: ["Saúde ocupacional"],
    resumo: [
      "Exige o PCMSO, coordenado por médico, articulado com o GRO/PGR (riscos do inventário).",
      "Define exames médicos ocupacionais: admissional, periódico, de retorno ao trabalho, de mudança de risco e demissional.",
      "Resulta no ASO (Atestado de Saúde Ocupacional) e no relatório analítico anual."
    ],
    exigencias: [
      "Implementar o PCMSO compatível com os riscos do PGR e manter o ASO de cada trabalhador.",
      "Realizar os exames nas datas devidas (admissional antes do início; periódicos conforme o risco/idade).",
      "Disponibilizar primeiros socorros no canteiro e definir o fluxo de emergência médica.",
      "Notificar acidentes/doenças ocupacionais (CAT) quando ocorrerem."
    ],
    documentos: ["PCMSO", "ASO (por trabalhador)", "Relatório analítico anual", "CAT quando houver"],
    checklists: [], modelos: ["os-seguranca"]
  },
  {
    id: "nr-9", codigo: "NR-9", titulo: "Avaliação e controle de exposições (agentes físicos, químicos e biológicos)",
    ano: 2020, foco: "Antecipa/avalia/controla agentes ambientais — integra o PGR.",
    atividades: ["Gestão / GRO-PGR", "Saúde ocupacional"],
    resumo: [
      "Estabelece os requisitos para avaliação e controle das exposições ocupacionais a agentes físicos, químicos e biológicos.",
      "Substitui o antigo PPRA, integrando-se ao GRO/PGR da NR-1.",
      "Define limites de exposição, medições e a hierarquia de medidas de controle (coletivas antes das individuais)."
    ],
    exigencias: [
      "Identificar agentes (ruído, vibração, calor, poeira, sílica, solventes etc.) por frente de serviço.",
      "Avaliar a exposição (qualitativa/quantitativa) e definir medidas de controle no plano de ação do PGR.",
      "Priorizar medidas coletivas (enclausuramento, ventilação, umidificação) e só então o EPI.",
      "Atenção à sílica (corte/lixamento), ao ruído (serras, bate-estacas) e ao calor (trabalho a céu aberto)."
    ],
    documentos: ["Inventário de agentes (no PGR)", "Laudos de medição quando aplicável"],
    checklists: ["seg-epi"], modelos: ["apr-ast", "pgr-construcao"]
  },
  {
    id: "nr-10", codigo: "NR-10", titulo: "Segurança em instalações e serviços em eletricidade",
    ano: 2004, foco: "Risco elétrico: desenergização, prontuário e capacitação.",
    atividades: ["Eletricidade"],
    resumo: [
      "Define medidas de controle e sistemas preventivos para trabalhos em instalações elétricas e suas proximidades.",
      "Exige medidas de proteção coletiva (desenergização ou tensão de segurança) antes das individuais.",
      "Capacitação básica (curso NR-10) e complementar para o Sistema Elétrico de Potência (SEP)."
    ],
    exigencias: [
      "Manter o prontuário das instalações elétricas (diagramas, laudos, procedimentos) atualizado.",
      "Adotar a desenergização segura: seccionar, impedir reenergização, constatar ausência de tensão, aterrar, sinalizar.",
      "Quadros provisórios de obra com disjuntores DR, aterramento e proteção contra contato; extensões em bom estado.",
      "Trabalhadores habilitados/qualificados/capacitados; respeitar distâncias de segurança e usar PT quando aplicável."
    ],
    epis: ["Luvas isolantes (classe conforme tensão)", "Calçado isolante", "Capacete classe B", "Vestimenta antichama (arco elétrico)"],
    documentos: ["Prontuário das instalações elétricas", "Certificados de capacitação NR-10", "PT para serviços energizados"],
    checklists: ["seg-eletrica"], modelos: ["pt-trabalho", "apr-ast"]
  },
  {
    id: "nr-12", codigo: "NR-12", titulo: "Segurança no trabalho em máquinas e equipamentos",
    ano: 2019, foco: "Proteções, intertravamento e parada de emergência.",
    atividades: ["Máquinas e equipamentos"],
    resumo: [
      "Define proteções e dispositivos de segurança em máquinas e equipamentos, fixos e móveis.",
      "Exige proteções, dispositivos de intertravamento, parada de emergência e capacitação dos operadores.",
      "Aplica-se a betoneiras, serras (circular/policorte), gruas, guinchos, elevadores de obra e centrais."
    ],
    exigencias: [
      "Manter proteções nas partes móveis (coifa e cutelo divisor na serra circular; proteção da polia da betoneira).",
      "Botão de parada de emergência acessível e dispositivos de partida que evitem acionamento acidental.",
      "Aterramento das máquinas, manutenção preventiva registrada e operadores capacitados.",
      "Elevadores de obra e gruas: inspeção, ART do montador, sinalização e controle de acesso à base."
    ],
    epis: ["Protetor auricular", "Óculos de proteção", "Luvas (conforme a máquina)"],
    documentos: ["Manual e registros de manutenção", "ART de montagem (gruas/elevadores)", "Capacitação de operadores"],
    normaRef: "NR-12", checklists: ["seg-maquinas"], modelos: ["apr-ast", "os-seguranca"]
  },
  {
    id: "nr-18", codigo: "NR-18", titulo: "Segurança e saúde no trabalho na indústria da construção",
    ano: 2020, foco: "A NR central do canteiro: PGR, proteções coletivas e áreas de vivência.",
    atividades: ["Gestão / GRO-PGR", "Trabalho em altura", "Andaimes", "Escavação", "Eletricidade", "Movimentação de cargas"],
    resumo: [
      "Estabelece as diretrizes de segurança e saúde nos canteiros de obras.",
      "Exige o PGR específico da construção e a comunicação prévia ao órgão regional quando aplicável.",
      "Regula áreas de vivência, proteções coletivas, escadas, andaimes, escavações, instalações elétricas temporárias e movimentação de cargas."
    ],
    exigencias: [
      "Proteção de periferia e de aberturas: guarda-corpo (≈1,20 m) com rodapé e travessa intermediária; fechamento de vãos.",
      "Plataformas de proteção (principal e secundárias) conforme a altura da edificação.",
      "Áreas de vivência: instalações sanitárias, vestiário, refeitório e água potável.",
      "Andaimes dimensionados e com prancha/forração completa; acessos seguros; escadas fixadas.",
      "Escavações com talude/escoramento e sinalização; instalações elétricas temporárias protegidas (ver NR-10).",
      "Sinalização do canteiro, ordem e limpeza, e proteção contra quedas (integra NR-35)."
    ],
    epis: ["Capacete com jugular", "Calçado de segurança", "Cinturão paraquedista (altura/periferia)", "Óculos/luvas conforme atividade"],
    documentos: ["PGR da construção", "Comunicação prévia (quando aplicável)", "Projetos de proteção coletiva/andaimes"],
    normaRef: "NR-18", checklists: ["seg-altura-andaime", "seg-escavacao", "seg-eletrica"], modelos: ["pgr-construcao", "os-seguranca", "apr-ast"]
  },
  {
    id: "nr-33", codigo: "NR-33", titulo: "Segurança e saúde nos trabalhos em espaços confinados",
    ano: 2006, foco: "Entrada controlada: PET, vigia, atmosfera e resgate.",
    atividades: ["Espaço confinado"],
    resumo: [
      "Aplica-se a espaços confinados (reservatórios, poços, galerias, fossas, silos): pouca ventilação e risco de atmosfera perigosa.",
      "Exige Permissão de Entrada e Trabalho (PET), supervisor de entrada, vigia e monitoramento contínuo da atmosfera.",
      "Capacitação específica e plano/equipe de resgate disponíveis."
    ],
    exigencias: [
      "Identificar e sinalizar os espaços confinados; proibir entrada não autorizada.",
      "Emitir a PET para cada entrada, com medição prévia e contínua da atmosfera (O₂, gases inflamáveis e tóxicos).",
      "Ventilação/purga do ambiente, bloqueio de energias (lockout/tagout) e meios de comunicação com o vigia.",
      "Plano de emergência e resgate, com equipe e equipamentos disponíveis durante a tarefa."
    ],
    epis: ["Detector de gases", "Proteção respiratória (quando exigida)", "Cinturão e sistema de resgate", "Iluminação adequada"],
    documentos: ["PET (Permissão de Entrada e Trabalho)", "Registros de medição da atmosfera", "Capacitação NR-33"],
    checklists: ["seg-confinado"], modelos: ["pt-trabalho", "apr-ast"]
  },
  {
    id: "nr-35", codigo: "NR-35", titulo: "Trabalho em altura",
    ano: 2012, foco: "Acima de 2,00 m: análise de risco, PT e proteção contra quedas.",
    atividades: ["Trabalho em altura", "Andaimes"],
    resumo: [
      "Aplica-se a toda atividade executada acima de 2,00 m do nível inferior, com risco de queda.",
      "Exige Análise de Risco (AR) e, quando aplicável, Permissão de Trabalho (PT).",
      "Capacitação específica e sistema de proteção contra quedas (coletivo e/ou individual)."
    ],
    exigencias: [
      "Priorizar proteção coletiva (guarda-corpo, plataformas); quando insuficiente, usar proteção individual.",
      "Sistema de proteção contra quedas: cinturão paraquedista, talabarte/trava-quedas e ponto de ancoragem confiável.",
      "Elaborar a Análise de Risco da tarefa e emitir PT para atividades não rotineiras/críticas.",
      "Capacitar (carga horária mínima e reciclagem), inspecionar os EPIs antes do uso e definir plano de resgate."
    ],
    epis: ["Cinturão de segurança tipo paraquedista", "Talabarte com absorvedor / trava-quedas", "Capacete com jugular", "Mosquetões e pontos de ancoragem"],
    documentos: ["Análise de Risco (AR)", "Permissão de Trabalho (PT)", "Capacitação NR-35", "Inspeção de EPI"],
    normaRef: "NR-35", checklists: ["seg-altura-andaime"], modelos: ["pt-trabalho", "apr-ast"]
  }
];

if (typeof window !== "undefined") window.NRS = NRS;
