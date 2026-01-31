import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireAuth } from "@/src/auth/requireAuth";
import { getActiveLocalId } from "@/src/auth/localSession";
import { IdSchema } from "@/src/domain/zod";

export async function POST(
  _req: Request,
  ctx: { params: { userId: string } }
) {
  const actor = await requireAuth();
  const activeLocalId = getActiveLocalId();

  if (!activeLocalId) {
    return NextResponse.json(
      { ok: false, error: "Local activo requerido" },
      { status: 400 }
    );
  }

  const admin = await prisma.userLocal.findFirst({
    where: {
      userId: actor.id,
      localId: activeLocalId,
      rol: "ADMIN",
      isActive: true,
      local: { isActive: true },
    },
  });

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 403 }
    );
  }

  const parsed = IdSchema.safeParse(ctx.params.userId);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "ID inválido" },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: parsed.data },
    data: { isActive: true },
  });

  return NextResponse.json({ ok: true });
}
