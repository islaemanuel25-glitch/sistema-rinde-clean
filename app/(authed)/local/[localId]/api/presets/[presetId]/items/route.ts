import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireLocalContextApi } from "@/app/lib/rinde/requireLocalContext";

export async function GET(
  _: Request,
  { params }: { params: { localId: string; presetId: string } }
) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;
  const { localId } = gate.ctx;

  // Nota: no “valido ownership” fuerte acá porque el preset puede ser GLOBAL (localId null).
  // Igual filtramos para no devolver cosas de otros locales en presets LOCAL.
  const preset = await prisma.preset.findFirst({
    where: {
      id: params.presetId,
      isActive: true,
      OR: [{ scope: "GLOBAL", localId: null }, { scope: "LOCAL", localId }],
    },
    select: { id: true },
  });

  if (!preset) {
    return NextResponse.json({ ok: false, error: "Preset inválido" }, { status: 404 });
  }

  const items = await prisma.presetItem.findMany({
    where: { presetId: params.presetId },
    orderBy: { orden: "asc" },
    select: {
      id: true,
      tipo: true,
      accionId: true,
      categoria: true,
      socioId: true,
      orden: true,
    },
  });

  return NextResponse.json({ ok: true, items });
}
