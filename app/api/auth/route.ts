import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/src/lib/db";
import { createSession, destroySession } from "@/src/auth/session";
import { LoginRequestSchema } from "@/src/domain/zod";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = LoginRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
  }

  const { email, password } = parsed.data;

  // Mensaje genérico siempre
  const invalid = () =>
    NextResponse.json({ ok: false, error: "Credenciales inválidas" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return invalid();

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return invalid();

  await createSession(user.id);

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await destroySession();
  return NextResponse.json({ ok: true });
}

