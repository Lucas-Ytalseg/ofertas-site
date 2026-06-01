import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, ShieldOff, UserPlus, UserCog } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin/usuarios")({ component: AdminUsers });

interface Profile { id: string; full_name: string | null; avatar_url: string | null; created_at: string; isAdmin: boolean; }

function AdminUsers() {
  const { user } = useAuth();
  const [items, setItems] = useState<Profile[]>([]);

  // Promote existing
  const [promoteEmail, setPromoteEmail] = useState("");
  const [promoting, setPromoting] = useState(false);

  // Create new user
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "editor" | "user">("user");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, avatar_url, created_at").order("created_at");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const adminSet = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
    setItems((profiles ?? []).map((p) => ({ ...p, isAdmin: adminSet.has(p.id) })));
  };
  useEffect(() => { load(); }, []);

  const promote = async (uid: string) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
    if (error) toast.error(error.message); else { toast.success("Promovido a admin"); load(); }
  };
  const demote = async (uid: string) => {
    if (uid === user?.id) { toast.error("Você não pode remover seu próprio admin."); return; }
    const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin");
    if (error) toast.error(error.message); else { toast.success("Permissão removida"); load(); }
  };

  const inviteByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoteEmail.trim()) return;
    setPromoting(true);
    const { data, error } = await supabase.functions.invoke("admin-add-by-email", { body: { email: promoteEmail.trim() } });
    setPromoting(false);
    if (error || data?.error) {
      toast.error(data?.error ?? error?.message ?? "Erro ao adicionar admin");
    } else {
      toast.success("Admin adicionado!");
      setPromoteEmail("");
      load();
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newPassword) {
      toast.error("Informe e-mail e senha");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Senha precisa ter pelo menos 8 caracteres");
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: { email: newEmail.trim(), password: newPassword, full_name: newName.trim(), role: newRole },
    });
    setCreating(false);
    if (error || data?.error) {
      toast.error(data?.error ?? error?.message ?? "Erro ao criar usuário");
    } else {
      toast.success(`Usuário criado como ${newRole}`);
      setNewName(""); setNewEmail(""); setNewPassword(""); setNewRole("user");
      load();
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">Usuários e admins</h2>
      <p className="text-sm text-muted-foreground mb-6">
        O cadastro público está desativado. Crie contas aqui ou promova usuários existentes.
      </p>

      <section className="rounded-xl border bg-card p-4 mb-6">
        <h3 className="font-semibold text-sm mb-3 inline-flex items-center gap-2"><UserPlus className="h-4 w-4" />Criar novo usuário</h3>
        <form onSubmit={createUser} className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Nome (opcional)</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Maria Silva" />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@dominio.com" />
          </div>
          <div>
            <Label>Senha (mín. 8 caracteres)</Label>
            <Input type="text" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="senha temporária" />
          </div>
          <div>
            <Label>Papel</Label>
            <select
              className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as "admin" | "editor" | "user")}
            >
              <option value="user">Usuário comum</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={creating}>
              <UserPlus className="h-4 w-4 mr-1" />{creating ? "Criando..." : "Criar usuário"}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border bg-card p-4 mb-6">
        <h3 className="font-semibold text-sm mb-3 inline-flex items-center gap-2"><UserCog className="h-4 w-4" />Promover usuário existente</h3>
        <form onSubmit={inviteByEmail} className="flex gap-2 max-w-md">
          <Input type="email" placeholder="email@dominio.com" value={promoteEmail} onChange={(e) => setPromoteEmail(e.target.value)} />
          <Button type="submit" disabled={promoting}>
            <ShieldCheck className="h-4 w-4 mr-1" />{promoting ? "Adicionando..." : "Tornar admin"}
          </Button>
        </form>
      </section>

      <h3 className="font-semibold text-sm mb-2">Todos os usuários</h3>
      <ul className="divide-y border-t">
        {items.map((p) => (
          <li key={p.id} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-muted grid place-items-center text-sm font-bold">
                {(p.full_name ?? "?").charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-medium">{p.full_name ?? "Sem nome"}</div>
                {p.isAdmin && <span className="text-xs rounded bg-primary text-primary-foreground px-1.5 py-0.5">admin</span>}
              </div>
            </div>
            {p.isAdmin
              ? <Button size="sm" variant="ghost" onClick={() => demote(p.id)}><ShieldOff className="h-4 w-4 mr-1" />Remover admin</Button>
              : <Button size="sm" variant="outline" onClick={() => promote(p.id)}><ShieldCheck className="h-4 w-4 mr-1" />Tornar admin</Button>}
          </li>
        ))}
      </ul>
    </div>
  );
}
