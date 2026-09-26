// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).

// a52 passo 2 (21/set/2026) — A FÁBRICA DE COLEÇÕES MORA AQUI, e não mais no js/manutencao2.js.
//
// POR QUE SAIU DE LÁ (achado da revisão de 21/set/2026, que o pegou com o CI 100% verde): com os módulos
// chegando ao clicar, `cbColecao` passou a ser uma dependência ENTRE módulos. Ela é chamada NO TOPO de sete
// arquivos — js/orcamento.js, js/projetos.js (2x), js/cronograma.js, js/rdo.js, js/conformidade.js,
// js/manual.js e o próprio js/manutencao2.js — e morava no arquivo de UM módulo (Manutenção). Resultado
// medido: abrir Custos, Meus projetos, Diário de Obra ou Cronograma dava `cbColecao is not defined` na
// primeira linha do arquivo do módulo, o resto dele não rodava, e a tela virava "chegou incompleto" com um
// "Tentar de novo" que repetia o mesmo erro para sempre, em qualquer aparelho, online ou offline.
//
// POR QUE UM ARQUIVO PRÓPRIO, e não o js/manutencao2.js inteiro na lista dos quatro módulos (caminho de arquivo
// não se escreve entre aspas nem entre crases num comentário daqui: o leitor do tools/carimbar-versao.ts não
// conhece comentário e cobraria carimbo de um caminho que ninguém pede — foi o que aconteceu ao escrever este
// cabeçalho, e é bom que tenha acontecido): o arquivo inteiro são
// 34.742 B (9.867 B comprimidos) de Manutenção 2.0 — ativos, agendamentos, calendário, OS —, e a fábrica são
// 3.324 B. Pôr o módulo inteiro em Custos para ter uma fábrica de coleções é o mesmo defeito que a régua M12
// do tests/abertura.check.mjs condena na home (pagar 12 arquivos por um badge). Aqui ela é o que sempre foi:
// infraestrutura de armazenamento, irmã do CBStore (js/store.js), usada por cinco módulos.
//
// ONDE ELA APARECE: em js/modulos.js é o PRIMEIRO arquivo das listas de `sinapi`, `manutencao`, `projetos`,
// `rdo` e `cronograma` — antes de todo arquivo que a chama no topo. Quem trava a ordem é a régua M14 do
// tests/abertura.check.mjs, que EXECUTA a lista de cada módulo num sandbox e reprova ReferenceError de topo.
// O teste da fábrica continua sendo o tests/colecao.check.mjs, que agora a extrai DESTE arquivo.
//
// NÃO ENTROU NA CASCA (js/store.js) de propósito: a casca é o que TODA abertura baixa, e nenhuma das telas da
// primeira tela usa coleção — pô-la lá devolveria bytes à abertura, que é justamente o que o passo 2 tirou.

