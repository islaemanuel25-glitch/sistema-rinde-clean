import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireLocalContextApi } from "@/app/lib/rinde/requireLocalContext";
import { ItemsBootstrapResponseSchema } from "@/src/domain/zod";

export async function GET(
  _: Request,
  { params }: { params: { localId: string } }
) {
  const gate = await requireLocalContextApi(params.localId);
  if (!gate.ok) return gate.res;
  const { localId } = gate.ctx;

  // Cargar todos los preset items de presets válidos para este local
  const presets = await prisma.preset.findMany({
    where: {
      isActive: true,
      OR: [{ scope: "GLOBAL" }, { scope: "LOCAL", localId }],
    },
    select: { id: true },
  });

  const presetIds = presets.map((p) => p.id);

  const presetItems = await prisma.presetItem.findMany({
    where: {
      presetId: { in: presetIds },
    },
    orderBy: [{ presetId: "asc" }, { orden: "asc" }],
    select: {
      id: true,
      presetId: true,
      tipo: true,
      accionId: true,
      categoria: true,
      socioId: true,
      orden: true,
    },
  });

  // Acciones habilitadas del local
  const accionesLocal = await prisma.accionLocal.findMany({
    where: { localId, isEnabled: true },
    orderBy: [{ orden: "asc" }],
    select: {
      id: true,
      localId: true,
      accionId: true,
      isEnabled: true,
      orden: true,
      tipoOverride: true,
      impactaTotal: true,
      impactaTotalDesde: true,
      usaTurnoOverride: true,
      usaNombreOverride: true,
      updatedAt: true,
    },
  });

  // Acciones base (solo las que están habilitadas en el local)
  const accionIds = accionesLocal.map((al) => al.accionId);
  const acciones = await prisma.accion.findMany({
    where: {
      id: { in: accionIds },
      isActive: true,
    },
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      tipoDefault: true,
      impactaTotalDefault: true,
      usaTurno: true,
      usaNombre: true,
      requierePermisoEspecial: true,
      categoria: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Presets (solo los válidos para el local)
  const presetsFull = await prisma.preset.findMany({
    where: {
      isActive: true,
      OR: [{ scope: "GLOBAL" }, { scope: "LOCAL", localId }],
    },
    orderBy: [{ scope: "desc" }, { orden: "asc" }, { nombre: "asc" }],
    select: {
      id: true,
      scope: true,
      localId: true,
      nombre: true,
      orden: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Socios del local
  const socios = await prisma.socio.findMany({
    where: { localId, isActive: true },
    select: {
      id: true,
      localId: true,
      nombre: true,
      isActive: true,
    },
  });

  const response = {
    acciones: acciones.map((a) => ({
      id: a.id,
      nombre: a.nombre,
      descripcion: a.descripcion,
      tipoDefault: a.tipoDefault,
      impactaTotalDefault: a.impactaTotalDefault,
      usaTurno: a.usaTurno,
      usaNombre: a.usaNombre,
      requierePermisoEspecial: a.requierePermisoEspecial,
      categoria: a.categoria,
      isActive: a.isActive,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
    accionesLocal: accionesLocal.map((al) => ({
      id: al.id,
      localId: al.localId,
      accionId: al.accionId,
      isEnabled: al.isEnabled,
      orden: al.orden,
      tipoOverride: al.tipoOverride,
      impactaTotal: al.impactaTotal,
      impactaTotalDesde: al.impactaTotalDesde.toISOString(),
      usaTurnoOverride: al.usaTurnoOverride,
      usaNombreOverride: al.usaNombreOverride,
      updatedAt: al.updatedAt.toISOString(),
    })),
    presets: presetsFull.map((p) => ({
      id: p.id,
      scope: p.scope,
      localId: p.localId,
      nombre: p.nombre,
      orden: p.orden,
      isActive: p.isActive,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    presetItems: presetItems.map((pi) => ({
      id: pi.id,
      presetId: pi.presetId,
      tipo: pi.tipo,
      accionId: pi.accionId,
      categoria: pi.categoria,
      socioId: pi.socioId,
      orden: pi.orden,
    })),
    socios: socios.map((s) => ({
      id: s.id,
      localId: s.localId,
      nombre: s.nombre,
      isActive: s.isActive,
    })),
  };

  const out = ItemsBootstrapResponseSchema.parse(response);
  return NextResponse.json(out);
}

