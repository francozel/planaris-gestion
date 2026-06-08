import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signedAmount } from "@/lib/accounting";
import { getActorWithRoles, getSocioActor } from "@/lib/api-auth";

type CobroBody = {
  id?: string;
  fecha?: string;
  venta_id?: string;
  cliente?: string | null;
  medio_cobro?: string;
  moneda?: string;
  importe_original?: number;
  tipo_cambio?: number;
  importe_pesos?: number;
  retenciones_total?: number;
  retenciones?: unknown;
  total_cancelado?: number;
  banco_id?: string | null;
  banco?: string;
  numero_operacion?: string;
  numero_cheque?: string;
  fecha_emision?: string | null;
  fecha_pago?: string | null;
  imputaciones?: Array<{
    venta_id: string;
    cliente?: string | null;
    importe: number;
  }>;
  instrumentos?: Array<{
    medio_cobro?: string;
    moneda?: string;
    importe_original?: number;
    tipo_cambio?: number;
    importe_pesos?: number;
    banco_id?: string | null;
    banco?: string;
    numero_operacion?: string;
    numero_cheque?: string;
    fecha_emision?: string | null;
    fecha_pago?: string | null;
  }>;
};

export async function GET(request: Request) {
  const auth = await getActorWithRoles(request, ["socio", "administracion"]);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const cartera = searchParams.get("cartera") === "cheques-terceros";

  if (cartera) {
    const [{ data: cheques, error: chequesError }, { data: usados, error: usadosError }] =
      await Promise.all([
        auth.supabaseAdmin
          .from("cobros")
          .select(
            "id, fecha, cliente, importe_pesos, banco, numero_cheque, fecha_emision, fecha_pago"
          )
          .ilike("medio_cobro", "%cheque%")
          .order("id", { ascending: true }),
        auth.supabaseAdmin
          .from("ordenes_pago_medios")
          .select("cobro_origen_id")
          .not("cobro_origen_id", "is", null),
      ]);

    if (chequesError || usadosError) {
      return NextResponse.json(
        {
          error:
            usadosError?.message ||
            chequesError?.message ||
            "No se pudo cargar la cartera de cheques",
        },
        { status: 400 }
      );
    }

    const usadosIds = new Set(
      (usados || []).map((item) => item.cobro_origen_id).filter(Boolean)
    );
    const grupos = new Map<
      string,
      {
        ids: string[];
        id: string;
        fecha: string;
        cliente: string | null;
        importe_pesos: number;
        banco: string | null;
        numero_cheque: string | null;
        fecha_emision: string | null;
        fecha_pago: string | null;
      }
    >();

    for (const cheque of cheques || []) {
      const clave = [
        cheque.numero_cheque,
        cheque.banco,
        cheque.fecha_emision,
        cheque.fecha_pago,
        cheque.cliente,
      ].join("|");
      const grupo = grupos.get(clave);

      if (grupo) {
        grupo.ids.push(cheque.id);
        grupo.importe_pesos += Number(cheque.importe_pesos || 0);
      } else {
        grupos.set(clave, {
          ids: [cheque.id],
          id: cheque.id,
          fecha: cheque.fecha,
          cliente: cheque.cliente,
          importe_pesos: Number(cheque.importe_pesos || 0),
          banco: cheque.banco,
          numero_cheque: cheque.numero_cheque,
          fecha_emision: cheque.fecha_emision,
          fecha_pago: cheque.fecha_pago,
        });
      }
    }

    return NextResponse.json({
      data: Array.from(grupos.values())
        .filter((cheque) => !cheque.ids.some((chequeId) => usadosIds.has(chequeId)))
        .map((cheque) => ({
          id: cheque.id,
          fecha: cheque.fecha,
          cliente: cheque.cliente,
          importe_pesos: cheque.importe_pesos,
          banco: cheque.banco,
          numero_cheque: cheque.numero_cheque,
          fecha_emision: cheque.fecha_emision,
          fecha_pago: cheque.fecha_pago,
        })),
    });
  }

  const query = auth.supabaseAdmin
    .from("cobros")
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
      { error: "No se encontro el cobro" },
      { status: 404 }
    );
  }

  return NextResponse.json({ data });
}

