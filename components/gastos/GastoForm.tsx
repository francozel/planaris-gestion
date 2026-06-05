"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { getAccessToken } from "@/lib/client-auth";
import { userIdentityLabel } from "@/lib/user-identity";

type Usuario = {
  id: string;
  nombre: string | null;
  email: string | null;
};

type CategoriaGasto = {
  id: string;
  nombre: string | null;
};

export default function GastoForm() {
  const { session } = useAuth();
  const [abierto, setAbierto] = useState(false);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([]);

  const [usuarioId, setUsuarioId] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [cuit, setCuit] = useState("");
  const [tipoComprobante, setTipoComprobante] = useState("Sin comprobante");
  const [importeNeto, setImporteNeto] = useState("");
  const [iva, setIva] = useState("");
  const [otrosImpuestos, setOtrosImpuestos] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);

  const cargarDatos = useCallback(async () => {
    const accessToken = session?.access_token || (await getAccessToken());
    const usuariosResponse = accessToken
      ? await fetch("/api/usuarios", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      : null;
    const usuariosResult = usuariosResponse
      ? ((await usuariosResponse.json()) as { data?: Usuario[] })
      : { data: [] };

    const { data: categoriasData } = await supabase
      .from("categorias_gastos")
      .select("*")
      .order("nombre");

    setUsuarios((usuariosResult.data || []) as Usuario[]);
    setCategorias((categoriasData || []) as CategoriaGasto[]);
  }, [session]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarDatos();
  }, [cargarDatos]);

  async function guardarGasto() {
    const neto = Number(importeNeto || 0);
    const ivaNum = Number(iva || 0);
    const otros = Number(otrosImpuestos || 0);
    const total = neto + ivaNum + otros;

    const accessToken = session?.access_token || (await getAccessToken());

    if (!accessToken) {
      alert("No se encontro una sesion activa");
      return;
    }

    const response = await fetch("/api/gastos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
      usuario_id: usuarioId === "__proveedores" ? null : usuarioId,
      categoria,
      descripcion,
      proveedor,
      cuit,
      tipo_comprobante: tipoComprobante,
      importe_neto: neto,
      iva: ivaNum,
      otros_impuestos: otros,
      importe_total: total,
      fecha,
      }),
    });
    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      alert(result.error || "No se pudo guardar el gasto");
      return;
    }

    alert("Gasto guardado");
    location.reload();
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm mb-8">
      <button
        onClick={() => setAbierto(!abierto)}
        className="bg-black text-white px-6 py-3 rounded-xl"
      >
        {abierto ? "Cerrar formulario" : "+ Nuevo gasto"}
      </button>

      {abierto && (
        <div className="mt-6">
          <h2 className="text-2xl font-bold mb-6">Nuevo gasto</h2>

          <div className="grid grid-cols-3 gap-4">
            <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} className="border rounded-xl p-3">
              <option value="">Seleccionar usuario</option>
              <option value="__proveedores">Proveedores / Planaris</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{userIdentityLabel(u)}</option>
              ))}
            </select>

            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="border rounded-xl p-3">
              <option value="">Categoría</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.nombre || ""}>{c.nombre}</option>
              ))}
            </select>

            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="border rounded-xl p-3" />

            <input placeholder="Proveedor" value={proveedor} onChange={(e) => setProveedor(e.target.value)} className="border rounded-xl p-3" />

            <input placeholder="CUIT" value={cuit} onChange={(e) => setCuit(e.target.value)} className="border rounded-xl p-3" />

            <select value={tipoComprobante} onChange={(e) => setTipoComprobante(e.target.value)} className="border rounded-xl p-3">
              <option>Factura A</option>
              <option>Factura B</option>
              <option>Factura C</option>
              <option>Ticket</option>
              <option>Recibo</option>
              <option>Sin comprobante</option>
            </select>

            <input placeholder="Importe neto" value={importeNeto} onChange={(e) => setImporteNeto(e.target.value)} className="border rounded-xl p-3" />

            <input placeholder="IVA" value={iva} onChange={(e) => setIva(e.target.value)} className="border rounded-xl p-3" />

            <input placeholder="Otros impuestos" value={otrosImpuestos} onChange={(e) => setOtrosImpuestos(e.target.value)} className="border rounded-xl p-3" />
          </div>

          <textarea
            placeholder="Descripción"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="border rounded-xl p-3 w-full mt-4"
          />

          <button onClick={guardarGasto} className="mt-6 bg-black text-white px-6 py-3 rounded-xl">
            Guardar gasto
          </button>
        </div>
      )}
    </div>
  );
}
