import { Icono } from './iconos';
import { useEffect, useState } from 'react';
import { formatoMoneda, formatoFecha } from './formato';
import { obtenerFacturasPendientes, type FacturaPendiente } from './api';
import { exportarAExcel } from './exportarExcel';

interface Props {
  onCerrar: () => void;
}

export function AdminFacturasPendientes({ onCerrar }: Props) {
  const [facturas, setFacturas] = useState<FacturaPendiente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      const data = await obtenerFacturasPendientes();
      setFacturas(data);
    } catch {
      setMensaje('No se pudieron cargar las facturas pendientes.');
    } finally {
      setCargando(false);
    }
  }

  const [busqueda, setBusqueda] = useState('');
  const totalPendiente = facturas.reduce((acc, f) => acc + f.saldoPendiente, 0);

  const facturasFiltradas = facturas
    .filter((f) => {
      if (!busqueda.trim()) return true;
      const q = busqueda.trim().toLowerCase();
      return (
        f.proveedor.nombre.toLowerCase().includes(q) ||
        (f.numeroFactura || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  async function exportar() {
    try {
      await exportarAExcel(
        facturasFiltradas.map((f) => ({
          Proveedor: f.proveedor.nombre,
          Telefono: f.proveedor.telefono || '',
          Factura: f.numeroFactura || '',
          'Fecha de compra': formatoFecha(new Date(f.fecha)),
          Vencimiento: f.fechaVencimiento ? formatoFecha(new Date(f.fechaVencimiento)) : '',
          Total: f.total,
          'Saldo pendiente': f.saldoPendiente,
        })),
        'facturas-pendientes'
      );
    } catch {
      setMensaje('No hay facturas pendientes para exportar.');
    }
  }

  return (
    <div className="pantalla-centrada pantalla-arriba">
      <div className="contenido-pantalla contenido-760">
        <div className="fila-entre-centro">
          <h2>Facturas pendientes</h2>
          <div className="fila-gap-8">
            <button onClick={exportar}><Icono nombre="tabla" size={16} /> Exportar Excel</button>
            <button onClick={onCerrar}>Cerrar</button>
          </div>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        <input
          className="buscador"
          placeholder="Buscar por proveedor o número de factura"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        {cargando ? (
          <p>Cargando...</p>
        ) : facturasFiltradas.length === 0 ? (
          <p className="t-tenue">No hay facturas pendientes que coincidan.</p>
        ) : (
          <>
            <div className="lista-tarjetas grid-gap-075">
              {facturasFiltradas.map((f) => (
                <div key={f.id} className="tarjeta-sombra">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong>{f.proveedor.nombre}</strong>
                      <div className="t-tenue-13">{f.proveedor.telefono || ''}</div>
                      <div className="fs-13">Factura: {f.numeroFactura || 'Sin factura'}</div>
                      <div className="fs-13">Compra: {formatoFecha(new Date(f.fecha))}</div>
                      <div className="fs-13">
                        Vence: {f.fechaVencimiento ? formatoFecha(new Date(f.fechaVencimiento)) : 'Sin fecha'}
                      </div>
                    </div>
                    <div className="t-der">
                      <div>Total: {formatoMoneda(f.total)}</div>
                      <div style={{ fontWeight: 700, color: 'var(--peligro)' }}>Saldo: {formatoMoneda(f.saldoPendiente)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.75rem',
                borderRadius: 14,
                background: 'var(--fondo-suave)',
                fontWeight: 700,
              }}
            >
              <span>Total pendiente a proveedores</span>
              <span>{formatoMoneda(totalPendiente)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
