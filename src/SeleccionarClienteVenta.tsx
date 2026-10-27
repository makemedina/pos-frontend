import { useState } from 'react';
import { buscarClientes, crearClienteRapido, type Cliente, ORIGENES_CLIENTE } from './api';
import { obtenerClientesCache } from './offline';
import { telefonoValido, MENSAJE_TELEFONO_INVALIDO } from './formato';

interface Props {
  onSeleccionar: (cliente: Cliente) => void;
  onCerrar: () => void;
}

/**
 * Paso previo al catalogo: el cliente se elige ANTES de armar el carrito,
 * para poder sugerir el ultimo precio que se le dio a ese cliente en cada
 * producto (ver App.tsx: ultimosPrecios). Es la misma UI de busqueda/alta
 * rapida que antes vivia dentro de Checkout.tsx.
 */
export function SeleccionarClienteVenta({ onSeleccionar, onCerrar }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [mostrarAltaRapida, setMostrarAltaRapida] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [telefonoNuevo, setTelefonoNuevo] = useState('');
  const [origenNuevo, setOrigenNuevo] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);

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

  async function guardarClienteNuevo() {
    if (!nombreNuevo || !telefonoNuevo) return;
    if (!telefonoValido(telefonoNuevo)) {
      setMensaje(MENSAJE_TELEFONO_INVALIDO);
      return;
    }
    if (!origenNuevo) {
      setMensaje('Elige cómo llegó el cliente.');
      return;
    }
    try {
      const cliente = await crearClienteRapido(nombreNuevo, telefonoNuevo, origenNuevo);
      onSeleccionar(cliente);
    } catch {
      setMensaje('No se pudo crear el cliente.');
    }
  }

  return (
    <div className="pantalla-centrada pantalla-arriba">
      <div style={{ width: '100%', maxWidth: 480, display: 'grid', gap: '0.75rem' }}>
        <header className="encabezado">
          <button
            className="boton-secundario"
            onClick={onCerrar}
            style={{ height: 40, width: 'auto', marginTop: 0, padding: '0 16px' }}
          >
            ← Inicio
          </button>
        </header>

        <h2 className="m-0">¿A quién le vendes?</h2>
        <p className="t-tenue-13-m0">
          Elige o crea el cliente antes de armar la nota, para poder sugerirte el último precio que
          le diste a cada producto.
        </p>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {!mostrarAltaRapida ? (
          <>
            <input
              className="buscador"
              placeholder="Buscar cliente por nombre o telefono"
              value={busqueda}
              onChange={(e) => buscar(e.target.value)}
              autoFocus
            />
            {resultados.map((c) => (
              <div key={c.id} className="resultado-cliente" onClick={() => onSeleccionar(c)}>
                {c.nombre} · {c.telefono}
              </div>
            ))}
            {busqueda.length >= 2 && resultados.length === 0 && (
              <button className="boton-secundario" onClick={() => setMostrarAltaRapida(true)}>
                + Crear cliente nuevo
              </button>
            )}
          </>
        ) : (
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
            <select value={origenNuevo} onChange={(e) => setOrigenNuevo(e.target.value)}>
              <option value="">¿Cómo llegó?</option>
              {ORIGENES_CLIENTE.map((o) => (
                <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
              ))}
            </select>
            <div className="fila-gap-8">
              <button className="boton-primario flex-1" onClick={guardarClienteNuevo}>
                Guardar cliente
              </button>
              <button className="boton-secundario flex-1" onClick={() => setMostrarAltaRapida(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
