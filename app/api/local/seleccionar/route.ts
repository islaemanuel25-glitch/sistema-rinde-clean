import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireAuth } from "@/src/auth/requireAuth";
import { getActiveLocalId, setActiveLocalId } from "@/src/auth/localSession";
import { z } from "zod";
import { IdSchema } from "@/src/domain/zod";

const BodySchema = z.object({ localId: IdSchema });

async function authorizeAndSet(userId: string, localId: string) {
  const current = getActiveLocalId();

  // Si quiere cambiar de local y ya hay uno activo, solo lo permitimos si es ADMIN del local actual
  if (current && current !== localId) {
    const currentRole = await prisma.userLocal.findFirst({
      where: {
        userId,
        localId: current,
        isActive: true,
        local: { isActive: true },
      },
      select: { rol: true },
    });

    if (!currentRole || currentRole.rol !== "ADMIN") {
      return NextResponse.json(
        { ok: false, error: "No podés cambiar de local sin cerrar sesión" },
        { status: 409 }
      );
    }
  }

  const allowed = await prisma.userLocal.findFirst({
    where: { userId, localId, isActive: true, local: { isActive: true } },
    select: { id: true },
  });

  if (!allowed) {
    return NextResponse.json({ ok: false, error: "Local no autorizado" }, { status: 403 });
  }

  setActiveLocalId(localId);
  return null;
}

// GET /api/local/seleccionar?localId=xxx&next=/local/xxx
export async function GET(req: Request) {
  const user = await requireAuth();
  const url = new URL(req.url);

  const localId = url.searchParams.get("localId") ?? "";
  const next = url.searchParams.get("next") ?? "/home";

  const parsed = IdSchema.safeParse(localId);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  }

  const err = await authorizeAndSet(user.id, parsed.data);
  if (err) return err;

  return NextResponse.redirect(new URL(next, url.origin));
}

export async function POST(req: Request) {
  const user = await requireAuth();

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  }

  const err = await authorizeAndSet(user.id, parsed.data.localId);
  if (err) return err;

  return NextResponse.json({ ok: true });
}
