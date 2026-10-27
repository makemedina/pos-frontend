import { Icono } from './iconos';
import { useEffect, useState } from 'react';
import { formatoMoneda, formatoFecha } from './formato';
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
      setMensaje(`Corte del ${formatoFecha(new Date(editando.fecha))} actualizado.`);
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
      setMensaje(`Corte del ${formatoFecha(new Date(fecha))} eliminado.`);
      setConfirmandoEliminarId(null);
      cargar();
    } catch (err: any) {
      setMensaje(err.message || 'No se pudo eliminar el corte.');
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div className="pantalla-centrada pantalla-arriba">
      <div className="contenido-pantalla contenido-760">
        <div className="fila-entre-centro">
          <h2>Histórico de cortes</h2>
          <button onClick={onCerrar}>Volver</button>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {cargando ? (
          <p>Cargando...</p>
        ) : cortes.length === 0 ? (
          <p className="t-tenue">Aún no hay cortes registrados.</p>
        ) : (
          <div className="lista-tarjetas grid-gap-075">
            {cortes.map((c) => (
              <div key={c.id} className="tarjeta-sombra">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong>{formatoFecha(new Date(c.fecha))}</strong>
                    <div className="t-tenue-13">Registró: {c.registradoPor}</div>
                    <div>Efectivo: {formatoMoneda(c.efectivoContado)}</div>
                    <div>Banco: {formatoMoneda(c.saldoBancoContado)}</div>
                    {c.utilidadDia !== undefined && (
                      <>
                        <div style={{ marginTop: 4 }}>Utilidad del día: {formatoMoneda(c.utilidadDia)}</div>
                        <div>Valor de inventario: {formatoMoneda(c.valorInventario!)}</div>
                        <div>Balanza total: <strong>{formatoMoneda(c.balanzaTotal!)}</strong></div>
                        {c.diferenciaCuadre != null && (
                          Math.abs(c.diferenciaCuadre) < 0.01 ? (
                            <div style={{ color: 'var(--exito)', fontSize: 12 }}>✓ Cuadra con el día anterior</div>
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
                        <Icono nombre="documento" size={16} /> {c.observacion}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button onClick={() => setFechaAImprimir(c.fecha.slice(0, 10))}><Icono nombre="impresora" size={16} /> Imprimir</button>
                    <button onClick={() => empezarEdicion(c)}>Editar</button>
                    <button
                      onClick={() => setConfirmandoEliminarId(c.id)}
                      style={{ background: 'var(--peligro-fondo)', color: 'var(--peligro)' }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                {confirmandoEliminarId === c.id && (
                  <div className="bloque-autorizacion mt-8">
                    <p className="texto-alerta fw-600">
                      ¿Seguro que quieres eliminar el corte del {formatoFecha(new Date(c.fecha))}?
                      Esto puede afectar el cuadre del corte del día siguiente que ya se guardó (se
                      comparará contra el corte anterior a este). No se puede deshacer.
                    </p>
                    <div className="fila-gap-8-mt-8">
                      <button onClick={() => confirmarEliminar(c.id, c.fecha)} disabled={eliminando} className="flex-1">
                        {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
                      </button>
                      <button onClick={() => setConfirmandoEliminarId(null)} className="flex-1">
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
          <form onSubmit={guardarEdicion} className="tarjeta-grid-075">
            <h3>Corregir corte del {formatoFecha(new Date(editando.fecha))}</h3>
            <p className="t-tenue-13-m0">
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
            <div className="fila-gap-8">
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
