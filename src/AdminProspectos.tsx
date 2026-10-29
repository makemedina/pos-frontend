import { Icono } from './iconos';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  obtenerProspectos,
  obtenerProspecto,
  crearProspecto,
  actualizarProspecto,
  agregarNotaProspecto,
  eliminarNotaProspecto,
  convertirProspectoEnCliente,
  eliminarProspecto,
  ORIGENES_PROSPECTO,
  NIVELES_INTERES,
  TIPOS_NOTA_PROSPECTO,
  type ProspectoResumen,
  type ProspectoDetalle,
  type DatosProspectoForm,
  type EstadoProspecto,
} from './api';
import { formatoFecha, formatoFechaHora, haceDias, telefonoValido, MENSAJE_TELEFONO_INVALIDO } from './formato';

interface Props {
  onCerrar: () => void;
  esAdmin: boolean;
  usuarioId: string;
  // Para abrir directo la ficha de un prospecto (ej. desde "Llamadas de hoy").
  prospectoInicialId?: string | null;
}

const CARD = { border: 'none', boxShadow: 'var(--sombra-tarjeta)', padding: '0.75rem', borderRadius: 14 };

const ETIQUETA_ORIGEN = Object.fromEntries(ORIGENES_PROSPECTO.map((o) => [o.valor, o.etiqueta])) as Record<string, string>;
const ETIQUETA_TIPO_NOTA = Object.fromEntries(TIPOS_NOTA_PROSPECTO.map((t) => [t.valor, t.etiqueta])) as Record<string, string>;

const COLOR_INTERES: Record<string, { fondo: string; texto: string }> = {
  alto: { fondo: 'var(--exito-fondo)', texto: 'var(--exito-oscuro)' },
  medio: { fondo: 'var(--advertencia-fondo)', texto: 'var(--advertencia)' },
  bajo: { fondo: 'var(--fondo-gris)', texto: 'var(--ios-secondary-label)' },
};

// Atajos para agendar el siguiente contacto sin abrir el calendario.
const ATAJOS_FECHA = [
  { etiqueta: 'Mañana', dias: 1 },
  { etiqueta: '3 días', dias: 3 },
  { etiqueta: '1 semana', dias: 7 },
  { etiqueta: '2 semanas', dias: 14 },
  { etiqueta: '1 mes', dias: 30 },
];

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function enDias(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return formatDateInput(d);
}

function inicioDia(f: Date) {
  return new Date(f.getFullYear(), f.getMonth(), f.getDate()).getTime();
}

// Dias de calendario de hoy a la fecha agendada (negativo = ya se paso).
function diasParaContacto(fecha: string) {
  return Math.round((inicioDia(new Date(fecha)) - inicioDia(new Date())) / 86400000);
}

function textoProximoContacto(fecha: string) {
  const dias = diasParaContacto(fecha);
  if (dias < 0) return `Vencido ${dias === -1 ? 'desde ayer' : `hace ${-dias} días`}`;
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  return new Date(fecha).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
}

// Igual que en Llamadas de hoy: wa.me necesita la lada 52 delante del celular.
function linkWhatsapp(telefono: string, mensaje: string) {
  const soloDigitos = telefono.replace(/\D/g, '');
  const numero = soloDigitos.length === 10 ? `52${soloDigitos}` : soloDigitos;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

function Chip({ texto, fondo, color }: { texto: string; fondo: string; color: string }) {
  return (
    <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: fondo, color }}>
      {texto}
    </span>
  );
}

function Segmentado<T extends string>({ opciones, valor, onChange }: { opciones: { valor: T; etiqueta: string }[]; valor: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'inline-flex', flexWrap: 'wrap', background: 'var(--ios-gray-fill)', borderRadius: 10, padding: 3, gap: 2 }}>
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onChange(o.valor)}
          style={{
            padding: '7px 12px',
            borderRadius: 8,
            background: valor === o.valor ? 'var(--superficie)' : 'transparent',
            color: valor === o.valor ? 'var(--ios-label)' : 'var(--ios-secondary-label)',
            fontWeight: valor === o.valor ? 600 : 500,
            boxShadow: valor === o.valor ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
          }}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}

