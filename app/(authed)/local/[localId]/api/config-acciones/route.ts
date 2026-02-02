import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireLocalContextApi } from "@/app/lib/rinde/requireLocalContext";
import { ensureAccionesHoja } from "../acciones-hoja/ensure/route";
import { z } from "zod";

const PatchBodySchema = z.object({
  accionId: z.string().min(1),
  isEnabled: z.boolean(),
});

export async function GET(_: Request, { params }: { params: { localId: string } }) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;

  const { localId } = gate.ctx;

  // Llamar ensure antes de consultar
  await ensureAccionesHoja(localId);

  const accionesLocal = await prisma.accionLocal.findMany({
    where: {
      localId,
      accion: { isActive: true },
    },
    include: {
      accion: {
        select: {
          id: true,
          nombre: true,
          categoria: true,
          tipoDefault: true,
        },
      },
    },
    orderBy: [{ orden: "asc" }, { accion: { nombre: "asc" } }],
  });

  const acciones = accionesLocal.map((al) => ({
    accionId: al.accionId,
    nombre: al.accion.nombre,
    categoria: al.accion.categoria,
    tipoDefault: al.accion.tipoDefault,
    isEnabled: al.isEnabled,
    orden: al.orden,
  }));

  return NextResponse.json({ ok: true, acciones });
}

export async function PATCH(
  req: Request,
  { params }: { params: { localId: string } }
) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;

  const { localId, rol } = gate.ctx;

  // Rol LECTURA no puede modificar
  if (rol === "LECTURA") {
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN_ROLE" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { ok: false, error: "INVALID_BODY" },
      { status: 400 }
    );
  }

  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "INVALID_BODY" },
      { status: 400 }
    );
  }

  const { accionId, isEnabled } = parsed.data;

  // Verificar que la acción existe y está activa
  const accion = await prisma.accion.findFirst({
    where: { id: accionId, isActive: true },
    select: { id: true },
  });

  if (!accion) {
    return NextResponse.json(
      { ok: false, error: "ACCION_NOT_FOUND" },
      { status: 404 }
    );
  }

  // Intentar update, si no existe AccionLocal, llamar ensure y reintentar
  try {
    await prisma.accionLocal.update({
      where: { localId_accionId: { localId, accionId } },
      data: { isEnabled },
    });
  } catch (error: any) {
    // Si no existe AccionLocal, llamar ensure y reintentar
    if (error?.code === "P2025") {
      await ensureAccionesHoja(localId);
      await prisma.accionLocal.update({
        where: { localId_accionId: { localId, accionId } },
        data: { isEnabled },
      });
    } else {
      throw error;
    }
  }

  return NextResponse.json({ ok: true });
}

