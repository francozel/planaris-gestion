export type UserRole = "socio" | "administracion" | "usuario" | "admin";

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
  | "/usuarios"
  | "/mi-cuenta";

export const roleLabels: Record<UserRole, string> = {
  socio: "Socio",
  administracion: "Administracion",
  usuario: "Usuario",
  admin: "Admin de usuarios",
};

export const roleDescriptions: Record<UserRole, string> = {
  socio: "Acceso completo",
  administracion: "Acceso completo con restriccion a retiros",
  usuario: "Solo acceso a gastos",
  admin: "Solo gestion de usuarios y contrasenas",
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
    "/mi-cuenta",
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
    "/mi-cuenta",
  ],
  usuario: ["/gastos", "/mi-cuenta"],
  admin: ["/usuarios"],
};

export function normalizeRole(role: string | null | undefined): UserRole {
  if (
    role === "socio" ||
    role === "administracion" ||
    role === "usuario" ||
    role === "admin"
  ) {
    return role;
  }

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
