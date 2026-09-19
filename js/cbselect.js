// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Dropdown customizado e acessível. A lista de opções de um <select> nativo é desenhada pelo
// SO e não aceita CSS (cantos, sombra, hover, etc.) — então, onde a lista aberta precisa de
// acabamento, trocamos por este componente. Progressive enhancement: o <select> nativo continua
// no DOM (oculto) como fonte de valor/eventos/form; ao escolher, setamos o valor e disparamos
// 'change' (handlers onchange existentes seguem funcionando). Opt-in: marque com data-cbselect.
// Padrão ARIA combobox+listbox: teclado (setas/Enter/Esc/Home/End), foco e leitor de tela.
// Robusto a mudanças programáticas: um MutationObserver no <select> re-sincroniza opções e o
// estado disabled (ex.: filtro de UF que recria <option>s, regime que desabilita na base estática).
(function () {
  let uid = 0;

  function enhance(sel) {
    if (!sel || sel.tagName !== "SELECT" || sel.dataset.cbselDone === "1") return;
    sel.dataset.cbselDone = "1";
    const id = "cbsel" + ++uid;
    const labelTxt = sel.getAttribute("aria-label") || sel.getAttribute("title") || "";

    sel.classList.add("cb-select-native");           // oculto, mas presente p/ valor/eventos
    sel.setAttribute("tabindex", "-1");
    sel.setAttribute("aria-hidden", "true");

    const wrap = document.createElement("div");
    wrap.className = "cb-select";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cb-select-trigger";
    btn.id = id + "-btn";
    btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-expanded", "false");
    if (labelTxt) btn.setAttribute("aria-label", labelTxt);
    const list = document.createElement("ul");
    list.className = "cb-select-list";
    list.id = id + "-list";
    list.tabIndex = -1;
    list.setAttribute("role", "listbox");
    if (labelTxt) list.setAttribute("aria-label", labelTxt);
    btn.setAttribute("aria-controls", list.id);

    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(btn);
    wrap.appendChild(list);
    wrap.appendChild(sel);

    let open = false, active = 0, opts = [];
    const optionsArr = () => Array.prototype.slice.call(sel.options);
    const labelFor = v => { const o = optionsArr().find(x => x.value === v); return o ? o.textContent : ""; };
    const idxByValue = () => Math.max(0, optionsArr().findIndex(o => o.value === sel.value));

    // (Re)constrói a lista e reflete valor/disabled a partir do <select> nativo (idempotente).
    function sync() {
      opts = optionsArr();
      list.innerHTML = "";
      opts.forEach((o, i) => {
        const li = document.createElement("li");
        li.className = "cb-select-opt";
        li.id = id + "-opt" + i;
        li.setAttribute("role", "option");
        li.dataset.value = o.value;
        li.textContent = o.textContent;
        li.setAttribute("aria-selected", o.value === sel.value ? "true" : "false");
        list.appendChild(li);
      });
      btn.innerHTML = '<span class="cb-select-val"></span><i class="ti ti-chevron-down" aria-hidden="true"></i>';
      btn.querySelector(".cb-select-val").textContent = labelFor(sel.value);
      btn.disabled = sel.disabled;
    }
    sync();

    function position() {
      const r = btn.getBoundingClientRect();
      list.style.minWidth = Math.max(r.width, 150) + "px";
      const lh = list.offsetHeight, lw = list.offsetWidth;
      let left = r.left;
      if (left + lw > window.innerWidth - 8) left = Math.max(8, window.innerWidth - lw - 8);
      list.style.left = Math.round(left) + "px";
      const abaixo = window.innerHeight - r.bottom;
      list.style.top = Math.round((abaixo < lh + 8 && r.top > abaixo) ? r.top - lh - 4 : r.bottom + 4) + "px";
    }
    function markActive(i) {
      active = Math.min(opts.length - 1, Math.max(0, i));
      Array.prototype.forEach.call(list.children, (li, k) => li.classList.toggle("active", k === active));
      const li = list.children[active];
      if (li) { list.setAttribute("aria-activedescendant", li.id); li.scrollIntoView({ block: "nearest" }); }
    }
    function openList() {
      if (open || sel.disabled) return; open = true;
      sync();                              // garante opções/rótulo atuais ao abrir
      btn.setAttribute("aria-expanded", "true");
      wrap.classList.add("open");
      document.body.appendChild(list);     // portal: escapa de overflow e de ancestrais com transform
      list.classList.add("cb-open");
      position(); markActive(idxByValue()); list.focus();
      document.addEventListener("mousedown", onOutside, true);
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onScroll);
    }
    function closeList(focar) {
      if (!open) return; open = false;
      btn.setAttribute("aria-expanded", "false");
      wrap.classList.remove("open");
      list.classList.remove("cb-open");
      list.removeAttribute("aria-activedescendant");
      wrap.appendChild(list);              // devolve a lista ao wrapper
      document.removeEventListener("mousedown", onOutside, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      if (focar && !sel.disabled) btn.focus();
    }
    function choose(i) {
      const o = opts[i]; if (!o) { closeList(true); return; }
      if (sel.value !== o.value) {
        sel.value = o.value;
        sync();
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
      closeList(true);
    }
    function onOutside(e) { if (!wrap.contains(e.target) && !list.contains(e.target)) closeList(false); }
    // reposiciona em vez de fechar: o listener com captura pega scroll de QUALQUER container
    // (ex.: a tabela virtual da SINAPI), e fechar nesses casos seria errado.
    function onScroll() { if (open) position(); }

    btn.addEventListener("click", () => open ? closeList(true) : openList());
    btn.addEventListener("keydown", e => {
      if (["ArrowDown", "ArrowUp", "Enter", " "].indexOf(e.key) >= 0) { e.preventDefault(); openList(); }
    });
    list.addEventListener("keydown", e => {
      if (e.key === "ArrowDown") { e.preventDefault(); markActive(active + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); markActive(active - 1); }
      else if (e.key === "Home") { e.preventDefault(); markActive(0); }
      else if (e.key === "End") { e.preventDefault(); markActive(opts.length - 1); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(active); }
      else if (e.key === "Escape") { e.preventDefault(); closeList(true); }
      else if (e.key === "Tab") { closeList(false); }
    });
    list.addEventListener("click", e => {
      const li = e.target.closest(".cb-select-opt");
      if (li) choose(Array.prototype.indexOf.call(list.children, li));
    });
    sel.addEventListener("change", sync);
    // reflete mudanças programáticas: <option>s recriados (childList) e disabled alternado
    new MutationObserver(() => sync()).observe(sel, { childList: true, attributes: true, attributeFilter: ["disabled"] });
  }

  function enhanceAll(root) {
    const r = root || document;
    if (r.querySelectorAll) r.querySelectorAll("select[data-cbselect]:not([data-cbsel-done])").forEach(enhance);
  }
  function init() {
    enhanceAll(document);
    if (!("MutationObserver" in window)) return;
    new MutationObserver(muts => {
      for (const m of muts) for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.matches && n.matches("select[data-cbselect]")) enhance(n);
        enhanceAll(n);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init);
})();
