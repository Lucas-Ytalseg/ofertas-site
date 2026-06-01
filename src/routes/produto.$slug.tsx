import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink, Heart, Star, Eye, BellPlus, Bell, Share2, ChevronRight,
  ShieldCheck, Truck, Tag, ChevronLeft, Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard, type ProductCardProduct } from "@/components/ProductCard";
import { Countdown } from "@/components/Countdown";
import { CouponBox } from "@/components/CouponBox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";
import placeholder from "@/assets/product-placeholder.jpg";

interface Product {
  id: string; name: string; slug: string; short_description: string | null;
  description: string | null; price: number | null; original_price: number | null;
  image_url: string | null; gallery: string[] | null; affiliate_url: string | null;
  category_id: string | null; tags: string[] | null; rating: number | null;
  review_count: number | null; views: number;
  coupon_code: string | null; expires_at: string | null; awaiting_link: boolean;
}

interface Category { id: string; name: string; slug: string }

export const Route = createFileRoute("/produto/$slug")({
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [related, setRelated] = useState<ProductCardProduct[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [fav, setFav] = useState(false);

  useEffect(() => {
    const run = async () => {
      setProduct(undefined);
      const { data } = await supabase.from("products").select("*").eq("slug", slug).eq("is_published", true).maybeSingle();
      setProduct((data as Product | null) ?? null);
      if (data) {
        setActiveImage(data.image_url);
        supabase.rpc("increment_product_views", { _slug: slug });
        if (data.category_id) {
          const [{ data: rel }, { data: cat }] = await Promise.all([
            supabase.from("products")
              .select("id, name, slug, short_description, price, original_price, image_url, rating, review_count, expires_at, awaiting_link")
              .eq("is_published", true).eq("category_id", data.category_id).neq("id", data.id).limit(10),
            supabase.from("categories").select("id, name, slug").eq("id", data.category_id).maybeSingle(),
          ]);
          setRelated((rel ?? []) as ProductCardProduct[]);
          setCategory((cat as Category | null) ?? null);
        } else {
          setCategory(null);
          setRelated([]);
        }
      }
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    };
    run();
  }, [slug]);

  useEffect(() => {
    if (!user || !product) return;
    supabase.from("favorites").select("product_id").eq("user_id", user.id).eq("product_id", product.id)
      .then(({ data }) => setFav(!!data?.length));
  }, [user, product]);

  const toggleFav = async () => {
    if (!user) { toast.error("Entre para favoritar"); return; }
    if (!product) return;
    if (fav) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("product_id", product.id);
      setFav(false);
      toast.success("Removido dos favoritos");
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, product_id: product.id });
      setFav(true);
      toast.success("Adicionado aos favoritos");
    }
  };

  const share = async () => {
    if (!product) return;
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: product.name, text: product.short_description ?? product.name, url }); return; }
      catch { /* user cancelled */ }
    }
    try { await navigator.clipboard.writeText(url); toast.success("Link copiado!"); }
    catch { toast.error("Não foi possível compartilhar"); }
  };

  if (product === undefined) return <ProductSkeleton />;
  if (product === null) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 grid place-items-center p-8 text-center">
          <div>
            <p className="text-lg font-semibold mb-2">Produto não encontrado</p>
            <Link to="/" className="text-sm text-muted-foreground underline">Voltar para a home</Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const gallery = [product.image_url, ...(product.gallery ?? [])].filter(Boolean) as string[];
  const discount = product.original_price && product.price && product.original_price > product.price
    ? Math.round((1 - product.price / product.original_price) * 100) : null;
  const expired = product.expires_at ? new Date(product.expires_at).getTime() < Date.now() : false;
  const buyable = !!product.affiliate_url && !product.awaiting_link && !expired;
  const economy = product.original_price && product.price && product.original_price > product.price
    ? product.original_price - product.price : null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 mx-auto max-w-7xl w-full px-3 sm:px-4 py-4 sm:py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4 overflow-x-auto whitespace-nowrap">
          <Link to="/" className="hover:text-foreground transition-colors">Início</Link>
          <ChevronRight className="h-3 w-3" />
          {category ? (
            <>
              <Link to="/categoria/$slug" params={{ slug: category.slug }} className="hover:text-foreground transition-colors">
                {category.name}
              </Link>
              <ChevronRight className="h-3 w-3" />
            </>
          ) : null}
          <span className="text-foreground font-medium truncate max-w-[60vw]">{product.name}</span>
        </nav>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_420px] gap-5 lg:gap-8">
          {/* Gallery */}
          <Gallery
            gallery={gallery}
            activeImage={activeImage}
            onSelect={setActiveImage}
            productName={product.name}
            discount={discount}
          />

          {/* Buy box */}
          <aside className="space-y-4">
            <div className="bg-card rounded-2xl p-5 sm:p-6 shadow-card border border-border/60">
              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {product.views} visualizações</span>
                {product.rating ? (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3 w-3 fill-promo text-promo" />
                      <span className="font-medium text-foreground">{product.rating.toFixed(1)}</span>
                      {product.review_count ? <span>({product.review_count})</span> : null}
                    </span>
                  </>
                ) : null}
              </div>

              <h1 className="text-xl sm:text-2xl font-extrabold leading-tight tracking-tight">{product.name}</h1>

              {product.short_description && (
                <p className="mt-2 text-sm text-muted-foreground">{product.short_description}</p>
              )}

              {product.price != null && (
                <div className="mt-5">
                  {product.original_price && product.original_price > product.price && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground line-through">{formatBRL(product.original_price)}</span>
                      {discount && (
                        <span className="rounded-md bg-promo px-1.5 py-0.5 font-bold text-promo-foreground">-{discount}%</span>
                      )}
                    </div>
                  )}
                  <div className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                    {formatBRL(product.price)}
                  </div>
                  {economy && (
                    <div className="text-xs text-promo font-semibold mt-1">
                      Você economiza {formatBRL(economy)}
                    </div>
                  )}
                </div>
              )}

              {product.expires_at && !expired && (
                <div className="mt-4">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Oferta termina em</div>
                  <Countdown expiresAt={product.expires_at} />
                </div>
              )}

              {product.coupon_code && buyable && (
                <div className="mt-4">
                  <CouponBox code={product.coupon_code} />
                </div>
              )}

              <div className="mt-5 flex flex-col gap-2">
                {product.awaiting_link ? (
                  <Button size="lg" className="h-12 rounded-full text-sm font-bold" onClick={toggleFav} variant={fav ? "default" : "outline"}>
                    {fav ? <><Bell className="mr-2 h-4 w-4" />Você será avisado</> : <><BellPlus className="mr-2 h-4 w-4" />Avise-me quando chegar</>}
                  </Button>
                ) : buyable ? (
                  <Button asChild size="lg" className="h-12 rounded-full text-sm font-bold shadow-card hover:shadow-hover transition-shadow">
                    <a href={product.affiliate_url!} target="_blank" rel="noopener noreferrer sponsored"
                      onClick={() => { supabase.rpc("increment_product_clicks", { _id: product.id }); }}>
                      Ver Oferta <ExternalLink className="ml-1.5 h-4 w-4" />
                    </a>
                  </Button>
                ) : (
                  <Button size="lg" className="h-12 rounded-full" disabled>
                    Oferta encerrada
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="lg" onClick={toggleFav} aria-label="Favoritar" className="flex-1 h-11 rounded-full">
                    <Heart className={`mr-1.5 h-4 w-4 ${fav ? "fill-destructive text-destructive" : ""}`} />
                    {fav ? "Favoritado" : "Favoritar"}
                  </Button>
                  <Button variant="outline" size="lg" onClick={share} aria-label="Compartilhar" className="flex-1 h-11 rounded-full">
                    <Share2 className="mr-1.5 h-4 w-4" /> Compartilhar
                  </Button>
                </div>
              </div>

              {product.awaiting_link && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Esse produto ainda está aguardando o link da loja. Favorite para receber o link assim que estiver disponível.
                </p>
              )}

              {product.tags && product.tags.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-1.5 pt-4 border-t">
                  {product.tags.map((t) => <Badge key={t} variant="secondary" className="font-normal">{t}</Badge>)}
                </div>
              )}
            </div>

            {/* Trust card */}
            <div className="bg-card rounded-2xl p-5 shadow-card border border-border/60 space-y-3 text-sm">
              <TrustRow icon={<ShieldCheck className="h-4 w-4" />} title="Compra segura" desc="Você compra direto na loja oficial." />
              <TrustRow icon={<Truck className="h-4 w-4" />} title="Envio pela loja" desc="Frete e prazos definidos pelo vendedor." />
              <TrustRow icon={<Tag className="h-4 w-4" />} title="Oferta verificada" desc="Validade e preço conferidos por nós." />
            </div>
          </aside>
        </div>

        {/* Description / Características tabs */}
        {(product.description || (product.tags && product.tags.length > 0)) && (
          <section className="mt-8 bg-card rounded-2xl p-5 sm:p-6 shadow-card border border-border/60">
            <Tabs defaultValue="desc">
              <TabsList className="bg-muted/60">
                <TabsTrigger value="desc">Descrição</TabsTrigger>
                <TabsTrigger value="specs">Características</TabsTrigger>
                <TabsTrigger value="reviews">Avaliações</TabsTrigger>
              </TabsList>
              <TabsContent value="desc" className="pt-5">
                {product.description ? (
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground leading-relaxed">
                    {product.description}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem descrição disponível.</p>
                )}
              </TabsContent>
              <TabsContent value="specs" className="pt-5">
                <SpecsBlock product={product} categoryName={category?.name ?? null} />
              </TabsContent>
              <TabsContent value="reviews" className="pt-5">
                <ReviewsBlock rating={product.rating} count={product.review_count} />
              </TabsContent>
            </Tabs>
          </section>
        )}

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-4">Produtos relacionados</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              {related.slice(0, 5).map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}
      </main>

      {/* Sticky mobile CTA */}
      {buyable && (
        <div className="lg:hidden sticky bottom-0 z-40 border-t bg-card/95 backdrop-blur p-3 shadow-hover">
          <div className="mx-auto max-w-7xl flex items-center gap-3">
            <div className="flex-1 min-w-0">
              {product.price != null && (
                <div className="text-lg font-extrabold leading-none">{formatBRL(product.price)}</div>
              )}
              {discount && <div className="text-[11px] text-promo font-semibold">-{discount}% off</div>}
            </div>
            <Button asChild size="lg" className="rounded-full h-12 px-6 font-bold">
              <a href={product.affiliate_url!} target="_blank" rel="noopener noreferrer sponsored"
                onClick={() => { supabase.rpc("increment_product_clicks", { _id: product.id }); }}>
                Ver Oferta <ExternalLink className="ml-1.5 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}

function Gallery({
  gallery, activeImage, onSelect, productName, discount,
}: {
  gallery: string[]; activeImage: string | null;
  onSelect: (img: string) => void; productName: string; discount: number | null;
}) {
  const [zoom, setZoom] = useState({ active: false, x: 50, y: 50 });
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoom({ active: true, x, y });
  };

  const idx = activeImage ? gallery.indexOf(activeImage) : 0;
  const goPrev = () => onSelect(gallery[(idx - 1 + gallery.length) % gallery.length]);
  const goNext = () => onSelect(gallery[(idx + 1) % gallery.length]);

  return (
    <div className="bg-card rounded-2xl p-3 sm:p-5 shadow-card border border-border/60">
      <div className="grid sm:grid-cols-[88px_minmax(0,1fr)] gap-3 sm:gap-4">
        {/* Thumbnails */}
        <div className="flex sm:flex-col gap-2 order-2 sm:order-1 overflow-x-auto sm:overflow-y-auto sm:max-h-[520px] scrollbar-none">
          {gallery.map((img) => (
            <button
              key={img}
              onClick={() => onSelect(img)}
              className={`shrink-0 h-16 w-16 sm:h-20 sm:w-20 rounded-lg overflow-hidden border-2 transition-all ${
                activeImage === img
                  ? "border-foreground shadow-card"
                  : "border-border/60 hover:border-foreground/40"
              }`}
            >
              <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>

        {/* Main image with zoom */}
        <div className="order-1 sm:order-2 relative">
          <div
            ref={containerRef}
            onMouseMove={onMouseMove}
            onMouseLeave={() => setZoom({ active: false, x: 50, y: 50 })}
            className="relative aspect-square bg-muted/50 rounded-xl overflow-hidden cursor-zoom-in group"
          >
            {activeImage ? (
              <img
                src={activeImage}
                alt={productName}
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = placeholder; }}
                className="h-full w-full object-contain transition-transform duration-200 ease-out"
                style={
                  zoom.active
                    ? { transform: "scale(1.8)", transformOrigin: `${zoom.x}% ${zoom.y}%` }
                    : undefined
                }
              />
            ) : (
              <img src={placeholder} alt="" className="h-full w-full object-contain" />
            )}
            {discount && (
              <span className="absolute top-3 left-3 rounded-md bg-promo px-2 py-1 text-xs font-bold text-promo-foreground shadow-card">
                -{discount}%
              </span>
            )}

            {gallery.length > 1 && (
              <>
                <button
                  onClick={goPrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-card/90 backdrop-blur shadow-card hover:bg-card transition opacity-0 group-hover:opacity-100"
                  aria-label="Imagem anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={goNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-card/90 backdrop-blur shadow-card hover:bg-card transition opacity-0 group-hover:opacity-100"
                  aria-label="Próxima imagem"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>

          {gallery.length > 1 && (
            <div className="mt-2 text-center text-[11px] text-muted-foreground">
              {idx + 1} / {gallery.length} · Passe o mouse para dar zoom
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TrustRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid h-8 w-8 place-items-center rounded-full bg-muted text-foreground shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="font-semibold text-sm text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}

function SpecsBlock({ product, categoryName }: { product: Product; categoryName: string | null }) {
  const specs: Array<[string, string]> = [];
  if (categoryName) specs.push(["Categoria", categoryName]);
  if (product.rating) specs.push(["Avaliação", `${product.rating.toFixed(1)} / 5`]);
  if (product.review_count) specs.push(["Total de avaliações", String(product.review_count)]);
  if (product.coupon_code) specs.push(["Cupom de desconto", product.coupon_code]);
  if (product.tags && product.tags.length > 0) specs.push(["Tags", product.tags.join(", ")]);

  if (specs.length === 0) {
    return <p className="text-sm text-muted-foreground">Características adicionais não informadas.</p>;
  }

  return (
    <dl className="divide-y divide-border/60 rounded-xl border border-border/60 overflow-hidden">
      {specs.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[140px_1fr] sm:grid-cols-[200px_1fr] gap-3 px-4 py-2.5 odd:bg-muted/40 text-sm">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="font-medium text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function ReviewsBlock({ rating, count }: { rating: number | null; count: number | null }) {
  if (!rating || !count) {
    return <p className="text-sm text-muted-foreground">Este produto ainda não tem avaliações por aqui.</p>;
  }
  const r = Math.round(rating);
  return (
    <div className="flex items-center gap-5">
      <div className="text-center">
        <div className="text-4xl font-extrabold tracking-tight">{rating.toFixed(1)}</div>
        <div className="flex justify-center mt-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={`h-4 w-4 ${i < r ? "fill-promo text-promo" : "text-muted"}`} />
          ))}
        </div>
        <div className="text-xs text-muted-foreground mt-1">{count} avaliações</div>
      </div>
      <div className="flex-1 text-sm text-muted-foreground flex items-center gap-2">
        <Check className="h-4 w-4 text-success" />
        Avaliações agregadas da loja parceira.
      </div>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 py-6">
        <Skeleton className="h-4 w-64 mb-4" />
        <div className="grid lg:grid-cols-[minmax(0,1fr)_420px] gap-6">
          <Skeleton className="aspect-square rounded-2xl" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-12 w-1/3" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
