import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin/logs")({ component: AdminLogs });

interface Log { id: string; user_id: string | null; email: string | null; user_agent: string | null; created_at: string }

function AdminLogs() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Log[] | null>(null);

  useEffect(() => { if (!loading && !isAdmin) navigate({ to: "/admin" }); }, [loading, isAdmin, navigate]);
  useEffect(() => {
    supabase.from("admin_login_logs").select("*").order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setItems((data as Log[]) ?? []));
  }, []);

  if (!isAdmin) return null;
  return (
    <div>
      <h2 className="text-xl font-bold mb-1">Logs de acesso administrativo</h2>
      <p className="text-xs text-muted-foreground mb-4">Últimos 200 acessos de admins e editores</p>
      {items === null ? <p>Carregando...</p>
        : items.length === 0 ? <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">Nenhum acesso registrado ainda.</div>
        : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase">
                <tr><th className="px-3 py-2 text-left">Quando</th><th className="px-3 py-2 text-left">Email</th><th className="px-3 py-2 text-left">Dispositivo</th></tr>
              </thead>
              <tbody>
                {items.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2">{l.email ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-md">{l.user_agent ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
