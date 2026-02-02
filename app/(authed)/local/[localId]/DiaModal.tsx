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

/**
 * Turnos: en la práctica los nombres varían (ej: "Caja mañana", "Ventas mañana", "Turno Mañana", etc.).
 * Esta función intenta varias combinaciones y prioriza categoria TURNO si existe.
 */
function findTurno(list: AccionHoja[], turno: "manana" | "tarde" | "noche") {
  const variants =
    turno === "manana"
      ? [
          ["turno", "mañana"],
          ["turno", "manana"],
          ["mañana"],
          ["manana"],
          ["ventas", "mañana"],
          ["ventas", "manana"],
          ["caja", "mañana"],
          ["caja", "manana"],
        ]
      : turno === "tarde"
      ? [["turno", "tarde"], ["tarde"], ["ventas", "tarde"], ["caja", "tarde"]]
      : [["turno", "noche"], ["noche"], ["ventas", "noche"], ["caja", "noche"]];

  // 1) Preferir categoria TURNO
  for (const ks of variants) {
    const hit = findByKeywords(list, ks, "TURNO");
    if (hit) return hit;
  }
  // 2) Fallback: sin categoria (por si lo cargaron mal)
  for (const ks of variants) {
    const hit = findByKeywords(list, ks);
    if (hit) return hit;
  }
  return null;
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
  dateIso: string;
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

  const map = useMemo(() => {
    const manana = findTurno(acciones, "manana");
    const tarde = findTurno(acciones, "tarde");
    const noche = findTurno(acciones, "noche");

    const electronico =
      findByKeywords(acciones, ["electron"], "ELECTRONICO") ?? findByKeywords(acciones, ["electronico"], "ELECTRONICO");
    const deposito = findByKeywords(acciones, ["deposit"], "DEPOSITO") ?? findByKeywords(acciones, ["deposito"], "DEPOSITO");

    const virtual = findByKeywords(acciones, ["virtual"], "OTROS");
    const davidEva =
      findByKeywords(acciones, ["david"], "OTROS") ??
      findByKeywords(acciones, ["eva"], "OTROS") ??
      findByKeywords(acciones, ["david", "eva"], "OTROS");

    return { manana, tarde, noche, electronico, deposito, virtual, davidEva };
  }, [acciones]);

  const missingRequired = useMemo(() => {
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

  // Scroll lock + ESC
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

  function getVal(action: AccionHoja | null) {
    if (!action) return "";
    return values[action.id] ?? "";
  }

  function setVal(action: AccionHoja | null, v: string) {
    if (!action) return; // <- si no hay acción, NO hay dónde guardar
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
    <div className="fixed inset-0 z-[1000]">
      <button className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Cerrar" />

      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md z-[1001]">
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

            {missingRequired.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                Acciones faltantes: {missingRequired.join(", ")}. (Por eso Turnos puede “no escribir”)
              </div>
            )}

            {/* Ventas */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="text-sm font-extrabold text-slate-900">Ventas por turno</div>

              <Field label="Turno mañana" hint={!map.manana ? "No configurado (acción TURNO mañana no encontrada)" : undefined}>
                <input
                  type="text"
                  value={map.manana ? getVal(map.manana) : ""}
                  onChange={
                    map.manana
                      ? (e) => setVal(map.manana, e.target.value.replace(/[^\d.,]/g, ""))
                      : undefined
                  }
                  placeholder={!map.manana ? "Configurar acción TURNO mañana" : "0"}
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base"
                  disabled={saving || !map.manana}
                />
              </Field>

              <Field label="Turno tarde" hint={!map.tarde ? "No configurado (acción TURNO tarde no encontrada)" : undefined}>
                <input
                  type="text"
                  value={map.tarde ? getVal(map.tarde) : ""}
                  onChange={
                    map.tarde
                      ? (e) => setVal(map.tarde, e.target.value.replace(/[^\d.,]/g, ""))
                      : undefined
                  }
                  placeholder={!map.tarde ? "Configurar acción TURNO tarde" : "0"}
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base"
                  disabled={saving || !map.tarde}
                />
              </Field>

              {map.noche && (
                <Field label="Turno noche" hint="Solo si el local tiene noche">
                  <input
                    type="text"
                    value={getVal(map.noche)}
                    onChange={(e) => setVal(map.noche, e.target.value.replace(/[^\d.,]/g, ""))}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base"
                    disabled={saving}
                  />
                </Field>
              )}
            </div>

            {/* Cobros */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="text-sm font-extrabold text-slate-900">Cobros</div>

              <Field label="Pagos electrónicos" hint={!map.electronico ? "No configurado" : undefined}>
                <input
                  type="text"
                  value={map.electronico ? getVal(map.electronico) : ""}
                  onChange={
                    map.electronico
                      ? (e) => setVal(map.electronico, e.target.value.replace(/[^\d.,]/g, ""))
                      : undefined
                  }
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base"
                  disabled={saving || !map.electronico}
                />
              </Field>
            </div>

            {/* Pagos / costos */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="text-sm font-extrabold text-slate-900">Pagos / costos</div>

              <Field label="Depósito" hint={!map.deposito ? "No configurado" : undefined}>
                <input
                  type="text"
                  value={map.deposito ? getVal(map.deposito) : ""}
                  onChange={
                    map.deposito
                      ? (e) => setVal(map.deposito, e.target.value.replace(/[^\d.,]/g, ""))
                      : undefined
                  }
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base"
                  disabled={saving || !map.deposito}
                />
              </Field>

              {map.virtual && (
                <Field label="Virtual">
                  <input
                    type="text"
                    value={getVal(map.virtual)}
                    onChange={(e) => setVal(map.virtual, e.target.value.replace(/[^\d.,]/g, ""))}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base"
                    disabled={saving}
                  />
                </Field>
              )}

              {map.davidEva && (
                <Field label="David / Eva" hint="Solo en ese local">
                  <input
                    type="text"
                    value={getVal(map.davidEva)}
                    onChange={(e) => setVal(map.davidEva, e.target.value.replace(/[^\d.,]/g, ""))}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base"
                    disabled={saving}
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
