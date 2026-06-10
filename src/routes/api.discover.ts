import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const MARKETPLACE_PAGES: Record<string, { name: string; url: string; searchUrl: string }> = {
  mercadolivre: { name: "Mercado Livre", url: "https://www.mercadolivre.com.br/ofertas",          searchUrl: "https://lista.mercadolivre.com.br/{query}" },
  amazon:       { name: "Amazon BR",     url: "https://www.amazon.com.br/gp/goldbox",             searchUrl: "https://www.amazon.com.br/s?k={query}" },
  shopee:       { name: "Shopee",        url: "https://shopee.com.br/flash_sale",                 searchUrl: "https://shopee.com.br/search?keyword={query}" },
  aliexpress:   { name: "AliExpress",    url: "https://pt.aliexpress.com/p/sales/index.html",     searchUrl: "https://pt.aliexpress.com/wholesale?SearchText={query}" },
  magalu:       { name: "Magalu",        url: "https://www.magazineluiza.com.br/selecao/ofertasdodia/", searchUrl: "https://www.magazineluiza.com.br/busca/{query}/" },
  americanas:   { name: "Americanas",    url: "https://www.americanas.com.br/hotsite/ofertas-do-dia",   searchUrl: "https://www.americanas.com.br/busca/{query}" },
  shein:        { name: "Shein",         url: "https://br.shein.com/promotion-page.html",         searchUrl: "https://br.shein.com/pdsearch/{query}/" },
  kabum:        { name: "Kabum",         url: "https://www.kabum.com.br/ofertas",                 searchUrl: "https://www.kabum.com.br/busca/{query}" },
};

// Tags de afiliado
const AFFILIATE_TAGS = {
  amazon:       "directofert0f-20",
  mercadolivre: "lucasberg",
  magalu:       "directofertas12",
};

function addAffiliateTag(url: string, marketplace: string): string {
  try {
    const u = new URL(url);
    if (marketplace === "amazon" && (u.hostname.includes("amazon.com.br") || u.hostname.includes("amzn.to"))) {
      u.searchParams.set("tag", AFFILIATE_TAGS.amazon);
      return u.toString();
    }
    if (marketplace === "mercadolivre" && u.hostname.includes("mercadolivre.com.br")) {
      u.searchParams.set("matt_tool", AFFILIATE_TAGS.mercadolivre);
      return u.toString();
    }
    if (marketplace === "magalu" && u.hostname.includes("magazineluiza.com.br")) {
      // Magalu usa subdomínio magazinevoce
      return `https://www.magazinevoce.com.br/magazine${AFFILIATE_TAGS.magalu}/${u.pathname}${u.search}`;
    }
  } catch { /* ignora URLs inválidas */ }
  return url;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let s = v.replace(/[^\d.,-]/g, "").trim();
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

async function firecrawlScrape(url: string, apiKey: string) {
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, waitFor: 2500 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Firecrawl ${res.status}`);
  return data?.data ?? data;
}

async function groqExtract(prompt: string, content: string, apiKey: string) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: `Responda APENAS JSON valido, sem markdown.\n\n${prompt}\n\nConteudo:\n${content.slice(0, 10000)}` }],
      temperature: 0.1,
      response_format: { type: "json_object" },
      max_tokens: 4096,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const raw: string = data?.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(raw); } catch { return { products: [] }; }
}

export const Route = createFileRoute("/api/discover")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const firecrawlKey = process.env.FIRECRAWL_API_KEY ?? "";
          const groqKey = process.env.GROQ_API_KEY ?? "";
          if (!firecrawlKey) throw new Error("FIRECRAWL_API_KEY nao configurado");
          if (!groqKey) throw new Error("GROQ_API_KEY nao configurado");

          const body = await request.json();
          const { marketplace, query } = z.object({
            marketplace: z.enum(["mercadolivre","amazon","shopee","aliexpress","magalu","americanas","shein","kabum"]),
            query: z.string().max(120).optional(),
          }).parse(body);

          const mp = MARKETPLACE_PAGES[marketplace];
          const q = (query ?? "").trim();
          const url = q
            ? mp.searchUrl.replace("{query}", encodeURIComponent(q))
            : mp.url;

          const scraped = await firecrawlScrape(url, firecrawlKey);
          const markdown: string = scraped?.markdown ?? "";

          const prompt = `Marketplace: ${mp.name}. Pesquisa: "${q}".
Encontre produtos reais. Retorne JSON: {"products":[{"name":"","price":0,"original_price":0,"discount_percentage":0,"image_url":"https://...","url":"https://...","rating":0,"review_count":0,"description":"","category":""}]}
Somente produtos com image_url e url absolutos (https://). Numeros sem R$ ou %. Se nao houver, retorne {"products":[]}.`;

          const extracted = await groqExtract(prompt, markdown, groqKey);

          const numericFields = ["price","original_price","discount_percentage","rating","review_count"];
          const seen = new Set<string>();
          const products = (Array.isArray(extracted?.products) ? extracted.products : [])
            .map((p: Record<string, unknown>) => {
              const out = { ...p };
              for (const f of numericFields) if (f in out) out[f] = toNum(out[f]);
              return out;
            })
            .filter((p: Record<string, unknown>) => {
              if (!p.name || !p.image_url || !p.url) return false;
              if (!/^https?:\/\//i.test(String(p.image_url)) || !/^https?:\/\//i.test(String(p.url))) return false;
              const key = `${p.url}::${String(p.name).toLowerCase().trim()}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            })
            .map((p: Record<string, unknown>) => {
              let discount = (p.discount_percentage as number) ?? null;
              const price = p.price as number;
              const orig = p.original_price as number;
              if (!discount && price && orig && orig > price) discount = Math.round((1 - price / orig) * 100);
              // Adiciona tag de afiliado no link
              const affiliateUrl = addAffiliateTag(String(p.url), marketplace);
              return { ...p, discount_percentage: discount, source: mp.name, source_url: affiliateUrl, url: affiliateUrl };
            });

          return new Response(JSON.stringify({ marketplace: mp.name, query: q, products }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: String(err), products: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
