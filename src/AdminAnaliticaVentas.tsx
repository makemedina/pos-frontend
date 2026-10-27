import { useEffect, useState } from 'react';
import {
  actualizarCliente,
  obtenerClasificacionClientes,
  obtenerClientesEnRiesgo,
  TIPOS_CLIENTE,
  type ClasificacionClientes,
  type ClienteEnRiesgo,
  type ClienteParaClasificar,
} from './api';

interface Props {
  onCerrar: () => void;
}

const UMBRAL_RIESGO = 50;

function etiquetaMotivo(motivo: ClienteEnRiesgo['motivo']): string {
  if (motivo === 'ambos') return 'Dejó de comprar y compra menos';
  if (motivo === 'dejo_de_comprar') return 'Dejó de comprar';
  return 'Comprando menos';
}

function etiquetaTipo(tipo: string | null): string {
  return TIPOS_CLIENTE.find((t) => t.valor === tipo)?.etiqueta ?? 'Sin clasificar';
}

function detalleCompras(c: ClienteParaClasificar): string {
  const partes = [`${c.compras} compra${c.compras !== 1 ? 's' : ''}`];
  if (c.intervaloPromedioDias !== null) partes.push(`cada ${c.intervaloPromedioDias} días`);
  partes.push(`${c.diasSinComprar} día${c.diasSinComprar !== 1 ? 's' : ''} sin comprar`);
  return partes.join(' · ');
}

