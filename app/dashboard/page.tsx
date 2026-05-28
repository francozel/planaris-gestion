function Card({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <p className="text-zinc-500 mb-2">
        {title}
      </p>

      <h2 className="text-3xl font-bold text-zinc-900">
        {value}
      </h2>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-zinc-900">
          Dashboard
        </h1>

        <p className="text-zinc-500 mt-2">
          Resumen general del negocio
        </p>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-10">
        <Card title="Ventas" value="$ 12.500.000" />
        <Card title="Compras" value="$ 8.200.000" />
        <Card title="Gastos" value="$ 1.350.000" />
        <Card title="Ganancia" value="$ 2.950.000" />
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="text-2xl font-bold mb-4">
          Actividad reciente
        </h2>

        <div className="space-y-4">
          <div className="border rounded-xl p-4">
            Nuevo gasto cargado
          </div>

          <div className="border rounded-xl p-4">
            Nueva venta registrada
          </div>

          <div className="border rounded-xl p-4">
            Retiro realizado por socio
          </div>
        </div>
      </div>
    </div>
  );
}