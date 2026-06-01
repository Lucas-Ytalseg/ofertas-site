import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff, Search, ImageIcon, Clock, BellPlus, Tag, Copy, MousePointerClick } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/produtos")({ component: AdminProductsList });

interface Row {
  id: string; name: string; slug: string; price: number | null; image_url: string | null;
  views: number; click_count: number; featured: boolean; is_published: boolean; created_at: string;
  awaiting_link: boolean; expires_at: string | null; coupon_code: string | null; affiliate_url: string | null;
  scheduled_publish_at: string | null;
}
type Tab = "all" | "active" | "scheduled" | "awaiting" | "expired";

function AdminProductsList() {
  const [items, setItems] = useState<Row[] | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const path = useRouterState({ select: (state) => state.location.pathname });
  const isListRoute = path === "/admin/produtos";

  const load = async () => {
    const { data } = await supabase.from("products")
      .select("id, name, slug, price, image_url, views, click_count, featured, is_published, created_at, awaiting_link, expires_at, coupon_code, affiliate_url, scheduled_publish_at")
      .order("created_at", { ascending: false });
    setItems((data as Row[]) ?? []);
  };
  useEffect(() => { if (isListRoute) load(); }, [isListRoute]);

  const filtered = useMemo(() => {
    if (!items) return null;
    const now = Date.now();
    return items.filter((p) => {
      const isScheduled = !!p.scheduled_publish_at && new Date(p.scheduled_publish_at).getTime() > now && !p.is_published;
      if (tab === "awaiting" && !p.awaiting_link) return false;
      if (tab === "scheduled" && !isScheduled) return false;
      if (tab === "active" && (p.awaiting_link || isScheduled || (p.expires_at && new Date(p.expires_at).getTime() < now) || !p.is_published)) return false;
      if (tab === "expired" && (!p.expires_at || new Date(p.expires_at).getTime() >= now)) return false;
      if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [items, tab, q]);

  const counts = useMemo(() => {
    if (!items) return { all: 0, active: 0, scheduled: 0, awaiting: 0, expired: 0 };
    const now = Date.now();
    const isScheduled = (p: Row) => !!p.scheduled_publish_at && new Date(p.scheduled_publish_at).getTime() > now && !p.is_published;
    return {
      all: items.length,
      active: items.filter((p) => p.is_published && !p.awaiting_link && !isScheduled(p) && (!p.expires_at || new Date(p.expires_at).getTime() >= now)).length,
      scheduled: items.filter(isScheduled).length,
      awaiting: items.filter((p) => p.awaiting_link).length,
      expired: items.filter((p) => p.expires_at && new Date(p.expires_at).getTime() < now).length,
    };
  }, [items]);

  const remove = async (id: string) => {
    if (!confirm("Excluir este produto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Excluído"); load(); }
  };
  const togglePublish = async (id: string, value: boolean) => {
    const { error } = await supabase.from("products").update({ is_published: value }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };
  const toggleFeatured = async (id: string, value: boolean) => {
    const { error } = await supabase.from("products").update({ featured: value }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };
  const duplicate = async (id: string) => {
    const { error } = await supabase.rpc("duplicate_product", { _id: id });
    if (error) toast.error(error.message);
    else { toast.success("Produto duplicado (rascunho)"); load(); }
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "Todos", count: counts.all },
    { key: "active", label: "Ativos", count: counts.active },
    { key: "scheduled", label: "Agendados", count: counts.scheduled },
    { key: "awaiting", label: "Sem link", count: counts.awaiting },
    { key: "expired", label: "Encerrados", count: counts.expired },
  ];

  if (!isListRoute) return <Outlet />;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold">Produtos</h2>
          <p className="text-xs text-muted-foreground">Gerencie seu catálogo de ofertas</p>
        </div>
        <Link to="/admin/produtos/$id" params={{ id: "novo" }}><Button><Plus className="h-4 w-4 mr-1" />Novo produto</Button></Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${tab === t.key ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
            {t.label}
            <span className={`rounded-full px-1.5 ${tab === t.key ? "bg-background/20" : "bg-background"}`}>{t.count}</span>
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8 w-56" placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {filtered === null ? <p>Carregando...</p>
        : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="text-muted-foreground mb-3">Nenhum produto nessa aba.</p>
            <Link to="/admin/produtos/$id" params={{ id: "novo" }}><Button variant="outline"><Plus className="h-4 w-4 mr-1" />Adicionar produto</Button></Link>
          </div>
        ) : (
          <div className="grid gap-2">
            {filtered.map((p) => {
              const expired = p.expires_at && new Date(p.expires_at).getTime() < Date.now();
              const scheduled = p.scheduled_publish_at && new Date(p.scheduled_publish_at).getTime() > Date.now() && !p.is_published;
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:shadow-card transition">
                  <div className="h-14 w-14 rounded bg-muted overflow-hidden shrink-0 grid place-items-center border">
                    {p.image_url
                      ? <img src={p.image_url} alt="" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                      : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium line-clamp-1">{p.name}</div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="text-sm font-semibold">{p.price != null ? formatBRL(p.price) : "Sem preço"}</span>
                      <span className="text-xs text-muted-foreground">· {p.views} views</span>
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-0.5"><MousePointerClick className="h-3 w-3" />{p.click_count}</span>
                      {p.awaiting_link && <Badge tone="slate" icon={<BellPlus className="h-3 w-3" />}>Sem link</Badge>}
                      {scheduled && <Badge tone="sky" icon={<Clock className="h-3 w-3" />}>Agendado</Badge>}
                      {expired && <Badge tone="destructive" icon={<Clock className="h-3 w-3" />}>Encerrado</Badge>}
                      {p.expires_at && !expired && !scheduled && <Badge tone="amber" icon={<Clock className="h-3 w-3" />}>Com prazo</Badge>}
                      {p.coupon_code && <Badge tone="primary" icon={<Tag className="h-3 w-3" />}><span className="font-mono">{p.coupon_code}</span></Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button title={p.featured ? "Tirar dos destaques" : "Marcar como destaque"} onClick={() => toggleFeatured(p.id, !p.featured)} className={`h-8 w-8 grid place-items-center rounded hover:bg-muted ${p.featured ? "text-yellow-500" : "text-muted-foreground"}`}>★</button>
                    <button title={p.is_published ? "Despublicar" : "Publicar"} onClick={() => togglePublish(p.id, !p.is_published)} className="h-8 w-8 grid place-items-center rounded text-muted-foreground hover:bg-muted hover:text-primary">
                      {p.is_published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <Button size="sm" variant="ghost" title="Duplicar" onClick={() => duplicate(p.id)}><Copy className="h-4 w-4" /></Button>
                    <Link to="/admin/produtos/$id" params={{ id: p.id }}>
                      <Button size="sm" variant="ghost"><Pencil className="h-4 w-4" /></Button>
                    </Link>
                    <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}

function Badge({ tone, icon, children }: { tone: "slate" | "sky" | "destructive" | "amber" | "primary"; icon?: React.ReactNode; children: React.ReactNode }) {
  const map: Record<string, string> = {
    slate: "bg-foreground/10 text-foreground",
    sky: "bg-sky-500/10 text-sky-700",
    destructive: "bg-destructive/10 text-destructive",
    amber: "bg-amber-500/10 text-amber-700",
    primary: "bg-primary/10 text-primary",
  };
  return <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${map[tone]}`}>{icon}{children}</span>;
}
