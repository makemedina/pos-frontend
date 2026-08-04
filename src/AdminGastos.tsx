import { useEffect, useState } from 'react';
import { formatoMoneda } from './formato';
import { headerAuth, API_URL, buscarProveedores, crearProveedorRapido, type Proveedor } from './api';
import { exportarAExcel } from './exportarExcel';

interface CategoriaGasto {
  id: string;
  nombre: string;
  departamento: string;
}

interface Gasto {
  id: string;
  concepto: string;
  monto: number;
  metodoPago: string;
  fecha: string;
  categoria: CategoriaGasto;
  proveedor: { nombre: string } | null;
  registradoPor: { nombre: string };
  cancelado: boolean;
  canceladoEn: string | null;
}

interface Props {
  onCerrar: () => void;
}

const DEPARTAMENTOS = ['Operativos', 'Administrativos', 'Recursos Humanos', 'Financieros'];

export function AdminGastos({ onCerrar }: Props) {
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [categoriaId, setCategoriaId] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [busquedaProveedor, setBusquedaProveedor] = useState('');
  const [resultadosProveedor, setResultadosProveedor] = useState<Proveedor[]>([]);
  const [proveedorElegido, setProveedorElegido] = useState<Proveedor | null>(null);

  const [mostrarNuevaCategoria, setMostrarNuevaCategoria] = useState(false);
  const [nombreCategoriaNueva, setNombreCategoriaNueva] = useState('');
  const [departamentoNuevo, setDepartamentoNuevo] = useState(DEPARTAMENTOS[0]);

  const [pestana, setPestana] = useState<'registrar' | 'historico'>('registrar');
  const [busquedaGasto, setBusquedaGasto] = useState('');

  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [necesitaAutorizacion, setNecesitaAutorizacion] = useState(false);
  const [autorizadoPorTelefono, setAutorizadoPorTelefono] = useState('');
  const [autorizadoPin, setAutorizadoPin] = useState('');
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    try {
      const [catRes, gastoRes] = await Promise.all([
        fetch(`${API_URL}/gastos/categorias`, { headers: headerAuth() }),
        fetch(`${API_URL}/gastos`, { headers: headerAuth() }),
      ]);
      const categoriasData = await catRes.json();
      const gastosData = await gastoRes.json();
      setCategorias(categoriasData);
      setGastos(gastosData);
      if (categoriasData[0] && !categoriasData.some((c: CategoriaGasto) => c.id === categoriaId)) {
        setCategoriaId(categoriasData[0].id);
      }
    } catch {
      setMensaje('No se pudo cargar los gastos');
    }
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
    if (!nombreCategoriaNueva.trim()) return;
    try {
      const res = await fetch(`${API_URL}/gastos/categorias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headerAuth() },
        body: JSON.stringify({ nombre: nombreCategoriaNueva.trim(), departamento: departamentoNuevo }),
      });
      if (!res.ok) throw new Error();
      const nueva = await res.json();
      setCategorias((prev) => [...prev, nueva]);
      setCategoriaId(nueva.id);
      setNombreCategoriaNueva('');
      setMostrarNuevaCategoria(false);
    } catch {
      setMensaje('No se pudo crear la categoría.');
    }
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
      setMensaje('Gasto cancelado.');
      setConfirmandoId(null);
      setNecesitaAutorizacion(false);
      setAutorizadoPorTelefono('');
      setAutorizadoPin('');
      cargar();
    } finally {
      setCancelando(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoriaId) {
      setMensaje('Elige una categoría antes de guardar.');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/gastos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headerAuth() },
        body: JSON.stringify({
          categoriaId,
          proveedorId: proveedorElegido?.id,
          concepto,
          monto: Number(monto),
          metodoPago,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar');
      setMensaje('Gasto registrado');
      setConcepto('');
      setMonto('');
      setProveedorElegido(null);
      cargar();
    } catch (err: any) {
      setMensaje(err.message || 'No se pudo registrar el gasto');
    }
  }

  async function exportar() {
    try {
      await exportarAExcel(
        gastosFiltrados.map((g) => ({
          Fecha: new Date(g.fecha).toLocaleString(),
          Concepto: g.concepto,
          Categoria: g.categoria.nombre,
          Departamento: g.categoria.departamento,
          Proveedor: g.proveedor?.nombre || '',
          Monto: Number(g.monto),
          'Metodo de pago': g.metodoPago,
          'Registrado por': g.registradoPor.nombre,
        })),
        'gastos'
      );
    } catch {
      setMensaje('No hay gastos para exportar.');
    }
  }

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
      (g.proveedor?.nombre || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Gastos</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {pestana === 'historico' && <button onClick={exportar}>📊 Exportar Excel</button>}
            <button onClick={onCerrar}>Cerrar</button>
          </div>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e5e5ea' }}>
          {(['registrar', 'historico'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPestana(p)}
              style={{
                background: 'none',
                border: 'none',
                padding: '8px 4px',
                borderBottom: pestana === p ? '2px solid #007aff' : '2px solid transparent',
                fontWeight: pestana === p ? 700 : 400,
                color: pestana === p ? '#007aff' : '#374151',
              }}
            >
              {p === 'registrar' ? 'Registrar' : 'Histórico'}
            </button>
          ))}
        </div>

        {pestana === 'registrar' && (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.75rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
            <h3>Registrar gasto</h3>
            <input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Concepto" required />
            <input value={monto} onChange={(e) => setMonto(e.target.value)} type="number" step="0.01" placeholder="Monto" required />
            <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
            </select>

            <label className="etiqueta">Categoría</label>
            {!mostrarNuevaCategoria ? (
              <>
                <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                  {Object.entries(categoriasPorDepartamento).map(([departamento, cats]) => (
                    <optgroup key={departamento} label={departamento}>
                      {cats.map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button type="button" className="boton-secundario" onClick={() => setMostrarNuevaCategoria(true)} style={{ width: '100%', marginTop: 0 }}>
                  + Nueva categoría
                </button>
              </>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                <input
                  placeholder="Nombre de la categoría"
                  value={nombreCategoriaNueva}
                  onChange={(e) => setNombreCategoriaNueva(e.target.value)}
                />
                <select value={departamentoNuevo} onChange={(e) => setDepartamentoNuevo(e.target.value)}>
                  {DEPARTAMENTOS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={crearCategoriaNueva}>Guardar categoría</button>
                  <button type="button" onClick={() => setMostrarNuevaCategoria(false)}>Cancelar</button>
                </div>
              </div>
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
                  <button type="button" className="boton-secundario" onClick={crearProveedorDesdeGasto} style={{ width: '100%', marginTop: 0 }}>
                    + Agregar "{busquedaProveedor}" como proveedor nuevo
                  </button>
                )}
              </>
            )}

            <button type="submit">Guardar gasto</button>
          </form>
        )}

        {pestana === 'historico' && (
          <>
            <input
              className="buscador"
              placeholder="Buscar por concepto, categoría o proveedor"
              value={busquedaGasto}
              onChange={(e) => setBusquedaGasto(e.target.value)}
            />
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {gastosFiltrados.length === 0 && <p style={{ color: '#6b7280' }}>No hay gastos que coincidan.</p>}
              {gastosFiltrados.map((gasto) => (
                <div key={gasto.id} style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <strong>{gasto.concepto}</strong>
                      <div>{gasto.categoria.nombre}</div>
                      {gasto.proveedor && <div style={{ fontSize: 12, color: '#6b7280' }}>Proveedor: {gasto.proveedor.nombre}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div>{formatoMoneda(Number(gasto.monto))}</div>
                      <small>{gasto.registradoPor.nombre}</small>
                    </div>
                  </div>

                  {gasto.cancelado ? (
                    <div className="aviso-alerta" style={{ marginTop: 8 }}>
                      ❌ Cancelado{gasto.canceladoEn ? ` el ${new Date(gasto.canceladoEn).toLocaleString()}` : ''}
                    </div>
                  ) : confirmandoId === gasto.id ? (
                    <div className="bloque-autorizacion" style={{ marginTop: 8 }}>
                      <p className="texto-alerta" style={{ fontWeight: 600 }}>
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
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button onClick={() => confirmarCancelacion(gasto.id)} disabled={cancelando} style={{ flex: 1 }}>
                          {cancelando ? 'Cancelando...' : 'Sí, cancelar'}
                        </button>
                        <button onClick={() => { setConfirmandoId(null); setNecesitaAutorizacion(false); }} style={{ flex: 1 }}>
                          No, regresar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="boton-secundario"
                      onClick={() => setConfirmandoId(gasto.id)}
                      style={{ width: '100%', marginTop: 8, background: '#fff2f1', color: '#b91c1c' }}
                    >
                      🗑️ Cancelar gasto
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
