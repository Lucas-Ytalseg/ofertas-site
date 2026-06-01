import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Instagram, Truck, ShieldCheck, Headphones, Tag, Flame, Sparkles, Clock } from "lucide-react";
import Autoplay from "embla-carousel-autoplay";
import { supabase } from "@/integrations/supabase/client";
import { Header, INSTAGRAM_URL, INSTAGRAM_HANDLE } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard, type ProductCardProduct } from "@/components/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious,
} from "@/components/ui/carousel";
import catEletronicos from "@/assets/categories/eletronicos.jpg";
import catRoupas from "@/assets/categories/roupas.jpg";
import catCasa from "@/assets/categories/casa-e-cozinha.jpg";
import catBeleza from "@/assets/categories/beleza.jpg";
import catEsportes from "@/assets/categories/esportes.jpg";
import catOutros from "@/assets/categories/outros.jpg";
import productPlaceholder from "@/assets/product-placeholder.jpg";
import banner1 from "@/assets/banners/banner-1.jpg";
import banner2 from "@/assets/banners/banner-2.jpg";
import banner3 from "@/assets/banners/banner-3.jpg";

const CATEGORY_FALLBACK: Record<string, string> = {
  eletronicos: catEletronicos,
  roupas: catRoupas,
  "casa-e-cozinha": catCasa,
  beleza: catBeleza,
  esportes: catEsportes,
  outros: catOutros,
};

interface BannerItem {
  image: string;
  image_mobile?: string | null;
  eyebrow: string;
  title: string;
  subtitle: string;
  align: "left" | "right" | "center";
  link_url?: string | null;
  cta_label?: string | null;
}

const FALLBACK_BANNERS: BannerItem[] = [
  { image: banner1, eyebrow: "Ofertas selecionadas", title: "Tecnologia e mais com descontos imperdíveis", subtitle: "Eletrônicos, áudio e acessórios com links diretos para os melhores preços.", align: "left" },
  { image: banner2, eyebrow: "Moda & Beleza", title: "Achados que fazem a diferença", subtitle: "Estilo, perfumes e cosméticos garimpados a dedo para você.", align: "right" },
  { image: banner3, eyebrow: "Casa & Cozinha", title: "Aconchego em cada detalhe", subtitle: "Itens essenciais para deixar seu lar mais bonito e funcional.", align: "left" },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Direct Ofertas — Marketplace de ofertas selecionadas" },
      { name: "description", content: "Direct Ofertas: marketplace moderno com ofertas selecionadas em eletrônicos, moda, casa, beleza e mais. Links diretos para os melhores sites." },
    ],
  }),
  component: HomePage,
});

interface Category { id: string; name: string; slug: string; icon: string | null; image_url: string | null }

