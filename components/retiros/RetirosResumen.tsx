"use client";

import { useMemo, useState } from "react";

type RetiroResumenItem = {
  fecha: string;
  importe?: number | null;
  tipo?: string | null;
};

export default function RetirosResumen({
  retiros,
}: {
  retiros: RetiroResumenItem[];
}) {
  const hoy = useMemo(() => new Date(), []);
  const [vista, setVista] = useState("mensual");
  const [desde, setDesde] = useState(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`);
  const [hasta, setHasta] = useState(hoy.toISOString().split("T")[0]);

  const filtrados = useMemo(() => {
    return retiros.filter((retiro) => {
      if (vista === "historico") return true;

      const fecha = new Date(retiro.fecha);

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
  }, [retiros, vista, desde, hasta, hoy]);

  const total = filtrados.reduce((acc, r) => acc + Number(r.importe || 0), 0);
  const anticipos = filtrados.filter((r) => r.tipo === "Anticipo").reduce((acc, r) => acc + Number(r.importe || 0), 0);
  const dividendos = filtrados.filter((r) => r.tipo === "Dividendo").reduce((acc, r) => acc + Number(r.importe || 0), 0);
  const cantidad = filtrados.length;

  return (
    <div className="mb-8">
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-sm text-zinc-500 mb-2">Vista</label>
            <select value={vista} onChange={(e) => setVista(e.target.value)} className="border rounded-xl p-3">
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

      <div className="grid grid-cols-4 gap-4">
        <Card title="Total retiros" value={total} />
        <Card title="Anticipos" value={anticipos} />
        <Card title="Dividendos" value={dividendos} />
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-zinc-500 text-sm mb-2">Cantidad</p>
          <h3 className="metric-number">{cantidad}</h3>
        </div>
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
