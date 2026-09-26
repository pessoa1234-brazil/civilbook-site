// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Utilidades de UI: toasts (avisos não bloqueantes) e esqueletos de carregamento.

// toast(mensagem, tipo) — tipo: "info" | "success" | "error" | "warn".
// Usa textContent na mensagem (à prova de XSS). Some sozinho.
function toast(msg, tipo) {
  let host = document.getElementById("cb-toasts");
  if (!host) {
    host = document.createElement("div");
    host.id = "cb-toasts";
    host.className = "cb-toasts";
    document.body.appendChild(host);
  }
  const icones = { info: "ti-info-circle", success: "ti-circle-check", error: "ti-alert-circle", warn: "ti-alert-triangle" };
  const el = document.createElement("div");
  el.className = "cb-toast cb-toast-" + (tipo || "info");
  el.setAttribute("role", "status");
  el.innerHTML = `<i class="ti ${icones[tipo] || icones.info}"></i><span></span>`;
  el.querySelector("span").textContent = msg;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  const fechar = () => { el.classList.remove("show"); setTimeout(() => el.remove(), 250); };
  el.addEventListener("click", fechar);
  setTimeout(fechar, 3400);
}

// cbConfirmar(mensagem, opcoes) → Promise<boolean> — a confirmação da casa (a15).
// SUBSTITUI window.confirm(), que é suprimido no navegador embutido do preview (o diálogo nem
// aparece e confirm() devolve false: o botão "não funciona" e ninguém vê erro — achado de campo em
// 15/ago/2026, na validação do manual da f64) e é frágil em PWA standalone/iOS e em WebView.
// Opções: {titulo, ok, cancelar, perigo:boolean, detalhe}. Foco inicial no CANCELAR, Esc e clique
// fora cancelam, Enter confirma. Texto por textContent (à prova de XSS) — mensagem com \n vira
// parágrafo. Nunca resolve duas vezes.
function cbConfirmar(mensagem, opcoes) {
  const o = opcoes || {};
  // PERIGO por inferência: as ~27 chamadas herdadas do confirm() passavam só a frase. Em vez de
  // reescrever cada uma (e esquecer alguma), o tom sai do próprio texto — quem quiser manda
  // {perigo:false} explícito. Verbo destrutivo no começo OU aviso de irreversibilidade.
  const txt = String(mensagem || "");
  const perigo = typeof o.perigo === "boolean" ? o.perigo
    : /^(excluir|remover|apagar|expurgar|deletar)\b/i.test(txt.trim()) || /não há como desfazer|nao ha como desfazer|não pode ser desfeita|nao pode ser desfeita|irrevers/i.test(txt);
  return new Promise((resolve) => {
    const ov = document.createElement("div");
    ov.className = "cb-modal-ov";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.innerHTML = `<div class="card cb-modal-box cb-confirm">
      <strong class="cb-confirm-tit"></strong>
      <div class="cb-confirm-msg"></div>
      <p class="page-sub cb-confirm-det" style="font-size:12px;margin:6px 0 0"></p>
      <div class="cb-confirm-acoes">
        <button type="button" class="btn" data-cb="nao"></button>
        <button type="button" class="btn ${perigo ? "danger" : "primary"}" data-cb="sim"></button>
      </div>
    </div>`;
    const tit = ov.querySelector(".cb-confirm-tit");
    tit.textContent = o.titulo || (perigo ? "Confirmar exclusão" : "Confirmar");
    // cada linha da mensagem vira um parágrafo (as mensagens antigas do confirm usavam \n\n)
    const msg = ov.querySelector(".cb-confirm-msg");
    String(mensagem || "").split("\n").forEach((linha) => {
      const p = document.createElement("p");
      p.textContent = linha;
      p.style.margin = linha.trim() ? "8px 0 0" : "4px 0 0";
      msg.appendChild(p);
    });
    const det = ov.querySelector(".cb-confirm-det");
    if (o.detalhe) det.textContent = o.detalhe; else det.remove();
    const bSim = ov.querySelector('[data-cb="sim"]');
    const bNao = ov.querySelector('[data-cb="nao"]');
    bSim.textContent = o.ok || (perigo ? "Excluir" : "Confirmar");
    bNao.textContent = o.cancelar || "Cancelar";

    let vivo = true;
    const antes = document.activeElement;
    const fim = (r) => {
      if (!vivo) return;
      vivo = false;
      document.removeEventListener("keydown", tecla, true);
      ov.remove();
      if (antes && antes.focus) { try { antes.focus(); } catch { /* elemento pode ter sumido */ } }
      resolve(r);
    };
    const tecla = (e) => {
      // stopPropagation é OBRIGATÓRIO: app.js tem um Esc global que remove TODO .cb-modal-ov —
      // sem ele, o Esc num confirm aberto POR CIMA de outro modal (ex.: publicar versão dentro do
      // modal do Repositório) fecharia os dois e o usuário perderia o formulário. Handler de
      // captura + stopPropagation = o evento nunca chega ao global.
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fim(false); }
      else if (e.key === "Enter" && document.activeElement !== bNao) { e.preventDefault(); e.stopPropagation(); fim(true); }
      else if (e.key === "Tab") {   // laço de foco: só os dois botões
        e.preventDefault();
        (document.activeElement === bNao ? bSim : bNao).focus();
      }
    };
    ov.addEventListener("click", (e) => { if (e.target === ov) fim(false); });
    bSim.addEventListener("click", () => fim(true));
    bNao.addEventListener("click", () => fim(false));
    document.addEventListener("keydown", tecla, true);
    document.body.appendChild(ov);
    requestAnimationFrame(() => bNao.focus());   // o seguro é o padrão
  });
}
if (typeof window !== "undefined") window.cbConfirmar = cbConfirmar;

// Esqueletos de carregamento (placeholders animados).
const UI = {
  // n cartões empilhados (para listas)
  skelCards(n) {
    const card = `<div class="card" style="margin-bottom:10px">
      <div class="skel" style="height:15px;width:42%;margin-bottom:12px"></div>
      <div class="skel" style="height:10px;width:82%;margin-bottom:7px"></div>
      <div class="skel" style="height:10px;width:64%"></div>
    </div>`;
    return card.repeat(n || 3);
  },
  // linha horizontal de cartões (para a tela inicial / recomendações)
  skelRow(n) {
    const c = `<div class="reco-card"><div class="skel" style="height:36px;width:36px;border-radius:10px;margin-bottom:10px"></div>
      <div class="skel" style="height:12px;width:90%;margin-bottom:6px"></div>
      <div class="skel" style="height:10px;width:60%"></div></div>`;
    return `<div class="reco-row">${c.repeat(n || 5)}</div>`;
  }
};
