"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Wallet,
  ArrowUpCircle,
  Users,
  Building2,
  CreditCard,
  Landmark,
  Truck,
  FileBarChart,
  Banknote,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { getAllowedRoutes, roleDescriptions, roleLabels } from "@/lib/permissions";

const items = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Ventas", href: "/ventas", icon: ShoppingCart },
  { label: "Cobros", href: "/cobros", icon: Landmark },
  { label: "Compras", href: "/compras", icon: Receipt },
  { label: "Pagos", href: "/pagos", icon: CreditCard },
  { label: "Gastos", href: "/gastos", icon: Wallet },
  { label: "Retiros", href: "/retiros", icon: ArrowUpCircle },
  { label: "Clientes", href: "/clientes", icon: Building2 },
  { label: "Proveedores", href: "/proveedores", icon: Truck },
  { label: "Bancos", href: "/bancos", icon: Banknote },
  { label: "Reportes", href: "/reportes", icon: FileBarChart },
  { label: "Usuarios", href: "/usuarios", icon: Users },
];

export default function Sidebar() {
  const { user, signOut } = useAuth();
  const allowedRoutes = user ? getAllowedRoutes(user.rol) : [];
  const visibleItems = items.filter((item) =>
    allowedRoutes.includes(item.href as (typeof allowedRoutes)[number])
  );

  return (
    <aside className="w-full md:w-64 bg-black text-white p-3 md:p-6 flex flex-col md:min-h-screen md:sticky md:top-0">
      <div className="hidden md:block mb-10">
        <img
  src="/logo-planaris.png"
  alt="Planaris"
  className="w-full h-auto object-contain"
/>
      </div>

      <nav className="flex md:flex-col gap-2 md:gap-3 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
        {visibleItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex flex-none items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl hover:bg-zinc-800 transition text-sm md:text-base"
            >
              <Icon size={20} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="md:hidden flex items-center justify-between gap-3 pt-3 border-t border-zinc-800">
          <div className="min-w-0">
            <p className="font-semibold truncate">{user.email}</p>
            <p className="text-xs text-zinc-500 truncate">{user.nombre}</p>
            <p className="text-xs text-zinc-400">{roleLabels[user.rol]}</p>
          </div>
          <button
            onClick={signOut}
            className="flex-none border border-zinc-700 rounded-lg px-3 py-2 text-sm hover:bg-zinc-800 transition"
          >
            Salir
          </button>
        </div>
      )}

      {user && (
        <div className="hidden md:block mt-auto pt-6 border-t border-zinc-800">
          <p className="font-semibold break-all">{user.email}</p>
          <p className="text-xs text-zinc-500">{user.nombre}</p>
          <p className="text-sm text-zinc-400">{roleLabels[user.rol]}</p>
          <p className="text-xs text-zinc-500 mt-1">
            {roleDescriptions[user.rol]}
          </p>
          <button
            onClick={signOut}
            className="mt-4 w-full border border-zinc-700 rounded-xl px-4 py-2 text-left hover:bg-zinc-800 transition"
          >
            Cerrar sesion
          </button>
        </div>
      )}
    </aside>
  );
}
