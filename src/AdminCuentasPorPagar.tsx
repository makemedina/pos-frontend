import { Icono } from './iconos';
import { useEffect, useMemo, useState } from 'react';
import { formatoMoneda, formatoFecha, formatoFechaHora } from './formato';
import {
  obtenerFacturasPendientes,
  obtenerPagosDeCompra,
  registrarPagoCompra,
  registrarPagoMultiCompra,
  cancelarPagoCompra,
  obtenerPagosDeProveedor,
  cancelarGrupoPagoCompra,
  obtenerComprobanteFotoPagoCompra,
  type FacturaPendiente,
  type PagoCompraHistorial,
  type GrupoPagoProveedor,
} from './api';
import { ComprobantePagoModal, type DatosComprobantePago } from './ComprobantePagoModal';

// Campo de foto del comprobante de pago (obligatorio en todo pago a
// proveedor). Mismo estilo que el de Gastos: el <input type="file"> queda
// oculto y se dispara desde un recuadro grande facil de tocar; sin
// "capture", para que en celular se pueda elegir camara o galeria.
function CampoFotoComprobante({ id, archivo, onCambio }: { id: string; archivo: File | null; onCambio: (archivo: File | null) => void }) {
  const previa = useMemo(() => (archivo ? URL.createObjectURL(archivo) : null), [archivo]);
  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa); }, [previa]);
  return (
    <div className="grid-gap-05">
      <span>Foto del comprobante (obligatoria)</span>
      <label
        htmlFor={id}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          border: '2px dashed var(--ios-gray-3)',
          borderRadius: 12,
          padding: '1.25rem',
          cursor: 'pointer',
          color: 'var(--acento)',
          fontWeight: 600,
          textAlign: 'center',
        }}
      >
        {archivo ? <><Icono nombre="adjunto" size={16} /> {archivo.name} (toca para cambiarla)</> : <><Icono nombre="camara" size={16} /> Toca para elegir o tomar la foto</>}
      </label>
      <input
        id={id}
        type="file"
        accept="image/*"
        onChange={(e) => onCambio(e.target.files?.[0] ?? null)}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />
      {previa && <img src={previa} alt="Comprobante" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'contain' }} />}
    </div>
  );
}

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

