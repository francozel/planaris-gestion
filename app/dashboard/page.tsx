"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PeriodSelector from "@/components/PeriodSelector";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { getAccessToken } from "@/lib/client-auth";
import {
  matchesPeriod,
  monthStartISO,
  todayISO,
  type PeriodView,
} from "@/lib/period";
import { signedAmount } from "@/lib/accounting";
import { relatedUserIdentity } from "@/lib/user-identity";

type Compra = {
  id: string;
  fecha: string;
  tipo_comprobante: string | null;
  importe: number | null;
  iva: number | null;
  razon_social?: string | null;
  proveedor?: string | null;
};

type Venta = {
  id: string;
  fecha: string;
  tipo_comprobante: string | null;
  importe: number | null;
  iva: number | null;
  razon_social?: string | null;
};

type Cobro = {
  id: string;
  fecha: string;
  cliente: string | null;
  medio_cobro: string | null;
  importe_pesos: number | null;
  total_cancelado: number | null;
  banco: string | null;
  numero_cheque: string | null;
  fecha_emision: string | null;
  fecha_pago: string | null;
};

type MedioPagoOrden = {
  id: string;
  cobro_origen_id: string | null;
  beneficiario?: string | null;
  medio_pago: string | null;
  importe: number | null;
  fecha_pago: string | null;
};

type Gasto = {
  id: string;
  fecha: string;
  importe_total: number | null;
  iva: number | null;
  proveedor?: string | null;
  categoria?: string | null;
};

type Pago = {
  id: string;
  fecha: string;
  beneficiario: string | null;
  medio_pago: string | null;
  importe: number | null;
  fecha_pago: string | null;
  ordenes_pago?: {
    id: string;
    fecha: string;
    ordenes_pago_medios?: MedioPagoOrden[];
  } | null;
};

type Retiro = {
  id: string;
  fecha: string;
  tipo: string | null;
  importe: number | null;
  usuarios?:
    | { nombre?: string | null; email?: string | null }
    | { nombre?: string | null; email?: string | null }[]
    | null;
};

function money(value: number) {
  return `$${value.toLocaleString("es-AR")}`;
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <p className="text-zinc-500 text-sm mb-2">{title}</p>
      <h2 className="text-xl font-bold leading-tight break-words text-zinc-900">
        {value}
      </h2>
    </div>
  );
}

function IvaCard({ value }: { value: number }) {
  const favorable = value >= 0;

  return (
    <div className="bg-white border rounded-lg p-4">
      <p className="text-zinc-500 text-sm mb-2">Situacion tributaria (IVA)</p>
      <h2
        className={`text-xl font-bold leading-tight break-words ${
          favorable ? "text-green-700" : "text-red-700"
        }`}
      >
        {money(Math.abs(value))}
      </h2>
      <p className="text-xs text-zinc-500">
        {favorable ? "IVA a favor" : "IVA en contra"}
      </p>
    </div>
  );
}

function shortName(value: string | null | undefined) {
  if (!value) return "-";
  return value.length > 16 ? `${value.slice(0, 16)}...` : value;
}

function relatedUserName(value: Retiro["usuarios"]) {
  return relatedUserIdentity(value, "Socio");
}

function endOfMonthISO(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];
}

function chequeKey(cobro: Cobro) {
  return [
    cobro.numero_cheque || "",
    cobro.banco || "",
    cobro.fecha_emision || "",
    cobro.fecha_pago || "",
    cobro.cliente || "",
  ].join("|");
}

