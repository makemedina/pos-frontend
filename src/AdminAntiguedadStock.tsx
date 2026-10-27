import { useEffect, useState } from 'react';
import { formatoMoneda, formatoKg, formatoFecha } from './formato';
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
    <div className="pantalla-centrada pantalla-arriba">
      <div className="contenido-pantalla contenido-760">
        <div className="fila-entre-centro">
          <h2>Antigüedad de stock</h2>
          <button onClick={onCerrar}>Cerrar</button>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {!cargando && (
          <>
            <p className="t-tenue-13-m0">
              Un lote se marca crítico cuando lleva más de {DIAS_CRITICO} días en stock sin venderse.
            </p>

            <div className="fila-gap-075-wrap">
              <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, flex: 1 }}>
                <strong style={{ color: criticos.length > 0 ? 'var(--peligro)' : undefined }}>{criticos.length}</strong> lote{criticos.length !== 1 ? 's' : ''} crítico{criticos.length !== 1 ? 's' : ''}
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
          <p className="t-tenue">{soloCriticos ? 'No hay lotes críticos ahora mismo.' : 'No hay lotes en stock.'}</p>
        ) : (
          <div className="lista-tarjetas grid-gap-075">
            {lotesVisibles.map((l) => (
              <div
                key={l.id}
                style={{
                  border: 'none',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)',
                  padding: '0.75rem',
                  borderRadius: 14,
                  background: l.critico ? 'var(--peligro-fondo)' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong>{l.producto} {l.marca}</strong>
                    <div className="t-tenue-13">
                      Proveedor: {l.proveedor} · Ingresó {formatoFecha(new Date(l.fechaIngreso))}
                    </div>
                    <div className="fs-13">
                      {formatoKg(l.cantidadDisponible)} kg a {formatoMoneda(l.costoUnitario)}/kg
                    </div>
                  </div>
                  <div className="t-der">
                    <div style={{ fontWeight: 700, color: l.critico ? 'var(--peligro)' : undefined }}>
                      {l.diasEnStock} día{l.diasEnStock !== 1 ? 's' : ''}
                    </div>
                    <div className="t-tenue-12">{formatoMoneda(l.valorEnStock)}</div>
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
