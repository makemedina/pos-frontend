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
