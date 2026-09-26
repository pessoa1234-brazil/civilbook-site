// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// CUB multi-UF — carrega os valores R$/m² por estado do Supabase quando disponível e cai
// para a base estática (data/cub.js, Paraná) quando o backend não está configurado/populado.
//
// O catálogo de projetos-padrão (CUB_PROJETOS) é fixo e vem sempre da base estática; só os
// VALORES mudam por UF/competência. Em modo dinâmico busca a lista de valores da UF escolhida
// (RPC cub_valores_uf) e a usa no lugar da estática. Padrão offline-first, igual a SINAPIDB.

const CUBDB = {
  _uf: null,        // UF ativa
  _ufs: null,       // [{uf, competencia, sinduscon, estatico?}] (cache de sessão)
  _valores: null,   // [{projeto, padrao, valor}] da UF ativa
  _meta: null,      // {uf, competencia, sinduscon, fonte, dinamico}
  _readyP: null,    // promessa de boot

  _supaOk() { return !!(typeof window !== "undefined" && window.supa); },
  _ufSalva() { try { return localStorage.getItem("cb-cub-uf"); } catch { return null; } },
  _persist(uf) { try { localStorage.setItem("cb-cub-uf", uf); } catch {} },

  // 'AAAA-MM' → 'MM/AAAA'
  fmtCompet(c) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(c || ""));
    return m ? `${m[2]}/${m[1]}` : (c || "");
  },

  // Monta a string de fonte exibida na tela (UF/competência/sinduscon).
  _fonte(uf, competencia, sinduscon) {
    const ent = sinduscon ? ` (${sinduscon})` : "";
    return `Fonte: CUB/m² ${this.fmtCompet(competencia)}, ${uf}${ent}, conforme ABNT NBR 12.721:2006 — confira a competência/UF do seu projeto`;
  },

  // Base estática (fallback e catálogo).
  _estatico() {
    return {
      uf: (typeof CUB_UF_BASE !== "undefined" ? CUB_UF_BASE : "PR"),
      competencia: (typeof CUB_COMPETENCIA !== "undefined" ? CUB_COMPETENCIA : "2026-03"),
      sinduscon: (typeof CUB_SINDUSCON !== "undefined" ? CUB_SINDUSCON : ""),
      valores: (typeof CUB !== "undefined" ? CUB : []),
      fonte: (typeof CUB_REFERENCIA !== "undefined" ? CUB_REFERENCIA : ""),
      dinamico: false
    };
  },

  // UFs disponíveis: base estática (PR) sempre + as do banco (que vencem a estática quando coincidem).
  async _carregarUFs() {
    if (this._ufs) return this._ufs;
    const base = this._estatico();
    const ufs = [{ uf: base.uf, competencia: base.competencia, sinduscon: base.sinduscon, estatico: true }];
    if (this._supaOk()) {
      try {
        const { data, error } = await window.supa.rpc("cub_ufs");
        if (!error && Array.isArray(data)) {
          data.forEach(r => {
            if (!r || !r.uf) return;
            const i = ufs.findIndex(u => u.uf === r.uf);
            const item = { uf: r.uf, competencia: r.competencia, sinduscon: r.sinduscon || "", estatico: false };
            if (i >= 0) ufs[i] = item; else ufs.push(item);
          });
        }
      } catch { /* offline / tabela ausente → fica só com a base estática */ }
    }
    ufs.sort((a, b) => a.uf.localeCompare(b.uf));
    this._ufs = ufs;
    return ufs;
  },

  // Boot: carrega UFs e aplica a UF salva (ou a base). Idempotente.
  ready() {
    if (this._readyP) return this._readyP;
    this._readyP = (async () => {
      await this._carregarUFs();
      const alvo = this._uf || this._ufSalva() || this._estatico().uf;
      await this.setUF(alvo);
      return this._meta;
    })();
    return this._readyP;
  },

  ufs() {
    const e = this._estatico();
    return this._ufs || [{ uf: e.uf, competencia: e.competencia, sinduscon: e.sinduscon, estatico: true }];
  },
  valores() { return this._valores || (typeof CUB !== "undefined" ? CUB : []); },
  meta() { return this._meta || this._estatico(); },

  // Busca os valores (projeto/padrao/valor) de uma UF na competência vigente.
  async _fetchValoresUF(uf) {
    const { data, error } = await window.supa.rpc("cub_valores_uf", { p_uf: uf });
    if (error) throw error;
    return (data || []).map(r => ({ projeto: r.projeto, padrao: r.padrao, valor: r.valor }));
  },

  // Troca a UF ativa. Base estática (ou sem backend) usa a embutida; senão busca os valores no banco.
  async setUF(uf) {
    const ufs = this._ufs || (await this._carregarUFs());
    const disp = ufs.find(u => u.uf === uf) || ufs.find(u => u.estatico) || ufs[0];

    if (!disp || disp.estatico || !this._supaOk()) {
      const e = this._estatico();
      this._uf = e.uf; this._valores = e.valores; this._meta = e;
      this._persist(e.uf);
      return e;
    }

    try {
      const vals = await this._fetchValoresUF(disp.uf);
      if (!vals.length) throw new Error("sem valores para a UF");
      this._valores = vals;
      this._uf = disp.uf;
      this._meta = {
        uf: disp.uf,
        competencia: disp.competencia,
        sinduscon: disp.sinduscon || "",
        fonte: this._fonte(disp.uf, disp.competencia, disp.sinduscon),
        dinamico: true
      };
      this._persist(disp.uf);
      return this._meta;
    } catch {
      // Falhou a carga dinâmica → volta para a base estática sem quebrar a tela.
      const e = this._estatico();
      this._uf = e.uf; this._valores = e.valores; this._meta = e;
      return e;
    }
  }
};

if (typeof window !== "undefined") window.CUBDB = CUBDB;
