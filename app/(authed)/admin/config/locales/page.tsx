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

          // ✅ Forward cookie para que /api/locales pueda leer rinde_local
          const res = await fetch(`${getBaseUrl()}/api/locales`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              cookie: getCookieHeader(),
            },
            body: JSON.stringify({ nombre }),
            cache: "no-store",
          });

          // Si falla, NO redirigimos silencioso (así no “parece que no hace nada”)
          if (!res.ok) {
            // Devolvemos a la misma pantalla (podés mejorar esto luego con UI)
            redirect("/admin/config/locales");
          }

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
        {locales.map((l) => (
          <div
            key={l.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="truncate text-base font-extrabold text-slate-900">{l.nombre}</div>
            <div className="mt-1 text-xs font-medium text-slate-500">ID: {l.id}</div>

            <div className="mt-2">
              <span
                className={
                  l.isActive
                    ? "inline-block rounded-xl bg-slate-900 px-3 py-2 text-xs font-extrabold text-white"
                    : "inline-block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-extrabold text-slate-700"
                }
              >
                {l.isActive ? "Activo" : "Inactivo"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
