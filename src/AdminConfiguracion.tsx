import { useEffect, useState } from 'react';
import { obtenerConfiguracion, guardarConfiguracion, type Configuracion } from './api';

interface Props {
  onCerrar: () => void;
  onIrARecibo: () => void;
}

export function AdminConfiguracion({ onCerrar, onIrARecibo }: Props) {
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [saldoBancoInput, setSaldoBancoInput] = useState('');
  const [guardandoSaldo, setGuardandoSaldo] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      const data = await obtenerConfiguracion();
      setConfig(data);
      setSaldoBancoInput(String(data.saldoBancoActual));
    } catch {
      setMensaje('No se pudo cargar la configuración.');
    } finally {
      setCargando(false);
    }
  }

  function actualizar<K extends keyof Configuracion>(campo: K, valor: Configuracion[K]) {
    setConfig((prev) => (prev ? { ...prev, [campo]: valor } : prev));
  }

  function seleccionarLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => {
      actualizar('logoBase64', lector.result as string);
    };
    lector.readAsDataURL(archivo);
  }

  async function guardar() {
    if (!config) return;
    setGuardando(true);
    try {
      const actualizado = await guardarConfiguracion({
        nombreNegocio: config.nombreNegocio,
        logoBase64: config.logoBase64,
        telefono: config.telefono,
        direccion: config.direccion,
        notasNegocio: config.notasNegocio,
      });
      setConfig(actualizado);
      setMensaje('Configuración guardada.');
    } catch {
      setMensaje('No se pudo guardar la configuración.');
    } finally {
      setGuardando(false);
    }
  }

  async function guardarSaldoBanco() {
    const valor = Number(saldoBancoInput);
    if (isNaN(valor)) return;
    setGuardandoSaldo(true);
    try {
      const actualizado = await guardarConfiguracion({ saldoBancoActual: valor });
      setConfig(actualizado);
      setMensaje('Saldo en bancos actualizado.');
    } catch {
      setMensaje('No se pudo guardar el saldo en bancos.');
    } finally {
      setGuardandoSaldo(false);
    }
  }

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Configuración del negocio</h2>
          <button onClick={onCerrar}>Cerrar</button>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {cargando || !config ? (
          <p>Cargando...</p>
        ) : (
          <>
            <div style={{ display: 'grid', gap: '0.75rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
              <label>
                Nombre del negocio
                <input
                  value={config.nombreNegocio}
                  onChange={(e) => actualizar('nombreNegocio', e.target.value)}
                  placeholder="Ej. Mr Carnes"
                />
              </label>

              <label>
                Logo
                <input type="file" accept="image/*" onChange={seleccionarLogo} />
              </label>
              {config.logoBase64 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src={config.logoBase64} alt="Logo" style={{ maxHeight: 60, maxWidth: 160 }} />
                  <button type="button" onClick={() => actualizar('logoBase64', null)}>Quitar logo</button>
                </div>
              )}

              <label>
                Teléfono
                <input value={config.telefono} onChange={(e) => actualizar('telefono', e.target.value)} />
              </label>

              <label>
                Dirección
                <input value={config.direccion} onChange={(e) => actualizar('direccion', e.target.value)} />
              </label>

              <label>
                Notas (uso interno, no aparecen en el recibo)
                <textarea
                  value={config.notasNegocio}
                  onChange={(e) => actualizar('notasNegocio', e.target.value)}
                  rows={3}
                  style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, padding: 8 }}
                />
              </label>

              <button onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>

            <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14, display: 'grid', gap: '0.5rem' }}>
              <h3>🏦 Saldo en bancos</h3>
              <p style={{ fontSize: 13, color: '#6b7280' }}>
                Este número sube solo con cada venta/abono por transferencia, y baja solo con
                cada gasto, compra o pago a proveedor por transferencia. Solo cámbialo a mano
                para poner el saldo inicial o para corregirlo si no coincide con el banco real.
              </p>
              <label>
                Saldo actual
                <input
                  type="number"
                  step="0.01"
                  value={saldoBancoInput}
                  onChange={(e) => setSaldoBancoInput(e.target.value)}
                />
              </label>
              <button onClick={guardarSaldoBanco} disabled={guardandoSaldo}>
                {guardandoSaldo ? 'Guardando...' : 'Guardar saldo en bancos'}
              </button>
            </div>

            <div
              style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14, cursor: 'pointer' }}
              onClick={onIrARecibo}
            >
              <strong>Configuración del recibo →</strong>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
                Datos del cliente, encabezado, pie de página e impresora.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