function HomePage() {
  const [featured, setFeatured] = useState<ProductCardProduct[] | null>(null);
  const [recent, setRecent] = useState<ProductCardProduct[] | null>(null);
  const [popular, setPopular] = useState<ProductCardProduct[] | null>(null);
  const [awaiting, setAwaiting] = useState<ProductCardProduct[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<BannerItem[]>(FALLBACK_BANNERS);

  useEffect(() => {
    supabase.from("banners").select("title, subtitle, eyebrow, image_url, image_url_mobile, link_url, cta_label, align")
      .order("sort_order").then(({ data }) => {
        if (data && data.length > 0) {
          setBanners(data.filter((b) => b.image_url).map((b) => ({
            image: b.image_url!, image_mobile: b.image_url_mobile,
            eyebrow: b.eyebrow ?? "", title: b.title ?? "", subtitle: b.subtitle ?? "",
            align: (b.align as BannerItem["align"]) ?? "left",
            link_url: b.link_url, cta_label: b.cta_label,
          })));
        }
      });
  }, []);

  useEffect(() => {
    const fields = "id, name, slug, short_description, price, original_price, image_url, rating, review_count, expires_at, awaiting_link";
    supabase.from("products").select(fields).eq("is_published", true).eq("featured", true).eq("awaiting_link", false).limit(12)
      .then(({ data }) => setFeatured((data ?? []) as ProductCardProduct[]));
    supabase.from("products").select(fields).eq("is_published", true).eq("awaiting_link", false).order("created_at", { ascending: false }).limit(12)
      .then(({ data }) => setRecent((data ?? []) as ProductCardProduct[]));
    supabase.from("products").select(fields).eq("is_published", true).eq("awaiting_link", false).order("views", { ascending: false }).limit(12)
      .then(({ data }) => setPopular((data ?? []) as ProductCardProduct[]));
    supabase.from("products").select(fields).eq("is_published", true).eq("awaiting_link", true).order("created_at", { ascending: false }).limit(10)
      .then(({ data }) => setAwaiting((data ?? []) as ProductCardProduct[]));
    supabase.from("categories").select("id, name, slug, icon, image_url").order("sort_order")
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* Hero banner carousel */}
        <HeroBanner banners={banners} />

        {/* Trust strip */}
        <section className="border-b bg-card">
          <div className="mx-auto max-w-7xl px-4 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs sm:text-sm">
            <TrustItem icon={<Tag className="h-4 w-4" />} title="Ofertas selecionadas" desc="Garimpadas a dedo" />
            <TrustItem icon={<Truck className="h-4 w-4" />} title="Links diretos" desc="Aos melhores sites" />
            <TrustItem icon={<ShieldCheck className="h-4 w-4" />} title="Compra segura" desc="Lojas confiáveis" />
            <TrustItem icon={<Headphones className="h-4 w-4" />} title="Atendimento" desc="Via Instagram" />
          </div>
        </section>

        {/* Categorias */}
        <section className="mx-auto max-w-7xl px-4 mt-10">
          <SectionHeader title="Navegue por categoria" />
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4">
            {categories.map((c) => (
              <Link
                key={c.id}
                to="/categoria/$slug"
                params={{ slug: c.slug }}
                className="group relative aspect-square overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card hover:shadow-hover hover:-translate-y-1 transition-all duration-300"
              >
                <img
                  src={c.image_url ?? CATEGORY_FALLBACK[c.slug] ?? productPlaceholder}
                  alt={c.name}
                  loading="lazy"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = productPlaceholder; }}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3">
                  <span className="text-xs sm:text-sm font-semibold text-white drop-shadow">{c.name}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Em destaque - carrossel */}
        <FeaturedCarousel items={featured} />

        {awaiting && awaiting.length > 0 && (
          <Section
            icon={<Clock className="h-5 w-5" />}
            title="Em breve"
            subtitle="Favorite e seja avisado quando o link sair"
            items={awaiting}
          />
        )}

        <Section
          icon={<Flame className="h-5 w-5 text-promo" />}
          title="Mais vistos"
          subtitle="O que está bombando agora"
          items={popular}
        />

        <Section
          icon={<Sparkles className="h-5 w-5" />}
          title="Adicionados recentemente"
          subtitle="Novidades fresquinhas"
          items={recent}
        />

        {/* Instagram CTA */}
        <section className="mx-auto max-w-7xl px-4 mt-12 mb-8">
          <div className="rounded-3xl border bg-card p-6 sm:p-10 grid sm:grid-cols-[1fr_auto] items-center gap-5 shadow-card">
            <div>
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Receba ofertas em primeira mão</h3>
              <p className="mt-1 text-sm sm:text-base text-muted-foreground">Siga {INSTAGRAM_HANDLE} no Instagram para ofertas relâmpago todos os dias.</p>
            </div>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-6 py-3 text-sm font-semibold hover:opacity-90 transition shadow-card"
            >
              <Instagram className="h-4 w-4" />
              Seguir no Instagram
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function HeroBanner({ banners }: { banners: BannerItem[] }) {
  const autoplay = useRef(Autoplay({ delay: 5000, stopOnInteraction: false }));
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 pt-4 sm:pt-6">
        <Carousel
          opts={{ loop: true, align: "start" }}
          plugins={[autoplay.current]}
          className="relative"
        >
          <CarouselContent>
            {banners.map((b, i) => (
              <CarouselItem key={i}>
                <div className="relative overflow-hidden rounded-3xl border border-border/60 shadow-card">
                  <img
                    src={b.image}
                    alt={b.title}
                    className="h-[260px] sm:h-[400px] w-full object-cover"
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                  <div
                    className={`absolute inset-0 ${
                      b.align === "left"
                        ? "bg-gradient-to-r from-background/95 via-background/60 to-transparent"
                        : "bg-gradient-to-l from-background/95 via-background/60 to-transparent"
                    }`}
                  />
                  <div
                    className={`absolute inset-0 flex items-center ${
                      b.align === "left" ? "justify-start" : "justify-end"
                    } p-6 sm:p-12`}
                  >
                    <div className={`max-w-md ${b.align === "right" ? "text-right" : ""}`}>
                      <span className="inline-block text-[11px] font-semibold uppercase tracking-widest text-promo mb-2">
                        {b.eyebrow}
                      </span>
                      <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
                        {b.title}
                      </h2>
                      <p className="mt-2 text-sm sm:text-base text-muted-foreground">{b.subtitle}</p>
                      {b.link_url ? (
                        <a href={b.link_url} target={b.link_url.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer"
                          className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition shadow-card">
                          {b.cta_label || "Ver ofertas"}
                        </a>
                      ) : (
                        <Link to="/buscar" search={{ q: "" }}
                          className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition shadow-card">
                          {b.cta_label || "Ver ofertas"}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-4 hidden sm:flex" />
          <CarouselNext className="right-4 hidden sm:flex" />
        </Carousel>
      </div>
    </section>
  );
}

function TrustItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-muted text-foreground shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="font-semibold text-foreground truncate">{title}</div>
        <div className="text-muted-foreground truncate text-xs">{desc}</div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon?: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">{title}</h2>
        </div>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function FeaturedCarousel({ items }: { items: ProductCardProduct[] | null }) {
  return (
    <section className="mx-auto max-w-7xl px-4 mt-10">
      <SectionHeader icon={<Tag className="h-5 w-5 text-promo" />} title="Em destaque" subtitle="Ofertas escolhidas a dedo para você" />
      {items === null ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState text="Nenhum produto em destaque ainda." />
      ) : (
        <Carousel opts={{ align: "start", slidesToScroll: 2 }} className="relative">
          <CarouselContent className="-ml-3">
            {items.map((p) => (
              <CarouselItem key={p.id} className="pl-3 basis-1/2 sm:basis-1/3 lg:basis-1/5">
                <ProductCard product={p} />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="-left-3 hidden sm:flex" />
          <CarouselNext className="-right-3 hidden sm:flex" />
        </Carousel>
      )}
    </section>
  );
}

function Section({ title, subtitle, icon, items }: { title: string; subtitle?: string; icon?: React.ReactNode; items: ProductCardProduct[] | null }) {
  return (
    <section className="mx-auto max-w-7xl px-4 mt-10">
      <SectionHeader title={title} subtitle={subtitle} icon={icon} />
      {items === null ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState text="Nenhum produto encontrado." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {items.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground bg-card">
      {text}
    </div>
  );
}
