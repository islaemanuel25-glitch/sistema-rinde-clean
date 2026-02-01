import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireLocalContextApi } from "@/app/lib/rinde/requireLocalContext";
import { z } from "zod";

export async function GET(_: Request, { params }: { params: { localId: string } }) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;

  const { localId, userId } = (gate.ctx as any) ?? {};

  // ✅ SOLO ADMIN (validación real con tu schema: UserLocal.rol)
  if (userId) {
    const ul = await prisma.userLocal.findFirst({
      where: { userId, localId, isActive: true, local: { isActive: true } },
      select: { rol: true },
    });
    if (!ul || ul.rol !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }
  }

  // Traemos catálogo (Accion) + estado por local (AccionLocal)
  // Nota: NO filtramos por isEnabled acá, porque es pantalla de config.
  const acciones = await prisma.accion.findMany({
    where: { isActive: true },
    orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
    select: {
      id: true,
      nombre: true,
      categoria: true,
      tipoDefault: true,
      impactaTotalDefault: true,
      usaTurno: true,
      usaNombre: true,
      locales: {
        where: { localId },
        select: {
          isEnabled: true,
          orden: true,
          tipoOverride: true,
          impactaTotal: true,
          impactaTotalDesde: true,
          usaTurnoOverride: true,
          usaNombreOverride: true,
        },
      },
    },
  });

  const out = acciones.map((a) => {
    const al = a.locales[0] ?? null;

    return {
      accionId: a.id,
      nombre: a.nombre,

      tipoDefault: a.tipoDefault,
      impactaTotalDefault: a.impactaTotalDefault,
      usaTurnoDefault: a.usaTurno,
      usaNombreDefault: a.usaNombre,
      categoria: a.categoria,

      // estado local (si no existe row, usamos defaults)
      isEnabled: al?.isEnabled ?? true,
      orden: al?.orden ?? 0,
      tipoOverride: al?.tipoOverride ?? null,
      impactaTotal: al?.impactaTotal ?? a.impactaTotalDefault,
      impactaTotalDesde: al?.impactaTotalDesde ?? null,
      usaTurnoOverride: al?.usaTurnoOverride ?? null,
      usaNombreOverride: al?.usaNombreOverride ?? null,
    };
  });

  out.sort((x, y) => (x.orden - y.orden) || x.nombre.localeCompare(y.nombre));

  return NextResponse.json({ ok: true, acciones: out });
}

const UpdateSchema = z.object({
  acciones: z.array(
    z.object({
      accionId: z.string().min(1),
      isEnabled: z.boolean(),
      orden: z.number().int(),
      tipoOverride: z.enum(["ENTRADA", "SALIDA"]).nullable(),
      impactaTotal: z.boolean(),
      usaTurnoOverride: z.boolean().nullable(),
      usaNombreOverride: z.boolean().nullable(),
    })
  ),
});

export async function PUT(req: Request, { params }: { params: { localId: string } }) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;

  const { localId, userId } = (gate.ctx as any) ?? {};

  // ✅ SOLO ADMIN
  if (userId) {
    const ul = await prisma.userLocal.findFirst({
      where: { userId, localId, isActive: true, local: { isActive: true } },
      select: { rol: true },
    });
    if (!ul || ul.rol !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }
  }

  const body = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
  }

  const items = parsed.data.acciones;

  await prisma.$transaction(
    items.map((i) =>
      prisma.accionLocal.upsert({
        where: { localId_accionId: { localId, accionId: i.accionId } },
        create: {
          localId,
          accionId: i.accionId,
          isEnabled: i.isEnabled,
          orden: i.orden,
          tipoOverride: i.tipoOverride,
          impactaTotal: i.impactaTotal,
          impactaTotalDesde: new Date(),
          usaTurnoOverride: i.usaTurnoOverride,
          usaNombreOverride: i.usaNombreOverride,
        },
        update: {
          isEnabled: i.isEnabled,
          orden: i.orden,
          tipoOverride: i.tipoOverride,
          impactaTotal: i.impactaTotal,
          // Regla: solo actualizamos "desde" si cambia impactaTotal
          impactaTotalDesde: undefined as any, // set abajo condicionalmente
          usaTurnoOverride: i.usaTurnoOverride,
          usaNombreOverride: i.usaNombreOverride,
        },
      })
    )
  );

  // ✅ Ajuste fino: impactaTotalDesde solo si cambia
  // (lo hacemos en 2da pasada para no complicar el upsert)
  // Nota: si querés performance máxima, lo fusionamos en una sola transacción con lectura previa.
  const existing = await prisma.accionLocal.findMany({
    where: { localId, accionId: { in: items.map((x) => x.accionId) } },
    select: { accionId: true, impactaTotal: true },
  });
  const byId = new Map(existing.map((e) => [e.accionId, e.impactaTotal]));

  const changes = items.filter((i) => {
    const prev = byId.get(i.accionId);
    return prev !== undefined && prev !== i.impactaTotal;
  });

  if (changes.length) {
    await prisma.$transaction(
      changes.map((i) =>
        prisma.accionLocal.update({
          where: { localId_accionId: { localId, accionId: i.accionId } },
          data: { impactaTotalDesde: new Date() },
        })
      )
    );
  }

  return NextResponse.json({ ok: true });
}
