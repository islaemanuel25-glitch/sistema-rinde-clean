import { redirect } from "next/navigation";
import { getCurrentUser } from "./session";

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

