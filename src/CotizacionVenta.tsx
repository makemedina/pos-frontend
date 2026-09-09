import type { Configuracion } from './api';
import { formatoMoneda } from './formato';
import type { DatosCotizacion } from './construirCotizacion';

interface Props {
  config: Configuracion;
  datos: DatosCotizacion;
  elementId: string;
}

// El aviso de "esto no es un recibo de venta" tiene que ser imposible de
// pasar por alto -- por eso va grande, en rojo, con borde, y se repite
// arriba, en medio y abajo del todo (pedido explicito: alguien podria
// confundir una cotizacion con una venta ya cobrada si solo se avisa una
// vez y de pasada).
function AvisoCotizacion() {
  return (
    <div
      style={{
        textAlign: 'center',
        fontWeight: 800,
        fontSize: 15,
        lineHeight: 1.3,
        color: '#b91c1c',
        border: '2px solid #b91c1c',
        borderRadius: 6,
        padding: '6px 4px',
        margin: '10px 0',
        textTransform: 'uppercase',
      }}
    >
      Esto es una cotización.
      <br />
      No es un recibo de venta.
    </div>
  );
}

export function CotizacionVenta({ config, datos, elementId }: Props) {
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
      <AvisoCotizacion />

      {config.logoBase64 && (
        <img
          src={config.logoBase64}
          alt="Logo"
          style={{ maxWidth: '100%', maxHeight: 90, display: 'block', margin: '0 auto 10px' }}
        />
      )}

      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 16 }}>
        {config.nombreNegocio || 'Mi negocio'}
      </div>
      {config.telefono && <div style={{ textAlign: 'center' }}>{config.telefono}</div>}
      {config.direccion && <div style={{ textAlign: 'center' }}>{config.direccion}</div>}

      <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px dashed #999' }} />

      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 15 }}>COTIZACIÓN</div>
      <div>Cotización #{datos.folio}</div>
      <div>{datos.fecha}</div>
      <div>Atendió: {datos.vendedor}</div>

      <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px dashed #999' }} />
      <div>Cliente: {datos.cliente.nombre}</div>
      {datos.cliente.telefono && <div>Tel: {datos.cliente.telefono}</div>}

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

      <AvisoCotizacion />

      <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px dashed #999' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16 }}>
        <span>TOTAL</span>
        <span>{formatoMoneda(datos.total)}</span>
      </div>

      <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: '#6b7280' }}>
        Cotización sin compromiso — precios sujetos a cambio hasta confirmar la venta.
      </div>

      <AvisoCotizacion />
    </div>
  );
}
