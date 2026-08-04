import { useEffect, useState } from 'react';
import { obtenerConfiguracion, type Configuracion } from './api';
import { obtenerConfiguracionCache } from './offline';
import { ReciboVenta } from './ReciboVenta';
import { construirLineasRecibo, type DatosRecibo } from './construirRecibo';
import { generarImagenRecibo, generarPdfRecibo, compartirArchivo, CompartirCanceladoError } from './reciboExport';
import {
  impresoraConectada,
  nombreImpresoraConectada,
  conectarImpresora,
  imprimirLineas,
} from './impresionBluetooth';

interface Props {
  datos: DatosRecibo;
  onCerrar: () => void;
}

const ELEMENT_ID = 'recibo-venta-render';

export function ReciboModal({ datos, onCerrar }: Props) {
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
        // Sin conexion: se usa la configuracion guardada la ultima vez que hubo internet.
        const enCache = obtenerConfiguracionCache();
        if (enCache) {
          setConfig(enCache);
        } else {
          setMensaje('No se pudo cargar la configuración del recibo.');
        }
      })
      .finally(() => setCargando(false));
  }, []);

  // Generar el archivo y compartirlo son DOS pasos separados a proposito:
  // en el celular, generar la imagen con html2canvas toma un momento, y
  // si se llama a compartir() justo despues (dentro del mismo async), el
  // navegador ya no lo reconoce como una accion directa del usuario y lo
  // bloquea ("The request is not allowed..."). Por eso el boton de
  // compartir solo aparece DESPUES de que el archivo ya esta listo -- ese
  // click es una accion nueva y directa, sin ningun await antes.

  async function generarImagen() {
    setOcupado('imagen');
    setMensaje(null);
    try {
      const blob = await generarImagenRecibo(ELEMENT_ID);
      setImagenBlob(blob);
    } catch (err: any) {
      setMensaje(err?.message || 'No se pudo generar la imagen.');
    } finally {
      setOcupado(null);
    }
  }

  async function compartirImagenLista() {
    if (!imagenBlob) return;
    try {
      await compartirArchivo(imagenBlob, `recibo-${datos.folio}.png`, 'image/png');
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
      const blob = await generarPdfRecibo(ELEMENT_ID);
      setPdfBlob(blob);
    } catch (err: any) {
      setMensaje(err?.message || 'No se pudo generar el PDF.');
    } finally {
      setOcupado(null);
    }
  }

  async function compartirPdfListo() {
    if (!pdfBlob) return;
    try {
      await compartirArchivo(pdfBlob, `recibo-${datos.folio}.pdf`, 'application/pdf');
    } catch (err: any) {
      if (!(err instanceof CompartirCanceladoError)) {
        setMensaje(err?.message || 'No se pudo compartir el PDF.');
      }
    }
  }

  async function imprimir() {
    if (!config) return;
    setOcupado('imprimir');
    setMensaje(null);
    try {
      if (!impresoraConectada()) {
        await conectarImpresora();
      }
      const lineas = construirLineasRecibo(config, datos);
      const veces = config.imprimirDosVeces ? 2 : 1;
      await imprimirLineas(lineas, veces);
      setMensaje('Recibo enviado a la impresora.');
    } catch (err: any) {
      setMensaje(err.message || 'No se pudo imprimir. Revisa que la impresora esté prendida y cerca.');
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="modal-fondo" onClick={onCerrar} style={{ zIndex: 40 }}>
      <div className="modal-contenido" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <p className="titulo">Venta registrada</p>
          <button className="boton-cerrar" onClick={onCerrar}>✕</button>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {cargando || !config ? (
          <p style={{ textAlign: 'center', color: '#6b7280' }}>Cargando recibo...</p>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
              <ReciboVenta config={config} datos={datos} elementId={ELEMENT_ID} />
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

              <button className="boton-secundario" disabled={!!ocupado} onClick={imprimir} style={{ width: '100%', marginTop: 0 }}>
                {ocupado === 'imprimir'
                  ? 'Imprimiendo...'
                  : impresoraConectada()
                    ? `🖨️ Imprimir (${nombreImpresoraConectada()})`
                    : '🖨️ Conectar e imprimir'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
