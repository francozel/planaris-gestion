"use client";

import { useCallback, useEffect, useState } from "react";
import UserForm from "@/components/usuarios/UserForm";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import {
  canManageRecords,
  normalizeRole,
  roleDescriptions,
  roleLabels,
} from "@/lib/permissions";

type Usuario = {
  id: string;
  nombre: string | null;
  email: string;
  rol: string | null;
  activo: boolean | null;
};

export default function UsuariosPage() {
  const { user } = useAuth();
  const puedeGestionar = canManageRecords(user?.rol);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  const cargarUsuarios = useCallback(async () => {
    setLoading(true);

    const { data } = await supabase
      .from("usuarios")
      .select("*")
      .order("created_at", { ascending: false });

    setUsuarios(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarUsuarios();
  }, [cargarUsuarios]);

  async function eliminarUsuario(usuario: Usuario) {
    if (!puedeGestionar) return;

    const confirmado = confirm(`Eliminar usuario ${usuario.email}?`);

    if (!confirmado) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch(
      `/api/usuarios?email=${encodeURIComponent(usuario.email)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token || ""}`,
        },
      }
    );

    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      alert(result.error || "No se pudo eliminar el usuario");
      return;
    }

    await cargarUsuarios();
  }

  async function restablecerPassword(usuario: Usuario) {
    if (!puedeGestionar) return;

    const confirmado = confirm(
      `Enviar email de restablecimiento a ${usuario.email}?`
    );

    if (!confirmado) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/usuarios", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${sessionData.session?.access_token || ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: usuario.email }),
    });
    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      alert(result.error || "No se pudo enviar el restablecimiento");
      return;
    }

    alert("Email de restablecimiento enviado");
  }

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-4xl font-bold">Usuarios / Socios</h1>
        <p className="text-zinc-500 mt-2">Gestion de usuarios del sistema</p>
      </div>

      {puedeGestionar && <UserForm />}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading && <p className="p-4">Cargando usuarios...</p>}
        {!loading && (
          <table className="w-full">
            <thead className="bg-zinc-100">
              <tr>
                <th className="text-left p-4">Nombre</th>
                <th className="text-left p-4">Email</th>
                <th className="text-left p-4">Rol</th>
                <th className="text-left p-4">Estado</th>
                {puedeGestionar && <th className="text-left p-4">Acciones</th>}
              </tr>
            </thead>

            <tbody>
              {usuarios.map((usuario) => {
                const rol = normalizeRole(usuario.rol);

                return (
                  <tr key={usuario.id} className="border-t">
                    <td className="p-4">{usuario.nombre}</td>
                    <td className="p-4">{usuario.email}</td>
                    <td className="p-4">
                      {roleLabels[rol]}
                      <p className="text-xs text-zinc-500">
                        {roleDescriptions[rol]}
                      </p>
                    </td>
                    <td className="p-4">
                      {usuario.activo === false ? "Inactivo" : "Activo"}
                    </td>
                    {puedeGestionar && (
                      <td className="p-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => restablecerPassword(usuario)}
                            className="border rounded px-3 py-1"
                          >
                            Restablecer contraseña
                          </button>
                          <button
                            onClick={() => eliminarUsuario(usuario)}
                            className="border rounded px-3 py-1 text-red-600"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
