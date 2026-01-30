import { z } from "zod";
import { DateTimeISOSchema, IdSchema } from "./common";

// Enums Prisma
export const RolLocalSchema = z.enum(["ADMIN", "OPERATIVO", "LECTURA"]);
export const ScopePresetSchema = z.enum(["GLOBAL", "LOCAL"]);
export const TipoMovimientoSchema = z.enum(["ENTRADA", "SALIDA"]);
export const TurnoSchema = z.enum(["MANIANA", "TARDE", "NOCHE"]);
export const CategoriaAccionSchema = z.enum([
  "TURNO",
  "DEPOSITO",
  "ELECTRONICO",
  "SOCIO",
  "OTROS",
]);
export const PresetItemTipoSchema = z.enum(["ACCION", "CATEGORIA", "SOCIO"]);

// Modelos
export const AccionSchema = z.object({
  id: IdSchema,
  nombre: z.string(),
  descripcion: z.string().nullable().optional(),
  tipoDefault: TipoMovimientoSchema,
  impactaTotalDefault: z.boolean(),
  usaTurno: z.boolean(),
  usaNombre: z.boolean(),
  requierePermisoEspecial: z.boolean(),
  categoria: CategoriaAccionSchema,
  isActive: z.boolean(),
  createdAt: DateTimeISOSchema,
  updatedAt: DateTimeISOSchema,
});

export const AccionLocalSchema = z.object({
  id: IdSchema,
  localId: IdSchema,
  accionId: IdSchema,
  isEnabled: z.boolean(),
  orden: z.number().int(),

  tipoOverride: TipoMovimientoSchema.nullable().optional(),
  impactaTotal: z.boolean(),
  impactaTotalDesde: DateTimeISOSchema,

  usaTurnoOverride: z.boolean().nullable().optional(),
  usaNombreOverride: z.boolean().nullable().optional(),

  updatedAt: DateTimeISOSchema,
});

export const PresetSchema = z.object({
  id: IdSchema,
  scope: ScopePresetSchema,
  localId: IdSchema.nullable().optional(),
  nombre: z.string(),
  orden: z.number().int(),
  isActive: z.boolean(),
  createdAt: DateTimeISOSchema,
  updatedAt: DateTimeISOSchema,
});

export const PresetItemSchema = z.object({
  id: IdSchema,
  presetId: IdSchema,
  tipo: PresetItemTipoSchema,
  accionId: IdSchema.nullable().optional(),
  categoria: CategoriaAccionSchema.nullable().optional(),
  socioId: IdSchema.nullable().optional(),
  orden: z.number().int(),
});

export const SocioSchema = z.object({
  id: IdSchema,
  localId: IdSchema,
  nombre: z.string(),
  isActive: z.boolean(),
});

// “Bootstrap” para cargar todo lo necesario del lado UI (catálogos)
export const ItemsBootstrapResponseSchema = z.object({
  acciones: z.array(AccionSchema),
  accionesLocal: z.array(AccionLocalSchema),
  presets: z.array(PresetSchema),
  presetItems: z.array(PresetItemSchema),
  socios: z.array(SocioSchema),
});
