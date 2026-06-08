import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const [emailArg, passwordArg, nameArg = "Administrador"] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();
const password = passwordArg?.trim();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !password || password.length < 6) {
  throw new Error("Uso: node scripts/create-admin.mjs email password [nombre]");
}

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: usersData, error: listError } =
  await supabase.auth.admin.listUsers();

if (listError) throw listError;

const existing = usersData.users.find(
  (user) => user.email?.toLowerCase() === email
);

if (existing) {
  const { error } = await supabase.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    user_metadata: { nombre: nameArg, rol: "admin" },
  });
  if (error) throw error;
} else {
  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre: nameArg, rol: "admin" },
  });
  if (error) throw error;
}

const { error: profileError } = await supabase.from("usuarios").upsert(
  {
    nombre: nameArg,
    email,
    rol: "admin",
    activo: true,
  },
  { onConflict: "email" }
);

if (profileError) throw profileError;

const { data: profile, error: verifyError } = await supabase
  .from("usuarios")
  .select("email, rol, activo")
  .eq("email", email)
  .single();

if (verifyError) throw verifyError;
if (profile.rol !== "admin" || profile.activo !== true) {
  throw new Error("El perfil fue creado pero no quedo configurado como admin activo");
}

console.log(`Admin verificado: ${profile.email} - rol ${profile.rol}`);
