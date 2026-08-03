import { useEffect, useState } from 'react';
import {
  obtenerFacturasPendientes,
  obtenerPagosDeCompra,
  registrarPagoCompra,
  type FacturaPendiente,
  type PagoCompraHistorial,
} from './api';

interface Props {
  onCerrar: () => void;
}

export function AdminCuentasPorPagar({ onCerrar }: Props) {
  const [facturas, setFacturas] = useState<FacturaPendiente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Nivel 2: historial de pagos de una factura
  const [facturaElegida, setFacturaElegida] = useState<FacturaPendiente | null>(null);
  const [pagos, setPagos] = useState<PagoCompraHistorial[]>([]);
  const [monto, setMonto] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      const data = await obtenerFacturasPendientes();
      setFacturas(data);
    } catch {
      setMensaje('No se pudieron cargar las cuentas por pagar');
    } finally {
      setCargando(false);
    }
  }

  async function abrirFactura(f: FacturaPendiente) {
    setFacturaElegida(f);
    setMonto('');
    setCargando(true);
    try {
      const data = await obtenerPagosDeCompra(f.id);
      setPagos(data);
    } catch {
      setMensaje('No se pudo cargar el historial de pagos.');
    } finally {
      setCargando(false);
    }
  }

  function volverALista() {
    setFacturaElegida(null);
    setPagos([]);
    cargar();
  }

  async function handlePago(e: React.FormEvent) {
    e.preventDefault();
    if (!facturaElegida) return;

    try {
      await registrarPagoCompra(facturaElegida.id, Number(monto), metodoPago);
      setMensaje(`Pago registrado para ${facturaElegida.proveedor.nombre}`);
      setMonto('');
      // Refresca el saldo de la factura y su historial de pagos
      const [facturasData, pagosData] = await Promise.all([
        obtenerFacturasPendientes(),
        obtenerPagosDeCompra(facturaElegida.id),
      ]);
      const facturaActualizada = facturasData.find((f) => f.id === facturaElegida.id) ?? null;
      setFacturas(facturasData);
      setPagos(pagosData);
      setFacturaElegida(facturaActualizada);
      if (!facturaActualizada) {
        // Ya quedo saldada, ya no aparece en pendientes -- regresamos a la lista
        volverALista();
      }
    } catch (err: any) {
      if (err.code === 'MONTO_INVALIDO') {
        setMensaje(err.error || 'El monto del pago no es válido.');
      } else {
        setMensaje('No se pudo registrar el pago');
      }
    }
  }

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>{facturaElegida ? `Factura de ${facturaElegida.proveedor.nombre}` : 'Cuentas por pagar'}</h2>
          <button onClick={onCerrar}>Cerrar</button>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {cargando && <p>Cargando...</p>}

        {/* ---------- NIVEL 1: LISTA DE FACTURAS PENDIENTES ---------- */}
        {!cargando && !facturaElegida && (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {facturas.length === 0 && <p style={{ color: '#6b7280' }}>No hay cuentas por pagar.</p>}
            {facturas.map((f) => (
              <div
                key={f.id}
                style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, cursor: 'pointer' }}
                onClick={() => abrirFactura(f)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{f.proveedor.nombre}</strong>
                    <div style={{ fontSize: 13 }}>Factura: {f.numeroFactura || 'Sin factura'}</div>
                    <div style={{ fontSize: 13 }}>
                      Vence: {f.fechaVencimiento ? new Date(f.fechaVencimiento).toLocaleDateString() : 'Sin fecha'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div>Saldo: ${f.saldoPendiente.toFixed(2)}</div>
                    <small>{f.proveedor.telefono || ''}</small>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ---------- NIVEL 2: HISTORIAL DE ABONOS DE LA FACTURA ---------- */}
        {!cargando && facturaElegida && (
          <>
            <button onClick={volverALista} style={{ justifySelf: 'start' }}>← Todas las cuentas por pagar</button>

            <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total de la factura</span>
                <strong>${facturaElegida.total.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Saldo pendiente</span>
                <strong className={facturaElegida.saldoPendiente > 0 ? 'texto-alerta' : ''}>
                  ${facturaElegida.saldoPendiente.toFixed(2)}
                </strong>
              </div>
            </div>

            <h3>Historial de abonos</h3>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {pagos.length === 0 && <p style={{ color: '#6b7280' }}>Aún no se ha registrado ningún abono.</p>}
              {pagos.map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderBottom: '1px solid #e5e5ea', paddingBottom: 6 }}>
                  <span>
                    {new Date(p.fecha).toLocaleDateString()} · {new Date(p.fecha).toLocaleTimeString()} · {p.metodoPago}
                    <br />
                    <small style={{ color: '#6b7280' }}>Registró: {p.registradoPor.nombre}</small>
                  </span>
                  <strong>${p.monto.toFixed(2)}</strong>
                </div>
              ))}
            </div>

            {facturaElegida.saldoPendiente > 0 && (
              <form onSubmit={handlePago} style={{ display: 'grid', gap: '0.75rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
                <h3>Registrar nuevo abono</h3>
                <label>
                  Monto (saldo pendiente: ${facturaElegida.saldoPendiente.toFixed(2)})
                  <input
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    type="number"
                    step="0.01"
                    max={facturaElegida.saldoPendiente}
                    required
                  />
                </label>
                <label>
                  Método de pago
                  <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
                </label>
                <button type="submit">Guardar pago</button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
