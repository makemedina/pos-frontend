// PRIORIDAD 1: si existe VITE_API_URL (configurada en Cloudflare Pages / .env
// para produccion), se usa esa -- apunta directo al backend real en Railway.
// PRIORIDAD 2 (respaldo, solo para pruebas locales en la misma red sin esa
// variable configurada): se usa el mismo host con el que se abrio la app,
// cambiando el puerto al 3000 del backend local.
export const API_URL =
  (import.meta.env as any).VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000/api`;

// ---------- MANEJO DE SESION ----------
// El backend ahora exige un token en cada llamada (Authorization: Bearer <token>).
// Antes no existia ningun mecanismo de sesion; esto centraliza el token en
// memoria y lo agrega automaticamente a cada fetch de este archivo.

let tokenActual: string | null = null;

export function guardarToken(token: string) {
  tokenActual = token;
}

export function limpiarToken() {
  tokenActual = null;
}

export function headerAuth(): Record<string, string> {
  return tokenActual ? { Authorization: `Bearer ${tokenActual}` } : {};
}

async function manejarRespuesta(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw { ...data, status: res.status };
  }
  return data;
}

// ---------- AUTENTICACION ----------

export interface Permisos {
  puedeVerCostos: boolean;
  puedeRegistrarCompras: boolean;
  puedeVerUtilidad: boolean;
  puedeVerCarteraGeneral: boolean;
  puedeVerGastosTodos: boolean;
  puedeAutorizar: boolean;
  puedeRegistrarPagos: boolean;
}

export interface UsuarioSesion {
  id: string;
  nombre: string;
  telefono: string;
  rolBase: string;
  permisos: Permisos | null;
}

export async function login(telefono: string, pin: string): Promise<{ token: string; usuario: UsuarioSesion }> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telefono, pin }),
  });
  const data = await manejarRespuesta(res);
  guardarToken(data.token);
  return data;
}

export async function logout() {
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: headerAuth(),
    });
  } finally {
    limpiarToken();
  }
}

// ---------- CATALOGO ----------

export interface VarianteCatalogo {
  id: string;
  producto: string;
  marca: string;
  categoria: string | null;
  precioVenta: number;
  stockMinimo: number;
  stockDisponible: number;
  costoLoteMasViejo: number | null;
  pocoStock: boolean;
}

export async function obtenerCatalogo(): Promise<VarianteCatalogo[]> {
  const res = await fetch(`${API_URL}/catalogo`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo cargar el catalogo');
  }
  return res.json();
}

export interface VarianteBusqueda {
  id: string;
  marca: string;
  producto: { id: string; nombre: string };
}

export async function buscarVariantes(query: string): Promise<VarianteBusqueda[]> {
  if (query.length < 2) return [];
  const res = await fetch(`${API_URL}/catalogo/buscar?q=${encodeURIComponent(query)}`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo buscar productos');
  }
  return res.json();
}

export async function crearVarianteRapida(
  nombreProducto: string,
  marca: string,
  precioVenta: number
): Promise<VarianteBusqueda> {
  const res = await fetch(`${API_URL}/catalogo/variantes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify({ nombreProducto, marca, precioVenta }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo crear la variante');
  }
  return res.json();
}

export interface Producto {
  id: string;
  nombre: string;
}

export async function buscarProductos(query: string): Promise<Producto[]> {
  if (query.length < 2) return [];
  const res = await fetch(`${API_URL}/catalogo/productos?q=${encodeURIComponent(query)}`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo buscar productos');
  }
  return res.json();
}

export interface VarianteExistente {
  id: string;
  marca: string;
  precioVenta: string;
}

export async function obtenerVariantesDeProducto(productoId: string): Promise<VarianteExistente[]> {
  const res = await fetch(`${API_URL}/catalogo/productos/${productoId}/variantes`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudieron obtener las variantes');
  }
  return res.json();
}

// ---------- GESTION DE PRODUCTOS (pantalla Productos) ----------

export interface LoteStockGestion {
  cantidadDisponible: number;
  costoUnitario: number;
  fechaIngreso: string;
}

export interface ProductoGestion {
  id: string;
  producto: string;
  productoId: string;
  marca: string;
  categoria: string | null;
  precioVenta: number;
  lotes: LoteStockGestion[];
  stockMinimo: number;
  stockDisponible: number;
  pocoStock: boolean;
}

export async function obtenerProductosGestion(): Promise<ProductoGestion[]> {
  const res = await fetch(`${API_URL}/catalogo/gestion`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudieron cargar los productos');
  }
  return res.json();
}

