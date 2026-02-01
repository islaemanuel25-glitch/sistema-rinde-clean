import { requireAuth } from "@/src/auth/requireAuth";
import { getActiveLocalId } from "@/src/auth/localSession";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/db";
import AccionesClient from "./AccionesClient";

export default async function AccionesPage({ params }: { params: { localId: string } }) {
  const auth: any = await requireAuth();

  const active = getActiveLocalId();
  if (!active) redirect("/home");
  if (active !== params.localId) redirect("/home");

  const userId: string | undefined = auth?.id ?? auth?.user?.id ?? auth?.userId;
  if (!userId) redirect("/home");

  const ul = await prisma.userLocal.findFirst({
    where: { userId, localId: params.localId, isActive: true, local: { isActive: true } },
    select: { rol: true },
  });

  if (!ul || ul.rol !== "ADMIN") redirect("/home");

  return (
    <main className="space-y-3">
      <div>
        <div className="text-2xl font-extrabold tracking-tight text-slate-900">Acciones</div>
        <div className="mt-1 text-sm font-medium text-slate-600">
          Configuración de acciones del local (solo Admin)
        </div>
      </div>

      <AccionesClient localId={params.localId} />
    </main>
  );
}
