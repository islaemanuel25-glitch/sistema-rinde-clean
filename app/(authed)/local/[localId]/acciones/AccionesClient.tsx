"use client";

import * as React from "react";

type AccionTipo = "ENTRADA" | "SALIDA";

type AccionRow = {
  accionId: string;
  nombre: string;

  categoria: string;

  // defaults (catálogo)
  tipoDefault: AccionTipo;
  impactaTotalDefault: boolean;
  usaTurnoDefault: boolean;
  usaNombreDefault: boolean;

  // local (config efectiva)
  isEnabled: boolean;
  orden: number;

  tipoOverride: AccionTipo | null;
  impactaTotal: boolean;
  usaTurnoOverride: boolean | null;
  usaNombreOverride: boolean | null;
};

function catLabel(cat: string) {
  // si querés, acá podés poner labels “lindos”
  return cat;
}

function effectiveTipo(r: AccionRow) {
  return r.tipoOverride ?? r.tipoDefault;
}
function effectiveUsaTurno(r: AccionRow) {
  return r.usaTurnoOverride ?? r.usaTurnoDefault;
}
function effectiveUsaNombre(r: AccionRow) {
  return r.usaNombreOverride ?? r.usaNombreDefault;
}

export default function AccionesClient({ localId }: { localId: string }) {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<AccionRow[]>([]);
  const [openCats, setOpenCats] = React.useState<Record<string, boolean>>({});

  const apiUrl = `/local/${localId}/api/acciones`;

  async function load() {
    setLoading(true);
    setError(null);
    setOkMsg(null);

    const res = await fetch(apiUrl, { cache: "no-store" });
    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      setError(data?.error || "No se pudo cargar acciones");
      setLoading(false);
      return;
    }

    const acciones = (data.acciones ?? []) as AccionRow[];
    setRows(acciones);

    // abrir categorías por defecto (todas abiertas)
    const cats = Array.from(new Set(acciones.map((a) => a.categoria)));
    setOpenCats((prev) => {
      const next = { ...prev };
      for (const c of cats) if (next[c] === undefined) next[c] = true;
      return next;
    });

    setLoading(false);
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localId]);

  function setRow(id: string, patch: Partial<AccionRow>) {
    setRows((prev) => prev.map((r) => (r.accionId === id ? { ...r, ...patch } : r)));
  }

  function resetOverrides(id: string) {
    setRow(id, {
      tipoOverride: null,
      usaTurnoOverride: null,
      usaNombreOverride: null,
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    setOkMsg(null);

    const payload = {
      acciones: rows.map((r) => ({
        accionId: r.accionId,
        isEnabled: r.isEnabled,
        orden: Number.isFinite(r.orden) ? r.orden : 0,
        tipoOverride: r.tipoOverride,
        impactaTotal: !!r.impactaTotal,
        usaTurnoOverride: r.usaTurnoOverride,
        usaNombreOverride: r.usaNombreOverride,
      })),
    };

    const res = await fetch(apiUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      setError(data?.error || "No se pudo guardar");
      setSaving(false);
      return;
    }

    setOkMsg("Guardado.");
    setSaving(false);
    await load();
  }

  const grouped = React.useMemo(() => {
    const map = new Map<string, AccionRow[]>();
    for (const r of rows) {
      const k = r.categoria || "OTROS";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    // orden dentro de categoría
    for (const [k, list] of map.entries()) {
      list.sort((a, b) => (a.orden - b.orden) || a.nombre.localeCompare(b.nombre));
      map.set(k, list);
    }
    // orden de categorías fijo si querés (SOCIO eliminado)
    const order = ["TURNO", "DEPOSITO", "ELECTRONICO", "OTROS"];
    const cats = Array.from(map.keys()).sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return { map, cats };
  }, [rows]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 shadow-sm">
        Cargando…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header sticky “tipo app” */}
      <div className="sticky top-0 z-10 -mx-2 bg-white/90 px-2 pb-2 pt-1 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-extrabold text-slate-900">Acciones del local</div>

          <button
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-extrabold text-white shadow-sm disabled:opacity-60"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>

        <div className="mt-1 text-xs font-semibold text-slate-500">
          No se crean acciones acá: solo se configuran las existentes (catálogo).
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-extrabold text-rose-700">
          {error}
        </div>
      )}

      {okMsg && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-extrabold text-emerald-700">
          {okMsg}
        </div>
      )}

      <div className="space-y-3">
        {grouped.cats.map((cat) => {
          const list = grouped.map.get(cat)!;
          const isOpen = openCats[cat] ?? true;

          const enabledCount = list.filter((x) => x.isEnabled).length;

          return (
            <section
              key={cat}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <button
                type="button"
                onClick={() => setOpenCats((p) => ({ ...p, [cat]: !isOpen }))}
                className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left"
              >
                <div>
                  <div className="text-sm font-extrabold text-slate-900">{catLabel(cat)}</div>
                  <div className="text-xs font-semibold text-slate-500">
                    {enabledCount}/{list.length} habilitadas
                  </div>
                </div>
                <div className="text-xs font-extrabold text-slate-500">
                  {isOpen ? "Cerrar" : "Abrir"}
                </div>
              </button>

              {isOpen && (
                <div className="divide-y divide-slate-100">
                  {list.map((r) => {
                    const effTipo = effectiveTipo(r);
                    const effTurno = effectiveUsaTurno(r);
                    const effNombre = effectiveUsaNombre(r);

                    return (
                      <div key={r.accionId} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-extrabold text-slate-900">
                              {r.nombre}
                            </div>

                            <div className="mt-1 text-xs font-semibold text-slate-500">
                              Efectivo: {effTipo} · turno:{effTurno ? "sí" : "no"} · nombre:
                              {effNombre ? "sí" : "no"} · impacta:{r.impactaTotal ? "sí" : "no"}
                            </div>

                            <div className="mt-1 text-[11px] font-semibold text-slate-400">
                              Default: {r.tipoDefault} · turno:{r.usaTurnoDefault ? "sí" : "no"} ·
                              nombre:{r.usaNombreDefault ? "sí" : "no"} · impacta:
                              {r.impactaTotalDefault ? "sí" : "no"}
                            </div>
                          </div>

                          <label className="flex items-center gap-2 text-xs font-extrabold text-slate-700">
                            <input
                              type="checkbox"
                              checked={r.isEnabled}
                              onChange={(e) => setRow(r.accionId, { isEnabled: e.target.checked })}
                              className="h-4 w-4"
                            />
                            ON
                          </label>
                        </div>

                        {/* Controles */}
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="rounded-xl border border-slate-200 p-2">
                            <div className="text-[11px] font-extrabold text-slate-500">Orden</div>
                            <input
                              value={r.orden}
                              onChange={(e) =>
                                setRow(r.accionId, {
                                  orden: parseInt(e.target.value || "0", 10),
                                })
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm font-extrabold"
                              inputMode="numeric"
                            />
                          </div>

                          <div className="rounded-xl border border-slate-200 p-2">
                            <div className="text-[11px] font-extrabold text-slate-500">Tipo</div>
                            <select
                              value={r.tipoOverride ?? ""}
                              onChange={(e) =>
                                setRow(r.accionId, {
                                  tipoOverride: (e.target.value || null) as any,
                                })
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm font-extrabold"
                            >
                              <option value="">(default)</option>
                              <option value="ENTRADA">ENTRADA</option>
                              <option value="SALIDA">SALIDA</option>
                            </select>
                          </div>

                          <div className="rounded-xl border border-slate-200 p-2">
                            <div className="text-[11px] font-extrabold text-slate-500">
                              Usa turno
                            </div>
                            <select
                              value={r.usaTurnoOverride === null ? "" : String(r.usaTurnoOverride)}
                              onChange={(e) =>
                                setRow(r.accionId, {
                                  usaTurnoOverride:
                                    e.target.value === ""
                                      ? null
                                      : e.target.value === "true",
                                })
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm font-extrabold"
                            >
                              <option value="">(default)</option>
                              <option value="true">Sí</option>
                              <option value="false">No</option>
                            </select>
                          </div>

                          <div className="rounded-xl border border-slate-200 p-2">
                            <div className="text-[11px] font-extrabold text-slate-500">
                              Usa nombre
                            </div>
                            <select
                              value={
                                r.usaNombreOverride === null ? "" : String(r.usaNombreOverride)
                              }
                              onChange={(e) =>
                                setRow(r.accionId, {
                                  usaNombreOverride:
                                    e.target.value === ""
                                      ? null
                                      : e.target.value === "true",
                                })
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-sm font-extrabold"
                            >
                              <option value="">(default)</option>
                              <option value="true">Sí</option>
                              <option value="false">No</option>
                            </select>
                          </div>

                          <div className="col-span-2 rounded-xl border border-slate-200 p-2">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="text-[11px] font-extrabold text-slate-500">
                                  Impacta total
                                </div>
                                <div className="text-[11px] font-semibold text-slate-400">
                                  (Este es el valor efectivo por local)
                                </div>
                              </div>
                              <input
                                type="checkbox"
                                checked={r.impactaTotal}
                                onChange={(e) =>
                                  setRow(r.accionId, { impactaTotal: e.target.checked })
                                }
                                className="h-5 w-5"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => resetOverrides(r.accionId)}
                            className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-extrabold text-slate-700"
                          >
                            Restablecer overrides (volver a default)
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
