// Requiere el paquete xlsx: npm install xlsx
// Convierte un arreglo de objetos (cada objeto = una fila, cada llave =
// una columna) en un archivo .xlsx y lo descarga directamente en el
// navegador. Se usa igual en todas las pantallas de reportes.

export class SinDatosParaExportarError extends Error {}

/** Numero de semana ISO 8601 (1-53), la misma convencion usada en los calendarios. */
export function numeroSemana(fecha: Date): number {
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const diaSemana = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - diaSemana);
  const inicioAnio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - inicioAnio.getTime()) / 86400000 + 1) / 7);
}

export async function exportarAExcel(
  filas: Record<string, any>[],
  nombreArchivo: string,
  nombreHoja = 'Reporte'
) {
  if (!filas || filas.length === 0) {
    throw new SinDatosParaExportarError('No hay datos para exportar con los filtros actuales.');
  }

  const XLSX = await import('xlsx');
  const hoja = XLSX.utils.json_to_sheet(filas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);

  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(libro, `${nombreArchivo}-${fecha}.xlsx`);
}

/** Igual que exportarAExcel, pero permite varias hojas en el mismo archivo (ej. resumen + detalle). */
export async function exportarVariasHojas(
  hojas: { nombre: string; filas: Record<string, any>[] }[],
  nombreArchivo: string
) {
  const conDatos = hojas.filter((h) => h.filas.length > 0);
  if (conDatos.length === 0) {
    throw new SinDatosParaExportarError('No hay datos para exportar con los filtros actuales.');
  }

  const XLSX = await import('xlsx');
  const libro = XLSX.utils.book_new();
  for (const h of conDatos) {
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(h.filas), h.nombre.slice(0, 31));
  }

  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(libro, `${nombreArchivo}-${fecha}.xlsx`);
}
