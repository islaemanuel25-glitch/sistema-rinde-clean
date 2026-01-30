"use client";

import { useMemo, useState } from "react";

type TipoMovimiento = "ENTRADA" | "SALIDA";
type Nullable<T> = T | null;

type AccionConfigRow = {
  accionId: string;
  nombre: string;
  categoria: string;

  isEnabled: boolean;
  orden: number;

  tipoOverride: Nullable<TipoMovimiento>;
  usaTurnoOverride: Nullable<boolean>;
  usaNombreOverride: Nullable<boolean>;
  impactaTotal: boolean;
  impactaTotalDesde: string; // yyyy-mm-dd

  defaults: {
    tipoDefault: TipoMovimiento;
    impactaTotalDefault: boolean;
    usaTurno: boolean;
    usaNombre: boolean;
  };
};

export default function AccionesConfigClient({
  localId,
  initialAcciones,
}: {
  localId: string;
  initialAcciones: AccionConfigRow[];
}) {
  const [rows, setRows] = useState<AccionConfigRow[]>(initialAcciones);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const initialById = useMemo(() => {
    const m = new Map<string, AccionConfigRow>();
    for (const r of initialAcciones) m.set(r.accionId, r);
    return m;
  }, [initialAcciones]);

  function setRow(id: string, patch: Partial<AccionConfigRow>) {
    setRows((prev) => prev.map((r) => (r.accionId === id ? { ...r, ...patch } : r)));
  }

  function isDirty(r: AccionConfigRow) {
    const base = initialById.get(r.accionId);
    if (!base) return true;
    return (
      r.isEnabled !== base.isEnabled ||
      r.orden !== base.orden ||
      r.impactaTotal !== base.impactaTotal ||
      r.impactaTotalDesde !== base.impactaTotalDesde ||
      r.tipoOverride !== base.tipoOverride ||
      r.usaTurnoOverride !== base.usaTurnoOverride ||
      r.usaNombreOverride !== base.usaNombreOverride
    );
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const dirty = rows.filter(isDirty);
      if (dirty.length === 0) {
        setMsg("No hay cambios.");
        return;
      }

      for (const r of dirty) {
        const res = await fetch("/api/config/acciones", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            localId,
            accionId: r.accionId,
            isEnabled: r.isEnabled,
            orden: r.orden,
            impactaTotal: r.impactaTotal,
            impactaTotalDesde: r.impactaTotalDesde,
            tipoOverride: r.tipoOverride,
            usaTurnoOverride: r.usaTurnoOverride,
            usaNombreOverride: r.usaNombreOverride,
          }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error ?? `ERROR_${res.status}`);
        }
      }

      setMsg("Guardado OK.");
      // refrescamos para que server vuelva a traer y quede consistente
      window.location.reload();
    } catch (e: any) {
      setMsg(`Error: ${String(e?.message ?? e)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ padding: 12, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12 }}>
        <div style={{ fontWeight: 700 }}>Editor</div>
        <div style={{ opacity: 0.8, marginTop: 6 }}>
          Cambiá valores y apretá <b>Guardar</b>. Esto solo modifica <b>AccionLocal</b> (config por local), no históricos.
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={save}
            disabled={saving}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)" }}
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
          {msg ? <div style={{ opacity: 0.85 }}>{msg}</div> : null}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r) => {
          const dirty = isDirty(r);
          return (
            <div
              key={r.accionId}
              style={{
                padding: 12,
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                <div style={{ fontWeight: 700 }}>
                  {r.nombre}{" "}
                  {dirty ? <span style={{ fontWeight: 600, opacity: 0.7 }}>(cambiado)</span> : null}
                </div>
                <div style={{ opacity: 0.7 }}>{r.categoria}</div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={r.isEnabled}
                    onChange={(e) => setRow(r.accionId, { isEnabled: e.target.checked })}
                  />
                  habilitada
                </label>

                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  orden
                  <input
                    type="number"
                    value={r.orden}
                    onChange={(e) => setRow(r.accionId, { orden: Number(e.target.value) })}
                    style={{ width: 90 }}
                  />
                </label>

                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={r.impactaTotal}
                    onChange={(e) => setRow(r.accionId, { impactaTotal: e.target.checked })}
                  />
                  impactaTotal
                </label>

                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  impactaDesde
                  <input
                    type="date"
                    value={r.impactaTotalDesde}
                    onChange={(e) => setRow(r.accionId, { impactaTotalDesde: e.target.value })}
                  />
                </label>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  tipoOverride
                  <select
                    value={r.tipoOverride ?? ""}
                    onChange={(e) =>
                      setRow(r.accionId, { tipoOverride: e.target.value ? (e.target.value as TipoMovimiento) : null })
                    }
                  >
                    <option value="">(sin override)</option>
                    <option value="ENTRADA">ENTRADA</option>
                    <option value="SALIDA">SALIDA</option>
                  </select>
                </label>

                <TriStateBool
                  label="usaTurnoOverride"
                  value={r.usaTurnoOverride}
                  onChange={(v) => setRow(r.accionId, { usaTurnoOverride: v })}
                />

                <TriStateBool
                  label="usaNombreOverride"
                  value={r.usaNombreOverride}
                  onChange={(v) => setRow(r.accionId, { usaNombreOverride: v })}
                />
              </div>

              <div style={{ opacity: 0.7, fontSize: 12 }}>
                defaults → tipo {r.defaults.tipoDefault}, usaTurno {r.defaults.usaTurno ? "sí" : "no"}, usaNombre{" "}
                {r.defaults.usaNombre ? "sí" : "no"}, impactaTotalDefault {r.defaults.impactaTotalDefault ? "sí" : "no"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TriStateBool({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  const v = value === null ? "" : value ? "true" : "false";

  return (
    <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {label}
      <select
        value={v}
        onChange={(e) => {
          const s = e.target.value;
          if (s === "") return onChange(null);
          return onChange(s === "true");
        }}
      >
        <option value="">(sin override)</option>
        <option value="true">sí</option>
        <option value="false">no</option>
      </select>
    </label>
  );
}
