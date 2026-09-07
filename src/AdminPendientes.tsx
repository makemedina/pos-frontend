import { useEffect, useState } from 'react';
import {
  obtenerPendientes,
  crearPendiente,
  actualizarPendiente,
  eliminarPendiente,
  type Pendiente,
} from './api';

interface Props {
  onCerrar: () => void;
}

const CARD = { border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14 };

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function esMismoDia(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function AdminPendientes({ onCerrar }: Props) {
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [mostrarCompletados, setMostrarCompletados] = useState(false);

  const [formAbierto, setFormAbierto] = useState(false);
  const [concepto, setConcepto] = useState('');
  const [fecha, setFecha] = useState(() => formatDateInput(new Date()));
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      setPendientes(await obtenerPendientes(true));
      setMensaje(null);
    } catch {
      setMensaje('No se pudieron cargar los pendientes.');
    } finally {
      setCargando(false);
    }
  }

  async function agregar() {
    if (!concepto.trim() || !fecha) return;
    setGuardando(true);
    try {
      await crearPendiente({ concepto: concepto.trim(), fecha, notas: notas.trim() || undefined });
      setConcepto('');
      setNotas('');
      setFecha(formatDateInput(new Date()));
      setFormAbierto(false);
      cargar();
    } catch {
      setMensaje('No se pudo guardar el pendiente.');
    } finally {
      setGuardando(false);
    }
  }

  async function toggleHecho(p: Pendiente) {
    setPendientes((prev) => prev.map((x) => (x.id === p.id ? { ...x, hecho: !p.hecho } : x)));
    setGuardandoId(p.id);
    try {
      await actualizarPendiente(p.id, { hecho: !p.hecho });
    } catch {
      setMensaje('No se pudo guardar. Intenta otra vez.');
      cargar();
    } finally {
      setGuardandoId(null);
    }
  }

  async function eliminar(p: Pendiente) {
    if (!confirm(`¿Eliminar el pendiente "${p.concepto}"?`)) return;
    setGuardandoId(p.id);
    try {
      await eliminarPendiente(p.id);
      setPendientes((prev) => prev.filter((x) => x.id !== p.id));
    } catch {
      setMensaje('No se pudo eliminar.');
    } finally {
      setGuardandoId(null);
    }
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const activos = pendientes.filter((p) => !p.hecho);
  const completados = pendientes.filter((p) => p.hecho);
  const vencidos = activos.filter((p) => new Date(p.fecha) < hoy);
  const deHoy = activos.filter((p) => esMismoDia(new Date(p.fecha), hoy));
  const proximos = activos.filter((p) => new Date(p.fecha) > hoy && !esMismoDia(new Date(p.fecha), hoy));

  function tarjeta(p: Pendiente, vencido = false) {
    return (
      <div key={p.id} style={{ ...CARD, opacity: p.hecho ? 0.6 : 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={p.hecho}
              disabled={guardandoId === p.id}
              onChange={() => toggleHecho(p)}
              style={{ marginTop: 3 }}
            />
            <span>
              <strong style={{ textDecoration: p.hecho ? 'line-through' : 'none' }}>{p.concepto}</strong>
              <div style={{ fontSize: 12, color: vencido ? '#b91c1c' : '#6b7280', fontWeight: vencido ? 700 : 400 }}>
                {new Date(p.fecha).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                {vencido && ' · Vencido'}
              </div>
              {p.notas && <div style={{ fontSize: 13, color: '#374151', marginTop: 4 }}>{p.notas}</div>}
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Agregado por {p.registradoPor.nombre}</div>
            </span>
          </label>
          <button
            onClick={() => eliminar(p)}
            disabled={guardandoId === p.id}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4 }}
            title="Eliminar"
          >
            🗑️
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 620, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Pendientes</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setFormAbierto((v) => !v)}>{formAbierto ? 'Cancelar' : '+ Nuevo'}</button>
            <button onClick={onCerrar}>Cerrar</button>
          </div>
        </div>

        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
          Recordatorios y tareas sueltas programadas para un día específico. Los de hoy también aparecen en
          "Llamadas de hoy".
        </p>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {formAbierto && (
          <div style={{ ...CARD, display: 'grid', gap: '0.5rem' }}>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span>¿Qué hay que hacer?</span>
              <input
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Ej. Llamar al proveedor de bolsas"
                autoFocus
              />
            </label>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span>¿Qué día?</span>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </label>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span>Notas (opcional)</span>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} style={{ resize: 'vertical' }} />
            </label>
            <button onClick={agregar} disabled={guardando || !concepto.trim() || !fecha}>
              {guardando ? 'Guardando...' : 'Guardar pendiente'}
            </button>
          </div>
        )}

        {cargando ? (
          <p style={{ textAlign: 'center', color: '#6b7280' }}>Cargando...</p>
        ) : pendientes.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#6b7280' }}>No hay pendientes. Usa "+ Nuevo" para agregar uno.</p>
        ) : (
          <>
            {vencidos.length > 0 && (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <strong style={{ fontSize: 13, color: '#b91c1c' }}>Vencidos ({vencidos.length})</strong>
                {vencidos.map((p) => tarjeta(p, true))}
              </div>
            )}

            {deHoy.length > 0 && (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <strong style={{ fontSize: 13, color: '#6b7280' }}>Hoy ({deHoy.length})</strong>
                {deHoy.map((p) => tarjeta(p))}
              </div>
            )}

            {proximos.length > 0 && (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <strong style={{ fontSize: 13, color: '#6b7280' }}>Próximos ({proximos.length})</strong>
                {proximos.map((p) => tarjeta(p))}
              </div>
            )}

            {activos.length === 0 && (
              <p style={{ textAlign: 'center', color: '#6b7280' }}>No hay pendientes activos. 🎉</p>
            )}

            {completados.length > 0 && (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <button
                  onClick={() => setMostrarCompletados((v) => !v)}
                  style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', textAlign: 'left', padding: 0 }}
                >
                  {mostrarCompletados ? '▾' : '▸'} Completados ({completados.length})
                </button>
                {mostrarCompletados && completados.map((p) => tarjeta(p))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
