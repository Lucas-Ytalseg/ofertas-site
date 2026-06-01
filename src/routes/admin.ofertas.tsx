import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { discoverDeals, importProductFromUrl } from "@/lib/offers.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Link2, Plus, Loader2, Star, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { slugify } from "@/lib/format";

export const Route = createFileRoute("/admin/ofertas")({ component: OffersPage });

interface ExtractedProduct {
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

const MARKETPLACES = [
  { id: "mercadolivre", name: "Mercado Livre" },
  { id: "amazon", name: "Amazon BR" },
  { id: "shopee", name: "Shopee" },
  { id: "aliexpress", name: "AliExpress" },
  { id: "magalu", name: "Magalu" },
  { id: "americanas", name: "Americanas" },
  { id: "shein", name: "Shein" },
  { id: "kabum", name: "Kabum" },
] as const;

function OffersPage() {
  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold inline-flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> Ofertas Inteligentes
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Descubra produtos em alta nos marketplaces ou importe um produto colando o link.
          A IA extrai nome, preço, imagem e categoria automaticamente.
        </p>
      </div>

      <Tabs defaultValue="import">
        <TabsList>
          <TabsTrigger value="import"><Link2 className="h-4 w-4 mr-1" />Importar por link</TabsTrigger>
          <TabsTrigger value="discover"><Sparkles className="h-4 w-4 mr-1" />Descobrir ofertas</TabsTrigger>
        </TabsList>
        <TabsContent value="import" className="mt-4"><ImportByLink /></TabsContent>
        <TabsContent value="discover" className="mt-4"><DiscoverDeals /></TabsContent>
      </Tabs>
    </div>
  );
}

