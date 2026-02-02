"use client";

import { useEffect, useMemo, useState } from "react";

type AccionHoja = {
  id: string;
  nombre: string;
  tipo: "ENTRADA" | "SALIDA";
  categoria: "TURNO" | "DEPOSITO" | "ELECTRONICO" | "SOCIO" | "OTROS";
  usaTurno: boolean;
  usaNombre: boolean;
  impactaTotal: boolean;
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findByKeywords(list: AccionHoja[], keywords: string[], category?: AccionHoja["categoria"]) {
  const ks = keywords.map(norm);
  return (
    list.find((a) => {
      if (category && a.categoria !== category) return false;
      const n = norm(a.nombre);
      return ks.every((k) => n.includes(k));
    }) ?? null
  );
}

function Field(props: { label: string; children: React.ReactNode; hint?: string }) {
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

export default function DiaModal(props: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  localId: string;
  dateIso: string; // fecha fija del día clickeado
}) {
  const { open, onClose, onSaved, localId, dateIso } = props;

  const [acciones, setAcciones] = useState<AccionHoja[]>([]);
  const [loading, setLoading] = useState(false);

  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchAcciones() {
    const res = await fetch(`/local/${localId}/api/acciones-hoja`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) throw new Error(json?.error ?? "No se pudieron cargar acciones");
    setAcciones(json.acciones ?? []);
  }

  async function fetchDia() {
    const res = await fetch(`/local/${localId}/api/carga-dia?date=${dateIso}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) throw new Error(json?.error ?? "No se pudo cargar el día");
    setValues(json.values ?? {});
  }

  // Mapeo Opción B (acciones distintas)
  const map = useMemo(() => {
    // Turnos (por nombre)
    const manana = findByKeywords(acciones, ["turno", "mañana"], "TURNO") ?? findByKeywords(acciones, ["turno", "manana"], "TURNO");
    const tarde = findByKeywords(acciones, ["turno", "tarde"], "TURNO");
    const noche = findByKeywords(acciones, ["turno", "noche"], "TURNO");

    // Otros (por categoría + nombre)
    const electronico =
      findByKeywords(acciones, ["electron"], "ELECTRONICO") ?? findByKeywords(acciones, ["electronico"], "ELECTRONICO");
    const deposito =
      findByKeywords(acciones, ["deposit"], "DEPOSITO") ?? findByKeywords(acciones, ["deposito"], "DEPOSITO");

    // OTROS: virtual / david-eva
    const virtual = findByKeywords(acciones, ["virtual"], "OTROS");
    const davidEva =
      findByKeywords(acciones, ["david"], "OTROS") ??
      findByKeywords(acciones, ["eva"], "OTROS") ??
      findByKeywords(acciones, ["david", "eva"], "OTROS");

    return { manana, tarde, noche, electronico, deposito, virtual, davidEva };
  }, [acciones]);

  const missingRequired = useMemo(() => {
    // requeridos mínimos para que el sistema sea “usable”
    const miss: string[] = [];
    if (!map.manana) miss.push("Turno mañana");
    if (!map.tarde) miss.push("Turno tarde");
    if (!map.electronico) miss.push("Pagos electrónicos");
    if (!map.deposito) miss.push("Depósito");
    return miss;
  }, [map]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoading(true);
    (async () => {
      try {
        await fetchAcciones();
        await fetchDia();
      } catch (e: any) {
        setError(e?.message ?? "Error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, localId, dateIso]);

  if (!open) return null;

  function getVal(action: AccionHoja | null) {
    if (!action) return "";
    return values[action.id] ?? "";
  }
  function setVal(action: AccionHoja | null, v: string) {
    if (!action) return;
    setValues((prev) => ({ ...prev, [action.id]: v }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (missingRequired.length) {
        setError(`Faltan acciones configuradas: ${missingRequired.join(", ")}`);
        return;
      }

      // armamos payload con solo acciones que existen
      const payload: Record<string, string> = {};
      for (const a of [map.manana, map.tarde, map.noche, map.electronico, map.deposito, map.virtual, map.davidEva]) {
        if (!a) continue;
        payload[a.id] = (values[a.id] ?? "").trim() || "0";
      }

      const res = await fetch(`/local/${localId}/api/carga-dia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateIso, values: payload }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setError(json?.error ?? "No se pudo guardar");
        return;
      }

      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Cerrar" />

      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md">
        <div className="rounded-t-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex justify-center pt-2">
            <div className="h-1.5 w-12 rounded-full bg-slate-200" />
          </div>

          <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
            <div className="min-w-0">
              <div className="text-base font-extrabold text-slate-900">Cargar día</div>
              <div className="mt-0.5 text-xs font-medium text-slate-500">Fecha fija: {dateIso}</div>
            </div>

            <button
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
              onClick={onClose}
              disabled={saving}
            >
              Cerrar
            </button>
          </div>

          <div className="max-h-[70vh] overflow-auto px-4 pb-28 pt-2 space-y-4">
            {loading && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                Cargando…
              </div>
            )}

            {/* Ventas */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="text-sm font-extrabold text-slate-900">Ventas por turno</div>

              <Field label="Turno mañana">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={getVal(map.manana)}
                  onChange={(e) => setVal(map.manana, e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                />
              </Field>

              <Field label="Turno tarde">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={getVal(map.tarde)}
                  onChange={(e) => setVal(map.tarde, e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                />
              </Field>

              {map.noche && (
                <Field label="Turno noche" hint="Solo si el local tiene noche">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={getVal(map.noche)}
                    onChange={(e) => setVal(map.noche, e.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                  />
                </Field>
              )}
            </div>

            {/* Cobros */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="text-sm font-extrabold text-slate-900">Cobros</div>

              <Field label="Pagos electrónicos">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={getVal(map.electronico)}
                  onChange={(e) => setVal(map.electronico, e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                />
              </Field>
            </div>

            {/* Pagos / costos */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="text-sm font-extrabold text-slate-900">Pagos / costos</div>

              <Field label="Depósito">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={getVal(map.deposito)}
                  onChange={(e) => setVal(map.deposito, e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                />
              </Field>

              {map.virtual && (
                <Field label="Virtual">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={getVal(map.virtual)}
                    onChange={(e) => setVal(map.virtual, e.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                  />
                </Field>
              )}

              {map.davidEva && (
                <Field label="David / Eva" hint="Solo en ese local">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={getVal(map.davidEva)}
                    onChange={(e) => setVal(map.davidEva, e.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                  />
                </Field>
              )}
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
                {error}
              </div>
            )}
          </div>

          <div className="absolute inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3">
            <button
              className={cn(
                "w-full rounded-2xl px-4 py-3 text-base font-extrabold shadow-sm",
                saving ? "bg-slate-200 text-slate-700" : "bg-slate-900 text-white"
              )}
              onClick={save}
              disabled={saving}
            >
              {saving ? "Guardando…" : "Guardar día"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
