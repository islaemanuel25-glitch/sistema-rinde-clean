import "./globals.css";

export const metadata = {
  title: "Sistema Rinde",
  description: "Control diario del local",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full bg-slate-50 text-slate-900 antialiased">
        {/* App Shell (mobile-first) */}
        <div className="min-h-screen">
          {/* Centered mobile container */}
          <div className="mx-auto w-full max-w-md px-3 py-4">{children}</div>
        </div>
      </body>
    </html>
  );
}
