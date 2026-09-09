import { useEffect, useRef } from 'react';
import prospectosData from './prospeccion/prospectos.json';
import prospeccionCss from './prospeccion/prospeccion.css?raw';
import prospeccionScript from './prospeccion/prospeccionScript.js?raw';

interface Props {
  onCerrar: () => void;
}

declare global {
  interface Window {
    __PROSPECCION_DATA__?: unknown;
    __prospeccionMounted?: boolean;
    __prospeccionApi?: { render: () => void };
  }
}

// Modulo de prospeccion en campo, vendido como un solo archivo autocontenido
// (ver el zip original: prospeccion.html + prospectos.json). Aqui se separo
// en 3 piezas (css, script, datos) para poder montarlo dentro de esta app,
// pero el script en si no se toco salvo para leer PROSPECTOS de
// window.__PROSPECCION_DATA__ en vez de traerlo embebido, y para exponer
// window.__prospeccionApi.render() (ver mas abajo, por que).
export function AdminProspeccion({ onCerrar }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.__PROSPECCION_DATA__ = prospectosData;

    // El script usa document.addEventListener a nivel global -- si ya corrio
    // una vez en esta sesion (el usuario entro, salio, y volvio a entrar),
    // no lo volvemos a inyectar (duplicaria los listeners); solo le pedimos
    // que repinte sobre el nuevo <div id="app"> que React acaba de montar.
    if (window.__prospeccionMounted) {
      window.__prospeccionApi?.render();
      return;
    }

    const script = document.createElement('script');
    script.textContent = prospeccionScript;
    document.body.appendChild(script);
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 30, background: '#F4F2EF', overflowY: 'auto' }}>
      <style>{prospeccionCss}</style>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          background: '#fff',
          borderBottom: '1px solid #E2DDD7',
        }}
      >
        <strong>Prospección</strong>
        <button className="boton-secundario" onClick={onCerrar} style={{ height: 36, width: 'auto', marginTop: 0, padding: '0 16px' }}>
          Cerrar
        </button>
      </div>

      <div ref={contenedorRef}>
        <div id="app">
          <header className="hd">
            <div className="hd-top">
              <h1>Prospección</h1>
              <div className="hd-count">
                <span id="hdDone">0</span> de <span id="hdTot">0</span> visitados
              </div>
            </div>
            <div className="bar"><div className="bar-fill" id="barFill" /></div>
            <nav className="rutas" id="rutas" />
          </header>

          <main id="view" />

          <nav className="tabs" id="tabs">
            <button data-tab="hoy" className="on">Hoy</button>
            <button data-tab="lista">Lista</button>
            <button data-tab="ventas">Ventas</button>
            <button data-tab="datos">Datos</button>
          </nav>

          <div className="sheet" id="sheet" hidden>
            <div className="sheet-scrim" data-close />
            <div className="sheet-body" id="sheetBody" role="dialog" aria-modal="true" />
          </div>

          <div className="toast" id="toast" hidden />
        </div>
      </div>
    </div>
  );
}
