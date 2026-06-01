export const formatBRL = (n: number | null | undefined) =>
  n == null ? "" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const slugify = (s: string) =>
  s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
