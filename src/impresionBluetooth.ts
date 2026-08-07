// Utilidades para imprimir el recibo en una impresora termica Bluetooth
// usando el protocolo ESC/POS. Cada fabricante de impresora BLE economica
// usa un servicio/caracteristica GATT distinto -- no hay un estandar unico.
// En vez de fijar un solo UUID, se prueban varios PERFILES_CONOCIDOS en
// orden (los mas comunes en impresoras de 58mm/80mm tipo GoojPrt/Zjiang/
// "Cat printer") hasta que uno conecta. Si NINGUNO funciona, hay que
// inspeccionar el dispositivo con chrome://bluetooth-internals en Android
// (o la app/SDK de la impresora) para sacar su UUID exacto y agregarlo
// a esta lista.
interface PerfilImpresora {
  nombre: string;
  servicio: number | string;
  caracteristica: number | string;
}

const PERFILES_CONOCIDOS: PerfilImpresora[] = [
  { nombre: 'Generico FF00/FF02', servicio: 0xff00, caracteristica: 0xff02 },
  { nombre: 'Generico FF00/FF01', servicio: 0xff00, caracteristica: 0xff01 },
  { nombre: 'POS58 comun 18F0/2AF1', servicio: 0x18f0, caracteristica: 0x2af1 },
  { nombre: 'Serial BLE FFE0/FFE1', servicio: 0xffe0, caracteristica: 0xffe1 },
  {
    nombre: 'UART transparente ISSC',
    servicio: '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    caracteristica: '49535343-8841-43f4-a8d4-ecbe34729bb3',
  },
];

let dispositivo: any = null;
let caracteristica: any = null;
let perfilConectado: PerfilImpresora | null = null;

export function impresoraConectada(): boolean {
  return !!caracteristica;
}

export function nombreImpresoraConectada(): string | null {
  return dispositivo?.name ?? null;
}

