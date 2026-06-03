"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { roleDescriptions, roleLabels, type UserRole } from "@/lib/permissions";

export default function UserForm() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<UserRole>("usuario");
  const [loading, setLoading] = useState(false);

  async function crearUsuario() {
    if (!nombre.trim() || !email.trim() || !password.trim()) {
      alert("Completa nombre, email y contrasena");
      return;
    }

    try {
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();

      const response = await fetch("/api/usuarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session?.access_token || ""}`,
        },
        body: JSON.stringify({
          nombre,
          email,
          password,
          rol,
        }),
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        alert(result.error || "No se pudo crear el usuario");
        return;
      }

      alert("Usuario creado");

      setNombre("");
      setEmail("");
      setPassword("");
      setRol("usuario");

      location.reload();

    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm mb-8">
      <h2 className="text-2xl font-bold mb-6">
        Nuevo usuario
      </h2>

      <div className="grid grid-cols-4 gap-4">
        <input
          placeholder="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="border rounded-xl p-3"
        />

        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded-xl p-3"
        />

        <input
          placeholder="Contrasena"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded-xl p-3"
        />

        <select
          value={rol}
          onChange={(e) => setRol(e.target.value as UserRole)}
          className="border rounded-xl p-3"
        >
          {(["socio", "administracion", "usuario"] as UserRole[]).map(
            (role) => (
              <option key={role} value={role}>
                {roleLabels[role]} - {roleDescriptions[role]}
              </option>
            )
          )}
        </select>
      </div>

      <button
        onClick={crearUsuario}
        disabled={loading}
        className="mt-6 bg-black text-white px-6 py-3 rounded-xl"
      >
        {loading ? "Guardando..." : "Crear usuario"}
      </button>
    </div>
  );
}
