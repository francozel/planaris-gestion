"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import PeriodSelector from "@/components/PeriodSelector";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { canManageRecords } from "@/lib/permissions";
import { signedAmount } from "@/lib/accounting";
import { getAccessToken } from "@/lib/client-auth";
import {
  matchesPeriod,
  monthStartISO,
  todayISO,
  type PeriodView,
} from "@/lib/period";

type Venta = {
  id: string;
  fecha: string;
  tipo_comprobante: string | null;
  numero_comprobante: string | null;
  razon_social: string | null;
  cuit: string | null;
  importe: number | null;
  estado: string | null;
};

type Cobro = {
  id: string;
  fecha: string;
  venta_id: string;
  cliente: string | null;
  medio_cobro: string | null;
  moneda: string | null;
  importe_original: number | null;
  tipo_cambio: number | null;
  importe_pesos: number | null;
  retenciones_total: number | null;
  total_cancelado: number | null;
  banco_id: string | null;
  banco: string | null;
  numero_operacion: string | null;
  numero_cheque: string | null;
  fecha_emision: string | null;
  fecha_pago: string | null;
};

type Banco = {
  id: string;
  nombre: string | null;
  banco: string | null;
  moneda: string | null;
  saldo_actual: number | null;
  activo: boolean | null;
};

type Retencion = {
  tipo: string;
  importe: number;
};

type ImputacionCobro = {
  venta_id: string;
  cliente: string | null;
  numero_comprobante: string | null;
  importe: number;
};

type InstrumentoCobro = {
  id: string;
  medio_cobro: string;
  moneda: string;
  importe_original: number;
  tipo_cambio: number;
  importe_pesos: number;
  banco_id: string | null;
  banco: string;
  numero_operacion: string;
  numero_cheque: string;
  fecha_emision: string | null;
  fecha_pago: string | null;
};

const hoy = () => new Date().toISOString().split("T")[0];

function numero(valor: string) {
  const resultado = Number(valor.replace(",", ".") || 0);
  return Number.isFinite(resultado) ? resultado : 0;
}

function abreviar(texto: string | null | undefined) {
  if (!texto) return "-";
  return texto.length > 18 ? `${texto.slice(0, 18)}...` : texto;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message);
  }

  return "Error desconocido";
}

