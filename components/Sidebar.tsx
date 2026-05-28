"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Wallet,
  ArrowUpCircle,
  Users,
} from "lucide-react";

const items = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Ventas",
    href: "/ventas",
    icon: ShoppingCart,
  },
  {
    label: "Compras",
    href: "/compras",
    icon: Receipt,
  },
  {
    label: "Gastos",
    href: "/gastos",
    icon: Wallet,
  },
  {
    label: "Retiros",
    href: "/retiros",
    icon: ArrowUpCircle,
  },
  {
    label: "Usuarios",
    href: "/usuarios",
    icon: Users,
  },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-black text-white p-6 flex flex-col">
      <h1 className="text-2xl font-bold mb-10">
        Planaris
      </h1>

      <nav className="flex flex-col gap-3">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-zinc-800 transition"
            >
              <Icon size={20} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}