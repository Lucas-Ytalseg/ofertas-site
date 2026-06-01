import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SiteSettings {
  name: string;
  tagline: string;
  logo_url: string | null;
  favicon_url: string | null;
}
export interface SocialSettings {
  instagram: string;
  instagram_handle: string;
  tiktok: string;
  facebook: string;
  whatsapp: string;
}
export interface FooterSettings {
  about: string;
  disclaimer: string;
}

const DEFAULT_SITE: SiteSettings = { name: "Direct Ofertas", tagline: "Ofertas para todos os tipos, escolhidas a dedo.", logo_url: null, favicon_url: null };
const DEFAULT_SOCIAL: SocialSettings = {
  instagram: "https://www.instagram.com/direct_ofer.tas",
  instagram_handle: "@direct_ofer.tas",
  tiktok: "", facebook: "", whatsapp: "",
};
const DEFAULT_FOOTER: FooterSettings = {
  about: "Ofertas para todos os tipos, escolhidas a dedo.",
  disclaimer: "Este site contém links de afiliados. Podemos receber comissão por compras realizadas.",
};

interface Ctx {
  site: SiteSettings;
  social: SocialSettings;
  footer: FooterSettings;
  refresh: () => Promise<void>;
  loading: boolean;
}

const SettingsCtx = createContext<Ctx>({
  site: DEFAULT_SITE, social: DEFAULT_SOCIAL, footer: DEFAULT_FOOTER, refresh: async () => {}, loading: true,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [site, setSite] = useState<SiteSettings>(DEFAULT_SITE);
  const [social, setSocial] = useState<SocialSettings>(DEFAULT_SOCIAL);
  const [footer, setFooter] = useState<FooterSettings>(DEFAULT_FOOTER);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const { data } = await supabase.from("site_settings").select("key, value");
    if (data) {
      for (const r of data) {
        const v = r.value as Record<string, unknown>;
        if (r.key === "site") setSite({ ...DEFAULT_SITE, ...(v as Partial<SiteSettings>) });
        if (r.key === "social") setSocial({ ...DEFAULT_SOCIAL, ...(v as Partial<SocialSettings>) });
        if (r.key === "footer") setFooter({ ...DEFAULT_FOOTER, ...(v as Partial<FooterSettings>) });
      }
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  return <SettingsCtx.Provider value={{ site, social, footer, refresh, loading }}>{children}</SettingsCtx.Provider>;
}

export const useSettings = () => useContext(SettingsCtx);
