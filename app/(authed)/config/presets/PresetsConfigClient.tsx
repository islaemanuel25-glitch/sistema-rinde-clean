"use client";

import { useEffect, useMemo, useState } from "react";

type ScopePreset = "GLOBAL" | "LOCAL";
type PresetItemTipo = "ACCION" | "CATEGORIA"; // SOCIO eliminado
type CategoriaAccion = "TURNO" | "DEPOSITO" | "ELECTRONICO" | "OTROS"; // SOCIO eliminado

type PresetRow = {
  id: string;
  scope: ScopePreset;
  localId: string | null;
  nombre: string;
  orden: number;
  isActive: boolean;
  updatedAt: string;
};

type PresetItemRow = {
  id: string;
  tipo: PresetItemTipo;
  accionId: string | null;
  categoria: CategoriaAccion | null;
  socioId: string | null;
  orden: number;
};

export default function PresetsConfigClient({
  localId,
  initialPresets,
}: {
  localId: string;
  initialPresets: PresetRow[];
}) {
  const [presets, setPresets] = useState<PresetRow[]>(initialPresets);
  const [selectedId, setSelectedId] = useState<string>(initialPresets[0]?.id ?? "");
  const selected = useMemo(() => presets.find((p) => p.id === selectedId) ?? null, [presets, selectedId]);

  const [loadingItems, setLoadingItems] = useState(false);
  const [items, setItems] = useState<PresetItemRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const [createNombre, setCreateNombre] = useState("");
  const [createOrden, setCreateOrden] = useState<number>(0);

  const [editNombre, setEditNombre] = useState("");
  const [editOrden, setEditOrden] = useState<number>(0);

  // carga items cuando cambia preset seleccionado
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!selectedId) return;
      setMsg(null);
      setLoadingItems(true);
      try {
        const p = presets.find((x) => x.id === selectedId);
        if (!p) return;

        // GLOBAL: usamos endpoint existente read-only
        // LOCAL: usamos endpoint config (editable)
        const url =
          p.scope === "GLOBAL"
            ? `/local/${encodeURIComponent(localId)}/api/presets/${encodeURIComponent(p.id)}/items`
            : `/api/config/presets/${encodeURIComponent(p.id)}/items?localId=${encodeURIComponent(localId)}`;

        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok) {
          throw new Error(data?.error ?? `ERROR_${res.status}`);
        }

        if (!cancelled) {
          setItems((data.items ?? []) as PresetItemRow[]);
        }
      } catch (e: any) {
        if (!cancelled) setMsg(`Error items: ${String(e?.message ?? e)}`);
      } finally {
        if (!cancelled) setLoadingItems(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [selectedId, presets, localId]);

  // sincroniza inputs de edición
  useEffect(() => {
    if (!selected) return;
    setEditNombre(selected.nombre);
    setEditOrden(selected.orden);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshPresets() {
    setMsg(null);
    const res = await fetch(`/api/config/presets?localId=${encodeURIComponent(localId)}`, { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error(data?.error ?? `ERROR_${res.status}`);
    setPresets(data.presets as PresetRow[]);
    if (!selectedId && (data.presets?.[0]?.id ?? "")) setSelectedId(data.presets[0].id);
  }

  async function createPresetLocal() {
    setMsg(null);
    try {
      const nombre = createNombre.trim();
      if (!nombre) {
        setMsg("Falta nombre.");
        return;
      }

      const res = await fetch("/api/config/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localId, nombre, orden: createOrden }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `ERROR_${res.status}`);

      await refreshPresets();
      setCreateNombre("");
      setCreateOrden(0);
      setSelectedId(data.id);
      setMsg("Preset creado.");
    } catch (e: any) {
      setMsg(`Error crear: ${String(e?.message ?? e)}`);
    }
  }

  async function savePresetMeta() {
    if (!selected) return;
    if (selected.scope !== "LOCAL") {
      setMsg("Preset GLOBAL: por ahora solo lectura.");
      return;
    }

    setMsg(null);
    try {
      const res = await fetch(`/api/config/presets/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localId, nombre: editNombre.trim(), orden: editOrden }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `ERROR_${res.status}`);

      await refreshPresets();
      setMsg("Guardado OK.");
    } catch (e: any) {
      setMsg(`Error guardar: ${String(e?.message ?? e)}`);
    }
  }

  async function deletePresetLocal() {
    if (!selected) return;
    if (selected.scope !== "LOCAL") {
      setMsg("Preset GLOBAL: no se puede borrar desde acá.");
      return;
    }

    setMsg(null);
    try {
      const res = await fetch(
        `/api/config/presets/${encodeURIComponent(selected.id)}?localId=${encodeURIComponent(localId)}`,
        { method: "DELETE" }
      );

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `ERROR_${res.status}`);

      await refreshPresets();
      setSelectedId(presets.filter((p) => p.id !== selected.id)[0]?.id ?? "");
      setMsg("Preset desactivado.");
    } catch (e: any) {
      setMsg(`Error borrar: ${String(e?.message ?? e)}`);
    }
  }

  async function addItem(newItem: Omit<PresetItemRow, "id">) {
    if (!selected) return;
    if (selected.scope !== "LOCAL") {
      setMsg("Preset GLOBAL: por ahora solo lectura.");
      return;
    }

    setMsg(null);
    try {
      const res = await fetch(`/api/config/presets/${encodeURIComponent(selected.id)}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localId,
          tipo: newItem.tipo,
          accionId: newItem.accionId ?? undefined,
          categoria: newItem.categoria ?? undefined,
          socioId: newItem.socioId ?? undefined,
          orden: newItem.orden,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `ERROR_${res.status}`);

      // recargar items
      setSelectedId(selected.id); // dispara efecto
      setMsg("Item agregado.");
      // forzar reload items:
      const res2 = await fetch(
        `/api/config/presets/${encodeURIComponent(selected.id)}/items?localId=${encodeURIComponent(localId)}`,
        { cache: "no-store" }
      );
      const data2 = await res2.json().catch(() => null);
      if (res2.ok && data2?.ok) setItems(data2.items ?? []);
    } catch (e: any) {
      setMsg(`Error item: ${String(e?.message ?? e)}`);
    }
  }

  async function patchItem(itemId: string, patch: Partial<PresetItemRow>) {
    if (!selected) return;
    if (selected.scope !== "LOCAL") {
      setMsg("Preset GLOBAL: por ahora solo lectura.");
      return;
    }

    setMsg(null);
    try {
      const res = await fetch(`/api/config/presets/${encodeURIComponent(selected.id)}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localId,
          itemId,
          orden: patch.orden,
          tipo: patch.tipo,
          accionId: patch.accionId,
          categoria: patch.categoria,
          socioId: patch.socioId,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `ERROR_${res.status}`);

      // reflejar en UI
      setItems((prev) =>
        prev
          .map((it) => (it.id === itemId ? { ...it, ...patch } : it))
          .slice()
          .sort((a, b) => a.orden - b.orden)
      );
      setMsg("Item actualizado.");
    } catch (e: any) {
      setMsg(`Error patch item: ${String(e?.message ?? e)}`);
    }
  }

  async function deleteItem(itemId: string) {
    if (!selected) return;
    if (selected.scope !== "LOCAL") {
      setMsg("Preset GLOBAL: por ahora solo lectura.");
      return;
    }

    setMsg(null);
    try {
      const res = await fetch(
        `/api/config/presets/${encodeURIComponent(selected.id)}/items?localId=${encodeURIComponent(localId)}&itemId=${encodeURIComponent(
          itemId
        )}`,
        { method: "DELETE" }
      );

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `ERROR_${res.status}`);

      setItems((prev) => prev.filter((x) => x.id !== itemId));
      setMsg("Item eliminado.");
    } catch (e: any) {
      setMsg(`Error delete item: ${String(e?.message ?? e)}`);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ padding: 12, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12 }}>
        <div style={{ fontWeight: 700 }}>Presets</div>
        <div style={{ opacity: 0.8, marginTop: 6 }}>
          GLOBAL = lectura (por ahora). LOCAL = editable para este local.
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Nuevo preset LOCAL</div>
            <input
              value={createNombre}
              onChange={(e) => setCreateNombre(e.target.value)}
              placeholder="Nombre"
              style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)", minWidth: 220 }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Orden</div>
            <input
              type="number"
              value={createOrden}
              onChange={(e) => setCreateOrden(Number(e.target.value))}
              style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)", width: 120 }}
            />
          </div>

          <button
            onClick={createPresetLocal}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)" }}
          >
            Crear
          </button>

          <button
            onClick={() => refreshPresets().catch((e) => setMsg(String(e?.message ?? e)))}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)" }}
          >
            Recargar
          </button>

          {msg ? <div style={{ opacity: 0.85 }}>{msg}</div> : null}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 12 }}>
        {/* Lista */}
        <div style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.12)", fontWeight: 700 }}>Lista</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {presets.map((p) => {
              const active = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  style={{
                    textAlign: "left",
                    padding: 10,
                    border: "none",
                    borderBottom: "1px solid rgba(0,0,0,0.08)",
                    background: active ? "rgba(0,0,0,0.06)" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{p.nombre}</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>
                    {p.scope} · orden {p.orden}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Editor */}
        <div style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, padding: 12 }}>
          {!selected ? (
            <div style={{ opacity: 0.8 }}>Seleccioná un preset.</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.nombre}</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>
                    scope {selected.scope} · id {selected.id}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={savePresetMeta}
                    disabled={selected.scope !== "LOCAL"}
                    style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)" }}
                  >
                    Guardar
                  </button>
                  <button
                    onClick={deletePresetLocal}
                    disabled={selected.scope !== "LOCAL"}
                    style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)" }}
                  >
                    Desactivar
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>Nombre</span>
                  <input
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    disabled={selected.scope !== "LOCAL"}
                    style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)", minWidth: 260 }}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>Orden</span>
                  <input
                    type="number"
                    value={editOrden}
                    onChange={(e) => setEditOrden(Number(e.target.value))}
                    disabled={selected.scope !== "LOCAL"}
                    style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)", width: 140 }}
                  />
                </label>
              </div>

              <div style={{ marginTop: 14, borderTop: "1px solid rgba(0,0,0,0.12)", paddingTop: 12 }}>
                <div style={{ fontWeight: 700 }}>Items</div>
                <div style={{ opacity: 0.75, marginTop: 6 }}>
                  {selected.scope === "LOCAL"
                    ? "Editable (LOCAL)."
                    : "Read-only (GLOBAL). Para editar global lo habilitamos después."}
                </div>

                <div style={{ marginTop: 10 }}>
                  <AddItemBox
                    disabled={selected.scope !== "LOCAL"}
                    onAdd={(it) => addItem(it)}
                    nextOrden={(items.at(-1)?.orden ?? -1) + 1}
                  />
                </div>

                <div style={{ marginTop: 10 }}>
                  {loadingItems ? (
                    <div style={{ opacity: 0.8 }}>Cargando items...</div>
                  ) : items.length === 0 ? (
                    <div style={{ opacity: 0.8 }}>Sin items.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {items
                        .slice()
                        .sort((a, b) => a.orden - b.orden)
                        .map((it) => (
                          <ItemRow
                            key={it.id}
                            item={it}
                            disabled={selected.scope !== "LOCAL"}
                            onPatch={(patch) => patchItem(it.id, patch)}
                            onDelete={() => deleteItem(it.id)}
                          />
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AddItemBox({
  disabled,
  nextOrden,
  onAdd,
}: {
  disabled: boolean;
  nextOrden: number;
  onAdd: (item: Omit<PresetItemRow, "id">) => void;
}) {
  const [tipo, setTipo] = useState<PresetItemTipo>("ACCION");
  const [accionId, setAccionId] = useState("");
  const [categoria, setCategoria] = useState<CategoriaAccion>("OTROS");
  const [socioId, setSocioId] = useState("");
  const [orden, setOrden] = useState<number>(nextOrden);

  useEffect(() => setOrden(nextOrden), [nextOrden]);

  function add() {
    if (disabled) return;

    if (tipo === "ACCION" && !accionId.trim()) return;

    onAdd({
      tipo,
      accionId: tipo === "ACCION" ? accionId.trim() : null,
      categoria: tipo === "CATEGORIA" ? categoria : null,
      socioId: null, // SOCIO deshabilitado
      orden,
    });

    setAccionId("");
    setTipo("ACCION");
  }

  return (
    <div style={{ padding: 10, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Agregar item</div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.7 }}>Tipo</span>
          <select
            value={tipo}
            disabled={disabled}
            onChange={(e) => setTipo(e.target.value as PresetItemTipo)}
            style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)" }}
          >
            <option value="ACCION">ACCION</option>
            <option value="CATEGORIA">CATEGORIA</option>
          </select>
        </label>

        {tipo === "ACCION" ? (
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>accionId</span>
            <input
              value={accionId}
              disabled={disabled}
              onChange={(e) => setAccionId(e.target.value)}
              placeholder="Pegá accionId"
              style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)", minWidth: 220 }}
            />
          </label>
        ) : null}

        {tipo === "CATEGORIA" ? (
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>categoria</span>
            <select
              value={categoria}
              disabled={disabled}
              onChange={(e) => setCategoria(e.target.value as CategoriaAccion)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)" }}
            >
              <option value="TURNO">TURNO</option>
              <option value="DEPOSITO">DEPOSITO</option>
              <option value="ELECTRONICO">ELECTRONICO</option>
              <option value="OTROS">OTROS</option>
            </select>
          </label>
        ) : null}


        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.7 }}>orden</span>
          <input
            type="number"
            value={orden}
            disabled={disabled}
            onChange={(e) => setOrden(Number(e.target.value))}
            style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)", width: 120 }}
          />
        </label>

        <button
          onClick={add}
          disabled={disabled}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)" }}
        >
          Agregar
        </button>
      </div>

      <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>
        Nota: por ahora para ACCION y SOCIO se pega el ID. Si querés, después hacemos selector lindo.
      </div>
    </div>
  );
}

function ItemRow({
  item,
  disabled,
  onPatch,
  onDelete,
}: {
  item: PresetItemRow;
  disabled: boolean;
  onPatch: (patch: Partial<PresetItemRow>) => void;
  onDelete: () => void;
}) {
  return (
    <div style={{ padding: 10, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontWeight: 700 }}>
          {item.tipo} · orden {item.orden}
        </div>
        <button
          onClick={onDelete}
          disabled={disabled}
          style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)" }}
        >
          Eliminar
        </button>
      </div>

      <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.7 }}>orden</span>
          <input
            type="number"
            value={item.orden}
            disabled={disabled}
            onChange={(e) => onPatch({ orden: Number(e.target.value) })}
            style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.2)", width: 120 }}
          />
        </label>

        <div style={{ opacity: 0.85, fontSize: 12 }}>
          accionId: {item.accionId ?? "-"} · categoria: {item.categoria ?? "-"} · socioId: {item.socioId ?? "-"}
        </div>
      </div>
    </div>
  );
}
