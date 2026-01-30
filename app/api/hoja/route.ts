import { requireLocalContext } from "@/lib/auth/requireLocalContext";
import { assertRole } from "@/lib/auth/permissions";

export async function GET(req: Request) {
  const ctx = await requireLocalContext();
  assertRole(ctx.rol, "MOV_READ");

  // ... tu lógica actual (usar ctx.localId)
}

export async function POST(req: Request) {
  const ctx = await requireLocalContext();
  assertRole(ctx.rol, "MOV_WRITE");

  // ... tu lógica actual de alta (usar ctx.localId)
}
