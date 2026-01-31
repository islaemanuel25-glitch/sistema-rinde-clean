import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/src/lib/db";
import { requireAuth } from "@/src/auth/requireAuth";
import { getActiveLocalId } from "@/src/auth/localSession";
import { z } from "zod";
import { IdSchema } from "@/src/domain/zod";

const BodySchema = z.object({
  nombre: z.string().min(1).max(80),
  email: z.string().email().max(200),
  password: z.string().min(6).max(200),
  localIds: z.array(IdSchema).min(1),
});

export async function POST(req: Request) {
  const actor = await requireAuth();
  const activeLocalId = getActiveLocalId();

  if (!activeLocalId) {
    return NextResponse.json(
      { ok: false, error: "Local activo requerido" },
      { status: 400 }
    );
  }

  // ADMIN del local activo
  const admin = await prisma.userLocal.findFirst({
    where: {
      userId: actor.id,
      localId: activeLocalId,
      rol: "ADMIN",
      isActive: true,
      local: { isActive: true },
    },
    select: { id: true },
  });

  if (!admin) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  }

  const { email, password, localIds } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ ok: false, error: "El email ya existe" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        passwordHash,
        isActive: true,
      },
      select: { id: true, email: true, isActive: true, createdAt: true },
    });

    await tx.userLocal.createMany({
      data: localIds.map((localId) => ({
        userId: created.id,
        localId,
        rol: "OPERATIVO",
        isActive: true,
      })),
      skipDuplicates: true,
    });

    return created;
  });

  return NextResponse.json({ ok: true, item: user }, { status: 201 });
}
