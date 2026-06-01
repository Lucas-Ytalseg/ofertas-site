import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function diff(target: number) {
  const ms = Math.max(0, target - Date.now());
  const s = Math.floor(ms / 1000);
  return {
    ms,
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

export function Countdown({ expiresAt, className }: { expiresAt: string; className?: string }) {
  const target = new Date(expiresAt).getTime();
  const [t, setT] = useState(() => diff(target));

  useEffect(() => {
    const id = setInterval(() => setT(diff(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (t.ms <= 0) {
    return (
      <div className={`inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground ${className ?? ""}`}>
        <Clock className="h-3.5 w-3.5" /> Oferta encerrada
      </div>
    );
  }

  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive ${className ?? ""}`}>
      <Clock className="h-3.5 w-3.5" />
      {t.d > 0 && <span>{t.d}d</span>}
      <span className="tabular-nums">{pad(t.h)}:{pad(t.m)}:{pad(t.s)}</span>
    </div>
  );
}
