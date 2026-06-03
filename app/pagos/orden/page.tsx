"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/client-auth";

type Pago = {
  id: string;
  fecha: string;
  tipo: string;
  beneficiario: string | null;
  importe: number;
  medio_pago: string | null;
  observaciones: string | null;
};

export default function OrdenPagoPage() {
  const [pago, setPago] = useState<Pago | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");

    if (!id) return;

    async function cargarOrden() {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        setError("No se encontro una sesion activa");
        return;
      }

      const response = await fetch(`/api/pagos?id=${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = (await response.json()) as {
        data?: Pago;
        error?: string;
      };

      if (!response.ok) {
        setError(result.error || "No se pudo cargar la orden de pago");
        return;
      }

      setPago(result.data || null);
    }

    void cargarOrden();
  }, []);

  if (error) {
    return <div className="p-10 text-red-600">{error}</div>;
  }

  if (!pago) {
    return <div className="p-10">Cargando orden de pago...</div>;
  }

  return (
    <div className="bg-white min-h-screen p-10 text-black">
      <div className="print-area max-w-3xl mx-auto border rounded-lg p-8">
        <div className="flex justify-between gap-4 border-b pb-6">
          <div>
            <h1 className="text-3xl font-bold">Orden de pago</h1>
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
            <p className="text-sm text-gray-500">Beneficiario</p>
            <p className="font-semibold">{pago.beneficiario || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Fecha</p>
            <p className="font-semibold">{pago.fecha}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Tipo</p>
            <p className="font-semibold">{pago.tipo}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Medio</p>
            <p className="font-semibold">{pago.medio_pago || "-"}</p>
          </div>
        </div>

        <div className="border rounded p-4 mt-8">
          <p className="text-sm text-gray-500">Importe pagado</p>
          <p className="text-2xl font-bold">
            ${Number(pago.importe || 0).toLocaleString("es-AR")}
          </p>
        </div>

        {pago.observaciones && (
          <div className="mt-8 border-t pt-6">
            <h2 className="font-semibold mb-2">Observaciones</h2>
            <p>{pago.observaciones}</p>
          </div>
        )}
      </div>
    </div>
  );
}
