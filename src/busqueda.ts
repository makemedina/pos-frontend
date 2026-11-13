// Busqueda de un solo campo para las listas: busca el texto en varios
// campos a la vez (sin importar mayusculas ni acentos) y, si lo tecleado
// es un numero, tambien en los importes.

// Sin acentos y en minusculas, para que "panaderia" encuentre "Panadería".
export function normalizarTexto(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * true si `busqueda` aparece en alguno de `textos`, o si es un numero que
 * coincide con alguno de `importes`. El importe se compara desde el inicio
 * y sin "$" ni comas: "1500", "1,500" o "$1,500.00" encuentran 1500, y
 * "150" encuentra 150 y 1500 pero no 2150. Una busqueda vacia coincide
 * con todo.
 */
export function coincideBusqueda(
  busqueda: string,
  textos: (string | number | null | undefined)[],
  importes: (number | string | null | undefined)[] = []
) {
  const q = normalizarTexto(busqueda.trim());
  if (!q) return true;
  if (textos.some((t) => t !== null && t !== undefined && normalizarTexto(String(t)).includes(q))) return true;

  const qNumero = q.replace(/[$,\s]/g, '');
  if (!qNumero || !/^\d*\.?\d*$/.test(qNumero) || qNumero === '.') return false;
  return importes.some((importe) => {
    if (importe === null || importe === undefined || importe === '') return false;
    const valor = Number(importe);
    if (!Number.isFinite(valor)) return false;
    return Math.abs(valor).toFixed(2).startsWith(qNumero);
  });
}
