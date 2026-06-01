import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useSettings, type SiteSettings, type SocialSettings, type FooterSettings } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, ImageIcon, Globe, Instagram, Music2, Facebook, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/configuracoes")({ component: AdminSettings });

function AdminSettings() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const { site, social, footer, refresh } = useSettings();

  const [siteForm, setSiteForm] = useState<SiteSettings>(site);
  const [socialForm, setSocialForm] = useState<SocialSettings>(social);
  const [footerForm, setFooterForm] = useState<FooterSettings>(footer);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "favicon" | null>(null);

  useEffect(() => { setSiteForm(site); }, [site]);
  useEffect(() => { setSocialForm(social); }, [social]);
  useEffect(() => { setFooterForm(footer); }, [footer]);
  useEffect(() => { if (!loading && !isAdmin) navigate({ to: "/admin" }); }, [loading, isAdmin, navigate]);

  if (!isAdmin) return null;

  const upload = async (file: File, kind: "logo" | "favicon") => {
    setUploading(kind);
    const ext = file.name.split(".").pop();
    const path = `${kind}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("site").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); setUploading(null); return; }
    const { data } = supabase.storage.from("site").getPublicUrl(path);
    setSiteForm((f) => ({ ...f, [`${kind}_url`]: data.publicUrl }));
    setUploading(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const updates = [
        { key: "site", value: siteForm as unknown as Record<string, unknown> },
        { key: "social", value: socialForm as unknown as Record<string, unknown> },
        { key: "footer", value: footerForm as unknown as Record<string, unknown> },
      ];
      for (const row of updates) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await supabase.from("site_settings").upsert(row as any, { onConflict: "key" });
        if (error) throw error;
      }
      toast.success("Configurações salvas com sucesso");
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Configurações do site</h2>
        <p className="text-xs text-muted-foreground">Edite logo, identidade, redes sociais e textos sem mexer no código</p>
      </div>

      <Section title="Identidade" icon={<Globe className="h-4 w-4" />}>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>Nome do site</Label><Input value={siteForm.name} onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })} /></div>
          <div><Label>Tagline</Label><Input value={siteForm.tagline} onChange={(e) => setSiteForm({ ...siteForm, tagline: e.target.value })} /></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <ImageField label="Logo" url={siteForm.logo_url} uploading={uploading === "logo"}
            onUpload={(f) => upload(f, "logo")} onClear={() => setSiteForm({ ...siteForm, logo_url: null })} />
          <ImageField label="Favicon" url={siteForm.favicon_url} uploading={uploading === "favicon"}
            onUpload={(f) => upload(f, "favicon")} onClear={() => setSiteForm({ ...siteForm, favicon_url: null })} />
        </div>
      </Section>

      <Section title="Redes sociais" icon={<Instagram className="h-4 w-4" />}>
        <div className="grid sm:grid-cols-2 gap-3">
          <FieldIcon icon={<Instagram className="h-3.5 w-3.5" />} label="Instagram URL" value={socialForm.instagram} onChange={(v) => setSocialForm({ ...socialForm, instagram: v })} placeholder="https://instagram.com/..." />
          <FieldIcon icon={<Instagram className="h-3.5 w-3.5" />} label="Instagram @handle" value={socialForm.instagram_handle} onChange={(v) => setSocialForm({ ...socialForm, instagram_handle: v })} placeholder="@usuario" />
          <FieldIcon icon={<Music2 className="h-3.5 w-3.5" />} label="TikTok URL" value={socialForm.tiktok} onChange={(v) => setSocialForm({ ...socialForm, tiktok: v })} placeholder="https://tiktok.com/@..." />
          <FieldIcon icon={<Facebook className="h-3.5 w-3.5" />} label="Facebook URL" value={socialForm.facebook} onChange={(v) => setSocialForm({ ...socialForm, facebook: v })} placeholder="https://facebook.com/..." />
          <FieldIcon icon={<MessageCircle className="h-3.5 w-3.5" />} label="WhatsApp link" value={socialForm.whatsapp} onChange={(v) => setSocialForm({ ...socialForm, whatsapp: v })} placeholder="https://wa.me/55..." />
        </div>
      </Section>

      <Section title="Textos do rodapé" icon={<Globe className="h-4 w-4" />}>
        <div><Label>Sobre (parágrafo curto)</Label><Textarea rows={2} value={footerForm.about} onChange={(e) => setFooterForm({ ...footerForm, about: e.target.value })} /></div>
        <div><Label>Aviso legal / disclaimer</Label><Textarea rows={3} value={footerForm.disclaimer} onChange={(e) => setFooterForm({ ...footerForm, disclaimer: e.target.value })} /></div>
      </Section>

      <div className="sticky bottom-0 bg-card -mx-5 -mb-5 p-4 border-t flex justify-end">
        <Button onClick={save} disabled={saving} size="lg">{saving ? "Salvando..." : "Salvar configurações"}</Button>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 space-y-3">
      <h3 className="font-semibold text-sm inline-flex items-center gap-2">{icon}{title}</h3>
      {children}
    </section>
  );
}

function FieldIcon({ icon, label, value, onChange, placeholder }: { icon: React.ReactNode; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label className="inline-flex items-center gap-1.5">{icon}{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function ImageField({ label, url, uploading, onUpload, onClear }: { label: string; url: string | null; uploading: boolean; onUpload: (f: File) => void; onClear: () => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex items-center gap-3">
        <div className="h-14 w-14 rounded border bg-muted overflow-hidden grid place-items-center shrink-0">
          {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
        </div>
        <div className="flex-1 flex gap-2">
          <label className="inline-flex items-center gap-1.5 rounded border bg-background px-3 py-1.5 text-xs cursor-pointer hover:bg-muted">
            <Upload className="h-3.5 w-3.5" />{uploading ? "Enviando..." : "Enviar"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
          </label>
          {url && <Button size="sm" variant="ghost" onClick={onClear}>Remover</Button>}
        </div>
      </div>
    </div>
  );
}
