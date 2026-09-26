// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Base do módulo Compras (PRO) — "companheiro de solicitação de compra".
// Contexto: no dia a dia pede-se a compra de um item, mas ele depende de outros
// itens que costumam ser esquecidos. Aqui o engenheiro/comprador confere, antes de
// fechar o pedido, o que mais precisa ir junto — e, por serviço, quais materiais
// são necessários (espelhando a lógica das composições/insumos da SINAPI).
//
// COMPRAS_ITENS: item solicitado -> pergunta de verificação + itens complementares.
// COMPRAS_SERVICOS: serviço -> materiais e equipamentos necessários (SEM unidade
//   nem valor; apenas "essencial" ou "conferir/opcional"), no estilo da miscelânea
//   de insumos de cada composição SINAPI.

const COMPRAS_ITENS = [
  {
    id: "cimento", item: "Cimento",
    pergunta: "Há areia, brita e água suficientes para o traço? Cal e aditivo, se previstos? O tipo de cimento (CP II/III/IV/V-ARI ou RS) é o adequado ao uso?",
    complementares: ["Areia (agregado miúdo)", "Brita (agregado graúdo)", "Água potável disponível", "Cal hidratada (argamassas)", "Aditivo (se previsto)", "Tipo de cimento correto p/ o uso"]
  },
  {
    id: "aco", item: "Aço para armadura (CA-50)",
    pergunta: "Foram pedidos os estribos (CA-60), o arame recozido para amarração e os espaçadores/pastilhas de cobrimento? Há a lista/planilha de dobramento?",
    complementares: ["Estribos (CA-60)", "Arame recozido (amarração)", "Espaçadores / pastilhas de cobrimento", "Lista de dobramento / corte", "Tela soldada (se houver)"]
  },
  {
    id: "registro-acab", item: "Acabamento de registro",
    pergunta: "Qual a marca/linha do registro bruto (base) já instalado? Bases Deca (16 estrias) e Docol (20 estrias) NÃO são compatíveis entre si — o acabamento serve nessa base ou precisa de adaptador/conversor?",
    complementares: ["Base do registro compatível (mesma marca/estrias)", "Adaptador/conversor (se marcas diferentes)", "Canopla / anel de vedação", "Prolongador (se a base estiver profunda)"]
  },
  {
    id: "tinta", item: "Tinta",
    pergunta: "Foram pedidos o selador/fundo preparador, a massa (corrida/acrílica), lixa, fita crepe, rolo/pincel/bandeja e o solvente/diluente correto? A superfície já curou?",
    complementares: ["Selador / fundo preparador", "Massa corrida ou acrílica", "Lixa", "Fita crepe", "Rolo, pincel e bandeja", "Solvente/diluente compatível"]
  },
  {
    id: "porcelanato", item: "Porcelanato / cerâmica",
    pergunta: "A argamassa colante é a adequada (AC-I/II/III) ao tipo de placa e à área? Foram pedidos rejunte, espaçadores e, em área molhada, a impermeabilização?",
    complementares: ["Argamassa colante (AC correta)", "Rejunte", "Espaçadores", "Impermeabilizante (área molhada)", "Disco/cortadora"]
  },
  {
    id: "tubo-pvc", item: "Tubo de PVC (hidráulica)",
    pergunta: "Foram pedidas as conexões (joelhos, tês, luvas), o adesivo + solução limpadora, a fita veda-rosca e os suportes/abraçadeiras?",
    complementares: ["Conexões (joelhos, tês, luvas)", "Adesivo + solução limpadora", "Fita veda-rosca", "Suportes / abraçadeiras", "Registros / válvulas"]
  },
  {
    id: "vaso", item: "Vaso sanitário",
    pergunta: "Foram pedidos o anel de vedação, os parafusos de fixação, o tubo de ligação/engate e confere a bolsa de saída (compatível com o esgoto)?",
    complementares: ["Anel de vedação", "Parafusos + buchas de fixação", "Tubo de ligação / engate flexível", "Veda-rosca", "Assento (se não acompanha)"]
  },
  {
    id: "porta", item: "Porta (folha)",
    pergunta: "Batente/marco, dobradiças, fechadura/maçaneta, parafusos e guarnição/alizar foram incluídos? O sentido de abertura e a largura conferem com o vão?",
    complementares: ["Batente / marco", "Dobradiças", "Fechadura / maçaneta", "Guarnição / alizar", "Parafusos / espuma de fixação"]
  },
  {
    id: "telha", item: "Telha",
    pergunta: "Foram previstas as cumeeiras/arremates, as peças de fixação (parafusos/ganchos + vedação) e a estrutura/ripamento de apoio? E calhas/rufos?",
    complementares: ["Cumeeiras / arremates", "Parafusos/ganchos + anéis de vedação", "Estrutura / ripamento de apoio", "Calhas e rufos", "Manta subcobertura (se previsto)"]
  },
  {
    id: "bloco", item: "Bloco / tijolo",
    pergunta: "Foi prevista a argamassa de assentamento (cimento, cal, areia)? Se for alvenaria estrutural, o graute e as armaduras? Telas para amarração com a estrutura?",
    complementares: ["Cimento", "Cal", "Areia", "Graute (se estrutural)", "Armaduras / tela de amarração (ferro-cabelo)"]
  },
  {
    id: "eletroduto", item: "Eletroduto",
    pergunta: "Foram pedidas as curvas/conexões, as caixas (4x2, 4x4, de passagem), os fios/cabos da bitola correta e a fita isolante? Disjuntores e DPS?",
    complementares: ["Curvas / conexões / luvas", "Caixas (4x2, 4x4, passagem)", "Fios/cabos (bitola correta)", "Fita isolante", "Disjuntores / DR / DPS"]
  },
  {
    id: "laje-pre", item: "Laje pré-moldada (vigota)",
    pergunta: "As vigotas e os elementos de enchimento (lajotas/EPS) estão na quantidade certa? Foram previstos escoramento, tela e o concreto da capa?",
    complementares: ["Vigotas", "Lajotas / EPS (enchimento)", "Escoramento", "Tela soldada", "Concreto da capa (cimento+areia+brita)"]
  },
  {
    id: "manta", item: "Manta asfáltica",
    pergunta: "Foram pedidos o primer, o GLP para o maçarico, os reforços de canto e a proteção mecânica? A regularização com caimento já está feita?",
    complementares: ["Primer asfáltico", "GLP (maçarico)", "Reforço de cantos / telas", "Proteção mecânica", "Argamassa de regularização/caimento"]
  },
  {
    id: "janela", item: "Janela / esquadria",
    pergunta: "Contramarco, fixação (parafusos/chumbadores), espuma/selante e as contravergas foram previstos? A medida confere com o vão (folga de instalação)?",
    complementares: ["Contramarco", "Fixação (parafusos/chumbadores)", "Espuma expansiva / selante", "Verga e contraverga", "Peitoril / pingadeira"]
  },
  {
    id: "drywall", item: "Forro/parede de gesso (drywall)",
    pergunta: "Perfis/montantes, parafusos, fita e massa para junta, e os tirantes/suportes foram incluídos? Em área úmida, a placa é resistente à umidade (RU)?",
    complementares: ["Perfis / montantes / guias", "Parafusos", "Fita + massa de junta", "Tirantes / suportes (forro)", "Placa RU (área úmida)"]
  },
  {
    id: "piso-laminado", item: "Piso laminado / vinílico",
    pergunta: "Foram pedidos a manta/base niveladora, os rodapés, os perfis de transição/acabamento e a cola (se vinílico colado)? O contrapiso está nivelado e seco?",
    complementares: ["Manta / base acústica", "Rodapés", "Perfis de transição/acabamento", "Cola (vinílico colado)", "Massa niveladora (autonivelante)"]
  }
];

