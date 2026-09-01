import { useEffect, useMemo, useState } from 'react';
import { formatoMoneda } from './formato';
import {
  obtenerFacturasPendientes,
  obtenerPagosDeCompra,
  registrarPagoCompra,
  registrarPagoMultiCompra,
  cancelarPagoCompra,
  type FacturaPendiente,
  type PagoCompraHistorial,
} from './api';
import { ComprobantePagoModal, type DatosComprobantePago } from './ComprobantePagoModal';

interface Props {
  onCerrar: () => void;
}

interface ProveedorResumen {
  id: string;
  nombre: string;
  telefono: string | null;
  saldoTotal: number;
  facturasConSaldo: number;
}

type Nivel = 'proveedores' | 'facturas' | 'pagos';

export function AdminCuentasPorPagar({ onCerrar }: Props) {
  const [nivel, setNivel] = useState<Nivel>('proveedores');
  const [facturas, setFacturas] = useState<FacturaPendiente[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Nivel 2: proveedor elegido + sus facturas
  const [proveedorElegido, setProveedorElegido] = useState<ProveedorResumen | null>(null);

  // Pago repartido entre varias facturas del mismo proveedor
  const [mostrarPagoMultiple, setMostrarPagoMultiple] = useState(false);
  const [metodoPagoMultiple, setMetodoPagoMultiple] = useState('efectivo');
  const [montoPagoMultiple, setMontoPagoMultiple] = useState('');
  const [asignacionesPago, setAsignacionesPago] = useState<Record<string, string>>({});
  const [guardandoPagoMultiple, setGuardandoPagoMultiple] = useState(false);
  const [guardandoPago, setGuardandoPago] = useState(false);

  // Comprobante de cada pago a proveedor, sea parcial o deje la factura
  // en $0 -- mismo criterio que Cartera con los clientes.
  const [comprobanteActivo, setComprobanteActivo] = useState<DatosComprobantePago | null>(null);

  // Nivel 3: historial de abonos de una factura + formulario de abono individual
  const [facturaElegida, setFacturaElegida] = useState<FacturaPendiente | null>(null);
  const [pagos, setPagos] = useState<PagoCompraHistorial[]>([]);
  const [monto, setMonto] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');

  // Cancelar un abono ya registrado (p.ej. se capturo con el metodo de
  // pago equivocado) -- mismo patron que AdminCartera con pagos de clientes.
  const [confirmandoCancelarPagoId, setConfirmandoCancelarPagoId] = useState<string | null>(null);
  const [necesitaAutorizacionPago, setNecesitaAutorizacionPago] = useState(false);
  const [autorizadoPorTelefonoPago, setAutorizadoPorTelefonoPago] = useState('');
  const [autorizadoPinPago, setAutorizadoPinPago] = useState('');
  const [cancelandoPago, setCancelandoPago] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      const data = await obtenerFacturasPendientes();
      setFacturas(data);
      return data;
    } catch {
      setMensaje('No se pudieron cargar las cuentas por pagar');
    } finally {
      setCargando(false);
    }
  }

  // Nivel 1: se agrupan las facturas pendientes (ya planas) por proveedor,
  // sin pedirle nada nuevo al backend -- mismo patron que "Cartera" del
  // lado de clientes, pero calculado aqui en vez de con un endpoint aparte.
  const proveedoresResumen: ProveedorResumen[] = useMemo(() => {
    const mapa = new Map<string, ProveedorResumen>();
    for (const f of facturas) {
      const existente = mapa.get(f.proveedor.id);
      if (existente) {
        existente.saldoTotal += f.saldoPendiente;
        existente.facturasConSaldo += 1;
      } else {
        mapa.set(f.proveedor.id, {
          id: f.proveedor.id,
          nombre: f.proveedor.nombre,
          telefono: f.proveedor.telefono,
          saldoTotal: f.saldoPendiente,
          facturasConSaldo: 1,
        });
      }
    }
    return Array.from(mapa.values()).sort((a, b) => b.saldoTotal - a.saldoTotal);
  }, [facturas]);

  const proveedoresFiltrados = proveedoresResumen.filter(
    (p) => !busqueda.trim() || p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())
  );
  const totalPorPagar = proveedoresFiltrados.reduce((acc, p) => acc + p.saldoTotal, 0);

  function abrirProveedor(p: ProveedorResumen) {
    setProveedorElegido(p);
    setMostrarPagoMultiple(false);
    setAsignacionesPago({});
    setNivel('facturas');
  }

  function volverAProveedores() {
    setNivel('proveedores');
    setProveedorElegido(null);
    setMostrarPagoMultiple(false);
    setAsignacionesPago({});
    cargar();
  }

  const facturasDelProveedor = proveedorElegido
    ? facturas.filter((f) => f.proveedor.id === proveedorElegido.id)
    : [];

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

  function actualizarAsignacion(facturaId: string, valor: string) {
    setAsignacionesPago((prev) => ({ ...prev, [facturaId]: valor }));
  }

  // Marcar/desmarcar una factura en el checklist: al marcarla se rellena
  // su recuadro con el saldo pendiente de esa factura (editable despues);
  // al desmarcarla se le quita cualquier monto que tuviera asignado.
  function toggleFacturaPago(f: FacturaPendiente) {
    setAsignacionesPago((prev) => {
      if (f.id in prev) {
        const { [f.id]: _omitida, ...resto } = prev;
        return resto;
      }
      return { ...prev, [f.id]: String(f.saldoPendiente) };
    });
  }

  const totalAsignadoPago = facturasDelProveedor.reduce(
    (acc, f) => acc + (Number(asignacionesPago[f.id]) || 0),
    0
  );
  const restantePorDistribuir = Number(montoPagoMultiple || 0) - totalAsignadoPago;

  async function handlePagoMultiple(e: React.FormEvent) {
    e.preventDefault();
    if (!proveedorElegido) return;

    const asignaciones = facturasDelProveedor
      .map((f) => ({ compraId: f.id, monto: Number(asignacionesPago[f.id]) || 0 }))
      .filter((a) => a.monto > 0);

    if (asignaciones.length === 0) {
      setMensaje('Asigna un monto mayor a cero a al menos una factura.');
      return;
    }

    setGuardandoPagoMultiple(true);
    try {
      const resultado = await registrarPagoMultiCompra(proveedorElegido.id, asignaciones, metodoPagoMultiple);
      setMensaje(`Pago registrado para ${proveedorElegido.nombre}`);
      cerrarPagoMultiple();
      const facturasData = await cargar();
      const saldoTotalProveedor = (facturasData ?? facturas)
        .filter((f) => f.proveedor.id === proveedorElegido.id)
        .reduce((acc, f) => acc + f.saldoPendiente, 0);
      setComprobanteActivo({
        folioNota: resultado.detalle.map((d) => d.numeroFactura || 'sin número').join(', '),
        clienteNombre: proveedorElegido.nombre,
        clienteTelefono: proveedorElegido.telefono ?? undefined,
        monto: resultado.totalPagado,
        metodoPago: metodoPagoMultiple,
        fecha: new Date().toLocaleString(),
        saldoNotaRestante: 0,
        saldoTotalCliente: saldoTotalProveedor,
        detalleNotas:
          resultado.detalle.length > 1
            ? resultado.detalle.map((d) => ({
                folio: d.numeroFactura || 'sin número',
                monto: d.monto,
                saldoRestante: d.saldoFacturaRestante,
              }))
            : undefined,
        entidadLabel: 'Proveedor',
        tituloDocumento: 'Factura',
        etiquetaSaldoTotal: 'Saldo total al proveedor',
        nombreArchivo: 'pago-proveedor',
      });
    } catch (err: any) {
      setMensaje(err.error || 'No se pudo registrar el pago.');
    } finally {
      setGuardandoPagoMultiple(false);
    }
  }

  async function abrirFactura(f: FacturaPendiente) {
    setFacturaElegida(f);
    setMonto('');
    setCargando(true);
    try {
      const data = await obtenerPagosDeCompra(f.id);
      setPagos(data);
    } catch {
      setMensaje('No se pudo cargar el historial de pagos.');
    } finally {
      setCargando(false);
    }
    setNivel('pagos');
  }

  function volverAFacturas() {
    setNivel('facturas');
    setFacturaElegida(null);
    setPagos([]);
    cargar();
  }

  async function handlePago(e: React.FormEvent) {
    e.preventDefault();
    if (!facturaElegida || guardandoPago) return;

    const montoPagado = Number(monto);
    setGuardandoPago(true);
    try {
      await registrarPagoCompra(facturaElegida.id, montoPagado, metodoPago);
      setMensaje(`Pago registrado para ${facturaElegida.proveedor.nombre}`);
      setMonto('');
      // Refresca el saldo de la factura y su historial de pagos
      const [facturasData, pagosData] = await Promise.all([
        obtenerFacturasPendientes(),
        obtenerPagosDeCompra(facturaElegida.id),
      ]);
      const facturaActualizada = facturasData.find((f) => f.id === facturaElegida.id) ?? null;
      setFacturas(facturasData);
      setPagos(pagosData);
      setFacturaElegida(facturaActualizada);

      const saldoTotalProveedor = facturasData
        .filter((f) => f.proveedor.id === facturaElegida.proveedor.id)
        .reduce((acc, f) => acc + f.saldoPendiente, 0);
      setComprobanteActivo({
        folioNota: facturaElegida.numeroFactura || 'sin número',
        clienteNombre: facturaElegida.proveedor.nombre,
        clienteTelefono: facturaElegida.proveedor.telefono ?? undefined,
        monto: montoPagado,
        metodoPago,
        fecha: new Date().toLocaleString(),
        saldoNotaRestante: facturaActualizada?.saldoPendiente ?? 0,
        saldoTotalCliente: saldoTotalProveedor,
        entidadLabel: 'Proveedor',
        tituloDocumento: 'Factura',
        etiquetaSaldoTotal: 'Saldo total al proveedor',
        nombreArchivo: 'pago-proveedor',
      });
      if (!facturaActualizada) {
        // Ya quedo saldada, ya no aparece en pendientes -- regresamos a la
        // lista de facturas del proveedor.
        volverAFacturas();
      }
    } catch (err: any) {
      if (err.code === 'MONTO_INVALIDO') {
        setMensaje(err.error || 'El monto del pago no es válido.');
      } else {
        setMensaje('No se pudo registrar el pago');
      }
    } finally {
      setGuardandoPago(false);
    }
  }

  function pedirCancelarPago(pagoId: string) {
    setConfirmandoCancelarPagoId(pagoId);
    setNecesitaAutorizacionPago(false);
    setAutorizadoPorTelefonoPago('');
    setAutorizadoPinPago('');
  }

  async function confirmarCancelarPago(pagoId: string) {
    if (!facturaElegida) return;
    setCancelandoPago(true);
    try {
      await cancelarPagoCompra(
        facturaElegida.id,
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
      const [facturasData, pagosData] = await Promise.all([
        obtenerFacturasPendientes(),
        obtenerPagosDeCompra(facturaElegida.id),
      ]);
      const facturaActualizada = facturasData.find((f) => f.id === facturaElegida.id) ?? facturaElegida;
      setFacturas(facturasData);
      setPagos(pagosData);
      setFacturaElegida(facturaActualizada);
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

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>
            {nivel === 'proveedores' && 'Cuentas por pagar'}
            {nivel === 'facturas' && `Facturas de ${proveedorElegido?.nombre}`}
            {nivel === 'pagos' && `Factura de ${facturaElegida?.proveedor.nombre}`}
          </h2>
          <button onClick={onCerrar}>Cerrar</button>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {cargando && <p>Cargando...</p>}

        {/* ---------- NIVEL 1: PROVEEDORES ---------- */}
        {!cargando && nivel === 'proveedores' && (
          <>
            <input
              className="buscador"
              placeholder="Buscar proveedor por nombre"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {proveedoresFiltrados.length === 0 && <p style={{ color: '#6b7280' }}>No hay proveedores que coincidan.</p>}
              {proveedoresFiltrados.map((p) => (
                <div
                  key={p.id}
                  style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, cursor: 'pointer' }}
                  onClick={() => abrirProveedor(p)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{p.nombre}</strong>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>{p.telefono || ''}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#b91c1c' }}>{formatoMoneda(p.saldoTotal)}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        {p.facturasConSaldo} factura{p.facturasConSaldo !== 1 ? 's' : ''} pendiente{p.facturasConSaldo !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {proveedoresFiltrados.length > 0 && (
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
                <span>{busqueda.trim() ? 'Total filtrado' : 'Total por pagar'}</span>
                <span>{formatoMoneda(totalPorPagar)}</span>
              </div>
            )}
          </>
        )}

        {/* ---------- NIVEL 2: FACTURAS DE UN PROVEEDOR ---------- */}
        {!cargando && nivel === 'facturas' && (
          <>
            <button onClick={volverAProveedores} style={{ justifySelf: 'start' }}>← Todos los proveedores</button>

            {!mostrarPagoMultiple && facturasDelProveedor.length > 0 && (
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
                  <h3 style={{ margin: 0 }}>Agregar pago a {proveedorElegido?.nombre}</h3>
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
                  Importe del pago entregado
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
                  Marca las facturas que se pagan con este importe — cada una se rellena con su saldo, pero puedes cambiarlo.
                </p>

                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {facturasDelProveedor.map((f) => {
                    const seleccionada = f.id in asignacionesPago;
                    return (
                      <div
                        key={f.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #e5e5ea', paddingBottom: 6 }}
                      >
                        <input
                          type="checkbox"
                          checked={seleccionada}
                          onChange={() => toggleFacturaPago(f)}
                        />
                        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => toggleFacturaPago(f)}>
                          <strong>{f.numeroFactura || 'Sin numero'}</strong>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>
                            Saldo: {formatoMoneda(f.saldoPendiente)}
                          </div>
                        </div>
                        {seleccionada && (
                          <input
                            value={asignacionesPago[f.id] ?? ''}
                            onChange={(e) => actualizarAsignacion(f.id, e.target.value)}
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
                    Asignaste más de lo que dice el importe del pago entregado.
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

            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {facturasDelProveedor.length === 0 && <p style={{ color: '#6b7280' }}>No hay facturas pendientes de este proveedor.</p>}
              {facturasDelProveedor.map((f) => (
                <div
                  key={f.id}
                  style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, cursor: 'pointer' }}
                  onClick={() => abrirFactura(f)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>Factura: {f.numeroFactura || 'Sin factura'}</strong>
                      <div style={{ fontSize: 13 }}>
                        Vence: {f.fechaVencimiento ? new Date(f.fechaVencimiento).toLocaleDateString() : 'Sin fecha'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div>Total: {formatoMoneda(f.total)}</div>
                      <div style={{ fontSize: 12, color: '#b91c1c' }}>Saldo: {formatoMoneda(f.saldoPendiente)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ---------- NIVEL 3: HISTORIAL DE ABONOS DE LA FACTURA ---------- */}
        {!cargando && nivel === 'pagos' && facturaElegida && (
          <>
            <button onClick={volverAFacturas} style={{ justifySelf: 'start' }}>← Facturas de {facturaElegida.proveedor.nombre}</button>

            <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total de la factura</span>
                <strong>{formatoMoneda(facturaElegida.total)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Saldo pendiente</span>
                <strong className={facturaElegida.saldoPendiente > 0 ? 'texto-alerta' : ''}>
                  {formatoMoneda(facturaElegida.saldoPendiente)}
                </strong>
              </div>
            </div>

            <h3>Historial de abonos</h3>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {pagos.length === 0 && <p style={{ color: '#6b7280' }}>Aún no se ha registrado ningún abono.</p>}
              {pagos.map((p) => (
                <div key={p.id} style={{ fontSize: 14, borderBottom: '1px solid #e5e5ea', paddingBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                      {new Date(p.fecha).toLocaleDateString()} · {new Date(p.fecha).toLocaleTimeString()} · {p.metodoPago}
                      <br />
                      <small style={{ color: '#6b7280' }}>Registró: {p.registradoPor.nombre}</small>
                    </span>
                    <strong style={p.cancelado ? { textDecoration: 'line-through', color: '#9ca3af' } : undefined}>
                      {formatoMoneda(p.monto)}
                    </strong>
                  </div>

                  {p.cancelado && (
                    <div className="aviso-alerta" style={{ marginTop: 6 }}>
                      ❌ Cancelado{p.canceladoEn ? ` el ${new Date(p.canceladoEn).toLocaleString()}` : ''}
                    </div>
                  )}

                  {!p.cancelado &&
                    (confirmandoCancelarPagoId === p.id ? (
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
                    ))}
                </div>
              ))}
            </div>

            {facturaElegida.saldoPendiente > 0 && (
              <form onSubmit={handlePago} style={{ display: 'grid', gap: '0.75rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
                <h3>Registrar nuevo abono</h3>
                <label>
                  Monto (saldo pendiente: {formatoMoneda(facturaElegida.saldoPendiente)})
                  <input
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    type="number"
                    step="0.01"
                    max={facturaElegida.saldoPendiente}
                    required
                  />
                </label>
                <label>
                  Método de pago
                  <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
                </label>
                <button type="submit" disabled={guardandoPago}>
                  {guardandoPago ? 'Guardando...' : 'Guardar pago'}
                </button>
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
