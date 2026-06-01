import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Upload, X, ImageIcon } from "lucide-react";
import { slugify } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/produtos/$id")({ component: EditProduct });

interface Category { id: string; name: string }

function EditProduct() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const isNew = id === "novo";

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    name: "", slug: "", short_description: "", description: "",
    price: "", original_price: "", image_url: "", affiliate_url: "",
    category_id: "", tags: "", featured: false, is_published: true,
    coupon_code: "", expires_at: "", awaiting_link: false,
    gallery: [] as string[],
  });

  useEffect(() => {
    supabase.from("categories").select("id, name").order("sort_order").then(({ data }) => setCategories(data ?? []));
    if (!isNew) {
      supabase.from("products").select("*").eq("id", id).maybeSingle().then(({ data }) => {
        if (data) {
          setForm({
            name: data.name, slug: data.slug,
            short_description: data.short_description ?? "",
            description: data.description ?? "",
            price: data.price?.toString() ?? "",
            original_price: data.original_price?.toString() ?? "",
            image_url: data.image_url ?? "",
            affiliate_url: data.affiliate_url ?? "",
            category_id: data.category_id ?? "",
            tags: (data.tags ?? []).join(", "),
            featured: data.featured, is_published: data.is_published,
            coupon_code: data.coupon_code ?? "",
            expires_at: data.expires_at ? toLocalInput(data.expires_at) : "",
            awaiting_link: data.awaiting_link ?? false,
            gallery: (data.gallery ?? []) as string[],
          });
        }
        setLoading(false);
      });
    }
  }, [id, isNew]);

  const uploadFile = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("products").upload(path, file);
    if (error) { toast.error(error.message); return null; }
    return supabase.storage.from("products").getPublicUrl(path).data.publicUrl;
  };

  const upload = async (file: File) => {
    setUploading(true);
    const url = await uploadFile(file);
    if (url) { setForm((f) => ({ ...f, image_url: url })); toast.success("Imagem enviada"); }
    setUploading(false);
  };

  const uploadGallery = async (files: FileList) => {
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const url = await uploadFile(file);
      if (url) urls.push(url);
    }
    if (urls.length) setForm((f) => ({ ...f, gallery: [...f.gallery, ...urls] }));
    setUploading(false);
    if (urls.length) toast.success(`${urls.length} imagem(ns) adicionada(s)`);
  };

  const setExpireInDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(23, 59, 0, 0);
    setForm((f) => ({ ...f, expires_at: toLocalInput(d.toISOString()) }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!form.awaiting_link && !form.affiliate_url.trim()) {
      toast.error("Coloque o link de afiliado ou marque 'Aguardando link'");
      return;
    }
    let affiliateUrl: string | null = form.affiliate_url.trim() || null;
    if (affiliateUrl && !/^https?:\/\//i.test(affiliateUrl)) {
      affiliateUrl = `https://${affiliateUrl}`;
    }
    if (affiliateUrl && !/^https?:\/\/.+\..+/i.test(affiliateUrl)) {
      toast.error("Link de afiliado inválido. Deve começar com http:// ou https://");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      short_description: form.short_description || null,
      description: form.description || null,
      price: form.price ? Number(form.price) : null,
      original_price: form.original_price ? Number(form.original_price) : null,
      image_url: form.image_url || null,
      affiliate_url: affiliateUrl,
      category_id: form.category_id || null,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      featured: form.featured,
      is_published: form.is_published,
      coupon_code: form.coupon_code.trim() || null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      awaiting_link: form.awaiting_link,
      gallery: form.gallery,
    };
    const res = isNew
      ? await supabase.from("products").insert(payload)
      : await supabase.from("products").update(payload).eq("id", id);
    setSaving(false);
    if (res.error) toast.error(res.error.message);
    else { toast.success("Salvo!"); navigate({ to: "/admin" }); }
  };

  if (loading) return <p>Carregando...</p>;

  return (
    <div>
      <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-primary mb-3"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
      <h2 className="text-xl font-bold mb-4">{isNew ? "Novo produto" : "Editar produto"}</h2>
      <form onSubmit={save} className="space-y-5 max-w-2xl">
        <section className="space-y-3 rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Informações</h3>
          <div>
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })} required />
          </div>
          <div>
            <Label>Slug (URL)</Label>
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} placeholder="gerado automaticamente" />
          </div>
          <div>
            <Label>Descrição curta</Label>
            <Input value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} maxLength={200} />
          </div>
          <div>
            <Label>Descrição completa</Label>
            <Textarea rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <Label>Categoria</Label>
            <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">— Nenhuma —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Tags (separadas por vírgula)</Label>
            <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="oferta, novidade, frete grátis" />
          </div>
        </section>

        <section className="space-y-3 rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Preço & cupom</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Preço (R$)</Label><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
            <div><Label>Preço original (R$)</Label><Input type="number" step="0.01" value={form.original_price} onChange={(e) => setForm({ ...form, original_price: e.target.value })} /></div>
          </div>
          <div>
            <Label>Cupom de desconto (opcional)</Label>
            <Input value={form.coupon_code} onChange={(e) => setForm({ ...form, coupon_code: e.target.value.toUpperCase() })} placeholder="EX: PROMO10" className="font-mono uppercase" />
            <p className="text-xs text-muted-foreground mt-1">O cupom aparece destacado na página do produto com botão de copiar.</p>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tempo da oferta</h3>
          <div>
            <Label>Termina em (data e hora)</Label>
            <Input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[1, 3, 7, 15, 30].map((d) => (
                <Button key={d} type="button" size="sm" variant="outline" onClick={() => setExpireInDays(d)}>
                  +{d} dia{d > 1 ? "s" : ""}
                </Button>
              ))}
              {form.expires_at && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setForm({ ...form, expires_at: "" })}>
                  <X className="h-3 w-3 mr-1" /> Limpar
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Mostra um cronômetro regressivo na vitrine e na página do produto.</p>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Imagem principal</h3>
          <div className="flex items-center gap-3">
            <div className="h-24 w-24 rounded border bg-muted overflow-hidden grid place-items-center shrink-0">
              {form.image_url
                ? <img src={form.image_url} alt="" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
            </div>
            <div className="flex-1 space-y-2">
              <label className="inline-flex items-center gap-2 rounded border bg-background px-3 py-2 text-sm cursor-pointer hover:bg-muted">
                <Upload className="h-4 w-4" /> {uploading ? "Enviando..." : "Enviar imagem"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              </label>
              <Input placeholder="ou cole uma URL https://..." value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
              {form.image_url && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setForm({ ...form, image_url: "" })}>
                  <X className="h-3 w-3 mr-1" /> Remover imagem
                </Button>
              )}
            </div>
          </div>

          <div className="pt-3 border-t">
            <h4 className="text-sm font-semibold mb-2">Galeria (imagens extras)</h4>
            <p className="text-xs text-muted-foreground mb-2">Adicione fotos adicionais que aparecem na página do produto.</p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-2">
              {form.gallery.map((url, i) => (
                <div key={i} className="relative aspect-square rounded border bg-muted overflow-hidden group">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => setForm((f) => ({ ...f, gallery: f.gallery.filter((_, j) => j !== i) }))}
                    className="absolute top-1 right-1 bg-background/90 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <label className="inline-flex items-center gap-2 rounded border bg-background px-3 py-2 text-sm cursor-pointer hover:bg-muted">
              <Upload className="h-4 w-4" /> {uploading ? "Enviando..." : "Adicionar imagens"}
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && e.target.files.length > 0 && uploadGallery(e.target.files)} />
            </label>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Link de afiliado</h3>
          <label className="flex items-start gap-3 rounded-md border bg-background p-3 cursor-pointer">
            <Switch checked={form.awaiting_link} onCheckedChange={(v) => setForm({ ...form, awaiting_link: v })} />
            <div>
              <div className="text-sm font-medium">Ainda sem link (aguardando)</div>
              <div className="text-xs text-muted-foreground">As pessoas poderão favoritar o produto para serem avisadas quando o link chegar.</div>
            </div>
          </label>
          <div>
            <Label>Link de afiliado {!form.awaiting_link && "*"}</Label>
            <Input type="url" required={!form.awaiting_link} value={form.affiliate_url} onChange={(e) => setForm({ ...form, affiliate_url: e.target.value })} placeholder="https://..." disabled={form.awaiting_link} />
          </div>
        </section>

        <section className="space-y-2 rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Visibilidade</h3>
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} />Em destaque</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} />Publicado</label>
          </div>
        </section>

        <div className="flex gap-2">
          <Button type="submit" disabled={saving} size="lg">{saving ? "Salvando..." : "Salvar produto"}</Button>
          <Link to="/admin"><Button type="button" variant="outline" size="lg">Cancelar</Button></Link>
        </div>
      </form>
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
