"use client";

import { useCallback, useEffect, useState } from "react";
import PeriodSelector from "@/components/PeriodSelector";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { canManageRecords } from "@/lib/permissions";
import { signedAmount } from "@/lib/accounting";
import {
  matchesPeriod,
  monthStartISO,
  todayISO,
  type PeriodView,
} from "@/lib/period";

type Compra = {
  id: string;
  fecha: string;
  tipo_comprobante: string | null;
  numero_comprobante: string | null;
  cuit: string | null;
  razon_social: string | null;
  proveedor: string | null;
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

const fechaActual = () => new Date().toISOString().split("T")[0];

function numero(valor: string) {
  const normalizado = valor.replace(",", ".");
  const resultado = Number(normalizado || 0);

  return Number.isFinite(resultado) ? resultado : 0;
}

function formatearNumeroComprobante(sucursal: string, numeroFactura: string) {
  const sucursalFormateada = sucursal.trim().padStart(4, "0");
  const numeroFormateado = numeroFactura.trim().padStart(8, "0");

  return `${sucursalFormateada}-${numeroFormateado}`;
}

export default function ComprasPage() {
  const { user } = useAuth();
  const puedeGestionar = canManageRecords(user?.rol);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");
  const [editandoId, setEditandoId] = useState("");
  const [vista, setVista] = useState<PeriodView>("mensual");
  const [desde, setDesde] = useState(monthStartISO());
  const [hasta, setHasta] = useState(todayISO());

  const [fecha, setFecha] = useState(fechaActual());
  const [tipoComprobante, setTipoComprobante] = useState("Factura A");
  const [sucursalFactura, setSucursalFactura] = useState("");
  const [numeroFactura, setNumeroFactura] = useState("");

  const [cuit, setCuit] = useState("");
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

  const cargarCompras = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setErrorCarga("");

    const { data, error } = await supabase
      .from("compras")
      .select("*")
      .order("fecha", { ascending: false });

    if (error) {
      console.error(error);
      setErrorCarga("No se pudieron cargar las compras.");
      setLoading(false);
      return;
    }

    setCompras(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarCompras();
  }, [cargarCompras]);

  const subtotalFactura = numero(subtotal);
  const ivaFactura = numero(iva);
  const iibbFactura = numero(iibb);
  const otrosFactura = numero(otrosImpuestos);
  const totalFactura = subtotalFactura + ivaFactura + iibbFactura + otrosFactura;
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

  const comprasFiltradas = compras.filter((compra) =>
    matchesPeriod(compra.fecha, vista, desde, hasta)
  );

  const totalComprado = comprasFiltradas.reduce(
    (acc, compra) =>
      acc + signedAmount(compra.tipo_comprobante, Number(compra.importe || 0)),
    0
  );
  const ivaCredito = comprasFiltradas.reduce(
    (acc, compra) =>
      acc + signedAmount(compra.tipo_comprobante, Number(compra.iva || 0)),
    0
  );

  const numeroComprobantePreview =
    sucursalFactura || numeroFactura
      ? formatearNumeroComprobante(
          sucursalFactura || "0",
          numeroFactura || "0"
        )
      : "0000-00000000";

  function limpiarProveedor() {
    setCuit("");
    setRazonSocial("");
    setDomicilio("");
    setCiudad("");
  }

  async function buscarProveedorPorCuit() {
    const cuitLimpio = cuit.trim();

    if (!cuitLimpio) return;

    const { data, error } = await supabase
      .from("proveedores")
      .select("razon_social, domicilio, ciudad")
      .eq("cuit", cuitLimpio)
      .maybeSingle();

    if (error || !data) return;

    setRazonSocial(data.razon_social || "");
    setDomicilio(data.domicilio || "");
    setCiudad(data.ciudad || "");
  }

  function limpiarFormulario() {
    setEditandoId("");
    setFecha(fechaActual());
    setTipoComprobante("Factura A");
    setSucursalFactura("");
    setNumeroFactura("");
    limpiarProveedor();
    setDetalle("");
    setSubtotal("");
    setIva("");
    setIibb("");
    setOtrosImpuestos("");
    setMoneda("ARS");
    setTipoCambio("1");
  }

  async function guardarCompra() {
    if (!puedeGestionar) {
      alert("Solo los socios pueden crear o editar compras");
      return;
    }

    if (!fecha) {
      alert("Ingresa la fecha");
      return;
    }

    if (!sucursalFactura.trim() || !numeroFactura.trim()) {
      alert("Ingresa sucursal y numero de factura");
      return;
    }

    if (!cuit.trim() || !razonSocial.trim()) {
      alert("Ingresa CUIT y razon social del proveedor");
      return;
    }

    if (totalPesos <= 0) {
      alert("Ingresa importes validos");
      return;
    }

    if (moneda !== "ARS" && cambio <= 0) {
      alert("Ingresa un tipo de cambio valido");
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

        proveedor: razonSocial.trim(),
        cuit: cuit.trim(),
        razon_social: razonSocial.trim(),
        domicilio: domicilio.trim(),
        ciudad: ciudad.trim(),

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
        ? await supabase.from("compras").update(payload).eq("id", editandoId)
        : await supabase.from("compras").insert(payload);

      if (error) throw error;

      limpiarFormulario();
      await cargarCompras();
    } catch (error) {
      console.error(error);
      alert("Error al guardar la compra");
    } finally {
      setGuardando(false);
    }
  }

  function editarCompra(compra: Compra) {
    if (!puedeGestionar) return;

    const [sucursal = "", numeroFacturaValue = ""] = (
      compra.numero_comprobante || ""
    ).split("-");

    setEditandoId(compra.id);
    setFecha(compra.fecha || fechaActual());
    setTipoComprobante(compra.tipo_comprobante || "Factura A");
    setSucursalFactura(sucursal.replace(/^0+/, "") || sucursal);
    setNumeroFactura(numeroFacturaValue.replace(/^0+/, "") || numeroFacturaValue);
    setCuit(compra.cuit || "");
    setRazonSocial(compra.razon_social || compra.proveedor || "");
    setDomicilio(compra.domicilio || "");
    setCiudad(compra.ciudad || "");
    setDetalle(compra.descripcion || "");
    setSubtotal(String(Math.abs(Number(compra.importe_neto || 0)) || ""));
    setIva(String(Math.abs(Number(compra.iva || 0)) || ""));
    setIibb(String(Math.abs(Number(compra.iibb || 0)) || ""));
    setOtrosImpuestos(String(Math.abs(Number(compra.otros_impuestos || 0)) || ""));
    setMoneda(compra.moneda || "ARS");
    setTipoCambio(String(compra.tipo_cambio || 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function eliminarCompra(compra: Compra) {
    if (!puedeGestionar) return;

    const confirmado = confirm(
      `Eliminar compra ${compra.numero_comprobante || compra.razon_social || ""}?`
    );

    if (!confirmado) return;

    const { error } = await supabase.from("compras").delete().eq("id", compra.id);

    if (error) {
      alert(error.message);
      return;
    }

    await cargarCompras();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold">Compras</h1>

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
          <div className="text-sm text-gray-500">Comprado en pesos</div>
          <div className="metric-number">
            ${totalComprado.toLocaleString("es-AR")}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-500">IVA credito fiscal</div>
          <div className="metric-number">
            ${ivaCredito.toLocaleString("es-AR")}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <div className="text-sm text-gray-500">Cantidad de comprobantes</div>
          <div className="metric-number">{comprasFiltradas.length}</div>
        </div>
      </div>

      {puedeGestionar && (
      <div className="border rounded-lg p-4 space-y-4">
        <h2 className="text-xl font-semibold">Nueva factura de compra</h2>

        <div className="grid grid-cols-4 gap-3">
          <input
            className="border rounded p-2"
            type="date"
            value={fecha}
            onChange={(event) => setFecha(event.target.value)}
          />

          <select
            className="border rounded p-2"
            value={tipoComprobante}
            onChange={(event) => setTipoComprobante(event.target.value)}
          >
            <option>Factura A</option>
            <option>Factura B</option>
            <option>Factura C</option>
            <option>Nota de Credito</option>
            <option>Nota de Debito</option>
            <option>Recibo</option>
          </select>

          <input
            className="border rounded p-2"
            placeholder="Sucursal, ej: 3"
            type="number"
            value={sucursalFactura}
            onChange={(event) => setSucursalFactura(event.target.value)}
          />

          <input
            className="border rounded p-2"
            placeholder="Numero, ej: 15"
            type="number"
            value={numeroFactura}
            onChange={(event) => setNumeroFactura(event.target.value)}
          />
        </div>

        <div className="text-sm text-gray-500">
          Numero final:{" "}
          <span className="font-semibold text-black">
            {numeroComprobantePreview}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <input
            className="border rounded p-2"
            placeholder="CUIT proveedor"
            value={cuit}
            onChange={(event) => setCuit(event.target.value)}
            onBlur={buscarProveedorPorCuit}
          />

          <input
            className="border rounded p-2"
            placeholder="Razon social"
            value={razonSocial}
            onChange={(event) => setRazonSocial(event.target.value)}
          />

          <input
            className="border rounded p-2"
            placeholder="Ciudad"
            value={ciudad}
            onChange={(event) => setCiudad(event.target.value)}
          />

          <button
            type="button"
            onClick={limpiarProveedor}
            className="border rounded p-2"
          >
            Limpiar proveedor
          </button>
        </div>

        <input
          className="border rounded p-2 w-full"
          placeholder="Domicilio"
          value={domicilio}
          onChange={(event) => setDomicilio(event.target.value)}
        />

        <textarea
          className="border rounded p-2 w-full"
          placeholder="Detalle"
          value={detalle}
          onChange={(event) => setDetalle(event.target.value)}
        />

        <div className="grid grid-cols-4 gap-3">
          <input
            className="border rounded p-2"
            placeholder="Subtotal"
            type="number"
            value={subtotal}
            onChange={(event) => setSubtotal(event.target.value)}
          />

          <input
            className="border rounded p-2"
            placeholder="IVA"
            type="number"
            value={iva}
            onChange={(event) => setIva(event.target.value)}
          />

          <input
            className="border rounded p-2"
            placeholder="IIBB"
            type="number"
            value={iibb}
            onChange={(event) => setIibb(event.target.value)}
          />

          <input
            className="border rounded p-2"
            placeholder="Otros impuestos"
            type="number"
            value={otrosImpuestos}
            onChange={(event) => setOtrosImpuestos(event.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <select
            className="border rounded p-2"
            value={moneda}
            onChange={(event) => {
              setMoneda(event.target.value);
              if (event.target.value === "ARS") setTipoCambio("1");
            }}
          >
            <option value="ARS">Pesos argentinos</option>
            <option value="USD">Dolares</option>
            <option value="EUR">Euros</option>
            <option value="OTRA">Otra moneda</option>
          </select>

          {moneda !== "ARS" && (
            <input
              className="border rounded p-2"
              placeholder="Tipo de cambio"
              type="number"
              value={tipoCambio}
              onChange={(event) => setTipoCambio(event.target.value)}
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
            Total factura: {moneda} {totalFactura.toLocaleString("es-AR")} x TC{" "}
            {cambio.toLocaleString("es-AR")} = $
            {totalContable.toLocaleString("es-AR")}
          </div>
        )}

      <button
        onClick={guardarCompra}
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
        <button onClick={limpiarFormulario} className="ml-3 border rounded px-4 py-2">
          Cancelar edicion
        </button>
      )}
      </div>
      )}

      {errorCarga && <p className="text-sm text-red-600">{errorCarga}</p>}

      {loading && <p>Cargando compras...</p>}

      {!loading && !errorCarga && comprasFiltradas.length === 0 && (
        <p>No hay compras registradas.</p>
      )}

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Historial de compras</h2>
        {comprasFiltradas.map((compra) => (
          <div key={compra.id} className="border rounded-lg p-4">
            <div className="font-semibold">
              {compra.tipo_comprobante} {compra.numero_comprobante}
            </div>

            <div className="text-sm text-gray-500">
              {compra.razon_social || compra.proveedor || "Proveedor sin nombre"}{" "}
              - CUIT {compra.cuit || "-"}
            </div>

            <div className="text-sm">{compra.descripcion || "Sin detalle"}</div>

            <div className="mt-2 font-bold">
              ${Number(compra.importe || 0).toLocaleString("es-AR")}
            </div>

            <div className="text-sm text-gray-500">
              Fecha: {compra.fecha} - Moneda: {compra.moneda || "ARS"} - TC:{" "}
              {compra.tipo_cambio || 1} - Estado: {compra.estado || "Pendiente"}
            </div>
            {puedeGestionar && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => editarCompra(compra)}
                  className="border rounded px-3 py-1"
                >
                  Editar
                </button>
                <button
                  onClick={() => eliminarCompra(compra)}
                  className="border rounded px-3 py-1 text-red-600"
                >
                  Eliminar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
