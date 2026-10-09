import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { formatoMoneda, formatoFecha, haceDias } from './formato';
import {
  crearVarianteRapida,
  obtenerProductosGestion,
  obtenerTablaPrecios,
  guardarCostoProveedor,
  eliminarCostoProveedor,
  type FilaTablaPrecios,
  type PrecioProveedor,
} from './api';

interface Props {
  onCerrar: () => void;
}

const BORDE = '1px solid #d1d5db';
// Bordes solo a la derecha y abajo (mas arriba en el encabezado y a la
// izquierda en la primera columna): con encabezado/columna fijos la tabla
// no puede usar border-collapse, y con borde completo se verian dobles.
const celdaBase: CSSProperties = { borderRight: BORDE, borderBottom: BORDE, padding: '6px 8px', whiteSpace: 'nowrap' };
const celdaEncabezado: CSSProperties = { ...celdaBase, borderTop: BORDE, background: '#f3f4f6', fontWeight: 600, textAlign: 'left' };

// Fecha corta para que quepa debajo del precio en la celda (ej. "8 oct"),
// con el año solo cuando no es el actual.
function fechaCorta(fecha: string): string {
  const d = new Date(fecha);
  const mismoAnio = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', ...(mismoAnio ? {} : { year: '2-digit' }) });
}

