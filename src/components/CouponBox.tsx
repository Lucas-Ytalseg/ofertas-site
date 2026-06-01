import { useState } from "react";
import { Copy, Check, Ticket } from "lucide-react";
import { toast } from "sonner";

export function CouponBox({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Cupom copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };
  return (
    <button
      onClick={copy}
      className="group flex w-full items-center justify-between gap-2 rounded-md border-2 border-dashed border-primary bg-primary/5 px-3 py-2.5 text-left transition hover:bg-primary/10"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Ticket className="h-4 w-4 text-primary shrink-0" />
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Cupom</div>
          <div className="font-mono font-bold text-sm text-foreground truncate">{code}</div>
        </div>
      </div>
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary shrink-0">
        {copied ? <><Check className="h-3.5 w-3.5" />Copiado</> : <><Copy className="h-3.5 w-3.5" />Copiar</>}
      </span>
    </button>
  );
}