function AtajosFecha({ onElegir }: { onElegir: (fecha: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {ATAJOS_FECHA.map((a) => (
        <button
          key={a.dias}
          type="button"
          onClick={() => onElegir(enDias(a.dias))}
          style={{ padding: '5px 10px', fontSize: 12.5, borderRadius: 999, background: 'var(--fondo-gris)', color: 'var(--ios-label)', border: 'none' }}
        >
          {a.etiqueta}
        </button>
      ))}
    </div>
  );
}

const FORM_VACIO: DatosProspectoForm & { notaInicial: string } = {
  nombre: '',
  nombreContacto: '',
  telefono: '',
  colonia: '',
  ciudad: '',
  googleMapsUrl: '',
  origen: '',
  interes: '',
  nivelInteres: 'medio',
  proximoContacto: enDias(7),
  motivoContacto: '',
  notaInicial: '',
};

export function AdminProspectos({ onCerrar, esAdmin, usuarioId, prospectoInicialId }: Props) {
  const [estado, setEstado] = useState<EstadoProspecto>('activo');
  const [prospectos, setProspectos] = useState<ProspectoResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroOrigen, setFiltroOrigen] = useState('');

  const [mostrarAlta, setMostrarAlta] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  const [abiertoId, setAbiertoId] = useState<string | null>(prospectoInicialId ?? null);

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  async function cargar() {
    setCargando(true);
    try {
      setProspectos(await obtenerProspectos(estado));
    } catch (e) {
      setMensaje((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  async function guardarNuevo(e: FormEvent) {
    e.preventDefault();
    if (!form.nombre?.trim()) return setMensaje('Escribe el nombre del negocio o de la persona.');
    if (!form.origen) return setMensaje('Elige cómo llegó el prospecto.');
    if (form.telefono?.trim() && !telefonoValido(form.telefono)) return setMensaje(MENSAJE_TELEFONO_INVALIDO);
    setGuardando(true);
    try {
      const nuevo = await crearProspecto({ ...form, proximoContacto: form.proximoContacto || null });
      setForm({ ...FORM_VACIO, proximoContacto: enDias(7) });
      setMostrarAlta(false);
      setMensaje(`${nuevo.nombre} quedó registrado.`);
      if (estado === 'activo') cargar();
      else setEstado('activo');
    } catch (e) {
      setMensaje((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return prospectos.filter(
      (p) =>
        (!filtroOrigen || p.origen === filtroOrigen) &&
        (!q ||
          [p.nombre, p.nombreContacto, p.telefono, p.colonia, p.interes].some((v) => v?.toLowerCase().includes(q)))
    );
  }, [prospectos, busqueda, filtroOrigen]);

  if (abiertoId) {
    return (
      <FichaProspecto
        id={abiertoId}
        esAdmin={esAdmin}
        usuarioId={usuarioId}
        onVolver={() => {
          setAbiertoId(null);
          cargar();
        }}
      />
    );
  }

  const porContactar = filtrados.filter((p) => p.proximoContacto && diasParaContacto(p.proximoContacto) <= 0);
  const proximos = filtrados.filter((p) => p.proximoContacto && diasParaContacto(p.proximoContacto) > 0);
  const sinAgenda = filtrados.filter((p) => !p.proximoContacto);

  function tarjeta(p: ProspectoResumen) {
    const vencido = p.proximoContacto && diasParaContacto(p.proximoContacto) < 0;
    const interes = COLOR_INTERES[p.nivelInteres] ?? COLOR_INTERES.medio;
    return (
      <div key={p.id} style={{ ...CARD, cursor: 'pointer', display: 'grid', gap: 4 }} onClick={() => setAbiertoId(p.id)}>
        <div className="fila-entre-centro" style={{ alignItems: 'flex-start', gap: 8 }}>
          <div>
            <strong>{p.nombre}</strong>
            {(p.nombreContacto || p.colonia) && (
              <div className="t-tenue-13">{[p.nombreContacto, p.colonia].filter(Boolean).join(' · ')}</div>
            )}
          </div>
          {p.estado === 'activo' && p.proximoContacto && (
            <span style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', color: vencido ? 'var(--peligro)' : 'var(--acento)', textTransform: 'capitalize' }}>
              {textoProximoContacto(p.proximoContacto)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Chip texto={ETIQUETA_ORIGEN[p.origen] ?? p.origen} fondo="var(--acento-fondo)" color="var(--acento)" />
          {p.estado === 'activo' && <Chip texto={`Interés ${p.nivelInteres}`} fondo={interes.fondo} color={interes.texto} />}
          {p.estado === 'convertido' && p.cliente && <Chip texto={`Cliente: ${p.cliente.nombre}`} fondo="var(--exito-fondo)" color="var(--exito-oscuro)" />}
        </div>
        {p.estado === 'activo' && p.motivoContacto && <div style={{ fontSize: 13 }}>→ {p.motivoContacto}</div>}
        {p.estado === 'descartado' && p.motivoDescarte && <div style={{ fontSize: 13 }}>Motivo: {p.motivoDescarte}</div>}
        <div className="t-tenue-12">
          {p.ultimoContacto
            ? `Último contacto: ${ETIQUETA_TIPO_NOTA[p.ultimoContacto.tipo] ?? p.ultimoContacto.tipo} ${haceDias(p.ultimoContacto.creadoEn)} — ${p.ultimoContacto.texto.slice(0, 90)}${p.ultimoContacto.texto.length > 90 ? '…' : ''}`
            : `Registrado ${haceDias(p.creadoEn)} por ${p.registradoPorNombre}`}
        </div>
      </div>
    );
  }

  function grupo(titulo: string, lista: ProspectoResumen[]) {
    if (lista.length === 0) return null;
    return (
      <div className="lista-tarjetas grid-gap-05">
        <strong className="t-tenue-13">{titulo} ({lista.length})</strong>
        {lista.map(tarjeta)}
      </div>
    );
  }

  const campo = (k: keyof typeof form) => ({
    value: (form[k] as string) ?? '',
    onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value })),
  });

  return (
    <div className="pantalla-centrada pantalla-arriba">
      <div className="contenido-pantalla" style={{ width: '100%', maxWidth: 680, display: 'grid', gap: '1rem' }}>
        <div className="fila-entre-centro">
          <h2 style={{ margin: 0 }}>Prospectos</h2>
          <div className="fila-gap-8">
            {!mostrarAlta && <button onClick={() => setMostrarAlta(true)}>+ Nuevo prospecto</button>}
            <button onClick={onCerrar}>Cerrar</button>
          </div>
        </div>

        <p className="t-tenue-13-m0">
          Negocios que visitaste o que escribieron por redes y todavía no compran. Lleva la bitácora de cada
          contacto y agenda cuándo volver a buscarlos — los de hoy también salen en Llamadas de hoy.
        </p>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {mostrarAlta && (
          <form className="tarjeta-grid-05" onSubmit={guardarNuevo}>
            <strong>Nuevo prospecto</strong>
            <input placeholder="Nombre del negocio o persona *" {...campo('nombre')} autoFocus />
            <input placeholder="Nombre del contacto (opcional)" {...campo('nombreContacto')} />
            <input placeholder="Teléfono / WhatsApp (opcional)" inputMode="tel" {...campo('telefono')} />
            <select {...campo('origen')}>
              <option value="">¿Cómo llegó? *</option>
              {ORIGENES_PROSPECTO.map((o) => (
                <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
              ))}
            </select>
            <div className="fila-gap-8">
              <input placeholder="Colonia" {...campo('colonia')} style={{ flex: 1 }} />
              <input placeholder="Ciudad" {...campo('ciudad')} style={{ flex: 1 }} />
            </div>
            <input placeholder="Link de Google Maps (opcional)" {...campo('googleMapsUrl')} />
            <input placeholder="¿Qué le interesa / qué compra hoy y a quién?" {...campo('interes')} />
            <label className="etiqueta">Nivel de interés</label>
            <Segmentado
              opciones={NIVELES_INTERES.map((n) => ({ valor: n.valor as string, etiqueta: n.etiqueta }))}
              valor={form.nivelInteres ?? 'medio'}
              onChange={(v) => setForm((f) => ({ ...f, nivelInteres: v }))}
            />
            <textarea rows={3} placeholder="¿Qué platicaron? (queda como primera nota de la bitácora)" {...campo('notaInicial')} />
            <label className="etiqueta">Volver a contactar</label>
            <AtajosFecha onElegir={(fecha) => setForm((f) => ({ ...f, proximoContacto: fecha }))} />
            <input type="date" {...campo('proximoContacto')} />
            <input placeholder="¿Para qué? (ej. ofrecerle arrachera cuando llegue)" {...campo('motivoContacto')} />
            <div className="fila-gap-8">
              <button type="submit" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar prospecto'}</button>
              <button type="button" onClick={() => setMostrarAlta(false)}>Cancelar</button>
            </div>
          </form>
        )}

        <Segmentado
          opciones={[
            { valor: 'activo' as EstadoProspecto, etiqueta: 'En seguimiento' },
            { valor: 'convertido' as EstadoProspecto, etiqueta: 'Convertidos' },
            { valor: 'descartado' as EstadoProspecto, etiqueta: 'Descartados' },
          ]}
          valor={estado}
          onChange={setEstado}
        />

        <div className="fila-gap-8" style={{ flexWrap: 'wrap' }}>
          <input
            className="buscador"
            placeholder="Buscar por nombre, teléfono, colonia o interés"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ flex: '1 1 240px' }}
          />
          <select value={filtroOrigen} onChange={(e) => setFiltroOrigen(e.target.value)}>
            <option value="">Todos los orígenes</option>
            {ORIGENES_PROSPECTO.map((o) => (
              <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
            ))}
          </select>
        </div>

        {cargando ? (
          <p className="t-centro-tenue">Cargando...</p>
        ) : filtrados.length === 0 ? (
          <p className="t-centro-tenue">
            {prospectos.length === 0
              ? estado === 'activo'
                ? 'Todavía no hay prospectos. Registra el primero con "+ Nuevo prospecto".'
                : 'No hay prospectos aquí todavía.'
              : 'Ningún prospecto coincide con la búsqueda.'}
          </p>
        ) : estado === 'activo' ? (
          <>
            {grupo('Por contactar hoy', porContactar)}
            {grupo('Próximos', proximos)}
            {grupo('Sin seguimiento agendado', sinAgenda)}
          </>
        ) : (
          grupo(estado === 'convertido' ? 'Ya son clientes' : 'Descartados', filtrados)
        )}
      </div>
    </div>
  );
}

// ---------- FICHA DE UN PROSPECTO ----------

function FichaProspecto({ id, esAdmin, usuarioId, onVolver }: { id: string; esAdmin: boolean; usuarioId: string; onVolver: () => void }) {
  const [p, setP] = useState<ProspectoDetalle | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Registrar contacto
  const [tipoNota, setTipoNota] = useState('llamada');
  const [textoNota, setTextoNota] = useState('');
  const [reagendar, setReagendar] = useState('');
  const [motivoReagendar, setMotivoReagendar] = useState('');

  // Siguiente contacto (editar sin registrar contacto)
  const [fechaAgenda, setFechaAgenda] = useState('');
  const [motivoAgenda, setMotivoAgenda] = useState('');

  const [editando, setEditando] = useState(false);
  const [edit, setEdit] = useState<DatosProspectoForm>({});

  const [accion, setAccion] = useState<null | 'convertir' | 'descartar'>(null);
  const [telefonoConvertir, setTelefonoConvertir] = useState('');
  const [motivoDescarte, setMotivoDescarte] = useState('');

  useEffect(() => {
    obtenerProspecto(id)
      .then(aplicar)
      .catch((e) => setMensaje((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function aplicar(d: ProspectoDetalle) {
    setP(d);
    setFechaAgenda(d.proximoContacto ? formatDateInput(new Date(d.proximoContacto)) : '');
    setMotivoAgenda(d.motivoContacto ?? '');
    setTelefonoConvertir(d.telefono ?? '');
  }

  async function ejecutar(fn: () => Promise<ProspectoDetalle | void>, exito?: string) {
    setOcupado(true);
    try {
      const r = await fn();
      if (r) aplicar(r);
      if (exito) setMensaje(exito);
      return true;
    } catch (e) {
      setMensaje((e as Error).message);
      return false;
    } finally {
      setOcupado(false);
    }
  }

  if (!p) {
    return (
      <div className="pantalla-centrada pantalla-arriba">
        <div className="contenido-pantalla" style={{ width: '100%', maxWidth: 680, display: 'grid', gap: '1rem' }}>
          <div className="fila-entre-centro">
            <h2 style={{ margin: 0 }}>Prospecto</h2>
            <button onClick={onVolver}>← Prospectos</button>
          </div>
          <p className="t-centro-tenue">{mensaje ?? 'Cargando...'}</p>
        </div>
      </div>
    );
  }

  const activo = p.estado === 'activo';

  async function registrarContacto(e: FormEvent) {
    e.preventDefault();
    if (!textoNota.trim()) return;
    const ok = await ejecutar(
      () =>
        agregarNotaProspecto(id, {
          tipo: tipoNota,
          texto: textoNota,
          // Solo se reagenda si se eligio fecha; si no, se respeta la que ya tenia.
          ...(reagendar ? { proximoContacto: reagendar, motivoContacto: motivoReagendar } : {}),
        }),
      reagendar ? 'Contacto registrado y siguiente seguimiento agendado.' : 'Contacto registrado.'
    );
    if (ok) {
      setTextoNota('');
      setReagendar('');
      setMotivoReagendar('');
    }
  }

  function abrirEdicion() {
    setEdit({
      nombre: p!.nombre,
      nombreContacto: p!.nombreContacto ?? '',
      telefono: p!.telefono ?? '',
      colonia: p!.colonia ?? '',
      ciudad: p!.ciudad ?? '',
      googleMapsUrl: p!.googleMapsUrl ?? '',
      origen: p!.origen,
      interes: p!.interes ?? '',
      nivelInteres: p!.nivelInteres,
    });
    setEditando(true);
  }

  async function guardarEdicion() {
    if (edit.telefono?.trim() && !telefonoValido(edit.telefono)) return setMensaje(MENSAJE_TELEFONO_INVALIDO);
    if (await ejecutar(() => actualizarProspecto(id, edit), 'Datos guardados.')) setEditando(false);
  }

  async function convertir() {
    if (!telefonoValido(telefonoConvertir)) return setMensaje(MENSAJE_TELEFONO_INVALIDO);
    setOcupado(true);
    try {
      const r = await convertirProspectoEnCliente(id, telefonoConvertir);
      setAccion(null);
      aplicar(await obtenerProspecto(id));
      setMensaje(
        r.yaExistia
          ? `Ya existía un cliente con ese teléfono (${r.clienteNombre}); se ligó a él y se le copiaron las notas.`
          : `¡Listo! ${r.clienteNombre} ya está en Clientes, con su bitácora copiada a sus notas.`
      );
    } catch (e) {
      setMensaje((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function borrarNota(notaId: string) {
    if (!confirm('¿Borrar esta nota de la bitácora?')) return;
    await ejecutar(async () => {
      await eliminarNotaProspecto(notaId);
      return obtenerProspecto(id);
    });
  }

  async function borrarProspecto() {
    if (!confirm(`¿Eliminar a ${p!.nombre} y toda su bitácora? Esto no se puede deshacer.`)) return;
    if (await ejecutar(() => eliminarProspecto(id))) onVolver();
  }

  const interes = COLOR_INTERES[p.nivelInteres] ?? COLOR_INTERES.medio;
  const setE = (k: keyof DatosProspectoForm) => ({
    value: (edit[k] as string) ?? '',
    onChange: (e: { target: { value: string } }) => setEdit((d) => ({ ...d, [k]: e.target.value })),
  });

  return (
    <div className="pantalla-centrada pantalla-arriba">
      <div className="contenido-pantalla" style={{ width: '100%', maxWidth: 680, display: 'grid', gap: '1rem' }}>
        <div className="fila-entre-centro" style={{ alignItems: 'flex-start', gap: 8 }}>
          <div>
            <h2 style={{ margin: 0 }}>{p.nombre}</h2>
            <div className="t-tenue-13">
              {[p.nombreContacto, p.telefono, [p.colonia, p.ciudad].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button onClick={onVolver}>← Prospectos</button>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Chip texto={ETIQUETA_ORIGEN[p.origen] ?? p.origen} fondo="var(--acento-fondo)" color="var(--acento)" />
          <Chip texto={`Interés ${p.nivelInteres}`} fondo={interes.fondo} color={interes.texto} />
          {p.estado === 'convertido' && <Chip texto="Ya es cliente" fondo="var(--exito-fondo)" color="var(--exito-oscuro)" />}
          {p.estado === 'descartado' && <Chip texto="Descartado" fondo="var(--peligro-fondo)" color="var(--peligro)" />}
        </div>

        {p.interes && <div style={{ fontSize: 14 }}><strong>Le interesa:</strong> {p.interes}</div>}
        {p.estado === 'descartado' && p.motivoDescarte && <div style={{ fontSize: 14 }}><strong>Motivo de descarte:</strong> {p.motivoDescarte}</div>}
        {p.estado === 'convertido' && p.cliente && (
          <div style={{ fontSize: 14 }}>
            Se convirtió en cliente <strong>{p.cliente.nombre}</strong>
            {p.convertidoEn && ` el ${formatoFecha(p.convertidoEn)}`}. Búscalo en Clientes para venderle.
          </div>
        )}

        {(p.telefono || p.googleMapsUrl) && (
          <div className="fila-gap-8">
            {p.telefono && (
              <a href={`tel:${p.telefono}`} style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 10, background: 'var(--fondo-gris)', color: 'var(--ios-label)', textDecoration: 'none', fontSize: 14 }}>
                <Icono nombre="telefono" size={16} /> Llamar
              </a>
            )}
            {p.telefono && (
              <a
                href={linkWhatsapp(p.telefono, `Hola${p.nombreContacto ? ` ${p.nombreContacto}` : ''}, te habla Mr Carnes.`)}
                target="_blank"
                rel="noreferrer"
                style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 10, background: 'var(--exito-fondo)', color: 'var(--exito-oscuro)', textDecoration: 'none', fontSize: 14 }}
              >
                💬 WhatsApp
              </a>
            )}
            {p.googleMapsUrl && (
              <a href={p.googleMapsUrl} target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 10, background: 'var(--fondo-gris)', color: 'var(--ios-label)', textDecoration: 'none', fontSize: 14 }}>
                📍 Mapa
              </a>
            )}
          </div>
        )}

        {activo && (
          <div className="tarjeta-grid-05">
            <strong><Icono nombre="calendario" size={16} /> Siguiente contacto</strong>
            {p.proximoContacto ? (
              <div style={{ fontSize: 14, textTransform: 'none' }}>
                <span style={{ fontWeight: 600, color: diasParaContacto(p.proximoContacto) < 0 ? 'var(--peligro)' : 'var(--acento)', textTransform: 'capitalize' }}>
                  {textoProximoContacto(p.proximoContacto)}
                </span>
                {' '}({formatoFecha(p.proximoContacto)}){p.motivoContacto && ` — ${p.motivoContacto}`}
              </div>
            ) : (
              <div className="t-tenue-13">Sin seguimiento agendado.</div>
            )}
            <AtajosFecha onElegir={setFechaAgenda} />
            <input type="date" value={fechaAgenda} onChange={(e) => setFechaAgenda(e.target.value)} />
            <input placeholder="¿Para qué? (ej. ofrecerle costilla)" value={motivoAgenda} onChange={(e) => setMotivoAgenda(e.target.value)} />
            <div className="fila-gap-8">
              <button
                disabled={ocupado || !fechaAgenda}
                onClick={() => ejecutar(() => actualizarProspecto(id, { proximoContacto: fechaAgenda, motivoContacto: motivoAgenda }), 'Seguimiento agendado.')}
              >
                Agendar
              </button>
              {p.proximoContacto && (
                <button
                  disabled={ocupado}
                  onClick={() => ejecutar(() => actualizarProspecto(id, { proximoContacto: null, motivoContacto: null }), 'Seguimiento quitado.')}
                >
                  Quitar
                </button>
              )}
            </div>
          </div>
        )}

        <form className="tarjeta-grid-05" onSubmit={registrarContacto}>
          <strong>Registrar contacto</strong>
          <Segmentado
            opciones={TIPOS_NOTA_PROSPECTO.map((t) => ({ valor: t.valor as string, etiqueta: t.etiqueta }))}
            valor={tipoNota}
            onChange={setTipoNota}
          />
          <textarea
            rows={3}
            placeholder="¿Qué platicaron? (ej. compra con otro proveedor, le mandé precios de pierna, que le hable el viernes...)"
            value={textoNota}
            onChange={(e) => setTextoNota(e.target.value)}
          />
          {activo && (
            <>
              <label className="etiqueta">Volver a contactar (opcional)</label>
              <AtajosFecha onElegir={setReagendar} />
              <input type="date" value={reagendar} onChange={(e) => setReagendar(e.target.value)} />
              {reagendar && (
                <input placeholder="¿Para qué?" value={motivoReagendar} onChange={(e) => setMotivoReagendar(e.target.value)} />
              )}
            </>
          )}
          <button type="submit" className="boton-primario" disabled={ocupado || !textoNota.trim()}>
            {ocupado ? 'Guardando...' : 'Guardar en bitácora'}
          </button>
        </form>

        <div className="grid-gap-05">
          <strong className="t-tenue-13">Bitácora ({p.notas.length})</strong>
          {p.notas.length === 0 ? (
            <p className="t-tenue">Todavía no hay contactos registrados.</p>
          ) : (
            p.notas.map((n) => (
              <div key={n.id} className="tarjeta-sombra">
                <div style={{ marginBottom: 4 }}>
                  <Chip texto={ETIQUETA_TIPO_NOTA[n.tipo] ?? n.tipo} fondo="var(--fondo-gris)" color="var(--ios-label)" />
                </div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{n.texto}</div>
                <div className="fila-entre-centro" style={{ marginTop: 6 }}>
                  <small className="t-tenue">
                    {formatoFechaHora(n.creadoEn)} · {n.autorNombre}
                  </small>
                  {(n.autorId === usuarioId || esAdmin) && (
                    <button
                      onClick={() => borrarNota(n.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--peligro)', fontSize: 13, padding: 0, cursor: 'pointer' }}
                    >
                      Borrar
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {editando ? (
          <div className="tarjeta-grid-05">
            <strong>Editar datos</strong>
            <input placeholder="Nombre del negocio o persona" {...setE('nombre')} />
            <input placeholder="Nombre del contacto" {...setE('nombreContacto')} />
            <input placeholder="Teléfono / WhatsApp" inputMode="tel" {...setE('telefono')} />
            <select {...setE('origen')}>
              {ORIGENES_PROSPECTO.map((o) => (
                <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
              ))}
            </select>
            <div className="fila-gap-8">
              <input placeholder="Colonia" {...setE('colonia')} style={{ flex: 1 }} />
              <input placeholder="Ciudad" {...setE('ciudad')} style={{ flex: 1 }} />
            </div>
            <input placeholder="Link de Google Maps" {...setE('googleMapsUrl')} />
            <input placeholder="¿Qué le interesa?" {...setE('interes')} />
            <label className="etiqueta">Nivel de interés</label>
            <Segmentado
              opciones={NIVELES_INTERES.map((n) => ({ valor: n.valor as string, etiqueta: n.etiqueta }))}
              valor={edit.nivelInteres ?? 'medio'}
              onChange={(v) => setEdit((d) => ({ ...d, nivelInteres: v }))}
            />
            <div className="fila-gap-8">
              <button disabled={ocupado} onClick={guardarEdicion}>Guardar</button>
              <button onClick={() => setEditando(false)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <button className="boton-secundario" onClick={abrirEdicion}><Icono nombre="editar" size={16} /> Editar datos</button>
        )}

        {accion === 'convertir' && (
          <div className="tarjeta-grid-05">
            <strong>Convertir en cliente</strong>
            <p className="t-tenue-13-m0">
              Se da de alta en Clientes con sus datos y se le copia la bitácora a sus notas. Si ya hay un cliente con ese
              teléfono, se liga a ese en vez de duplicarlo.
            </p>
            <input placeholder="Teléfono / WhatsApp (10 dígitos)" inputMode="tel" value={telefonoConvertir} onChange={(e) => setTelefonoConvertir(e.target.value)} />
            <div className="fila-gap-8">
              <button disabled={ocupado} onClick={convertir}>{ocupado ? 'Convirtiendo...' : 'Convertir'}</button>
              <button onClick={() => setAccion(null)}>Cancelar</button>
            </div>
          </div>
        )}

        {accion === 'descartar' && (
          <div className="tarjeta-grid-05">
            <strong>Descartar prospecto</strong>
            <input placeholder="Motivo (ej. no le interesa, cerró el negocio...)" value={motivoDescarte} onChange={(e) => setMotivoDescarte(e.target.value)} />
            <div className="fila-gap-8">
              <button
                disabled={ocupado}
                onClick={async () => {
                  if (await ejecutar(() => actualizarProspecto(id, { estado: 'descartado', motivoDescarte, proximoContacto: null, motivoContacto: null }), 'Prospecto descartado.')) setAccion(null);
                }}
              >
                Descartar
              </button>
              <button onClick={() => setAccion(null)}>Cancelar</button>
            </div>
          </div>
        )}

        {!accion && (
          <div className="fila-gap-8" style={{ flexWrap: 'wrap' }}>
            {activo && (
              <button className="boton-primario" style={{ flex: '1 1 200px' }} onClick={() => setAccion('convertir')}>
                <Icono nombre="clientes" size={16} /> Convertir en cliente
              </button>
            )}
            {activo && <button style={{ flex: '1 1 140px' }} onClick={() => setAccion('descartar')}>Descartar</button>}
            {p.estado === 'descartado' && (
              <button style={{ flex: '1 1 140px' }} disabled={ocupado} onClick={() => ejecutar(() => actualizarProspecto(id, { estado: 'activo', proximoContacto: enDias(1) }), 'Prospecto reactivado; quedó agendado para mañana.')}>
                Reactivar
              </button>
            )}
            {esAdmin && (
              <button style={{ flex: '1 1 140px', color: 'var(--peligro)' }} disabled={ocupado} onClick={borrarProspecto}>
                <Icono nombre="papelera" size={16} /> Eliminar
              </button>
            )}
          </div>
        )}

        <small className="t-tenue">Registrado el {formatoFecha(p.creadoEn)} por {p.registradoPorNombre}.</small>
      </div>
    </div>
  );
}
