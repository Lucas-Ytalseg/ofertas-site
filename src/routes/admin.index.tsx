import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Package, Eye, Star, Clock, MousePointerClick, Image as ImageIcon, Tag, BellPlus, Plus, ArrowRight, TrendingUp } from "lucide-react";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/admin/")({ component: Dashboard });

interface Stats {
  total: number; active: number; expired: number; featured: number;
  awaiting: number; clicks: number; views: number;
}
interface TopProduct { id: string; name: string; slug: string; views: number; click_count: number; image_url: string | null; price: number | null }
interface TopCategory { name: string; slug: string; count: number }

function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [topClicked, setTopClicked] = useState<TopProduct[] | null>(null);
  const [topViewed, setTopViewed] = useState<TopProduct[] | null>(null);
  const [topCats, setTopCats] = useState<TopCategory[] | null>(null);
  const [recent, setRecent] = useState<{ id: string; name: string; slug: string; created_at: string }[] | null>(null);

  useEffect(() => {
    (async () => {
      const now = new Date().toISOString();
      const [{ data: products }, { data: cats }] = await Promise.all([
        supabase.from("products").select("id, name, slug, image_url, price, views, click_count, featured, is_published, awaiting_link, expires_at, created_at, category_id"),
        supabase.from("categories").select("id, name, slug"),
      ]);
      const list = products ?? [];
      const total = list.length;
      const expired = list.filter((p) => p.expires_at && p.expires_at < now).length;
      const awaiting = list.filter((p) => p.awaiting_link).length;
      const featured = list.filter((p) => p.featured && p.is_published).length;
      const active = list.filter((p) => p.is_published && !p.awaiting_link && (!p.expires_at || p.expires_at >= now)).length;
      const clicks = list.reduce((s, p) => s + (p.click_count ?? 0), 0);
      const views = list.reduce((s, p) => s + (p.views ?? 0), 0);
      setStats({ total, active, expired, featured, awaiting, clicks, views });

      setTopClicked([...list].filter((p) => p.click_count > 0).sort((a, b) => b.click_count - a.click_count).slice(0, 5));
      setTopViewed([...list].sort((a, b) => b.views - a.views).slice(0, 5));
      setRecent([...list].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 5).map((p) => ({ id: p.id, name: p.name, slug: p.slug, created_at: p.created_at })));

      const counts: Record<string, number> = {};
      for (const p of list) if (p.category_id) counts[p.category_id] = (counts[p.category_id] ?? 0) + p.views;
      const cMap = new Map((cats ?? []).map((c) => [c.id, { name: c.name, slug: c.slug }]));
      setTopCats(Object.entries(counts)
        .map(([id, n]) => ({ ...(cMap.get(id) ?? { name: "—", slug: "" }), count: n }))
        .sort((a, b) => b.count - a.count).slice(0, 5));
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Visão geral</h2>
          <p className="text-sm text-muted-foreground">Métricas em tempo real do seu marketplace</p>
        </div>
        <Link to="/admin/produtos/$id" params={{ id: "novo" }}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-4 py-2 text-sm font-semibold hover:opacity-90 shadow-card transition">
          <Plus className="h-4 w-4" /> Novo produto
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total" value={stats?.total} icon={<Package className="h-4 w-4" />} accent="bg-foreground/5" />
        <Stat label="Ativos" value={stats?.active} icon={<TrendingUp className="h-4 w-4" />} accent="bg-emerald-500/10 text-emerald-700" />
        <Stat label="Em destaque" value={stats?.featured} icon={<Star className="h-4 w-4" />} accent="bg-amber-500/10 text-amber-700" />
        <Stat label="Sem link" value={stats?.awaiting} icon={<BellPlus className="h-4 w-4" />} accent="bg-sky-500/10 text-sky-700" />
        <Stat label="Encerrados" value={stats?.expired} icon={<Clock className="h-4 w-4" />} accent="bg-destructive/10 text-destructive" />
        <Stat label="Visualizações" value={stats?.views} icon={<Eye className="h-4 w-4" />} accent="bg-foreground/5" />
        <Stat label="Cliques 'Ver Oferta'" value={stats?.clicks} icon={<MousePointerClick className="h-4 w-4" />} accent="bg-promo/10 text-promo" />
        <Stat label="CTR" value={stats ? (stats.views > 0 ? `${((stats.clicks / stats.views) * 100).toFixed(1)}%` : "0%") : undefined} icon={<TrendingUp className="h-4 w-4" />} accent="bg-foreground/5" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Mais clicados" icon={<MousePointerClick className="h-4 w-4" />} link="/admin/produtos">
          {topClicked === null ? <Loading /> : topClicked.length === 0 ? <Empty text="Nenhum clique registrado ainda." /> : (
            <ul className="divide-y">
              {topClicked.map((p) => (
                <RowProduct key={p.id} p={p} metric={`${p.click_count} cliques`} />
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Mais vistos" icon={<Eye className="h-4 w-4" />} link="/admin/produtos">
          {topViewed === null ? <Loading /> : topViewed.length === 0 ? <Empty text="Sem visualizações ainda." /> : (
            <ul className="divide-y">
              {topViewed.map((p) => <RowProduct key={p.id} p={p} metric={`${p.views} views`} />)}
            </ul>
          )}
        </Panel>
        <Panel title="Categorias mais acessadas" icon={<Tag className="h-4 w-4" />} link="/admin/categorias">
          {topCats === null ? <Loading /> : topCats.length === 0 ? <Empty text="Sem dados de categoria." /> : (
            <ul className="divide-y">
              {topCats.map((c) => (
                <li key={c.slug} className="flex items-center justify-between py-2.5">
                  <span className="font-medium text-sm">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.count} views</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Adicionados recentemente" icon={<Plus className="h-4 w-4" />} link="/admin/produtos">
          {recent === null ? <Loading /> : recent.length === 0 ? <Empty text="Nenhum produto ainda." /> : (
            <ul className="divide-y">
              {recent.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5">
                  <Link to="/admin/produtos/$id" params={{ id: p.id }} className="text-sm font-medium hover:text-primary truncate">{p.name}</Link>
                  <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR")}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );

  function RowProduct({ p, metric }: { p: TopProduct; metric: string }) {
    return (
      <li className="flex items-center gap-3 py-2.5">
        <div className="h-10 w-10 shrink-0 rounded-lg bg-muted overflow-hidden grid place-items-center border">
          {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <Link to="/admin/produtos/$id" params={{ id: p.id }} className="text-sm font-medium hover:text-primary truncate block">{p.name}</Link>
          {p.price != null && <div className="text-xs text-muted-foreground">{formatBRL(p.price)}</div>}
        </div>
        <span className="text-xs font-semibold shrink-0">{metric}</span>
      </li>
    );
  }
}

function Stat({ label, value, icon, accent }: { label: string; value: number | string | undefined; icon: React.ReactNode; accent: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 hover:shadow-card transition-shadow">
      <div className="flex items-center justify-between">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${accent}`}>{icon}</span>
      </div>
      <div className="mt-3 text-2xl font-extrabold tracking-tight">{value ?? "—"}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function Panel({ title, icon, link, children }: { title: string; icon: React.ReactNode; link: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <header className="flex items-center justify-between mb-2">
        <div className="inline-flex items-center gap-2 font-semibold text-sm">{icon}{title}</div>
        <Link to={link as never} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5">
          ver tudo <ArrowRight className="h-3 w-3" />
        </Link>
      </header>
      {children}
    </section>
  );
}

function Loading() { return <div className="py-6 text-center text-xs text-muted-foreground">Carregando…</div>; }
function Empty({ text }: { text: string }) { return <div className="py-6 text-center text-xs text-muted-foreground">{text}</div>; }
