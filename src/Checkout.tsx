import { useEffect, useState } from 'react';
import { formatoMoneda } from './formato';
import type { Cliente } from './api';
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
    montoPagadoAhora: number;
    metodoPago: string;
    autorizadoPorTelefono?: string;
    autorizadoPin?: string;
    motivoAutorizacion?: string;
  }) => void;
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
  onEnviarCotizacion,
  enviandoCotizacion,
  cotizacionEnviada,
  mensajeCotizacion,
  onCerrar,
  errorServidor,
}: Props) {
  const total = items.reduce((acc, i) => acc + i.cantidad * i.precioUnitario, 0);

  const [esCredito, setEsCredito] = useState(false);
  const [montoPagado, setMontoPagado] = useState(total);
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [autorizadoPorTelefono, setAutorizadoPorTelefono] = useState('');
  const [autorizadoPin, setAutorizadoPin] = useState('');
  const [motivoAutorizacion, setMotivoAutorizacion] = useState('');
  const [errorAutorizacion, setErrorAutorizacion] = useState<string | null>(null);

  const saldoPendiente = Math.max(total - montoPagado, 0);
  const requiereAutorizacion = items.some(
    (item) => item.costoLote !== null && item.precioUnitario < item.costoLote
  );

  useEffect(() => {
    if (!esCredito) {
      setMontoPagado(total);
    }
  }, [esCredito, total]);

  function toggleCredito() {
    const nuevoValor = !esCredito;
    setEsCredito(nuevoValor);
    setMontoPagado(nuevoValor ? 0 : total);
  }

  function confirmar() {
    if (
      requiereAutorizacion &&
      (!autorizadoPorTelefono.trim() || !autorizadoPin.trim() || !motivoAutorizacion.trim())
    ) {
      setErrorAutorizacion('Se necesita ID, PIN y motivo de autorizacion para completar esta venta.');
      return;
    }

    onConfirmar({
      clienteId: cliente.id,
      clienteNombre: cliente.nombre,
      clienteTelefono: cliente.telefono,
      esCredito,
      montoPagadoAhora: montoPagado,
      metodoPago,
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

        <label className="etiqueta">Metodo de pago</label>
        <div className="opciones-metodo">
          <button
            className={metodoPago === 'efectivo' ? 'activo' : ''}
            onClick={() => setMetodoPago('efectivo')}
          >
            Efectivo
          </button>
          <button
            className={metodoPago === 'transferencia' ? 'activo' : ''}
            onClick={() => setMetodoPago('transferencia')}
          >
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

        <button className="boton-primario" onClick={confirmar}>
          ✅ Confirmar venta
        </button>
      </div>
    </div>
  );
}
