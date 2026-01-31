import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireAuth } from "@/src/auth/requireAuth";
import { prisma } from "@/src/lib/db";
import { getActiveLocalId } from "@/src/auth/localSession";

async function getLocalesForUser(userId: string) {
  const rows = await prisma.userLocal.findMany({
    where: {
      userId,
      isActive: true,
      local: { isActive: true },
    },
    include: { local: true },
    orderBy: { local: { nombre: "asc" } },
  });

  return rows.map((r) => ({
    id: r.local.id,
    nombre: r.local.nombre,
    rol: r.rol, // IMPORTANTE para futuro (ADMIN/OPERATIVO/LECTURA)
  }));
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  return `${protocol}://${host}`;
}

function MenuCard(props: {
  title: string;
  desc: string;
  href?: string;
  disabled?: boolean;
  badge?: string;
}) {
  const disabled = !!props.disabled || !props.href;

  const inner = (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm",
        disabled ? "opacity-50" : "active:scale-[0.99]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-extrabold text-slate-900">{props.title}</div>
          <div className="mt-1 text-sm font-medium text-slate-600">{props.desc}</div>
        </div>
        {props.badge ? (
          <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-extrabold text-slate-700">
            {props.badge}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (disabled) return inner;
  return (
    <a href={props.href} className="block">
      {inner}
    </a>
  );
}

export default async function HomePage() {
  const user = await requireAuth();
  const locales = await getLocalesForUser(user.id);

  const activeLocalId = getActiveLocalId() ?? null;
  const active = activeLocalId ? locales.find((l) => l.id === activeLocalId) ?? null : null;

  if (locales.length === 0) {
    return (
      <main className="mx-auto w-full max-w-md px-3 pb-24 pt-4">
        <div className="mb-3">
          <div className="text-2xl font-extrabold tracking-tight text-slate-900">Home</div>
          <div className="mt-1 text-sm font-medium text-slate-600">No tenés locales asignados</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 shadow-sm">
          Pedile al administrador que te asigne un local.
        </div>

        <form
          action={async () => {
            "use server";
            await fetch(`${getBaseUrl()}/api/auth`, { method: "DELETE", cache: "no-store" });
            redirect("/login");
          }}
          className="mt-4"
        >
          <button
            type="submit"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-extrabold text-slate-900 shadow-sm"
          >
            Cerrar sesión
          </button>
        </form>
      </main>
    );
  }

  const needPickLocal = !active;

  return (
    <main className="mx-auto w-full max-w-md px-3 pb-28 pt-4 space-y-3">
      {/* Header */}
      <div>
        <div className="text-2xl font-extrabold tracking-tight text-slate-900">Sistema Rinde</div>
        <div className="mt-1 text-sm font-medium text-slate-600">
          {active ? `Local activo: ${active.nombre}` : "Elegí un local para habilitar el menú"}
        </div>
      </div>

      {/* Selector de local (siempre) */}
      <div className="space-y-2">
        {locales.map((l) => {
          const isActive = activeLocalId === l.id;

          return (
            <a
              key={l.id}
              href={`/api/local/seleccionar?localId=${encodeURIComponent(l.id)}&next=${encodeURIComponent("/home")}`}
              className={cn(
                "block rounded-2xl border bg-white p-4 shadow-sm active:scale-[0.99]",
                isActive ? "border-slate-900" : "border-slate-200"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-base font-extrabold text-slate-900">{l.nombre}</div>
                  <div className="mt-1 text-xs font-medium text-slate-500">ID: {l.id}</div>
                </div>

                <div
                  className={cn(
                    "shrink-0 rounded-xl px-3 py-2 text-xs font-extrabold",
                    isActive ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-700 border border-slate-200"
                  )}
                >
                  {isActive ? "Activo" : "Usar"}
                </div>
              </div>
            </a>
          );
        })}
      </div>

      {/* Menú */}
      <div className="pt-1">
        <div className="mb-2 text-sm font-extrabold text-slate-900">Menú</div>

        <div className="space-y-2">
          <MenuCard
            title="Hoja"
            desc="Cargar y ver movimientos (día/semana/mes)."
            href={active ? `/local/${active.id}` : undefined}
            disabled={needPickLocal}
            badge="Operación"
          />

          <MenuCard
            title="Acciones"
            desc="Configurar acciones habilitadas, orden, overrides."
            href={active ? `/local/${active.id}/acciones` : undefined}
            disabled={needPickLocal}
            badge="Config"
          />

          <MenuCard
            title="Presets"
            desc="Armar presets por local para precargar la hoja."
            href={active ? `/local/${active.id}/presets` : undefined}
            disabled={needPickLocal}
            badge="Config"
          />

          <MenuCard
            title="Socios"
            desc="Administrar socios del local (para movimientos SOCIO)."
            href={active ? `/local/${active.id}/socios` : undefined}
            disabled={needPickLocal}
            badge="Config"
          />

          {active?.rol === "ADMIN" && (
            <MenuCard
              title="Locales"
              desc="Administrar locales del sistema."
              href="/admin/config/locales"
              badge="Config"
            />
          )}

          {active?.rol === "ADMIN" && (
            <MenuCard
              title="Usuarios"
              desc="Crear usuarios y asignar locales."
              href="/admin/config/usuarios"
              badge="Config"
            />
          )}
        </div>

        {needPickLocal && (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">
            Elegí un local arriba para habilitar el menú.
          </div>
        )}
      </div>

      {/* Logout (bottom sticky) */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/90 backdrop-blur safe-bottom">
        <div className="mx-auto w-full max-w-md px-3 py-3">
          <form
            action={async () => {
              "use server";
              await fetch(`${getBaseUrl()}/api/auth`, { method: "DELETE", cache: "no-store" });
              redirect("/login");
            }}
          >
            <button
              type="submit"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-extrabold text-slate-900 shadow-sm"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
