import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Search, Heart, ShieldCheck, LogOut, User as UserIcon, Instagram, LayoutDashboard } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import logoFallback from "@/assets/logo.png";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Backwards-compat exports; real values come from useSettings().social
export const INSTAGRAM_URL = "https://www.instagram.com/direct_ofer.tas";
export const INSTAGRAM_HANDLE = "@direct_ofer.tas";

interface Suggestion {
  id: string; name: string; slug: string; price: number | null; image_url: string | null;
}

export function Header() {
  const navigate = useNavigate();
  const { user, isStaff, signOut } = useAuth();
  const { site, social } = useSettings();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [categories, setCategories] = useState<{ name: string; slug: string }[]>([]);
  const ref = useRef<HTMLFormElement>(null);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    supabase.from("categories").select("name, slug").order("sort_order").then(({ data }) => {
      if (data) setCategories(data);
    });
  }, []);

  useEffect(() => { setOpen(false); setQ(""); }, [path]);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("products").select("id, name, slug, price, image_url")
        .eq("is_published", true)
        .or(`name.ilike.%${q}%,short_description.ilike.%${q}%`)
        .limit(6);
      setResults(data ?? []); setOpen(true);
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate({ to: "/buscar", search: { q: q.trim() } });
  };

  const igUrl = social.instagram || INSTAGRAM_URL;
  const logo = site.logo_url || logoFallback;

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 text-foreground border-b">
      {/* Staff strip — só aparece para admin/editor logados */}
      {isStaff && (
        <div className="bg-foreground text-background text-xs">
          <div className="mx-auto max-w-7xl px-4 py-1.5 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <ShieldCheck className="h-3.5 w-3.5" /> Modo administrador
            </span>
            <Link to="/admin" className="inline-flex items-center gap-1.5 rounded-full bg-background/10 px-3 py-1 hover:bg-background/20 transition">
              <LayoutDashboard className="h-3.5 w-3.5" /> Abrir painel
            </Link>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-3 sm:gap-5 sm:px-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src={logo} alt={site.name} className="h-10 w-10 rounded-lg object-contain" />
          <span className="hidden sm:block text-base font-extrabold tracking-tight">{site.name}</span>
        </Link>

        <form onSubmit={submit} className="relative flex-1 max-w-3xl" ref={ref}>
          <div className="flex items-center rounded-full bg-muted/60 text-foreground border border-border focus-within:border-foreground/40 focus-within:bg-card focus-within:shadow-card transition-all">
            <Search className="ml-4 h-4 w-4 text-muted-foreground" />
            <input
              type="text" value={q} onChange={(e) => setQ(e.target.value)}
              onFocus={() => results.length && setOpen(true)}
              placeholder="Buscar produtos, marcas e muito mais..."
              className="w-full bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button type="submit" className="mr-1 rounded-full bg-foreground px-4 py-1.5 text-xs font-semibold text-background hover:opacity-90 transition" aria-label="Buscar">
              Buscar
            </button>
          </div>
          {open && results.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 rounded-xl bg-card shadow-hover overflow-hidden border animate-fade-in">
              {results.map((r) => (
                <Link key={r.id} to="/produto/$slug" params={{ slug: r.slug }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted text-foreground transition-colors">
                  <div className="h-11 w-11 shrink-0 rounded-lg bg-muted overflow-hidden">
                    {r.image_url && <img src={r.image_url} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{r.name}</div>
                    {r.price != null && <div className="text-xs text-muted-foreground">{formatBRL(r.price)}</div>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </form>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {igUrl && (
            <>
              <a href={igUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                className="hidden md:inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted transition">
                <Instagram className="h-4 w-4" /><span>Instagram</span>
              </a>
              <a href={igUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                className="md:hidden grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
                <Instagram className="h-4 w-4" />
              </a>
            </>
          )}

          {user && (
            <Link to="/favoritos" className="hidden sm:inline-flex" aria-label="Favoritos">
              <Button variant="ghost" size="icon" className="rounded-full"><Heart className="h-4 w-4" /></Button>
            </Link>
          )}

          {isStaff && (
            <Link to="/admin" className="inline-flex" aria-label="Abrir painel admin">
              <Button size="sm" className="gap-1.5 rounded-full text-sm">
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Painel</span>
              </Button>
            </Link>
          )}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 rounded-full">
                  <UserIcon className="h-4 w-4" />
                  <span className="hidden sm:inline text-sm max-w-24 truncate">{user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild><Link to="/favoritos">Favoritos</Link></DropdownMenuItem>
                {isStaff && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/admin"><ShieldCheck className="mr-2 h-4 w-4" />Painel admin</Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="mr-2 h-4 w-4" />Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/login"><Button size="sm" className="rounded-full text-sm">Entrar</Button></Link>
          )}
        </div>
      </div>

      <nav className="border-t bg-card">
        <div className="mx-auto flex max-w-7xl gap-5 overflow-x-auto px-3 py-2 text-xs sm:px-4 scrollbar-none">
          {categories.map((c) => (
            <Link key={c.slug} to="/categoria/$slug" params={{ slug: c.slug }}
              className="whitespace-nowrap font-medium text-muted-foreground hover:text-foreground transition-colors"
              activeProps={{ className: "text-foreground" }}>
              {c.name}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
