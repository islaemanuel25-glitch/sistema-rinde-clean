import { z } from "zod";

// Prisma cuid()
export const IdSchema = z.string().min(1);

// DateISO: YYYY-MM-DD (para usar en API)
export const DateISOSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "dateISO debe ser YYYY-MM-DD");

// DateTime ISO (createdAt/updatedAt, etc.)
export const DateTimeISOSchema = z.string().datetime();

// Prisma Decimal(Numeric(14,2)) -> string para evitar float
export const MoneySchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,2})?$/, "money debe ser decimal con hasta 2 decimales");

// Helpers API
export const OkSchema = z.object({ ok: z.literal(true) });
export const ErrorSchema = z.object({ ok: z.literal(false), error: z.string() });
