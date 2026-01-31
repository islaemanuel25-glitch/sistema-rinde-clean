"use client";

import { useEffect, useMemo, useState } from "react";

type Preset = {
  id: string;
  nombre?: string;
  name?: string;
  isActive?: boolean;
};

type PresetItem = {
  id: string;
  label?: string;
  nombre?: string;
  tipo?: string;
  monto?: number;
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

async function safeJson(res: Response) {
  const txt = await res.text();
  try {
    return txt ? JSON.parse(txt) : null;
  } catch {
    return null;
  }
}

function getPresetLabel(p: Preset) {
  return (p.nombre ?? p.name ?? "Sin nombre").trim();
}

export default function PresetsClient({ localId }: { localId: string }) {
  const base = useMemo(
    () => `/local/${encodeURIComponent(localId)}/api/presets`,
    [localId]
  );

  const [loading, setLoading] = useState(true);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [openNew, setOpenNew] = useState(false);
  const [newName, setNewName] = useState("");

  const [openItems, setOpenItems] = useState(false);
  const [activePreset, setActivePreset] = useState<Preset | null>(null);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [items, setItems] = useState<PresetItem[]>([]);
  const [itemsError, setItemsError] = useState<string | null>(null);

  // item modal fields (siempre vacíos al abrir)
  const [itemLabel, setItemLabel] = useState("");
  const [itemTipo, setItemTipo] = useState("");
  const [itemMonto, setItemMonto] = useState("");

  // delete preset UI
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ✅ asegura cookie de local activo (requireLocalContextApi depende de esto)
  async function ensureLocal() {
    const res = await fetch("/api/local/seleccionar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ localId }),
    });

    // si tu route devuelve 204 o algo sin body, safeJson devuelve null y no pasa nada
    const data = await safeJson(res);

    if (!res.ok) {
      // 409 típico: "No podés cambiar de local sin cerrar sesión"
      const msg = data?.error ?? "No se pudo seleccionar el local";
      throw new Error(msg);
    }
  }

  async function loadPresets() {
    setLoading(true);
    setError(null);

    try {
      await ensureLocal();
    } catch (e: any) {
      setError(e?.message ?? "No se pudo seleccionar el local");
      setLoading(false);
      return;
    }

    const res = await fetch(base, { cache: "no-store" });
    const data = await safeJson(res);

    if (!res.ok) {
      setError(data?.error ?? "No se pudieron cargar los presets");
      setLoading(false);
      return;
    }

    // soporta {presets:[...]} o [...]
    const list: Preset[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.presets)
      ? data.presets
      : [];
    setPresets(list);
    setLoading(false);
  }

  async function createPreset() {
    const nombre = newName.trim();
    if (!nombre) return;

    try {
      await ensureLocal();
    } catch (e: any) {
      setError(e?.message ?? "No se pudo seleccionar el local");
      return;
    }

    const res = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    const data = await safeJson(res);

    if (!res.ok) {
      setError(data?.error ?? "No se pudo crear el preset");
      return;
    }

    setOpenNew(false);
    setNewName(""); // vaciar
    await loadPresets();
  }

  async function openPresetItems(p: Preset) {
    setActivePreset(p);
    setOpenItems(true);

    // reset campos (regla)
    setItemLabel("");
    setItemTipo("");
    setItemMonto("");

    await loadItems(p.id);
  }

  async function loadItems(presetId: string) {
    setItemsLoading(true);
    setItemsError(null);

    const res = await fetch(`/local/${encodeURIComponent(localId)}/api/items`, {
      cache: "no-store",
      credentials: "include",
    });

    const data = await safeJson(res);

    if (!res.ok) {
      setItemsError(data?.error ?? "No se pudieron cargar los items");
      setItemsLoading(false);
      return;
    }

    const all: PresetItem[] = Array.isArray(data?.presetItems)
      ? data.presetItems
      : [];

    const filtered = all.filter((it: any) => it.presetId === presetId);

    setItems(filtered);
    setItemsLoading(false);
  }

  async function addItem() {
    if (!activePreset) return;

    const label = itemLabel.trim();
    if (!label) return;

    const montoNum =
      itemMonto.trim() === "" ? undefined : Number(itemMonto.replace(",", "."));

    const payload: any = { label };
    if (itemTipo.trim()) payload.tipo = itemTipo.trim();
    if (montoNum !== undefined && !Number.isNaN(montoNum)) payload.monto = montoNum;

    try {
      await ensureLocal();
    } catch (e: any) {
      setItemsError(e?.message ?? "No se pudo seleccionar el local");
      return;
    }

    const url = `${base}/${encodeURIComponent(activePreset.id)}/items`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await safeJson(res);

    if (!res.ok) {
      setItemsError(data?.error ?? "No se pudo agregar el item");
      return;
    }

    // reset campos (regla)
    setItemLabel("");
    setItemTipo("");
    setItemMonto("");

    await loadItems(activePreset.id);
  }

  function askDeletePreset(p: Preset) {
    setDeleteError(null);
    setConfirmDelete({ id: p.id, label: getPresetLabel(p) });
  }

  async function deletePreset(presetId: string) {
    setDeleteError(null);
    setDeletingId(presetId);

    try {
      await ensureLocal();

      const url = `/api/config/presets/${encodeURIComponent(
        presetId
      )}?localId=${encodeURIComponent(localId)}`;

      const res = await fetch(url, { method: "DELETE" });
      const data = await safeJson(res);

      if (!res.ok) {
        setDeleteError(data?.error ?? "No se pudo eliminar el preset");
        return;
      }

      // sacar de la lista (optimista)
      setPresets((prev) => prev.filter((x) => x.id !== presetId));

      // si estaba abierto, cerrar modal items
      if (activePreset?.id === presetId) {
        setOpenItems(false);
        setActivePreset(null);
        setItems([]);
        setItemsError(null);
        // reset campos (regla)
        setItemLabel("");
        setItemTipo("");
        setItemMonto("");
      }

      setConfirmDelete(null);
    } catch (e: any) {
      setDeleteError(e?.message ?? "Error de red al eliminar el preset");
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    loadPresets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  return (
    <main className="space-y-3">
      {/* Header */}
      <div>
        <div className="text-2xl font-extrabold tracking-tight text-slate-900">
          Presets
        </div>
        <div className="mt-1 text-sm font-medium text-slate-600">
          Armá presets para precargar la hoja del local.
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setNewName(""); // vacío al abrir
            setOpenNew(true);
          }}
          className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-base font-extrabold text-white shadow-sm active:scale-[0.99]"
        >
          Nuevo preset
        </button>

        <button
          onClick={loadPresets}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-extrabold text-slate-900 shadow-sm active:scale-[0.99]"
        >
          Refrescar
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 shadow-sm">
          {error}
        </div>
      ) : null}

      {/* List */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="text-sm font-extrabold text-slate-900">Listado</div>
          <div className="text-xs font-medium text-slate-500">Local: {localId}</div>
        </div>

        <div className="p-2">
          {loading ? (
            <div className="px-2 py-6 text-center text-sm font-semibold text-slate-600">
              Cargando…
            </div>
          ) : presets.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm font-semibold text-slate-600">
              No hay presets todavía.
            </div>
          ) : (
            <div className="space-y-2">
              {presets.map((p) => {
                const label = getPresetLabel(p);
                const isDeleting = deletingId === p.id;

                return (
                  <div
                    key={p.id}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-extrabold text-slate-900">
                          {label}
                        </div>
                        <div className="mt-1 text-xs font-medium text-slate-500">
                          ID: {p.id}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          onClick={() => openPresetItems(p)}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-extrabold text-slate-700 active:scale-[0.99]"
                        >
                          Abrir
                        </button>

                        <button
                          onClick={() => askDeletePreset(p)}
                          disabled={!!deletingId}
                          className={cn(
                            "rounded-xl border px-3 py-2 text-xs font-extrabold active:scale-[0.99]",
                            deletingId
                              ? "border-slate-200 bg-slate-100 text-slate-400"
                              : "border-rose-200 bg-rose-50 text-rose-700"
                          )}
                          title="Eliminar preset"
                        >
                          {isDeleting ? "…" : "Eliminar"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal: New preset */}
      {openNew ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="text-base font-extrabold text-slate-900">Nuevo preset</div>
              <div className="mt-0.5 text-xs font-medium text-slate-500">Nombre del preset</div>
            </div>

            <div className="px-4 py-3 space-y-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej: Semana estándar"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none focus:border-slate-900"
                autoFocus
              />
            </div>

            <div className="flex gap-2 px-4 pb-4">
              <button
                onClick={() => {
                  setOpenNew(false);
                  setNewName(""); // limpiar
                }}
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-extrabold text-slate-900 shadow-sm active:scale-[0.99]"
              >
                Cancelar
              </button>
              <button
                onClick={createPreset}
                className={cn(
                  "flex-1 rounded-2xl px-4 py-3 text-base font-extrabold text-white shadow-sm active:scale-[0.99]",
                  newName.trim() ? "bg-slate-900" : "bg-slate-200 text-slate-700"
                )}
                disabled={!newName.trim()}
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal: Items */}
      {openItems && activePreset ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="text-base font-extrabold text-slate-900">
                {getPresetLabel(activePreset)}
              </div>
              <div className="mt-0.5 text-xs font-medium text-slate-500">Items del preset</div>
            </div>

            <div className="px-4 py-3 space-y-2">
              {itemsError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                  {itemsError}
                </div>
              ) : null}

              {/* Add item */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-sm font-extrabold text-slate-900">Agregar item</div>

                <div className="mt-2 space-y-2">
                  <input
                    value={itemLabel}
                    onChange={(e) => setItemLabel(e.target.value)}
                    placeholder="Nombre / etiqueta (obligatorio)"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none focus:border-slate-900"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={itemTipo}
                      onChange={(e) => setItemTipo(e.target.value)}
                      placeholder="Tipo (opcional)"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none focus:border-slate-900"
                    />
                    <input
                      value={itemMonto}
                      onChange={(e) => setItemMonto(e.target.value)}
                      inputMode="decimal"
                      placeholder="Monto (opcional)"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none focus:border-slate-900"
                    />
                  </div>

                  <button
                    onClick={addItem}
                    disabled={!itemLabel.trim()}
                    className={cn(
                      "w-full rounded-2xl px-4 py-3 text-base font-extrabold shadow-sm active:scale-[0.99]",
                      itemLabel.trim() ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700"
                    )}
                  >
                    Agregar
                  </button>
                </div>
              </div>

              {/* Items list */}
              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="text-sm font-extrabold text-slate-900">Items</div>
                </div>

                <div className="p-3">
                  {itemsLoading ? (
                    <div className="py-6 text-center text-sm font-semibold text-slate-600">
                      Cargando…
                    </div>
                  ) : items.length === 0 ? (
                    <div className="py-6 text-center text-sm font-semibold text-slate-600">
                      Sin items.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {items.map((it) => (
                        <div
                          key={it.id}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                        >
                          <div className="text-sm font-extrabold text-slate-900">
                            {(it.label ?? it.nombre ?? "Item").toString()}
                          </div>
                          <div className="mt-1 text-xs font-medium text-slate-500">
                            {it.tipo ? `Tipo: ${it.tipo} · ` : ""}
                            {typeof it.monto === "number" ? `Monto: ${it.monto}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-4 pb-4">
              <button
                onClick={() => {
                  setOpenItems(false);
                  setActivePreset(null);
                  setItems([]);
                  setItemsError(null);
                  // reset campos (regla)
                  setItemLabel("");
                  setItemTipo("");
                  setItemMonto("");
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-extrabold text-slate-900 shadow-sm active:scale-[0.99]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal: Confirm delete preset */}
      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="text-base font-extrabold text-slate-900">Eliminar preset</div>
              <div className="mt-0.5 text-xs font-medium text-slate-500">
                Se eliminará el preset y sus items.
              </div>
            </div>

            <div className="px-4 py-3 space-y-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-sm font-extrabold text-slate-900 truncate">
                  {confirmDelete.label}
                </div>
                <div className="mt-1 text-xs font-medium text-slate-500">
                  ID: {confirmDelete.id}
                </div>
              </div>

              {deleteError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                  {deleteError}
                </div>
              ) : null}
            </div>

            <div className="flex gap-2 px-4 pb-4">
              <button
                onClick={() => {
                  if (deletingId) return;
                  setConfirmDelete(null);
                  setDeleteError(null);
                }}
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-extrabold text-slate-900 shadow-sm active:scale-[0.99]"
                disabled={!!deletingId}
              >
                Cancelar
              </button>

              <button
                onClick={() => deletePreset(confirmDelete.id)}
                className={cn(
                  "flex-1 rounded-2xl px-4 py-3 text-base font-extrabold text-white shadow-sm active:scale-[0.99]",
                  deletingId === confirmDelete.id ? "bg-rose-300" : "bg-rose-600"
                )}
                disabled={!!deletingId}
              >
                {deletingId === confirmDelete.id ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
