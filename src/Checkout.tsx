import { useEffect, useState } from 'react';
import { formatoMoneda } from './formato';
import { obtenerSaldoAFavor, type Cliente } from './api';
import type { ItemCarrito } from './Carrito';

interface Props {
  items: ItemCarrito[];
  cliente: Cliente;
  onCambiarCliente: () => void;
  onConfirmar: (datos: {
    clienteId: string;
    clienteNombre: string;
    clienteTelefono: string;
    esCredito: boolean;
    pagos: { monto: number; metodoPago: string }[];
    autorizadoPorTelefono?: string;
    autorizadoPin?: string;
    motivoAutorizacion?: string;
  }) => void;
  // true mientras la venta se esta mandando al servidor -- deshabilita el
  // boton de confirmar para que un doble click (o un click de mas por
  // conexion lenta) no genere dos ventas identicas.
  guardandoVenta?: boolean;
  onEnviarCotizacion: () => void;
  enviandoCotizacion?: boolean;
  cotizacionEnviada?: boolean;
  mensajeCotizacion?: string | null;
  onCerrar: () => void;
  // Error que vino del backend al intentar confirmar (stock insuficiente,
  // autorizacion invalida, etc). Se muestra aqui mismo, dentro del modal,
  // porque antes se perdia detras del Checkout y el usuario no veia nada.
  errorServidor?: string | null;
}

