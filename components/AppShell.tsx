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
  const isRecovery =
    typeof window !== "undefined" &&
    (window.location.hash.includes("type=recovery") ||
      window.location.search.includes("type=recovery"));

  useEffect(() => {
    if (loading) return;

    if (!user && !isLogin) {
      router.replace("/login");
      return;
    }

    if (user && isLogin && !isRecovery) {
      router.replace(getDefaultRoute(user.rol));
      return;
    }

    if (user && !canAccess(user.rol, pathname)) {
      router.replace(getDefaultRoute(user.rol));
    }
  }, [isLogin, isRecovery, loading, pathname, router, user]);

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
    <main className="app-shell min-h-screen bg-zinc-100 flex flex-col md:flex-row">
      <Sidebar />

      <section className="app-content flex-1 min-w-0 p-4 md:p-10">
        {children}
      </section>
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
