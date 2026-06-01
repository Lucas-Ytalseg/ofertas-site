import { Link } from "@tanstack/react-router";
import { Heart, Star, BellPlus, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";
import placeholder from "@/assets/product-placeholder.jpg";
import { Countdown } from "@/components/Countdown";

export interface ProductCardProduct {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  price: number | null;
  original_price: number | null;
  image_url: string | null;
  rating: number | null;
  review_count: number | null;
  expires_at?: string | null;
  awaiting_link?: boolean;
}

export function ProductCard({ product }: { product: ProductCardProduct }) {
  const { user } = useAuth();
  const [fav, setFav] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase.from("favorites").select("product_id").eq("user_id", user.id).eq("product_id", product.id)
      .then(({ data }) => { if (active) setFav(!!data?.length); });
    return () => { active = false; };
  }, [user, product.id]);

  const toggleFav = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) { toast.error("Entre para favoritar"); return; }
    if (fav) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("product_id", product.id);
      setFav(false);
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, product_id: product.id });
      setFav(true);
    }
  };

  const discount = product.original_price && product.price && product.original_price > product.price
    ? Math.round((1 - product.price / product.original_price) * 100)
    : null;

  return (
    <Link
      to="/produto/$slug"
      params={{ slug: product.slug }}
      className="group flex flex-col rounded-xl bg-card border border-border/60 shadow-card hover:shadow-hover hover:-translate-y-0.5 hover:border-foreground/20 transition-all duration-300 overflow-hidden"
    >
      <div className="relative aspect-square bg-muted overflow-hidden">
        <img
          src={product.image_url || placeholder}
          alt={product.name}
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = placeholder; }}
          className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
        />
        <button
          onClick={toggleFav}
          aria-label="Favoritar"
          className="absolute top-2.5 right-2.5 grid h-9 w-9 place-items-center rounded-full bg-card/95 backdrop-blur shadow-card hover:scale-110 transition-transform"
        >
          <Heart className={`h-4 w-4 ${fav ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
        </button>
        {discount && !product.awaiting_link && (
          <span className="absolute top-2.5 left-2.5 rounded-md bg-promo px-2 py-1 text-[11px] font-bold text-promo-foreground shadow-card">
            -{discount}%
          </span>
        )}
        {product.awaiting_link && (
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-md bg-foreground px-2 py-1 text-[10px] font-bold text-background">
            <BellPlus className="h-3 w-3" /> Em breve
          </span>
        )}
        {product.expires_at && !product.awaiting_link && (
          <div className="absolute bottom-2.5 left-2.5">
            <Countdown expiresAt={product.expires_at} className="!py-0.5 !text-[10px]" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <h3 className="line-clamp-2 text-sm leading-snug text-foreground group-hover:text-foreground min-h-[2.5rem]">
          {product.name}
        </h3>
        {product.price != null && (
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-lg font-extrabold text-foreground tracking-tight">{formatBRL(product.price)}</span>
            {product.original_price && product.original_price > product.price && (
              <span className="text-xs text-muted-foreground line-through">{formatBRL(product.original_price)}</span>
            )}
          </div>
        )}
        {product.rating != null && product.rating > 0 ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3 w-3 fill-promo text-promo" />
            <span className="font-medium text-foreground">{product.rating.toFixed(1)}</span>
            {product.review_count ? <span>({product.review_count})</span> : null}
          </div>
        ) : <div className="h-4" />}
        <div className="mt-1.5 inline-flex items-center justify-center gap-1.5 rounded-full bg-foreground text-background py-2 text-xs font-semibold opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-300">
          Ver Oferta <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </Link>
  );
}
