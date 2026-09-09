import { useEffect, useState } from 'react';
import tijuanaData from './prospeccion/tijuana.json';
import tijuanaRutas from './prospeccion/tijuana-rutas.json';
import culiacanData from './prospeccion/culiacan.json';
import culiacanRutas from './prospeccion/culiacan-rutas.json';
import prospeccionCss from './prospeccion/prospeccion.css?raw';
import prospeccionScript from './prospeccion/prospeccionScript.js?raw';

interface Props {
  onCerrar: () => void;
}

declare global {
  interface Window {
    __PROSPECCION_DATA__?: unknown;
    __PROSPECCION_RUTAS__?: unknown;
    __PROSPECCION_ZONA__?: string;
    __prospeccionMounted?: boolean;
    __prospeccionApi?: {
      render: () => void;
      setZona: (prospectos: unknown, rutas: unknown, zonaKey: string) => void;
    };
  }
}

interface Zona {
  key: string;
  titulo: string;
  prospectos: unknown;
  rutas: unknown;
}

// Cada zona es una ciudad/area con su propio set de prospectos y rutas. Los
// ids y las claves de ruta de "culiacan.json" ya vienen sin cruzarse con las
// de "tijuana.json" (ver culiacan_merged.json en el zip original), y el
// script namespacea la captura por zona (carne.crm.<zona>) para que cambiar
// de zona no mezcle visitas de una ciudad con ids de otra.
const ZONAS: Zona[] = [
  { key: 'tijuana', titulo: 'Playas de Tijuana', prospectos: tijuanaData, rutas: tijuanaRutas },
  { key: 'culiacan', titulo: 'Culiacán centro · zona 3', prospectos: culiacanData, rutas: culiacanRutas },
];

// Modulo de prospeccion en campo, vendido como un solo archivo autocontenido
// por zona (ver el zip original: prospeccion_clientes.html + prospeccion_proveedores.html).
// Aqui se separo en piezas (css, script, datos por zona) para poder montarlo
// dentro de esta app y para poder cambiar de zona sin recargar la pagina.
// El script en si no se toco salvo para leer PROSPECTOS/RUTAS de
// window.__PROSPECCION_* en vez de traerlos embebidos, namespacear su
// localStorage por zona, y exponer window.__prospeccionApi (render/setZona)
// para que React pueda cambiar de zona sin re-inyectar el script (evitaria
// duplicar los listeners de document).
export function AdminProspeccion({ onCerrar }: Props) {
  const [zonaKey, setZonaKey] = useState(ZONAS[0].key);
  const zona = ZONAS.find((z) => z.key === zonaKey)!;

  useEffect(() => {
    window.__PROSPECCION_DATA__ = zona.prospectos;
    window.__PROSPECCION_RUTAS__ = zona.rutas;
    window.__PROSPECCION_ZONA__ = zona.key;

    if (window.__prospeccionMounted) {
      window.__prospeccionApi?.setZona(zona.prospectos, zona.rutas, zona.key);
      return;
    }

    const script = document.createElement('script');
    script.textContent = prospeccionScript;
    document.body.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zonaKey]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 30, background: '#F4F2EF', overflowY: 'auto' }}>
      <style>{prospeccionCss}</style>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          padding: '10px 14px',
          background: '#fff',
          borderBottom: '1px solid #E2DDD7',
        }}
      >
        <strong>Prospección</strong>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ZONAS.map((z) => (
            <button
              key={z.key}
              className="boton-secundario"
              onClick={() => setZonaKey(z.key)}
              style={{
                height: 32,
                width: 'auto',
                marginTop: 0,
                padding: '0 12px',
                fontSize: 12.5,
                background: z.key === zonaKey ? '#191512' : undefined,
                borderColor: z.key === zonaKey ? '#191512' : undefined,
                color: z.key === zonaKey ? '#fff' : undefined,
              }}
            >
              {z.titulo}
            </button>
          ))}
        </div>
        <button className="boton-secundario" onClick={onCerrar} style={{ height: 36, width: 'auto', marginTop: 0, padding: '0 16px' }}>
          Cerrar
        </button>
      </div>

      <div id="app">
        <header className="hd">
          <div className="hd-top">
            <h1>{zona.titulo}</h1>
            <div className="hd-count">
              <span id="hdDone">0</span> de <span id="hdTot">0</span> visitados
            </div>
          </div>
          <div className="bar"><div className="bar-fill" id="barFill" /></div>
          <nav className="rutas" id="lados" />
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
  );
}
