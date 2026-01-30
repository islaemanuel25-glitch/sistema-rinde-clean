import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma"; // ajustá path
import { requireUser } from "@/lib/auth/requireUser"; // tu helper actual (o reemplazalo)

export type LocalRol = "ADMIN" | "OPERATIVO" | "LECTURA";

export type LocalContext = {
  userId: string;
  localId: string;
  rol: LocalRol;
};

export async function requireLocalContext(): Promise<LocalContext> {
  const user = await requireUser(); // debe tirar error si no hay login
  const localId = cookies().get("rinde_local")?.value;

  if (!localId) {
    throw new Response("Falta contexto de local (cookie rinde_local).", { status: 400 });
  }

  const ul = await prisma.userLocal.findFirst({
    where: { userId: user.id, localId },
    select: { rol: true },
  });

  if (!ul?.rol) {
    throw new Response("No tenés acceso a este local.", { status: 403 });
  }

  return { userId: user.id, localId, rol: ul.rol as LocalRol };
}
