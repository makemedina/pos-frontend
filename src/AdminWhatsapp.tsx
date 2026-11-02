import { useEffect, useRef, useState } from 'react';
import { formatoFechaHora } from './formato';
import {
  obtenerEstadoWhatsapp,
  conectarWhatsapp,
  completarConexionWhatsapp,
  type EstadoWhatsapp,
} from './api';

// Conecta el numero de WhatsApp del negocio con la app de Meta usando el
// "Embedded Signup" de Meta en modo coexistencia: el numero sigue
// funcionando en la app de WhatsApp Business del celular y, ademas, los
// chats que llegan desde un anuncio le avisan al POS (webhook) para que
// Meta sepa que anuncio trajo cada venta.

interface Props {
  onCerrar: () => void;
}

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

function cargarSdkFacebook(appId: string, apiVersion: string): Promise<void> {
  if (window.FB) return Promise.resolve();
  return new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version: apiVersion });
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/es_LA/sdk.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => reject(new Error('No se pudo cargar Facebook. Revisa tu conexión.'));
    document.body.appendChild(script);
  });
}

export function AdminWhatsapp({ onCerrar }: Props) {
  const [estado, setEstado] = useState<EstadoWhatsapp | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // El Embedded Signup entrega por separado el codigo (callback de
  // FB.login) y los ids de la cuenta (mensaje de la ventana de Meta); se
  // manda al servidor cuando ya estan los dos.
  const codigo = useRef<string | null>(null);
  const cuenta = useRef<{ wabaId: string; phoneNumberId: string } | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    function alMensaje(evento: MessageEvent) {
      if (!/(^|\.)facebook\.com$/.test(new URL(evento.origin).hostname)) return;
      let datos: any;
      try {
        datos = typeof evento.data === 'string' ? JSON.parse(evento.data) : evento.data;
      } catch {
        return;
      }
      if (datos?.type !== 'WA_EMBEDDED_SIGNUP') return;
      if (datos.event === 'CANCEL') {
        setOcupado(false);
        setMensaje(datos.data?.error_message || 'Se canceló la conexión. Tu número no se modificó.');
        return;
      }
      if (datos.data?.waba_id && datos.data?.phone_number_id) {
        cuenta.current = { wabaId: String(datos.data.waba_id), phoneNumberId: String(datos.data.phone_number_id) };
        terminarSiListo();
      }
    }
    window.addEventListener('message', alMensaje);
    return () => window.removeEventListener('message', alMensaje);
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      setEstado(await obtenerEstadoWhatsapp());
    } catch {
      setMensaje('No se pudo consultar la conexión de WhatsApp.');
    } finally {
      setCargando(false);
    }
  }

  async function terminarSiListo() {
    if (!codigo.current || !cuenta.current) return;
    const { wabaId, phoneNumberId } = cuenta.current;
    const codigoActual = codigo.current;
    codigo.current = null;
    cuenta.current = null;
    try {
      const conexion = await conectarWhatsapp(codigoActual, wabaId, phoneNumberId);
      setEstado((e) => (e ? { ...e, conexion } : e));
      setMensaje(
        conexion.ultimoError
          ? 'Número conectado, pero faltó un paso. Dale "Reintentar" abajo.'
          : 'Listo: tu WhatsApp quedó conectado.',
      );
    } catch (err: any) {
      setMensaje(err.error || 'Meta no aceptó la conexión.');
    } finally {
      setOcupado(false);
    }
  }

  async function conectar() {
    if (!estado?.configurado) return;
    setOcupado(true);
    setMensaje(null);
    try {
      await cargarSdkFacebook(estado.configurado.appId, estado.configurado.apiVersion);
    } catch (err: any) {
      setOcupado(false);
      setMensaje(err.message);
      return;
    }
    // FB.login no acepta un callback async.
    window.FB.login(
      (respuesta: any) => {
        if (respuesta?.authResponse?.code) {
          codigo.current = respuesta.authResponse.code;
          terminarSiListo();
        } else {
          setOcupado(false);
          setMensaje((m) => m ?? 'No se completó el inicio de sesión con Meta. Tu número no se modificó.');
        }
      },
      {
        config_id: estado.configurado.configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: '3' },
      },
    );
  }

  async function reintentar() {
    setOcupado(true);
    setMensaje(null);
    try {
      const conexion = await completarConexionWhatsapp();
      setEstado((e) => (e ? { ...e, conexion } : e));
      setMensaje(conexion.ultimoError ? 'Sigue faltando un paso (ver detalle abajo).' : 'Listo, conexión completa.');
    } catch (err: any) {
      setMensaje(err.error || 'No se pudo completar.');
    } finally {
      setOcupado(false);
    }
  }

  const conexion = estado?.conexion;
  const completa = !!conexion && !!conexion.sincronizadoEn && !!conexion.datasetId;

  return (
    <div className="pantalla-centrada pantalla-arriba">
      <div className="contenido-pantalla contenido-760">
        <div className="fila-entre-centro">
          <h2>Conectar WhatsApp</h2>
          <button onClick={onCerrar}>Cerrar</button>
        </div>

        <p className="t-tenue-13-m0">
          Conecta el WhatsApp del negocio para que Meta sepa qué anuncio trajo cada venta. Sigues
          atendiendo desde la app de WhatsApp Business del celular como siempre. Al conectar se
          cierran WhatsApp Web y los de computadora (se vuelven a ligar) y las listas de difusión
          quedan de solo lectura.
        </p>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {cargando ? (
          <p className="t-centro-tenue">Cargando...</p>
        ) : !estado?.configurado ? (
          <div className="aviso-alerta">
            ⚠️ Falta configurar la app de Meta en el servidor (META_APP_ID y META_ES_CONFIG_ID).
          </div>
        ) : (
          <div className="tarjeta-sombra">
            {conexion ? (
              <>
                <strong>{completa ? '✅ Conectado' : '⚠️ Conectado, falta un paso'}</strong>
                <div className="t-tenue-12">Desde {formatoFechaHora(new Date(conexion.conectadoEn))}</div>
                <div className="t-tenue-12">
                  Contactos e historial:{' '}
                  {conexion.sincronizadoEn ? formatoFechaHora(new Date(conexion.sincronizadoEn)) : 'pendiente'}
                </div>
                <div className="t-tenue-12">Dataset de Meta: {conexion.datasetId ?? 'pendiente'}</div>
                {conexion.ultimoError && <div className="aviso-alerta">{conexion.ultimoError}</div>}
                {!completa && (
                  <button onClick={reintentar} disabled={ocupado} style={{ marginTop: 8 }}>
                    {ocupado ? 'Reintentando...' : 'Reintentar'}
                  </button>
                )}
              </>
            ) : (
              <>
                <p style={{ marginTop: 0 }}>
                  Se abre una ventana de Meta. Elige <strong>"Conectar tu app de WhatsApp Business"</strong>,
                  escribe el número del negocio y escanea el código con el celular desde la app de
                  WhatsApp Business.
                </p>
                <button onClick={conectar} disabled={ocupado}>
                  {ocupado ? 'Conectando...' : 'Conectar mi WhatsApp'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
