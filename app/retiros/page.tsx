"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import PeriodSelector from "@/components/PeriodSelector";
import { useAuth } from "@/components/AuthProvider";
import { canManageRecords } from "@/lib/permissions";
import { getAccessToken } from "@/lib/client-auth";
import { relatedUserIdentity, userIdentityLabel } from "@/lib/user-identity";
import {
  matchesPeriod,
  monthStartISO,
  todayISO,
  type PeriodView,
} from "@/lib/period";

type Usuario = {
  id: string;
  nombre: string | null;
  email: string | null;
  rol: string | null;
  activo: boolean | null;
};

type Retiro = {
  id: string;
  fecha: string;
  usuario_id: string | null;
  tipo: string | null;
  medio_pago: string | null;
  importe: number | null;
  estado: string | null;
  usuarios?:
    | { nombre?: string | null; email?: string | null }
    | { nombre?: string | null; email?: string | null }[]
    | null;
};

type RetiroEdit = {
  fecha: string;
  usuario_id: string;
  medio_pago: string;
  tipo: string;
  importe: string;
  estado: string;
};

type SocioResumen = {
  id: string;
  nombre: string | null;
  email: string;
  gastos: number;
  reintegros: number;
  retiros: number;
  saldo: number;
};

const hoy = () => new Date().toISOString().split("T")[0];

function money(value: number) {
  return `$${value.toLocaleString("es-AR")}`;
}

function nombreRelacionado(
  value: Retiro["usuarios"],
  fallback = "Sin socio"
) {
  return relatedUserIdentity(value, fallback);
}

