import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/src/lib/db";
import { requireLocalContextApi } from "@/app/lib/rinde/requireLocalContext";

const PatchSchema = z.object({
  localId: z.string().min(1),
  nombre: z.string().min(1).optional(),
  orden: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

async function assertEditableLocalPreset(presetId: string, localId: string) {
  const preset = await prisma.preset.findFirst({
    where: { id: presetId, scope: "LOCAL", localId, isActive: true },
    select: { id: true },
  });
  return !!preset;
}

export async function PATCH(req: NextRequest, { params }: { params: { presetId: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const gate = await requireLocalContextApi(parsed.data.localId);
  if (!gate.ok) return gate.res;

  const { localId, rol } = gate.ctx;
  if (rol !== "ADMIN") return NextResponse.json({ ok: false, error: "FORBIDDEN_ROLE" }, { status: 403 });

  const ok = await assertEditableLocalPreset(params.presetId, localId);
  if (!ok) return NextResponse.json({ ok: false, error: "PRESET_NOT_EDITABLE" }, { status: 403 });

  await prisma.preset.update({
    where: { id: params.presetId },
    data: {
      nombre: parsed.data.nombre,
      orden: parsed.data.orden,
      isActive: parsed.data.isActive,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { presetId: string } }) {
  const localId = req.nextUrl.searchParams.get("localId") ?? "";
  if (!localId) return NextResponse.json({ ok: false, error: "MISSING_LOCAL" }, { status: 400 });

  const gate = await requireLocalContextApi(localId);
  if (!gate.ok) return gate.res;

  const ctxLocalId = gate.ctx.localId;
  const rol = gate.ctx.rol;
  if (rol !== "ADMIN") return NextResponse.json({ ok: false, error: "FORBIDDEN_ROLE" }, { status: 403 });

  const ok = await assertEditableLocalPreset(params.presetId, ctxLocalId);
  if (!ok) return NextResponse.json({ ok: false, error: "PRESET_NOT_EDITABLE" }, { status: 403 });

  await prisma.preset.update({
    where: { id: params.presetId },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}
