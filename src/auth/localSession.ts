import { cookies } from "next/headers";

const LOCAL_COOKIE = "rinde_local";
const LOCAL_DAYS = 14;

export function getActiveLocalId() {
  return cookies().get(LOCAL_COOKIE)?.value ?? null;
}

export function setActiveLocalId(localId: string) {
  const expires = new Date(Date.now() + LOCAL_DAYS * 24 * 60 * 60 * 1000);

  cookies().set(LOCAL_COOKIE, localId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export function clearActiveLocalId() {
  cookies().set(LOCAL_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}
