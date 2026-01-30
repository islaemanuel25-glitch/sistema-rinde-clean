import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/src/lib/db";
import { requireLocalContextApi } from "@/app/lib/rinde/requireLocalContext";

const QuerySchema = z.object({
  localId: z.string().min(1),
});

const PatchBodySchema = z.object({
  localId: z.string().min(1),
  accionId: z.string().min(1),

  isEnabled: z.boolean().optional(),
  orden: z.number().int().min(0).optional(),

  // overrides (null = “sin override”)
  tipoOverride: z.enum(["ENTRADA", "SALIDA"]).nullable().optional(),
  usaTurnoOverride: z.boolean().nullable().optional(),
  usaNombreOverride: z.boolean().nullable().optional(),

  // en tu modelo es boolean siempre
  impactaTotal: z.boolean().optional(),

  // Paso 6: impacto forward (desde cuándo aplica este override)
  impactaTotalDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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

  // Admin only
  if (rol !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN_ROLE" }, { status: 403 });
  }

  // TODAS las acciones del local (enabled o no), solo acciones activas
  const rows = await prisma.accionLocal.findMany({
    where: { localId, accion: { isActive: true } },
    orderBy: [{ orden: "asc" }, { updatedAt: "desc" }],
    select: {
      accionId: true,
      isEnabled: true,
      orden: true,
      tipoOverride: true,
      impactaTotal: true,
      impactaTotalDesde: true,
      usaTurnoOverride: true,
      usaNombreOverride: true,
      accion: {
        select: {
          nombre: true,
          tipoDefault: true,
          impactaTotalDefault: true,
          usaTurno: true,
          usaNombre: true,
          categoria: true,
        },
      },
    },
  });

  const acciones = rows.map((r) => {
    const tipo = r.tipoOverride ?? r.accion.tipoDefault;
    const usaTurno = r.usaTurnoOverride ?? r.accion.usaTurno;
    const usaNombre = r.usaNombreOverride ?? r.accion.usaNombre;

    return {
      accionId: r.accionId,
      nombre: r.accion.nombre,
      categoria: r.accion.categoria,

      isEnabled: r.isEnabled,
      orden: r.orden,

      // efectivos (preview)
      tipo,
      usaTurno,
      usaNombre,
      impactaTotal: r.impactaTotal,

      // forward
      impactaTotalDesde: r.impactaTotalDesde,

      // defaults para UI
      defaults: {
        tipoDefault: r.accion.tipoDefault,
        impactaTotalDefault: r.accion.impactaTotalDefault,
        usaTurno: r.accion.usaTurno,
        usaNombre: r.accion.usaNombre,
      },

      // overrides crudos
      overrides: {
        tipoOverride: r.tipoOverride,
        usaTurnoOverride: r.usaTurnoOverride,
        usaNombreOverride: r.usaNombreOverride,
      },
    };
  });

  return NextResponse.json({ ok: true, acciones });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const gate = await requireLocalContextApi(parsed.data.localId);
  if (!gate.ok) return gate.res;

  const { localId, rol } = gate.ctx;

  if (rol !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN_ROLE" }, { status: 403 });
  }

  const { accionId } = parsed.data;

  await prisma.accionLocal.update({
    where: {
      localId_accionId: { localId, accionId },
    },
    data: {
      isEnabled: parsed.data.isEnabled,
      orden: parsed.data.orden,
      tipoOverride: parsed.data.tipoOverride,
      usaTurnoOverride: parsed.data.usaTurnoOverride,
      usaNombreOverride: parsed.data.usaNombreOverride,
      impactaTotal: parsed.data.impactaTotal,
      impactaTotalDesde: parsed.data.impactaTotalDesde
        ? new Date(`${parsed.data.impactaTotalDesde}T00:00:00`)
        : undefined,
    },
  });

  return NextResponse.json({ ok: true });
}
