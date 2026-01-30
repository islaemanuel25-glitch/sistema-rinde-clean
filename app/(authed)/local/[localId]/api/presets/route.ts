import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireLocalContextApi } from "@/app/lib/rinde/requireLocalContext";

export async function GET(_: Request, { params }: { params: { localId: string } }) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;
  const { localId } = gate.ctx;

  const presets = await prisma.preset.findMany({
    where: {
      isActive: true,
      OR: [
        { scope: "LOCAL", localId },
        { scope: "GLOBAL" },
      ],
    },
    orderBy: [{ scope: "desc" }, { orden: "asc" }, { nombre: "asc" }],
    select: { id: true, nombre: true, scope: true },
  });

  return NextResponse.json({ ok: true, presets });
}
