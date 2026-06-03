import { NextResponse } from "next/server";
import { getSocioActor } from "@/lib/api-auth";

type GastoBody = {
  id?: string;
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

export async function PUT(request: Request) {
  const auth = await getSocioActor(request);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as GastoBody;

  if (!body.id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const neto = Number(body.importe_neto || 0);
  const iva = Number(body.iva || 0);
  const otros = Number(body.otros_impuestos || 0);

  const { data, error } = await auth.supabaseAdmin
    .from("gastos")
    .update({
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
    })
    .eq("id", body.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
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
