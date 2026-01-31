import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireLocalContextApi } from "@/app/lib/rinde/requireLocalContext";
import { z } from "zod";
import { IdSchema } from "@/src/domain/zod";

const CategoriaSchema = z.enum(["TURNO", "DEPOSITO", "ELECTRONICO", "SOCIO", "OTROS"]);

// Acepta DOS formatos:
// 1) Nuevo: { tipo: "CATEGORIA", categoria: "TURNO" }
// 2) Viejo (UI actual): { label: "...", tipo: "TURNO", monto: 123 }
const CreateItemSchema = z
  .object({
    // formato nuevo
    tipo: z.string().optional(),
    categoria: z.string().optional(),

    // formato viejo
    label: z.string().optional(),
    monto: z.any().optional(),
  })
  .transform((val) => {
    const raw = (val.categoria ?? val.tipo ?? "").toString().trim().toUpperCase();
    const categoria = CategoriaSchema.safeParse(raw).success ? (raw as any) : ("OTROS" as const);

    return {
      tipo: "CATEGORIA" as const,
      categoria,
    };
  });

export async function GET(
  _: Request,
  { params }: { params: { localId: string; presetId: string } }
) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;

  const presetId = IdSchema.parse(params.presetId);

  const items = await prisma.presetItem.findMany({
    where: { presetId },
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

export async function POST(
  req: Request,
  { params }: { params: { localId: string; presetId: string } }
) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;

  const presetId = IdSchema.parse(params.presetId);

  const body = await req.json().catch(() => null);
  const parsed = CreateItemSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Datos inválidos" },
      { status: 400 }
    );
  }

  const last = await prisma.presetItem.findFirst({
    where: { presetId },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });
  const orden = (last?.orden ?? 0) + 1;

  const item = await prisma.presetItem.create({
    data: {
      presetId,
      tipo: "CATEGORIA",
      categoria: parsed.data.categoria as any,
      orden,
    },
    select: {
      id: true,
      tipo: true,
      accionId: true,
      categoria: true,
      socioId: true,
      orden: true,
    },
  });

  return NextResponse.json({ ok: true, item }, { status: 201 });
}
