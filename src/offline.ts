import {
  obtenerCatalogo,
  obtenerClientesConSaldo,
  obtenerConfiguracion,
  registrarVenta,
  type VarianteCatalogo,
  type ClienteConSaldo,
  type Configuracion,
  type CrearVentaPayload,
} from './api';

const CLAVE_CATALOGO = 'offline_catalogo_v1';
const CLAVE_CLIENTES = 'offline_clientes_v1';
const CLAVE_CONFIGURACION = 'offline_configuracion_v1';
const CLAVE_COLA_VENTAS = 'offline_cola_ventas_v1';

export interface VentaPendiente {
  id: string; // id local, generado en el celular
  payload: CrearVentaPayload;
  resumen: {
    clienteNombre: string;
    totalItems: number;
    total: number;
    fecha: string; // fecha en que se capturo, aunque no se haya subido
  };
  estado: 'pendiente' | 'error';
  error?: string;
}

// ---------- Cache de catalogo y clientes, para poder seguir vendiendo sin conexion ----------

export function guardarCatalogoCache(datos: VarianteCatalogo[]) {
  try {
    localStorage.setItem(CLAVE_CATALOGO, JSON.stringify(datos));
  } catch {
    // localStorage lleno o no disponible -- no es fatal, simplemente no habra cache
  }
}

export function obtenerCatalogoCache(): VarianteCatalogo[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_CATALOGO) || '[]');
  } catch {
    return [];
  }
}

export function guardarClientesCache(datos: ClienteConSaldo[]) {
  try {
    localStorage.setItem(CLAVE_CLIENTES, JSON.stringify(datos));
  } catch {
    // ignorar
  }
}

export function obtenerClientesCache(): ClienteConSaldo[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_CLIENTES) || '[]');
  } catch {
    return [];
  }
}

export function guardarConfiguracionCache(datos: Configuracion) {
  try {
    localStorage.setItem(CLAVE_CONFIGURACION, JSON.stringify(datos));
  } catch {
    // ignorar
  }
}

export function obtenerConfiguracionCache(): Configuracion | null {
  try {
    const raw = localStorage.getItem(CLAVE_CONFIGURACION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Refresca los datos guardados localmente (catalogo y clientes) cuando
 * hay conexion. Se llama al iniciar la app y cada vez que vuelve internet.
 * Si algo falla (ej. el usuario no tiene permiso para ver clientes), no
 * es un error fatal -- se sigue usando lo que ya estaba en cache.
 */
export async function refrescarCacheOffline() {
  try {
    const catalogo = await obtenerCatalogo();
    guardarCatalogoCache(catalogo);
  } catch {
    // sin conexion, se mantiene el catalogo que ya estaba guardado
  }

  try {
    const clientes = await obtenerClientesConSaldo('todos');
    guardarClientesCache(clientes);
  } catch {
    // sin conexion o sin permiso -- se mantiene lo que ya estaba guardado
  }

  try {
    const config = await obtenerConfiguracion();
    guardarConfiguracionCache(config);
  } catch {
    // sin conexion -- se mantiene la configuracion que ya estaba guardada
  }
}

/** Descuenta stock de la copia local del catalogo, para no sobrevender mientras no hay conexion. */
export function descontarStockLocal(items: { varianteId: string; cantidad: number }[]) {
  const catalogo = obtenerCatalogoCache();
  for (const item of items) {
    const variante = catalogo.find((v) => v.id === item.varianteId);
    if (variante) {
      variante.stockDisponible = Math.max(0, variante.stockDisponible - item.cantidad);
      variante.pocoStock = variante.stockDisponible <= variante.stockMinimo;
    }
  }
  guardarCatalogoCache(catalogo);
}

// ---------- Cola de ventas pendientes de sincronizar ----------

function generarIdLocal() {
  return (crypto as any).randomUUID ? crypto.randomUUID() : `local-${Date.now()}-${Math.random()}`;
}

function leerCola(): VentaPendiente[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_COLA_VENTAS) || '[]');
  } catch {
    return [];
  }
}

function guardarCola(cola: VentaPendiente[]) {
  try {
    localStorage.setItem(CLAVE_COLA_VENTAS, JSON.stringify(cola));
  } catch {
    // ignorar
  }
}

export function obtenerVentasPendientes(): VentaPendiente[] {
  return leerCola();
}

export function contarVentasPendientes(): number {
  return leerCola().length;
}

export function encolarVenta(
  payload: CrearVentaPayload,
  resumen: VentaPendiente['resumen']
): VentaPendiente {
  const nueva: VentaPendiente = {
    id: generarIdLocal(),
    payload,
    resumen,
    estado: 'pendiente',
  };
  const cola = leerCola();
  cola.push(nueva);
  guardarCola(cola);
  return nueva;
}

export function quitarVentaDeCola(id: string) {
  guardarCola(leerCola().filter((v) => v.id !== id));
}

function marcarVentaConError(id: string, error: string) {
  const cola = leerCola();
  const idx = cola.findIndex((v) => v.id === id);
  if (idx >= 0) {
    cola[idx].estado = 'error';
    cola[idx].error = error;
    guardarCola(cola);
  }
}

export function reintentarVenta(id: string) {
  const cola = leerCola();
  const idx = cola.findIndex((v) => v.id === id);
  if (idx >= 0) {
    cola[idx].estado = 'pendiente';
    cola[idx].error = undefined;
    guardarCola(cola);
  }
}

/**
 * Intenta subir cada venta pendiente en orden. Si una falla por conexion
 * (no llega respuesta del servidor), se detiene ahi para no perder el
 * orden ni marcar de mas. Si el SERVIDOR contesta pero rechaza la venta
 * (ej. el stock ya no alcanza porque cambio mientras estaba offline), esa
 * venta se marca con error para revision manual, y se sigue con las demas.
 */
export async function sincronizarVentasPendientes(): Promise<{ exitosas: number; conError: number }> {
  const cola = leerCola();
  let exitosas = 0;
  let conError = 0;

  for (const venta of cola) {
    if (venta.estado === 'error') continue; // ya se marco antes, necesita revision manual

    try {
      await registrarVenta(venta.payload);
      quitarVentaDeCola(venta.id);
      exitosas++;
    } catch (err: any) {
      if (err && (err.code || err.status)) {
        // el servidor SI respondio, solo que rechazo esta venta en particular
        marcarVentaConError(venta.id, err.error || 'El servidor rechazo esta venta.');
        conError++;
      } else {
        // fallo de red (probablemente se volvio a caer la conexion) -- paramos aqui
        break;
      }
    }
  }

  return { exitosas, conError };
}
