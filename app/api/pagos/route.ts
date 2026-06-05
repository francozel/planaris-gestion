import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signedAmount } from "@/lib/accounting";
import { getActorWithRoles, getSocioActor } from "@/lib/api-auth";

type Imputacion = {
  tipo: "compra" | "gasto";
  referencia_id: string;
  beneficiario?: string | null;
  importe: number;
};

type MedioPago = {
  medio_pago: string;
  importe: number;
  banco?: string;
  numero_operacion?: string;
  numero_cheque?: string;
  fecha_emision?: string | null;
  fecha_pago?: string | null;
};

type Retencion = {
  tipo: string;
  importe: number;
};

type PagoBody = {
  id?: string;
  orden_pago_id?: string;
  fecha?: string;
  tipo?: "compra" | "gasto";
  referencia_id?: string;
  beneficiario?: string | null;
  importe?: number;
  medio_pago?: string;
  observaciones?: string;
  banco?: string;
  numero_operacion?: string;
  numero_cheque?: string;
  fecha_emision?: string | null;
  fecha_pago?: string | null;
  imputaciones?: Imputacion[];
  medios?: MedioPago[];
  retenciones?: Retencion[];
};

const numeroOrden = (numero: number | string | null | undefined) =>
  `OP-${String(numero || 0).padStart(6, "0")}`;

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
      estado: reintegrado
        ? "Reintegrado"
        : pagado > 0
        ? "Parcial"
        : "Pendiente",
      reintegrado,
    })
    .eq("id", referenciaId);

  return error?.message || null;
}

