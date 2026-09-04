import { useEffect, useState } from 'react';
import { formatoMoneda } from './formato';
import {
  buscarVariantes,
  obtenerCostosProveedor,
  guardarCostoProveedor,
  eliminarCostoProveedor,
  obtenerUltimoCostoCompra,
  type VarianteBusqueda,
  type CostoProveedorProducto,
} from './api';

interface Props {
  proveedorId: string;
  proveedorNombre: string;
  onCerrar: () => void;
}

export function ProveedorCostos({ proveedorId, proveedorNombre, onCerrar }: Props) {
  const [costos, setCostos] = useState<CostoProveedorProducto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<VarianteBusqueda[]>([]);
  const [varianteElegida, setVarianteElegida] = useState<VarianteBusqueda | null>(null);
  const [costoNuevo, setCostoNuevo] = useState('');
  const [guardando, setGuardando] = useState(false);
  // Ultimo costo con el que se le compro esta variante a este proveedor
  // (segun el historial real de Compras) -- se usa para precargar el
  // campo de costo como sugerencia, en vez de partir de $0.
  const [ultimaCompra, setUltimaCompra] = useState<{ costo: number; fecha: string } | null>(null);
  const [cargandoUltimaCompra, setCargandoUltimaCompra] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [costoEdicion, setCostoEdicion] = useState('');
  const [ultimaCompraEdicion, setUltimaCompraEdicion] = useState<{ costo: number; fecha: string } | null>(null);

  useEffect(() => {
    cargar();
  }, [proveedorId]);

  async function cargar() {
    setCargando(true);
    try {
      setCostos(await obtenerCostosProveedor(proveedorId));
    } catch {
      setMensaje('No se pudieron cargar los costos de este proveedor.');
    } finally {
      setCargando(false);
    }
  }

  async function buscar(valor: string) {
    setBusqueda(valor);
    if (valor.length < 2) {
      setResultados([]);
      return;
    }
    setResultados(await buscarVariantes(valor));
  }

  async function elegirVariante(v: VarianteBusqueda) {
    setVarianteElegida(v);
    setResultados([]);
    setBusqueda('');
    setCostoNuevo('');
    setUltimaCompra(null);
    setCargandoUltimaCompra(true);
    try {
      const ultimo = await obtenerUltimoCostoCompra(proveedorId, v.id);
      setUltimaCompra(ultimo);
      if (ultimo) setCostoNuevo(String(ultimo.costo));
    } catch {
      // Si falla, no pasa nada -- el usuario sigue pudiendo capturar el costo a mano.
    } finally {
      setCargandoUltimaCompra(false);
    }
  }

  async function agregarCosto() {
    if (!varianteElegida) return;
    const costo = Number(costoNuevo);
    if (!costo || costo <= 0) {
      setMensaje('Escribe un costo válido.');
      return;
    }
    setGuardando(true);
    try {
      await guardarCostoProveedor(proveedorId, varianteElegida.id, costo);
      setVarianteElegida(null);
      setCostoNuevo('');
      cargar();
    } catch (err: any) {
      setMensaje(err.message || 'No se pudo guardar el costo.');
    } finally {
      setGuardando(false);
    }
  }

  async function empezarEdicion(c: CostoProveedorProducto) {
    setEditandoId(c.varianteId);
    setCostoEdicion(String(c.costo));
    setUltimaCompraEdicion(null);
    try {
      setUltimaCompraEdicion(await obtenerUltimoCostoCompra(proveedorId, c.varianteId));
    } catch {
      // Informativo -- si falla, se sigue pudiendo editar a mano.
    }
  }

  async function guardarEdicion(varianteId: string) {
    const costo = Number(costoEdicion);
    if (!costo || costo <= 0) {
      setMensaje('Escribe un costo válido.');
      return;
    }
    try {
      await guardarCostoProveedor(proveedorId, varianteId, costo);
      setEditandoId(null);
      cargar();
    } catch (err: any) {
      setMensaje(err.message || 'No se pudo guardar el costo.');
    }
  }

  async function eliminar(varianteId: string) {
    try {
      await eliminarCostoProveedor(proveedorId, varianteId);
      cargar();
    } catch (err: any) {
      setMensaje(err.message || 'No se pudo eliminar el costo.');
    }
  }

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 620, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Costos de {proveedorNombre}</h2>
          <button onClick={onCerrar}>Cerrar</button>
        </div>

        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
          Precios de referencia que este proveedor ofrece por producto — es solo informativo, para comparar
          entre proveedores. No afecta el costo real que se registra al hacer una compra.
        </p>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        <div style={{ position: 'relative' }}>
          {!varianteElegida ? (
            <input
              className="buscador"
              placeholder="Buscar producto para agregar su costo..."
              value={busqueda}
              onChange={(e) => buscar(e.target.value)}
            />
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.5rem 0.75rem', borderRadius: 10 }}>
                  <strong>{varianteElegida.producto.nombre}</strong> · {varianteElegida.marca}
                </div>
                <input
                  type="number"
                  placeholder="Costo"
                  value={costoNuevo}
                  onChange={(e) => setCostoNuevo(e.target.value)}
                  style={{ width: 110 }}
                />
                <button onClick={agregarCosto} disabled={guardando} style={{ width: 'auto', padding: '0 14px' }}>
                  Guardar
                </button>
                <button
                  onClick={() => {
                    setVarianteElegida(null);
                    setUltimaCompra(null);
                  }}
                  style={{ width: 'auto', padding: '0 14px' }}
                >
                  Cancelar
                </button>
              </div>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>
                {cargandoUltimaCompra
                  ? 'Buscando el último costo de compra...'
                  : ultimaCompra
                    ? `Se precargó el último costo con el que se le compró: ${formatoMoneda(ultimaCompra.costo)} (${new Date(ultimaCompra.fecha).toLocaleDateString()}). Puedes ajustarlo.`
                    : 'Este proveedor no tiene compras registradas de este producto todavía.'}
              </p>
            </div>
          )}

          {resultados.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5, background: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', borderRadius: 10, marginTop: 4, overflow: 'hidden' }}>
              {resultados.map((v) => (
                <div
                  key={v.id}
                  onClick={() => elegirVariante(v)}
                  style={{ padding: '0.6rem 0.85rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                >
                  <strong>{v.producto.nombre}</strong> · {v.marca}
                </div>
              ))}
            </div>
          )}
        </div>

        {cargando ? (
          <p style={{ textAlign: 'center', color: '#6b7280' }}>Cargando...</p>
        ) : costos.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#6b7280' }}>Este proveedor no tiene costos registrados todavía.</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {costos.map((c) => (
              <div key={c.varianteId} style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{c.producto}</strong>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>{c.marca}</div>
                  </div>
                  {editandoId === c.varianteId ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="number"
                        value={costoEdicion}
                        onChange={(e) => setCostoEdicion(e.target.value)}
                        style={{ width: 100 }}
                      />
                      <button onClick={() => guardarEdicion(c.varianteId)} style={{ width: 'auto', padding: '0 12px' }}>Guardar</button>
                      <button onClick={() => setEditandoId(null)} style={{ width: 'auto', padding: '0 12px' }}>Cancelar</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <strong>{formatoMoneda(c.costo)}</strong>
                      <button onClick={() => empezarEdicion(c)} style={{ width: 'auto', padding: '0 12px' }}>Editar</button>
                      <button
                        onClick={() => eliminar(c.varianteId)}
                        style={{ width: 'auto', padding: '0 12px', background: '#fff2f1', color: '#b91c1c' }}
                      >
                        Quitar
                      </button>
                    </div>
                  )}
                </div>
                {editandoId === c.varianteId && ultimaCompraEdicion && (
                  <p style={{ fontSize: 12, color: '#6b7280', margin: '6px 0 0' }}>
                    Último costo de compra: {formatoMoneda(ultimaCompraEdicion.costo)} (
                    {new Date(ultimaCompraEdicion.fecha).toLocaleDateString()}){' '}
                    {ultimaCompraEdicion.costo !== Number(costoEdicion) && (
                      <button
                        onClick={() => setCostoEdicion(String(ultimaCompraEdicion.costo))}
                        style={{ width: 'auto', padding: '0 8px', fontSize: 12 }}
                      >
                        Usar este
                      </button>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