const COMPRAS_SERVICOS = [
  {
    id: "forma-madeira", servico: "Fôrma de madeira para estrutura",
    materiais: [
      { item: "Madeira (tábua, compensado ou sarrafo)", essencial: true },
      { item: "Pregos", essencial: true },
      { item: "Arame recozido", essencial: true },
      { item: "Desmoldante", essencial: true },
      { item: "Escoras / pontaletes", essencial: true },
      { item: "Espaçadores de cobrimento", essencial: false }
    ],
    equipamentos: [{ item: "Serra circular", essencial: true }]
  },
  {
    id: "armacao", servico: "Armação de aço",
    materiais: [
      { item: "Barras CA-50", essencial: true },
      { item: "Estribos CA-60", essencial: true },
      { item: "Arame recozido (amarração)", essencial: true },
      { item: "Espaçadores / pastilhas", essencial: true }
    ],
    equipamentos: [{ item: "Bancada / máquina de dobrar e cortar", essencial: false }]
  },
  {
    id: "concreto", servico: "Concreto estrutural (preparo e lançamento)",
    materiais: [
      { item: "Cimento", essencial: true },
      { item: "Areia", essencial: true },
      { item: "Brita", essencial: true },
      { item: "Água", essencial: true },
      { item: "Aditivo (plastificante)", essencial: false }
    ],
    equipamentos: [
      { item: "Vibrador de imersão (+ reserva)", essencial: true },
      { item: "Betoneira ou bomba/grua", essencial: true }
    ]
  },
  {
    id: "alvenaria", servico: "Alvenaria de vedação",
    materiais: [
      { item: "Blocos / tijolos", essencial: true },
      { item: "Cimento", essencial: true },
      { item: "Cal", essencial: true },
      { item: "Areia", essencial: true },
      { item: "Tela / ferro-cabelo (amarração)", essencial: false }
    ]
  },
  {
    id: "reboco", servico: "Revestimento de argamassa (chapisco, emboço, reboco)",
    materiais: [
      { item: "Cimento", essencial: true },
      { item: "Cal", essencial: true },
      { item: "Areia", essencial: true },
      { item: "Chapisco (cimento + areia grossa)", essencial: true },
      { item: "Água", essencial: true },
      { item: "Tela nos encontros de materiais", essencial: false }
    ]
  },
  {
    id: "ceramico", servico: "Assentamento de revestimento cerâmico",
    materiais: [
      { item: "Placas cerâmicas / porcelanato", essencial: true },
      { item: "Argamassa colante (AC correta)", essencial: true },
      { item: "Rejunte", essencial: true },
      { item: "Espaçadores", essencial: true },
      { item: "Impermeabilização (área molhada)", essencial: false }
    ]
  },
  {
    id: "pintura", servico: "Pintura",
    materiais: [
      { item: "Tinta", essencial: true },
      { item: "Selador / fundo preparador", essencial: true },
      { item: "Lixa", essencial: true },
      { item: "Rolo, pincel e bandeja", essencial: true },
      { item: "Massa corrida / acrílica", essencial: false },
      { item: "Fita crepe", essencial: false },
      { item: "Solvente / diluente", essencial: false }
    ]
  },
  {
    id: "hidraulica", servico: "Instalação hidráulica (água fria)",
    materiais: [
      { item: "Tubos", essencial: true },
      { item: "Conexões", essencial: true },
      { item: "Adesivo + solução limpadora", essencial: true },
      { item: "Fita veda-rosca", essencial: true },
      { item: "Registros / válvulas", essencial: true },
      { item: "Suportes / abraçadeiras", essencial: false }
    ]
  },
  {
    id: "imper-manta", servico: "Impermeabilização com manta asfáltica",
    materiais: [
      { item: "Manta asfáltica", essencial: true },
      { item: "Primer asfáltico", essencial: true },
      { item: "Reforço de cantos / telas", essencial: true },
      { item: "Proteção mecânica", essencial: true },
      { item: "Argamassa de regularização/caimento", essencial: false }
    ],
    equipamentos: [{ item: "Maçarico + GLP", essencial: true }]
  },
  {
    id: "cobertura", servico: "Cobertura (telhado)",
    materiais: [
      { item: "Telhas", essencial: true },
      { item: "Estrutura / ripamento de apoio", essencial: true },
      { item: "Fixação (parafusos/ganchos + vedação)", essencial: true },
      { item: "Cumeeiras / arremates", essencial: true },
      { item: "Calhas e rufos", essencial: false },
      { item: "Manta subcobertura", essencial: false }
    ]
  }
];
