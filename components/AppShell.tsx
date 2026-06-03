"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { canAccess, getDefaultRoute } from "@/lib/permissions";

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, user } = useAuth();
  const isLogin = pathname === "/login";

  useEffect(() => {
    if (loading) return;

    if (!user && !isLogin) {
      router.replace("/login");
      return;
    }

    if (user && isLogin) {
      router.replace(getDefaultRoute(user.rol));
      return;
    }

    if (user && !canAccess(user.rol, pathname)) {
      router.replace(getDefaultRoute(user.rol));
    }
  }, [isLogin, loading, pathname, router, user]);

  if (isLogin) {
    return <main className="min-h-screen bg-zinc-100">{children}</main>;
  }

  if (loading || !user || !canAccess(user.rol, pathname)) {
    return (
      <main className="min-h-screen bg-zinc-100 grid place-items-center">
        <p className="text-zinc-500">Cargando...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 flex">
      <Sidebar />

      <section className="flex-1 p-10">{children}</section>
    </main>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ShellContent>{children}</ShellContent>
    </AuthProvider>
  );
}
