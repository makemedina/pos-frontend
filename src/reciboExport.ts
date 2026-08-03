// Requiere las dependencias html2canvas y jspdf en el proyecto:
//   npm install html2canvas jspdf
// Se importan de forma dinamica para no obligar a cargarlas si nunca
// se usa esta pantalla.

export async function generarImagenRecibo(elementId: string): Promise<Blob> {
  const { default: html2canvas } = await import('html2canvas');
  const el = document.getElementById(elementId);
  if (!el) throw new Error('No se encontro el recibo para generar la imagen');

  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('No se pudo generar la imagen'));
    }, 'image/png');
  });
}

export async function generarPdfRecibo(elementId: string): Promise<Blob> {
  const { default: html2canvas } = await import('html2canvas');
  const { jsPDF } = await import('jspdf');
  const el = document.getElementById(elementId);
  if (!el) throw new Error('No se encontro el recibo para generar el PDF');

  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
  const imgData = canvas.toDataURL('image/png');
  const anchoPdf = canvas.width / 2;
  const altoPdf = canvas.height / 2;
  const pdf = new jsPDF({ unit: 'px', format: [anchoPdf, altoPdf] });
  pdf.addImage(imgData, 'PNG', 0, 0, anchoPdf, altoPdf);
  return pdf.output('blob');
}

/**
 * Comparte un archivo (imagen o PDF) usando el Web Share API -- en
 * Android Chrome esto abre el menu nativo de compartir, donde
 * WhatsApp aparece como una opcion mas. Si el navegador no soporta
 * compartir archivos, cae de vuelta a una descarga normal.
 */
export async function compartirArchivo(blob: Blob, nombreArchivo: string, tipoMime: string) {
  const file = new File([blob], nombreArchivo, { type: tipoMime });
  const nav = navigator as any;

  if (nav.canShare && nav.canShare({ files: [file] })) {
    await nav.share({ files: [file], title: 'Recibo de venta' });
    return;
  }

  // Fallback: descargar el archivo directamente
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}
