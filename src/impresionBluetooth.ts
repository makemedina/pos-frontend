// Utilidades para imprimir el recibo en una impresora termica Bluetooth
// usando el protocolo ESC/POS. Se probo con el servicio/caracteristica
// GATT mas comun en impresoras BLE economicas de 58mm/80mm (familia
// generica tipo "GoojPrt"/"Zjiang"). SI TU IMPRESORA NO IMPRIME, esto es
// lo primero a revisar: cada fabricante puede usar un UUID distinto; se
// puede inspeccionar con chrome://bluetooth-internals o la app/SDK de
// tu impresora, y ajustar las dos constantes de abajo.

const SERVICE_UUID = 0xff00; // 0000ff00-0000-1000-8000-00805f9b34fb
const CHARACTERISTIC_UUID = 0xff02; // 0000ff02-0000-1000-8000-00805f9b34fb

let dispositivo: any = null;
let caracteristica: any = null;

export function impresoraConectada(): boolean {
  return !!caracteristica;
}

export function nombreImpresoraConectada(): string | null {
  return dispositivo?.name ?? null;
}

function conTiempoLimite<T>(promesa: Promise<T>, ms: number, mensajeError: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const temporizador = setTimeout(() => reject(new Error(mensajeError)), ms);
    promesa.then(
      (valor) => {
        clearTimeout(temporizador);
        resolve(valor);
      },
      (err) => {
        clearTimeout(temporizador);
        reject(err);
      }
    );
  });
}

export async function conectarImpresora(): Promise<string> {
  const bt = (navigator as any).bluetooth;
  if (!bt) {
    throw new Error('Este navegador no soporta Web Bluetooth (usa Chrome en Android).');
  }

  const dev = await bt.requestDevice({
    acceptAllDevices: true,
    optionalServices: [SERVICE_UUID],
  });

  // gatt.connect() a veces se queda colgado sin fallar ni conectar --
  // sobre todo en Android, si la impresora esta apagada, lejos, o no
  // soporta bien BLE. Sin este limite, el boton de "conectar" se queda
  // pegado para siempre sin ningun aviso.
  const server = await conTiempoLimite<any>(
    dev.gatt.connect(),
    15000,
    'La conexión tardó demasiado. Verifica que la impresora esté encendida y cerca, y vuelve a intentar.'
  );
  const service = await conTiempoLimite<any>(
    server.getPrimaryService(SERVICE_UUID),
    10000,
    'No se encontró el servicio Bluetooth esperado en esta impresora.'
  );
  const char = await conTiempoLimite<any>(
    service.getCharacteristic(CHARACTERISTIC_UUID),
    10000,
    'No se encontró la característica Bluetooth esperada en esta impresora.'
  );

  dispositivo = dev;
  caracteristica = char;
  return dev.name ?? 'Impresora';
}

export function desconectarImpresora() {
  try {
    dispositivo?.gatt?.disconnect();
  } catch {
    // ignorar, ya se va a limpiar la referencia de todos modos
  }
  dispositivo = null;
  caracteristica = null;
}

function quitarAcentos(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const ESC = 0x1b;
const GS = 0x1d;

function cmdInicio(): number[] {
  return [ESC, 0x40];
}
function cmdCentrado(activar: boolean): number[] {
  return [ESC, 0x61, activar ? 1 : 0];
}
function cmdNegrita(activar: boolean): number[] {
  return [ESC, 0x45, activar ? 1 : 0];
}
function cmdDoble(activar: boolean): number[] {
  return [GS, 0x21, activar ? 0x11 : 0x00];
}
function textoABytes(texto: string): number[] {
  return Array.from(quitarAcentos(texto)).map((c) => c.charCodeAt(0) & 0xff);
}
function saltos(n = 1): number[] {
  return new Array(n).fill(0x0a);
}

export interface LineaRecibo {
  texto: string;
  centrado?: boolean;
  negrita?: boolean;
  doble?: boolean;
}

export function anchoCaracteres(anchoPapelMm: number) {
  return anchoPapelMm === 80 ? 48 : 32;
}

/** Reparte un texto en dos columnas (ej. "Producto" ... "$45.00"), ajustado al ancho del papel. */
export function lineaDosColumnas(izquierda: string, derecha: string, anchoPapelMm: number) {
  const ancho = anchoCaracteres(anchoPapelMm);
  const espacio = Math.max(ancho - izquierda.length - derecha.length, 1);
  return izquierda + ' '.repeat(espacio) + derecha;
}

export function lineaSeparadora(anchoPapelMm: number) {
  return '-'.repeat(anchoCaracteres(anchoPapelMm));
}

function construirBytes(lineas: LineaRecibo[]): Uint8Array {
  const bytes: number[] = [...cmdInicio()];

  for (const linea of lineas) {
    bytes.push(...cmdCentrado(!!linea.centrado));
    bytes.push(...cmdNegrita(!!linea.negrita));
    bytes.push(...cmdDoble(!!linea.doble));
    bytes.push(...textoABytes(linea.texto));
    bytes.push(...saltos(1));
  }

  bytes.push(...cmdCentrado(false), ...cmdNegrita(false), ...cmdDoble(false));
  bytes.push(...saltos(3)); // espacio extra para poder cortar el papel a mano

  return new Uint8Array(bytes);
}

/** Manda los bytes en trozos pequenos: los characteristic.writeValue de BLE tienen un limite de tamano por envio. */
async function enviarBytes(bytes: Uint8Array) {
  if (!caracteristica) throw new Error('No hay impresora conectada');
  const TAMANO_TROZO = 100;
  for (let i = 0; i < bytes.length; i += TAMANO_TROZO) {
    const trozo = bytes.slice(i, i + TAMANO_TROZO);
    await caracteristica.writeValue(trozo);
    await new Promise((r) => setTimeout(r, 20)); // pausa corta para no saturar el buffer
  }
}

export async function imprimirLineas(lineas: LineaRecibo[], veces = 1) {
  const bytes = construirBytes(lineas);
  for (let i = 0; i < veces; i++) {
    await enviarBytes(bytes);
  }
}

export async function imprimirPrueba(anchoPapelMm: number) {
  await imprimirLineas([
    { texto: 'PRUEBA DE IMPRESION', centrado: true, negrita: true },
    { texto: new Date().toLocaleString(), centrado: true },
    { texto: lineaSeparadora(anchoPapelMm) },
    { texto: 'Si ves este texto completo,' },
    { texto: 'la impresora esta bien conectada.' },
  ]);
}
