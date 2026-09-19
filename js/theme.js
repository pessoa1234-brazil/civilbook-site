// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Controle de tema (claro/escuro). O tema inicial já é aplicado por um script
// inline no <head> (evita "flash" antes do CSS). Aqui ficam o toggle, a persistência
// e a sincronização do ícone do botão.
// e30: a preferência passou a seguir a CONTA, não o navegador. Ordem de precedência:
//   escolha na conta (0083)  >  localStorage 'cb-theme'  >  prefers-color-scheme do sistema.
// O localStorage continua sendo o cache que o script anti-flash do <head> lê — é ele que impede
// o "pisca branco" antes do login resolver; a conta corrige logo depois, se divergir.
const THEME = {
  get() { return document.documentElement.dataset.theme === "dark" ? "dark" : "light"; },
  set(t, opcoes) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("cb-theme", t); } catch (e) {}
    this.sync();
    // Escolha do usuário sobe para a conta; aplicação vinda da própria conta não volta (evita
    // um ping-pong de escrita a cada login).
    if (!(opcoes && opcoes.daConta) && typeof AUTH !== "undefined" && AUTH.salvarPreferencia) {
      AUTH.salvarPreferencia("tema", t);
    }
  },
  // Chamada pelo AUTH quando o perfil chega. Sem preferência gravada, NÃO mexe em nada — quem
  // manda segue sendo o cache local / o sistema operacional.
  aplicarDaConta(prefs) {
    const t = prefs && prefs.tema;
    if (t !== "dark" && t !== "light") return;
    if (t === this.get()) { try { localStorage.setItem("cb-theme", t); } catch (e) {} return; }
    this.set(t, { daConta: true });
  },
  toggle() { this.set(this.get() === "dark" ? "light" : "dark"); },
  sync() {
    const dark = this.get() === "dark";
    document.querySelectorAll("[data-theme-toggle]").forEach(b => {
      const i = b.querySelector("i");
      if (i) i.className = "ti " + (dark ? "ti-sun" : "ti-moon-stars");
      b.setAttribute("aria-label", dark ? "Mudar para tema claro" : "Mudar para tema escuro");
      b.title = dark ? "Tema claro" : "Tema escuro";
    });
  }
};
document.addEventListener("DOMContentLoaded", () => THEME.sync());
