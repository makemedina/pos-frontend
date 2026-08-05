import { useEffect, useState } from 'react';
import {
  obtenerProveedoresTodos,
  crearProveedorRapido,
  actualizarProveedor,
  type Proveedor,
} from './api';

interface Props {
  onCerrar: () => void;
}

export function AdminProveedores({ onCerrar }: Props) {
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

  const proveedoresFiltrados = proveedores.filter((p) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.trim().toLowerCase();
    return p.nombre.toLowerCase().includes(q) || (p.telefono || '').includes(busqueda.trim());
  });

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Proveedores</h2>
          <button onClick={onCerrar}>Cerrar</button>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="buscador"
            placeholder="Buscar por nombre o teléfono"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ flex: 1 }}
          />
          <button onClick={() => setMostrarAlta(true)} style={{ width: 'auto', padding: '0 16px' }}>
            + Nuevo
          </button>
        </div>

        {mostrarAlta && (
          <div style={{ display: 'grid', gap: '0.5rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
            <input placeholder="Nombre" value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} />
            <input placeholder="Teléfono (opcional)" value={telefonoNuevo} onChange={(e) => setTelefonoNuevo(e.target.value)} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={crear}>Guardar</button>
              <button onClick={() => setMostrarAlta(false)}>Cancelar</button>
            </div>
          </div>
        )}

        {cargando ? (
          <p style={{ textAlign: 'center', color: '#6b7280' }}>Cargando...</p>
        ) : proveedoresFiltrados.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#6b7280' }}>No hay proveedores que coincidan.</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {proveedoresFiltrados.map((p) => (
              <div key={p.id} style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14 }}>
                {editandoId === p.id ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <input value={nombreEdicion} onChange={(e) => setNombreEdicion(e.target.value)} placeholder="Nombre" />
                    <input value={telefonoEdicion} onChange={(e) => setTelefonoEdicion(e.target.value)} placeholder="Teléfono" />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={guardarEdicion} style={{ flex: 1 }}>Guardar</button>
                      <button onClick={() => setEditandoId(null)} style={{ flex: 1 }}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{p.nombre}</strong>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>{p.telefono || 'Sin teléfono'}</div>
                    </div>
                    <button onClick={() => empezarEdicion(p)}>Editar</button>
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
