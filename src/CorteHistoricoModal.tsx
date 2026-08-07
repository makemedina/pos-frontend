import { useEffect, useState } from 'react';
import { obtenerCorteDelDia, type ResumenCorteDia } from './api';
import { generarImagenRecibo, generarPdfRecibo, compartirArchivo, CompartirCanceladoError } from './reciboExport';
import { ReporteCorte } from './ReporteCorte';

interface Props {
  fecha: string; // yyyy-mm-dd
  onCerrar: () => void;
}

const ELEMENT_ID = 'corte-historico-reporte';

export function CorteHistoricoModal({ fecha, onCerrar }: Props) {
  const [resumen, setResumen] = useState<ResumenCorteDia | null>(null);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [exportando, setExportando] = useState<'imagen' | 'pdf' | null>(null);
  const [imagenBlob, setImagenBlob] = useState<Blob | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  useEffect(() => {
    setCargando(true);
    obtenerCorteDelDia(fecha)
      .then(setResumen)
      .catch((err: any) => setMensaje(err?.message || 'No se pudo cargar el corte de ese día'))
      .finally(() => setCargando(false));
  }, [fecha]);

  // Generar y compartir van separados a proposito: si se comparte justo
  // despues de generar (que tarda un momento en el celular), el
  // navegador ya no lo reconoce como accion directa del usuario.
  async function generarImagen() {
    setExportando('imagen');
    setMensaje(null);
    try {
      const blob = await generarImagenRecibo(ELEMENT_ID);
      setImagenBlob(blob);
    } catch (err: any) {
      setMensaje(err?.message || 'No se pudo generar la imagen del corte.');
    } finally {
      setExportando(null);
    }
  }

  async function compartirImagenLista() {
    if (!imagenBlob) return;
    try {
      await compartirArchivo(imagenBlob, `corte-de-caja-${fecha}.png`, 'image/png');
    } catch (err: any) {
      if (!(err instanceof CompartirCanceladoError)) {
        setMensaje(err?.message || 'No se pudo compartir la imagen.');
      }
    }
  }

  async function generarPdf() {
    setExportando('pdf');
    setMensaje(null);
    try {
      const blob = await generarPdfRecibo(ELEMENT_ID);
      setPdfBlob(blob);
    } catch (err: any) {
      setMensaje(err?.message || 'No se pudo generar el PDF del corte.');
    } finally {
      setExportando(null);
    }
  }

  async function compartirPdfListo() {
    if (!pdfBlob) return;
    try {
      await compartirArchivo(pdfBlob, `corte-de-caja-${fecha}.pdf`, 'application/pdf');
    } catch (err: any) {
      if (!(err instanceof CompartirCanceladoError)) {
        setMensaje(err?.message || 'No se pudo compartir el PDF.');
      }
    }
  }

  const fechaLegible = new Date(`${fecha}T12:00:00`).toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="modal-fondo" onClick={onCerrar} style={{ zIndex: 30, alignItems: 'center' }}>
      <div
        className="modal-contenido"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 760, maxHeight: '90vh', overflowY: 'auto', display: 'grid', gap: '1rem' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ textTransform: 'capitalize', margin: 0 }}>Corte del {fechaLegible}</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {resumen && !cargando && (
              <>
                {!imagenBlob ? (
                  <button onClick={generarImagen} disabled={!!exportando}>
                    {exportando === 'imagen' ? 'Generando...' : '🖼️ Imagen'}
                  </button>
                ) : (
                  <button onClick={compartirImagenLista}>📤 Compartir imagen</button>
                )}
                {!pdfBlob ? (
                  <button onClick={generarPdf} disabled={!!exportando}>
                    {exportando === 'pdf' ? 'Generando...' : '📄 PDF'}
                  </button>
                ) : (
                  <button onClick={compartirPdfListo}>📤 Compartir PDF</button>
                )}
              </>
            )}
            <button onClick={onCerrar}>✕</button>
          </div>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {cargando ? (
          <p>Cargando...</p>
        ) : !resumen ? null : (
          <ReporteCorte resumen={resumen} elementId={ELEMENT_ID} />
        )}
      </div>
    </div>
  );
}
