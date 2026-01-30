import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/src/lib/db";
import { requireAuth } from "@/src/auth/requireAuth";

import PresetsConfigClient from "./PresetsConfigClient";

export default async function Page() {
  const user = await requireAuth();

  const localId = cookies().get("rinde_local")?.value;
  if (!localId) redirect("/home");

  const ul = await prisma.userLocal.findFirst({
    where: { userId: user.id, localId, isActive: true, local: { isActive: true } },
    select: { rol: true },
  });

  if (!ul) redirect("/home");

  if (ul.rol !== "ADMIN") {
    return (
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Config · Presets</h1>

        <div style={{ padding: 12, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Sin permisos</div>
          <div style={{ opacity: 0.8 }}>Rol actual: {String(ul.rol)}</div>
          <div style={{ opacity: 0.8, marginTop: 6 }}>Solo ADMIN puede entrar a Config.</div>
        </div>

        <Link href="/home" style={{ textDecoration: "underline" }}>
          Volver a Home
        </Link>
      </div>
    );
  }

  const presets = await prisma.preset.findMany({
    where: {
      isActive: true,
      OR: [{ scope: "GLOBAL", localId: null }, { scope: "LOCAL", localId }],
    },
    orderBy: [{ orden: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      scope: true,
      localId: true,
      nombre: true,
      orden: true,
      isActive: true,
      updatedAt: true,
    },
  });

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Config · Presets</h1>
          <div style={{ opacity: 0.7, marginTop: 4 }}>Local activo: {localId}</div>
        </div>

        <Link href="/home" style={{ textDecoration: "underline" }}>
          Volver
        </Link>
      </div>

      <PresetsConfigClient localId={localId} initialPresets={presets} />
    </div>
  );
}
