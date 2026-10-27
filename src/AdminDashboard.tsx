import { useEffect, useMemo, useState } from 'react';
import { formatoMoneda, formatoKg, formatoFecha, etiquetaMetodoPago } from './formato';
import { headerAuth, API_URL, obtenerPendientesDeHoy, actualizarPendiente, type Pendiente, ORIGENES_CLIENTE } from './api';
import { exportarVariasHojas } from './exportarExcel';
import { intentarActivarNotificacionesAutomatico } from './push';

interface DiaResumen {
  fecha: string;
  facturacion: number;
  ventasCantidad: number;
  ticketMedio: number;
  ganancia: number;
  utilidadCobrada: number;
  kgVendidos: number;
  totalCobrado: number;
  gastos: number;
  utilidadNeta: number;
  utilidadNetaCobrada: number;
  porcentajeEfectivo: number;
}

interface GastoDetalle {
  id: string;
  fecha: string;
  concepto: string;
  monto: number;
  metodoPago: string;
  proveedor: string | null;
}

interface GastosCategoria {
  categoria: string;
  departamento: string;
  total: number;
  gastos: GastoDetalle[];
}

interface VentasOrigen {
  origen: string;
  totalVentas: number;
  utilidadBruta: number;
  ventasCantidad: number;
  clientesConCompra: number;
  clientesNuevos: number;
  clientesNuevosQueCompraron: number;
  clientes: Array<[string, number]>;
}

function etiquetaOrigen(origen: string) {
  if (origen === 'sin_dato') return 'Sin dato';
  return ORIGENES_CLIENTE.find((o) => o.valor === origen)?.etiqueta ?? origen;
}

