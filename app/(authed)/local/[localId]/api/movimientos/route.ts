import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/src/lib/db";
import { requireLocalContextApi } from "@/app/lib/rinde/requireLocalContext";

const BodySchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  accionId: z.string().min(1),
  importe: z.string().min(1), // lo validamos abajo como > 0
  turno: z.enum(["MANIANA", "TARDE", "NOCHE"]).optional(),
  nombre: z.string().optional(),
  socioId: z.string().optional(),
});

function isPositiveDecimalString(v: string) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

export async function POST(req: Request, { params }: { params: { localId: string } }) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;

  const { localId, userId, rol } = gate.ctx;

  // Paso 7: LECTURA no puede escribir
  if (rol === "LECTURA") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN_ROLE" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  }

  const { fecha, accionId, importe, turno, nombre, socioId } = parsed.data;

  if (!isPositiveDecimalString(importe)) {
    return NextResponse.json({ ok: false, error: "Importe inválido" }, { status: 400 });
  }

  // Acción habilitada en el local + acción activa
  const accionLocal = await prisma.accionLocal.findFirst({
    where: { localId, accionId, isEnabled: true, accion: { isActive: true } },
    select: {
      accionId: true,
      tipoOverride: true,
      impactaTotal: true,
      usaTurnoOverride: true,
      usaNombreOverride: true,
      accion: {
        select: {
          tipoDefault: true,
          usaTurno: true,
          usaNombre: true,
          categoria: true,
        },
      },
    },
  });

  if (!accionLocal) {
    return NextResponse.json({ ok: false, error: "Acción no habilitada en este local" }, { status: 403 });
  }

  // Tipo real del movimiento (obligatorio en Movimiento.tipo)
  const tipo = accionLocal.tipoOverride ?? accionLocal.accion.tipoDefault;

  // Reglas de campos condicionales
  const usaTurno = accionLocal.usaTurnoOverride ?? accionLocal.accion.usaTurno;
  const usaNombre = accionLocal.usaNombreOverride ?? accionLocal.accion.usaNombre;
  const categoria = accionLocal.accion.categoria; // SOCIO etc

  if (usaTurno && !turno) {
    return NextResponse.json({ ok: false, error: "Falta turno" }, { status: 400 });
  }
  if (!usaTurno && turno) {
    return NextResponse.json({ ok: false, error: "Turno no corresponde a esta acción" }, { status: 400 });
  }

  if (usaNombre && (!nombre || !nombre.trim())) {
    return NextResponse.json({ ok: false, error: "Falta nombre" }, { status: 400 });
  }

  if (categoria === "SOCIO") {
    if (!socioId) {
      return NextResponse.json({ ok: false, error: "Falta socio" }, { status: 400 });
    }
    const socioOk = await prisma.socio.findFirst({
      where: { id: socioId, localId, isActive: true },
      select: { id: true },
    });
    if (!socioOk) {
      return NextResponse.json({ ok: false, error: "Socio inválido" }, { status: 400 });
    }
  }

  const created = await prisma.movimiento.create({
    data: {
      localId,
      fecha: new Date(`${fecha}T00:00:00`),
      accionId,
      tipo,
      importe, // Decimal: Prisma acepta string
      turno: usaTurno ? turno! : null,
      nombre: usaNombre ? (nombre?.trim() ?? null) : null,
      socioId: categoria === "SOCIO" ? socioId! : null,
      createdByUserId: userId,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
