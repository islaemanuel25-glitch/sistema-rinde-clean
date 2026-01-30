import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/src/lib/db";
import { requireAuth } from "@/src/auth/requireAuth";

import AccionesConfigClient from "./AccionesConfigClient";

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
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Config · Acciones</h1>

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

  const rows = await prisma.accionLocal.findMany({
    where: { localId, accion: { isActive: true } },
    orderBy: [{ orden: "asc" }, { updatedAt: "desc" }],
    select: {
      accionId: true,
      isEnabled: true,
      orden: true,
      tipoOverride: true,
      impactaTotal: true,
      impactaTotalDesde: true,
      usaTurnoOverride: true,
      usaNombreOverride: true,
      accion: {
        select: {
          nombre: true,
          tipoDefault: true,
          impactaTotalDefault: true,
          usaTurno: true,
          usaNombre: true,
          categoria: true,
        },
      },
    },
  });

  const acciones = rows.map((r) => ({
    accionId: r.accionId,
    nombre: r.accion.nombre,
    categoria: r.accion.categoria,

    isEnabled: r.isEnabled,
    orden: r.orden,

    tipoOverride: r.tipoOverride, // ENTRADA | SALIDA | null
    usaTurnoOverride: r.usaTurnoOverride, // boolean | null
    usaNombreOverride: r.usaNombreOverride, // boolean | null
    impactaTotal: r.impactaTotal,
    impactaTotalDesde: r.impactaTotalDesde.toISOString().slice(0, 10),

    defaults: {
      tipoDefault: r.accion.tipoDefault,
      impactaTotalDefault: r.accion.impactaTotalDefault,
      usaTurno: r.accion.usaTurno,
      usaNombre: r.accion.usaNombre,
    },
  }));

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Config · Acciones</h1>
          <div style={{ opacity: 0.7, marginTop: 4 }}>Local activo: {localId}</div>
        </div>

        <Link href="/home" style={{ textDecoration: "underline" }}>
          Volver
        </Link>
      </div>

      <AccionesConfigClient localId={localId} initialAcciones={acciones} />
    </div>
  );
}
