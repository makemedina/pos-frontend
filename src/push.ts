import { obtenerVapidPublicKey, suscribirsePush, desuscribirsePush } from './api';

// El navegador exige la llave publica VAPID como Uint8Array, no como el
// base64url que manda el backend -- conversion estandar de la spec de
// Web Push.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function notificacionesSoportadas(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function notificacionesActivadas(): Promise<boolean> {
  if (!notificacionesSoportadas()) return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

export async function activarNotificaciones(): Promise<void> {
  if (!notificacionesSoportadas()) {
    throw new Error('Este navegador no soporta notificaciones push.');
  }
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') {
    throw new Error('No se concedió permiso para mandar notificaciones.');
  }
  const publicKey = await obtenerVapidPublicKey();
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }
  await suscribirsePush(sub);
}

export async function desactivarNotificaciones(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await desuscribirsePush(sub.endpoint);
    await sub.unsubscribe();
  }
}

/**
 * Pide permiso de notificaciones sin que el usuario tenga que ir a
 * buscar un boton -- se llama sola al entrar al Dashboard. Si el
 * navegador ya decidio "denied" en el pasado, no vuelve a mostrar el
 * cuadro de permiso (asi lo impone el navegador, no hay manera de
 * forzarlo); en ese caso no hacemos nada. Si esta en "default" (nunca se
 * le ha preguntado, o "recordar despues"), se le vuelve a preguntar --
 * como el navegador no deja saber de antemano si va a mostrar el cuadro
 * otra vez, esto efectivamente lo repite cada vez que entra al Dashboard
 * hasta que acepte. Si ya esta "granted" pero por lo que sea no quedo
 * suscrito (ej. se reinstalo la PWA), se vuelve a suscribir sin volver a
 * preguntar (ya se tiene el permiso).
 */
export async function intentarActivarNotificacionesAutomatico(): Promise<void> {
  if (!notificacionesSoportadas()) return;
  if (Notification.permission === 'denied') return;
  try {
    if (Notification.permission === 'granted') {
      const yaActiva = await notificacionesActivadas();
      if (!yaActiva) await activarNotificaciones();
      return;
    }
    await activarNotificaciones();
  } catch {
    // Silencioso -- esto corre solo, sin que el usuario haya pedido nada,
    // asi que no tiene caso mostrarle un error si no acepto o fallo.
  }
}
