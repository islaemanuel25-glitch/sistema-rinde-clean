"use client";

import { useEffect, useMemo, useState } from "react";
import DiaModal from "./DiaModal";

type Scope = "day" | "week" | "month" | "monthcal" | "all";

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

function formatDmY(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function isoToDmy(iso: string): { day: number; month: number; year: number } {
  const d = new Date(`${iso}T00:00:00`);
  return {
    day: d.getDate(),
    month: d.getMonth() + 1,
    year: d.getFullYear(),
  };
}

function dmyToIso(day: number, month: number, year: number): string {
  const d = new Date(year, month - 1, day);
  return d.toISOString().slice(0, 10);
}

function startOfWeekSundayIso(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  const day = d.getDay(); // 0=Dom
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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
    { v: "month", label: "Mes (semanas)" },
    { v: "monthcal", label: "Mes calendario" },
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

type WeekBlock = {
  start: string; // domingo
  end: string;   // sábado
  days: DayGroup[];
  resumen: { e: number; s: number; n: number; i: number };
};

function groupWeeks(days: DayGroup[]): WeekBlock[] {
  // days viene desc (más nuevo arriba). Para agrupar, orden asc.
  const asc = [...days].sort((a, b) => (a.date < b.date ? -1 : 1));
  const map = new Map<string, DayGroup[]>();

  for (const d of asc) {
    const ws = startOfWeekSundayIso(d.date);
    if (!map.has(ws)) map.set(ws, []);
    map.get(ws)!.push(d);
  }

  const blocks: WeekBlock[] = [];
  for (const [ws, list] of map.entries()) {
    const start = ws;
    const end = addDaysIso(ws, 6);

    let e = 0, s = 0, n = 0, i = 0;
    for (const d of list) {
      e += d.resumen.totalEntradas;
      s += d.resumen.totalSalidas;
      n += d.resumen.totalNeto;
      i += d.resumen.totalImpacta;
    }

    blocks.push({ start, end, days: list, resumen: { e, s, n, i } });
  }

  // más nueva arriba
  blocks.sort((a, b) => (a.start < b.start ? 1 : -1));
  return blocks;
}

export default function LocalHojaClient({ localId }: { localId: string }) {
  const [scope, setScope] = useState<Scope>("day");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const [days, setDays] = useState<DayGroup[]>([]);
  const [lastMovimientoDate, setLastMovimientoDate] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterValue>("ALL");
  const [acciones, setAcciones] = useState<AccionUI[]>([]);
  const [presets, setPresets] = useState<PresetUI[]>([]);
  const [presetAllowedAccionIds, setPresetAllowedAccionIds] = useState<Set<string> | null>(null);

  const [hydrated, setHydrated] = useState(false);
  const [userPickedPresetKey, setUserPickedPresetKey] = useState<string | null>(null);
  const [lastAppliedKey, setLastAppliedKey] = useState<string | null>(null);

  // Estado para SocioConfig
  const [socioEnabled, setSocioEnabled] = useState(false);
  const [socioPct, setSocioPct] = useState(0);

  const [hideZero, setHideZero] = useState(true);

  // Modal día
  const [openDay, setOpenDay] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>(date);

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

  useEffect(() => localStorage.setItem("rinde_scope", scope), [scope]);
  useEffect(() => localStorage.setItem("rinde_date", date), [date]);
  useEffect(() => localStorage.setItem("rinde_filter", filter), [filter]);
  useEffect(() => localStorage.setItem("rinde_hide_zero", hideZero ? "1" : "0"), [hideZero]);

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
    // Usar acciones-hoja (lectura)
    const aRes = await fetch(`/local/${localId}/api/acciones-hoja`, { cache: "no-store" });
    const aJson = await aRes.json().catch(() => null);
    if (aRes.ok && aJson?.ok) setAcciones((aJson.acciones ?? []).map((x: any) => ({ id: x.id, nombre: x.nombre })));
    else setAcciones([]);

    const pRes = await fetch(`/local/${localId}/api/presets`, { cache: "no-store" });
    const pJson = await pRes.json().catch(() => null);
    if (pRes.ok && pJson?.ok) setPresets(pJson.presets ?? []);
    else setPresets([]);
  }

  async function fetchSocioConfig() {
    try {
      const res = await fetch(`/local/${localId}/api/socio-config`, {
        cache: "no-store",
        credentials: "include",
      });
      const json = await res.json().catch(() => null);

      if (res.ok && json?.ok) {
        setSocioEnabled(json.socioConfig?.isEnabled ?? false);
        setSocioPct(json.socioConfig?.pctSocio ?? 0); // Ya viene como 0..1
      }
    } catch (e: any) {
      // Silenciar error, usar defaults
    }
  }

  useEffect(() => {
    fetchHoja();
    fetchFiltros();
    fetchSocioConfig();
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
        }
      } catch {}
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
    if (scope === "day") return `Día ${formatDmY(date)}`;
    if (scope === "week") return `Semana (Dom→Sáb) base ${formatDmY(date)}`;
    if (scope === "month") return `Mes (negocio) base ${formatDmY(date)}`;
    if (scope === "monthcal") return `Mes calendario base ${formatDmY(date)}`;
    return "Todo";
  }, [scope, date]);

  const topSummary = useMemo(() => {
    let e = 0, s = 0, n = 0;
    for (const d of visibleDays) {
      e += d.resumen.totalEntradas;
      s += d.resumen.totalSalidas;
      n += d.resumen.totalNeto;
    }
    return { e, s, n };
  }, [visibleDays]);

  // Calcular reparto con socio
  const repartoSocio = useMemo(() => {
    if (!socioEnabled || socioPct <= 0) {
      return { socioMonto: 0, duenioMonto: topSummary.n };
    }
    const socioMonto = topSummary.n * socioPct;
    const duenioMonto = topSummary.n - socioMonto;
    return { socioMonto, duenioMonto };
  }, [socioEnabled, socioPct, topSummary.n]);

  const weeks = useMemo(() => {
    if (scope === "day") return null;
    return groupWeeks(visibleDays);
  }, [visibleDays, scope]);

  function openDia(iso: string) {
    setSelectedDay(iso);
    setOpenDay(true);
  }

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
            fetchSocioConfig();
          }}
          disabled={loading}
        >
          {loading ? "Cargando…" : "Refrescar"}
        </button>
      </div>

      {/* Tabs */}
      <Segmented value={scope} onChange={setScope} />

      {/* Date picker base (no all) */}
      {scope !== "all" && (
        <Card>
          <div className="px-4 pt-4 pb-3">
            <div className="text-sm font-semibold text-slate-900">Fecha base</div>
            {lastMovimientoDate && <div className="mt-0.5 text-xs text-slate-500">Último movimiento: {formatDmY(lastMovimientoDate)}</div>}
          </div>
          <div className="px-4 pb-4">
            {scope === "day" ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="flex-1"
                />
                <button
                  onClick={() => setDate(new Date().toISOString().slice(0, 10))}
                  className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm"
                >
                  Hoy
                </button>
              </div>
            ) : (
              (() => {
                const { day, month, year } = isoToDmy(date);
                const currentYear = new Date().getFullYear();
                const years = Array.from({ length: 7 }, (_, i) => currentYear - 5 + i);
                const months = Array.from({ length: 12 }, (_, i) => i + 1);
                const days = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1);

                return (
                  <div className="flex items-center gap-2">
                    <select
                      value={day}
                      onChange={(e) => {
                        const newDay = Number(e.target.value);
                        setDate(dmyToIso(newDay, month, year));
                      }}
                      className="flex-1"
                    >
                      {days.map((d) => (
                        <option key={d} value={d}>
                          {String(d).padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                    <select
                      value={month}
                      onChange={(e) => {
                        const newMonth = Number(e.target.value);
                        const maxDay = daysInMonth(year, newMonth);
                        const newDay = Math.min(day, maxDay);
                        setDate(dmyToIso(newDay, newMonth, year));
                      }}
                      className="flex-1"
                    >
                      {months.map((m) => (
                        <option key={m} value={m}>
                          {String(m).padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                    <select
                      value={year}
                      onChange={(e) => {
                        const newYear = Number(e.target.value);
                        const maxDay = daysInMonth(newYear, month);
                        const newDay = Math.min(day, maxDay);
                        setDate(dmyToIso(newDay, month, newYear));
                      }}
                      className="flex-1"
                    >
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setDate(new Date().toISOString().slice(0, 10))}
                      className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm"
                    >
                      Hoy
                    </button>
                  </div>
                );
              })()
            )}
          </div>
        </Card>
      )}

      {/* Summary */}
      <div className={cn("grid gap-2", socioEnabled && socioPct > 0 ? "grid-cols-5" : "grid-cols-3")}>
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
        {socioEnabled && socioPct > 0 && (
          <>
            <Card>
              <div className="p-4">
                <div className="text-xs font-medium text-slate-500">Socio</div>
                <div className="mt-1 text-2xl font-extrabold text-slate-700">{money(repartoSocio.socioMonto)}</div>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <div className="text-xs font-medium text-slate-500">Dueño</div>
                <div className="mt-1 text-2xl font-extrabold text-slate-700">{money(repartoSocio.duenioMonto)}</div>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Filtro */}
      <Card>
        <div className="px-4 pt-4 pb-3">
          <div className="text-sm font-semibold text-slate-900">Ver</div>
          <div className="mt-0.5 text-xs text-slate-500">Todo, por plantilla o por acción</div>
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

            {presets.length > 0 && <option disabled>— Plantillas —</option>}
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

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={hideZero}
              onChange={(e) => setHideZero(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Ocultar movimientos de $0 (plantillas)
          </label>

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

        {/* DAY: lista compacta */}
        {scope === "day" &&
          visibleDays.map((d) => (
            <Card key={d.date}>
              <button
                className="w-full text-left"
                onClick={() => openDia(d.date)}
              >
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-base font-extrabold text-slate-900">{formatDmY(d.date)}</div>
                    <Chip variant="soft">Neto {money(d.resumen.totalNeto)}</Chip>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>Entradas: {money(d.resumen.totalEntradas)}</span>
                    <span>•</span>
                    <span>Salidas: {money(d.resumen.totalSalidas)}</span>
                  </div>
                  {socioEnabled && socioPct > 0 && (
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                      <span>Socio: {money(d.resumen.totalNeto * socioPct)}</span>
                      <span>•</span>
                      <span>Dueño: {money(d.resumen.totalNeto * (1 - socioPct))}</span>
                    </div>
                  )}
                  <div className="mt-2 text-xs font-semibold text-slate-600">Tocá para cargar/editar el día</div>
                </div>
              </button>

              <div className="px-4 pb-4">
                <div className="space-y-1">
                  {d.movimientos.map((m) => {
                    const imp = parseNumber(m.importe);
                    const isIn = m.tipo === "ENTRADA";

                    return (
                      <div key={m.id} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-slate-900">{m.accionNombre}</div>
                          {(m.turno || m.nombre) && (
                            <div className="mt-0.5 text-xs text-slate-500">
                              {m.turno && <span>{m.turno}</span>}
                              {m.turno && m.nombre && <span> • </span>}
                              {m.nombre && <span>{m.nombre}</span>}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className={cn("text-lg font-extrabold whitespace-nowrap", isIn ? "text-emerald-700" : "text-rose-700")}>
                            {isIn ? "+" : "-"}
                            {money(imp)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          ))}

        {/* WEEK/MONTH/MONTHCAL/ALL: agrupar por semanas */}
        {scope !== "day" && weeks && weeks.map((w) => (
          <Card key={w.start}>
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-base font-extrabold text-slate-900">
                  Semana {formatDmY(w.start)} → {formatDmY(w.end)}
                </div>
                <Chip variant="soft">Neto {money(w.resumen.n)}</Chip>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                <span>Entradas: {money(w.resumen.e)}</span>
                <span>•</span>
                <span>Salidas: {money(w.resumen.s)}</span>
                <span>•</span>
                <span>Neto: {money(w.resumen.n)}</span>
              </div>
            </div>

            <div className="px-4 pb-4 space-y-2">
              {w.days
                .sort((a, b) => (a.date < b.date ? -1 : 1))
                .map((d) => (
                  <button
                    key={d.date}
                    onClick={() => openDia(d.date)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-extrabold text-slate-900">{formatDmY(d.date)}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Entradas {money(d.resumen.totalEntradas)} · Salidas {money(d.resumen.totalSalidas)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-extrabold text-slate-900">{money(d.resumen.totalNeto)}</div>
                        <div className="text-[11px] font-semibold text-slate-600">Tocar para cargar</div>
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Modal día */}
      <DiaModal
        open={openDay}
        onClose={() => setOpenDay(false)}
        localId={localId}
        dateIso={selectedDay}
        onSaved={() => {
          setOpenDay(false);
          fetchHoja();
          fetchFiltros();
          fetchSocioConfig();
        }}
      />

      {/* Botón fijo CTA abajo */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur safe-bottom">
        <div className="mx-auto w-full max-w-md px-3 py-3">
          <button
            onClick={() => {
              setSelectedDay(date);
              setOpenDay(true);
            }}
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-base font-extrabold text-white shadow-sm active:scale-[0.98]"
          >
            Cargar datos del día
          </button>
        </div>
      </div>
    </div>
  );
}
