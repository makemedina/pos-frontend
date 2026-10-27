import { Icono } from './iconos';
import { useState } from 'react';
import { formatoMoneda, formatoFechaHora } from './formato';
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
    <div className="pantalla-centrada pantalla-arriba">
      <div className="contenido-pantalla contenido-760">
        <div className="fila-entre-centro">
          <h2>Ventas sin sincronizar</h2>
          <div className="fila-gap-8">
            <button onClick={sincronizarAhora} disabled={sincronizando}>
              {sincronizando ? 'Sincronizando...' : <><Icono nombre="sincronizar" size={16} /> Sincronizar ahora</>}
            </button>
            <button onClick={onCerrar}>Cerrar</button>
          </div>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {ventas.length === 0 ? (
          <p className="t-tenue">No hay ventas pendientes por subir. Todo está sincronizado.</p>
        ) : (
          <div className="lista-tarjetas grid-gap-075">
            {ventas.map((v) => (
              <div
                key={v.id}
                style={{
                  border: 'none',
                  boxShadow: 'var(--sombra-tarjeta)',
                  padding: '0.75rem',
                  borderRadius: 14,
                }}
              >
                <div className="fila-entre">
                  <div>
                    <strong>{v.resumen.clienteNombre}</strong>
                    <div className="t-tenue-13">
                      {formatoFechaHora(new Date(v.resumen.fecha))} · {v.resumen.totalItems} producto{v.resumen.totalItems !== 1 ? 's' : ''}
                    </div>
                    {v.estado === 'error' && (
                      <div style={{ fontSize: 12, color: 'var(--peligro)', marginTop: 4 }}>⚠ {v.error}</div>
                    )}
                    {v.estado === 'pendiente' && (
                      <div style={{ fontSize: 12, color: 'var(--ios-secondary-label)', marginTop: 4 }}>Esperando conexión...</div>
                    )}
                  </div>
                  <strong>{formatoMoneda(v.resumen.total)}</strong>
                </div>
                <div className="fila-gap-8-mt-8">
                  {v.estado === 'error' && (
                    <button onClick={() => reintentar(v.id)} className="flex-1">Reintentar</button>
                  )}
                  <button onClick={() => descartar(v.id)} className="flex-1">Descartar</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p style={{ fontSize: 12, color: 'var(--texto-tenue)' }}>
          Las ventas "esperando conexión" se suben solas en cuanto vuelva internet. Las que tienen
          error necesitan revisión (por ejemplo, si el stock cambió mientras no había conexión).
        </p>
      </div>
    </div>
  );
}
