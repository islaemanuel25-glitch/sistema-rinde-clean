import { requireAuth } from "@/src/auth/requireAuth";
import { getActiveLocalId } from "@/src/auth/localSession";
import { redirect } from "next/navigation";

export default async function AccionesPage({ params }: { params: { localId: string } }) {
  await requireAuth();

  const active = getActiveLocalId();
  if (!active) redirect("/home");

  // Si querés forzar que solo se pueda entrar al local activo:
  if (active !== params.localId) redirect("/home");

  return (
    <main className="space-y-3">
      <div>
        <div className="text-2xl font-extrabold tracking-tight text-slate-900">Acciones</div>
        <div className="mt-1 text-sm font-medium text-slate-600">Configuración de acciones del local</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 shadow-sm">
        Pendiente: listado + alta/edición + orden.
      </div>
    </main>
  );
}
