// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Motores de cálculo. Cada calculadora declara seus campos e uma função compute()
// que recebe os valores e devolve uma lista de resultados { label, value, unit, status? }.
// status: "ok" | "danger" | undefined (neutro).

const CALCULADORAS = [
  // ---------- Estruturas ----------
  {
    id: "viga-biapoiada", grupo: "Estruturas", icone: "ti-line",
    titulo: "Viga biapoiada — esforços máximos",
    sub: "Carga uniformemente distribuída",
    norma: "Estática clássica · NBR 6118",
    campos: [
      { id: "q", label: "Carga distribuída q (kN/m)", valor: 15, hint: "Inclua peso próprio + permanente + acidental" },
      { id: "L", label: "Vão L (m)", valor: 6 }
    ],
    compute: (v) => [
      { label: "Momento máximo (M = qL²/8)", value: (v.q * v.L * v.L / 8).toFixed(2), unit: "kN·m" },
      { label: "Cortante máximo (V = qL/2)", value: (v.q * v.L / 2).toFixed(2), unit: "kN" },
      { label: "Reação em cada apoio", value: (v.q * v.L / 2).toFixed(2), unit: "kN" }
    ]
  },
  {
    id: "flecha-viga", grupo: "Estruturas", icone: "ti-vector-spline",
    titulo: "Flecha de viga biapoiada",
    sub: "Carga distribuída — verificação L/250",
    norma: "NBR 6118 §13.3",
    campos: [
      { id: "q", label: "Carga de serviço q (kN/m)", valor: 12 },
      { id: "L", label: "Vão L (m)", valor: 5 },
      { id: "E", label: "Módulo E (GPa)", valor: 28, hint: "C25 ≈ 28 GPa · C30 ≈ 31 GPa" },
      { id: "b", label: "Base da seção b (cm)", valor: 20 },
      { id: "h", label: "Altura da seção h (cm)", valor: 50 }
    ],
    compute: (v) => {
      const I = (v.b / 100) * Math.pow(v.h / 100, 3) / 12; // m4
      const f = (5 * v.q * Math.pow(v.L, 4)) / (384 * v.E * 1e6 * I) * 1000; // mm
      const flim = v.L * 1000 / 250;
      const ok = f <= flim;
      return [
        { label: "Inércia da seção bruta (I)", value: (I * 1e8).toFixed(0), unit: "cm⁴" },
        { label: "Flecha imediata (5qL⁴/384EI)", value: f.toFixed(2), unit: "mm" },
        { label: "Flecha limite (L/250)", value: flim.toFixed(2), unit: "mm", status: ok ? "ok" : "danger", note: ok ? "Atende ✓" : "Não atende ✗ — aumentar seção" }
      ];
    }
  },
  {
    id: "esbeltez-pilar", grupo: "Estruturas", icone: "ti-rectangle-vertical",
    titulo: "Índice de esbeltez de pilar",
    sub: "Seção retangular — λ = le/i",
    norma: "NBR 6118 §15.8",
    campos: [
      { id: "le", label: "Comprimento equivalente le (cm)", valor: 300 },
      { id: "h", label: "Dimensão da seção na direção analisada h (cm)", valor: 30, hint: "i = h/√12 para seção retangular" }
    ],
    compute: (v) => {
      const i = v.h / Math.sqrt(12);
      const lambda = v.le / i;
      let nota, st;
      if (lambda <= 35) { nota = "λ ≤ 35 — efeitos de 2ª ordem dispensáveis"; st = "ok"; }
      else if (lambda <= 90) { nota = "35 < λ ≤ 90 — método do pilar-padrão aplicável"; st = "ok"; }
      else if (lambda <= 140) { nota = "90 < λ ≤ 140 — método refinado com fluência"; st = undefined; }
      else if (lambda <= 200) { nota = "140 < λ ≤ 200 — método geral obrigatório"; st = undefined; }
      else { nota = "λ > 200 — NÃO PERMITIDO pela NBR 6118"; st = "danger"; }
      return [
        { label: "Raio de giração (i = h/√12)", value: i.toFixed(2), unit: "cm" },
        { label: "Índice de esbeltez (λ)", value: lambda.toFixed(1), unit: "", status: st, note: nota }
      ];
    }
  },
  {
    id: "laje-espessura", grupo: "Estruturas", icone: "ti-square",
    titulo: "Pré-dimensionamento de laje maciça",
    sub: "Estimativa de espessura por vão",
    norma: "NBR 6118 §13.2.4.1 (mínimos)",
    campos: [
      { id: "lx", label: "Menor vão lx (m)", valor: 4 },
      { id: "tipo", label: "Condição", tipo: "select", opcoes: [
        { label: "Laje de piso apoiada (estimativa lx/40)", valor: 40 },
        { label: "Laje em balanço (estimativa lx/10)", valor: 10 }
      ]}
    ],
    compute: (v) => {
      const minNorma = v.tipo === 10 ? 10 : 8; // mínimos usuais: 8 cm piso, 10 cm balanço (simplificado)
      const h = Math.max(v.lx * 100 / v.tipo, minNorma);
      return [
        { label: "Espessura estimada", value: Math.ceil(h).toFixed(0), unit: "cm" },
        { label: "Mínimo normativo aplicável", value: minNorma.toFixed(0), unit: "cm", note: "NBR 6118: 7 cm cobertura · 8 cm piso · 10 cm balanço/veículos" }
      ];
    }
  },
  // ---------- Fundações ----------
  {
    id: "sapata-area", grupo: "Fundações", icone: "ti-stack-2",
    titulo: "Área de sapata isolada",
    sub: "Tensão admissível do solo",
    norma: "NBR 6122",
    campos: [
      { id: "N", label: "Carga vertical de serviço N (kN)", valor: 800 },
      { id: "pp", label: "Acréscimo p/ peso próprio (%)", valor: 5 },
      { id: "sigma", label: "Tensão admissível σadm (kPa)", valor: 200, hint: "Obtida da investigação geotécnica (SPT)" }
    ],
    compute: (v) => {
      const A = v.N * (1 + v.pp / 100) / v.sigma;
      const B = Math.sqrt(A);
      return [
        { label: "Área mínima necessária", value: A.toFixed(2), unit: "m²" },
        { label: "Sapata quadrada — lado B", value: (Math.ceil(B * 20) / 20).toFixed(2), unit: "m", note: "Arredondado para múltiplo de 5 cm" }
      ];
    }
  },
  {
    id: "estaca-capacidade", grupo: "Fundações", icone: "ti-arrow-bar-down",
    titulo: "Capacidade de estaca (estimativa rápida)",
    sub: "Aoki-Velloso simplificado por Nspt médio",
    norma: "NBR 6122 — FS = 2,0",
    campos: [
      { id: "D", label: "Diâmetro da estaca (cm)", valor: 40 },
      { id: "Lp", label: "Comprimento da estaca (m)", valor: 12 },
      { id: "nl", label: "Nspt médio ao longo do fuste", valor: 8 },
      { id: "np", label: "Nspt na ponta", valor: 20 }
    ],
    compute: (v) => {
      // Estimativa expedita (areia argilosa, hélice contínua): atrito ≈ 2,5·Nspt (kPa) limitado, ponta ≈ 100·Nspt (kPa)
      const D = v.D / 100;
      const perim = Math.PI * D;
      const Ap = Math.PI * D * D / 4;
      const ql = Math.min(2.5 * v.nl, 120); // kPa
      const qp = Math.min(100 * v.np, 4000); // kPa
      const Ql = ql * perim * v.Lp;
      const Qp = qp * Ap;
      const Qult = Ql + Qp;
      const Qadm = Qult / 2;
      return [
        { label: "Parcela de atrito lateral", value: Ql.toFixed(0), unit: "kN" },
        { label: "Parcela de ponta", value: Qp.toFixed(0), unit: "kN" },
        { label: "Carga admissível (FS = 2,0)", value: Qadm.toFixed(0), unit: "kN", note: "Estimativa expedita — dimensionar com método completo e sondagem real" }
      ];
    }
  },
  // ---------- Concreto e materiais ----------
  {
    id: "traco-concreto", grupo: "Concreto e materiais", icone: "ti-rotate",
    titulo: "Volume de materiais para concreto",
    sub: "Traço em massa 1 : a : p (cimento : areia : brita)",
    norma: "Referência prática",
    campos: [
      { id: "V", label: "Volume de concreto (m³)", valor: 5 },
      { id: "cons", label: "Consumo de cimento (kg/m³)", valor: 320, hint: "C20 ≈ 280–320 · C25 ≈ 320–360 · C30 ≈ 360–400" },
      { id: "a", label: "Areia (proporção em massa)", valor: 2.3 },
      { id: "p", label: "Brita (proporção em massa)", valor: 2.7 },
      { id: "ac", label: "Relação água/cimento", valor: 0.55 }
    ],
    compute: (v) => {
      const cim = v.V * v.cons;
      return [
        { label: "Cimento", value: Math.ceil(cim / 50).toFixed(0), unit: "sacos 50 kg", note: `${fmtNum(cim, 0)} kg` },
        { label: "Areia (massa)", value: (cim * v.a / 1000).toFixed(2), unit: "t", note: `≈ ${fmtNum(cim * v.a / 1500, 2)} m³ (γ≈1,5 t/m³)` },
        { label: "Brita (massa)", value: (cim * v.p / 1000).toFixed(2), unit: "t", note: `≈ ${fmtNum(cim * v.p / 1450, 2)} m³ (γ≈1,45 t/m³)` },
        { label: "Água", value: (cim * v.ac).toFixed(0), unit: "L" }
      ];
    }
  },
  {
    id: "aco-peso", grupo: "Concreto e materiais", icone: "ti-line-dashed",
    titulo: "Peso de aço por bitola",
    sub: "Barras CA-50/CA-60",
    norma: "NBR 7480",
    campos: [
      { id: "fi", label: "Bitola (mm)", tipo: "select", opcoes: [
        { label: "5,0 mm (0,154 kg/m)", valor: 0.154 },
        { label: "6,3 mm (0,245 kg/m)", valor: 0.245 },
        { label: "8,0 mm (0,395 kg/m)", valor: 0.395 },
        { label: "10,0 mm (0,617 kg/m)", valor: 0.617 },
        { label: "12,5 mm (0,963 kg/m)", valor: 0.963 },
        { label: "16,0 mm (1,578 kg/m)", valor: 1.578 },
        { label: "20,0 mm (2,466 kg/m)", valor: 2.466 },
        { label: "25,0 mm (3,853 kg/m)", valor: 3.853 }
      ]},
      { id: "m", label: "Comprimento total (m)", valor: 120 },
      { id: "perda", label: "Perda/desbitolamento (%)", valor: 10 }
    ],
    compute: (v) => {
      const peso = v.fi * v.m * (1 + v.perda / 100);
      return [
        { label: "Peso total com perdas", value: peso.toFixed(1), unit: "kg" },
        { label: "Barras de 12 m necessárias", value: Math.ceil(v.m * (1 + v.perda / 100) / 12).toFixed(0), unit: "un" }
      ];
    }
  },
  {
    id: "alvenaria-quant", grupo: "Concreto e materiais", icone: "ti-wall",
    titulo: "Quantitativo de alvenaria",
    sub: "Blocos e argamassa por área de parede",
    norma: "Referência prática",
    campos: [
      { id: "area", label: "Área de parede (m²)", valor: 100, hint: "Descontar vãos > 2 m²" },
      { id: "bloco", label: "Tipo de bloco", tipo: "select", opcoes: [
        { label: "Cerâmico 9×19×39 (12,5 un/m²)", valor: 12.5 },
        { label: "Cerâmico 14×19×39 (12,5 un/m²)", valor: 12.5 },
        { label: "Cerâmico 9×19×29 (16,5 un/m²)", valor: 16.5 },
        { label: "Concreto 14×19×39 (12,5 un/m²)", valor: 12.5 }
      ]},
      { id: "perda", label: "Perdas (%)", valor: 8 }
    ],
    compute: (v) => [
      { label: "Blocos necessários", value: Math.ceil(v.area * v.bloco * (1 + v.perda / 100)).toFixed(0), unit: "un" },
      { label: "Argamassa de assentamento", value: (v.area * 0.011).toFixed(2), unit: "m³", note: "≈ 11 L/m² (junta 10–12 mm)" }
    ]
  },
  // ---------- Hidráulica e diversos ----------
  {
    id: "aguas-pluviais", grupo: "Instalações", icone: "ti-cloud-rain",
    titulo: "Vazão de águas pluviais",
    sub: "Q = I·A/60",
    norma: "NBR 10844",
    campos: [
      { id: "A", label: "Área de contribuição (m²)", valor: 120 },
      { id: "I", label: "Intensidade pluviométrica (mm/h)", valor: 150, hint: "Mínimo 150 mm/h para áreas ≤ 100 m²" }
    ],
    compute: (v) => {
      const Q = v.I * v.A / 60;
      let cond;
      if (Q <= 114) cond = "Condutor vertical Ø 75 mm atende (até ~114 L/min)";
      else if (Q <= 247) cond = "Condutor vertical Ø 100 mm atende (até ~247 L/min)";
      else cond = "Necessário Ø 125+ mm ou dividir área entre condutores";
      return [
        { label: "Vazão de projeto", value: Q.toFixed(1), unit: "L/min", note: cond }
      ];
    }
  },
  {
    id: "rampa-acessivel", grupo: "Instalações", icone: "ti-wheelchair",
    titulo: "Rampa acessível",
    sub: "Inclinação e comprimento",
    norma: "NBR 9050 §6.6",
    campos: [
      { id: "h", label: "Desnível a vencer (cm)", valor: 60 },
      { id: "incl", label: "Inclinação adotada (%)", valor: 8.33, hint: "Máx. 8,33% (1:12) para uso geral" }
    ],
    compute: (v) => {
      const L = v.h / (v.incl / 100) / 100;
      const segMax = v.incl > 6.25 ? 0.8 : (v.incl > 5 ? 1.0 : 1.5);
      const nSeg = Math.ceil(v.h / 100 / segMax);
      const okIncl = v.incl <= 8.33;
      return [
        { label: "Comprimento total da rampa", value: L.toFixed(2), unit: "m", status: okIncl ? "ok" : "danger", note: okIncl ? "Inclinação dentro do limite ✓" : "Acima de 8,33% — não permitido ✗" },
        { label: "Segmentos (com patamares)", value: nSeg.toFixed(0), unit: "un", note: `Desnível máx. por segmento a ${fmtNum(v.incl)}%: ${fmtNum(segMax * 100, 0)} cm · patamar mín. 1,20 m` }
      ];
    }
  },
  {
    id: "escada-blondel", grupo: "Estruturas", icone: "ti-stairs",
    titulo: "Escada — fórmula de Blondel",
    sub: "Relação piso/espelho confortável",
    norma: "Blondel: 2e + p ≈ 63–64 cm",
    campos: [
      { id: "h", label: "Altura a vencer (cm)", valor: 280, hint: "pé-direito + laje" },
      { id: "e", label: "Espelho adotado (cm)", valor: 17.5, hint: "usual 16–18 cm" }
    ],
    compute: (v) => {
      const n = Math.max(1, Math.round(v.h / v.e));
      const esp = v.h / n;
      const piso = 63 - 2 * esp;
      const ok = esp >= 16 && esp <= 18.5 && piso >= 25;
      return [
        { label: "Número de espelhos (degraus)", value: n.toFixed(0), unit: "un" },
        { label: "Espelho real (h ÷ n)", value: esp.toFixed(2), unit: "cm" },
        { label: "Piso sugerido (2e + p = 63)", value: piso.toFixed(2), unit: "cm", status: ok ? "ok" : "danger", note: ok ? "Dentro do conforto (Blondel) ✓" : "Fora do conforto — revise o espelho ✗" }
      ];
    }
  },
  // ---------- Financeiro (e14) ----------
  {
    id: "juros-compostos", grupo: "Financeiro", icone: "ti-trending-up",
    titulo: "Juros compostos (montante)",
    sub: "Quanto um capital rende no tempo",
    norma: "Matemática financeira — FV = PV(1+i)ⁿ",
    campos: [
      { id: "PV", label: "Capital inicial PV (R$)", valor: 10000 },
      { id: "i", label: "Taxa por período i (%)", valor: 1, hint: "ex.: 1 = 1% ao mês" },
      { id: "n", label: "Número de períodos n", valor: 12 }
    ],
    compute: (v) => {
      const FV = v.PV * Math.pow(1 + v.i / 100, v.n);
      return [
        { label: "Montante (FV)", value: FV.toFixed(2), unit: "R$" },
        { label: "Juros acumulados", value: (FV - v.PV).toFixed(2), unit: "R$" }
      ];
    }
  },
  {
    id: "taxa-equivalente", grupo: "Financeiro", icone: "ti-percentage",
    titulo: "Taxa de juros equivalente",
    sub: "Converte a taxa entre períodos (juros compostos)",
    norma: "Taxas equivalentes — (1+i)^(t)",
    campos: [
      { id: "i", label: "Taxa informada (%)", valor: 12 },
      { id: "de", label: "Por período de", tipo: "select", opcoes: [{ label: "ano", valor: 12 }, { label: "semestre", valor: 6 }, { label: "trimestre", valor: 3 }, { label: "mês", valor: 1 }] },
      { id: "para", label: "Equivalente a cada", tipo: "select", opcoes: [{ label: "mês", valor: 1 }, { label: "trimestre", valor: 3 }, { label: "semestre", valor: 6 }, { label: "ano", valor: 12 }] }
    ],
    compute: (v) => {
      const ieq = Math.pow(1 + v.i / 100, v.para / v.de) - 1;
      return [{ label: "Taxa equivalente", value: (ieq * 100).toFixed(4), unit: "%", note: "mesma taxa efetiva, em outro período" }];
    }
  },
  {
    id: "price", grupo: "Financeiro", icone: "ti-cash-banknote",
    titulo: "Financiamento — Tabela Price",
    sub: "Parcela fixa (sistema francês)",
    norma: "Price — PMT = PV·i / (1−(1+i)⁻ⁿ)",
    campos: [
      { id: "PV", label: "Valor financiado (R$)", valor: 100000 },
      { id: "i", label: "Taxa ao mês i (%)", valor: 1.2 },
      { id: "n", label: "Parcelas (meses)", valor: 60 }
    ],
    compute: (v) => {
      const i = v.i / 100;
      const PMT = (i === 0) ? v.PV / v.n : v.PV * i / (1 - Math.pow(1 + i, -v.n));
      const total = PMT * v.n;
      return [
        { label: "Parcela mensal (PMT)", value: PMT.toFixed(2), unit: "R$" },
        { label: "Total pago", value: total.toFixed(2), unit: "R$" },
        { label: "Juros totais", value: (total - v.PV).toFixed(2), unit: "R$" }
      ];
    }
  },
  // ---------- Ferramentas (e14): render próprio (sem o padrão campos+compute) ----------
  {
    id: "conversor", grupo: "Ferramentas", icone: "ti-arrows-left-right",
    titulo: "Conversor de unidades",
    sub: "Comprimento, força, pressão, vazão, momento, temperatura…",
    norma: "Conversões SI e usuais de obra",
    render: calcConversorRender
  },
  {
    id: "cientifica", grupo: "Ferramentas", icone: "ti-calculator",
    titulo: "Calculadora científica",
    sub: "Operações + funções (trig, log, potências) · DEG/RAD",
    norma: "—",
    render: calcCientificaRender
  }
];

