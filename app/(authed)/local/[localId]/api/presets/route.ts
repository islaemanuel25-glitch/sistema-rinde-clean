import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireLocalContextApi } from "@/app/lib/rinde/requireLocalContext";
import { z } from "zod";

const CreatePresetSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre requerido").max(80),
  // si querés permitir orden manual desde UI, descomentá:
  // orden: z.number().int().min(0).optional(),
});

export async function GET(_: Request, { params }: { params: { localId: string } }) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;
  const { localId } = gate.ctx;

  const presets = await prisma.preset.findMany({
    where: {
      isActive: true,
      OR: [{ scope: "LOCAL", localId }, { scope: "GLOBAL" }],
    },
    orderBy: [{ scope: "desc" }, { orden: "asc" }, { nombre: "asc" }],
    select: { id: true, nombre: true, scope: true },
  });

  return NextResponse.json({ ok: true, presets });
}

export async function POST(req: Request, { params }: { params: { localId: string } }) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;
  const { localId } = gate.ctx;

  const body = await req.json().catch(() => null);
  const parsed = CreatePresetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Body inválido" },
      { status: 400 }
    );
  }

  // Orden automático al final (solo para presets LOCAL del local)
  const last = await prisma.preset.findFirst({
    where: { isActive: true, scope: "LOCAL", localId },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });
  const orden = (last?.orden ?? 0) + 1;

  const preset = await prisma.preset.create({
    data: {
      nombre: parsed.data.nombre,
      scope: "LOCAL",
      localId,
      orden,
      isActive: true,
    },
    select: { id: true, nombre: true, scope: true },
  });

  return NextResponse.json({ ok: true, preset }, { status: 201 });
}
