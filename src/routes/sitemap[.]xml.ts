import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const STATIC_PATHS = ["/", "/buscar", "/favoritos", "/login"];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const BASE_URL = `${url.protocol}//${url.host}`;

        const entries: { path: string; lastmod?: string }[] = STATIC_PATHS.map((p) => ({ path: p }));

        try {
          const supabaseUrl = process.env.VITE_SUPABASE_URL;
          const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          if (supabaseUrl && supabaseKey) {
            const sb = createClient(supabaseUrl, supabaseKey);
            const [{ data: products }, { data: categories }] = await Promise.all([
              sb.from("products").select("slug, updated_at").eq("is_published", true).limit(1000),
              sb.from("categories").select("slug, updated_at").limit(500),
            ]);
            for (const p of products ?? []) entries.push({ path: `/produto/${p.slug}`, lastmod: p.updated_at });
            for (const c of categories ?? []) entries.push({ path: `/categoria/${c.slug}`, lastmod: c.updated_at });
          }
        } catch (e) {
          console.error("sitemap error", e);
        }

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...entries.map((e) =>
            `  <url><loc>${BASE_URL}${e.path}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}</url>`
          ),
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
