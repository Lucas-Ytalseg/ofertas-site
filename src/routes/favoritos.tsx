import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard, type ProductCardProduct } from "@/components/ProductCard";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/favoritos")({
  component: FavoritesPage,
});

function FavoritesPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<ProductCardProduct[] | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("favorites").select("products(id, name, slug, short_description, price, original_price, image_url, rating, review_count, expires_at, awaiting_link)")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const products = (data ?? []).map((d: any) => d.products).filter(Boolean) as ProductCardProduct[];
        setItems(products);
      });
  }, [user]);

  if (loading) return <div className="min-h-screen flex flex-col"><Header /><main className="flex-1 p-8 text-center">Carregando...</main><Footer /></div>;
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 mx-auto max-w-md w-full px-4 py-12 text-center">
          <h1 className="text-2xl font-bold mb-2">Favoritos</h1>
          <p className="text-muted-foreground mb-4">Entre para ver e gerenciar seus produtos favoritos.</p>
          <Link to="/login" className="inline-block rounded bg-primary px-4 py-2 text-primary-foreground">Entrar</Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 py-6">
        <h1 className="text-2xl font-bold mb-4">Meus favoritos</h1>
        {items === null ? <p>Carregando...</p>
          : items.length === 0 ? <p className="text-muted-foreground">Você ainda não favoritou nenhum produto.</p>
          : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {items.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
      </main>
      <Footer />
    </div>
  );
}
