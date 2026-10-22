# js/vendor — bibliotecas de terceiros servidas localmente

Dependências vendorizadas (sem CDN em runtime) para **confiabilidade** e coerência com o
offline-first. O site é estático e não tem build/npm, então o bundle é baixado e versionado aqui.

## supabase.js
- `@supabase/supabase-js` **v2.45.0** — bundle **UMD** (expõe `window.supabase`).
- Fonte oficial: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/dist/umd/supabase.js`
- Consumido por [`js/supa.js`](../supa.js) em modo **local-first**: usa `window.supabase` e só
  cai para o import dinâmico via `esm.sh` se o bundle local faltar (rede de segurança).
- Carregado como `<script src="js/vendor/supabase.js">` antes de `js/supa.js` em
  `app.html`, `index.html` e `admin.html`.

### Atualizar versão
1. Baixar a nova versão da mesma URL (trocando `@2.45.0`).
2. Ajustar a versão do fallback em `js/supa.js` e, se mudar de origem, a CSP das páginas.