interface DashboardData {
  totalVentas: number;
  totalCobrado: number;
  utilidadBruta: number;
  utilidadCobrada: number;
  kgVendidos: number;
  totalGastos: number;
  gastosCantidad: number;
  gastosPorCategoria: GastosCategoria[];
  utilidadNeta: number;
  utilidadNetaCobrada: number;
  ventasCantidad: number;
  ticketMedio: number;
  porcentajeEfectivo: number;
  productosMasVendidos: Array<[string, number]>;
  productosMasVendidosPorValor: Array<[string, number]>;
  mejoresClientesPorValor: Array<[string, number]>;
  detalleProductosPorValor: Record<string, Array<[string, number]>>;
  detalleClientesPorValor: Record<string, Array<[string, number]>>;
  detalleClientesPorVolumen: Record<string, Array<[string, number]>>;
  ventasPorVendedor: Array<[string, number]>;
  // Opcional: un backend anterior a este reporte no lo manda.
  ventasPorOrigen?: VentasOrigen[];
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
  | 'gastos'
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
  gastos: { titulo: 'Gastos por día', obtenerValor: (d) => formatoMoneda(d.gastos) },
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

const ESPACIOS_POR_SECCION = 10;

export function AdminDashboard({ onCerrar }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState('dia');
  const [desde, setDesde] = useState(() => formatDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [hasta, setHasta] = useState(() => formatDateInput(new Date()));
  const [metricaExpandida, setMetricaExpandida] = useState<MetricaClave | null>(null);
  // Detalle al hacer click en un producto de "Productos mas vendidos por
  // valor" (quien se lo compro) o en un cliente de "Mejores clientes por
  // valor" (que le compro) -- viene precalculado del backend, sin pedir
  // nada nuevo al servidor.
  const [detalleProducto, setDetalleProducto] = useState<string | null>(null);
  const [detalleCliente, setDetalleCliente] = useState<string | null>(null);
  // El detalle de un cliente se puede ver por valor ($) o por volumen
  // (kg) -- se reinicia a "valor" cada vez que se abre un cliente nuevo.
  const [detalleClientePestana, setDetalleClientePestana] = useState<'valor' | 'volumen'>('valor');
  // Cada lista del dashboard (productos, clientes, vendedores) muestra
  // solo los primeros ESPACIOS_POR_SECCION por default, con un boton
  // "Mostrar todos" para desplegar el resto -- el backend ya manda la
  // lista completa ordenada, esto es solo un recorte visual.
  const [mostrarTodosProductosVolumen, setMostrarTodosProductosVolumen] = useState(false);
  const [mostrarTodosProductos, setMostrarTodosProductos] = useState(false);
  const [mostrarTodosClientes, setMostrarTodosClientes] = useState(false);
  const [mostrarTodosVendedores, setMostrarTodosVendedores] = useState(false);
  const [mostrarTodosGastos, setMostrarTodosGastos] = useState(false);
  // Detalle al hacer click en una categoria de la seccion Gastos: los
  // gastos individuales de esa categoria en el periodo.
  const [detalleGastos, setDetalleGastos] = useState<GastosCategoria | null>(null);
  const [detalleOrigen, setDetalleOrigen] = useState<VentasOrigen | null>(null);
  const [pendientesHoy, setPendientesHoy] = useState<Pendiente[]>([]);
  const [guardandoPendienteId, setGuardandoPendienteId] = useState<string | null>(null);

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
    setMostrarTodosProductosVolumen(false);
    setMostrarTodosProductos(false);
    setMostrarTodosClientes(false);
    setMostrarTodosVendedores(false);
    setMostrarTodosGastos(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, desde, hasta]);

  // Independiente del filtro de periodo de arriba -- "hoy" siempre es hoy.
  useEffect(() => {
    obtenerPendientesDeHoy()
      .then(setPendientesHoy)
      .catch(() => {});
  }, []);

  // Pide permiso de notificaciones al entrar aqui (sin que el usuario
  // tenga que ir a buscar el boton en Pendientes) -- si todavia no se ha
  // decidido, se lo vuelve a preguntar cada vez que entra al Dashboard.
  useEffect(() => {
    intentarActivarNotificacionesAutomatico();
  }, []);

  async function toggleHechoPendiente(p: Pendiente) {
    setPendientesHoy((prev) => prev.map((x) => (x.id === p.id ? { ...x, hecho: !p.hecho } : x)));
    setGuardandoPendienteId(p.id);
    try {
      await actualizarPendiente(p.id, { hecho: !p.hecho });
    } catch {
      obtenerPendientesDeHoy().then(setPendientesHoy).catch(() => {});
    } finally {
      setGuardandoPendienteId(null);
    }
  }

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
            nombre: 'Gastos',
            filas: data.gastosPorCategoria.flatMap((c) =>
              c.gastos.map((g) => ({
                Fecha: formatoFecha(g.fecha),
                Categoría: c.categoria,
                Departamento: c.departamento,
                Concepto: g.concepto,
                Proveedor: g.proveedor ?? '',
                'Método de pago': etiquetaMetodoPago(g.metodoPago),
                Monto: g.monto,
              }))
            ),
          },
          {
            nombre: 'Ventas por origen',
            filas: (data.ventasPorOrigen ?? []).map((o) => ({
              Origen: etiquetaOrigen(o.origen),
              Facturación: o.totalVentas,
              'Utilidad en papel': o.utilidadBruta,
              Ventas: o.ventasCantidad,
              'Clientes que compraron': o.clientesConCompra,
              'Clientes nuevos': o.clientesNuevos,
              'Clientes nuevos que ya compraron': o.clientesNuevosQueCompraron,
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
      <div className="contenido-pantalla" style={{ width: '100%', maxWidth: 860, display: 'grid', gap: '1rem' }}>
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
                <option value="antier">Antier</option>
                <option value="semana">Esta semana</option>
                <option value="semana_pasada">Semana pasada</option>
                <option value="hace_2_semanas">Hace 2 semanas</option>
                <option value="hace_3_semanas">Hace 3 semanas</option>
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

        {pendientesHoy.length > 0 && (
          <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14, display: 'grid', gap: '0.5rem' }}>
            <h3 style={{ margin: 0 }}>📝 Pendientes de hoy</h3>
            {pendientesHoy.map((p) => (
              <label
                key={p.id}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', opacity: p.hecho ? 0.6 : 1 }}
              >
                <input
                  type="checkbox"
                  checked={p.hecho}
                  disabled={guardandoPendienteId === p.id}
                  onChange={() => toggleHechoPendiente(p)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <span style={{ textDecoration: p.hecho ? 'line-through' : 'none' }}>{p.concepto}</span>
                  {p.cliente && <div style={{ fontSize: 13, color: 'var(--ios-secondary-label)' }}>🧑‍🤝‍🧑 {p.cliente.nombre}</div>}
                  {p.notas && <div style={{ fontSize: 13, color: 'var(--ios-secondary-label)' }}>{p.notas}</div>}
                </span>
              </label>
            ))}
          </div>
        )}

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
                <div style={{ fontSize: 12, color: 'var(--ios-secondary-label)' }}>{(100 - data.porcentajeEfectivo).toFixed(1)}% transferencia</div>
              </div>
            </div>

            <div className="secciones-dashboard" style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
                <div
                  onClick={() => setMetricaExpandida('gastos')}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', cursor: 'pointer', marginBottom: 8 }}
                >
                  <h3 style={{ margin: 0 }}>Gastos</h3>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ color: 'var(--peligro)' }}>{formatoMoneda(data.totalGastos)}</strong>
                    <div style={{ fontSize: 12, color: 'var(--ios-secondary-label)' }}>
                      {data.gastosCantidad} gasto{data.gastosCantidad === 1 ? '' : 's'} · ver por día
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {data.gastosPorCategoria.length === 0 && <p style={{ color: 'var(--ios-secondary-label)' }}>Sin gastos en este periodo.</p>}
                  {(mostrarTodosGastos ? data.gastosPorCategoria : data.gastosPorCategoria.slice(0, ESPACIOS_POR_SECCION)).map((c) => (
                    <div
                      key={`${c.departamento}-${c.categoria}`}
                      onClick={() => setDetalleGastos(c)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    >
                      <span>
                        {c.categoria}
                        <div style={{ fontSize: 12, color: 'var(--ios-secondary-label)' }}>
                          {c.departamento} · {data.totalGastos > 0 ? ((c.total / data.totalGastos) * 100).toFixed(1) : '0.0'}%
                        </div>
                      </span>
                      <strong>{formatoMoneda(c.total)}</strong>
                    </div>
                  ))}
                </div>
                {data.gastosPorCategoria.length > ESPACIOS_POR_SECCION && (
                  <button
                    className="boton-secundario"
                    onClick={() => setMostrarTodosGastos((v) => !v)}
                    style={{ width: '100%', marginTop: 8 }}
                  >
                    {mostrarTodosGastos ? 'Mostrar menos' : `Mostrar todos (${data.gastosPorCategoria.length})`}
                  </button>
                )}
              </div>

              <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
                <h3>Productos más vendidos por volumen</h3>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {data.productosMasVendidos.length === 0 && <p style={{ color: 'var(--ios-secondary-label)' }}>Sin datos en este periodo.</p>}
                  {(mostrarTodosProductosVolumen ? data.productosMasVendidos : data.productosMasVendidos.slice(0, ESPACIOS_POR_SECCION)).map(([nombre, cantidad]) => (
                    <div key={nombre} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{nombre}</span>
                      <strong>{formatoKg(cantidad)} kg</strong>
                    </div>
                  ))}
                </div>
                {data.productosMasVendidos.length > ESPACIOS_POR_SECCION && (
                  <button
                    className="boton-secundario"
                    onClick={() => setMostrarTodosProductosVolumen((v) => !v)}
                    style={{ width: '100%', marginTop: 8 }}
                  >
                    {mostrarTodosProductosVolumen ? 'Mostrar menos' : `Mostrar todos (${data.productosMasVendidos.length})`}
                  </button>
                )}
              </div>

              <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
                <h3>Productos más vendidos por valor</h3>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {data.productosMasVendidosPorValor.length === 0 && <p style={{ color: 'var(--ios-secondary-label)' }}>Sin datos en este periodo.</p>}
                  {(mostrarTodosProductos ? data.productosMasVendidosPorValor : data.productosMasVendidosPorValor.slice(0, ESPACIOS_POR_SECCION)).map(([nombre, valor]) => (
                    <div
                      key={nombre}
                      onClick={() => setDetalleProducto(nombre)}
                      style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}
                    >
                      <span>{nombre}</span>
                      <strong>{formatoMoneda(valor)}</strong>
                    </div>
                  ))}
                </div>
                {data.productosMasVendidosPorValor.length > ESPACIOS_POR_SECCION && (
                  <button
                    className="boton-secundario"
                    onClick={() => setMostrarTodosProductos((v) => !v)}
                    style={{ width: '100%', marginTop: 8 }}
                  >
                    {mostrarTodosProductos ? 'Mostrar menos' : `Mostrar todos (${data.productosMasVendidosPorValor.length})`}
                  </button>
                )}
              </div>

              <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
                <h3>Mejores clientes por valor</h3>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {data.mejoresClientesPorValor.length === 0 && <p style={{ color: 'var(--ios-secondary-label)' }}>Sin datos en este periodo.</p>}
                  {(mostrarTodosClientes ? data.mejoresClientesPorValor : data.mejoresClientesPorValor.slice(0, ESPACIOS_POR_SECCION)).map(([nombre, valor]) => (
                    <div
                      key={nombre}
                      onClick={() => {
                        setDetalleCliente(nombre);
                        setDetalleClientePestana('valor');
                      }}
                      style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}
                    >
                      <span>{nombre}</span>
                      <strong>{formatoMoneda(valor)}</strong>
                    </div>
                  ))}
                </div>
                {data.mejoresClientesPorValor.length > ESPACIOS_POR_SECCION && (
                  <button
                    className="boton-secundario"
                    onClick={() => setMostrarTodosClientes((v) => !v)}
                    style={{ width: '100%', marginTop: 8 }}
                  >
                    {mostrarTodosClientes ? 'Mostrar menos' : `Mostrar todos (${data.mejoresClientesPorValor.length})`}
                  </button>
                )}
              </div>