export default function DashboardPage() {
  const { session } = useAuth();
  const [view, setView] = useState<PeriodView>("anual");
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");

  const [compras, setCompras] = useState<Compra[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [retiros, setRetiros] = useState<Retiro[]>([]);

  const cargarDatos = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setErrorCarga("");

    const accessToken = session?.access_token || (await getAccessToken());

    const [
      comprasResult,
      ventasResult,
      cobrosResponse,
      gastosResult,
      pagosResponse,
      retirosResponse,
    ] =
      await Promise.all([
        supabase.from("compras").select("id, fecha, tipo_comprobante, importe, iva, razon_social, proveedor"),
        supabase.from("ingresos").select("id, fecha, tipo_comprobante, importe, iva, razon_social"),
        accessToken
          ? fetch("/api/cobros", {
              headers: { Authorization: `Bearer ${accessToken}` },
            })
          : Promise.resolve(null),
        supabase.from("gastos").select("id, fecha, importe_total, iva, proveedor, categoria"),
        accessToken
          ? fetch("/api/pagos", {
              headers: { Authorization: `Bearer ${accessToken}` },
            })
          : Promise.resolve(null),
        accessToken
          ? fetch("/api/retiros", {
              headers: { Authorization: `Bearer ${accessToken}` },
            })
          : Promise.resolve(null),
      ]);

    if (
      comprasResult.error ||
      ventasResult.error ||
      gastosResult.error ||
      !cobrosResponse ||
      !pagosResponse
    ) {
      setErrorCarga("No se pudo cargar el resumen.");
      setLoading(false);
      return;
    }

    const cobrosResult = (await cobrosResponse.json()) as {
      data?: Cobro[];
      error?: string;
    };
    const pagosResult = (await pagosResponse.json()) as {
      data?: Pago[];
      error?: string;
    };
    const retirosResult = retirosResponse
      ? ((await retirosResponse.json()) as { data?: Retiro[]; error?: string })
      : { data: [] };

    if (!cobrosResponse.ok || !pagosResponse.ok) {
      setErrorCarga(
        cobrosResult.error || pagosResult.error || "No se pudo cargar el resumen."
      );
      setLoading(false);
      return;
    }

    setCompras(comprasResult.data || []);
    setVentas(ventasResult.data || []);
    setCobros(cobrosResult.data || []);
    setGastos(gastosResult.data || []);
    setPagos(pagosResult.data || []);
    setRetiros(retirosResponse?.ok ? retirosResult.data || [] : []);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarDatos();
  }, [cargarDatos]);

  const resumen = useMemo(() => {
    const comprasPeriodo = compras.filter((item) =>
      matchesPeriod(item.fecha, view, from, to)
    );
    const ventasPeriodo = ventas.filter((item) =>
      matchesPeriod(item.fecha, view, from, to)
    );
    const cobrosPeriodo = cobros.filter((item) =>
      matchesPeriod(item.fecha, view, from, to)
    );
    const gastosPeriodo = gastos.filter((item) =>
      matchesPeriod(item.fecha, view, from, to)
    );

    const totalCompras = comprasPeriodo.reduce(
      (acc, item) =>
        acc + signedAmount(item.tipo_comprobante, Number(item.importe || 0)),
      0
    );
    const totalVentas = ventasPeriodo.reduce(
      (acc, item) =>
        acc + signedAmount(item.tipo_comprobante, Number(item.importe || 0)),
      0
    );
    const totalCobros = cobrosPeriodo.reduce(
      (acc, item) => acc + Number(item.total_cancelado || item.importe_pesos || 0),
      0
    );
    const totalGastos = gastosPeriodo.reduce(
      (acc, item) => acc + Number(item.importe_total || 0),
      0
    );
    const ivaVentas = ventasPeriodo.reduce(
      (acc, item) =>
        acc + signedAmount(item.tipo_comprobante, Number(item.iva || 0)),
      0
    );
    const ivaCompras = comprasPeriodo.reduce(
      (acc, item) =>
        acc + signedAmount(item.tipo_comprobante, Number(item.iva || 0)),
      0
    );
    const ivaGastos = gastosPeriodo.reduce(
      (acc, item) => acc + Number(item.iva || 0),
      0
    );

    return {
      totalCompras,
      totalVentas,
      totalCobros,
      totalGastos,
      ganancia: totalVentas - totalCompras - totalGastos,
      iva: ivaCompras + ivaGastos - ivaVentas,
    };
  }, [cobros, compras, from, gastos, to, ventas, view]);

  const mediosPago = Array.from(
    pagos.reduce<Map<string, MedioPagoOrden & { fecha: string }>>((acc, pago) => {
      const medios = pago.ordenes_pago?.ordenes_pago_medios || [];

      if (medios.length === 0) {
        acc.set(`legacy-${pago.id}`, {
          id: `legacy-${pago.id}`,
          cobro_origen_id: null,
          medio_pago: pago.medio_pago,
          importe: pago.importe,
          fecha_pago: pago.fecha_pago,
          fecha: pago.fecha,
          beneficiario: pago.beneficiario,
        });
        return acc;
      }

      for (const medio of medios) {
        acc.set(medio.id, {
          ...medio,
          fecha: pago.ordenes_pago?.fecha || pago.fecha,
          beneficiario: pago.beneficiario,
        });
      }

      return acc;
    }, new Map())
  ).map(([, medio]) => medio);
  const cobrosOrigenUsados = new Set(
    mediosPago.map((medio) => medio.cobro_origen_id).filter(Boolean)
  );
  const chequesUsadosKeys = new Set(
    cobros
      .filter((cobro) => cobrosOrigenUsados.has(cobro.id))
      .map(chequeKey)
  );
  const chequesCobro = cobros.filter(
    (cobro) =>
      (cobro.medio_cobro || "").toLowerCase().includes("cheque") &&
      !chequesUsadosKeys.has(chequeKey(cobro))
  );
  const chequesPago = mediosPago.filter((medio) =>
    (medio.medio_pago || "").toLowerCase().includes("cheque")
  );
  const totalChequesCobro = chequesCobro.reduce(
    (acc, cobro) => acc + Number(cobro.importe_pesos || cobro.total_cancelado || 0),
    0
  );
  const totalChequesPago = chequesPago.reduce(
    (acc, pago) => acc + Number(pago.importe || 0),
    0
  );
  const proximoCobro = [...chequesCobro]
    .filter((cobro) => cobro.fecha_pago && cobro.fecha_pago >= todayISO())
    .sort((a, b) => String(a.fecha_pago).localeCompare(String(b.fecha_pago)))[0];
  const proximoPago = [...chequesPago]
    .filter((pago) => pago.fecha_pago && pago.fecha_pago >= todayISO())
    .sort((a, b) => String(a.fecha_pago).localeCompare(String(b.fecha_pago)))[0];

  const hoyISO = todayISO();
  const finMes = endOfMonthISO(new Date());
  const finMesProximo = endOfMonthISO(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
  );
  const cobrosConDinero = cobros.filter((cobro) => {
    const medio = (cobro.medio_cobro || "").toLowerCase();
    return !medio.includes("retencion") && !medio.includes("nota de credito");
  });
  const cobrosLiquidados = cobrosConDinero.filter((cobro) => {
    const esCheque = (cobro.medio_cobro || "").toLowerCase().includes("cheque");
    if (esCheque && chequesUsadosKeys.has(chequeKey(cobro))) return false;
    const fechaEfectiva = esCheque ? cobro.fecha_pago || cobro.fecha : cobro.fecha;
    return fechaEfectiva <= hoyISO;
  });
  const pagosLiquidados = mediosPago.filter((pago) => {
    if (pago.cobro_origen_id) return false;
    const esCheque = (pago.medio_pago || "").toLowerCase().includes("cheque");
    const fechaEfectiva = esCheque ? pago.fecha_pago || pago.fecha : pago.fecha;
    return fechaEfectiva <= hoyISO;
  });
  const liquidezActual =
    cobrosLiquidados.reduce(
      (acc, cobro) => acc + Number(cobro.total_cancelado || cobro.importe_pesos || 0),
      0
    ) -
    pagosLiquidados.reduce((acc, pago) => acc + Number(pago.importe || 0), 0) -
    retiros
      .filter((retiro) => retiro.fecha <= hoyISO)
      .reduce((acc, retiro) => acc + Number(retiro.importe || 0), 0);
  const cobrosFuturosHasta = (limite: string) =>
    cobrosConDinero
      .filter((cobro) => {
        const esCheque = (cobro.medio_cobro || "").toLowerCase().includes("cheque");
        if (esCheque && chequesUsadosKeys.has(chequeKey(cobro))) return false;
        const fechaEfectiva = esCheque
          ? cobro.fecha_pago || cobro.fecha
          : cobro.fecha;
        return fechaEfectiva > hoyISO && fechaEfectiva <= limite;
      })
      .reduce(
        (acc, cobro) =>
          acc + Number(cobro.total_cancelado || cobro.importe_pesos || 0),
        0
      );
  const pagosFuturosHasta = (limite: string) =>
    mediosPago
      .filter((pago) => {
        if (pago.cobro_origen_id) return false;
        const esCheque = (pago.medio_pago || "").toLowerCase().includes("cheque");
        const fechaEfectiva = esCheque ? pago.fecha_pago || pago.fecha : pago.fecha;
        return fechaEfectiva > hoyISO && fechaEfectiva <= limite;
      })
      .reduce((acc, pago) => acc + Number(pago.importe || 0), 0);
  const retirosFuturosHasta = (limite: string) =>
    retiros
      .filter((retiro) => retiro.fecha > hoyISO && retiro.fecha <= limite)
      .reduce((acc, retiro) => acc + Number(retiro.importe || 0), 0);
  const fechasMovimientosFuturos = [
    ...cobrosConDinero
      .filter((cobro) => {
        const esCheque = (cobro.medio_cobro || "").toLowerCase().includes("cheque");
        if (esCheque && chequesUsadosKeys.has(chequeKey(cobro))) return false;
        return (esCheque ? cobro.fecha_pago || cobro.fecha : cobro.fecha) > hoyISO;
      })
      .map((cobro) =>
        (cobro.medio_cobro || "").toLowerCase().includes("cheque")
          ? cobro.fecha_pago || cobro.fecha
          : cobro.fecha
      ),
    ...mediosPago
      .filter((pago) => {
        if (pago.cobro_origen_id) return false;
        const esCheque = (pago.medio_pago || "").toLowerCase().includes("cheque");
        return (esCheque ? pago.fecha_pago || pago.fecha : pago.fecha) > hoyISO;
      })
      .map((pago) =>
        (pago.medio_pago || "").toLowerCase().includes("cheque")
          ? pago.fecha_pago || pago.fecha
          : pago.fecha
      ),
    ...retiros.filter((retiro) => retiro.fecha > hoyISO).map((retiro) => retiro.fecha),
  ].sort();
  const proximaFechaMovimiento = fechasMovimientosFuturos[0];
  const proyeccionLiquidez = proximaFechaMovimiento
    ? liquidezActual +
      cobrosFuturosHasta(proximaFechaMovimiento) -
      pagosFuturosHasta(proximaFechaMovimiento) -
      retirosFuturosHasta(proximaFechaMovimiento)
    : liquidezActual;
  const proyectadoFinMes =
    liquidezActual +
    cobrosFuturosHasta(finMes) -
    pagosFuturosHasta(finMes) -
    retirosFuturosHasta(finMes);
  const proyectadoMesProximo =
    liquidezActual +
    cobrosFuturosHasta(finMesProximo) -
    pagosFuturosHasta(finMesProximo) -
    retirosFuturosHasta(finMesProximo);

  const historial = [
    ...ventas.map((item) => ({
      id: `venta-${item.id}`,
      fecha: item.fecha,
      tipo: "Venta",
      detalle: item.razon_social || "Cliente",
      importe: signedAmount(item.tipo_comprobante, Number(item.importe || 0)),
    })),
    ...compras.map((item) => ({
      id: `compra-${item.id}`,
      fecha: item.fecha,
      tipo: "Compra",
      detalle: item.razon_social || item.proveedor || "Proveedor",
      importe: -signedAmount(item.tipo_comprobante, Number(item.importe || 0)),
    })),
    ...cobros.map((item) => ({
      id: `cobro-${item.id}`,
      fecha: item.fecha,
      tipo: "Cobro",
      detalle: item.cliente || "Cliente",
      importe: Number(item.total_cancelado || item.importe_pesos || 0),
    })),
    ...pagos.map((item) => ({
      id: `pago-${item.id}`,
      fecha: item.fecha,
      tipo: "Pago",
      detalle: item.beneficiario || "Beneficiario",
      importe: -Number(item.importe || 0),
    })),
    ...gastos.map((item) => ({
      id: `gasto-${item.id}`,
      fecha: item.fecha,
      tipo: "Gasto",
      detalle: item.proveedor || item.categoria || "Gasto",
      importe: -Number(item.importe_total || 0),
    })),
    ...retiros.map((item) => ({
      id: `retiro-${item.id}`,
      fecha: item.fecha,
      tipo: "Retiro",
      detalle: relatedUserName(item.usuarios) || item.tipo || "Socio",
      importe: -Number(item.importe || 0),
    })),
  ]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 40);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-zinc-900">Dashboard</h1>
        <p className="text-zinc-500 mt-2">Así vamos: Balance Operativo y Analítico de PLANARIS srl</p>
      </div>

      <PeriodSelector
        view={view}
        from={from}
        to={to}
        onViewChange={setView}
        onFromChange={setFrom}
        onToChange={setTo}
      />

      {loading && <p>Cargando resumen...</p>}
      {errorCarga && <p className="text-sm text-red-600">{errorCarga}</p>}

      <div className="grid grid-cols-6 gap-4">
        <Card title="Total compras" value={money(resumen.totalCompras)} />
        <Card title="Total ventas" value={money(resumen.totalVentas)} />
        <Card title="Total cobros" value={money(resumen.totalCobros)} />
        <Card title="Total gastos" value={money(resumen.totalGastos)} />
        <Card title="Ganancia" value={money(resumen.ganancia)} />
        <IvaCard value={resumen.iva} />
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-4">Cheques</h2>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-zinc-500">Cobros</p>
            <p className="metric-number">{money(totalChequesCobro)}</p>
          </div>

          <div>
            <p className="text-sm text-zinc-500">Proximo ch a acreditar</p>
            <p className="font-bold">
              {proximoCobro
                ? `${proximoCobro.fecha_pago} - ${money(
                    Number(proximoCobro.importe_pesos || 0)
                  )}`
                : "-"}
            </p>
            <p className="text-xs text-zinc-500">
              {shortName(proximoCobro?.cliente)}
            </p>
          </div>

          <div>
            <p className="text-sm text-zinc-500">Pagos</p>
            <p className="metric-number">{money(totalChequesPago)}</p>
          </div>

          <div>
            <p className="text-sm text-zinc-500">Proximo cheque a depositar</p>
            <p className="font-bold">
              {proximoPago
                ? `${proximoPago.fecha_pago} - ${money(
                    Number(proximoPago.importe || 0)
                  )}`
                : "-"}
            </p>
            <p className="text-xs text-zinc-500">
              {shortName(proximoPago?.beneficiario)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-4">Liquidez</h2>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-zinc-500">Liquidez</p>
            <p className="metric-number">{money(liquidezActual)}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-500">Proyeccion de liquidez</p>
            <p className="metric-number">{money(proyeccionLiquidez)}</p>
            <p className="text-xs text-zinc-500">
              {proximaFechaMovimiento || "Sin movimientos futuros"}
            </p>
          </div>
          <div>
            <p className="text-sm text-zinc-500">Proyectado fin de mes</p>
            <p className="metric-number">{money(proyectadoFinMes)}</p>
            <p className="text-xs text-zinc-500">Hasta {finMes}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-500">Proyectado mes proximo</p>
            <p className="metric-number">{money(proyectadoMesProximo)}</p>
            <p className="text-xs text-zinc-500">Hasta {finMesProximo}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-4">Historial general</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Fecha</th>
              <th className="py-2">Tipo</th>
              <th className="py-2">Detalle</th>
              <th className="py-2 text-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {historial.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="py-2">{item.fecha}</td>
                <td className="py-2">{item.tipo}</td>
                <td className="py-2">{item.detalle}</td>
                <td className="py-2 text-right font-semibold">
                  {money(item.importe)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
