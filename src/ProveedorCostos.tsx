import { useEffect, useState } from 'react';
import { formatoMoneda } from './formato';
import {
  buscarVariantes,
  obtenerCostosProveedor,
  guardarCostoProveedor,
  eliminarCostoProveedor,
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

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [costoEdicion, setCostoEdicion] = useState('');

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

  function elegirVariante(v: VarianteBusqueda) {
    setVarianteElegida(v);
    setResultados([]);
    setBusqueda('');
    setCostoNuevo('');
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

  function empezarEdicion(c: CostoProveedorProducto) {
    setEditandoId(c.varianteId);
    setCostoEdicion(String(c.costo));
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
              <button onClick={() => setVarianteElegida(null)} style={{ width: 'auto', padding: '0 14px' }}>
                Cancelar
              </button>
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
              <div key={c.varianteId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14 }}>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
