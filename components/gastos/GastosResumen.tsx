"use client";

import { useMemo, useState } from "react";

type GastoResumenItem = {
  fecha: string;
  importe_total?: number | null;
  importe_neto?: number | null;
  iva?: number | null;
  otros_impuestos?: number | null;
  reintegrado?: boolean | null;
};

export default function GastosResumen({
  gastos,
}: {
  gastos: GastoResumenItem[];
}) {
  const hoy = useMemo(() => new Date(), []);
  const [vista, setVista] = useState("mensual");
  const [desde, setDesde] = useState(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`);
  const [hasta, setHasta] = useState(hoy.toISOString().split("T")[0]);

  const gastosFiltrados = useMemo(() => {
    return gastos.filter((gasto) => {
      if (vista === "historico") return true;

      const fecha = new Date(gasto.fecha);

      if (vista === "mensual") {
        return fecha.getMonth() === hoy.getMonth() && fecha.getFullYear() === hoy.getFullYear();
      }

      if (vista === "anual") {
        return fecha.getFullYear() === hoy.getFullYear();
      }

      if (vista === "personalizado") {
        return fecha >= new Date(desde) && fecha <= new Date(hasta);
      }

      return true;
    });
  }, [gastos, vista, desde, hasta, hoy]);

  const total = gastosFiltrados.reduce((acc, g) => acc + Number(g.importe_total || 0), 0);
  const neto = gastosFiltrados.reduce((acc, g) => acc + Number(g.importe_neto || 0), 0);
  const iva = gastosFiltrados.reduce((acc, g) => acc + Number(g.iva || 0), 0);
  const otros = gastosFiltrados.reduce((acc, g) => acc + Number(g.otros_impuestos || 0), 0);
  const pendientes = gastosFiltrados
    .filter((g) => !g.reintegrado)
    .reduce((acc, g) => acc + Number(g.importe_total || 0), 0);

  return (
    <div className="mb-8">
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-sm text-zinc-500 mb-2">Vista</label>
            <select
              value={vista}
              onChange={(e) => setVista(e.target.value)}
              className="border rounded-xl p-3"
            >
              <option value="mensual">Mensual</option>
              <option value="anual">Anual</option>
              <option value="historico">Histórico</option>
              <option value="personalizado">Período personalizado</option>
            </select>
          </div>

          {vista === "personalizado" && (
            <>
              <div>
                <label className="block text-sm text-zinc-500 mb-2">Desde</label>
                <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="border rounded-xl p-3" />
              </div>

              <div>
                <label className="block text-sm text-zinc-500 mb-2">Hasta</label>
                <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="border rounded-xl p-3" />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <Card title="Total" value={total} />
        <Card title="Neto" value={neto} />
        <Card title="IVA" value={iva} />
        <Card title="Otros impuestos" value={otros} />
        <Card title="Pendiente reintegro" value={pendientes} />
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <p className="text-zinc-500 text-sm mb-2">{title}</p>
      <h3 className="metric-number">
        ${value.toLocaleString("es-AR")}
      </h3>
    </div>
  );
}
