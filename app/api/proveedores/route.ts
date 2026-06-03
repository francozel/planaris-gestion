import { NextResponse } from "next/server";
import { getActorWithRoles, getSocioActor } from "@/lib/api-auth";

type ProveedorBody = {
  id?: string;
  cuit?: string;
  razon_social?: string;
  domicilio?: string | null;
  ciudad?: string | null;
  telefono?: string | null;
  email?: string | null;
  observaciones?: string | null;
  activo?: boolean;
};

function proveedorPayload(body: ProveedorBody) {
  return {
    cuit: body.cuit?.trim(),
    razon_social: body.razon_social?.trim(),
    domicilio: body.domicilio?.trim() || null,
    ciudad: body.ciudad?.trim() || null,
    telefono: body.telefono?.trim() || null,
    email: body.email?.trim() || null,
    observaciones: body.observaciones?.trim() || null,
    activo: body.activo !== false,
  };
}

export async function GET(request: Request) {
  const auth = await getActorWithRoles(request, ["socio", "administracion"]);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await auth.supabaseAdmin
    .from("proveedores")
    .select("*")
    .order("razon_social", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const auth = await getSocioActor(request);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const payload = proveedorPayload((await request.json()) as ProveedorBody);

  if (!payload.cuit || !payload.razon_social) {
    return NextResponse.json(
      { error: "CUIT y razon social son obligatorios" },
      { status: 400 }
    );
  }

  const { error } = await auth.supabaseAdmin.from("proveedores").insert(payload);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const auth = await getSocioActor(request);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as ProveedorBody;

  if (!body.id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const payload = proveedorPayload(body);
  const { error } = await auth.supabaseAdmin
    .from("proveedores")
    .update(payload)
    .eq("id", body.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await getSocioActor(request);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const { error } = await auth.supabaseAdmin
    .from("proveedores")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
