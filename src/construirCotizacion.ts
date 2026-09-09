import { anchoCaracteres, lineaDosColumnas, lineaSeparadora, type LineaRecibo } from './impresionBluetooth';
import type { Configuracion } from './api';

export interface ItemCotizacionDatos {
  producto: string;
  marca: string;
  cantidad: number;
  precioUnitario: number;
}

export interface DatosCotizacion {
  folio: number | string;
  fecha: string;
  vendedor: string;
  cliente: { nombre: string; telefono: string };
  items: ItemCotizacionDatos[];
  total: number;
}

// El aviso en letra doble (el doble de ancha) solo cabe ~16 caracteres en
// papel de 32mm y ~24 en 80mm -- se reparte en varias lineas cortas para
// que quepa en cualquiera de los dos, en vez de que el papel lo corte o
// la impresora lo encoja solo.
function bloqueAvisoCotizacion(): LineaRecibo[] {
  return [
    { texto: 'ESTO ES UNA', centrado: true, negrita: true, doble: true },
    { texto: 'COTIZACION', centrado: true, negrita: true, doble: true },
    { texto: 'NO ES UN', centrado: true, negrita: true, doble: true },
    { texto: 'RECIBO DE VENTA', centrado: true, negrita: true, doble: true },
  ];
}

/**
 * Lineas para imprimir una cotizacion en la impresora termica -- a
 * diferencia del recibo de venta, no lleva pagos ni saldo (nada se cobro
 * todavia), y el aviso de "no es una venta" se repite arriba, en medio
 * (justo despues de los productos) y hasta abajo del todo, para que sea
 * imposible confundirla con un recibo de venta ya cobrada.
 */
export function construirLineasCotizacion(config: Configuracion, datos: DatosCotizacion): LineaRecibo[] {
  const ancho = config.anchoPapelMm;
  const lineas: LineaRecibo[] = [];

  lineas.push(...bloqueAvisoCotizacion());
  lineas.push({ texto: '' });

  lineas.push({ texto: config.nombreNegocio || 'Mi negocio', centrado: true, negrita: true, doble: true });
  if (config.telefono) lineas.push({ texto: config.telefono, centrado: true });
  if (config.direccion) lineas.push({ texto: config.direccion, centrado: true });

  lineas.push({ texto: lineaSeparadora(ancho) });
  lineas.push({ texto: `Cotizacion #${datos.folio}` });
  lineas.push({ texto: datos.fecha });
  lineas.push({ texto: `Atendio: ${datos.vendedor}` });

  lineas.push({ texto: lineaSeparadora(ancho) });
  lineas.push({ texto: `Cliente: ${datos.cliente.nombre}` });
  if (datos.cliente.telefono) lineas.push({ texto: `Tel: ${datos.cliente.telefono}` });

  lineas.push({ texto: lineaSeparadora(ancho) });
  for (const item of datos.items) {
    lineas.push({ texto: `${item.producto} ${item.marca}` });
    const subtotal = item.cantidad * item.precioUnitario;
    lineas.push({
      texto: lineaDosColumnas(`${item.cantidad}kg x $${item.precioUnitario.toFixed(2)}`, `$${subtotal.toFixed(2)}`, ancho),
    });
  }
  lineas.push({ texto: lineaSeparadora(ancho) });
  lineas.push({ texto: lineaDosColumnas('TOTAL', `$${datos.total.toFixed(2)}`, ancho), negrita: true, doble: true });

  lineas.push({ texto: '' });
  lineas.push(...bloqueAvisoCotizacion());
  lineas.push({ texto: '' });

  lineas.push({ texto: 'Precios sujetos a cambio', centrado: true });
  lineas.push({ texto: 'hasta confirmar la venta.', centrado: true });

  lineas.push({ texto: '' });
  lineas.push(...bloqueAvisoCotizacion());

  return lineas;
}

export function anchoParaVistaPreviaCotizacion(anchoPapelMm: number) {
  return anchoCaracteres(anchoPapelMm);
}
