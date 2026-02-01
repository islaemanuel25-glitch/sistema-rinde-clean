import { requireAuth } from "@/src/auth/requireAuth";
import { prisma } from "@/src/lib/db";
import { getActiveLocalId } from "@/src/auth/localSession";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  return `${protocol}://${host}`;
}

function getCookieHeader() {
  const h = headers();
  return h.get("cookie") ?? "";
}

export default async function AdminConfigLocalesPage() {
  const user = await requireAuth();
  const activeLocalId = getActiveLocalId();

  if (!activeLocalId) {
    redirect("/home");
  }

  const userLocal = await prisma.userLocal.findFirst({
    where: {
      userId: user.id,
      localId: activeLocalId,
      isActive: true,
      local: { isActive: true },
    },
    select: { rol: true },
  });

  if (!userLocal || userLocal.rol !== "ADMIN") {
    return (
      <main className="mx-auto w-full max-w-md px-3 pb-24 pt-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 shadow-sm">
          No tenés permisos para acceder a esta sección.
        </div>
      </main>
    );
  }

  const locales = await prisma.local.findMany({
    orderBy: { nombre: "asc" },
  });

  return (
    <main className="mx-auto w-full max-w-md px-3 pb-28 pt-4 space-y-3">
      <div>
        <div className="text-2xl font-extrabold tracking-tight text-slate-900">
          Config · Locales
        </div>
        <div className="mt-1 text-sm font-medium text-slate-600">
          Administrar locales del sistema
        </div>
      </div>

      {/* Crear local */}
      <form
        action={async (formData) => {
          "use server";

          const nombre = String(formData.get("nombre") || "").trim();
          if (!nombre) return;

          const res = await fetch(`${getBaseUrl()}/api/locales`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              cookie: getCookieHeader(),
            },
            body: JSON.stringify({ nombre }),
            cache: "no-store",
          });

          redirect("/admin/config/locales");
        }}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="mb-2 text-sm font-extrabold text-slate-900">Crear local</div>

        <div className="flex gap-2">
          <input
            name="nombre"
            placeholder="Nombre del local"
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium"
          />
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-extrabold text-white"
          >
            Crear
          </button>
        </div>
      </form>

      {/* Listado */}
      <div className="space-y-2">
        {locales.map((l) => {
          const isSessionLocal = l.id === activeLocalId;

          return (
            <div
              key={l.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-base font-extrabold text-slate-900">
                      {l.nombre}
                    </div>

                    {isSessionLocal ? (
                      <span className="shrink-0 inline-block rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-extrabold text-slate-700">
                        Activo (sesión)
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-1 text-xs font-medium text-slate-500">ID: {l.id}</div>
                </div>

                <span
                  className={
                    l.isActive
                      ? "shrink-0 inline-block rounded-xl bg-slate-900 px-3 py-2 text-xs font-extrabold text-white"
                      : "shrink-0 inline-block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-extrabold text-slate-700"
                  }
                >
                  {l.isActive ? "Activo" : "Inactivo"}
                </span>
              </div>

              {/* Editar nombre (inline) */}
              <form
                action={async (formData) => {
                  "use server";

                  const localId = String(formData.get("localId") || "");
                  const nombre = String(formData.get("nombre") || "").trim();
                  if (!localId || !nombre) return;

                  await fetch(`${getBaseUrl()}/api/locales`, {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                      cookie: getCookieHeader(),
                    },
                    body: JSON.stringify({ localId, nombre }),
                    cache: "no-store",
                  });

                  redirect("/admin/config/locales");
                }}
                className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <input type="hidden" name="localId" value={l.id} />
                <div className="text-xs font-extrabold text-slate-700 mb-2">
                  Editar nombre
                </div>
                <div className="flex gap-2">
                  <input
                    name="nombre"
                    defaultValue={l.nombre}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-extrabold text-white"
                  >
                    Guardar
                  </button>
                </div>
              </form>

              {/* Activar / Desactivar (soft) */}
              <div className="mt-3 text-xs font-medium text-slate-500">
                Tip: no desactives el local que está en sesión.
              </div>

              {isSessionLocal && l.isActive ? (
                // ✅ No permitir desactivar el local activo (UX)
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-extrabold text-slate-700">
                  Este es el local activo. No se puede desactivar desde acá.
                </div>
              ) : (
                <form
                  action={async (formData) => {
                    "use server";

                    const localId = String(formData.get("localId") || "");
                    const nextIsActive = String(formData.get("nextIsActive") || "");
                    if (
                      !localId ||
                      (nextIsActive !== "true" && nextIsActive !== "false")
                    )
                      return;

                    await fetch(`${getBaseUrl()}/api/locales`, {
                      method: "PATCH",
                      headers: {
                        "Content-Type": "application/json",
                        cookie: getCookieHeader(),
                      },
                      body: JSON.stringify({
                        localId,
                        isActive: nextIsActive === "true",
                      }),
                      cache: "no-store",
                    });

                    redirect("/admin/config/locales");
                  }}
                  className="mt-2"
                >
                  <input type="hidden" name="localId" value={l.id} />
                  <input
                    type="hidden"
                    name="nextIsActive"
                    value={(!l.isActive).toString()}
                  />
                  <button
                    type="submit"
                    className={
                      l.isActive
                        ? "w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-900"
                        : "w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-extrabold text-white"
                    }
                  >
                    {l.isActive ? "Desactivar" : "Activar"}
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
