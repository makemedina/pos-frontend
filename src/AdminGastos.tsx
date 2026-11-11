import { Icono, type NombreIcono } from './iconos';
import { useEffect, useState } from 'react';
import { formatoMoneda, formatoFecha, formatoFechaHora } from './formato';
import {
  headerAuth,
  API_URL,
  buscarProveedores,
  crearProveedorRapido,
  obtenerGastos,
  editarGasto,
  listarAutomoviles,
  nombreAutomovil,
  type Automovil,
  type Proveedor,
  type CategoriaGasto,
  type GastoHistorial,
} from './api';
import { exportarAExcel, numeroSemana } from './exportarExcel';
import { DEPARTAMENTOS, ESTILO_DEPARTAMENTO } from './categoriasGasto';

type Gasto = GastoHistorial;

interface Props {
  onCerrar: () => void;
  esAdmin: boolean;
  onAbrirCategorias?: () => void;
}

const METODOS_PAGO: { valor: string; titulo: string; descripcion: string; icono: NombreIcono; color: string }[] = [
  { valor: 'efectivo', titulo: 'Efectivo', descripcion: 'Sale de la caja', icono: 'cartera', color: '#4f7a5f' },
  { valor: 'transferencia', titulo: 'Transferencia', descripcion: 'Sale del banco', icono: 'banco', color: '#3f6b73' },
  { valor: 'tarjeta', titulo: 'Tarjeta', descripcion: 'Sale del banco', icono: 'tarjeta', color: '#5b6b9a' },
];

// Pasos del registro de un gasto, en orden.
// 'automovil' solo aparece si la subcategoria lo pide (ver usoAutomovil).
type PasoRegistro = 'categoria' | 'subcategoria' | 'automovil' | 'importe' | 'concepto' | 'metodo' | 'comprobante';
const PASOS: PasoRegistro[] = ['categoria', 'subcategoria', 'automovil', 'importe', 'concepto', 'metodo', 'comprobante'];

function nombreMetodo(valor: string) {
  return METODOS_PAGO.find((m) => m.valor === valor)?.titulo ?? valor;
}

type Periodo =
  | 'dia'
  | 'ayer'
  | 'antier'
  | 'semana'
  | 'semana_pasada'
  | 'hace_2_semanas'
  | 'hace_3_semanas'
  | 'mes'
  | 'anio'
  | 'rango'
  | 'todos';

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const CARD = { border: 'none', boxShadow: 'var(--sombra-tarjeta)', padding: '0.75rem', borderRadius: 14 };

