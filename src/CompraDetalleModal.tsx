import { useEffect, useState } from 'react';
import { obtenerDetalleCompra, type CompraDetalle } from './api';

interface Props {
  compraId: string;
  onCerrar: () => void;
}

export function CompraDetalleModal({ compraId, onCerrar }: Props) {
  const [compra, setCompra] = useState<CompraDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    obtenerDetalleCompra(compraId)
      .then(setCompra)
      .catch(() => setMensaje('No se pudo cargar el detalle de la compra.'))
      .finally(() => setCargando(false));
  }, [compraId]);

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
          <>
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
                  <span>${it.subtotal.toFixed(2)}</span>
                </div>
              ))}
              <div className="linea-resumen total">
                <span>Total</span>
                <span>${compra.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="linea-resumen">
              <span>Método(s) de pago</span>
              <span>{compra.metodosPago.join(', ') || 'Sin pago registrado'}</span>
            </div>
            <div className="linea-resumen">
              <span>Estado</span>
              <span className={compra.estadoPago === 'pagada' ? '' : 'texto-alerta'}>
                {compra.estadoPago === 'pagada' ? 'Pagada' : `Saldo: $${compra.saldoPendiente.toFixed(2)}`}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
