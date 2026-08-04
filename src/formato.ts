// Formatea cualquier numero como moneda con comas de miles y 2 decimales
// (ej. 99987.94 -> "$99,987.94"). Se usa en TODAS las pantallas que
// muestran un monto, para que nunca se vea "99987.94" sin comas.
export function formatoMoneda(valor: number): string {
  const numero = Number.isFinite(valor) ? valor : 0;
  return `$${numero.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
