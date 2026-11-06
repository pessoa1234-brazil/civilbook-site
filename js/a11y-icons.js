// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.
(function(){function o(e){if(!e||!e.querySelectorAll)return;var t=e.querySelectorAll("i.ti:not([aria-hidden])");for(var r=0;r<t.length;r++)t[r].setAttribute("aria-hidden","true")}function d(){o(document);if(!("MutationObserver"in window))return;new MutationObserver(function(e){for(var t=0;t<e.length;t++){var r=e[t].addedNodes;for(var n=0;n<r.length;n++){var i=r[n];if(i.nodeType!==1)continue;if(i.matches&&i.matches("i.ti")&&!i.hasAttribute("aria-hidden"))i.setAttribute("aria-hidden","true");o(i)}}}).observe(document.body,{childList:true,subtree:true})}if(document.body)d();else document.addEventListener("DOMContentLoaded",d)})();
