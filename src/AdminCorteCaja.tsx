import { useEffect, useState } from 'react';
import { formatoMoneda } from './formato';
import { obtenerCorteDelDia, guardarCorte, type ResumenCorteDia } from './api';
import { generarImagenRecibo, generarPdfRecibo, compartirArchivo, CompartirCanceladoError } from './reciboExport';

interface Props {
  onCerrar: () => void;
  onVerHistorial?: () => void;
}

export function AdminCorteCaja({ onCerrar, onVerHistorial }: Props) {
  const [efectivoContado, setEfectivoContado] = useState('');
  const [saldoBancoContado, setSaldoBancoContado] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ResumenCorteDia | null>(null);
  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState<'imagen' | 'pdf' | null>(null);

  useEffect(() => {
    cargarResumen();
  }, []);

  async function cargarResumen() {
    setCargando(true);
    try {
      const data = await obtenerCorteDelDia();
      setResumen(data);
    } catch {
      setMensaje('No se pudo cargar el resumen del día');
    } finally {
      setCargando(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await guardarCorte(Number(efectivoContado), Number(saldoBancoContado));
      setMensaje('Corte de caja guardado');
      setEfectivoContado('');
      setSaldoBancoContado('');
      cargarResumen();
    } catch (err: any) {
      if (err.code === 'CORTE_YA_EXISTE') {
        setMensaje(err.error || 'Ya existe un corte de caja para hoy.');
        cargarResumen();
      } else {
        setMensaje('No se pudo guardar el corte');
      }
    }
  }

  const tieneUtilidad = resumen?.utilidadDia !== undefined;

  async function descargarImagen() {
    setExportando('imagen');
    setMensaje(null);
    try {
      const blob = await generarImagenRecibo('corte-reporte');
      await compartirArchivo(blob, 'corte-de-caja.png', 'image/png');
    } catch (err: any) {
      if (!(err instanceof CompartirCanceladoError)) {
        setMensaje(err?.message || 'No se pudo generar la imagen del corte.');
      }
    } finally {
      setExportando(null);
    }
  }

  async function descargarPdf() {
    setExportando('pdf');
    setMensaje(null);
    try {
      const blob = await generarPdfRecibo('corte-reporte');
      await compartirArchivo(blob, 'corte-de-caja.pdf', 'application/pdf');
    } catch (err: any) {
      if (!(err instanceof CompartirCanceladoError)) {
        setMensaje(err?.message || 'No se pudo generar el PDF del corte.');
      }
    } finally {
      setExportando(null);
    }
  }

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Corte de caja</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {resumen && !cargando && (
              <>
                <button onClick={descargarImagen} disabled={!!exportando}>
                  {exportando === 'imagen' ? 'Generando...' : '🖼️ Imagen'}
                </button>
                <button onClick={descargarPdf} disabled={!!exportando}>
                  {exportando === 'pdf' ? 'Generando...' : '📄 PDF'}
                </button>
              </>
            )}
            {onVerHistorial && <button onClick={onVerHistorial}>Histórico</button>}
            <button onClick={onCerrar}>Cerrar</button>
          </div>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {cargando ? (
          <p>Cargando...</p>
        ) : (
          <div id="corte-reporte" style={{ display: 'grid', gap: '1rem', background: 'white' }}>            {resumen?.yaExisteCorteHoy ? (
              <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14, background: '#f0fdf4' }}>
                <strong>El corte de hoy ya se realizó.</strong>
                <div style={{ marginTop: 6 }}>
                  Efectivo contado: {formatoMoneda(resumen.corteExistente?.efectivoContado)}
                </div>
                <div>Saldo en banco: {formatoMoneda(resumen.corteExistente?.saldoBancoContado)}</div>
                {onVerHistorial && (
                  <p style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>
                    Si te equivocaste al capturarlo, corrígelo desde el botón "Histórico".
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.75rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
                <h3>Captura del día</h3>
                {resumen && (
                  <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                    El sistema lleva {formatoMoneda(resumen.saldoEfectivoSistema)} en efectivo — compáralo contra lo que cuentes:
                  </p>
                )}
                <input value={efectivoContado} onChange={(e) => setEfectivoContado(e.target.value)} type="number" step="0.01" placeholder="Efectivo contado" required />
                {resumen && (
                  <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                    El sistema lleva {formatoMoneda(resumen.saldoBancoSistema)} en bancos (por transferencias) — compáralo contra tu banco real:
                  </p>
                )}
                <input value={saldoBancoContado} onChange={(e) => setSaldoBancoContado(e.target.value)} type="number" step="0.01" placeholder="Saldo en banco" required />
                <button type="submit">Guardar corte</button>
              </form>
            )}

            {resumen && (
              <div style={{ display: 'grid', gap: '0.75rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
                <h3>Resumen del día</h3>
                <div>Ventas: {formatoMoneda(Number(resumen.ventas?.total ?? 0))}</div>
                <div>Cobrado (de ventas de hoy): {formatoMoneda(Number(resumen.ventas?.cobrado ?? 0))}</div>
                <div>Compras: {formatoMoneda(Number(resumen.compras?.total ?? 0))}</div>
                <div>Gastos: {formatoMoneda(Number(resumen.gastos?.total ?? 0))}</div>
                <div>Cartera: {formatoMoneda(Number(resumen.cartera ?? 0))}</div>
                <div>Cuentas por pagar: {formatoMoneda(Number(resumen.cuentasPorPagar ?? 0))}</div>
              </div>
            )}

            {resumen && resumen.ventas.detalle.length > 0 && (
              <div style={{ display: 'grid', gap: '0.5rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
                <h3>Ventas del día ({resumen.ventas.detalle.length})</h3>
                {resumen.ventas.detalle.map((v) => (
                  <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid #e5e5ea', paddingBottom: 4 }}>
                    <span>#{v.folio} · {v.cliente} · {v.vendedor}</span>
                    <span>
                      {formatoMoneda(v.total)}{' '}
                      <small style={{ color: v.estadoPago === 'pagada' ? '#16a34a' : '#b91c1c' }}>
                        ({v.estadoPago === 'pagada' ? 'pagada' : `saldo ${formatoMoneda(v.saldoPendiente)}`})
                      </small>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {resumen && resumen.compras.detalle.length > 0 && (
              <div style={{ display: 'grid', gap: '0.5rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
                <h3>Compras del día ({resumen.compras.detalle.length})</h3>
                {resumen.compras.detalle.map((c) => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid #e5e5ea', paddingBottom: 4 }}>
                    <span>{c.proveedor} · {c.numeroFactura || 'sin factura'}</span>
                    <span>
                      {formatoMoneda(c.total)}{' '}
                      <small style={{ color: c.estadoPago === 'pagada' ? '#16a34a' : '#b91c1c' }}>
                        ({c.estadoPago === 'pagada' ? 'pagada' : `saldo ${formatoMoneda(c.saldoPendiente)}`})
                      </small>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {resumen && (resumen.canceladas.ventas.length > 0 || resumen.canceladas.compras.length > 0) && (
              <div style={{ display: 'grid', gap: '0.5rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14, background: '#fff2f1' }}>
                <h3 style={{ color: '#b91c1c' }}>❌ Cancelado hoy</h3>
                {resumen.canceladas.ventas.map((v) => (
                  <div key={v.id} style={{ fontSize: 13, borderBottom: '1px solid #fecaca', paddingBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Venta #{v.folio} · {v.cliente}</span>
                      <strong>{formatoMoneda(v.total)}</strong>
                    </div>
                    <small style={{ color: '#6b7280' }}>
                      Original: {new Date(v.fechaOriginal).toLocaleDateString()} · Cancelada por {v.canceladaPor} el {new Date(v.canceladaEn).toLocaleString()}
                    </small>
                  </div>
                ))}
                {resumen.canceladas.compras.map((c) => (
                  <div key={c.id} style={{ fontSize: 13, borderBottom: '1px solid #fecaca', paddingBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Compra {c.numeroFactura || 'sin factura'} · {c.proveedor}</span>
                      <strong>{formatoMoneda(c.total)}</strong>
                    </div>
                    <small style={{ color: '#6b7280' }}>
                      Original: {new Date(c.fechaOriginal).toLocaleDateString()} · Cancelada por {c.canceladaPor} el {new Date(c.canceladaEn).toLocaleString()}
                    </small>
                  </div>
                ))}
              </div>
            )}

            {resumen?.pagosClientes && (
              <div style={{ display: 'grid', gap: '0.5rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
                <h3>Pagos de clientes recibidos hoy</h3>
                <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                  Incluye el pago inicial de ventas de hoy y abonos a notas de días anteriores.
                </p>
                <div>Total: <strong>{formatoMoneda(Number(resumen.pagosClientes.total ?? 0))}</strong></div>
                <div>Efectivo: {formatoMoneda(Number(resumen.pagosClientes.efectivo ?? 0))}</div>
                <div>Transferencia: {formatoMoneda(Number(resumen.pagosClientes.transferencia ?? 0))}</div>

                {resumen.pagosClientes.detalle.length > 0 && (
                  <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
                    <strong style={{ fontSize: 13 }}>Detalle</strong>
                    {resumen.pagosClientes.detalle.map((p) => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid #e5e5ea', paddingBottom: 4 }}>
                        <span>
                          Venta #{p.folio} · {p.cliente} · {p.metodoPago}
                          <br />
                          <small style={{ color: '#6b7280' }}>
                            {new Date(p.fecha).toLocaleTimeString()} · registró: {p.registradoPor}
                          </small>
                        </span>
                        <strong>{formatoMoneda(p.monto)}</strong>
                      </div>
                    ))}
                  </div>
                )}
                {resumen.pagosClientes.detalle.length === 0 && (
                  <p style={{ fontSize: 13, color: '#6b7280' }}>Sin pagos de clientes hoy.</p>
                )}
              </div>
            )}

            {resumen?.pagosProveedores && (
              <div style={{ display: 'grid', gap: '0.5rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
                <h3>Pagos a proveedores hechos hoy</h3>
                <div>Total: <strong>{formatoMoneda(Number(resumen.pagosProveedores.total ?? 0))}</strong></div>
                <div>Efectivo: {formatoMoneda(Number(resumen.pagosProveedores.efectivo ?? 0))}</div>
                <div>Transferencia: {formatoMoneda(Number(resumen.pagosProveedores.transferencia ?? 0))}</div>

                {resumen.pagosProveedores.detalle.length > 0 && (
                  <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
                    <strong style={{ fontSize: 13 }}>Detalle</strong>
                    {resumen.pagosProveedores.detalle.map((p) => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid #e5e5ea', paddingBottom: 4 }}>
                        <span>
                          {p.proveedor} · Factura {p.numeroFactura || 'sin número'} · {p.metodoPago}
                          <br />
                          <small style={{ color: '#6b7280' }}>
                            {new Date(p.fecha).toLocaleTimeString()} · registró: {p.registradoPor}
                          </small>
                        </span>
                        <strong>{formatoMoneda(p.monto)}</strong>
                      </div>
                    ))}
                  </div>
                )}
                {resumen.pagosProveedores.detalle.length === 0 && (
                  <p style={{ fontSize: 13, color: '#6b7280' }}>Sin pagos a proveedores hoy.</p>
                )}
              </div>
            )}

            {tieneUtilidad && (
              <div style={{ display: 'grid', gap: '0.5rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14, background: '#fefce8' }}>
                <h3>Utilidad y balanza (solo visible para administración)</h3>
                <div>Utilidad del día: <strong>{formatoMoneda(resumen!.utilidadDia!)}</strong></div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>
                  Balanza = cartera por cobrar + valor de inventario − cuentas por pagar
                </div>
                <div>Cartera por cobrar: {formatoMoneda(resumen!.cartera)}</div>
                <div>Valor de inventario: {formatoMoneda(resumen!.valorInventario!)}</div>
                <div>Cuentas por pagar: {formatoMoneda(resumen!.cuentasPorPagar)}</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  Balanza total: {formatoMoneda(resumen!.balanzaTotal!)}
                </div>

                {resumen?.balanzaAyer != null && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                      Cuadre: balanza de ayer ({formatoMoneda(resumen.balanzaAyer)}) + utilidad de hoy − gastos de hoy
                      = {formatoMoneda(resumen.balanzaEsperada!)} esperado
                    </div>
                    {Math.abs(resumen.diferenciaCuadre ?? 0) < 0.01 ? (
                      <div style={{ color: '#16a34a', fontWeight: 600 }}>✓ Cuadra</div>
                    ) : (
                      <div className="texto-alerta" style={{ fontWeight: 600 }}>
                        ⚠ No cuadra. Diferencia: {formatoMoneda(resumen.diferenciaCuadre!)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
