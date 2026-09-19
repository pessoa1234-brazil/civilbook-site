// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// SINAPI multi-UF — carrega preços por estado do Supabase quando disponível e cai para
// a base estática (data/sinapi.js, Paraná) quando o backend não está configurado/populado.
//
// O catálogo (código, descrição, categoria, grupo, unidade) é UF-independente e vem sempre
// da base estática embarcada; só o PREÇO muda por UF/competência/regime. Em modo dinâmico,
// busca um mapa código→preço da UF+regime escolhidos (regime SD = sem desoneração, CD = com
// desoneração, SE = sem encargos sociais) e o sobrepõe no catálogo — assim a busca global e o
// índice normalizado (_sinapiNorm), que dependem de código+descrição, seguem válidos sem
// recomputar. Também expõe composicao(codigo): o detalhamento analítico de um serviço (custo
// de material × mão de obra × equipamento, por insumo). Padrão offline-first, igual a MNT.

// Base de dados SINAPI (data/sinapi.js, ~1,7 MB) carregada SOB DEMANDA — só quando a aba SINAPI
// abre ou a busca precisa. Mantém o boot do app leve (não baixa 1,7 MB em toda visita).
let _sinapiDadosP = null;
function ensureSinapiData() {
  if (typeof SINAPI !== "undefined") return Promise.resolve();
  if (_sinapiDadosP) return _sinapiDadosP;
  _sinapiDadosP = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "data/sinapi.js";
    s.onload = () => resolve();
    s.onerror = () => { _sinapiDadosP = null; reject(new Error("falha ao carregar a base SINAPI")); };
    document.head.appendChild(s);
  });
  return _sinapiDadosP;
}
if (typeof window !== "undefined") window.ensureSinapiData = ensureSinapiData;

