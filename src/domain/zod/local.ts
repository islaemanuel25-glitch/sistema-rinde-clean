import { z } from "zod";
import { DateTimeISOSchema, IdSchema } from "./common";
import { RolLocalSchema } from "./item";

export const LocalSchema = z.object({
  id: IdSchema,
  nombre: z.string(),
  isActive: z.boolean(),
  createdAt: DateTimeISOSchema,
  updatedAt: DateTimeISOSchema,
});

export const LocalListResponseSchema = z.object({
  items: z.array(LocalSchema),
});

export const UserLocalSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  localId: IdSchema,
  rol: RolLocalSchema,
  isActive: z.boolean(),
});
