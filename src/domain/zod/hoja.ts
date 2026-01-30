import { z } from "zod";
import { DateISOSchema, DateTimeISOSchema, IdSchema, MoneySchema } from "./common";
import { TipoMovimientoSchema, TurnoSchema } from "./item";

export const HojaQuerySchema = z.object({
  localId: IdSchema,
  start: DateISOSchema,
  end: DateISOSchema,
});

// API contract de Movimiento (fecha como YYYY-MM-DD)
export const MovimientoSchema = z.object({
  id: IdSchema,
  localId: IdSchema,
  fecha: DateISOSchema,
  accionId: IdSchema,
  tipo: TipoMovimientoSchema,
  importe: MoneySchema,

  turno: TurnoSchema.nullable().optional(),
  nombre: z.string().nullable().optional(),
  socioId: IdSchema.nullable().optional(),

  createdByUserId: IdSchema,
  createdAt: DateTimeISOSchema,
});

export const HojaRangoResponseSchema = z.object({
  localId: IdSchema,
  start: DateISOSchema,
  end: DateISOSchema,
  movimientos: z.array(MovimientoSchema),
});
