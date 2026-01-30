import { NextResponse } from "next/server";
import { ItemsBootstrapResponseSchema } from "@/src/domain/zod";

export async function GET() {
  const mock = {
    acciones: [],
    accionesLocal: [],
    presets: [],
    presetItems: [],
    socios: [],
  };
  const out = ItemsBootstrapResponseSchema.parse(mock);
  return NextResponse.json(out);
}
