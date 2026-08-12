import { useEffect, useState } from 'react';
import { obtenerClientesEnRiesgo, type ClienteEnRiesgo } from './api';

interface Props {
  onCerrar: () => void;
}

const UMBRAL_RIESGO = 70;

function etiquetaMotivo(motivo: ClienteEnRiesgo['motivo']): string {
  if (motivo === 'ambos') return 'Dejó de comprar y compra menos';
  if (motivo === 'dejo_de_comprar') return 'Dejó de comprar';
  return 'Comprando menos';
}

export function AdminAnaliticaVentas({ onCerrar }: Props) {
  const [clientes, setClientes] = useState<ClienteEnRiesgo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      setClientes(await obtenerClientesEnRiesgo());
    } catch {
      setMensaje('No se pudo cargar la analítica de ventas.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Analítica de ventas</h2>
          <button onClick={onCerrar}>Cerrar</button>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {!cargando && (
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            Compara a cada cliente contra su propio historial (no contra un promedio general). Se
            marca cuando su ritmo de compra o su gasto de los últimos 30 días cae a {UMBRAL_RIESGO}%
            o menos de lo normal para él — llámales para ofrecerles producto antes de perderlos del todo.
          </p>
        )}

        {!cargando && clientes.length > 0 && (
          <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14 }}>
            <strong style={{ color: '#b91c1c' }}>{clientes.length}</strong> cliente{clientes.length !== 1 ? 's' : ''} en riesgo
          </div>
        )}

        {cargando ? (
          <p>Cargando...</p>
        ) : clientes.length === 0 ? (
          <p style={{ color: '#6b7280' }}>No hay clientes en riesgo por ahora — necesitas al menos 3 compras de un cliente para poder comparar su ritmo.</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {clientes.map((c) => (
              <div
                key={c.id}
                style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, background: '#fff2f1' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong>{c.nombre}</strong>
                    <div style={{ fontSize: 13 }}>
                      <a href={`tel:${c.telefono}`} style={{ color: '#007aff' }}>{c.telefono}</a>
                    </div>
                    <div style={{ fontSize: 12, color: '#b91c1c', fontWeight: 600, marginTop: 2 }}>
                      {etiquetaMotivo(c.motivo)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 13 }}>
                    <div>{c.diasSinComprar} día{c.diasSinComprar !== 1 ? 's' : ''} sin comprar</div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>
                      (normal: cada {c.intervaloPromedioDias} día{c.intervaloPromedioDias !== 1 ? 's' : ''})
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: 8, fontSize: 12, color: '#6b7280', borderTop: '1px solid #fecaca', paddingTop: 6 }}>
                  <span>Ritmo actual: <strong>{c.ritmoPct}%</strong> de lo normal</span>
                  {c.gastoRecientePct !== null && (
                    <span>Gasto últimos 30 días: <strong>{c.gastoRecientePct}%</strong> de lo normal</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
