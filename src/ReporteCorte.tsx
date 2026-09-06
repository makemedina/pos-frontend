import { useState } from 'react';
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

// Convierte una diferencia de cuadre en un texto llano ("falta"/"sobra")
// en vez de un numero con signo -- mas facil de leer de un vistazo que
// "-$120.00". Se usa tanto en el veredicto de arriba como en cada
// seccion de cuadre mas abajo.
function describirDiferencia(diferencia: number | null): { texto: string; color: string } {
  if (diferencia === null) return { texto: '—', color: '#6b7280' };
  if (Math.abs(diferencia) < 0.01) return { texto: '✓ Cuadra exacto', color: '#16a34a' };
  if (diferencia < 0) return { texto: `⚠ Falta ${formatoMoneda(Math.abs(diferencia))}`, color: '#b91c1c' };
  return { texto: `⚠ Sobra ${formatoMoneda(diferencia)}`, color: '#b45309' };
}

// Orden fijo al desglosar nota por nota dentro de un cliente/proveedor:
// primero efectivo, luego transferencia, y al final lo que no tiene
// metodo de pago (a credito, sin abono). Mismo criterio que ya usa el
// backend para ordenar las listas completas.
const ORDEN_METODO_PAGO: Record<string, number> = { efectivo: 0, transferencia: 1 };

function ordenarPorMetodo<T>(items: T[], getMetodo: (item: T) => string | null): T[] {
  return [...items].sort((a, b) => {
    const metodoA = getMetodo(a);
    const metodoB = getMetodo(b);
    const ordenA = metodoA ? ORDEN_METODO_PAGO[metodoA] ?? 2 : 3;
    const ordenB = metodoB ? ORDEN_METODO_PAGO[metodoB] ?? 2 : 3;
    return ordenA - ordenB;
  });
}

interface GrupoNombre<T> {
  clave: string;
  subtotal: number;
  items: T[];
}

interface GrupoDia<T> {
  fecha: Date;
  grupos: GrupoNombre<T>[];
}

// Agrupa un detalle plano (ventas, compras, pagos...) primero por día,
// despues por cliente/proveedor (con su subtotal), y adentro de cada uno
// ordena nota por nota segun la forma de pago -- el orden que se pidio
// para hacer el recibo del corte mas facil de revisar.
function agruparPorDiaYNombre<T>(
  items: T[],
  getFecha: (item: T) => string,
  getNombre: (item: T) => string,
  getMetodo: (item: T) => string | null,
  getMonto: (item: T) => number
): GrupoDia<T>[] {
  const porDia = new Map<string, { fecha: Date; items: T[] }>();
  for (const item of items) {
    const f = new Date(getFecha(item));
    const clave = f.toDateString();
    let dia = porDia.get(clave);
    if (!dia) {
      dia = { fecha: f, items: [] };
      porDia.set(clave, dia);
    }
    dia.items.push(item);
  }

  return Array.from(porDia.values())
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
    .map((dia) => {
      const porNombre = new Map<string, T[]>();
      for (const item of dia.items) {
        const nombre = getNombre(item);
        const arr = porNombre.get(nombre) ?? [];
        arr.push(item);
        porNombre.set(nombre, arr);
      }
      const grupos = Array.from(porNombre.entries())
        .map(([clave, itemsNombre]) => ({
          clave,
          subtotal: itemsNombre.reduce((acc, it) => acc + getMonto(it), 0),
          items: ordenarPorMetodo(itemsNombre, getMetodo),
        }))
        .sort((a, b) => a.clave.localeCompare(b.clave));
      return { fecha: dia.fecha, grupos };
    });
}

