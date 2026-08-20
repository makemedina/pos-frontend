import { useEffect, useState } from 'react';
import { formatoMoneda } from './formato';
import {
  obtenerHistorialCompras,
  buscarProveedores,
  type CompraHistorial,
  type Proveedor,
} from './api';
import { exportarAExcel } from './exportarExcel';
import { CompraDetalleModal } from './CompraDetalleModal';

interface Props {
  onCerrar: () => void;
}

type Periodo = 'dia' | 'ayer' | 'semana' | 'semana_pasada' | 'mes' | 'anio' | 'rango';

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const CARD = { border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14 };

export function AdminHistorialCompras({ onCerrar }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [desde, setDesde] = useState(() => formatDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [hasta, setHasta] = useState(() => formatDateInput(new Date()));
  const [estadoPago, setEstadoPago] = useState('');

  const [busquedaProveedor, setBusquedaProveedor] = useState('');
  const [resultadosProveedor, setResultadosProveedor] = useState<Proveedor[]>([]);
  const [proveedorElegido, setProveedorElegido] = useState<Proveedor | null>(null);

  const [compras, setCompras] = useState<CompraHistorial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [compraAbierta, setCompraAbierta] = useState<string | null>(null);

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, desde, hasta, estadoPago, proveedorElegido]);

  async function cargar() {
    setCargando(true);
    try {
      const data = await obtenerHistorialCompras({
        periodo,
        desde: periodo === 'rango' ? desde : undefined,
        hasta: periodo === 'rango' ? hasta : undefined,
        proveedorId: proveedorElegido?.id,
        estadoPago: estadoPago || undefined,
      });
      setCompras(data);
      setMensaje(null);
    } catch {
      setMensaje('No se pudo cargar el historial de compras.');
    } finally {
      setCargando(false);
    }
  }

  async function buscarProveedor(valor: string) {
    setBusquedaProveedor(valor);
    if (valor.length < 2) {
      setResultadosProveedor([]);
      return;
    }
    setResultadosProveedor(await buscarProveedores(valor));
  }

  function elegirProveedor(p: Proveedor) {
    setProveedorElegido(p);
    setResultadosProveedor([]);
    setBusquedaProveedor('');
  }

  async function exportar() {
    try {
      const filas = compras.flatMap((c) =>
        c.items.map((it) => ({
          Fecha: new Date(c.fecha).toLocaleDateString(),
          Proveedor: c.proveedor.nombre,
          Factura: c.numeroFactura || '',
          Producto: it.producto,
          Marca: it.marca,
          'Cantidad (kg)': it.cantidad,
          Costo: it.costoUnitario,
          Subtotal: it.cantidad * it.costoUnitario,
          'Total de la compra': c.total,
          'Saldo pendiente': c.saldoPendiente,
          Estado: c.estadoPago,
          'Metodo(s) de pago': c.metodosPago.join(', '),
        }))
      );
      await exportarAExcel(filas, 'historial-compras');
    } catch {
      setMensaje('No hay compras para exportar con estos filtros.');
    }
  }

  const totalPeriodo = compras.reduce((acc, c) => acc + c.total, 0);
  const pendientePeriodo = compras.reduce((acc, c) => acc + c.saldoPendiente, 0);

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Historial de compras</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={exportar}>📊 Exportar Excel</button>
            <button onClick={onCerrar}>Cerrar</button>
          </div>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        <div style={{ ...CARD, display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span>Periodo</span>
              <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
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

            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span>Estado</span>
              <select value={estadoPago} onChange={(e) => setEstadoPago(e.target.value)}>
                <option value="">Todos</option>
                <option value="pagada">Pagada</option>
                <option value="parcial">Parcial</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </label>
          </div>

          <div>
            <span style={{ display: 'block', marginBottom: 4 }}>Proveedor</span>
            {proveedorElegido ? (
              <div className="cliente-chip">
                <span>{proveedorElegido.nombre}</span>
                <button onClick={() => setProveedorElegido(null)}>Quitar filtro</button>
              </div>
            ) : (
              <>
                <input
                  className="buscador"
                  placeholder="Buscar proveedor"
                  value={busquedaProveedor}
                  onChange={(e) => buscarProveedor(e.target.value)}
                />
                {resultadosProveedor.map((p) => (
                  <div key={p.id} className="resultado-cliente" onClick={() => elegirProveedor(p)}>
                    {p.nombre}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {!cargando && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ ...CARD, flex: 1 }}>
              <strong>{compras.length}</strong> compra{compras.length !== 1 ? 's' : ''}
            </div>
            <div style={{ ...CARD, flex: 1 }}>
              Total: <strong>{formatoMoneda(totalPeriodo)}</strong>
            </div>
            <div style={{ ...CARD, flex: 1 }}>
              Pendiente: <strong>{formatoMoneda(pendientePeriodo)}</strong>
            </div>
          </div>
        )}

        {cargando ? (
          <p>Cargando...</p>
        ) : compras.length === 0 ? (
          <p style={{ color: '#6b7280' }}>No hay compras con esos filtros.</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {compras.map((c) => (
              <div key={c.id} style={{ ...CARD, cursor: 'pointer' }} onClick={() => setCompraAbierta(c.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong>{c.proveedor.nombre}</strong>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                      {new Date(c.fecha).toLocaleDateString()} · Factura: {c.numeroFactura || 'sin número'}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      {c.metodosPago.join(', ') || 'Sin pago registrado'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div><strong>{formatoMoneda(c.total)}</strong></div>
                    {c.cancelada ? (
                      <div style={{ fontSize: 12, color: '#b91c1c', fontWeight: 700 }}>❌ Cancelada</div>
                    ) : (
                      <div style={{ fontSize: 12, color: c.estadoPago === 'pagada' ? '#16a34a' : '#b91c1c' }}>
                        {c.estadoPago === 'pagada' ? 'Pagada' : `Saldo: ${formatoMoneda(c.saldoPendiente)}`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {compraAbierta && (
        <CompraDetalleModal compraId={compraAbierta} onCerrar={() => setCompraAbierta(null)} onCancelada={cargar} />
      )}
    </div>
  );
}
