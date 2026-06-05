"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import PeriodSelector from "@/components/PeriodSelector";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { canManageRecords } from "@/lib/permissions";
import { isCreditNote, signedAmount } from "@/lib/accounting";
import { getAccessToken } from "@/lib/client-auth";
import { relatedUserIdentity, userIdentityLabel } from "@/lib/user-identity";
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
  razon_social: string | null;
  proveedor: string | null;
  importe: number | null;
  estado: string | null;
};

type Gasto = {
  id: string;
  fecha: string;
  usuario_id: string | null;
  categoria: string | null;
  proveedor: string | null;
  descripcion: string | null;
  importe_total: number | null;
  estado: string | null;
  reintegrado: boolean | null;
  usuarios?:
    | { nombre?: string | null; email?: string | null }
    | { nombre?: string | null; email?: string | null }[]
    | null;
};

type Pago = {
  id: string;
  orden_pago_id?: string | null;
  fecha: string;
  tipo: "compra" | "gasto";
  referencia_id: string;
  beneficiario: string | null;
  importe: number;
  medio_pago: string | null;
  observaciones: string | null;
  banco?: string | null;
  numero_cheque?: string | null;
  fecha_emision?: string | null;
  fecha_pago?: string | null;
  ordenes_pago?: {
    id: string;
    numero: number;
    fecha: string;
    beneficiario: string | null;
    observaciones: string | null;
    ordenes_pago_medios?: MedioPago[];
    ordenes_pago_retenciones?: RetencionPago[];
  } | null;
};

type MedioPago = {
  id?: string;
  medio_pago: string;
  importe: number;
  banco: string;
  numero_operacion: string;
  numero_cheque: string;
  fecha_emision: string | null;
  fecha_pago: string | null;
};

type RetencionPago = {
  id?: string;
  tipo: string;
  importe: number;
};

type ImputacionPago = {
  tipo: "compra" | "gasto";
  referencia_id: string;
  beneficiario: string | null;
  detalle: string;
  importe: number;
};

type Usuario = {
  id: string;
  nombre: string | null;
  email: string | null;
  activo: boolean | null;
};

type PagoEdit = {
  fecha: string;
  medio_pago: string;
  importe: string;
  banco: string;
  numero_cheque: string;
  fecha_emision: string;
  fecha_pago: string;
  observaciones: string;
};

const hoy = () => new Date().toISOString().split("T")[0];

