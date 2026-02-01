import { requireAuth } from "@/src/auth/requireAuth";
import { getActiveLocalId } from "@/src/auth/localSession";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage({ params }: { params: { localId: string } }) {
  await requireAuth();

  const active = getActiveLocalId();
  if (!active) redirect("/home");
  if (active !== params.localId) redirect("/home");

  return (
    <main className="space-y-3">
      <div>
        <div className="text-2xl font-extrabold tracking-tight text-slate-900">Dashboard</div>
        <div className="mt-1 text-sm font-medium text-slate-600">
          Tendencia semanal y mensual
        </div>
      </div>

      <DashboardClient localId={params.localId} />
    </main>
  );
}