export function Checkout({
  items,
  cliente,
  onCambiarCliente,
  onConfirmar,
  guardandoVenta,
  onEnviarCotizacion,
  enviandoCotizacion,
  cotizacionEnviada,
  mensajeCotizacion,
  onCerrar,
  errorServidor,
}: Props) {
  // Redondeado a centavos: sumar cantidad*precio en punto flotante puede
  // dar ruido tipo 136.01000000000002 (mas facil de ver ahora que la
  // cantidad admite hasta 3 decimales), y este total precarga el campo
  // de efectivo, asi que se veria tal cual en la pantalla.
  const total = Math.round(items.reduce((acc, i) => acc + i.cantidad * i.precioUnitario, 0) * 100) / 100;

  const [esCredito, setEsCredito] = useState(false);
  // El pago se puede repartir entre efectivo y transferencia -- ej. el
  // cliente da $500 en efectivo y paga $300 con tarjeta/transferencia.
  const [montoEfectivo, setMontoEfectivo] = useState(total);
  const [montoTransferencia, setMontoTransferencia] = useState(0);
  // Si el cliente ya tenia saldo a favor de otra nota (por un sobrepago
  // anterior), se puede aplicar aqui como si fuera otro metodo de pago
  // mas -- no es dinero nuevo, se descuenta de esa otra nota.
  const [saldoFavorDisponible, setSaldoFavorDisponible] = useState(0);
  const [montoSaldoFavor, setMontoSaldoFavor] = useState(0);
  const [autorizadoPorTelefono, setAutorizadoPorTelefono] = useState('');
  const [autorizadoPin, setAutorizadoPin] = useState('');
  const [motivoAutorizacion, setMotivoAutorizacion] = useState('');
  const [errorAutorizacion, setErrorAutorizacion] = useState<string | null>(null);
  const [errorMontos, setErrorMontos] = useState<string | null>(null);

  const montoPagado = montoEfectivo + montoTransferencia + montoSaldoFavor;
  const saldoPendiente = Math.max(total - montoPagado, 0);
  const diferenciaContado = total - montoPagado;
  // Si el cliente pago de mas (efectivo o transferencia, credito o de
  // contado), el excedente se guarda como saldo a favor en su cuenta --
  // ya no se rechaza como error.
  const excedente = Math.max(montoPagado - total, 0);
  const requiereAutorizacion = items.some(
    (item) => item.costoLote !== null && item.precioUnitario < item.costoLote
  );

  useEffect(() => {
    obtenerSaldoAFavor(cliente.id).then(setSaldoFavorDisponible);
  }, [cliente.id]);

  useEffect(() => {
    if (!esCredito) {
      setMontoEfectivo(Math.max(total - montoSaldoFavor, 0));
      setMontoTransferencia(0);
    }
    // No se agrega montoSaldoFavor a las dependencias a proposito: solo
    // queremos recalcular el efectivo cuando cambia el total o el modo,
    // no crear un loop cada vez que el usuario edita el saldo a favor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esCredito, total]);

  function toggleCredito() {
    const nuevoValor = !esCredito;
    setEsCredito(nuevoValor);
    setMontoSaldoFavor(0);
    if (nuevoValor) {
      setMontoEfectivo(0);
      setMontoTransferencia(0);
    } else {
      setMontoEfectivo(total);
      setMontoTransferencia(0);
    }
  }

  function cambiarSaldoFavor(valor: number) {
    const limitado = Math.min(Math.max(valor, 0), saldoFavorDisponible);
    setMontoSaldoFavor(limitado);
    if (!esCredito) {
      setMontoEfectivo(Math.max(total - montoTransferencia - limitado, 0));
    }
    setErrorMontos(null);
  }

  function confirmar() {
    if (guardandoVenta) return;
    setErrorMontos(null);

    if (!esCredito && diferenciaContado > 0.01) {
      setErrorMontos(`Falta ${formatoMoneda(diferenciaContado)} para completar el total.`);
      return;
    }
    if (
      requiereAutorizacion &&
      (!autorizadoPorTelefono.trim() || !autorizadoPin.trim() || !motivoAutorizacion.trim())
    ) {
      setErrorAutorizacion('Se necesita ID, PIN y motivo de autorizacion para completar esta venta.');
      return;
    }

    const pagos: { monto: number; metodoPago: string }[] = [];
    if (montoEfectivo > 0) pagos.push({ monto: montoEfectivo, metodoPago: 'efectivo' });
    if (montoTransferencia > 0) pagos.push({ monto: montoTransferencia, metodoPago: 'transferencia' });
    if (montoSaldoFavor > 0) pagos.push({ monto: montoSaldoFavor, metodoPago: 'saldo_favor' });

    onConfirmar({
      clienteId: cliente.id,
      clienteNombre: cliente.nombre,
      clienteTelefono: cliente.telefono,
      esCredito,
      pagos,
      autorizadoPorTelefono: autorizadoPorTelefono.trim() || undefined,
      autorizadoPin: autorizadoPin.trim() || undefined,
      motivoAutorizacion: motivoAutorizacion.trim() || undefined,
    });
  }

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal-contenido" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <p className="titulo">Checkout</p>
          <button className="boton-cerrar" onClick={onCerrar}>✕</button>
        </div>

        <div className="resumen-nota">
          {items.map((i, idx) => (
            <div key={idx} className="linea-resumen">
              <span>{i.producto} {i.marca} · {i.cantidad} kg</span>
              <span>{formatoMoneda((i.cantidad * i.precioUnitario))}</span>
            </div>
          ))}
          <div className="linea-resumen total">
            <span>Total</span>
            <span>{formatoMoneda(total)}</span>
          </div>
        </div>

        <label className="etiqueta">Cliente</label>
        <div className="cliente-chip">
          <span>{cliente.nombre}</span>
          <button onClick={onCambiarCliente}>Cambiar</button>
        </div>

        <label className="etiqueta">Pago (efectivo y/o transferencia)</label>
        <label style={{ fontSize: 13 }}>
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
        <label style={{ fontSize: 13 }}>
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

        {saldoFavorDisponible > 0 && (
          <label style={{ fontSize: 13 }}>
            Saldo a favor (tiene {formatoMoneda(saldoFavorDisponible)} disponible)
            <div className="campo-precio">
              <span>$</span>
              <input
                type="number"
                step="0.01"
                value={montoSaldoFavor}
                onChange={(e) => cambiarSaldoFavor(Number(e.target.value) || 0)}
              />
            </div>
          </label>
        )}

        <div className="bloque-credito">
          <div className="fila-switch">
            <span>Venta a credito</span>
            <button className={`switch ${esCredito ? 'on' : ''}`} onClick={toggleCredito}>
              <span className="switch-bola" />
            </button>
          </div>

          <div className="linea-resumen">
            <span>Total pagado ahora</span>
            <strong>{formatoMoneda(montoPagado)}</strong>
          </div>

          {esCredito && (
            <div className="linea-resumen">
              <span>Saldo pendiente</span>
              <strong className="texto-alerta">{formatoMoneda(saldoPendiente)}</strong>
            </div>
          )}

          {excedente > 0.01 && (
            <div className="banner-mensaje">
              💰 Sobran {formatoMoneda(excedente)} — se guardarán como saldo a favor de {cliente.nombre}.
            </div>
          )}

          {errorMontos && <div className="aviso-alerta">{errorMontos}</div>}
        </div>

        {requiereAutorizacion && (
          <div className="bloque-autorizacion">
            <p className="texto-alerta">
              Esta venta incluye productos con precio debajo del costo. Llama al administrador
              para que te dicte su telefono y su PIN.
            </p>
            <label className="etiqueta">Telefono del administrador</label>
            <input
              placeholder="Telefono de quien autoriza"
              value={autorizadoPorTelefono}
              onChange={(e) => {
                setAutorizadoPorTelefono(e.target.value);
                setErrorAutorizacion(null);
              }}
            />
            <label className="etiqueta">PIN del administrador</label>
            <input
              placeholder="PIN dictado por el administrador"
              type="password"
              value={autorizadoPin}
              onChange={(e) => {
                setAutorizadoPin(e.target.value);
                setErrorAutorizacion(null);
              }}
            />
            <label className="etiqueta">Motivo de autorizacion</label>
            <input
              placeholder="Motivo de autorizacion"
              value={motivoAutorizacion}
              onChange={(e) => {
                setMotivoAutorizacion(e.target.value);
                setErrorAutorizacion(null);
              }}
            />
            {errorAutorizacion && <div className="aviso-alerta">{errorAutorizacion}</div>}
          </div>
        )}

        {mensajeCotizacion && (
          <div className="banner-mensaje" style={{ marginTop: 12 }}>
            {mensajeCotizacion}
          </div>
        )}

        {errorServidor && (
          <div className="aviso-alerta" style={{ marginTop: 12 }}>
            {errorServidor}
          </div>
        )}

        <button
          className="boton-secundario"
          disabled={!!enviandoCotizacion || !!cotizacionEnviada}
          onClick={onEnviarCotizacion}
          style={{ width: '100%', marginTop: 12 }}
        >
          {cotizacionEnviada
            ? '✅ Cotización enviada'
            : enviandoCotizacion
              ? 'Guardando...'
              : '📤 Enviar cotización'}
        </button>

        <button className="boton-primario" onClick={confirmar} disabled={!!guardandoVenta}>
          {guardandoVenta ? 'Guardando...' : '✅ Confirmar venta'}
        </button>
      </div>
    </div>
  );
}
