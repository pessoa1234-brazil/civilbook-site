// Civilbook — dados de EXEMPLO da obra "Residencial Aurora" (e29).
// Regra nº 1 deste arquivo: NADA é JSON fixo — tudo é FUNÇÃO DE HOJE. Um dataset com datas
// cravadas apodrece em três meses e o exemplo passa a mostrar uma obra 100% atrasada, com
// garantia vencida e cronograma no passado. Aqui a obra "começou há 118 dias" e sempre estará
// no mesmo ponto da curva, hoje, amanhã ou em 2028.
// Regra nº 2: estes objetos NUNCA entram nas coleções (cbColecao grava em localStorage e replica
// no Supabase). Eles só alimentam renderizadores PUROS — ver js/exemplo.js.
// Regra nº 3: nada de código SINAPI inventado. Os itens do orçamento são avulsos e descritos; o
// preço de composição vem da base do próprio usuário, e fingir um código que eu não conferi
// ensinaria o número errado a um engenheiro.
// Validação de engenharia (durações, efetivo, valores, prazos de garantia): do RT — é a parte
// "MISTO" da e29.

const EXEMPLO_OBRA = (() => {
  const DIA = 86400000;
  const iso = (d) => new Date(d).toISOString().slice(0, 10);
  const hoje = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; };
  const emDias = (n) => iso(hoje().getTime() + n * DIA);

  // Obra de 4 pavimentos, ~1.850 m², iniciada há 118 dias: estrutura pronta, alvenaria em curso.
  const INICIO = -118;
  const WBS = [
    { etapa: "Preliminares", nome: "Serviços preliminares e canteiro", de: INICIO, dur: 15, valor: 68000, avanco: 100 },
    { etapa: "Infraestrutura", nome: "Fundações (estacas e blocos)", de: INICIO + 15, dur: 30, valor: 245000, avanco: 100 },
    { etapa: "Superestrutura", nome: "Estrutura em concreto armado (4 pav.)", de: INICIO + 45, dur: 45, valor: 512000, avanco: 100 },
    { etapa: "Vedações", nome: "Alvenaria de vedação em bloco cerâmico", de: INICIO + 90, dur: 30, valor: 198000, avanco: 55 },
    { etapa: "Cobertura", nome: "Cobertura e impermeabilização", de: INICIO + 120, dur: 15, valor: 142000, avanco: 0 },
    { etapa: "Instalações", nome: "Instalações elétricas e hidrossanitárias", de: INICIO + 135, dur: 30, valor: 276000, avanco: 0 },
    { etapa: "Acabamentos", nome: "Revestimentos e contrapisos", de: INICIO + 165, dur: 30, valor: 231000, avanco: 0 },
    { etapa: "Acabamentos", nome: "Esquadrias de alumínio e madeira", de: INICIO + 195, dur: 15, valor: 154000, avanco: 0 },
    { etapa: "Acabamentos", nome: "Pintura interna e externa", de: INICIO + 210, dur: 20, valor: 118000, avanco: 0 },
    { etapa: "Entrega", nome: "Limpeza final, vistoria e entrega", de: INICIO + 230, dur: 10, valor: 36000, avanco: 0, marco: true },
  ];

  // O RDO precisa cair em dia útil (a obra não trabalha domingo) — anda para trás até seg-sáb.
  function diaUtilAtras(n) {
    let d = hoje().getTime() - n * DIA;
    while (new Date(d).getDay() === 0) d -= DIA;
    return iso(d);
  }

  function gerar() {
    const projetoId = "exemplo-obra";
    const cronograma = {
      id: "exemplo-crono",
      nome: "Residencial Aurora — 4 pavimentos",
      projeto_id: projetoId,
      atividades: WBS.map((a, i) => ({
        id: "ex-at-" + i, etapa: a.etapa, nome: a.nome,
        inicio: emDias(a.de), dur: a.dur, valor: a.valor, avanco: a.avanco, marco: !!a.marco,
      })),
    };

    const rdos = [
      {
        id: "exemplo-rdo-1", projeto_id: projetoId, obra: "Residencial Aurora", data: diaUtilAtras(1),
        clima: { manha: "bom", tarde: "chuvoso" },
        efetivo: [{ funcao: "Pedreiro", qtd: 6 }, { funcao: "Servente", qtd: 8 }, { funcao: "Encarregado", qtd: 1 }],
        atividades: "Alvenaria de vedação do 3º pavimento (eixos A-D). Marcação da primeira fiada concluída nos apartamentos 301 e 302; elevação até a 8ª fiada.",
        ocorrencias: "Chuva a partir das 15h30 — serviço externo interrompido; equipe remanejada para alvenaria interna.",
        obs: "Recebida carga de 4.000 blocos cerâmicos (NF 12.481).", fotos: [],
      },
      {
        id: "exemplo-rdo-2", projeto_id: projetoId, obra: "Residencial Aurora", data: diaUtilAtras(2),
        clima: { manha: "bom", tarde: "bom" },
        efetivo: [{ funcao: "Pedreiro", qtd: 6 }, { funcao: "Servente", qtd: 8 }, { funcao: "Encarregado", qtd: 1 }],
        atividades: "Alvenaria do 3º pavimento (eixos A-D). Chumbamento de contramarcos nas fachadas norte e leste.",
        ocorrencias: "Sem ocorrências.",
        obs: "Conferido esquadro e prumo das paredes do 2º pav. — aprovado pelo encarregado.", fotos: [],
      },
      {
        id: "exemplo-rdo-3", projeto_id: projetoId, obra: "Residencial Aurora", data: diaUtilAtras(5),
        clima: { manha: "nublado", tarde: "bom" },
        efetivo: [{ funcao: "Pedreiro", qtd: 5 }, { funcao: "Servente", qtd: 7 }, { funcao: "Encarregado", qtd: 1 }, { funcao: "Eletricista", qtd: 2 }],
        atividades: "Alvenaria do 2º pavimento finalizada. Início dos eletrodutos embutidos nas paredes do 1º pavimento.",
        ocorrencias: "Falta de energia da concessionária das 09h às 11h — betoneira parada; equipe deslocada para transporte de material.",
        obs: "", fotos: [],
      },
    ];

    const orcamento = {
      id: "exemplo-orc", nome: "Residencial Aurora — orçamento executivo", versao: 2, projeto_id: projetoId, bdi: 22,
      itens: [
        { id: "ex-o1", etapa: "Infraestrutura", descricao: "Estaca hélice contínua D=40 cm, incl. mobilização", un: "m", qtd: 820, valor_unit: 168.4 },
        { id: "ex-o2", etapa: "Superestrutura", descricao: "Concreto usinado fck 30 MPa, lançado e adensado", un: "m³", qtd: 310, valor_unit: 612.5 },
        { id: "ex-o3", etapa: "Superestrutura", descricao: "Aço CA-50 cortado, dobrado e montado", un: "kg", qtd: 28400, valor_unit: 12.9 },
        { id: "ex-o4", etapa: "Superestrutura", descricao: "Fôrma de madeira compensada plastificada, 3 usos", un: "m²", qtd: 3150, valor_unit: 78.2 },
        { id: "ex-o5", etapa: "Vedações", descricao: "Alvenaria de bloco cerâmico 14×19×39, esp. 14 cm", un: "m²", qtd: 4280, valor_unit: 96.7 },
        { id: "ex-o6", etapa: "Cobertura", descricao: "Impermeabilização de laje com manta asfáltica 4 mm", un: "m²", qtd: 620, valor_unit: 128.3 },
        { id: "ex-o7", etapa: "Instalações", descricao: "Ponto de tomada 2P+T 10 A, incl. eletroduto e fiação", un: "un", qtd: 486, valor_unit: 214.6 },
        { id: "ex-o8", etapa: "Acabamentos", descricao: "Revestimento cerâmico de parede, assentado com argamassa AC-II", un: "m²", qtd: 2140, valor_unit: 87.4 },
      ],
    };

    const ativos = [
      {
        id: "exemplo-ativo-1", empreendimento: "Residencial Aurora", unidade: "Área comum", nome: "Elevador social — 8 paradas",
        categoria: "Transporte vertical", fabricante: "(fabricante)", modelo: "Gearless 630 kg", num_serie: "EX-0001",
        local: "Torre única", instalado_em: emDias(-40), garantia_ate: emDias(25),
        especificacoes: [], documentos: [], obs: "Manutenção mensal obrigatória em contrato — NBR NM 207.",
      },
      {
        id: "exemplo-ativo-2", empreendimento: "Residencial Aurora", unidade: "Subsolo", nome: "Bomba de recalque de água potável",
        categoria: "Hidráulica", fabricante: "(fabricante)", modelo: "3 CV trifásica", num_serie: "EX-0002",
        local: "Casa de bombas", instalado_em: emDias(-35), garantia_ate: emDias(330),
        especificacoes: [], documentos: [], obs: "Conjunto com bomba reserva em alternância automática.",
      },
    ];

    const agendamentos = [
      {
        id: "exemplo-age-1", ativo_id: "exemplo-ativo-1", titulo: "Manutenção preventiva mensal do elevador",
        atividade: "Inspeção de cabos, freios, nivelamento e portas conforme contrato e NBR NM 207.",
        data: emDias(12), periodicidade_meses: 1, resp: "Empresa conservadora", status: "agendado", obs: "",
      },
      {
        id: "exemplo-age-2", ativo_id: "exemplo-ativo-2", titulo: "Limpeza do reservatório de água potável",
        atividade: "Limpeza e desinfecção dos reservatórios superior e inferior, com laudo.",
        data: emDias(-3), periodicidade_meses: 6, resp: "Empresa especializada", status: "agendado",
        obs: "Semestral — exigência sanitária; este está VENCIDO de propósito no exemplo.",
      },
    ];

    const garantias = [
      {
        id: "exemplo-gar-1", empreendimento: "Residencial Aurora", sistema: "Impermeabilização",
        descricao: "Impermeabilização de lajes, reservatórios e áreas frias", prazo_anos: 5,
        inicio: emDias(-30), ativo_id: "", fornecedor_id: "", obs: "Prazo do catálogo NBR 17170 — confira o contrato da obra.",
      },
      {
        id: "exemplo-gar-2", empreendimento: "Residencial Aurora", sistema: "Esquadrias",
        descricao: "Esquadrias de alumínio: perfis, fixação e vedação", prazo_anos: 2,
        inicio: emDias(-30), ativo_id: "", fornecedor_id: "", obs: "",
      },
    ];

    return { projetoId, obra: "Residencial Aurora", cronograma, rdos, orcamento, ativos, agendamentos, garantias };
  }

  return { gerar, WBS, INICIO };
})();

if (typeof window !== "undefined") window.EXEMPLO_OBRA = EXEMPLO_OBRA;
if (typeof module !== "undefined" && module.exports) module.exports = { EXEMPLO_OBRA };
