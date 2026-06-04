"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";

type LoginMode = "login" | "recover" | "update";

export default function LoginPage() {
  const { signIn, signOut, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [mode, setMode] = useState<LoginMode>("login");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;

    if (hash.includes("type=recovery") || search.includes("type=recovery")) {
      queueMicrotask(() => {
        setMode("update");
        setMessage("Ingresa tu nueva contrasena.");
      });
    }
  }, []);

  async function ingresar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const message = await signIn(email.trim(), password);

    if (message) {
      setError("Email o contrasena incorrectos.");
    }
  }

  async function enviarRecuperacion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Ingresa tu email.");
      return;
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: `${window.location.origin}/login`,
      }
    );

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setMessage("Te enviamos un email para restablecer la contrasena.");
  }

  async function actualizarPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (newPassword.length < 6) {
      setError("La contrasena debe tener al menos 6 caracteres.");
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setError("Las contrasenas no coinciden.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage("Contrasena actualizada. Ya podes ingresar nuevamente.");
    setNewPassword("");
    setNewPasswordConfirm("");
    setMode("login");
    window.history.replaceState({}, "", "/login");
    await signOut();
  }

  const formTitle =
    mode === "recover"
      ? "Recuperar contrasena"
      : mode === "update"
      ? "Nueva contrasena"
      : "Planaris Gestion";
  const formText =
    mode === "recover"
      ? "Ingresa tu email y te enviamos un enlace de recuperacion"
      : mode === "update"
      ? "Defini una nueva contrasena para tu cuenta"
      : "Ingresa con tu usuario y contrasena";

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <form
        onSubmit={
          mode === "recover"
            ? enviarRecuperacion
            : mode === "update"
            ? actualizarPassword
            : ingresar
        }
        className="w-full max-w-sm bg-white border rounded-lg p-6 space-y-4"
      >
        <div>
          <h1 className="text-2xl font-bold">{formTitle}</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {formText}
          </p>
        </div>

        {mode !== "update" && (
          <input
            className="border rounded p-3 w-full"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        )}

        {mode === "login" && (
          <input
            className="border rounded p-3 w-full"
            placeholder="Contrasena"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}

        {mode === "update" && (
          <>
            <input
              className="border rounded p-3 w-full"
              placeholder="Nueva contrasena"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <input
              className="border rounded p-3 w-full"
              placeholder="Repetir nueva contrasena"
              type="password"
              value={newPasswordConfirm}
              onChange={(event) => setNewPasswordConfirm(event.target.value)}
            />
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-emerald-700">{message}</p>}

        <button
          disabled={loading}
          className="bg-black text-white rounded p-3 w-full disabled:opacity-50"
        >
          {mode === "recover"
            ? "Enviar enlace"
            : mode === "update"
            ? "Guardar contrasena"
            : loading
            ? "Ingresando..."
            : "Ingresar"}
        </button>

        {mode === "login" && (
          <button
            type="button"
            onClick={() => {
              setError("");
              setMessage("");
              setMode("recover");
            }}
            className="w-full text-sm text-zinc-600 hover:text-black"
          >
            Olvide mi contrasena
          </button>
        )}

        {mode === "recover" && (
          <button
            type="button"
            onClick={() => {
              setError("");
              setMessage("");
              setMode("login");
            }}
            className="w-full text-sm text-zinc-600 hover:text-black"
          >
            Volver al ingreso
          </button>
        )}
      </form>
    </div>
  );
}
