import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireAuth } from "@/src/auth/requireAuth";
import { LocalListResponseSchema } from "@/src/domain/zod";
import { z } from "zod";
import { getActiveLocalId } from "@/src/auth/localSession";

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
  nombre: z.string().min(1).max(60),
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
    return NextResponse.json(
      { ok: false, error: "Datos inválidos" },
      { status: 400 }
    );
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
