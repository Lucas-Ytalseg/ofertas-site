import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Páginas públicas de ofertas de cada marketplace
const MARKETPLACE_PAGES: Record<string, { name: string; url: string }> = {
  mercadolivre: { name: "Mercado Livre", url: "https://www.mercadolivre.com.br/ofertas" },
  amazon:       { name: "Amazon BR",     url: "https://www.amazon.com.br/gp/goldbox" },
  shopee:       { name: "Shopee",        url: "https://shopee.com.br/flash_sale" },
  aliexpress:   { name: "AliExpress",    url: "https://pt.aliexpress.com/p/sales/index.html" },
  magalu:       { name: "Magalu",        url: "https://www.magazineluiza.com.br/selecao/ofertasdodia/" },
  americanas:   { name: "Americanas",    url: "https://www.americanas.com.br/hotsite/ofertas-do-dia" },
  shein:        { name: "Shein",         url: "https://br.shein.com/promotion-page.html" },
  kabum:        { name: "Kabum",         url: "https://www.kabum.com.br/ofertas" },
};

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let s = v.replace(/[^\d.,-]/g, "").trim();
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot   = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

const ProductSchema = z.object({
  name: z.string(),
  price: z.number().nullable().optional(),
  original_price: z.number().nullable().optional(),
  discount_percentage: z.number().nullable().optional(),
  image_url: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  rating: z.number().nullable().optional(),
  review_count: z.number().nullable().optional(),
  category: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  availability: z.string().nullable().optional(),
});

const ExtractionSchema = z.object({ products: z.array(ProductSchema) });

// ── Firecrawl scraping ────────────────────────────────────────────────────────
type FirecrawlFormat =
  | string
  | { type: "json"; prompt?: string; schema?: Record<string, unknown> };

async function firecrawlScrape(url: string, opts: { formats?: FirecrawlFormat[] } = {}) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY não configurado");
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      formats: opts.formats ?? ["markdown"],
      onlyMainContent: true,
      waitFor: 2500,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Firecrawl ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data?.data ?? data;
}

// ── Google Gemini (direto, sem intermediário Lovable) ─────────────────────────
async function aiExtract<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  content: string,
  model = "gemini-2.0-flash",
): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY não configurado");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Você extrai dados estruturados de páginas em português. Responda APENAS JSON válido, sem markdown, sem \`\`\`.\n\n${prompt}\n\nConteúdo:\n${content.slice(0, 18000)}`,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);

  const raw: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end   = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { parsed = JSON.parse(cleaned.slice(start, end + 1)); }
      catch { parsed = { products: [] }; }
    } else {
      parsed = { products: [] };
    }
  }

  const obj = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
  if (Array.isArray(obj.products)) {
    const numericFields = ["price", "original_price", "rating", "review_count", "discount_percentage"];
    obj.products = (obj.products as Array<Record<string, unknown>>)
      .map((p) => {
        const out = { ...p };
        for (const f of numericFields) if (f in out) out[f] = toNum(out[f]);
        return out;
      })
      .filter((p) => typeof p.name === "string" && (p.name as string).trim().length > 0);
  }
  return schema.parse(obj);
}

// ── Schema JSON para produto individual ───────────────────────────────────────
const PRODUCT_JSON_SCHEMA = {
  type: "object",
  properties: {
    name:           { type: ["string"],           description: "Nome/título completo do produto" },
    price:          { type: ["number", "null"],   description: "Preço atual em reais (apenas número)" },
    original_price: { type: ["number", "null"],   description: "Preço antes do desconto, se houver" },
    image_url:      { type: ["string", "null"],   description: "URL absoluta da imagem principal" },
    rating:         { type: ["number", "null"] },
    review_count:   { type: ["number", "null"] },
    category:       { type: ["string", "null"],   description: "Eletrônicos, Roupas, Casa e Cozinha, Beleza, Esportes ou Outros" },
  },
  required: ["name"],
} as const;

