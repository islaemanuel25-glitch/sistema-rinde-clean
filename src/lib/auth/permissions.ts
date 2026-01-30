import "server-only";
import type { LocalRol } from "./requireLocalContext";

export type Action =
  | "CONFIG_READ"
  | "CONFIG_WRITE"
  | "MOV_READ"
  | "MOV_WRITE";

const allow: Record<Action, LocalRol[]> = {
  CONFIG_READ: ["ADMIN"],
  CONFIG_WRITE: ["ADMIN"],
  MOV_READ: ["ADMIN", "OPERATIVO", "LECTURA"],
  MOV_WRITE: ["ADMIN", "OPERATIVO"],
};

export function assertRole(rol: LocalRol, action: Action) {
  if (!allow[action].includes(rol)) {
    throw new Response("Sin permisos.", { status: 403 });
  }
}
