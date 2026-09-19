// Civilbook - Codigo proprietario. (c) 2026 CB Desenvolvimento de Software Não Customizável Inova Simples (I.S.).
// Todos os direitos reservados. Proibida copia, redistribuicao, modificacao ou
// uso sem autorizacao escrita do titular. Ver LICENSE (Lei 9.609/98 e 9.610/98).
// Componentes de terceiros mantem suas proprias licencas.

// Configuração pública do Civilbook.
// Estas chaves são PÚBLICAS por natureza (a publishable key do Supabase só é segura COM RLS
// ativo). NUNCA coloque aqui a sb_secret_/service_role — ela fica apenas em Edge Functions.
//
// Para ativar o backend real:
//   1) Crie um projeto em https://supabase.com
//   2) Em Settings → API Keys, copie a Project URL e a publishable key (sb_publishable_…)
//   3) Cole abaixo, substituindo os placeholders
//   4) Rode o SQL de supabase/migrations/ no SQL Editor do projeto
//
// Enquanto os placeholders estiverem aqui, o app roda em modo local (localStorage),
// sem backend — útil para desenvolvimento e demonstração.
//
// MIGRAÇÃO DE CHAVES (f53 §2 do docs/ROTACAO-SEGREDOS.md, 09/ago/2026): a anon key legada (JWT)
// foi trocada pela publishable do modelo novo. O nome do campo segue SUPABASE_ANON_KEY porque é o
// contrato do supabase-js e dos consumidores (drive-callback, e2e) — o VALOR é que mudou de era.
window.CB_CONFIG = {
  SUPABASE_URL: "https://wektjvtdqkoxkzzycsyg.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_ZDYJX8pDg6dCtuFQj-e80g_UyXdIqK_"
};

window.CB_CONFIG.SUPA_READY =
  /^https:\/\/[a-z0-9-]+\.supabase\.co/.test(window.CB_CONFIG.SUPABASE_URL) &&
  !window.CB_CONFIG.SUPABASE_URL.includes("SEU-PROJETO") &&
  window.CB_CONFIG.SUPABASE_ANON_KEY.length > 20 &&
  window.CB_CONFIG.SUPABASE_ANON_KEY !== "SUA-ANON-KEY";

// Modo local forçado para testes E2E (sem backend) — RESTRITO a localhost: ?e2e=1 liga e usa
// sessionStorage (cb-e2e) para sobreviver à navegação index→app DENTRO da mesma aba/teste, mas
// zerar ao fechar a aba — assim não prende o navegador em modo local nem trava o login de quem
// usa o localhost depois. Produção (domínio real) nunca é afetada.
try {
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    if (/[?&]e2e=1/.test(location.search)) sessionStorage.setItem("cb-e2e", "1");
    if (sessionStorage.getItem("cb-e2e") === "1") window.CB_CONFIG.SUPA_READY = false;
  }
} catch (e) {}

// Pagamentos (PSP: Asaas). A chave de API do Asaas vai SÓ nas Edge Functions, nunca
// aqui. Troque PAGAMENTOS_ATIVO p/ true após criar a conta, configurar os segredos e
// fazer deploy das functions (passo a passo em docs/PAGAMENTOS.md). Enquanto false, os
// botões "Assinar" mantêm o comportamento atual (upgrade local/teste).
window.CB_CONFIG.PAGAMENTOS_ATIVO = false;
window.CB_CONFIG.FUNCTIONS_URL = window.CB_CONFIG.SUPABASE_URL + "/functions/v1";

// Modo piloto (18/set/2026) — o site publicado fica só para convidados. NÃO se liga aqui: a chave é o
// modo-piloto.json da raiz do repositório, e a publicação (tools/modo-piloto.ts, chamado pelo publicar-site.yml)
// troca ESTA linha exata por true no dist/ quando a chave está ligada. No repositório fica sempre false. Serve só
// para AJUSTES DE INTERFACE (ex.: Minha conta deixa de apontar para a página de planos, que o piloto não publica).
// Nada se fecha por aqui: o que não deve ser visto simplesmente não é publicado. Como ligar e desligar:
// docs/MODO-PILOTO.md.
window.CB_CONFIG.MODO_PILOTO = true;

// CAPTCHA opcional no login/cadastro (anti-bot, complementa o cooldown e os limites do
// Supabase Auth). Deixe vazio para desligar. Para ativar: crie um site no Cloudflare
// Turnstile (ou hCaptcha), cole a SITE KEY aqui, habilite o CAPTCHA em Supabase → Auth com
// a SECRET, e libere o domínio do widget na CSP. Passo a passo em docs/SECURITY.md.
window.CB_CONFIG.CAPTCHA_SITE_KEY = "";

// Integração ERP/CRM (d2) — reflete vendas/clientes/financeiro no painel admin.
// A CHAVE de API do ERP/CRM fica SÓ na Edge Function erp-resumo (Supabase → Edge Functions →
// Secrets: ERP_PROVIDER + ERP_API_KEY). NUNCA coloque a chave aqui. Abaixo só: o provedor
// previsto (rótulo) e a flag que liga a busca dos KPIs no admin.
window.CB_CONFIG.ERP_PROVIDER = "";   // "" enquanto não definido; ex.: "bling" | "omie" | "rdstation" | "pipedrive"
window.CB_CONFIG.ERP_ATIVO = false;   // true após criar a conta, gravar o secret e fazer deploy da function erp-resumo

