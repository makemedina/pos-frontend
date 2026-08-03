import { useEffect, useState } from 'react';
import { obtenerDetalleVenta, cancelarVenta, type VentaDetalle } from './api';
import { ReciboModal } from './ReciboModal';
import type { DatosRecibo } from './construirRecibo';

interface Props {
  ventaId: string;
  esAdmin: boolean;
  onCerrar: () => void;
  onCancelada?: () => void;
}

export function VentaDetalleModal({ ventaId, esAdmin, onCerrar, onCancelada }: Props) {
  const [venta, setVenta] = useState<VentaDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [mostrarRecibo, setMostrarRecibo] = useState(false);
  const [confirmandoCancelacion, setConfirmandoCancelacion] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => {
    obtenerDetalleVenta(ventaId)
      .then(setVenta)
      .catch(() => setMensaje('No se pudo cargar el detalle de la nota.'))
      .finally(() => setCargando(false));
  }, [ventaId]);

  async function confirmarCancelacion() {
    setCancelando(true);
    try {
      await cancelarVenta(ventaId);
      setMensaje('Venta cancelada. El stock se regresó al inventario.');
      setConfirmandoCancelacion(false);
      onCancelada?.();
      const actualizada = await obtenerDetalleVenta(ventaId);
      setVenta(actualizada);
    } catch (err: any) {
      setMensaje(err.error || 'No se pudo cancelar la venta.');
    } finally {
      setCancelando(false);
    }
  }

  const datosRecibo: DatosRecibo | null = venta
    ? {
        folio: venta.folio,
        fecha: new Date(venta.fecha).toLocaleString(),
        vendedor: venta.vendedor.nombre,
        cliente: { nombre: venta.cliente.nombre, telefono: venta.cliente.telefono },
        items: venta.items.map((it) => ({
          producto: it.producto,
          marca: it.marca,
          cantidad: it.cantidad,
          precioUnitario: it.precioUnitario,
        })),
        total: venta.total,
        metodoPago: venta.metodosPago.join(', ') || undefined,
        esCredito: venta.esCredito,
        saldoPendiente: venta.saldoPendiente,
      }
    : null;

  return (
    <div className="modal-fondo" onClick={onCerrar} style={{ zIndex: 30 }}>
      <div className="modal-contenido" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <p className="titulo">{venta ? `Venta #${venta.folio}` : 'Nota'}</p>
          <button className="boton-cerrar" onClick={onCerrar}>✕</button>
        </div>

        {mensaje && <div className="banner-mensaje">{mensaje}</div>}

        {cargando && <p style={{ textAlign: 'center', color: '#6b7280' }}>Cargando...</p>}

        {venta && (
          <>
            <div className="resumen-nota">
              <div className="linea-resumen">
                <span>Fecha</span>
                <span>{new Date(venta.fecha).toLocaleString()}</span>
              </div>
              <div className="linea-resumen">
                <span>Cliente</span>
                <span>{venta.cliente.nombre}</span>
              </div>
              <div className="linea-resumen">
                <span>Atendió</span>
                <span>{venta.vendedor.nombre}</span>
              </div>
            </div>

            <div className="resumen-nota">
              {venta.items.map((it, idx) => (
                <div key={idx} className="linea-resumen">
                  <span>{it.producto} {it.marca} · {it.cantidad} kg</span>
                  <span>${it.subtotal.toFixed(2)}</span>
                </div>
              ))}
              <div className="linea-resumen total">
                <span>Total</span>
                <span>${venta.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="linea-resumen">
              <span>Método(s) de pago</span>
              <span>{venta.metodosPago.join(', ') || 'Sin pago registrado'}</span>
            </div>
            <div className="linea-resumen">
              <span>Estado</span>
              <span className={venta.estadoPago === 'pagada' ? '' : 'texto-alerta'}>
                {venta.estadoPago === 'pagada' ? 'Pagada' : `Saldo: $${venta.saldoPendiente.toFixed(2)}`}
              </span>
            </div>

            {venta.cancelada && (
              <div className="aviso-alerta" style={{ marginTop: 8 }}>
                ❌ Esta venta fue cancelada{venta.canceladaEn ? ` el ${new Date(venta.canceladaEn).toLocaleString()}` : ''}.
                El stock ya fue regresado al inventario.
              </div>
            )}

            <button className="boton-primario" onClick={() => setMostrarRecibo(true)} style={{ marginTop: 12 }}>
              🧾 Generar recibo
            </button>

            {esAdmin && !venta.cancelada && !confirmandoCancelacion && (
              <button
                className="boton-secundario"
                onClick={() => setConfirmandoCancelacion(true)}
                style={{ width: '100%', marginTop: 8, background: '#fff2f1', color: '#b91c1c' }}
              >
                🗑️ Cancelar venta
              </button>
            )}

            {confirmandoCancelacion && (
              <div className="bloque-autorizacion" style={{ marginTop: 8 }}>
                <p className="texto-alerta" style={{ fontWeight: 600 }}>
                  ¿Seguro que quieres cancelar esta venta? El stock se regresará al inventario
                  y el saldo pendiente quedará en cero. Esta acción no se puede deshacer.
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={confirmarCancelacion} disabled={cancelando} style={{ flex: 1 }}>
                    {cancelando ? 'Cancelando...' : 'Sí, cancelar venta'}
                  </button>
                  <button onClick={() => setConfirmandoCancelacion(false)} style={{ flex: 1 }}>
                    No, regresar
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {mostrarRecibo && datosRecibo && (
        <ReciboModal datos={datosRecibo} onCerrar={() => setMostrarRecibo(false)} />
      )}
    </div>
  );
}
