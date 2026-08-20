import { useEffect, useMemo, useState } from 'react';
import { formatoMoneda, formatoKg } from './formato';
import { headerAuth, API_URL } from './api';
import { exportarVariasHojas } from './exportarExcel';

interface DiaResumen {
  fecha: string;
  facturacion: number;
  ventasCantidad: number;
  ticketMedio: number;
  ganancia: number;
  utilidadCobrada: number;
  kgVendidos: number;
  totalCobrado: number;
  utilidadNeta: number;
  utilidadNetaCobrada: number;
  porcentajeEfectivo: number;
}

interface DashboardData {
  totalVentas: number;
  totalCobrado: number;
  utilidadBruta: number;
  utilidadCobrada: number;
  kgVendidos: number;
  totalGastos: number;
  utilidadNeta: number;
  utilidadNetaCobrada: number;
  ventasCantidad: number;
  ticketMedio: number;
  porcentajeEfectivo: number;
  productosMasVendidos: Array<[string, number]>;
  productosMasVendidosPorValor: Array<[string, number]>;
  mejoresClientesPorValor: Array<[string, number]>;
  ventasPorVendedor: Array<[string, number]>;
  detallePorDia: DiaResumen[];
}

interface Props {
  onCerrar: () => void;
}

type MetricaClave =
  | 'facturacion'
  | 'ventas'
  | 'ticketMedio'
  | 'ganancia'
  | 'utilidadCobrada'
  | 'kgVendidos'
  | 'totalCobrado'
  | 'utilidadNeta'
  | 'utilidadNetaCobrada'
  | 'medioDePago';

const METRICAS_INFO: Record<MetricaClave, { titulo: string; obtenerValor: (d: DiaResumen) => string }> = {
  facturacion: { titulo: 'Facturación por día', obtenerValor: (d) => formatoMoneda(d.facturacion) },
  ventas: { titulo: 'Ventas por día', obtenerValor: (d) => String(d.ventasCantidad) },
  ticketMedio: { titulo: 'Ticket medio por día', obtenerValor: (d) => formatoMoneda(d.ticketMedio) },
  ganancia: { titulo: 'Utilidad en papel por día', obtenerValor: (d) => formatoMoneda(d.ganancia) },
  utilidadCobrada: { titulo: 'Utilidad cobrada por día', obtenerValor: (d) => formatoMoneda(d.utilidadCobrada) },
  kgVendidos: { titulo: 'Kg vendidos por día', obtenerValor: (d) => `${formatoKg(d.kgVendidos)} kg` },
  totalCobrado: { titulo: 'Total cobrado por día', obtenerValor: (d) => formatoMoneda(d.totalCobrado) },
  utilidadNeta: { titulo: 'Utilidad neta por día', obtenerValor: (d) => formatoMoneda(d.utilidadNeta) },
  utilidadNetaCobrada: { titulo: 'Utilidad neta cobrada por día', obtenerValor: (d) => formatoMoneda(d.utilidadNetaCobrada) },
  medioDePago: { titulo: 'Medio de pago por día', obtenerValor: (d) => `${d.porcentajeEfectivo.toFixed(1)}% efectivo` },
};

