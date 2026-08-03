import { useEffect, useMemo, useState } from 'react';
import { API_URL, headerAuth } from './api';

interface VentaResumen {
  id: string;
  folio?: number;
  cliente?: { nombre: string; telefono?: string };
  total?: number;
  fecha?: string;
  metodoPago?: string;
}

interface CompraResumen {
  id: string;
  numeroFactura?: string;
  proveedor?: { nombre: string; telefono?: string };
  total?: number;
  fecha?: string;
  metodoPago?: string;
}

interface Transaccion {
  id: string;
  tipo: 'Venta' | 'Compra';
  referencia: string;
  fecha: string;
  monto: number;
  metodoPago?: string;
  contrapartida?: string;
}

interface Props {
  onCerrar: () => void;
}

function formatearFecha(fecha?: string) {
  if (!fecha) return 'Sin fecha';
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) return fecha;
  return date.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

export function AdminTransacciones({ onCerrar }: Props) {
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<'todo' | 'Venta' | 'Compra'>('todo');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const transaccionesFiltradas = useMemo(
    () =>
      filtroTipo === 'todo'
        ? transacciones
        : transacciones.filter((transaccion) => transaccion.tipo === filtroTipo),
    [filtroTipo, transacciones]
  );

  useEffect(() => {
    cargarTransacciones();
  }, []);

  async function cargarTransacciones() {
    setCargando(true);
    try {
      const [ventasRes, comprasRes] = await Promise.all([
        fetch(`${API_URL}/ventas`, { headers: headerAuth() }),
        fetch(`${API_URL}/compras`, { headers: headerAuth() }),
      ]);

      if (!ventasRes.ok || !comprasRes.ok) {
        throw new Error('No se pudieron cargar las transacciones');
      }

      const ventasData: VentaResumen[] = await ventasRes.json();
      const comprasData: CompraResumen[] = await comprasRes.json();

      const ventas = ventasData.map((venta) => ({
        id: venta.id,
        tipo: 'Venta' as const,
        referencia: venta.folio ? `Folio ${venta.folio}` : venta.id,
        fecha: venta.fecha ?? '',
        monto: Number(venta.total ?? 0),
        metodoPago: venta.metodoPago,
        contrapartida: venta.cliente?.nombre ?? 'Cliente desconocido',
      }));

      const compras = comprasData.map((compra) => ({
        id: compra.id,
        tipo: 'Compra' as const,
        referencia: compra.numeroFactura ? `Factura ${compra.numeroFactura}` : compra.id,
        fecha: compra.fecha ?? '',
        monto: Number(compra.total ?? 0),
        metodoPago: compra.metodoPago,
        contrapartida: compra.proveedor?.nombre ?? 'Proveedor desconocido',
      }));

      setTransacciones([...ventas, ...compras].sort((a, b) => {
        const fechaA = new Date(a.fecha).getTime();
        const fechaB = new Date(b.fecha).getTime();
        return fechaB - fechaA;
      }));
      setMensaje(null);
    } catch {
      setMensaje('No se pudieron cargar las transacciones. Verifica que el backend tenga las rutas /ventas y /compras.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>Transacciones</h2>
            <small>Ventas y compras registradas</small>
          </div>
          <button onClick={onCerrar}>Cerrar</button>
        </div>

        {mensaje && <div className="banner-mensaje">{mensaje}</div>}

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setFiltroTipo('todo')}
            style={{ padding: '10px', borderRadius: 12, border: filtroTipo === 'todo' ? '2px solid #007aff' : '1px solid #e5e7eb', background: filtroTipo === 'todo' ? '#eff6ff' : '#f8fafc' }}
          >
            Todas
          </button>
          <button
            type="button"
            onClick={() => setFiltroTipo('Venta')}
            style={{ padding: '10px', borderRadius: 12, border: filtroTipo === 'Venta' ? '2px solid #007aff' : '1px solid #e5e7eb', background: filtroTipo === 'Venta' ? '#eff6ff' : '#f8fafc' }}
          >
            Ventas
          </button>
          <button
            type="button"
            onClick={() => setFiltroTipo('Compra')}
            style={{ padding: '10px', borderRadius: 12, border: filtroTipo === 'Compra' ? '2px solid #007aff' : '1px solid #e5e7eb', background: filtroTipo === 'Compra' ? '#eff6ff' : '#f8fafc' }}
          >
            Compras
          </button>
        </div>

        {cargando ? (
          <p>Cargando transacciones...</p>
        ) : transaccionesFiltradas.length === 0 ? (
          <p style={{ color: '#6b7280' }}>No se encontraron transacciones.</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {transaccionesFiltradas.map((transaccion) => (
              <div key={`${transaccion.tipo}-${transaccion.id}`} style={{ border: '1px solid #ddd', padding: '0.75rem', borderRadius: 8, background: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div>
                    <strong>{transaccion.tipo}</strong>
                    <div>{transaccion.referencia}</div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>{transaccion.contrapartida}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>${transaccion.monto.toFixed(2)}</div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>{formatearFecha(transaccion.fecha)}</div>
                    {transaccion.metodoPago ? <div style={{ fontSize: 12, color: '#6b7280' }}>{transaccion.metodoPago}</div> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
