import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Direct Ofertas" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  useEffect(() => { if (user) navigate({ to: "/" }); }, [user, navigate]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    // Log se for staff (silencioso, RLS impede leitura por usuário comum)
    let staffLogin = false;
    if (data.user) {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      const isStaff = (roles ?? []).some((r) => r.role === "admin" || r.role === "editor");
      staffLogin = isStaff;
      if (isStaff) {
        await supabase.from("admin_login_logs").insert({
          user_id: data.user.id, email: data.user.email, user_agent: navigator.userAgent,
        });
      }
    }
    toast.success("Bem-vindo!");
    navigate({ to: staffLogin ? "/admin" : "/" });
  };

  

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Enviamos um e-mail com o link para redefinir sua senha.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md bg-card rounded-xl shadow-card border p-6">
        <Link to="/" className="text-sm text-primary hover:underline">← Voltar</Link>
        <h1 className="mt-2 text-2xl font-bold">Direct Ofertas</h1>
        <p className="text-sm text-muted-foreground mb-4">{forgot ? "Recuperar senha" : "Entre ou crie sua conta"}</p>

        {forgot ? (
          <form onSubmit={sendReset} className="space-y-3">
            <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <Button type="submit" disabled={loading} className="w-full">Enviar link de recuperação</Button>
            <button type="button" onClick={() => setForgot(false)} className="text-xs text-muted-foreground hover:text-foreground w-full text-center">
              ← Voltar para o login
            </button>
          </form>
        ) : (
          <form onSubmit={signIn} className="space-y-3 mt-3">
            <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Senha</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <Button type="submit" disabled={loading} className="w-full">Entrar</Button>
            <button type="button" onClick={() => setForgot(true)} className="text-xs text-muted-foreground hover:text-foreground w-full text-center">
              Esqueci minha senha
            </button>
            <p className="text-xs text-muted-foreground text-center pt-2 border-t">
              Acesso restrito. Novas contas só podem ser criadas por um administrador.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