// ══════════════════════════════════════════════════════════════════════════
// e14 — Conversor de unidades. Fatores em relação à unidade-base SI de cada grandeza
// (valor_base = valor × fator). Temperatura é não-linear → tratada à parte.
// ══════════════════════════════════════════════════════════════════════════
const CONVERSOES = {
  "Comprimento": { "mm": 0.001, "cm": 0.01, "m": 1, "km": 1000, "pol (in)": 0.0254, "pé (ft)": 0.3048 },
  "Área": { "cm²": 0.0001, "m²": 1, "ha": 10000, "km²": 1e6, "alqueire paulista": 24200 },
  "Volume": { "cm³": 1e-6, "L": 0.001, "m³": 1, "galão (US)": 0.00378541 },
  "Massa": { "g": 0.001, "kg": 1, "t": 1000, "lb": 0.45359237 },
  "Força": { "N": 1, "kN": 1000, "kgf": 9.80665, "tf": 9806.65, "lbf": 4.4482216 },
  "Pressão/Tensão": { "Pa": 1, "kPa": 1000, "MPa": 1e6, "N/mm²": 1e6, "kgf/cm²": 98066.5, "kgf/m²": 9.80665, "bar": 1e5, "psi": 6894.757, "atm": 101325 },
  "Momento": { "N·m": 1, "kN·m": 1000, "N·cm": 0.01, "kgf·m": 9.80665, "tf·m": 9806.65 },
  "Vazão": { "m³/s": 1, "m³/h": 1 / 3600, "L/s": 0.001, "L/min": 0.001 / 60, "L/h": 0.001 / 3600 }
};

