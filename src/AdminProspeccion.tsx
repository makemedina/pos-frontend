import { useEffect, useState } from 'react';
import tijuanaData from './prospeccion/tijuana.json';
import tijuanaRutas from './prospeccion/tijuana-rutas.json';
import culiacanZ1 from './prospeccion/culiacan-z1.json';
import culiacanZ1Rutas from './prospeccion/culiacan-z1-rutas.json';
import culiacanZ2 from './prospeccion/culiacan-z2.json';
import culiacanZ2Rutas from './prospeccion/culiacan-z2-rutas.json';
import culiacanZ3 from './prospeccion/culiacan-z3.json';
import culiacanZ3Rutas from './prospeccion/culiacan-z3-rutas.json';
import culiacanZ4 from './prospeccion/culiacan-z4.json';
import culiacanZ4Rutas from './prospeccion/culiacan-z4-rutas.json';
import culiacanZ5 from './prospeccion/culiacan-z5.json';
import culiacanZ5Rutas from './prospeccion/culiacan-z5-rutas.json';
import culiacanZ6 from './prospeccion/culiacan-z6.json';
import culiacanZ6Rutas from './prospeccion/culiacan-z6-rutas.json';
import culiacanZ7 from './prospeccion/culiacan-z7.json';
import culiacanZ7Rutas from './prospeccion/culiacan-z7-rutas.json';
import culiacanZ8 from './prospeccion/culiacan-z8.json';
import culiacanZ8Rutas from './prospeccion/culiacan-z8-rutas.json';
import culiacanZ9 from './prospeccion/culiacan-z9.json';
import culiacanZ9Rutas from './prospeccion/culiacan-z9-rutas.json';
import culiacanZ10 from './prospeccion/culiacan-z10.json';
import culiacanZ10Rutas from './prospeccion/culiacan-z10-rutas.json';
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

interface Ciudad {
  key: string;
  titulo: string;
  zonas: Zona[];
}

// Cada ciudad se divide en zonas (Tijuana trae una sola). Los ids y las
// claves de ruta de cada archivo *-z*.json ya vienen sin cruzarse entre
// clientes/proveedores DENTRO de esa zona (offset de id + prefijo de ruta,
// ver procesar_ciudad.py), y el script namespacea la captura por
// ciudad+zona (carne.crm.<ciudad>-<zona>) para que cambiar de zona no
// mezcle visitas de una con ids de otra.
const CIUDADES: Ciudad[] = [
  {
    key: 'tijuana',
    titulo: 'Playas de Tijuana',
    zonas: [{ key: 'unica', titulo: 'Playas de Tijuana', prospectos: tijuanaData, rutas: tijuanaRutas }],
  },
  {
    key: 'culiacan',
    titulo: 'Culiacán',
    zonas: [
      { key: 'z1', titulo: 'Rieles · zona 1', prospectos: culiacanZ1, rutas: culiacanZ1Rutas },
      { key: 'z2', titulo: 'Los Ángeles · zona 2', prospectos: culiacanZ2, rutas: culiacanZ2Rutas },
      { key: 'z3', titulo: 'Centro · zona 3', prospectos: culiacanZ3, rutas: culiacanZ3Rutas },
      { key: 'z4', titulo: 'Guadalupe Victoria · zona 4', prospectos: culiacanZ4, rutas: culiacanZ4Rutas },
      { key: 'z5', titulo: 'Valle Alto · zona 5', prospectos: culiacanZ5, rutas: culiacanZ5Rutas },
      { key: 'z6', titulo: 'Lázaro Cárdenas · zona 6', prospectos: culiacanZ6, rutas: culiacanZ6Rutas },
      { key: 'z7', titulo: 'Díaz Ordaz · zona 7', prospectos: culiacanZ7, rutas: culiacanZ7Rutas },
      { key: 'z8', titulo: 'Benito Juárez Norte · zona 8', prospectos: culiacanZ8, rutas: culiacanZ8Rutas },
      { key: 'z9', titulo: 'Unión · zona 9', prospectos: culiacanZ9, rutas: culiacanZ9Rutas },
      { key: 'z10', titulo: 'Pueblos Unidos · zona 10', prospectos: culiacanZ10, rutas: culiacanZ10Rutas },
    ],
  },
];

