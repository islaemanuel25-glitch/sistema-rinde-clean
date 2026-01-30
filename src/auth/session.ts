import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/src/lib/db";
import { clearActiveLocalId } from "./localSession";

const COOKIE_NAME = "rinde_session";
const SESSION_DAYS = 14;

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function getSessionCookie() {
  return cookies().get(COOKIE_NAME)?.value ?? null;
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(token);

  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: { userId, tokenHash, expiresAt },
  });

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const token = getSessionCookie();
  if (token) {
    const tokenHash = sha256(token);
    await prisma.session.deleteMany({ where: { tokenHash } });
  }

  // borra sesión cookie
  cookies().set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });

  // borra local activo también (regla del paso 2)
  clearActiveLocalId();
}

export async function getCurrentUser() {
  const token = getSessionCookie();
  if (!token) return null;

  const tokenHash = sha256(token);

  const session = await prisma.session.findFirst({
    where: { tokenHash, expiresAt: { gt: new Date() } },
    include: { user: true },
  });

  if (!session) return null;
  if (!session.user.isActive) return null;

  return session.user;
}