// ── Importar produto por URL ──────────────────────────────────────────────────
export const importProductFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ url: z.string().url() }).parse(input))
  .handler(async ({ data }) => {
    // 1) Firecrawl extração nativa JSON
    const scraped = await firecrawlScrape(data.url, {
      formats: [
        {
          type: "json",
          prompt:
            "Extraia os dados do produto principal desta página de loja. Preços em reais como número (sem R$, sem formatação). image_url deve ser a URL absoluta da imagem principal do produto.",
          schema: PRODUCT_JSON_SCHEMA as unknown as Record<string, unknown>,
        },
        "markdown",
      ],
    });

    const meta       = scraped?.metadata ?? {};
    const jsonResult = scraped?.json ?? scraped?.extract ?? null;

    let name:           string | null = null;
    let price:          number | null = null;
    let original_price: number | null = null;
    let image_url:      string | null = null;
    let rating:         number | null = null;
    let review_count:   number | null = null;
    let category:       string | null = null;

    if (jsonResult && typeof jsonResult === "object") {
      const j = jsonResult as Record<string, unknown>;
      name           = typeof j.name === "string" && j.name.trim() ? j.name.trim() : null;
      price          = toNum(j.price);
      original_price = toNum(j.original_price);
      image_url      = typeof j.image_url === "string" ? j.image_url : null;
      rating         = toNum(j.rating);
      review_count   = toNum(j.review_count);
      category       = typeof j.category === "string" ? j.category : null;
    }

    // 2) Fallback Gemini via markdown se JSON veio vazio
    if (!name || (price == null && !image_url)) {
      const markdown: string = scraped?.markdown ?? "";
      if (markdown.length > 200) {
        try {
          const extracted = await aiExtract(
            `Extraia os dados do produto principal desta página. Retorne JSON {"products":[{name, price (número em reais), original_price (número), image_url (URL absoluta), rating (0-5), review_count, category}]}.`,
            ExtractionSchema,
            markdown,
            "gemini-2.0-flash",
          );
          const p = extracted.products[0];
          if (p) {
            name           = name           ?? p.name;
            price          = price          ?? p.price          ?? null;
            original_price = original_price ?? p.original_price ?? null;
            image_url      = image_url      ?? p.image_url      ?? null;
            rating         = rating         ?? p.rating         ?? null;
            review_count   = review_count   ?? p.review_count   ?? null;
            category       = category       ?? p.category       ?? null;
          }
        } catch { /* ignora, checamos name abaixo */ }
      }
    }

    // 3) Fallback metadados OG
    if (!image_url && typeof meta?.ogImage === "string") image_url = meta.ogImage;
    if (!name) {
      const metaTitle = typeof meta?.ogTitle === "string" ? meta.ogTitle
                      : typeof meta?.title   === "string" ? meta.title
                      : null;
      if (metaTitle?.trim()) name = metaTitle.trim();
    }

    if (!name) {
      throw new Error(
        "Não consegui extrair o produto desta página. A loja pode estar bloqueando o acesso (comum no Shopee). Tente outro link ou cadastre manualmente.",
      );
    }

    const warnings: string[] = [];
    if (price == null) warnings.push("Preço não detectado — edite manualmente.");
    if (!image_url)    warnings.push("Imagem não detectada — adicione no editor.");

    return { name, price, original_price, image_url, url: data.url, rating, review_count, category, source_url: data.url, warning: warnings.length ? warnings.join(" ") : null };
  });

// ── Descobrir ofertas em um marketplace ──────────────────────────────────────
export const discoverDeals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      marketplace: z.enum(["mercadolivre","amazon","shopee","aliexpress","magalu","americanas","shein","kabum"]),
      query: z.string().max(120).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const mp    = MARKETPLACE_PAGES[data.marketplace];
    const query = (data.query ?? "").trim();
    const url   = query
      ? `${mp.url}${mp.url.includes("?") ? "&" : "?"}q=${encodeURIComponent(query)}`
      : mp.url;

    const scraped  = await firecrawlScrape(url, { formats: ["markdown"] });
    const markdown: string = scraped?.markdown ?? "";

    const prompt = `Marketplace: ${mp.name}
Pesquisa: "${query}"

Encontre produtos reais e relevantes nesta página de ofertas. Regras:
- Retorne apenas produtos relacionados à pesquisa (ou os melhores produtos se não houver pesquisa).
- Priorize produtos populares, bem avaliados e com maiores descontos.
- Nunca invente informações. Não retorne produtos sem imagem ou sem link.
- Remova duplicados.
- Se não houver resultados, retorne {"products":[]}.

Formato obrigatório — JSON {"products":[{
  "name": "",
  "price": 0,
  "original_price": 0,
  "discount_percentage": 0,
  "image_url": "https://...",
  "url": "https://...",
  "rating": 0,
  "review_count": 0,
  "description": "",
  "availability": "",
  "category": ""
}]}

price, original_price, discount_percentage, rating e review_count = NÚMEROS (sem R$, sem %).
Todas as URLs devem ser absolutas (https://...).`;

    let extracted: z.infer<typeof ExtractionSchema> = { products: [] };
    try {
      extracted = await aiExtract(prompt, ExtractionSchema, markdown);
    } catch (err) {
      console.error("discoverDeals: Gemini parse failed", err);
    }

    const seen     = new Set<string>();
    const products = extracted.products
      .filter((p) => {
        if (!p.name || !p.image_url || !p.url) return false;
        if (!/^https?:\/\//i.test(p.image_url) || !/^https?:\/\//i.test(p.url)) return false;
        const key = `${p.url}::${p.name.toLowerCase().trim()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((p) => {
        let discount = p.discount_percentage ?? null;
        if (discount == null && p.price && p.original_price && p.original_price > p.price) {
          discount = Math.round((1 - p.price / p.original_price) * 100);
        }
        return { ...p, discount_percentage: discount, source: mp.name, source_url: p.url ?? url };
      });

    return { tab: mp.name, marketplace: mp.name, query, products };
  });
