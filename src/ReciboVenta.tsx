import type { Configuracion } from './api';
import { formatoMoneda } from './formato';
import type { DatosRecibo } from './construirRecibo';

interface Props {
  config: Configuracion;
  datos: DatosRecibo;
  elementId: string;
}

export function ReciboVenta({ config, datos, elementId }: Props) {
  return (
    <div
      id={elementId}
      style={{
        width: 320,
        background: 'white',
        padding: 18,
        fontFamily: 'ui-monospace, Menlo, monospace',
        color: '#111',
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      {/* 1. Logo */}
      {config.logoBase64 && (
        <img
          src={config.logoBase64}
          alt="Logo"
          style={{ maxWidth: '100%', maxHeight: 90, display: 'block', margin: '0 auto 10px' }}
        />
      )}

      {/* 2. Encabezado con datos del negocio */}
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 16 }}>
        {config.nombreNegocio || 'Mi negocio'}
      </div>
      {config.telefono && <div style={{ textAlign: 'center' }}>{config.telefono}</div>}
      {config.direccion && <div style={{ textAlign: 'center' }}>{config.direccion}</div>}
      {config.encabezadoRecibo && (
        <div style={{ textAlign: 'center', marginTop: 6 }}>{config.encabezadoRecibo}</div>
      )}

      <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px dashed #999' }} />

      <div>Venta #{datos.folio}</div>
      <div>{datos.fecha}</div>
      <div>Atendió: {datos.vendedor}</div>

      {/* 3. Datos del cliente */}
      {config.mostrarDatosCliente && datos.cliente && (
        <>
          <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px dashed #999' }} />
          <div>Cliente: {datos.cliente.nombre}</div>
          {datos.cliente.telefono && <div>Tel: {datos.cliente.telefono}</div>}
        </>
      )}

      {/* 4. Cuerpo del recibo */}
      <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px dashed #999' }} />
      {datos.items.map((it, idx) => (
        <div key={idx} style={{ marginBottom: 6 }}>
          <div>{it.producto} {it.marca}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{it.cantidad}kg x {formatoMoneda(it.precioUnitario)}</span>
            <span>{formatoMoneda((it.cantidad * it.precioUnitario))}</span>
          </div>
        </div>
      ))}
      <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px dashed #999' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16 }}>
        <span>TOTAL</span>
        <span>{formatoMoneda(datos.total)}</span>
      </div>
      {datos.metodoPago && <div style={{ marginTop: 4 }}>Método de pago: {datos.metodoPago}</div>}
      {datos.esCredito && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontWeight: 700 }}>VENTA A CRÉDITO</div>
          <div>Saldo pendiente (esta nota): {formatoMoneda(datos.saldoPendiente)}</div>
        </div>
      )}
      {datos.saldoTotalCliente !== undefined && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: '1px dashed #999' }}>
          <span>Saldo total del cliente</span>
          <span>{formatoMoneda(datos.saldoTotalCliente)}</span>
        </div>
      )}

      {/* 5. Pie de recibo */}
      {config.piePaginaRecibo && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>{config.piePaginaRecibo}</div>
      )}
      <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: '#6b7280' }}>
        Gracias por su compra
      </div>
    </div>
  );
}
