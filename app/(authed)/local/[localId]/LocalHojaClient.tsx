"use client";

import { useEffect, useMemo, useState } from "react";
import MovimientoModal from "./MovimientoModal";

type Scope = "day" | "week" | "month" | "all";

type DayGroup = {
  date: string;
  movimientos: Array<{
    id: string;
    accionId: string;
    accionNombre: string;
    tipo: "ENTRADA" | "SALIDA";
    importe: string;
    turno: "MANIANA" | "TARDE" | "NOCHE" | null;
    nombre: string | null;
    socio: string | null;
    impactaTotal: boolean;
  }>;
  resumen: {
    totalEntradas: number;
    totalSalidas: number;
    totalNeto: number;
    totalImpacta: number;
  };
};

type AccionUI = { id: string; nombre: string };
type PresetUI = { id: string; nombre: string; scope: "GLOBAL" | "LOCAL" };

type FilterValue = "ALL" | `PRESET:${string}` | `ACCION:${string}`;

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function money(v: number) {
  if (!isFinite(v)) return "0";
  return v.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function parseNumber(s: string) {
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

function applyFilterToDays(days: DayGroup[], allowedAccionIds: Set<string> | null) {
  if (!allowedAccionIds) return days;

  const out: DayGroup[] = [];
  for (const d of days) {
    const movs = d.movimientos.filter((m) => allowedAccionIds.has(m.accionId));
    if (movs.length === 0) continue;

    let totalEntradas = 0;
    let totalSalidas = 0;
    let totalImpacta = 0;

    for (const m of movs) {
      const imp = parseNumber(m.importe);
      if (m.tipo === "ENTRADA") totalEntradas += imp;
      else totalSalidas += imp;

      if (m.impactaTotal) {
        if (m.tipo === "ENTRADA") totalImpacta += imp;
        else totalImpacta -= imp;
      }
    }

    out.push({
      date: d.date,
      movimientos: movs,
      resumen: {
        totalEntradas,
        totalSalidas,
        totalNeto: totalEntradas - totalSalidas,
        totalImpacta,
      },
    });
  }
  return out;
}

function Chip(props: { children: React.ReactNode; variant?: "neutral" | "in" | "out" | "soft" }) {
  const v = props.variant ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[12px] leading-4 font-medium",
        v === "neutral" && "border border-slate-200 bg-white text-slate-700",
        v === "soft" && "border border-slate-200 bg-slate-50 text-slate-700",
        v === "in" && "border border-emerald-200 bg-emerald-50 text-emerald-800",
        v === "out" && "border border-rose-200 bg-rose-50 text-rose-800"
      )}
    >
      {props.children}
    </span>
  );
}

function Card(props: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", props.className)}>{props.children}</div>;
}

