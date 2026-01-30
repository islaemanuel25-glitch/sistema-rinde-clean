import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { prisma } from "@/src/lib/db";
import { requireAuth } from "@/src/auth/requireAuth";

export type LocalRol = "ADMIN" | "OPERATIVO" | "LECTURA";

export async function requireLocalContext(localIdFromRoute: string) {
  const user = await requireAuth(); // si falla, ya redirige / lanza

  const cookieLocal = cookies().get("rinde_local")?.value;
  if (!cookieLocal) redirect("/home");
  if (cookieLocal !== localIdFromRoute) redirect("/home");

  const allowed = await prisma.userLocal.findFirst({
    where: { userId: user.id, localId: localIdFromRoute, isActive: true, local: { isActive: true } },
    select: { id: true, rol: true },
  });

  if (!allowed) redirect("/home");

  return { userId: user.id, localId: localIdFromRoute, rol: allowed.rol as LocalRol };
}

export async function requireLocalContextApi(localIdFromRoute: string) {
  let userId: string;
  try {
    const user = await requireAuth();
    userId = user.id;
  } catch {
    return { ok: false as const, res: NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 }) };
  }

  const cookieLocal = cookies().get("rinde_local")?.value;
  if (!cookieLocal || cookieLocal !== localIdFromRoute) {
    return {
      ok: false as const,
      res: NextResponse.json({ ok: false, error: "LOCAL_CONTEXT_MISMATCH" }, { status: 403 }),
    };
  }

  const allowed = await prisma.userLocal.findFirst({
    where: { userId, localId: localIdFromRoute, isActive: true, local: { isActive: true } },
    select: { id: true, rol: true },
  });

  if (!allowed) {
    return { ok: false as const, res: NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 }) };
  }

  return { ok: true as const, ctx: { userId, localId: localIdFromRoute, rol: allowed.rol as LocalRol } };
}
