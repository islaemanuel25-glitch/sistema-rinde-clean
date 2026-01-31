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

export default async function AdminConfigUsuariosPage(props: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await requireAuth();
  const activeLocalId = getActiveLocalId();

  if (!activeLocalId) redirect("/home");

  // ADMIN del local activo (mismo patrón que presets/acciones/locales)
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

  const rawError = props.searchParams?.error;
  const error =
    typeof rawError === "string"
      ? rawError
      : Array.isArray(rawError)
      ? rawError[0]
      : null;

  const locales = await prisma.local.findMany({
    where: { isActive: true },
    orderBy: { nombre: "asc" },
  });

  // Listado simple de usuarios (control)
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, email: true, createdAt: true },
  });

  return (
    <main className="mx-auto w-full max-w-md px-3 pb-28 pt-4 space-y-3">
      <div>
        <div className="text-2xl font-extrabold tracking-tight text-slate-900">
          Config · Usuarios
        </div>
        <div className="mt-1 text-sm font-medium text-slate-600">
          Crear usuarios y asignar locales
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800 shadow-sm">
          {decodeURIComponent(error)}
        </div>
      ) : null}

      {/* Crear usuario */}
      <form
        action={async (formData) => {
          "use server";

          const nombre = String(formData.get("nombre") || "").trim();
          const email = String(formData.get("email") || "").trim().toLowerCase();
          const password = String(formData.get("password") || "");
          const localIds = formData.getAll("localIds").map((v) => String(v));

          if (!nombre || !email || !password || localIds.length === 0) {
            redirect("/admin/config/usuarios?error=" + encodeURIComponent("Completá nombre, email, contraseña y al menos 1 local."));
          }

          const res = await fetch(`${getBaseUrl()}/api/admin/usuarios`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              cookie: getCookieHeader(), // ✅ crucial para leer rinde_local en la API
            },
            body: JSON.stringify({ nombre, email, password, localIds }),
            cache: "no-store",
          });

          const data = await res.json().catch(() => null);

          if (!res.ok) {
            const msg = data?.error ?? "No se pudo crear el usuario";
            redirect("/admin/config/usuarios?error=" + encodeURIComponent(msg));
          }

          redirect("/admin/config/usuarios");
        }}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
      >
        <div className="text-sm font-extrabold text-slate-900">Crear usuario</div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate-900">Nombre</label>
          <input
            name="nombre"
            placeholder="Nombre"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate-900">Email</label>
          <input
            name="email"
            inputMode="email"
            autoComplete="email"
            placeholder="tu@email.com"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate-900">Contraseña</label>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium"
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-slate-900">Locales</div>

          <div className="space-y-2">
            {locales.map((l) => (
              <label
                key={l.id}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"
              >
                <input type="checkbox" name="localIds" value={l.id} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold text-slate-900">
                    {l.nombre}
                  </div>
                  <div className="text-xs font-medium text-slate-500">ID: {l.id}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="text-xs font-medium text-slate-500">
            El usuario verá solo los locales asignados.
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-base font-extrabold text-white shadow-sm"
        >
          Crear usuario
        </button>
      </form>

      {/* Listado */}
      <div className="pt-1">
        <div className="mb-2 text-sm font-extrabold text-slate-900">Últimos usuarios</div>
        <div className="space-y-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="truncate text-sm font-extrabold text-slate-900">{u.email}</div>
              <div className="mt-1 text-xs font-medium text-slate-500">ID: {u.id}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