async function actualizarBanco(
  supabaseAdmin: SupabaseClient,
  bancoId: string | null | undefined,
  delta: number
) {
  if (!bancoId || delta === 0) return null;

  const { data: banco, error: bancoError } = await supabaseAdmin
    .from("bancos")
    .select("saldo_actual")
    .eq("id", bancoId)
    .maybeSingle();

  if (bancoError) return bancoError.message;
  if (!banco) return "No se encontro el banco";

  const { error } = await supabaseAdmin
    .from("bancos")
    .update({
      saldo_actual: Number(banco.saldo_actual || 0) + delta,
    })
    .eq("id", bancoId);

  return error?.message || null;
}

async function actualizarEstadoVenta(
  supabaseAdmin: SupabaseClient,
  ventaId: string
) {
  const { data: venta, error: ventaGetError } = await supabaseAdmin
    .from("ingresos")
    .select("id, tipo_comprobante, importe")
    .eq("id", ventaId)
    .maybeSingle();

  if (ventaGetError) return ventaGetError.message;
  if (!venta) return "No se encontro la venta";

  const { data: cobros, error: cobrosError } = await supabaseAdmin
    .from("cobros")
    .select("total_cancelado")
    .eq("venta_id", ventaId);

  if (cobrosError) return cobrosError.message;

  const totalCobrado = (cobros || []).reduce(
    (acc, cobro) => acc + Number(cobro.total_cancelado || 0),
    0
  );
  const totalVenta = signedAmount(
    venta.tipo_comprobante,
    Number(venta.importe || 0)
  );
  const estado =
    totalVenta < 0
      ? totalCobrado >= 0
        ? "Pendiente"
        : totalCobrado <= totalVenta
        ? "Cobrada"
        : "Parcial"
      : totalCobrado <= 0
      ? "Pendiente"
      : totalCobrado >= totalVenta
      ? "Cobrada"
      : "Parcial";

  const { error } = await supabaseAdmin
    .from("ingresos")
    .update({ estado })
    .eq("id", ventaId);

  return error?.message || null;
}

