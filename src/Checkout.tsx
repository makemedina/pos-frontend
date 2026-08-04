import { useEffect, useState } from 'react';
import { formatoMoneda } from './formato';
import { buscarClientes, crearClienteRapido, type Cliente } from './api';
import { obtenerClientesCache } from './offline';
import type { ItemCarrito } from './Carrito';

interface Props {
  items: ItemCarrito[];
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
  onCerrar: () => void;
  // Error que vino del backend al intentar confirmar (stock insuficiente,
  // autorizacion invalida, etc). Se muestra aqui mismo, dentro del modal,
  // porque antes se perdia detras del Checkout y el usuario no veia nada.
  errorServidor?: string | null;
}

export function Checkout({ items, onConfirmar, onCerrar, errorServidor }: Props) {
  const total = items.reduce((acc, i) => acc + i.cantidad * i.precioUnitario, 0);

  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [mostrarAltaRapida, setMostrarAltaRapida] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [telefonoNuevo, setTelefonoNuevo] = useState('');

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

  async function buscar(valor: string) {
    setBusqueda(valor);
    if (valor.length < 2) {
      setResultados([]);
      return;
    }
    try {
      const data = await buscarClientes(valor);
      setResultados(data);
    } catch {
      // Sin conexion: se busca en la copia local guardada la ultima vez que hubo internet.
      const q = valor.toLowerCase();
      const enCache = obtenerClientesCache().filter(
        (c) => c.nombre.toLowerCase().includes(q) || c.telefono.includes(valor)
      );
      setResultados(enCache);
    }
  }

  function seleccionarCliente(c: Cliente) {
    setClienteSeleccionado(c);
    setResultados([]);
    setBusqueda('');
  }

  async function guardarClienteNuevo() {
    if (!nombreNuevo || !telefonoNuevo) return;
    const cliente = await crearClienteRapido(nombreNuevo, telefonoNuevo);
    setClienteSeleccionado(cliente);
    setMostrarAltaRapida(false);
  }

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
    if (!clienteSeleccionado) return;
    if (
      requiereAutorizacion &&
      (!autorizadoPorTelefono.trim() || !autorizadoPin.trim() || !motivoAutorizacion.trim())
    ) {
      setErrorAutorizacion('Se necesita ID, PIN y motivo de autorizacion para completar esta venta.');
      return;
    }

    onConfirmar({
      clienteId: clienteSeleccionado.id,
      clienteNombre: clienteSeleccionado.nombre,
      clienteTelefono: clienteSeleccionado.telefono,
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
        {clienteSeleccionado ? (
          <div className="cliente-chip">
            <span>{clienteSeleccionado.nombre}</span>
            <button onClick={() => setClienteSeleccionado(null)}>Cambiar</button>
          </div>
        ) : (
          <>
            <input
              className="buscador"
              placeholder="Buscar cliente por nombre o telefono"
              value={busqueda}
              onChange={(e) => buscar(e.target.value)}
            />
            {resultados.map((c) => (
              <div key={c.id} className="resultado-cliente" onClick={() => seleccionarCliente(c)}>
                {c.nombre} · {c.telefono}
              </div>
            ))}
            {busqueda.length >= 2 && resultados.length === 0 && (
              <button className="boton-secundario" onClick={() => setMostrarAltaRapida(true)}>
                + Crear cliente nuevo
              </button>
            )}
          </>
        )}

        {mostrarAltaRapida && (
          <div className="alta-rapida">
            <input
              placeholder="Nombre del cliente"
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
            />
            <input
              placeholder="Telefono (10 digitos)"
              value={telefonoNuevo}
              onChange={(e) => setTelefonoNuevo(e.target.value)}
            />
            <button className="boton-primario" onClick={guardarClienteNuevo}>
              Guardar cliente
            </button>
          </div>
        )}

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

        {errorServidor && (
          <div className="aviso-alerta" style={{ marginTop: 12 }}>
            {errorServidor}
          </div>
        )}

        <button
          className="boton-primario"
          disabled={!clienteSeleccionado}
          onClick={confirmar}
        >
          Confirmar venta
        </button>
      </div>
    </div>
  );
}