// ---------- Coleção genérica offline-first (id próprio + dono), no padrão do MNT ----------
// a19 (24/ago/2026): duas armadilhas fechadas na fábrica. (1) listar() com _items null devolvia
// um [] NOVO a cada chamada — o upsert empurrava o item num array que ninguém guardava: ia p/ o
// localStorage e sumia da sessão. Agora upsert/remover MATERIALIZAM _items a partir do LS.
// (2) um load() em voo terminava DEPOIS de uma gravação e enterrava o item com o retrato lido
// no começo (e _loaded=true impedia qualquer recarga). Agora gravação feita antes da 1ª carga
// (ou durante uma em voo) vira PENDENTE e é reaplicada por cima do retrato no fim do load —
// os dois retratos não disputam mais. Teste puro: tests/colecao.check.mjs (roda no CI).
// a59 (22/set/2026): `opcoes.compartilhavel` ("projeto" | "os") diz que a TABELA é um recurso
// compartilhável da 0010 — política de select "dono OU is_admin() OU tem_acesso(...)". Nesse caso a carga
// passa pelo cbLerMeusRecursos (casca, js/app.js) em vez de um select("*") que confia no RLS: para o ADMIN
// o select("*") devolvia as linhas de todas as contas. Foi o que aconteceu com a coleção PROJ ("Meus
// projetos", js/projetos.js), que lê a MESMA tabela `projetos` da Conferência — e escapou da primeira
// varredura porque aqui o nome da tabela é uma VARIÁVEL. Sem a opção, nada muda: as outras coleções são de
// tabelas cuja política é só do dono.
function cbColecao(table, lsKey, fromRow, toRow, opcoes) {
  const compartilhavel = (opcoes && opcoes.compartilhavel) || null;
  return {
    _items: null, _loaded: false, _carregando: false, _pendentes: null, _carga: null, table, lsKey, compartilhavel,
    _pendente(op, id, it) {
      if (this._loaded && !this._carregando) return;   // fora da janela de risco não há disputa
      (this._pendentes = this._pendentes || []).push({ op, id, it });
    },
    // a19 (2ª volta — achado da revisão adversarial de 24/ago): DOIS load() concorrentes ainda
    // enterravam gravação — o primeiro a terminar zerava _pendentes/_carregando e o segundo
    // sobrescrevia com o retrato velho. Agora o load em voo é MEMOIZADO: chamadas concorrentes
    // dividem a MESMA carga; só existe um retrato por vez.
    load() {
      if (this._carga) return this._carga;
      this._carga = this._carregar().finally(() => { this._carga = null; });
      return this._carga;
    },
    async _carregar() {
      this._carregando = true;
      const local = CBStore.lsGet(lsKey, []);
      let items = null;
      // a59, correção da revisão de 22/set/2026: a fábrica ATENDIA o `parcial` do helper jogando-o fora —
      // com a lista de convites fora do ar, os compartilhados sumiam da tela SEM aviso, o espelho era
      // regravado encolhido e, para quem não é dono de nada, a "migração única" ainda reenviava o espelho
      // ao banco como itens NOVOS. A Conferência e a Manutenção já avisavam; aqui ninguém avisava.
      let parcial = null;
      if (CBStore.online()) {
        try {
          const r = compartilhavel
            ? await cbLerMeusRecursos(table, compartilhavel, {})          // a59: dono + compartilhado comigo
            : await window.supa.from(table).select("*");
          const { data, error } = r;
          if (error) throw error;
          parcial = r.parcial || null;
          if (parcial && typeof toast === "function") toast("Itens compartilhados com você podem não ter carregado.", "warn");
          items = (data || []).map(fromRow);
          if (!parcial && !items.length && local.length) {     // migração única: sobe locais se vazio
            items = [];
            for (const it of local) {
              const { error: e } = await window.supa.from(table).insert(toRow(it));
              if (!e) items.push(it);
            }
          }
        } catch (e) { console.warn(table + ".load:", e && e.message); items = null; }
      }
      if (items == null) items = local;
      // a19: reaplica o que foi gravado enquanto este load corria — a gravação vence o retrato.
      for (const p of (this._pendentes || [])) {
        if (p.op === "remover") { items = items.filter(x => x.id !== p.id); continue; }
        const i = items.findIndex(x => x.id === p.id);
        if (i < 0) items.push(p.it); else items[i] = p.it;
      }
      this._pendentes = null;
      // Carga PARCIAL não reescreve o espelho: ele é o que abre offline, e gravá-lo sem os compartilhados
      // os apaga do aparelho (o aviso só existe nesta sessão). O que foi gravado durante o load já está no
      // storage pelo upsert/remover, que grava direto — nada se perde por não regravar aqui.
      this._items = items; if (!parcial) CBStore.lsSet(lsKey, items);
      this._loaded = true; this._carregando = false;
    },
    async ready() { if (!this._loaded) await this.load(); return this._loaded; },
    listar() { return this._items || []; },
    get(id) { return this.listar().find(x => x.id === id) || null; },
    upsert(it) {
      // a19: materializa — sem isso, com _items null, a lista era um array descartável.
      const lista = this._items || (this._items = CBStore.lsGet(lsKey, []));
      const i = lista.findIndex(x => x.id === it.id);
      const novo = i < 0;
      if (novo) lista.push(it); else lista[i] = it;
      CBStore.lsSet(lsKey, lista);
      this._pendente("upsert", it.id, it);
      if (CBStore.online()) {
        const row = toRow(it);
        const q = novo ? window.supa.from(table).insert(row) : window.supa.from(table).update(row).eq("id", it.id);
        q.then(({ error }) => { if (error) console.warn(table + ".upsert:", error.message); });
      }
    },
    remover(id) {
      const lista = this._items || (this._items = CBStore.lsGet(lsKey, []));
      this._items = lista.filter(x => x.id !== id);
      CBStore.lsSet(lsKey, this._items);
      this._pendente("remover", id);
      CBStore.remove(table, { id });
    }
  };
}
