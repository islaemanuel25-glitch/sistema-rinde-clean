import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireLocalContextApi } from "@/app/lib/rinde/requireLocalContext";

export async function GET(_: Request, { params }: { params: { localId: string } }) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;

  const { localId, userId } = (gate.ctx as any) ?? {};

  // ✅ Permitir lectura a ADMIN / OPERATIVO / LECTURA
  // (no bloqueamos acá; solo aseguramos que exista el userLocal activo)
  if (userId) {
    const ul = await prisma.userLocal.findFirst({
      where: { userId, localId, isActive: true, local: { isActive: true } },
      select: { rol: true },
    });
    if (!ul) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }
  }

  // Traemos catálogo + override por local, y devolvemos SOLO habilitadas
  const acciones = await prisma.accion.findMany({
    where: { isActive: true },
    orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
    select: {
      id: true,
      nombre: true,
      categoria: true,
      tipoDefault: true,
      impactaTotalDefault: true,
      usaTurno: true,
      usaNombre: true,
      locales: {
        where: { localId },
        select: {
          isEnabled: true,
          tipoOverride: true,
          impactaTotal: true,
          usaTurnoOverride: true,
          usaNombreOverride: true,
        },
      },
    },
  });

  const out = acciones
    .map((a) => {
      const al = a.locales[0] ?? null;

      const tipo = (al?.tipoOverride ?? a.tipoDefault) as "ENTRADA" | "SALIDA";
      const impactaTotal = al?.impactaTotal ?? a.impactaTotalDefault;
      const usaTurno = al?.usaTurnoOverride ?? a.usaTurno;
      const usaNombre = al?.usaNombreOverride ?? a.usaNombre;

      return {
        id: a.id,
        nombre: a.nombre,
        categoria: a.categoria,
        tipo,
        impactaTotal,
        usaTurno,
        usaNombre,
        isEnabled: al?.isEnabled ?? true,
      };
    })
    .filter((x) => x.isEnabled)
    .filter((x) => x.categoria !== "SOCIO"); // defensivo

  return NextResponse.json({ ok: true, acciones: out });
}
