import { useEffect, useState } from 'react';
import { headerAuth, API_URL } from './api';

interface UsuarioAdmin {
  id: string;
  nombre: string;
  telefono: string;
  rolBase: string;
  activo: boolean;
  permisos: {
    puedeVerCostos: boolean;
    puedeRegistrarCompras: boolean;
    puedeVerUtilidad: boolean;
    puedeVerCarteraGeneral: boolean;
    puedeVerGastosTodos: boolean;
    puedeAutorizar: boolean;
    puedeRegistrarPagos: boolean;
  } | null;
}

interface Props {
  onCerrar: () => void;
}

export function AdminUsuarios({ onCerrar }: Props) {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [pin, setPin] = useState('');
  const [pinUsuario, setPinUsuario] = useState('');
  const [nombreEdicion, setNombreEdicion] = useState('');
  const [telefonoEdicion, setTelefonoEdicion] = useState('');
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<UsuarioAdmin | null>(null);
  const [permisos, setPermisos] = useState({
    puedeVerCostos: false,
    puedeRegistrarCompras: false,
    puedeVerUtilidad: false,
    puedeVerCarteraGeneral: false,
    puedeVerGastosTodos: false,
    puedeAutorizar: false,
    puedeRegistrarPagos: false,
  });
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch(`${API_URL}/usuarios`, { headers: headerAuth() });
      if (!res.ok) throw new Error('No se pudo cargar');
      setUsuarios(await res.json());
    } catch {
      setMensaje('No se pudo cargar la lista de usuarios');
    } finally {
      setCargando(false);
    }
  }

  async function crearUsuario(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/usuarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headerAuth() },
        body: JSON.stringify({ nombre, telefono, pin }),
      });
      if (!res.ok) throw new Error('No se pudo crear');
      setMensaje('Usuario creado correctamente');
      setNombre('');
      setTelefono('');
      setPin('');
      cargar();
    } catch {
      setMensaje('No se pudo crear el usuario');
    }
  }

  async function cambiarPin(e: React.FormEvent) {
    e.preventDefault();
    if (!usuarioSeleccionado) return;
    try {
      const res = await fetch(`${API_URL}/usuarios/${usuarioSeleccionado.id}/pin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headerAuth() },
        body: JSON.stringify({ pin: pinUsuario }),
      });
      if (!res.ok) throw new Error('No se pudo actualizar');
      setMensaje(`PIN actualizado para ${usuarioSeleccionado.nombre}`);
      setPinUsuario('');
      setUsuarioSeleccionado(null);
      cargar();
    } catch {
      setMensaje('No se pudo actualizar el PIN');
    }
  }

  async function guardarDatos(e: React.FormEvent) {
    e.preventDefault();
    if (!usuarioSeleccionado) return;
    try {
      const res = await fetch(`${API_URL}/usuarios/${usuarioSeleccionado.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headerAuth() },
        body: JSON.stringify({ nombre: nombreEdicion, telefono: telefonoEdicion }),
      });
      if (!res.ok) throw new Error('No se pudo actualizar');
      setMensaje('Datos actualizados correctamente');
      setUsuarioSeleccionado(null);
      cargar();
    } catch {
      setMensaje('No se pudo actualizar el nombre/teléfono');
    }
  }

  async function guardarPermisos(e: React.FormEvent) {
    e.preventDefault();
    if (!usuarioSeleccionado) return;
    try {
      const res = await fetch(`${API_URL}/usuarios/${usuarioSeleccionado.id}/permisos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headerAuth() },
        body: JSON.stringify(permisos),
      });
      if (!res.ok) throw new Error('No se pudo guardar');
      setMensaje(`Permisos actualizados para ${usuarioSeleccionado.nombre}`);
      cargar();
    } catch {
      setMensaje('No se pudo actualizar los permisos');
    }
  }

  function actualizarPermiso(nombre: keyof typeof permisos, valor: boolean) {
    setPermisos((prev) => ({ ...prev, [nombre]: valor }));
  }

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Usuarios</h2>
          <button onClick={onCerrar}>Cerrar</button>
        </div>

        {mensaje && <div className="banner-mensaje">{mensaje}</div>}

        <form onSubmit={crearUsuario} style={{ display: 'grid', gap: '0.75rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
          <h3>Agregar usuario</h3>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" required />
          <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Teléfono" required />
          <input value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN" required />
          <button type="submit">Crear usuario</button>
        </form>

        {cargando ? <p>Cargando...</p> : null}

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {usuarios.map((usuario) => (
            <div key={usuario.id} style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{usuario.nombre}</strong>
                  <div>{usuario.telefono}</div>
                  <div>{usuario.rolBase}</div>
                </div>
                <button onClick={() => {
                  setUsuarioSeleccionado(usuario);
                  setNombreEdicion(usuario.nombre);
                  setTelefonoEdicion(usuario.telefono);
                  setPermisos({
                    puedeVerCostos: usuario.permisos?.puedeVerCostos ?? false,
                    puedeRegistrarCompras: usuario.permisos?.puedeRegistrarCompras ?? false,
                    puedeVerUtilidad: usuario.permisos?.puedeVerUtilidad ?? false,
                    puedeVerCarteraGeneral: usuario.permisos?.puedeVerCarteraGeneral ?? false,
                    puedeVerGastosTodos: usuario.permisos?.puedeVerGastosTodos ?? false,
                    puedeAutorizar: usuario.permisos?.puedeAutorizar ?? false,
                    puedeRegistrarPagos: usuario.permisos?.puedeRegistrarPagos ?? false,
                  });
                }}>Editar</button>
              </div>
            </div>
          ))}
        </div>

        {usuarioSeleccionado && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <form onSubmit={guardarDatos} style={{ display: 'grid', gap: '0.75rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
              <h3>Datos de {usuarioSeleccionado.nombre}</h3>
              <input value={nombreEdicion} onChange={(e) => setNombreEdicion(e.target.value)} placeholder="Nombre" required />
              <input value={telefonoEdicion} onChange={(e) => setTelefonoEdicion(e.target.value)} placeholder="Teléfono" required />
              <button type="submit">Guardar datos</button>
            </form>

            <form onSubmit={cambiarPin} style={{ display: 'grid', gap: '0.75rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
              <h3>Cambiar PIN de {usuarioSeleccionado.nombre}</h3>
              <input value={pinUsuario} onChange={(e) => setPinUsuario(e.target.value)} placeholder="Nuevo PIN" required />
              <button type="submit">Actualizar PIN</button>
            </form>

            <form onSubmit={guardarPermisos} style={{ display: 'grid', gap: '0.75rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
              <h3>Permisos</h3>
              {Object.entries(permisos).map(([key, value]) => (
                <label key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</span>
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => actualizarPermiso(key as keyof typeof permisos, e.target.checked)}
                  />
                </label>
              ))}
              <button type="submit">Guardar permisos</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