export default function CobrosPage() {
  const { session, user } = useAuth();
  const puedeGestionar = canManageRecords(user?.rol);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");
  const [vistaCheques, setVistaCheques] = useState(false);
  const [ultimoCobroId, setUltimoCobroId] = useState("");
  const [vista, setVista] = useState<PeriodView>("mensual");
  const [desde, setDesde] = useState(monthStartISO());
  const [hasta, setHasta] = useState(todayISO());

  const [ventaId, setVentaId] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [medioCobro, setMedioCobro] = useState("Caja");
  const [moneda, setMoneda] = useState("ARS");
  const [importe, setImporte] = useState("");
  const [tipoCambio, setTipoCambio] = useState("1");
  const [bancoDestinoId, setBancoDestinoId] = useState("");
  const [banco, setBanco] = useState("");
  const [numeroOperacion, setNumeroOperacion] = useState("");
  const [numeroCheque, setNumeroCheque] = useState("");
  const [fechaEmision, setFechaEmision] = useState(hoy());
  const [fechaPago, setFechaPago] = useState(hoy());
  const [retencionTipo, setRetencionTipo] = useState("Ganancias");
  const [retencionImporte, setRetencionImporte] = useState("");
  const [retenciones, setRetenciones] = useState<Retencion[]>([]);
  const [imputaciones, setImputaciones] = useState<ImputacionCobro[]>([]);
  const [instrumentos, setInstrumentos] = useState<InstrumentoCobro[]>([]);

  const cargarDatos = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setErrorCarga("");

    const accessToken = session?.access_token || (await getAccessToken());

    const [ventasResult, cobrosResponse] = await Promise.all([
      supabase
        .from("ingresos")
        .select("id, fecha, tipo_comprobante, numero_comprobante, razon_social, cuit, importe, estado")
        .neq("estado", "Cobrada")
        .order("fecha", { ascending: false }),
      accessToken
        ? fetch("/api/cobros", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          })
        : Promise.resolve(null),
    ]);

    if (ventasResult.error || !cobrosResponse) {
      setErrorCarga("No se pudieron cargar los cobros.");
      setLoading(false);
      return;
    }

    const cobrosResult = (await cobrosResponse.json()) as {
      data?: Cobro[];
      error?: string;
    };

    if (!cobrosResponse.ok) {
      setErrorCarga(cobrosResult.error || "No se pudieron cargar los cobros.");
      setLoading(false);
      return;
    }

    setVentas(ventasResult.data || []);
    setCobros(cobrosResult.data || []);

    if (accessToken) {
      const bancosResponse = await fetch("/api/bancos", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const bancosResult = (await bancosResponse.json()) as {
        data?: Banco[];
      };

      setBancos((bancosResult.data || []).filter((banco) => banco.activo !== false));
    }

    setLoading(false);
  }, [session]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarDatos();
  }, [cargarDatos]);

  const cobradoPorVenta = useMemo(() => {
    return cobros.reduce<Record<string, number>>((acc, cobro) => {
      acc[cobro.venta_id] =
        (acc[cobro.venta_id] || 0) + Number(cobro.total_cancelado || 0);
      return acc;
    }, {});
  }, [cobros]);

  const pendientes = ventas.map((venta) => {
    const total = signedAmount(
      venta.tipo_comprobante,
      Number(venta.importe || 0)
    );
    const cobrado = cobradoPorVenta[venta.id] || 0;
    return {
      ...venta,
      pendiente: Math.max(total - cobrado, 0),
    };
  });

  const ventaSeleccionada =
    pendientes.find((venta) => venta.id === ventaId) || null;
  const cambio = moneda === "ARS" ? 1 : numero(tipoCambio);
  const importeOriginal = numero(importe);
  const importePesos = importeOriginal * cambio;
  const totalRetenciones = retenciones.reduce(
    (acc, retencion) => acc + retencion.importe,
    0
  );
  const totalInstrumentos = instrumentos.reduce(
    (acc, instrumento) => acc + instrumento.importe_pesos,
    0
  );
  const pagosEnPesos = instrumentos.length > 0 ? totalInstrumentos : importePesos;
  const totalCancelado = pagosEnPesos + totalRetenciones;
  const totalImputado = imputaciones.reduce(
    (acc, imputacion) => acc + imputacion.importe,
    0
  );
  const cobrosFiltrados = cobros.filter((cobro) =>
    matchesPeriod(cobro.fecha, vista, desde, hasta)
  );

  const cheques = cobrosFiltrados.filter((cobro) =>
    (cobro.medio_cobro || "").toLowerCase().includes("cheque")
  );
  const proximoCheque = [...cheques]
    .filter((cobro) => cobro.fecha_pago)
    .sort((a, b) => String(a.fecha_pago).localeCompare(String(b.fecha_pago)))[0];
  const totalPendiente = pendientes.reduce(
    (acc, venta) => acc + venta.pendiente,
    0
  );
  const totalCheques = cheques.reduce(
    (acc, cobro) => acc + Number(cobro.importe_pesos || 0),
    0
  );

  function agregarRetencion() {
    const valor = numero(retencionImporte);

    if (valor <= 0) return;

    setRetenciones([...retenciones, { tipo: retencionTipo, importe: valor }]);
    setRetencionImporte("");
  }

  function limpiarInstrumentoActual() {
    setImporte("");
    setTipoCambio("1");
    setBancoDestinoId("");
    setBanco("");
    setNumeroOperacion("");
    setNumeroCheque("");
    setFechaEmision(hoy());
    setFechaPago(hoy());
  }

  function agregarInstrumento() {
    if (importePesos <= 0) {
      alert("Ingresa el importe del pago");
      return;
    }

    if (moneda === "USD" && cambio <= 0) {
      alert("Ingresa un tipo de cambio valido");
      return;
    }

    setInstrumentos([
      ...instrumentos,
      {
        id: `${instrumentos.length + 1}-${medioCobro}-${importePesos}`,
        medio_cobro: medioCobro,
        moneda,
        importe_original: importeOriginal,
        tipo_cambio: cambio,
        importe_pesos: importePesos,
        banco_id: bancoDestinoId || null,
        banco: banco.trim(),
        numero_operacion: numeroOperacion.trim(),
        numero_cheque: numeroCheque.trim(),
        fecha_emision: medioCobro.includes("Cheque") ? fechaEmision : null,
        fecha_pago: medioCobro.includes("Cheque") ? fechaPago : null,
      },
    ]);
    limpiarInstrumentoActual();
  }

  function quitarInstrumento(id: string) {
    setInstrumentos(instrumentos.filter((instrumento) => instrumento.id !== id));
  }

  function agregarImputacion() {
    if (!ventaSeleccionada) {
      alert("Selecciona una factura pendiente");
      return;
    }

    if (imputaciones.some((item) => item.venta_id === ventaSeleccionada.id)) {
      alert("La factura ya esta imputada");
      return;
    }

    if (ventaSeleccionada.pendiente <= 0) {
      alert("La factura no tiene saldo pendiente");
      return;
    }

    setImputaciones([
      ...imputaciones,
      {
        venta_id: ventaSeleccionada.id,
        cliente: ventaSeleccionada.razon_social,
        numero_comprobante: ventaSeleccionada.numero_comprobante,
        importe: ventaSeleccionada.pendiente,
      },
    ]);
    setVentaId("");
  }

  function quitarImputacion(ventaIdValue: string) {
    setImputaciones(
      imputaciones.filter((item) => item.venta_id !== ventaIdValue)
    );
  }

  function limpiarFormulario() {
    setVentaId("");
    setFecha(hoy());
    setMedioCobro("Caja");
    setMoneda("ARS");
    setImporte("");
    setTipoCambio("1");
    setBancoDestinoId("");
    setBanco("");
    setNumeroOperacion("");
    setNumeroCheque("");
    setFechaEmision(hoy());
    setFechaPago(hoy());
    setRetenciones([]);
    setImputaciones([]);
    setInstrumentos([]);
  }

  async function registrarCobro() {
    if (!puedeGestionar) {
      alert("Solo los socios pueden registrar cobros");
      return;
    }

    if (pagosEnPesos <= 0 && totalRetenciones <= 0) {
      alert("Ingresa un importe o retenciones");
      return;
    }

    if (moneda === "USD" && cambio <= 0) {
      alert("Ingresa un tipo de cambio valido");
      return;
    }

    const imputacionesFinales =
      imputaciones.length > 0
        ? imputaciones
        : ventaSeleccionada
        ? [
            {
              venta_id: ventaSeleccionada.id,
              cliente: ventaSeleccionada.razon_social,
              numero_comprobante: ventaSeleccionada.numero_comprobante,
              importe: totalCancelado,
            },
          ]
        : [];

    if (imputacionesFinales.length === 0) {
      alert("Agrega al menos una imputacion");
      return;
    }

    const totalImputadoFinal = imputacionesFinales.reduce(
      (acc, item) => acc + Number(item.importe || 0),
      0
    );

    if (Math.abs(totalImputadoFinal - totalCancelado) > 0.01) {
      alert("El total imputado debe coincidir con el total cancelado");
      return;
    }

    try {
      setGuardando(true);

      const accessToken = session?.access_token || (await getAccessToken());

      if (!accessToken) {
        throw new Error("No se encontro una sesion activa");
      }

      const response = await fetch("/api/cobros", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fecha,
          venta_id: imputacionesFinales[0].venta_id,
          cliente: imputacionesFinales[0].cliente,
          imputaciones: imputacionesFinales,
          instrumentos:
            instrumentos.length > 0
              ? instrumentos.map((instrumento) => ({
                  medio_cobro: instrumento.medio_cobro,
                  moneda: instrumento.moneda,
                  importe_original: instrumento.importe_original,
                  tipo_cambio: instrumento.tipo_cambio,
                  importe_pesos: instrumento.importe_pesos,
                  banco_id: instrumento.banco_id,
                  banco: instrumento.banco,
                  numero_operacion: instrumento.numero_operacion,
                  numero_cheque: instrumento.numero_cheque,
                  fecha_emision: instrumento.fecha_emision,
                  fecha_pago: instrumento.fecha_pago,
                }))
              : undefined,
          medio_cobro: medioCobro,
          moneda,
          importe_original: importeOriginal,
          tipo_cambio: cambio,
          importe_pesos: importePesos,
          retenciones_total: totalRetenciones,
          retenciones,
          total_cancelado: totalCancelado,
          banco_id: bancoDestinoId || null,
          banco: banco.trim(),
          numero_operacion: numeroOperacion.trim(),
          numero_cheque: numeroCheque.trim(),
          fecha_emision: medioCobro.includes("Cheque") ? fechaEmision : null,
          fecha_pago: medioCobro.includes("Cheque") ? fechaPago : null,
        }),
      });
      const result = (await response.json()) as { id?: string; error?: string };

      if (!response.ok) {
        throw new Error(result.error || "No se pudo registrar el cobro");
      }

      limpiarFormulario();
      await cargarDatos();

      if (result.id) {
        setUltimoCobroId(result.id);
      }
    } catch (error) {
      alert(`Error al registrar el cobro: ${errorMessage(error)}`);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarCobro(cobro: Cobro) {
    if (!puedeGestionar) return;

    const confirmado = confirm(
      `Eliminar cobro de ${cobro.cliente || "cliente"}?`
    );

    if (!confirmado) return;

    const accessToken = session?.access_token || (await getAccessToken());

    if (!accessToken) {
      alert("No se encontro una sesion activa");
      return;
    }

    const response = await fetch(`/api/cobros?id=${cobro.id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      alert(result.error || "No se pudo eliminar el cobro");
      return;
    }

    await cargarDatos();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Cobros</h1>
        <p className="text-zinc-500 mt-2">
          Cancelacion total o parcial de facturas emitidas
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

      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 bg-white">
          <div className="text-sm text-gray-500">Cobros pendientes</div>
          <div className="text-2xl font-bold">
            ${totalPendiente.toLocaleString("es-AR")}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setVistaCheques(!vistaCheques)}
          className="border rounded-lg p-4 bg-white text-left"
        >
          <div className="text-sm text-gray-500">Cheques recibidos</div>
          <div className="text-2xl font-bold">
            ${totalCheques.toLocaleString("es-AR")}
          </div>
        </button>

        <div className="border rounded-lg p-4 bg-white">
          <div className="text-sm text-gray-500">Proximo ch a vencer</div>
          <div className="text-lg font-bold">
            {proximoCheque
              ? `$${Number(proximoCheque.importe_pesos || 0).toLocaleString(
                  "es-AR"
                )}`
              : "-"}
          </div>
          <div className="text-xs text-gray-500">
            {proximoCheque
              ? `${proximoCheque.fecha_pago} - ${abreviar(proximoCheque.cliente)}`
              : "Sin cheques pendientes"}
          </div>
        </div>
      </div>

      {vistaCheques && (
        <div className="border rounded-lg bg-white overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-100">
              <tr>
                <th className="text-left p-3">Fecha pago</th>
                <th className="text-left p-3">Cliente</th>
                <th className="text-left p-3">Banco</th>
                <th className="text-left p-3">Cheque</th>
                <th className="text-left p-3">Importe</th>
              </tr>
            </thead>
            <tbody>
              {cheques.map((cheque) => (
                <tr key={cheque.id} className="border-t">
                  <td className="p-3">{cheque.fecha_pago || "-"}</td>
                  <td className="p-3">{cheque.cliente || "-"}</td>
                  <td className="p-3">{cheque.banco || "-"}</td>
                  <td className="p-3">{cheque.numero_cheque || "-"}</td>
                  <td className="p-3 font-semibold">
                    ${Number(cheque.importe_pesos || 0).toLocaleString("es-AR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {puedeGestionar && (
      <div className="border rounded-lg p-4 bg-white space-y-4">
        <h2 className="text-xl font-semibold">Registrar cobro</h2>

        <select
          className="border rounded p-2 w-full"
          value={ventaId}
          onChange={(event) => setVentaId(event.target.value)}
        >
          <option value="">Seleccionar factura emitida</option>
          {pendientes.map((venta) => (
            <option key={venta.id} value={venta.id}>
              {venta.razon_social || "Cliente"} - {venta.numero_comprobante} -
              pendiente ${venta.pendiente.toLocaleString("es-AR")}
            </option>
          ))}
        </select>

        <div className="border rounded-lg p-3 bg-zinc-50 space-y-3">
          <div className="flex justify-between gap-3 items-center">
            <div>
              <h3 className="font-semibold">Imputaciones</h3>
              <p className="text-sm text-zinc-500">
                Total imputado: ${totalImputado.toLocaleString("es-AR")}
              </p>
            </div>
            <button
              type="button"
              onClick={agregarImputacion}
              className="border rounded px-4 py-2 bg-white"
            >
              Agregar imputacion
            </button>
          </div>
          {imputaciones.length > 0 && (
            <div className="space-y-2">
              {imputaciones.map((imputacion) => (
                <div
                  key={imputacion.venta_id}
                  className="grid grid-cols-4 gap-3 items-center text-sm"
                >
                  <div className="col-span-2">
                    {imputacion.cliente || "Cliente"} -{" "}
                    {imputacion.numero_comprobante || "Sin comprobante"}
                  </div>
                  <input
                    className="border rounded p-2"
                    type="number"
                    value={imputacion.importe}
                    onChange={(event) =>
                      setImputaciones(
                        imputaciones.map((item) =>
                          item.venta_id === imputacion.venta_id
                            ? { ...item, importe: numero(event.target.value) }
                            : item
                        )
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() => quitarImputacion(imputacion.venta_id)}
                    className="border rounded px-3 py-2 text-red-600"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-3">
          <select
            className="border rounded p-2"
            value={medioCobro}
            onChange={(event) => setMedioCobro(event.target.value)}
          >
            <option>Caja</option>
            <option>Transferencia</option>
            <option>Cheque propio</option>
            <option>Cheque de terceros</option>
            <option>Otros</option>
          </select>

          <input
            className="border rounded p-2"
            type="date"
            value={fecha}
            onChange={(event) => setFecha(event.target.value)}
          />

          <select
            className="border rounded p-2"
            value={moneda}
            onChange={(event) => {
              setMoneda(event.target.value);
              if (event.target.value === "ARS") setTipoCambio("1");
            }}
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>

          <input
            className="border rounded p-2"
            placeholder="Importe"
            type="number"
            value={importe}
            onChange={(event) => setImporte(event.target.value)}
          />
        </div>

        {moneda === "USD" && (
          <input
            className="border rounded p-2 w-full"
            placeholder="Tipo de cambio"
            type="number"
            value={tipoCambio}
            onChange={(event) => setTipoCambio(event.target.value)}
          />
        )}

        <select
          className="border rounded p-2 w-full"
          value={bancoDestinoId}
          onChange={(event) => setBancoDestinoId(event.target.value)}
        >
          <option value="">Banco destino / caja sin banco</option>
          {bancos.map((bancoItem) => (
            <option key={bancoItem.id} value={bancoItem.id}>
              {bancoItem.nombre || bancoItem.banco || "Banco"} -{" "}
              {bancoItem.moneda || "ARS"} - saldo $
              {Number(bancoItem.saldo_actual || 0).toLocaleString("es-AR")}
            </option>
          ))}
        </select>

        {medioCobro === "Transferencia" && (
          <div className="grid grid-cols-2 gap-3">
            <input
              className="border rounded p-2"
              placeholder="Numero de operacion"
              value={numeroOperacion}
              onChange={(event) => setNumeroOperacion(event.target.value)}
            />
            <input
              className="border rounded p-2"
              placeholder="Banco"
              value={banco}
              onChange={(event) => setBanco(event.target.value)}
            />
          </div>
        )}

        {medioCobro.includes("Cheque") && (
          <div className="grid grid-cols-4 gap-3">
            <input
              className="border rounded p-2"
              placeholder="Numero de cheque"
              value={numeroCheque}
              onChange={(event) => setNumeroCheque(event.target.value)}
            />
            <input
              className="border rounded p-2"
              placeholder="Banco"
              value={banco}
              onChange={(event) => setBanco(event.target.value)}
            />
            <input
              className="border rounded p-2"
              type="date"
              value={fechaEmision}
              onChange={(event) => setFechaEmision(event.target.value)}
            />
            <input
              className="border rounded p-2"
              type="date"
              value={fechaPago}
              onChange={(event) => setFechaPago(event.target.value)}
            />
          </div>
        )}

        <div className="border rounded-lg p-3 bg-zinc-50 space-y-3">
          <div className="flex justify-between gap-3 items-center">
            <div>
              <h3 className="font-semibold">Pagos del cobro</h3>
              <p className="text-sm text-zinc-500">
                Total pagos: ${pagosEnPesos.toLocaleString("es-AR")}
              </p>
            </div>
            <button
              type="button"
              onClick={agregarInstrumento}
              className="border rounded px-4 py-2 bg-white"
            >
              Agregar pago
            </button>
          </div>

          {instrumentos.length > 0 && (
            <div className="space-y-2">
              {instrumentos.map((instrumento) => (
                <div
                  key={instrumento.id}
                  className="grid grid-cols-5 gap-3 items-center text-sm"
                >
                  <div>{instrumento.medio_cobro}</div>
                  <div>
                    {instrumento.moneda}{" "}
                    {instrumento.importe_original.toLocaleString("es-AR")}
                  </div>
                  <div className="font-semibold">
                    ${instrumento.importe_pesos.toLocaleString("es-AR")}
                  </div>
                  <div>
                    {instrumento.numero_cheque ||
                      instrumento.numero_operacion ||
                      instrumento.banco ||
                      "-"}
                  </div>
                  <button
                    type="button"
                    onClick={() => quitarInstrumento(instrumento.id)}
                    className="border rounded px-3 py-2 text-red-600"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t pt-4 space-y-3">
          <h3 className="font-semibold">Retenciones</h3>
          <div className="grid grid-cols-3 gap-3">
            <select
              className="border rounded p-2"
              value={retencionTipo}
              onChange={(event) => setRetencionTipo(event.target.value)}
            >
              <option>Ganancias</option>
              <option>IVA</option>
              <option>IIBB</option>
              <option>SUSS</option>
              <option>Otra</option>
            </select>
            <input
              className="border rounded p-2"
              placeholder="Importe retencion"
              type="number"
              value={retencionImporte}
              onChange={(event) => setRetencionImporte(event.target.value)}
            />
            <button type="button" onClick={agregarRetencion} className="border rounded p-2">
              Agregar retencion
            </button>
          </div>
          {retenciones.length > 0 && (
            <div className="text-sm text-zinc-600">
              {retenciones.map((retencion, index) => (
                <span key={`${retencion.tipo}-${index}`} className="mr-4">
                  {retencion.tipo}: ${retencion.importe.toLocaleString("es-AR")}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="border rounded p-2 bg-gray-50">
            <div className="text-sm text-gray-500">Pagos en pesos</div>
            <div className="font-bold">${pagosEnPesos.toLocaleString("es-AR")}</div>
          </div>
          <div className="border rounded p-2 bg-gray-50">
            <div className="text-sm text-gray-500">Retenciones</div>
            <div className="font-bold">
              ${totalRetenciones.toLocaleString("es-AR")}
            </div>
          </div>
          <div className="border rounded p-2 bg-gray-50">
            <div className="text-sm text-gray-500">Total cancelado</div>
            <div className="font-bold">
              ${totalCancelado.toLocaleString("es-AR")}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={registrarCobro}
            disabled={guardando}
            className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {guardando ? "Registrando..." : "Registrar cobro"}
          </button>

          {ultimoCobroId ? (
            <Link
              href={`/cobros/recibo?id=${ultimoCobroId}`}
              target="_blank"
              className="border rounded px-4 py-2"
            >
              Recibo
            </Link>
          ) : (
            <button disabled className="border rounded px-4 py-2 opacity-50">
              Recibo
            </button>
          )}
        </div>
      </div>
      )}

      {loading && <p>Cargando cobros...</p>}
      {errorCarga && <p className="text-sm text-red-600">{errorCarga}</p>}

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Historial de cobros</h2>
        {cobrosFiltrados.map((cobro) => (
          <div key={cobro.id} className="border rounded-lg p-4 bg-white">
            <div className="flex justify-between gap-4">
              <div>
                <div className="font-semibold">
                  {cobro.cliente || "Cliente"} - {cobro.medio_cobro}
                </div>
                <div className="text-sm text-gray-500">
                  Fecha: {cobro.fecha} - Moneda: {cobro.moneda || "ARS"} - TC:{" "}
                  {cobro.tipo_cambio || 1}
                </div>
              </div>
              <Link
                href={`/cobros/recibo?id=${cobro.id}`}
                target="_blank"
                className="border rounded px-4 py-2 h-fit"
              >
                Recibo
              </Link>
            </div>
            <div className="mt-2 font-bold">
              ${Number(cobro.total_cancelado || 0).toLocaleString("es-AR")}
            </div>
            {puedeGestionar && (
              <button
                onClick={() => eliminarCobro(cobro)}
                className="border rounded px-3 py-1 text-red-600 mt-3"
              >
                Eliminar
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
