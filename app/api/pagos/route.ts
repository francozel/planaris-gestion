import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signedAmount } from "@/lib/accounting";
import { getActorWithRoles, getSocioActor } from "@/lib/api-auth";

type PagoBody = {
  fecha?: string;
  tipo?: "compra" | "gasto";
  referencia_id?: string;
  beneficiario?: string | null;
  importe?: number;
  medio_pago?: string;
  observaciones?: string;
  banco?: string;
  numero_cheque?: string;
  fecha_emision?: string | null;
  fecha_pago?: string | null;
  imputaciones?: Array<{
    tipo: "compra" | "gasto";
    referencia_id: string;
    beneficiario?: string | null;
    importe: number;
  }>;
};

async function actualizarReferencia(
  supabaseAdmin: SupabaseClient,
  tipo: "compra" | "gasto",
  referenciaId: string
) {
  const { data: pagos, error: pagosError } = await supabaseAdmin
    .from("pagos")
    .select("importe")
    .eq("tipo", tipo)
    .eq("referencia_id", referenciaId);

  if (pagosError) return pagosError.message;

  const pagado = (pagos || []).reduce(
    (acc, pago) => acc + Number(pago.importe || 0),
    0
  );

  if (tipo === "compra") {
    const { data: compra, error: refError } = await supabaseAdmin
      .from("compras")
      .select("id, tipo_comprobante, importe")
      .eq("id", referenciaId)
      .maybeSingle();

    if (refError) return refError.message;
    if (!compra) return "No se encontro la referencia";

    const total = Math.abs(
      signedAmount(compra.tipo_comprobante, Number(compra.importe || 0))
    );
    const pagadoAbs = Math.abs(pagado);
    const { error } = await supabaseAdmin
      .from("compras")
      .update({
        estado:
          pagadoAbs >= total
            ? "Pagada"
            : pagadoAbs > 0
            ? "Parcial"
            : "Pendiente",
      })
      .eq("id", referenciaId);

    return error?.message || null;
  }
  const { data: gasto, error: refError } = await supabaseAdmin
    .from("gastos")
    .select("id, importe_total")
    .eq("id", referenciaId)
    .maybeSingle();

  if (refError) return refError.message;
  if (!gasto) return "No se encontro la referencia";

  const total = Number(gasto.importe_total || 0);
  const reintegrado = pagado >= total;
  const { error } = await supabaseAdmin
    .from("gastos")
    .update({
      estado: reintegrado ? "Reintegrado" : pagado > 0 ? "Parcial" : "Pendiente",
      reintegrado,
    })
    .eq("id", referenciaId);

  return error?.message || null;
}

export async function GET(request: Request) {
  const auth = await getActorWithRoles(request, ["socio", "administracion"]);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  const query = auth.supabaseAdmin
    .from("pagos")
    .select("*")
    .order("fecha", { ascending: false });

  const { data, error } = id
    ? await query.eq("id", id).maybeSingle()
    : await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (id && !data) {
    return NextResponse.json(
      { error: "No se encontro el pago" },
      { status: 404 }
    );
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const auth = await getSocioActor(request);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as PagoBody;
  const imputaciones =
    body.imputaciones && body.imputaciones.length > 0
      ? body.imputaciones
      : body.tipo && body.referencia_id
      ? [
          {
            tipo: body.tipo,
            referencia_id: body.referencia_id,
            beneficiario: body.beneficiario,
            importe: Number(body.importe || 0),
          },
        ]
      : [];

  if (imputaciones.length === 0) {
    return NextResponse.json(
      { error: "Agrega al menos una imputacion" },
      { status: 400 }
    );
  }

  const payloads = imputaciones.map((imputacion) => ({
    fecha: body.fecha,
    tipo: imputacion.tipo,
    referencia_id: imputacion.referencia_id,
    beneficiario: imputacion.beneficiario || body.beneficiario,
    importe: Number(imputacion.importe || 0),
    medio_pago: body.medio_pago,
    observaciones: body.observaciones?.trim() || "",
    banco: body.banco?.trim() || "",
    numero_cheque: body.numero_cheque?.trim() || "",
    fecha_emision: body.fecha_emision || null,
    fecha_pago: body.fecha_pago || null,
  }));

  const { data, error } = await auth.supabaseAdmin
    .from("pagos")
    .insert(payloads)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  for (const imputacion of imputaciones) {
    const refError = await actualizarReferencia(
      auth.supabaseAdmin,
      imputacion.tipo,
      imputacion.referencia_id
    );

    if (refError) {
      return NextResponse.json({ error: refError }, { status: 400 });
    }
  }

  return NextResponse.json({ id: data?.[0]?.id || null });
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

  const { data: pago, error: getError } = await auth.supabaseAdmin
    .from("pagos")
    .select("id, tipo, referencia_id")
    .eq("id", id)
    .maybeSingle();

  if (getError) {
    return NextResponse.json({ error: getError.message }, { status: 400 });
  }

  if (!pago) {
    return NextResponse.json(
      { error: "No se encontro el pago" },
      { status: 404 }
    );
  }

  const { error } = await auth.supabaseAdmin.from("pagos").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const refError = await actualizarReferencia(
    auth.supabaseAdmin,
    pago.tipo,
    pago.referencia_id
  );

  if (refError) {
    return NextResponse.json({ error: refError }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
