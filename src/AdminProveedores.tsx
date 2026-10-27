import { useEffect, useState } from 'react';
import {
  obtenerProveedoresTodos,
  crearProveedorRapido,
  actualizarProveedor,
  eliminarProveedor,
  type Proveedor,
} from './api';
import { ProveedorCostos } from './ProveedorCostos';
import { AdminHistorialCompras } from './AdminHistorialCompras';

interface Props {
  onCerrar: () => void;
  esAdmin?: boolean;
  puedeVerCostos?: boolean;
}

export function AdminProveedores({ onCerrar, esAdmin, puedeVerCostos }: Props) {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const [mostrarAlta, setMostrarAlta] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [telefonoNuevo, setTelefonoNuevo] = useState('');

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreEdicion, setNombreEdicion] = useState('');
  const [telefonoEdicion, setTelefonoEdicion] = useState('');

  const [confirmandoEliminarId, setConfirmandoEliminarId] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const [proveedorCostos, setProveedorCostos] = useState<Proveedor | null>(null);
  const [proveedorCompras, setProveedorCompras] = useState<Proveedor | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      setProveedores(await obtenerProveedoresTodos());
    } catch {
      setMensaje('No se pudieron cargar los proveedores.');
    } finally {
      setCargando(false);
    }
  }

  async function crear() {
    if (!nombreNuevo.trim()) return;
    try {
      await crearProveedorRapido(nombreNuevo.trim(), telefonoNuevo.trim() || undefined);
      setNombreNuevo('');
      setTelefonoNuevo('');
      setMostrarAlta(false);
      cargar();
    } catch (err: any) {
      setMensaje(err.message || 'No se pudo crear el proveedor.');
    }
  }

  function empezarEdicion(p: Proveedor) {
    setEditandoId(p.id);
    setNombreEdicion(p.nombre);
    setTelefonoEdicion(p.telefono || '');
  }

  async function guardarEdicion() {
    if (!editandoId) return;
    try {
      await actualizarProveedor(editandoId, { nombre: nombreEdicion.trim(), telefono: telefonoEdicion.trim() });
      setEditandoId(null);
      cargar();
    } catch (err: any) {
      setMensaje(err.message || 'No se pudo actualizar el proveedor.');
    }
  }

  async function confirmarEliminar(id: string, nombre: string) {
    setEliminando(true);
    try {
      await eliminarProveedor(id);
      setMensaje(`Proveedor "${nombre}" eliminado.`);
      setConfirmandoEliminarId(null);
      cargar();
    } catch (err: any) {
      setMensaje(err.error || 'No se pudo eliminar el proveedor.');
      setConfirmandoEliminarId(null);
    } finally {
      setEliminando(false);
    }
  }

  const proveedoresFiltrados = proveedores.filter((p) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.trim().toLowerCase();
    return p.nombre.toLowerCase().includes(q) || (p.telefono || '').includes(busqueda.trim());
  });

  if (proveedorCostos) {
    return (
      <ProveedorCostos
        proveedorId={proveedorCostos.id}
        proveedorNombre={proveedorCostos.nombre}
        onCerrar={() => setProveedorCostos(null)}
      />
    );
  }

  if (proveedorCompras) {
    return <AdminHistorialCompras proveedor={proveedorCompras} onCerrar={() => setProveedorCompras(null)} />;
  }

  return (
    <div className="pantalla-centrada pantalla-arriba">
      <div className="contenido-pantalla contenido-760">
        <div className="fila-entre-centro">
          <h2>Proveedores</h2>
          <button onClick={onCerrar}>Cerrar</button>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        <div className="fila-gap-8">
          <input
            className="buscador flex-1"
            placeholder="Buscar por nombre o teléfono"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <button onClick={() => setMostrarAlta(true)} style={{ width: 'auto', padding: '0 16px' }}>
            + Nuevo
          </button>
        </div>

        {mostrarAlta && (
          <div className="tarjeta-grid-05">
            <input placeholder="Nombre" value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} />
            <input placeholder="Teléfono (opcional)" value={telefonoNuevo} onChange={(e) => setTelefonoNuevo(e.target.value)} />
            <div className="fila-gap-8">
              <button onClick={crear}>Guardar</button>
              <button onClick={() => setMostrarAlta(false)}>Cancelar</button>
            </div>
          </div>
        )}

        {cargando ? (
          <p className="t-centro-tenue">Cargando...</p>
        ) : proveedoresFiltrados.length === 0 ? (
          <p className="t-centro-tenue">No hay proveedores que coincidan.</p>
        ) : (
          <div className="lista-tarjetas grid-gap-05">
            {proveedoresFiltrados.map((p) => (
              <div key={p.id} className="tarjeta-sombra">
                {editandoId === p.id ? (
                  <div className="grid-gap-8">
                    <input value={nombreEdicion} onChange={(e) => setNombreEdicion(e.target.value)} placeholder="Nombre" />
                    <input value={telefonoEdicion} onChange={(e) => setTelefonoEdicion(e.target.value)} placeholder="Teléfono" />
                    <div className="fila-gap-8">
                      <button onClick={guardarEdicion} className="flex-1">Guardar</button>
                      <button onClick={() => setEditandoId(null)} className="flex-1">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="fila-entre-centro">
                    <div
                      onClick={puedeVerCostos ? () => setProveedorCompras(p) : undefined}
                      style={{ cursor: puedeVerCostos ? 'pointer' : undefined, flex: 1 }}
                    >
                      <strong>{p.nombre}</strong>
                      <div className="t-tenue-13">
                        {p.telefono || 'Sin teléfono'}
                        {puedeVerCostos && <span style={{ color: 'var(--acento)' }}> · Ver compras ›</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {puedeVerCostos && (
                        <button onClick={() => setProveedorCostos(p)}>Costos</button>
                      )}
                      <button onClick={() => empezarEdicion(p)}>Editar</button>
                      {esAdmin && (
                        <button
                          onClick={() => setConfirmandoEliminarId(p.id)}
                          style={{ background: 'var(--peligro-fondo)', color: 'var(--peligro)' }}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {confirmandoEliminarId === p.id && (
                  <div className="bloque-autorizacion mt-8">
                    <p className="texto-alerta fw-600">
                      ¿Seguro que quieres eliminar a "{p.nombre}"? No se puede deshacer.
                    </p>
                    <div className="fila-gap-8-mt-8">
                      <button onClick={() => confirmarEliminar(p.id, p.nombre)} disabled={eliminando} className="flex-1">
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
      </div>
    </div>
  );
}
