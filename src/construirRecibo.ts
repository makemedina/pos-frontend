import { anchoCaracteres, lineaDosColumnas, lineaSeparadora, type LineaRecibo } from './impresionBluetooth';
import type { Configuracion } from './api';
import { etiquetaMetodoPago } from './formato';

export interface ItemReciboDatos {
  producto: string;
  marca: string;
  cantidad: number;
  precioUnitario: number;
}

export interface PagoReciboDatos {
  metodoPago: string;
  monto: number;
}


export interface DatosRecibo {
  folio: number | string;
  fecha: string;
  vendedor: string;
  cliente?: { nombre: string; telefono: string } | null;
  items: ItemReciboDatos[];
  total: number;
  // El pago inicial se puede repartir entre varios metodos (ej. parte en
  // efectivo y parte por transferencia) -- se muestra cada uno por separado.
  pagos?: PagoReciboDatos[];
  esCredito: boolean;
  saldoPendiente: number;
  // Saldo total del cliente sumando TODAS sus notas a credito (no solo
  // esta venta) -- solo se muestra si viene un valor.
  saldoTotalCliente?: number;
}

/** Orden del recibo: logo (no aplica en texto) -> encabezado del negocio -> datos del cliente -> cuerpo -> pie. */
export function construirLineasRecibo(config: Configuracion, datos: DatosRecibo): LineaRecibo[] {
  const ancho = config.anchoPapelMm;
  const lineas: LineaRecibo[] = [];

  // Encabezado con datos del negocio
  lineas.push({ texto: config.nombreNegocio || 'Mi negocio', centrado: true, negrita: true, doble: true });
  if (config.telefono) lineas.push({ texto: config.telefono, centrado: true });
  if (config.direccion) lineas.push({ texto: config.direccion, centrado: true });
  if (config.encabezadoRecibo) {
    lineas.push({ texto: '' });
    lineas.push({ texto: config.encabezadoRecibo, centrado: true });
  }

  lineas.push({ texto: lineaSeparadora(ancho) });
  lineas.push({ texto: `Venta #${datos.folio}` });
  lineas.push({ texto: datos.fecha });
  lineas.push({ texto: `Atendio: ${datos.vendedor}` });

  // Datos del cliente (si el switch esta activado)
  if (config.mostrarDatosCliente && datos.cliente) {
    lineas.push({ texto: lineaSeparadora(ancho) });
    lineas.push({ texto: `Cliente: ${datos.cliente.nombre}` });
    if (datos.cliente.telefono) lineas.push({ texto: `Tel: ${datos.cliente.telefono}` });
  }

  // Cuerpo del recibo
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

  if (datos.pagos && datos.pagos.length > 0) {
    for (const pago of datos.pagos) {
      lineas.push({
        texto: lineaDosColumnas(`Pagado (${etiquetaMetodoPago(pago.metodoPago)})`, `$${pago.monto.toFixed(2)}`, ancho),
      });
    }
  }
  if (datos.esCredito) {
    lineas.push({ texto: 'VENTA A CREDITO', negrita: true });
    lineas.push({ texto: `Saldo pendiente (esta nota): $${datos.saldoPendiente.toFixed(2)}` });
  }
  if (datos.saldoTotalCliente !== undefined) {
    lineas.push({
      texto: lineaDosColumnas('Saldo total del cliente', `$${datos.saldoTotalCliente.toFixed(2)}`, ancho),
      negrita: true,
    });
  }

  // Pie de recibo
  if (config.piePaginaRecibo) {
    lineas.push({ texto: '' });
    lineas.push({ texto: config.piePaginaRecibo, centrado: true });
  }
  lineas.push({ texto: '' });
  lineas.push({ texto: 'Gracias por su compra', centrado: true });

  return lineas;
}

export function anchoParaVistaPrevia(anchoPapelMm: number) {
  return anchoCaracteres(anchoPapelMm);
}
