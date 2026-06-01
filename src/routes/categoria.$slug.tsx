import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard, type ProductCardProduct } from "@/components/ProductCard";

export const Route = createFileRoute("/categoria/$slug")({
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const [category, setCategory] = useState<{ id: string; name: string } | null>(null);
  const [items, setItems] = useState<ProductCardProduct[] | null>(null);
  const [sort, setSort] = useState<"recent" | "asc" | "desc" | "popular">("recent");

  useEffect(() => {
    const run = async () => {
      setItems(null);
      const { data: cat } = await supabase.from("categories").select("id, name").eq("slug", slug).maybeSingle();
      if (!cat) { setCategory(null); setItems([]); return; }
      setCategory(cat);
      let query = supabase
        .from("products")
        .select("id, name, slug, short_description, price, original_price, image_url, rating, review_count, expires_at, awaiting_link")
        .eq("is_published", true)
        .eq("category_id", cat.id);
      if (sort === "asc") query = query.order("price", { ascending: true, nullsFirst: false });
      else if (sort === "desc") query = query.order("price", { ascending: false, nullsFirst: false });
      else if (sort === "popular") query = query.order("views", { ascending: false });
      else query = query.order("created_at", { ascending: false });
      const { data } = await query.limit(60);
      setItems((data ?? []) as ProductCardProduct[]);
    };
    run();
  }, [slug, sort]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h1 className="text-2xl font-bold">{category?.name ?? "Categoria"}</h1>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded border bg-card px-3 py-1.5 text-sm">
            <option value="recent">Mais recentes</option>
            <option value="popular">Mais vistos</option>
            <option value="asc">Menor preço</option>
            <option value="desc">Maior preço</option>
          </select>
        </div>
        {items === null ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground">Nenhum produto nesta categoria ainda.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
