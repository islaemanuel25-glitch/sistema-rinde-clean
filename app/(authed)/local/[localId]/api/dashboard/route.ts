import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireLocalContextApi } from "@/app/lib/rinde/requireLocalContext";

type Mode = "week" | "month";

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeekSunday(d: Date) {
  const x = new Date(d);
  const day = x.getDay(); // 0=Dom
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function firstSundayOfMonth(year: number, month0: number) {
  const d = new Date(year, month0, 1);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const add = (7 - day) % 7;
  d.setDate(d.getDate() + add);
  return d;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function addMonths(d: Date, months: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

async function sumMovimientos(localId: string, start: Date, end: Date) {
  const movimientos = await prisma.movimiento.findMany({
    where: { localId, fecha: { gte: start, lt: end } },
    select: { tipo: true, importe: true },
  });

  let entradas = 0;
  let salidas = 0;

  for (const m of movimientos) {
    const imp = Number(m.importe);
    if (m.tipo === "ENTRADA") entradas += imp;
    else salidas += imp;
  }

  return { entradas, salidas, resultado: entradas - salidas, count: movimientos.length };
}

export async function GET(req: NextRequest, { params }: { params: { localId: string } }) {
  try {
    const gate = await requireLocalContextApi(params.localId);
    if (!gate.ok) return gate.res;
    const { localId } = gate.ctx;

    const url = new URL(req.url);
    const mode = ((url.searchParams.get("mode") || "week") as Mode);
    const count = Math.min(Math.max(parseInt(url.searchParams.get("count") || "12", 10), 1), 52);

    // Socio config
    const cfg = await prisma.socioConfig.findUnique({
      where: { localId },
      select: { isEnabled: true, pctSocio: true },
    });
    const pctSocio = cfg?.isEnabled ? Number(cfg.pctSocio) : 0;

    // ✅ ANCLA REAL: última fecha con movimientos (si no hay, usa hoy)
    const last = await prisma.movimiento.findFirst({
      where: { localId },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
      select: { fecha: true },
    });

    const anchorDate = last?.fecha ? new Date(last.fecha) : new Date();
    const anchorIso = toISODate(anchorDate);

    const periods: Array<{ start: Date; end: Date }> = [];

    if (mode === "week") {
      const baseStart = startOfWeekSunday(new Date(`${anchorIso}T00:00:00`));
      const baseEnd = addDays(baseStart, 7);
      for (let i = count - 1; i >= 0; i--) {
        const start = addDays(baseStart, -7 * i);
        const end = addDays(baseEnd, -7 * i);
        periods.push({ start, end });
      }
    } else {
      const base = new Date(`${anchorIso}T00:00:00`);
      const y = base.getFullYear();
      const m = base.getMonth();

      const baseStart = firstSundayOfMonth(y, m);
      const nextBase = addMonths(baseStart, 1);
      const baseEnd = firstSundayOfMonth(nextBase.getFullYear(), nextBase.getMonth());

      for (let i = count - 1; i >= 0; i--) {
        const pivot = addMonths(baseStart, -i);
        const start = firstSundayOfMonth(pivot.getFullYear(), pivot.getMonth());
        const pivot2 = addMonths(start, 1);
        const end = firstSundayOfMonth(pivot2.getFullYear(), pivot2.getMonth());
        periods.push({ start, end });
      }
    }

    // Arrastre
    let saldoPendiente = 0;

    const series = [];
    for (const p of periods) {
      const sums = await sumMovimientos(localId, p.start, p.end);

      const arrastreAntes = saldoPendiente;
      saldoPendiente = saldoPendiente + sums.resultado;

      let gananciaDivisible = 0;
      let parteSocio = 0;
      let parteDueno = 0;

      if (saldoPendiente > 0) {
        gananciaDivisible = saldoPendiente;
        parteSocio = gananciaDivisible * pctSocio;
        parteDueno = gananciaDivisible - parteSocio;
        saldoPendiente = 0;
      }

      series.push({
        start: toISODate(p.start),
        end: toISODate(p.end), // end exclusivo
        entradas: sums.entradas,
        salidas: sums.salidas,
        resultado: sums.resultado,
        movimientosCount: sums.count,
        arrastreAntes,
        arrastreDespues: saldoPendiente,
        gananciaDivisible,
        pctSocio,
        parteSocio,
        parteDueno,
      });
    }

    return NextResponse.json({
      ok: true,
      mode,
      anchorDate: last?.fecha ? toISODate(last.fecha) : toISODate(new Date()),
      series,
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "UNKNOWN_ERROR";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
