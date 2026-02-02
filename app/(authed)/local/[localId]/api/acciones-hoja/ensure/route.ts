import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireLocalContextApi } from "@/app/lib/rinde/requireLocalContext";

const BASE_TURNOS = [
  { nombre: "Turno mañana", key: "manana" as const },
  { nombre: "Turno tarde", key: "tarde" as const },
  { nombre: "Turno noche", key: "noche" as const }, // opcional, si no querés borrala
];

export async function POST(_: Request, { params }: { params: { localId: string } }) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;

  const { localId, userId } = (gate.ctx as any) ?? {};

  // Solo ADMIN
  const ul = await prisma.userLocal.findFirst({
    where: { userId, localId, isActive: true, local: { isActive: true } },
    select: { rol: true },
  });
  if (!ul || ul.rol !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
  }

  // Crear acciones si no existen (por nombre único)
  const existing = await prisma.accion.findMany({
    where: { nombre: { in: BASE_TURNOS.map((x) => x.nombre) } },
    select: { id: true, nombre: true },
  });

  const existingByName = new Map(existing.map((a) => [a.nombre, a]));

  const created: Array<{ id: string; nombre: string }> = [];

  for (const t of BASE_TURNOS) {
    if (existingByName.has(t.nombre)) continue;

    const a = await prisma.accion.create({
      data: {
        nombre: t.nombre,
        categoria: "TURNO",
        tipoDefault: "ENTRADA",
        impactaTotalDefault: true,
        usaTurno: false,
        usaNombre: false,
        requierePermisoEspecial: false,
        isActive: true,
      },
      select: { id: true, nombre: true },
    });

    existingByName.set(a.nombre, a);
    created.push(a);
  }

  // Asegurar habilitadas en acciones_local para este local (upsert)
  const ensured: Array<{ accionId: string; nombre: string }> = [];

  for (const t of BASE_TURNOS) {
    const a = existingByName.get(t.nombre);
    if (!a) continue;

    await prisma.accionLocal.upsert({
      where: { localId_accionId: { localId, accionId: a.id } },
      create: { localId, accionId: a.id, isEnabled: true, orden: 0, impactaTotal: true },
      update: { isEnabled: true },
    });

    ensured.push({ accionId: a.id, nombre: a.nombre });
  }

  return NextResponse.json({ ok: true, created, ensured });
}