// -- Import by link --------------------------------------------------------
function ImportByLink() {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<ExtractedProduct | null>(null);
  const importFn = useServerFn(importProductFromUrl);

  const extract = useMutation({
    mutationFn: async (u: string) => importFn({ data: { url: u } }),
    onSuccess: (data) => {
      setPreview(data);
      if (data.warning) toast.warning(data.warning);
      else toast.success("Produto extraído!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => { e.preventDefault(); if (url) extract.mutate(url); }}
        className="flex gap-2"
      >
        <Input
          type="url"
          required
          placeholder="Cole aqui o link do produto (Amazon, Shopee, Mercado Livre...)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button type="submit" disabled={extract.isPending}>
          {extract.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
          Extrair com IA
        </Button>
      </form>

      {preview && <ProductPreview product={preview} onAdded={() => { setPreview(null); setUrl(""); }} />}
    </div>
  );
}

// -- Discover deals --------------------------------------------------------
function DiscoverDeals() {
  const [marketplace, setMarketplace] = useState<typeof MARKETPLACES[number]["id"]>("mercadolivre");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExtractedProduct[]>([]);
  const discoverFn = useServerFn(discoverDeals);

  const discover = useMutation({
    mutationFn: async () => discoverFn({ data: { marketplace, query: query || undefined } }),
    onSuccess: (data) => {
      const products = Array.isArray(data?.products) ? (data.products as ExtractedProduct[]) : [];
      setResults(products);
      const mpName = data?.marketplace ?? MARKETPLACES.find((m) => m.id === marketplace)?.name ?? "";
      if (products.length === 0) toast.warning(`Nenhum produto encontrado em ${mpName}. Tente outra palavra.`);
      else toast.success(`${products.length} produtos encontrados em ${mpName}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <Label>Marketplace</Label>
          <select
            className="w-full h-10 rounded-md border bg-background px-3 text-sm"
            value={marketplace}
            onChange={(e) => setMarketplace(e.target.value as typeof MARKETPLACES[number]["id"])}
          >
            {MARKETPLACES.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label>Filtrar por palavra (opcional)</Label>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ex: fone bluetooth" />
        </div>
        <Button onClick={() => discover.mutate()} disabled={discover.isPending}>
          {discover.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Buscar ofertas
        </Button>
      </div>

      {discover.isPending && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          Analisando {MARKETPLACES.find((m) => m.id === marketplace)?.name} com IA...
        </div>
      )}

      {results.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {results.map((p, i) => <ProductPreview key={i} product={p} compact onAdded={() => setResults((r) => r.filter((_, idx) => idx !== i))} />)}
        </div>
      )}
    </div>
  );
}

// -- Product preview card --------------------------------------------------
function ProductPreview({ product, compact, onAdded }: { product: ExtractedProduct; compact?: boolean; onAdded?: () => void }) {
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const discount =
    product.discount_percentage && product.discount_percentage > 0
      ? Math.round(product.discount_percentage)
      : product.price && product.original_price && product.original_price > product.price
        ? Math.round((1 - product.price / product.original_price) * 100)
        : 0;

  const addToSite = async (openEditor: boolean) => {
    setAdding(true);
    try {
      // ensure category
      let category_id: string | null = null;
      if (product.category) {
        const slug = slugify(product.category);
        const { data: cat } = await supabase.from("categories").select("id").eq("slug", slug).maybeSingle();
        if (cat) category_id = cat.id;
        else {
          const { data: created } = await supabase.from("categories").insert({ name: product.category, slug }).select("id").maybeSingle();
          category_id = created?.id ?? null;
        }
      }

      const baseSlug = slugify(product.name).slice(0, 80) || `produto-${Date.now()}`;
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

      const { data: inserted, error } = await supabase.from("products").insert({
        name: product.name,
        slug,
        price: product.price ?? null,
        original_price: product.original_price ?? null,
        image_url: product.image_url ?? null,
        affiliate_url: product.source_url ?? product.url ?? null,
        category_id,
        rating: product.rating ?? 0,
        review_count: product.review_count ?? 0,
        is_published: false,
        awaiting_link: true,
        short_description: product.description?.trim() || (product.source ? `Importado de ${product.source}` : null),
      }).select("id").maybeSingle();

      if (error) throw error;
      toast.success("Produto adicionado! Cole seu link de afiliado para publicar.");
      onAdded?.();
      if (openEditor && inserted) {
        navigate({ to: "/admin/produtos/$id", params: { id: inserted.id } });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao adicionar");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className={`rounded-xl border bg-card overflow-hidden ${compact ? "" : "flex gap-4 p-4"}`}>
      <div className={compact ? "aspect-square bg-muted overflow-hidden" : "h-32 w-32 shrink-0 rounded-lg bg-muted overflow-hidden"}>
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full w-full grid place-items-center text-muted-foreground text-xs">Sem imagem</div>
        )}
      </div>
      <div className={compact ? "p-3 space-y-2" : "flex-1 min-w-0 space-y-2"}>
        <div className="flex items-start gap-2">
          <h3 className="font-medium text-sm line-clamp-2 flex-1">{product.name}</h3>
          {product.source_url && (
            <a href={product.source_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground shrink-0">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
          {product.price != null && <span className="font-bold">R$ {product.price.toFixed(2)}</span>}
          {product.original_price && product.original_price > (product.price ?? 0) && (
            <>
              <span className="text-xs text-muted-foreground line-through">R$ {product.original_price.toFixed(2)}</span>
              {discount > 0 && <Badge variant="destructive" className="text-[10px]">-{discount}%</Badge>}
            </>
          )}
        </div>
        {product.description && (
          <p className="text-[11px] text-muted-foreground line-clamp-2">{product.description}</p>
        )}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
          {product.source && <Badge variant="secondary" className="text-[10px]">{product.source}</Badge>}
          {product.availability && <Badge variant="outline" className="text-[10px]">{product.availability}</Badge>}
          {product.category && <span>{product.category}</span>}
          {product.rating ? <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 fill-current" />{product.rating.toFixed(1)}{product.review_count ? ` (${product.review_count})` : ""}</span> : null}
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={() => addToSite(false)} disabled={adding} className="flex-1">
            {adding ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
            Adicionar
          </Button>
          {!compact && (
            <Button size="sm" variant="outline" onClick={() => addToSite(true)} disabled={adding}>
              Editar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
