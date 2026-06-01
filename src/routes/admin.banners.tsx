import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Upload, ImageIcon, ArrowUp, ArrowDown, Pencil, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/banners")({ component: AdminBanners });

interface Banner {
  id: string; title: string; subtitle: string; eyebrow: string;
  image_url: string | null; image_url_mobile: string | null;
  link_url: string | null; cta_label: string | null; align: "left" | "right" | "center";
  sort_order: number; is_active: boolean;
  starts_at: string | null; ends_at: string | null;
}

const empty: Omit<Banner, "id"> = {
  title: "", subtitle: "", eyebrow: "",
  image_url: null, image_url_mobile: null, link_url: null, cta_label: "Ver ofertas",
  align: "left", sort_order: 0, is_active: true, starts_at: null, ends_at: null,
};

function AdminBanners() {
  const [items, setItems] = useState<Banner[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [editing, setEditing] = useState<Banner | (Omit<Banner, "id"> & { id?: string }) | null>(null);
  const [uploading, setUploading] = useState<"desktop" | "mobile" | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [b, c] = await Promise.all([
      supabase.from("banners").select("*").order("sort_order"),
      supabase.from("categories").select("id, name, slug").order("sort_order"),
    ]);
    setItems((b.data as Banner[]) ?? []);
    setCategories(c.data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    if (!editing.title?.trim() && !editing.image_url) { toast.error("Adicione um título ou uma imagem"); return; }
    const payload = {
      title: editing.title ?? "", subtitle: editing.subtitle ?? "", eyebrow: editing.eyebrow ?? "",
      image_url: editing.image_url, image_url_mobile: editing.image_url_mobile,
      link_url: editing.link_url, cta_label: editing.cta_label, align: editing.align,
      sort_order: editing.sort_order ?? items.length, is_active: editing.is_active,
      starts_at: editing.starts_at, ends_at: editing.ends_at,
    };
    const res = "id" in editing && editing.id
      ? await supabase.from("banners").update(payload).eq("id", editing.id)
      : await supabase.from("banners").insert(payload);
    if (res.error) toast.error(res.error.message);
    else { toast.success("Salvo"); setEditing(null); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir banner?")) return;
    const { error } = await supabase.from("banners").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };
  const move = async (id: string, dir: -1 | 1) => {
    const idx = items.findIndex((b) => b.id === id);
    const target = items[idx + dir];
    if (!target) return;
    await supabase.from("banners").update({ sort_order: target.sort_order }).eq("id", id);
    await supabase.from("banners").update({ sort_order: items[idx].sort_order }).eq("id", target.id);
    load();
  };
  const toggleActive = async (b: Banner) => {
    await supabase.from("banners").update({ is_active: !b.is_active }).eq("id", b.id);
    load();
  };

  const upload = async (file: File, kind: "desktop" | "mobile") => {
    setUploading(kind);
    const ext = file.name.split(".").pop();
    const path = `banners/${Date.now()}-${kind}.${ext}`;
    const { error } = await supabase.storage.from("site").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); setUploading(null); return; }
    const { data } = supabase.storage.from("site").getPublicUrl(path);
    setEditing((e) => e ? { ...e, [kind === "desktop" ? "image_url" : "image_url_mobile"]: data.publicUrl } : e);
    setUploading(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Banners da home</h2>
          <p className="text-xs text-muted-foreground">Gerencie o carrossel principal</p>
        </div>
        <Button onClick={() => setEditing({ ...empty, sort_order: items.length })}><Plus className="h-4 w-4 mr-1" />Novo banner</Button>
      </div>

      {loading ? <p>Carregando...</p> : items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          Nenhum banner ainda. Sua home está usando os banners padrão.
        </div>
      ) : (
        <div className="grid gap-2">
          {items.map((b, i) => (
            <div key={b.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <div className="h-16 w-28 rounded bg-muted overflow-hidden shrink-0 grid place-items-center border">
                {b.image_url ? <img src={b.image_url} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{b.title || "Sem título"}</div>
                <div className="text-xs text-muted-foreground truncate">{b.eyebrow}</div>
                <div className="mt-1 flex gap-1.5 flex-wrap">
                  <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${b.is_active ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                    {b.is_active ? "Ativo" : "Inativo"}
                  </span>
                  {b.starts_at && <span className="text-[10px] rounded bg-sky-500/10 text-sky-700 font-bold px-1.5 py-0.5">Início: {new Date(b.starts_at).toLocaleDateString("pt-BR")}</span>}
                  {b.ends_at && <span className="text-[10px] rounded bg-amber-500/10 text-amber-700 font-bold px-1.5 py-0.5">Fim: {new Date(b.ends_at).toLocaleDateString("pt-BR")}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(b.id, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" disabled={i === items.length - 1} onClick={() => move(b.id, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Switch checked={b.is_active} onCheckedChange={() => toggleActive(b)} />
                <Button size="sm" variant="ghost" onClick={() => setEditing(b)}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4 animate-fade-in" onClick={() => setEditing(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-card rounded-xl shadow-hover w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-card">
              <h3 className="font-bold">{editing.id ? "Editar banner" : "Novo banner"}</h3>
              <button onClick={() => setEditing(null)} className="h-8 w-8 grid place-items-center rounded hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div><Label>Eyebrow (texto pequeno)</Label><Input value={editing.eyebrow ?? ""} onChange={(e) => setEditing({ ...editing, eyebrow: e.target.value })} placeholder="Ofertas selecionadas" /></div>
              <div><Label>Título</Label><Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
              <div><Label>Subtítulo</Label><Input value={editing.subtitle ?? ""} onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Imagem (desktop)</Label>
                  <label className="mt-1 inline-flex w-full items-center gap-2 rounded border bg-background px-3 py-2 text-xs cursor-pointer hover:bg-muted">
                    <Upload className="h-4 w-4" />{uploading === "desktop" ? "Enviando…" : "Enviar"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "desktop")} />
                  </label>
                  {editing.image_url && <img src={editing.image_url} alt="" className="mt-2 h-20 w-full object-cover rounded border" />}
                </div>
                <div>
                  <Label>Imagem (mobile, opcional)</Label>
                  <label className="mt-1 inline-flex w-full items-center gap-2 rounded border bg-background px-3 py-2 text-xs cursor-pointer hover:bg-muted">
                    <Upload className="h-4 w-4" />{uploading === "mobile" ? "Enviando…" : "Enviar"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "mobile")} />
                  </label>
                  {editing.image_url_mobile && <img src={editing.image_url_mobile} alt="" className="mt-2 h-20 w-full object-cover rounded border" />}
                </div>
              </div>
              <div>
                <Label>Categoria de destino</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={editing.link_url ?? ""}
                  onChange={(e) => setEditing({ ...editing, link_url: e.target.value || null })}
                >
                  <option value="">— Nenhuma (sem link) —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={`/categoria/${c.slug}`}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Texto do botão</Label><Input value={editing.cta_label ?? ""} onChange={(e) => setEditing({ ...editing, cta_label: e.target.value })} /></div>
                <div>
                  <Label>Alinhamento</Label>
                  <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={editing.align} onChange={(e) => setEditing({ ...editing, align: e.target.value as Banner["align"] })}>
                    <option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Início (opcional)</Label><Input type="datetime-local" value={toLocal(editing.starts_at)} onChange={(e) => setEditing({ ...editing, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
                <div><Label>Fim (opcional)</Label><Input type="datetime-local" value={toLocal(editing.ends_at)} onChange={(e) => setEditing({ ...editing, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />Ativo</label>
            </div>
            <div className="flex gap-2 p-4 border-t sticky bottom-0 bg-card">
              <Button onClick={save} className="flex-1">Salvar</Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function toLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
