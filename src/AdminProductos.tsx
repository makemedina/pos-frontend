import { useEffect, useState } from 'react';
import {
  obtenerProductosGestion,
  obtenerHistorialVariante,
  type ProductoGestion,
  type MovimientoVariante,
} from './api';
import { VentaDetalleModal } from './VentaDetalleModal';
import { CompraDetalleModal } from './CompraDetalleModal';

interface Props {
  onCerrar: () => void;
  onIrAjusteGeneral: () => void;
  onRegistrarAjuste: (variante: { id: string; producto: string; marca: string }) => void;
  esAdmin: boolean;
}

const ETIQUETAS_TIPO: Record<MovimientoVariante['tipo'], { texto: string; color: string }> = {
  entrada: { texto: 'Entrada (compra)', color: '#16a34a' },
  salida: { texto: 'Salida (venta)', color: '#b91c1c' },
  merma: { texto: 'Merma', color: '#b91c1c' },
  correccion_positiva: { texto: 'Corrección +', color: '#16a34a' },
  correccion_negativa: { texto: 'Corrección −', color: '#b91c1c' },
};

export function AdminProductos({ onCerrar, onIrAjusteGeneral, onRegistrarAjuste, esAdmin }: Props) {
  const [productos, setProductos] = useState<ProductoGestion[]>([]);
  const [verSinStock, setVerSinStock] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [productoElegido, setProductoElegido] = useState<ProductoGestion | null>(null);
  const [historial, setHistorial] = useState<MovimientoVariante[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  const [ventaAbierta, setVentaAbierta] = useState<string | null>(null);
  const [compraAbierta, setCompraAbierta] = useState<string | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      const data = await obtenerProductosGestion();
      setProductos(data);
    } catch {
      setMensaje('No se pudieron cargar los productos.');
    } finally {
      setCargando(false);
    }
  }

  async function abrirProducto(p: ProductoGestion) {
    setProductoElegido(p);
    setCargandoHistorial(true);
    try {
      setHistorial(await obtenerHistorialVariante(p.id));
    } catch {
      setMensaje('No se pudo cargar el historial de este producto.');
    } finally {
      setCargandoHistorial(false);
    }
  }

  function volverALista() {
    setProductoElegido(null);
    setHistorial([]);
  }

  function clickMovimiento(m: MovimientoVariante) {
    if (!m.navegarA) return;
    if (m.navegarA.tipo === 'venta') setVentaAbierta(m.navegarA.id);
    else setCompraAbierta(m.navegarA.id);
  }

  const productosVisibles = verSinStock ? productos : productos.filter((p) => p.stockDisponible > 0);

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>{productoElegido ? `${productoElegido.producto} · ${productoElegido.marca}` : 'Productos'}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {!productoElegido && <button onClick={onIrAjusteGeneral}>⚖️ Ajuste de inventario</button>}
            <button onClick={productoElegido ? volverALista : onCerrar}>
              {productoElegido ? '← Productos' : 'Cerrar'}
            </button>
          </div>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {/* ---------- LISTA DE PRODUCTOS ---------- */}
        {!productoElegido && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input type="checkbox" checked={verSinStock} onChange={(e) => setVerSinStock(e.target.checked)} />
              Ver también productos sin stock
            </label>

            {cargando ? (
              <p>Cargando...</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {productosVisibles.length === 0 && <p style={{ color: '#6b7280' }}>No hay productos que coincidan.</p>}
                {productosVisibles.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)',
                      padding: '0.6rem 0.75rem',
                      borderRadius: 14,
                      cursor: 'pointer',
                      background: p.stockDisponible === 0 ? '#fff4f4' : undefined,
                    }}
                    onClick={() => abrirProducto(p)}
                  >
                    <div>
                      <strong>{p.producto}</strong> {p.marca}
                      {p.pocoStock && <span style={{ color: '#b91c1c', fontSize: 12 }}> · poco stock</span>}
                    </div>
                    <div style={{ fontWeight: 700 }}>{p.stockDisponible.toFixed(1)} kg</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ---------- DETALLE + HISTORIAL DE UN PRODUCTO ---------- */}
        {productoElegido && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14 }}>
              <div>
                <div>Stock disponible: <strong>{productoElegido.stockDisponible.toFixed(1)} kg</strong></div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>Precio de venta: ${productoElegido.precioVenta.toFixed(2)}/kg</div>
              </div>
              <button
                onClick={() =>
                  onRegistrarAjuste({ id: productoElegido.id, producto: productoElegido.producto, marca: productoElegido.marca })
                }
              >
                ⚖️ Registrar ajuste
              </button>
            </div>

            <h3>Historial de movimientos</h3>
            {cargandoHistorial ? (
              <p>Cargando...</p>
            ) : historial.length === 0 ? (
              <p style={{ color: '#6b7280' }}>Sin movimientos registrados.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {historial.map((m) => {
                  const info = ETIQUETAS_TIPO[m.tipo];
                  const clickeable = !!m.navegarA;
                  return (
                    <div
                      key={`${m.tipo}-${m.id}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)',
                        padding: '0.6rem 0.75rem',
                        borderRadius: 14,
                        cursor: clickeable ? 'pointer' : 'default',
                      }}
                      onClick={() => clickMovimiento(m)}
                    >
                      <div>
                        <div style={{ fontSize: 12, color: info.color, fontWeight: 600 }}>{info.texto}</div>
                        <div style={{ fontSize: 13 }}>{m.referencia}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(m.fecha).toLocaleString()}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: m.cantidad >= 0 ? '#16a34a' : '#b91c1c' }}>
                          {m.cantidad >= 0 ? '+' : ''}{m.cantidad.toFixed(1)} kg
                        </div>
                        {clickeable && <div style={{ fontSize: 11, color: '#007aff' }}>Ver detalle →</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {ventaAbierta && (
        <VentaDetalleModal
          ventaId={ventaAbierta}
          esAdmin={esAdmin}
          onCerrar={() => setVentaAbierta(null)}
          onCancelada={() => {
            if (productoElegido) abrirProducto(productoElegido);
          }}
        />
      )}
      {compraAbierta && <CompraDetalleModal compraId={compraAbierta} onCerrar={() => setCompraAbierta(null)} />}
    </div>
  );
}