export function AdminGastos({ onCerrar, esAdmin, onAbrirCategorias }: Props) {
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [categoriaId, setCategoriaId] = useState('');
  // Solo el administrador puede elegir un dia distinto de hoy para el
  // gasto -- a cualquier otro usuario el backend le ignora este campo.
  const [fecha, setFecha] = useState(() => formatDateInput(new Date()));
  const [fotoComprobante, setFotoComprobante] = useState<File | null>(null);
  const [previaFoto, setPreviaFoto] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [comprobanteAbierto, setComprobanteAbierto] = useState<string | null>(null);
  const [cargandoComprobante, setCargandoComprobante] = useState(false);

  const [busquedaProveedor, setBusquedaProveedor] = useState('');
  const [resultadosProveedor, setResultadosProveedor] = useState<Proveedor[]>([]);
  const [proveedorElegido, setProveedorElegido] = useState<Proveedor | null>(null);

  const [mostrarNuevaCategoria, setMostrarNuevaCategoria] = useState(false);
  const [nombreCategoriaNueva, setNombreCategoriaNueva] = useState('');

  // 'menu' = los dos botones (Registrar / Histórico) al entrar a Gastos.
  const [pestana, setPestana] = useState<'menu' | 'registrar' | 'historico'>('menu');
  const [paso, setPaso] = useState<PasoRegistro>('categoria');
  const [automoviles, setAutomoviles] = useState<Automovil[]>([]);
  const [automovilId, setAutomovilId] = useState('');
  const [automovilFiltro, setAutomovilFiltro] = useState('');
  const [editAutomovilId, setEditAutomovilId] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [busquedaGasto, setBusquedaGasto] = useState('');

  // Reporte de gastos (pestaña Histórico): mismo patrón de filtros que
  // Historial de compras/ventas.
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [desde, setDesde] = useState(() => formatDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [hasta, setHasta] = useState(() => formatDateInput(new Date()));
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [metodoPagoFiltro, setMetodoPagoFiltro] = useState('');
  const [busquedaProveedorFiltro, setBusquedaProveedorFiltro] = useState('');
  const [resultadosProveedorFiltro, setResultadosProveedorFiltro] = useState<Proveedor[]>([]);
  const [proveedorFiltro, setProveedorFiltro] = useState<Proveedor | null>(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);

  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [necesitaAutorizacion, setNecesitaAutorizacion] = useState(false);
  const [autorizadoPorTelefono, setAutorizadoPorTelefono] = useState('');
  const [autorizadoPin, setAutorizadoPin] = useState('');
  const [cancelando, setCancelando] = useState(false);

  // Edicion de un gasto ya registrado (solo administrador).
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editConcepto, setEditConcepto] = useState('');
  const [editMonto, setEditMonto] = useState('');
  const [editMetodoPago, setEditMetodoPago] = useState('efectivo');
  const [editCategoriaId, setEditCategoriaId] = useState('');
  const [editFecha, setEditFecha] = useState('');
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  useEffect(() => {
    cargarCategorias();
    listarAutomoviles()
      .then(setAutomoviles)
      .catch(() => setMensaje('No se pudo cargar la lista de automóviles.'));
  }, []);

  useEffect(() => {
    cargarHistorial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, desde, hasta, categoriaFiltro, metodoPagoFiltro, proveedorFiltro, automovilFiltro]);

  async function cargarCategorias() {
    try {
      const res = await fetch(`${API_URL}/gastos/categorias`, { headers: headerAuth() });
      const categoriasData = await res.json();
      setCategorias(categoriasData);
    } catch {
      setMensaje('No se pudo cargar las categorías de gasto');
    }
  }

  async function cargarHistorial() {
    setCargandoHistorial(true);
    try {
      const data = await obtenerGastos({
        periodo,
        desde: periodo === 'rango' ? desde : undefined,
        hasta: periodo === 'rango' ? hasta : undefined,
        categoriaId: categoriaFiltro || undefined,
        proveedorId: proveedorFiltro?.id,
        metodoPago: metodoPagoFiltro || undefined,
        automovilId: automovilFiltro || undefined,
      });
      setGastos(data);
    } catch {
      setMensaje('No se pudo cargar el reporte de gastos.');
    } finally {
      setCargandoHistorial(false);
    }
  }

  async function buscarProveedorFiltro(valor: string) {
    setBusquedaProveedorFiltro(valor);
    if (valor.length < 2) {
      setResultadosProveedorFiltro([]);
      return;
    }
    setResultadosProveedorFiltro(await buscarProveedores(valor));
  }

  function elegirProveedorFiltro(p: Proveedor) {
    setProveedorFiltro(p);
    setResultadosProveedorFiltro([]);
    setBusquedaProveedorFiltro('');
  }

  async function buscarProveedor(valor: string) {
    setBusquedaProveedor(valor);
    if (valor.length < 2) {
      setResultadosProveedor([]);
      return;
    }
    setResultadosProveedor(await buscarProveedores(valor));
  }

  function elegirProveedor(p: Proveedor) {
    setProveedorElegido(p);
    setResultadosProveedor([]);
    setBusquedaProveedor('');
  }

  async function crearProveedorDesdeGasto() {
    if (!busquedaProveedor.trim()) return;
    try {
      const nuevo = await crearProveedorRapido(busquedaProveedor.trim());
      setProveedorElegido(nuevo);
      setResultadosProveedor([]);
      setBusquedaProveedor('');
    } catch {
      setMensaje('No se pudo crear el proveedor.');
    }
  }

  async function crearCategoriaNueva() {
    if (!nombreCategoriaNueva.trim() || !departamento) return;
    try {
      const res = await fetch(`${API_URL}/gastos/categorias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headerAuth() },
        body: JSON.stringify({ nombre: nombreCategoriaNueva.trim(), departamento }),
      });
      if (!res.ok) throw new Error();
      const nueva = await res.json();
      setCategorias((prev) => [...prev, nueva]);
      setCategoriaId(nueva.id);
      setNombreCategoriaNueva('');
      setMostrarNuevaCategoria(false);
      setPaso('importe');
    } catch {
      setMensaje('No se pudo crear la categoría.');
    }
  }

  // El backend recalcula solo el corte de caja de un dia que ya estaba
  // guardado, si el cambio de un gasto lo afecta (ver corteRecalculado /
  // cortesRecalculados en las respuestas) -- aqui se arma el aviso para
  // que quien edito sepa que un corte cerrado cambio de numeros.
  function avisoCortesRecalculados(fechas: (string | null | undefined)[]) {
    const validas = fechas.filter((f): f is string => !!f);
    if (validas.length === 0) return '';
    const listado = validas.map((f) => formatoFecha(new Date(f))).join(', ');
    return ` ⚠️ El corte de caja del ${listado} ya estaba guardado y se recalculó con este cambio.`;
  }

  async function confirmarCancelacion(gastoId: string) {
    setCancelando(true);
    try {
      const res = await fetch(`${API_URL}/gastos/${gastoId}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headerAuth() },
        body: JSON.stringify(
          necesitaAutorizacion ? { telefono: autorizadoPorTelefono, pin: autorizadoPin } : {}
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'REQUIERE_AUTORIZACION') {
          setNecesitaAutorizacion(true);
          setMensaje('Este gasto es de un día anterior: se necesita el teléfono y PIN de un administrador para cancelarlo.');
        } else {
          setMensaje(data.error || 'No se pudo cancelar el gasto.');
        }
        return;
      }
      setMensaje(`Gasto cancelado.${avisoCortesRecalculados([data.corteRecalculado])}`);
      setConfirmandoId(null);
      setNecesitaAutorizacion(false);
      setAutorizadoPorTelefono('');
      setAutorizadoPin('');
      cargarHistorial();
    } finally {
      setCancelando(false);
    }
  }

  function iniciarEdicion(gasto: Gasto) {
    setEditandoId(gasto.id);
    setEditConcepto(gasto.concepto);
    setEditMonto(String(gasto.monto));
    setEditMetodoPago(gasto.metodoPago);
    setEditCategoriaId(gasto.categoria.id);
    setEditAutomovilId(gasto.automovil?.id ?? '');
    setEditFecha(formatDateInput(new Date(gasto.fecha)));
  }

  function cancelarEdicion() {
    setEditandoId(null);
  }

  async function guardarEdicion(gastoId: string) {
    setGuardandoEdicion(true);
    try {
      const resultado = await editarGasto(gastoId, {
        concepto: editConcepto,
        monto: Number(editMonto),
        metodoPago: editMetodoPago,
        categoriaId: editCategoriaId,
        automovilId: usoAutoEdicion === 'no' ? null : editAutomovilId || null,
        fecha: editFecha,
      });
      setMensaje(`Gasto actualizado.${avisoCortesRecalculados(resultado.cortesRecalculados ?? [])}`);
      setEditandoId(null);
      cargarHistorial();
    } catch (err: any) {
      setMensaje(err.message || 'No se pudo editar el gasto.');
    } finally {
      setGuardandoEdicion(false);
    }
  }

  function elegirFotoComprobante(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0] ?? null;
    setFotoComprobante(archivo);
    setPreviaFoto((anterior) => {
      if (anterior) URL.revokeObjectURL(anterior);
      return archivo ? URL.createObjectURL(archivo) : null;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoriaId) {
      setMensaje('Elige una categoría antes de guardar.');
      return;
    }
    if (!fotoComprobante) {
      setMensaje('Sube una foto del comprobante antes de guardar.');
      return;
    }
    setGuardando(true);
    try {
      const cuerpo = new FormData();
      cuerpo.append('categoriaId', categoriaId);
      if (proveedorElegido) cuerpo.append('proveedorId', proveedorElegido.id);
      if (usoAuto !== 'no' && automovilId) cuerpo.append('automovilId', automovilId);
      cuerpo.append('concepto', concepto);
      cuerpo.append('monto', monto);
      cuerpo.append('metodoPago', metodoPago);
      if (esAdmin) cuerpo.append('fecha', fecha);
      cuerpo.append('foto', fotoComprobante);

      // Sin Content-Type manual: el navegador lo pone solo (con el boundary
      // correcto) al mandar un FormData con multipart/form-data.
      const res = await fetch(`${API_URL}/gastos`, {
        method: 'POST',
        headers: headerAuth(),
        body: cuerpo,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar');
      setMensaje(`Gasto registrado.${avisoCortesRecalculados([data.corteRecalculado])}`);
      reiniciarRegistro();
      setPestana('menu');
      setFecha(formatDateInput(new Date()));
      setProveedorElegido(null);
      if (previaFoto) URL.revokeObjectURL(previaFoto);
      setFotoComprobante(null);
      setPreviaFoto(null);
      cargarHistorial();
    } catch (err: any) {
      setMensaje(err.message || 'No se pudo registrar el gasto');
    } finally {
      setGuardando(false);
    }
  }

  function reiniciarRegistro() {
    setPaso('categoria');
    setDepartamento('');
    setCategoriaId('');
    setAutomovilId('');
    setConcepto('');
    setMonto('');
    setMetodoPago('efectivo');
    setFecha(formatDateInput(new Date()));
    setProveedorElegido(null);
    setMostrarNuevaCategoria(false);
    setNombreCategoriaNueva('');
    if (previaFoto) URL.revokeObjectURL(previaFoto);
    setFotoComprobante(null);
    setPreviaFoto(null);
  }

  function empezarRegistro() {
    reiniciarRegistro();
    setPestana('registrar');
  }

  function pasoAnterior() {
    const i = pasosActivos.indexOf(paso);
    if (i <= 0) {
      setPestana('menu');
      return;
    }
    setMostrarNuevaCategoria(false);
    setPaso(pasosActivos[i - 1]);
  }

  function siguienteDesde(e: React.FormEvent, valido: boolean, mensajeError: string, siguiente: PasoRegistro) {
    e.preventDefault();
    if (!valido) {
      setMensaje(mensajeError);
      return;
    }
    setMensaje(null);
    setPaso(siguiente);
  }

  async function verComprobante(gastoId: string) {
    setCargandoComprobante(true);
    try {
      const res = await fetch(`${API_URL}/gastos/${gastoId}/comprobante`, { headers: headerAuth() });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      setComprobanteAbierto(URL.createObjectURL(blob));
    } catch {
      setMensaje('No se pudo cargar la foto del comprobante.');
    } finally {
      setCargandoComprobante(false);
    }
  }

  function cerrarComprobante() {
    if (comprobanteAbierto) URL.revokeObjectURL(comprobanteAbierto);
    setComprobanteAbierto(null);
  }

  async function exportar() {
    try {
      await exportarAExcel(
        gastosFiltrados.map((g) => ({
          Fecha: formatoFecha(new Date(g.fecha)),
          Hora: new Date(g.fecha).toLocaleTimeString(),
          Semana: numeroSemana(new Date(g.fecha)),
          Concepto: g.concepto,
          Categoria: g.categoria.nombre,
          Departamento: g.categoria.departamento,
          Proveedor: g.proveedor?.nombre || '',
          Automovil: g.automovil ? nombreAutomovil(g.automovil) : '',
          Monto: Number(g.monto),
          'Metodo de pago': g.metodoPago,
          'Registrado por': g.registradoPor.nombre,
          Cancelado: g.cancelado ? 'Sí' : 'No',
          'Cancelado el': g.canceladoEn ? formatoFechaHora(new Date(g.canceladoEn)) : '',
        })),
        'gastos'
      );
    } catch {
      setMensaje('No hay gastos para exportar.');
    }
  }

  const categoriaElegida = categorias.find((c) => c.id === categoriaId);
  // Las subcategorias ocultas (activa = false) no se ofrecen para gastos nuevos.
  const subcategorias = categorias.filter((c) => c.departamento === departamento && c.activa !== false);
  const usoAuto = categoriaElegida?.usoAutomovil ?? 'no';
  const pasosActivos = PASOS.filter((p) => p !== 'automovil' || usoAuto !== 'no');
  const numeroPaso = pasosActivos.indexOf(paso) + 1;
  const automovilesActivos = automoviles.filter((a) => a.activo);
  const automovilElegido = automoviles.find((a) => a.id === automovilId);
  const usoAutoEdicion = categorias.find((c) => c.id === editCategoriaId)?.usoAutomovil ?? 'no';

  const categoriasPorDepartamento = categorias.reduce<Record<string, CategoriaGasto[]>>((acc, c) => {
    (acc[c.departamento] ??= []).push(c);
    return acc;
  }, {});

  const gastosFiltrados = gastos.filter((g) => {
    if (!busquedaGasto.trim()) return true;
    const q = busquedaGasto.trim().toLowerCase();
    return (
      g.concepto.toLowerCase().includes(q) ||
      g.categoria.nombre.toLowerCase().includes(q) ||
      (g.proveedor?.nombre || '').toLowerCase().includes(q) ||
      (g.automovil?.nombre || '').toLowerCase().includes(q)
    );
  });

  // Los totales/subtotales del reporte no cuentan los gastos cancelados
  // -- ese dinero nunca salio de verdad, igual que en el corte de caja.
  const gastosActivos = gastosFiltrados.filter((g) => !g.cancelado);
  const totalPeriodo = gastosActivos.reduce((acc, g) => acc + Number(g.monto), 0);
  const totalPorDepartamento = gastosActivos.reduce<Record<string, number>>((acc, g) => {
    const dep = g.categoria.departamento;
    acc[dep] = (acc[dep] ?? 0) + Number(g.monto);
    return acc;
  }, {});

  return (
    <div className="pantalla-centrada pantalla-arriba">
      <div className="contenido-pantalla contenido-760">
        <div className="fila-entre-centro">
          <h2>Gastos</h2>
          <div className="fila-gap-8">
            {pestana === 'historico' && <button onClick={exportar}><Icono nombre="tabla" size={16} /> Exportar Excel</button>}
            <button onClick={onCerrar}>Cerrar</button>
          </div>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {pestana === 'menu' && (
          <div className="grid-menu">
            <div className="tarjeta-menu" onClick={empezarRegistro}>
              <div className="icono-menu" style={{ background: '#b8892f' }}><Icono nombre="cartera" size={22} /></div>
              <div>
                <p className="titulo-menu">Registrar gasto</p>
                <p className="descripcion-menu">Capturar un gasto nuevo paso a paso</p>
              </div>
            </div>
            <div className="tarjeta-menu" onClick={() => setPestana('historico')}>
              <div className="icono-menu" style={{ background: '#8a5a6e' }}><Icono nombre="reloj" size={22} /></div>
              <div>
                <p className="titulo-menu">Histórico de gastos</p>
                <p className="descripcion-menu">Ver, filtrar, editar y exportar gastos</p>
              </div>
            </div>
            {esAdmin && onAbrirCategorias && (
              <div className="tarjeta-menu" onClick={onAbrirCategorias}>
                <div className="icono-menu" style={{ background: '#64748b' }}><Icono nombre="etiqueta" size={22} /></div>
                <div>
                  <p className="titulo-menu">Categorías y automóviles</p>
                  <p className="descripcion-menu">Subcategorías de gasto y vehículos del negocio</p>
                </div>
              </div>
            )}
          </div>
        )}

        {pestana === 'historico' && (
          <button type="button" className="boton-secundario" onClick={() => setPestana('menu')} style={{ width: 'auto', marginTop: 0, justifySelf: 'start' }}>
            ← Gastos
          </button>
        )}

        {pestana === 'registrar' && (
          <div className="tarjeta-grid-075">
            <div className="fila-entre-centro">
              <button type="button" className="boton-secundario" onClick={pasoAnterior} style={{ width: 'auto', marginTop: 0 }}>
                ← Atrás
              </button>
              <small className="t-tenue">Paso {numeroPaso} de {pasosActivos.length}</small>
            </div>

            {/* Lo que ya se eligio, para no perder de vista el gasto */}
            {paso !== 'categoria' && (
              <div className="t-tenue-12" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                <span><strong>{departamento}</strong>{categoriaElegida && paso !== 'subcategoria' ? ` › ${categoriaElegida.nombre}` : ''}</span>
                {automovilElegido && PASOS.indexOf(paso) > PASOS.indexOf('automovil') && <span>{nombreAutomovil(automovilElegido)}</span>}
                {monto && PASOS.indexOf(paso) > PASOS.indexOf('importe') && <span>{formatoMoneda(Number(monto))}</span>}
                {concepto && PASOS.indexOf(paso) > PASOS.indexOf('concepto') && <span>{concepto}</span>}
                {paso === 'comprobante' && <span>{nombreMetodo(metodoPago)}</span>}
              </div>
            )}

            {paso === 'categoria' && (
              <>
                <h3>¿En qué categoría va el gasto?</h3>
                <div className="grid-gap-8">
                  {DEPARTAMENTOS.map((d) => (
                    <div
                      key={d}
                      className="tarjeta-menu"
                      onClick={() => {
                        setDepartamento(d);
                        setCategoriaId('');
                        setPaso('subcategoria');
                      }}
                    >
                      <div className="icono-menu" style={{ background: ESTILO_DEPARTAMENTO[d]?.color }}>
                        <Icono nombre={ESTILO_DEPARTAMENTO[d]?.icono ?? 'cartera'} size={22} />
                      </div>
                      <p className="titulo-menu">{d}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {paso === 'subcategoria' && (
              <>
                <h3>Subcategoría de {departamento}</h3>
                {!mostrarNuevaCategoria ? (
                  <>
                    <div role="listbox" aria-label={`Subcategorías de ${departamento}`} className="grid-gap-8">
                      {subcategorias.map((c) => (
                        <div
                          key={c.id}
                          role="option"
                          aria-selected={c.id === categoriaId}
                          className="resultado-cliente"
                          onClick={() => {
                            setCategoriaId(c.id);
                            setAutomovilId('');
                            setPaso((c.usoAutomovil ?? 'no') === 'no' ? 'importe' : 'automovil');
                          }}
                        >
                          {c.nombre}
                        </div>
                      ))}
                      {subcategorias.length === 0 && <p className="t-tenue">Todavía no hay subcategorías en {departamento}.</p>}
                    </div>
                    <button type="button" className="boton-secundario w-100-mt-0" onClick={() => setMostrarNuevaCategoria(true)}>
                      + Nueva subcategoría
                    </button>
                  </>
                ) : (
                  <div className="grid-gap-8">
                    <input
                      autoFocus
                      placeholder={`Nombre de la subcategoría (${departamento})`}
                      value={nombreCategoriaNueva}
                      onChange={(e) => setNombreCategoriaNueva(e.target.value)}
                    />
                    <div className="fila-gap-8">
                      <button type="button" onClick={crearCategoriaNueva}>Guardar y seguir</button>
                      <button type="button" onClick={() => setMostrarNuevaCategoria(false)}>Cancelar</button>
                    </div>
                  </div>
                )}
              </>
            )}

            {paso === 'automovil' && (
              <>
                <h3>{categoriaElegida?.nombre === 'Mantenimiento y reparaciones' ? '¿A qué vehículo se le hizo?' : '¿De qué automóvil es el gasto?'}</h3>
                <div role="listbox" aria-label="Automóviles" className="grid-gap-8">
                  {automovilesActivos.map((a) => (
                    <div
                      key={a.id}
                      role="option"
                      aria-selected={a.id === automovilId}
                      className="resultado-cliente"
                      onClick={() => {
                        setAutomovilId(a.id);
                        setPaso('importe');
                      }}
                    >
                      <strong>{a.nombre}</strong>
                      {a.placas && <span className="t-tenue"> · {a.placas}</span>}
                    </div>
                  ))}
                  {usoAuto === 'opcional' && (
                    <div
                      role="option"
                      aria-selected={false}
                      className="resultado-cliente"
                      onClick={() => {
                        setAutomovilId('');
                        setPaso('importe');
                      }}
                    >
                      <span className="t-tenue">No es de un vehículo</span>
                    </div>
                  )}
                </div>
                {automovilesActivos.length === 0 && (
                  <p className="t-tenue">
                    No hay automóviles dados de alta.{' '}
                    {esAdmin
                      ? 'Agrégalos en Configuración → Categorías y automóviles.'
                      : 'Pídele al administrador que los agregue.'}
                  </p>
                )}
              </>
            )}

            {paso === 'importe' && (
              <form className="grid-gap-8" onSubmit={(e) => siguienteDesde(e, Number(monto) > 0, 'Escribe un importe mayor a cero.', 'concepto')}>
                <h3>¿Cuál es el importe?</h3>
                <input autoFocus value={monto} onChange={(e) => setMonto(e.target.value)} type="number" inputMode="decimal" step="0.01" min="0.01" placeholder="$0.00" />
                <button type="submit">Siguiente</button>
              </form>
            )}

            {paso === 'concepto' && (
              <form className="grid-gap-8" onSubmit={(e) => siguienteDesde(e, !!concepto.trim(), 'Escribe el concepto del gasto.', 'metodo')}>
                <h3>¿Cuál es el concepto?</h3>
                <input autoFocus value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej. Recibo de luz de octubre" />
                <button type="submit">Siguiente</button>
              </form>
            )}

            {paso === 'metodo' && (
              <>
                <h3>¿Cómo se pagó?</h3>
                <div className="grid-gap-8">
                  {METODOS_PAGO.map((m) => (
                    <div
                      key={m.valor}
                      className="tarjeta-menu"
                      onClick={() => {
                        setMetodoPago(m.valor);
                        setPaso('comprobante');
                      }}
                    >
                      <div className="icono-menu" style={{ background: m.color }}><Icono nombre={m.icono} size={22} /></div>
                      <div>
                        <p className="titulo-menu">{m.titulo}</p>
                        <p className="descripcion-menu">{m.descripcion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {paso === 'comprobante' && (
              <form onSubmit={handleSubmit} className="grid-gap-8">
                <h3>Comprobante y guardar</h3>
                {esAdmin && (
                  <>
                    <label className="etiqueta">Día en que se aplica el gasto</label>
                    <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                  </>
                )}

              <label className="etiqueta">Proveedor (opcional)</label>
              {proveedorElegido ? (
                <div className="cliente-chip">
                  <span>{proveedorElegido.nombre}</span>
                  <button type="button" onClick={() => setProveedorElegido(null)}>Quitar</button>
                </div>
              ) : (
                <>
                  <input
                    className="buscador"
                    placeholder="Buscar proveedor por nombre"
                    value={busquedaProveedor}
                    onChange={(e) => buscarProveedor(e.target.value)}
                  />
                  {resultadosProveedor.map((p) => (
                    <div key={p.id} className="resultado-cliente" onClick={() => elegirProveedor(p)}>
                      {p.nombre}
                    </div>
                  ))}
                  {busquedaProveedor.length >= 2 && resultadosProveedor.length === 0 && (
                    <button type="button" className="boton-secundario w-100-mt-0" onClick={crearProveedorDesdeGasto}>
                      + Agregar "{busquedaProveedor}" como proveedor nuevo
                    </button>
                  )}
                </>
              )}

              <label className="etiqueta">Foto del comprobante (obligatoria)</label>
              {/* El <input type="file"> nativo queda oculto y se dispara desde
                  este botón grande de verdad -- en computadora el input solo
                  se ve como un texto gris chiquito ("Seleccionar archivo") que
                  es facil no notar; asi siempre hay algo obviamente clickeable
                  sin importar el navegador. Sin "capture": en celular el
                  navegador ofrece elegir entre tomar foto o subir de la
                  galeria, en vez de forzar la camara. */}
              <label
                htmlFor="foto-comprobante-gasto"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  border: '2px dashed var(--ios-gray-3)',
                  borderRadius: 12,
                  padding: '1.25rem',
                  cursor: 'pointer',
                  color: 'var(--acento)',
                  fontWeight: 600,
                  textAlign: 'center',
                }}
              >
                {fotoComprobante ? <><Icono nombre="adjunto" size={16} /> {fotoComprobante.name} (toca para cambiarla)</> : <><Icono nombre="camara" size={16} /> Toca para elegir o tomar la foto</>}
              </label>
              <input
                id="foto-comprobante-gasto"
                type="file"
                accept="image/*"
                onChange={elegirFotoComprobante}
                style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
              />
              {previaFoto && (
                <img
                  src={previaFoto}
                  alt="Comprobante"
                  style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'contain' }}
                />
              )}

                <button type="submit" disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar gasto'}
                </button>
              </form>
            )}
          </div>
        )}

        {pestana === 'historico' && (
          <>
            <div style={{ ...CARD, display: 'grid', gap: '0.75rem' }}>
              <div className="fila-gap-075-wrap">
                <label className="grid-gap-025">
                  <span>Periodo</span>
                  <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
                    <option value="dia">Hoy</option>
                    <option value="ayer">Ayer</option>
                    <option value="antier">Antier</option>
                    <option value="semana">Esta semana</option>
                    <option value="semana_pasada">Semana pasada</option>
                    <option value="hace_2_semanas">Hace 2 semanas</option>
                    <option value="hace_3_semanas">Hace 3 semanas</option>
                    <option value="mes">Este mes</option>
                    <option value="anio">Este año</option>
                    <option value="rango">Personalizado</option>
                    <option value="todos">Todos</option>
                  </select>
                </label>

                {periodo === 'rango' && (
                  <>
                    <label className="grid-gap-025">
                      <span>Desde</span>
                      <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
                    </label>
                    <label className="grid-gap-025">
                      <span>Hasta</span>
                      <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                    </label>
                  </>
                )}

                <label className="grid-gap-025">
                  <span>Categoría</span>
                  <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}>
                    <option value="">Todas</option>
                    {Object.entries(categoriasPorDepartamento).map(([departamento, cats]) => (
                      <optgroup key={departamento} label={departamento}>
                        {cats.map((c) => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>

                <label className="grid-gap-025">
                  <span>Método de pago</span>
                  <select value={metodoPagoFiltro} onChange={(e) => setMetodoPagoFiltro(e.target.value)}>
                    <option value="">Todos</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </label>

                {automoviles.length > 0 && (
                  <label className="grid-gap-025">
                    <span>Automóvil</span>
                    <select value={automovilFiltro} onChange={(e) => setAutomovilFiltro(e.target.value)}>
                      <option value="">Todos</option>
                      {automoviles.map((a) => (
                        <option key={a.id} value={a.id}>{nombreAutomovil(a)}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <div>
                <span style={{ display: 'block', marginBottom: 4 }}>Proveedor</span>
                {proveedorFiltro ? (
                  <div className="cliente-chip">
                    <span>{proveedorFiltro.nombre}</span>
                    <button onClick={() => setProveedorFiltro(null)}>Quitar filtro</button>
                  </div>
                ) : (
                  <>
                    <input
                      className="buscador"
                      placeholder="Buscar proveedor"
                      value={busquedaProveedorFiltro}
                      onChange={(e) => buscarProveedorFiltro(e.target.value)}
                    />
                    {resultadosProveedorFiltro.map((p) => (
                      <div key={p.id} className="resultado-cliente" onClick={() => elegirProveedorFiltro(p)}>
                        {p.nombre}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {!cargandoHistorial && (
              <div className="fila-gap-075-wrap">
                <div style={{ ...CARD, flex: 1 }}>
                  <strong>{gastosActivos.length}</strong> gasto{gastosActivos.length !== 1 ? 's' : ''}
                </div>
                <div style={{ ...CARD, flex: 1 }}>
                  Total: <strong>{formatoMoneda(totalPeriodo)}</strong>
                </div>
              </div>
            )}

            {!cargandoHistorial && Object.keys(totalPorDepartamento).length > 0 && (
              <div style={{ ...CARD, display: 'grid', gap: 4 }}>
                <strong className="fs-13">Por departamento</strong>
                {Object.entries(totalPorDepartamento)
                  .sort((a, b) => b[1] - a[1])
                  .map(([departamento, monto]) => (
                    <div key={departamento} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>{departamento}</span>
                      <span>{formatoMoneda(monto)}</span>
                    </div>
                  ))}
              </div>
            )}

            <input
              className="buscador"
              placeholder="Buscar por concepto, categoría o proveedor"
              value={busquedaGasto}
              onChange={(e) => setBusquedaGasto(e.target.value)}
            />
            <div className="lista-tarjetas grid-gap-075">
              {cargandoHistorial && <p>Cargando...</p>}
              {!cargandoHistorial && gastosFiltrados.length === 0 && (
                <p className="t-tenue">No hay gastos que coincidan.</p>
              )}
              {!cargandoHistorial && gastosFiltrados.map((gasto) => (
                <div key={gasto.id} className="tarjeta-sombra">
                  {editandoId === gasto.id ? (
                    <div className="grid-gap-8">
                      <label className="etiqueta">Concepto</label>
                      <input value={editConcepto} onChange={(e) => setEditConcepto(e.target.value)} />
                      <label className="etiqueta">Monto</label>
                      <input type="number" step="0.01" value={editMonto} onChange={(e) => setEditMonto(e.target.value)} />
                      <label className="etiqueta">Método de pago</label>
                      <select value={editMetodoPago} onChange={(e) => setEditMetodoPago(e.target.value)}>
                        <option value="efectivo">Efectivo</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="tarjeta">Tarjeta</option>
                      </select>
                      <label className="etiqueta">Categoría</label>
                      <select value={editCategoriaId} onChange={(e) => setEditCategoriaId(e.target.value)}>
                        {Object.entries(categoriasPorDepartamento).map(([departamento, cats]) => (
                          <optgroup key={departamento} label={departamento}>
                            {cats.map((c) => (
                              <option key={c.id} value={c.id}>{c.nombre}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      {usoAutoEdicion !== 'no' && (
                        <>
                          <label className="etiqueta">Automóvil</label>
                          <select value={editAutomovilId} onChange={(e) => setEditAutomovilId(e.target.value)}>
                            <option value="">{usoAutoEdicion === 'opcional' ? 'No es de un vehículo' : 'Elige un automóvil'}</option>
                            {automoviles
                              .filter((a) => a.activo || a.id === editAutomovilId)
                              .map((a) => (
                                <option key={a.id} value={a.id}>{nombreAutomovil(a)}</option>
                              ))}
                          </select>
                        </>
                      )}
                      <label className="etiqueta">Día en que se aplica el gasto</label>
                      <input type="date" value={editFecha} onChange={(e) => setEditFecha(e.target.value)} />
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button onClick={() => guardarEdicion(gasto.id)} disabled={guardandoEdicion} className="flex-1">
                          {guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                        <button className="boton-secundario flex-1" onClick={cancelarEdicion} disabled={guardandoEdicion}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="fila-entre">
                        <div>
                          <strong>{gasto.concepto}</strong>
                          <div>{gasto.categoria.nombre}</div>
                          {gasto.proveedor && <div className="t-tenue-12">Proveedor: {gasto.proveedor.nombre}</div>}
                          {gasto.automovil && <div className="t-tenue-12">Automóvil: {nombreAutomovil(gasto.automovil)}</div>}
                          <div className="t-tenue-12">{formatoFecha(new Date(gasto.fecha))}</div>
                        </div>
                        <div className="t-der">
                          <div>{formatoMoneda(Number(gasto.monto))}</div>
                          <small>{gasto.registradoPor.nombre}</small>
                        </div>
                      </div>

                      {esAdmin && !gasto.cancelado && (
                        <button
                          className="boton-secundario"
                          onClick={() => iniciarEdicion(gasto)}
                          style={{ width: '100%', marginTop: 8 }}
                        >
                          <Icono nombre="editar" size={16} /> Editar
                        </button>
                      )}
                    </>
                  )}

                  {editandoId !== gasto.id && gasto.fotoComprobanteKey && (
                    <button
                      className="boton-secundario"
                      onClick={() => verComprobante(gasto.id)}
                      disabled={cargandoComprobante}
                      style={{ width: '100%', marginTop: 8 }}
                    >
                      <Icono nombre="recibo" size={16} /> Ver comprobante
                    </button>
                  )}

                  {editandoId === gasto.id ? null : gasto.cancelado ? (
                    <div className="aviso-alerta mt-8">
                      ❌ Cancelado{gasto.canceladoEn ? ` el ${formatoFechaHora(new Date(gasto.canceladoEn))}` : ''}
                    </div>
                  ) : confirmandoId === gasto.id ? (
                    <div className="bloque-autorizacion mt-8">
                      <p className="texto-alerta fw-600">
                        ¿Seguro que quieres cancelar este gasto? No se puede deshacer.
                      </p>
                      {necesitaAutorizacion && (
                        <>
                          <input
                            placeholder="Teléfono del administrador"
                            value={autorizadoPorTelefono}
                            onChange={(e) => setAutorizadoPorTelefono(e.target.value)}
                          />
                          <input
                            placeholder="PIN"
                            type="password"
                            value={autorizadoPin}
                            onChange={(e) => setAutorizadoPin(e.target.value)}
                          />
                        </>
                      )}
                      <div className="fila-gap-8-mt-8">
                        <button onClick={() => confirmarCancelacion(gasto.id)} disabled={cancelando} className="flex-1">
                          {cancelando ? 'Cancelando...' : 'Sí, cancelar'}
                        </button>
                        <button onClick={() => { setConfirmandoId(null); setNecesitaAutorizacion(false); }} className="flex-1">
                          No, regresar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="boton-secundario"
                      onClick={() => setConfirmandoId(gasto.id)}
                      style={{ width: '100%', marginTop: 8, background: 'var(--peligro-fondo)', color: 'var(--peligro)' }}
                    >
                      <Icono nombre="papelera" size={16} /> Cancelar gasto
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {comprobanteAbierto && (
        <div className="modal-fondo" onClick={cerrarComprobante} style={{ zIndex: 40 }}>
          <div className="modal-contenido" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <p className="titulo">Comprobante</p>
              <button className="boton-cerrar" onClick={cerrarComprobante}>✕</button>
            </div>
            <img src={comprobanteAbierto} alt="Comprobante" style={{ maxWidth: '100%', borderRadius: 8 }} />
          </div>
        </div>
      )}
    </div>
  );
}
