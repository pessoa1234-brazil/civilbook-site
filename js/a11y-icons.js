// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Acessibilidade: os ícones de fonte (Tabler, `<i class="ti …">`) são puramente
// decorativos. Marcamos TODOS com aria-hidden="true" para que:
//   (1) o glifo PUA do ::before não entre no "accessible name" do controle — isso
//       confunde leitores de tela e quebra seletores por nome (ex.: Playwright
//       getByRole, que foi o que derrubou o teste c4); e
//   (2) leitores de tela não anunciem o glifo.
// O nome acessível de cada controle vem do texto visível ou de aria-label/title —
// nunca do ícone. Cobre ícones estáticos (passada inicial) e os renderizados
// dinamicamente pela SPA (MutationObserver). Carregado em todas as páginas.
(function () {
  function ocultar(raiz) {
    if (!raiz || !raiz.querySelectorAll) return;
    var ic = raiz.querySelectorAll('i.ti:not([aria-hidden])');
    for (var i = 0; i < ic.length; i++) ic[i].setAttribute("aria-hidden", "true");
  }

  function iniciar() {
    ocultar(document);                       // ícones já presentes no HTML
    if (!("MutationObserver" in window)) return;
    new MutationObserver(function (muts) {   // ícones inseridos depois (renders da SPA)
      for (var i = 0; i < muts.length; i++) {
        var add = muts[i].addedNodes;
        for (var j = 0; j < add.length; j++) {
          var n = add[j];
          if (n.nodeType !== 1) continue;      // só elementos
          if (n.matches && n.matches("i.ti") && !n.hasAttribute("aria-hidden")) n.setAttribute("aria-hidden", "true");
          ocultar(n);                          // ícones descendentes do nó inserido
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) iniciar();
  else document.addEventListener("DOMContentLoaded", iniciar);
})();
