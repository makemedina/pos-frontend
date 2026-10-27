import { Icono } from './iconos';
import { useEffect, useState } from 'react';
import { formatoMoneda, formatoFechaHora } from './formato';
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
  const [montoEfectivo, setMontoEfectivo] = useState(0);
  const [montoTransferencia, setMontoTransferencia] = useState(0);
  const [necesitaAutorizacion, setNecesitaAutorizacion] = useState(false);
  const [autorizadoPorTelefono, setAutorizadoPorTelefono] = useState('');
  const [autorizadoPin, setAutorizadoPin] = useState('');
  const [motivoAutorizacion, setMotivoAutorizacion] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [errorMontos, setErrorMontos] = useState<string | null>(null);

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
    setEsCredito(false);
    setConfirmandoCancelar(false);
    setErrorMontos(null);
    try {
      const d = await obtenerCotizacion(id);
      setDetalle(d);
      setMontoEfectivo(d.total);
      setMontoTransferencia(0);
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
    if (nuevoValor) {
      setMontoEfectivo(0);
      setMontoTransferencia(0);
    } else {
      setMontoEfectivo(detalle.total);
      setMontoTransferencia(0);
    }
  }

  async function confirmar() {
    if (!detalle) return;
    setErrorMontos(null);
    const montoPagado = montoEfectivo + montoTransferencia;
    const diferenciaContado = detalle.total - montoPagado;

    if (!esCredito && Math.abs(diferenciaContado) > 0.01) {
      setErrorMontos(
        diferenciaContado > 0
          ? `Falta ${formatoMoneda(diferenciaContado)} para completar el total.`
          : `El efectivo y la transferencia suman ${formatoMoneda(-diferenciaContado)} de más que el total.`
      );
      return;
    }
    if (montoPagado > detalle.total + 0.01) {
      setErrorMontos('El monto pagado no puede ser mayor al total de la venta.');
      return;
    }

    const pagos: { monto: number; metodoPago: string }[] = [];
    if (montoEfectivo > 0) pagos.push({ monto: montoEfectivo, metodoPago: 'efectivo' });
    if (montoTransferencia > 0) pagos.push({ monto: montoTransferencia, metodoPago: 'transferencia' });

    setConfirmando(true);
    setMensaje(null);
    try {
      const resultado = await confirmarCotizacion(detalle.id, {
        esCredito,
        pagos,
        autorizadoPorTelefono: autorizadoPorTelefono.trim() || undefined,
        autorizadoPin: autorizadoPin.trim() || undefined,
        motivoAutorizacion: motivoAutorizacion.trim() || undefined,
      });
      onVentaConfirmada({
        folio: resultado.venta.folio,
        fecha: formatoFechaHora(new Date(resultado.venta.fecha ?? Date.now())),
        vendedor: vendedorNombre,
        cliente: { nombre: detalle.cliente.nombre, telefono: detalle.cliente.telefono },
        items: detalle.items.map((i) => ({
          producto: i.producto,
          marca: i.marca,
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
        })),
        total: Number(resultado.venta.total),
        pagos,
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

  const montoPagadoTotal = montoEfectivo + montoTransferencia;
  const saldoPendiente = detalle ? Math.max(detalle.total - montoPagadoTotal, 0) : 0;

  return (
    <div className="pantalla-centrada pantalla-arriba">
      <div className="contenido-pantalla contenido-760">
        <div className="fila-entre-centro">
          <h2>{detalle ? `Cotización #${detalle.folio}` : 'Cotizaciones pendientes'}</h2>
          <button onClick={detalle ? volverALista : onCerrar}>{detalle ? '← Pendientes' : 'Cerrar'}</button>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {!detalle && (
          <>
            {cargando ? (
              <p>Cargando...</p>
            ) : cotizaciones.length === 0 ? (
              <p className="t-tenue">No hay cotizaciones pendientes.</p>
            ) : (
              <div className="lista-tarjetas grid-gap-075">
                {cotizaciones.map((c) => (
                  <div
                    key={c.id}
                    className="tarjeta-click"
                    onClick={() => abrirDetalle(c.id)}
                  >
                    <div className="fila-entre">
                      <div>
                        <strong>Cotización #{c.folio}</strong>
                        <div className="t-tenue-13">{c.cliente.nombre}</div>
                        <div style={{ fontSize: 12, color: 'var(--texto-tenue)' }}>
                          {formatoFechaHora(new Date(c.fecha))} · {c.vendedor.nombre}
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
            <div className="tarjeta-sombra">
              <div>Cliente: <strong>{detalle.cliente.nombre}</strong></div>
              <div className="t-tenue-13">{detalle.cliente.telefono}</div>
              <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid var(--ios-separator)' }} />
              {detalle.items.map((i) => (
                <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
                  <span>{i.producto} {i.marca} · {i.cantidad} kg</span>
                  <span>{formatoMoneda(i.cantidad * i.precioUnitario)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--ios-separator)' }}>
                <span>Total</span>
                <span>{formatoMoneda(detalle.total)}</span>
              </div>
            </div>

            <div className="tarjeta-grid-075">
              <h3 className="m-0">Confirmar como venta</h3>

              <label className="etiqueta">Pago (efectivo y/o transferencia)</label>
              <label className="fs-13">
                Efectivo
                <div className="campo-precio">
                  <span>$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={montoEfectivo}
                    onChange={(e) => {
                      setMontoEfectivo(Number(e.target.value) || 0);
                      setErrorMontos(null);
                    }}
                  />
                </div>
              </label>
              <label className="fs-13">
                Transferencia
                <div className="campo-precio">
                  <span>$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={montoTransferencia}
                    onChange={(e) => {
                      setMontoTransferencia(Number(e.target.value) || 0);
                      setErrorMontos(null);
                    }}
                  />
                </div>
              </label>

              <div className="bloque-credito">
                <div className="fila-switch">
                  <span>Venta a credito</span>
                  <button className={`switch ${esCredito ? 'on' : ''}`} onClick={toggleCredito}>
                    <span className="switch-bola" />
                  </button>
                </div>

                <div className="linea-resumen">
                  <span>Total pagado ahora</span>
                  <strong>{formatoMoneda(montoPagadoTotal)}</strong>
                </div>

                {esCredito && (
                  <div className="linea-resumen">
                    <span>Saldo pendiente</span>
                    <strong className="texto-alerta">{formatoMoneda(saldoPendiente)}</strong>
                  </div>
                )}

                {errorMontos && <div className="aviso-alerta">{errorMontos}</div>}
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
                  style={{ background: 'var(--peligro-fondo)', color: 'var(--peligro)' }}
                >
                  <Icono nombre="papelera" size={16} /> Cancelar cotización
                </button>
              ) : (
                <div className="bloque-autorizacion">
                  <p className="texto-alerta fw-600">¿Seguro que quieres cancelar esta cotización?</p>
                  <div className="fila-gap-8">
                    <button onClick={cancelar} className="flex-1">Sí, cancelar</button>
                    <button onClick={() => setConfirmandoCancelar(false)} className="flex-1">No, regresar</button>
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
