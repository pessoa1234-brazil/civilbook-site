// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// e17 — Web Worker: roda o Monte Carlo FORA da thread principal (não trava a UI).
// Importa o núcleo puro (mesmo código do fallback inline). Caminho relativo à URL do
// worker (js/) → js/risco.core.js. CSP: same-origin, coberto por worker-src/script-src 'self'.
importScripts("risco.core.js?v=cd8b896");

self.onmessage = function (e) {
  try {
    self.postMessage(self.cbSimularRisco(e.data || {}));
  } catch (err) {
    self.postMessage({ ok: false, erro: String((err && err.message) || err) });
  }
};
