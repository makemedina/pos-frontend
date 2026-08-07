import { useEffect, useState } from 'react';
import { formatoMoneda, formatoKg } from './formato';
import {
  obtenerMovimientosInventario,
  buscarProductos,
  type MovimientoInventario,
  type ResumenMovimientosInventario,
  type Producto,
} from './api';
import { exportarAExcel } from './exportarExcel';

interface Props {
  onCerrar: () => void;
}

type Periodo = 'dia' | 'semana' | 'mes' | 'anio' | 'rango';

const ETIQUETAS_TIPO: Record<MovimientoInventario['tipo'], { texto: string; color: string }> = {
  entrada: { texto: 'Entrada (compra)', color: '#16a34a' },
  salida: { texto: 'Salida (venta)', color: '#b91c1c' },
  merma: { texto: 'Merma', color: '#b91c1c' },
  correccion_positiva: { texto: 'Corrección +', color: '#16a34a' },
  correccion_negativa: { texto: 'Corrección −', color: '#b91c1c' },
};

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function AdminMovimientosInventario({ onCerrar }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [desde, setDesde] = useState(() => formatDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [hasta, setHasta] = useState(() => formatDateInput(new Date()));

  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [resultadosProducto, setResultadosProducto] = useState<Producto[]>([]);
  const [productoElegido, setProductoElegido] = useState<Producto | null>(null);

  const [resumen, setResumen] = useState<ResumenMovimientosInventario | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Se recarga automaticamente cada vez que cambia cualquier filtro --
  // ya no hace falta un boton de "Aplicar filtros".
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, desde, hasta, productoElegido]);

  async function cargar() {
    setCargando(true);
    try {
      const data = await obtenerMovimientosInventario({
        periodo,
        desde: periodo === 'rango' ? desde : undefined,
        hasta: periodo === 'rango' ? hasta : undefined,
        productoId: productoElegido?.id,
      });
      setResumen(data.resumen);
      setMovimientos(data.movimientos);
      setMensaje(null);
    } catch {
      setMensaje('No se pudo cargar el reporte de movimientos.');
    } finally {
      setCargando(false);
    }
  }

  async function buscarProducto(valor: string) {
    setBusquedaProducto(valor);
    if (valor.length < 2) {
      setResultadosProducto([]);
      return;
    }
    setResultadosProducto(await buscarProductos(valor));
  }

  function elegirProducto(p: Producto) {
    setProductoElegido(p);
    setResultadosProducto([]);
    setBusquedaProducto('');
  }

  function quitarFiltroProducto() {
    setProductoElegido(null);
  }

  async function exportar() {
    try {
      await exportarAExcel(
        movimientos.map((m) => ({
          Fecha: new Date(m.fecha).toLocaleString(),
          Tipo: ETIQUETAS_TIPO[m.tipo].texto,
          Producto: m.producto,
          Marca: m.marca,
          'Cantidad (kg)': m.cantidad,
          Valor: m.valor,
          Referencia: m.referencia,
        })),
        'movimientos-inventario'
      );
    } catch {
      setMensaje('No hay movimientos para exportar.');
    }
  }

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Movimientos de inventario</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={exportar}>📊 Exportar Excel</button>
            <button onClick={onCerrar}>Cerrar</button>
          </div>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span>Periodo</span>
              <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
                <option value="dia">Hoy</option>
                <option value="semana">Esta semana</option>
                <option value="mes">Este mes</option>
                <option value="anio">Este año</option>
                <option value="rango">Personalizado</option>
              </select>
            </label>

            {periodo === 'rango' && (
              <>
                <label style={{ display: 'grid', gap: '0.25rem' }}>
                  <span>Desde</span>
                  <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
                </label>
                <label style={{ display: 'grid', gap: '0.25rem' }}>
                  <span>Hasta</span>
                  <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                </label>
              </>
            )}
          </div>

          <div>
            <span style={{ display: 'block', marginBottom: 4 }}>Producto (opcional)</span>
            {productoElegido ? (
              <div className="cliente-chip">
                <span>{productoElegido.nombre}</span>
                <button onClick={quitarFiltroProducto}>Quitar filtro</button>
              </div>
            ) : (
              <>
                <input
                  className="buscador"
                  placeholder="Buscar producto"
                  value={busquedaProducto}
                  onChange={(e) => buscarProducto(e.target.value)}
                />
                {resultadosProducto.map((p) => (
                  <div key={p.id} className="resultado-cliente" onClick={() => elegirProducto(p)}>
                    {p.nombre}
                  </div>
                ))}
              </>
            )}
          </div>

        </div>

        {cargando ? (
          <p>Cargando...</p>
        ) : (
          <>
            {resumen && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
                <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14 }}>
                  <strong>Entradas</strong>
                  <div>{formatoKg(resumen.entradasKg)} kg</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>{formatoMoneda(resumen.entradasValor)}</div>
                </div>
                <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14 }}>
                  <strong>Salidas</strong>
                  <div>{formatoKg(resumen.salidasKg)} kg</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>{formatoMoneda(resumen.salidasValor)}</div>
                </div>
                <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14 }}>
                  <strong>Merma</strong>
                  <div>{formatoKg(resumen.mermaKg)} kg</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>{formatoMoneda(resumen.mermaValor)}</div>
                </div>
                <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14 }}>
                  <strong>Corrección neta</strong>
                  <div>{formatoKg(resumen.correccionNetaKg)} kg</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>{formatoMoneda(resumen.correccionNetaValor)}</div>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {movimientos.length === 0 && <p style={{ color: '#6b7280' }}>No hay movimientos con esos filtros.</p>}
              {movimientos.map((m) => {
                const info = ETIQUETAS_TIPO[m.tipo];
                return (
                  <div
                    key={`${m.tipo}-${m.id}`}
                    style={{ display: 'flex', justifyContent: 'space-between', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.6rem 0.75rem', borderRadius: 14 }}
                  >
                    <div>
                      <div>
                        <strong>{m.producto}</strong> {m.marca}
                      </div>
                      <div style={{ fontSize: 12, color: info.color, fontWeight: 600 }}>{info.texto}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{m.referencia}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(m.fecha).toLocaleString()}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: m.cantidad >= 0 ? '#16a34a' : '#b91c1c' }}>
                        {m.cantidad >= 0 ? '+' : ''}{formatoKg(m.cantidad)} kg
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{formatoMoneda(m.valor)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
