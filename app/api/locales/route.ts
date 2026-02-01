import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireAuth } from "@/src/auth/requireAuth";
import { LocalListResponseSchema } from "@/src/domain/zod";
import { z } from "zod";
import { getActiveLocalId } from "@/src/auth/localSession";
import { IdSchema } from "@/src/domain/zod";

export async function GET() {
  const user = await requireAuth();

  const rows = await prisma.userLocal.findMany({
    where: {
      userId: user.id,
      isActive: true,
      local: { isActive: true },
    },
    include: { local: true },
    orderBy: { local: { nombre: "asc" } },
  });

  const items = rows.map((r) => ({
    id: r.local.id,
    nombre: r.local.nombre,
    isActive: r.local.isActive,
    createdAt: r.local.createdAt.toISOString(),
    updatedAt: r.local.updatedAt.toISOString(),
  }));

  const out = LocalListResponseSchema.parse({ items });
  return NextResponse.json(out);
}

const CreateLocalSchema = z.object({
  nombre: z.string().trim().min(1).max(60),
});

export async function POST(req: Request) {
  const user = await requireAuth();
  const activeLocalId = getActiveLocalId();

  if (!activeLocalId) {
    return NextResponse.json(
      { ok: false, error: "Local activo requerido" },
      { status: 400 }
    );
  }

  const admin = await prisma.userLocal.findFirst({
    where: {
      userId: user.id,
      localId: activeLocalId,
      rol: "ADMIN",
      isActive: true,
      local: { isActive: true },
    },
    select: { id: true },
  });

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Solo ADMIN puede crear locales" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateLocalSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const local = await tx.local.create({
      data: {
        nombre: parsed.data.nombre,
        isActive: true,
      },
    });

    await tx.userLocal.create({
      data: {
        userId: user.id,
        localId: local.id,
        rol: "ADMIN",
        isActive: true,
      },
    });

    return local;
  });

  return NextResponse.json({ ok: true, item: created }, { status: 201 });
}

const PatchLocalSchema = z
  .object({
    localId: IdSchema,
    nombre: z.string().trim().min(1).max(60).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => v.nombre !== undefined || v.isActive !== undefined, {
    message: "No hay cambios para aplicar",
  });

export async function PATCH(req: Request) {
  const user = await requireAuth();
  const activeLocalId = getActiveLocalId();

  if (!activeLocalId) {
    return NextResponse.json(
      { ok: false, error: "Local activo requerido" },
      { status: 400 }
    );
  }

  // Gate ADMIN (mismo criterio que POST)
  const admin = await prisma.userLocal.findFirst({
    where: {
      userId: user.id,
      localId: activeLocalId,
      rol: "ADMIN",
      isActive: true,
      local: { isActive: true },
    },
    select: { id: true },
  });

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Solo ADMIN puede administrar locales" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = PatchLocalSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  }

  const { localId, nombre, isActive } = parsed.data;

  // ✅ Guard rail: no permitir desactivar el local activo
  if (isActive === false && localId === activeLocalId) {
    return NextResponse.json(
      {
        ok: false,
        error: "No podés desactivar el local activo. Cambiá de local primero.",
      },
      { status: 409 }
    );
  }

  const exists = await prisma.local.findUnique({
    where: { id: localId },
    select: { id: true, isActive: true },
  });

  if (!exists) {
    return NextResponse.json({ ok: false, error: "Local no existe" }, { status: 404 });
  }

  // ✅ Update (opcional: si se desactiva, también apagamos UserLocal)
  const updated = await prisma.$transaction(async (tx) => {
    const local = await tx.local.update({
      where: { id: localId },
      data: {
        ...(nombre !== undefined ? { nombre } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    if (isActive === false) {
      await tx.userLocal.updateMany({
        where: { localId },
        data: { isActive: false },
      });
    }

    return local;
  });

  return NextResponse.json(
    {
      ok: true,
      item: {
        id: updated.id,
        nombre: updated.nombre,
        isActive: updated.isActive,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    },
    { status: 200 }
  );
}
