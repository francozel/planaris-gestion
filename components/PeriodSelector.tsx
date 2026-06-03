"use client";

import type { PeriodView } from "@/lib/period";

type Props = {
  view: PeriodView;
  from: string;
  to: string;
  onViewChange: (value: PeriodView) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
};

export default function PeriodSelector({
  view,
  from,
  to,
  onViewChange,
  onFromChange,
  onToChange,
}: Props) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex gap-4 items-end">
        <div>
          <label className="block text-sm text-zinc-500 mb-2">Vista</label>
          <select
            value={view}
            onChange={(event) => onViewChange(event.target.value as PeriodView)}
            className="border rounded p-2"
          >
            <option value="mensual">Mensual</option>
            <option value="anual">Anual</option>
            <option value="historico">Historico</option>
            <option value="personalizado">Periodo personalizado</option>
          </select>
        </div>

        {view === "personalizado" && (
          <>
            <div>
              <label className="block text-sm text-zinc-500 mb-2">Desde</label>
              <input
                type="date"
                value={from}
                onChange={(event) => onFromChange(event.target.value)}
                className="border rounded p-2"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-500 mb-2">Hasta</label>
              <input
                type="date"
                value={to}
                onChange={(event) => onToChange(event.target.value)}
                className="border rounded p-2"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
