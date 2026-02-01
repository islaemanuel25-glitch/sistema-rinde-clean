"use client";

import * as React from "react";

type Mode = "week" | "month";

type Row = {
  start: string;
  end: string;
  entradas: number;
  salidas: number;
  resultado: number;
  arrastreAntes: number;
  arrastreDespues: number;
  gananciaDivisible: number;
  pctSocio: number; // 0..1
  parteSocio: number;
  parteDueno: number;
};

type SocioCfg = {
  isEnabled: boolean;
  pctSocio: number; // UI: 50..99
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function DashboardClient({ localId }: { localId: string }) {
  const [mode, setMode] = React.useState<Mode>("week");
  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // Config socio
  const [cfgLoading, setCfgLoading] = React.useState(true);
  const [cfg, setCfg] = React.useState<SocioCfg>({ isEnabled: false, pctSocio: 50 });
  const [cfgDirty, setCfgDirty] = React.useState(false);
  const [cfgMsg, setCfgMsg] = React.useState<string | null>(null);
  const [cfgIsAdmin, setCfgIsAdmin] = React.useState<boolean>(false);

  async function loadDashboard(m: Mode) {
    setLoading(true);
    setError(null);

    const res = await fetch(`/local/${localId}/api/dashboard?mode=${m}&count=12`, { cache: "no-store" });
    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      setError(data?.error || "No se pudo cargar dashboard");
      setLoading(false);
      return;
    }

    setRows(data.series as Row[]);
    setLoading(false);
  }

  async function loadSocioConfig() {
    setCfgLoading(true);
    setCfgMsg(null);

    const res = await fetch(`/local/${localId}/api/socio-config`, { cache: "no-store" });
    const data = await res.json().catch(() => null);

    // Si da 403 => no es admin (o no autorizado para editar)
    if (res.status === 403) {
      setCfgIsAdmin(false);
      setCfgLoading(false);
      return;
    }

    if (!res.ok || !data?.ok) {
      // Si falla por cualquier otra cosa, no rompemos dashboard
      setCfgIsAdmin(false);
      setCfgLoading(false);
      return;
    }

    setCfgIsAdmin(true);
    setCfg(data.item as SocioCfg);
    setCfgDirty(false);
    setCfgLoading(false);
  }

  async function saveSocioConfig() {
    setCfgMsg(null);

    const res = await fetch(`/local/${localId}/api/socio-config`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cfg),
    });

    const data = await res.json().catch(() => null);

    if (res.status === 403) {
      setCfgMsg("No tenés permisos para editar (solo ADMIN).");
      return;
    }

    if (!res.ok || !data?.ok) {
      setCfgMsg(data?.error || "No se pudo guardar");
      return;
    }

    setCfg(data.item as SocioCfg);
    setCfgDirty(false);
    setCfgMsg("Guardado");
    // recargar dashboard para que divida con el nuevo %
    await loadDashboard(mode);
  }

  React.useEffect(() => {
    loadDashboard(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, localId]);

  React.useEffect(() => {
    loadSocioConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localId]);

  const last = rows[rows.length - 1];

  return (
    <div className="space-y-3">
      {/* Config socio (solo ADMIN) */}
      {!cfgLoading && cfgIsAdmin && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-base font-extrabold text-slate-900">Reparto con socio</div>
              <div className="mt-1 text-sm font-medium text-slate-600">
                Se divide solo cuando el acumulado queda positivo (arrastre de pérdidas).
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setCfg((p) => ({ ...p, isEnabled: !p.isEnabled }));
                setCfgDirty(true);
              }}
              className={cn(
                "shrink-0 rounded-xl px-3 py-2 text-xs font-extrabold border",
                cfg.isEnabled ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-900 border-slate-200"
              )}
            >
              {cfg.isEnabled ? "Habilitado" : "Deshabilitado"}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-sm font-extrabold text-slate-900">%</div>

            <input
              type="number"
              min={1}
              max={99}
              value={cfg.pctSocio}
              disabled={!cfg.isEnabled}
              onChange={(e) => {
                const v = parseInt(e.target.value || "0", 10);
                setCfg((p) => ({ ...p, pctSocio: v }));
                setCfgDirty(true);
              }}
              className={cn(
                "w-full rounded-2xl border px-4 py-3 text-base font-extrabold",
                cfg.isEnabled ? "border-slate-200 bg-white text-slate-900" : "border-slate-200 bg-slate-50 text-slate-400"
              )}
              placeholder="50"
            />

            <div className="text-sm font-extrabold text-slate-700">Socio</div>
          </div>

          <div className="text-xs font-semibold text-slate-500">
            Dueño = {cfg.isEnabled ? Math.max(0, 100 - (cfg.pctSocio || 0)) : 100}%.
          </div>

          <button
            type="button"
            disabled={!cfgDirty}
            onClick={saveSocioConfig}
            className={cn(
              "w-full rounded-2xl px-4 py-3 text-base font-extrabold border shadow-sm",
              cfgDirty
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-400"
            )}
          >
            Guardar
          </button>

          {cfgMsg && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-extrabold text-slate-700">
              {cfgMsg}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("week")}
          className={cn(
            "flex-1 rounded-2xl border px-4 py-3 text-sm font-extrabold",
            mode === "week"
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 bg-white text-slate-900"
          )}
        >
          Semana
        </button>
        <button
          onClick={() => setMode("month")}
          className={cn(
            "flex-1 rounded-2xl border px-4 py-3 text-sm font-extrabold",
            mode === "month"
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 bg-white text-slate-900"
          )}
        >
          Mes
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-extrabold text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 shadow-sm">
          Cargando…
        </div>
      ) : (
        <>
          {last ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-extrabold text-slate-900">
                Último período ({last.start} → {last.end})
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-xs font-extrabold text-slate-500">Entradas</div>
                  <div className="text-lg font-extrabold text-slate-900">{last.entradas}</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-xs font-extrabold text-slate-500">Salidas</div>
                  <div className="text-lg font-extrabold text-slate-900">{last.salidas}</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-xs font-extrabold text-slate-500">Resultado</div>
                  <div className="text-lg font-extrabold text-slate-900">{last.resultado}</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-xs font-extrabold text-slate-500">Arrastre</div>
                  <div className="text-lg font-extrabold text-slate-900">{last.arrastreDespues}</div>
                </div>
              </div>

              <div className="mt-2 rounded-xl border border-slate-200 p-3 text-sm">
                <div className="text-xs font-extrabold text-slate-500">Ganancia divisible</div>
                <div className="text-lg font-extrabold text-slate-900">{last.gananciaDivisible}</div>

                {last.pctSocio > 0 ? (
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    Socio: {Math.round(last.parteSocio)} · Dueño: {Math.round(last.parteDueno)} (Socio {Math.round(last.pctSocio * 100)}%)
                  </div>
                ) : (
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    Reparto socio deshabilitado.
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-extrabold text-slate-600">
              Historial (últimos {rows.length})
            </div>

            <div className="divide-y divide-slate-100">
              {rows.slice().reverse().map((r) => (
                <div key={`${r.start}-${r.end}`} className="px-4 py-3">
                  <div className="text-sm font-extrabold text-slate-900">
                    {r.start} → {r.end}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    Entradas {r.entradas} · Salidas {r.salidas} · Resultado {r.resultado} · Arrastre {r.arrastreDespues}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    Divisible {r.gananciaDivisible} · Socio {Math.round(r.parteSocio)} · Dueño {Math.round(r.parteDueno)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