// Modulo de prospeccion en campo, vendido como un solo archivo autocontenido
// por zona (ver el zip original: prospeccion_clientes.html + prospeccion_proveedores.html).
// Aqui se separo en piezas (css, script, datos por ciudad/zona) para poder
// montarlo dentro de esta app y para poder cambiar de zona sin recargar la
// pagina. El script en si no se toco salvo para leer PROSPECTOS/RUTAS de
// window.__PROSPECCION_* en vez de traerlos embebidos, namespacear su
// localStorage por zona, y exponer window.__prospeccionApi (render/setZona)
// para que React pueda cambiar de zona sin re-inyectar el script (evitaria
// duplicar los listeners de document).
export function AdminProspeccion({ onCerrar }: Props) {
  const [ciudadKey, setCiudadKey] = useState(CIUDADES[0].key);
  const ciudad = CIUDADES.find((c) => c.key === ciudadKey)!;
  const [zonaKey, setZonaKey] = useState(ciudad.zonas[0].key);
  const zona = ciudad.zonas.find((z) => z.key === zonaKey) ?? ciudad.zonas[0];
  const zonaStorageKey = `${ciudad.key}-${zona.key}`;

  function elegirCiudad(c: Ciudad) {
    setCiudadKey(c.key);
    setZonaKey(c.zonas[0].key);
  }

  useEffect(() => {
    window.__PROSPECCION_DATA__ = zona.prospectos;
    window.__PROSPECCION_RUTAS__ = zona.rutas;
    window.__PROSPECCION_ZONA__ = zonaStorageKey;

    if (window.__prospeccionMounted) {
      window.__prospeccionApi?.setZona(zona.prospectos, zona.rutas, zonaStorageKey);
      return;
    }

    const script = document.createElement('script');
    script.textContent = prospeccionScript;
    document.body.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zonaStorageKey]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 30, background: '#F4F2EF', overflowY: 'auto' }}>
      <style>{prospeccionCss}</style>
      <div style={{ background: '#fff', borderBottom: '1px solid #E2DDD7' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            padding: '10px 14px 8px',
          }}
        >
          <strong>Prospección</strong>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CIUDADES.map((c) => (
              <button
                key={c.key}
                className="boton-secundario"
                onClick={() => elegirCiudad(c)}
                style={{
                  height: 32,
                  width: 'auto',
                  marginTop: 0,
                  padding: '0 12px',
                  fontSize: 12.5,
                  background: c.key === ciudadKey ? '#191512' : undefined,
                  borderColor: c.key === ciudadKey ? '#191512' : undefined,
                  color: c.key === ciudadKey ? '#fff' : undefined,
                }}
              >
                {c.titulo}
              </button>
            ))}
          </div>
          <button className="boton-secundario" onClick={onCerrar} style={{ height: 36, width: 'auto', marginTop: 0, padding: '0 16px' }}>
            Cerrar
          </button>
        </div>

        {ciudad.zonas.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 14px 10px' }}>
            {ciudad.zonas.map((z) => (
              <button
                key={z.key}
                className="boton-secundario"
                onClick={() => setZonaKey(z.key)}
                style={{
                  height: 28,
                  width: 'auto',
                  marginTop: 0,
                  padding: '0 10px',
                  fontSize: 11.5,
                  background: z.key === zonaKey ? '#8C1D18' : undefined,
                  borderColor: z.key === zonaKey ? '#8C1D18' : undefined,
                  color: z.key === zonaKey ? '#fff' : undefined,
                }}
              >
                {z.titulo}
              </button>
            ))}
          </div>
        )}
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
