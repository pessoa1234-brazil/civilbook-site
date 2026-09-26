// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Prazos de garantia de edificações — referência da ABNT NBR 17170:2022
// ("Edificações — Garantias — Prazos recomendados e diretrizes").
// Descrições em palavras próprias (não reproduzem o texto da norma). Os PRAZOS são os
// recomendados/legais; confirme sempre no texto da norma, no contrato e no manual da obra.
// tipo: "legal" = solidez e segurança (5 anos, legislação vigente / Código Civil art. 618);
//       "oferecida" = prazo oferecido pelo incorporador/construtor/prestador (NBR 17170, Tabela 2).
const GARANTIAS_REF = "Prazos de referência da ABNT NBR 17170:2022. Não substituem o contrato, o manual da obra nem o texto da norma — confirme os prazos aplicáveis ao seu empreendimento.";

const GARANTIAS_CATEGORIAS = ["Estrutura", "Impermeabilização", "Fachadas", "Pisos e acabamentos", "Instalações", "Esquadrias", "Equipamentos"];

// [sistema, categoria, descrição, falhas cobertas, prazo (anos), tipo]
const GARANTIAS = [
  // ── Solidez e segurança — garantia LEGAL 5 anos (NBR 17170 §9.2 / Cód. Civil art. 618) ──
  { id: "g-contencoes", sistema: "Contenções", categoria: "Estrutura", prazo: 5, tipo: "legal",
    descricao: "Muros de arrimo, cortinas de estaca, paredes-diafragma e demais estruturas de contenção do solo.",
    falhas: "Falhas que afetem a segurança e a estabilidade do maciço ou da contenção." },
  { id: "g-fundacoes", sistema: "Fundações", categoria: "Estrutura", prazo: 5, tipo: "legal",
    descricao: "Elementos que transmitem as cargas da edificação ao solo (sapatas, estacas, tubulões, radier, blocos).",
    falhas: "Falhas estruturais que comprometam a estabilidade ou a segurança." },
  { id: "g-estrutura", sistema: "Estrutura (pilares, vigas, lajes)", categoria: "Estrutura", prazo: 5, tipo: "legal",
    descricao: "Elementos com função estrutural: pilares, vigas, lajes e paredes estruturais (concreto, aço, alvenaria estrutural, madeira).",
    falhas: "Falhas que comprometam a segurança; fissuras ou deformações fora dos limites normativos." },
  { id: "g-estrutura-pisos", sistema: "Estrutura de pisos", categoria: "Estrutura", prazo: 5, tipo: "legal",
    descricao: "Estruturas de pisos em mezaninos e estruturas auxiliares com função estrutural.",
    falhas: "Falhas que afetem a estabilidade ou a segurança do pavimento." },
  { id: "g-estrutura-cobertura", sistema: "Estrutura da cobertura", categoria: "Estrutura", prazo: 5, tipo: "legal",
    descricao: "Estruturas de cobertura de qualquer natureza (madeira, metálica, concreto): tesouras, terças, vigamentos.",
    falhas: "Falhas que afetem a segurança ou a resistência estrutural." },

  // ── Impermeabilização ──
  { id: "g-impermeab", sistema: "Impermeabilização", categoria: "Impermeabilização", prazo: 5, tipo: "oferecida",
    descricao: "Sistemas de impermeabilização de coberturas, lajes, áreas molhadas, reservatórios e subsolos.",
    falhas: "Perda de estanqueidade com infiltração de água." },

  // ── Fachadas e vedações externas ──
  { id: "g-vedacao-ext", sistema: "Vedação vertical externa / fachada", categoria: "Fachadas", prazo: 5, tipo: "oferecida",
    descricao: "Fachadas de alvenaria, painéis pré-fabricados e fachadas-cortina (pele de vidro).",
    falhas: "Ruptura de painéis ou perda de estabilidade/integridade da vedação." },
  { id: "g-revest-fachada", sistema: "Revestimento de fachada (argamassa/cerâmica/pedra)", categoria: "Fachadas", prazo: 5, tipo: "oferecida",
    descricao: "Emboço/reboco externo, revestimento cerâmico e placas de pedra natural aderidos à fachada.",
    falhas: "Fissuração generalizada, descolamento ou queda de elementos." },
  { id: "g-fachada-estanqueidade", sistema: "Selantes e juntas de fachada", categoria: "Fachadas", prazo: 1, tipo: "oferecida",
    descricao: "Mastiques, silicones e juntas de dilatação responsáveis pela estanqueidade da fachada.",
    falhas: "Ressecamento, descolamento ou perda de estanqueidade." },
  { id: "g-pintura-ext", sistema: "Pintura externa", categoria: "Fachadas", prazo: 3, tipo: "oferecida",
    descricao: "Pintura e texturas aplicadas nas fachadas e áreas externas.",
    falhas: "Descascamento, empolamento ou desbotamento precoce fora do esperado." },

  // ── Pisos e acabamentos internos ──
  { id: "g-contrapiso", sistema: "Contrapiso", categoria: "Pisos e acabamentos", prazo: 3, tipo: "oferecida",
    descricao: "Camada de regularização/nivelamento do piso (contrapiso).",
    falhas: "Dessolidarização (descolamento) da base." },
  { id: "g-piso-acustico", sistema: "Isolamento acústico de piso", categoria: "Pisos e acabamentos", prazo: 1, tipo: "oferecida",
    descricao: "Manta ou camada resiliente para isolamento acústico ao ruído de impacto (piso flutuante).",
    falhas: "Desintegração, ruptura ou perda de eficácia do isolante." },
  { id: "g-revest-piso", sistema: "Revestimento de piso interno", categoria: "Pisos e acabamentos", prazo: 1, tipo: "oferecida",
    descricao: "Revestimentos de piso e sua fixação (cerâmica, porcelanato, laminado, vinílico, madeira).",
    falhas: "Perda de aderência, desgaste anormal ou fissuras." },
  { id: "g-rejunte", sistema: "Rejuntamento", categoria: "Pisos e acabamentos", prazo: 1, tipo: "oferecida",
    descricao: "Rejunte de juntas de revestimentos cerâmicos.",
    falhas: "Desgaste acentuado, fissuração ou dessolidarização do rejunte." },
  { id: "g-piso-garagem", sistema: "Piso de garagem coberta", categoria: "Pisos e acabamentos", prazo: 3, tipo: "oferecida",
    descricao: "Pavimento de garagens e estacionamentos cobertos.",
    falhas: "Desgaste severo, fissuração ou perda de coesão." },
  { id: "g-rodape", sistema: "Rodapés", categoria: "Pisos e acabamentos", prazo: 1, tipo: "oferecida",
    descricao: "Rodapés de qualquer tipologia e sua fixação.",
    falhas: "Descolamento, deformação ou ruptura." },
  { id: "g-revest-interno", sistema: "Revestimento de parede interna", categoria: "Pisos e acabamentos", prazo: 2, tipo: "oferecida",
    descricao: "Revestimentos internos: cerâmica, gesso, massa e sua fixação.",
    falhas: "Descolamento, fissuras ou empolamento." },
  { id: "g-pintura-int", sistema: "Pintura interna", categoria: "Pisos e acabamentos", prazo: 1, tipo: "oferecida",
    descricao: "Pintura e massa corrida das paredes e tetos internos.",
    falhas: "Descascamento, fissuras de pintura ou empolamento prematuro." },
  { id: "g-forro", sistema: "Forros (gesso/drywall)", categoria: "Pisos e acabamentos", prazo: 1, tipo: "oferecida",
    descricao: "Forros de gesso, gesso acartonado (drywall) e seus acabamentos.",
    falhas: "Fissuras, deformações ou descolamento." },

  // ── Esquadrias ──
  { id: "g-esquadrias", sistema: "Esquadrias (portas e janelas)", categoria: "Esquadrias", prazo: 2, tipo: "oferecida",
    descricao: "Esquadrias de alumínio, madeira, PVC e ferro, incluindo fixação e vedação.",
    falhas: "Empenamento, falha de vedação, oxidação precoce ou problemas de operação." },
  { id: "g-vidros", sistema: "Vidros", categoria: "Esquadrias", prazo: 1, tipo: "oferecida",
    descricao: "Vidros e espelhos instalados nas esquadrias e ambientes.",
    falhas: "Defeito de fabricação ou de instalação (não cobre quebra por uso)." },

  // ── Instalações ──
  { id: "g-hidraulica-prumadas", sistema: "Tubulações principais de água (prumadas)", categoria: "Instalações", prazo: 5, tipo: "oferecida",
    descricao: "Colunas/prumadas de abastecimento e reservatórios.",
    falhas: "Rompimentos, vazamentos nas uniões ou corrosão precoce." },
  { id: "g-hidraulica-ramais", sistema: "Ramais hidráulicos (instalação)", categoria: "Instalações", prazo: 2, tipo: "oferecida",
    descricao: "Execução e ligações dos ramais internos de água.",
    falhas: "Vazamentos ou perda de pressão por falha de montagem." },
  { id: "g-esgoto", sistema: "Tubulações de esgoto e águas pluviais", categoria: "Instalações", prazo: 2, tipo: "oferecida",
    descricao: "Coletores e ramais de esgoto sanitário e de águas pluviais.",
    falhas: "Entupimentos por falha de execução, vazamentos ou caimento inadequado." },
  { id: "g-eletrica", sistema: "Instalações elétricas (quadros e prumadas)", categoria: "Instalações", prazo: 5, tipo: "oferecida",
    descricao: "Quadros de distribuição, barramentos e cabeamento principal.",
    falhas: "Aquecimento anormal, falha de isolamento ou dano em barramentos." },
  { id: "g-eletrica-aparelhagem", sistema: "Aparelhagem elétrica (tomadas/interruptores)", categoria: "Instalações", prazo: 1, tipo: "oferecida",
    descricao: "Tomadas, interruptores e dispositivos instalados.",
    falhas: "Defeito de funcionamento ou contatos danificados." },
  { id: "g-loucas-metais", sistema: "Louças e metais sanitários", categoria: "Instalações", prazo: 1, tipo: "oferecida",
    descricao: "Bacias, lavatórios, cubas, torneiras, registros e misturadores.",
    falhas: "Defeito de fabricação do material ou do mecanismo de vedação." },

  // ── Equipamentos ──
  { id: "g-equipamentos", sistema: "Equipamentos (bombas, motores, automação)", categoria: "Equipamentos", prazo: 1, tipo: "oferecida",
    descricao: "Equipamentos prediais: bombas de recalque, motores de portão, pressurização, automação.",
    falhas: "Defeito de funcionamento. Sem prazo específico, vale a garantia do fabricante (mínimo de 180 dias)." }
];