async function detalleOrden(supabaseAdmin: SupabaseClient, id: string) {
  const { data: orden, error } = await supabaseAdmin
    .from("ordenes_pago")
    .select(
      "*, pagos(*), ordenes_pago_medios(*), ordenes_pago_retenciones(*)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) return { error: error.message };
  if (orden) return { data: orden };

  const { data: pago, error: pagoError } = await supabaseAdmin
    .from("pagos")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (pagoError) return { error: pagoError.message };
  if (!pago) return { error: "No se encontro la orden de pago", status: 404 };

  return {
    data: {
      id: pago.id,
      numero: null,
      fecha: pago.fecha,
      beneficiario: pago.beneficiario,
      observaciones: pago.observaciones,
      pagos: [pago],
      ordenes_pago_medios: [
        {
          id: pago.id,
          medio_pago: pago.medio_pago,
          importe: Math.abs(Number(pago.importe || 0)),
          banco: pago.banco,
          numero_cheque: pago.numero_cheque,
          fecha_emision: pago.fecha_emision,
          fecha_pago: pago.fecha_pago,
        },
      ],
      ordenes_pago_retenciones: [],
    },
  };
}

export async function GET(request: Request) {
  const auth = await getActorWithRoles(request, ["socio", "administracion"]);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const result = await detalleOrden(auth.supabaseAdmin, id);
    return NextResponse.json(result, {
      status: "status" in result ? result.status : result.error ? 400 : 200,
    });
  }

  const { data, error } = await auth.supabaseAdmin
    .from("pagos")
    .select(
      "*, ordenes_pago(id, numero, fecha, beneficiario, observaciones, ordenes_pago_medios(*), ordenes_pago_retenciones(*))"
    )
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
  const retenciones = (body.retenciones || []).filter(
    (retencion) => Number(retencion.importe || 0) > 0
  );
  const totalImputado = imputaciones.reduce(
    (acc, imputacion) => acc + Number(imputacion.importe || 0),
    0
  );
  const totalRetenciones = retenciones.reduce(
    (acc, retencion) => acc + Number(retencion.importe || 0),
    0
  );
  const saldoPorPagar = totalImputado - totalRetenciones;
  const medios =
    body.medios && body.medios.length > 0
      ? body.medios
      : saldoPorPagar > 0.01
      ? [
          {
            medio_pago: body.medio_pago || "Transferencia",
            importe: saldoPorPagar,
            banco: body.banco,
            numero_operacion: body.numero_operacion,
            numero_cheque: body.numero_cheque,
            fecha_emision: body.fecha_emision,
            fecha_pago: body.fecha_pago,
          },
        ]
      : [];
  const totalMedios = medios.reduce(
    (acc, medio) => acc + Number(medio.importe || 0),
    0
  );

  if (!body.fecha || imputaciones.length === 0) {
    return NextResponse.json(
      { error: "Fecha y al menos una imputacion son obligatorias" },
      { status: 400 }
    );
  }

  if (
    medios.some((medio) => Number(medio.importe || 0) <= 0) ||
    Math.abs(totalMedios + totalRetenciones - totalImputado) > 0.01
  ) {
    return NextResponse.json(
      {
        error:
          "La suma de medios de pago y retenciones debe coincidir con el total imputado",
      },
      { status: 400 }
    );
  }

  const beneficiarios = Array.from(
    new Set(
      imputaciones
        .map((imputacion) => imputacion.beneficiario?.trim())
        .filter(Boolean)
    )
  );
  const { data: orden, error: ordenError } = await auth.supabaseAdmin
    .from("ordenes_pago")
    .insert({
      fecha: body.fecha,
      beneficiario:
        beneficiarios.length === 1 ? beneficiarios[0] : "Varios beneficiarios",
      observaciones: body.observaciones?.trim() || "",
    })
    .select("id, numero")
    .single();

  if (ordenError || !orden) {
    return NextResponse.json(
      {
        error:
          ordenError?.message ||
          "No se pudo generar el numero de orden de pago",
      },
      { status: 400 }
    );
  }

  const primerMedio = medios[0];
  const payloads = imputaciones.map((imputacion) => ({
    orden_pago_id: orden.id,
    fecha: body.fecha,
    tipo: imputacion.tipo,
    referencia_id: imputacion.referencia_id,
    beneficiario: imputacion.beneficiario || body.beneficiario,
    importe: Number(imputacion.importe || 0),
    medio_pago:
      medios.length === 0
        ? "Retenciones"
        : medios.length === 1
        ? primerMedio.medio_pago
        : "Multiples medios",
    observaciones: body.observaciones?.trim() || "",
    banco: medios.length === 1 ? primerMedio.banco?.trim() || "" : "",
    numero_cheque:
      medios.length === 1 ? primerMedio.numero_cheque?.trim() || "" : "",
    fecha_emision: medios.length === 1 ? primerMedio.fecha_emision || null : null,
    fecha_pago: medios.length === 1 ? primerMedio.fecha_pago || null : null,
  }));

  const { error: pagosError } = await auth.supabaseAdmin
    .from("pagos")
    .insert(payloads);

  if (pagosError) {
    await auth.supabaseAdmin.from("ordenes_pago").delete().eq("id", orden.id);
    return NextResponse.json({ error: pagosError.message }, { status: 400 });
  }

  const { error: mediosError } =
    medios.length > 0
      ? await auth.supabaseAdmin.from("ordenes_pago_medios").insert(
          medios.map((medio) => ({
            orden_pago_id: orden.id,
            medio_pago: medio.medio_pago,
            importe: Number(medio.importe || 0),
            banco: medio.banco?.trim() || "",
            numero_operacion: medio.numero_operacion?.trim() || "",
            numero_cheque: medio.numero_cheque?.trim() || "",
            fecha_emision: medio.fecha_emision || null,
            fecha_pago: medio.fecha_pago || null,
          }))
        )
      : { error: null };

  if (mediosError) {
    await auth.supabaseAdmin.from("ordenes_pago").delete().eq("id", orden.id);
    return NextResponse.json({ error: mediosError.message }, { status: 400 });
  }

  if (retenciones.length > 0) {
    const { error: retencionesError } = await auth.supabaseAdmin
      .from("ordenes_pago_retenciones")
      .insert(
        retenciones.map((retencion) => ({
          orden_pago_id: orden.id,
          tipo: retencion.tipo.trim() || "Retencion",
          importe: Number(retencion.importe || 0),
        }))
      );

    if (retencionesError) {
      await auth.supabaseAdmin.from("ordenes_pago").delete().eq("id", orden.id);
      return NextResponse.json(
        { error: retencionesError.message },
        { status: 400 }
      );
    }
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

  return NextResponse.json({
    id: orden.id,
    numero: orden.numero,
    numero_formateado: numeroOrden(orden.numero),
  });
}

export async function PUT(request: Request) {
  const auth = await getSocioActor(request);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as PagoBody;

  if (!body.id || !body.tipo || !body.referencia_id) {
    return NextResponse.json(
      { error: "ID, tipo y referencia son obligatorios" },
      { status: 400 }
    );
  }

  const { data: pagoAnterior, error: getError } = await auth.supabaseAdmin
    .from("pagos")
    .select("id, tipo, referencia_id")
    .eq("id", body.id)
    .maybeSingle();

  if (getError) {
    return NextResponse.json({ error: getError.message }, { status: 400 });
  }

  if (!pagoAnterior) {
    return NextResponse.json({ error: "No se encontro el pago" }, { status: 404 });
  }

  const { error } = await auth.supabaseAdmin
    .from("pagos")
    .update({
      fecha: body.fecha,
      tipo: body.tipo,
      referencia_id: body.referencia_id,
      beneficiario: body.beneficiario || null,
      importe: Number(body.importe || 0),
      medio_pago: body.medio_pago,
      observaciones: body.observaciones?.trim() || "",
      banco: body.banco?.trim() || "",
      numero_cheque: body.numero_cheque?.trim() || "",
      fecha_emision: body.fecha_emision || null,
      fecha_pago: body.fecha_pago || null,
    })
    .eq("id", body.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const referencias = [
    {
      tipo: pagoAnterior.tipo as "compra" | "gasto",
      id: pagoAnterior.referencia_id,
    },
    { tipo: body.tipo, id: body.referencia_id },
  ];

  for (const referencia of referencias) {
    const refError = await actualizarReferencia(
      auth.supabaseAdmin,
      referencia.tipo,
      referencia.id
    );

    if (refError) {
      return NextResponse.json({ error: refError }, { status: 400 });
    }
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

  const { data: pago, error: getError } = await auth.supabaseAdmin
    .from("pagos")
    .select("id, tipo, referencia_id")
    .eq("id", id)
    .maybeSingle();

  if (getError) {
    return NextResponse.json({ error: getError.message }, { status: 400 });
  }

  if (!pago) {
    return NextResponse.json({ error: "No se encontro el pago" }, { status: 404 });
  }

  const { error } = await auth.supabaseAdmin
    .from("pagos")
    .delete()
    .eq("id", id);

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
