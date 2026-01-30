import { z } from "zod";
import { DateTimeISOSchema, IdSchema } from "./common";

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const SessionUserSchema = z.object({
  id: IdSchema,
  email: z.string().email(),
  isActive: z.boolean(),
  createdAt: DateTimeISOSchema,
  updatedAt: DateTimeISOSchema,
});

export const SessionResponseSchema = z.object({
  user: SessionUserSchema,
});
