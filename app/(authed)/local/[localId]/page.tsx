import { requireLocalContext } from "@/app/lib/rinde/requireLocalContext";
import LocalHojaClient from "./LocalHojaClient";

export default async function Page({ params }: { params: { localId: string } }) {
  // Valida sesión, cookie rinde_local y permisos del usuario en el local
  await requireLocalContext(params.localId);

  return (
    <main className="w-full">
      <LocalHojaClient localId={params.localId} />
    </main>
  );
}