export function AdminAnaliticaVentas({ onCerrar }: Props) {
  const [pestana, setPestana] = useState<'riesgo' | 'clasificar'>('riesgo');
  const [clientes, setClientes] = useState<ClienteEnRiesgo[]>([]);
  const [clasificacion, setClasificacion] = useState<ClasificacionClientes | null>(null);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      const [riesgo, clasif] = await Promise.all([obtenerClientesEnRiesgo(), obtenerClasificacionClientes()]);
      setClientes(riesgo);
      setClasificacion(clasif);
    } catch {
      setMensaje('No se pudo cargar la analítica de ventas.');
    } finally {
      setCargando(false);
    }
  }

  async function clasificar(c: ClienteParaClasificar, tipo: string) {
    setGuardandoId(c.id);
    try {
      await actualizarCliente(c.id, { tipo });
      // Se recarga todo: al cambiar el tipo, el cliente puede salir (u
      // ocupar otro lugar) tanto en la lista de riesgo como en esta.
      const [riesgo, clasif] = await Promise.all([obtenerClientesEnRiesgo(), obtenerClasificacionClientes()]);
      setClientes(riesgo);
      setClasificacion(clasif);
    } catch {
      setMensaje('No se pudo guardar el tipo de cliente.');
    } finally {
      setGuardandoId(null);
    }
  }

  const posiblesCerrados = clasificacion?.porRevisar.filter((c) => c.posibleCerrado) ?? [];
  const sinClasificar = clasificacion?.porRevisar.filter((c) => !c.posibleCerrado) ?? [];

  return (
    <div className="pantalla-centrada pantalla-arriba">
      <div className="contenido-pantalla contenido-760">
        <div className="fila-entre-centro">
          <h2>Analítica de ventas</h2>
          <button onClick={onCerrar}>Cerrar</button>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={pestana === 'riesgo' ? 'boton-primario' : 'boton-secundario'}
            style={{ flex: 1, marginTop: 0 }}
            onClick={() => setPestana('riesgo')}
          >
            En riesgo
          </button>
          <button
            className={pestana === 'clasificar' ? 'boton-primario' : 'boton-secundario'}
            style={{ flex: 1, marginTop: 0 }}
            onClick={() => setPestana('clasificar')}
          >
            Clasificar{clasificacion && clasificacion.porRevisar.length > 0 ? ` (${clasificacion.porRevisar.length})` : ''}
          </button>
        </div>

        {pestana === 'clasificar' ? (
          cargando || !clasificacion ? (
            <p>Cargando...</p>
          ) : (
            <>
              <p className="t-tenue-13-m0">
                Marca a cada cliente como recurrente (negocio que te compra seguido), ocasional (compañeros,
                conocidos, compras de vez en cuando) o cerrado. Solo los recurrentes y los sin clasificar
                aparecen en "En riesgo" y en las llamadas de hoy. La sugerencia sale de su historial de compras.
              </p>
              <div className="tarjeta-sombra fs-13" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <span>Recurrentes: <strong>{clasificacion.resumen.recurrente}</strong></span>
                <span>Ocasionales: <strong>{clasificacion.resumen.ocasional}</strong></span>
                <span>Cerrados: <strong>{clasificacion.resumen.cerrado}</strong></span>
                <span>Sin clasificar: <strong>{clasificacion.resumen.sinClasificar}</strong></span>
              </div>

              {clasificacion.porRevisar.length === 0 && (
                <p className="t-tenue">No hay clientes por revisar.</p>
              )}

              {posiblesCerrados.length > 0 && <h3 style={{ marginBottom: 0 }}>¿Cerraron?</h3>}
              {posiblesCerrados.length > 0 && (
                <p className="t-tenue-13-m0">
                  Compraban seguido y llevan mucho más de lo normal sin comprar. Confirma si cerraron.
                </p>
              )}
              <div className="lista-tarjetas grid-gap-075">
                {posiblesCerrados.map((c) => (
                  <TarjetaClasificar key={c.id} c={c} guardando={guardandoId === c.id} onClasificar={clasificar} />
                ))}
              </div>

              {sinClasificar.length > 0 && <h3 style={{ marginBottom: 0 }}>Sin clasificar</h3>}
              <div className="lista-tarjetas grid-gap-075">
                {sinClasificar.map((c) => (
                  <TarjetaClasificar key={c.id} c={c} guardando={guardandoId === c.id} onClasificar={clasificar} />
                ))}
              </div>
            </>
          )
        ) : (
        <>
        {!cargando && (
          <p className="t-tenue-13-m0">
            Compara a cada cliente contra su propio historial (no contra un promedio general). Se
            marca cuando su ritmo de compra o su gasto de los últimos 30 días cae a {UMBRAL_RIESGO}%
            o menos de lo normal para él — llámales para ofrecerles producto antes de perderlos del todo.
          </p>
        )}

        {!cargando && clientes.length > 0 && (
          <div className="tarjeta-sombra">
            <strong style={{ color: 'var(--peligro)' }}>{clientes.length}</strong> cliente{clientes.length !== 1 ? 's' : ''} en riesgo
          </div>
        )}

        {cargando ? (
          <p>Cargando...</p>
        ) : clientes.length === 0 ? (
          <p className="t-tenue">No hay clientes en riesgo por ahora — necesitas al menos 3 compras de un cliente para poder comparar su ritmo.</p>
        ) : (
          <div className="lista-tarjetas grid-gap-075">
            {clientes.map((c) => (
              <div
                key={c.id}
                style={{ border: 'none', boxShadow: 'var(--sombra-tarjeta)', padding: '0.75rem', borderRadius: 14, background: 'var(--peligro-fondo)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong>{c.nombre}</strong>
                    <div className="fs-13">
                      <a href={`tel:${c.telefono}`} style={{ color: 'var(--acento)' }}>{c.telefono}</a>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--peligro)', fontWeight: 600, marginTop: 2 }}>
                      {etiquetaMotivo(c.motivo)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 13 }}>
                    <div>{c.diasSinComprar} día{c.diasSinComprar !== 1 ? 's' : ''} sin comprar</div>
                    <div style={{ color: 'var(--ios-secondary-label)', fontSize: 12 }}>
                      (normal: cada {c.intervaloPromedioDias} día{c.intervaloPromedioDias !== 1 ? 's' : ''})
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: 8, fontSize: 12, color: 'var(--ios-secondary-label)', borderTop: '1px solid var(--peligro-borde)', paddingTop: 6 }}>
                  <span>Ritmo actual: <strong>{c.ritmoPct}%</strong> de lo normal</span>
                  {c.gastoRecientePct !== null && (
                    <span>Gasto últimos 30 días: <strong>{c.gastoRecientePct}%</strong> de lo normal</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}

function TarjetaClasificar({
  c,
  guardando,
  onClasificar,
}: {
  c: ClienteParaClasificar;
  guardando: boolean;
  onClasificar: (c: ClienteParaClasificar, tipo: string) => void;
}) {
  // En los "¿cerro?" la opcion destacada es cerrado; en los demas, la sugerencia.
  const destacado = c.posibleCerrado ? 'cerrado' : c.sugerencia;
  return (
    <div className="tarjeta-sombra">
      <div className="fila-entre-centro" style={{ alignItems: 'flex-start' }}>
        <div>
          <strong>{c.nombre}</strong>
          <div className="fs-13">
            <a href={`tel:${c.telefono}`} style={{ color: 'var(--acento)' }}>{c.telefono}</a>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--ios-secondary-label)' }}>
          {c.tipo ? `Hoy: ${etiquetaTipo(c.tipo)}` : c.sugerencia ? `Sugerido: ${etiquetaTipo(c.sugerencia)}` : 'Muy nuevo para sugerir'}
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--ios-secondary-label)', marginTop: 4 }}>{detalleCompras(c)}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {TIPOS_CLIENTE.map((t) => (
          <button
            key={t.valor}
            disabled={guardando || c.tipo === t.valor}
            className={destacado === t.valor ? 'boton-primario' : 'boton-secundario'}
            style={{ flex: 1, marginTop: 0, padding: '6px 4px', fontSize: 13 }}
            onClick={() => onClasificar(c, t.valor)}
          >
            {t.valor === 'cerrado' ? 'Cerró' : t.etiqueta}
          </button>
        ))}
      </div>
    </div>
  );
}
