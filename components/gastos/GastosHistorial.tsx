"use client";

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { canManageRecords } from "@/lib/permissions";
import { getAccessToken } from "@/lib/client-auth";

type Gasto = {
  id: string;
  fecha: string;
  categoria: string | null;
  descripcion: string | null;
  proveedor: string | null;
  cuit: string | null;
  tipo_comprobante: string | null;
  importe_neto: number | null;
  iva: number | null;
  otros_impuestos: number | null;
  importe_total: number | null;
  estado: string | null;
  usuarios?: {
    nombre?: string | null;
  } | null;
};

type GastoEdit = {
  fecha: string;
  categoria: string;
  descripcion: string;
  proveedor: string;
  cuit: string;
  tipo_comprobante: string;
  importe_neto: string;
  iva: string;
  otros_impuestos: string;
  estado: string;
};

function numero(valor: string) {
  const parsed = Number(valor.replace(",", ".") || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function GastosHistorial({ gastos }: { gastos: Gasto[] }) {
  const { session, user } = useAuth();
  const puedeGestionar = canManageRecords(user?.rol);
  const [editandoId, setEditandoId] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [filtroProveedor, setFiltroProveedor] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [form, setForm] = useState<GastoEdit>({
    fecha: "",
    categoria: "",
    descripcion: "",
    proveedor: "",
    cuit: "",
    tipo_comprobante: "Sin comprobante",
    importe_neto: "",
    iva: "",
    otros_impuestos: "",
    estado: "Pendiente",
  });

  const estados = useMemo(
    () =>
      Array.from(new Set(gastos.map((gasto) => gasto.estado || "Pendiente"))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [gastos]
  );
  const categorias = useMemo(
    () =>
      Array.from(new Set(gastos.map((gasto) => gasto.categoria || "Sin categoria"))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [gastos]
  );
  const gastosFiltrados = useMemo(() => {
    const textoProveedor = filtroProveedor.trim().toLowerCase();

    return gastos.filter((gasto) => {
      const proveedor = (
        gasto.proveedor ||
        gasto.usuarios?.nombre ||
        "Proveedores / Planaris"
      ).toLowerCase();

      return (
        (!filtroFecha || gasto.fecha === filtroFecha) &&
        (!textoProveedor || proveedor.includes(textoProveedor)) &&
        (!filtroEstado || (gasto.estado || "Pendiente") === filtroEstado) &&
        (!filtroCategoria ||
          (gasto.categoria || "Sin categoria") === filtroCategoria)
      );
    });
  }, [filtroCategoria, filtroEstado, filtroFecha, filtroProveedor, gastos]);

  function limpiarFiltros() {
    setFiltroFecha("");
    setFiltroProveedor("");
    setFiltroEstado("");
    setFiltroCategoria("");
  }

  function editarGasto(gasto: Gasto) {
    if (!puedeGestionar) return;

    setEditandoId(gasto.id);
    setForm({
      fecha: gasto.fecha || new Date().toISOString().split("T")[0],
      categoria: gasto.categoria || "",
      descripcion: gasto.descripcion || "",
      proveedor: gasto.proveedor || "",
      cuit: gasto.cuit || "",
      tipo_comprobante: gasto.tipo_comprobante || "Sin comprobante",
      importe_neto: String(gasto.importe_neto || ""),
      iva: String(gasto.iva || ""),
      otros_impuestos: String(gasto.otros_impuestos || ""),
      estado: gasto.estado || "Pendiente",
    });
  }

  function updateField(key: keyof GastoEdit, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function cancelarEdicion() {
    setEditandoId("");
  }

  async function guardarEdicion() {
    if (!puedeGestionar || !editandoId) return;

    const neto = numero(form.importe_neto);
    const iva = numero(form.iva);
    const otros = numero(form.otros_impuestos);

    const accessToken = session?.access_token || (await getAccessToken());

    if (!accessToken) {
      alert("No se encontro una sesion activa");
      return;
    }

    const response = await fetch("/api/gastos", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: editandoId,
        fecha: form.fecha,
        categoria: form.categoria,
        descripcion: form.descripcion,
        proveedor: form.proveedor,
        cuit: form.cuit,
        tipo_comprobante: form.tipo_comprobante,
        importe_neto: neto,
        iva,
        otros_impuestos: otros,
        estado: form.estado,
      }),
    });
    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      alert(result.error || "No se pudo editar el gasto");
      return;
    }

    location.reload();
  }

  async function eliminarGasto(gasto: Gasto) {
    if (!puedeGestionar) return;

    const confirmado = confirm(
      `Eliminar gasto ${gasto.proveedor || gasto.categoria || gasto.fecha}?`
    );

    if (!confirmado) return;

    const accessToken = session?.access_token || (await getAccessToken());

    if (!accessToken) {
      alert("No se encontro una sesion activa");
      return;
    }

    const response = await fetch(`/api/gastos?id=${gasto.id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      alert(result.error || "No se pudo eliminar el gasto");
      return;
    }

    location.reload();
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="p-4 border-b">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold">Historial de gastos</h2>
          <div className="grid grid-cols-5 gap-2">
            <input
              className="border rounded p-2"
              type="date"
              value={filtroFecha}
              onChange={(event) => setFiltroFecha(event.target.value)}
            />
            <input
              className="border rounded p-2"
              placeholder="Proveedor"
              value={filtroProveedor}
              onChange={(event) => setFiltroProveedor(event.target.value)}
            />
            <select
              className="border rounded p-2"
              value={filtroEstado}
              onChange={(event) => setFiltroEstado(event.target.value)}
            >
              <option value="">Estado</option>
              {estados.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
            <select
              className="border rounded p-2"
              value={filtroCategoria}
              onChange={(event) => setFiltroCategoria(event.target.value)}
            >
              <option value="">Categoria</option>
              {categorias.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={limpiarFiltros}
              className="border rounded p-2"
              title="Restablecer filtros"
              aria-label="Restablecer filtros"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </div>
      </div>
      {puedeGestionar && editandoId && (
        <div className="p-4 border-b bg-zinc-50 space-y-3">
          <h3 className="font-semibold">Editar gasto</h3>
          <div className="grid grid-cols-4 gap-3">
            <input
              className="border rounded p-2"
              type="date"
              value={form.fecha}
              onChange={(event) => updateField("fecha", event.target.value)}
            />
            <input
              className="border rounded p-2"
              placeholder="Categoria"
              value={form.categoria}
              onChange={(event) => updateField("categoria", event.target.value)}
            />
            <input
              className="border rounded p-2"
              placeholder="Proveedor"
              value={form.proveedor}
              onChange={(event) => updateField("proveedor", event.target.value)}
            />
            <input
              className="border rounded p-2"
              placeholder="CUIT"
              value={form.cuit}
              onChange={(event) => updateField("cuit", event.target.value)}
            />
          </div>

          <div className="grid grid-cols-5 gap-3">
            <select
              className="border rounded p-2"
              value={form.tipo_comprobante}
              onChange={(event) =>
                updateField("tipo_comprobante", event.target.value)
              }
            >
              <option>Factura A</option>
              <option>Factura B</option>
              <option>Factura C</option>
              <option>Ticket</option>
              <option>Recibo</option>
              <option>Sin comprobante</option>
            </select>
            <input
              className="border rounded p-2"
              placeholder="Neto"
              value={form.importe_neto}
              onChange={(event) => updateField("importe_neto", event.target.value)}
            />
            <input
              className="border rounded p-2"
              placeholder="IVA"
              value={form.iva}
              onChange={(event) => updateField("iva", event.target.value)}
            />
            <input
              className="border rounded p-2"
              placeholder="Otros impuestos"
              value={form.otros_impuestos}
              onChange={(event) =>
                updateField("otros_impuestos", event.target.value)
              }
            />
            <select
              className="border rounded p-2"
              value={form.estado}
              onChange={(event) => updateField("estado", event.target.value)}
            >
              <option>Pendiente</option>
              <option>Pagado</option>
              <option>Reintegrado</option>
            </select>
          </div>

          <textarea
            className="border rounded p-2 w-full"
            placeholder="Descripcion"
            value={form.descripcion}
            onChange={(event) => updateField("descripcion", event.target.value)}
          />

          <div className="flex gap-3">
            <button
              onClick={guardarEdicion}
              className="bg-black text-white rounded px-4 py-2"
            >
              Guardar cambios
            </button>
            <button onClick={cancelarEdicion} className="border rounded px-4 py-2">
              Cancelar
            </button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-zinc-100">
          <tr>
            <th className="text-left p-4">Fecha</th>
            <th className="text-left p-4">Usuario</th>
            <th className="text-left p-4">Categoria</th>
            <th className="text-left p-4">Proveedor</th>
            <th className="text-left p-4">Tipo</th>
            <th className="text-left p-4">Total</th>
            <th className="text-left p-4">Estado</th>
            {puedeGestionar && <th className="text-left p-4">Acciones</th>}
          </tr>
        </thead>

        <tbody>
          {gastosFiltrados.map((gasto) => (
            <tr key={gasto.id} className="border-t">
              <td className="p-4">{gasto.fecha}</td>
              <td className="p-4">
                {gasto.usuarios?.nombre || "Proveedores / Planaris"}
              </td>
              <td className="p-4">{gasto.categoria}</td>
              <td className="p-4">{gasto.proveedor || "-"}</td>
              <td className="p-4">{gasto.tipo_comprobante || "-"}</td>
              <td className="p-4 font-bold">
                ${Number(gasto.importe_total || 0).toLocaleString("es-AR")}
              </td>
              <td className="p-4">{gasto.estado || "Pendiente"}</td>
              {puedeGestionar && (
                <td className="p-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => editarGasto(gasto)}
                      className="border rounded px-3 py-1"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => eliminarGasto(gasto)}
                      className="border rounded px-3 py-1 text-red-600"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
