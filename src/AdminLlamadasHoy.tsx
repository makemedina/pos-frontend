import { useEffect, useState } from 'react';
import { obtenerLlamadasDeHoy, marcarLlamadaCliente, type LlamadaHoy } from './api';

interface Props {
  onCerrar: () => void;
}

const DIAS_NOMBRE = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function AdminLlamadasHoy({ onCerrar }: Props) {
  const [llamadas, setLlamadas] = useState<LlamadaHoy[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [marcando, setMarcando] = useState<string | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      setLlamadas(await obtenerLlamadasDeHoy());
    } catch {
      setMensaje('No se pudieron cargar las llamadas de hoy.');
    } finally {
      setCargando(false);
    }
  }

  async function toggle(cliente: LlamadaHoy) {
    setMarcando(cliente.id);
    // Optimista: se actualiza la pantalla de una vez, y se corrige si falla.
    setLlamadas((prev) => prev.map((l) => (l.id === cliente.id ? { ...l, hecha: !l.hecha } : l)));
    try {
      await marcarLlamadaCliente(cliente.id, !cliente.hecha);
    } catch {
      setLlamadas((prev) => prev.map((l) => (l.id === cliente.id ? { ...l, hecha: cliente.hecha } : l)));
      setMensaje('No se pudo guardar. Intenta otra vez.');
    } finally {
      setMarcando(null);
    }
  }

  const pendientes = llamadas.filter((l) => !l.hecha);
  const hechas = llamadas.filter((l) => l.hecha);
  const hoyNombre = DIAS_NOMBRE[new Date().getDay()];

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 620, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, textTransform: 'capitalize' }}>Llamadas de hoy ({hoyNombre})</h2>
          <button onClick={onCerrar}>Cerrar</button>
        </div>

        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
          Clientes y prospectos configurados para que se les hable hoy. Márcalos conforme les hables — el
          checklist se reinicia solo cada día.
        </p>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {cargando ? (
          <p style={{ textAlign: 'center', color: '#6b7280' }}>Cargando...</p>
        ) : llamadas.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#6b7280' }}>
            Nadie tiene hoy configurado como día de llamada. Puedes elegir los días de cada cliente en su
            ficha, dentro de Clientes.
          </p>
        ) : (
          <>
            {pendientes.length > 0 && (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <strong style={{ fontSize: 13, color: '#6b7280' }}>Por llamar ({pendientes.length})</strong>
                {pendientes.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: 'none',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)',
                      padding: '0.75rem',
                      borderRadius: 14,
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={c.hecha}
                        disabled={marcando === c.id}
                        onChange={() => toggle(c)}
                      />
                      <span>
                        <strong>{c.nombre}</strong>
                        {c.notas && <div style={{ fontSize: 12, color: '#6b7280' }}>{c.notas}</div>}
                      </span>
                    </label>
                    <a href={`tel:${c.telefono}`} style={{ color: '#007aff', whiteSpace: 'nowrap' }}>
                      {c.telefono}
                    </a>
                  </div>
                ))}
              </div>
            )}

            {hechas.length > 0 && (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <strong style={{ fontSize: 13, color: '#6b7280' }}>Ya llamados ({hechas.length})</strong>
                {hechas.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: 'none',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)',
                      padding: '0.75rem',
                      borderRadius: 14,
                      opacity: 0.6,
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={c.hecha}
                        disabled={marcando === c.id}
                        onChange={() => toggle(c)}
                      />
                      <strong style={{ textDecoration: 'line-through' }}>{c.nombre}</strong>
                    </label>
                    <a href={`tel:${c.telefono}`} style={{ color: '#007aff', whiteSpace: 'nowrap' }}>
                      {c.telefono}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
