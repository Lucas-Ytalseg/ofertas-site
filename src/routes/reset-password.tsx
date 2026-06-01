import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Redefinir senha — Direct Ofertas" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase processa o token no hash da URL e dispara PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Senha precisa de pelo menos 6 caracteres."); return; }
    if (password !== confirm) { toast.error("As senhas não conferem."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Senha atualizada!"); navigate({ to: "/" }); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md bg-card rounded-xl shadow-card border p-6">
        <h1 className="text-2xl font-bold">Redefinir senha</h1>
        <p className="text-sm text-muted-foreground mb-4">
          {ready ? "Digite sua nova senha." : "Aguardando confirmação do link..."}
        </p>
        {ready ? (
          <form onSubmit={submit} className="space-y-3">
            <div><Label>Nova senha</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div><Label>Confirmar senha</Label><Input type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
            <Button type="submit" disabled={loading} className="w-full">Salvar nova senha</Button>
          </form>
        ) : (
          <Link to="/login" className="text-sm text-primary hover:underline">Voltar ao login</Link>
        )}
      </div>
    </div>
  );
}