// Dibuja el desglose ya agrupado: encabezado de día, adentro un renglon
// por cliente/proveedor con su subtotal, y adentro de cada uno una linea
// por nota/pago (renderItem), ya ordenada por forma de pago.
function renderDetalleAgrupado<T>(grupos: GrupoDia<T>[], renderItem: (item: T) => React.ReactNode) {
  return grupos.map((dia) => (
    <div key={dia.fecha.toDateString()} style={{ display: 'grid', gap: 6 }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', textTransform: 'capitalize' }}>
        {dia.fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
      </div>
      {dia.grupos.map((g) => (
        <div key={g.clave} style={{ display: 'grid', gap: 4, paddingLeft: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 13 }}>
            <span>{g.clave}</span>
            <span>{formatoMoneda(g.subtotal)}</span>
          </div>
          <div style={{ display: 'grid', gap: 2, paddingLeft: 8 }}>{g.items.map(renderItem)}</div>
        </div>
      ))}
    </div>
  ));
}

/**
 * Cuerpo del reporte de un corte de caja (todo menos la captura/formulario
 * del dia). Arriba de todo va el veredicto (¿cuadra o no?), para verlo sin
 * tener que desplazarse por todo el detalle; despues los saldos contados,
 * ventas, pagos de clientes (cartera anterior), compras, gastos, pagos a
 * proveedores (cartera anterior), depositos a banco, cancelaciones, y
 * hasta el final el desglose completo del cuadre y la utilidad/balanza
 * (solo administracion). El detalle linea por linea de cada seccion viene
 * colapsado por default -- solo se ven los totales, a menos que se pida
 * verlo. Se usa tanto para el corte de HOY (AdminCorteCaja) como para
 * reimprimir un corte de un dia pasado desde el historico
 * (CorteHistoricoModal).
 */
export function ReporteCorte({ resumen, elementId, efectivoContadoEnVivo, saldoBancoContadoEnVivo }: Props) {
  const [detalleAbierto, setDetalleAbierto] = useState<Record<string, boolean>>({});
  const toggleDetalle = (clave: string) =>
    setDetalleAbierto((prev) => ({ ...prev, [clave]: !prev[clave] }));

  const tieneUtilidad = resumen.utilidadDia !== undefined;
  // Si el ultimo corte no fue justo ayer, este corte abarca varios dias
  // (desde el siguiente al ultimo corte hasta hoy) -- se muestra la fecha
  // completa de cada renglon (no solo la hora) para distinguir de que dia
  // es cada quien, y los titulos dicen "del periodo" en vez de "del día".
  const abarcaVariosDias = resumen.abarcaVariosDias;
  const tituloPeriodo = (singular: string, plural: string) => (abarcaVariosDias ? plural : singular);
  const formatoFechaHora = (fecha: string | Date) =>
    abarcaVariosDias ? new Date(fecha).toLocaleString() : new Date(fecha).toLocaleTimeString();

  // Si ya existe un corte guardado para esta fecha (hoy o un dia pasado),
  // se muestran EXACTAMENTE los montos con los que se guardo ese dia --
  // no se recalculan con datos de hoy. Si no (el corte de HOY todavia no
  // se guarda), se usa lo que el usuario vaya escribiendo en el formulario.
  const yaGuardado = resumen.corteExistente;
  const efectivoUsado = yaGuardado ? yaGuardado.efectivoContado : efectivoContadoEnVivo ?? 0;
  const bancoUsado = yaGuardado ? yaGuardado.saldoBancoContado : saldoBancoContadoEnVivo ?? 0;

  // Para el corte de HOY, el saldo pendiente a proveedores en vivo; para
  // uno ya guardado, la fotografia que se guardo ese dia (no las
  // facturas pendientes de HOY).
  const facturasPendientesMostrar = yaGuardado
    ? yaGuardado.facturasPendientesPorProveedor
    : resumen.facturasPendientesPorProveedor;
  const totalFacturasPendientesMostrar = facturasPendientesMostrar.reduce((acc, g) => acc + g.subtotal, 0);

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

  // Balanza (todo el negocio: efectivo + banco + cartera + inventario −
  // cuentas por pagar) -- se calcula aqui arriba (en vez de solo hasta
  // abajo) para poder mostrarla tambien en el veredicto inicial.
  const balanzaMostrada = tieneUtilidad
    ? yaGuardado
      ? yaGuardado.balanzaTotal!
      : efectivoUsado + bancoUsado + resumen.cartera + resumen.valorInventario! - resumen.cuentasPorPagar
    : null;
  const diferenciaBalanza =
    tieneUtilidad && resumen.balanzaEsperada != null && balanzaMostrada !== null
      ? balanzaMostrada - resumen.balanzaEsperada
      : null;

  const veredictoEfectivo = describirDiferencia(diferenciaEfectivo);
  const veredictoBanco = bancoEsperado !== null ? describirDiferencia(diferenciaBanco) : null;
  const veredictoBalanza = tieneUtilidad && resumen.balanzaAyer != null ? describirDiferencia(diferenciaBalanza) : null;

  return (
    <div id={elementId} style={{ display: 'grid', gap: '1rem', background: 'white' }}>
      {abarcaVariosDias && (
        <div className="aviso-alerta" style={{ fontWeight: 600 }}>
          ⚠ No se capturó el corte de uno o más días — este corte abarca desde el{' '}
          {new Date(resumen.desde).toLocaleDateString()} hasta hoy. Cada renglón de abajo indica de qué
          día es.
        </div>
      )}

      {/* Veredicto arriba de todo: para saber si cuadra sin tener que
          desplazarse por todo el detalle de abajo. */}
      <div style={{ display: 'grid', gap: 6, border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14, background: '#f8fafc' }}>
        <h3 style={{ margin: 0 }}>¿Cuadra el corte?</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Efectivo</span>
          <strong style={{ color: veredictoEfectivo.color }}>{veredictoEfectivo.texto}</strong>
        </div>
        {veredictoBanco && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Banco</span>
            <strong style={{ color: veredictoBanco.color }}>{veredictoBanco.texto}</strong>
          </div>
        )}
        {veredictoBalanza && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Negocio en general (balanza)</span>
            <strong style={{ color: veredictoBalanza.color }}>{veredictoBalanza.texto}</strong>
          </div>
        )}
        <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
          El detalle completo de cada cuadre está más abajo, junto con todo lo que se vendió, compró y
          gastó.
        </p>
      </div>

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
          <h3>{tituloPeriodo('Ventas del día', 'Ventas del período')} ({resumen.ventas.detalle.length})</h3>
          <div style={{ fontSize: 13 }}>
            <div>Efectivo: {formatoMoneda(resumen.ventas.subtotalesPorMetodo.efectivo)}</div>
            <div>Transferencia: {formatoMoneda(resumen.ventas.subtotalesPorMetodo.transferencia)}</div>
            <div>Crédito ({tituloPeriodo('sin abono hoy', 'sin abono en el período')}): {formatoMoneda(resumen.ventas.subtotalesPorMetodo.credito)}</div>
          </div>
          <button type="button" className="boton-secundario" onClick={() => toggleDetalle('ventas')} style={{ width: 'auto', justifySelf: 'start' }}>
            {detalleAbierto.ventas ? 'Ocultar detalle' : `Ver detalle (${resumen.ventas.detalle.length})`}
          </button>
          {detalleAbierto.ventas &&
            renderDetalleAgrupado(
              agruparPorDiaYNombre(
                resumen.ventas.detalle,
                (v) => v.fecha,
                (v) => v.cliente,
                (v) => v.metodoPago,
                (v) => v.total
              ),
              (v) => {
                const pagoMixto = v.montoEfectivo > 0 && v.montoTransferencia > 0;
                return (
                  <div key={v.id} style={{ fontSize: 13, borderBottom: '1px solid #e5e5ea', paddingBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>#{v.folio} · {v.vendedor} · {v.metodoPago ?? 'crédito'}</span>
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
              }
            )}
        </div>
      )}

      {resumen?.pagosClientes && (
        <div style={{ display: 'grid', gap: '0.5rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
          <h3>{tituloPeriodo('Pagos de clientes recibidos hoy', 'Pagos de clientes recibidos en el período')} (cartera anterior)</h3>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
            Abonos a notas de antes de {tituloPeriodo('hoy', 'este período')}. No incluye el pago inicial de{' '}
            {tituloPeriodo('ventas de hoy', 'ventas del período')} — ese ya se cuenta arriba, en "
            {tituloPeriodo('Ventas del día', 'Ventas del período')}".
          </p>
          <div>Total: <strong>{formatoMoneda(Number(resumen.pagosClientes.total ?? 0))}</strong></div>
          <div>Efectivo: {formatoMoneda(Number(resumen.pagosClientes.efectivo ?? 0))}</div>
          <div>Transferencia: {formatoMoneda(Number(resumen.pagosClientes.transferencia ?? 0))}</div>

          {resumen.pagosClientes.detalle.length > 0 && (
            <>
              <button type="button" className="boton-secundario" onClick={() => toggleDetalle('pagosClientes')} style={{ width: 'auto', justifySelf: 'start' }}>
                {detalleAbierto.pagosClientes ? 'Ocultar detalle' : `Ver detalle (${resumen.pagosClientes.detalle.length})`}
              </button>
              {detalleAbierto.pagosClientes && (
                <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                  {renderDetalleAgrupado(
                    agruparPorDiaYNombre(
                      resumen.pagosClientes.detalle,
                      (p) => p.fecha,
                      (p) => p.cliente,
                      (p) => p.metodoPago,
                      (p) => p.monto
                    ),
                    (p) => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid #e5e5ea', paddingBottom: 4 }}>
                        <span>
                          Venta #{p.folio} · {p.metodoPago}
                          <br />
                          <small style={{ color: '#6b7280' }}>
                            {formatoFechaHora(p.fecha)} · registró: {p.registradoPor}
                          </small>
                        </span>
                        <strong>{formatoMoneda(p.monto)}</strong>
                      </div>
                    )
                  )}
                </div>
              )}
            </>
          )}
          {resumen.pagosClientes.detalle.length === 0 && (
            <p style={{ fontSize: 13, color: '#6b7280' }}>Sin pagos de clientes {tituloPeriodo('hoy', 'en el período')}.</p>
          )}
        </div>
      )}

      {resumen && resumen.compras.detalle.length > 0 && (
        <div style={{ display: 'grid', gap: '0.5rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
          <h3>{tituloPeriodo('Compras del día', 'Compras del período')} ({resumen.compras.detalle.length})</h3>
          <div style={{ fontSize: 13 }}>
            <div>Efectivo: {formatoMoneda(resumen.compras.subtotalesPorMetodo.efectivo)}</div>
            <div>Transferencia: {formatoMoneda(resumen.compras.subtotalesPorMetodo.transferencia)}</div>
            <div>Crédito ({tituloPeriodo('sin abono hoy', 'sin abono en el período')}): {formatoMoneda(resumen.compras.subtotalesPorMetodo.credito)}</div>
          </div>
          <button type="button" className="boton-secundario" onClick={() => toggleDetalle('compras')} style={{ width: 'auto', justifySelf: 'start' }}>
            {detalleAbierto.compras ? 'Ocultar detalle' : `Ver detalle (${resumen.compras.detalle.length})`}
          </button>
          {detalleAbierto.compras &&
            renderDetalleAgrupado(
              agruparPorDiaYNombre(
                resumen.compras.detalle,
                (c) => c.fecha,
                (c) => c.proveedor,
                (c) => c.metodoPago,
                (c) => c.total
              ),
              (c) => (
                <div key={c.id} style={{ fontSize: 13, borderBottom: '1px solid #e5e5ea', paddingBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{c.numeroFactura || 'sin factura'} · {c.metodoPago ?? 'crédito'}</span>
                    <span>
                      {formatoMoneda(c.total)}{' '}
                      <small style={{ color: c.estadoPago === 'pagada' ? '#16a34a' : '#b91c1c' }}>
                        ({c.estadoPago === 'pagada' ? 'pagada' : `saldo ${formatoMoneda(c.saldoPendiente)}`})
                      </small>
                    </span>
                  </div>
                </div>
              )
            )}
        </div>
      )}

      {resumen && resumen.gastos.detalle.length > 0 && (
        <div style={{ display: 'grid', gap: '0.5rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
          <h3>{tituloPeriodo('Gastos del día', 'Gastos del período')} ({resumen.gastos.detalle.length})</h3>
          <div style={{ fontSize: 13 }}>
            <div>Efectivo: {formatoMoneda(resumen.gastos.subtotalesPorMetodo.efectivo)}</div>
            <div>Transferencia: {formatoMoneda(resumen.gastos.subtotalesPorMetodo.transferencia)}</div>
          </div>
          <button type="button" className="boton-secundario" onClick={() => toggleDetalle('gastos')} style={{ width: 'auto', justifySelf: 'start' }}>
            {detalleAbierto.gastos ? 'Ocultar detalle' : `Ver detalle (${resumen.gastos.detalle.length})`}
          </button>
          {detalleAbierto.gastos &&
            resumen.gastos.detalle.map((g) => (
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
                  {formatoFechaHora(g.fecha)} · registró: {g.registradoPor}
                </small>
              </div>
            ))}
        </div>
      )}

      {resumen?.pagosProveedores && (
        <div style={{ display: 'grid', gap: '0.5rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
          <h3>{tituloPeriodo('Pagos a proveedores hechos hoy', 'Pagos a proveedores hechos en el período')} (cartera anterior)</h3>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
            Abonos a facturas de antes de {tituloPeriodo('hoy', 'este período')}. No incluye el pago inicial de{' '}
            {tituloPeriodo('compras de hoy', 'compras del período')} — ese ya se cuenta arriba, en "
            {tituloPeriodo('Compras del día', 'Compras del período')}".
          </p>
          <div>Total: <strong>{formatoMoneda(Number(resumen.pagosProveedores.total ?? 0))}</strong></div>
          <div>Efectivo: {formatoMoneda(Number(resumen.pagosProveedores.efectivo ?? 0))}</div>
          <div>Transferencia: {formatoMoneda(Number(resumen.pagosProveedores.transferencia ?? 0))}</div>

          {resumen.pagosProveedores.detalle.length > 0 && (
            <>
              <button type="button" className="boton-secundario" onClick={() => toggleDetalle('pagosProveedores')} style={{ width: 'auto', justifySelf: 'start' }}>
                {detalleAbierto.pagosProveedores ? 'Ocultar detalle' : `Ver detalle (${resumen.pagosProveedores.detalle.length})`}
              </button>
              {detalleAbierto.pagosProveedores && (
                <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                  {renderDetalleAgrupado(
                    agruparPorDiaYNombre(
                      resumen.pagosProveedores.detalle,
                      (p) => p.fecha,
                      (p) => p.proveedor,
                      (p) => p.metodoPago,
                      (p) => p.monto
                    ),
                    (p) => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid #e5e5ea', paddingBottom: 4 }}>
                        <span>
                          Factura {p.numeroFactura || 'sin número'} · {p.metodoPago}
                          <br />
                          <small style={{ color: '#6b7280' }}>
                            {formatoFechaHora(p.fecha)} · registró: {p.registradoPor}
                          </small>
                        </span>
                        <strong>{formatoMoneda(p.monto)}</strong>
                      </div>
                    )
                  )}
                </div>
              )}
            </>
          )}
          {resumen.pagosProveedores.detalle.length === 0 && (
            <p style={{ fontSize: 13, color: '#6b7280' }}>Sin pagos a proveedores {tituloPeriodo('hoy', 'en el período')}.</p>
          )}
        </div>
      )}

      {resumen?.depositosBanco && (
        <div style={{ display: 'grid', gap: '0.5rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
          <h3>{tituloPeriodo('Depósitos a banco hoy', 'Depósitos a banco en el período')}</h3>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
            Traspaso interno (efectivo → banco): ya está reflejado en los saldos del sistema, no es un gasto ni afecta la utilidad.
          </p>
          <div>Total: <strong>{formatoMoneda(Number(resumen.depositosBanco.total ?? 0))}</strong></div>

          {resumen.depositosBanco.detalle.length > 0 && (
            <>
              <button type="button" className="boton-secundario" onClick={() => toggleDetalle('depositos')} style={{ width: 'auto', justifySelf: 'start' }}>
                {detalleAbierto.depositos ? 'Ocultar detalle' : `Ver detalle (${resumen.depositosBanco.detalle.length})`}
              </button>
              {detalleAbierto.depositos && (
                <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
                  {resumen.depositosBanco.detalle.map((d) => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid #e5e5ea', paddingBottom: 4 }}>
                      <span>
                        {d.notas || 'Depósito a banco'}
                        <br />
                        <small style={{ color: '#6b7280' }}>
                          {formatoFechaHora(d.fecha)} · registró: {d.registradoPor}
                        </small>
                      </span>
                      <strong>{formatoMoneda(d.monto)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {resumen.depositosBanco.detalle.length === 0 && (
            <p style={{ fontSize: 13, color: '#6b7280' }}>Sin depósitos a banco {tituloPeriodo('hoy', 'en el período')}.</p>
          )}
        </div>
      )}

      {resumen && (resumen.canceladas.ventas.length > 0 || resumen.canceladas.compras.length > 0) && (
        <div style={{ display: 'grid', gap: '0.5rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14, background: '#fff2f1' }}>
          <h3 style={{ color: '#b91c1c' }}>❌ {tituloPeriodo('Cancelado hoy', 'Cancelado en el período')}</h3>
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

      {/* Para el corte de HOY (todavia no guardado) es el saldo pendiente
          en vivo; para un corte ya guardado es la fotografia de las
          facturas pendientes que se guardo justo ESE dia -- no se
          recalcula con las facturas de hoy. */}
      {facturasPendientesMostrar.length > 0 && (
        <div style={{ display: 'grid', gap: '0.75rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>Facturas pendientes a proveedores</h3>
            <strong>{formatoMoneda(totalFacturasPendientesMostrar)}</strong>
          </div>
          {facturasPendientesMostrar.map((grupo) => (
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
        <h3>Detalle del cuadre de efectivo</h3>
        {!yaGuardado ? (
          <>
            <div style={{ fontWeight: 700 }}>
              Efectivo que debería haber (según el sistema): {formatoMoneda(efectivoEsperado!)}
            </div>
            <div>
              Efectivo que se está reportando (lo que vas escribiendo): <strong>{formatoMoneda(efectivoUsado)}</strong>
            </div>
            <div style={{ fontWeight: 600, color: veredictoEfectivo.color }}>{veredictoEfectivo.texto}</div>
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
              Efectivo que debería haber: {formatoMoneda(efectivoEsperado!)}
            </div>
            <div>
              Efectivo que se está reportando: <strong>{formatoMoneda(efectivoUsado)}</strong>
            </div>
            <div style={{ fontWeight: 600, color: veredictoEfectivo.color }}>{veredictoEfectivo.texto}</div>
          </>
        )}
      </div>

      {bancoEsperado !== null && (
        <div style={{ display: 'grid', gap: '0.5rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
          <h3>Detalle del cuadre de banco</h3>
          <div style={{ fontWeight: 700 }}>
            Banco que debería haber (según el sistema): {formatoMoneda(bancoEsperado)}
          </div>
          <div>
            Banco que se está reportando (lo que vas escribiendo): <strong>{formatoMoneda(bancoUsado)}</strong>
          </div>
          <div style={{ fontWeight: 600, color: veredictoBanco!.color }}>{veredictoBanco!.texto}</div>
        </div>
      )}

      {tieneUtilidad && (
        <div style={{ display: 'grid', gap: '0.5rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14, background: '#fefce8' }}>
          <h3>Qué tan bien le fue al negocio (solo administración)</h3>
          <div>{tituloPeriodo('Utilidad del día', 'Utilidad del período')}: <strong>{formatoMoneda(yaGuardado ? yaGuardado.utilidadDia : resumen.utilidadDia!)}</strong></div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            Balanza (todo lo que vale el negocio) = efectivo + banco + lo que te deben (cartera) + valor de
            inventario − lo que debes a proveedores
          </div>
          <div>Efectivo{!yaGuardado && ' (lo que vas escribiendo)'}: {formatoMoneda(efectivoUsado)}</div>
          <div>Banco{!yaGuardado && ' (lo que vas escribiendo)'}: {formatoMoneda(bancoUsado)}</div>
          {!yaGuardado && <div>Cartera por cobrar: {formatoMoneda(resumen.cartera)}</div>}
          <div>Valor de inventario: {formatoMoneda(yaGuardado ? yaGuardado.valorInventario! : resumen.valorInventario!)}</div>
          {!yaGuardado && <div>Cuentas por pagar: {formatoMoneda(resumen.cuentasPorPagar)}</div>}
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            Valor total del negocio (balanza): {formatoMoneda(balanzaMostrada!)}
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
                Cuadre: balanza de {tituloPeriodo('ayer', 'antes del período')} ({formatoMoneda(resumen.balanzaAyer)}) +{' '}
                {tituloPeriodo('utilidad de hoy − gastos de hoy', 'utilidad del período − gastos del período')}{' '}
                = {formatoMoneda(resumen.balanzaEsperada!)} esperado
              </div>
              <div style={{ fontWeight: 600, color: veredictoBalanza!.color }}>{veredictoBalanza!.texto}</div>
            </div>
          )}

          {yaGuardado?.observacion && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
              <strong style={{ fontSize: 13 }}>Observación</strong>
              <p style={{ fontSize: 13, margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{yaGuardado.observacion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
