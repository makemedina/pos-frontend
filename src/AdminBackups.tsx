import { useEffect, useState } from 'react';
import {
  obtenerBackups,
  crearBackupManual,
  eliminarBackup,
  restaurarBackup,
  descargarBackup,
  type BackupInfo,
} from './api';

interface Props {
  onCerrar: () => void;
}

function formatoTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function etiquetaTipo(tipo: BackupInfo['tipo']): { texto: string; color: string } {
  if (tipo === 'automatico') return { texto: 'Automático (medianoche)', color: '#007aff' };
  if (tipo === 'pre-restauracion') return { texto: 'Antes de una restauración', color: '#b45309' };
  return { texto: 'Manual', color: '#16a34a' };
}

export function AdminBackups({ onCerrar }: Props) {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [noConfigurado, setNoConfigurado] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [ocupadoKey, setOcupadoKey] = useState<string | null>(null);

  const [confirmandoRestaurarKey, setConfirmandoRestaurarKey] = useState<string | null>(null);
  const [textoConfirmacion, setTextoConfirmacion] = useState('');
  const [restaurando, setRestaurando] = useState(false);

  const [confirmandoEliminarKey, setConfirmandoEliminarKey] = useState<string | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    setNoConfigurado(null);
    try {
      setBackups(await obtenerBackups());
    } catch (err: any) {
      if (err.code === 'BACKUP_NO_CONFIGURADO') {
        setNoConfigurado(err.error);
      } else {
        setMensaje('No se pudieron cargar los respaldos.');
      }
    } finally {
      setCargando(false);
    }
  }

  async function hacerBackupAhora() {
    setCreando(true);
    setMensaje(null);
    try {
      await crearBackupManual();
      setMensaje('Respaldo creado.');
      cargar();
    } catch (err: any) {
      setMensaje(err.error || 'No se pudo crear el respaldo.');
    } finally {
      setCreando(false);
    }
  }

  async function descargar(key: string) {
    setOcupadoKey(key);
    setMensaje(null);
    try {
      await descargarBackup(key);
    } catch (err: any) {
      setMensaje(err.message || 'No se pudo descargar el respaldo.');
    } finally {
      setOcupadoKey(null);
    }
  }

  function pedirEliminar(key: string) {
    setConfirmandoEliminarKey(key);
  }

  async function confirmarEliminar(key: string) {
    setOcupadoKey(key);
    try {
      await eliminarBackup(key);
      setConfirmandoEliminarKey(null);
      cargar();
    } catch (err: any) {
      setMensaje(err.error || 'No se pudo eliminar el respaldo.');
    } finally {
      setOcupadoKey(null);
    }
  }

  function pedirRestaurar(key: string) {
    setConfirmandoRestaurarKey(key);
    setTextoConfirmacion('');
  }

  async function confirmarRestaurar() {
    if (!confirmandoRestaurarKey || textoConfirmacion !== 'RESTAURAR') return;
    setRestaurando(true);
    setMensaje(null);
    try {
      await restaurarBackup(confirmandoRestaurarKey, textoConfirmacion);
      alert(
        'Restauración completa. La base de datos volvió al estado de ese respaldo. ' +
          'La página se va a recargar.'
      );
      window.location.reload();
    } catch (err: any) {
      setMensaje(err.error || 'No se pudo restaurar el respaldo.');
      setRestaurando(false);
    }
  }

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Respaldos</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={hacerBackupAhora} disabled={creando || !!noConfigurado}>
              {creando ? 'Creando...' : '💾 Hacer backup ahora'}
            </button>
            <button onClick={onCerrar}>Cerrar</button>
          </div>
        </div>

        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
          Respaldo completo de toda la base de datos (ventas, compras, clientes, proveedores,
          inventario, todo). Se guarda fuera del sistema, en Cloudflare. Además del botón manual,
          todos los días a medianoche se hace uno automático.
        </p>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {noConfigurado && (
          <div className="aviso-alerta">
            ⚠️ {noConfigurado}
          </div>
        )}

        {cargando ? (
          <p style={{ textAlign: 'center', color: '#6b7280' }}>Cargando...</p>
        ) : !noConfigurado && backups.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#6b7280' }}>Todavía no hay ningún respaldo.</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {backups.map((b) => {
              const etiqueta = etiquetaTipo(b.tipo);
              return (
                <div key={b.key} style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong>{new Date(b.fecha).toLocaleString()}</strong>
                      <div style={{ fontSize: 12, color: etiqueta.color, fontWeight: 600 }}>{etiqueta.texto}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{formatoTamano(b.tamano)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button onClick={() => descargar(b.key)} disabled={ocupadoKey === b.key}>
                        ⬇️ Descargar
                      </button>
                      <button
                        onClick={() => pedirRestaurar(b.key)}
                        style={{ background: '#fff2f1', color: '#b91c1c' }}
                      >
                        Restaurar
                      </button>
                      <button
                        onClick={() => pedirEliminar(b.key)}
                        style={{ background: '#fff2f1', color: '#b91c1c' }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  {confirmandoEliminarKey === b.key && (
                    <div className="bloque-autorizacion" style={{ marginTop: 8 }}>
                      <p className="texto-alerta" style={{ fontWeight: 600 }}>
                        ¿Eliminar este respaldo? No se puede deshacer.
                      </p>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button onClick={() => confirmarEliminar(b.key)} disabled={ocupadoKey === b.key} style={{ flex: 1 }}>
                          {ocupadoKey === b.key ? 'Eliminando...' : 'Sí, eliminar'}
                        </button>
                        <button onClick={() => setConfirmandoEliminarKey(null)} style={{ flex: 1 }}>
                          No, regresar
                        </button>
                      </div>
                    </div>
                  )}

                  {confirmandoRestaurarKey === b.key && (
                    <div className="bloque-autorizacion" style={{ marginTop: 8 }}>
                      <p className="texto-alerta" style={{ fontWeight: 600 }}>
                        Esto va a BORRAR todo lo que hay ahorita en el sistema y lo va a reemplazar
                        con lo que había en este respaldo ({new Date(b.fecha).toLocaleString()}).
                        Antes de empezar se guarda automáticamente un respaldo de cómo está todo
                        justo ahora, por si te equivocas de respaldo. Esto no se puede deshacer de
                        otra forma.
                      </p>
                      <label style={{ fontSize: 13 }}>
                        Escribe <strong>RESTAURAR</strong> para confirmar:
                      </label>
                      <input
                        value={textoConfirmacion}
                        onChange={(e) => setTextoConfirmacion(e.target.value)}
                        placeholder="RESTAURAR"
                      />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          onClick={confirmarRestaurar}
                          disabled={textoConfirmacion !== 'RESTAURAR' || restaurando}
                          style={{ flex: 1, background: '#b91c1c', color: 'white' }}
                        >
                          {restaurando ? 'Restaurando...' : 'Confirmar y restaurar'}
                        </button>
                        <button
                          onClick={() => { setConfirmandoRestaurarKey(null); setTextoConfirmacion(''); }}
                          style={{ flex: 1 }}
                          disabled={restaurando}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
