import { supabase } from "@/lib/supabase";
import GastoForm from "@/components/gastos/GastoForm";
import GastosResumen from "@/components/gastos/GastosResumen";
import GastosHistorial from "@/components/gastos/GastosHistorial";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GastosPage() {
  const { data: gastos } = await supabase
    .from("gastos")
    .select(`
      *,
      usuarios (
        nombre,
        email
      )
    `)
    .order("fecha", {
      ascending: false,
    });

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-4xl font-bold">Gastos</h1>

        <p className="text-zinc-500 mt-2">
          Rendiciones y gastos realizados por socios o usuarios
        </p>
      </div>

      <GastosResumen gastos={gastos || []} />
      <GastoForm />
      <GastosHistorial gastos={gastos || []} />
    </div>
  );
}
