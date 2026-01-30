import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/src/lib/db";
import { requireLocalContextApi } from "@/app/lib/rinde/requireLocalContext";

const QuerySchema = z.object({
  localId: z.string().min(1),
});

const CreateSchema = z.object({
  localId: z.string().min(1),
  nombre: z.string().min(1),
  orden: z.number().int().min(0).optional(),
});

function getLocalIdFromQuery(req: NextRequest) {
  const localId = req.nextUrl.searchParams.get("localId") ?? "";
  return QuerySchema.safeParse({ localId });
}

export async function GET(req: NextRequest) {
  const q = getLocalIdFromQuery(req);
  if (!q.success) return NextResponse.json({ ok: false, error: "INVALID_QUERY" }, { status: 400 });

  const gate = await requireLocalContextApi(q.data.localId);
  if (!gate.ok) return gate.res;

  const { localId, rol } = gate.ctx;
  if (rol !== "ADMIN") return NextResponse.json({ ok: false, error: "FORBIDDEN_ROLE" }, { status: 403 });

  const presets = await prisma.preset.findMany({
    where: {
      isActive: true,
      OR: [{ scope: "GLOBAL", localId: null }, { scope: "LOCAL", localId }],
    },
    orderBy: [{ orden: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      scope: true,
      localId: true,
      nombre: true,
      orden: true,
      isActive: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ ok: true, presets });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const gate = await requireLocalContextApi(parsed.data.localId);
  if (!gate.ok) return gate.res;

  const { localId, rol } = gate.ctx;
  if (rol !== "ADMIN") return NextResponse.json({ ok: false, error: "FORBIDDEN_ROLE" }, { status: 403 });

  const created = await prisma.preset.create({
    data: {
      scope: "LOCAL",
      localId,
      nombre: parsed.data.nombre,
      orden: parsed.data.orden ?? 0,
      isActive: true,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
