import { Icono } from './iconos';
import { useEffect, useState } from 'react';
import {
  listarCategoriasGasto,
  crearCategoriaGasto,
  actualizarCategoriaGasto,
  listarAutomoviles,
  crearAutomovil,
  actualizarAutomovil,
  type CategoriaGasto,
  type Automovil,
  type UsoAutomovil,
} from './api';

const TEXTO_USO_AUTOMOVIL: Record<UsoAutomovil, string> = {
  no: 'No pide automóvil',
  opcional: 'Automóvil opcional',
  obligatorio: 'Automóvil obligatorio',
};

const SEPARADOR = { padding: '8px 0', borderTop: '1px solid var(--ios-separator)' } as const;
const BOTON_CHICO = { width: 'auto', marginTop: 0 } as const;
import { DEPARTAMENTOS, ESTILO_DEPARTAMENTO } from './categoriasGasto';

interface Props {
  onCerrar: () => void;
}

// Administrar las subcategorias de gasto (solo administrador): agregar,
// renombrar, cambiar de categoria y ocultar/mostrar. No se borran porque
// los gastos ya registrados apuntan a ellas -- ocultarla solo hace que ya
// no se ofrezca al registrar un gasto nuevo.
export function AdminCategoriasGasto({ onCerrar }: Props) {
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editDepartamento, setEditDepartamento] = useState('');
  const [editUso, setEditUso] = useState<UsoAutomovil>('no');

  const [automoviles, setAutomoviles] = useState<Automovil[]>([]);
  const [editandoAutoId, setEditandoAutoId] = useState<string | null>(null);
  const [agregandoAuto, setAgregandoAuto] = useState(false);
  const [autoNombre, setAutoNombre] = useState('');
  const [autoPlacas, setAutoPlacas] = useState('');

  // Departamento en el que se esta agregando una subcategoria nueva.
  const [agregandoEn, setAgregandoEn] = useState<string | null>(null);
  const [nombreNueva, setNombreNueva] = useState('');

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      const [cats, autos] = await Promise.all([listarCategoriasGasto(), listarAutomoviles()]);
      setCategorias(cats);
      setAutomoviles(autos);
    } catch {
      setMensaje('No se pudieron cargar las subcategorías y automóviles.');
    } finally {
      setCargando(false);
    }
  }

  function reemplazar(actualizada: CategoriaGasto) {
    setCategorias((prev) => prev.map((c) => (c.id === actualizada.id ? actualizada : c)));
  }

  function iniciarEdicion(c: CategoriaGasto) {
    setAgregandoEn(null);
    setEditandoId(c.id);
    setEditNombre(c.nombre);
    setEditDepartamento(c.departamento);
    setEditUso(c.usoAutomovil ?? 'no');
  }

  async function guardarEdicion(id: string) {
    if (!editNombre.trim()) {
      setMensaje('El nombre no puede ir vacío.');
      return;
    }
    setGuardando(true);
    try {
      reemplazar(
        await actualizarCategoriaGasto(id, { nombre: editNombre.trim(), departamento: editDepartamento, usoAutomovil: editUso })
      );
      setEditandoId(null);
      setMensaje('Subcategoría actualizada.');
    } catch (err: any) {
      setMensaje(err?.error || 'No se pudo actualizar la subcategoría.');
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarActiva(c: CategoriaGasto) {
    const activa = c.activa === false;
    setGuardando(true);
    try {
      reemplazar(await actualizarCategoriaGasto(c.id, { activa }));
      setMensaje(activa ? `"${c.nombre}" vuelve a aparecer al registrar gastos.` : `"${c.nombre}" ya no aparecerá al registrar gastos.`);
    } catch (err: any) {
      setMensaje(err?.error || 'No se pudo cambiar la subcategoría.');
    } finally {
      setGuardando(false);
    }
  }

  async function agregar(departamento: string) {
    if (!nombreNueva.trim()) return;
    setGuardando(true);
    try {
      const nueva = await crearCategoriaGasto(nombreNueva.trim(), departamento);
      setCategorias((prev) => [...prev, { ...nueva, activa: true, _count: { gastos: 0 } }]);
      setNombreNueva('');
      setAgregandoEn(null);
      setMensaje(`Subcategoría "${nueva.nombre}" agregada a ${departamento}.`);
    } catch (err: any) {
      setMensaje(err?.error || 'No se pudo agregar la subcategoría.');
    } finally {
      setGuardando(false);
    }
  }

  // ---------- Automoviles ----------

  function empezarAgregarAuto() {
    setEditandoAutoId(null);
    setAutoNombre('');
    setAutoPlacas('');
    setAgregandoAuto(true);
  }

  function iniciarEdicionAuto(a: Automovil) {
    setAgregandoAuto(false);
    setEditandoAutoId(a.id);
    setAutoNombre(a.nombre);
    setAutoPlacas(a.placas ?? '');
  }

  async function guardarAuto() {
    if (!autoNombre.trim()) {
      setMensaje('Escribe el nombre del automóvil.');
      return;
    }
    setGuardando(true);
    try {
      if (editandoAutoId) {
        const actualizado = await actualizarAutomovil(editandoAutoId, { nombre: autoNombre.trim(), placas: autoPlacas.trim() });
        setAutomoviles((prev) => prev.map((a) => (a.id === actualizado.id ? actualizado : a)));
        setMensaje('Automóvil actualizado.');
      } else {
        const nuevo = await crearAutomovil(autoNombre.trim(), autoPlacas.trim());
        setAutomoviles((prev) => [...prev, nuevo]);
        setMensaje(`Automóvil "${nuevo.nombre}" agregado.`);
      }
      setEditandoAutoId(null);
      setAgregandoAuto(false);
    } catch (err: any) {
      setMensaje(err?.error || 'No se pudo guardar el automóvil.');
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarActivoAuto(a: Automovil) {
    setGuardando(true);
    try {
      const actualizado = await actualizarAutomovil(a.id, { activo: !a.activo });
      setAutomoviles((prev) => prev.map((x) => (x.id === actualizado.id ? actualizado : x)));
      setMensaje(actualizado.activo ? `"${a.nombre}" vuelve a aparecer al registrar gastos.` : `"${a.nombre}" ya no aparecerá al registrar gastos.`);
    } catch (err: any) {
      setMensaje(err?.error || 'No se pudo cambiar el automóvil.');
    } finally {
      setGuardando(false);
    }
  }

  const formularioAuto = (
    <div className="grid-gap-8" style={SEPARADOR}>
      <input autoFocus value={autoNombre} onChange={(e) => setAutoNombre(e.target.value)} placeholder="Nombre (ej. Nissan NP300 blanca)" />
      <input value={autoPlacas} onChange={(e) => setAutoPlacas(e.target.value)} placeholder="Placas (opcional)" />
      <div className="fila-gap-8">
        <button type="button" disabled={guardando} onClick={guardarAuto}>{editandoAutoId ? 'Guardar' : 'Agregar'}</button>
        <button
          type="button"
          onClick={() => {
            setEditandoAutoId(null);
            setAgregandoAuto(false);
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );

  const automovilesOrdenados = [...automoviles].sort(
    (a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre)
  );

  // Las que tengan un departamento fuera de los 4 (datos viejos) se
  // muestran al final para poder moverlas a una categoria valida.
  const otros = Array.from(new Set(categorias.map((c) => c.departamento))).filter((d) => !DEPARTAMENTOS.includes(d));
  const grupos = [...DEPARTAMENTOS, ...otros];

  return (
    <div className="pantalla-centrada pantalla-arriba">
      <div className="contenido-pantalla contenido-760">
        <div className="fila-entre-centro">
          <h2>Categorías y automóviles</h2>
          <button onClick={onCerrar}>Cerrar</button>
        </div>

        <p className="t-tenue">
          Las 4 categorías son fijas. Aquí puedes agregar, renombrar o mover subcategorías, y dar de alta los
          automóviles. Lo que ya no uses se oculta en vez de borrarse, porque los gastos registrados lo siguen usando.
        </p>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {cargando && <p className="t-tenue">Cargando...</p>}

        {!cargando &&
          grupos.map((departamento) => {
            const estilo = ESTILO_DEPARTAMENTO[departamento];
            const lista = categorias
              .filter((c) => c.departamento === departamento)
              .sort((a, b) => Number(a.activa === false) - Number(b.activa === false) || a.nombre.localeCompare(b.nombre));
            return (
              <div key={departamento} className="tarjeta-grid-075">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="icono-menu" style={{ background: estilo?.color ?? '#94a3b8', width: 36, height: 36, minWidth: 36, borderRadius: 10 }}>
                    <Icono nombre={estilo?.icono ?? 'etiqueta'} size={18} />
                  </div>
                  <h3 style={{ margin: 0 }}>
                    {departamento}
                    {!estilo && <small className="t-tenue"> (categoría no válida: mueve estas subcategorías)</small>}
                  </h3>
                </div>

                {lista.length === 0 && <p className="t-tenue">Sin subcategorías.</p>}

                {lista.map((c) =>
                  editandoId === c.id ? (
                    <div key={c.id} className="grid-gap-8" style={{ padding: '8px 0', borderTop: '1px solid var(--ios-separator)' }}>
                      <input autoFocus value={editNombre} onChange={(e) => setEditNombre(e.target.value)} placeholder="Nombre de la subcategoría" />
                      <select value={editDepartamento} onChange={(e) => setEditDepartamento(e.target.value)}>
                        {DEPARTAMENTOS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                        {!DEPARTAMENTOS.includes(editDepartamento) && <option value={editDepartamento}>{editDepartamento}</option>}
                      </select>
                      <label className="etiqueta">¿Pedir automóvil al registrar un gasto aquí?</label>
                      <select value={editUso} onChange={(e) => setEditUso(e.target.value as UsoAutomovil)}>
                        <option value="no">No</option>
                        <option value="opcional">Opcional (se puede dejar sin automóvil)</option>
                        <option value="obligatorio">Obligatorio</option>
                      </select>
                      <div className="fila-gap-8">
                        <button type="button" disabled={guardando} onClick={() => guardarEdicion(c.id)}>Guardar</button>
                        <button type="button" onClick={() => setEditandoId(null)}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 0',
                        borderTop: '1px solid var(--ios-separator)',
                        opacity: c.activa === false ? 0.55 : 1,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>
                          {c.nombre}
                          {c.activa === false && <small className="t-tenue"> · oculta</small>}
                        </div>
                        <div className="t-tenue-12">
                          {c._count?.gastos ?? 0} {(c._count?.gastos ?? 0) === 1 ? 'gasto' : 'gastos'}
                          {c.usoAutomovil && c.usoAutomovil !== 'no' && ` · ${TEXTO_USO_AUTOMOVIL[c.usoAutomovil]}`}
                        </div>
                      </div>
                      <button type="button" className="boton-secundario" style={{ width: 'auto', marginTop: 0 }} onClick={() => iniciarEdicion(c)} aria-label={`Editar ${c.nombre}`}>
                        <Icono nombre="editar" size={16} />
                      </button>
                      <button type="button" className="boton-secundario" style={{ width: 'auto', marginTop: 0 }} disabled={guardando} onClick={() => cambiarActiva(c)}>
                        {c.activa === false ? 'Mostrar' : 'Ocultar'}
                      </button>
                    </div>
                  )
                )}

                {estilo &&
                  (agregandoEn === departamento ? (
                    <div className="grid-gap-8">
                      <input
                        autoFocus
                        value={nombreNueva}
                        onChange={(e) => setNombreNueva(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && agregar(departamento)}
                        placeholder={`Nueva subcategoría de ${departamento}`}
                      />
                      <div className="fila-gap-8">
                        <button type="button" disabled={guardando || !nombreNueva.trim()} onClick={() => agregar(departamento)}>Agregar</button>
                        <button type="button" onClick={() => setAgregandoEn(null)}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="boton-secundario w-100-mt-0"
                      onClick={() => {
                        setEditandoId(null);
                        setNombreNueva('');
                        setAgregandoEn(departamento);
                      }}
                    >
                      + Nueva subcategoría
                    </button>
                  ))}
              </div>
            );
          })}

        {!cargando && (
          <div className="tarjeta-grid-075">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="icono-menu" style={{ background: '#5b6b9a', width: 36, height: 36, minWidth: 36, borderRadius: 10 }}>
                <Icono nombre="etiqueta" size={18} />
              </div>
              <h3 style={{ margin: 0 }}>Automóviles</h3>
            </div>
            <p className="t-tenue-12" style={{ margin: 0 }}>
              Se eligen al registrar gastos en las subcategorías que piden automóvil (ej. Transporte y combustible,
              Mantenimiento y reparaciones).
            </p>

            {automovilesOrdenados.length === 0 && !agregandoAuto && <p className="t-tenue">Todavía no hay automóviles.</p>}

            {automovilesOrdenados.map((a) =>
              editandoAutoId === a.id ? (
                <div key={a.id}>{formularioAuto}</div>
              ) : (
                <div key={a.id} style={{ ...SEPARADOR, display: 'flex', alignItems: 'center', gap: 8, opacity: a.activo ? 1 : 0.55 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>
                      {a.nombre}
                      {!a.activo && <small className="t-tenue"> · oculto</small>}
                    </div>
                    <div className="t-tenue-12">
                      {a.placas ? `Placas ${a.placas} · ` : ''}
                      {a._count?.gastos ?? 0} {(a._count?.gastos ?? 0) === 1 ? 'gasto' : 'gastos'}
                    </div>
                  </div>
                  <button type="button" className="boton-secundario" style={BOTON_CHICO} onClick={() => iniciarEdicionAuto(a)} aria-label={`Editar ${a.nombre}`}>
                    <Icono nombre="editar" size={16} />
                  </button>
                  <button type="button" className="boton-secundario" style={BOTON_CHICO} disabled={guardando} onClick={() => cambiarActivoAuto(a)}>
                    {a.activo ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              )
            )}

            {agregandoAuto ? (
              formularioAuto
            ) : (
              <button type="button" className="boton-secundario w-100-mt-0" onClick={empezarAgregarAuto}>
                + Nuevo automóvil
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
