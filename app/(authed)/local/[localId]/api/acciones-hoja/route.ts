import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireLocalContextApi } from "@/app/lib/rinde/requireLocalContext";
import { ensureAccionesHoja } from "./ensure/route";

export async function GET(_: Request, { params }: { params: { localId: string } }) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;

  const { localId, userId } = (gate.ctx as any) ?? {};

  if (userId) {
    const ul = await prisma.userLocal.findFirst({
      where: { userId, localId, isActive: true, local: { isActive: true } },
      select: { rol: true },
    });
    if (!ul) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
  }

  // Asegurar AccionLocal existe antes de consultar
  await ensureAccionesHoja(localId);

  // Query: solo habilitadas y activas
  const accionesLocal = await prisma.accionLocal.findMany({
    where: {
      localId,
      isEnabled: true,
      accion: { isActive: true },
    },
    include: {
      accion: {
        select: {
          id: true,
          nombre: true,
          categoria: true,
          tipoDefault: true,
          impactaTotalDefault: true,
          usaTurno: true,
          usaNombre: true,
        },
      },
    },
    orderBy: [{ orden: "asc" }, { accion: { nombre: "asc" } }],
  });

  const out = accionesLocal
    .map((al) => {
      const accion = al.accion;

      const tipo = (al.tipoOverride ?? accion.tipoDefault) as "ENTRADA" | "SALIDA";
      const impactaTotal = al.impactaTotal;
      const usaTurno = al.usaTurnoOverride ?? accion.usaTurno;
      const usaNombre = al.usaNombreOverride ?? accion.usaNombre;

      return {
        id: accion.id,
        nombre: accion.nombre,
        categoria: accion.categoria,
        tipo,
        impactaTotal,
        usaTurno,
        usaNombre,
        isEnabled: true, // ya filtrado por isEnabled: true
      };
    })
    .filter((x) => x.categoria !== "SOCIO");

  return NextResponse.json({ ok: true, acciones: out });
}
