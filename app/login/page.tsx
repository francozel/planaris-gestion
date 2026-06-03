"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const { signIn, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function ingresar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const message = await signIn(email.trim(), password);

    if (message) {
      setError("Email o contrasena incorrectos.");
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <form
        onSubmit={ingresar}
        className="w-full max-w-sm bg-white border rounded-lg p-6 space-y-4"
      >
        <div>
          <h1 className="text-2xl font-bold">Planaris Gestion</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Ingresa con tu usuario y contrasena
          </p>
        </div>

        <input
          className="border rounded p-3 w-full"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <input
          className="border rounded p-3 w-full"
          placeholder="Contrasena"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          disabled={loading}
          className="bg-black text-white rounded p-3 w-full disabled:opacity-50"
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
