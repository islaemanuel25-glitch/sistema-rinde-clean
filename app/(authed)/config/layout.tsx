import Link from "next/link";
import type { ReactNode } from "react";

export default function ConfigLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-3 pb-28 pt-4">
      <Link
        href="/home"
        className="inline-flex items-center gap-1 text-sm font-extrabold text-slate-700 hover:text-slate-900"
      >
        ← Volver
      </Link>

      <div className="mt-3">{children}</div>
    </div>
  );
}
