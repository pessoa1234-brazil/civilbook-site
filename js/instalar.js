// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).

// INSTALAR — o convite para o Civilbook virar APLICATIVO na tela inicial.
//
// O PWA já estava completo (manifest.json + sw.js + ícones): quem soubesse instalar, instalava. O
// que faltava era DESCOBERTA — e ela é diferente em cada plataforma, o que é a razão deste arquivo:
//
//   · ANDROID/Chrome dispara `beforeinstallprompt`. Guardamos o evento e o disparamos no clique do
//     usuário (o navegador exige gesto; chamar na hora do evento seria ignorado).
//   · iPHONE/Safari NÃO tem esse evento e nunca terá — a Apple não implementa. Lá o caminho é
//     manual (Compartilhar → Adicionar à Tela de Início) e ninguém descobre sozinho: sem instrução
//     na tela, o app simplesmente não existe para metade dos usuários.
//
// Nada aparece para quem JÁ instalou (display-mode: standalone) nem para quem dispensou o convite.
const INSTALAR = {
  _prompt: null,           // evento beforeinstallprompt guardado até o clique
  _K: "cb-instalar-off",   // dispensado pelo usuário (não insistir)

  /** Já está rodando instalado? Então não há o que oferecer. */
  standalone() {
    try {
      return matchMedia("(display-mode: standalone)").matches ||
             matchMedia("(display-mode: fullscreen)").matches ||
             window.navigator.standalone === true;   // iOS usa esta, fora do padrão
    } catch (e) { return false; }
  },

  /** iPhone/iPad. O iPadOS recente se declara "Macintosh" — daí o teste de toque. */
  ehIOS() {
    const ua = navigator.userAgent || "";
    return /iPad|iPhone|iPod/.test(ua) ||
           (/Macintosh/.test(ua) && typeof document.ontouchend !== "undefined");
  },
  /** No iOS só o Safari instala: Chrome/Firefox/Edge por lá não têm o menu Compartilhar → Adicionar. */
  ehSafariIOS() {
    return this.ehIOS() && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent || "");
  },

  _dispensado() { try { return localStorage.getItem(this._K) === "1"; } catch (e) { return false; } },
  dispensar() {
    try { localStorage.setItem(this._K, "1"); } catch (e) {}
    const el = document.getElementById("instalar-home");
    if (el) el.innerHTML = "";
  },

  /** Chamado uma vez no boot do app (cbInit). Só escuta — quem decide mostrar é o render da Home. */
  iniciar() {
    if (this._ligado) return;
    this._ligado = true;
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();               // suprime o banner nativo; o convite é nosso, no lugar certo
      this._prompt = e;
      this.render();                    // o evento costuma chegar DEPOIS do primeiro render
    });
    window.addEventListener("appinstalled", () => {
      this._prompt = null;
      const el = document.getElementById("instalar-home");
      if (el) el.innerHTML = "";
      if (typeof toast === "function") toast("Civilbook instalado! Abra pelo ícone na tela inicial.", "success");
    });
  },

  /** Tem algo a oferecer nesta plataforma/estado? */
  disponivel() {
    if (this.standalone() || this._dispensado()) return false;
    return !!this._prompt || this.ehSafariIOS();
  },

  // ── UI ────────────────────────────────────────────────────────────────────
  render() {
    const el = document.getElementById("instalar-home");
    if (!el) return;
    if (!this.disponivel()) { el.innerHTML = ""; return; }
    const iOS = !this._prompt && this.ehSafariIOS();
    el.innerHTML = `
      <div class="card" style="margin-bottom:14px;border-left:3px solid var(--blue);display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <i class="ti ti-device-mobile" aria-hidden="true" style="font-size:22px;color:var(--blue)"></i>
        <div style="flex:1;min-width:200px">
          <div style="font-weight:600">Instale o Civilbook no seu celular</div>
          <div class="page-sub" style="margin:0;font-size:13px">Abre em tela cheia, com ícone próprio — e as calculadoras, normas e SINAPI continuam funcionando <strong>sem internet</strong> no canteiro.</div>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0">
          <button class="btn primary" onclick="INSTALAR.${iOS ? "comoNoIphone()" : "instalar()"}"><i class="ti ti-download" aria-hidden="true"></i> ${iOS ? "Como instalar" : "Instalar"}</button>
          <button class="btn" onclick="INSTALAR.dispensar()" title="Não mostrar de novo">Agora não</button>
        </div>
      </div>`;
  },

  /** Android/Chrome: dispara o prompt guardado. Só vale uma vez por evento. */
  async instalar() {
    if (!this._prompt) { this.comoNoIphone(); return; }   // sem evento, resta explicar
    const p = this._prompt;
    this._prompt = null;
    try {
      p.prompt();
      const r = await p.userChoice;
      if (r && r.outcome === "dismissed" && typeof toast === "function") {
        toast("Sem problema — o convite fica na tela inicial do app quando quiser.", "info");
      }
    } catch (e) { /* prompt já usado/expirado */ }
    this.render();
  },

  /** iPhone: instrução passo a passo. É o único caminho — a Apple não expõe API de instalação. */
  comoNoIphone() {
    document.querySelectorAll(".cb-modal-ov").forEach(e => e.remove());
    const ov = document.createElement("div");
    ov.className = "cb-modal-ov";
    ov.onclick = e => { if (e.target === ov) ov.remove(); };
    const passo = (n, txt) => `<li style="margin-bottom:8px">${txt}</li>`;
    ov.innerHTML = `<div class="card cb-modal-box" role="dialog" aria-modal="true" style="max-width:460px">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
        <h3 style="margin:0"><i class="ti ti-device-mobile" aria-hidden="true"></i> Instalar no iPhone</h3>
        <button class="btn icon-only" aria-label="Fechar" onclick="this.closest('.cb-modal-ov').remove()"><i class="ti ti-x"></i></button>
      </div>
      <ol style="margin:14px 0 0;padding-left:20px;font-size:14px;line-height:1.6">
        ${passo(1, "Toque em <strong>Compartilhar</strong> <i class=\"ti ti-share\" aria-hidden=\"true\"></i> na barra do Safari (embaixo).")}
        ${passo(2, "Role a lista e escolha <strong>Adicionar à Tela de Início</strong>.")}
        ${passo(3, "Confirme em <strong>Adicionar</strong>. O ícone do Civilbook aparece junto dos seus apps.")}
      </ol>
      <p class="page-sub" style="font-size:12.5px;margin:14px 0 0"><i class="ti ti-info-circle" aria-hidden="true"></i> No iPhone isso só funciona pelo <strong>Safari</strong> — Chrome e outros navegadores não oferecem a opção.</p>
    </div>`;
    document.body.appendChild(ov);
  },
};
if (typeof window !== "undefined") window.INSTALAR = INSTALAR;
