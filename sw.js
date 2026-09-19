// Service worker do Civilbook (PWA).
//
// O QUE ELE RESOLVE (relato do fundador, 17/set/2026, PWA num Android): "às vezes demora a carregar"
// e a Início aparecia vazia. O SW antigo era rede-primeiro SEM PRAZO para ~75 arquivos: com sinal
// ruim (canteiro, elevador, troca Wi-Fi/4G) cada pedido ficava preso esperando a rede, mesmo com uma
// cópia boa guardada no aparelho. Além disso guardava QUALQUER resposta (404, página de erro).
//
// ESTRATÉGIA — decidida por estrategiaPara(), função pura testada em tests/sw-estrategia.test.mjs:
//
//   1. "rede-com-prazo": páginas (navegação) e TUDO que o app executa ou lê como código — .js, .css,
//      .json, .html, INCLUSIVE data/*.js. Vai à rede primeiro; se ela não responder em PRAZO_MS e
//      houver cópia guardada, entrega a cópia NA HORA e deixa a rede terminar em segundo plano,
//      atualizando a cópia para a próxima abertura. Sem cópia não há o que entregar: espera a rede até
//      o fim, como antes.
//      POR QUE data/*.js ESTÁ AQUI e não na 2 (achado da revisão de 17/set/2026): as bases são lidas
//      pelo js/ do MESMO deploy (data/param-*.js ↔ js/parametrico.js, data/cub.js, data/normas.js…).
//      Em cache-e-revalida, toda 1ª abertura depois de um deploy juntava js/ NOVO (rede) com data/
//      VELHO (cópia), mesmo com rede boa — e num PWA que fica dias aberto a "próxima abertura" demora.
//   2. "cache-e-revalida": SÓ o que não tem par no código — ícones, imagens e fontes. Entrega a cópia
//      guardada na hora e busca a versão nova em segundo plano.
//   3. "ignorar": o SW não toca no pedido (o navegador segue direto para a rede, sem cache nosso).
//      Tudo que NÃO é GET, tudo de OUTRO domínio (Supabase, jsDelivr, esm.sh), /cdn-cgi/ (Cloudflare),
//      o painel admin (admin.html e js/admin.js — só funciona online e pesa ~750 KB), o retorno do
//      OAuth do Drive (leva ?code= na URL) e extensões desconhecidas.
//
// REGRAS QUE NÃO SE NEGOCIAM:
//   - Nunca entregar HTML no lugar de JS/CSS. Só NAVEGAÇÃO cai para a casca app.html; e uma resposta
//     200 com text/html para um .js/.css (portal cativo de Wi-Fi, desafio do Cloudflare) é tratada
//     como falha de rede: nem é entregue nem é guardada — ver respostaPropria().
//   - Só se guarda resposta 200 do próprio site. 404, 5xx e redirect não entram no cache.
//   - A chave do cache é origem + caminho, SEM query string: app.html?code=… não grava o código do
//     OAuth no cache e acha a mesma cópia de app.html.
//
// REDE-PRIMEIRO DE VERDADE, SEM IR À REDE A CADA ABERTURA: o Cloudflare manda max-age de 4 h no
// JS/CSS e de 10 min no HTML (medido em 17/set/2026), então o fetch() comum do SW devolvia JS de até
// 4 h atrás junto com HTML novo. O GitHub Pages carimba TODOS os arquivos com a hora do deploy no
// Last-Modified; modoDeBusca() compara o carimbo da cópia guardada com o do último HTML visto: cópia
// do mesmo deploy → deixa o cache HTTP responder, sem rede; cópia mais velha que o HTML (saiu deploy)
// → cache:"no-cache", que obriga a perguntar ao servidor. Se o carimbo faltar, pergunta sempre
// (correto, só menos rápido).
// O QUE ISSO CUSTA, SEM ENFEITE: depois de um deploy essa pergunta NÃO volta 304 — volta 200 com o
// arquivo inteiro, para os ~75 arquivos, mesmo os que não mudaram. O ETag do Pages é
// "hora-do-deploy + tamanho" (W/"6aab0650-134b3": 0x6aab0650 = 16/set/2026 21:12:48 UTC, o próprio
// Last-Modified) e todo deploy recarimba tudo. É o mesmo custo do SW antigo (rede-primeiro para
// tudo), pago uma vez por deploy e agora com prazo; o ganho é entre deploys, quando nada vai à rede.
// 304 de verdade só existe dentro do mesmo deploy (cache HTTP vencido, carimbo desconhecido).
//
// COMO SUBIR A VERSÃO: troque VERSAO abaixo ("v3" → "v4"). O activate APROVEITA as cópias boas dos
// caches "civilbook-*" de outras versões (migrarCopias: mesma régua de respostaPropria, chave sem
// query) e só então os apaga — inclusive o legado "civilbook-v2", que guardava qualquer coisa. Sem
// isso a troca de versão zerava o offline E o prazo (sem cópia não há prazo) até a próxima carga
// completa online. NÃO precisa subir versão para publicar mudança de HTML/JS/CSS — a estratégia 1 já
// busca o novo. Suba quando mudar ESTE arquivo de um jeito que torne o cache antigo impróprio (chave,
// estratégia). Para EXPURGAR cópia ruim dos aparelhos, suba a versão COM APROVEITAR_ANTIGO = false
// nessa subida (senão a migração leva a cópia ruim junto) e volte para true na seguinte.
//
// LIMITES CONHECIDOS: (a) com rede lenta, uma abertura pode misturar arquivos novos (chegaram no
// prazo) com cópias antigas (não chegaram); conserta sozinho na abertura seguinte. Com rede boa não
// há mistura: js/ e data/ seguem a mesma estratégia. O remédio completo é o precache atômico por
// deploy, que exige carimbar este arquivo em tools/build-static.sh.
// (b) O registro (app.html, fim do <body>) usa updateViaCache:"none" e reg.update() ao voltar ao
// primeiro plano, no máximo 1 vez a cada 10 min: um PWA que fica aberto sem voltar ao primeiro plano
// só recebe sw.js novo na próxima navegação.
// (c) Os ícones Tabler vêm do jsDelivr (outro domínio): ficam fora do alcance deste SW e somem offline.
// (d) 404 com cópia guardada entrega a cópia (decisão, ver redeComPrazo). Arquivo removido ou
// renomeado num deploy fica órfão no cache, e a migração o carrega de versão em versão. Órfão não é
// pedido por ninguém (o HTML novo não o cita): o custo é espaço, não comportamento. Faxina = uma
// subida de versão com APROVEITAR_ANTIGO = false.