              {data.ventasPorOrigen && (
              <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
                <h3 style={{ marginBottom: 4 }}>Ventas por origen del cliente</h3>
                <p style={{ fontSize: 12, color: 'var(--ios-secondary-label)', margin: '0 0 8px' }}>
                  Cómo llegaron los clientes que compraron. "Nuevos" son los dados de alta en este periodo.
                </p>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {data.ventasPorOrigen.length === 0 && <p style={{ color: 'var(--ios-secondary-label)' }}>Sin datos en este periodo.</p>}
                  {data.ventasPorOrigen.map((o) => (
                    <div
                      key={o.origen}
                      onClick={() => setDetalleOrigen(o)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                    >
                      <span>
                        {etiquetaOrigen(o.origen)}
                        <div style={{ fontSize: 12, color: 'var(--ios-secondary-label)' }}>
                          {o.ventasCantidad} venta{o.ventasCantidad === 1 ? '' : 's'} · {o.clientesConCompra} cliente
                          {o.clientesConCompra === 1 ? '' : 's'}
                          {o.clientesNuevos > 0 &&
                            ` · ${o.clientesNuevos} nuevo${o.clientesNuevos === 1 ? '' : 's'} (${o.clientesNuevosQueCompraron} ya compr${o.clientesNuevosQueCompraron === 1 ? 'ó' : 'aron'})`}
                        </div>
                      </span>
                      <div style={{ textAlign: 'right' }}>
                        <strong>{formatoMoneda(o.totalVentas)}</strong>
                        <div style={{ fontSize: 12, color: 'var(--ios-secondary-label)' }}>
                          {data.totalVentas > 0 ? ((o.totalVentas / data.totalVentas) * 100).toFixed(1) : '0.0'}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )}

              <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
                <h3>Ventas por vendedor</h3>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {data.ventasPorVendedor.length === 0 && <p style={{ color: 'var(--ios-secondary-label)' }}>Sin datos en este periodo.</p>}
                  {(mostrarTodosVendedores ? data.ventasPorVendedor : data.ventasPorVendedor.slice(0, ESPACIOS_POR_SECCION)).map(([nombre, valor]) => (
                    <div key={nombre} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{nombre}</span>
                      <strong>{formatoMoneda(valor)}</strong>
                    </div>
                  ))}
                </div>
                {data.ventasPorVendedor.length > ESPACIOS_POR_SECCION && (
                  <button
                    className="boton-secundario"
                    onClick={() => setMostrarTodosVendedores((v) => !v)}
                    style={{ width: '100%', marginTop: 8 }}
                  >
                    {mostrarTodosVendedores ? 'Mostrar menos' : `Mostrar todos (${data.ventasPorVendedor.length})`}
                  </button>
                )}
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
              <p style={{ color: 'var(--ios-secondary-label)' }}>Sin datos en este periodo.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {data.detallePorDia.map((d) => (
                  <div key={d.fecha} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderBottom: '1px solid var(--ios-separator)', paddingBottom: 6 }}>
                    <span style={{ textTransform: 'capitalize' }}>{formatearFechaDia(d.fecha)}</span>
                    <strong>{METRICAS_INFO[metricaExpandida].obtenerValor(d)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {detalleGastos && (
        <div className="modal-fondo" onClick={() => setDetalleGastos(null)}>
          <div className="modal-contenido" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <p className="titulo">
                {detalleGastos.categoria} — {formatoMoneda(detalleGastos.total)}
              </p>
              <button className="boton-cerrar" onClick={() => setDetalleGastos(null)}>✕</button>
            </div>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {detalleGastos.gastos.map((g) => (
                <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14, borderBottom: '1px solid var(--ios-separator)', paddingBottom: 6 }}>
                  <span>
                    {g.concepto}
                    <div style={{ fontSize: 12, color: 'var(--ios-secondary-label)' }}>
                      {formatoFecha(g.fecha)} · {etiquetaMetodoPago(g.metodoPago)}
                      {g.proveedor ? ` · ${g.proveedor}` : ''}
                    </div>
                  </span>
                  <strong>{formatoMoneda(g.monto)}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {detalleOrigen && (
        <div className="modal-fondo" onClick={() => setDetalleOrigen(null)}>
          <div className="modal-contenido" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <p className="titulo">
                {etiquetaOrigen(detalleOrigen.origen)} — {formatoMoneda(detalleOrigen.totalVentas)}
              </p>
              <button className="boton-cerrar" onClick={() => setDetalleOrigen(null)}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ios-secondary-label)', marginBottom: 8 }}>
              Utilidad en papel: {formatoMoneda(detalleOrigen.utilidadBruta)} · Clientes nuevos en el periodo:{' '}
              {detalleOrigen.clientesNuevos} ({detalleOrigen.clientesNuevosQueCompraron} ya compraron)
            </div>
            {detalleOrigen.clientes.length === 0 ? (
              <p style={{ color: 'var(--ios-secondary-label)' }}>Ningún cliente de este origen compró en el periodo.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {detalleOrigen.clientes.map(([cliente, valor]) => (
                  <div key={cliente} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderBottom: '1px solid var(--ios-separator)', paddingBottom: 6 }}>
                    <span>{cliente}</span>
                    <strong>{formatoMoneda(valor)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {detalleProducto && data && (
        <div className="modal-fondo" onClick={() => setDetalleProducto(null)}>
          <div className="modal-contenido" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <p className="titulo">{detalleProducto} — por cliente</p>
              <button className="boton-cerrar" onClick={() => setDetalleProducto(null)}>✕</button>
            </div>
            {(data.detalleProductosPorValor[detalleProducto] ?? []).length === 0 ? (
              <p style={{ color: 'var(--ios-secondary-label)' }}>Sin datos en este periodo.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {data.detalleProductosPorValor[detalleProducto].map(([cliente, valor]) => (
                  <div key={cliente} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderBottom: '1px solid var(--ios-separator)', paddingBottom: 6 }}>
                    <span>{cliente}</span>
                    <strong>{formatoMoneda(valor)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {detalleCliente && data && (
        <div className="modal-fondo" onClick={() => setDetalleCliente(null)}>
          <div className="modal-contenido" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <p className="titulo">{detalleCliente} — por producto</p>
              <button className="boton-cerrar" onClick={() => setDetalleCliente(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--ios-separator)', marginBottom: 8 }}>
              {(['valor', 'volumen'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setDetalleClientePestana(p)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '8px 4px',
                    borderRadius: 0,
                    borderBottom: detalleClientePestana === p ? '2px solid var(--ios-blue)' : '2px solid transparent',
                    fontWeight: detalleClientePestana === p ? 700 : 400,
                    color: detalleClientePestana === p ? 'var(--ios-blue)' : 'var(--texto-fuerte)',
                  }}
                >
                  {p === 'valor' ? 'Por valor' : 'Por volumen'}
                </button>
              ))}
            </div>

            {detalleClientePestana === 'valor' ? (
              (data.detalleClientesPorValor[detalleCliente] ?? []).length === 0 ? (
                <p style={{ color: 'var(--ios-secondary-label)' }}>Sin datos en este periodo.</p>
              ) : (
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {data.detalleClientesPorValor[detalleCliente].map(([producto, valor]) => (
                    <div key={producto} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderBottom: '1px solid var(--ios-separator)', paddingBottom: 6 }}>
                      <span>{producto}</span>
                      <strong>{formatoMoneda(valor)}</strong>
                    </div>
                  ))}
                </div>
              )
            ) : (data.detalleClientesPorVolumen[detalleCliente] ?? []).length === 0 ? (
              <p style={{ color: 'var(--ios-secondary-label)' }}>Sin datos en este periodo.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {data.detalleClientesPorVolumen[detalleCliente].map(([producto, cantidad]) => (
                  <div key={producto} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderBottom: '1px solid var(--ios-separator)', paddingBottom: 6 }}>
                    <span>{producto}</span>
                    <strong>{formatoKg(cantidad)} kg</strong>
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