export async function actualizarProducto(id: string, nombre: string): Promise<{ id: string; nombre: string }> {
  const res = await fetch(`${API_URL}/catalogo/productos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify({ nombre }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { ...data, status: res.status };
  return data;
}

export interface MovimientoVariante {
  tipo: 'entrada' | 'salida' | 'merma' | 'correccion_positiva' | 'correccion_negativa';
  id: string;
  fecha: string;
  cantidad: number;
  valor: number;
  referencia: string;
  navegarA?: { tipo: 'compra' | 'venta'; id: string };
}

export async function obtenerHistorialVariante(varianteId: string): Promise<MovimientoVariante[]> {
  const res = await fetch(`${API_URL}/catalogo/variantes/${varianteId}/historial`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo cargar el historial del producto');
  }
  return res.json();
}

// ---------- CLIENTES ----------

export interface Cliente {
  id: string;
  nombre: string;
  telefono: string;
}

export async function buscarClientes(query: string): Promise<Cliente[]> {
  if (query.length < 2) return [];
  const res = await fetch(`${API_URL}/clientes?q=${encodeURIComponent(query)}`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo buscar clientes');
  }
  return res.json();
}

export async function crearClienteRapido(nombre: string, telefono: string): Promise<Cliente> {
  const res = await fetch(`${API_URL}/clientes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify({ nombre, telefono }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo crear el cliente');
  }
  return res.json();
}

export interface ClienteConSaldo {
  id: string;
  nombre: string;
  telefono: string;
  direccion: string | null;
  permiteVentaCredito: boolean;
  saldoInicial: number;
  saldoTotal: number;
}

export async function obtenerClientesConSaldo(filtro: 'todos' | 'conDeuda' | 'sinDeuda'): Promise<ClienteConSaldo[]> {
  const res = await fetch(`${API_URL}/clientes/todos?filtro=${filtro}`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudieron cargar los clientes');
  }
  return res.json();
}

export async function obtenerClienteDetalle(id: string): Promise<ClienteConSaldo> {
  const res = await fetch(`${API_URL}/clientes/${id}`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo cargar el cliente');
  }
  return res.json();
}

export async function crearClienteCompleto(datos: { nombre: string; telefono: string; direccion?: string }): Promise<Cliente> {
  const res = await fetch(`${API_URL}/clientes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo crear el cliente');
  }
  return res.json();
}

export async function importarClientes(nombres: string[]): Promise<{ creados: number }> {
  const res = await fetch(`${API_URL}/clientes/importar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify({ nombres }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudieron importar los clientes');
  }
  return res.json();
}

export async function cargarSaldosIniciales(
  filas: { nombre: string; saldo: number }[],
  fecha?: string
): Promise<{ actualizados: string[]; noEncontrados: string[] }> {
  const res = await fetch(`${API_URL}/clientes/saldos-iniciales`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify({ filas, fecha }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudieron cargar los saldos iniciales');
  }
  return res.json();
}

export async function migrarSaldoInicialANotas(fecha?: string): Promise<{ migrados: string[] }> {
  const res = await fetch(`${API_URL}/clientes/migrar-saldo-inicial`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify({ fecha }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo migrar el saldo inicial');
  }
  return res.json();
}

export async function cargarFacturasIniciales(
  filas: { proveedor: string; telefono?: string; factura: string; importe: number }[],
  fecha?: string
): Promise<{ creadas: number }> {
  const res = await fetch(`${API_URL}/admin/cargar-facturas-iniciales`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify({ filas, fecha }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudieron cargar las facturas iniciales');
  }
  return res.json();
}

export async function actualizarCliente(
  id: string,
  datos: { nombre?: string; telefono?: string; direccion?: string; permiteVentaCredito?: boolean }
): Promise<ClienteConSaldo> {
  const res = await fetch(`${API_URL}/clientes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo actualizar el cliente');
  }
  return res.json();
}

// Solo administradores. Si el cliente tiene ventas, cotizaciones o saldo
// inicial de cartera, el backend rechaza con 409 y code TIENE_INFORMACION_LIGADA.
export async function eliminarCliente(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/clientes/${id}`, {
    method: 'DELETE',
    headers: headerAuth(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw { ...data, status: res.status };
  }
}

export interface ItemVentaCliente {
  producto: string;
  productoId: string;
  marca: string;
  cantidad: number;
  precioUnitario: number;
}

export interface VentaDeCliente {
  id: string;
  folio: number;
  fecha: string;
  total: number;
  saldoPendiente: number;
  esCredito: boolean;
  estadoPago: string;
  items: ItemVentaCliente[];
}

export async function obtenerVentasDeCliente(clienteId: string): Promise<VentaDeCliente[]> {
  const res = await fetch(`${API_URL}/clientes/${clienteId}/ventas`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudieron cargar las transacciones del cliente');
  }
  return res.json();
}

export interface MovimientoCliente {
  tipo: 'venta' | 'abono';
  id: string;
  folio: number;
  fecha: string;
  monto: number;
}

export async function obtenerMovimientosDeCliente(
  clienteId: string
): Promise<{ saldoTotal: number; movimientos: MovimientoCliente[] }> {
  const res = await fetch(`${API_URL}/clientes/${clienteId}/movimientos`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudieron cargar los movimientos del cliente');
  }
  return res.json();
}

export interface ItemVentaDetalle {
  producto: string;
  marca: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface VentaDetalle {
  id: string;
  folio: number;
  fecha: string;
  total: number;
  saldoPendiente: number;
  esCredito: boolean;
  estadoPago: string;
  cancelada: boolean;
  canceladaEn: string | null;
  cliente: { id: string; nombre: string; telefono: string };
  vendedor: { id: string; nombre: string };
  metodosPago: string[];
  pagos: { metodoPago: string; monto: number }[];
  items: ItemVentaDetalle[];
}

export async function obtenerDetalleVenta(ventaId: string): Promise<VentaDetalle> {
  const res = await fetch(`${API_URL}/ventas/${ventaId}`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo cargar el detalle de la venta');
  }
  return res.json();
}

export interface ItemUtilidadVenta {
  producto: string;
  marca: string;
  cantidad: number;
  precioUnitario: number;
  costoUnitario: number;
  utilidad: number;
}

export interface UtilidadVenta {
  utilidadDevengada: number;
  utilidadCobrada: number;
  items: ItemUtilidadVenta[];
}

// Solo administradores (o un vendedor con el permiso puedeVerUtilidad) --
// el backend responde 403 para cualquier otro usuario.
export async function obtenerUtilidadVenta(ventaId: string): Promise<UtilidadVenta> {
  const res = await fetch(`${API_URL}/ventas/${ventaId}/utilidad`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo cargar la utilidad de la venta');
  }
  return res.json();
}

export async function cancelarVenta(
  ventaId: string,
  autorizacion?: { telefono: string; pin: string }
): Promise<VentaDetalle> {
  const res = await fetch(`${API_URL}/ventas/${ventaId}/cancelar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify(autorizacion || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { ...data, status: res.status };
  return data;
}

// ---------- PROVEEDORES ----------

export interface Proveedor {
  id: string;
  nombre: string;
  telefono: string | null;
}

export async function buscarProveedores(query: string): Promise<Proveedor[]> {
  const res = await fetch(`${API_URL}/proveedores?q=${encodeURIComponent(query)}`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo buscar proveedores');
  }
  return res.json();
}

export async function crearProveedorRapido(nombre: string, telefono?: string): Promise<Proveedor> {
  const res = await fetch(`${API_URL}/proveedores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify({ nombre, telefono }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo crear el proveedor');
  }
  return res.json();
}

export async function obtenerProveedoresTodos(): Promise<Proveedor[]> {
  const res = await fetch(`${API_URL}/proveedores/todos`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudieron cargar los proveedores');
  }
  return res.json();
}

export async function actualizarProveedor(
  id: string,
  datos: { nombre?: string; telefono?: string }
): Promise<Proveedor> {
  const res = await fetch(`${API_URL}/proveedores/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo actualizar el proveedor');
  }
  return res.json();
}

// Solo administradores. Si el proveedor tiene compras o gastos, el
// backend rechaza con 409 y code TIENE_INFORMACION_LIGADA.
export async function eliminarProveedor(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/proveedores/${id}`, {
    method: 'DELETE',
    headers: headerAuth(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw { ...data, status: res.status };
  }
}

export async function importarProveedores(nombres: string[]): Promise<{ creados: number }> {
  const res = await fetch(`${API_URL}/proveedores/importar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify({ nombres }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudieron importar los proveedores');
  }
  return res.json();
}

// ---------- COMPRAS ----------

export interface ItemCompraPayload {
  varianteId: string;
  cantidad: number;
  costoUnitario: number;
}

export interface CrearCompraPayload {
  proveedorId: string;
  numeroFactura?: string;
  fechaVencimiento?: string;
  items: ItemCompraPayload[];
  pagoInicial?: number;
  metodoPagoInicial?: string;
}

export async function registrarCompra(payload: CrearCompraPayload) {
  const res = await fetch(`${API_URL}/compras`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo registrar la compra');
  }
  return res.json();
}

export async function registrarPagoCompra(compraId: string, monto: number, metodoPago: string) {
  const res = await fetch(`${API_URL}/compras/${compraId}/pagos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify({ monto, metodoPago }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { ...data, status: res.status };
  return data;
}

export interface AsignacionPagoMultipleCompra {
  compraId: string;
  monto: number;
}

export interface DetallePagoMultiCompra {
  compraId: string;
  numeroFactura: string | null;
  monto: number;
  saldoFacturaRestante: number;
}

export interface ResultadoPagoMultiCompra {
  detalle: DetallePagoMultiCompra[];
  totalPagado: number;
}

export async function registrarPagoMultiCompra(
  proveedorId: string,
  asignaciones: AsignacionPagoMultipleCompra[],
  metodoPago: string
): Promise<ResultadoPagoMultiCompra> {
  const res = await fetch(`${API_URL}/proveedores/${proveedorId}/pagos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify({ asignaciones, metodoPago }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { ...data, status: res.status };
  return data;
}

export interface FacturaPendiente {
  id: string;
  numeroFactura: string | null;
  saldoPendiente: number;
  total: number;
  fechaVencimiento: string | null;
  fecha: string;
  proveedor: { id: string; nombre: string; telefono: string | null };
}

export async function obtenerFacturasPendientes(): Promise<FacturaPendiente[]> {
  const res = await fetch(`${API_URL}/compras/pendientes`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudieron cargar las facturas pendientes');
  }
  return res.json();
}

export interface PagoCompraHistorial {
  id: string;
  monto: number;
  metodoPago: string;
  fecha: string;
  registradoPor: { nombre: string };
}

export async function obtenerPagosDeCompra(compraId: string): Promise<PagoCompraHistorial[]> {
  const res = await fetch(`${API_URL}/compras/${compraId}/pagos`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo cargar el historial de pagos');
  }
  return res.json();
}

// ---------- INVENTARIO (ajustes/merma) ----------

export interface LoteInventario {
  id: string;
  costoUnitario: number;
  cantidadInicial: number;
  cantidadDisponible: number;
  fechaIngreso: string;
}

export async function obtenerLotesDeVariante(varianteId: string): Promise<LoteInventario[]> {
  const res = await fetch(`${API_URL}/inventario/lotes/${varianteId}`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudieron obtener los lotes');
  }
  return res.json();
}

export interface AjusteInventarioPayload {
  loteId: string;
  tipo: 'merma' | 'correccion_positiva' | 'correccion_negativa';
  cantidad: number;
  motivo: string;
  // Siempre obligatorios: un ajuste de inventario SIEMPRE requiere
  // autorizacion, sin excepcion (a diferencia de precio bajo costo,
  // que solo la requiere cuando el precio cae por debajo del costo).
  autorizadoPorTelefono: string;
  autorizadoPin: string;
}

export async function registrarAjusteInventario(payload: AjusteInventarioPayload) {
  const res = await fetch(`${API_URL}/inventario/ajustes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { ...data, status: res.status };
  return data;
}

// ---------- VENTAS ----------

export interface ItemVentaPayload {
  varianteId: string;
  cantidad: number;
  precioUnitario: number;
  // Se requieren los tres SOLO si el precio queda por debajo del costo del lote.
  // El administrador se identifica por su TELEFONO (el mismo que usa para
  // hacer login), no por un ID interno que nadie se sabe de memoria.
  autorizadoPorTelefono?: string;
  autorizadoPin?: string;
  motivoAutorizacion?: string;
}

export interface PagoInicialPayload {
  monto: number;
  metodoPago: string;
}

export interface CrearVentaPayload {
  clienteId: string;
  items: ItemVentaPayload[];
  esCredito: boolean;
  // El pago inicial se puede repartir entre varios metodos (ej. parte en
  // efectivo y parte por transferencia).
  pagos?: PagoInicialPayload[];
}

export async function registrarVenta(payload: CrearVentaPayload) {
  const res = await fetch(`${API_URL}/ventas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify(payload),
  });
  return manejarRespuesta(res);
}

export async function obtenerUltimosPreciosCliente(
  clienteId: string
): Promise<Record<string, { precioUnitario: number; fecha: string }>> {
  const res = await fetch(`${API_URL}/clientes/${clienteId}/ultimos-precios`, { headers: headerAuth() });
  if (!res.ok) return {};
  return res.json();
}

// ---------- COTIZACIONES ----------
// Carrito + cliente guardado para compartir con el cliente ANTES de
// confirmar la venta. No toca inventario ni saldos hasta que se confirma.

export interface ItemCotizacionPayload {
  varianteId: string;
  cantidad: number;
  precioUnitario: number;
}

export interface CotizacionItemDetalle {
  id: string;
  varianteId: string;
  producto: string;
  marca: string;
  cantidad: number;
  precioUnitario: number;
}

export interface CotizacionResumen {
  id: string;
  folio: number;
  fecha: string;
  total: number;
  estado: string;
  cliente: { id: string; nombre: string; telefono: string };
  vendedor: { nombre: string };
  items: { varianteId: string; cantidad: number; precioUnitario: number }[];
}

export interface CotizacionDetalle extends Omit<CotizacionResumen, 'items'> {
  items: CotizacionItemDetalle[];
}

export async function crearCotizacion(payload: {
  clienteId: string;
  items: ItemCotizacionPayload[];
}): Promise<CotizacionResumen> {
  const res = await fetch(`${API_URL}/cotizaciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify(payload),
  });
  return manejarRespuesta(res);
}

export async function obtenerCotizacionesPendientes(): Promise<CotizacionResumen[]> {
  const res = await fetch(`${API_URL}/cotizaciones`, { headers: headerAuth() });
  if (!res.ok) return [];
  return res.json();
}

export async function obtenerCotizacion(id: string): Promise<CotizacionDetalle> {
  const res = await fetch(`${API_URL}/cotizaciones/${id}`, { headers: headerAuth() });
  return manejarRespuesta(res);
}

export async function confirmarCotizacion(
  id: string,
  datos: {
    esCredito: boolean;
    pagos?: PagoInicialPayload[];
    autorizadoPorTelefono?: string;
    autorizadoPin?: string;
    motivoAutorizacion?: string;
  }
) {
  const res = await fetch(`${API_URL}/cotizaciones/${id}/confirmar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify(datos),
  });
  return manejarRespuesta(res);
}

export async function cancelarCotizacion(id: string) {
  const res = await fetch(`${API_URL}/cotizaciones/${id}/cancelar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
  });
  return manejarRespuesta(res);
}

// ---------- CONFIGURACION (negocio, recibo, impresora) ----------

export interface Configuracion {
  id: string;
  nombreNegocio: string;
  logoBase64: string | null;
  telefono: string;
  direccion: string;
  notasNegocio: string;
  mostrarDatosCliente: boolean;
  encabezadoRecibo: string;
  piePaginaRecibo: string;
  anchoPapelMm: number;
  imprimirDosVeces: boolean;
  saldoBancoActual: number;
  saldoEfectivoActual: number;
}

export async function obtenerConfiguracion(): Promise<Configuracion> {
  const res = await fetch(`${API_URL}/configuracion`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo cargar la configuracion');
  }
  return res.json();
}

export async function guardarConfiguracion(datos: Partial<Configuracion>): Promise<Configuracion> {
  const res = await fetch(`${API_URL}/configuracion`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo guardar la configuracion');
  }
  return res.json();
}

// ---------- CORTE DE CAJA ----------

export interface PagoDetalleCorte {
  id: string;
  folio: number;
  cliente: string;
  monto: number;
  metodoPago: string;
  fecha: string;
  registradoPor: string;
}

export interface PagoProveedorDetalleCorte {
  id: string;
  proveedor: string;
  numeroFactura: string | null;
  monto: number;
  metodoPago: string;
  fecha: string;
  registradoPor: string;
}

export interface GastoDetalleCorte {
  id: string;
  concepto: string;
  categoria: string;
  proveedor: string | null;
  monto: number;
  metodoPago: string;
  fecha: string;
  registradoPor: string;
}

export interface DepositoDetalleCorte {
  id: string;
  monto: number;
  notas: string | null;
  fecha: string;
  registradoPor: string;
}

export interface VentaDetalleCorte {
  id: string;
  folio: number;
  cliente: string;
  vendedor: string;
  total: number;
  saldoPendiente: number;
  estadoPago: string;
  metodoPago: string | null;
  montoEfectivo: number;
  montoTransferencia: number;
  fecha: string;
}

export interface CompraDetalleCorte {
  id: string;
  numeroFactura: string | null;
  proveedor: string;
  total: number;
  saldoPendiente: number;
  estadoPago: string;
  metodoPago: string | null;
  fecha: string;
}

export interface SubtotalesPorMetodo {
  efectivo: number;
  transferencia: number;
  credito: number;
}

export interface VentaCanceladaCorte {
  id: string;
  folio: number;
  cliente: string;
  total: number;
  fechaOriginal: string;
  canceladaEn: string;
  canceladaPor: string;
}

export interface CompraCanceladaCorte {
  id: string;
  numeroFactura: string | null;
  proveedor: string;
  total: number;
  fechaOriginal: string;
  canceladaEn: string;
  canceladaPor: string;
}

export interface ResumenCorteDia {
  yaExisteCorteHoy: boolean;
  corteExistente: {
    id: string;
    efectivoContado: number;
    saldoBancoContado: number;
    // Tal como quedaron capturados ESE dia (no se recalculan con datos de hoy).
    utilidadDia: number;
    valorInventario: number;
    balanzaTotal: number;
    observacion: string | null;
  } | null;
  ventas: {
    total: number;
    cobrado: number;
    cantidad: number;
    subtotalesPorMetodo: SubtotalesPorMetodo;
    detalle: VentaDetalleCorte[];
  };
  compras: {
    total: number;
    cantidad: number;
    subtotalesPorMetodo: SubtotalesPorMetodo;
    detalle: CompraDetalleCorte[];
  };
  gastos: {
    total: number;
    cantidad: number;
    subtotalesPorMetodo: SubtotalesPorMetodo;
    detalle: GastoDetalleCorte[];
  };
  pagosClientes: {
    total: number;
    efectivo: number;
    transferencia: number;
    cantidad: number;
    detalle: PagoDetalleCorte[];
  };
  pagosProveedores: {
    total: number;
    efectivo: number;
    transferencia: number;
    cantidad: number;
    detalle: PagoProveedorDetalleCorte[];
  };
  depositosBanco: {
    total: number;
    cantidad: number;
    detalle: DepositoDetalleCorte[];
  };
  cartera: number;
  cuentasPorPagar: number;
  saldoBancoSistema: number;
  saldoEfectivoSistema: number;
  canceladas: { ventas: VentaCanceladaCorte[]; compras: CompraCanceladaCorte[] };
  // Solo presentes si el usuario tiene permiso de ver utilidad. Nota:
  // balanzaTotal/diferenciaCuadre de HOY no vienen del backend -- todavia
  // no se sabe cuanto hay en efectivo/banco hasta que se cuenten, asi que
  // se calculan en vivo en la pantalla con lo que se vaya escribiendo.
  utilidadDia?: number;
  valorInventario?: number;
  balanzaAyer?: number | null;
  balanzaEsperada?: number | null;
  // A diferencia de los de arriba, este es visible para cualquiera (no
  // solo quien puede ver utilidad) -- punto de partida del cuadre de
  // efectivo del dia, que tambien es publico.
  efectivoAyer?: number | null;
}

export async function obtenerCorteDelDia(fecha?: string): Promise<ResumenCorteDia> {
  const url = fecha ? `${API_URL}/corte?fecha=${fecha}` : `${API_URL}/corte`;
  const res = await fetch(url, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo cargar el resumen del dia');
  }
  return res.json();
}

export async function guardarCorte(
  efectivoContado: number,
  saldoBancoContado: number,
  fecha?: string,
  observacion?: string
) {
  const res = await fetch(`${API_URL}/corte/caja`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify({ efectivoContado, saldoBancoContado, fecha, observacion }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { ...data, status: res.status };
  return data;
}

export interface CorteHistorico {
  id: string;
  fecha: string;
  efectivoContado: number;
  saldoBancoContado: number;
  registradoPor: string;
  actualizadoEn: string;
  utilidadDia?: number;
  gastosDia?: number;
  valorInventario?: number;
  balanzaTotal?: number;
  balanzaEsperada?: number | null;
  diferenciaCuadre?: number | null;
  observacion: string | null;
}

export async function obtenerHistorialCortes(): Promise<CorteHistorico[]> {
  const res = await fetch(`${API_URL}/corte/historial`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo cargar el historico de cortes');
  }
  return res.json();
}

export async function actualizarCorte(
  id: string,
  efectivoContado: number,
  saldoBancoContado: number,
  observacion?: string
) {
  const res = await fetch(`${API_URL}/corte/caja/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify({ efectivoContado, saldoBancoContado, observacion }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo actualizar el corte');
  }
  return res.json();
}

export async function eliminarCorte(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/corte/caja/${id}`, {
    method: 'DELETE',
    headers: headerAuth(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo eliminar el corte');
  }
}

export interface ItemCompraDetalle {
  producto: string;
  marca: string;
  cantidad: number;
  costoUnitario: number;
  subtotal: number;
}

export interface CompraDetalle {
  id: string;
  numeroFactura: string | null;
  fecha: string;
  fechaVencimiento: string | null;
  total: number;
  saldoPendiente: number;
  estadoPago: string;
  cancelada: boolean;
  canceladaEn: string | null;
  proveedor: { id: string; nombre: string; telefono: string | null };
  metodosPago: string[];
  items: ItemCompraDetalle[];
}

export async function cancelarCompra(
  compraId: string,
  autorizacion?: { telefono: string; pin: string }
): Promise<CompraDetalle> {
  const res = await fetch(`${API_URL}/compras/${compraId}/cancelar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify(autorizacion || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { ...data, status: res.status };
  return data;
}

export async function obtenerDetalleCompra(compraId: string): Promise<CompraDetalle> {
  const res = await fetch(`${API_URL}/compras/${compraId}`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo cargar el detalle de la compra');
  }
  return res.json();
}

export interface ItemCompraHistorial {
  producto: string;
  marca: string;
  cantidad: number;
  costoUnitario: number;
}

export interface CompraHistorial {
  id: string;
  numeroFactura: string | null;
  fecha: string;
  fechaVencimiento: string | null;
  total: number;
  saldoPendiente: number;
  estadoPago: string;
  cancelada: boolean;
  canceladaEn: string | null;
  proveedor: { id: string; nombre: string; telefono: string | null };
  metodosPago: string[];
  items: ItemCompraHistorial[];
}

export interface FiltrosHistorialCompras {
  periodo?: 'todos' | 'dia' | 'semana' | 'mes' | 'anio' | 'rango';
  desde?: string;
  hasta?: string;
  proveedorId?: string;
  estadoPago?: string;
}

export async function obtenerHistorialCompras(filtros: FiltrosHistorialCompras): Promise<CompraHistorial[]> {
  const params = new URLSearchParams();
  if (filtros.periodo) params.set('periodo', filtros.periodo);
  if (filtros.desde) params.set('desde', filtros.desde);
  if (filtros.hasta) params.set('hasta', filtros.hasta);
  if (filtros.proveedorId) params.set('proveedorId', filtros.proveedorId);
  if (filtros.estadoPago) params.set('estadoPago', filtros.estadoPago);

  const res = await fetch(`${API_URL}/compras/historial?${params.toString()}`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo cargar el historial de compras');
  }
  return res.json();
}

// ---------- MOVIMIENTOS DE INVENTARIO (reporte) ----------

export interface MovimientoInventario {
  tipo: 'entrada' | 'salida' | 'merma' | 'correccion_positiva' | 'correccion_negativa';
  id: string;
  fecha: string;
  producto: string;
  marca: string;
  cantidad: number;
  valor: number;
  referencia: string;
}

export interface ResumenMovimientosInventario {
  entradasKg: number;
  entradasValor: number;
  salidasKg: number;
  salidasValor: number;
  mermaKg: number;
  mermaValor: number;
  correccionNetaKg: number;
  correccionNetaValor: number;
}

export interface FiltrosMovimientosInventario {
  periodo?: 'todos' | 'dia' | 'semana' | 'mes' | 'anio' | 'rango';
  desde?: string;
  hasta?: string;
  productoId?: string;
}

export async function obtenerMovimientosInventario(
  filtros: FiltrosMovimientosInventario
): Promise<{ resumen: ResumenMovimientosInventario; movimientos: MovimientoInventario[] }> {
  const params = new URLSearchParams();
  if (filtros.periodo) params.set('periodo', filtros.periodo);
  if (filtros.desde) params.set('desde', filtros.desde);
  if (filtros.hasta) params.set('hasta', filtros.hasta);
  if (filtros.productoId) params.set('productoId', filtros.productoId);

  const res = await fetch(`${API_URL}/inventario/movimientos?${params.toString()}`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo cargar el reporte de movimientos');
  }
  return res.json();
}

// ---------- ANTIGÜEDAD DE STOCK ----------

export interface LoteAntiguo {
  id: string;
  producto: string;
  marca: string;
  proveedor: string;
  cantidadDisponible: number;
  costoUnitario: number;
  valorEnStock: number;
  fechaIngreso: string;
  diasEnStock: number;
  critico: boolean;
}

export async function obtenerAntiguedadStock(): Promise<LoteAntiguo[]> {
  const res = await fetch(`${API_URL}/inventario/antiguedad-stock`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo cargar la antigüedad del stock');
  }
  return res.json();
}

// ---------- HISTORIAL DE VENTAS ----------

export interface ItemVentaHistorial {
  producto: string;
  marca: string;
  cantidad: number;
  precioUnitario: number;
  // Solo presentes si el usuario tiene permiso de ver utilidad:
  costoUnitario?: number;
  utilidad?: number;
}

export interface VentaHistorial {
  id: string;
  folio: number;
  fecha: string;
  total: number;
  saldoPendiente: number;
  esCredito: boolean;
  estadoPago: string;
  cancelada: boolean;
  canceladaEn: string | null;
  cliente: { id: string; nombre: string; telefono: string };
  vendedor: { id: string; nombre: string };
  metodosPago: string[];
  items: ItemVentaHistorial[];
}

export interface FiltrosHistorial {
  periodo?: 'todos' | 'dia' | 'semana' | 'mes' | 'anio' | 'rango';
  desde?: string;
  hasta?: string;
  clienteId?: string;
  metodoPago?: string;
  incluirCanceladas?: boolean;
}

export async function obtenerHistorialVentas(filtros: FiltrosHistorial): Promise<VentaHistorial[]> {
  const params = new URLSearchParams();
  if (filtros.periodo) params.set('periodo', filtros.periodo);
  if (filtros.desde) params.set('desde', filtros.desde);
  if (filtros.hasta) params.set('hasta', filtros.hasta);
  if (filtros.clienteId) params.set('clienteId', filtros.clienteId);
  if (filtros.metodoPago) params.set('metodoPago', filtros.metodoPago);
  if (filtros.incluirCanceladas) params.set('incluirCanceladas', 'true');

  const res = await fetch(`${API_URL}/historial/ventas?${params.toString()}`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo cargar el historial de ventas');
  }
  return res.json();
}

// ---------- CARTERA ----------

export interface ClienteCartera {
  id: string;
  nombre: string;
  telefono: string;
  saldoInicial: number;
  saldoTotal: number;
  notasConSaldo: number;
}

export interface NotaCartera {
  id: string;
  folio: number;
  fecha: string;
  total: number;
  saldoPendiente: number;
  estadoPago: string;
}

export interface PagoNota {
  id: string;
  monto: number;
  metodoPago: string;
  fecha: string;
  cancelado: boolean;
  canceladoEn: string | null;
  registradoPor: { nombre: string };
}

export async function obtenerResumenCartera(): Promise<ClienteCartera[]> {
  const res = await fetch(`${API_URL}/cartera/clientes`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo cargar la cartera');
  }
  return res.json();
}

export async function obtenerNotasCliente(clienteId: string, incluirPagadas: boolean): Promise<NotaCartera[]> {
  const res = await fetch(
    `${API_URL}/cartera/clientes/${clienteId}/notas?incluirPagadas=${incluirPagadas}`,
    { headers: headerAuth() }
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudieron cargar las notas del cliente');
  }
  return res.json();
}

export async function obtenerPagosDeNota(ventaId: string): Promise<PagoNota[]> {
  const res = await fetch(`${API_URL}/ventas/${ventaId}/pagos`, { headers: headerAuth() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo cargar el historial de pagos');
  }
  return res.json();
}

export async function registrarPagoVenta(ventaId: string, monto: number, metodoPago: string) {
  const res = await fetch(`${API_URL}/ventas/${ventaId}/pagos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify({ monto, metodoPago }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { ...data, status: res.status };
  return data;
}

export async function cancelarPagoVenta(
  ventaId: string,
  pagoId: string,
  autorizacion?: { telefono: string; pin: string }
) {
  const res = await fetch(`${API_URL}/ventas/${ventaId}/pagos/${pagoId}/cancelar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify(autorizacion ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { ...data, status: res.status };
  return data;
}

export interface AsignacionPagoMultiple {
  ventaId: string;
  monto: number;
}

export interface DetallePagoMultiNota {
  ventaId: string;
  folio: number;
  monto: number;
  saldoNotaRestante: number;
}

export interface ResultadoPagoMultiNota {
  detalle: DetallePagoMultiNota[];
  totalPagado: number;
  saldoTotalCliente: number;
}

export async function registrarPagoMultiNota(
  clienteId: string,
  asignaciones: AsignacionPagoMultiple[],
  metodoPago: string
): Promise<ResultadoPagoMultiNota> {
  const res = await fetch(`${API_URL}/cartera/clientes/${clienteId}/pagos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify({ asignaciones, metodoPago }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { ...data, status: res.status };
  return data;
}

// ---------- RESPALDOS (solo administradores) ----------

export interface BackupInfo {
  key: string;
  fecha: string;
  tamano: number;
  tipo: 'manual' | 'automatico' | 'pre-restauracion';
}

export async function obtenerBackups(): Promise<BackupInfo[]> {
  const res = await fetch(`${API_URL}/admin/backups`, { headers: headerAuth() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { ...data, status: res.status };
  return data;
}

export async function crearBackupManual(): Promise<BackupInfo> {
  const res = await fetch(`${API_URL}/admin/backups`, { method: 'POST', headers: headerAuth() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { ...data, status: res.status };
  return data;
}

export async function eliminarBackup(key: string): Promise<void> {
  const res = await fetch(`${API_URL}/admin/backups?key=${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: headerAuth(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw { ...data, status: res.status };
  }
}

export async function restaurarBackup(key: string, confirmacion: string): Promise<void> {
  const res = await fetch(`${API_URL}/admin/backups/restaurar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify({ key, confirmacion }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { ...data, status: res.status };
}

/** Descarga el respaldo directo al dispositivo (no se puede usar un link normal porque la ruta exige el token de sesion). */
export async function descargarBackup(key: string): Promise<void> {
  const res = await fetch(`${API_URL}/admin/backups/descargar?key=${encodeURIComponent(key)}`, {
    headers: headerAuth(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo descargar el respaldo');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = key.split('/').pop() || 'respaldo.dump';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
