// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Inicialização do client Supabase (módulo ES) e orquestração de boot.
// Carregado como <script type="module">. Roda DEPOIS dos scripts clássicos,
// então AUTH/METRICS/initApp já estão definidos quando este módulo executa.
//
const cfg = window.CB_CONFIG || {};

// Carrega o SDK do Supabase, LOCAL-FIRST: o bundle vendorizado (js/vendor/supabase.js, UMD)
// expõe window.supabase e é servido pelo próprio site ('self') — sem depender de CDN em
// runtime. Só se o bundle local faltar, cai para o import dinâmico via esm.sh (com retry),
// que historicamente falhava por instabilidade de rede ("Failed to fetch ... module").
async function importarSDK(tentativas = 3) {
  if (window.supabase && typeof window.supabase.createClient === "function") return window.supabase;
  let ultimoErro;
  for (let i = 0; i < tentativas; i++) {
    try { return await import("https://esm.sh/@supabase/supabase-js@2.45.0"); }
    catch (e) { ultimoErro = e; await new Promise(r => setTimeout(r, 600 * (i + 1))); }
  }
  throw ultimoErro;
}

// a41: marcas de desempenho do boot (performance.getEntriesByName("cb:cbinit")[0].startTime = ms desde o
// início da navegação até o 1º desenho liberado). Servem para medir no aparelho de verdade em vez de
// supor — o relato "às vezes demora a carregar" do PWA não tinha número nenhum.
const marcar = (nome) => { try { performance.mark(nome); } catch (e) { /* sem User Timing: segue */ } };

(async () => {
  marcar("cb:boot-inicio");
  if (cfg.SUPA_READY) {
    try {
      const { createClient } = await importarSDK();
      window.supa = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    } catch (e) {
      console.error("Civilbook: falha ao carregar o SDK Supabase —", e);
      window.supa = null;
    }
  } else {
    window.supa = null;
    console.info("Civilbook: Supabase não configurado — modo local (localStorage).");
  }

  // AUTH.boot() é OTIMISTA (a41): com cache de perfil, resolve com a sessão local (getSession) sem ir
  // à rede e revalida perfil e sessão em 2º plano — nada aqui espera o Supabase para liberar o cbInit.
  try {
    if (typeof AUTH !== "undefined" && AUTH.boot) await AUTH.boot();
  } catch (e) {
    console.error("Civilbook boot:", e);
  }
  marcar("cb:cbinit");
  if (typeof window.cbInit === "function") window.cbInit();
})();
