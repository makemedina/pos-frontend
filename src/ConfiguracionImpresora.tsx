import { Icono } from './iconos';
import { useEffect, useState } from 'react';
import { obtenerConfiguracion, guardarConfiguracion, type Configuracion } from './api';
import {
  impresoraConectada,
  nombreImpresoraConectada,
  perfilImpresoraConectado,
  conectarImpresora,
  desconectarImpresora,
  imprimirPrueba,
} from './impresionBluetooth';

interface Props {
  onCerrar: () => void;
}

export function ConfiguracionImpresora({ onCerrar }: Props) {
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [, forzarRender] = useState(0); // para reflejar el estado del modulo de impresion (no vive en React state)

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
        anchoPapelMm: config.anchoPapelMm,
        imprimirDosVeces: config.imprimirDosVeces,
      });
      setConfig(actualizado);
      setMensaje('Configuración de impresora guardada.');
    } catch {
      setMensaje('No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  async function conectar() {
    setConectando(true);
    setMensaje(null);
    try {
      const nombre = await conectarImpresora();
      setMensaje(`Conectado a "${nombre}".`);
      forzarRender((n) => n + 1);
    } catch (err: any) {
      setMensaje(err.message || 'No se pudo conectar a la impresora.');
    } finally {
      setConectando(false);
    }
  }

  function desconectar() {
    desconectarImpresora();
    forzarRender((n) => n + 1);
    setMensaje('Impresora desconectada.');
  }

  async function probar() {
    if (!config) return;
    setProbando(true);
    setMensaje(null);
    try {
      if (!impresoraConectada()) {
        await conectarImpresora();
        forzarRender((n) => n + 1);
      }
      await imprimirPrueba(config.anchoPapelMm);
      setMensaje('Prueba enviada a la impresora.');
    } catch (err: any) {
      setMensaje(err.message || 'No se pudo imprimir la prueba.');
    } finally {
      setProbando(false);
    }
  }

  return (
    <div className="pantalla-centrada pantalla-arriba">
      <div style={{ width: '100%', maxWidth: 560, display: 'grid', gap: '1rem' }}>
        <div className="fila-entre-centro">
          <h2>Configuración de la impresora</h2>
          <button onClick={onCerrar}>Cerrar</button>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {cargando || !config ? (
          <p>Cargando...</p>
        ) : (
          <div className="tarjeta-grid-075">
            <div>
              <strong>Impresora:</strong>{' '}
              {impresoraConectada()
                ? `Conectada (${nombreImpresoraConectada()} · perfil ${perfilImpresoraConectado()})`
                : 'Ninguna conectada'}
            </div>
            {impresoraConectada() ? (
              <button type="button" onClick={desconectar}>Desconectar</button>
            ) : (
              <button type="button" onClick={conectar} disabled={conectando}>
                {conectando ? 'Buscando...' : 'Conectar impresora'}
              </button>
            )}

            <label className="etiqueta">Tamaño de papel</label>
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="radio"
                  name="ancho"
                  checked={config.anchoPapelMm === 58}
                  onChange={() => actualizar('anchoPapelMm', 58)}
                />
                58 mm
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="radio"
                  name="ancho"
                  checked={config.anchoPapelMm === 80}
                  onChange={() => actualizar('anchoPapelMm', 80)}
                />
                80 mm
              </label>
            </div>

            <div className="fila-switch">
              <span>Imprimir el recibo 2 veces</span>
              <button
                className={`switch ${config.imprimirDosVeces ? 'on' : ''}`}
                onClick={() => actualizar('imprimirDosVeces', !config.imprimirDosVeces)}
              >
                <span className="switch-bola" />
              </button>
            </div>

            <button onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>

            <button type="button" onClick={probar} disabled={probando} className="mt-8">
              {probando ? 'Imprimiendo...' : <><Icono nombre="impresora" size={16} /> Imprimir prueba</>}
            </button>

            <p style={{ fontSize: 12, color: 'var(--ios-secondary-label)', margin: 0 }}>
              Usa Chrome en Android. Si tu impresora no imprime nada, puede que use un UUID de
              Bluetooth distinto al configurado por default — avísale a soporte el modelo exacto.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
