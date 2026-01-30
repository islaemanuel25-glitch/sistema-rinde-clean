import { requireAuth } from "@/src/auth/requireAuth";
import { getActiveLocalId } from "@/src/auth/localSession";
import { redirect } from "next/navigation";
import PresetsClient from "./PresetsClient";

export default async function PresetsPage({ params }: { params: { localId: string } }) {
  await requireAuth();

  const active = getActiveLocalId();
  if (!active) redirect("/home");
  if (active !== params.localId) redirect("/home");

  return <PresetsClient localId={params.localId} />;
}
