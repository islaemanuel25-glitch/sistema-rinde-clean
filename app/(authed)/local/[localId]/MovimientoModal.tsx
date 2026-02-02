"use client";

import { useEffect, useMemo, useState } from "react";

type Scope = "day" | "week" | "month" | "all";

type AccionUI = {
  id: string;
  nombre: string;
  tipo: "ENTRADA" | "SALIDA";
  categoria: "TURNO" | "DEPOSITO" | "ELECTRONICO" | "SOCIO" | "OTROS";
  usaTurno: boolean;
  usaNombre: boolean;
  impactaTotal: boolean;
};

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Field(props: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-900">{props.label}</div>
        {props.hint && <div className="text-xs text-slate-500">{props.hint}</div>}
      </div>
      {props.children}
    </div>
  );
}

export default function MovimientoModal(props: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  localId: string;
  scope: Scope;
  selectedDate: string | null; // si scope=day
  lastMovimientoDate: string | null;
}) {
  const { open, onClose, onCreated, localId, scope, selectedDate, lastMovimientoDate } = props;

  const [acciones, setAcciones] = useState<AccionUI[]>([]);
  const [loadingAcciones, setLoadingAcciones] = useState(false);

  const [fecha, setFecha] = useState<string>("");
  const [accionId, setAccionId] = useState<string>("");
  const [importe, setImporte] = useState<string>("");
  const [turno, setTurno] = useState<"MANIANA" | "TARDE" | "NOCHE" | "">("");
  const [nombre, setNombre] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pideFecha = !selectedDate && (scope === "week" || scope === "month" || scope === "all");

  const suggestedDate = useMemo(() => {
    if (selectedDate) return selectedDate;
    if (lastMovimientoDate) return addDays(lastMovimientoDate, 1);
    return new Date().toISOString().slice(0, 10);
  }, [selectedDate, lastMovimientoDate]);

  const accion = useMemo(() => acciones.find((a) => a.id === accionId) ?? null, [acciones, accionId]);

  async function fetchAcciones() {
    setLoadingAcciones(true);
    try {
      const res = await fetch(`/local/${localId}/api/acciones-hoja`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setAcciones([]);
        setError(json?.error ?? "No se pudieron cargar acciones");
        return;
      }
      setAcciones(json.acciones ?? []);
    } finally {
      setLoadingAcciones(false);
    }
  }

  useEffect(() => {
    if (!open) return;

    // reset
    setError(null);
    setFecha(suggestedDate);
      setAccionId("");
      setImporte("");
      setTurno("");
      setNombre("");

    fetchAcciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, suggestedDate]);

  // Cerrar con ESC (PC) + bloquear scroll fondo
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      if (!accionId) {
        setError("Elegí una acción");
        return;
      }

      const fechaFinal = selectedDate ?? fecha;
      if (!fechaFinal) {
        setError("Falta fecha");
        return;
      }

      // Normalización y validación de importe
      const importeNorm = importe.trim().replace(/\./g, "").replace(",", ".");
      const importeNum = Number(importeNorm);

      if (!Number.isFinite(importeNum) || importeNum <= 0) {
        setError("Importe inválido");
        return;
      }

      // Validaciones UI básicas según acción
      if (accion?.usaTurno && !turno) {
        setError("Falta turno");
        return;
      }
      if (accion?.usaNombre && !nombre.trim()) {
        setError("Falta nombre");
        return;
      }

      const payload: any = {
        fecha: fechaFinal,
        accionId,
        importe: importeNorm,
      };
      if (accion?.usaTurno) payload.turno = turno;
      if (accion?.usaNombre) payload.nombre = nombre.trim();

      const res = await fetch(`/local/${localId}/api/movimientos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? "No se pudo guardar");
        return;
      }

      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md">
        <div className="rounded-t-3xl border border-slate-200 bg-white shadow-2xl">
          {/* Grabber */}
          <div className="flex justify-center pt-2">
            <div className="h-1.5 w-12 rounded-full bg-slate-200" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
            <div className="min-w-0">
              <div className="text-base font-extrabold text-slate-900">Cargar movimiento</div>
              <div className="mt-0.5 text-xs font-medium text-slate-500">
                {selectedDate ? `Fecha fija: ${selectedDate}` : `Sugerida: ${suggestedDate}`}
              </div>
            </div>

            <button
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
              onClick={onClose}
              disabled={saving}
            >
              Cerrar
            </button>
          </div>

          {/* Content (scroll) */}
          <div className="max-h-[70vh] overflow-auto px-4 pb-28 pt-2 space-y-4">
            {pideFecha && (
              <Field label="Fecha">
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </Field>
            )}

            <Field
              label="Acción"
              hint={accion ? `Cat: ${accion.categoria} · Impacta: ${accion.impactaTotal ? "Sí" : "No"}` : undefined}
            >
              <select value={accionId} onChange={(e) => setAccionId(e.target.value)} disabled={loadingAcciones}>
                <option value="">{loadingAcciones ? "Cargando..." : "Seleccionar"}</option>
                {acciones.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre} ({a.tipo})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Importe" hint="Ej: 15000 o 15.000,50">
  <input
    type="text"
    inputMode="decimal"
    value={importe}
    onChange={(e) => {
      const v = e.target.value.replace(/[^\d.,]/g, "");
      setImporte(v);
    }}
    placeholder="0"
    className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base"
    disabled={saving}
  />
</Field>

            {accion?.usaTurno && (
              <Field label="Turno">
                <select value={turno} onChange={(e) => setTurno(e.target.value as any)}>
                  <option value="">Seleccionar</option>
                  <option value="MANIANA">Mañana</option>
                  <option value="TARDE">Tarde</option>
                  <option value="NOCHE">Noche</option>
                </select>
              </Field>
            )}

            {accion?.usaNombre && (
              <Field label="Nombre">
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" />
              </Field>
            )}

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
                {error}
              </div>
            )}
          </div>

          {/* Bottom action */}
          <div className="absolute inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3">
            <button
              className={cn(
                "w-full rounded-2xl px-4 py-3 text-base font-extrabold shadow-sm",
                saving ? "bg-slate-200 text-slate-700" : "bg-slate-900 text-white"
              )}
              onClick={submit}
              disabled={saving}
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
