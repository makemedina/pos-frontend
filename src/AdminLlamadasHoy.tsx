import { Icono } from './iconos';
import { useEffect, useState } from 'react';
import {
  obtenerLlamadasDeHoy,
  actualizarLlamadaCliente,
  obtenerPendientesDeHoy,
  actualizarPendiente,
  obtenerProspectosDeHoy,
  type LlamadaHoy,
  type Pendiente,
  type ProspectoResumen,
} from './api';

interface Props {
  onCerrar: () => void;
  onAbrirProspecto?: (id: string) => void;
}

const DIAS_NOMBRE = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// wa.me necesita el numero en formato internacional. Los telefonos de
// clientes se capturan a 10 digitos (celular mexicano) sin lada pais --
// se le antepone 52 si ya viene "limpio" a 10 digitos; si ya trae algo
// distinto (ya tiene lada, espacios, etc.) se manda tal cual sin el 52
// para no inventar un numero equivocado.
function linkWhatsapp(telefono: string, mensaje: string) {
  const soloDigitos = telefono.replace(/\D/g, '');
  const numero = soloDigitos.length === 10 ? `52${soloDigitos}` : soloDigitos;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

export function AdminLlamadasHoy({ onCerrar, onAbrirProspecto }: Props) {
  const [llamadas, setLlamadas] = useState<LlamadaHoy[]>([]);
  const [pendientesHoy, setPendientesHoy] = useState<Pendiente[]>([]);
  const [prospectosHoy, setProspectosHoy] = useState<ProspectoResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      const [llamadasHoy, pendientes, prospectos] = await Promise.all([
        obtenerLlamadasDeHoy(),
        obtenerPendientesDeHoy(),
        obtenerProspectosDeHoy().catch(() => []),
      ]);
      setLlamadas(llamadasHoy);
      setPendientesHoy(pendientes);
      setProspectosHoy(prospectos);
    } catch {
      setMensaje('No se pudieron cargar las llamadas de hoy.');
    } finally {
      setCargando(false);
    }
  }

  async function toggleHechoPendiente(p: Pendiente) {
    setPendientesHoy((prev) => prev.map((x) => (x.id === p.id ? { ...x, hecho: !p.hecho } : x)));
    setGuardandoId(p.id);
    try {
      await actualizarPendiente(p.id, { hecho: !p.hecho });
    } catch {
      setMensaje('No se pudo guardar. Intenta otra vez.');
      cargar();
    } finally {
      setGuardandoId(null);
    }
  }

  // Optimista para hecha/hizoPedido (feedback al toque); las notas se
  // guardan al salir del campo (onBlur), no en cada letra.
  async function actualizar(cliente: LlamadaHoy, datos: { hecha?: boolean; notas?: string; hizoPedido?: boolean }) {
    setLlamadas((prev) => prev.map((l) => (l.id === cliente.id ? { ...l, ...datos } : l)));
    setGuardandoId(cliente.id);
    try {
      await actualizarLlamadaCliente(cliente.id, datos);
    } catch {
      setMensaje('No se pudo guardar. Intenta otra vez.');
      cargar();
    } finally {
      setGuardandoId(null);
    }
  }

  const pendientes = llamadas.filter((l) => !l.hecha);
  const hechas = llamadas.filter((l) => l.hecha);
  const hoyNombre = DIAS_NOMBRE[new Date().getDay()];

  function tarjeta(c: LlamadaHoy) {
    return (
      <div
        key={c.id}
        style={{
          display: 'grid',
          gap: 8,
          border: 'none',
          boxShadow: 'var(--sombra-tarjeta)',
          padding: '0.75rem',
          borderRadius: 14,
          opacity: c.hecha ? 0.75 : 1,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={c.hecha}
              disabled={guardandoId === c.id}
              onChange={() => actualizar(c, { hecha: !c.hecha })}
              style={{ marginTop: 3 }}
            />
            <span>
              <strong style={{ textDecoration: c.hecha ? 'line-through' : 'none' }}>{c.nombre}</strong>
              {c.notasCliente && <div className="t-tenue-12">{c.notasCliente}</div>}
            </span>
          </label>
        </div>

        <div className="fila-gap-8">
          <a
            href={`tel:${c.telefono}`}
            style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 10, background: 'var(--fondo-gris)', color: 'var(--ios-label)', textDecoration: 'none', fontSize: 14 }}
          >
            <Icono nombre="telefono" size={16} /> Llamar
          </a>
          <a
            href={linkWhatsapp(c.telefono, `Hola ${c.nombre}, te habla Mr Carnes para ofrecerte producto.`)}
            target="_blank"
            rel="noreferrer"
            style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 10, background: 'var(--exito-fondo)', color: 'var(--exito-oscuro)', textDecoration: 'none', fontSize: 14 }}
          >
            💬 WhatsApp
          </a>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={c.hizoPedido}
            disabled={guardandoId === c.id}
            onChange={() => actualizar(c, { hizoPedido: !c.hizoPedido })}
          />
          Hizo pedido
        </label>

        <textarea
          placeholder="Notas de esta llamada (qué dijo, cuándo volver a hablarle, etc.)"
          defaultValue={c.notas}
          onBlur={(e) => {
            if (e.target.value !== c.notas) actualizar(c, { notas: e.target.value });
          }}
          rows={2}
          style={{ fontSize: 13, resize: 'vertical' }}
        />
      </div>
    );
  }

  return (
    <div className="pantalla-centrada pantalla-arriba">
      <div className="contenido-pantalla" style={{ width: '100%', maxWidth: 620, display: 'grid', gap: '1rem' }}>
        <div className="fila-entre-centro">
          <h2 style={{ margin: 0, textTransform: 'capitalize' }}>Llamadas de hoy ({hoyNombre})</h2>
          <button onClick={onCerrar}>Cerrar</button>
        </div>

        <p className="t-tenue-13-m0">
          Clientes y prospectos configurados para que se les hable hoy. Márcalos conforme les hables — el
          checklist se reinicia solo cada día.
        </p>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {!cargando && pendientesHoy.length > 0 && (
          <div className="grid-gap-05">
            <strong className="t-tenue-13">Pendientes de hoy ({pendientesHoy.length})</strong>
            {pendientesHoy.map((p) => (
              <div
                key={p.id}
                style={{
                  border: 'none',
                  boxShadow: 'var(--sombra-tarjeta)',
                  padding: '0.75rem',
                  borderRadius: 14,
                  opacity: p.hecho ? 0.6 : 1,
                }}
              >
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={p.hecho}
                    disabled={guardandoId === p.id}
                    onChange={() => toggleHechoPendiente(p)}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    <strong style={{ textDecoration: p.hecho ? 'line-through' : 'none' }}>{p.concepto}</strong>
                    {p.cliente && <div style={{ fontSize: 13, color: 'var(--texto-fuerte)' }}><Icono nombre="clientes" size={16} /> {p.cliente.nombre}</div>}
                    {p.notas && <div style={{ fontSize: 13, color: 'var(--texto-fuerte)' }}>{p.notas}</div>}
                  </span>
                </label>
              </div>
            ))}
          </div>
        )}

        {!cargando && prospectosHoy.length > 0 && (
          <div className="grid-gap-05">
            <strong className="t-tenue-13">Prospectos por contactar ({prospectosHoy.length})</strong>
            {prospectosHoy.map((p) => {
              const vencido = p.proximoContacto && new Date(p.proximoContacto).getTime() < new Date(new Date().toDateString()).getTime();
              return (
                <div
                  key={p.id}
                  onClick={() => onAbrirProspecto?.(p.id)}
                  style={{ border: 'none', boxShadow: 'var(--sombra-tarjeta)', padding: '0.75rem', borderRadius: 14, cursor: onAbrirProspecto ? 'pointer' : undefined }}
                >
                  <div className="fila-entre-centro" style={{ alignItems: 'flex-start', gap: 8 }}>
                    <strong><Icono nombre="objetivo" size={16} /> {p.nombre}</strong>
                    {vencido && <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--peligro)', whiteSpace: 'nowrap' }}>Atrasado</span>}
                  </div>
                  {p.motivoContacto && <div style={{ fontSize: 13, color: 'var(--texto-fuerte)' }}>→ {p.motivoContacto}</div>}
                  {p.ultimoContacto && <div className="t-tenue-12">Última nota: {p.ultimoContacto.texto.slice(0, 90)}</div>}
                  <div className="t-tenue-12">Toca para abrir su ficha, registrar el contacto y reagendar.</div>
                </div>
              );
            })}
          </div>
        )}

        {cargando ? (
          <p className="t-centro-tenue">Cargando...</p>
        ) : llamadas.length === 0 && pendientesHoy.length === 0 && prospectosHoy.length === 0 ? (
          <p className="t-centro-tenue">
            Nadie tiene hoy configurado como día de llamada. Puedes elegir los días de cada cliente en su
            ficha, dentro de Clientes.
          </p>
        ) : (
          <>
            {pendientes.length > 0 && (
              <div className="lista-tarjetas grid-gap-05">
                <strong className="t-tenue-13">Por llamar ({pendientes.length})</strong>
                {pendientes.map(tarjeta)}
              </div>
            )}

            {hechas.length > 0 && (
              <div className="lista-tarjetas grid-gap-05">
                <strong className="t-tenue-13">Ya llamados ({hechas.length})</strong>
                {hechas.map(tarjeta)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
