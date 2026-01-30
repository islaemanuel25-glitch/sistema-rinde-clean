import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireLocalContextApi } from "@/app/lib/rinde/requireLocalContext";

export async function GET(_: Request, { params }: { params: { localId: string } }) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;
  const { localId } = gate.ctx;

  const rows = await prisma.accionLocal.findMany({
    where: { localId, isEnabled: true, accion: { isActive: true } },
    orderBy: [{ orden: "asc" }, { updatedAt: "desc" }],
    select: {
      accionId: true,
      isEnabled: true,
      tipoOverride: true,
      impactaTotal: true,
      usaTurnoOverride: true,
      usaNombreOverride: true,
      accion: {
        select: {
          nombre: true,
          tipoDefault: true,
          impactaTotalDefault: true,
          usaTurno: true,
          usaNombre: true,
          categoria: true,
        },
      },
    },
  });

  const acciones = rows.map((r) => {
    const tipo = r.tipoOverride ?? r.accion.tipoDefault;
    const usaTurno = r.usaTurnoOverride ?? r.accion.usaTurno;
    const usaNombre = r.usaNombreOverride ?? r.accion.usaNombre;

    // Para impactaTotal, en tu modelo AccionLocal.impactaTotal es boolean (no null)
    // y existe siempre: manda el override del local.
    const impactaTotal = r.impactaTotal;

    return {
      id: r.accionId,
      nombre: r.accion.nombre,
      tipo, // ENTRADA/SALIDA
      categoria: r.accion.categoria, // TURNO/DEPOSITO/ELECTRONICO/SOCIO/OTROS
      usaTurno,
      usaNombre,
      impactaTotal,
      impactaTotalDefault: r.accion.impactaTotalDefault,
    };
  });

  return NextResponse.json({ ok: true, acciones });
}
