import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeRole, type UserRole } from "@/lib/permissions";

export async function getActorWithRoles(
  request: Request,
  allowedRoles: UserRole[]
) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.replace("Bearer ", "").trim()
    : "";

  if (!token || token === "undefined" || token === "null") {
    return { error: "No autorizado: falta token de sesion", status: 401 as const };
  }

  let supabaseAdmin;

  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch {
    return {
      error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor",
      status: 500 as const,
    };
  }

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.getUser(token);

  if (authError || !authData.user.email) {
    return {
      error: `No autorizado: token invalido o vencido${
        authError?.message ? ` (${authError.message})` : ""
      }`,
      status: 401 as const,
    };
  }

  const { data: actor } = await supabaseAdmin
    .from("usuarios")
    .select("rol, activo")
    .eq("email", authData.user.email)
    .maybeSingle();

  if (!actor?.activo || !allowedRoles.includes(normalizeRole(actor.rol))) {
    return {
      error: "Sin permisos: el usuario no es socio o esta inactivo",
      status: 403 as const,
    };
  }

  return { supabaseAdmin };
}

export async function getSocioActor(request: Request) {
  return getActorWithRoles(request, ["socio"]);
}
