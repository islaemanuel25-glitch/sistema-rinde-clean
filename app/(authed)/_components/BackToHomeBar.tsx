"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BackToHomeBar() {
  const pathname = usePathname();

  // No mostrar en Home
  if (pathname === "/home") return null;

  // Estas ramas ya tienen su propio layout con volver
  if (pathname.startsWith("/admin/config")) return null;
  if (pathname.startsWith("/config")) return null;

  return (
    <div className="mx-auto w-full max-w-md px-3 pt-4">
      <Link
        href="/home"
        className="inline-flex items-center gap-1 text-sm font-extrabold text-slate-700 hover:text-slate-900"
      >
        ← Volver
      </Link>
    </div>
  );
}
