"use client";

import { useEffect, useState } from "react";

type AccionConfig = {
  accionId: string;
  nombre: string;
  categoria: "TURNO" | "DEPOSITO" | "ELECTRONICO" | "SOCIO" | "OTROS";
  tipoDefault: "ENTRADA" | "SALIDA";
  isEnabled: boolean;
  orden: number;
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Card(props: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn("rounded-2xl border border-slate-200 bg-white p-4", props.className)}
    >
      {props.children}
    </div>
  );
}

async function safeJson(res: Response) {
  const txt = await res.text();
  try {
    return txt ? JSON.parse(txt) : null;
  } catch {
    return null;
  }
}

const CATEGORIAS_ORDER: Array<AccionConfig["categoria"]> = [
  "TURNO",
  "ELECTRONICO",
  "DEPOSITO",
  "OTROS",
];

const CATEGORIA_LABELS: Record<AccionConfig["categoria"], string> = {
  TURNO: "Turnos",
  ELECTRONICO: "Pagos Electrónicos",
  DEPOSITO: "Depósitos",
  OTROS: "Otros",
  SOCIO: "Socios",
};

export default function LocalConfigAccionesClient({ localId }: { localId: string }) {
  // Acciones
  const [loading, setLoading] = useState(true);
  const [acciones, setAcciones] = useState<AccionConfig[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<Set<string>>(new Set());

  // SocioConfig
  const [socioEnabled, setSocioEnabled] = useState(false);
  const [socioPct, setSocioPct] = useState(0); // UI 0..100
  const [socioLoading, setSocioLoading] = useState(true);
  const [socioError, setSocioError] = useState<string | null>(null);
  const [socioSaving, setSocioSaving] = useState(false);

  async function loadAcciones() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/local/${encodeURIComponent(localId)}/api/config-acciones`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await safeJson(res);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? "No se pudieron cargar las acciones");
      }

      setAcciones(data?.acciones ?? []);
    } catch (e: any) {
      setAcciones([]);
      setError(e?.message ?? "Error al cargar acciones");
    } finally {
      setLoading(false);
    }
  }

  async function loadSocioConfig() {
    try {
      setSocioLoading(true);
      setSocioError(null);
      
      const res = await fetch(`/local/${encodeURIComponent(localId)}/api/socio-config`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await safeJson(res);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? "No se pudo cargar la configuración de socio");
      }

      setSocioEnabled(data?.socioConfig?.isEnabled ?? false);
      // backend devuelve 0..1, UI usa 0..100
      setSocioPct((data?.socioConfig?.pctSocio ?? 0) * 100);
      setSocioError(null); // Limpiar error si carga bien
    } catch (e: any) {
      // En caso de error, usar defaults pero seguir mostrando la Card
      setSocioEnabled(false);
      setSocioPct(0);
      setSocioError(e?.message ?? "Error al cargar configuración de socio");
    } finally {
      // Siempre marcar como no loading, incluso si hay error
      setSocioLoading(false);
    }
  }

  async function updateSocioConfig(updates: { isEnabled?: boolean; pctSocio?: number }) {
    setSocioSaving(true);
    setSocioError(null);
    try {
      const res = await fetch(`/local/${encodeURIComponent(localId)}/api/socio-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });

      const data = await safeJson(res);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? "No se pudo actualizar la configuración de socio");
      }

      if (updates.isEnabled !== undefined) setSocioEnabled(updates.isEnabled);
      if (updates.pctSocio !== undefined) setSocioPct(updates.pctSocio);
    } catch (e: any) {
      setSocioError(e?.message ?? "Error al actualizar configuración de socio");
      await loadSocioConfig();
    } finally {
      setSocioSaving(false);
    }
  }

  useEffect(() => {
    loadAcciones();
    loadSocioConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localId]);

  async function toggleAccion(accionId: string, currentEnabled: boolean) {
    const newEnabled = !currentEnabled;
    setUpdating((prev) => new Set(prev).add(accionId));

    try {
      const res = await fetch(`/local/${encodeURIComponent(localId)}/api/config-acciones`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accionId, isEnabled: newEnabled }),
      });

      const data = await safeJson(res);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? "No se pudo actualizar la acción");
      }

      setAcciones((prev) =>
        prev.map((a) => (a.accionId === accionId ? { ...a, isEnabled: newEnabled } : a))
      );
    } catch (e: any) {
      setError(e?.message ?? "Error al actualizar acción");
      await loadAcciones();
    } finally {
      setUpdating((prev) => {
        const next = new Set(prev);
        next.delete(accionId);
        return next;
      });
    }
  }

  // Agrupar por categoría (solo si acciones cargaron)
  const porCategoria = acciones.reduce(
    (acc, accion) => {
      const cat = accion.categoria;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(accion);
      return acc;
    },
    {} as Record<AccionConfig["categoria"], AccionConfig[]>
  );

  for (const cat in porCategoria) {
    porCategoria[cat as AccionConfig["categoria"]].sort((a, b) => {
      if (a.orden !== b.orden) return a.orden - b.orden;
      return a.nombre.localeCompare(b.nombre);
    });
  }

  // Renderizar siempre, incluso si hay errores
  // Card Socio PRIMERO para asegurar que siempre se renderice
  return (
    <div className="space-y-4">
      {/* =========================
          SOCIO (SIEMPRE VISIBLE - RENDERIZAR PRIMERO)
          ========================= */}
      <Card>
        <div className="mb-3 text-sm font-extrabold text-slate-900">Socio</div>

        {socioError && (
          <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
            {socioError}
            <button
              className="mt-2 block rounded-xl border border-rose-300 bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-900"
              onClick={loadSocioConfig}
              disabled={socioLoading || socioSaving}
            >
              Reintentar
            </button>
          </div>
        )}

        {socioLoading ? (
          <div className="text-sm font-semibold text-slate-700">Cargando configuración de socio…</div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-900">Habilitar reparto con socio</div>
                <div className="text-xs text-slate-500">Activa el cálculo de reparto en la Hoja</div>
              </div>

              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={socioEnabled}
                  onChange={(e) => updateSocioConfig({ isEnabled: e.target.checked })}
                  disabled={socioSaving}
                  className="peer sr-only"
                />
                <div
                  className={cn(
                    "h-6 w-11 rounded-full transition-colors",
                    socioEnabled ? "bg-slate-900" : "bg-slate-300",
                    socioSaving && "opacity-50"
                  )}
                >
                  <div
                    className={cn(
                      "h-5 w-5 translate-x-0.5 translate-y-0.5 rounded-full bg-white transition-transform",
                      socioEnabled && "translate-x-5"
                    )}
                  />
                </div>
                {socioSaving && <span className="ml-2 text-xs text-slate-500">…</span>}
              </label>
            </div>

            {socioEnabled && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="mb-2 text-sm font-semibold text-slate-900">Porcentaje socio</div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={socioPct}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!Number.isNaN(val) && val >= 0 && val <= 100) setSocioPct(val);
                    }}
                    onBlur={() => updateSocioConfig({ pctSocio: socioPct })}
                    disabled={socioSaving}
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-base"
                  />
                  <span className="text-sm font-medium text-slate-600">%</span>
                </div>

                <div className="mt-1 text-xs text-slate-500">Rango: 0-100%</div>
              </div>
            )}

            <button
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
              onClick={loadSocioConfig}
              disabled={socioSaving || socioLoading}
            >
              Refrescar socio
            </button>
          </div>
        )}
      </Card>

      {/* =========================
          ACCIONES (NO BLOQUEA SOCIO)
          ========================= */}
      {loading && (
        <Card>
          <div className="text-sm font-semibold text-slate-700">Cargando acciones…</div>
        </Card>
      )}

      {!loading && error && (
        <Card>
          <div className="text-sm font-semibold text-rose-800">{error}</div>
          <button
            className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
            onClick={loadAcciones}
          >
            Reintentar acciones
          </button>
        </Card>
      )}

      {!loading && !error && (
        <>
          {CATEGORIAS_ORDER.map((categoria) => {
            const items = porCategoria[categoria] ?? [];
            if (items.length === 0) return null;

            return (
              <Card key={categoria}>
                <div className="mb-3 text-sm font-extrabold text-slate-900">
                  {CATEGORIA_LABELS[categoria]}
                </div>

                <div className="space-y-2">
                  {items.map((accion) => {
                    const isUpdating = updating.has(accion.accionId);

                    return (
                      <div
                        key={accion.accionId}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-slate-900">{accion.nombre}</div>
                          <div className="text-xs text-slate-500">Tipo: {accion.tipoDefault}</div>
                        </div>

                        <label className="relative inline-flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            checked={accion.isEnabled}
                            onChange={() => toggleAccion(accion.accionId, accion.isEnabled)}
                            disabled={isUpdating}
                            className="peer sr-only"
                          />
                          <div
                            className={cn(
                              "h-6 w-11 rounded-full transition-colors",
                              accion.isEnabled ? "bg-slate-900" : "bg-slate-300",
                              isUpdating && "opacity-50"
                            )}
                          >
                            <div
                              className={cn(
                                "h-5 w-5 translate-x-0.5 translate-y-0.5 rounded-full bg-white transition-transform",
                                accion.isEnabled && "translate-x-5"
                              )}
                            />
                          </div>

                          {isUpdating && <span className="ml-2 text-xs text-slate-500">…</span>}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}

          {/* Categorías no contempladas (por si aparece SOCIO u otra) */}
          {Object.keys(porCategoria)
            .filter((cat) => !CATEGORIAS_ORDER.includes(cat as AccionConfig["categoria"]))
            .map((categoria) => {
              const items = porCategoria[categoria as AccionConfig["categoria"]] ?? [];
              if (items.length === 0) return null;

              return (
                <Card key={categoria}>
                  <div className="mb-3 text-sm font-extrabold text-slate-900">
                    {CATEGORIA_LABELS[categoria as AccionConfig["categoria"]] ?? categoria}
                  </div>

                  <div className="space-y-2">
                    {items.map((accion) => {
                      const isUpdating = updating.has(accion.accionId);

                      return (
                        <div
                          key={accion.accionId}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                        >
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-slate-900">{accion.nombre}</div>
                            <div className="text-xs text-slate-500">Tipo: {accion.tipoDefault}</div>
                          </div>

                          <label className="relative inline-flex cursor-pointer items-center">
                            <input
                              type="checkbox"
                              checked={accion.isEnabled}
                              onChange={() => toggleAccion(accion.accionId, accion.isEnabled)}
                              disabled={isUpdating}
                              className="peer sr-only"
                            />
                            <div
                              className={cn(
                                "h-6 w-11 rounded-full transition-colors",
                                accion.isEnabled ? "bg-slate-900" : "bg-slate-300",
                                isUpdating && "opacity-50"
                              )}
                            >
                              <div
                                className={cn(
                                  "h-5 w-5 translate-x-0.5 translate-y-0.5 rounded-full bg-white transition-transform",
                                  accion.isEnabled && "translate-x-5"
                                )}
                              />
                            </div>

                            {isUpdating && <span className="ml-2 text-xs text-slate-500">…</span>}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
        </>
      )}
    </div>
  );
}
