import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireLocalContextApi } from "@/app/lib/rinde/requireLocalContext";

const ACCIONES_GLOBALES = [
  {
    nombre: "Turno noche",
    categoria: "TURNO" as const,
    tipoDefault: "ENTRADA" as const,
    usaTurno: false,
    usaNombre: false,
    impactaTotalDefault: true,
  },
  {
    nombre: "Turno mañana",
    categoria: "TURNO" as const,
    tipoDefault: "ENTRADA" as const,
    usaTurno: false,
    usaNombre: false,
    impactaTotalDefault: true,
  },
  {
    nombre: "Turno tarde",
    categoria: "TURNO" as const,
    tipoDefault: "ENTRADA" as const,
    usaTurno: false,
    usaNombre: false,
    impactaTotalDefault: true,
  },
  {
    nombre: "Pagos electrónicos",
    categoria: "ELECTRONICO" as const,
    tipoDefault: "ENTRADA" as const,
    usaTurno: false,
    usaNombre: false,
    impactaTotalDefault: true,
  },
  {
    nombre: "Pago depósito",
    categoria: "DEPOSITO" as const,
    tipoDefault: "SALIDA" as const,
    usaTurno: false,
    usaNombre: false,
    impactaTotalDefault: true,
  },
  {
    nombre: "Pagos virtuales",
    categoria: "OTROS" as const,
    tipoDefault: "SALIDA" as const,
    usaTurno: false,
    usaNombre: false,
    impactaTotalDefault: true,
  },
  {
    nombre: "Pago Eva/David",
    categoria: "OTROS" as const,
    tipoDefault: "SALIDA" as const,
    usaTurno: false,
    usaNombre: false,
    impactaTotalDefault: true,
  },
];

/**
 * Función reutilizable para asegurar catálogo global + AccionLocal por local
 * Idempotente: puede llamarse múltiples veces sin duplicar ni romper
 */
export async function ensureAccionesHoja(localId: string) {
  // Upsert acciones globales por nombre único
  for (const accionData of ACCIONES_GLOBALES) {
    await prisma.accion.upsert({
      where: { nombre: accionData.nombre },
      create: {
        nombre: accionData.nombre,
        categoria: accionData.categoria,
        tipoDefault: accionData.tipoDefault,
        impactaTotalDefault: accionData.impactaTotalDefault,
        usaTurno: accionData.usaTurno,
        usaNombre: accionData.usaNombre,
        requierePermisoEspecial: false,
        isActive: true,
      },
      update: {
        // No actualizar si ya existe (mantener valores existentes)
      },
    });
  }

  // Asegurar AccionLocal para TODAS las acciones activas del catálogo global
  const todasAcciones = await prisma.accion.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  for (const accion of todasAcciones) {
    await prisma.accionLocal.upsert({
      where: { localId_accionId: { localId, accionId: accion.id } },
      create: {
        localId,
        accionId: accion.id,
        isEnabled: true,
        orden: 0,
        impactaTotal: true,
      },
      update: {
        // No tocar overrides, no tocar orden si ya existe
      },
    });
  }
}

export async function POST(_: Request, { params }: { params: { localId: string } }) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;

  const { localId } = gate.ctx;

  await ensureAccionesHoja(localId);

  return NextResponse.json({ ok: true });
}

export async function GET(_: Request, { params }: { params: { localId: string } }) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;

  const { localId } = gate.ctx;

  await ensureAccionesHoja(localId);

  return NextResponse.json({ ok: true });
}
