import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/src/lib/db";
import { requireLocalContextApi } from "@/app/lib/rinde/requireLocalContext";

const QuerySchema = z.object({
  localId: z.string().min(1),
});

const CreateItemSchema = z.object({
  localId: z.string().min(1),
  tipo: z.enum(["ACCION", "CATEGORIA", "SOCIO"]),
  accionId: z.string().min(1).optional(),
  categoria: z.enum(["TURNO", "DEPOSITO", "ELECTRONICO", "SOCIO", "OTROS"]).optional(),
  socioId: z.string().min(1).optional(),
  orden: z.number().int().min(0).optional(),
});

const PatchItemSchema = z.object({
  localId: z.string().min(1),
  itemId: z.string().min(1),
  orden: z.number().int().min(0).optional(),
  // permitir cambiar payload
  tipo: z.enum(["ACCION", "CATEGORIA", "SOCIO"]).optional(),
  accionId: z.string().nullable().optional(),
  categoria: z.enum(["TURNO", "DEPOSITO", "ELECTRONICO", "SOCIO", "OTROS"]).nullable().optional(),
  socioId: z.string().nullable().optional(),
});

async function assertEditableLocalPreset(presetId: string, localId: string) {
  const preset = await prisma.preset.findFirst({
    where: { id: presetId, scope: "LOCAL", localId, isActive: true },
    select: { id: true },
  });
  return !!preset;
}

export async function GET(req: NextRequest, { params }: { params: { presetId: string } }) {
  const q = QuerySchema.safeParse({ localId: req.nextUrl.searchParams.get("localId") ?? "" });
  if (!q.success) return NextResponse.json({ ok: false, error: "INVALID_QUERY" }, { status: 400 });

  const gate = await requireLocalContextApi(q.data.localId);
  if (!gate.ok) return gate.res;

  const { localId, rol } = gate.ctx;
  if (rol !== "ADMIN") return NextResponse.json({ ok: false, error: "FORBIDDEN_ROLE" }, { status: 403 });

  // admin ve items solo de presets LOCAL del local (editable)
  const ok = await assertEditableLocalPreset(params.presetId, localId);
  if (!ok) return NextResponse.json({ ok: false, error: "PRESET_NOT_EDITABLE" }, { status: 403 });

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

export async function POST(req: NextRequest, { params }: { params: { presetId: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = CreateItemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const gate = await requireLocalContextApi(parsed.data.localId);
  if (!gate.ok) return gate.res;

  const { localId, rol } = gate.ctx;
  if (rol !== "ADMIN") return NextResponse.json({ ok: false, error: "FORBIDDEN_ROLE" }, { status: 403 });

  const ok = await assertEditableLocalPreset(params.presetId, localId);
  if (!ok) return NextResponse.json({ ok: false, error: "PRESET_NOT_EDITABLE" }, { status: 403 });

  // Validación mínima por tipo (sin inventar reglas extra)
  if (parsed.data.tipo === "ACCION" && !parsed.data.accionId) {
    return NextResponse.json({ ok: false, error: "MISSING_ACCION" }, { status: 400 });
  }
  if (parsed.data.tipo === "CATEGORIA" && !parsed.data.categoria) {
    return NextResponse.json({ ok: false, error: "MISSING_CATEGORIA" }, { status: 400 });
  }
  if (parsed.data.tipo === "SOCIO" && !parsed.data.socioId) {
    return NextResponse.json({ ok: false, error: "MISSING_SOCIO" }, { status: 400 });
  }

  const created = await prisma.presetItem.create({
    data: {
      presetId: params.presetId,
      tipo: parsed.data.tipo,
      accionId: parsed.data.tipo === "ACCION" ? parsed.data.accionId! : null,
      categoria: parsed.data.tipo === "CATEGORIA" ? parsed.data.categoria! : null,
      socioId: parsed.data.tipo === "SOCIO" ? parsed.data.socioId! : null,
      orden: parsed.data.orden ?? 0,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}

export async function PATCH(req: NextRequest, { params }: { params: { presetId: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = PatchItemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const gate = await requireLocalContextApi(parsed.data.localId);
  if (!gate.ok) return gate.res;

  const { localId, rol } = gate.ctx;
  if (rol !== "ADMIN") return NextResponse.json({ ok: false, error: "FORBIDDEN_ROLE" }, { status: 403 });

  const ok = await assertEditableLocalPreset(params.presetId, localId);
  if (!ok) return NextResponse.json({ ok: false, error: "PRESET_NOT_EDITABLE" }, { status: 403 });

  await prisma.presetItem.update({
    where: { id: parsed.data.itemId },
    data: {
      orden: parsed.data.orden,
      tipo: parsed.data.tipo,
      accionId: parsed.data.accionId,
      categoria: parsed.data.categoria,
      socioId: parsed.data.socioId,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { presetId: string } }) {
  const localId = req.nextUrl.searchParams.get("localId") ?? "";
  const itemId = req.nextUrl.searchParams.get("itemId") ?? "";
  if (!localId) return NextResponse.json({ ok: false, error: "MISSING_LOCAL" }, { status: 400 });
  if (!itemId) return NextResponse.json({ ok: false, error: "MISSING_ITEM" }, { status: 400 });

  const gate = await requireLocalContextApi(localId);
  if (!gate.ok) return gate.res;

  const ctxLocalId = gate.ctx.localId;
  const rol = gate.ctx.rol;
  if (rol !== "ADMIN") return NextResponse.json({ ok: false, error: "FORBIDDEN_ROLE" }, { status: 403 });

  const ok = await assertEditableLocalPreset(params.presetId, ctxLocalId);
  if (!ok) return NextResponse.json({ ok: false, error: "PRESET_NOT_EDITABLE" }, { status: 403 });

  await prisma.presetItem.delete({ where: { id: itemId } });

  return NextResponse.json({ ok: true });
}
