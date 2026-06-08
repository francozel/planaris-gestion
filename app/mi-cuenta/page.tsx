"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getAccessToken } from "@/lib/client-auth";
import { roleLabels } from "@/lib/permissions";

type PortalData = {
  usuario: {
    nombre: string | null;
    email: string;
    rol: keyof typeof roleLabels;
  };
  resumen: {
    gastos: number;
    reintegros: number;
    retiros: number;
  };
  historial: Array<{
    id: string;
    fecha: string;
    tipo: string;
    detalle: string;
    importe: number;
    estado: string | null;
  }>;
};

const money = (value: number) =>
  `$${Number(value || 0).toLocaleString("es-AR")}`;

export default function MiCuentaPage() {
  const { session } = useAuth();
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const accessToken = session?.access_token || (await getAccessToken());

    if (!accessToken) return;

    const response = await fetch("/api/mi-cuenta", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const result = (await response.json()) as {
      data?: PortalData;
      error?: string;
    };

    if (!response.ok) {
      setError(result.error || "No se pudo cargar el portal");
      return;
    }

    setData(result.data || null);
  }, [session]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar]);

  const saldo = useMemo(
    () =>
      (data?.resumen.gastos || 0) -
      (data?.resumen.reintegros || 0) -
      (data?.resumen.retiros || 0),
    [data]
  );

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-zinc-500">Cargando portal...</p>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl font-bold">Mi cuenta</h1>
        <p className="mt-2 text-zinc-500">
          {data.usuario.email} - {roleLabels[data.usuario.rol]}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Gastos asociados", data.resumen.gastos],
          ["Reintegros", data.resumen.reintegros],
          ["Retiros", data.resumen.retiros],
          ["Saldo", saldo],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border bg-white p-4">
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="metric-number">{money(Number(value))}</p>
          </div>
        ))}
      </section>

      <section className="overflow-x-auto rounded-lg border bg-white">
        <div className="border-b p-4">
          <h2 className="text-xl font-semibold">Historial personal</h2>
        </div>
        <table className="w-full min-w-[720px]">
          <thead className="bg-zinc-100 text-left">
            <tr>
              <th className="p-3">Fecha</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Detalle</th>
              <th className="p-3">Estado</th>
              <th className="p-3 text-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {data.historial.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="p-3">{item.fecha}</td>
                <td className="p-3">{item.tipo}</td>
                <td className="p-3">{item.detalle}</td>
                <td className="p-3">{item.estado || "-"}</td>
                <td className="p-3 text-right font-semibold">
                  {money(item.importe)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.historial.length === 0 && (
          <p className="p-6 text-zinc-500">Sin movimientos asociados.</p>
        )}
      </section>
    </div>
  );
}
