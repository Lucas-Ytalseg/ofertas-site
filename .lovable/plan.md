## Problema

O "Importar por link" agora "passa" mas grava o produto **sem preço e sem imagem** — só com o nome.

Causa: o fallback que adicionei no último fix pega `meta.title` da página quando a IA não acha o produto. Em páginas pesadas em JS (Shopee, Mercado Livre, Magalu, etc.) o markdown que o Firecrawl gera é fraco, a IA não acha preço/imagem, e o fallback cria um produto "vazio" só com o título.

Além disso, o fluxo atual usa markdown → LLM, que é o caminho menos confiável do Firecrawl para páginas de e-commerce.

## Plano

### 1. Trocar a extração para o modo nativo do Firecrawl (`json`)
Em vez de pegar markdown e pedir pra IA estruturar, usar `formats: [{ type: "json", prompt, schema }]` direto no Firecrawl. Ele renderiza JS, segue redirects de afiliado e devolve JSON já estruturado — bem mais robusto pra lojas.

Schema enviado ao Firecrawl:
```ts
{ name, price, original_price, image_url, rating, review_count, category }
```

### 2. Pedir múltiplos formatos de uma vez
`formats: [{ type: "json", ... }, "markdown", "screenshot"]` para termos:
- JSON estruturado (fonte principal)
- `metadata.ogImage` / `metadata.ogTitle` (fallback de imagem/título)
- Markdown (fallback se o JSON vier vazio, aí cai no Gemini como hoje)

### 3. Endurecer a validação
Remover o fallback "só com `meta.title`". Regra nova:
- Se não tiver **nome** → erro "não consegui extrair" (mesma mensagem).
- Se tiver nome mas faltar imagem → preencher com `metadata.ogImage`. Se ainda faltar, salvar `null` e o front mostra placeholder.
- Se faltar **preço** → salva mesmo assim, mas devolve um aviso (`warning`) pro front exibir um toast tipo "Produto importado, mas o preço não foi detectado — edite manualmente".

### 4. Subir a qualidade do LLM no caminho fallback
Trocar `google/gemini-2.5-flash` por `google/gemini-2.5-pro` apenas no `importProductFromUrl` (página única, baixo volume). O `discoverDeals` (lista) fica no flash.

### 5. (Opcional, recomendado depois) API oficial Shopee Afiliados
Pra Shopee especificamente, scraping é frágil mesmo com Firecrawl. O caminho estável é a API GraphQL de Afiliados (App ID + Secret no painel Shopee). Não entra neste fix — deixo proposto pra próximo passo se você quiser.

## Arquivos afetados

- `src/lib/offers.functions.ts` — refatorar `firecrawlScrape` para aceitar formatos estruturados, e reescrever `importProductFromUrl` usando o JSON do Firecrawl com fallback pro Gemini.
- `src/routes/admin.ofertas.tsx` — exibir o `warning` do retorno (toast amarelo) quando vier sem preço.

## Pergunta pra você

Quer que eu já implemente também a API oficial de Afiliados Shopee no mesmo passo, ou prefere primeiro ver se a melhoria do Firecrawl resolve a maioria dos links?