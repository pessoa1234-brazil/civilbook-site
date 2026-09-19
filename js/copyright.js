// Civilbook — Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.). Todos os direitos reservados.
// d12 — watermark discreto de copyright no console (valor PROBATORIO; nao bloqueia nada).
// Aparece no DevTools de quem inspeciona o app servido. Sem PII, sem efeito na UX.
(function () {
  try {
    var ANO = 2026;                          // ano de criacao (fixo p/ valor probatorio)
    var TITULAR = "CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.)";
    var atual = new Date().getFullYear();
    var faixa = atual > ANO ? ANO + "–" + atual : String(ANO);   // 2026 ou 2026–<ano atual>
    console.log("%cCivilbook", "font:700 16px system-ui;color:#185FA5");
    console.log(
      "%c© " + faixa + " " + TITULAR + " — código proprietário. Todos os direitos reservados.%c\n" +
      "Uso, cópia ou redistribuição não autorizados são vedados (Lei 9.609/98 e 9.610/98). Ver LICENSE.",
      "color:#6B6A65;font-weight:600", "color:#9C9B94"
    );
  } catch (e) {}
})();
if (typeof window !== "undefined") window.CB_COPYRIGHT = { titular: "CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.)", ano: 2026 };