const VERSAO = "v3";
const PREFIXO = "civilbook-";
const CACHE_APP = PREFIXO + "app-" + VERSAO;           // páginas, js/, css/ e data/ (rede-com-prazo)
const CACHE_ESTATICO = PREFIXO + "estatico-" + VERSAO; // ícones, imagens e fontes (cache-e-revalida)
const PRAZO_MS = 3000;                                 // quanto se espera a rede antes de entregar a cópia
const APROVEITAR_ANTIGO = true;                        // false só na subida de versão feita para EXPURGAR

// Mínimo para abrir offline logo após instalar. O resto entra no cache conforme é pedido.
// O install é TUDO-OU-NADA para o CORE: um 404 aqui e o SW não instala (o teste confere que todos
// existem e vão para dist/).
const CORE = ["app.html", "index.html", "css/style.css", "manifest.json", "icon.svg"];
// Páginas legais: o banner de cookies e o cadastro apontam para elas; offline e sem cópia, quem
// tocasse em "Política de Privacidade" recebia a casca do app no lugar. Entram no install SEM o
// tudo-ou-nada: se uma faltar, o SW instala do mesmo jeito.
const CORE_EXTRA = ["termos.html", "privacidade.html"];
const CASCA = "app.html";

// Caminhos (relativos à pasta do sw.js) que o SW nunca intercepta.
// acesso.html e js/acesso.js (d24, 18/set/2026): a página dos links de e-mail do login recebe o token_hash na
// URL — mesma razão da drive-callback.html: nada de cópia em cache nem de casca do app no lugar dela.
const SO_REDE = ["sw.js", "admin.html", "js/admin.js", "drive-callback.html", "acesso.html", "js/acesso.js",
  "viabilidade.html", "js/viabilidade.jsx"];
const SO_REDE_PREFIXOS = ["cdn-cgi/", ".well-known/"];

const EXT_CODIGO = ["js", "mjs", "css", "json", "webmanifest", "html", "htm"];
const EXT_ESTATICO = ["png", "jpg", "jpeg", "webp", "gif", "svg", "ico", "avif", "woff", "woff2", "ttf", "otf"];

const ESTRATEGIA = { IGNORAR: "ignorar", REDE_PRAZO: "rede-com-prazo", CACHE_REVALIDA: "cache-e-revalida" };

// ---------------------------------------------------------------------------------------------
// Decisão PURA (sem rede, sem cache, sem relógio) — é o que tests/sw-estrategia.test.mjs exercita.
// ---------------------------------------------------------------------------------------------

