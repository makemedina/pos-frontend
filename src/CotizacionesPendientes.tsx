import { useEffect, useState } from 'react';
import { formatoMoneda } from './formato';
import {
  obtenerCotizacionesPendientes,
  obtenerCotizacion,
  confirmarCotizacion,
  cancelarCotizacion,
  type CotizacionResumen,
  type CotizacionDetalle,
} from './api';
import type { DatosRecibo } from './construirRecibo';

interface Props {
  vendedorNombre: string;
  onCerrar: () => void;
  onCambio: () => void;
  onVentaConfirmada: (recibo: DatosRecibo) => void;
}

export function CotizacionesPendientes({ vendedorNombre, onCerrar, onCambio, onVentaConfirmada }: Props) {
  const [cotizaciones, setCotizaciones] = useState<CotizacionResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [detalle, setDetalle] = useState<CotizacionDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [esCredito, setEsCredito] = useState(false);
  const [montoPagado, setMontoPagado] = useState(0);
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [necesitaAutorizacion, setNecesitaAutorizacion] = useState(false);
  const [autorizadoPorTelefono, setAutorizadoPorTelefono] = useState('');
  const [autorizadoPin, setAutorizadoPin] = useState('');
  const [motivoAutorizacion, setMotivoAutorizacion] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      setCotizaciones(await obtenerCotizacionesPendientes());
    } catch {
      setMensaje('No se pudieron cargar las cotizaciones.');
    } finally {
      setCargando(false);
    }
  }

  async function abrirDetalle(id: string) {
    setCargandoDetalle(true);
    setNecesitaAutorizacion(false);
    setAutorizadoPorTelefono('');
    setAutorizadoPin('');
    setMotivoAutorizacion('');
    setMetodoPago('efectivo');
    setEsCredito(false);
    setConfirmandoCancelar(false);
    try {
      const d = await obtenerCotizacion(id);
      setDetalle(d);
      setMontoPagado(d.total);
    } catch {
      setMensaje('No se pudo cargar esta cotización.');
    } finally {
      setCargandoDetalle(false);
    }
  }

  function volverALista() {
    setDetalle(null);
    cargar();
  }

  function toggleCredito() {
    if (!detalle) return;
    const nuevoValor = !esCredito;
    setEsCredito(nuevoValor);
    setMontoPagado(nuevoValor ? 0 : detalle.total);
  }

  async function confirmar() {
    if (!detalle) return;
    setConfirmando(true);
    setMensaje(null);
    try {
      const resultado = await confirmarCotizacion(detalle.id, {
        esCredito,
        montoPagadoAhora: montoPagado,
        metodoPago,
        autorizadoPorTelefono: autorizadoPorTelefono.trim() || undefined,
        autorizadoPin: autorizadoPin.trim() || undefined,
        motivoAutorizacion: motivoAutorizacion.trim() || undefined,
      });
      onVentaConfirmada({
        folio: resultado.venta.folio,
        fecha: new Date(resultado.venta.fecha ?? Date.now()).toLocaleString(),
        vendedor: vendedorNombre,
        cliente: { nombre: detalle.cliente.nombre, telefono: detalle.cliente.telefono },
        items: detalle.items.map((i) => ({
          producto: i.producto,
          marca: i.marca,
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
        })),
        total: Number(resultado.venta.total),
        metodoPago,
        esCredito,
        saldoPendiente: Number(resultado.venta.saldoPendiente ?? 0),
        saldoTotalCliente: resultado.saldoTotalCliente !== undefined ? Number(resultado.saldoTotalCliente) : undefined,
      });
      setDetalle(null);
      cargar();
      onCambio();
    } catch (err: any) {
      if (err.code === 'REQUIERE_AUTORIZACION') {
        setNecesitaAutorizacion(true);
        setMensaje('Algún producto quedó con precio bajo costo: se necesita teléfono, PIN y motivo de un administrador.');
      } else if (err.code === 'STOCK_INSUFICIENTE') {
        setMensaje('Ya no hay stock suficiente para completar esta venta.');
      } else if (err.code === 'CLIENTE_SIN_CREDITO') {
        setMensaje('Este cliente no tiene autorizado comprar a crédito.');
      } else if (err.code === 'COTIZACION_YA_RESUELTA') {
        setMensaje('Esta cotización ya se confirmó o canceló desde otro lado.');
        setDetalle(null);
        cargar();
      } else {
        setMensaje('No se pudo confirmar la venta.');
      }
    } finally {
      setConfirmando(false);
    }
  }

  async function cancelar() {
    if (!detalle) return;
    try {
      await cancelarCotizacion(detalle.id);
      setMensaje('Cotización cancelada.');
      setDetalle(null);
      cargar();
      onCambio();
    } catch {
      setMensaje('No se pudo cancelar la cotización.');
    }
  }

  const saldoPendiente = detalle ? Math.max(detalle.total - montoPagado, 0) : 0;

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>{detalle ? `Cotización #${detalle.folio}` : 'Cotizaciones pendientes'}</h2>
          <button onClick={detalle ? volverALista : onCerrar}>{detalle ? '← Pendientes' : 'Cerrar'}</button>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {!detalle && (
          <>
            {cargando ? (
              <p>Cargando...</p>
            ) : cotizaciones.length === 0 ? (
              <p style={{ color: '#6b7280' }}>No hay cotizaciones pendientes.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {cotizaciones.map((c) => (
                  <div
                    key={c.id}
                    style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, cursor: 'pointer' }}
                    onClick={() => abrirDetalle(c.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <strong>Cotización #{c.folio}</strong>
                        <div style={{ fontSize: 13, color: '#6b7280' }}>{c.cliente.nombre}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>
                          {new Date(c.fecha).toLocaleString()} · {c.vendedor.nombre}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700 }}>{formatoMoneda(c.total)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {cargandoDetalle && <p>Cargando cotización...</p>}

        {detalle && !cargandoDetalle && (
          <>
            <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14 }}>
              <div>Cliente: <strong>{detalle.cliente.nombre}</strong></div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>{detalle.cliente.telefono}</div>
              <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid #e5e5ea' }} />
              {detalle.items.map((i) => (
                <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
                  <span>{i.producto} {i.marca} · {i.cantidad} kg</span>
                  <span>{formatoMoneda(i.cantidad * i.precioUnitario)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: '1px solid #e5e5ea' }}>
                <span>Total</span>
                <span>{formatoMoneda(detalle.total)}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '0.75rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
              <h3 style={{ margin: 0 }}>Confirmar como venta</h3>

              <label className="etiqueta">Metodo de pago</label>
              <div className="opciones-metodo">
                <button className={metodoPago === 'efectivo' ? 'activo' : ''} onClick={() => setMetodoPago('efectivo')}>
                  Efectivo
                </button>
                <button className={metodoPago === 'transferencia' ? 'activo' : ''} onClick={() => setMetodoPago('transferencia')}>
                  Transferencia
                </button>
              </div>

              <div className="bloque-credito">
                <div className="fila-switch">
                  <span>Venta a credito</span>
                  <button className={`switch ${esCredito ? 'on' : ''}`} onClick={toggleCredito}>
                    <span className="switch-bola" />
                  </button>
                </div>

                {esCredito && (
                  <>
                    <label className="etiqueta">Monto pagado ahora</label>
                    <div className="campo-precio">
                      <span>$</span>
                      <input
                        type="number"
                        value={montoPagado}
                        onChange={(e) => setMontoPagado(Number(e.target.value) || 0)}
                      />
                    </div>
                    <div className="linea-resumen">
                      <span>Saldo pendiente</span>
                      <strong className="texto-alerta">{formatoMoneda(saldoPendiente)}</strong>
                    </div>
                  </>
                )}
              </div>

              {necesitaAutorizacion && (
                <div className="bloque-autorizacion">
                  <label className="etiqueta">Telefono del administrador</label>
                  <input
                    placeholder="Telefono de quien autoriza"
                    value={autorizadoPorTelefono}
                    onChange={(e) => setAutorizadoPorTelefono(e.target.value)}
                  />
                  <label className="etiqueta">PIN del administrador</label>
                  <input
                    placeholder="PIN dictado por el administrador"
                    type="password"
                    value={autorizadoPin}
                    onChange={(e) => setAutorizadoPin(e.target.value)}
                  />
                  <label className="etiqueta">Motivo de autorizacion</label>
                  <input
                    placeholder="Motivo de autorizacion"
                    value={motivoAutorizacion}
                    onChange={(e) => setMotivoAutorizacion(e.target.value)}
                  />
                </div>
              )}

              <button className="boton-primario" onClick={confirmar} disabled={confirmando}>
                {confirmando ? 'Confirmando...' : '✅ Confirmar venta'}
              </button>

              {!confirmandoCancelar ? (
                <button
                  className="boton-secundario"
                  onClick={() => setConfirmandoCancelar(true)}
                  style={{ background: '#fff2f1', color: '#b91c1c' }}
                >
                  🗑️ Cancelar cotización
                </button>
              ) : (
                <div className="bloque-autorizacion">
                  <p className="texto-alerta" style={{ fontWeight: 600 }}>¿Seguro que quieres cancelar esta cotización?</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={cancelar} style={{ flex: 1 }}>Sí, cancelar</button>
                    <button onClick={() => setConfirmandoCancelar(false)} style={{ flex: 1 }}>No, regresar</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
