import { useEffect, useState } from 'react';
import { obtenerConfiguracion, type Configuracion } from './api';
import { obtenerConfiguracionCache } from './offline';
import { formatoMoneda } from './formato';
import { generarImagenRecibo, generarPdfRecibo, compartirArchivo, CompartirCanceladoError } from './reciboExport';

export interface DatosComprobantePago {
  folioNota: number | string;
  clienteNombre: string;
  clienteTelefono?: string;
  monto: number;
  metodoPago: string;
  fecha: string;
  saldoNotaRestante: number;
  saldoTotalCliente: number;
}

interface Props {
  datos: DatosComprobantePago;
  onCerrar: () => void;
}

const ELEMENT_ID = 'comprobante-pago-render';

export function ComprobantePagoModal({ datos, onCerrar }: Props) {
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [imagenBlob, setImagenBlob] = useState<Blob | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  useEffect(() => {
    obtenerConfiguracion()
      .then(setConfig)
      .catch(() => {
        const enCache = obtenerConfiguracionCache();
        if (enCache) setConfig(enCache);
        else setMensaje('No se pudo cargar la configuración del comprobante.');
      })
      .finally(() => setCargando(false));
  }, []);

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
      await compartirArchivo(imagenBlob, `abono-${datos.folioNota}.png`, 'image/png');
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
      await compartirArchivo(pdfBlob, `abono-${datos.folioNota}.pdf`, 'application/pdf');
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
          <p className="titulo">Comprobante de pago</p>
          <button className="boton-cerrar" onClick={onCerrar}>✕</button>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {cargando || !config ? (
          <p style={{ textAlign: 'center', color: '#6b7280' }}>Cargando comprobante...</p>
        ) : (
          <>
            <div
              id={ELEMENT_ID}
              style={{
                width: 320,
                background: 'white',
                padding: 18,
                fontFamily: 'ui-monospace, Menlo, monospace',
                color: '#111',
                fontSize: 13,
                lineHeight: 1.5,
                margin: '0 auto 16px',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
              }}
            >
              {config.logoBase64 && (
                <img
                  src={config.logoBase64}
                  alt="Logo"
                  style={{ maxWidth: '100%', maxHeight: 90, display: 'block', margin: '0 auto 10px' }}
                />
              )}
              <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 16 }}>
                {config.nombreNegocio || 'Mi negocio'}
              </div>
              {config.telefono && <div style={{ textAlign: 'center' }}>{config.telefono}</div>}
              {config.direccion && <div style={{ textAlign: 'center' }}>{config.direccion}</div>}

              <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px dashed #999' }} />

              <div style={{ textAlign: 'center', fontWeight: 700 }}>COMPROBANTE DE PAGO</div>
              <div>Nota #{datos.folioNota}</div>
              <div>{datos.fecha}</div>

              <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px dashed #999' }} />
              <div>Cliente: {datos.clienteNombre}</div>
              {datos.clienteTelefono && <div>Tel: {datos.clienteTelefono}</div>}

              <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px dashed #999' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16 }}>
                <span>MONTO ABONADO</span>
                <span>{formatoMoneda(datos.monto)}</span>
              </div>
              <div style={{ marginTop: 4 }}>Método de pago: {datos.metodoPago}</div>

              <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px dashed #999' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Saldo restante de esta nota</span>
                <span>{formatoMoneda(datos.saldoNotaRestante)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 4 }}>
                <span>Saldo total del cliente</span>
                <span>{formatoMoneda(datos.saldoTotalCliente)}</span>
              </div>

              {config.piePaginaRecibo && (
                <div style={{ textAlign: 'center', marginTop: 12 }}>{config.piePaginaRecibo}</div>
              )}
              <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: '#6b7280' }}>
                Gracias por su pago
              </div>
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
