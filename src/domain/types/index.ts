import { z } from "zod";
import * as S from "../zod";

export type Id = z.infer<typeof S.IdSchema>;
export type DateISO = z.infer<typeof S.DateISOSchema>;
export type Money = z.infer<typeof S.MoneySchema>;

export type Local = z.infer<typeof S.LocalSchema>;
export type LocalListResponse = z.infer<typeof S.LocalListResponseSchema>;

export type Accion = z.infer<typeof S.AccionSchema>;
export type AccionLocal = z.infer<typeof S.AccionLocalSchema>;
export type Preset = z.infer<typeof S.PresetSchema>;
export type PresetItem = z.infer<typeof S.PresetItemSchema>;
export type Socio = z.infer<typeof S.SocioSchema>;
export type ItemsBootstrapResponse = z.infer<typeof S.ItemsBootstrapResponseSchema>;

export type HojaQuery = z.infer<typeof S.HojaQuerySchema>;
export type Movimiento = z.infer<typeof S.MovimientoSchema>;
export type HojaRangoResponse = z.infer<typeof S.HojaRangoResponseSchema>;

export type LoginRequest = z.infer<typeof S.LoginRequestSchema>;
export type SessionResponse = z.infer<typeof S.SessionResponseSchema>;

export type CrearCierreRequest = z.infer<typeof S.CrearCierreRequestSchema>;
export type CierreResponse = z.infer<typeof S.CierreResponseSchema>;
