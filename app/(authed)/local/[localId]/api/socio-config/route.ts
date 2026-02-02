import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireLocalContextApi } from "@/app/lib/rinde/requireLocalContext";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const PatchBodySchema = z.object({
  isEnabled: z.boolean().optional(),
  pctSocio: z.number().min(0).max(100).optional(), // UI manda 0..100
});

export async function GET(_: Request, { params }: { params: { localId: string } }) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;

  const { localId } = gate.ctx;

  // Buscar socioConfig, si no existe crear con defaults
  let socioConfig = await prisma.socioConfig.findUnique({
    where: { localId },
    select: { isEnabled: true, pctSocio: true },
  });

  if (!socioConfig) {
    socioConfig = await prisma.socioConfig.create({
      data: {
        localId,
        isEnabled: false,
        pctSocio: new Prisma.Decimal(0),
      },
      select: { isEnabled: true, pctSocio: true },
    });
  }

  // pctSocio en DB es Decimal 0..1
  const pctSocioNum = Number(socioConfig.pctSocio);

  return NextResponse.json({
    ok: true,
    socioConfig: {
      isEnabled: socioConfig.isEnabled,
      pctSocio: pctSocioNum, // 0..1
    },
  });
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

  const { isEnabled, pctSocio } = parsed.data;

  // Preparar data para upsert (DB guarda 0..1 como Decimal)
  const updateData: {
    isEnabled?: boolean;
    pctSocio?: Prisma.Decimal;
  } = {};

  if (isEnabled !== undefined) {
    updateData.isEnabled = isEnabled;
  }

  if (pctSocio !== undefined) {
    // pctSocio viene 0..100 (UI) => guardar 0..1 (DB)
    if (pctSocio < 0 || pctSocio > 100) {
      return NextResponse.json(
        { ok: false, error: "INVALID_PCT_SOCIO" },
        { status: 400 }
      );
    }
    updateData.pctSocio = new Prisma.Decimal(pctSocio / 100);
  }

  await prisma.socioConfig.upsert({
    where: { localId },
    create: {
      localId,
      isEnabled: updateData.isEnabled ?? false,
      pctSocio: updateData.pctSocio ?? new Prisma.Decimal(0),
    },
    update: updateData,
  });

  return NextResponse.json({ ok: true });
}