const SINAPIDB = {
  _uf: null,        // UF ativa
  _regime: null,    // regime de encargos ativo: 'SD' (sem deso.) | 'CD' (com deso.) | 'SE'
  _ufs: null,       // [{uf, competencia, estatico?}] disponíveis (cache de sessão)
  _lista: null,     // lista ativa: catálogo estático com preço da UF ativa
  _meta: null,      // {uf, competencia, regime, desonerado, fonte, dinamico}
  _readyP: null,    // promessa de boot (carrega UFs + aplica UF salva)

  _supaOk() { return !!(typeof window !== "undefined" && window.supa); },
  _ufSalva() { try { return localStorage.getItem("cb-sinapi-uf"); } catch { return null; } },
  _persist(uf) { try { localStorage.setItem("cb-sinapi-uf", uf); } catch {} },
  _regimeSalvo() { try { return localStorage.getItem("cb-sinapi-regime"); } catch { return null; } },
  _persistRegime(r) { try { localStorage.setItem("cb-sinapi-regime", r); } catch {} },
  regime() { return this._regime || "SD"; },
  _regimeLabel(r) { return r === "CD" ? "com desoneração" : r === "SE" ? "sem encargos sociais" : "sem desoneração"; },

  // Agrupa um item do analítico em Material / Mão de obra / Equipamento / Serviços /
  // Composições auxiliares. A mão de obra na SINAPI aparece como insumos "MAO DE OBRA" e
  // também como composições auxiliares "... COM ENCARGOS COMPLEMENTARES" (servente, pedreiro…).
  _grupoItem(tipo, classifOuDesc) {
    if (tipo === "COMPOSICAO") return /encargos\s+complementares/i.test(classifOuDesc || "") ? "Mão de obra" : "Composições auxiliares";
    const u = String(classifOuDesc || "").toUpperCase();
    if (u.indexOf("MATERIAL") >= 0) return "Material";
    if (u.indexOf("MAO DE OBRA") >= 0 || u.indexOf("MÃO DE OBRA") >= 0 || u.indexOf("ENCARGO") >= 0) return "Mão de obra";
    if (u.indexOf("EQUIPAMENTO") >= 0) return "Equipamento";
    if (u.indexOf("SERVI") >= 0) return "Serviços";
    return "Outros";
  },

  // 'AAAA-MM' → 'MM/AAAA' para exibição
  fmtCompet(c) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(c || ""));
    return m ? `${m[2]}/${m[1]}` : (c || "");
  },

  // Base estática (fallback e catálogo de descrições).
  _estatico() {
    return {
      uf: (typeof SINAPI_UF_BASE !== "undefined" ? SINAPI_UF_BASE : "PR"),
      competencia: (typeof SINAPI_COMPETENCIA !== "undefined" ? SINAPI_COMPETENCIA : "2026-05"),
      lista: SINAPI,
      fonte: (typeof SINAPI_REFERENCIA !== "undefined" ? SINAPI_REFERENCIA : ""),
      desonerado: false,
      regime: "SD",
      dinamico: false,
    };
  },

  // Monta a lista de UFs: a base estática (PR) sempre disponível + as do banco (que vencem
  // a estática quando coincidem, por terem competência mais recente).
  async _carregarUFs() {
    if (this._ufs) return this._ufs;
    const base = this._estatico();
    const ufs = [{ uf: base.uf, competencia: base.competencia, estatico: true }];
    if (this._supaOk()) {
      try {
        const { data, error } = await window.supa.rpc("sinapi_ufs");
        if (!error && Array.isArray(data)) {
          data.forEach(r => {
            if (!r || !r.uf) return;
            const i = ufs.findIndex(u => u.uf === r.uf);
            const item = { uf: r.uf, competencia: r.competencia, estatico: false };
            if (i >= 0) ufs[i] = item; else ufs.push(item);
          });
        }
      } catch { /* offline / tabela ausente → fica só com a base estática */ }
    }
    ufs.sort((a, b) => a.uf.localeCompare(b.uf));
    this._ufs = ufs;
    return ufs;
  },

  // Boot: carrega UFs e aplica a UF/regime salvos (ou a base). Idempotente.
  ready() {
    if (this._readyP) return this._readyP;
    this._readyP = (async () => {
      await ensureSinapiData();   // garante a base estática carregada (lazy)
      await this._carregarUFs();
      this._regime = this._regime || this._regimeSalvo() || "SD";
      const alvo = this._uf || this._ufSalva() || this._estatico().uf;
      await this.setUF(alvo);
      return this._meta;
    })();
    return this._readyP;
  },

  ufs() { return this._ufs || [{ uf: this._estatico().uf, competencia: this._estatico().competencia, estatico: true }]; },
  lista() { return this._lista || SINAPI; },
  meta() { return this._meta || this._estatico(); },

  // Busca paginada do mapa código→custo de uma UF/competência/regime. O PostgREST limita
  // a 1000 linhas por resposta, então percorremos em páginas (ordenado por código p/ não
  // pular/duplicar). ~10,4k composições ≈ 11 páginas.
  async _fetchPrecosUF(uf, competencia, regime) {
    const PAGE = 1000, mapa = new Map();
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await window.supa
        .from("sinapi_comp_precos").select("codigo,custo")
        .eq("uf", uf).eq("regime", regime).eq("competencia", competencia)
        .order("codigo").range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || !data.length) break;
      // custo 0 = hífen na SINAPI (composição sem custo calculável) → tratamos como "sem preço".
      for (let i = 0; i < data.length; i++) mapa.set(data[i].codigo, data[i].custo || null);
      if (data.length < PAGE) break;
    }
    return mapa;
  },

  // Troca a UF ativa. Para a UF estática (ou sem backend) usa a base embutida; senão busca
  // os preços da UF no banco e sobrepõe no catálogo. Sempre resolve para um estado válido.
  async setUF(uf) {
    const ufs = this._ufs || (await this._carregarUFs());
    const disp = ufs.find(u => u.uf === uf) || ufs.find(u => u.estatico) || ufs[0];

    if (!disp || disp.estatico || !this._supaOk()) {
      const e = this._estatico();
      this._uf = e.uf; this._lista = e.lista; this._meta = e;
      this._persist(e.uf);
      return e;
    }

    try {
      const regime = this._regime || "SD";
      const mapa = await this._fetchPrecosUF(disp.uf, disp.competencia, regime);
      if (!mapa.size) throw new Error("sem preços para a UF");
      this._lista = SINAPI.map(s => ({ ...s, preco: mapa.has(s.codigo) ? mapa.get(s.codigo) : null }));
      this._uf = disp.uf;
      this._meta = {
        uf: disp.uf,
        competencia: disp.competencia,
        regime: regime,
        desonerado: regime === "CD",
        fonte: `Fonte oficial: SINAPI ${this.fmtCompet(disp.competencia)}, ${disp.uf}, ${this._regimeLabel(regime)} — confira a competência/UF do seu projeto`,
        dinamico: true,
      };
      this._persist(disp.uf);
      return this._meta;
    } catch {
      // Falhou a carga dinâmica → volta para a base estática sem quebrar a tela.
      const e = this._estatico();
      this._uf = e.uf; this._lista = e.lista; this._meta = e;
      return e;
    }
  },

  // Troca o regime de encargos (SD/CD/SE) e recarrega os preços da UF ativa.
  async setRegime(regime) {
    this._regime = regime;
    this._persistRegime(regime);
    return this.setUF(this._uf || this._ufSalva() || this._estatico().uf);
  },

  // Detalhamento analítico de uma composição na UF/regime/competência ativos: lista de itens
  // (insumos e composições auxiliares) com coeficiente, preço unitário e custo, já classificados
  // por grupo (Material/Mão de obra/Equipamento/…). Só em modo dinâmico (precisa do banco).
  // Calculado no cliente a partir das tabelas oficiais já carregadas (analítico + insumos +
  // preços por UF/regime). A soma pode diferir do preço sintético publicado: nem todo insumo
  // tem preço coletado na UF (a SINAPI completa o custo por representatividade/%AS).
  async composicao(codigo) {
    if (!this._supaOk() || !this.meta().dinamico) return { disponivel: false };
    const uf = this._uf, regime = this._regime || "SD", comp = this.meta().competencia;
    const an = await window.supa.from("sinapi_analitico")
      .select("seq,tipo_item,item_codigo,descricao,unidade,coeficiente")
      .eq("comp_codigo", codigo).eq("competencia", comp).order("seq");
    if (an.error) throw an.error;
    const rows = (an.data || []).filter(r => r.tipo_item && r.item_codigo);
    if (!rows.length) return { disponivel: true, vazio: true, uf, regime, competencia: comp };
    const insCods = [...new Set(rows.filter(r => r.tipo_item === "INSUMO").map(r => r.item_codigo))];
    const compCods = [...new Set(rows.filter(r => r.tipo_item === "COMPOSICAO").map(r => r.item_codigo))];
    const cls = {}, preco = {};
    if (insCods.length) {
      const [ci, pi] = await Promise.all([
        window.supa.from("sinapi_insumos").select("codigo,classificacao").in("codigo", insCods),
        window.supa.from("sinapi_insumo_precos").select("codigo,preco")
          .eq("uf", uf).eq("regime", regime).eq("competencia", comp).in("codigo", insCods)
      ]);
      (ci.data || []).forEach(r => { cls[r.codigo] = r.classificacao; });
      (pi.data || []).forEach(r => { preco["I" + r.codigo] = r.preco; });
    }
    if (compCods.length) {
      const pc = await window.supa.from("sinapi_comp_precos").select("codigo,custo")
        .eq("uf", uf).eq("regime", regime).eq("competencia", comp).in("codigo", compCods);
      (pc.data || []).forEach(r => { preco["C" + r.codigo] = r.custo; });
    }
    const itens = rows.map(r => {
      const isI = r.tipo_item === "INSUMO";
      const unit = isI ? (preco["I" + r.item_codigo] ?? null) : (preco["C" + r.item_codigo] ?? null);
      const grupo = isI ? this._grupoItem("INSUMO", cls[r.item_codigo]) : this._grupoItem("COMPOSICAO", r.descricao);
      const custo = unit == null ? null : +(r.coeficiente * unit).toFixed(4);
      return { tipo: r.tipo_item, codigo: r.item_codigo, descricao: r.descricao, unidade: r.unidade, coeficiente: r.coeficiente, preco: unit, custo, grupo, semPreco: unit == null };
    });
    return { disponivel: true, itens, uf, regime, competencia: comp };
  }
};

if (typeof window !== "undefined") window.SINAPIDB = SINAPIDB;
