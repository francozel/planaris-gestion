import { NextResponse } from "next/server";
import { getSocioActor } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await getSocioActor(request);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const [usuariosResult, gastosResult, pagosResult, retirosResult] =
    await Promise.all([
      auth.supabaseAdmin
        .from("usuarios")
        .select("id, nombre, email")
        .eq("rol", "socio")
        .eq("activo", true)
        .order("email"),
      auth.supabaseAdmin
        .from("gastos")
        .select("id, usuario_id, importe_total")
        .not("usuario_id", "is", null),
      auth.supabaseAdmin
        .from("pagos")
        .select("referencia_id, importe")
        .eq("tipo", "gasto"),
      auth.supabaseAdmin
        .from("retiros_socios")
        .select("usuario_id, importe"),
    ]);

  const error =
    usuariosResult.error ||
    gastosResult.error ||
    pagosResult.error ||
    retirosResult.error;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const gastos = gastosResult.data || [];
  const gastoUsuario = new Map(
    gastos.map((gasto) => [gasto.id, gasto.usuario_id])
  );
  const resumen = (usuariosResult.data || []).map((usuario) => {
    const totalGastos = gastos
      .filter((gasto) => gasto.usuario_id === usuario.id)
      .reduce((acc, gasto) => acc + Number(gasto.importe_total || 0), 0);
    const totalReintegros = (pagosResult.data || [])
      .filter((pago) => gastoUsuario.get(pago.referencia_id) === usuario.id)
      .reduce((acc, pago) => acc + Number(pago.importe || 0), 0);
    const totalRetiros = (retirosResult.data || [])
      .filter((retiro) => retiro.usuario_id === usuario.id)
      .reduce((acc, retiro) => acc + Number(retiro.importe || 0), 0);

    return {
      ...usuario,
      gastos: totalGastos,
      reintegros: totalReintegros,
      retiros: totalRetiros,
      saldo: totalGastos - totalReintegros - totalRetiros,
    };
  });

  return NextResponse.json({ data: resumen });
}
