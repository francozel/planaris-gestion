"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { canManageRecords } from "@/lib/permissions";
import { getAccessToken } from "@/lib/client-auth";

type Banco = {
  id: string;
  nombre: string | null;
  banco: string | null;
  tipo_cuenta: string | null;
  numero_cuenta: string | null;
  moneda: string | null;
  saldo_inicial: number | null;
  saldo_actual: number | null;
  activo: boolean | null;
};

const bancoVacio = {
  nombre: "",
  banco: "",
  tipo_cuenta: "Cuenta corriente",
  numero_cuenta: "",
  moneda: "ARS",
  saldo_inicial: "",
  saldo_actual: "",
  activo: true,
};

function money(value: number) {
  return `$${value.toLocaleString("es-AR")}`;
}

function numberValue(value: string) {
  const parsed = Number(value.replace(",", ".") || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function BancosPage() {
  const { loading: authLoading, session, user } = useAuth();
  const puedeGestionar = canManageRecords(user?.rol);
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState("");
  const [form, setForm] = useState(bancoVacio);

  const cargarBancos = useCallback(async () => {
    const accessToken = session?.access_token || (await getAccessToken());

    if (!accessToken) {
      setLoading(authLoading);
      return;
    }

    setLoading(true);

    const response = await fetch("/api/bancos", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const result = (await response.json()) as {
      data?: Banco[];
      error?: string;
    };

    if (!response.ok) {
      alert(result.error || "No se pudieron cargar los bancos");
      setLoading(false);
      return;
    }

    setBancos(result.data || []);
    setLoading(false);
  }, [authLoading, session]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarBancos();
  }, [cargarBancos]);

  const resumen = useMemo(() => {
    const activos = bancos.filter((banco) => banco.activo !== false);
    const saldoArs = activos
      .filter((banco) => (banco.moneda || "ARS") === "ARS")
      .reduce((acc, banco) => acc + Number(banco.saldo_actual || 0), 0);
    const saldoUsd = activos
      .filter((banco) => (banco.moneda || "ARS") === "USD")
      .reduce((acc, banco) => acc + Number(banco.saldo_actual || 0), 0);

    return { activos: activos.length, saldoArs, saldoUsd };
  }, [bancos]);

  function updateField(
    key: keyof typeof bancoVacio,
    value: string | boolean
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function limpiarFormulario() {
    setEditandoId("");
    setForm(bancoVacio);
  }

  async function guardarBanco() {
    if (!puedeGestionar) {
      alert("Solo los socios pueden crear o editar bancos");
      return;
    }

    if (!form.nombre.trim() || !form.banco.trim()) {
      alert("Completa nombre y banco");
      return;
    }

    const saldoInicial = numberValue(form.saldo_inicial);
    const saldoActual = form.saldo_actual
      ? numberValue(form.saldo_actual)
      : saldoInicial;

    const payload = {
      id: editandoId,
      nombre: form.nombre.trim(),
      banco: form.banco.trim(),
      tipo_cuenta: form.tipo_cuenta,
      numero_cuenta: form.numero_cuenta.trim(),
      moneda: form.moneda,
      saldo_inicial: saldoInicial,
      saldo_actual: saldoActual,
      activo: form.activo,
    };

    setGuardando(true);

    const accessToken = session?.access_token || (await getAccessToken());

    if (!accessToken) {
      alert("No se encontro una sesion activa");
      setGuardando(false);
      return;
    }

    const response = await fetch("/api/bancos", {
      method: editandoId ? "PUT" : "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as { error?: string };

    setGuardando(false);

    if (!response.ok) {
      alert(result.error || "No se pudo guardar el banco");
      return;
    }

    limpiarFormulario();
    await cargarBancos();
  }

  function editarBanco(banco: Banco) {
    if (!puedeGestionar) return;

    setEditandoId(banco.id);
    setForm({
      nombre: banco.nombre || "",
      banco: banco.banco || "",
      tipo_cuenta: banco.tipo_cuenta || "Cuenta corriente",
      numero_cuenta: banco.numero_cuenta || "",
      moneda: banco.moneda || "ARS",
      saldo_inicial: String(banco.saldo_inicial || 0),
      saldo_actual: String(banco.saldo_actual || 0),
      activo: banco.activo !== false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function eliminarBanco(banco: Banco) {
    if (!puedeGestionar) return;

    const confirmado = confirm(`Eliminar banco ${banco.nombre || ""}?`);
    if (!confirmado) return;

    const accessToken = session?.access_token || (await getAccessToken());

    if (!accessToken) {
      alert("No se encontro una sesion activa");
      return;
    }

    const response = await fetch(`/api/bancos?id=${banco.id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      alert(result.error || "No se pudo eliminar el banco");
      return;
    }

    await cargarBancos();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Bancos</h1>
        <p className="text-zinc-500 mt-2">
          Cuentas bancarias de la empresa y saldos disponibles
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 bg-white">
          <p className="text-sm text-zinc-500">Bancos activos</p>
          <p className="metric-number">{resumen.activos}</p>
        </div>
        <div className="border rounded-lg p-4 bg-white">
          <p className="text-sm text-zinc-500">Saldo ARS</p>
          <p className="metric-number">{money(resumen.saldoArs)}</p>
        </div>
        <div className="border rounded-lg p-4 bg-white">
          <p className="text-sm text-zinc-500">Saldo USD</p>
          <p className="metric-number">USD {resumen.saldoUsd.toLocaleString("es-AR")}</p>
        </div>
      </div>

      {puedeGestionar && (
        <div className="border rounded-lg p-4 bg-white space-y-4">
          <h2 className="text-xl font-semibold">
            {editandoId ? "Editar banco" : "Nuevo banco"}
          </h2>
          <div className="grid grid-cols-4 gap-3">
            <input
              className="border rounded p-2"
              placeholder="Nombre interno"
              value={form.nombre}
              onChange={(event) => updateField("nombre", event.target.value)}
            />
            <input
              className="border rounded p-2"
              placeholder="Banco"
              value={form.banco}
              onChange={(event) => updateField("banco", event.target.value)}
            />
            <select
              className="border rounded p-2"
              value={form.tipo_cuenta}
              onChange={(event) => updateField("tipo_cuenta", event.target.value)}
            >
              <option>Cuenta corriente</option>
              <option>Caja de ahorro</option>
              <option>Cuenta comitente</option>
              <option>Otra</option>
            </select>
            <input
              className="border rounded p-2"
              placeholder="Numero de cuenta / CBU"
              value={form.numero_cuenta}
              onChange={(event) => updateField("numero_cuenta", event.target.value)}
            />
          </div>

          <div className="grid grid-cols-4 gap-3">
            <select
              className="border rounded p-2"
              value={form.moneda}
              onChange={(event) => updateField("moneda", event.target.value)}
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
            <input
              className="border rounded p-2"
              placeholder="Saldo inicial"
              value={form.saldo_inicial}
              onChange={(event) => updateField("saldo_inicial", event.target.value)}
            />
            <input
              className="border rounded p-2"
              placeholder="Saldo actual"
              value={form.saldo_actual}
              onChange={(event) => updateField("saldo_actual", event.target.value)}
            />
            <label className="border rounded p-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(event) => updateField("activo", event.target.checked)}
              />
              Activo
            </label>
          </div>

          <div className="flex gap-3">
            <button
              onClick={guardarBanco}
              disabled={guardando}
              className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar banco"}
            </button>
            {editandoId && (
              <button onClick={limpiarFormulario} className="border rounded px-4 py-2">
                Cancelar edicion
              </button>
            )}
          </div>
        </div>
      )}

      {loading && <p>Cargando bancos...</p>}

      <div className="border rounded-lg bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100">
            <tr>
              <th className="text-left p-3">Nombre</th>
              <th className="text-left p-3">Banco</th>
              <th className="text-left p-3">Cuenta</th>
              <th className="text-left p-3">Moneda</th>
              <th className="text-right p-3">Saldo</th>
              <th className="text-left p-3">Estado</th>
              {puedeGestionar && <th className="text-left p-3">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {bancos.map((banco) => (
              <tr key={banco.id} className="border-t">
                <td className="p-3 font-semibold">{banco.nombre || "-"}</td>
                <td className="p-3">{banco.banco || "-"}</td>
                <td className="p-3">{banco.tipo_cuenta || "-"}</td>
                <td className="p-3">{banco.moneda || "ARS"}</td>
                <td className="p-3 text-right font-semibold">
                  {money(Number(banco.saldo_actual || 0))}
                </td>
                <td className="p-3">{banco.activo === false ? "Inactivo" : "Activo"}</td>
                {puedeGestionar && (
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => editarBanco(banco)}
                        className="border rounded px-3 py-1"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => eliminarBanco(banco)}
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
