import { ReactNode } from "react";
import { requireAuth } from "@/src/auth/requireAuth";

export default async function AuthedLayout({ children }: { children: ReactNode }) {
  await requireAuth();
  return <>{children}</>;
}
