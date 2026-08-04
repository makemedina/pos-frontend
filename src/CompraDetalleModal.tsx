import { useEffect, useState } from 'react';
import { formatoMoneda } from './formato';
import { obtenerDetalleCompra, cancelarCompra, type CompraDetalle } from './api';
import { generarImagenRecibo, generarPdfRecibo, compartirArchivo, CompartirCanceladoError } from './reciboExport';

interface Props {
  compraId: string;
  onCerrar: () => void;
  onCancelada?: () => void;
}

const ELEMENT_ID = 'compra-recibo-render';

export function CompraDetalleModal({ compraId, onCerrar, onCancelada }: Props) {
  const [compra, setCompra] = useState<CompraDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [exportando, setExportando] = useState<'imagen' | 'pdf' | null>(null);
  const [imagenBlob, setImagenBlob] = useState<Blob | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [confirmandoCancelacion, setConfirmandoCancelacion] = useState(false);
  const [necesitaAutorizacion, setNecesitaAutorizacion] = useState(false);
  const [autorizadoPorTelefono, setAutorizadoPorTelefono] = useState('');
  const [autorizadoPin, setAutorizadoPin] = useState('');
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => {
    obtenerDetalleCompra(compraId)
      .then(setCompra)
      .catch(() => setMensaje('No se pudo cargar el detalle de la compra.'))
      .finally(() => setCargando(false));
  }, [compraId]);

  // Generar y compartir van separados a proposito: en el celular, si se
  // llama a compartir() justo despues de generar la imagen (que tarda un
  // momento), el navegador ya no lo reconoce como accion directa del
  // usuario y lo bloquea.
  async function generarImagen() {
    setExportando('imagen');
    try {
      const blob = await generarImagenRecibo(ELEMENT_ID);
      setImagenBlob(blob);
    } catch (err: any) {
      setMensaje(err?.message || 'No se pudo generar la imagen.');
    } finally {
      setExportando(null);
    }
  }

  async function compartirImagenLista() {
    if (!imagenBlob) return;
    try {
      await compartirArchivo(imagenBlob, `compra-${compra?.numeroFactura || compraId}.png`, 'image/png');
    } catch (err: any) {
      if (!(err instanceof CompartirCanceladoError)) {
        setMensaje(err?.message || 'No se pudo compartir la imagen.');
      }
    }
  }

  async function generarPdf() {
    setExportando('pdf');
    try {
      const blob = await generarPdfRecibo(ELEMENT_ID);
      setPdfBlob(blob);
    } catch (err: any) {
      setMensaje(err?.message || 'No se pudo generar el PDF.');
    } finally {
      setExportando(null);
    }
  }

  async function compartirPdfListo() {
    if (!pdfBlob) return;
    try {
      await compartirArchivo(pdfBlob, `compra-${compra?.numeroFactura || compraId}.pdf`, 'application/pdf');
    } catch (err: any) {
      if (!(err instanceof CompartirCanceladoError)) {
        setMensaje(err?.message || 'No se pudo compartir el PDF.');
      }
    }
  }

  async function confirmarCancelacion() {
    setCancelando(true);
    try {
      await cancelarCompra(
        compraId,
        necesitaAutorizacion ? { telefono: autorizadoPorTelefono, pin: autorizadoPin } : undefined
      );
      setMensaje('Compra cancelada. El inventario de esa mercancía se puso en cero.');
      setConfirmandoCancelacion(false);
      setNecesitaAutorizacion(false);
      onCancelada?.();
      const actualizada = await obtenerDetalleCompra(compraId);
      setCompra(actualizada);
    } catch (err: any) {
      if (err.code === 'REQUIERE_AUTORIZACION') {
        setNecesitaAutorizacion(true);
        setMensaje('Esta compra es de un día anterior: se necesita el teléfono y PIN de un administrador para cancelarla.');
      } else {
        setMensaje(err.error || 'No se pudo cancelar la compra.');
      }
    } finally {
      setCancelando(false);
    }
  }

  return (
    <div className="modal-fondo" onClick={onCerrar} style={{ zIndex: 30 }}>
      <div className="modal-contenido" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <p className="titulo">{compra ? `Compra a ${compra.proveedor.nombre}` : 'Compra'}</p>
          <button className="boton-cerrar" onClick={onCerrar}>✕</button>
        </div>

        {mensaje && <div className="banner-mensaje">{mensaje}</div>}
        {cargando && <p style={{ textAlign: 'center', color: '#6b7280' }}>Cargando...</p>}

        {compra && (
          <div id={ELEMENT_ID}>
            <div className="resumen-nota">
              <div className="linea-resumen">
                <span>Fecha</span>
                <span>{new Date(compra.fecha).toLocaleString()}</span>
              </div>
              <div className="linea-resumen">
                <span>Factura</span>
                <span>{compra.numeroFactura || 'Sin factura'}</span>
              </div>
              <div className="linea-resumen">
                <span>Proveedor</span>
                <span>{compra.proveedor.nombre}</span>
              </div>
            </div>

            <div className="resumen-nota">
              {compra.items.map((it, idx) => (
                <div key={idx} className="linea-resumen">
                  <span>{it.producto} {it.marca} · {it.cantidad} kg</span>
                  <span>{formatoMoneda(it.subtotal)}</span>
                </div>
              ))}
              <div className="linea-resumen total">
                <span>Total</span>
                <span>{formatoMoneda(compra.total)}</span>
              </div>
            </div>

            <div className="linea-resumen">
              <span>Método(s) de pago</span>
              <span>{compra.metodosPago.join(', ') || 'Sin pago registrado'}</span>
            </div>
            <div className="linea-resumen">
              <span>Estado</span>
              <span className={compra.estadoPago === 'pagada' ? '' : 'texto-alerta'}>
                {compra.estadoPago === 'pagada' ? 'Pagada' : `Saldo: ${formatoMoneda(compra.saldoPendiente)}`}
              </span>
            </div>

            {compra.cancelada && (
              <div className="aviso-alerta" style={{ marginTop: 8 }}>
                ❌ Esta compra fue cancelada{compra.canceladaEn ? ` el ${new Date(compra.canceladaEn).toLocaleString()}` : ''}.
                El inventario que había agregado ya se puso en cero.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {!imagenBlob ? (
                <button onClick={generarImagen} disabled={!!exportando} style={{ flex: 1 }}>
                  {exportando === 'imagen' ? 'Generando...' : '🖼️ Generar imagen'}
                </button>
              ) : (
                <button onClick={compartirImagenLista} style={{ flex: 1 }}>📤 Compartir imagen</button>
              )}
              {!pdfBlob ? (
                <button onClick={generarPdf} disabled={!!exportando} style={{ flex: 1 }}>
                  {exportando === 'pdf' ? 'Generando...' : '📄 Generar PDF'}
                </button>
              ) : (
                <button onClick={compartirPdfListo} style={{ flex: 1 }}>📤 Compartir PDF</button>
              )}
            </div>

            {!compra.cancelada && !confirmandoCancelacion && (
              <button
                className="boton-secundario"
                onClick={() => setConfirmandoCancelacion(true)}
                style={{ width: '100%', marginTop: 8, background: '#fff2f1', color: '#b91c1c' }}
              >
                🗑️ Cancelar compra
              </button>
            )}

            {confirmandoCancelacion && (
              <div className="bloque-autorizacion" style={{ marginTop: 8 }}>
                <p className="texto-alerta" style={{ fontWeight: 600 }}>
                  ¿Seguro que quieres cancelar esta compra? Solo se puede si nada de esa
                  mercancía se ha vendido todavía. Esta acción no se puede deshacer.
                </p>

                {necesitaAutorizacion && (
                  <>
                    <input
                      placeholder="Teléfono del administrador"
                      value={autorizadoPorTelefono}
                      onChange={(e) => setAutorizadoPorTelefono(e.target.value)}
                    />
                    <input
                      placeholder="PIN"
                      type="password"
                      value={autorizadoPin}
                      onChange={(e) => setAutorizadoPin(e.target.value)}
                    />
                  </>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={confirmarCancelacion} disabled={cancelando} style={{ flex: 1 }}>
                    {cancelando ? 'Cancelando...' : 'Sí, cancelar compra'}
                  </button>
                  <button
                    onClick={() => {
                      setConfirmandoCancelacion(false);
                      setNecesitaAutorizacion(false);
                    }}
                    style={{ flex: 1 }}
                  >
                    No, regresar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
