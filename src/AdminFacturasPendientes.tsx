import { useEffect, useState } from 'react';
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

  const facturasFiltradas = facturas.filter((f) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.trim().toLowerCase();
    return (
      f.proveedor.nombre.toLowerCase().includes(q) ||
      (f.numeroFactura || '').toLowerCase().includes(q)
    );
  });

  async function exportar() {
    try {
      await exportarAExcel(
        facturasFiltradas.map((f) => ({
          Proveedor: f.proveedor.nombre,
          Telefono: f.proveedor.telefono || '',
          Factura: f.numeroFactura || '',
          'Fecha de compra': new Date(f.fecha).toLocaleDateString(),
          Vencimiento: f.fechaVencimiento ? new Date(f.fechaVencimiento).toLocaleDateString() : '',
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
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Facturas pendientes</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={exportar}>📊 Exportar Excel</button>
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
          <p style={{ color: '#6b7280' }}>No hay facturas pendientes que coincidan.</p>
        ) : (
          <>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {facturasFiltradas.map((f) => (
                <div key={f.id} style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong>{f.proveedor.nombre}</strong>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>{f.proveedor.telefono || ''}</div>
                      <div style={{ fontSize: 13 }}>Factura: {f.numeroFactura || 'Sin factura'}</div>
                      <div style={{ fontSize: 13 }}>
                        Vence: {f.fechaVencimiento ? new Date(f.fechaVencimiento).toLocaleDateString() : 'Sin fecha'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div>Total: ${f.total.toFixed(2)}</div>
                      <div style={{ fontWeight: 700, color: '#b91c1c' }}>Saldo: ${f.saldoPendiente.toFixed(2)}</div>
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
                background: '#f8fafc',
                fontWeight: 700,
              }}
            >
              <span>Total pendiente a proveedores</span>
              <span>${totalPendiente.toFixed(2)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
