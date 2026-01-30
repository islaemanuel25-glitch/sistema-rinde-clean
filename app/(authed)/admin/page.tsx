import Link from "next/link";

const items = [
  {
    title: "Acciones",
    desc: "Gestioná acciones del sistema",
    href: "/admin/config/acciones",
  },
  {
    title: "Presets",
    desc: "Plantillas rápidas de carga",
    href: "/admin/config/presets",
  },
  {
    title: "Socios",
    desc: "Configuración de socios y reparto",
    href: "/admin/config/socios",
  },
];

export default function AdminHomePage() {
  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="text-sm text-neutral-500">
          Configuración del sistema
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-2xl border bg-white p-4 active:scale-[0.98] transition"
          >
            <div className="text-base font-semibold">
              {item.title}
            </div>
            <div className="text-sm text-neutral-500 mt-1">
              {item.desc}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