/** Perfil de servicio/caracteristica GATT que conecto -- util para diagnostico/soporte. */
export function perfilImpresoraConectado(): string | null {
  return perfilConectado?.nombre ?? null;
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

  // Web Bluetooth exige declarar de antemano TODOS los servicios GATT que
  // se van a pedir despues -- si no se listan aqui, getPrimaryService()
  // falla aunque el dispositivo si tenga ese servicio.
  const dev = await bt.requestDevice({
    acceptAllDevices: true,
    optionalServices: PERFILES_CONOCIDOS.map((p) => p.servicio),
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

  // Se prueba cada perfil conocido en orden hasta que uno conecte -- cada
  // fabricante usa un UUID de servicio/caracteristica distinto.
  let ultimoError: any = null;
  for (const perfil of PERFILES_CONOCIDOS) {
    try {
      const service = await conTiempoLimite<any>(
        server.getPrimaryService(perfil.servicio),
        6000,
        `Sin respuesta probando el perfil "${perfil.nombre}".`
      );
      const char = await conTiempoLimite<any>(
        service.getCharacteristic(perfil.caracteristica),
        6000,
        `Sin respuesta probando el perfil "${perfil.nombre}".`
      );

      dispositivo = dev;
      caracteristica = char;
      perfilConectado = perfil;
      return dev.name ?? 'Impresora';
    } catch (err) {
      ultimoError = err;
    }
  }

  try {
    dev.gatt.disconnect();
  } catch {
    // ignorar, de todos modos no se guardo ninguna referencia
  }

  throw new Error(
    `No se encontró ningún perfil de impresora compatible en "${dev.name ?? 'este dispositivo'}". ` +
      `Se probaron ${PERFILES_CONOCIDOS.length} perfiles conocidos sin éxito ` +
      `(último error: ${ultimoError?.message ?? ultimoError}). ` +
      'Necesitamos el UUID exacto: en el celular abre chrome://bluetooth-internals, ' +
      'busca el dispositivo y revisa sus servicios, o avísale a soporte el modelo exacto de la impresora.'
  );
}

export function desconectarImpresora() {
  try {
    dispositivo?.gatt?.disconnect();
  } catch {
    // ignorar, ya se va a limpiar la referencia de todos modos
  }
  dispositivo = null;
  caracteristica = null;
  perfilConectado = null;
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

// Ancho de impresion en puntos (dots) segun el tamano de papel -- estandar
// casi universal en impresoras termicas ESC/POS baratas (203dpi): 384
// puntos para 58mm, 576 para 80mm. No confundir con anchoCaracteres(), que
// es para TEXTO (columnas), esto es para la imagen (pixeles).
function anchoPuntos(anchoPapelMm: number) {
  return anchoPapelMm === 80 ? 576 : 384;
}

// Altura maxima del logo impreso, para que un logo con proporciones raras
// (muy alto) no imprima medio metro de papel en blanco.
const ALTO_MAXIMO_LOGO_PUNTOS = 220;

/**
 * Convierte el logo (base64, el mismo que se ve en Configuracion) a un
 * bitmap blanco/negro y arma el comando ESC/POS para imprimirlo (GS v 0,
 * "print raster bit image"). Se hace con un <canvas> oculto: se dibuja el
 * logo centrado sobre fondo blanco del ancho exacto del papel, y cada
 * pixel se vuelve 1 bit (negro si es oscuro u opaco, blanco si no).
 */
async function bytesLogoImpresora(logoBase64: string, anchoPapelMm: number): Promise<number[]> {
  const anchoDots = anchoPuntos(anchoPapelMm);

  const img = await conTiempoLimite(
    new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('No se pudo leer la imagen del logo.'));
      el.src = logoBase64;
    }),
    8000,
    'El logo tardó demasiado en cargar.'
  );

  let dibujoAncho = anchoDots;
  let dibujoAlto = Math.round((img.height / img.width) * dibujoAncho) || 1;
  if (dibujoAlto > ALTO_MAXIMO_LOGO_PUNTOS) {
    dibujoAlto = ALTO_MAXIMO_LOGO_PUNTOS;
    dibujoAncho = Math.round((img.width / img.height) * dibujoAlto) || 1;
  }

  const canvas = document.createElement('canvas');
  canvas.width = anchoDots;
  canvas.height = dibujoAlto;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo preparar el logo para imprimir.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const offsetX = Math.round((anchoDots - dibujoAncho) / 2);
  ctx.drawImage(img, offsetX, 0, dibujoAncho, dibujoAlto);

  const { data } = ctx.getImageData(0, 0, anchoDots, dibujoAlto);
  const bytesPorFila = Math.ceil(anchoDots / 8);
  const bitmap = new Uint8Array(bytesPorFila * dibujoAlto);

  for (let y = 0; y < dibujoAlto; y++) {
    for (let x = 0; x < anchoDots; x++) {
      const idx = (y * anchoDots + x) * 4;
      const gris = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      const alpha = data[idx + 3];
      const esNegro = alpha > 10 && gris < 200;
      if (esNegro) {
        const byteIndex = y * bytesPorFila + (x >> 3);
        bitmap[byteIndex] |= 0x80 >> x % 8;
      }
    }
  }

  // GS v 0: m xL xH yL yH d1...dk -- m=0 (normal), x/y en little-endian.
  return [
    GS,
    0x76,
    0x30,
    0x00,
    bytesPorFila & 0xff,
    (bytesPorFila >> 8) & 0xff,
    dibujoAlto & 0xff,
    (dibujoAlto >> 8) & 0xff,
    ...Array.from(bitmap),
  ];
}

export async function imprimirLineas(
  lineas: LineaRecibo[],
  veces = 1,
  logo?: { base64: string; anchoPapelMm: number }
) {
  const bytesTexto = construirBytes(lineas);
  let bytes = bytesTexto;

  if (logo) {
    try {
      const bytesImg = await bytesLogoImpresora(logo.base64, logo.anchoPapelMm);
      bytes = new Uint8Array([...cmdInicio(), ...bytesImg, ...saltos(1), ...bytesTexto]);
    } catch {
      // Si el logo falla (imagen invalida, canvas no disponible, etc.) se
      // imprime el recibo solo con texto -- mejor eso que no imprimir nada.
      bytes = bytesTexto;
    }
  }

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
