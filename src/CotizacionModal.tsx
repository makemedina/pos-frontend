import { useEffect, useState } from 'react';
import { obtenerConfiguracion, type Configuracion } from './api';
import { obtenerConfiguracionCache } from './offline';
import { CotizacionVenta } from './CotizacionVenta';
import type { DatosCotizacion } from './construirCotizacion';
import { generarImagenRecibo, generarPdfRecibo, compartirArchivo, CompartirCanceladoError } from './reciboExport';

interface Props {
  datos: DatosCotizacion;
  onCerrar: () => void;
}

const ELEMENT_ID = 'cotizacion-venta-render';

export function CotizacionModal({ datos, onCerrar }: Props) {
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [imagenBlob, setImagenBlob] = useState<Blob | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  useEffect(() => {
    obtenerConfiguracion()
      .then(setConfig)
      .catch(() => {
        const enCache = obtenerConfiguracionCache();
        if (enCache) setConfig(enCache);
        else setMensaje('No se pudo cargar la configuración de la cotización.');
      })
      .finally(() => setCargando(false));
  }, []);

  // Generar el archivo y compartirlo son DOS pasos separados a proposito
  // (mismo motivo que en ReciboModal): si se comparte justo despues de
  // generar sin una interaccion nueva de por medio, el navegador bloquea
  // el share() por no considerarlo un gesto directo del usuario.

  async function generarImagen() {
    setOcupado('imagen');
    setMensaje(null);
    try {
      setImagenBlob(await generarImagenRecibo(ELEMENT_ID));
    } catch (err: any) {
      setMensaje(err?.message || 'No se pudo generar la imagen.');
    } finally {
      setOcupado(null);
    }
  }

  async function compartirImagenLista() {
    if (!imagenBlob) return;
    try {
      await compartirArchivo(imagenBlob, `cotizacion-${datos.folio}.png`, 'image/png');
    } catch (err: any) {
      if (!(err instanceof CompartirCanceladoError)) {
        setMensaje(err?.message || 'No se pudo compartir la imagen.');
      }
    }
  }

  async function generarPdf() {
    setOcupado('pdf');
    setMensaje(null);
    try {
      setPdfBlob(await generarPdfRecibo(ELEMENT_ID));
    } catch (err: any) {
      setMensaje(err?.message || 'No se pudo generar el PDF.');
    } finally {
      setOcupado(null);
    }
  }

  async function compartirPdfListo() {
    if (!pdfBlob) return;
    try {
      await compartirArchivo(pdfBlob, `cotizacion-${datos.folio}.pdf`, 'application/pdf');
    } catch (err: any) {
      if (!(err instanceof CompartirCanceladoError)) {
        setMensaje(err?.message || 'No se pudo compartir el PDF.');
      }
    }
  }

  return (
    <div className="modal-fondo" onClick={onCerrar} style={{ zIndex: 40 }}>
      <div className="modal-contenido" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <p className="titulo">Cotización #{datos.folio}</p>
          <button className="boton-cerrar" onClick={onCerrar}>✕</button>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {cargando || !config ? (
          <p style={{ textAlign: 'center', color: '#6b7280' }}>Cargando cotización...</p>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
              <CotizacionVenta config={config} datos={datos} elementId={ELEMENT_ID} />
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              {!imagenBlob ? (
                <button className="boton-primario" disabled={!!ocupado} onClick={generarImagen}>
                  {ocupado === 'imagen' ? 'Generando...' : '🖼️ Generar imagen (WhatsApp)'}
                </button>
              ) : (
                <button className="boton-primario" onClick={compartirImagenLista}>
                  📤 Compartir imagen
                </button>
              )}

              {!pdfBlob ? (
                <button className="boton-secundario" disabled={!!ocupado} onClick={generarPdf} style={{ width: '100%', marginTop: 0 }}>
                  {ocupado === 'pdf' ? 'Generando...' : '📄 Generar PDF'}
                </button>
              ) : (
                <button className="boton-secundario" onClick={compartirPdfListo} style={{ width: '100%', marginTop: 0 }}>
                  📤 Compartir PDF
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
