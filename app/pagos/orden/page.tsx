"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getAccessToken } from "@/lib/client-auth";

type Imputacion = {
  id: string;
  tipo: string;
  beneficiario: string | null;
  importe: number;
};

type MedioPago = {
  id: string;
  medio_pago: string;
  importe: number;
  banco: string | null;
  numero_operacion: string | null;
  numero_cheque: string | null;
  fecha_emision: string | null;
  fecha_pago: string | null;
};

type Retencion = {
  id: string;
  tipo: string;
  importe: number;
};

type OrdenPago = {
  id: string;
  numero: number | null;
  fecha: string;
  beneficiario: string | null;
  observaciones: string | null;
  pagos: Imputacion[];
  ordenes_pago_medios: MedioPago[];
  ordenes_pago_retenciones: Retencion[];
};

const dinero = (importe: number) =>
  `$${Number(importe || 0).toLocaleString("es-AR")}`;

const numeroOrden = (numero: number | null) =>
  numero ? `OP-${String(numero).padStart(6, "0")}` : "Orden historica";

export default function OrdenPagoPage() {
  const [orden, setOrden] = useState<OrdenPago | null>(null);
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
        data?: OrdenPago;
        error?: string;
      };

      if (!response.ok) {
        setError(result.error || "No se pudo cargar la orden de pago");
        return;
      }

      setOrden(result.data || null);
    }

    void cargarOrden();
  }, []);

  const totales = useMemo(() => {
    const imputado = (orden?.pagos || []).reduce(
      (acc, pago) => acc + Number(pago.importe || 0),
      0
    );
    const pagado = (orden?.ordenes_pago_medios || []).reduce(
      (acc, medio) => acc + Number(medio.importe || 0),
      0
    );
    const retenido = (orden?.ordenes_pago_retenciones || []).reduce(
      (acc, retencion) => acc + Number(retencion.importe || 0),
      0
    );

    return { imputado, pagado, retenido };
  }, [orden]);

  if (error) {
    return <div className="p-10 text-red-600">{error}</div>;
  }

  if (!orden) {
    return <div className="p-10">Cargando orden de pago...</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-100 p-4 text-black sm:p-8">
      <div className="print-hidden mx-auto mb-4 flex max-w-5xl justify-between gap-3">
        <Link
          href="/pagos"
          className="inline-flex items-center gap-2 rounded border bg-white px-4 py-2"
        >
          <ArrowLeft size={18} />
          Volver
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded bg-black px-4 py-2 text-white"
        >
          <Printer size={18} />
          Imprimir / PDF
        </button>
      </div>

      <main className="print-area mx-auto max-w-5xl rounded-lg border bg-white p-5 sm:p-10">
        <header className="flex flex-wrap justify-between gap-5 border-b pb-6">
          <div>
            <p className="text-sm text-zinc-500">Planaris Gestion</p>
            <h1 className="text-3xl font-bold">Orden de pago</h1>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-2xl font-bold">{numeroOrden(orden.numero)}</p>
            <p className="text-sm text-zinc-500">Fecha: {orden.fecha}</p>
          </div>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-zinc-500">Beneficiario</p>
            <p className="font-semibold">{orden.beneficiario || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-500">Total de la orden</p>
            <p className="text-2xl font-bold">{dinero(totales.imputado)}</p>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-xl font-semibold">Imputaciones</h2>
          <div className="overflow-x-auto rounded border">
            <table className="w-full min-w-[560px]">
              <thead className="bg-zinc-100 text-left">
                <tr>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Beneficiario</th>
                  <th className="p-3 text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {orden.pagos.map((pago) => (
                  <tr key={pago.id} className="border-t">
                    <td className="p-3 capitalize">{pago.tipo}</td>
                    <td className="p-3">{pago.beneficiario || "-"}</td>
                    <td className="p-3 text-right font-semibold">
                      {dinero(pago.importe)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-xl font-semibold">Medios de pago</h2>
          <div className="space-y-3">
            {orden.ordenes_pago_medios.length === 0 && (
              <p className="rounded border p-4 text-zinc-500">
                Cancelada completamente mediante retenciones
              </p>
            )}
            {orden.ordenes_pago_medios.map((medio) => (
              <div key={medio.id} className="rounded border p-4">
                <div className="flex flex-wrap justify-between gap-3">
                  <p className="font-semibold">{medio.medio_pago}</p>
                  <p className="font-bold">{dinero(medio.importe)}</p>
                </div>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                  {medio.banco && <p>Banco: {medio.banco}</p>}
                  {medio.numero_operacion && (
                    <p>Operacion: {medio.numero_operacion}</p>
                  )}
                  {medio.numero_cheque && (
                    <p>Cheque: {medio.numero_cheque}</p>
                  )}
                  {medio.fecha_emision && (
                    <p>Emision: {medio.fecha_emision}</p>
                  )}
                  {medio.fecha_pago && <p>Pago: {medio.fecha_pago}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-xl font-semibold">Retenciones</h2>
          {orden.ordenes_pago_retenciones.length === 0 ? (
            <p className="rounded border p-4 text-zinc-500">Sin retenciones</p>
          ) : (
            <div className="overflow-hidden rounded border">
              {orden.ordenes_pago_retenciones.map((retencion) => (
                <div
                  key={retencion.id}
                  className="flex justify-between gap-3 border-b p-3 last:border-b-0"
                >
                  <span>{retencion.tipo}</span>
                  <strong>{dinero(retencion.importe)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 grid gap-3 border-t pt-6 sm:grid-cols-3">
          <div>
            <p className="text-sm text-zinc-500">Medios de pago</p>
            <p className="text-xl font-bold">{dinero(totales.pagado)}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-500">Retenciones</p>
            <p className="text-xl font-bold">{dinero(totales.retenido)}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-500">Suma total</p>
            <p className="text-xl font-bold">
              {dinero(totales.pagado + totales.retenido)}
            </p>
          </div>
        </section>

        {orden.observaciones && (
          <section className="mt-8 border-t pt-6">
            <h2 className="mb-2 font-semibold">Observaciones</h2>
            <p>{orden.observaciones}</p>
          </section>
        )}
      </main>
    </div>
  );
}
