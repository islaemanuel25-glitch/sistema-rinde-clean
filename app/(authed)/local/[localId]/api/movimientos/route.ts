import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/src/lib/db";
import { requireLocalContextApi } from "@/app/lib/rinde/requireLocalContext";

const BodySchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  accionId: z.string().min(1),
  importe: z.string().min(1),
  turno: z.enum(["MANIANA", "TARDE", "NOCHE"]).optional(),
  nombre: z.string().optional(),
  socioId: z.string().optional(),
});

/**
 * Acepta:
 *  - 15000
 *  - 15000,50
 *  - 15.000,50
 *  - 15000.50
 *
 * Rechaza:
 *  - 1e5
 *  - +10 / -10
 *  - letras
 */
function isPositiveDecimalString(v: string) {
  const s = v
    .trim()
    .replace(/\./g, "") // elimina separadores de miles
    .replace(",", "."); // normaliza decimal

  if (!/^\d+(\.\d{1,2})?$/.test(s)) return false;

  const n = Number(s);
  return Number.isFinite(n) && n > 0;
}

export async function POST(
  req: Request,
  { params }: { params: { localId: string } }
) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;

  const { localId, userId, rol } = gate.ctx;

  // Rol LECTURA no puede cargar
  if (rol === "LECTURA") {
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN_ROLE" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Datos inválidos" },
      { status: 400 }
    );
  }

  const { fecha, accionId, importe, turno, nombre: nombreRaw } = parsed.data;

  if (!isPositiveDecimalString(importe)) {
    return NextResponse.json(
      { ok: false, error: "Importe inválido" },
      { status: 400 }
    );
  }

  // Normalizamos importe para guardar (string decimal con punto)
  const importeFinal = importe
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");

  // Acción habilitada en el local
  const accionLocal = await prisma.accionLocal.findFirst({
    where: {
      localId,
      accionId,
      isEnabled: true,
      accion: { isActive: true },
    },
    select: {
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
    return NextResponse.json(
      { ok: false, error: "Acción no habilitada en este local" },
      { status: 403 }
    );
  }

  // Bloquear SOCIO
  if (accionLocal.accion.categoria === "SOCIO") {
    return NextResponse.json(
      { ok: false, error: "SOCIO_DISABLED" },
      { status: 403 }
    );
  }

  const tipo =
    accionLocal.tipoOverride ?? accionLocal.accion.tipoDefault;

  const usaTurno =
    accionLocal.usaTurnoOverride ?? accionLocal.accion.usaTurno;

  const usaNombre =
    accionLocal.usaNombreOverride ?? accionLocal.accion.usaNombre;

  if (usaTurno && !turno) {
    return NextResponse.json(
      { ok: false, error: "Falta turno" },
      { status: 400 }
    );
  }

  if (!usaTurno && turno) {
    return NextResponse.json(
      { ok: false, error: "Turno no corresponde" },
      { status: 400 }
    );
  }

  const nombre = nombreRaw?.trim() ?? null;

  if (usaNombre && !nombre) {
    return NextResponse.json(
      { ok: false, error: "Falta nombre" },
      { status: 400 }
    );
  }

  const created = await prisma.movimiento.create({
    data: {
      localId,
      fecha: new Date(`${fecha}T00:00:00`),
      accionId,
      tipo,
      importe: importeFinal,
      turno: usaTurno ? turno! : null,
      nombre: usaNombre ? nombre : null,
      socioId: null,
      createdByUserId: userId,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}

export async function DELETE(
  req: Request,
  { params }: { params: { localId: string } }
) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;

  const { localId, rol } = gate.ctx;

  // Rol LECTURA no puede borrar
  if (rol === "LECTURA") {
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN_ROLE" },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const fecha = url.searchParams.get("fecha");
  const id = url.searchParams.get("id");

  // Modo A: Vaciar día completo
  if (fecha) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return NextResponse.json(
        { ok: false, error: "Fecha inválida" },
        { status: 400 }
      );
    }

    const start = new Date(`${fecha}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const result = await prisma.movimiento.deleteMany({
      where: {
        localId,
        fecha: {
          gte: start,
          lt: end,
        },
      },
    });

    return NextResponse.json({ ok: true, count: result.count });
  }

  // Modo B: Borrar por ID
  if (id) {
    const movimiento = await prisma.movimiento.findFirst({
      where: {
        id,
        localId,
      },
      select: { id: true },
    });

    if (!movimiento) {
      return NextResponse.json(
        { ok: false, error: "Movimiento no encontrado" },
        { status: 404 }
      );
    }

    await prisma.movimiento.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { ok: false, error: "Falta fecha o id" },
    { status: 400 }
  );
}
