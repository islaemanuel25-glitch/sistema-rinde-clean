"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // opcional (si querés año)
  const [year, setYear] = useState<number | null>(null);
  useEffect(() => setYear(new Date().getFullYear()), []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setError(data?.error ?? "Credenciales inválidas");
      setLoading(false);
      return;
    }

    router.replace("/home");
  }

  return (
    <main className="min-h-[calc(100vh-2rem)] flex items-center">
      <div className="w-full">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-4">
            <div className="text-3xl font-extrabold tracking-tight text-slate-900">Sistema Rinde</div>
            <div className="mt-1 text-sm font-medium text-slate-600">Ingresá para continuar</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="px-4 pt-4 pb-3">
              <div className="text-base font-extrabold text-slate-900">Ingresar</div>
              <div className="mt-0.5 text-xs font-medium text-slate-500">Usá tu email y contraseña</div>
            </div>

            <form onSubmit={onSubmit} className="px-4 pb-4 space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-900">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  inputMode="email"
                  autoComplete="email"
                  placeholder="tu@email.com"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-900">Contraseña</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </div>

              {error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
                  {error}
                </div>
              ) : null}

              <button
                disabled={loading}
                type="submit"
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-base font-extrabold text-white shadow-sm disabled:bg-slate-200 disabled:text-slate-700"
              >
                {loading ? "Ingresando..." : "Ingresar"}
              </button>

              <div className="pt-2 text-center text-xs font-medium text-slate-500">
                Si no podés ingresar, revisá email/contraseña.
              </div>
            </form>
          </div>

          <div className="mt-4 text-center text-xs font-medium text-slate-500">
            © {year ?? "—"} Sistema Rinde
          </div>
        </div>
      </div>
    </main>
  );
}