function formatearFechaDia(fecha: string) {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function AdminDashboard({ onCerrar }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState('dia');
  const [desde, setDesde] = useState(() => formatDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [hasta, setHasta] = useState(() => formatDateInput(new Date()));
  const [metricaExpandida, setMetricaExpandida] = useState<MetricaClave | null>(null);

  const filtroLabel = useMemo(() => {
    switch (periodo) {
      case 'dia': return 'Hoy';
      case 'ayer': return 'Ayer';
      case 'semana': return 'Esta semana (lun-dom)';
      case 'semana_pasada': return 'Semana pasada (lun-dom)';
      case 'mes': return 'Mes actual';
      case 'anio': return 'Año actual';
      case 'rango': return `Rango ${desde || '—'} / ${hasta || '—'}`;
      default: return 'Periodo';
    }
  }, [periodo, desde, hasta]);

  // Se recarga automaticamente cada vez que cambia cualquier filtro --
  // ya no hace falta un boton de "Aplicar filtros".
  useEffect(() => {
    cargar({ periodo, desde, hasta });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, desde, hasta]);

  async function cargar(filtro: { periodo: string; desde: string; hasta: string }) {
    try {
      const params = new URLSearchParams({ periodo: filtro.periodo });
      if (filtro.periodo === 'rango') {
        if (filtro.desde) params.set('desde', filtro.desde);
        if (filtro.hasta) params.set('hasta', filtro.hasta);
      }
      const res = await fetch(`${API_URL}/dashboard?${params.toString()}`, { headers: headerAuth() });
      if (!res.ok) throw new Error('No se pudo cargar');
      setData(await res.json());
      setMensaje(null);
    } catch {
      setMensaje('No se pudo cargar el dashboard');
    }
  }

  async function exportar() {
    if (!data) return;
    try {
      await exportarVariasHojas(
        [
          {
            nombre: 'Resumen',
            filas: [
              {
                Periodo: filtroLabel,
                Facturación: data.totalVentas,
                Ventas: data.ventasCantidad,
                'Ticket medio': data.ticketMedio,
                'Kg vendidos': data.kgVendidos,
                'Utilidad en papel': data.utilidadBruta,
                'Utilidad cobrada': data.utilidadCobrada,
                'Total cobrado': data.totalCobrado,
                'Total gastos': data.totalGastos,
                'Utilidad neta': data.utilidadNeta,
                'Utilidad neta cobrada': data.utilidadNetaCobrada,
                '% pagos en efectivo': data.porcentajeEfectivo,
              },
            ],
          },
          {
            nombre: 'Productos mas vendidos (valor)',
            filas: data.productosMasVendidosPorValor.map(([nombre, valor]) => ({
              Producto: nombre,
              Valor: valor,
            })),
          },
          {
            nombre: 'Mejores clientes (valor)',
            filas: data.mejoresClientesPorValor.map(([nombre, valor]) => ({
              Cliente: nombre,
              Valor: valor,
            })),
          },
          {
            nombre: 'Ventas por vendedor',
            filas: data.ventasPorVendedor.map(([nombre, valor]) => ({
              Vendedor: nombre,
              Valor: valor,
            })),
          },
        ],
        'dashboard'
      );
    } catch {
      setMensaje('No hay datos para exportar.');
    }
  }

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 860, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>Dashboard</h2>
            <small style={{ color: '#666' }}>{filtroLabel}</small>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={exportar}>📊 Exportar Excel</button>
            <button onClick={onCerrar}>Cerrar</button>
          </div>
        </div>

        <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span>Periodo</span>
              <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
                <option value="dia">Hoy</option>
                <option value="ayer">Ayer</option>
                <option value="semana">Esta semana</option>
                <option value="semana_pasada">Semana pasada</option>
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
        </div>

        {mensaje && <div className="banner-mensaje">{mensaje}</div>}

        {data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div
                style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, cursor: 'pointer' }}
                onClick={() => setMetricaExpandida('facturacion')}
              >
                <strong>Facturación</strong>
                <div>{formatoMoneda(data.totalVentas)}</div>
              </div>
              <div
                style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, cursor: 'pointer' }}
                onClick={() => setMetricaExpandida('ventas')}
              >
                <strong>Ventas</strong>
                <div>{data.ventasCantidad}</div>
              </div>
              <div
                style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, cursor: 'pointer' }}
                onClick={() => setMetricaExpandida('ticketMedio')}
              >
                <strong>Ticket medio</strong>
                <div>{formatoMoneda(data.ticketMedio)}</div>
              </div>
              <div
                style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, cursor: 'pointer' }}
                onClick={() => setMetricaExpandida('kgVendidos')}
              >
                <strong>Kg vendidos</strong>
                <div>{formatoKg(data.kgVendidos)} kg</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div
                style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, cursor: 'pointer' }}
                onClick={() => setMetricaExpandida('ganancia')}
              >
                <strong>Utilidad en papel</strong>
                <div>{formatoMoneda(data.utilidadBruta)}</div>
              </div>
              <div
                style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, cursor: 'pointer' }}
                onClick={() => setMetricaExpandida('utilidadCobrada')}
              >
                <strong>Utilidad cobrada</strong>
                <div>{formatoMoneda(data.utilidadCobrada)}</div>
              </div>
              <div
                style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, cursor: 'pointer' }}
                onClick={() => setMetricaExpandida('totalCobrado')}
              >
                <strong>Total cobrado</strong>
                <div>{formatoMoneda(data.totalCobrado)}</div>
              </div>
              <div
                style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, cursor: 'pointer' }}
                onClick={() => setMetricaExpandida('utilidadNeta')}
              >
                <strong>Utilidad neta</strong>
                <div>{formatoMoneda(data.utilidadNeta)}</div>
              </div>
              <div
                style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, cursor: 'pointer' }}
                onClick={() => setMetricaExpandida('utilidadNetaCobrada')}
              >
                <strong>Utilidad neta cobrada</strong>
                <div>{formatoMoneda(data.utilidadNetaCobrada)}</div>
              </div>
              <div
                style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, cursor: 'pointer' }}
                onClick={() => setMetricaExpandida('medioDePago')}
              >
                <strong>Medio de pago</strong>
                <div>{data.porcentajeEfectivo.toFixed(1)}% efectivo</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{(100 - data.porcentajeEfectivo).toFixed(1)}% transferencia</div>
              </div>
            </div>

            <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
              <h3>Productos más vendidos por valor</h3>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {data.productosMasVendidosPorValor.length === 0 && <p style={{ color: '#6b7280' }}>Sin datos en este periodo.</p>}
                {data.productosMasVendidosPorValor.map(([nombre, valor]) => (
                  <div key={nombre} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{nombre}</span>
                    <strong>{formatoMoneda(valor)}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
              <h3>Mejores clientes por valor</h3>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {data.mejoresClientesPorValor.length === 0 && <p style={{ color: '#6b7280' }}>Sin datos en este periodo.</p>}
                {data.mejoresClientesPorValor.map(([nombre, valor]) => (
                  <div key={nombre} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{nombre}</span>
                    <strong>{formatoMoneda(valor)}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
              <h3>Ventas por vendedor</h3>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {data.ventasPorVendedor.length === 0 && <p style={{ color: '#6b7280' }}>Sin datos en este periodo.</p>}
                {data.ventasPorVendedor.map(([nombre, valor]) => (
                  <div key={nombre} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{nombre}</span>
                    <strong>{formatoMoneda(valor)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {metricaExpandida && data && (
        <div className="modal-fondo" onClick={() => setMetricaExpandida(null)}>
          <div className="modal-contenido" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <p className="titulo">{METRICAS_INFO[metricaExpandida].titulo}</p>
              <button className="boton-cerrar" onClick={() => setMetricaExpandida(null)}>✕</button>
            </div>
            {data.detallePorDia.length === 0 ? (
              <p style={{ color: '#6b7280' }}>Sin datos en este periodo.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {data.detallePorDia.map((d) => (
                  <div key={d.fecha} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderBottom: '1px solid #e5e5ea', paddingBottom: 6 }}>
                    <span style={{ textTransform: 'capitalize' }}>{formatearFechaDia(d.fecha)}</span>
                    <strong>{METRICAS_INFO[metricaExpandida].obtenerValor(d)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
