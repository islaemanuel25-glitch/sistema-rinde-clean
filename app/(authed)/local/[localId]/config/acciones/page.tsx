import { requireAuth } from "@/src/auth/requireAuth";
import { getActiveLocalId } from "@/src/auth/localSession";
import { redirect } from "next/navigation";
import LocalConfigAccionesClient from "./LocalConfigAccionesClient";

export default async function ConfigAccionesPage({
  params,
}: {
  params: { localId: string };
}) {
  const auth: any = await requireAuth();

  const active = getActiveLocalId();
  if (!active) redirect("/home");
  if (active !== params.localId) redirect("/home");

  const userId: string | undefined = auth?.id ?? auth?.user?.id ?? auth?.userId;
  if (!userId) redirect("/home");

  return (
    <main className="space-y-3">
      <div>
        <div className="text-2xl font-extrabold tracking-tight text-slate-900">
          Configurar Acciones
        </div>
        <div className="mt-1 text-sm font-medium text-slate-600">
          Habilitar o deshabilitar acciones para este local
        </div>
      </div>

      <LocalConfigAccionesClient localId={params.localId} />
    </main>
  );
}