type Nivel = 'proveedores' | 'facturas' | 'pagos' | 'historialPagos';

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
  const [fotoPagoMultiple, setFotoPagoMultiple] = useState<File | null>(null);
  const [fotoPago, setFotoPago] = useState<File | null>(null);
  // URL (blob) de la foto de comprobante que se esta viendo, o null.
  const [fotoComprobanteAbierta, setFotoComprobanteAbierta] = useState<string | null>(null);
  const [cargandoFotoComprobante, setCargandoFotoComprobante] = useState(false);
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

  // Nivel "historialPagos": TODOS los pagos que se le han entregado a un
  // proveedor, sin importar a que factura(s) hayan cubierto -- para poder
  // cancelar un pago completo (todas las facturas que abarco) desde un
  // solo lugar, en vez de tener que entrar factura por factura.
  const [gruposPago, setGruposPago] = useState<GrupoPagoProveedor[]>([]);
  const [confirmandoCancelarGrupoKey, setConfirmandoCancelarGrupoKey] = useState<string | null>(null);
  const [necesitaAutorizacionGrupo, setNecesitaAutorizacionGrupo] = useState(false);
  const [autorizadoPorTelefonoGrupo, setAutorizadoPorTelefonoGrupo] = useState('');
  const [autorizadoPinGrupo, setAutorizadoPinGrupo] = useState('');
  const [cancelandoGrupo, setCancelandoGrupo] = useState(false);

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
    ? facturas
        .filter((f) => f.proveedor.id === proveedorElegido.id)
        .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
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
    setFotoPagoMultiple(null);
  }

  async function verFotoComprobante(pagoId: string) {
    setCargandoFotoComprobante(true);
    try {
      const blob = await obtenerComprobanteFotoPagoCompra(pagoId);
      setFotoComprobanteAbierta(URL.createObjectURL(blob));
    } catch {
      setMensaje('No se pudo cargar la foto del comprobante.');
    } finally {
      setCargandoFotoComprobante(false);
    }
  }

  function cerrarFotoComprobante() {
    if (fotoComprobanteAbierta) URL.revokeObjectURL(fotoComprobanteAbierta);
    setFotoComprobanteAbierta(null);
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
    if (!fotoPagoMultiple) {
      setMensaje('Sube la foto del comprobante del pago antes de registrarlo.');
      return;
    }

    setGuardandoPagoMultiple(true);
    try {
      const resultado = await registrarPagoMultiCompra(proveedorElegido.id, asignaciones, metodoPagoMultiple, fotoPagoMultiple);
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
        fecha: formatoFechaHora(new Date()),
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

  async function abrirHistorialPagos() {
    if (!proveedorElegido) return;
    setConfirmandoCancelarGrupoKey(null);
    setNivel('historialPagos');
    setCargando(true);
    try {
      const data = await obtenerPagosDeProveedor(proveedorElegido.id);
      setGruposPago(data);
    } catch {
      setMensaje('No se pudo cargar el historial de pagos del proveedor.');
    } finally {
      setCargando(false);
    }
  }

  function volverAFacturasDesdeHistorial() {
    setNivel('facturas');
    setGruposPago([]);
    cargar();
  }

  function pedirCancelarGrupo(grupoKey: string) {
    setConfirmandoCancelarGrupoKey(grupoKey);
    setNecesitaAutorizacionGrupo(false);
    setAutorizadoPorTelefonoGrupo('');
    setAutorizadoPinGrupo('');
  }

  async function confirmarCancelarGrupo(grupoKey: string) {
    if (!proveedorElegido) return;
    setCancelandoGrupo(true);
    try {
      await cancelarGrupoPagoCompra(
        grupoKey,
        necesitaAutorizacionGrupo
          ? { telefono: autorizadoPorTelefonoGrupo, pin: autorizadoPinGrupo }
          : undefined
      );
      setMensaje('Pago cancelado. Las facturas que cubría vuelven a quedar con saldo pendiente.');
      setConfirmandoCancelarGrupoKey(null);
      setNecesitaAutorizacionGrupo(false);
      setAutorizadoPorTelefonoGrupo('');
      setAutorizadoPinGrupo('');
      const data = await obtenerPagosDeProveedor(proveedorElegido.id);
      setGruposPago(data);
    } catch (err: any) {
      if (err.code === 'REQUIERE_AUTORIZACION') {
        setNecesitaAutorizacionGrupo(true);
        setMensaje('Este pago (o parte de el) es de un día anterior: se necesita el teléfono y PIN de un administrador para cancelarlo.');
      } else if (err.code === 'PAGO_YA_CANCELADO') {
        setMensaje('Este pago ya estaba cancelado.');
        setConfirmandoCancelarGrupoKey(null);
      } else {
        setMensaje('No se pudo cancelar el pago.');
      }
    } finally {
      setCancelandoGrupo(false);
    }
  }

  async function handlePago(e: React.FormEvent) {
    e.preventDefault();
    if (!facturaElegida || guardandoPago) return;

    if (!fotoPago) {
      setMensaje('Sube la foto del comprobante del pago antes de guardarlo.');
      return;
    }

    const montoPagado = Number(monto);
    setGuardandoPago(true);
    try {
      await registrarPagoCompra(facturaElegida.id, montoPagado, metodoPago, fotoPago);
      setMensaje(`Pago registrado para ${facturaElegida.proveedor.nombre}`);
      setMonto('');
      setFotoPago(null);
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
        fecha: formatoFechaHora(new Date()),
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
      if (err.code === 'MONTO_INVALIDO' || err.code === 'FOTO_REQUERIDA' || err.code === 'FOTO_INVALIDA') {
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
    <div className="pantalla-centrada pantalla-arriba">
      <div className="contenido-pantalla contenido-760">
        <div className="fila-entre-centro">
          <h2>
            {nivel === 'proveedores' && 'Cuentas por pagar'}
            {nivel === 'facturas' && `Facturas de ${proveedorElegido?.nombre}`}
            {nivel === 'pagos' && `Factura de ${facturaElegida?.proveedor.nombre}`}
            {nivel === 'historialPagos' && `Pagos de ${proveedorElegido?.nombre}`}
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
            <div className="lista-tarjetas grid-gap-075">
              {proveedoresFiltrados.length === 0 && <p className="t-tenue">No hay proveedores que coincidan.</p>}
              {proveedoresFiltrados.map((p) => (
                <div
                  key={p.id}
                  className="tarjeta-click"
                  onClick={() => abrirProveedor(p)}
                >
                  <div className="fila-entre-centro">
                    <div>
                      <strong>{p.nombre}</strong>
                      <div className="t-tenue-13">{p.telefono || ''}</div>
                    </div>
                    <div className="t-der">
                      <div style={{ fontWeight: 700, color: 'var(--peligro)' }}>{formatoMoneda(p.saldoTotal)}</div>
                      <div className="t-tenue-12">
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
                  background: 'var(--fondo-suave)',
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
            <button onClick={volverAProveedores} className="justify-start">← Todos los proveedores</button>

            <div className="fila-gap-8">
              {!mostrarPagoMultiple && facturasDelProveedor.length > 0 && (
                <button onClick={abrirPagoMultiple} className="justify-start">
                  + Agregar pago
                </button>
              )}
              <button onClick={abrirHistorialPagos} className="boton-secundario justify-start">
                <Icono nombre="pendientes" size={16} /> Ver todos los pagos
              </button>
            </div>

            {mostrarPagoMultiple && (
              <form
                onSubmit={handlePagoMultiple}
                className="tarjeta-grid-075"
              >
                <div className="fila-entre-centro">
                  <h3 className="m-0">Agregar pago a {proveedorElegido?.nombre}</h3>
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

                <p className="t-tenue-13-m0">
                  Marca las facturas que se pagan con este importe — cada una se rellena con su saldo, pero puedes cambiarlo.
                </p>

                <div className="grid-gap-05">
                  {facturasDelProveedor.map((f) => {
                    const seleccionada = f.id in asignacionesPago;
                    return (
                      <div
                        key={f.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--ios-separator)', paddingBottom: 6 }}
                      >
                        <input
                          type="checkbox"
                          checked={seleccionada}
                          onChange={() => toggleFacturaPago(f)}
                        />
                        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => toggleFacturaPago(f)}>
                          <strong>{f.numeroFactura || 'Sin numero'}</strong>
                          <div className="t-tenue-12">
                            Compra: {formatoFecha(new Date(f.fecha))} · Saldo: {formatoMoneda(f.saldoPendiente)}
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
                    background: restantePorDistribuir < 0 ? 'var(--peligro-fondo)' : 'var(--fondo-suave)',
                    fontWeight: 700,
                  }}
                >
                  <span>Por distribuir</span>
                  <span style={{ color: restantePorDistribuir < 0 ? 'var(--peligro)' : undefined }}>
                    {formatoMoneda(restantePorDistribuir)}
                  </span>
                </div>
                {restantePorDistribuir < 0 && (
                  <p style={{ fontSize: 12, color: 'var(--peligro)', margin: 0 }}>
                    Asignaste más de lo que dice el importe del pago entregado.
                  </p>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, paddingTop: 4 }}>
                  <span>Total a registrar</span>
                  <span>{formatoMoneda(totalAsignadoPago)}</span>
                </div>

                <CampoFotoComprobante id="foto-comprobante-pago-multiple" archivo={fotoPagoMultiple} onCambio={setFotoPagoMultiple} />

                <button type="submit" disabled={totalAsignadoPago <= 0 || guardandoPagoMultiple}>
                  {guardandoPagoMultiple ? 'Guardando...' : 'Registrar pago'}
                </button>
              </form>
            )}

            <div className="lista-tarjetas grid-gap-075">
              {facturasDelProveedor.length === 0 && <p className="t-tenue">No hay facturas pendientes de este proveedor.</p>}
              {facturasDelProveedor.map((f) => (
                <div
                  key={f.id}
                  className="tarjeta-click"
                  onClick={() => abrirFactura(f)}
                >
                  <div className="fila-entre-centro">
                    <div>
                      <strong>Factura: {f.numeroFactura || 'Sin factura'}</strong>
                      <div className="fs-13">Compra: {formatoFecha(new Date(f.fecha))}</div>
                      <div className="fs-13">
                        Vence: {f.fechaVencimiento ? formatoFecha(new Date(f.fechaVencimiento)) : 'Sin fecha'}
                      </div>
                    </div>
                    <div className="t-der">
                      <div>Total: {formatoMoneda(f.total)}</div>
                      <div style={{ fontSize: 12, color: 'var(--peligro)' }}>Saldo: {formatoMoneda(f.saldoPendiente)}</div>
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
            <button onClick={volverAFacturas} className="justify-start">← Facturas de {facturaElegida.proveedor.nombre}</button>

            <div className="tarjeta-sombra">
              <div className="fila-entre">
                <span>Total de la factura</span>
                <strong>{formatoMoneda(facturaElegida.total)}</strong>
              </div>
              <div className="fila-entre">
                <span>Saldo pendiente</span>
                <strong className={facturaElegida.saldoPendiente > 0 ? 'texto-alerta' : ''}>
                  {formatoMoneda(facturaElegida.saldoPendiente)}
                </strong>
              </div>
            </div>

            <h3>Historial de abonos</h3>
            <div className="grid-gap-05">
              {pagos.length === 0 && <p className="t-tenue">Aún no se ha registrado ningún abono.</p>}
              {pagos.map((p) => (
                <div key={p.id} style={{ fontSize: 14, borderBottom: '1px solid var(--ios-separator)', paddingBottom: 6 }}>
                  <div className="fila-entre">
                    <span>
                      {formatoFecha(new Date(p.fecha))} · {new Date(p.fecha).toLocaleTimeString()} · {p.metodoPago}
                      <br />
                      <small className="t-tenue">Registró: {p.registradoPor.nombre}</small>
                    </span>
                    <strong style={p.cancelado ? { textDecoration: 'line-through', color: 'var(--texto-tenue)' } : undefined}>
                      {formatoMoneda(p.monto)}
                    </strong>
                  </div>

                  {p.tieneComprobante && (
                    <button
                      className="boton-secundario mt-6"
                      onClick={() => verFotoComprobante(p.id)}
                      disabled={cargandoFotoComprobante}
                    >
                      <Icono nombre="recibo" size={16} /> Ver comprobante
                    </button>
                  )}

                  {p.cancelado && (
                    <div className="aviso-alerta mt-6">
                      ❌ Cancelado{p.canceladoEn ? ` el ${formatoFechaHora(new Date(p.canceladoEn))}` : ''}
                    </div>
                  )}

                  {!p.cancelado &&
                    (confirmandoCancelarPagoId === p.id ? (
                      <div className="bloque-autorizacion mt-6">
                        <p className="texto-alerta fw-600">
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
                        <div className="fila-gap-8-mt-8">
                          <button onClick={() => confirmarCancelarPago(p.id)} disabled={cancelandoPago} className="flex-1">
                            {cancelandoPago ? 'Cancelando...' : 'Sí, cancelar'}
                          </button>
                          <button onClick={() => setConfirmandoCancelarPagoId(null)} className="flex-1">
                            No, regresar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="boton-secundario"
                        onClick={() => pedirCancelarPago(p.id)}
                        style={{ marginTop: 6, width: '100%', background: 'var(--peligro-fondo)', color: 'var(--peligro)' }}
                      >
                        <Icono nombre="papelera" size={16} /> Cancelar pago
                      </button>
                    ))}
                </div>
              ))}
            </div>

            {facturaElegida.saldoPendiente > 0 && (
              <form onSubmit={handlePago} className="tarjeta-grid-075">
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
                <CampoFotoComprobante id="foto-comprobante-pago" archivo={fotoPago} onCambio={setFotoPago} />
                <button type="submit" disabled={guardandoPago}>
                  {guardandoPago ? 'Guardando...' : 'Guardar pago'}
                </button>
              </form>
            )}
          </>
        )}

        {/* ---------- HISTORIAL DE PAGOS DEL PROVEEDOR (todas las facturas) ---------- */}
        {!cargando && nivel === 'historialPagos' && proveedorElegido && (
          <>
            <button onClick={volverAFacturasDesdeHistorial} className="justify-start">← Facturas de {proveedorElegido.nombre}</button>

            <p className="t-tenue-13-m0">
              Todos los pagos que se le han entregado a {proveedorElegido.nombre}, aunque hayan cubierto varias
              facturas a la vez. Cancelar uno revierte TODAS las facturas que cubrió.
            </p>

            <div className="grid-gap-05">
              {gruposPago.length === 0 && <p className="t-tenue">Aún no se le ha hecho ningún pago a este proveedor.</p>}
              {gruposPago.map((g) => (
                <div key={g.grupoKey} style={{ fontSize: 14, border: 'none', boxShadow: 'var(--sombra-tarjeta)', padding: '0.75rem', borderRadius: 14 }}>
                  <div className="fila-entre">
                    <span>
                      {formatoFechaHora(new Date(g.fecha))} · {g.metodosPago.join(' + ') || '—'}
                      <br />
                      <small className="t-tenue">Registró: {g.registradoPor}</small>
                    </span>
                    <strong style={g.cancelado ? { textDecoration: 'line-through', color: 'var(--texto-tenue)' } : undefined}>
                      {formatoMoneda(g.montoTotal)}
                    </strong>
                  </div>

                  <div style={{ marginTop: 6, fontSize: 13, color: 'var(--ios-secondary-label)' }}>
                    Cubrió{g.facturas.length > 1 ? ` ${g.facturas.length} facturas` : ' 1 factura'}:{' '}
                    {g.facturas.map((f, idx) => (
                      <span key={f.compraId + idx} style={f.cancelado ? { textDecoration: 'line-through' } : undefined}>
                        {f.numeroFactura || 'sin número'} ({formatoMoneda(f.monto)}){idx < g.facturas.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>

                  {g.comprobantePagoId && (
                    <button
                      className="boton-secundario mt-6"
                      onClick={() => verFotoComprobante(g.comprobantePagoId!)}
                      disabled={cargandoFotoComprobante}
                    >
                      <Icono nombre="recibo" size={16} /> Ver comprobante
                    </button>
                  )}

                  {g.cancelado && (
                    <div className="aviso-alerta mt-6">
                      ❌ Cancelado
                    </div>
                  )}

                  {!g.cancelado &&
                    (confirmandoCancelarGrupoKey === g.grupoKey ? (
                      <div className="bloque-autorizacion mt-6">
                        <p className="texto-alerta fw-600">
                          ¿Seguro que quieres cancelar este pago? Se revertirán TODAS las facturas que cubrió.
                          No se puede deshacer.
                        </p>
                        {necesitaAutorizacionGrupo && (
                          <>
                            <input
                              placeholder="Teléfono del administrador"
                              value={autorizadoPorTelefonoGrupo}
                              onChange={(e) => setAutorizadoPorTelefonoGrupo(e.target.value)}
                            />
                            <input
                              placeholder="PIN"
                              type="password"
                              value={autorizadoPinGrupo}
                              onChange={(e) => setAutorizadoPinGrupo(e.target.value)}
                            />
                          </>
                        )}
                        <div className="fila-gap-8-mt-8">
                          <button onClick={() => confirmarCancelarGrupo(g.grupoKey)} disabled={cancelandoGrupo} className="flex-1">
                            {cancelandoGrupo ? 'Cancelando...' : 'Sí, cancelar'}
                          </button>
                          <button onClick={() => setConfirmandoCancelarGrupoKey(null)} className="flex-1">
                            No, regresar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="boton-secundario"
                        onClick={() => pedirCancelarGrupo(g.grupoKey)}
                        style={{ marginTop: 6, width: '100%', background: 'var(--peligro-fondo)', color: 'var(--peligro)' }}
                      >
                        <Icono nombre="papelera" size={16} /> Cancelar este pago
                      </button>
                    ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {comprobanteActivo && (
        <ComprobantePagoModal datos={comprobanteActivo} onCerrar={() => setComprobanteActivo(null)} />
      )}

      {fotoComprobanteAbierta && (
        <div className="modal-fondo" onClick={cerrarFotoComprobante} style={{ zIndex: 40 }}>
          <div className="modal-contenido" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <p className="titulo">Comprobante</p>
              <button className="boton-cerrar" onClick={cerrarFotoComprobante}>✕</button>
            </div>
            <img src={fotoComprobanteAbierta} alt="Comprobante" style={{ maxWidth: '100%', borderRadius: 8 }} />
          </div>
        </div>
      )}
    </div>
  );
}