const mismoTexto = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Campo de texto con lista desplegable: al enfocarlo muestra las opciones
// que ya existen (filtradas por lo que se va tecleando) y, si lo tecleado
// no esta en la lista, lo ofrece como nuevo.
function CampoConLista({
  valor,
  onCambio,
  opciones,
  placeholder,
}: {
  valor: string;
  onCambio: (valor: string) => void;
  opciones: string[];
  placeholder: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const texto = valor.trim().toLowerCase();
  const visibles = opciones.filter((o) => o.toLowerCase().includes(texto));
  const esNuevo = texto !== '' && !opciones.some((o) => mismoTexto(o, valor));
  const estiloOpcion: CSSProperties = { padding: '0.6rem 0.85rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', color: '#1c1c1e' };

  return (
    <div style={{ position: 'relative', flex: '1 1 180px' }}>
      <input
        className="buscador"
        placeholder={placeholder}
        value={valor}
        onChange={(e) => {
          onCambio(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
      />
      {abierto && (visibles.length > 0 || esNuevo) && (
        <div
          // Evita que el campo pierda el foco (y la lista se cierre) antes de registrar el click.
          onMouseDown={(e) => e.preventDefault()}
          style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5, background: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', borderRadius: 10, marginTop: 4, maxHeight: 260, overflowY: 'auto' }}
        >
          {visibles.map((o) => (
            <div
              key={o}
              onClick={() => {
                onCambio(o);
                setAbierto(false);
              }}
              style={estiloOpcion}
            >
              {o}
            </div>
          ))}
          {esNuevo && (
            <div onClick={() => setAbierto(false)} style={{ ...estiloOpcion, color: '#007aff', fontWeight: 500 }}>
              + Agregar “{valor.trim()}” como nuevo
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AdminTablaPrecios({ onCerrar }: Props) {
  const [proveedores, setProveedores] = useState<{ id: string; nombre: string }[]>([]);
  const [filas, setFilas] = useState<FilaTablaPrecios[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Proveedores que se agregaron como columna a mano (todavia sin ningun
  // precio capturado) -- los que ya tienen al menos un precio salen solos.
  const [columnasExtra, setColumnasExtra] = useState<string[]>([]);

  const [filtro, setFiltro] = useState('');
  // Todo el catalogo (producto + marca), para las listas desplegables de
  // "agregar producto" y para saber si lo tecleado ya existe o es nuevo.
  const [catalogo, setCatalogo] = useState<{ id: string; producto: string; marca: string }[]>([]);
  const [productoNuevo, setProductoNuevo] = useState('');
  const [marcaNueva, setMarcaNueva] = useState('');
  const [agregando, setAgregando] = useState(false);

  const [editando, setEditando] = useState<{ varianteId: string; proveedorId: string } | null>(null);
  const [valorEdicion, setValorEdicion] = useState('');

  // La tabla se desliza con barras en los cuatro lados: abajo y a la
  // derecha son las del propio contenedor; arriba y a la izquierda son
  // barras "espejo" (un div vacio del mismo tamaño que la tabla) que se
  // mantienen sincronizadas con el, para no tener que ir hasta el fondo
  // o hasta la orilla derecha para moverse.
  const contenedorRef = useRef<HTMLDivElement>(null);
  const tablaRef = useRef<HTMLTableElement>(null);
  const barraArribaRef = useRef<HTMLDivElement>(null);
  const barraIzquierdaRef = useRef<HTMLDivElement>(null);
  // Ancho real de la columna Producto: la de Marca tambien queda fija al
  // deslizar hacia los lados, pegada justo despues de ella.
  const thProductoRef = useRef<HTMLTableCellElement>(null);
  const [medidas, setMedidas] = useState({ ancho: 0, alto: 0, desbordaX: false, desbordaY: false, anchoProducto: 0 });

  useEffect(() => {
    cargar();
    obtenerProductosGestion()
      .then((productos) => setCatalogo(productos.map((p) => ({ id: p.id, producto: p.producto, marca: p.marca }))))
      .catch(() => setMensaje('No se pudo cargar la lista de productos.'));
  }, []);

  useEffect(() => {
    const contenedor = contenedorRef.current;
    const tabla = tablaRef.current;
    if (!contenedor || !tabla) return;
    const medir = () =>
      setMedidas({
        ancho: contenedor.scrollWidth,
        alto: contenedor.scrollHeight,
        desbordaX: contenedor.scrollWidth > contenedor.clientWidth + 1,
        desbordaY: contenedor.scrollHeight > contenedor.clientHeight + 1,
        anchoProducto: thProductoRef.current?.getBoundingClientRect().width ?? 0,
      });
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(contenedor);
    observador.observe(tabla);
    return () => observador.disconnect();
  }, [cargando, filas.length === 0]);

  function sincronizar(origen: HTMLDivElement) {
    for (const ref of [contenedorRef, barraArribaRef, barraIzquierdaRef]) {
      const el = ref.current;
      if (!el || el === origen) continue;
      if (el !== barraIzquierdaRef.current && origen !== barraIzquierdaRef.current) el.scrollLeft = origen.scrollLeft;
      if (el !== barraArribaRef.current && origen !== barraArribaRef.current) el.scrollTop = origen.scrollTop;
    }
  }

  async function cargar() {
    try {
      const tabla = await obtenerTablaPrecios();
      setProveedores(tabla.proveedores);
      // Conserva los renglones agregados a mano que todavia no tienen precio.
      setFilas((previas) => [
        ...tabla.filas,
        ...previas.filter((p) => Object.keys(p.precios).length === 0 && !tabla.filas.some((f) => f.varianteId === p.varianteId)),
      ]);
    } catch {
      setMensaje('No se pudo cargar la tabla de precios.');
    } finally {
      setCargando(false);
    }
  }

  const columnas = useMemo(
    () => proveedores.filter((p) => columnasExtra.includes(p.id) || filas.some((f) => f.precios[p.id])),
    [proveedores, filas, columnasExtra]
  );
  const proveedoresSinColumna = proveedores.filter((p) => !columnas.some((c) => c.id === p.id));

  const filasVisibles = useMemo(() => {
    const texto = filtro.trim().toLowerCase();
    if (!texto) return filas;
    return filas.filter((f) => `${f.producto} ${f.marca}`.toLowerCase().includes(texto));
  }, [filas, filtro]);

  const sinRepetir = (valores: string[]) =>
    [...new Map(valores.map((v) => [v.toLowerCase(), v])).values()].sort((a, b) => a.localeCompare(b, 'es'));
  const opcionesProducto = useMemo(() => sinRepetir(catalogo.map((c) => c.producto)), [catalogo]);
  // Marcas: primero las que ya tiene ese producto; si es un producto nuevo, todas las conocidas.
  const opcionesMarca = useMemo(() => {
    const delProducto = catalogo.filter((c) => mismoTexto(c.producto, productoNuevo));
    return sinRepetir((delProducto.length > 0 ? delProducto : catalogo).map((c) => c.marca));
  }, [catalogo, productoNuevo]);

  async function agregarRenglon() {
    const producto = productoNuevo.trim();
    const marca = marcaNueva.trim();
    if (!producto || !marca) {
      setMensaje('Escribe o elige el producto y la marca.');
      return;
    }

    setAgregando(true);
    try {
      let variante = catalogo.find((c) => mismoTexto(c.producto, producto) && mismoTexto(c.marca, marca));
      if (!variante) {
        // No existe: se da de alta en el catalogo (sin precio de venta, se
        // le pone despues en Productos o al registrar su primera compra).
        const creada = await crearVarianteRapida(producto, marca, 0);
        variante = { id: creada.id, producto: creada.producto.nombre, marca: creada.marca };
        setCatalogo((previo) => [...previo, variante!]);
      }
      const { id, producto: nombre, marca: marcaFinal } = variante;
      setFilas((previas) =>
        previas.some((f) => f.varianteId === id) ? previas : [...previas, { varianteId: id, producto: nombre, marca: marcaFinal, precios: {} }]
      );
      setFiltro('');
      setProductoNuevo('');
      setMarcaNueva('');
    } catch (err: any) {
      setMensaje(err.message || 'No se pudo agregar el producto.');
    } finally {
      setAgregando(false);
    }
  }

  function empezarEdicion(varianteId: string, proveedorId: string, actual?: PrecioProveedor) {
    setEditando({ varianteId, proveedorId });
    setValorEdicion(actual ? String(actual.costo) : '');
  }

  async function guardarEdicion() {
    if (!editando) return;
    const { varianteId, proveedorId } = editando;
    setEditando(null);

    const actual = filas.find((f) => f.varianteId === varianteId)?.precios[proveedorId];
    const texto = valorEdicion.trim();

    // Celda vacia = quitar el precio de ese proveedor.
    if (texto === '') {
      if (!actual) return;
      try {
        await eliminarCostoProveedor(proveedorId, varianteId);
      } catch {
        // Si el precio venia solo del historial de compras no hay nada guardado que quitar.
      }
      cargar();
      return;
    }

    const costo = Number(texto);
    if (!costo || costo <= 0) {
      setMensaje('Escribe un precio válido.');
      return;
    }
    if (actual && actual.costo === costo) return;

    try {
      const guardado = await guardarCostoProveedor(proveedorId, varianteId, costo);
      const ultimaCompra = actual?.ultimaCompra ?? null;
      const nuevo: PrecioProveedor = {
        costo: guardado.costo,
        actualizadoEn: guardado.actualizadoEn,
        origen: ultimaCompra && ultimaCompra.costo === guardado.costo ? 'compra' : 'manual',
        ultimaCompra,
      };
      setFilas((previas) =>
        previas.map((f) => (f.varianteId === varianteId ? { ...f, precios: { ...f.precios, [proveedorId]: nuevo } } : f))
      );
    } catch (err: any) {
      setMensaje(err.message || 'No se pudo guardar el precio.');
    }
  }

  function detalleCelda(p: PrecioProveedor): string {
    const partes = [`Actualizado el ${formatoFecha(p.actualizadoEn)} (${haceDias(p.actualizadoEn)})`];
    if (p.origen === 'manual') {
      partes.push(
        p.ultimaCompra
          ? `Precio capturado a mano. Última compra: ${formatoMoneda(p.ultimaCompra.costo)} el ${formatoFecha(p.ultimaCompra.fecha)}`
          : 'Precio capturado a mano, todavía no se le ha comprado.'
      );
    } else {
      partes.push('Precio de la última compra.');
    }
    return partes.join('\n');
  }

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 960, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Tabla de precios</h2>
          <button onClick={onCerrar}>Cerrar</button>
        </div>

        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
          Precio por kg de cada proveedor, solo los actualizados en los últimos 10 días. Parte del costo de la última compra y se actualiza solo al registrar una
          compra nueva; toca cualquier celda para cambiarlo si el proveedor te avisa de otro precio. En{' '}
          <span style={{ background: '#dcfce7', color: '#166534', fontWeight: 600, padding: '0 4px', borderRadius: 4 }}>verde</span>{' '}
          el mejor precio de cada producto, y con ✎ los capturados a mano (distintos a la última compra).
        </p>

        {mensaje && <div className="banner-mensaje" style={{ marginBottom: 0 }} onClick={() => setMensaje(null)}>{mensaje}</div>}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="buscador"
            placeholder="Filtrar la tabla..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            style={{ flex: '1 1 180px', width: 'auto' }}
          />
          {proveedoresSinColumna.length > 0 && (
            <select
              value=""
              onChange={(e) => e.target.value && setColumnasExtra([...columnasExtra, e.target.value])}
              style={{ flex: '0 1 200px' }}
            >
              <option value="">+ Agregar proveedor...</option>
              {proveedoresSinColumna.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <CampoConLista valor={productoNuevo} onCambio={setProductoNuevo} opciones={opcionesProducto} placeholder="Producto a agregar..." />
          <CampoConLista valor={marcaNueva} onCambio={setMarcaNueva} opciones={opcionesMarca} placeholder="Marca..." />
          <button onClick={agregarRenglon} disabled={agregando} style={{ height: 40 }}>
            + Agregar
          </button>
        </div>

        {cargando ? (
          <p style={{ textAlign: 'center', color: '#6b7280' }}>Cargando...</p>
        ) : filas.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#6b7280' }}>
            No hay precios de los últimos 10 días. Agrega un producto y un proveedor para empezar, o registra una compra.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)' }}>
            <div />
            <div
              ref={barraArribaRef}
              className="deslizador-tabla"
              onScroll={(e) => sincronizar(e.currentTarget)}
              style={{ overflowX: 'scroll', overflowY: 'hidden', display: medidas.desbordaX ? undefined : 'none' }}
            >
              <div style={{ width: medidas.ancho, height: 1 }} />
            </div>
            <div
              ref={barraIzquierdaRef}
              className="deslizador-tabla"
              onScroll={(e) => sincronizar(e.currentTarget)}
              style={{ overflowY: 'scroll', overflowX: 'hidden', maxHeight: '60vh', display: medidas.desbordaY ? undefined : 'none' }}
            >
              <div style={{ height: medidas.alto, width: 1 }} />
            </div>
            <div
              ref={contenedorRef}
              className="deslizador-tabla"
              onScroll={(e) => sincronizar(e.currentTarget)}
              style={{ overflow: 'auto', maxHeight: '60vh', gridColumn: 2 }}
            >
            <table ref={tablaRef} style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', fontSize: 14, color: '#1c1c1e' }}>
              <thead>
                <tr>
                  <th ref={thProductoRef} style={{ ...celdaEncabezado, borderLeft: BORDE, position: 'sticky', top: 0, left: 0, zIndex: 3 }}>Producto</th>
                  <th style={{ ...celdaEncabezado, position: 'sticky', top: 0, left: medidas.anchoProducto, zIndex: 3 }}>Marca</th>
                  {columnas.map((p) => (
                    <th key={p.id} style={{ ...celdaEncabezado, position: 'sticky', top: 0, zIndex: 2, textAlign: 'right' }}>{p.nombre}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filasVisibles.map((f) => {
                  const costos = columnas.map((p) => f.precios[p.id]?.costo).filter((c): c is number => c !== undefined);
                  const mejor = costos.length > 0 ? Math.min(...costos) : null;
                  return (
                    <tr key={f.varianteId}>
                      <td style={{ ...celdaBase, borderLeft: BORDE, position: 'sticky', left: 0, zIndex: 1, background: '#fff', fontWeight: 500 }}>{f.producto}</td>
                      <td style={{ ...celdaBase, position: 'sticky', left: medidas.anchoProducto, zIndex: 1, background: '#fff' }}>{f.marca}</td>
                      {columnas.map((p) => {
                        const precio = f.precios[p.id];
                        const enEdicion = editando?.varianteId === f.varianteId && editando.proveedorId === p.id;
                        const esMejor = !!precio && precio.costo === mejor;
                        if (enEdicion) {
                          return (
                            <td key={p.id} style={{ ...celdaBase, padding: 2 }}>
                              <input
                                type="number"
                                inputMode="decimal"
                                autoFocus
                                value={valorEdicion}
                                onChange={(e) => setValorEdicion(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                onBlur={guardarEdicion}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.currentTarget.blur();
                                  if (e.key === 'Escape') setEditando(null);
                                }}
                                style={{ width: 86, textAlign: 'right', padding: '6px 8px', borderRadius: 6 }}
                              />
                            </td>
                          );
                        }
                        return (
                          <td
                            key={p.id}
                            onClick={() => empezarEdicion(f.varianteId, p.id, precio)}
                            title={precio ? detalleCelda(precio) : 'Toca para capturar un precio'}
                            style={{
                              ...celdaBase,
                              textAlign: 'right',
                              cursor: 'pointer',
                              minWidth: 90,
                              background: esMejor ? '#dcfce7' : undefined,
                            }}
                          >
                            {precio && (
                              <>
                                <div style={{ fontWeight: esMejor ? 700 : 400, color: esMejor ? '#166534' : undefined }}>
                                  {precio.origen === 'manual' && <span style={{ fontSize: 11, marginRight: 4 }}>✎</span>}
                                  {formatoMoneda(precio.costo)}
                                </div>
                                <div style={{ fontSize: 11, color: '#6b7280' }}>{fechaCorta(precio.actualizadoEn)}</div>
                              </>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
