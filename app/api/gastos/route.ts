import { NextResponse } from "next/server";
import { getActorWithRoles, getSocioActor } from "@/lib/api-auth";

type GastoBody = {
  id?: string;
  usuario_id?: string | null;
  fecha?: string;
  categoria?: string;
  descripcion?: string;
  proveedor?: string;
  cuit?: string;
  tipo_comprobante?: string;
  importe_neto?: number;
  iva?: number;
  otros_impuestos?: number;
  importe_total?: number;
  estado?: string;
};

function gastoPayload(body: GastoBody) {
  const neto = Number(body.importe_neto || 0);
  const iva = Number(body.iva || 0);
  const otros = Number(body.otros_impuestos || 0);

  return {
    usuario_id: body.usuario_id || null,
    fecha: body.fecha,
    categoria: body.categoria?.trim() || "",
    descripcion: body.descripcion?.trim() || "",
    proveedor: body.proveedor?.trim() || "",
    cuit: body.cuit?.trim() || "",
    tipo_comprobante: body.tipo_comprobante || "Sin comprobante",
    importe_neto: neto,
    iva,
    otros_impuestos: otros,
    importe_total: neto + iva + otros,
    estado: body.estado || "Pendiente",
  };
}

function gastoDatabaseError(message: string) {
  if (
    message.includes("usuario_id") &&
    message.includes("not-null constraint")
  ) {
    return "La base de datos todavia exige seleccionar un usuario. Ejecuta la migracion sql/permitir_gastos_sin_usuario.sql para registrar gastos de Proveedores / Planaris.";
  }

  return message;
}

export async function POST(request: Request) {
  const auth = await getActorWithRoles(request, [
    "socio",
    "administracion",
    "usuario",
  ]);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const payload = {
    ...gastoPayload((await request.json()) as GastoBody),
    reintegrado: false,
  };

  if (!payload.fecha || payload.importe_total <= 0) {
    return NextResponse.json(
      { error: "Fecha e importe son obligatorios" },
      { status: 400 }
    );
  }

  const { error } = await auth.supabaseAdmin.from("gastos").insert(payload);

  if (error) {
    return NextResponse.json(
      { error: gastoDatabaseError(error.message) },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const auth = await getSocioActor(request);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as GastoBody;

  if (!body.id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const payload = gastoPayload(body);

  const { data, error } = await auth.supabaseAdmin
    .from("gastos")
    .update(payload)
    .eq("id", body.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: gastoDatabaseError(error.message) },
      { status: 400 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "No se encontro el gasto para editar" },
      { status: 404 }
    );
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

  const { data, error } = await auth.supabaseAdmin
    .from("gastos")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "No se encontro el gasto para borrar" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
