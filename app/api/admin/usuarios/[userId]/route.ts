import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/src/lib/db";
import { requireAuth } from "@/src/auth/requireAuth";
import { getActiveLocalId } from "@/src/auth/localSession";
import { z } from "zod";
import { IdSchema } from "@/src/domain/zod";

const PatchSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(6).max(200).nullable().optional(),
  localIds: z.array(IdSchema).min(1),
});

async function requireAdminOfActiveLocal(userId: string) {
  const activeLocalId = getActiveLocalId();
  if (!activeLocalId) {
    return { ok: false as const, res: NextResponse.json({ ok: false, error: "Local activo requerido" }, { status: 400 }) };
  }

  const admin = await prisma.userLocal.findFirst({
    where: {
      userId,
      localId: activeLocalId,
      rol: "ADMIN",
      isActive: true,
      local: { isActive: true },
    },
    select: { id: true },
  });

  if (!admin) {
    return { ok: false as const, res: NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 }) };
  }

  return { ok: true as const };
}

export async function PATCH(req: Request, ctx: { params: { userId: string } }) {
  const actor = await requireAuth();

  const gate = await requireAdminOfActiveLocal(actor.id);
  if (!gate.ok) return gate.res;

  const userId = ctx.params.userId;
  const parsedId = IdSchema.safeParse(userId);
  if (!parsedId.success) {
    return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  }

  const { email, password, localIds } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { id: userId } });
  if (!exists) {
    return NextResponse.json({ ok: false, error: "Usuario no encontrado" }, { status: 404 });
  }

  // Si cambia email, que no choque con otro usuario
  const emailOwner = await prisma.user.findUnique({ where: { email } });
  if (emailOwner && emailOwner.id !== userId) {
    return NextResponse.json({ ok: false, error: "El email ya existe" }, { status: 409 });
  }

  const passwordHash = password ? await bcrypt.hash(password, 10) : null;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        email,
        ...(passwordHash ? { passwordHash } : {}),
      },
    });

    // Reemplazar asignaciones: desactivo todas y activo las seleccionadas
    await tx.userLocal.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    // Upsert: por cada localId activo, creo si no existe o reactivo si existe
    for (const localId of localIds) {
      await tx.userLocal.upsert({
        where: { userId_localId: { userId, localId } },
        create: {
          userId,
          localId,
          rol: "OPERATIVO",
          isActive: true,
        },
        update: { isActive: true },
      });
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: { userId: string } }) {
  const actor = await requireAuth();

  const gate = await requireAdminOfActiveLocal(actor.id);
  if (!gate.ok) return gate.res;

  const userId = ctx.params.userId;
  const parsedId = IdSchema.safeParse(userId);
  if (!parsedId.success) {
    return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  }

  // No te dejes borrar a vos mismo (evita quedar afuera)
  if (actor.id === userId) {
    return NextResponse.json({ ok: false, error: "No podés eliminar tu propio usuario" }, { status: 409 });
  }

  const exists = await prisma.user.findUnique({ where: { id: userId } });
  if (!exists) {
    return NextResponse.json({ ok: false, error: "Usuario no encontrado" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    await tx.userLocal.updateMany({
      where: { userId },
      data: { isActive: false },
    });
  });

  return NextResponse.json({ ok: true });
}
