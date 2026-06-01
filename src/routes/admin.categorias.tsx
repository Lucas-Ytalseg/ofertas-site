import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Upload, ImageIcon } from "lucide-react";
import { slugify } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/categorias")({ component: AdminCategories });

interface Cat { id: string; name: string; slug: string; sort_order: number; image_url: string | null }

function AdminCategories() {
  const [items, setItems] = useState<Cat[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from("categories").select("id, name, slug, sort_order, image_url").order("sort_order");
    if (error) { toast.error(error.message); return; }
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Digite o nome da categoria"); return; }
    setSaving(true);
    const { error } = await supabase.from("categories").insert({
      name: name.trim(), slug: slugify(name), sort_order: items.length + 1,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Categoria criada"); setName(""); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir? Produtos ficarão sem categoria.")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const uploadImage = async (cat: Cat, file: File) => {
    setUploadingId(cat.id);
    const ext = file.name.split(".").pop();
    const path = `categorias/${cat.slug}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("products").upload(path, file, { upsert: true });
    if (upErr) { toast.error(upErr.message); setUploadingId(null); return; }
    const { data } = supabase.storage.from("products").getPublicUrl(path);
    const { error } = await supabase.from("categories").update({ image_url: data.publicUrl }).eq("id", cat.id);
    setUploadingId(null);
    if (error) toast.error(error.message);
    else { toast.success("Imagem atualizada"); load(); }
  };

  const clearImage = async (cat: Cat) => {
    const { error } = await supabase.from("categories").update({ image_url: null }).eq("id", cat.id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Categorias</h2>
      <form onSubmit={add} className="flex gap-2 max-w-md mb-6">
        <Input placeholder="Nova categoria" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" disabled={saving}><Plus className="h-4 w-4" />{saving ? "Salvando" : "Adicionar"}</Button>
      </form>
      <ul className="divide-y border-t">
        {items.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-14 w-14 rounded bg-muted overflow-hidden shrink-0 grid place-items-center border">
                {c.image_url
                  ? <img src={c.image_url} alt={c.name} className="h-full w-full object-cover" />
                  : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground truncate">/{c.slug}</div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <label className="inline-flex items-center gap-1 rounded border bg-card px-2 py-1.5 text-xs cursor-pointer hover:bg-muted">
                <Upload className="h-3.5 w-3.5" />
                {uploadingId === c.id ? "Enviando..." : (c.image_url ? "Trocar" : "Imagem")}
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadImage(c, e.target.files[0])} />
              </label>
              {c.image_url && (
                <Button variant="ghost" size="sm" onClick={() => clearImage(c)} title="Remover imagem">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => remove(c.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
