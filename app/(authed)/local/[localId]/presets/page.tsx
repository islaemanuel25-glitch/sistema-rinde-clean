import { requireAuth } from "@/src/auth/requireAuth";
import { getActiveLocalId, setActiveLocalId } from "@/src/auth/localSession";
import { redirect } from "next/navigation";
import PresetsClient from "./PresetsClient";

export default async function PresetsPage({
  params,
}: {
  params: { localId: string };
}) {
  const user = await requireAuth();

  const active = getActiveLocalId();

  // Si no hay local activo, lo seteamos
  if (!active) {
    setActiveLocalId(params.localId);
  }

  // Si hay local activo distinto → NO se permite seguir
  if (active && active !== params.localId) {
    redirect("/home");
  }

  return <PresetsClient localId={params.localId} />;
}
