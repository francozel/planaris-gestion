import { NextResponse } from "next/server";
import { getActorWithRoles, getSocioActor } from "@/lib/api-auth";

type RetiroBody = {
  id?: string;
  fecha?: string;
  usuario_id?: string;
  tipo?: string;
  medio_pago?: string;
  importe?: number;
  estado?: string;
};

export async function GET(request: Request) {
  const auth = await getActorWithRoles(request, ["socio", "administracion"]);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await auth.supabaseAdmin
    .from("retiros_socios")
    .select("*, usuarios(nombre)")
    .order("fecha", { ascending: false });

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

  const body = (await request.json()) as RetiroBody;
  const payload = {
    fecha: body.fecha,
    usuario_id: body.usuario_id,
    tipo: body.tipo,
    medio_pago: body.medio_pago,
    importe: Number(body.importe || 0),
    estado: body.estado || "Registrado",
  };

  if (!payload.fecha || !payload.usuario_id || !payload.tipo || !payload.medio_pago) {
    return NextResponse.json(
      { error: "Fecha, socio, motivo y medio son obligatorios" },
      { status: 400 }
    );
  }

  if (payload.importe <= 0) {
    return NextResponse.json(
      { error: "El importe debe ser mayor a cero" },
      { status: 400 }
    );
  }

  const { error } = await auth.supabaseAdmin
    .from("retiros_socios")
    .insert(payload);

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
    .from("retiros_socios")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