export async function POST(request: Request) {
  const auth = await getSocioActor(request);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as CobroBody;

  if (!body.venta_id) {
    return NextResponse.json({ error: "Venta requerida" }, { status: 400 });
  }

  const imputaciones =
    body.imputaciones && body.imputaciones.length > 0
      ? body.imputaciones
      : [
          {
            venta_id: body.venta_id,
            cliente: body.cliente,
            importe: Number(body.total_cancelado || 0),
          },
        ];

  const instrumentos =
    body.instrumentos && body.instrumentos.length > 0
      ? body.instrumentos
      : [
          {
            medio_cobro: body.medio_cobro,
            moneda: body.moneda,
            importe_original: body.importe_original,
            tipo_cambio: body.tipo_cambio,
            importe_pesos: body.importe_pesos,
            banco_id: body.banco_id,
            banco: body.banco,
            numero_operacion: body.numero_operacion,
            numero_cheque: body.numero_cheque,
            fecha_emision: body.fecha_emision,
            fecha_pago: body.fecha_pago,
          },
        ];

  const totalImputado = imputaciones.reduce(
    (acc, imputacion) => acc + Number(imputacion.importe || 0),
    0
  );
  const totalInstrumentos =
    instrumentos.reduce(
      (acc, instrumento) => acc + Number(instrumento.importe_pesos || 0),
      0
    ) + Number(body.retenciones_total || 0);

  if (Math.abs(totalImputado - totalInstrumentos) > 0.01) {
    return NextResponse.json(
      { error: "El total imputado debe coincidir con pagos y retenciones" },
      { status: 400 }
    );
  }

  const pendientes = imputaciones.map((imputacion) => ({
    ...imputacion,
    restante: Number(imputacion.importe || 0),
  }));
  const payloads = [];
  let creditosRestantes = pendientes.reduce(
    (acc, imputacion) =>
      imputacion.restante < 0 ? acc + Math.abs(imputacion.restante) : acc,
    0
  );

  for (const imputacion of pendientes) {
    if (imputacion.restante >= 0) continue;

    payloads.push({
      fecha: body.fecha,
      venta_id: imputacion.venta_id,
      cliente: imputacion.cliente || body.cliente,
      medio_cobro: "Nota de credito",
      moneda: "ARS",
      importe_original: 0,
      tipo_cambio: 1,
      importe_pesos: 0,
      retenciones_total: 0,
      retenciones: [],
      total_cancelado: imputacion.restante,
      banco_id: null,
      banco: "",
      numero_operacion: "",
      numero_cheque: "",
      fecha_emision: null,
      fecha_pago: null,
    });

    imputacion.restante = 0;
  }

  for (const imputacion of pendientes) {
    if (creditosRestantes <= 0) break;
    if (imputacion.restante <= 0) continue;

    const aplicado = Math.min(imputacion.restante, creditosRestantes);

    payloads.push({
      fecha: body.fecha,
      venta_id: imputacion.venta_id,
      cliente: imputacion.cliente || body.cliente,
      medio_cobro: "Nota de credito",
      moneda: "ARS",
      importe_original: 0,
      tipo_cambio: 1,
      importe_pesos: 0,
      retenciones_total: 0,
      retenciones: [],
      total_cancelado: aplicado,
      banco_id: null,
      banco: "",
      numero_operacion: "",
      numero_cheque: "",
      fecha_emision: null,
      fecha_pago: null,
    });

    imputacion.restante -= aplicado;
    creditosRestantes -= aplicado;
  }

  for (const instrumento of instrumentos) {
    let restanteInstrumento = Number(instrumento.importe_pesos || 0);

    for (const imputacion of pendientes) {
      if (restanteInstrumento <= 0) break;
      if (imputacion.restante <= 0) continue;

      const aplicado = Math.min(imputacion.restante, restanteInstrumento);

      payloads.push({
        fecha: body.fecha,
        venta_id: imputacion.venta_id,
        cliente: imputacion.cliente || body.cliente,
        medio_cobro: instrumento.medio_cobro || body.medio_cobro,
        moneda: instrumento.moneda || body.moneda || "ARS",
        importe_original: Number(instrumento.importe_original || aplicado),
        tipo_cambio: Number(instrumento.tipo_cambio || body.tipo_cambio || 1),
        importe_pesos: aplicado,
        retenciones_total: 0,
        retenciones: [],
        total_cancelado: aplicado,
        banco_id: instrumento.banco_id || null,
        banco: instrumento.banco?.trim() || "",
        numero_operacion: instrumento.numero_operacion?.trim() || "",
        numero_cheque: instrumento.numero_cheque?.trim() || "",
        fecha_emision: instrumento.fecha_emision || null,
        fecha_pago: instrumento.fecha_pago || null,
      });

      imputacion.restante -= aplicado;
      restanteInstrumento -= aplicado;
    }
  }

  let retencionesRestantes = Number(body.retenciones_total || 0);
  for (const imputacion of pendientes) {
    if (retencionesRestantes <= 0) break;
    if (imputacion.restante <= 0) continue;

    const aplicado = Math.min(imputacion.restante, retencionesRestantes);

    payloads.push({
      fecha: body.fecha,
      venta_id: imputacion.venta_id,
      cliente: imputacion.cliente || body.cliente,
      medio_cobro: "Retencion",
      moneda: "ARS",
      importe_original: 0,
      tipo_cambio: 1,
      importe_pesos: 0,
      retenciones_total: aplicado,
      retenciones: body.retenciones || [],
      total_cancelado: aplicado,
      banco_id: null,
      banco: "",
      numero_operacion: "",
      numero_cheque: "",
      fecha_emision: null,
      fecha_pago: null,
    });

    imputacion.restante -= aplicado;
    retencionesRestantes -= aplicado;
  }

  if (payloads.length === 0) {
    return NextResponse.json(
      { error: "Agrega al menos un pago o retencion" },
      { status: 400 }
    );
  }

  const { data: cobros, error } = await auth.supabaseAdmin
    .from("cobros")
    .insert(payloads)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const bancosDelta = payloads.reduce<Record<string, number>>((acc, payload) => {
    if (!payload.banco_id) return acc;
    acc[payload.banco_id] =
      (acc[payload.banco_id] || 0) + Number(payload.importe_pesos || 0);
    return acc;
  }, {});

  for (const [bancoId, delta] of Object.entries(bancosDelta)) {
    const bancoError = await actualizarBanco(auth.supabaseAdmin, bancoId, delta);

    if (bancoError) {
      return NextResponse.json({ error: bancoError }, { status: 400 });
    }
  }

  for (const imputacion of imputaciones) {
    const estadoError = await actualizarEstadoVenta(
      auth.supabaseAdmin,
      imputacion.venta_id
    );

    if (estadoError) {
      return NextResponse.json({ error: estadoError }, { status: 400 });
    }
  }

  return NextResponse.json({ id: cobros?.[0]?.id || null });
}

