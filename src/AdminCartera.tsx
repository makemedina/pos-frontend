import { useEffect, useState } from 'react';
import { exportarAExcel } from './exportarExcel';
import {
  obtenerResumenCartera,
  obtenerNotasCliente,
  obtenerPagosDeNota,
  registrarPagoVenta,
  type ClienteCartera,
  type NotaCartera,
  type PagoNota,
} from './api';

interface Props {
  onCerrar: () => void;
}

type Nivel = 'clientes' | 'notas' | 'pagos';

export function AdminCartera({ onCerrar }: Props) {
  const [nivel, setNivel] = useState<Nivel>('clientes');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const [cargando, setCargando] = useState(true);

  // Nivel 1: clientes
  const [clientes, setClientes] = useState<ClienteCartera[]>([]);

  // Nivel 2: notas de un cliente
  const [clienteElegido, setClienteElegido] = useState<ClienteCartera | null>(null);
  const [notas, setNotas] = useState<NotaCartera[]>([]);
  const [verPagadas, setVerPagadas] = useState(false);

  // Nivel 3: pagos de una nota + formulario de abono
  const [notaElegida, setNotaElegida] = useState<NotaCartera | null>(null);
  const [pagos, setPagos] = useState<PagoNota[]>([]);
  const [monto, setMonto] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');

  useEffect(() => {
    cargarClientes();
  }, []);

  useEffect(() => {
    if (nivel === 'notas' && clienteElegido) cargarNotas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verPagadas]);

  async function cargarClientes() {
    setCargando(true);
    try {
      const data = await obtenerResumenCartera();
      setClientes(data);
    } catch {
      setMensaje('No se pudo cargar la cartera.');
    } finally {
      setCargando(false);
    }
  }

  async function abrirCliente(c: ClienteCartera) {
    setClienteElegido(c);
    setVerPagadas(false);
    setNivel('notas');
    setCargando(true);
    try {
      const data = await obtenerNotasCliente(c.id, false);
      setNotas(data);
    } catch {
      setMensaje('No se pudieron cargar las notas de este cliente.');
    } finally {
      setCargando(false);
    }
  }

  async function cargarNotas() {
    if (!clienteElegido) return;
    setCargando(true);
    try {
      const data = await obtenerNotasCliente(clienteElegido.id, verPagadas);
      setNotas(data);
    } catch {
      setMensaje('No se pudieron cargar las notas de este cliente.');
    } finally {
      setCargando(false);
    }
  }

  async function abrirNota(n: NotaCartera) {
    setNotaElegida(n);
    setMonto('');
    setNivel('pagos');
    setCargando(true);
    try {
      const data = await obtenerPagosDeNota(n.id);
      setPagos(data);
    } catch {
      setMensaje('No se pudo cargar el historial de pagos.');
    } finally {
      setCargando(false);
    }
  }

  function volverAClientes() {
    setNivel('clientes');
    setClienteElegido(null);
    setNotas([]);
    cargarClientes();
  }

  function volverANotas() {
    setNivel('notas');
    setNotaElegida(null);
    setPagos([]);
    cargarNotas();
  }

  async function handlePago(e: React.FormEvent) {
    e.preventDefault();
    if (!notaElegida) return;

    try {
      await registrarPagoVenta(notaElegida.id, Number(monto), metodoPago);
      setMensaje(`Pago registrado para la venta #${notaElegida.folio}`);
      setMonto('');
      // Refresca la nota (saldo actualizado) y su historial de pagos.
      const [notaData, pagosData] = await Promise.all([
        obtenerNotasCliente(clienteElegido!.id, verPagadas),
        obtenerPagosDeNota(notaElegida.id),
      ]);
      const notaActualizada = notaData.find((n) => n.id === notaElegida.id) ?? null;
      setNotaElegida(notaActualizada);
      setNotas(notaData);
      setPagos(pagosData);
    } catch (err: any) {
      if (err.code === 'MONTO_INVALIDO') {
        setMensaje(err.error || 'El monto del pago no es valido.');
      } else {
        setMensaje('No se pudo registrar el pago.');
      }
    }
  }

  const totalCartera = clientes.reduce((acc, c) => acc + c.saldoTotal, 0);

  async function exportar() {
    setExportando(true);
    setMensaje(null);
    try {
      // Una fila por NOTA pendiente (no un total por cliente): se trae
      // cada cliente con deuda y se piden sus notas una por una.
      const clientesConDeuda = clientes.filter((c) => c.saldoTotal > 0);
      const listasDeNotas = await Promise.all(
        clientesConDeuda.map((c) => obtenerNotasCliente(c.id, false))
      );

      const filas = clientesConDeuda.flatMap((c, idx) =>
        listasDeNotas[idx].map((n) => ({
          Cliente: c.nombre,
          Telefono: c.telefono,
          Folio: n.folio,
          Fecha: new Date(n.fecha).toLocaleDateString(),
          Total: n.total,
          'Saldo pendiente': n.saldoPendiente,
          Estado: n.estadoPago,
        }))
      );

      await exportarAExcel(filas, 'cartera-notas-pendientes');
    } catch {
      setMensaje('No se pudo generar el reporte de cartera.');
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>
            {nivel === 'clientes' && 'Cartera'}
            {nivel === 'notas' && `Notas de ${clienteElegido?.nombre}`}
            {nivel === 'pagos' && `Venta #${notaElegida?.folio}`}
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {nivel === 'clientes' && (
              <button onClick={exportar} disabled={exportando}>
                {exportando ? 'Generando...' : '📊 Exportar Excel'}
              </button>
            )}
            <button onClick={onCerrar}>Cerrar</button>
          </div>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {cargando && <p>Cargando...</p>}

        {/* ---------- NIVEL 1: CLIENTES ---------- */}
        {!cargando && nivel === 'clientes' && (
          <>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {clientes.length === 0 && <p style={{ color: '#6b7280' }}>No hay clientes con historial de credito.</p>}
              {clientes.map((c) => (
                <div
                  key={c.id}
                  style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, cursor: 'pointer' }}
                  onClick={() => abrirCliente(c)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{c.nombre}</strong>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>{c.telefono}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: c.saldoTotal > 0 ? '#b91c1c' : '#16a34a' }}>
                        ${c.saldoTotal.toFixed(2)}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        {c.notasConSaldo} nota{c.notasConSaldo !== 1 ? 's' : ''} pendiente{c.notasConSaldo !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {clientes.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  borderRadius: 14,
                  background: '#f8fafc',
                  fontWeight: 700,
                }}
              >
                <span>Total en cartera</span>
                <span>${totalCartera.toFixed(2)}</span>
              </div>
            )}
          </>
        )}

        {/* ---------- NIVEL 2: NOTAS DE UN CLIENTE ---------- */}
        {!cargando && nivel === 'notas' && (
          <>
            <button onClick={volverAClientes} style={{ justifySelf: 'start' }}>← Todos los clientes</button>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input type="checkbox" checked={verPagadas} onChange={(e) => setVerPagadas(e.target.checked)} />
              Ver tambien las notas ya pagadas
            </label>

            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {notas.length === 0 && <p style={{ color: '#6b7280' }}>No hay notas para mostrar.</p>}
              {notas.map((n) => (
                <div
                  key={n.id}
                  style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, cursor: 'pointer' }}
                  onClick={() => abrirNota(n)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>Venta #{n.folio}</strong>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>{new Date(n.fecha).toLocaleDateString()}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div>Total: ${n.total.toFixed(2)}</div>
                      <div style={{ fontSize: 12, color: n.estadoPago === 'pagada' ? '#16a34a' : '#b91c1c' }}>
                        {n.estadoPago === 'pagada' ? 'Pagada' : `Saldo: $${n.saldoPendiente.toFixed(2)}`}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ---------- NIVEL 3: PAGOS DE UNA NOTA ---------- */}
        {!cargando && nivel === 'pagos' && notaElegida && (
          <>
            <button onClick={volverANotas} style={{ justifySelf: 'start' }}>← Notas de {clienteElegido?.nombre}</button>

            <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total de la nota</span>
                <strong>${notaElegida.total.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Saldo pendiente</span>
                <strong className={notaElegida.saldoPendiente > 0 ? 'texto-alerta' : ''}>
                  ${notaElegida.saldoPendiente.toFixed(2)}
                </strong>
              </div>
            </div>

            <h3>Historial de pagos</h3>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {pagos.length === 0 && <p style={{ color: '#6b7280' }}>Aun no se ha registrado ningun pago.</p>}
              {pagos.map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderBottom: '1px solid #e5e5ea', paddingBottom: 6 }}>
                  <span>
                    {new Date(p.fecha).toLocaleString()} · {p.metodoPago}
                    <br />
                    <small style={{ color: '#6b7280' }}>Registro: {p.registradoPor.nombre}</small>
                  </span>
                  <strong>${p.monto.toFixed(2)}</strong>
                </div>
              ))}
            </div>

            {notaElegida.saldoPendiente > 0 && (
              <form onSubmit={handlePago} style={{ display: 'grid', gap: '0.75rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
                <h3>Registrar nuevo abono</h3>
                <label>
                  Monto (saldo pendiente: ${notaElegida.saldoPendiente.toFixed(2)})
                  <input
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    type="number"
                    step="0.01"
                    max={notaElegida.saldoPendiente}
                    required
                  />
                </label>
                <label>
                  Metodo de pago
                  <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
                </label>
                <button type="submit">Guardar pago</button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