// Chave do cache: origem + caminho. Sem query e sem hash; pasta vira o index.html dela.
function chaveDeCache(url) {
  const u = new URL(url);
  return u.origin + (u.pathname.endsWith("/") ? u.pathname + "index.html" : u.pathname);
}

function extensaoDe(caminho) {
  const nome = caminho.slice(caminho.lastIndexOf("/") + 1);
  const i = nome.lastIndexOf(".");
  return i <= 0 ? "" : nome.slice(i + 1).toLowerCase();
}

// pedido = { url, method, mode, destination, cache, temRange } · escopo = { origem, base }
// (base = pasta do sw.js, "/" em produção). Devolve { estrategia } ou { estrategia, navegacao, chave }.
function estrategiaPara(pedido, escopo) {
  const FORA = { estrategia: ESTRATEGIA.IGNORAR };
  if (!pedido || pedido.method !== "GET") return FORA;
  let u;
  try { u = new URL(pedido.url); } catch (_e) { return FORA; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return FORA;
  if (u.origin !== escopo.origem) return FORA;                       // outro domínio: nunca é nosso
  if (!u.pathname.startsWith(escopo.base)) return FORA;
  if (pedido.temRange) return FORA;                                  // resposta parcial (206) não se guarda
  if (pedido.cache === "only-if-cached" && pedido.mode !== "same-origin") return FORA; // fetch() lançaria

  const rel = u.pathname.slice(escopo.base.length);
  if (SO_REDE.includes(rel)) return FORA;
  if (SO_REDE_PREFIXOS.some((p) => rel.startsWith(p))) return FORA;

  const chave = chaveDeCache(u.href);
  if (pedido.mode === "navigate" || pedido.destination === "document") {
    return { estrategia: ESTRATEGIA.REDE_PRAZO, navegacao: true, chave };
  }
  const ext = extensaoDe(u.pathname);
  // data/*.js NÃO tem regra própria de propósito: cai em EXT_CODIGO, a mesma estratégia do js/ que o lê.
  if (EXT_ESTATICO.includes(ext)) return { estrategia: ESTRATEGIA.CACHE_REVALIDA, navegacao: false, chave };
  if (EXT_CODIGO.includes(ext) || u.pathname.endsWith("/")) {
    return { estrategia: ESTRATEGIA.REDE_PRAZO, navegacao: false, chave };
  }
  return FORA;
}

// A resposta pode ser entregue E guardada? r = { navegacao, chave, status, tipo, contentType }.
// É aqui que mora o "nunca HTML no lugar de JS/CSS".
function respostaPropria(r) {
  if (r.status !== 200 || r.tipo !== "basic") return false;
  const ehHtml = /^\s*text\/html\b/i.test(r.contentType || "");
  if (!ehHtml) return true;
  return !!r.navegacao || /\.html?$/i.test(r.chave || "");
}

// "default" = o cache HTTP pode responder (rápido, sem rede) · "no-cache" = revalida no servidor.
// lmCopia / lmDeploy = Last-Modified em ms (0 = desconhecido). Navegação fica no default: o HTML já
// tem só 10 min de cache HTTP e recriar um pedido de navegação com init muda o modo dele.
function modoDeBusca(m) {
  if (m.navegacao) return "default";
  if (m.lmCopia > 0 && m.lmDeploy > 0 && m.lmCopia >= m.lmDeploy) return "default";
  return "no-cache";
}

// Mesma versão já guardada → não regrava (o SW antigo fazia ~75 escritas no cache por abertura).
// a / b = { etag, lastModified, tamanho } (strings dos cabeçalhos; podem faltar).
function mesmaVersao(a, b) {
  if (!a || !b) return false;
  const limpa = (e) => String(e).replace(/^W\//, "");
  if (a.etag && b.etag) return limpa(a.etag) === limpa(b.etag);
  if (a.lastModified && b.lastModified && a.tamanho && b.tamanho) {
    return a.lastModified === b.lastModified && a.tamanho === b.tamanho;
  }
  return false;
}

// Quais caches apagar no activate: só os NOSSOS (prefixo) que não são da versão atual.
function cachesParaApagar(nomes, atuais) {
  return nomes.filter((n) => n.startsWith(PREFIXO) && !atuais.includes(n));
}

// Exposto para o teste (e para depurar no DevTools: self.CB_SW.VERSAO).
self.CB_SW = {
  VERSAO, CACHE_APP, CACHE_ESTATICO, PRAZO_MS, CORE, CORE_EXTRA, ESTRATEGIA,
  estrategiaPara, chaveDeCache, respostaPropria, modoDeBusca, mesmaVersao, cachesParaApagar,
};

// ---------------------------------------------------------------------------------------------
// Execução (rede + cache).
// ---------------------------------------------------------------------------------------------
const BASE = new URL("./", self.location.href);              // pasta do sw.js
const ESCOPO = { origem: BASE.origin, base: BASE.pathname };
const URL_CASCA = new URL(CASCA, BASE).href;

let deployVisto = 0;      // maior Last-Modified (ms) visto num HTML vindo da rede nesta instância do SW
let deployLido = false;   // já tentou recuperar o carimbo da casca guardada?

const lmDe = (resp) => (resp ? Date.parse(resp.headers.get("last-modified") || "") || 0 : 0);
const versaoDe = (resp) => (resp ? {
  etag: resp.headers.get("etag"),
  lastModified: resp.headers.get("last-modified"),
  tamanho: resp.headers.get("content-length"),
} : null);

// O SW é encerrado quando fica ocioso e a variável zera: recupera o carimbo da casca guardada.
async function deployConhecido(cache) {
  if (!deployVisto && !deployLido) {
    deployLido = true;
    deployVisto = lmDe(await cache.match(URL_CASCA));
  }
  return deployVisto;
}

function comPrazo(promessa, ms) {
  let t;
  const prazo = new Promise((ok) => { t = setTimeout(() => ok(null), ms); });
  return Promise.race([promessa, prazo]).finally(() => clearTimeout(t));
}

// Vai à rede e, se a resposta serve, guarda a cópia SEM segurar a entrega. Devolve { resp, boa } e
// nunca rejeita (resp = null quando a rede falhou).
async function buscarEGuardar(evento, init, cache, plano, copia) {
  let resp;
  try {
    resp = init ? await fetch(evento.request, init) : await fetch(evento.request);
  } catch (_e) {
    return { resp: null, boa: false };
  }
  // Redirect de navegação: devolve como veio (o navegador segue) e não guarda.
  if (resp.type === "opaqueredirect") return { resp, boa: true };
  const boa = respostaPropria({
    navegacao: plano.navegacao, chave: plano.chave,
    status: resp.status, tipo: resp.type, contentType: resp.headers.get("content-type"),
  });
  if (boa) {
    if (plano.navegacao) deployVisto = Math.max(deployVisto, lmDe(resp));
    if (!mesmaVersao(versaoDe(copia), versaoDe(resp))) {
      // clone() ANTES de entregar; a gravação corre em paralelo (cota cheia não derruba a entrega).
      const gravacao = cache.put(plano.chave, resp.clone()).catch(() => {});
      try { evento.waitUntil(gravacao); } catch (_e) { /* evento já encerrado: grava sem garantia */ }
    }
  }
  return { resp, boa };
}

// Sem resposta boa e sem cópia: 404/5xx de verdade seguem como vieram; HTML-no-lugar-de-JS vira erro.
function semSaida(fim) {
  if (fim.resp && fim.resp.status !== 200) return fim.resp;
  return Response.error();
}

async function redeComPrazo(evento, plano) {
  const cache = await caches.open(CACHE_APP);
  const copia = await cache.match(plano.chave);
  const modo = modoDeBusca({
    navegacao: plano.navegacao, lmCopia: lmDe(copia), lmDeploy: await deployConhecido(cache),
  });
  const rede = buscarEGuardar(evento, modo === "default" ? null : { cache: modo }, cache, plano, copia);
  evento.waitUntil(rede); // a rede termina (e atualiza a cópia) mesmo depois de a cópia ser entregue

  // Só existe prazo quando há o que entregar no lugar da rede.
  const primeiro = copia ? await comPrazo(rede, PRAZO_MS) : await rede;
  if (primeiro && primeiro.boa) return primeiro.resp;
  // Prazo estourou, rede caiu ou resposta imprópria → a cópia. "Imprópria" inclui 404 e 5xx, e é
  // DECISÃO: quando a hospedagem quebra (Pages despublicado, CNAME errado, repo privado) o site
  // inteiro responde 404, e o PWA instalado tem de seguir abrindo com o que guardou. O preço é um
  // arquivo removido num deploy continuar servido a quem já o tinha (limite (d) no cabeçalho).
  if (copia) return copia;
  const fim = primeiro || await rede;
  if (plano.navegacao) {
    // Última saída, SÓ para navegação: a casca do app. Nunca para JS/CSS/imagem.
    const casca = await cache.match(URL_CASCA);
    if (casca) return casca;
  }
  return semSaida(fim);
}

async function cacheERevalida(evento, plano) {
  const cache = await caches.open(CACHE_ESTATICO);
  const copia = await cache.match(plano.chave);
  const rede = buscarEGuardar(evento, null, cache, plano, copia);
  evento.waitUntil(rede);
  if (copia) return copia;
  const fim = await rede;
  return fim.boa ? fim.resp : semSaida(fim);
}

// Antes de apagar os caches de outra versão, aproveita as cópias BOAS deles. Sem isto, a 1ª abertura
// depois de uma troca de versão não tinha cópia de nenhum JS: offline dava casca + "Tentar de novo", e
// com sinal ruim voltava a espera SEM prazo (só há prazo quando há cópia) — justo o relato de
// 17/set/2026, por mais uma abertura. A régua é a mesma da rede: só 200 do próprio site, nunca HTML no
// lugar de JS/CSS (o legado "civilbook-v2" guardava 404 e página de erro), chave sem query, e o que
// a versão nova já guardou (CORE do install) vale mais. Cópia migrada pode estar velha: é revalidada
// na 1ª abertura online, como qualquer cópia de deploy anterior. NUNCA rejeita: migração é bônus, a
// troca de versão acontece de qualquer jeito.
async function migrarCopias(antigos) {
  if (!APROVEITAR_ANTIGO || !antigos.length) return;
  try {
    for (const nome of antigos) {
      const velho = await caches.open(nome);
      for (const pedido of await velho.keys()) {
        try {
          const d = destinoDe(pedido.url);
          if (!d) continue;
          const destino = await caches.open(d.cache);
          if (await destino.match(d.chave)) continue;
          const resp = await velho.match(pedido);
          const serve = resp && respostaPropria({
            navegacao: false, chave: d.chave,
            status: resp.status, tipo: resp.type, contentType: resp.headers.get("content-type"),
          });
          if (serve) await destino.put(d.chave, resp);
        } catch (_e) { /* uma cópia que não migra (Vary: *, cota cheia) não impede as outras */ }
      }
    }
  } catch (_e) { /* sem migração: o cache enche de novo na próxima abertura online */ }
}

// Em QUAL cache (e com que chave) o fetch vai procurar esta URL. Install e migração gravam por aqui,
// para nunca guardar num cache o que é lido no outro: o icon.svg do CORE ia para o cache do app e o
// fetch o procurava no de estáticos — offline logo após instalar, o ícone não existia. Só a URL decide
// (o modo de um pedido guardado não é confiável): app.html cai em ".html". null = o SW não guarda.
function destinoDe(url) {
  const plano = estrategiaPara({ url, method: "GET", mode: "same-origin", destination: "", cache: "default", temRange: false }, ESCOPO);
  if (plano.estrategia === ESTRATEGIA.IGNORAR) return null;
  return { cache: plano.estrategia === ESTRATEGIA.CACHE_REVALIDA ? CACHE_ESTATICO : CACHE_APP, chave: plano.chave };
}

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    // cache:"reload" fura o cache HTTP (4 h no CSS): o CORE guardado é o do servidor, não o do disco.
    const pedido = (u) => new Request(new URL(u, BASE).href, { cache: "reload" });
    const cacheDe = (u) => caches.open(destinoDe(new URL(u, BASE).href).cache); // CORE ignorado pelo SW = erro = não instala
    // Tudo-ou-nada: cada add() rejeita com 404/rede caída, e um só que rejeite derruba o install.
    await Promise.all(CORE.map(async (u) => (await cacheDe(u)).add(pedido(u))));
    await Promise.all(CORE_EXTRA.map(async (u) => { try { await (await cacheDe(u)).add(pedido(u)); } catch (_e) { /* instala igual */ } }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const antigos = cachesParaApagar(await caches.keys(), [CACHE_APP, CACHE_ESTATICO]);
    await migrarCopias(antigos);
    await Promise.all(antigos.map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const r = e.request;
  const plano = estrategiaPara({
    url: r.url, method: r.method, mode: r.mode, destination: r.destination, cache: r.cache,
    temRange: r.headers.has("range"),
  }, ESCOPO);
  if (plano.estrategia === ESTRATEGIA.IGNORAR) return; // o navegador segue direto para a rede
  e.respondWith(plano.estrategia === ESTRATEGIA.CACHE_REVALIDA ? cacheERevalida(e, plano) : redeComPrazo(e, plano));
});
