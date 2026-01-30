import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireLocalContextApi } from "@/app/lib/rinde/requireLocalContext";

function isISODate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });

  const routeLocalId = body.routeLocalId as string | undefined;
  if (!routeLocalId) return NextResponse.json({ error: "MISSING_ROUTE_LOCAL" }, { status: 400 });

  const gate = await requireLocalContextApi(routeLocalId);
  if (!gate.ok) return gate.res;

  const { localId, userId, rol } = gate.ctx;

  // Paso 7: LECTURA no puede escribir
  if (rol === "LECTURA") {
    return NextResponse.json({ error: "FORBIDDEN_ROLE" }, { status: 403 });
  }

  const fecha = body.fecha as string;
  const accionId = body.accionId as string;
  const importe = body.importe as string;
  const turno = body.turno as string | undefined;
  const nombre = body.nombre as string | undefined;
  const socioId = body.socioId as string | undefined;

  if (!fecha || !isISODate(fecha)) return NextResponse.json({ error: "INVALID_FECHA" }, { status: 400 });
  if (!accionId) return NextResponse.json({ error: "MISSING_ACCION" }, { status: 400 });
  if (!importe || Number(importe) <= 0) return NextResponse.json({ error: "INVALID_IMPORTE" }, { status: 400 });

  // Acción habilitada en el local
  const accionLocal = await prisma.acciones_local.findFirst({
    where: { localId, accionId, isEnabled: true },
    select: { id: true },
  });
  if (!accionLocal) return NextResponse.json({ error: "ACCION_NOT_ENABLED" }, { status: 403 });

  const created = await prisma.movimientos.create({
    data: {
      localId,
      userId,
      fecha: new Date(`${fecha}T00:00:00`),
      accionId,
      importe, // string/decimal
      turno: turno ?? null,
      nombre: nombre ?? null,
      socioId: socioId ?? null,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
