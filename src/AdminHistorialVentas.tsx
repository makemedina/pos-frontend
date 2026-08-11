import { useEffect, useState } from 'react';
import { formatoMoneda } from './formato';
import { exportarAExcel } from './exportarExcel';
import { VentaDetalleModal } from './VentaDetalleModal';
import {
  obtenerHistorialVentas,
  buscarClientes,
  type VentaHistorial,
  type Cliente,
} from './api';

interface Props {
  onCerrar?: () => void;
  esAdmin: boolean;
  esInicio?: boolean;
  onAbrirMenu?: () => void;
  onNuevaVenta?: () => void;
  onVerSinSincronizar?: () => void;
  ventasPendientesCount?: number;
  onVerCotizaciones?: () => void;
  cotizacionesPendientesCount?: number;
  onVerAntiguedadStock?: () => void;
  lotesAntiguosCount?: number;
  mensajeGlobal?: string | null;
  onCerrarMensajeGlobal?: () => void;
}

type Periodo = 'dia' | 'semana' | 'mes' | 'anio' | 'rango';

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function AdminHistorialVentas({
  onCerrar,
  esAdmin,
  esInicio,
  onAbrirMenu,
  onNuevaVenta,
  onVerSinSincronizar,
  ventasPendientesCount = 0,
  onVerCotizaciones,
  cotizacionesPendientesCount = 0,
  onVerAntiguedadStock,
  lotesAntiguosCount = 0,
  mensajeGlobal,
  onCerrarMensajeGlobal,
}: Props) {
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [desde, setDesde] = useState(() => formatDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [hasta, setHasta] = useState(() => formatDateInput(new Date()));
  const [metodoPago, setMetodoPago] = useState<string>('');
  const [verCanceladas, setVerCanceladas] = useState(false);

  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [resultadosCliente, setResultadosCliente] = useState<Cliente[]>([]);
  const [clienteElegido, setClienteElegido] = useState<Cliente | null>(null);

  const [ventas, setVentas] = useState<VentaHistorial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [notaAbierta, setNotaAbierta] = useState<string | null>(null);

  // Se recarga automaticamente cada vez que cambia cualquier filtro --
  // ya no hace falta un boton de "Aplicar filtros".
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, desde, hasta, metodoPago, clienteElegido, verCanceladas]);

  async function cargar() {
    setCargando(true);
    try {
      const data = await obtenerHistorialVentas({
        periodo,
        desde: periodo === 'rango' ? desde : undefined,
        hasta: periodo === 'rango' ? hasta : undefined,
        clienteId: clienteElegido?.id,
        metodoPago: metodoPago || undefined,
        incluirCanceladas: verCanceladas,
      });
      setVentas(data);
      setMensaje(null);
    } catch {
      setMensaje('No se pudo cargar el historial de ventas.');
    } finally {
      setCargando(false);
    }
  }

  async function buscarCliente(valor: string) {
    setBusquedaCliente(valor);
    if (valor.length < 2) {
      setResultadosCliente([]);
      return;
    }
    setResultadosCliente(await buscarClientes(valor));
  }

  function elegirCliente(c: Cliente) {
    setClienteElegido(c);
    setResultadosCliente([]);
    setBusquedaCliente('');
  }

  function quitarFiltroCliente() {
    setClienteElegido(null);
  }

  const totalPeriodo = ventas.filter((v) => !v.cancelada).reduce((acc, v) => acc + v.total, 0);
  const cobradoPeriodo = ventas.filter((v) => !v.cancelada).reduce((acc, v) => acc + (v.total - v.saldoPendiente), 0);

  async function exportar() {
    try {
      // Una fila por PRODUCTO vendido (no por venta), para que la cantidad
      // de kg de cada producto vaya en su propia columna sin mezclarse
      // con los demas productos de la misma nota.
      const filas = ventas.flatMap((v) =>
        v.items.map((it) => ({
          Folio: v.folio,
          Fecha: new Date(v.fecha).toLocaleString(),
          Cliente: v.cliente.nombre,
          Vendedor: v.vendedor.nombre,
          Producto: it.producto,
          Marca: it.marca,
          'Cantidad (kg)': it.cantidad,
          'Precio unitario': it.precioUnitario,
          // Solo aparecen si el backend las mando (usuario con permiso de ver utilidad).
          ...(it.costoUnitario !== undefined ? { Costo: it.costoUnitario } : {}),
          ...(it.utilidad !== undefined ? { Utilidad: it.utilidad } : {}),
          Subtotal: it.cantidad * it.precioUnitario,
          'Total de la venta': v.total,
          'Saldo pendiente': v.saldoPendiente,
          Estado: v.estadoPago,
          'Metodo(s) de pago': v.metodosPago.join(', '),
        }))
      );
      await exportarAExcel(filas, 'historial-ventas');
    } catch {
      setMensaje('No hay ventas para exportar con estos filtros.');
    }
  }

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: '1rem' }}>
        {esInicio ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={onAbrirMenu} style={{ width: 'auto', padding: '0 14px' }} aria-label="Menú">☰</button>
            <h2 style={{ margin: 0 }}>Ventas</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={exportar} style={{ width: 'auto', padding: '0 12px' }} aria-label="Exportar a Excel">
                📊
              </button>
              <button onClick={onVerSinSincronizar} style={{ width: 'auto', padding: '0 12px' }} aria-label="Sincronizar">
                🔄{ventasPendientesCount > 0 ? ` ${ventasPendientesCount}` : ''}
              </button>
              <button onClick={onVerCotizaciones} style={{ width: 'auto', padding: '0 12px' }} aria-label="Cotizaciones pendientes">
                📋{cotizacionesPendientesCount > 0 ? ` ${cotizacionesPendientesCount}` : ''}
              </button>
              <button className="boton-primario" onClick={onNuevaVenta} style={{ width: 'auto', padding: '0 16px' }} aria-label="Nueva venta">
                Nuevo
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Historial de ventas</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={exportar}>📊 Exportar Excel</button>
              <button onClick={onCerrar}>Cerrar</button>
            </div>
          </div>
        )}

        {mensajeGlobal && (
          <div className="banner-mensaje" onClick={onCerrarMensajeGlobal}>
            {mensajeGlobal}
          </div>
        )}

        {esInicio && ventasPendientesCount > 0 && (
          <div
            className="banner-mensaje"
            onClick={onVerSinSincronizar}
            style={{ background: '#fff7e6', color: '#92400e', cursor: 'pointer' }}
          >
            📴 Tienes {ventasPendientesCount} venta{ventasPendientesCount !== 1 ? 's' : ''} sin sincronizar — toca para verlas
          </div>
        )}

        {esInicio && lotesAntiguosCount > 0 && (
          <div
            className="banner-mensaje"
            onClick={onVerAntiguedadStock}
            style={{ background: '#fff2f1', color: '#b91c1c', cursor: 'pointer' }}
          >
            ⏳ Tienes {lotesAntiguosCount} lote{lotesAntiguosCount !== 1 ? 's' : ''} con más de 15 días en stock — toca para verlos
          </div>
        )}

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {/* Filtros */}
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

            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span>Metodo de pago</span>
              <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                <option value="">Todos</option>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </label>
          </div>

          <div>
            <span style={{ display: 'block', marginBottom: 4 }}>Cliente</span>
            {clienteElegido ? (
              <div className="cliente-chip">
                <span>{clienteElegido.nombre}</span>
                <button onClick={quitarFiltroCliente}>Quitar filtro</button>
              </div>
            ) : (
              <>
                <input
                  className="buscador"
                  placeholder="Buscar cliente por nombre o telefono"
                  value={busquedaCliente}
                  onChange={(e) => buscarCliente(e.target.value)}
                />
                {resultadosCliente.map((c) => (
                  <div key={c.id} className="resultado-cliente" onClick={() => elegirCliente(c)}>
                    {c.nombre} · {c.telefono}
                  </div>
                ))}
              </>
            )}
          </div>

          <label className="fila-switch" style={{ marginTop: 8 }}>
            <span>Mostrar ventas canceladas</span>
            <button
              type="button"
              className={`switch ${verCanceladas ? 'on' : ''}`}
              onClick={() => setVerCanceladas((v) => !v)}
            >
              <span className="switch-bola" />
            </button>
          </label>
        </div>

        {/* Resumen del periodo filtrado */}
        {!cargando && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, flex: 1 }}>
              <strong>{ventas.length}</strong> venta{ventas.length !== 1 ? 's' : ''}
            </div>
            <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, flex: 1 }}>
              Total: <strong>{formatoMoneda(totalPeriodo)}</strong>
            </div>
            <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, flex: 1 }}>
              Cobrado: <strong>{formatoMoneda(cobradoPeriodo)}</strong>
            </div>
          </div>
        )}

        {cargando ? (
          <p>Cargando...</p>
        ) : ventas.length === 0 ? (
          <p style={{ color: '#6b7280' }}>No hay ventas con esos filtros.</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {ventas.map((v) => (
              <div
                key={v.id}
                style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, cursor: 'pointer' }}
                onClick={() => setNotaAbierta(v.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong>Venta #{v.folio}</strong>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                      {new Date(v.fecha).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 13 }}>
                      {v.cliente.nombre} · {v.cliente.telefono}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      Vendio: {v.vendedor.nombre} · {v.metodosPago.join(', ') || 'sin pago registrado'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div><strong>{formatoMoneda(v.total)}</strong></div>
                    {v.cancelada ? (
                      <div style={{ fontSize: 12, color: '#b91c1c', fontWeight: 700 }}>❌ Cancelada</div>
                    ) : (
                      <div style={{ fontSize: 12, color: v.estadoPago === 'pagada' ? '#16a34a' : '#b91c1c' }}>
                        {v.estadoPago === 'pagada' ? 'Pagada' : `Saldo: ${formatoMoneda(v.saldoPendiente)}`}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 8, fontSize: 13, color: '#374151' }}>
                  {v.items.map((it, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{it.producto} {it.marca} · {it.cantidad} kg</span>
                      <span>{formatoMoneda((it.cantidad * it.precioUnitario))}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {notaAbierta && (
        <VentaDetalleModal
          ventaId={notaAbierta}
          esAdmin={esAdmin}
          onCerrar={() => setNotaAbierta(null)}
          onCancelada={cargar}
        />
      )}
    </div>
  );
}
