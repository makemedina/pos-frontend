// Requiere el paquete xlsx: npm install xlsx
// Convierte un arreglo de objetos (cada objeto = una fila, cada llave =
// una columna) en un archivo .xlsx y lo descarga directamente en el
// navegador. Se usa igual en todas las pantallas de reportes.

export class SinDatosParaExportarError extends Error {}

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
