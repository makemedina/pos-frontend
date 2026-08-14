// Formatea cualquier numero como moneda con comas de miles y 2 decimales
// (ej. 99987.94 -> "$99,987.94"). Se usa en TODAS las pantallas que
// muestran un monto, para que nunca se vea "99987.94" sin comas.
// Acepta undefined/null (por ejemplo cuando el dato todavia no existe) y
// simplemente muestra $0.00 en ese caso, en vez de romper.
export function formatoMoneda(valor: number | null | undefined): string {
  const numero = typeof valor === 'number' && Number.isFinite(valor) ? valor : 0;
  const signo = numero < 0 ? '-' : '';
  return `${signo}$${Math.abs(numero).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Formatea una cantidad en kg respetando hasta 3 decimales (la precision
// real que se guarda en la base de datos), sin ceros de mas al final
// (3 -> "3", 3.5 -> "3.5", 3.456 -> "3.456"). Antes varias pantallas
// usaban .toFixed(1) para mostrar el peso, lo que hacia parecer que el
// sistema redondeaba lo capturado aunque el dato guardado fuera exacto.
export function formatoKg(cantidad: number | null | undefined): string {
  const numero = typeof cantidad === 'number' && Number.isFinite(cantidad) ? cantidad : 0;
  return (Math.round(numero * 1000) / 1000).toString();
}

// El backend guarda "saldo_favor" tal cual (es el valor que espera la
// logica de pagos) -- esto solo lo traduce a texto legible dondequiera
// que se muestre un metodo de pago en pantalla o en un recibo.
const ETIQUETAS_METODO_PAGO: Record<string, string> = {
  saldo_favor: 'saldo a favor',
};

export function etiquetaMetodoPago(metodoPago: string): string {
  return ETIQUETAS_METODO_PAGO[metodoPago] ?? metodoPago;
}
