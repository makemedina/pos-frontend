import { useEffect, useState } from 'react';
import { formatoMoneda } from './formato';
import { obtenerNotasAntiguas, type NotaAntigua } from './api';

interface Props {
  onCerrar: () => void;
}

const DIAS_ANTIGUEDAD = 7;

export function AdminNotasAntiguas({ onCerrar }: Props) {
  const [notas, setNotas] = useState<NotaAntigua[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      setNotas(await obtenerNotasAntiguas());
    } catch {
      setMensaje('No se pudo cargar el reporte de notas antiguas.');
    } finally {
      setCargando(false);
    }
  }

  const totalPendiente = notas.reduce((acc, n) => acc + n.saldoPendiente, 0);

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Notas antiguas</h2>
          <button onClick={onCerrar}>Cerrar</button>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {!cargando && (
          <>
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
              Notas a crédito con saldo pendiente que llevan más de {DIAS_ANTIGUEDAD} días sin liquidarse.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, flex: 1 }}>
                <strong style={{ color: notas.length > 0 ? '#b91c1c' : undefined }}>{notas.length}</strong> nota{notas.length !== 1 ? 's' : ''} antigua{notas.length !== 1 ? 's' : ''}
              </div>
              <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, flex: 1 }}>
                Saldo pendiente: <strong>{formatoMoneda(totalPendiente)}</strong>
              </div>
            </div>
          </>
        )}

        {cargando ? (
          <p>Cargando...</p>
        ) : notas.length === 0 ? (
          <p style={{ color: '#6b7280' }}>No hay notas con más de {DIAS_ANTIGUEDAD} días sin liquidarse.</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {notas.map((n) => (
              <div
                key={n.id}
                style={{
                  border: 'none',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)',
                  padding: '0.75rem',
                  borderRadius: 14,
                  background: '#fff2f1',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong>{n.clienteNombre}</strong>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                      {n.clienteTelefono} · Nota #{n.folio} · {new Date(n.fecha).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#b91c1c' }}>
                      {n.diasAntiguedad} día{n.diasAntiguedad !== 1 ? 's' : ''}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{formatoMoneda(n.saldoPendiente)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
