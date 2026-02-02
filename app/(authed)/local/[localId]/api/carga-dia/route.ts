import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { requireLocalContextApi } from "@/app/lib/rinde/requireLocalContext";

function isISODate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function toStartEndDay(iso: string) {
  const start = new Date(`${iso}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function toDecimalString(v: unknown) {
  if (v === "" || v === null || v === undefined) return "0";
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  // guardamos entero como string (tu UI usa sin decimales)
  return String(Math.trunc(n));
}

const BodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  values: z.record(z.string(), z.union([z.string(), z.number()])), // accionId -> importe
});

export async function GET(req: NextRequest, { params }: { params: { localId: string } }) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;

  const { localId } = gate.ctx;
  const url = new URL(req.url);
  const date = url.searchParams.get("date");

  if (!date || !isISODate(date)) {
    return NextResponse.json({ ok: false, error: "DATE_REQUIRED" }, { status: 400 });
  }

  const { start, end } = toStartEndDay(date);

  const movimientos = await prisma.movimiento.findMany({
    where: {
      localId,
      fecha: { gte: start, lt: end },
      turno: null,
      nombre: null,
    },
    select: {
      accionId: true,
      importe: true,
    },
  });

  const values: Record<string, string> = {};
  for (const m of movimientos) {
    values[m.accionId] = String(m.importe);
  }

  return NextResponse.json({ ok: true, date, values });
}

export async function POST(req: NextRequest, { params }: { params: { localId: string } }) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;

  const { localId, userId, rol } = gate.ctx;

  if (!userId) {
    return NextResponse.json({ ok: false, error: "NO_USER" }, { status: 401 });
  }
  if (rol === "LECTURA") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN_ROLE" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const { date, values } = parsed.data;
  const { start, end } = toStartEndDay(date);

  const accionIds = Object.keys(values);
  if (accionIds.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, created: 0 });
  }

  // validar acciones habilitadas y no SOCIO
  const accionLocal = await prisma.accionLocal.findMany({
    where: { localId, accionId: { in: accionIds }, isEnabled: true, accion: { isActive: true } },
    select: {
      accionId: true,
      tipoOverride: true,
      impactaTotal: true,
      accion: {
        select: { tipoDefault: true, categoria: true },
      },
    },
  });

  const allowed = new Map(
    accionLocal.map((x) => [
      x.accionId,
      {
        tipo: (x.tipoOverride ?? x.accion.tipoDefault) as "ENTRADA" | "SALIDA",
        categoria: x.accion.categoria as any,
      },
    ])
  );

  // si falta alguna o es SOCIO => error claro
  for (const id of accionIds) {
    const a = allowed.get(id);
    if (!a) {
      return NextResponse.json({ ok: false, error: `ACCION_NOT_ENABLED:${id}` }, { status: 403 });
    }
    if (a.categoria === "SOCIO") {
      return NextResponse.json({ ok: false, error: "SOCIO_DISABLED" }, { status: 403 });
    }
  }

  // existentes del día (para upsert)
  const existentes = await prisma.movimiento.findMany({
    where: {
      localId,
      fecha: { gte: start, lt: end },
      accionId: { in: accionIds },
      turno: null,
      nombre: null,
    },
    select: { id: true, accionId: true },
  });

  const byAccionId = new Map<string, string>();
  for (const e of existentes) byAccionId.set(e.accionId, e.id);

  let updated = 0;
  let created = 0;

  // transacción: updates + creates
  await prisma.$transaction(async (tx) => {
    for (const accionId of accionIds) {
      const dec = toDecimalString(values[accionId]);
      if (dec === null) {
        throw new Error(`IMPORTE_INVALID:${accionId}`);
      }

      const tipo = allowed.get(accionId)!.tipo;

      const existingId = byAccionId.get(accionId);

      if (existingId) {
        await tx.movimiento.update({
          where: { id: existingId },
          data: {
            importe: dec,
            tipo,
            // no cambiamos fecha/accionId
          },
        });
        updated++;
      } else {
        // si es 0 y no existía, no creamos (evita basura)
        if (dec === "0") continue;

        await tx.movimiento.create({
          data: {
            localId,
            fecha: start,
            accionId,
            tipo,
            importe: dec,
            turno: null,
            nombre: null,
            socioId: null,
            createdByUserId: userId,
          },
          select: { id: true },
        });
        created++;
      }
    }
  });

  return NextResponse.json({ ok: true, updated, created });
}
