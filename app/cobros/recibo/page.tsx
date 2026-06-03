"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/client-auth";

type Cobro = {
  id: string;
  fecha: string;
  cliente: string | null;
  medio_cobro: string | null;
  moneda: string | null;
  importe_original: number | null;
  tipo_cambio: number | null;
  importe_pesos: number | null;
  retenciones_total: number | null;
  total_cancelado: number | null;
  banco: string | null;
  numero_operacion: string | null;
  numero_cheque: string | null;
  fecha_emision: string | null;
  fecha_pago: string | null;
  retenciones: Array<{ tipo: string; importe: number }> | null;
};

export default function ReciboPage() {
  const [cobro, setCobro] = useState<Cobro | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");

    if (!id) return;

    async function cargarRecibo() {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        setError("No se encontro una sesion activa");
        return;
      }

      const response = await fetch(`/api/cobros?id=${id}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const result = (await response.json()) as {
        data?: Cobro;
        error?: string;
      };

      if (!response.ok) {
        setError(result.error || "No se pudo cargar el recibo");
        return;
      }

      setCobro(result.data || null);
    }

    void cargarRecibo();
  }, []);

  if (error) {
    return <div className="p-10 text-red-600">{error}</div>;
  }

  if (!cobro) {
    return <div className="p-10">Cargando recibo...</div>;
  }

  return (
    <div className="bg-white min-h-screen p-10 text-black">
      <div className="print-area max-w-3xl mx-auto border rounded-lg p-8">
        <div className="flex justify-between gap-4 border-b pb-6">
          <div>
            <h1 className="text-3xl font-bold">Recibo</h1>
            <p className="text-sm text-gray-500">Planaris Gestion</p>
          </div>
          <button
            onClick={() => window.print()}
            className="print-hidden border rounded px-4 py-2 h-fit"
          >
            Descargar PDF
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div>
            <p className="text-sm text-gray-500">Cliente</p>
            <p className="font-semibold">{cobro.cliente || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Fecha</p>
            <p className="font-semibold">{cobro.fecha}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Medio de cobro</p>
            <p className="font-semibold">{cobro.medio_cobro || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Moneda / TC</p>
            <p className="font-semibold">
              {cobro.moneda || "ARS"} / {cobro.tipo_cambio || 1}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-8">
          <div className="border rounded p-4">
            <p className="text-sm text-gray-500">Importe original</p>
            <p className="text-xl font-bold">
              ${Number(cobro.importe_original || 0).toLocaleString("es-AR")}
            </p>
          </div>
          <div className="border rounded p-4">
            <p className="text-sm text-gray-500">Retenciones</p>
            <p className="text-xl font-bold">
              ${Number(cobro.retenciones_total || 0).toLocaleString("es-AR")}
            </p>
          </div>
          <div className="border rounded p-4">
            <p className="text-sm text-gray-500">Total cancelado ARS</p>
            <p className="text-xl font-bold">
              ${Number(cobro.total_cancelado || 0).toLocaleString("es-AR")}
            </p>
          </div>
        </div>

        {(cobro.banco || cobro.numero_operacion || cobro.numero_cheque) && (
          <div className="mt-8 border-t pt-6">
            <h2 className="font-semibold mb-3">Datos del instrumento</h2>
            <p>Banco: {cobro.banco || "-"}</p>
            <p>Operacion: {cobro.numero_operacion || "-"}</p>
            <p>Cheque: {cobro.numero_cheque || "-"}</p>
            <p>Emision: {cobro.fecha_emision || "-"}</p>
            <p>Pago: {cobro.fecha_pago || "-"}</p>
          </div>
        )}

        {cobro.retenciones && cobro.retenciones.length > 0 && (
          <div className="mt-8 border-t pt-6">
            <h2 className="font-semibold mb-3">Retenciones aplicadas</h2>
            {cobro.retenciones.map((retencion, index) => (
              <p key={`${retencion.tipo}-${index}`}>
                {retencion.tipo}: ${retencion.importe.toLocaleString("es-AR")}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
