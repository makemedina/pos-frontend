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
 * del dia). Orden fijo, de arriba a abajo: saldos contados, ventas,
 * pagos de clientes (cartera anterior), compras, gastos, pagos a
 * proveedores (cartera anterior), depositos a banco, cancelaciones,
 * cuadre de efectivo (publico), y hasta el final utilidad/balanza (solo
 * administracion). Se usa tanto para el corte de HOY (AdminCorteCaja)
 * como para reimprimir un corte de un dia pasado desde el historico
 * (CorteHistoricoModal).
 */
export function ReporteCorte({ resumen, elementId, efectivoContadoEnVivo, saldoBancoContadoEnVivo }: Props) {
  const tieneUtilidad = resumen.utilidadDia !== undefined;

  // Si ya existe un corte guardado para esta fecha (hoy o un dia pasado),
  // se muestran EXACTAMENTE los montos con los que se guardo ese dia --
  // no se recalculan con datos de hoy. Si no (el corte de HOY todavia no
  // se guarda), se usa lo que el usuario vaya escribiendo en el formulario.
  const yaGuardado = resumen.corteExistente;
  const efectivoUsado = yaGuardado ? yaGuardado.efectivoContado : efectivoContadoEnVivo ?? 0;
  const bancoUsado = yaGuardado ? yaGuardado.saldoBancoContado : saldoBancoContadoEnVivo ?? 0;

  // Cuadre de efectivo (distinto de la balanza de abajo, que es todo el
  // negocio). Publico -- no requiere permiso de utilidad.
  //
  // Para el corte de HOY (todavia no guardado): se usa saldoEfectivoSistema
  // directo -- es un total que el backend lleva en vivo, actualizado por
  // cada venta/gasto/pago real conforme pasa, y por eso SIEMPRE esta al
  // corriente sin importar si algun dia anterior se le olvido a alguien
  // guardar su corte. Antes se calculaba encadenando "lo contado ayer +
  // movimientos de hoy", pero esa cadena se rompe apenas se salta un dia:
  // "ayer" termina siendo el corte guardado mas reciente (que puede ser
  // de hace varios dias), y todo lo que paso en los dias saltados de por
  // medio nunca se resta ni se suma -- el corte de hoy queda descuadrado
  // para siempre por ese hueco.
  //
  // Para un corte YA GUARDADO (reimprimir historico): saldoEfectivoSistema
  // es el total de HOY, no el de esa fecha pasada, asi que ahi se sigue
  // usando la cadena "efectivoAyer + movimientos de ese dia" como antes.
  const efectivoAyer = resumen.efectivoAyer ?? null;
  const ventasEfectivo = resumen.ventas.subtotalesPorMetodo.efectivo;
  const pagosClientesEfectivo = resumen.pagosClientes.efectivo;
  const comprasEfectivo = resumen.compras.subtotalesPorMetodo.efectivo;
  const gastosEfectivo = resumen.gastos.subtotalesPorMetodo.efectivo;
  const pagosProveedoresEfectivo = resumen.pagosProveedores.efectivo;
  const depositosEfectivo = Number(resumen.depositosBanco.total ?? 0);
  const efectivoEsperado = !yaGuardado
    ? resumen.saldoEfectivoSistema
    : efectivoAyer !== null
      ? efectivoAyer + ventasEfectivo + pagosClientesEfectivo - comprasEfectivo - gastosEfectivo - pagosProveedoresEfectivo - depositosEfectivo
      : null;
  const diferenciaEfectivo = efectivoEsperado !== null ? efectivoUsado - efectivoEsperado : null;

  // Cuadre de banco: a diferencia de efectivo, aqui nunca hubo una cadena
  // dia-a-dia -- siempre se comparo contra saldoBancoSistema (el total en
  // vivo), asi que no hay nada que "romper" con un dia saltado. Pero
  // tampoco se guarda un "banco esperado" historico en CorteCaja, asi que
  // el cuadre automatico solo aplica al corte de HOY (no guardado todavia);
  // al reimprimir un corte pasado, saldoBancoSistema seria el de HOY, no
  // el de esa fecha, y no serviria para comparar.
  const bancoEsperado = !yaGuardado ? resumen.saldoBancoSistema : null;
  const diferenciaBanco = bancoEsperado !== null ? bancoUsado - bancoEsperado : null;

  return (
    <div id={elementId} style={{ display: 'grid', gap: '1rem', background: 'white' }}>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, flex: 1 }}>
          Efectivo{!yaGuardado && ' (lo que vas escribiendo)'}
          <div style={{ fontWeight: 700, fontSize: 18 }}>{formatoMoneda(efectivoUsado)}</div>
        </div>
        <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14, flex: 1 }}>
          Banco{!yaGuardado && ' (lo que vas escribiendo)'}
          <div style={{ fontWeight: 700, fontSize: 18 }}>{formatoMoneda(bancoUsado)}</div>
        </div>
      </div>

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

      {resumen?.pagosClientes && (
        <div style={{ display: 'grid', gap: '0.5rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
          <h3>Pagos de clientes recibidos hoy (cartera anterior)</h3>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
            Abonos a notas de días anteriores. No incluye el pago inicial de ventas de hoy — ese ya
            se cuenta arriba, en "Ventas del día".
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

      {resumen && resumen.gastos.detalle.length > 0 && (
        <div style={{ display: 'grid', gap: '0.5rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
          <h3>Gastos del día ({resumen.gastos.detalle.length})</h3>
          <div style={{ fontSize: 13 }}>
            <div>Efectivo: {formatoMoneda(resumen.gastos.subtotalesPorMetodo.efectivo)}</div>
            <div>Transferencia: {formatoMoneda(resumen.gastos.subtotalesPorMetodo.transferencia)}</div>
          </div>
          {resumen.gastos.detalle.map((g) => (
            <div key={g.id} style={{ fontSize: 13, borderBottom: '1px solid #e5e5ea', paddingBottom: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  {g.concepto}
                  <br />
                  <small style={{ color: '#6b7280' }}>
                    {g.categoria}{g.proveedor ? ` · ${g.proveedor}` : ''} · {g.metodoPago}
                  </small>
                </span>
                <strong>{formatoMoneda(g.monto)}</strong>
              </div>
              <small style={{ color: '#6b7280' }}>
                {new Date(g.fecha).toLocaleTimeString()} · registró: {g.registradoPor}
              </small>
            </div>
          ))}
        </div>
      )}

      {resumen?.pagosProveedores && (
        <div style={{ display: 'grid', gap: '0.5rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
          <h3>Pagos a proveedores hechos hoy (cartera anterior)</h3>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
            Abonos a facturas de días anteriores. No incluye el pago inicial de compras de hoy — ese
            ya se cuenta arriba, en "Compras del día".
          </p>
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

      {/* Igual que cuentasPorPagar/cartera: es el saldo pendiente a HOY, no
          el que habia el dia de un corte pasado -- solo se muestra para el
          corte de hoy todavia no guardado. */}
      {!yaGuardado && resumen.facturasPendientesPorProveedor.length > 0 && (
        <div style={{ display: 'grid', gap: '0.75rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>Facturas pendientes a proveedores</h3>
            <strong>{formatoMoneda(resumen.cuentasPorPagar)}</strong>
          </div>
          {resumen.facturasPendientesPorProveedor.map((grupo) => (
            <div key={grupo.proveedorId} style={{ display: 'grid', gap: '0.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                <span>{grupo.proveedorNombre}</span>
                <span>{formatoMoneda(grupo.subtotal)}</span>
              </div>
              {grupo.facturas.map((f) => (
                <div
                  key={f.id}
                  style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', paddingLeft: 8 }}
                >
                  <span>
                    {f.numeroFactura || 'Sin factura'} · {new Date(f.fecha).toLocaleDateString()} · {f.diasAntiguedad} día{f.diasAntiguedad !== 1 ? 's' : ''}
                  </span>
                  <span>{formatoMoneda(f.saldoPendiente)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gap: '0.5rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
        <h3>Cuadre de efectivo</h3>
        {!yaGuardado ? (
          <>
            <div style={{ fontWeight: 700 }}>
              Efectivo esperado (lo que lleva el sistema ahora mismo): {formatoMoneda(efectivoEsperado!)}
            </div>
            <div>
              Efectivo que se está reportando (lo que vas escribiendo): <strong>{formatoMoneda(efectivoUsado)}</strong>
            </div>
            {Math.abs(diferenciaEfectivo ?? 0) < 0.01 ? (
              <div style={{ color: '#16a34a', fontWeight: 600 }}>✓ Cuadra</div>
            ) : (
              <div className="texto-alerta" style={{ fontWeight: 600 }}>
                ⚠ No cuadra. Diferencia: {formatoMoneda(diferenciaEfectivo)}
              </div>
            )}
          </>
        ) : efectivoAyer === null ? (
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            No hay un corte anterior contra el cual cuadrar (este sería el primer corte guardado).
          </p>
        ) : (
          <>
            <div>Efectivo del día anterior: {formatoMoneda(efectivoAyer)}</div>
            <div>+ Ventas del día (efectivo): {formatoMoneda(ventasEfectivo)}</div>
            <div>+ Pagos de clientes recibidos (efectivo): {formatoMoneda(pagosClientesEfectivo)}</div>
            <div>− Compras del día (efectivo): {formatoMoneda(comprasEfectivo)}</div>
            <div>− Gastos del día (efectivo): {formatoMoneda(gastosEfectivo)}</div>
            <div>− Pagos a proveedores (efectivo): {formatoMoneda(pagosProveedoresEfectivo)}</div>
            <div>− Depósitos a banco: {formatoMoneda(depositosEfectivo)}</div>
            <div style={{ fontWeight: 700, paddingTop: 4, borderTop: '1px solid #e5e7eb' }}>
              Efectivo esperado: {formatoMoneda(efectivoEsperado!)}
            </div>
            <div>
              Efectivo que se está reportando: <strong>{formatoMoneda(efectivoUsado)}</strong>
            </div>
            {Math.abs(diferenciaEfectivo ?? 0) < 0.01 ? (
              <div style={{ color: '#16a34a', fontWeight: 600 }}>✓ Cuadra</div>
            ) : (
              <div className="texto-alerta" style={{ fontWeight: 600 }}>
                ⚠ No cuadra. Diferencia: {formatoMoneda(diferenciaEfectivo)}
              </div>
            )}
          </>
        )}
      </div>

      {bancoEsperado !== null && (
        <div style={{ display: 'grid', gap: '0.5rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
          <h3>Cuadre de banco</h3>
          <div style={{ fontWeight: 700 }}>
            Banco esperado (lo que lleva el sistema ahora mismo): {formatoMoneda(bancoEsperado)}
          </div>
          <div>
            Banco que se está reportando (lo que vas escribiendo): <strong>{formatoMoneda(bancoUsado)}</strong>
          </div>
          {Math.abs(diferenciaBanco ?? 0) < 0.01 ? (
            <div style={{ color: '#16a34a', fontWeight: 600 }}>✓ Cuadra</div>
          ) : (
            <div className="texto-alerta" style={{ fontWeight: 600 }}>
              ⚠ No cuadra. Diferencia: {formatoMoneda(diferenciaBanco)}
            </div>
          )}
        </div>
      )}

      {tieneUtilidad && (() => {
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

            {yaGuardado?.observacion && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
                <strong style={{ fontSize: 13 }}>Observación</strong>
                <p style={{ fontSize: 13, margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{yaGuardado.observacion}</p>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
