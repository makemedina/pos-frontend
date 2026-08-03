import { useEffect, useState } from 'react';
import { obtenerHistorialCortes, actualizarCorte, type CorteHistorico } from './api';

interface Props {
  onCerrar: () => void;
}

export function AdminHistorialCortes({ onCerrar }: Props) {
  const [cortes, setCortes] = useState<CorteHistorico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [editando, setEditando] = useState<CorteHistorico | null>(null);
  const [efectivoContado, setEfectivoContado] = useState('');
  const [saldoBancoContado, setSaldoBancoContado] = useState('');

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      const data = await obtenerHistorialCortes();
      setCortes(data);
    } catch {
      setMensaje('No se pudo cargar el histórico de cortes.');
    } finally {
      setCargando(false);
    }
  }

  function empezarEdicion(c: CorteHistorico) {
    setEditando(c);
    setEfectivoContado(String(c.efectivoContado));
    setSaldoBancoContado(String(c.saldoBancoContado));
  }

  async function guardarEdicion(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    try {
      await actualizarCorte(editando.id, Number(efectivoContado), Number(saldoBancoContado));
      setMensaje(`Corte del ${new Date(editando.fecha).toLocaleDateString()} actualizado.`);
      setEditando(null);
      cargar();
    } catch {
      setMensaje('No se pudo actualizar el corte.');
    }
  }

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Histórico de cortes</h2>
          <button onClick={onCerrar}>Volver</button>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {cargando ? (
          <p>Cargando...</p>
        ) : cortes.length === 0 ? (
          <p style={{ color: '#6b7280' }}>Aún no hay cortes registrados.</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {cortes.map((c) => (
              <div key={c.id} style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong>{new Date(c.fecha).toLocaleDateString()}</strong>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>Registró: {c.registradoPor}</div>
                    <div>Efectivo: ${c.efectivoContado.toFixed(2)}</div>
                    <div>Banco: ${c.saldoBancoContado.toFixed(2)}</div>
                    {c.utilidadDia !== undefined && (
                      <>
                        <div style={{ marginTop: 4 }}>Utilidad del día: ${c.utilidadDia.toFixed(2)}</div>
                        <div>Valor de inventario: ${c.valorInventario!.toFixed(2)}</div>
                        <div>Balanza total: <strong>${c.balanzaTotal!.toFixed(2)}</strong></div>
                        {c.diferenciaCuadre != null && (
                          Math.abs(c.diferenciaCuadre) < 0.01 ? (
                            <div style={{ color: '#16a34a', fontSize: 12 }}>✓ Cuadra con el día anterior</div>
                          ) : (
                            <div className="texto-alerta" style={{ fontSize: 12 }}>
                              ⚠ No cuadra: diferencia de ${c.diferenciaCuadre.toFixed(2)}
                            </div>
                          )
                        )}
                      </>
                    )}
                  </div>
                  <button onClick={() => empezarEdicion(c)}>Editar</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {editando && (
          <form onSubmit={guardarEdicion} style={{ display: 'grid', gap: '0.75rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
            <h3>Corregir corte del {new Date(editando.fecha).toLocaleDateString()}</h3>
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
              Solo se pueden corregir los montos contados. La utilidad y la balanza de ese día no se recalculan.
            </p>
            <label>
              Efectivo contado
              <input value={efectivoContado} onChange={(e) => setEfectivoContado(e.target.value)} type="number" step="0.01" required />
            </label>
            <label>
              Saldo en banco
              <input value={saldoBancoContado} onChange={(e) => setSaldoBancoContado(e.target.value)} type="number" step="0.01" required />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit">Guardar corrección</button>
              <button type="button" onClick={() => setEditando(null)}>Cancelar</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
