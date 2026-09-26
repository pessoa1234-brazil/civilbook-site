// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Módulo Compras (PRO) — companheiro de solicitação de compra.
// Aba "Por item": item solicitado -> pergunta de verificação + complementares.
// Aba "Por serviço": serviço -> materiais/equipamentos necessários (sim/não).

function renderCompras(aba) {
  if (!planoEhPro()) return renderComprasUpsell();
  aba = aba || "item";
  const abas = [
    { id: "item", label: "Por item solicitado", icone: "ti-shopping-cart" },
    { id: "servico", label: "Por serviço", icone: "ti-tools" }
  ];
  app.innerHTML = `
    <h2 class="page-title">Compras — conferência do pedido</h2>
    <p class="page-sub">Antes de fechar a solicitação, confira os itens que costumam ir junto. Muitas compras chegam incompletas porque o complemento foi esquecido.</p>
    <div class="tabs-bar">
      ${abas.map(a => `<button class="${a.id === aba ? "active" : ""}" onclick="navigate('compras','${a.id}')"><i class="ti ${a.icone}"></i>${a.label}</button>`).join("")}
    </div>
    <div id="cmp-body"></div>
    <div id="cmp-afil" class="cb-afil" style="max-width:760px"></div>`;
  if (aba === "servico") renderComprasServico();
  else renderComprasItem();
  // d11: ferramentas/medição recomendadas (afiliado) — alta intenção de compra aqui. No-op se off.
  if (typeof AFIL !== "undefined") AFIL.bloco("cmp-afil", "ferramentas", { titulo: "Ferramentas e medição recomendadas" });
}

function renderComprasUpsell() {
  app.innerHTML = `
    <div class="card" style="max-width:560px;margin:40px auto;text-align:center;padding:36px">
      <div class="card-icon" style="background:var(--teal-light);color:var(--teal);margin:0 auto 16px"><i class="ti ti-shopping-cart"></i></div>
      <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">Conferência de compras é um recurso PRO</h2>
      <p style="color:var(--text-2);margin-bottom:20px">Evite pedidos incompletos: veja os itens complementares de cada material e os materiais necessários por serviço, antes de comprar.</p>
      ${typeof cbTesteBotaoHTML === "function" ? cbTesteBotaoHTML('compras', null, 'btn primary lg') : ""}
    </div>`;
}

// ---------- Aba: por item solicitado ----------
function renderComprasItem() {
  document.getElementById("cmp-body").innerHTML = `
    <div class="card" style="max-width:620px">
      <div class="field">
        <label>Item solicitado</label>
        <select id="cmp-item" onchange="verificarCompraItem()">
          <option value="">— selecione o que foi pedido —</option>
          ${COMPRAS_ITENS.map(i => `<option value="${i.id}">${esc(i.item)}</option>`).join("")}
        </select>
      </div>
    </div>
    <div id="cmp-result" style="margin-top:14px;max-width:760px"></div>`;
}

function verificarCompraItem() {
  const id = document.getElementById("cmp-item").value;
  const el = document.getElementById("cmp-result");
  const it = COMPRAS_ITENS.find(x => x.id === id);
  if (!it) { el.innerHTML = ""; return; }
  el.innerHTML = `
    <div class="card" style="border-left:4px solid var(--blue)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <i class="ti ti-shopping-cart" style="color:var(--blue)"></i>
        <h3 style="margin:0">${esc(it.item)}</h3>
      </div>
      <div class="result" style="background:var(--amber-light);border-radius:8px;padding:10px 12px;margin-bottom:12px">
        <strong><i class="ti ti-help-circle"></i> Pergunte antes de fechar a compra:</strong><br>${esc(it.pergunta)}
      </div>
      <p style="font-size:13px;color:var(--text-2);margin-bottom:6px">Itens que costumam ser necessários junto — marque os que já estão no pedido:</p>
      <ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px">
        ${it.complementares.map(c => itemCheck(c)).join("")}
      </ul>
    </div>`;
}

// ---------- Aba: por serviço ----------
function renderComprasServico() {
  document.getElementById("cmp-body").innerHTML = `
    <div class="card" style="max-width:620px">
      <div class="field">
        <label>Serviço a executar</label>
        <select id="cmp-serv" onchange="verificarCompraServico()">
          <option value="">— selecione o serviço —</option>
          ${COMPRAS_SERVICOS.map(s => `<option value="${s.id}">${esc(s.servico)}</option>`).join("")}
        </select>
      </div>
    </div>
    <div id="cmp-result" style="margin-top:14px;max-width:760px"></div>`;
}

function verificarCompraServico() {
  const id = document.getElementById("cmp-serv").value;
  const el = document.getElementById("cmp-result");
  const s = COMPRAS_SERVICOS.find(x => x.id === id);
  if (!s) { el.innerHTML = ""; return; }
  el.innerHTML = `
    <div class="card" style="border-left:4px solid var(--teal)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <i class="ti ti-tools" style="color:var(--teal)"></i>
        <h3 style="margin:0">${esc(s.servico)}</h3>
      </div>
      <p style="font-size:12.5px;color:var(--text-3);margin-bottom:10px">Materiais necessários (sem unidade nem valor — confira se estão na compra).</p>
      <ul style="list-style:none;margin:0 0 4px;padding:0;display:flex;flex-direction:column;gap:6px">
        ${s.materiais.map(m => itemCheck(m.item, m.essencial)).join("")}
      </ul>
      ${s.equipamentos && s.equipamentos.length ? `
        <p style="font-size:12.5px;color:var(--text-3);margin:12px 0 6px"><i class="ti ti-tool"></i> Equipamentos:</p>
        <ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px">
          ${s.equipamentos.map(m => itemCheck(m.item, m.essencial)).join("")}
        </ul>` : ""}
    </div>`;
}

// Linha de checklist com selo essencial/conferir. Marcar risca o item (apoio visual).
function itemCheck(texto, essencial) {
  const selo = essencial === undefined ? "" :
    essencial ? `<span class="pill pill-coral" style="margin-left:auto">essencial</span>`
              : `<span class="pill pill-gray" style="margin-left:auto">conferir</span>`;
  return `<li><label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px">
    <input type="checkbox" onchange="this.parentElement.style.opacity=this.checked?'.5':'1';this.parentElement.style.textDecoration=this.checked?'line-through':'none'">
    <span>${esc(texto)}</span>${selo}
  </label></li>`;
}
