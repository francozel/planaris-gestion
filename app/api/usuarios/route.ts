import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getActorWithRoles } from "@/lib/api-auth";
import { normalizeRole, type UserRole } from "@/lib/permissions";

type CreateUserBody = {
  nombre?: string;
  email?: string;
  password?: string;
  rol?: UserRole;
};

type ResetPasswordBody = {
  email?: string;
};

export async function GET(request: Request) {
  const auth = await getActorWithRoles(request, [
    "socio",
    "administracion",
    "usuario",
  ]);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await auth.supabaseAdmin
    .from("usuarios")
    .select("id, nombre, email, rol, activo")
    .order("nombre");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let supabaseAdmin;

  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor" },
      { status: 500 }
    );
  }

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.getUser(token);

  if (authError || !authData.user.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: actor } = await supabaseAdmin
    .from("usuarios")
    .select("rol, activo")
    .eq("email", authData.user.email)
    .maybeSingle();

  const actorRole = normalizeRole(actor?.rol);

  if (!actor?.activo || (actorRole !== "socio" && actorRole !== "administracion")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = (await request.json()) as CreateUserBody;
  const nombre = body.nombre?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password?.trim();
  const rol = normalizeRole(body.rol);

  if (!nombre || !email || !password) {
    return NextResponse.json(
      { error: "Nombre, email y contrasena son obligatorios" },
      { status: 400 }
    );
  }

  const { error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, rol },
  });

  if (createAuthError) {
    return NextResponse.json(
      { error: createAuthError.message },
      { status: 400 }
    );
  }

  const { error: userError } = await supabaseAdmin.from("usuarios").upsert(
    {
      nombre,
      email,
      rol,
      activo: true,
    },
    { onConflict: "email" }
  );

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const auth = await getActorWithRoles(request, ["socio", "administracion"]);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as ResetPasswordBody;
  const email = body.email?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Email requerido" }, { status: 400 });
  }

  const redirectTo = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/login`
    : undefined;
  const { error } = await auth.supabaseAdmin.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let supabaseAdmin;

  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor" },
      { status: 500 }
    );
  }

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.getUser(token);

  if (authError || !authData.user.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: actor } = await supabaseAdmin
    .from("usuarios")
    .select("rol, activo")
    .eq("email", authData.user.email)
    .maybeSingle();

  if (!actor?.activo || normalizeRole(actor.rol) !== "socio") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Email requerido" }, { status: 400 });
  }

  const { data: usersData, error: listError } =
    await supabaseAdmin.auth.admin.listUsers();

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 400 });
  }

  const authUser = usersData.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase()
  );

  if (authUser) {
    const { error: deleteAuthError } =
      await supabaseAdmin.auth.admin.deleteUser(authUser.id);

    if (deleteAuthError) {
      return NextResponse.json(
        { error: deleteAuthError.message },
        { status: 400 }
      );
    }
  }

  const { error: deleteUserError } = await supabaseAdmin
    .from("usuarios")
    .delete()
    .eq("email", email);

  if (deleteUserError) {
    return NextResponse.json({ error: deleteUserError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