// Formata um número de saída do conversor em pt-BR, com casas adaptativas (sem fmtNum, que
// preserva as casas de uma string .toFixed — aqui a entrada é número puro).
function fmtConv(n) {
  if (!isFinite(n)) return "—";
  const a = Math.abs(n);
  const dec = a === 0 ? 0 : a >= 100 ? 2 : a >= 1 ? 4 : 6;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: dec });
}

function calcConversorRender(host) {
  const cats = Object.keys(CONVERSOES).concat("Temperatura");
  host.innerHTML = `
    <div class="field"><label>Grandeza</label>
      <select id="cv-cat" class="sinapi-uf">${cats.map(c => `<option>${c}</option>`).join("")}</select></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <div class="field" style="flex:1;min-width:120px"><label>Valor</label><input type="number" id="cv-val" value="1" step="any"></div>
      <div class="field" style="flex:1;min-width:150px"><label>Unidade de origem</label><select id="cv-de" class="sinapi-uf"></select></div>
    </div>
    <div id="cv-res"></div>`;
  const $ = id => document.getElementById(id);
  const unidadesDe = c => c === "Temperatura" ? ["°C", "°F", "K"] : Object.keys(CONVERSOES[c]);
  const popularDe = () => { $("cv-de").innerHTML = unidadesDe($("cv-cat").value).map(u => `<option>${u}</option>`).join(""); };
  const converter = () => {
    const c = $("cv-cat").value, v = parseFloat($("cv-val").value) || 0, de = $("cv-de").value;
    let saida;   // [[unidade, valor]]
    if (c === "Temperatura") {
      const cels = de === "°C" ? v : de === "°F" ? (v - 32) * 5 / 9 : v - 273.15;
      saida = [["°C", cels], ["°F", cels * 9 / 5 + 32], ["K", cels + 273.15]];
    } else {
      const U = CONVERSOES[c], base = v * U[de];
      saida = Object.keys(U).map(u => [u, base / U[u]]);
    }
    $("cv-res").innerHTML = saida.filter(([u]) => u !== de).map(([u, val]) => `
      <div class="result"><div><div class="r-label">${esc(u)}</div></div>
        <div><span class="r-value">${fmtConv(val)}</span><span class="r-unit"> ${esc(u)}</span></div></div>`).join("");
  };
  $("cv-cat").addEventListener("change", () => { popularDe(); converter(); });
  $("cv-val").addEventListener("input", converter);
  $("cv-de").addEventListener("change", converter);
  popularDe(); converter();
}

