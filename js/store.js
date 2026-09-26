// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Camada de persistência do Civilbook (Fase 2).
// Sincroniza dados por usuário entre o Supabase (quando logado e configurado) e o
// localStorage (cache offline / modo local). Os módulos leem de um cache em memória
// de forma SÍNCRONA após o load inicial; as escritas são otimistas — atualizam o
// cache na hora e gravam no banco em segundo plano (uma falha de rede nunca trava a UI).
const CBStore = {
  // Há backend configurado E usuário logado? (caso contrário, modo localStorage)
  online() { return typeof AUTH !== "undefined" && AUTH.isSupa() && !!AUTH.session(); },

  // id do usuário atual (uuid do Supabase) ou null
  uid() { const s = (typeof AUTH !== "undefined") && AUTH.session(); return s ? s.id : null; },

  // uuid v4 — usa o nativo quando disponível (https/localhost); senão, gera manualmente
  // (contexto file:// não expõe crypto.randomUUID).
  uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0, v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },

  // Espelho/cache em localStorage (também é o armazenamento do modo local)
  lsGet(key, def) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; }
    catch { return def; }
  },
  lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} },

  // Cartão de "carregando…" exibido enquanto o primeiro fetch do módulo resolve
  loadingCard(msg) {
    const card = `<div class="card" style="margin-bottom:10px">
      <div class="skel" style="height:15px;width:42%;margin-bottom:12px"></div>
      <div class="skel" style="height:10px;width:82%;margin-bottom:7px"></div>
      <div class="skel" style="height:10px;width:64%"></div>
    </div>`;
    return card + card + card;
  },

  // ---- Persistência genérica no Supabase (no-op quando offline/modo local) ----
  // Centralizam o guard online() + tratamento de erro. Escritas são fire-and-forget
  // nos módulos (otimistas): chame sem await para não travar a UI.
  async upsert(table, row, conflict) {
    if (!this.online()) return { skipped: true };
    try {
      const opts = conflict ? { onConflict: conflict } : undefined;
      const { error } = await window.supa.from(table).upsert(row, opts);
      if (error) console.warn("CBStore.upsert " + table + ":", error.message);
      return { error };
    } catch (e) { console.warn("CBStore.upsert " + table + ":", e && e.message); return { error: e }; }
  },
  async remove(table, match) {
    if (!this.online()) return { skipped: true };
    try {
      const { error } = await window.supa.from(table).delete().match(match);
      if (error) console.warn("CBStore.remove " + table + ":", error.message);
      return { error };
    } catch (e) { console.warn("CBStore.remove " + table + ":", e && e.message); return { error: e }; }
  },
  async select(table, columns) {
    if (!this.online()) return { data: null, error: { message: "offline" } };
    try { return await window.supa.from(table).select(columns || "*"); }
    catch (e) { return { data: null, error: e }; }
  }
};

// Os dois singletons centrais são `const` em script clássico — e `const` NÃO cria propriedade em
// window. Todo o resto do app os alcança pela cadeia de escopo, então nada quebrava; mas quem
// avalia código de fora do realm principal (Playwright em page.evaluate, o console de um mundo
// isolado, um bookmarklet) via `window.AUTH` encontrava undefined. Foi o que derrubou 5 specs no
// CI de 16/ago/2026. Mesma linha que projetos.js:935, rdo.js:517 e exemplo.js:226 já tinham.
if (typeof window !== "undefined") window.CBStore = CBStore;
