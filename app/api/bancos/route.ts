import { NextResponse } from "next/server";
import { getActorWithRoles, getSocioActor } from "@/lib/api-auth";

type BancoBody = {
  id?: string;
  nombre?: string;
  banco?: string;
  tipo_cuenta?: string;
  numero_cuenta?: string;
  moneda?: string;
  saldo_inicial?: number;
  saldo_actual?: number;
  activo?: boolean;
};

function bancoPayload(body: BancoBody) {
  return {
    nombre: body.nombre?.trim(),
    banco: body.banco?.trim(),
    tipo_cuenta: body.tipo_cuenta || "Cuenta corriente",
    numero_cuenta: body.numero_cuenta?.trim() || "",
    moneda: body.moneda || "ARS",
    saldo_inicial: Number(body.saldo_inicial || 0),
    saldo_actual: Number(body.saldo_actual || 0),
    activo: body.activo !== false,
  };
}

export async function GET(request: Request) {
  const auth = await getActorWithRoles(request, ["socio", "administracion"]);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await auth.supabaseAdmin
    .from("bancos")
    .select("*")
    .order("nombre");

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

  const payload = bancoPayload((await request.json()) as BancoBody);

  if (!payload.nombre || !payload.banco) {
    return NextResponse.json(
      { error: "Nombre y banco son obligatorios" },
      { status: 400 }
    );
  }

  const { error } = await auth.supabaseAdmin.from("bancos").insert(payload);

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

  const body = (await request.json()) as BancoBody;
  const payload = bancoPayload(body);

  if (!body.id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const { error } = await auth.supabaseAdmin
    .from("bancos")
    .update(payload)
    .eq("id", body.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const auth = await getSocioActor(request);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as { id?: string; delta?: number };

  if (!body.id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const { data: banco, error: bancoError } = await auth.supabaseAdmin
    .from("bancos")
    .select("saldo_actual")
    .eq("id", body.id)
    .maybeSingle();

  if (bancoError) {
    return NextResponse.json({ error: bancoError.message }, { status: 400 });
  }

  if (!banco) {
    return NextResponse.json(
      { error: "No se encontro el banco" },
      { status: 404 }
    );
  }

  const { error } = await auth.supabaseAdmin
    .from("bancos")
    .update({
      saldo_actual: Number(banco.saldo_actual || 0) + Number(body.delta || 0),
    })
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

  const { error } = await auth.supabaseAdmin.from("bancos").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
