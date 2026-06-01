import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Package, Users, Tag, ArrowLeft, LayoutDashboard, Image as ImageIcon, Settings as SettingsIcon, ScrollText, Sparkles, Layers } from "lucide-react";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

function AdminLayout() {
  const { user, isAdmin, isStaff, role, loading } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
    else if (!loading && user && !isStaff) navigate({ to: "/" });
  }, [loading, user, isStaff, navigate]);

  if (loading || !user || !isStaff) {
    return <div className="min-h-screen grid place-items-center bg-background">Carregando...</div>;
  }

  type Link = { to: string; label: string; icon: typeof Package; exact?: boolean; adminOnly?: boolean };
  const links: Link[] = [
    { to: "/admin",            label: "Dashboard",      icon: LayoutDashboard, exact: true },
    { to: "/admin/produtos",   label: "Produtos",        icon: Package },
    // "Curadoria em Lote" — busca automática multi-marketplace com ranqueamento por IA
    { to: "/admin/curadoria",  label: "Curadoria",       icon: Layers },
    { to: "/admin/ofertas",    label: "Ofertas IA",      icon: Sparkles },
    { to: "/admin/categorias", label: "Categorias",      icon: Tag },
    { to: "/admin/banners",    label: "Banners",         icon: ImageIcon },
    { to: "/admin/configuracoes", label: "Configurações",icon: SettingsIcon, adminOnly: true },
    { to: "/admin/usuarios",   label: "Admins",          icon: Users, adminOnly: true },
    { to: "/admin/logs",       label: "Logs de acesso",  icon: ScrollText, adminOnly: true },
  ].filter((l) => !l.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-foreground text-background grid place-items-center">
              <LayoutDashboard className="h-4 w-4" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-none">Painel admin</h1>
              <p className="text-[11px] text-muted-foreground">{role === "admin" ? "Administrador" : "Editor"}</p>
            </div>
          </div>
          <Link to="/" className="text-sm flex items-center gap-1 text-muted-foreground hover:text-foreground transition">
            <ArrowLeft className="h-4 w-4" /> Voltar ao site
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 grid lg:grid-cols-[230px_1fr] gap-6">
        <aside className="space-y-1 lg:sticky lg:top-20 self-start">
          {links.map((l) => {
            const active = l.exact ? path === l.to : path.startsWith(l.to);
            return (
              <Link key={l.to} to={l.to as never}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${active ? "bg-foreground text-background shadow-card" : "text-muted-foreground hover:bg-card hover:text-foreground"}`}>
                <l.icon className="h-4 w-4" /> {l.label}
              </Link>
            );
          })}
        </aside>
        <main className="bg-card rounded-xl shadow-card border p-5 min-h-[60vh]"><Outlet /></main>
      </div>
    </div>
  );
}
