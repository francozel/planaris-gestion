"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PeriodSelector from "@/components/PeriodSelector";
import { supabase } from "@/lib/supabase";
import {
  matchesPeriod,
  monthStartISO,
  todayISO,
  type PeriodView,
} from "@/lib/period";
import { signedAmount } from "@/lib/accounting";

type Venta = {
  id: string;
  fecha: string;
  tipo_comprobante: string | null;
  razon_social: string | null;
  importe: number | null;
};

type Compra = {
  id: string;
  fecha: string;
  tipo_comprobante: string | null;
  razon_social: string | null;
  proveedor: string | null;
  importe: number | null;
};

type Cobro = {
  id: string;
  fecha: string;
  cliente: string | null;
  total_cancelado: number | null;
};

type Pago = {
  id: string;
  fecha: string;
  beneficiario: string | null;
  importe: number | null;
};

type Gasto = {
  id: string;
  fecha: string;
  proveedor: string | null;
  categoria: string | null;
  importe_total: number | null;
};

function money(value: number) {
  return `$${value.toLocaleString("es-AR")}`;
}

function addToMap(map: Record<string, number>, key: string, value: number) {
  map[key] = (map[key] || 0) + value;
}

export default function ReportesPage() {
  const [vista, setVista] = useState<PeriodView>("mensual");
  const [desde, setDesde] = useState(monthStartISO());
  const [hasta, setHasta] = useState(todayISO());
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);

  const cargarDatos = useCallback(async () => {
    setLoading(true);

    const [ventasResult, comprasResult, cobrosResult, pagosResult, gastosResult] =
      await Promise.all([
        supabase.from("ingresos").select("id, fecha, tipo_comprobante, razon_social, importe"),
        supabase.from("compras").select("id, fecha, tipo_comprobante, razon_social, proveedor, importe"),
        supabase.from("cobros").select("id, fecha, cliente, total_cancelado"),
        supabase.from("pagos").select("id, fecha, beneficiario, importe"),
        supabase.from("gastos").select("id, fecha, proveedor, categoria, importe_total"),
      ]);

    setVentas(ventasResult.data || []);
    setCompras(comprasResult.data || []);
    setCobros((cobrosResult.data || []) as Cobro[]);
    setPagos((pagosResult.data || []) as Pago[]);
    setGastos(gastosResult.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarDatos();
  }, [cargarDatos]);

  const reportes = useMemo(() => {
    const ventasPeriodo = ventas.filter((item) =>
      matchesPeriod(item.fecha, vista, desde, hasta)
    );
    const comprasPeriodo = compras.filter((item) =>
      matchesPeriod(item.fecha, vista, desde, hasta)
    );
    const cobrosPeriodo = cobros.filter((item) =>
      matchesPeriod(item.fecha, vista, desde, hasta)
    );
    const pagosPeriodo = pagos.filter((item) =>
      matchesPeriod(item.fecha, vista, desde, hasta)
    );
    const gastosPeriodo = gastos.filter((item) =>
      matchesPeriod(item.fecha, vista, desde, hasta)
    );

    const clientes: Record<string, number> = {};
    const proveedores: Record<string, number> = {};

    ventasPeriodo.forEach((venta) =>
      addToMap(
        clientes,
        venta.razon_social || "Cliente sin nombre",
        signedAmount(venta.tipo_comprobante, Number(venta.importe || 0))
      )
    );
    cobrosPeriodo.forEach((cobro) =>
      addToMap(clientes, cobro.cliente || "Cliente sin nombre", -Number(cobro.total_cancelado || 0))
    );
    comprasPeriodo.forEach((compra) =>
      addToMap(
        proveedores,
        compra.razon_social || compra.proveedor || "Proveedor sin nombre",
        signedAmount(compra.tipo_comprobante, Number(compra.importe || 0))
      )
    );
    pagosPeriodo.forEach((pago) =>
      addToMap(proveedores, pago.beneficiario || "Proveedor sin nombre", -Number(pago.importe || 0))
    );

    const totalVentas = ventasPeriodo.reduce(
      (acc, item) =>
        acc + signedAmount(item.tipo_comprobante, Number(item.importe || 0)),
      0
    );
    const totalCompras = comprasPeriodo.reduce(
      (acc, item) =>
        acc + signedAmount(item.tipo_comprobante, Number(item.importe || 0)),
      0
    );
    const totalCobros = cobrosPeriodo.reduce(
      (acc, item) => acc + Number(item.total_cancelado || 0),
      0
    );
    const totalPagos = pagosPeriodo.reduce(
      (acc, item) => acc + Number(item.importe || 0),
      0
    );
    const totalGastos = gastosPeriodo.reduce(
      (acc, item) => acc + Number(item.importe_total || 0),
      0
    );

    return {
      clientes,
      proveedores,
      totalVentas,
      totalCompras,
      totalCobros,
      totalPagos,
      totalGastos,
      resultado: totalVentas - totalCompras - totalGastos,
      caja: totalCobros - totalPagos,
    };
  }, [cobros, compras, desde, gastos, hasta, pagos, ventas, vista]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Reportes</h1>
        <p className="text-zinc-500 mt-2">
          Resumenes de cuenta e informes contables
        </p>
      </div>

      <PeriodSelector
        view={vista}
        from={desde}
        to={hasta}
        onViewChange={setVista}
        onFromChange={setDesde}
        onToChange={setHasta}
      />

      {loading && <p>Cargando reportes...</p>}

      <div className="grid grid-cols-4 gap-4">
        <div className="border rounded-lg p-4 bg-white">
          <p className="text-sm text-zinc-500">Resultado contable</p>
          <p className="metric-number">{money(reportes.resultado)}</p>
        </div>
        <div className="border rounded-lg p-4 bg-white">
          <p className="text-sm text-zinc-500">Caja neta</p>
          <p className="metric-number">{money(reportes.caja)}</p>
        </div>
        <div className="border rounded-lg p-4 bg-white">
          <p className="text-sm text-zinc-500">Ventas / Cobros</p>
          <p className="metric-number">
            {money(reportes.totalVentas)} / {money(reportes.totalCobros)}
          </p>
        </div>
        <div className="border rounded-lg p-4 bg-white">
          <p className="text-sm text-zinc-500">Compras+Gastos / Pagos</p>
          <p className="metric-number">
            {money(reportes.totalCompras + reportes.totalGastos)} /{" "}
            {money(reportes.totalPagos)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-lg p-4 bg-white">
          <h2 className="text-xl font-semibold mb-3">Cuenta clientes</h2>
          {Object.entries(reportes.clientes).map(([cliente, saldo]) => (
            <div key={cliente} className="flex justify-between border-t py-2">
              <span>{cliente}</span>
              <strong>{money(saldo)}</strong>
            </div>
          ))}
        </div>

        <div className="border rounded-lg p-4 bg-white">
          <h2 className="text-xl font-semibold mb-3">Cuenta proveedores</h2>
          {Object.entries(reportes.proveedores).map(([proveedor, saldo]) => (
            <div key={proveedor} className="flex justify-between border-t py-2">
              <span>{proveedor}</span>
              <strong>{money(saldo)}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
