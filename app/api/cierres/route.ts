import { NextResponse } from "next/server";
import { CrearCierreRequestSchema, CierreResponseSchema } from "@/src/domain/zod";
import { requireLocalContextApi } from "@/app/lib/rinde/requireLocalContext";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = CrearCierreRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }

  const gate = await requireLocalContextApi(parsed.data.localId);
  if (!gate.ok) return gate.res;

  const { rol } = gate.ctx;

  // Paso 7: LECTURA no puede escribir
  if (rol === "LECTURA") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN_ROLE" }, { status: 403 });
  }

  const mock = {
    localId: parsed.data.localId,
    fecha: parsed.data.fecha,
    total: "0.00",
  };

  const out = CierreResponseSchema.parse(mock);
  return NextResponse.json(out);
}
