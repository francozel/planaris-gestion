import "./globals.css";
import AppShell from "@/components/AppShell";

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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
