"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { KeyRound, Pencil, Save, Trash2, X } from "lucide-react";
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

type UsuarioEdit = {
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
};

export default function UsuariosPage() {
  const { user } = useAuth();
  const puedeGestionar = canManageRecords(user?.rol);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState("");
  const [usuarioEdit, setUsuarioEdit] = useState<UsuarioEdit>({
    nombre: "",
    email: "",
    rol: "usuario",
    activo: true,
  });

  const cargarUsuarios = useCallback(async () => {
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/usuarios", {
      headers: {
        Authorization: `Bearer ${sessionData.session?.access_token || ""}`,
      },
    });
    const result = (await response.json()) as {
      data?: Usuario[];
      error?: string;
    };

    if (!response.ok) {
      alert(result.error || "No se pudieron cargar los usuarios");
      setUsuarios([]);
      setLoading(false);
      return;
    }

    setUsuarios(result.data || []);
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

  function editarUsuario(usuario: Usuario) {
    if (!puedeGestionar) return;

    setEditandoId(usuario.id);
    setUsuarioEdit({
      nombre: usuario.nombre || "",
      email: usuario.email,
      rol: normalizeRole(usuario.rol),
      activo: usuario.activo !== false,
    });
  }

  function updateUsuarioEdit(key: keyof UsuarioEdit, value: string | boolean) {
    setUsuarioEdit((current) => ({ ...current, [key]: value }));
  }

  async function guardarEdicionUsuario(usuario: Usuario) {
    if (!puedeGestionar || !editandoId) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/usuarios", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${sessionData.session?.access_token || ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: usuario.id,
        nombre: usuarioEdit.nombre,
        email: usuarioEdit.email,
        rol: usuarioEdit.rol,
        activo: usuarioEdit.activo,
      }),
    });
    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      alert(result.error || "No se pudo editar el usuario");
      return;
    }

    setEditandoId("");
    await cargarUsuarios();
  }

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-4xl font-bold">Usuarios / Socios</h1>
        <p className="text-zinc-500 mt-2">Gestion de usuarios del sistema</p>
      </div>

      {puedeGestionar && <UserForm onCreated={cargarUsuarios} />}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading && <p className="p-4">Cargando usuarios...</p>}
        {!loading && (
          <table className="w-full">
            <thead className="bg-zinc-100">
              <tr>
                <th className="text-left p-4">Email</th>
                <th className="text-left p-4">Nombre</th>
                <th className="text-left p-4">Rol</th>
                <th className="text-left p-4">Estado</th>
                {puedeGestionar && <th className="text-left p-4">Acciones</th>}
              </tr>
            </thead>

            <tbody>
              {usuarios.map((usuario) => {
                const rol = normalizeRole(usuario.rol);

                return (
                  <Fragment key={usuario.id}>
                    <tr className="border-t">
                      <td className="p-4 font-semibold">{usuario.email}</td>
                      <td className="p-4">{usuario.nombre}</td>
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
                              onClick={() => editarUsuario(usuario)}
                              className="inline-flex items-center gap-2 border rounded px-3 py-2 text-sm hover:bg-zinc-100"
                            >
                              <Pencil size={16} />
                              Editar
                            </button>
                            <button
                              onClick={() => restablecerPassword(usuario)}
                              className="inline-flex items-center gap-2 border rounded px-3 py-2 text-sm hover:bg-zinc-100"
                            >
                              <KeyRound size={16} />
                              Restablecer contraseña
                            </button>
                            <button
                              onClick={() => eliminarUsuario(usuario)}
                              className="inline-flex items-center gap-2 border border-red-200 rounded px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={16} />
                              Eliminar
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                    {puedeGestionar && editandoId === usuario.id && (
                      <tr className="border-t bg-zinc-50">
                        <td colSpan={5} className="p-4">
                          <div className="grid grid-cols-4 gap-3">
                            <input
                              className="border rounded p-2"
                              placeholder="Nombre"
                              value={usuarioEdit.nombre}
                              onChange={(event) =>
                                updateUsuarioEdit("nombre", event.target.value)
                              }
                            />
                            <input
                              className="border rounded p-2"
                              placeholder="Email"
                              value={usuarioEdit.email}
                              onChange={(event) =>
                                updateUsuarioEdit("email", event.target.value)
                              }
                            />
                            <select
                              className="border rounded p-2"
                              value={usuarioEdit.rol}
                              onChange={(event) =>
                                updateUsuarioEdit("rol", event.target.value)
                              }
                            >
                              <option value="socio">Socio</option>
                              <option value="administracion">Administracion</option>
                              <option value="usuario">Usuario</option>
                            </select>
                            <label className="border rounded p-2 flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={usuarioEdit.activo}
                                onChange={(event) =>
                                  updateUsuarioEdit("activo", event.target.checked)
                                }
                              />
                              Activo
                            </label>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => guardarEdicionUsuario(usuario)}
                              className="inline-flex items-center gap-2 bg-black text-white rounded px-3 py-2 text-sm"
                            >
                              <Save size={16} />
                              Guardar cambios
                            </button>
                            <button
                              onClick={() => setEditandoId("")}
                              className="inline-flex items-center gap-2 border rounded px-3 py-2 text-sm hover:bg-zinc-100"
                            >
                              <X size={16} />
                              Cancelar
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
