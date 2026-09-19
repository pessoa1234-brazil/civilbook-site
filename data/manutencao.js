// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Plano de manutenção preventiva predial — atividades típicas conforme NBR 5674
// (gestão de manutenção) e anexos orientativos da NBR 17170/NBR 14037 (manual de uso e operação).
// Periodicidades em meses (0.25 = semanal, 0.03 = diária).
const PLANO_MANUTENCAO = [
  {
    sistema: "Estrutura",
    icone: "ti-building",
    atividades: [
      { atividade: "Inspeção visual de elementos estruturais aparentes (fissuras, infiltração, corrosão de armadura)", periodicidade: 12, responsavel: "Engenheiro/empresa especializada" },
      { atividade: "Verificação de juntas de dilatação e selantes", periodicidade: 12, responsavel: "Empresa especializada" }
    ]
  },
  {
    sistema: "Vedações e fachada",
    icone: "ti-wall",
    atividades: [
      { atividade: "Inspeção de revestimento de fachada (descolamento, fissuras, som cavo)", periodicidade: 12, responsavel: "Empresa especializada" },
      { atividade: "Lavagem da fachada e tratamento de pontos de infiltração", periodicidade: 36, responsavel: "Empresa especializada" },
      { atividade: "Reaperto/rejuntamento de esquadrias e peitoris", periodicidade: 12, responsavel: "Equipe de manutenção local" }
    ]
  },
  {
    sistema: "Cobertura e impermeabilização",
    icone: "ti-home",
    atividades: [
      { atividade: "Limpeza de calhas, ralos e condutores de águas pluviais", periodicidade: 3, responsavel: "Equipe de manutenção local" },
      { atividade: "Inspeção de telhas, rufos e capeamentos", periodicidade: 6, responsavel: "Equipe de manutenção local" },
      { atividade: "Inspeção da impermeabilização exposta (lajes, jardineiras)", periodicidade: 12, responsavel: "Empresa especializada" }
    ]
  },
  {
    sistema: "Instalações hidrossanitárias",
    icone: "ti-droplet",
    atividades: [
      { atividade: "Limpeza e desinfecção de reservatórios de água potável", periodicidade: 6, responsavel: "Empresa especializada", norma: "Exigência sanitária usual" },
      { atividade: "Verificação de estanqueidade de registros, válvulas e torneiras das áreas comuns", periodicidade: 1, responsavel: "Equipe de manutenção local" },
      { atividade: "Verificação do funcionamento de bombas de recalque (alternância e ruído)", periodicidade: 0.25, responsavel: "Equipe de manutenção local" },
      { atividade: "Limpeza de caixas de gordura e de inspeção", periodicidade: 3, responsavel: "Equipe de manutenção local" }
    ]
  },
  {
    sistema: "Instalações elétricas",
    icone: "ti-bolt",
    atividades: [
      { atividade: "Teste dos dispositivos DR (botão de teste)", periodicidade: 1, responsavel: "Equipe de manutenção local" },
      { atividade: "Reaperto de conexões em quadros de distribuição e medição de aquecimento", periodicidade: 12, responsavel: "Eletricista habilitado" },
      { atividade: "Verificação do sistema de iluminação de emergência (autonomia)", periodicidade: 1, responsavel: "Equipe de manutenção local" },
      { atividade: "Inspeção do SPDA (para-raios) com emissão de laudo e ART", periodicidade: 12, responsavel: "Engenheiro/empresa especializada", norma: "NBR 5419" }
    ]
  },
  {
    sistema: "Gás",
    icone: "ti-flame",
    atividades: [
      { atividade: "Teste de estanqueidade da rede de gás", periodicidade: 12, responsavel: "Empresa especializada", norma: "NBR 15526" },
      { atividade: "Inspeção visual de abrigos de medidores e ventilação permanente", periodicidade: 3, responsavel: "Equipe de manutenção local" }
    ]
  },
  {
    sistema: "Prevenção e combate a incêndio",
    icone: "ti-fire-extinguisher",
    atividades: [
      { atividade: "Inspeção de extintores (lacre, pressão, validade)", periodicidade: 1, responsavel: "Equipe de manutenção local" },
      { atividade: "Recarga/manutenção de extintores", periodicidade: 12, responsavel: "Empresa certificada" },
      { atividade: "Teste de funcionamento de bombas de incêndio", periodicidade: 0.25, responsavel: "Equipe de manutenção local" },
      { atividade: "Verificação de hidrantes, mangueiras e abrigos", periodicidade: 6, responsavel: "Empresa especializada" },
      { atividade: "Teste do sistema de alarme e detecção", periodicidade: 1, responsavel: "Equipe de manutenção local" }
    ]
  },
  {
    sistema: "Elevadores",
    icone: "ti-elevator",
    atividades: [
      { atividade: "Manutenção preventiva por empresa conservadora", periodicidade: 1, responsavel: "Empresa conservadora contratada", norma: "NBR 16858" },
      { atividade: "Relatório de inspeção anual (RIA) com ART", periodicidade: 12, responsavel: "Empresa conservadora" }
    ]
  },
  {
    sistema: "Esquadrias e vidros",
    icone: "ti-window",
    atividades: [
      { atividade: "Limpeza de trilhos e lubrificação de roldanas e fechos", periodicidade: 6, responsavel: "Equipe de manutenção local" },
      { atividade: "Inspeção de guarda-corpos (fixação e integridade)", periodicidade: 12, responsavel: "Empresa especializada", norma: "NBR 14718" }
    ]
  },
  {
    sistema: "Pintura e revestimentos internos",
    icone: "ti-paint",
    atividades: [
      { atividade: "Inspeção de pisos e revestimentos de áreas comuns (som cavo, trincas)", periodicidade: 12, responsavel: "Equipe de manutenção local" },
      { atividade: "Repintura de áreas comuns e demarcações de garagem", periodicidade: 36, responsavel: "Empresa especializada" }
    ]
  }
];

// Opções para ordens de serviço
const OS_PRIORIDADES = [
  { id: "baixa", label: "Baixa", cor: "teal" },
  { id: "media", label: "Média", cor: "amber" },
  { id: "alta", label: "Alta", cor: "coral" },
  { id: "urgente", label: "Urgente", cor: "red" }
];

const OS_STATUS = [
  { id: "aberta", label: "Aberta", cor: "blue" },
  { id: "andamento", label: "Em andamento", cor: "amber" },
  { id: "concluida", label: "Concluída", cor: "teal" },
  { id: "cancelada", label: "Cancelada", cor: "gray" }
];

const OS_TIPOS = [
  "Manutenção preventiva",
  "Manutenção corretiva",
  "Solicitação de reparo (garantia)",
  "Inspeção/vistoria",
  "Melhoria/reforma"
];

function periodicidadeLabel(m) {
  if (m <= 0.05) return "Diária";
  if (m <= 0.3) return "Semanal";
  if (m === 1) return "Mensal";
  if (m === 3) return "Trimestral";
  if (m === 6) return "Semestral";
  if (m === 12) return "Anual";
  if (m === 24) return "Bienal";
  if (m === 36) return "A cada 3 anos";
  return "A cada " + m + " meses";
}
