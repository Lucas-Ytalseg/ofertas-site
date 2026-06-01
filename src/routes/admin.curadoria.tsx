/**
 * /src/routes/admin.curadoria.tsx
 *
 * Curadoria em Lote — busca automática em múltiplos marketplaces,
 * ranqueamento por IA, seleção em lote e publicação com um clique.
 *
 * INSTALAÇÃO:
 * 1. Copie este arquivo para src/routes/admin.curadoria.tsx
 * 2. Em src/routes/admin.tsx, adicione o link no array `links`:
 *      import { Layers } from "lucide-react";
 *      { to: "/admin/curadoria", label: "Curadoria", icon: Layers },
 * 3. Garanta que discoverDeals está exportado em src/lib/offers.functions.ts (já está)
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { discoverDeals } from "@/lib/offers.functions";
import { slugify, formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Layers,
  Sparkles,
  Search,
  CheckCheck,
  X,
  UploadCloud,
  Loader2,
  Star,
  TrendingUp,
  ExternalLink,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronUp,
  Trophy,
  Zap,
  Package,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/curadoria")({
  component: CuradoriaPage,
});

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface RawProduct {
  name: string;
  price?: number | null;
  original_price?: number | null;
  discount_percentage?: number | null;
  image_url?: string | null;
  url?: string | null;
  source?: string;
  source_url?: string;
  rating?: number | null;
  review_count?: number | null;
  category?: string | null;
  description?: string | null;
  availability?: string | null;
}

interface ScoredProduct extends RawProduct {
  _id: string; // uuid temporário para controle de seleção
  _score: number; // 0-100 pontuação de curadoria
  _rank: number; // 1, 2, 3...
  _tier: "top" | "good" | "ok";
}

// ─── Marketplaces configurados ─────────────────────────────────────────────────

const MARKETPLACES = [
  { id: "mercadolivre", name: "Mercado Livre", color: "bg-yellow-500" },
  { id: "amazon",       name: "Amazon BR",     color: "bg-orange-500" },
  { id: "shopee",       name: "Shopee",         color: "bg-orange-600" },
  { id: "aliexpress",   name: "AliExpress",     color: "bg-red-500" },
  { id: "magalu",       name: "Magalu",         color: "bg-blue-600" },
  { id: "americanas",   name: "Americanas",     color: "bg-red-600" },
  { id: "kabum",        name: "Kabum",          color: "bg-green-600" },
  { id: "shein",        name: "Shein",          color: "bg-black" },
] as const;

type MarketplaceId = typeof MARKETPLACES[number]["id"];

// ─── Algoritmo de score/ranking ────────────────────────────────────────────────

function scoreProduct(p: RawProduct): number {
  let score = 0;

  // Desconto — peso 35%
  const disc =
    p.discount_percentage ??
    (p.price && p.original_price && p.original_price > p.price
      ? Math.round((1 - p.price / p.original_price) * 100)
      : 0);
  score += Math.min(disc, 80) * 0.44; // máx 35 pts

  // Rating — peso 25%
  if (p.rating) {
    score += Math.min((p.rating / 5) * 25, 25);
  }

  // Volume de reviews — peso 20%
  if (p.review_count) {
    const rv = Math.min(p.review_count, 10000);
    score += (Math.log10(rv + 1) / Math.log10(10001)) * 20;
  }

  // Tem imagem + link — peso 10%
  if (p.image_url) score += 5;
  if (p.url || p.source_url) score += 5;

  // Tem descrição — peso 5%
  if (p.description && p.description.length > 20) score += 5;

  // Disponível — peso 5%
  if (p.availability && /disponív|estoque|pronta/i.test(p.availability)) score += 5;

  return Math.round(Math.min(score, 100));
}

function rankProducts(products: RawProduct[]): ScoredProduct[] {
  return products
    .map((p, i) => ({
      ...p,
      _id: `${i}-${Math.random().toString(36).slice(2, 7)}`,
      _score: scoreProduct(p),
      _rank: 0,
      _tier: "ok" as const,
    }))
    .sort((a, b) => b._score - a._score)
    .map((p, i) => ({
      ...p,
      _rank: i + 1,
      _tier: (i < 3 ? "top" : i < 10 ? "good" : "ok") as ScoredProduct["_tier"],
    }));
}

// ─── Componente principal ──────────────────────────────────────────────────────

function CuradoriaPage() {
  const [selectedMarkets, setSelectedMarkets] = useState<Set<MarketplaceId>>(
    new Set(["mercadolivre", "amazon", "magalu"])
  );
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<ScoredProduct[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [publishing, setPublishing] = useState(false);
  const [filterTier, setFilterTier] = useState<"all" | "top" | "good" | "ok">("all");
  const [sortBy, setSortBy] = useState<"score" | "discount" | "rating">("score");
  const [searchStatus, setSearchStatus] = useState<
    { market: string; status: "pending" | "done" | "error" }[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);

  const discoverFn = useServerFn(discoverDeals);

  // Busca em múltiplos marketplaces em paralelo
  const handleSearch = useCallback(async () => {
    if (selectedMarkets.size === 0) {
      toast.error("Selecione pelo menos um marketplace.");
      return;
    }
    setIsSearching(true);
    setProducts([]);
    setSelected(new Set());
    const markets = Array.from(selectedMarkets);
    setSearchStatus(markets.map((m) => ({ market: m, status: "pending" })));

    const allRaw: RawProduct[] = [];

    await Promise.allSettled(
      markets.map(async (marketplace) => {
        try {
          const result = await discoverFn({
            data: { marketplace, query: query.trim() || undefined },
          });
          const prods = Array.isArray(result?.products) ? (result.products as RawProduct[]) : [];
          allRaw.push(...prods);
          setSearchStatus((prev) =>
            prev.map((s) => (s.market === marketplace ? { ...s, status: "done" } : s))
          );
        } catch {
          setSearchStatus((prev) =>
            prev.map((s) => (s.market === marketplace ? { ...s, status: "error" } : s))
          );
        }
      })
    );

    // Dedupe por nome aproximado
    const seen = new Set<string>();
    const deduped = allRaw.filter((p) => {
      const key = p.name.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const ranked = rankProducts(deduped);
    setProducts(ranked);

    // Auto-seleciona os TOP 3
    const topIds = ranked.filter((p) => p._tier === "top").map((p) => p._id);
    setSelected(new Set(topIds));

    toast.success(`${ranked.length} produtos encontrados e ranqueados!`);
    setIsSearching(false);
  }, [selectedMarkets, query, discoverFn]);

  // Publicação em lote
  const handlePublish = async () => {
    const toPublish = products.filter((p) => selected.has(p._id));
    if (toPublish.length === 0) {
      toast.error("Selecione ao menos um produto.");
      return;
    }
    setPublishing(true);
    let ok = 0;
    let fail = 0;

    for (const p of toPublish) {
      try {
        // Upsert categoria
        let category_id: string | null = null;
        if (p.category) {
          const slug = slugify(p.category);
          const { data: cat } = await supabase
            .from("categories")
            .select("id")
            .eq("slug", slug)
            .maybeSingle();
          if (cat) {
            category_id = cat.id;
          } else {
            const { data: created } = await supabase
              .from("categories")
              .insert({ name: p.category, slug })
              .select("id")
              .maybeSingle();
            category_id = created?.id ?? null;
          }
        }

        const disc =
          p.discount_percentage ??
          (p.price && p.original_price && p.original_price > p.price
            ? Math.round((1 - p.price / p.original_price) * 100)
            : null);

        const baseSlug = slugify(p.name).slice(0, 70) || `produto-${Date.now()}`;
        const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

        const affiliate_url = p.source_url ?? p.url ?? null;

        await supabase.from("products").insert({
          name: p.name,
          slug,
          price: p.price ?? null,
          original_price: p.original_price ?? null,
          image_url: p.image_url ?? null,
          affiliate_url,
          // Se tiver link afiliado, publica direto; se não, fica aguardando
          awaiting_link: !affiliate_url,
          is_published: !!affiliate_url,
          category_id,
          rating: p.rating ?? 0,
          review_count: p.review_count ?? 0,
          short_description:
            p.description?.trim() ||
            (p.source ? `Importado de ${p.source}` : null),
          tags: disc ? [`-${disc}%`, p.source ?? ""].filter(Boolean) : null,
        });
        ok++;
      } catch {
        fail++;
      }
    }

    toast.success(
      `${ok} produto${ok !== 1 ? "s" : ""} publicado${ok !== 1 ? "s" : ""}!${fail ? ` (${fail} com erro)` : ""}`
    );
    // Remove publicados da lista
    setProducts((prev) => prev.filter((p) => !selected.has(p._id)));
    setSelected(new Set());
    setPublishing(false);
  };

  // Filtros e ordenação
  const filtered = useMemo(() => {
    let list = products;
    if (filterTier !== "all") list = list.filter((p) => p._tier === filterTier);
    if (sortBy === "discount") {
      list = [...list].sort((a, b) => {
        const da =
          a.discount_percentage ??
          (a.price && a.original_price ? Math.round((1 - a.price / a.original_price) * 100) : 0);
        const db =
          b.discount_percentage ??
          (b.price && b.original_price ? Math.round((1 - b.price / b.original_price) * 100) : 0);
        return db - da;
      });
    } else if (sortBy === "rating") {
      list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }
    return list;
  }, [products, filterTier, sortBy]);

  const toggleMarket = (id: MarketplaceId) => {
    setSelectedMarkets((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleProduct = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filtered.map((p) => p._id)));
  const selectNone = () => setSelected(new Set());
  const selectTop = () =>
    setSelected(new Set(filtered.filter((p) => p._tier === "top").map((p) => p._id)));

  const counts = useMemo(
    () => ({
      top: products.filter((p) => p._tier === "top").length,
      good: products.filter((p) => p._tier === "good").length,
      ok: products.filter((p) => p._tier === "ok").length,
    }),
    [products]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold inline-flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Curadoria em Lote
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Busque em vários marketplaces de uma vez. A IA ranqueia os melhores. Você seleciona e publica com um clique.
          </p>
        </div>
        {selected.size > 0 && (
          <Button onClick={handlePublish} disabled={publishing} className="gap-2">
            {publishing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4" />
            )}
            Publicar {selected.size} selecionado{selected.size !== 1 ? "s" : ""}
          </Button>
        )}
      </div>

      {/* Painel de busca */}
      <div className="rounded-xl border bg-card p-4 space-y-4">
        {/* Palavra-chave */}
        <div>
          <Label>Buscar por (opcional)</Label>
          <div className="flex gap-2 mt-1">
            <Input
              placeholder="ex: fone bluetooth, tênis running, notebook gamer..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={isSearching} className="gap-2 shrink-0">
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {isSearching ? "Buscando..." : "Buscar"}
            </Button>
          </div>
        </div>

        {/* Seleção de marketplaces */}
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">
            Marketplaces ({selectedMarkets.size} selecionado{selectedMarkets.size !== 1 ? "s" : ""})
          </Label>
          <div className="flex flex-wrap gap-2">
            {MARKETPLACES.map((m) => {
              const active = selectedMarkets.has(m.id);
              const status = searchStatus.find((s) => s.market === m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggleMarket(m.id)}
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                    ${active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/40 text-muted-foreground hover:border-primary/50"
                    }
                  `}
                >
                  {status?.status === "pending" && isSearching && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  {status?.status === "done" && <span className="text-green-500">✓</span>}
                  {status?.status === "error" && <span className="text-red-500">✗</span>}
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Botões rápidos de seleção de marketplaces */}
        <div className="flex gap-2 flex-wrap">
          <button
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            onClick={() => setSelectedMarkets(new Set(MARKETPLACES.map((m) => m.id) as MarketplaceId[]))}
          >
            Todos
          </button>
          <span className="text-muted-foreground text-xs">·</span>
          <button
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            onClick={() => setSelectedMarkets(new Set(["mercadolivre", "amazon", "magalu"]))}
          >
            Top 3 BR
          </button>
          <span className="text-muted-foreground text-xs">·</span>
          <button
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            onClick={() => setSelectedMarkets(new Set())}
          >
            Limpar
          </button>
        </div>
      </div>

      {/* Resultados */}
      {products.length > 0 && (
        <div className="space-y-4">
          {/* Barra de controle */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Stats por tier */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setFilterTier("all")}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${filterTier === "all" ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
              >
                <Package className="h-3.5 w-3.5" />
                Todos ({products.length})
              </button>
              <button
                onClick={() => setFilterTier("top")}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${filterTier === "top" ? "bg-amber-500/15 border-amber-500 text-amber-600" : "border-border text-muted-foreground hover:border-amber-400/40"}`}
              >
                <Trophy className="h-3.5 w-3.5" />
                Top ({counts.top})
              </button>
              <button
                onClick={() => setFilterTier("good")}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${filterTier === "good" ? "bg-blue-500/15 border-blue-500 text-blue-600" : "border-border text-muted-foreground hover:border-blue-400/40"}`}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Bons ({counts.good})
              </button>
              <button
                onClick={() => setFilterTier("ok")}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${filterTier === "ok" ? "bg-muted border-border text-foreground" : "border-border text-muted-foreground hover:border-foreground/30"}`}
              >
                Outros ({counts.ok})
              </button>
            </div>

            {/* Sort + seleção em massa */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                className="h-8 text-xs rounded-md border bg-background px-2"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              >
                <option value="score">↑ Score IA</option>
                <option value="discount">↑ Desconto</option>
                <option value="rating">↑ Avaliação</option>
              </select>

              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={selectTop}>
                <Trophy className="h-3 w-3" /> Só top
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={selectAll}>
                <CheckCheck className="h-3 w-3" /> Todos
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={selectNone}>
                <X className="h-3 w-3" /> Nenhum
              </Button>
            </div>
          </div>

          {/* Selecionados */}
          {selected.size > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between gap-3">
              <span className="text-sm font-medium">
                <span className="text-primary">{selected.size}</span> produto{selected.size !== 1 ? "s" : ""} selecionado{selected.size !== 1 ? "s" : ""}
              </span>
              <Button onClick={handlePublish} disabled={publishing} size="sm" className="gap-2">
                {publishing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="h-3.5 w-3.5" />
                )}
                Publicar selecionados
              </Button>
            </div>
          )}

          {/* Grid de cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((p) => (
              <ProductCard
                key={p._id}
                product={p}
                selected={selected.has(p._id)}
                onToggle={() => toggleProduct(p._id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Estado vazio */}
      {!isSearching && products.length === 0 && (
        <div className="rounded-xl border border-dashed bg-muted/20 py-16 text-center">
          <Sparkles className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum produto ainda</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Selecione os marketplaces e clique em Buscar
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Card de produto com score visual ─────────────────────────────────────────

function ProductCard({
  product: p,
  selected,
  onToggle,
}: {
  product: ScoredProduct;
  selected: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const discount =
    p.discount_percentage && p.discount_percentage > 0
      ? Math.round(p.discount_percentage)
      : p.price && p.original_price && p.original_price > p.price
      ? Math.round((1 - p.price / p.original_price) * 100)
      : 0;

  const tierColor =
    p._tier === "top"
      ? "border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/20"
      : p._tier === "good"
      ? "border-blue-400/40 bg-blue-50/20 dark:bg-blue-950/10"
      : "border-border bg-card";

  const tierBadge =
    p._tier === "top" ? (
      <Badge className="text-[10px] bg-amber-500 text-white border-0 gap-0.5">
        <Trophy className="h-2.5 w-2.5" /> TOP
      </Badge>
    ) : p._tier === "good" ? (
      <Badge className="text-[10px] bg-blue-500 text-white border-0 gap-0.5">
        <Zap className="h-2.5 w-2.5" /> BOM
      </Badge>
    ) : null;

  return (
    <div
      className={`rounded-xl border-2 overflow-hidden transition-all cursor-pointer ${
        selected
          ? "border-primary ring-2 ring-primary/20"
          : tierColor + " hover:border-primary/40"
      }`}
      onClick={onToggle}
    >
      {/* Imagem + rank + checkbox */}
      <div className="relative aspect-square bg-muted overflow-hidden">
        {p.image_url ? (
          <img
            src={p.image_url}
            alt={p.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full grid place-items-center text-muted-foreground/40">
            <Package className="h-8 w-8" />
          </div>
        )}

        {/* Rank badge */}
        <div className="absolute top-2 left-2">
          <span
            className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-[11px] font-bold ${
              p._rank <= 3
                ? "bg-amber-500 text-white"
                : p._rank <= 10
                ? "bg-blue-500 text-white"
                : "bg-background/80 text-foreground"
            }`}
          >
            {p._rank}
          </span>
        </div>

        {/* Desconto badge */}
        {discount > 0 && (
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-red-600 text-white text-[11px] font-bold">
              -{discount}%
            </span>
          </div>
        )}

        {/* Checkbox overlay */}
        <div className="absolute bottom-2 right-2">
          <div
            className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
              selected
                ? "bg-primary border-primary"
                : "bg-background/70 border-white/80"
            }`}
          >
            {selected && <span className="text-white text-[10px] font-bold">✓</span>}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5 space-y-1.5">
        {/* Nome + tier */}
        <div className="flex items-start gap-1.5">
          <p className="text-xs font-medium line-clamp-2 flex-1 leading-tight">{p.name}</p>
          {tierBadge}
        </div>

        {/* Preços */}
        <div className="flex items-baseline gap-1.5 flex-wrap">
          {p.price != null && (
            <span className="text-sm font-bold">{formatBRL(p.price)}</span>
          )}
          {p.original_price && p.original_price > (p.price ?? 0) && (
            <span className="text-[11px] text-muted-foreground line-through">
              {formatBRL(p.original_price)}
            </span>
          )}
        </div>

        {/* Score + rating */}
        <div className="flex items-center justify-between gap-2">
          {/* Score bar */}
          <div className="flex items-center gap-1.5 flex-1">
            <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  p._score >= 70
                    ? "bg-amber-500"
                    : p._score >= 45
                    ? "bg-blue-500"
                    : "bg-muted-foreground/40"
                }`}
                style={{ width: `${p._score}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground w-6 text-right">{p._score}</span>
          </div>

          {p.rating ? (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground shrink-0">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {p.rating.toFixed(1)}
              {p.review_count ? (
                <span className="text-[10px]">({p.review_count > 999 ? `${(p.review_count / 1000).toFixed(1)}k` : p.review_count})</span>
              ) : null}
            </span>
          ) : null}
        </div>

        {/* Marketplace + expand */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {p.source && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {p.source}
              </Badge>
            )}
            {(p.source_url ?? p.url) && (
              <a
                href={p.source_url ?? p.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {p.description && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Descrição expandível */}
        {expanded && p.description && (
          <p className="text-[11px] text-muted-foreground leading-relaxed pt-1 border-t">
            {p.description}
          </p>
        )}
      </div>
    </div>
  );
}
