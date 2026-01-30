import { z } from "zod";
import { DateISOSchema, IdSchema, MoneySchema } from "./common";

export const CrearCierreRequestSchema = z.object({
  localId: IdSchema,
  fecha: DateISOSchema,
});

export const CierreResponseSchema = z.object({
  localId: IdSchema,
  fecha: DateISOSchema,
  total: MoneySchema,
});
