import { Link } from "@tanstack/react-router";
import { Instagram, Music2, Facebook, MessageCircle } from "lucide-react";
import { useSettings } from "@/lib/settings";

export function Footer() {
  const { site, social, footer } = useSettings();
  return (
    <footer className="mt-12 border-t bg-card">
      <div className="mx-auto max-w-7xl px-4 py-8 text-sm">
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <div className="font-bold mb-2">{site.name}</div>
            <p className="text-muted-foreground">{footer.about}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {social.instagram && (
                <a href={social.instagram} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted transition">
                  <Instagram className="h-4 w-4" />{social.instagram_handle || "Instagram"}
                </a>
              )}
              {social.tiktok && (
                <a href={social.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-full border hover:bg-muted transition"><Music2 className="h-4 w-4" /></a>
              )}
              {social.facebook && (
                <a href={social.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-full border hover:bg-muted transition"><Facebook className="h-4 w-4" /></a>
              )}
              {social.whatsapp && (
                <a href={social.whatsapp} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-full border hover:bg-muted transition"><MessageCircle className="h-4 w-4" /></a>
              )}
            </div>
          </div>
          <div>
            <div className="font-semibold mb-2">Navegação</div>
            <ul className="space-y-1 text-muted-foreground">
              <li><Link to="/" className="hover:text-foreground">Início</Link></li>
              <li><Link to="/buscar" search={{ q: "" }} className="hover:text-foreground">Buscar</Link></li>
              <li><Link to="/favoritos" className="hover:text-foreground">Favoritos</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-semibold mb-2">Aviso</div>
            <p className="text-muted-foreground text-xs">{footer.disclaimer}</p>
          </div>
        </div>
        <div className="mt-6 border-t pt-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {site.name}
        </div>
      </div>
    </footer>
  );
}
