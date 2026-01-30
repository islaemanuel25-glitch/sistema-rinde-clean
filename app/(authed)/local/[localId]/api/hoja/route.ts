import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireLocalContextApi } from "@/app/lib/rinde/requireLocalContext";

type Scope = "day" | "week" | "month" | "all";

function parseScope(v: string | null): Scope {
  if (v === "day" || v === "week" || v === "month" || v === "all") return v;
  return "day";
}

function isISODate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startEndForScope(scope: Scope, isoDate: string) {
  const base = new Date(`${isoDate}T00:00:00`);
  const start = new Date(base);
  const end = new Date(base);

  if (scope === "day") {
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  if (scope === "week") {
    const day = start.getDay(); // 0=Dom
    const diffToMonday = (day + 6) % 7; // Lunes=0
    start.setDate(start.getDate() - diffToMonday);
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 7);
    return { start, end };
  }

  // month
  start.setDate(1);
  end.setMonth(start.getMonth() + 1);
  end.setDate(1);
  return { start, end };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { localId: string } }
) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;
  const { localId } = gate.ctx;

  const url = new URL(req.url);
  const scope = parseScope(url.searchParams.get("scope"));
  const dateParam = url.searchParams.get("date"); // YYYY-MM-DD

  // Para day/week/month exigimos date válida.
  if (scope !== "all") {
    if (!dateParam || !isISODate(dateParam)) {
      return NextResponse.json({ ok: false, error: "DATE_REQUIRED" }, { status: 400 });
    }
  }

  const whereMov: any = { localId };

  if (scope !== "all") {
    const { start, end } = startEndForScope(scope, dateParam!);
    whereMov.fecha = { gte: start, lt: end };
  }

  const movimientos = await prisma.movimiento.findMany({
    where: whereMov,
    orderBy: [{ fecha: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      fecha: true,
      importe: true,
      turno: true,
      nombre: true,
      socioId: true,
      accionId: true,
      tipo: true,
      accion: {
        select: {
          nombre: true,
          impactaTotalDefault: true,
        },
      },
    },
  });

  // Overrides por local (impactaTotal) — solo para acciones que aparezcan
  const accionIds = Array.from(new Set(movimientos.map((m) => m.accionId)));
  const accionesLocal = accionIds.length
    ? await prisma.accionLocal.findMany({
        where: { localId, accionId: { in: accionIds } },
        select: { accionId: true, impactaTotal: true },
      })
    : [];

  const impactaByAccionId = new Map<string, boolean>();
  for (const al of accionesLocal) impactaByAccionId.set(al.accionId, al.impactaTotal);

  // Meta: último día con movimientos del local (para “día sugerido” del modal luego)
  const last = await prisma.movimiento.findFirst({
    where: { localId },
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    select: { fecha: true },
  });

  // Agrupar por día
  const byDay = new Map<string, typeof movimientos>();
  for (const m of movimientos) {
    const dayIso = toISODate(m.fecha);
    if (!byDay.has(dayIso)) byDay.set(dayIso, []);
    byDay.get(dayIso)!.push(m);
  }

  const days = Array.from(byDay.entries()).map(([dayIso, list]) => {
    let totalEntradas = 0;
    let totalSalidas = 0;
    let totalImpacta = 0;

    const movimientosOut = list.map((m) => {
      const tipo = m.tipo; // Movimiento.tipo (ya está guardado)
      const importeNum = Number(m.importe); // Decimal -> number (ok para sumas UI)
      const impacta =
        impactaByAccionId.has(m.accionId)
          ? impactaByAccionId.get(m.accionId)!
          : m.accion.impactaTotalDefault;

      if (tipo === "ENTRADA") totalEntradas += importeNum;
      else totalSalidas += importeNum;

      if (impacta) {
        if (tipo === "ENTRADA") totalImpacta += importeNum;
        else totalImpacta -= importeNum;
      }

      return {
        id: m.id,
        accionId: m.accionId,
        accionNombre: m.accion.nombre,
        tipo,
        importe: String(m.importe),
        turno: m.turno ?? null,
        nombre: m.nombre ?? null,
        socio: m.socioId ?? null,
        impactaTotal: impacta,
      };
    });

    const totalNeto = totalEntradas - totalSalidas;

    return {
      date: dayIso,
      movimientos: movimientosOut,
      resumen: {
        totalEntradas,
        totalSalidas,
        totalNeto,
        totalImpacta,
      },
    };
  });

  // UI: último día arriba
  days.sort((a, b) => (a.date < b.date ? 1 : -1));

  return NextResponse.json({
    ok: true,
    scope,
    date: scope === "all" ? null : dateParam,
    days,
    meta: {
      lastMovimientoDate: last?.fecha ? toISODate(last.fecha) : null,
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { localId: string } }
) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;
  const { localId, userId, rol } = gate.ctx;

  if (!userId) {
    return NextResponse.json({ ok: false, error: "NO_USER" }, { status: 401 });
  }

  // LECTURA no puede escribir
  if (rol === "LECTURA") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN_ROLE" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.date !== "string" || typeof body.presetId !== "string") {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const { date, presetId } = body;

  if (!isISODate(date)) {
    return NextResponse.json({ ok: false, error: "DATE_INVALID" }, { status: 400 });
  }

  // Solo aplica a day (un día exacto)
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  // Cargar preset con items
  const preset = await prisma.preset.findFirst({
    where: {
      id: presetId,
      isActive: true,
      OR: [{ scope: "GLOBAL" }, { scope: "LOCAL", localId }],
    },
    select: {
      id: true,
      items: {
        orderBy: { orden: "asc" },
        select: {
          tipo: true,
          accionId: true,
          categoria: true,
          socioId: true,
        },
      },
    },
  });

  if (!preset) {
    return NextResponse.json({ ok: false, error: "PRESET_NOT_FOUND" }, { status: 404 });
  }

  // Acciones habilitadas del local
  const accionesLocal = await prisma.accionLocal.findMany({
    where: { localId, isEnabled: true },
    orderBy: [{ orden: "asc" }],
    select: {
      accionId: true,
      tipoOverride: true,
      accion: {
        select: {
          tipoDefault: true,
          categoria: true,
        },
      },
    },
  });

  // Mapa accionId -> tipo (override o default) + set habilitadas
  const tipoByAccionId = new Map<string, "ENTRADA" | "SALIDA">();
  const accionIdsHabilitadas = new Set<string>();

  for (const al of accionesLocal) {
    accionIdsHabilitadas.add(al.accionId);
    tipoByAccionId.set(al.accionId, (al.tipoOverride ?? al.accion.tipoDefault) as "ENTRADA" | "SALIDA");
  }

  // Primera acción SOCIO habilitada (si existe)
  let socioAccionId: string | null = null;
  for (const al of accionesLocal) {
    if (al.accion.categoria === "SOCIO") {
      socioAccionId = al.accionId;
      break;
    }
  }

  // Targets deduplicados por key `${accionId}::${socioId||""}`
  type Target = { accionId: string; socioId: string | null };
  const targets = new Map<string, Target>();

  for (const item of preset.items) {
    if (item.tipo === "ACCION" && item.accionId) {
      if (accionIdsHabilitadas.has(item.accionId)) {
        const key = `${item.accionId}::`;
        if (!targets.has(key)) targets.set(key, { accionId: item.accionId, socioId: null });
      }
      continue;
    }

    if (item.tipo === "CATEGORIA" && item.categoria) {
      for (const al of accionesLocal) {
        if (al.accion.categoria === item.categoria) {
          const key = `${al.accionId}::`;
          if (!targets.has(key)) targets.set(key, { accionId: al.accionId, socioId: null });
        }
      }
      continue;
    }

    if (item.tipo === "SOCIO" && item.socioId) {
      if (!socioAccionId) continue; // si no hay acción SOCIO, no falla
      const key = `${socioAccionId}::${item.socioId}`;
      if (!targets.has(key)) targets.set(key, { accionId: socioAccionId, socioId: item.socioId });
      continue;
    }
  }

  if (targets.size === 0) {
    return NextResponse.json({ ok: true, created: 0, skipped: 0, note: "NO_TARGETS" });
  }

  // Existentes del día para no duplicar
  const uniqAccionIds = Array.from(new Set(Array.from(targets.values()).map((t) => t.accionId)));
  const existentes = await prisma.movimiento.findMany({
    where: {
      localId,
      fecha: { gte: start, lt: end },
      accionId: { in: uniqAccionIds },
    },
    select: {
      accionId: true,
      socioId: true,
    },
  });

  const existentesSet = new Set<string>();
  for (const e of existentes) {
    existentesSet.add(`${e.accionId}::${e.socioId ?? ""}`);
  }

  const toCreate: Array<{
    localId: string;
    fecha: Date;
    accionId: string;
    tipo: "ENTRADA" | "SALIDA";
    importe: string;
    turno: null;
    nombre: null;
    socioId: string | null;
    createdByUserId: string;
  }> = [];

  for (const [key, target] of targets.entries()) {
    if (existentesSet.has(key)) continue;

    const tipo = tipoByAccionId.get(target.accionId);
    if (!tipo) continue;

    toCreate.push({
      localId,
      fecha: start,
      accionId: target.accionId,
      tipo,
      importe: "0",
      turno: null,
      nombre: null,
      socioId: target.socioId,
      createdByUserId: userId,
    });
  }

  if (toCreate.length > 0) {
    await prisma.movimiento.createMany({
      data: toCreate,
    });
  }

  const created = toCreate.length;
  const skipped = targets.size - toCreate.length;

  return NextResponse.json({ ok: true, created, skipped });
}
