import { useEffect, useState } from 'react';
import {
  obtenerClientesConSaldo,
  obtenerClienteDetalle,
  crearClienteCompleto,
  importarClientes,
  actualizarCliente,
  obtenerVentasDeCliente,
  obtenerMovimientosDeCliente,
  type ClienteConSaldo,
  type VentaDeCliente,
  type MovimientoCliente,
} from './api';
import { VentaDetalleModal } from './VentaDetalleModal';
import { exportarAExcel } from './exportarExcel';
import { obtenerClientesCache } from './offline';

interface Props {
  onCerrar: () => void;
  esAdmin: boolean;
}

type Filtro = 'todos' | 'conDeuda' | 'sinDeuda';
type Pestana = 'datos' | 'transacciones' | 'movimientos';

export function AdminClientes({ onCerrar, esAdmin }: Props) {
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [clientes, setClientes] = useState<ClienteConSaldo[]>([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [mostrarAlta, setMostrarAlta] = useState(false);
  const [mostrarImportar, setMostrarImportar] = useState(false);
  const [textoImportar, setTextoImportar] = useState('');
  const [importando, setImportando] = useState(false);

  const [nombreNuevo, setNombreNuevo] = useState('');
  const [telefonoNuevo, setTelefonoNuevo] = useState('');
  const [direccionNueva, setDireccionNueva] = useState('');

  const [clienteId, setClienteId] = useState<string | null>(null);
  const [cliente, setCliente] = useState<ClienteConSaldo | null>(null);
  const [pestana, setPestana] = useState<Pestana>('datos');

  // Edicion de datos generales
  const [editNombre, setEditNombre] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editDireccion, setEditDireccion] = useState('');
  const [editPermiteCredito, setEditPermiteCredito] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Transacciones
  const [ventas, setVentas] = useState<VentaDeCliente[]>([]);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [cargandoVentas, setCargandoVentas] = useState(false);

  // Movimientos
  const [movimientos, setMovimientos] = useState<MovimientoCliente[]>([]);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false);

  const [notaAbierta, setNotaAbierta] = useState<string | null>(null);

  useEffect(() => {
    cargarLista();
  }, [filtro]);

  async function cargarLista() {
    setCargandoLista(true);
    try {
      const data = await obtenerClientesConSaldo(filtro);
      setClientes(data);
    } catch {
      // Sin conexion: se usa la copia local guardada la ultima vez que hubo internet.
      const enCache = obtenerClientesCache();
      if (enCache.length > 0) {
        const filtrados =
          filtro === 'conDeuda'
            ? enCache.filter((c) => c.saldoTotal > 0)
            : filtro === 'sinDeuda'
              ? enCache.filter((c) => c.saldoTotal <= 0)
              : enCache;
        setClientes(filtrados);
        setMensaje('Sin conexión: mostrando los clientes guardados la última vez que hubo internet.');
      } else {
        setMensaje('No se pudieron cargar los clientes.');
      }
    } finally {
      setCargandoLista(false);
    }
  }

  async function crearNuevoCliente() {
    if (!nombreNuevo || !telefonoNuevo) return;
    try {
      await crearClienteCompleto({ nombre: nombreNuevo, telefono: telefonoNuevo, direccion: direccionNueva || undefined });
      setNombreNuevo('');
      setTelefonoNuevo('');
      setDireccionNueva('');
      setMostrarAlta(false);
      cargarLista();
    } catch {
      setMensaje('No se pudo crear el cliente.');
    }
  }

  async function importarLista() {
    const nombres = textoImportar.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (nombres.length === 0) return;
    setImportando(true);
    try {
      const { creados } = await importarClientes(nombres);
      setMensaje(`Se importaron ${creados} clientes.`);
      setTextoImportar('');
      setMostrarImportar(false);
      cargarLista();
    } catch (err: any) {
      setMensaje(err.message || 'No se pudo importar la lista.');
    } finally {
      setImportando(false);
    }
  }

  async function abrirCliente(id: string) {
    setClienteId(id);
    setPestana('datos');
    setVentas([]);
    setMovimientos([]);
    try {
      const data = await obtenerClienteDetalle(id);
      setCliente(data);
      setEditNombre(data.nombre);
      setEditTelefono(data.telefono);
      setEditDireccion(data.direccion || '');
      setEditPermiteCredito(data.permiteVentaCredito);
    } catch {
      // Sin conexion: usamos lo que ya teniamos de la lista (viene de la
      // caché si estamos offline), en vez de fallar por completo.
      const enLista = clientes.find((c) => c.id === id);
      if (enLista) {
        setCliente(enLista);
        setEditNombre(enLista.nombre);
        setEditTelefono(enLista.telefono);
        setEditDireccion(enLista.direccion || '');
        setEditPermiteCredito(enLista.permiteVentaCredito);
        setMensaje('Sin conexión: datos guardados localmente. Transacciones y movimientos no están disponibles.');
      } else {
        setMensaje('No se pudo cargar el cliente.');
      }
    }
  }

  function volverALista() {
    setClienteId(null);
    setCliente(null);
    cargarLista();
  }

  async function guardarDatosGenerales() {
    if (!clienteId) return;
    setGuardando(true);
    try {
      const datos: any = { nombre: editNombre, telefono: editTelefono, direccion: editDireccion };
      if (esAdmin) datos.permiteVentaCredito = editPermiteCredito;
      const actualizado = await actualizarCliente(clienteId, datos);
      setCliente((prev) => (prev ? { ...prev, ...actualizado } : prev));
      setMensaje('Datos guardados.');
    } catch {
      setMensaje('No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  async function irAPestana(p: Pestana) {
    setPestana(p);
    if (!clienteId) return;
    if (p === 'transacciones' && ventas.length === 0) {
      setCargandoVentas(true);
      try {
        setVentas(await obtenerVentasDeCliente(clienteId));
      } catch {
        setMensaje('No se pudieron cargar las transacciones.');
      } finally {
        setCargandoVentas(false);
      }
    }
    if (p === 'movimientos' && movimientos.length === 0) {
      setCargandoMovimientos(true);
      try {
        const data = await obtenerMovimientosDeCliente(clienteId);
        setMovimientos(data.movimientos);
      } catch {
        setMensaje('No se pudieron cargar los movimientos.');
      } finally {
        setCargandoMovimientos(false);
      }
    }
  }

  const clientesFiltrados = clientes.filter((c) => {
    if (!busquedaCliente.trim()) return true;
    const q = busquedaCliente.trim().toLowerCase();
    return c.nombre.toLowerCase().includes(q) || c.telefono.includes(busquedaCliente.trim());
  });

  const ventasFiltradas = ventas.filter((v) => {
    if (!busquedaProducto.trim()) return true;
    const q = busquedaProducto.trim().toLowerCase();
    return v.items.some(
      (it) =>
        it.producto.toLowerCase().includes(q) ||
        it.marca.toLowerCase().includes(q) ||
        it.productoId.toLowerCase().includes(q)
    );
  });

  async function exportar() {
    try {
      await exportarAExcel(
        clientes.map((c) => ({
          Nombre: c.nombre,
          Telefono: c.telefono,
          Domicilio: c.direccion || '',
          'Permite credito': c.permiteVentaCredito ? 'Si' : 'No',
          'Saldo total': c.saldoTotal,
        })),
        'clientes'
      );
    } catch {
      setMensaje('No hay clientes para exportar.');
    }
  }

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>{cliente ? cliente.nombre : 'Clientes'}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {!clienteId && <button onClick={exportar}>📊 Exportar Excel</button>}
            <button onClick={clienteId ? volverALista : onCerrar}>
              {clienteId ? '← Clientes' : 'Cerrar'}
            </button>
          </div>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {/* ---------- LISTA DE CLIENTES ---------- */}
        {!clienteId && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <select value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)}>
                <option value="todos">Todos los clientes</option>
                <option value="conDeuda">Con deuda</option>
                <option value="sinDeuda">Sin deuda</option>
              </select>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setMostrarAlta(true)}>+ Nuevo cliente</button>
                <button onClick={() => setMostrarImportar(true)}>📋 Importar lista</button>
              </div>
            </div>

            {mostrarAlta && (
              <div style={{ display: 'grid', gap: '0.5rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
                <input placeholder="Nombre" value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} />
                <input placeholder="Teléfono" value={telefonoNuevo} onChange={(e) => setTelefonoNuevo(e.target.value)} />
                <input placeholder="Domicilio (opcional)" value={direccionNueva} onChange={(e) => setDireccionNueva(e.target.value)} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={crearNuevoCliente}>Guardar</button>
                  <button onClick={() => setMostrarAlta(false)}>Cancelar</button>
                </div>
              </div>
            )}

            {mostrarImportar && (
              <div style={{ display: 'grid', gap: '0.5rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
                <p style={{ fontSize: 13, color: '#6b7280' }}>
                  Pega la lista de nombres, uno por línea. Se crean sin teléfono — lo puedes
                  agregar después desde el detalle de cada cliente.
                </p>
                <textarea
                  rows={10}
                  placeholder={'Luis Valdez\nManuel Garcia\nDavid Erenas\n...'}
                  value={textoImportar}
                  onChange={(e) => setTextoImportar(e.target.value)}
                  style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={importarLista} disabled={importando}>
                    {importando ? 'Importando...' : `Importar ${textoImportar.split('\n').filter((l) => l.trim()).length} clientes`}
                  </button>
                  <button onClick={() => setMostrarImportar(false)}>Cancelar</button>
                </div>
              </div>
            )}

            <input
              className="buscador"
              placeholder="Buscar por nombre o teléfono"
              value={busquedaCliente}
              onChange={(e) => setBusquedaCliente(e.target.value)}
            />

            {cargandoLista ? (
              <p>Cargando...</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {clientesFiltrados.length === 0 && <p style={{ color: '#6b7280' }}>No hay clientes que coincidan.</p>}
                {clientesFiltrados.map((c) => (
                  <div
                    key={c.id}
                    style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                    onClick={() => abrirCliente(c.id)}
                  >
                    <div>
                      <strong>{c.nombre}</strong>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>{c.telefono}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 700, color: c.saldoTotal > 0 ? '#b91c1c' : '#16a34a' }}>
                      ${c.saldoTotal.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ---------- DETALLE DE UN CLIENTE ---------- */}
        {clienteId && cliente && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: '#6b7280' }}>Saldo</span>
              <strong style={{ fontSize: 18, color: cliente.saldoTotal > 0 ? '#b91c1c' : '#16a34a' }}>
                ${cliente.saldoTotal.toFixed(2)}
              </strong>
            </div>

            <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e5e7eb' }}>
              {(['datos', 'transacciones', 'movimientos'] as Pestana[]).map((p) => (
                <button
                  key={p}
                  onClick={() => irAPestana(p)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '8px 4px',
                    borderBottom: pestana === p ? '2px solid #007aff' : '2px solid transparent',
                    fontWeight: pestana === p ? 700 : 400,
                    color: pestana === p ? '#007aff' : '#374151',
                  }}
                >
                  {p === 'datos' ? 'Datos generales' : p === 'transacciones' ? 'Transacciones' : 'Movimientos'}
                </button>
              ))}
            </div>

            {pestana === 'datos' && (
              <div style={{ display: 'grid', gap: '0.75rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
                <label>
                  Nombre
                  <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} />
                </label>
                <label>
                  Teléfono
                  <input value={editTelefono} onChange={(e) => setEditTelefono(e.target.value)} />
                </label>
                <label>
                  Domicilio
                  <input value={editDireccion} onChange={(e) => setEditDireccion(e.target.value)} />
                </label>

                {esAdmin && (
                  <div className="fila-switch">
                    <span>Permitir ventas a crédito</span>
                    <button
                      className={`switch ${editPermiteCredito ? 'on' : ''}`}
                      onClick={() => setEditPermiteCredito(!editPermiteCredito)}
                    >
                      <span className="switch-bola" />
                    </button>
                  </div>
                )}

                <button onClick={guardarDatosGenerales} disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            )}

            {pestana === 'transacciones' && (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <input
                  className="buscador"
                  placeholder="Buscar por producto, marca o código"
                  value={busquedaProducto}
                  onChange={(e) => setBusquedaProducto(e.target.value)}
                />
                {cargandoVentas ? (
                  <p>Cargando...</p>
                ) : ventasFiltradas.length === 0 ? (
                  <p style={{ color: '#6b7280' }}>No hay transacciones que coincidan.</p>
                ) : (
                  ventasFiltradas.map((v) => (
                    <div
                      key={v.id}
                      style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, cursor: 'pointer' }}
                      onClick={() => setNotaAbierta(v.id)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <strong>Venta #{v.folio}</strong>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>{new Date(v.fecha).toLocaleDateString()}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div>${v.total.toFixed(2)}</div>
                          <div style={{ fontSize: 12, color: v.estadoPago === 'pagada' ? '#16a34a' : '#b91c1c' }}>
                            {v.estadoPago === 'pagada' ? 'Pagada' : `Saldo: $${v.saldoPendiente.toFixed(2)}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {pestana === 'movimientos' && (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {cargandoMovimientos ? (
                  <p>Cargando...</p>
                ) : movimientos.length === 0 ? (
                  <p style={{ color: '#6b7280' }}>Sin movimientos.</p>
                ) : (
                  movimientos.map((m) => (
                    <div
                      key={`${m.tipo}-${m.id}`}
                      style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderBottom: '1px solid #e5e5ea', paddingBottom: 6 }}
                    >
                      <span>
                        {m.tipo === 'venta' ? '🛒 Venta' : '💵 Abono'} #{m.folio}
                        <br />
                        <small style={{ color: '#6b7280' }}>{new Date(m.fecha).toLocaleString()}</small>
                      </span>
                      <strong style={{ color: m.tipo === 'venta' ? '#b91c1c' : '#16a34a' }}>
                        {m.tipo === 'venta' ? '+' : '-'}${m.monto.toFixed(2)}
                      </strong>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {notaAbierta && (
        <VentaDetalleModal
          ventaId={notaAbierta}
          esAdmin={esAdmin}
          onCerrar={() => setNotaAbierta(null)}
          onCancelada={() => {
            setVentas([]);
            setMovimientos([]);
            if (pestana === 'transacciones' || pestana === 'movimientos') irAPestana(pestana);
          }}
        />
      )}
    </div>
  );
}
