import { NextResponse } from "next/server";
import { getActorWithRoles } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await getActorWithRoles(request, [
    "socio",
    "administracion",
    "usuario",
  ]);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const token = request.headers
    .get("authorization")
    ?.replace("Bearer ", "")
    .trim();
  const { data: authData } = await auth.supabaseAdmin.auth.getUser(token);
  const email = authData.user?.email?.toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Usuario no identificado" }, { status: 401 });
  }

  const { data: usuario, error: usuarioError } = await auth.supabaseAdmin
    .from("usuarios")
    .select("id, nombre, email, rol, activo")
    .eq("email", email)
    .maybeSingle();

  if (usuarioError || !usuario) {
    return NextResponse.json(
      { error: usuarioError?.message || "No se encontro el usuario" },
      { status: 404 }
    );
  }

  const [gastosResult, retirosResult] = await Promise.all([
    auth.supabaseAdmin
      .from("gastos")
      .select("id, fecha, categoria, descripcion, proveedor, importe_total, estado")
      .eq("usuario_id", usuario.id)
      .order("fecha", { ascending: false }),
    auth.supabaseAdmin
      .from("retiros_socios")
      .select("id, fecha, tipo, medio_pago, importe, estado")
      .eq("usuario_id", usuario.id)
      .order("fecha", { ascending: false }),
  ]);

  if (gastosResult.error || retirosResult.error) {
    return NextResponse.json(
      { error: gastosResult.error?.message || retirosResult.error?.message },
      { status: 400 }
    );
  }

  const gastos = gastosResult.data || [];
  const gastoIds = gastos.map((gasto) => gasto.id);
  const pagosResult =
    gastoIds.length > 0
      ? await auth.supabaseAdmin
          .from("pagos")
          .select("id, fecha, referencia_id, importe, medio_pago, observaciones")
          .eq("tipo", "gasto")
          .in("referencia_id", gastoIds)
          .order("fecha", { ascending: false })
      : { data: [], error: null };

  if (pagosResult.error) {
    return NextResponse.json({ error: pagosResult.error.message }, { status: 400 });
  }

  const pagos = pagosResult.data || [];
  const retiros = retirosResult.data || [];
  const historial = [
    ...gastos.map((item) => ({
      id: `gasto-${item.id}`,
      fecha: item.fecha,
      tipo: "Gasto",
      detalle: item.descripcion || item.proveedor || item.categoria || "Gasto",
      importe: Number(item.importe_total || 0),
      estado: item.estado,
    })),
    ...pagos.map((item) => ({
      id: `pago-${item.id}`,
      fecha: item.fecha,
      tipo: "Reintegro",
      detalle: item.observaciones || item.medio_pago || "Reintegro de gasto",
      importe: -Number(item.importe || 0),
      estado: "Pagado",
    })),
    ...retiros.map((item) => ({
      id: `retiro-${item.id}`,
      fecha: item.fecha,
      tipo: "Retiro",
      detalle: `${item.tipo || "Retiro"} - ${item.medio_pago || "-"}`,
      importe: -Number(item.importe || 0),
      estado: item.estado,
    })),
  ].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

  return NextResponse.json({
    data: {
      usuario,
      resumen: {
        gastos: gastos.reduce(
          (acc, item) => acc + Number(item.importe_total || 0),
          0
        ),
        reintegros: pagos.reduce(
          (acc, item) => acc + Number(item.importe || 0),
          0
        ),
        retiros: retiros.reduce(
          (acc, item) => acc + Number(item.importe || 0),
          0
        ),
      },
      historial,
    },
  });
}
