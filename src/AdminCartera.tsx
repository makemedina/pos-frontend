import { useEffect, useState } from 'react';
import { formatoMoneda } from './formato';
import { exportarAExcel } from './exportarExcel';
import { ComprobantePagoModal, type DatosComprobantePago } from './ComprobantePagoModal';
import {
  obtenerResumenCartera,
  obtenerNotasCliente,
  obtenerPagosDeNota,
  registrarPagoVenta,
  registrarPagoMultiNota,
  cancelarPagoVenta,
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
  const [busquedaCartera, setBusquedaCartera] = useState('');
  const [comprobanteActivo, setComprobanteActivo] = useState<DatosComprobantePago | null>(null);
  const [exportando, setExportando] = useState(false);
  const [cargando, setCargando] = useState(true);

  // Nivel 1: clientes
  const [clientes, setClientes] = useState<ClienteCartera[]>([]);

  // Nivel 2: notas de un cliente
  const [clienteElegido, setClienteElegido] = useState<ClienteCartera | null>(null);
  const [notas, setNotas] = useState<NotaCartera[]>([]);
  const [verPagadas, setVerPagadas] = useState(false);

  // Pago repartido entre varias notas (desde el nivel de notas)
  const [mostrarPagoMultiple, setMostrarPagoMultiple] = useState(false);
  const [metodoPagoMultiple, setMetodoPagoMultiple] = useState('efectivo');
  const [montoPagoMultiple, setMontoPagoMultiple] = useState('');
  const [asignacionesPago, setAsignacionesPago] = useState<Record<string, string>>({});
  const [guardandoPagoMultiple, setGuardandoPagoMultiple] = useState(false);

  // Nivel 3: pagos de una nota + formulario de abono
  const [notaElegida, setNotaElegida] = useState<NotaCartera | null>(null);
  const [pagos, setPagos] = useState<PagoNota[]>([]);
  const [monto, setMonto] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');

  // Cancelar un pago ya registrado
  const [confirmandoCancelarPagoId, setConfirmandoCancelarPagoId] = useState<string | null>(null);
  const [necesitaAutorizacionPago, setNecesitaAutorizacionPago] = useState(false);
  const [autorizadoPorTelefonoPago, setAutorizadoPorTelefonoPago] = useState('');
  const [autorizadoPinPago, setAutorizadoPinPago] = useState('');
  const [cancelandoPago, setCancelandoPago] = useState(false);

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
    setMostrarPagoMultiple(false);
    setAsignacionesPago({});
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
    setMostrarPagoMultiple(false);
    setConfirmandoCancelarPagoId(null);
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
    setMostrarPagoMultiple(false);
    setAsignacionesPago({});
    cargarClientes();
  }

  function abrirPagoMultiple() {
    setAsignacionesPago({});
    setMetodoPagoMultiple('efectivo');
    setMontoPagoMultiple('');
    setMostrarPagoMultiple(true);
  }

  function cerrarPagoMultiple() {
    setMostrarPagoMultiple(false);
    setAsignacionesPago({});
    setMontoPagoMultiple('');
  }

  function actualizarAsignacion(notaId: string, valor: string) {
    setAsignacionesPago((prev) => ({ ...prev, [notaId]: valor }));
  }

  // Marcar/desmarcar una nota en el checklist: al marcarla se rellena su
  // recuadro con el saldo pendiente de esa nota (editable despues); al
  // desmarcarla se le quita cualquier monto que tuviera asignado.
  function toggleNotaPago(n: NotaCartera) {
    setAsignacionesPago((prev) => {
      if (n.id in prev) {
        const { [n.id]: _omitida, ...resto } = prev;
        return resto;
      }
      return { ...prev, [n.id]: String(n.saldoPendiente) };
    });
  }

  const notasPendientesPago = notas.filter((n) => n.saldoPendiente > 0);
  const totalAsignadoPago = notasPendientesPago.reduce(
    (acc, n) => acc + (Number(asignacionesPago[n.id]) || 0),
    0
  );
  const restantePorDistribuir = Number(montoPagoMultiple || 0) - totalAsignadoPago;

  async function handlePagoMultiple(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteElegido) return;

    const asignaciones = notasPendientesPago
      .map((n) => ({ ventaId: n.id, monto: Number(asignacionesPago[n.id]) || 0 }))
      .filter((a) => a.monto > 0);

    if (asignaciones.length === 0) {
      setMensaje('Asigna un monto mayor a cero a al menos una nota.');
      return;
    }

    setGuardandoPagoMultiple(true);
    try {
      const resultado = await registrarPagoMultiNota(clienteElegido.id, asignaciones, metodoPagoMultiple);
      setComprobanteActivo({
        folioNota: resultado.detalle.map((d) => d.folio).join(', '),
        clienteNombre: clienteElegido.nombre,
        clienteTelefono: clienteElegido.telefono,
        monto: resultado.totalPagado,
        metodoPago: metodoPagoMultiple,
        fecha: new Date().toLocaleString(),
        saldoNotaRestante: 0,
        saldoTotalCliente: resultado.saldoTotalCliente,
        detalleNotas: resultado.detalle.map((d) => ({
          folio: d.folio,
          monto: d.monto,
          saldoRestante: d.saldoNotaRestante,
        })),
      });
      cerrarPagoMultiple();
      await cargarNotas();
    } catch (err: any) {
      if (err.code === 'MONTO_INVALIDO') {
        setMensaje(err.error || 'El monto del pago no es valido.');
      } else {
        setMensaje('No se pudo registrar el pago.');
      }
    } finally {
      setGuardandoPagoMultiple(false);
    }
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
      const resultado = await registrarPagoVenta(notaElegida.id, Number(monto), metodoPago);
      setMensaje(`Pago registrado para la venta #${notaElegida.folio}`);
      setComprobanteActivo({
        folioNota: notaElegida.folio,
        clienteNombre: clienteElegido!.nombre,
        clienteTelefono: clienteElegido!.telefono,
        monto: Number(monto),
        metodoPago,
        fecha: new Date().toLocaleString(),
        saldoNotaRestante: Number(resultado.saldoNotaRestante ?? 0),
        saldoTotalCliente: Number(resultado.saldoTotalCliente ?? 0),
      });
      setMonto('');
      // Refresca la nota (saldo actualizado) y su historial de pagos. Si la
      // nota quedo pagada (o con saldo a favor) y "ver tambien pagadas" esta
      // apagado, ya no viene en notaData -- se usa el saldo que ya sabemos
      // por el resultado del pago en vez de dejar la nota en null (eso
      // rompia la pantalla mostrando "Venta #undefined").
      const [notaData, pagosData] = await Promise.all([
        obtenerNotasCliente(clienteElegido!.id, verPagadas),
        obtenerPagosDeNota(notaElegida.id),
      ]);
      const saldoNotaRestante = Number(resultado.saldoNotaRestante ?? 0);
      const notaActualizada = notaData.find((n) => n.id === notaElegida.id) ?? {
        ...notaElegida,
        saldoPendiente: saldoNotaRestante,
        estadoPago: saldoNotaRestante <= 0 ? 'pagada' : 'parcial',
      };
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

  function pedirCancelarPago(pagoId: string) {
    setConfirmandoCancelarPagoId(pagoId);
    setNecesitaAutorizacionPago(false);
    setAutorizadoPorTelefonoPago('');
    setAutorizadoPinPago('');
  }

  async function confirmarCancelarPago(pagoId: string) {
    if (!notaElegida || !clienteElegido) return;
    setCancelandoPago(true);
    try {
      await cancelarPagoVenta(
        notaElegida.id,
        pagoId,
        necesitaAutorizacionPago
          ? { telefono: autorizadoPorTelefonoPago, pin: autorizadoPinPago }
          : undefined
      );
      setMensaje('Pago cancelado.');
      setConfirmandoCancelarPagoId(null);
      setNecesitaAutorizacionPago(false);
      setAutorizadoPorTelefonoPago('');
      setAutorizadoPinPago('');
      const [notaData, pagosData] = await Promise.all([
        obtenerNotasCliente(clienteElegido.id, verPagadas),
        obtenerPagosDeNota(notaElegida.id),
      ]);
      const notaActualizada = notaData.find((n) => n.id === notaElegida.id) ?? null;
      setNotaElegida(notaActualizada);
      setNotas(notaData);
      setPagos(pagosData);
    } catch (err: any) {
      if (err.code === 'REQUIERE_AUTORIZACION') {
        setNecesitaAutorizacionPago(true);
        setMensaje('Este pago es de un día anterior: se necesita el teléfono y PIN de un administrador para cancelarlo.');
      } else if (err.code === 'PAGO_YA_CANCELADO') {
        setMensaje('Este pago ya estaba cancelado.');
        setConfirmandoCancelarPagoId(null);
      } else {
        setMensaje('No se pudo cancelar el pago.');
      }
    } finally {
      setCancelandoPago(false);
    }
  }

  const clientesFiltrados = clientes.filter(
    (c) => !busquedaCartera.trim() || c.nombre.toLowerCase().includes(busquedaCartera.trim().toLowerCase())
  );
  const totalCartera = clientesFiltrados.reduce((acc, c) => acc + c.saldoTotal, 0);

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

  // Exporta las notas del cliente que se esta viendo (nivel 2). Usa lo
  // que ya esta cargado en pantalla -- si "Ver tambien las notas ya
  // pagadas" esta prendido, el reporte tambien las incluye; si no, solo
  // salen las pendientes.
  async function exportarNotasCliente() {
    if (!clienteElegido) return;
    setExportando(true);
    setMensaje(null);
    try {
      const filas = notas.map((n) => ({
        Cliente: clienteElegido.nombre,
        Telefono: clienteElegido.telefono,
        Folio: n.folio,
        Fecha: new Date(n.fecha).toLocaleDateString(),
        Total: n.total,
        'Saldo pendiente': n.saldoPendiente,
        Estado: n.estadoPago,
      }));
      const nombreArchivo = `cartera-${clienteElegido.nombre.trim().toLowerCase().replace(/\s+/g, '-')}`;
      await exportarAExcel(filas, nombreArchivo);
    } catch {
      setMensaje('No se pudo generar el reporte de este cliente.');
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
            {nivel === 'notas' && (
              <button onClick={exportarNotasCliente} disabled={exportando || notas.length === 0}>
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
            <input
              className="buscador"
              placeholder="Buscar cliente por nombre"
              value={busquedaCartera}
              onChange={(e) => setBusquedaCartera(e.target.value)}
            />
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {clientesFiltrados.length === 0 && <p style={{ color: '#6b7280' }}>No hay clientes que coincidan.</p>}
              {clientesFiltrados.map((c) => (
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
                        {formatoMoneda(Math.abs(c.saldoTotal))}
                      </div>
                      <div style={{ fontSize: 12, color: c.saldoTotal < 0 ? '#16a34a' : '#6b7280' }}>
                        {c.saldoTotal < 0
                          ? 'Saldo a favor'
                          : `${c.notasConSaldo} nota${c.notasConSaldo !== 1 ? 's' : ''} pendiente${c.notasConSaldo !== 1 ? 's' : ''}`}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {clientesFiltrados.length > 0 && (
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
                <span>{busquedaCartera.trim() ? 'Total filtrado' : 'Total en cartera'}</span>
                <span>{formatoMoneda(totalCartera)}</span>
              </div>
            )}
          </>
        )}

        {/* ---------- NIVEL 2: NOTAS DE UN CLIENTE ---------- */}
        {!cargando && nivel === 'notas' && (
          <>
            <button onClick={volverAClientes} style={{ justifySelf: 'start' }}>← Todos los clientes</button>

            {!mostrarPagoMultiple && notasPendientesPago.length > 0 && (
              <button onClick={abrirPagoMultiple} style={{ justifySelf: 'start' }}>
                + Agregar pago
              </button>
            )}

            {mostrarPagoMultiple && (
              <form
                onSubmit={handlePagoMultiple}
                style={{ display: 'grid', gap: '0.75rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0 }}>Agregar pago de {clienteElegido?.nombre}</h3>
                  <button type="button" onClick={cerrarPagoMultiple}>Cancelar</button>
                </div>

                <label>
                  Metodo de pago
                  <select value={metodoPagoMultiple} onChange={(e) => setMetodoPagoMultiple(e.target.value)}>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
                </label>

                <label>
                  Importe del pago recibido
                  <input
                    value={montoPagoMultiple}
                    onChange={(e) => setMontoPagoMultiple(e.target.value)}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                  />
                </label>

                <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
                  Marca las notas que se pagan con este importe — cada una se rellena con su saldo, pero puedes cambiarlo.
                </p>

                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {notasPendientesPago.map((n) => {
                    const seleccionada = n.id in asignacionesPago;
                    return (
                      <div
                        key={n.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #e5e5ea', paddingBottom: 6 }}
                      >
                        <input
                          type="checkbox"
                          checked={seleccionada}
                          onChange={() => toggleNotaPago(n)}
                        />
                        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => toggleNotaPago(n)}>
                          <strong>Venta #{n.folio}</strong>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>
                            Saldo: {formatoMoneda(n.saldoPendiente)}
                          </div>
                        </div>
                        {seleccionada && (
                          <input
                            value={asignacionesPago[n.id] ?? ''}
                            onChange={(e) => actualizarAsignacion(n.id, e.target.value)}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            style={{ width: 110, textAlign: 'right' }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 10,
                    background: restantePorDistribuir < 0 ? '#fff2f1' : '#f8fafc',
                    fontWeight: 700,
                  }}
                >
                  <span>Por distribuir</span>
                  <span style={{ color: restantePorDistribuir < 0 ? '#b91c1c' : undefined }}>
                    {formatoMoneda(restantePorDistribuir)}
                  </span>
                </div>
                {restantePorDistribuir < 0 && (
                  <p style={{ fontSize: 12, color: '#b91c1c', margin: 0 }}>
                    Asignaste más de lo que dice el importe del pago recibido.
                  </p>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, paddingTop: 4 }}>
                  <span>Total a registrar</span>
                  <span>{formatoMoneda(totalAsignadoPago)}</span>
                </div>

                <button type="submit" disabled={totalAsignadoPago <= 0 || guardandoPagoMultiple}>
                  {guardandoPagoMultiple ? 'Guardando...' : 'Registrar pago'}
                </button>
              </form>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input type="checkbox" checked={verPagadas} onChange={(e) => setVerPagadas(e.target.checked)} />
              Ver tambien las notas ya pagadas
            </label>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '-0.5rem 0 0' }}>
              "📊 Exportar Excel" (arriba) exporta lo que esté marcado aquí: solo pendientes, o pendientes y pagadas.
            </p>

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
                      <div>Total: {formatoMoneda(n.total)}</div>
                      <div style={{ fontSize: 12, color: n.estadoPago === 'pagada' ? '#16a34a' : '#b91c1c' }}>
                        {n.estadoPago === 'pagada'
                          ? n.saldoPendiente < 0
                            ? `Pagada · saldo a favor ${formatoMoneda(Math.abs(n.saldoPendiente))}`
                            : 'Pagada'
                          : `Saldo: ${formatoMoneda(n.saldoPendiente)}`}
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
                <strong>{formatoMoneda(notaElegida.total)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Saldo pendiente</span>
                <strong className={notaElegida.saldoPendiente > 0 ? 'texto-alerta' : ''}>
                  {formatoMoneda(notaElegida.saldoPendiente)}
                </strong>
              </div>
            </div>

            <h3>Historial de pagos</h3>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {pagos.length === 0 && <p style={{ color: '#6b7280' }}>Aun no se ha registrado ningun pago.</p>}
              {pagos.map((p) => (
                <div key={p.id} style={{ fontSize: 14, borderBottom: '1px solid #e5e5ea', paddingBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                      {new Date(p.fecha).toLocaleString()} · {p.metodoPago}
                      <br />
                      <small style={{ color: '#6b7280' }}>Registro: {p.registradoPor.nombre}</small>
                    </span>
                    <strong style={p.cancelado ? { textDecoration: 'line-through', color: '#9ca3af' } : undefined}>
                      {formatoMoneda(p.monto)}
                    </strong>
                  </div>

                  {p.cancelado ? (
                    <div className="aviso-alerta" style={{ marginTop: 6 }}>
                      ❌ Cancelado{p.canceladoEn ? ` el ${new Date(p.canceladoEn).toLocaleString()}` : ''}
                    </div>
                  ) : confirmandoCancelarPagoId === p.id ? (
                    <div className="bloque-autorizacion" style={{ marginTop: 6 }}>
                      <p className="texto-alerta" style={{ fontWeight: 600 }}>
                        ¿Seguro que quieres cancelar este pago? No se puede deshacer.
                      </p>
                      {necesitaAutorizacionPago && (
                        <>
                          <input
                            placeholder="Teléfono del administrador"
                            value={autorizadoPorTelefonoPago}
                            onChange={(e) => setAutorizadoPorTelefonoPago(e.target.value)}
                          />
                          <input
                            placeholder="PIN"
                            type="password"
                            value={autorizadoPinPago}
                            onChange={(e) => setAutorizadoPinPago(e.target.value)}
                          />
                        </>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button onClick={() => confirmarCancelarPago(p.id)} disabled={cancelandoPago} style={{ flex: 1 }}>
                          {cancelandoPago ? 'Cancelando...' : 'Sí, cancelar'}
                        </button>
                        <button onClick={() => setConfirmandoCancelarPagoId(null)} style={{ flex: 1 }}>
                          No, regresar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="boton-secundario"
                      onClick={() => pedirCancelarPago(p.id)}
                      style={{ marginTop: 6, width: '100%', background: '#fff2f1', color: '#b91c1c' }}
                    >
                      🗑️ Cancelar pago
                    </button>
                  )}
                </div>
              ))}
            </div>

            {notaElegida.saldoPendiente > 0 && (
              <form onSubmit={handlePago} style={{ display: 'grid', gap: '0.75rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
                <h3>Registrar nuevo abono</h3>
                <label>
                  Monto (saldo pendiente: {formatoMoneda(notaElegida.saldoPendiente)})
                  <input
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    type="number"
                    step="0.01"
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

      {comprobanteActivo && (
        <ComprobantePagoModal datos={comprobanteActivo} onCerrar={() => setComprobanteActivo(null)} />
      )}
    </div>
  );
}