// Rastreamento de marketing (d6). IDs PÚBLICOS (client-side por natureza — não são segredos).
// Vazios = rastreamento DESLIGADO. Preferido: usar só o GTM (container único) e configurar GA4 +
// Pixels dentro dele. GA4/Google respeitam o Consent Mode (consent.js, default negado); Meta e
// TikTok só carregam APÓS o aceite de cookies (LGPD). Detalhes em docs/RASTREAMENTO.md.
window.CB_CONFIG.GTM_ID = "";          // ex.: "GTM-XXXXXXX" (container único — preferido)
window.CB_CONFIG.GA4_ID = "";          // ex.: "G-XXXXXXXXXX" (usado direto só quando NÃO há GTM)
window.CB_CONFIG.META_PIXEL_ID = "";   // ex.: "1234567890123456" (Meta — Facebook/Instagram)
window.CB_CONFIG.TIKTOK_PIXEL_ID = ""; // ex.: "CABCDEFGHIJKLMNOPQRS"

// Monetização por anúncios (d10) — Google AdSense. ID PÚBLICO; vazio = DESLIGADO.
// Regras (em js/ads.js): só para usuários FREE (PRO não vê anúncios), só no app, respeitando o
// Consent Mode (anúncios não personalizados até o aceite). Ao ligar, é preciso TAMBÉM ampliar a
// CSP do app.html com os domínios do AdSense — passo a passo em docs/ADS.md.
window.CB_CONFIG.ADSENSE_CLIENT = "";          // ex.: "ca-pub-0000000000000000"
window.CB_CONFIG.ADSENSE_SLOT_INCONTENT = "";  // ex.: "1234567890" (unidade in-content; opcional)
window.CB_CONFIG.ADS_ATIVO = false;            // true após aprovação do AdSense + tráfego + CSP

// Anúncios NATIVOS (d11) — formatos do AdSense que se integram ao layout (in-article/in-feed),
// CTR maior e menos "cara de banner". Usam o MESMO client/CSP do AdSense (d10) e as mesmas regras
// (só FREE, respeitam o Consent Mode). Crie unidades nativas no painel do AdSense e cole os IDs.
window.CB_CONFIG.ADSENSE_SLOT_NATIVE = "";     // ex.: "2233445566" (unidade nativa in-article)
window.CB_CONFIG.ADSENSE_LAYOUT_KEY = "";      // ex.: "-fb+5w+4e-db+86" (só para in-feed; opcional)

// Afiliados de nicho (d11) — recomendações curadas (ferramentas, EPI, livros, cursos) com link
// de afiliado. Rendem comissão por VENDA (melhor que CPM em audiência pequena/segmentada).
// Diferente do AdSense: são conteúdo editorial com DISCLOSURE (não anúncio servido), por isso
// aparecem para todos os planos. As TAGS abaixo são públicas (vão na URL de todo link mesmo).
// Vazio/false = DESLIGADO. Como ligar e regras (LGPD/CDC) em docs/AFILIADOS.md.
window.CB_CONFIG.AFILIADOS_ATIVO = false;      // true após entrar nos programas e revisar o disclosure
window.CB_CONFIG.AMAZON_TAG = "";              // ex.: "civilbook-20" (Amazon Associados Brasil)
window.CB_CONFIG.AMAZON_DOMINIO = "amazon.com.br";

// Atalho/Chatbot de WhatsApp (d15) — botão flutuante na landing e no app p/ pré-venda e dúvidas
// (planos/produtos/suporte). Número PÚBLICO (vai no link wa.me). Formato: só dígitos, DDI+DDD+nº —
// ex.: "5511999999999". Vazio = botão DESLIGADO (não aparece). Fase 1 = clique-para-conversar (já
// pronto, js/whatsapp.js). Fase 2 (bot via WhatsApp Cloud API) usa secret SÓ na Edge Function —
// passo a passo em docs/WHATSAPP.md.
window.CB_CONFIG.WHATSAPP_NUMERO = "5544988581611";

// Proteção de conteúdo (d13) — PALIATIVOS contra cópia/scraping (contornáveis; ver
// docs/PROTECAO-CONTEUDO.md). A defesa real é o conteúdo atrás de login (já é o caso) + estes
// dissuasores. robots.txt e meta noai são sempre aplicados (custo zero de UX); estes flags só
// controlam o que mexe na experiência.
window.CB_CONFIG.WATERMARK_CONTEUDO = false;   // marca d'água por usuário no conteúdo autoral (rastreia vazamento). DESLIGADA por ora — reativar = true (mecanismo pronto em js/protecao.js)
window.CB_CONFIG.PROTECAO_COPIA = false;       // bloquear seleção/cópia/menu nos conteúdos sensíveis. OFF: puniria o PRO que paga p/ USAR os modelos (laudos). Ligar só se necessário
