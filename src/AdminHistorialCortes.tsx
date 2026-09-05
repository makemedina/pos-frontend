import { useEffect, useState } from 'react';
import { formatoMoneda } from './formato';
import { obtenerHistorialCortes, actualizarCorte, eliminarCorte, type CorteHistorico } from './api';
import { CorteHistoricoModal } from './CorteHistoricoModal';

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
  const [observacion, setObservacion] = useState('');
  const [confirmandoEliminarId, setConfirmandoEliminarId] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [fechaAImprimir, setFechaAImprimir] = useState<string | null>(null);

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
    setObservacion(c.observacion || '');
  }

  async function guardarEdicion(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    try {
      await actualizarCorte(editando.id, Number(efectivoContado), Number(saldoBancoContado), observacion);
      setMensaje(`Corte del ${new Date(editando.fecha).toLocaleDateString()} actualizado.`);
      setEditando(null);
      cargar();
    } catch {
      setMensaje('No se pudo actualizar el corte.');
    }
  }

  async function confirmarEliminar(id: string, fecha: string) {
    setEliminando(true);
    try {
      await eliminarCorte(id);
      setMensaje(`Corte del ${new Date(fecha).toLocaleDateString()} eliminado.`);
      setConfirmandoEliminarId(null);
      cargar();
    } catch (err: any) {
      setMensaje(err.message || 'No se pudo eliminar el corte.');
    } finally {
      setEliminando(false);
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
                    <div>Efectivo: {formatoMoneda(c.efectivoContado)}</div>
                    <div>Banco: {formatoMoneda(c.saldoBancoContado)}</div>
                    {c.utilidadDia !== undefined && (
                      <>
                        <div style={{ marginTop: 4 }}>Utilidad del día: {formatoMoneda(c.utilidadDia)}</div>
                        <div>Valor de inventario: {formatoMoneda(c.valorInventario!)}</div>
                        <div>Balanza total: <strong>{formatoMoneda(c.balanzaTotal!)}</strong></div>
                        {c.diferenciaCuadre != null && (
                          Math.abs(c.diferenciaCuadre) < 0.01 ? (
                            <div style={{ color: '#16a34a', fontSize: 12 }}>✓ Cuadra con el día anterior</div>
                          ) : (
                            <div className="texto-alerta" style={{ fontSize: 12 }}>
                              ⚠ No cuadra: diferencia de {formatoMoneda(c.diferenciaCuadre)}
                            </div>
                          )
                        )}
                      </>
                    )}
                    {c.observacion && (
                      <div style={{ fontSize: 13, marginTop: 4, whiteSpace: 'pre-wrap' }}>
                        📝 {c.observacion}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button onClick={() => setFechaAImprimir(c.fecha.slice(0, 10))}>🖨️ Imprimir</button>
                    <button onClick={() => empezarEdicion(c)}>Editar</button>
                    <button
                      onClick={() => setConfirmandoEliminarId(c.id)}
                      style={{ background: '#fff2f1', color: '#b91c1c' }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                {confirmandoEliminarId === c.id && (
                  <div className="bloque-autorizacion" style={{ marginTop: 8 }}>
                    <p className="texto-alerta" style={{ fontWeight: 600 }}>
                      ¿Seguro que quieres eliminar el corte del {new Date(c.fecha).toLocaleDateString()}?
                      Esto puede afectar el cuadre del corte del día siguiente que ya se guardó (se
                      comparará contra el corte anterior a este). No se puede deshacer.
                    </p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button onClick={() => confirmarEliminar(c.id, c.fecha)} disabled={eliminando} style={{ flex: 1 }}>
                        {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
                      </button>
                      <button onClick={() => setConfirmandoEliminarId(null)} style={{ flex: 1 }}>
                        No, regresar
                      </button>
                    </div>
                  </div>
                )}
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
            <label>
              Observación (opcional)
              <textarea
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Ej. faltaron $50 porque se le regalaron a un cliente"
                rows={2}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit">Guardar corrección</button>
              <button type="button" onClick={() => setEditando(null)}>Cancelar</button>
            </div>
          </form>
        )}
      </div>

      {fechaAImprimir && (
        <CorteHistoricoModal fecha={fechaAImprimir} onCerrar={() => setFechaAImprimir(null)} />
      )}
    </div>
  );
}
