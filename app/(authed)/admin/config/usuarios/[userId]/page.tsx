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

export default async function AdminUsuarioEditPage(props: {
  params: { userId: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const actor = await requireAuth();
  const activeLocalId = getActiveLocalId();
  if (!activeLocalId) redirect("/home");

  const actorLocal = await prisma.userLocal.findFirst({
    where: {
      userId: actor.id,
      localId: activeLocalId,
      isActive: true,
      local: { isActive: true },
    },
    select: { rol: true },
  });

  if (!actorLocal || actorLocal.rol !== "ADMIN") {
    return (
      <main className="mx-auto w-full max-w-md px-3 pb-24 pt-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 shadow-sm">
          No tenés permisos para acceder a esta sección.
        </div>
      </main>
    );
  }

  const userId = props.params.userId;

  const rawError = props.searchParams?.error;
  const error =
    typeof rawError === "string"
      ? rawError
      : Array.isArray(rawError)
      ? rawError[0]
      : null;

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, isActive: true, createdAt: true },
  });

  if (!target) {
    redirect("/admin/config/usuarios?error=" + encodeURIComponent("Usuario no encontrado"));
  }

  const locales = await prisma.local.findMany({
    where: { isActive: true },
    orderBy: { nombre: "asc" },
  });

  const assigned = await prisma.userLocal.findMany({
    where: { userId: userId, isActive: true, local: { isActive: true } },
    select: { localId: true, rol: true },
  });

  const assignedSet = new Set(assigned.map((a) => a.localId));

  return (
    <main className="mx-auto w-full max-w-md px-3 pb-28 pt-4 space-y-3">
      <div>
        <div className="text-2xl font-extrabold tracking-tight text-slate-900">Editar usuario</div>
        <div className="mt-1 text-sm font-medium text-slate-600">{target.email}</div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800 shadow-sm">
          {decodeURIComponent(error)}
        </div>
      ) : null}

      {/* Guardar cambios */}
      <form
        action={async (formData) => {
          "use server";

          const email = String(formData.get("email") || "").trim().toLowerCase();
          const password = String(formData.get("password") || "");
          const localIds = formData.getAll("localIds").map((v) => String(v));

          const res = await fetch(`${getBaseUrl()}/api/admin/usuarios/${encodeURIComponent(userId)}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              cookie: getCookieHeader(),
            },
            body: JSON.stringify({
              email,
              password: password ? password : null,
              localIds,
            }),
            cache: "no-store",
          });

          const data = await res.json().catch(() => null);

          if (!res.ok) {
            const msg = data?.error ?? "No se pudo guardar";
            redirect(
              `/admin/config/usuarios/${encodeURIComponent(userId)}?error=` + encodeURIComponent(msg)
            );
          }

          redirect(`/admin/config/usuarios/${encodeURIComponent(userId)}`);
        }}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
      >
        <div className="text-sm font-extrabold text-slate-900">Datos</div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate-900">Email</label>
          <input
            name="email"
            defaultValue={target.email}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-slate-900">Resetear contraseña</label>
          <input
            name="password"
            type="password"
            placeholder="(dejar vacío para no cambiar)"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium"
          />
          <div className="text-xs font-medium text-slate-500">
            Si cargás una contraseña nueva, debe tener al menos 6 caracteres.
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-slate-900">Locales asignados</div>
          <div className="space-y-2">
            {locales.map((l) => (
              <label
                key={l.id}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"
              >
                <input
                  type="checkbox"
                  name="localIds"
                  value={l.id}
                  defaultChecked={assignedSet.has(l.id)}
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold text-slate-900">{l.nombre}</div>
                  <div className="text-xs font-medium text-slate-500">ID: {l.id}</div>
                </div>
              </label>
            ))}
          </div>
          <div className="text-xs font-medium text-slate-500">
            Si le dejás 1 solo local, solo entra a ese. Si tiene varios, podrá elegir en Home.
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-base font-extrabold text-white shadow-sm"
        >
          Guardar cambios
        </button>
      </form>

      {/* Eliminar (baja lógica) */}
      <form
        action={async () => {
          "use server";

          const res = await fetch(`${getBaseUrl()}/api/admin/usuarios/${encodeURIComponent(userId)}`, {
            method: "DELETE",
            headers: { cookie: getCookieHeader() },
            cache: "no-store",
          });

          const data = await res.json().catch(() => null);
          if (!res.ok) {
            const msg = data?.error ?? "No se pudo eliminar";
            redirect(
              `/admin/config/usuarios/${encodeURIComponent(userId)}?error=` + encodeURIComponent(msg)
            );
          }

          redirect("/admin/config/usuarios");
        }}
        className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm"
      >
        <div className="text-sm font-extrabold text-rose-900">Eliminar usuario</div>
        <div className="mt-1 text-xs font-medium text-rose-800">
          Esto desactiva el usuario (no borra historial).
        </div>

        <button
          type="submit"
          className="mt-3 w-full rounded-2xl bg-rose-700 px-4 py-3 text-base font-extrabold text-white shadow-sm"
        >
          Eliminar
        </button>
      </form>

      <a
        href="/admin/config/usuarios"
        className="block text-center text-sm font-extrabold text-slate-900"
      >
        Volver
      </a>
    </main>
  );
}
