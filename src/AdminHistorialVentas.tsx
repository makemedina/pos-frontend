import { Icono } from './iconos';
import { useEffect, useState } from 'react';
import { formatoMoneda, etiquetaMetodoPago, formatoFecha, formatoFechaHora } from './formato';
import { exportarAExcel, numeroSemana } from './exportarExcel';
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
  onVerAnaliticaVentas?: () => void;
  clientesEnRiesgoCount?: number;
  onVerLlamadasHoy?: () => void;
  llamadasPendientesHoyCount?: number;
  onVerNotasAntiguas?: () => void;
  notasAntiguasCount?: number;
  mensajeGlobal?: string | null;
  onCerrarMensajeGlobal?: () => void;
}

type Periodo =
  | 'dia'
  | 'ayer'
  | 'antier'
  | 'semana'
  | 'semana_pasada'
  | 'hace_2_semanas'
  | 'hace_3_semanas'
  | 'mes'
  | 'anio'
  | 'rango';

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
  onVerAnaliticaVentas,
  clientesEnRiesgoCount = 0,
  onVerLlamadasHoy,
  llamadasPendientesHoyCount = 0,
  onVerNotasAntiguas,
  notasAntiguasCount = 0,
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
          Fecha: formatoFecha(new Date(v.fecha)),
          Hora: new Date(v.fecha).toLocaleTimeString(),
          Semana: numeroSemana(new Date(v.fecha)),
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
          'Metodo(s) de pago': v.metodosPago.map(etiquetaMetodoPago).join(', '),
          Cancelada: v.cancelada ? 'Sí' : 'No',
          'Cancelada el': v.canceladaEn ? formatoFechaHora(new Date(v.canceladaEn)) : '',
        }))
      );
      await exportarAExcel(filas, 'historial-ventas');
    } catch {
      setMensaje('No hay ventas para exportar con estos filtros.');
    }
  }

  return (
    <div className="pantalla-centrada pantalla-arriba">
      <div className="contenido-pantalla contenido-760">
        {esInicio ? (
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <button className="boton-hamburguesa" onClick={onAbrirMenu} style={{ width: 'auto', padding: '0 14px' }} aria-label="Menú">☰</button>
            <h2 className="m-0">Ventas</h2>
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <button onClick={exportar} style={{ width: 'auto', padding: '0 12px' }} aria-label="Exportar a Excel">
                <Icono nombre="tabla" size={16} />
              </button>
              <button onClick={onVerSinSincronizar} style={{ width: 'auto', padding: '0 12px' }} aria-label="Sincronizar">
                <Icono nombre="sincronizar" size={16} />{ventasPendientesCount > 0 ? ` ${ventasPendientesCount}` : ''}
              </button>
              <button onClick={onVerCotizaciones} style={{ width: 'auto', padding: '0 12px' }} aria-label="Cotizaciones pendientes">
                <Icono nombre="pendientes" size={16} />{cotizacionesPendientesCount > 0 ? ` ${cotizacionesPendientesCount}` : ''}
              </button>
              <button className="boton-primario" onClick={onNuevaVenta} style={{ width: 'auto', padding: '0 16px' }} aria-label="Nueva venta">
                Nuevo
              </button>
            </div>
          </div>
        ) : (
          <div className="fila-entre-centro">
            <h2>Historial de ventas</h2>
            <div className="fila-gap-8">
              <button onClick={exportar}><Icono nombre="tabla" size={16} /> Exportar Excel</button>
              <button onClick={onCerrar}>Cerrar</button>
            </div>
          </div>
        )}

        {mensajeGlobal && (
          <div className="banner-mensaje" onClick={onCerrarMensajeGlobal}>
            {mensajeGlobal}
          </div>
        )}

        {esInicio && (ventasPendientesCount > 0 || lotesAntiguosCount > 0 || clientesEnRiesgoCount > 0 || llamadasPendientesHoyCount > 0 || notasAntiguasCount > 0) && (
          <div className="avisos">
            {ventasPendientesCount > 0 && (
              <button
                type="button"
                className="aviso aviso-advertencia"
                onClick={onVerSinSincronizar}
                title={`Tienes ${ventasPendientesCount} venta${ventasPendientesCount !== 1 ? 's' : ''} sin sincronizar — toca para verlas`}
              >
                <Icono nombre="sinconexion" size={16} /> {ventasPendientesCount} sin sincronizar
              </button>
            )}
            {lotesAntiguosCount > 0 && (
              <button
                type="button"
                className="aviso"
                onClick={onVerAntiguedadStock}
                title={`Tienes ${lotesAntiguosCount} lote${lotesAntiguosCount !== 1 ? 's' : ''} con más de 15 días en stock — toca para verlos`}
              >
                <Icono nombre="reloj" size={16} /> {lotesAntiguosCount} lote{lotesAntiguosCount !== 1 ? 's' : ''} +15 días
              </button>
            )}
            {clientesEnRiesgoCount > 0 && (
              <button
                type="button"
                className="aviso"
                onClick={onVerAnaliticaVentas}
                title={`Tienes ${clientesEnRiesgoCount} cliente${clientesEnRiesgoCount !== 1 ? 's' : ''} en riesgo — toca para ver a quién llamarle`}
              >
                <Icono nombre="objetivo" size={16} /> {clientesEnRiesgoCount} cliente{clientesEnRiesgoCount !== 1 ? 's' : ''} en riesgo
              </button>
            )}
            {llamadasPendientesHoyCount > 0 && (
              <button
                type="button"
                className="aviso"
                onClick={onVerLlamadasHoy}
                title={`Tienes ${llamadasPendientesHoyCount} llamada${llamadasPendientesHoyCount !== 1 ? 's' : ''} pendiente${llamadasPendientesHoyCount !== 1 ? 's' : ''} hoy — toca para ver`}
              >
                <Icono nombre="telefono" size={16} /> {llamadasPendientesHoyCount} llamada{llamadasPendientesHoyCount !== 1 ? 's' : ''} hoy
              </button>
            )}
            {notasAntiguasCount > 0 && (
              <button
                type="button"
                className="aviso"
                onClick={onVerNotasAntiguas}
                title={`Tienes ${notasAntiguasCount} nota${notasAntiguasCount !== 1 ? 's' : ''} con más de 7 días sin liquidarse — toca para ver`}
              >
                <Icono nombre="calendario" size={16} /> {notasAntiguasCount} nota{notasAntiguasCount !== 1 ? 's' : ''} +7 días
              </button>
            )}
          </div>
        )}

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {/* Filtros */}
        <div style={{ border: 'none', boxShadow: 'var(--sombra-tarjeta)', padding: '0.75rem', borderRadius: 14, display: 'grid', gap: '0.75rem' }}>
          <div className="fila-gap-075-wrap">
            <label className="grid-gap-025">
              <span>Periodo</span>
              <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
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
                <label className="grid-gap-025">
                  <span>Desde</span>
                  <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
                </label>
                <label className="grid-gap-025">
                  <span>Hasta</span>
                  <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                </label>
              </>
            )}

            <label className="grid-gap-025">
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

          <label className="fila-switch mt-8">
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
          <div className="fila-gap-075-wrap">
            <div style={{ border: 'none', boxShadow: 'var(--sombra-tarjeta)', padding: '0.75rem', borderRadius: 14, flex: 1 }}>
              <strong>{ventas.length}</strong> venta{ventas.length !== 1 ? 's' : ''}
            </div>
            <div style={{ border: 'none', boxShadow: 'var(--sombra-tarjeta)', padding: '0.75rem', borderRadius: 14, flex: 1 }}>
              Total: <strong>{formatoMoneda(totalPeriodo)}</strong>
            </div>
            <div style={{ border: 'none', boxShadow: 'var(--sombra-tarjeta)', padding: '0.75rem', borderRadius: 14, flex: 1 }}>
              Cobrado: <strong>{formatoMoneda(cobradoPeriodo)}</strong>
            </div>
          </div>
        )}

        {cargando ? (
          <p>Cargando...</p>
        ) : ventas.length === 0 ? (
          <p className="t-tenue">No hay ventas con esos filtros.</p>
        ) : (
          <div className="lista-tarjetas grid-gap-075">
            {ventas.map((v) => (
              <div
                key={v.id}
                className="tarjeta-click"
                onClick={() => setNotaAbierta(v.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong>Venta #{v.folio}</strong>
                    <div className="t-tenue-13">
                      {formatoFechaHora(new Date(v.fecha))}
                    </div>
                    <div className="fs-13">
                      <span style={{ fontSize: 16, fontWeight: 700 }}>{v.cliente.nombre}</span> · {v.cliente.telefono}
                    </div>
                    <div className="t-tenue-12">
                      Vendio: {v.vendedor.nombre} · {v.metodosPago.map(etiquetaMetodoPago).join(', ') || 'sin pago registrado'}
                    </div>
                  </div>
                  <div className="t-der">
                    <div><strong>{formatoMoneda(v.total)}</strong></div>
                    {v.cancelada ? (
                      <div style={{ fontSize: 12, color: 'var(--peligro)', fontWeight: 700 }}>❌ Cancelada</div>
                    ) : (
                      <div style={{ fontSize: 12, color: v.estadoPago === 'pagada' ? 'var(--exito)' : 'var(--peligro)' }}>
                        {v.estadoPago === 'pagada' ? 'Pagada' : `Saldo: ${formatoMoneda(v.saldoPendiente)}`}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--texto-fuerte)' }}>
                  {v.items.map((it, idx) => (
                    <div key={idx} className="fila-entre">
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