// Calculadora científica — execução IMEDIATA (sem eval/Function: a CSP do app não permite
// 'unsafe-eval'). Funções unárias aplicam ao visor na hora; +−×÷ e xʸ usam um acumulador.
function calcCientificaRender(host) {
  let disp = "0", acc = null, op = null, fresh = true, deg = true;
  const KEYS = ["C", "⌫", "±", "%", "÷", "sin", "cos", "tan", "xʸ", "×", "ln", "log", "√", "x²", "−", "7", "8", "9", "π", "+", "4", "5", "6", "e", "=", "1", "2", "3", "0", "."];
  host.innerHTML = `
    <div class="sci-head">
      <button class="btn sm" id="sci-deg" title="Alternar graus/radianos">DEG</button>
      <div class="sci-disp" id="sci-disp" aria-live="polite">0</div>
    </div>
    <div class="sci-grid" id="sci-grid">
      ${KEYS.map(k => `<button data-k="${k}" class="sci-key${"+−×÷=xʸ".includes(k) ? " op" : ""}${k === "C" ? " clr" : ""}">${k}</button>`).join("")}
    </div>
    <p class="page-sub" style="font-size:11px;margin:10px 0 0">Trigonometria em <strong id="sci-mode">graus</strong>. Funções (sin, ln, √…) aplicam ao valor no visor.</p>`;
  const show = () => { document.getElementById("sci-disp").textContent = disp; };
  const fmt = n => { if (!isFinite(n)) return "Erro"; const r = Number(n.toPrecision(12)); return String(r); };
  const apply = (o, a, b) => o === "+" ? a + b : o === "−" ? a - b : o === "×" ? a * b : o === "÷" ? a / b : o === "xʸ" ? Math.pow(a, b) : b;
  const binop = (k) => { const cur = parseFloat(disp); if (op !== null && !fresh) { acc = apply(op, acc, cur); disp = fmt(acc); } else { acc = cur; } op = k; fresh = true; };
  const unary = (fn) => { disp = fmt(fn(parseFloat(disp))); fresh = true; };
  const trig = (f) => unary(x => f(deg ? x * Math.PI / 180 : x));
  const press = (k) => {
    if (k >= "0" && k <= "9") { disp = fresh ? k : (disp === "0" ? k : disp + k); fresh = false; }
    else if (k === ".") { if (fresh) { disp = "0."; fresh = false; } else if (!disp.includes(".")) disp += "."; }
    else if (k === "C") { disp = "0"; acc = null; op = null; fresh = true; }
    else if (k === "⌫") { disp = disp.length > 1 ? disp.slice(0, -1) : "0"; if (disp === "-" || disp === "") disp = "0"; }
    else if (k === "±") { disp = fmt(-parseFloat(disp)); }
    else if (k === "%") { disp = fmt(parseFloat(disp) / 100); fresh = true; }
    else if (k === "+" || k === "−" || k === "×" || k === "÷" || k === "xʸ") { binop(k); }
    else if (k === "=") { if (op !== null) { acc = apply(op, acc, parseFloat(disp)); disp = fmt(acc); op = null; fresh = true; } }
    else if (k === "π") { disp = fmt(Math.PI); fresh = true; }
    else if (k === "e") { disp = fmt(Math.E); fresh = true; }
    else if (k === "√") { unary(Math.sqrt); }
    else if (k === "x²") { unary(x => x * x); }
    else if (k === "ln") { unary(Math.log); }
    else if (k === "log") { unary(Math.log10); }
    else if (k === "sin") { trig(Math.sin); }
    else if (k === "cos") { trig(Math.cos); }
    else if (k === "tan") { trig(Math.tan); }
    show();
  };
  document.getElementById("sci-grid").addEventListener("click", e => { const b = e.target.closest("[data-k]"); if (b) press(b.dataset.k); });
  document.getElementById("sci-deg").addEventListener("click", () => {
    deg = !deg;
    document.getElementById("sci-deg").textContent = deg ? "DEG" : "RAD";
    document.getElementById("sci-mode").textContent = deg ? "graus" : "radianos";
  });
  show();
}
