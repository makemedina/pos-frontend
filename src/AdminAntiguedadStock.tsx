import { useEffect, useState } from 'react';
import { formatoMoneda, formatoKg } from './formato';
import { obtenerAntiguedadStock, type LoteAntiguo } from './api';

interface Props {
  onCerrar: () => void;
}

const DIAS_CRITICO = 15;

export function AdminAntiguedadStock({ onCerrar }: Props) {
  const [lotes, setLotes] = useState<LoteAntiguo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [soloCriticos, setSoloCriticos] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      setLotes(await obtenerAntiguedadStock());
    } catch {
      setMensaje('No se pudo cargar el reporte de antigüedad.');
    } finally {
      setCargando(false);
    }
  }

  const lotesVisibles = soloCriticos ? lotes.filter((l) => l.critico) : lotes;
  const criticos = lotes.filter((l) => l.critico);
  const valorCritico = criticos.reduce((acc, l) => acc + l.valorEnStock, 0);

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Antigüedad de stock</h2>
          <button onClick={onCerrar}>Cerrar</button>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {!cargando && (
          <>
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
              Un lote se marca crítico cuando lleva más de {DIAS_CRITICO} días en stock sin venderse.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, flex: 1 }}>
                <strong style={{ color: criticos.length > 0 ? '#b91c1c' : undefined }}>{criticos.length}</strong> lote{criticos.length !== 1 ? 's' : ''} crítico{criticos.length !== 1 ? 's' : ''}
              </div>
              <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, flex: 1 }}>
                Valor en crítico: <strong>{formatoMoneda(valorCritico)}</strong>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input type="checkbox" checked={soloCriticos} onChange={(e) => setSoloCriticos(e.target.checked)} />
              Ver solo los críticos
            </label>
          </>
        )}

        {cargando ? (
          <p>Cargando...</p>
        ) : lotesVisibles.length === 0 ? (
          <p style={{ color: '#6b7280' }}>{soloCriticos ? 'No hay lotes críticos ahora mismo.' : 'No hay lotes en stock.'}</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {lotesVisibles.map((l) => (
              <div
                key={l.id}
                style={{
                  border: 'none',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)',
                  padding: '0.75rem',
                  borderRadius: 14,
                  background: l.critico ? '#fff2f1' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong>{l.producto} {l.marca}</strong>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                      Proveedor: {l.proveedor} · Ingresó {new Date(l.fechaIngreso).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: 13 }}>
                      {formatoKg(l.cantidadDisponible)} kg a {formatoMoneda(l.costoUnitario)}/kg
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: l.critico ? '#b91c1c' : undefined }}>
                      {l.diasEnStock} día{l.diasEnStock !== 1 ? 's' : ''}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{formatoMoneda(l.valorEnStock)}</div>
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