function Segmented(props: { value: Scope; onChange: (v: Scope) => void }) {
  const items: Array<{ v: Scope; label: string }> = [
    { v: "day", label: "Día" },
    { v: "week", label: "Semana" },
    { v: "month", label: "Mes" },
    { v: "all", label: "Todo" },
  ];

  return (
    <div className="flex w-full rounded-2xl border border-slate-200 bg-slate-50 p-1">
      {items.map((it) => {
        const active = props.value === it.v;
        return (
          <button
            key={it.v}
            onClick={() => props.onChange(it.v)}
            className={cn(
              "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition",
              active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

export default function LocalHojaClient({ localId }: { localId: string }) {
  const [scope, setScope] = useState<Scope>("day");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const [days, setDays] = useState<DayGroup[]>([]);
  const [lastMovimientoDate, setLastMovimientoDate] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);

  const [filter, setFilter] = useState<FilterValue>("ALL");
  const [acciones, setAcciones] = useState<AccionUI[]>([]);
  const [presets, setPresets] = useState<PresetUI[]>([]);
  const [presetAllowedAccionIds, setPresetAllowedAccionIds] = useState<Set<string> | null>(null);

  const [lastAppliedKey, setLastAppliedKey] = useState<string | null>(null);

  // Opción B: aplicar preset solo cuando lo elige el usuario (no por persistencia inicial)
  const [hydrated, setHydrated] = useState(false);
  const [userPickedPresetKey, setUserPickedPresetKey] = useState<string | null>(null);

  // UX: ocultar ceros por defecto (presets)
  const [hideZero, setHideZero] = useState(true);

  useEffect(() => {
    const s = localStorage.getItem("rinde_scope") as Scope | null;
    const d = localStorage.getItem("rinde_date");
    const f = localStorage.getItem("rinde_filter") as FilterValue | null;
    const hz = localStorage.getItem("rinde_hide_zero");

    if (s) setScope(s);
    if (d) setDate(d);
    if (f) setFilter(f);
    if (hz === "0") setHideZero(false);
    if (hz === "1") setHideZero(true);

    setHydrated(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("rinde_scope", scope);
  }, [scope]);

  useEffect(() => {
    localStorage.setItem("rinde_date", date);
  }, [date]);

  useEffect(() => {
    localStorage.setItem("rinde_filter", filter);
  }, [filter]);

  useEffect(() => {
    localStorage.setItem("rinde_hide_zero", hideZero ? "1" : "0");
  }, [hideZero]);

  async function fetchHoja() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("scope", scope);
      if (scope !== "all") qs.set("date", date);

      const res = await fetch(`/local/${localId}/api/hoja?${qs.toString()}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setDays([]);
        setLastMovimientoDate(null);
        setError(json?.error ?? "No se pudo cargar la hoja");
        return;
      }

      setDays(json.days ?? []);
      setLastMovimientoDate(json?.meta?.lastMovimientoDate ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Error");
      setDays([]);
      setLastMovimientoDate(null);
    } finally {
      setLoading(false);
    }
  }

  async function fetchFiltros() {
    const aRes = await fetch(`/local/${localId}/api/acciones`, { cache: "no-store" });
    const aJson = await aRes.json().catch(() => null);
    if (aRes.ok && aJson?.ok) setAcciones((aJson.acciones ?? []).map((x: any) => ({ id: x.id, nombre: x.nombre })));
    else setAcciones([]);

    const pRes = await fetch(`/local/${localId}/api/presets`, { cache: "no-store" });
    const pJson = await pRes.json().catch(() => null);
    if (pRes.ok && pJson?.ok) setPresets(pJson.presets ?? []);
    else setPresets([]);
  }

  useEffect(() => {
    fetchHoja();
    fetchFiltros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localId]);

  useEffect(() => {
    fetchHoja();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, date]);

  useEffect(() => {
    async function run() {
      if (!filter.startsWith("PRESET:")) {
        setPresetAllowedAccionIds(null);
        return;
      }
      const presetId = filter.slice("PRESET:".length);
      const res = await fetch(`/local/${localId}/api/presets/${presetId}/items`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setPresetAllowedAccionIds(new Set());
        return;
      }
      const ids = new Set<string>();
      for (const it of (json.items ?? []) as Array<{ tipo: string; accionId?: string }>) {
        if (it.tipo === "ACCION" && typeof it.accionId === "string") ids.add(it.accionId);
      }
      setPresetAllowedAccionIds(ids);
    }
    run();
  }, [filter, localId]);

  useEffect(() => {
    async function applyPreset() {
      if (!hydrated) return;
      if (scope !== "day") return;
      if (!filter.startsWith("PRESET:")) return;

      const presetId = filter.slice("PRESET:".length);
      const key = `${localId}::${date}::${presetId}`;

      if (userPickedPresetKey !== key) return;
      if (lastAppliedKey === key) return;

      try {
        const res = await fetch(`/local/${localId}/api/hoja`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, presetId }),
        });

        const json = await res.json().catch(() => null);
        if (res.ok && json?.ok) {
          setLastAppliedKey(key);
          setHideZero(true);
          fetchHoja();
        } else {
          console.warn("No se pudo aplicar preset:", json?.error);
        }
      } catch (e) {
        console.warn("Error al aplicar preset:", e);
      }
    }

    applyPreset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, userPickedPresetKey, filter, scope, date, localId, lastAppliedKey]);

  const allowedAccionIds = useMemo(() => {
    if (filter === "ALL") return null;
    if (filter.startsWith("ACCION:")) return new Set([filter.slice("ACCION:".length)]);
    if (filter.startsWith("PRESET:")) return presetAllowedAccionIds ?? new Set<string>();
    return null;
  }, [filter, presetAllowedAccionIds]);

  const visibleDaysRaw = useMemo(() => applyFilterToDays(days, allowedAccionIds), [days, allowedAccionIds]);

  const visibleDays = useMemo(() => {
    if (!hideZero) return visibleDaysRaw;

    const out: DayGroup[] = [];
    for (const d of visibleDaysRaw) {
      const movs = d.movimientos.filter((m) => parseNumber(m.importe) !== 0);
      if (movs.length === 0) continue;

      let totalEntradas = 0;
      let totalSalidas = 0;
      let totalImpacta = 0;

      for (const m of movs) {
        const imp = parseNumber(m.importe);
        if (m.tipo === "ENTRADA") totalEntradas += imp;
        else totalSalidas += imp;

        if (m.impactaTotal) {
          if (m.tipo === "ENTRADA") totalImpacta += imp;
          else totalImpacta -= imp;
        }
      }

      out.push({
        date: d.date,
        movimientos: movs,
        resumen: {
          totalEntradas,
          totalSalidas,
          totalNeto: totalEntradas - totalSalidas,
          totalImpacta,
        },
      });
    }
    return out;
  }, [visibleDaysRaw, hideZero]);

  const headerLabel = useMemo(() => {
    if (scope === "day") return `Día ${date}`;
    if (scope === "week") return `Semana (base) ${date}`;
    if (scope === "month") return `Mes (base) ${date}`;
    return "Todo";
  }, [scope, date]);

  const topSummary = useMemo(() => {
    let e = 0,
      s = 0,
      n = 0,
      i = 0;
    for (const d of visibleDays) {
      e += d.resumen.totalEntradas;
      s += d.resumen.totalSalidas;
      n += d.resumen.totalNeto;
      i += d.resumen.totalImpacta;
    }
    return { e, s, n, i };
  }, [visibleDays]);

  return (
    <div className="space-y-3 pb-28">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-2xl font-extrabold tracking-tight text-slate-900">Hoja</div>
          <div className="mt-0.5 text-sm font-medium text-slate-600">{headerLabel}</div>
        </div>

        <button
          className={cn("rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm", loading && "opacity-60")}
          onClick={() => {
            fetchHoja();
            fetchFiltros();
          }}
          disabled={loading}
        >
          {loading ? "Cargando…" : "Refrescar"}
        </button>
      </div>

      {/* Tabs */}
      <Segmented value={scope} onChange={setScope} />

      {/* Date picker (solo day) */}
      {scope === "day" && (
        <Card>
          <div className="px-4 pt-4 pb-3">
            <div className="text-sm font-semibold text-slate-900">Fecha</div>
            {lastMovimientoDate && <div className="mt-0.5 text-xs text-slate-500">Último movimiento: {lastMovimientoDate}</div>}
          </div>
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <button onClick={() => setDate(new Date().toISOString().slice(0, 10))} className="shrink-0 font-semibold">
                Hoy
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2">
        <Card>
          <div className="p-4">
            <div className="text-xs font-medium text-slate-500">Entradas</div>
            <div className="mt-1 text-2xl font-extrabold text-emerald-700">+{money(topSummary.e)}</div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="text-xs font-medium text-slate-500">Salidas</div>
            <div className="mt-1 text-2xl font-extrabold text-rose-700">-{money(topSummary.s)}</div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="text-xs font-medium text-slate-500">Neto</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{money(topSummary.n)}</div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <div className="text-xs font-medium text-slate-500">Impacta</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{money(topSummary.i)}</div>
          </div>
        </Card>
      </div>

      {/* Filtro */}
      <Card>
        <div className="px-4 pt-4 pb-3">
          <div className="text-sm font-semibold text-slate-900">Filtro</div>
          <div className="mt-0.5 text-xs text-slate-500">Preset, acción o todo</div>
        </div>

        <div className="px-4 pb-4 space-y-3">
          <select
            value={filter}
            onChange={(e) => {
              const v = e.target.value as FilterValue;
              setFilter(v);

              if (v.startsWith("PRESET:")) {
                const presetId = v.slice("PRESET:".length);
                setUserPickedPresetKey(`${localId}::${date}::${presetId}`);
              } else {
                setUserPickedPresetKey(null);
              }
            }}
          >
            <option value="ALL">Todo</option>

            {presets.length > 0 && <option disabled>— Presets —</option>}
            {presets.map((p) => (
              <option key={p.id} value={`PRESET:${p.id}`}>
                {p.nombre}
              </option>
            ))}

            {acciones.length > 0 && <option disabled>— Acciones —</option>}
            {acciones.map((a) => (
              <option key={a.id} value={`ACCION:${a.id}`}>
                {a.nombre}
              </option>
            ))}
          </select>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={hideZero}
                onChange={(e) => setHideZero(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Ocultar importes 0
            </label>

            <button className="btn-primary border-0 px-4 py-2 font-semibold shadow-sm" onClick={() => setOpen(true)}>
              + Cargar
            </button>
          </div>

          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">{error}</div>}
        </div>
      </Card>

      {/* Lista */}
      <div className="space-y-3">
        {!loading && visibleDays.length === 0 && !error && (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm font-medium text-slate-600">
            Sin movimientos para este rango.
          </div>
        )}

        {visibleDays.map((d) => (
          <Card key={d.date}>
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-base font-extrabold text-slate-900">{d.date}</div>
                <Chip variant="soft">Neto {money(d.resumen.totalNeto)}</Chip>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                <span>Entradas: {money(d.resumen.totalEntradas)}</span>
                <span>•</span>
                <span>Salidas: {money(d.resumen.totalSalidas)}</span>
                <span>•</span>
                <span>Impacta: {money(d.resumen.totalImpacta)}</span>
              </div>
            </div>

            <div className="px-4 pb-4 space-y-2">
              {d.movimientos.map((m) => {
                const imp = parseNumber(m.importe);
                const isIn = m.tipo === "ENTRADA";

                return (
                  <div key={m.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-extrabold text-slate-900">{m.accionNombre}</div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <Chip variant={isIn ? "in" : "out"}>{isIn ? "ENTRADA" : "SALIDA"}</Chip>
                          <Chip variant="neutral">{m.impactaTotal ? "Impacta" : "No impacta"}</Chip>
                          {m.turno && <Chip variant="neutral">{m.turno}</Chip>}
                          {m.nombre && <Chip variant="neutral">{m.nombre}</Chip>}
                          {m.socio && <Chip variant="neutral">Socio: {m.socio}</Chip>}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className={cn("text-2xl font-extrabold", isIn ? "text-emerald-700" : "text-rose-700")}>
                          {isIn ? "+" : "-"}
                          {money(imp)}
                        </div>
                        {hideZero && imp === 0 && <div className="mt-0.5 text-[11px] font-medium text-slate-500">preset</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      {/* CTA fijo abajo (siempre accesible) */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto w-full max-w-md px-3 py-3">
          <button className="btn-primary w-full border-0 py-3 text-base font-extrabold shadow-sm" onClick={() => setOpen(true)}>
            + Cargar movimiento
          </button>
        </div>
      </div>

      <MovimientoModal
        open={open}
        onClose={() => setOpen(false)}
        localId={localId}
        scope={scope}
        selectedDate={scope === "day" ? date : null}
        lastMovimientoDate={lastMovimientoDate}
        onCreated={() => {
          setOpen(false);
          fetchHoja();
          fetchFiltros();
        }}
      />
    </div>
  );
}