export default function PagosPage() {
  const { session, user } = useAuth();
  const puedeGestionar = canManageRecords(user?.rol);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");
  const [vistaCheques, setVistaCheques] = useState(false);
  const [ultimoPagoId, setUltimoPagoId] = useState("");
  const [vista, setVista] = useState<PeriodView>("mensual");
  const [desde, setDesde] = useState(monthStartISO());
  const [hasta, setHasta] = useState(todayISO());
  const [historialFecha, setHistorialFecha] = useState("");
  const [historialProveedor, setHistorialProveedor] = useState("");
  const [historialEstado, setHistorialEstado] = useState("");
  const [historialCategoria, setHistorialCategoria] = useState("");

  const [tipo, setTipo] = useState<"compra" | "gasto">("compra");
  const [proveedorCompra, setProveedorCompra] = useState("");
  const [usuarioGastoId, setUsuarioGastoId] = useState("");
  const [referenciaId, setReferenciaId] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [medioPago, setMedioPago] = useState("Transferencia");
  const [observaciones, setObservaciones] = useState("");
  const [banco, setBanco] = useState("");
  const [numeroOperacion, setNumeroOperacion] = useState("");
  const [numeroCheque, setNumeroCheque] = useState("");
  const [fechaEmision, setFechaEmision] = useState(hoy());
  const [fechaPago, setFechaPago] = useState(hoy());
  const [importeMedio, setImporteMedio] = useState("");
  const [mediosPago, setMediosPago] = useState<MedioPago[]>([]);
  const [tipoRetencion, setTipoRetencion] = useState("Ganancias");
  const [importeRetencion, setImporteRetencion] = useState("");
  const [retenciones, setRetenciones] = useState<RetencionPago[]>([]);
  const [imputaciones, setImputaciones] = useState<ImputacionPago[]>([]);
  const [importeManual, setImporteManual] = useState("");
  const [editandoPagoId, setEditandoPagoId] = useState("");
  const [pagoEdit, setPagoEdit] = useState<PagoEdit>({
    fecha: hoy(),
    medio_pago: "Transferencia",
    importe: "",
    banco: "",
    numero_cheque: "",
    fecha_emision: hoy(),
    fecha_pago: hoy(),
    observaciones: "",
  });

  const cargarDatos = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setErrorCarga("");

    const accessToken = session?.access_token || (await getAccessToken());

    const [comprasResult, gastosResult, pagosResponse, usuariosResponse] = await Promise.all([
      supabase
        .from("compras")
        .select("id, fecha, tipo_comprobante, numero_comprobante, razon_social, proveedor, importe, estado")
        .order("fecha", { ascending: false }),
      supabase
        .from("gastos")
        .select("id, fecha, usuario_id, categoria, proveedor, descripcion, importe_total, estado, reintegrado, usuarios(nombre, email)")
        .order("fecha", { ascending: false }),
      accessToken
        ? fetch("/api/pagos", {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
        : Promise.resolve(null),
      accessToken
        ? fetch("/api/usuarios", {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
        : Promise.resolve(null),
    ]);

    if (comprasResult.error || gastosResult.error || !pagosResponse) {
      setErrorCarga("No se pudieron cargar los pagos.");
      setLoading(false);
      return;
    }

    const pagosResult = (await pagosResponse.json()) as {
      data?: Pago[];
      error?: string;
    };
    const usuariosResult = usuariosResponse
      ? ((await usuariosResponse.json()) as { data?: Usuario[]; error?: string })
      : { data: [] };

    if (!pagosResponse.ok) {
      setErrorCarga(pagosResult.error || "No se pudieron cargar los pagos.");
      setLoading(false);
      return;
    }

    setCompras(comprasResult.data || []);
    setGastos(gastosResult.data || []);
    setPagos(pagosResult.data || []);
    setUsuarios((usuariosResult.data || []).filter((usuario) => usuario.activo !== false));
    setLoading(false);
  }, [session]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarDatos();
  }, [cargarDatos]);

  const pagadoPorReferencia = useMemo(() => {
    return pagos.reduce<Record<string, number>>((acc, pago) => {
      const key = `${pago.tipo}:${pago.referencia_id}`;
      acc[key] = (acc[key] || 0) + Number(pago.importe || 0);
      return acc;
    }, {});
  }, [pagos]);

  const saldoCompra = useCallback((compra: Compra) => {
    const total = signedAmount(
      compra.tipo_comprobante,
      Number(compra.importe || 0)
    );
    return total - (pagadoPorReferencia[`compra:${compra.id}`] || 0);
  }, [pagadoPorReferencia]);

  const saldoGasto = useCallback((gasto: Gasto) => {
    return (
      Number(gasto.importe_total || 0) -
      (pagadoPorReferencia[`gasto:${gasto.id}`] || 0)
    );
  }, [pagadoPorReferencia]);

  const proveedoresCompra = useMemo(() => {
    return Array.from(
      new Set(
        compras
          .filter((compra) => Math.abs(saldoCompra(compra)) > 0.01)
          .map((compra) => compra.razon_social || compra.proveedor || "")
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [compras, saldoCompra]);

  const comprasPendientes = compras.filter((compra) => {
    const proveedor = compra.razon_social || compra.proveedor || "";
    return (
      Math.abs(saldoCompra(compra)) > 0.01 &&
      (!proveedorCompra || proveedor === proveedorCompra)
    );
  });

  const gastosPendientes =
    usuarioGastoId === "__proveedores"
      ? gastos.filter((gasto) => !gasto.usuario_id && saldoGasto(gasto) > 0.01)
      : usuarioGastoId
      ? gastos.filter(
          (gasto) => gasto.usuario_id === usuarioGastoId && saldoGasto(gasto) > 0.01
        )
      : [];
  const pendientes = tipo === "compra" ? comprasPendientes : gastosPendientes;
  const seleccionado = useMemo(() => {
    return pendientes.find((item) => item.id === referenciaId) || null;
  }, [pendientes, referenciaId]);

  const importeSeleccionado =
    seleccionado && tipo === "compra"
      ? saldoCompra(seleccionado as Compra)
      : seleccionado
      ? saldoGasto(seleccionado as Gasto)
      : 0;
  const importeParaImputar =
    importeManual.trim() === ""
      ? importeSeleccionado
      : Number(importeManual.replace(",", ".") || 0);
  const totalImputado = imputaciones.reduce(
    (acc, imputacion) => acc + imputacion.importe,
    0
  );
  const totalMedios = mediosPago.reduce(
    (acc, medio) => acc + Number(medio.importe || 0),
    0
  );
  const totalRetenciones = retenciones.reduce(
    (acc, retencion) => acc + Number(retencion.importe || 0),
    0
  );

  const totalPendienteCompras = compras.reduce(
    (acc, compra) => acc + saldoCompra(compra),
    0
  );
  const totalPendienteGastos = gastos.reduce(
    (acc, gasto) => acc + Math.max(saldoGasto(gasto), 0),
    0
  );
  const pagosPeriodo = pagos.filter((pago) =>
    matchesPeriod(pago.fecha, vista, desde, hasta)
  );

  function estadoPago(pago: Pago) {
    const esCheque = (pago.medio_pago || "").toLowerCase().includes("cheque");
    return esCheque && pago.fecha_pago && pago.fecha_pago > todayISO()
      ? "Pendiente"
      : "Pagado";
  }

  const pagosFiltrados = pagosPeriodo.filter((pago) => {
    const beneficiario = (pago.beneficiario || "").toLowerCase();
    return (
      (!historialFecha || pago.fecha === historialFecha) &&
      (!historialProveedor ||
        beneficiario.includes(historialProveedor.trim().toLowerCase())) &&
      (!historialEstado || estadoPago(pago) === historialEstado) &&
      (!historialCategoria || pago.tipo === historialCategoria)
    );
  });
  const ordenesFiltradas = Array.from(
    pagosFiltrados.reduce<Map<string, Pago[]>>((acc, pago) => {
      const key = pago.orden_pago_id || pago.id;
      acc.set(key, [...(acc.get(key) || []), pago]);
      return acc;
    }, new Map())
  ).map(([id, imputacionesOrden]) => {
    const primero = imputacionesOrden[0];
    const orden = primero.ordenes_pago;
    const total = imputacionesOrden.reduce(
      (acc, pago) => acc + Number(pago.importe || 0),
      0
    );

    return {
      id,
      numero: orden?.numero || null,
      fecha: orden?.fecha || primero.fecha,
      beneficiario: orden?.beneficiario || primero.beneficiario,
      total,
      cantidadImputaciones: imputacionesOrden.length,
      cantidadMedios: orden?.ordenes_pago_medios?.length || 1,
      retenciones: orden?.ordenes_pago_retenciones || [],
      imputaciones: imputacionesOrden,
    };
  });

  function limpiarFiltrosHistorial() {
    setHistorialFecha("");
    setHistorialProveedor("");
    setHistorialEstado("");
    setHistorialCategoria("");
  }

  const cheques = pagosPeriodo.filter((pago) =>
    (pago.medio_pago || "").toLowerCase().includes("cheque")
  );
  const totalCheques = cheques.reduce(
    (acc, pago) => acc + Number(pago.importe || 0),
    0
  );
  const proximoCheque = [...cheques]
    .filter((pago) => pago.fecha_pago)
    .sort((a, b) => String(a.fecha_pago).localeCompare(String(b.fecha_pago)))[0];

  function nombreReferencia(item: Compra | Gasto) {
    if (tipo === "compra") {
      const compra = item as Compra;
      const prefijo = isCreditNote(compra.tipo_comprobante)
        ? "Nota de credito"
        : "Factura";

      return `${prefijo} - ${
        compra.razon_social || compra.proveedor || "Proveedor"
      } - ${compra.numero_comprobante || "Sin comprobante"}`;
    }

    const gasto = item as Gasto;
    return `${gasto.proveedor || gasto.categoria || "Gasto"} - ${
      gasto.descripcion || gasto.fecha
    }`;
  }

  function beneficiarioGasto(gasto: Gasto) {
    return gasto.usuario_id
      ? relatedUserIdentity(gasto.usuarios, "Usuario")
      : gasto.proveedor || gasto.categoria || "Proveedores / Planaris";
  }

  function agregarImputacion() {
    if (!referenciaId || !seleccionado) {
      alert("Selecciona una factura o gasto pendiente");
      return;
    }

    const beneficiario =
      tipo === "compra"
        ? (seleccionado as Compra).razon_social || (seleccionado as Compra).proveedor
        : beneficiarioGasto(seleccionado as Gasto);

    if (Math.abs(importeParaImputar) <= 0.01) {
      alert("Ingresa un importe a imputar");
      return;
    }

    if (Math.abs(importeParaImputar) > Math.abs(importeSeleccionado) + 0.01) {
      alert("La imputacion supera el saldo pendiente");
      return;
    }

    const existente = imputaciones.find(
      (item) => item.tipo === tipo && item.referencia_id === referenciaId
    );

    if (existente) {
      const saldoDisponible = importeSeleccionado - existente.importe;

      if (Math.abs(saldoDisponible) <= 0.01) {
        alert("La imputacion ya cubre el saldo pendiente");
        return;
      }

      const importeAAgregar =
        importeManual.trim() === "" ? saldoDisponible : importeParaImputar;
      const nuevoImporte = existente.importe + importeAAgregar;

      if (Math.abs(nuevoImporte) > Math.abs(importeSeleccionado) + 0.01) {
        alert("La imputacion supera el saldo pendiente");
        return;
      }

      setImputaciones(
        imputaciones.map((item) =>
          item.tipo === tipo && item.referencia_id === referenciaId
            ? { ...item, importe: nuevoImporte }
            : item
        )
      );
      setReferenciaId("");
      setImporteManual("");
      return;
    }

    setImputaciones([
      ...imputaciones,
      {
        tipo,
        referencia_id: referenciaId,
        beneficiario: beneficiario || null,
        detalle: nombreReferencia(seleccionado),
        importe: importeParaImputar,
      },
    ]);
    setReferenciaId("");
    setImporteManual("");
  }

  function quitarImputacion(tipoValue: "compra" | "gasto", referenciaIdValue: string) {
    setImputaciones(
      imputaciones.filter(
        (item) =>
          item.tipo !== tipoValue || item.referencia_id !== referenciaIdValue
      )
    );
  }

  function agregarMedioPago() {
    const importe = Number(importeMedio.replace(",", ".") || 0);

    if (importe <= 0) {
      alert("Ingresa el importe del medio de pago");
      return;
    }

    setMediosPago([
      ...mediosPago,
      {
        medio_pago: medioPago,
        importe,
        banco: banco.trim(),
        numero_operacion: numeroOperacion.trim(),
        numero_cheque: numeroCheque.trim(),
        fecha_emision: medioPago.includes("Cheque") ? fechaEmision : null,
        fecha_pago: medioPago.includes("Cheque") ? fechaPago : null,
      },
    ]);
    setImporteMedio("");
    setBanco("");
    setNumeroOperacion("");
    setNumeroCheque("");
  }

  function agregarRetencion() {
    const importe = Number(importeRetencion.replace(",", ".") || 0);

    if (importe <= 0) {
      alert("Ingresa el importe de la retencion");
      return;
    }

    setRetenciones([...retenciones, { tipo: tipoRetencion, importe }]);
    setImporteRetencion("");
  }

  async function registrarPago() {
    if (!puedeGestionar) {
      alert("Solo los socios pueden registrar pagos");
      return;
    }

    const imputacionesFinales =
      imputaciones.length > 0
        ? imputaciones
        : referenciaId && seleccionado
        ? [
            {
              tipo,
              referencia_id: referenciaId,
              beneficiario:
                tipo === "compra"
                  ? (seleccionado as Compra).razon_social ||
                    (seleccionado as Compra).proveedor
                  : beneficiarioGasto(seleccionado as Gasto),
              detalle: nombreReferencia(seleccionado),
              importe: importeParaImputar,
            },
          ]
        : [];

    if (imputacionesFinales.length === 0) {
      alert("Agrega al menos una imputacion");
      return;
    }

    try {
      setGuardando(true);

      const accessToken = session?.access_token || (await getAccessToken());

      if (!accessToken) {
        throw new Error("No se encontro una sesion activa");
      }

      const response = await fetch("/api/pagos", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fecha,
          medio_pago: medioPago,
          observaciones: observaciones.trim(),
          banco: banco.trim(),
          numero_operacion: numeroOperacion.trim(),
          numero_cheque: numeroCheque.trim(),
          fecha_emision: medioPago.includes("Cheque") ? fechaEmision : null,
          fecha_pago: medioPago.includes("Cheque") ? fechaPago : null,
          imputaciones: imputacionesFinales,
          medios: mediosPago,
          retenciones,
        }),
      });
      const result = (await response.json()) as {
        id?: string;
        numero_formateado?: string;
        error?: string;
      };

      if (!response.ok) throw new Error(result.error || "Error al registrar el pago");

      setReferenciaId("");
      setFecha(hoy());
      setMedioPago("Transferencia");
      setObservaciones("");
      setBanco("");
      setNumeroOperacion("");
      setNumeroCheque("");
      setFechaEmision(hoy());
      setFechaPago(hoy());
      setImputaciones([]);
      setMediosPago([]);
      setRetenciones([]);
      setImporteMedio("");
      setImporteRetencion("");
      await cargarDatos();

      if (result.id) {
        setUltimoPagoId(result.id);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Error al registrar el pago");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarPago(pago: Pago) {
    if (!puedeGestionar) return;

    const confirmado = confirm(
      `Eliminar pago a ${pago.beneficiario || "beneficiario"}?`
    );

    if (!confirmado) return;

    const accessToken = session?.access_token || (await getAccessToken());

    if (!accessToken) {
      alert("No se encontro una sesion activa");
      return;
    }

    const response = await fetch(`/api/pagos?id=${pago.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      alert(result.error || "No se pudo eliminar el pago");
      return;
    }

    await cargarDatos();
  }

  function editarPago(pago: Pago) {
    if (!puedeGestionar) return;

    setEditandoPagoId(pago.id);
    setPagoEdit({
      fecha: pago.fecha || hoy(),
      medio_pago: pago.medio_pago || "Transferencia",
      importe: String(pago.importe || ""),
      banco: pago.banco || "",
      numero_cheque: pago.numero_cheque || "",
      fecha_emision: pago.fecha_emision || hoy(),
      fecha_pago: pago.fecha_pago || hoy(),
      observaciones: pago.observaciones || "",
    });
  }

  function updatePagoEdit(key: keyof PagoEdit, value: string) {
    setPagoEdit((current) => ({ ...current, [key]: value }));
  }

  async function guardarEdicionPago(pago: Pago) {
    if (!puedeGestionar || !editandoPagoId) return;

    const accessToken = session?.access_token || (await getAccessToken());

    if (!accessToken) {
      alert("No se encontro una sesion activa");
      return;
    }

    const response = await fetch("/api/pagos", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: pago.id,
        tipo: pago.tipo,
        referencia_id: pago.referencia_id,
        beneficiario: pago.beneficiario,
        fecha: pagoEdit.fecha,
        medio_pago: pagoEdit.medio_pago,
        importe: Number(pagoEdit.importe.replace(",", ".") || 0),
        banco: pagoEdit.banco,
        numero_cheque: pagoEdit.numero_cheque,
        fecha_emision: pagoEdit.medio_pago.includes("Cheque")
          ? pagoEdit.fecha_emision
          : null,
        fecha_pago: pagoEdit.medio_pago.includes("Cheque")
          ? pagoEdit.fecha_pago
          : null,
        observaciones: pagoEdit.observaciones,
      }),
    });
    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      alert(result.error || "No se pudo editar el pago");
      return;
    }

    setEditandoPagoId("");
    await cargarDatos();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Pagos</h1>
        <p className="text-zinc-500 mt-2">
          Cancelacion de facturas de compras y reintegros de gastos
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
          <div className="text-sm text-gray-500">Compras pendientes</div>
          <div className="text-2xl font-bold">
            ${totalPendienteCompras.toLocaleString("es-AR")}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setVistaCheques(!vistaCheques)}
          className="border rounded-lg p-4 bg-white text-left"
        >
          <div className="text-sm text-gray-500">Cheques entregados</div>
          <div className="text-2xl font-bold">
            ${totalCheques.toLocaleString("es-AR")}
          </div>
        </button>

        <div className="border rounded-lg p-4 bg-white">
          <div className="text-sm text-gray-500">Proximo ch a vencer</div>
          <div className="text-lg font-bold">
            {proximoCheque
              ? `$${Number(proximoCheque.importe || 0).toLocaleString("es-AR")}`
              : "-"}
          </div>
          <div className="text-xs text-gray-500">
            {proximoCheque
              ? `${proximoCheque.fecha_pago} - ${
                  proximoCheque.beneficiario || "-"
                }`
              : "Sin cheques pendientes"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-lg p-4 bg-white">
          <div className="text-sm text-gray-500">Gastos a reintegrar</div>
          <div className="text-2xl font-bold">
            ${totalPendienteGastos.toLocaleString("es-AR")}
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-white">
          <div className="text-sm text-gray-500">Pagos registrados</div>
          <div className="text-2xl font-bold">{pagosPeriodo.length}</div>
        </div>
      </div>

      {vistaCheques && (
        <div className="border rounded-lg bg-white overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-100">
              <tr>
                <th className="text-left p-3">Fecha pago</th>
                <th className="text-left p-3">Beneficiario</th>
                <th className="text-left p-3">Banco</th>
                <th className="text-left p-3">Cheque</th>
                <th className="text-left p-3">Importe</th>
              </tr>
            </thead>
            <tbody>
              {cheques.map((cheque) => (
                <tr key={cheque.id} className="border-t">
                  <td className="p-3">{cheque.fecha_pago || "-"}</td>
                  <td className="p-3">{cheque.beneficiario || "-"}</td>
                  <td className="p-3">{cheque.banco || "-"}</td>
                  <td className="p-3">{cheque.numero_cheque || "-"}</td>
                  <td className="p-3 font-semibold">
                    ${Number(cheque.importe || 0).toLocaleString("es-AR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {puedeGestionar && (
      <div className="border rounded-lg p-4 bg-white space-y-4">
        <h2 className="text-xl font-semibold">Registrar pago</h2>

        <div className="grid grid-cols-4 gap-3">
          <select
            className="border rounded p-2"
            value={tipo}
            onChange={(event) => {
              setTipo(event.target.value as "compra" | "gasto");
              setReferenciaId("");
              setProveedorCompra("");
              setUsuarioGastoId("");
            }}
          >
            <option value="compra">Factura de compra</option>
            <option value="gasto">Reintegro de gasto</option>
          </select>

          {tipo === "compra" ? (
            <select
              className="border rounded p-2"
              value={proveedorCompra}
              onChange={(event) => {
                setProveedorCompra(event.target.value);
                setReferenciaId("");
              }}
            >
              <option value="">Todos los proveedores</option>
              {proveedoresCompra.map((proveedor) => (
                <option key={proveedor} value={proveedor}>
                  {proveedor}
                </option>
              ))}
            </select>
          ) : (
            <select
              className="border rounded p-2"
              value={usuarioGastoId}
              onChange={(event) => {
                setUsuarioGastoId(event.target.value);
                setReferenciaId("");
              }}
            >
              <option value="">Seleccionar origen del gasto</option>
              <option value="__proveedores">Proveedores / Planaris</option>
              {usuarios.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {userIdentityLabel(usuario)}
                </option>
              ))}
            </select>
          )}

          <input
            className="border rounded p-2"
            type="date"
            value={fecha}
            onChange={(event) => setFecha(event.target.value)}
          />

          <select
            className="border rounded p-2"
            value={medioPago}
            onChange={(event) => setMedioPago(event.target.value)}
          >
            <option>Transferencia</option>
            <option>Efectivo</option>
            <option>Cheque propio</option>
            <option>Cheque de terceros</option>
            <option>Tarjeta</option>
            <option>Otro</option>
          </select>
        </div>

        {medioPago.includes("Cheque") && (
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

        {medioPago === "Transferencia" && (
          <div className="grid grid-cols-2 gap-3">
            <input
              className="border rounded p-2"
              placeholder="Banco"
              value={banco}
              onChange={(event) => setBanco(event.target.value)}
            />
            <input
              className="border rounded p-2"
              placeholder="Numero de operacion"
              value={numeroOperacion}
              onChange={(event) => setNumeroOperacion(event.target.value)}
            />
          </div>
        )}

        <div className="border rounded-lg p-3 bg-zinc-50 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-semibold">Medios de pago</h3>
              <p className="text-sm text-zinc-500">
                Total cargado: ${totalMedios.toLocaleString("es-AR")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                className="border rounded p-2 bg-white"
                placeholder="Importe del medio"
                value={importeMedio}
                onChange={(event) => setImporteMedio(event.target.value)}
              />
              <button
                type="button"
                onClick={agregarMedioPago}
                className="border rounded px-4 py-2 bg-white"
              >
                Agregar medio
              </button>
            </div>
          </div>
          {mediosPago.map((medio, index) => (
            <div
              key={`${medio.medio_pago}-${index}`}
              className="grid gap-2 rounded border bg-white p-3 text-sm sm:grid-cols-[1fr_1fr_auto]"
            >
              <div>
                <strong>{medio.medio_pago}</strong>
                <p className="text-zinc-500">
                  {[medio.banco, medio.numero_cheque, medio.numero_operacion]
                    .filter(Boolean)
                    .join(" - ") || "Sin datos adicionales"}
                </p>
              </div>
              <strong>${medio.importe.toLocaleString("es-AR")}</strong>
              <button
                type="button"
                onClick={() =>
                  setMediosPago(
                    mediosPago.filter((_, medioIndex) => medioIndex !== index)
                  )
                }
                className="border rounded px-3 py-1 text-red-600"
              >
                Quitar
              </button>
            </div>
          ))}
          {mediosPago.length === 0 && (
            <p className="text-sm text-zinc-500">
              Si no agregas medios, se usara el medio seleccionado por el saldo
              total de la orden.
            </p>
          )}
        </div>

        <select
          className="border rounded p-2 w-full"
          value={referenciaId}
          onChange={(event) => setReferenciaId(event.target.value)}
        >
          <option value="">Seleccionar pendiente</option>
          {pendientes.map((item) => (
            <option key={item.id} value={item.id}>
              {nombreReferencia(item)} - $
              {Number(
                tipo === "compra"
                  ? signedAmount(
                      (item as Compra).tipo_comprobante,
                      Number((item as Compra).importe || 0)
                    )
                  : (item as Gasto).importe_total || 0
              ).toLocaleString("es-AR")}
              {" "}pendiente $
              {Number(
                tipo === "compra"
                  ? saldoCompra(item as Compra)
                  : saldoGasto(item as Gasto)
              ).toLocaleString("es-AR")}
            </option>
          ))}
        </select>

        <input
          className="border rounded p-2 w-full"
          placeholder={`Importe a imputar: ${importeSeleccionado.toLocaleString("es-AR")}`}
          value={importeManual}
          onChange={(event) => setImporteManual(event.target.value)}
        />

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
                  key={`${imputacion.tipo}-${imputacion.referencia_id}`}
                  className="grid grid-cols-4 gap-3 items-center text-sm"
                >
                  <div className="col-span-2">{imputacion.detalle}</div>
                  <input
                    className="border rounded p-2"
                    type="number"
                    value={imputacion.importe}
                    onChange={(event) =>
                      setImputaciones(
                        imputaciones.map((item) =>
                          item.tipo === imputacion.tipo &&
                          item.referencia_id === imputacion.referencia_id
                            ? { ...item, importe: Number(event.target.value || 0) }
                            : item
                        )
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      quitarImputacion(imputacion.tipo, imputacion.referencia_id)
                    }
                    className="border rounded px-3 py-2 text-red-600"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border rounded-lg p-3 bg-zinc-50 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-semibold">Retenciones</h3>
              <p className="text-sm text-zinc-500">
                Total retenido: ${totalRetenciones.toLocaleString("es-AR")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className="border rounded p-2 bg-white"
                value={tipoRetencion}
                onChange={(event) => setTipoRetencion(event.target.value)}
              >
                <option>Ganancias</option>
                <option>IVA</option>
                <option>Ingresos Brutos</option>
                <option>SUSS</option>
                <option>Otra</option>
              </select>
              <input
                className="border rounded p-2 bg-white"
                placeholder="Importe retencion"
                value={importeRetencion}
                onChange={(event) => setImporteRetencion(event.target.value)}
              />
              <button
                type="button"
                onClick={agregarRetencion}
                className="border rounded px-4 py-2 bg-white"
              >
                Agregar retencion
              </button>
            </div>
          </div>
          {retenciones.map((retencion, index) => (
            <div
              key={`${retencion.tipo}-${index}`}
              className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded border bg-white p-3 text-sm"
            >
              <span>{retencion.tipo}</span>
              <strong>${retencion.importe.toLocaleString("es-AR")}</strong>
              <button
                type="button"
                onClick={() =>
                  setRetenciones(
                    retenciones.filter(
                      (_, retencionIndex) => retencionIndex !== index
                    )
                  )
                }
                className="border rounded px-3 py-1 text-red-600"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>

        <textarea
          className="border rounded p-2 w-full"
          placeholder="Observaciones"
          value={observaciones}
          onChange={(event) => setObservaciones(event.target.value)}
        />

        <div className="flex gap-3">
          <button
            onClick={registrarPago}
            disabled={guardando}
            className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {guardando ? "Registrando..." : "Registrar pago"}
          </button>

          {ultimoPagoId ? (
            <Link
              href={`/pagos/orden?id=${ultimoPagoId}`}
              target="_blank"
              className="border rounded px-4 py-2"
            >
              Orden de pago
            </Link>
          ) : (
            <button disabled className="border rounded px-4 py-2 opacity-50">
              Orden de pago
            </button>
          )}
        </div>
      </div>
      )}

      {loading && <p>Cargando pagos...</p>}
      {errorCarga && <p className="text-sm text-red-600">{errorCarga}</p>}

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold">Historial de pagos</h2>
          <div className="grid grid-cols-5 gap-2">
            <input
              className="border rounded p-2"
              type="date"
              value={historialFecha}
              onChange={(event) => setHistorialFecha(event.target.value)}
            />
            <input
              className="border rounded p-2"
              placeholder="Proveedor"
              value={historialProveedor}
              onChange={(event) => setHistorialProveedor(event.target.value)}
            />
            <select
              className="border rounded p-2"
              value={historialEstado}
              onChange={(event) => setHistorialEstado(event.target.value)}
            >
              <option value="">Estado</option>
              <option value="Pagado">Pagado</option>
              <option value="Pendiente">Pendiente</option>
            </select>
            <select
              className="border rounded p-2"
              value={historialCategoria}
              onChange={(event) => setHistorialCategoria(event.target.value)}
            >
              <option value="">Categoria</option>
              <option value="compra">Compra</option>
              <option value="gasto">Gasto</option>
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
        {ordenesFiltradas.map((orden) => (
          <details key={orden.id} className="border rounded-lg bg-white">
            <summary className="grid cursor-pointer list-none gap-3 p-4 sm:grid-cols-[150px_1fr_auto_auto] sm:items-center">
              <div>
                <div className="font-semibold">
                  {orden.numero
                    ? `OP-${String(orden.numero).padStart(6, "0")}`
                    : "Orden historica"}
                </div>
                <div className="text-sm text-zinc-500">{orden.fecha}</div>
              </div>
              <div>
                <div className="font-semibold">
                  {orden.beneficiario || "Sin beneficiario"}
                </div>
                <div className="text-sm text-zinc-500">
                  {orden.cantidadImputaciones} imputacion(es) -{" "}
                  {orden.cantidadMedios} medio(s)
                  {orden.retenciones.length > 0
                    ? ` - ${orden.retenciones.length} retencion(es)`
                    : ""}
                </div>
              </div>
              <strong>${orden.total.toLocaleString("es-AR")}</strong>
              <Link
                href={`/pagos/orden?id=${orden.id}`}
                onClick={(event) => event.stopPropagation()}
                className="border rounded px-3 py-2 text-center"
              >
                Ver detalle
              </Link>
            </summary>

            <div className="border-t p-4 space-y-3">
              {orden.imputaciones.map((pago) => (
                <div key={pago.id} className="rounded border p-3">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <strong>
                        {pago.tipo === "compra" ? "Compra" : "Gasto"} -{" "}
                        {pago.beneficiario || "Sin beneficiario"}
                      </strong>
                      <p className="text-sm text-zinc-500">
                        {pago.medio_pago || "-"} - {estadoPago(pago)}
                      </p>
                    </div>
                    <strong>
                      ${Number(pago.importe || 0).toLocaleString("es-AR")}
                    </strong>
                  </div>

                  {puedeGestionar && editandoPagoId === pago.id && (
                    <div className="mt-3 grid gap-2 rounded border bg-zinc-50 p-3 sm:grid-cols-4">
                      <input
                        className="border rounded p-2"
                        type="date"
                        value={pagoEdit.fecha}
                        onChange={(event) =>
                          updatePagoEdit("fecha", event.target.value)
                        }
                      />
                      <input
                        className="border rounded p-2"
                        value={pagoEdit.importe}
                        onChange={(event) =>
                          updatePagoEdit("importe", event.target.value)
                        }
                      />
                      <button
                        onClick={() => guardarEdicionPago(pago)}
                        className="bg-black text-white rounded px-3 py-2"
                      >
                        Guardar cambios
                      </button>
                      <button
                        onClick={() => setEditandoPagoId("")}
                        className="border rounded px-3 py-2"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}

                  {puedeGestionar && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => editarPago(pago)}
                        className="border rounded px-3 py-1"
                      >
                        Editar imputacion
                      </button>
                      <button
                        onClick={() => eliminarPago(pago)}
                        className="border rounded px-3 py-1 text-red-600"
                      >
                        Eliminar imputacion
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
