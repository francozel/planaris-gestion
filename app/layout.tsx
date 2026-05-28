import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata = {
  title: "Planaris Gestión",
  description: "Sistema de administración",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <main className="min-h-screen bg-zinc-100 flex">
          <Sidebar />

          <section className="flex-1 p-10">
            {children}
          </section>
        </main>
      </body>
    </html>
  );
}