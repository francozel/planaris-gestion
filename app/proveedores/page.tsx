"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { canManageRecords } from "@/lib/permissions";
import { getAccessToken } from "@/lib/client-auth";

type Proveedor = {
  id: string;
  cuit: string;
  razon_social: string;
  domicilio: string | null;
  ciudad: string | null;
  telefono: string | null;
  email: string | null;
  observaciones: string | null;
  activo: boolean | null;
};

export default function ProveedoresPage() {
  const { session, user } = useAuth();
  const puedeGestionar = canManageRecords(user?.rol);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const [cuit, setCuit] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [domicilio, setDomicilio] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [activo, setActivo] = useState(true);

  const cargarProveedores = useCallback(async () => {
    setLoading(true);
    const accessToken = session?.access_token || (await getAccessToken());

    if (!accessToken) {
      setProveedores([]);
      setLoading(false);
      return;
    }

    const response = await fetch("/api/proveedores", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const result = (await response.json()) as {
      data?: Proveedor[];
      error?: string;
    };

    if (!response.ok) {
      alert(result.error || "No se pudieron cargar los proveedores");
      setLoading(false);
      return;
    }

    setProveedores(result.data || []);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarProveedores();
  }, [cargarProveedores]);

  function limpiarFormulario() {
    setEditandoId("");
    setCuit("");
    setRazonSocial("");
    setDomicilio("");
    setCiudad("");
    setTelefono("");
    setEmail("");
    setObservaciones("");
    setActivo(true);
  }

  async function guardarProveedor() {
    if (!puedeGestionar) return;

    if (!cuit.trim() || !razonSocial.trim()) {
      alert("Completa CUIT y razon social");
      return;
    }

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

    const accessToken = session?.access_token || (await getAccessToken());

    if (!accessToken) {
      alert("No se encontro una sesion activa");
      setGuardando(false);
      return;
    }

    const response = await fetch("/api/proveedores", {
      method: editandoId ? "PUT" : "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(editandoId ? { ...payload, id: editandoId } : payload),
    });
    const result = (await response.json()) as { error?: string };

    setGuardando(false);

    if (!response.ok) {
      alert(result.error || "No se pudo guardar el proveedor");
      return;
    }

    limpiarFormulario();
    await cargarProveedores();
  }

  function editarProveedor(proveedor: Proveedor) {
    if (!puedeGestionar) return;

    setEditandoId(proveedor.id);
    setCuit(proveedor.cuit || "");
    setRazonSocial(proveedor.razon_social || "");
    setDomicilio(proveedor.domicilio || "");
    setCiudad(proveedor.ciudad || "");
    setTelefono(proveedor.telefono || "");
    setEmail(proveedor.email || "");
    setObservaciones(proveedor.observaciones || "");
    setActivo(proveedor.activo !== false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function eliminarProveedor(proveedor: Proveedor) {
    if (!puedeGestionar) return;

    const confirmado = confirm(`Eliminar proveedor ${proveedor.razon_social}?`);
    if (!confirmado) return;

    const accessToken = session?.access_token || (await getAccessToken());

    if (!accessToken) {
      alert("No se encontro una sesion activa");
      return;
    }

    const response = await fetch(`/api/proveedores?id=${proveedor.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      alert(result.error || "No se pudo eliminar el proveedor");
      return;
    }

    await cargarProveedores();
  }

  const proveedoresFiltrados = proveedores.filter((proveedor) =>
    `${proveedor.cuit} ${proveedor.razon_social} ${proveedor.ciudad || ""}`
      .toLowerCase()
      .includes(busqueda.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Proveedores</h1>
        <p className="text-zinc-500 mt-2">
          Base de proveedores para compras y pagos
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 bg-white">
          <div className="text-sm text-gray-500">Total proveedores</div>
          <div className="text-2xl font-bold">{proveedores.length}</div>
        </div>
        <div className="border rounded-lg p-4 bg-white">
          <div className="text-sm text-gray-500">Activos</div>
          <div className="text-2xl font-bold">
            {proveedores.filter((proveedor) => proveedor.activo !== false).length}
          </div>
        </div>
        <div className="border rounded-lg p-4 bg-white">
          <div className="text-sm text-gray-500">Inactivos</div>
          <div className="text-2xl font-bold">
            {proveedores.filter((proveedor) => proveedor.activo === false).length}
          </div>
        </div>
      </div>

      {puedeGestionar && (
        <div className="border rounded-lg p-4 bg-white space-y-4">
          <h2 className="text-xl font-semibold">
            {editandoId ? "Editar proveedor" : "Nuevo proveedor"}
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <input
              className="border rounded p-2"
              placeholder="CUIT"
              value={cuit}
              onChange={(event) => setCuit(event.target.value)}
            />
            <input
              className="border rounded p-2"
              placeholder="Razon social"
              value={razonSocial}
              onChange={(event) => setRazonSocial(event.target.value)}
            />
            <input
              className="border rounded p-2"
              placeholder="Domicilio"
              value={domicilio}
              onChange={(event) => setDomicilio(event.target.value)}
            />
            <input
              className="border rounded p-2"
              placeholder="Ciudad"
              value={ciudad}
              onChange={(event) => setCiudad(event.target.value)}
            />
            <input
              className="border rounded p-2"
              placeholder="Telefono"
              value={telefono}
              onChange={(event) => setTelefono(event.target.value)}
            />
            <input
              className="border rounded p-2"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <textarea
            className="border rounded p-2 w-full"
            placeholder="Observaciones"
            value={observaciones}
            onChange={(event) => setObservaciones(event.target.value)}
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={activo}
              onChange={(event) => setActivo(event.target.checked)}
            />
            Proveedor activo
          </label>

          <div className="flex gap-3">
            <button
              onClick={guardarProveedor}
              disabled={guardando}
              className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {guardando
                ? "Guardando..."
                : editandoId
                ? "Guardar cambios"
                : "Guardar proveedor"}
            </button>

            {editandoId && (
              <button onClick={limpiarFormulario} className="border rounded px-4 py-2">
                Cancelar edicion
              </button>
            )}
          </div>
        </div>
      )}

      <div className="border rounded-lg p-4 bg-white">
        <div className="flex justify-between gap-4 mb-4">
          <h2 className="text-xl font-semibold">Historial de proveedores</h2>
          <input
            className="border rounded p-2 w-80"
            placeholder="Buscar por CUIT, razon social o ciudad"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
          />
        </div>

        {loading && <p>Cargando proveedores...</p>}

        {!loading && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">CUIT</th>
                <th className="py-2">Razon social</th>
                <th className="py-2">Ciudad</th>
                <th className="py-2">Telefono</th>
                <th className="py-2">Estado</th>
                {puedeGestionar && <th className="py-2">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {proveedoresFiltrados.map((proveedor) => (
                <tr key={proveedor.id} className="border-b">
                  <td className="py-2">{proveedor.cuit}</td>
                  <td className="py-2 font-medium">{proveedor.razon_social}</td>
                  <td className="py-2">{proveedor.ciudad || "-"}</td>
                  <td className="py-2">{proveedor.telefono || "-"}</td>
                  <td className="py-2">
                    {proveedor.activo === false ? "Inactivo" : "Activo"}
                  </td>
                  {puedeGestionar && (
                    <td className="py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => editarProveedor(proveedor)}
                          className="border rounded px-3 py-1"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => eliminarProveedor(proveedor)}
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
        )}
      </div>
    </div>
  );
}
