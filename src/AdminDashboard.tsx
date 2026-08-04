import { useEffect, useMemo, useState } from 'react';
import { formatoMoneda } from './formato';
import { headerAuth, API_URL } from './api';
import { exportarVariasHojas } from './exportarExcel';

interface DashboardData {
  totalVentas: number;
  totalCobrado: number;
  utilidadBruta: number;
  totalGastos: number;
  utilidadNeta: number;
  productosMasVendidos: Array<[string, number]>;
}

interface Props {
  onCerrar: () => void;
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
  const [periodo, setPeriodo] = useState('mes');
  const [desde, setDesde] = useState(() => formatDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [hasta, setHasta] = useState(() => formatDateInput(new Date()));

  const filtroLabel = useMemo(() => {
    switch (periodo) {
      case 'dia': return 'Hoy';
      case 'semana': return 'Última semana';
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
                'Total ventas': data.totalVentas,
                'Total cobrado': data.totalCobrado,
                'Utilidad bruta': data.utilidadBruta,
                'Total gastos': data.totalGastos,
                'Utilidad neta': data.utilidadNeta,
              },
            ],
          },
          {
            nombre: 'Productos mas vendidos',
            filas: data.productosMasVendidos.map(([nombre, cantidad]) => ({
              Producto: nombre,
              'Cantidad (kg)': cantidad,
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
        </div>

        {mensaje && <div className="banner-mensaje">{mensaje}</div>}

        {data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14 }}>
                <strong>Total ventas</strong>
                <div>{formatoMoneda(data.totalVentas)}</div>
              </div>
              <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14 }}>
                <strong>Total cobrado</strong>
                <div>{formatoMoneda(data.totalCobrado)}</div>
              </div>
              <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14 }}>
                <strong>Utilidad bruta</strong>
                <div>{formatoMoneda(data.utilidadBruta)}</div>
              </div>
              <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14 }}>
                <strong>Utilidad neta</strong>
                <div>{formatoMoneda(data.utilidadNeta)}</div>
              </div>
            </div>

            <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
              <h3>Productos más vendidos</h3>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {data.productosMasVendidos.map(([nombre, cantidad]) => (
                  <div key={nombre} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{nombre}</span>
                    <strong>{cantidad.toFixed(1)} kg</strong>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
