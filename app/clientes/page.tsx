"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { canManageRecords } from "@/lib/permissions";

type Cliente = {
  id: string;
  cuit: string;
  razon_social: string;
  domicilio: string | null;
  ciudad: string | null;
  telefono: string | null;
  email: string | null;
  observaciones: string | null;
  activo: boolean;
};

export default function ClientesPage() {
  const { user } = useAuth();
  const puedeGestionar = canManageRecords(user?.rol);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const [cuit, setCuit] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [domicilio, setDomicilio] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [activo, setActivo] = useState(true);

  useEffect(() => {
    cargarClientes();
  }, []);

  async function cargarClientes() {
    setLoading(true);

    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .order("razon_social", { ascending: true });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    setClientes(data || []);
    setLoading(false);
  }

  function limpiarFormulario() {
    setEditandoId(null);
    setCuit("");
    setRazonSocial("");
    setDomicilio("");
    setCiudad("");
    setTelefono("");
    setEmail("");
    setObservaciones("");
    setActivo(true);
  }

  async function guardarCliente() {
    if (!puedeGestionar) {
      alert("Solo los socios pueden crear o editar clientes");
      return;
    }

    if (!cuit.trim()) {
      alert("Ingresá el CUIT");
      return;
    }

    if (!razonSocial.trim()) {
      alert("Ingresá la razón social");
      return;
    }

    try {
      setGuardando(true);

      const payload = {
        cuit: cuit.trim(),
        razon_social: razonSocial.trim(),
        domicilio: domicilio.trim() || null,
        ciudad: ciudad.trim() || null,
        telefono: telefono.trim() || null,
        email: email.trim() || null,
        observaciones: observaciones.trim() || null,
        activo,
      };

      const { error } = editandoId
        ? await supabase.from("clientes").update(payload).eq("id", editandoId)
        : await supabase.from("clientes").insert(payload);

      if (error) {
  console.log("SUPABASE ERROR:", error);
  alert(JSON.stringify(error, null, 2));
  return;
}

      limpiarFormulario();
      await cargarClientes();
    } catch (error) {
  console.error(error);
  alert(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setGuardando(false);
    }
  }

  function editarCliente(cliente: Cliente) {
    if (!puedeGestionar) return;

    setEditandoId(cliente.id);
    setCuit(cliente.cuit || "");
    setRazonSocial(cliente.razon_social || "");
    setDomicilio(cliente.domicilio || "");
    setCiudad(cliente.ciudad || "");
    setTelefono(cliente.telefono || "");
    setEmail(cliente.email || "");
    setObservaciones(cliente.observaciones || "");
    setActivo(cliente.activo ?? true);
  }

  async function eliminarCliente(cliente: Cliente) {
    if (!puedeGestionar) return;

    const confirmado = confirm(
      `Eliminar cliente ${cliente.razon_social}? Esta accion no se puede deshacer.`
    );

    if (!confirmado) return;

    const { error } = await supabase
      .from("clientes")
      .delete()
      .eq("id", cliente.id);

    if (error) {
      alert(error.message);
      return;
    }

    await cargarClientes();
  }

  const clientesFiltrados = clientes.filter((cliente) => {
    const texto = `${cliente.cuit} ${cliente.razon_social} ${cliente.ciudad || ""}`
      .toLowerCase();

    return texto.includes(busqueda.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold">Clientes</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 bg-white">
          <div className="text-sm text-gray-500">Total clientes</div>
          <div className="text-2xl font-bold">{clientes.length}</div>
        </div>

        <div className="border rounded-lg p-4 bg-white">
          <div className="text-sm text-gray-500">Activos</div>
          <div className="text-2xl font-bold">
            {clientes.filter((cliente) => cliente.activo).length}
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-white">
          <div className="text-sm text-gray-500">Inactivos</div>
          <div className="text-2xl font-bold">
            {clientes.filter((cliente) => !cliente.activo).length}
          </div>
        </div>
      </div>

      {puedeGestionar && (
      <div className="border rounded-lg p-4 space-y-4 bg-white">
        <h2 className="text-xl font-semibold">
          {editandoId ? "Editar cliente" : "Nuevo cliente"}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <input
            className="border rounded p-2"
            placeholder="CUIT"
            value={cuit}
            onChange={(e) => setCuit(e.target.value)}
          />

          <input
            className="border rounded p-2"
            placeholder="Razón social"
            value={razonSocial}
            onChange={(e) => setRazonSocial(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input
            className="border rounded p-2"
            placeholder="Domicilio"
            value={domicilio}
            onChange={(e) => setDomicilio(e.target.value)}
          />

          <input
            className="border rounded p-2"
            placeholder="Ciudad"
            value={ciudad}
            onChange={(e) => setCiudad(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input
            className="border rounded p-2"
            placeholder="Teléfono"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />

          <input
            className="border rounded p-2"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <textarea
          className="border rounded p-2 w-full"
          placeholder="Observaciones"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
          />
          Cliente activo
        </label>

        <div className="flex gap-3">
          <button
            onClick={guardarCliente}
            disabled={guardando}
            className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {guardando
              ? "Guardando..."
              : editandoId
              ? "Guardar cambios"
              : "Guardar cliente"}
          </button>

          {editandoId && (
            <button
              onClick={limpiarFormulario}
              className="border px-4 py-2 rounded"
            >
              Cancelar edición
            </button>
          )}
        </div>
      </div>
      )}

      <div className="border rounded-lg p-4 bg-white">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-semibold">Listado de clientes</h2>

          <input
            className="border rounded p-2 w-80"
            placeholder="Buscar por CUIT, razón social o ciudad"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {loading && <p>Cargando clientes...</p>}

        {!loading && clientesFiltrados.length === 0 && (
          <p>No hay clientes para mostrar.</p>
        )}

        {!loading && clientesFiltrados.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">CUIT</th>
                  <th className="py-2">Razón social</th>
                  <th className="py-2">Ciudad</th>
                  <th className="py-2">Teléfono</th>
                  <th className="py-2">Estado</th>
                  {puedeGestionar && <th className="py-2">Acciones</th>}
                </tr>
              </thead>

              <tbody>
                {clientesFiltrados.map((cliente) => (
                  <tr key={cliente.id} className="border-b">
                    <td className="py-2">{cliente.cuit}</td>
                    <td className="py-2 font-medium">
                      {cliente.razon_social}
                    </td>
                    <td className="py-2">{cliente.ciudad || "-"}</td>
                    <td className="py-2">{cliente.telefono || "-"}</td>
                    <td className="py-2">
                      {cliente.activo ? "Activo" : "Inactivo"}
                    </td>
                    {puedeGestionar && (
                      <td className="py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => editarCliente(cliente)}
                            className="border px-3 py-1 rounded"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => eliminarCliente(cliente)}
                            className="border px-3 py-1 rounded text-red-600"
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
        )}
      </div>
    </div>
  );
}
