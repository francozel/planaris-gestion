export function isCreditNote(tipoComprobante: string | null | undefined) {
  const normalized = (tipoComprobante || "")
    .toLowerCase()
    .replaceAll("é", "e")
    .replaceAll("É", "e");

  return normalized.includes("nota de credito");
}

export function signedAmount(
  tipoComprobante: string | null | undefined,
  value: number
) {
  const amount = Math.abs(value);

  return isCreditNote(tipoComprobante) ? -amount : amount;
}
