"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
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

type Cliente = {
  id: string;
  cuit: string;
  razon_social: string;
  domicilio: string | null;
  ciudad: string | null;
};

type Ingreso = {
  id: string;
  fecha: string;
  tipo_comprobante: string | null;
  numero_comprobante: string | null;
  cuit: string | null;
  razon_social: string | null;
  domicilio: string | null;
  ciudad: string | null;
  descripcion: string | null;
  importe_neto: number | null;
  iva: number | null;
  iibb: number | null;
  otros_impuestos: number | null;
  importe: number;
  moneda: string | null;
  tipo_cambio: number | null;
  estado: string | null;
};

type CobroVenta = {
  venta_id: string;
  total_cancelado: number | null;
};

export default function VentasPage() {
  const { user } = useAuth();
  const puedeGestionar = canManageRecords(user?.rol);
  const [ventas, setVentas] = useState<Ingreso[]>([]);
  const [cobros, setCobros] = useState<CobroVenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState("");
  const [vista, setVista] = useState<PeriodView>("mensual");
  const [desde, setDesde] = useState(monthStartISO());
  const [hasta, setHasta] = useState(todayISO());
  const [historialFecha, setHistorialFecha] = useState("");
  const [historialCliente, setHistorialCliente] = useState("");
  const [historialEstado, setHistorialEstado] = useState("");
  const [historialCategoria, setHistorialCategoria] = useState("");

  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [tipoComprobante, setTipoComprobante] = useState("Factura A");

  const [sucursalFactura, setSucursalFactura] = useState("");
  const [numeroFactura, setNumeroFactura] = useState("");

  const [cuit, setCuit] = useState("");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [razonSocial, setRazonSocial] = useState("");
  const [domicilio, setDomicilio] = useState("");
  const [ciudad, setCiudad] = useState("");

  const [detalle, setDetalle] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [iva, setIva] = useState("");
  const [iibb, setIibb] = useState("");
  const [otrosImpuestos, setOtrosImpuestos] = useState("");

  const [moneda, setMoneda] = useState("ARS");
  const [tipoCambio, setTipoCambio] = useState("1");

  useEffect(() => {
    cargarVentas();
  }, []);

  async function cargarVentas() {
    setLoading(true);

    const { data, error } = await supabase
      .from("ingresos")
      .select("*")
      .order("fecha", { ascending: false });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    setVentas(data || []);

    const accessToken = await getAccessToken();

    if (accessToken) {
      const response = await fetch("/api/cobros", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const result = (await response.json()) as {
        data?: CobroVenta[];
      };

      if (response.ok) {
        setCobros(result.data || []);
      }
    }

    setLoading(false);
  }

  async function buscarClientePorCuit() {
    const cuitLimpio = cuit.trim();

    if (!cuitLimpio) return;

    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("cuit", cuitLimpio)
      .single();

    if (error || !data) {
      setClienteId(null);
      setRazonSocial("");
      setDomicilio("");
      setCiudad("");
      alert("No se encontró un cliente con ese CUIT");
      return;
    }

    const cliente = data as Cliente;

    setClienteId(cliente.id);
    setRazonSocial(cliente.razon_social);
    setDomicilio(cliente.domicilio || "");
    setCiudad(cliente.ciudad || "");
  }

  function numero(valor: string) {
    return Number(valor || 0);
  }

  function formatearNumeroComprobante(sucursal: string, numeroFactura: string) {
    const sucursalFormateada = sucursal.trim().padStart(4, "0");
    const numeroFormateado = numeroFactura.trim().padStart(8, "0");

    return `${sucursalFormateada}-${numeroFormateado}`;
  }

  function esVentaCancelada(estado: string | null | undefined) {
    const normalizado = (estado || "").toLowerCase();

    return (
      normalizado === "cobrada" ||
      normalizado === "cancelada" ||
      normalizado === "pagada"
    );
  }

  const subtotalFactura = numero(subtotal);
  const ivaFactura = numero(iva);
  const iibbFactura = numero(iibb);
  const otrosFactura = numero(otrosImpuestos);

  const totalFactura =
    subtotalFactura + ivaFactura + iibbFactura + otrosFactura;

  const cambio = moneda === "ARS" ? 1 : numero(tipoCambio);

  const subtotalPesos = subtotalFactura * cambio;
  const ivaPesos = ivaFactura * cambio;
  const iibbPesos = iibbFactura * cambio;
  const otrosPesos = otrosFactura * cambio;
  const totalPesos = totalFactura * cambio;
  const subtotalContable = signedAmount(tipoComprobante, subtotalPesos);
  const ivaContable = signedAmount(tipoComprobante, ivaPesos);
  const iibbContable = signedAmount(tipoComprobante, iibbPesos);
  const otrosContable = signedAmount(tipoComprobante, otrosPesos);
  const totalContable = signedAmount(tipoComprobante, totalPesos);

  async function guardarVenta() {
    if (!puedeGestionar) {
      alert("Solo los socios pueden crear o editar ventas");
      return;
    }

    if (!fecha) {
      alert("Ingresá la fecha");
      return;
    }

    if (!sucursalFactura.trim() || !numeroFactura.trim()) {
      alert("Ingresá sucursal y número de factura");
      return;
    }

    if (!clienteId) {
      alert("Buscá y seleccioná un cliente por CUIT");
      return;
    }

    if (totalPesos <= 0) {
      alert("Ingresá importes válidos");
      return;
    }

    if (moneda !== "ARS" && cambio <= 0) {
      alert("Ingresá un tipo de cambio válido");
      return;
    }

    const numeroComprobanteFinal = formatearNumeroComprobante(
      sucursalFactura,
      numeroFactura
    );

    try {
      setGuardando(true);

      const payload = {
        fecha,
        tipo_comprobante: tipoComprobante,
        numero_comprobante: numeroComprobanteFinal,

        cliente_id: clienteId,
        cliente: razonSocial,
        cuit: cuit.trim(),
        razon_social: razonSocial,
        domicilio,
        ciudad,

        descripcion: detalle.trim(),

        importe_neto: subtotalContable,
        iva: ivaContable,
        iibb: iibbContable,
        otros_impuestos: otrosContable,
        importe: totalContable,

        moneda,
        tipo_cambio: cambio,

        estado: "Pendiente",
        tiene_comprobante: true,
      };

      const { error } = editandoId
        ? await supabase.from("ingresos").update(payload).eq("id", editandoId)
        : await supabase.from("ingresos").insert(payload);

      if (error) throw error;

      setFecha(new Date().toISOString().split("T")[0]);
      setEditandoId("");
      setTipoComprobante("Factura A");
      setSucursalFactura("");
      setNumeroFactura("");
      setCuit("");
      setClienteId(null);
      setRazonSocial("");
      setDomicilio("");
      setCiudad("");
      setDetalle("");
      setSubtotal("");
      setIva("");
      setIibb("");
      setOtrosImpuestos("");
      setMoneda("ARS");
      setTipoCambio("1");

      await cargarVentas();
    } catch (error) {
      console.error(error);
      alert("Error al guardar la venta");
    } finally {
      setGuardando(false);
    }
  }

  function editarVenta(venta: Ingreso) {
    if (!puedeGestionar) return;

    const [sucursal = "", numeroFacturaValue = ""] = (
      venta.numero_comprobante || ""
    ).split("-");

    setEditandoId(venta.id);
    setFecha(venta.fecha || new Date().toISOString().split("T")[0]);
    setTipoComprobante(venta.tipo_comprobante || "Factura A");
    setSucursalFactura(sucursal.replace(/^0+/, "") || sucursal);
    setNumeroFactura(numeroFacturaValue.replace(/^0+/, "") || numeroFacturaValue);
    setCuit(venta.cuit || "");
    setRazonSocial(venta.razon_social || "");
    setDomicilio(venta.domicilio || "");
    setCiudad(venta.ciudad || "");
    setDetalle(venta.descripcion || "");
    setSubtotal(String(Math.abs(Number(venta.importe_neto || 0)) || ""));
    setIva(String(Math.abs(Number(venta.iva || 0)) || ""));
    setIibb(String(Math.abs(Number(venta.iibb || 0)) || ""));
    setOtrosImpuestos(String(Math.abs(Number(venta.otros_impuestos || 0)) || ""));
    setMoneda(venta.moneda || "ARS");
    setTipoCambio(String(venta.tipo_cambio || 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function eliminarVenta(venta: Ingreso) {
    if (!puedeGestionar) return;

    const confirmado = confirm(
      `Eliminar venta ${venta.numero_comprobante || venta.razon_social || ""}?`
    );

    if (!confirmado) return;

    const { error } = await supabase.from("ingresos").delete().eq("id", venta.id);

    if (error) {
      alert(error.message);
      return;
    }

    await cargarVentas();
  }

  const ventasFiltradas = ventas.filter((venta) =>
    matchesPeriod(venta.fecha, vista, desde, hasta)
  );
  const estadosHistorial = Array.from(
    new Set(ventas.map((venta) => venta.estado || "Pendiente"))
  ).sort((a, b) => a.localeCompare(b));
  const categoriasHistorial = Array.from(
    new Set(ventas.map((venta) => venta.tipo_comprobante || "Sin tipo"))
  ).sort((a, b) => a.localeCompare(b));
  const historialVentas = ventasFiltradas.filter((venta) => {
    const cliente = (venta.razon_social || venta.cuit || "").toLowerCase();
    return (
      (!historialFecha || venta.fecha === historialFecha) &&
      (!historialCliente ||
        cliente.includes(historialCliente.trim().toLowerCase())) &&
      (!historialEstado ||
        (venta.estado || "Pendiente") === historialEstado) &&
      (!historialCategoria ||
        (venta.tipo_comprobante || "Sin tipo") === historialCategoria)
    );
  });

  function limpiarFiltrosHistorial() {
    setHistorialFecha("");
    setHistorialCliente("");
    setHistorialEstado("");
    setHistorialCategoria("");
  }

  const totalFacturado = ventasFiltradas.reduce(
    (acc, venta) =>
      acc + signedAmount(venta.tipo_comprobante, Number(venta.importe || 0)),
    0
  );

  const cobradoPorVenta = useMemo(() => {
    return cobros.reduce<Record<string, number>>((acc, cobro) => {
      acc[cobro.venta_id] =
        (acc[cobro.venta_id] || 0) + Number(cobro.total_cancelado || 0);
      return acc;
    }, {});
  }, [cobros]);

  function ventaEstaCancelada(venta: Ingreso) {
    const totalVenta = signedAmount(
      venta.tipo_comprobante,
      Number(venta.importe || 0)
    );

    return (
      esVentaCancelada(venta.estado) ||
      (cobradoPorVenta[venta.id] || 0) >= totalVenta
    );
  }

  const comprobantesPendientes = ventasFiltradas.filter(
    (venta) => !ventaEstaCancelada(venta)
  ).length;

  const numeroComprobantePreview =
    sucursalFactura || numeroFactura
      ? formatearNumeroComprobante(
          sucursalFactura || "0",
          numeroFactura || "0"
        )
      : "0000-00000000";

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold">Ventas</h1>

      <PeriodSelector
        view={vista}
        from={desde}
        to={hasta}
        onViewChange={setVista}
        onFromChange={setDesde}
        onToChange={setHasta}
      />

      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-500">Facturado en pesos</div>
          <div className="metric-number">
            ${totalFacturado.toLocaleString("es-AR")}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-500">Cantidad de comprobantes</div>
          <div className="metric-number">{ventasFiltradas.length}</div>
        </div>

        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-500">
            Comprobantes pendientes
          </div>
          <div className="metric-number">{comprobantesPendientes}</div>
        </div>
      </div>

      {puedeGestionar && (
      <div className="border rounded-lg p-4 space-y-4">
        <h2 className="text-xl font-semibold">Nueva factura de venta</h2>

        <div className="grid grid-cols-4 gap-3">
          <input
            className="border rounded p-2"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />

          <select
            className="border rounded p-2"
            value={tipoComprobante}
            onChange={(e) => setTipoComprobante(e.target.value)}
          >
            <option>Factura A</option>
            <option>Factura B</option>
            <option>Factura C</option>
            <option>Nota de Crédito</option>
            <option>Nota de Débito</option>
          </select>

          <input
            className="border rounded p-2"
            placeholder="Sucursal, ej: 3"
            type="number"
            value={sucursalFactura}
            onChange={(e) => setSucursalFactura(e.target.value)}
          />

          <input
            className="border rounded p-2"
            placeholder="Número, ej: 15"
            type="number"
            value={numeroFactura}
            onChange={(e) => setNumeroFactura(e.target.value)}
          />
        </div>

        <div className="text-sm text-gray-500">
          Número final:{" "}
          <span className="font-semibold text-black">
            {numeroComprobantePreview}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <input
            className="border rounded p-2"
            placeholder="CUIT"
            value={cuit}
            onChange={(e) => setCuit(e.target.value)}
            onBlur={buscarClientePorCuit}
          />

          <button
            type="button"
            onClick={buscarClientePorCuit}
            className="border rounded p-2"
          >
            Buscar cliente
          </button>

          <input
            className="border rounded p-2 bg-gray-100"
            placeholder="Razón social"
            value={razonSocial}
            readOnly
          />

          <input
            className="border rounded p-2 bg-gray-100"
            placeholder="Ciudad"
            value={ciudad}
            readOnly
          />
        </div>

        <input
          className="border rounded p-2 w-full bg-gray-100"
          placeholder="Domicilio"
          value={domicilio}
          readOnly
        />

        <textarea
          className="border rounded p-2 w-full"
          placeholder="Detalle"
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
        />

        <div className="grid grid-cols-4 gap-3">
          <input
            className="border rounded p-2"
            placeholder="Subtotal"
            type="number"
            value={subtotal}
            onChange={(e) => setSubtotal(e.target.value)}
          />

          <input
            className="border rounded p-2"
            placeholder="IVA"
            type="number"
            value={iva}
            onChange={(e) => setIva(e.target.value)}
          />

          <input
            className="border rounded p-2"
            placeholder="IIBB"
            type="number"
            value={iibb}
            onChange={(e) => setIibb(e.target.value)}
          />

          <input
            className="border rounded p-2"
            placeholder="Otros impuestos"
            type="number"
            value={otrosImpuestos}
            onChange={(e) => setOtrosImpuestos(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <select
            className="border rounded p-2"
            value={moneda}
            onChange={(e) => {
              setMoneda(e.target.value);
              if (e.target.value === "ARS") setTipoCambio("1");
            }}
          >
            <option value="ARS">Pesos argentinos</option>
            <option value="USD">Dólares</option>
            <option value="EUR">Euros</option>
            <option value="OTRA">Otra moneda</option>
          </select>

          {moneda !== "ARS" && (
            <input
              className="border rounded p-2"
              placeholder="Tipo de cambio"
              type="number"
              value={tipoCambio}
              onChange={(e) => setTipoCambio(e.target.value)}
            />
          )}

          <div className="border rounded p-2 bg-gray-50">
            <div className="text-sm text-gray-500">Total contable en pesos</div>
            <div className="font-bold">
              ${totalContable.toLocaleString("es-AR")}
            </div>
          </div>
        </div>

        {moneda !== "ARS" && (
          <div className="text-sm text-gray-500">
            Total factura: {moneda} {totalFactura.toLocaleString("es-AR")} × TC{" "}
            {cambio.toLocaleString("es-AR")} = $
            {totalContable.toLocaleString("es-AR")}
          </div>
        )}

        <button
          onClick={guardarVenta}
          disabled={guardando}
          className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {guardando
            ? "Guardando..."
            : editandoId
            ? "Guardar cambios"
            : "Guardar factura"}
        </button>
        {editandoId && (
          <button
            onClick={() => setEditandoId("")}
            className="ml-3 border rounded px-4 py-2"
          >
            Cancelar edicion
          </button>
        )}
      </div>
      )}

      {loading && <p>Cargando ventas...</p>}

      {!loading && ventas.length === 0 && <p>No hay ventas registradas.</p>}

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold">Historial de ventas</h2>
          <div className="grid grid-cols-5 gap-2">
            <input
              className="border rounded p-2"
              type="date"
              value={historialFecha}
              onChange={(event) => setHistorialFecha(event.target.value)}
            />
            <input
              className="border rounded p-2"
              placeholder="Cliente"
              value={historialCliente}
              onChange={(event) => setHistorialCliente(event.target.value)}
            />
            <select
              className="border rounded p-2"
              value={historialEstado}
              onChange={(event) => setHistorialEstado(event.target.value)}
            >
              <option value="">Estado</option>
              {estadosHistorial.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
            <select
              className="border rounded p-2"
              value={historialCategoria}
              onChange={(event) => setHistorialCategoria(event.target.value)}
            >
              <option value="">Categoria</option>
              {categoriasHistorial.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={limpiarFiltrosHistorial}
              className="border rounded p-2"
              title="Restablecer filtros"
              aria-label="Restablecer filtros"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </div>
        {historialVentas.map((venta) => {
          const cancelada = ventaEstaCancelada(venta);

          return (
          <div
            key={venta.id}
            className={
              cancelada
                ? "border rounded-lg p-3 bg-white grid grid-cols-5 gap-3 items-center text-sm"
                : "border rounded-lg p-4"
            }
          >
            {cancelada ? (
              <>
                <div className="font-semibold">
                  {venta.numero_comprobante || "Sin numero"}
                </div>
                <div>{venta.fecha}</div>
                <div className="col-span-2">
                  {venta.razon_social || "Cliente sin nombre"}
                </div>
                <div className="text-right">
                  <div className="font-bold">
                    ${Number(venta.importe || 0).toLocaleString("es-AR")}
                  </div>
                  <div className="text-xs text-green-700 font-semibold">
                    {venta.estado || "Cobrada"}
                  </div>
                </div>
              </>
            ) : (
              <>
            <div className="font-semibold">
              {venta.tipo_comprobante} {venta.numero_comprobante}
            </div>

            <div className="text-sm text-gray-500">
              {venta.razon_social || "Cliente sin nombre"} · CUIT{" "}
              {venta.cuit || "-"}
            </div>

            <div className="text-sm">{venta.descripcion || "Sin detalle"}</div>

            <div className="mt-2 font-bold">
              ${Number(venta.importe || 0).toLocaleString("es-AR")}
            </div>

            <div className="text-sm text-gray-500">
              Fecha: {venta.fecha} · Moneda: {venta.moneda || "ARS"} · TC:{" "}
              {venta.tipo_cambio || 1}
            </div>
            {puedeGestionar && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => editarVenta(venta)}
                  className="border rounded px-3 py-1"
                >
                  Editar
                </button>
                <button
                  onClick={() => eliminarVenta(venta)}
                  className="border rounded px-3 py-1 text-red-600"
                >
                  Eliminar
                </button>
              </div>
            )}
              </>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
