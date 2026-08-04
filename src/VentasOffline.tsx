import { useState } from 'react';
import { formatoMoneda } from './formato';
import {
  obtenerVentasPendientes,
  quitarVentaDeCola,
  reintentarVenta,
  sincronizarVentasPendientes,
  type VentaPendiente,
} from './offline';

interface Props {
  onCerrar: () => void;
  onCambio: () => void;
}

export function VentasOffline({ onCerrar, onCambio }: Props) {
  const [ventas, setVentas] = useState<VentaPendiente[]>(obtenerVentasPendientes());
  const [sincronizando, setSincronizando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  function refrescar() {
    setVentas(obtenerVentasPendientes());
    onCambio();
  }

  async function sincronizarAhora() {
    setSincronizando(true);
    setMensaje(null);
    try {
      const { exitosas, conError } = await sincronizarVentasPendientes();
      if (exitosas === 0 && conError === 0) {
        setMensaje('No se pudo conectar al servidor. Se sigue intentando cuando vuelva internet.');
      } else {
        const partes = [];
        if (exitosas > 0) partes.push(`${exitosas} venta${exitosas !== 1 ? 's' : ''} subida${exitosas !== 1 ? 's' : ''}`);
        if (conError > 0) partes.push(`${conError} con error`);
        setMensaje(partes.join(', ') + '.');
      }
      refrescar();
    } finally {
      setSincronizando(false);
    }
  }

  function descartar(id: string) {
    quitarVentaDeCola(id);
    refrescar();
  }

  function reintentar(id: string) {
    reintentarVenta(id);
    refrescar();
  }

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Ventas sin sincronizar</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={sincronizarAhora} disabled={sincronizando}>
              {sincronizando ? 'Sincronizando...' : '🔄 Sincronizar ahora'}
            </button>
            <button onClick={onCerrar}>Cerrar</button>
          </div>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {ventas.length === 0 ? (
          <p style={{ color: '#6b7280' }}>No hay ventas pendientes por subir. Todo está sincronizado.</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {ventas.map((v) => (
              <div
                key={v.id}
                style={{
                  border: 'none',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)',
                  padding: '0.75rem',
                  borderRadius: 14,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <strong>{v.resumen.clienteNombre}</strong>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                      {new Date(v.resumen.fecha).toLocaleString()} · {v.resumen.totalItems} producto{v.resumen.totalItems !== 1 ? 's' : ''}
                    </div>
                    {v.estado === 'error' && (
                      <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>⚠ {v.error}</div>
                    )}
                    {v.estado === 'pendiente' && (
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Esperando conexión...</div>
                    )}
                  </div>
                  <strong>{formatoMoneda(v.resumen.total)}</strong>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  {v.estado === 'error' && (
                    <button onClick={() => reintentar(v.id)} style={{ flex: 1 }}>Reintentar</button>
                  )}
                  <button onClick={() => descartar(v.id)} style={{ flex: 1 }}>Descartar</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p style={{ fontSize: 12, color: '#9ca3af' }}>
          Las ventas "esperando conexión" se suben solas en cuanto vuelva internet. Las que tienen
          error necesitan revisión (por ejemplo, si el stock cambió mientras no había conexión).
        </p>
      </div>
    </div>
  );
}