export default function RetirosPage() {
  const { session, user } = useAuth();
  const puedeGestionar = canManageRecords(user?.rol);
  const [retiros, setRetiros] = useState<Retiro[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [resumenSocios, setResumenSocios] = useState<SocioResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");
  const [vista, setVista] = useState<PeriodView>("mensual");
  const [desde, setDesde] = useState(monthStartISO());
  const [hasta, setHasta] = useState(todayISO());
  const [socioFiltro, setSocioFiltro] = useState("");

  const [fecha, setFecha] = useState(hoy());
  const [usuarioId, setUsuarioId] = useState("");
  const [medioPago, setMedioPago] = useState("Transferencia");
  const [motivo, setMotivo] = useState("Adelanto");
  const [importe, setImporte] = useState("");
  const [editandoRetiroId, setEditandoRetiroId] = useState("");
  const [retiroEdit, setRetiroEdit] = useState<RetiroEdit>({
    fecha: hoy(),
    usuario_id: "",
    medio_pago: "Transferencia",
    tipo: "Adelanto",
    importe: "",
    estado: "Registrado",
  });

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setErrorCarga("");

    const accessToken = session?.access_token || (await getAccessToken());

    if (!accessToken) {
      setErrorCarga("No se encontro una sesion activa");
      setLoading(false);
      return;
    }

    const [retirosResponse, usuariosResponse, resumenResponse] = await Promise.all([
      fetch("/api/retiros", {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      fetch("/api/usuarios", {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      fetch("/api/socios/resumen", {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);
    const retirosResult = (await retirosResponse.json()) as {
      data?: Retiro[];
      error?: string;
    };
    const usuariosResult = (await usuariosResponse.json()) as {
      data?: Usuario[];
      error?: string;
    };
    const resumenResult = (await resumenResponse.json()) as {
      data?: SocioResumen[];
      error?: string;
    };

    if (!retirosResponse.ok || !usuariosResponse.ok || !resumenResponse.ok) {
      setErrorCarga(
        retirosResult.error ||
          usuariosResult.error ||
          resumenResult.error ||
          "No se pudieron cargar los retiros"
      );
      setLoading(false);
      return;
    }

    setRetiros(retirosResult.data || []);
    setUsuarios(
      (usuariosResult.data || []).filter(
        (usuario) => usuario.activo !== false && usuario.rol === "socio"
      )
    );
    setResumenSocios(resumenResult.data || []);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarDatos();
  }, [cargarDatos]);

  const filtrados = useMemo(() => {
    return retiros.filter((retiro) => {
      const coincidePeriodo = matchesPeriod(retiro.fecha, vista, desde, hasta);
      const coincideSocio = socioFiltro ? retiro.usuario_id === socioFiltro : true;
      return coincidePeriodo && coincideSocio;
    });
  }, [desde, hasta, retiros, socioFiltro, vista]);

  const total = filtrados.reduce(
    (acc, retiro) => acc + Number(retiro.importe || 0),
    0
  );
  const adelantos = filtrados
    .filter((retiro) => (retiro.tipo || "").toLowerCase().includes("adelanto"))
    .reduce((acc, retiro) => acc + Number(retiro.importe || 0), 0);
  const dividendos = filtrados
    .filter((retiro) => (retiro.tipo || "").toLowerCase().includes("dividendo"))
    .reduce((acc, retiro) => acc + Number(retiro.importe || 0), 0);

  async function registrarRetiro() {
    if (!puedeGestionar) return;

    const importeNumero = Number(importe.replace(",", ".") || 0);

    if (!usuarioId || importeNumero <= 0) {
      alert("Selecciona socio e importe");
      return;
    }

    const accessToken = session?.access_token || (await getAccessToken());

    if (!accessToken) {
      alert("No se encontro una sesion activa");
      return;
    }

    setGuardando(true);
    const response = await fetch("/api/retiros", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fecha,
        usuario_id: usuarioId,
        medio_pago: medioPago,
        tipo: motivo,
        importe: importeNumero,
      }),
    });
    const result = (await response.json()) as { error?: string };
    setGuardando(false);

    if (!response.ok) {
      alert(result.error || "No se pudo registrar el retiro");
      return;
    }

    setFecha(hoy());
    setUsuarioId("");
    setMedioPago("Transferencia");
    setMotivo("Adelanto");
    setImporte("");
    await cargarDatos();
  }

  async function eliminarRetiro(retiro: Retiro) {
    if (!puedeGestionar) return;

    const confirmado = confirm(
      `Eliminar retiro de ${nombreRelacionado(retiro.usuarios, "socio")}?`
    );

    if (!confirmado) return;

    const accessToken = session?.access_token || (await getAccessToken());

    if (!accessToken) {
      alert("No se encontro una sesion activa");
      return;
    }

    const response = await fetch(`/api/retiros?id=${retiro.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      alert(result.error || "No se pudo eliminar el retiro");
      return;
    }

    await cargarDatos();
  }

  function editarRetiro(retiro: Retiro) {
    if (!puedeGestionar) return;

    setEditandoRetiroId(retiro.id);
    setRetiroEdit({
      fecha: retiro.fecha || hoy(),
      usuario_id: retiro.usuario_id || "",
      medio_pago: retiro.medio_pago || "Transferencia",
      tipo: retiro.tipo || "Adelanto",
      importe: String(retiro.importe || ""),
      estado: retiro.estado || "Registrado",
    });
  }

  function updateRetiroEdit(key: keyof RetiroEdit, value: string) {
    setRetiroEdit((current) => ({ ...current, [key]: value }));
  }

  async function guardarEdicionRetiro(retiro: Retiro) {
    if (!puedeGestionar || !editandoRetiroId) return;

    const accessToken = session?.access_token || (await getAccessToken());

    if (!accessToken) {
      alert("No se encontro una sesion activa");
      return;
    }

    const response = await fetch("/api/retiros", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: retiro.id,
        fecha: retiroEdit.fecha,
        usuario_id: retiroEdit.usuario_id,
        medio_pago: retiroEdit.medio_pago,
        tipo: retiroEdit.tipo,
        importe: Number(retiroEdit.importe.replace(",", ".") || 0),
        estado: retiroEdit.estado,
      }),
    });
    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      alert(result.error || "No se pudo editar el retiro");
      return;
    }

    setEditandoRetiroId("");
    await cargarDatos();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Socios</h1>
        <p className="text-zinc-500 mt-2">
          Saldos, gastos, reintegros y retiros de socios
        </p>
      </div>

      <PeriodSelector
        view={vista}
        from={desde}
        to={hasta}
        onViewChange={setVista}
        onFromChange={setDesde}
        onToChange={setHasta}
      />

      <div className="grid grid-cols-4 gap-4">
        <div className="border rounded-lg p-4 bg-white">
          <div className="text-sm text-gray-500">Total retiros</div>
          <div className="metric-number">{money(total)}</div>
        </div>
        <div className="border rounded-lg p-4 bg-white">
          <div className="text-sm text-gray-500">Adelantos</div>
          <div className="metric-number">{money(adelantos)}</div>
        </div>
        <div className="border rounded-lg p-4 bg-white">
          <div className="text-sm text-gray-500">Dividendos</div>
          <div className="metric-number">{money(dividendos)}</div>
        </div>
        <div className="border rounded-lg p-4 bg-white">
          <div className="text-sm text-gray-500">Cantidad</div>
          <div className="metric-number">{filtrados.length}</div>
        </div>
      </div>

      <div className="border rounded-lg bg-white overflow-x-auto">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">Saldos por socio</h2>
        </div>
        <table className="w-full min-w-[760px]">
          <thead className="bg-zinc-100 text-left">
            <tr>
              <th className="p-3">Socio</th>
              <th className="p-3 text-right">Gastos asociados</th>
              <th className="p-3 text-right">Reintegros</th>
              <th className="p-3 text-right">Retiros</th>
              <th className="p-3 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {resumenSocios.map((socio) => (
              <tr key={socio.id} className="border-t">
                <td className="p-3">
                  <strong>{socio.email}</strong>
                  <p className="text-sm text-zinc-500">{socio.nombre}</p>
                </td>
                <td className="p-3 text-right">{money(socio.gastos)}</td>
                <td className="p-3 text-right">{money(socio.reintegros)}</td>
                <td className="p-3 text-right">{money(socio.retiros)}</td>
                <td
                  className={`p-3 text-right font-bold ${
                    socio.saldo >= 0 ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {money(socio.saldo)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {puedeGestionar && (
        <div className="border rounded-lg p-4 bg-white space-y-4">
          <h2 className="text-xl font-semibold">Registrar retiro</h2>
          <div className="grid grid-cols-5 gap-3">
            <input
              className="border rounded p-2"
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
            />
            <select
              className="border rounded p-2"
              value={usuarioId}
              onChange={(event) => setUsuarioId(event.target.value)}
            >
              <option value="">Socio</option>
              {usuarios.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {userIdentityLabel(usuario, "Socio")}
                </option>
              ))}
            </select>
            <select
              className="border rounded p-2"
              value={medioPago}
              onChange={(event) => setMedioPago(event.target.value)}
            >
              <option>Transferencia</option>
              <option>Efectivo</option>
              <option>Cheque</option>
              <option>Cheque de tercero</option>
            </select>
            <select
              className="border rounded p-2"
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
            >
              <option>Adelanto</option>
              <option>Dividendos</option>
            </select>
            <input
              className="border rounded p-2"
              placeholder="Importe"
              value={importe}
              onChange={(event) => setImporte(event.target.value)}
            />
          </div>
          <button
            onClick={registrarRetiro}
            disabled={guardando}
            className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
          >
            {guardando ? "Registrando..." : "Registrar retiro"}
          </button>
        </div>
      )}

      <div className="border rounded-lg p-4 bg-white">
        <div className="flex justify-between gap-4 mb-4">
          <h2 className="text-xl font-semibold">Historial de retiros</h2>
          <select
            className="border rounded p-2 w-72"
            value={socioFiltro}
            onChange={(event) => setSocioFiltro(event.target.value)}
          >
            <option value="">Todos los socios</option>
            {usuarios.map((usuario) => (
              <option key={usuario.id} value={usuario.id}>
                {userIdentityLabel(usuario, "Socio")}
              </option>
            ))}
          </select>
        </div>

        {loading && <p>Cargando retiros...</p>}
        {errorCarga && <p className="text-sm text-red-600">{errorCarga}</p>}

        {!loading && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Fecha</th>
                <th className="py-2">Socio</th>
                <th className="py-2">Motivo</th>
                <th className="py-2">Medio</th>
                <th className="py-2 text-right">Importe</th>
                <th className="py-2">Estado</th>
                {puedeGestionar && <th className="py-2">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((retiro) => (
                <Fragment key={retiro.id}>
                  <tr className="border-b">
                    <td className="py-2">{retiro.fecha}</td>
                    <td className="py-2">
                      {nombreRelacionado(retiro.usuarios)}
                    </td>
                    <td className="py-2">{retiro.tipo || "-"}</td>
                    <td className="py-2">{retiro.medio_pago || "-"}</td>
                    <td className="py-2 text-right font-semibold">
                      {money(Number(retiro.importe || 0))}
                    </td>
                    <td className="py-2">{retiro.estado || "Registrado"}</td>
                    {puedeGestionar && (
                      <td className="py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => editarRetiro(retiro)}
                            className="border rounded px-3 py-1"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => eliminarRetiro(retiro)}
                            className="border rounded px-3 py-1 text-red-600"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                  {puedeGestionar && editandoRetiroId === retiro.id && (
                    <tr className="border-b bg-zinc-50">
                      <td colSpan={7} className="py-3">
                        <div className="grid grid-cols-6 gap-3">
                          <input
                            className="border rounded p-2"
                            type="date"
                            value={retiroEdit.fecha}
                            onChange={(event) =>
                              updateRetiroEdit("fecha", event.target.value)
                            }
                          />
                          <select
                            className="border rounded p-2"
                            value={retiroEdit.usuario_id}
                            onChange={(event) =>
                              updateRetiroEdit("usuario_id", event.target.value)
                            }
                          >
                            <option value="">Socio</option>
                            {usuarios.map((usuario) => (
                              <option key={usuario.id} value={usuario.id}>
                                {userIdentityLabel(usuario, "Socio")}
                              </option>
                            ))}
                          </select>
                          <select
                            className="border rounded p-2"
                            value={retiroEdit.medio_pago}
                            onChange={(event) =>
                              updateRetiroEdit("medio_pago", event.target.value)
                            }
                          >
                            <option>Transferencia</option>
                            <option>Efectivo</option>
                            <option>Cheque</option>
                            <option>Cheque de tercero</option>
                          </select>
                          <select
                            className="border rounded p-2"
                            value={retiroEdit.tipo}
                            onChange={(event) =>
                              updateRetiroEdit("tipo", event.target.value)
                            }
                          >
                            <option>Adelanto</option>
                            <option>Dividendos</option>
                          </select>
                          <input
                            className="border rounded p-2"
                            placeholder="Importe"
                            value={retiroEdit.importe}
                            onChange={(event) =>
                              updateRetiroEdit("importe", event.target.value)
                            }
                          />
                          <select
                            className="border rounded p-2"
                            value={retiroEdit.estado}
                            onChange={(event) =>
                              updateRetiroEdit("estado", event.target.value)
                            }
                          >
                            <option>Registrado</option>
                            <option>Anulado</option>
                          </select>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => guardarEdicionRetiro(retiro)}
                            className="bg-black text-white rounded px-3 py-1"
                          >
                            Guardar cambios
                          </button>
                          <button
                            onClick={() => setEditandoRetiroId("")}
                            className="border rounded px-3 py-1"
                          >
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
