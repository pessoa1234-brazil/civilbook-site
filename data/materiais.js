// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Fichas técnicas de materiais usuais.
const MATERIAIS = [
  {
    nome: "Concreto C20", categoria: "Concreto", icone: "ti-cube",
    specs: { "fck": "20 MPa", "fcd (γc=1,4)": "14,3 MPa", "fctm": "2,2 MPa", "Ecs": "25 GPa", "Uso mínimo": "CAA I", "Norma": "NBR 8953 / NBR 6118" }
  },
  {
    nome: "Concreto C25", categoria: "Concreto", icone: "ti-cube",
    specs: { "fck": "25 MPa", "fcd (γc=1,4)": "17,9 MPa", "fctm": "2,6 MPa", "Ecs": "28 GPa", "Uso mínimo": "CAA II", "Norma": "NBR 8953 / NBR 6118" }
  },
  {
    nome: "Concreto C30", categoria: "Concreto", icone: "ti-cube",
    specs: { "fck": "30 MPa", "fcd (γc=1,4)": "21,4 MPa", "fctm": "2,9 MPa", "Ecs": "31 GPa", "Uso mínimo": "CAA III", "Norma": "NBR 8953 / NBR 6118" }
  },
  {
    nome: "Aço CA-50", categoria: "Aço", icone: "ti-line-dashed",
    specs: { "fyk": "500 MPa", "fyd (γs=1,15)": "434,8 MPa", "Es": "210 GPa", "Alongamento mínimo": "8%", "Bitolas usuais": "6,3 a 40 mm", "Norma": "NBR 7480" }
  },
  {
    nome: "Aço CA-60", categoria: "Aço", icone: "ti-line-dashed",
    specs: { "fyk": "600 MPa", "fyd (γs=1,15)": "521,7 MPa", "Es": "210 GPa", "Alongamento mínimo": "5%", "Bitolas usuais": "4,2 a 9,5 mm", "Norma": "NBR 7480" }
  },
  {
    nome: "Aço ASTM A36 (perfis)", categoria: "Aço", icone: "ti-separator-horizontal",
    specs: { "fy": "250 MPa", "fu": "400 MPa", "E": "200 GPa", "Densidade": "7850 kg/m³", "Uso": "Perfis laminados/soldados", "Norma": "NBR 8800" }
  },
  {
    nome: "Aço ASTM A572 Gr.50", categoria: "Aço", icone: "ti-separator-horizontal",
    specs: { "fy": "345 MPa", "fu": "450 MPa", "E": "200 GPa", "Uso": "Perfis estruturais de alta resistência", "Norma": "NBR 8800" }
  },
  {
    nome: "Bloco cerâmico de vedação 14×19×39", categoria: "Alvenaria", icone: "ti-wall",
    specs: { "Dimensões": "14×19×39 cm", "fbk mínimo": "1,5 MPa", "Peso aproximado": "7 kg/un", "Consumo": "12,5 un/m²", "Norma": "NBR 15270" }
  },
  {
    nome: "Bloco de concreto estrutural 14×19×39", categoria: "Alvenaria", icone: "ti-wall",
    specs: { "Dimensões": "14×19×39 cm", "Classes": "A (≥8 MPa), B (4–8 MPa)", "Peso aproximado": "12,4 kg/un", "Consumo": "12,5 un/m²", "Norma": "NBR 6136" }
  },
  {
    nome: "Cimento CP II-E-32", categoria: "Aglomerantes", icone: "ti-package",
    specs: { "Resistência 28d": "≥ 32 MPa", "Adição": "Escória (6–34%)", "Início de pega": "≥ 1 h", "Uso": "Geral, estruturas correntes", "Norma": "NBR 16697" }
  },
  {
    nome: "Cimento CP V-ARI", categoria: "Aglomerantes", icone: "ti-package",
    specs: { "Resistência 1d": "≥ 14 MPa", "Resistência 28d": "≥ 34 MPa", "Uso": "Desforma rápida, pré-moldados", "Norma": "NBR 16697" }
  },
  {
    nome: "Madeira — Eucalipto citriodora (D40)", categoria: "Madeira", icone: "ti-tree",
    specs: { "fc0,k": "40 MPa", "Ec0,m": "19,5 GPa", "Densidade aparente": "≈ 1000 kg/m³", "Uso": "Estruturas, escoramento", "Norma": "NBR 7190" }
  },
  {
    nome: "Manta asfáltica 3 mm (Tipo III)", categoria: "Impermeabilização", icone: "ti-layers-subtract",
    specs: { "Espessura": "3 mm", "Estrutura": "Poliéster", "Uso": "Lajes, calhas, jardineiras", "Aplicação": "Maçarico", "Norma": "NBR 9952" }
  },
  {
    nome: "Argamassa colante AC-III", categoria: "Argamassas", icone: "ti-package",
    specs: { "Aderência 28d": "≥ 1,0 MPa", "Tempo em aberto": "≥ 20 min", "Uso": "Fachadas, piscinas, porcelanato externo", "Norma": "NBR 14081" }
  }
];
