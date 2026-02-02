import type { ReactNode } from "react";
import { requireAuth } from "@/src/auth/requireAuth";
import { BackToHomeBar } from "./_components/BackToHomeBar";

export default async function AuthedLayout({ children }: { children: ReactNode }) {
  // Mantiene el comportamiento actual: si no hay sesión, requireAuth redirige / lanza.
  await requireAuth();

  return (
    <>
      <BackToHomeBar />
      {children}
    </>
  );
}