export async function PUT(request: Request) {
  const auth = await getSocioActor(request);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as CobroBody;

  if (!body.id || !body.venta_id) {
    return NextResponse.json(
      { error: "ID y venta son obligatorios" },
      { status: 400 }
    );
  }

  const { data: anterior, error: getError } = await auth.supabaseAdmin
    .from("cobros")
    .select("id, venta_id, banco_id, importe_pesos, total_cancelado")
    .eq("id", body.id)
    .maybeSingle();

  if (getError) {
    return NextResponse.json({ error: getError.message }, { status: 400 });
  }

  if (!anterior) {
    return NextResponse.json(
      { error: "No se encontro el cobro" },
      { status: 404 }
    );
  }

  const importePesos = Number(body.importe_pesos || body.total_cancelado || 0);
  const totalCancelado = Number(body.total_cancelado || importePesos);
  const retencionesTotal = Number(body.retenciones_total || 0);

  const { error } = await auth.supabaseAdmin
    .from("cobros")
    .update({
      fecha: body.fecha,
      venta_id: body.venta_id,
      cliente: body.cliente,
      medio_cobro: body.medio_cobro,
      moneda: body.moneda || "ARS",
      importe_original: Number(body.importe_original || importePesos),
      tipo_cambio: Number(body.tipo_cambio || 1),
      importe_pesos: importePesos,
      retenciones_total: retencionesTotal,
      retenciones: body.retenciones || [],
      total_cancelado: totalCancelado,
      banco_id: body.banco_id || null,
      banco: body.banco?.trim() || "",
      numero_operacion: body.numero_operacion?.trim() || "",
      numero_cheque: body.numero_cheque?.trim() || "",
      fecha_emision: body.fecha_emision || null,
      fecha_pago: body.fecha_pago || null,
    })
    .eq("id", body.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (anterior.banco_id === body.banco_id) {
    const bancoError = await actualizarBanco(
      auth.supabaseAdmin,
      body.banco_id,
      importePesos - Number(anterior.importe_pesos || 0)
    );

    if (bancoError) {
      return NextResponse.json({ error: bancoError }, { status: 400 });
    }
  } else {
    const restaError = await actualizarBanco(
      auth.supabaseAdmin,
      anterior.banco_id,
      -Number(anterior.importe_pesos || 0)
    );
    if (restaError) {
      return NextResponse.json({ error: restaError }, { status: 400 });
    }

    const sumaError = await actualizarBanco(
      auth.supabaseAdmin,
      body.banco_id,
      importePesos
    );
    if (sumaError) {
      return NextResponse.json({ error: sumaError }, { status: 400 });
    }
  }

  for (const ventaId of new Set([anterior.venta_id, body.venta_id])) {
    if (!ventaId) continue;
    const estadoError = await actualizarEstadoVenta(auth.supabaseAdmin, ventaId);

    if (estadoError) {
      return NextResponse.json({ error: estadoError }, { status: 400 });
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

  const { data: cobro, error: getError } = await auth.supabaseAdmin
    .from("cobros")
    .select("id, venta_id, banco_id, total_cancelado")
    .eq("id", id)
    .maybeSingle();

  if (getError) {
    return NextResponse.json({ error: getError.message }, { status: 400 });
  }

  if (!cobro) {
    return NextResponse.json(
      { error: "No se encontro el cobro" },
      { status: 404 }
    );
  }

  const { error } = await auth.supabaseAdmin.from("cobros").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const bancoError = await actualizarBanco(
    auth.supabaseAdmin,
    cobro.banco_id,
    -Number(cobro.total_cancelado || 0)
  );

  if (bancoError) {
    return NextResponse.json({ error: bancoError }, { status: 400 });
  }

  const estadoError = await actualizarEstadoVenta(
    auth.supabaseAdmin,
    cobro.venta_id
  );

  if (estadoError) {
    return NextResponse.json({ error: estadoError }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
