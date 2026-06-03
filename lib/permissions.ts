export type UserRole = "socio" | "administracion" | "usuario";

export type AppRoute =
  | "/dashboard"
  | "/ventas"
  | "/cobros"
  | "/compras"
  | "/pagos"
  | "/gastos"
  | "/retiros"
  | "/clientes"
  | "/proveedores"
  | "/bancos"
  | "/reportes"
  | "/usuarios";

export const roleLabels: Record<UserRole, string> = {
  socio: "Socio",
  administracion: "Administracion",
  usuario: "Usuario",
};

export const roleDescriptions: Record<UserRole, string> = {
  socio: "Acceso completo",
  administracion: "Acceso completo con restriccion a retiros",
  usuario: "Solo acceso a gastos",
};

const permissions: Record<UserRole, AppRoute[]> = {
  socio: [
    "/dashboard",
    "/ventas",
    "/cobros",
    "/compras",
    "/pagos",
    "/gastos",
    "/retiros",
    "/clientes",
    "/proveedores",
    "/bancos",
    "/reportes",
    "/usuarios",
  ],
  administracion: [
    "/dashboard",
    "/ventas",
    "/cobros",
    "/compras",
    "/pagos",
    "/gastos",
    "/clientes",
    "/proveedores",
    "/bancos",
    "/reportes",
    "/usuarios",
  ],
  usuario: ["/gastos"],
};

export function normalizeRole(role: string | null | undefined): UserRole {
  if (role === "socio" || role === "administracion" || role === "usuario") {
    return role;
  }

  if (role === "admin") return "administracion";

  return "usuario";
}

export function getAllowedRoutes(role: UserRole) {
  return permissions[role];
}

export function canAccess(role: UserRole, pathname: string) {
  if (pathname === "/login") return true;

  return permissions[role].some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export function getDefaultRoute(role: UserRole) {
  return permissions[role][0];
}

export function canManageRecords(role: UserRole | null | undefined) {
  return role === "socio";
}
