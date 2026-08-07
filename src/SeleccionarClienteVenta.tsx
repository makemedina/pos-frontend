import { useState } from 'react';
import { buscarClientes, crearClienteRapido, type Cliente } from './api';
import { obtenerClientesCache } from './offline';

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
    try {
      const cliente = await crearClienteRapido(nombreNuevo, telefonoNuevo);
      onSeleccionar(cliente);
    } catch {
      setMensaje('No se pudo crear el cliente.');
    }
  }

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
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

        <h2 style={{ margin: 0 }}>¿A quién le vendes?</h2>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
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
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="boton-primario" onClick={guardarClienteNuevo} style={{ flex: 1 }}>
                Guardar cliente
              </button>
              <button className="boton-secundario" onClick={() => setMostrarAltaRapida(false)} style={{ flex: 1 }}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
