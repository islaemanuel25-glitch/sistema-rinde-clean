"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type LocalItem = {
  id: string;
  nombre: string;
  rol: "ADMIN" | "OPERATIVO" | "LECTURA";
};

export default function LocalPickerClient(props: {
  locales: LocalItem[];
  activeLocalId: string | null;
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function selectLocal(localId: string) {
    try {
      setLoadingId(localId);

      const res = await fetch("/api/local/seleccionar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error ?? "No se pudo seleccionar el local");
        return;
      }

      // Re-render del Server Component para que lea la cookie y habilite menú
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-2">
      {props.locales.map((l) => {
        const isActive = props.activeLocalId === l.id;
        const isLoading = loadingId === l.id;

        return (
          <button
            key={l.id}
            type="button"
            onClick={() => selectLocal(l.id)}
            disabled={isLoading}
            className={cn(
              "block w-full text-left rounded-2xl border bg-white p-4 shadow-sm active:scale-[0.99]",
              isActive ? "border-slate-900" : "border-slate-200",
              isLoading ? "opacity-70" : ""
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-base font-extrabold text-slate-900">
                  {l.nombre}
                </div>
                <div className="mt-1 text-xs font-medium text-slate-500">
                  ID: {l.id}
                </div>
              </div>

              <div
                className={cn(
                  "shrink-0 rounded-xl px-3 py-2 text-xs font-extrabold",
                  isActive
                    ? "bg-slate-900 text-white"
                    : "bg-slate-50 text-slate-700 border border-slate-200"
                )}
              >
                {isLoading ? "..." : isActive ? "Activo" : "Usar"}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
