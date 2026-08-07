import { formatoMoneda } from './formato';
import type { ResumenCorteDia } from './api';

interface Props {
  resumen: ResumenCorteDia;
  elementId: string;
  // Solo se usan si el corte de HOY todavia no se guarda (resumen.corteExistente
  // es null) -- mientras el usuario va escribiendo el conteo. Si ya existe un
  // corte guardado (hoy o un dia pasado), se usan los montos ya capturados.
  efectivoContadoEnVivo?: number;
  saldoBancoContadoEnVivo?: number;
}

/**
 * Cuerpo del reporte de un corte de caja (todo menos la captura/formulario
 * del dia): resumen, ventas/compras/gastos del dia, cancelaciones, pagos
 * de clientes/proveedores, depositos a banco, y utilidad/balanza. Se usa
 * tanto para el corte de HOY (AdminCorteCaja) como para reimprimir un
 * corte de un dia pasado desde el historico (CorteHistoricoModal).
 */
export function ReporteCorte({ resumen, elementId, efectivoContadoEnVivo, saldoBancoContadoEnVivo }: Props) {
  const tieneUtilidad = resumen.utilidadDia !== undefined;

  return (
    <div id={elementId} style={{ display: 'grid', gap: '1rem', background: 'white' }}>
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
          <div style={{ fontSize: 13 }}>
            <div>Efectivo: {formatoMoneda(resumen.ventas.subtotalesPorMetodo.efectivo)}</div>
            <div>Transferencia: {formatoMoneda(resumen.ventas.subtotalesPorMetodo.transferencia)}</div>
            <div>Crédito (sin abono hoy): {formatoMoneda(resumen.ventas.subtotalesPorMetodo.credito)}</div>
          </div>
          {resumen.ventas.detalle.map((v) => {
            const pagoMixto = v.montoEfectivo > 0 && v.montoTransferencia > 0;
            return (
              <div key={v.id} style={{ fontSize: 13, borderBottom: '1px solid #e5e5ea', paddingBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>#{v.folio} · {v.cliente} · {v.vendedor} · {v.metodoPago ?? 'crédito'}</span>
                  <span>
                    {formatoMoneda(v.total)}{' '}
                    <small style={{ color: v.estadoPago === 'pagada' ? '#16a34a' : '#b91c1c' }}>
                      ({v.estadoPago === 'pagada' ? 'pagada' : `saldo ${formatoMoneda(v.saldoPendiente)}`})
                    </small>
                  </span>
                </div>
                {pagoMixto && (
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Efectivo: {formatoMoneda(v.montoEfectivo)} · Transferencia: {formatoMoneda(v.montoTransferencia)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {resumen && resumen.compras.detalle.length > 0 && (
        <div style={{ display: 'grid', gap: '0.5rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
          <h3>Compras del día ({resumen.compras.detalle.length})</h3>
          <div style={{ fontSize: 13 }}>
            <div>Efectivo: {formatoMoneda(resumen.compras.subtotalesPorMetodo.efectivo)}</div>
            <div>Transferencia: {formatoMoneda(resumen.compras.subtotalesPorMetodo.transferencia)}</div>
            <div>Crédito (sin abono hoy): {formatoMoneda(resumen.compras.subtotalesPorMetodo.credito)}</div>
          </div>
          {resumen.compras.detalle.map((c) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid #e5e5ea', paddingBottom: 4 }}>
              <span>{c.proveedor} · {c.numeroFactura || 'sin factura'} · {c.metodoPago ?? 'crédito'}</span>
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

      {resumen?.depositosBanco && (
        <div style={{ display: 'grid', gap: '0.5rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
          <h3>Depósitos a banco hoy</h3>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
            Traspaso interno (efectivo → banco): ya está reflejado en los saldos del sistema, no es un gasto ni afecta la utilidad.
          </p>
          <div>Total: <strong>{formatoMoneda(Number(resumen.depositosBanco.total ?? 0))}</strong></div>

          {resumen.depositosBanco.detalle.length > 0 && (
            <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
              <strong style={{ fontSize: 13 }}>Detalle</strong>
              {resumen.depositosBanco.detalle.map((d) => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid #e5e5ea', paddingBottom: 4 }}>
                  <span>
                    {d.notas || 'Depósito a banco'}
                    <br />
                    <small style={{ color: '#6b7280' }}>
                      {new Date(d.fecha).toLocaleTimeString()} · registró: {d.registradoPor}
                    </small>
                  </span>
                  <strong>{formatoMoneda(d.monto)}</strong>
                </div>
              ))}
            </div>
          )}
          {resumen.depositosBanco.detalle.length === 0 && (
            <p style={{ fontSize: 13, color: '#6b7280' }}>Sin depósitos a banco hoy.</p>
          )}
        </div>
      )}

      {tieneUtilidad && (() => {
        // Si ya existe un corte guardado para esta fecha (hoy o un dia
        // pasado), se muestran EXACTAMENTE los numeros con los que se
        // guardo ese dia (valor de inventario, balanza) -- no se
        // recalculan con la cartera/inventario de HOY, que ya cambiaron
        // desde entonces. Si no (el corte de HOY todavia no se guarda),
        // se calcula en vivo con lo que el usuario vaya escribiendo.
        const yaGuardado = resumen.corteExistente;
        const efectivoUsado = yaGuardado ? yaGuardado.efectivoContado : efectivoContadoEnVivo ?? 0;
        const bancoUsado = yaGuardado ? yaGuardado.saldoBancoContado : saldoBancoContadoEnVivo ?? 0;
        const valorInventarioMostrado = yaGuardado ? yaGuardado.valorInventario : resumen.valorInventario!;
        const balanzaMostrada = yaGuardado
          ? yaGuardado.balanzaTotal
          : efectivoUsado + bancoUsado + resumen.cartera + resumen.valorInventario! - resumen.cuentasPorPagar;
        const diferencia = resumen.balanzaEsperada != null ? balanzaMostrada - resumen.balanzaEsperada : null;

        return (
          <div style={{ display: 'grid', gap: '0.5rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14, background: '#fefce8' }}>
            <h3>Utilidad y balanza (solo visible para administración)</h3>
            <div>Utilidad del día: <strong>{formatoMoneda(yaGuardado ? yaGuardado.utilidadDia : resumen.utilidadDia!)}</strong></div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              Balanza = efectivo + banco + cartera por cobrar + valor de inventario − cuentas por pagar
            </div>
            <div>Efectivo{!yaGuardado && ' (lo que vas escribiendo)'}: {formatoMoneda(efectivoUsado)}</div>
            <div>Banco{!yaGuardado && ' (lo que vas escribiendo)'}: {formatoMoneda(bancoUsado)}</div>
            {!yaGuardado && <div>Cartera por cobrar: {formatoMoneda(resumen.cartera)}</div>}
            <div>Valor de inventario: {formatoMoneda(valorInventarioMostrado)}</div>
            {!yaGuardado && <div>Cuentas por pagar: {formatoMoneda(resumen.cuentasPorPagar)}</div>}
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              Balanza total: {formatoMoneda(balanzaMostrada)}
            </div>
            {yaGuardado && (
              <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                Cartera y cuentas por pagar de ese día ya no se muestran por separado (cambian con el
                tiempo) — la balanza de arriba es la que quedó guardada ese día.
              </p>
            )}

            {resumen.balanzaAyer != null && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 13, color: '#6b7280' }}>
                  Cuadre: balanza de ayer ({formatoMoneda(resumen.balanzaAyer)}) + utilidad de hoy − gastos de hoy
                  = {formatoMoneda(resumen.balanzaEsperada!)} esperado
                </div>
                {Math.abs(diferencia ?? 0) < 0.01 ? (
                  <div style={{ color: '#16a34a', fontWeight: 600 }}>✓ Cuadra</div>
                ) : (
                  <div className="texto-alerta" style={{ fontWeight: 600 }}>
                    ⚠ No cuadra. Diferencia: {formatoMoneda(diferencia)}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
