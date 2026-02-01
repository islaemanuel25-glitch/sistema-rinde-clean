import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireLocalContextApi } from "@/app/lib/rinde/requireLocalContext";

// En UI se usa 50..100. En DB guardamos 0..1.
function toDbPct(uiPct: number) {
  return uiPct / 100;
}

function toUiPct(dbPct: number) {
  return Math.round(dbPct * 100);
}

export async function GET(req: NextRequest, { params }: { params: { localId: string } }) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;
  const { localId } = gate.ctx;

  const row = await prisma.socioConfig.findUnique({
    where: { localId },
    select: { isEnabled: true, pctSocio: true },
  });

  return NextResponse.json({
    ok: true,
    item: row
      ? { isEnabled: row.isEnabled, pctSocio: toUiPct(Number(row.pctSocio)) }
      : { isEnabled: false, pctSocio: 50 },
  });
}

export async function PUT(req: NextRequest, { params }: { params: { localId: string } }) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;
  const { localId, rol } = gate.ctx;

  // Solo ADMIN puede cambiar configuración
  if (rol !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN_ROLE" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.isEnabled !== "boolean" || typeof body.pctSocio !== "number") {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const uiPct = body.pctSocio;

  // Permitimos 1..99 (o 0..100 si querés). Acá dejo 1..99 para que tenga sentido.
  if (!Number.isFinite(uiPct) || uiPct < 1 || uiPct > 99) {
    return NextResponse.json({ ok: false, error: "PCT_INVALID" }, { status: 400 });
  }

  const dbPct = toDbPct(uiPct);

  const saved = await prisma.socioConfig.upsert({
    where: { localId },
    create: { localId, isEnabled: body.isEnabled, pctSocio: String(dbPct) },
    update: { isEnabled: body.isEnabled, pctSocio: String(dbPct) },
    select: { isEnabled: true, pctSocio: true },
  });

  return NextResponse.json({
    ok: true,
    item: { isEnabled: saved.isEnabled, pctSocio: toUiPct(Number(saved.pctSocio)) },
  });
}
