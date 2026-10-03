// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.
importScripts("risco.core.js?v=41524e0");self.onmessage=function(e){try{self.postMessage(self.cbSimularRisco(e.data||{}))}catch(s){self.postMessage({ok:false,erro:String(s&&s.message||s)})}};
