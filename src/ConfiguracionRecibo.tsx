import { useEffect, useState } from 'react';
import { obtenerConfiguracion, guardarConfiguracion, type Configuracion } from './api';

interface Props {
  onCerrar: () => void;
  onIrAImpresora: () => void;
}

export function ConfiguracionRecibo({ onCerrar, onIrAImpresora }: Props) {
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    obtenerConfiguracion()
      .then(setConfig)
      .catch(() => setMensaje('No se pudo cargar la configuración.'))
      .finally(() => setCargando(false));
  }, []);

  function actualizar<K extends keyof Configuracion>(campo: K, valor: Configuracion[K]) {
    setConfig((prev) => (prev ? { ...prev, [campo]: valor } : prev));
  }

  async function guardar() {
    if (!config) return;
    setGuardando(true);
    try {
      const actualizado = await guardarConfiguracion({
        mostrarDatosCliente: config.mostrarDatosCliente,
        encabezadoRecibo: config.encabezadoRecibo,
        piePaginaRecibo: config.piePaginaRecibo,
      });
      setConfig(actualizado);
      setMensaje('Configuración del recibo guardada.');
    } catch {
      setMensaje('No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="pantalla-centrada pantalla-arriba">
      <div style={{ width: '100%', maxWidth: 560, display: 'grid', gap: '1rem' }}>
        <div className="fila-entre-centro">
          <h2>Configuración del recibo</h2>
          <button onClick={onCerrar}>Cerrar</button>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {cargando || !config ? (
          <p>Cargando...</p>
        ) : (
          <>
            <div className="tarjeta-grid-075">
              <div className="fila-switch">
                <span>Mostrar datos del cliente en el recibo</span>
                <button
                  className={`switch ${config.mostrarDatosCliente ? 'on' : ''}`}
                  onClick={() => actualizar('mostrarDatosCliente', !config.mostrarDatosCliente)}
                >
                  <span className="switch-bola" />
                </button>
              </div>

              <label>
                Encabezado del recibo (debajo de los datos del negocio)
                <textarea
                  value={config.encabezadoRecibo}
                  onChange={(e) => actualizar('encabezadoRecibo', e.target.value)}
                  rows={2}
                  placeholder='Ej. "Venta de carnes al mayoreo y menudeo"'
                  style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, padding: 8 }}
                />
              </label>

              <label>
                Nota al pie del recibo
                <textarea
                  value={config.piePaginaRecibo}
                  onChange={(e) => actualizar('piePaginaRecibo', e.target.value)}
                  rows={2}
                  placeholder='Ej. "No se aceptan devoluciones despues de 24 horas"'
                  style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, padding: 8 }}
                />
              </label>

              <button onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>

            <div
              style={{ border: 'none', boxShadow: 'var(--sombra-tarjeta)', padding: '1rem', borderRadius: 14, cursor: 'pointer' }}
              onClick={onIrAImpresora}
            >
              <strong>Configuración de la impresora →</strong>
              <p style={{ fontSize: 13, color: 'var(--ios-secondary-label)', margin: '4px 0 0' }}>
                Conectar impresora, tamaño de papel, prueba de impresión.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
