import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "editor" | "user" | null;

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: Role;
  isAdmin: boolean;
  isStaff: boolean; // admin OR editor
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null, session: null, role: null, isAdmin: false, isStaff: false, loading: true, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  const loadRole = async (uid: string) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    const roles = (data ?? []).map((r) => r.role);
    if (roles.includes("admin" as never)) setRole("admin");
    else if (roles.includes("editor" as never)) setRole("editor");
    else setRole("user");
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) setTimeout(() => loadRole(s.user.id), 0);
      else setRole(null);
    });
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) await loadRole(s.user.id);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const isAdmin = role === "admin";
  const isStaff = role === "admin" || role === "editor";

  return (
    <Ctx.Provider value={{
      user: session?.user ?? null,
      session, role, isAdmin, isStaff, loading,
      signOut: async () => { await supabase.auth.signOut(); },
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
