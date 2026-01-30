import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireAuth } from "@/src/auth/requireAuth";
import { LocalListResponseSchema } from "@/src/domain/zod";

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
