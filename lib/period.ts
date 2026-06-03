export type PeriodView = "mensual" | "anual" | "historico" | "personalizado";

export function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export function monthStartISO() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
    2,
    "0"
  )}-01`;
}

export function matchesPeriod(
  value: string | null | undefined,
  view: PeriodView,
  from: string,
  to: string
) {
  if (view === "historico") return true;
  if (!value) return false;

  const date = new Date(`${value}T00:00:00`);
  const today = new Date();

  if (view === "mensual") {
    return (
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  if (view === "anual") {
    return date.getFullYear() === today.getFullYear();
  }

  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T23:59:59`);

  return date >= fromDate && date <= toDate;
}
