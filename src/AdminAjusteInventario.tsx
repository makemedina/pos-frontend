import { useEffect, useState } from 'react';
import {
  buscarVariantes,
  obtenerLotesDeVariante,
  registrarAjusteInventario,
  type VarianteBusqueda,
  type LoteInventario,
} from './api';

interface Props {
  onCerrar: () => void;
  // Si se entra desde el detalle de un producto (pantalla de Productos),
  // ya sabemos que variante es -- se salta el paso de busqueda.
  varianteInicial?: { id: string; producto: string; marca: string };
}

type Tipo = 'merma' | 'correccion_positiva' | 'correccion_negativa';

const ETIQUETAS_TIPO: Record<Tipo, string> = {
  merma: 'Merma (se perdio producto)',
  correccion_negativa: 'Correccion negativa (habia menos de lo registrado)',
  correccion_positiva: 'Correccion positiva (habia mas de lo registrado)',
};

export function AdminAjusteInventario({ onCerrar, varianteInicial }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<VarianteBusqueda[]>([]);
  const [varianteElegida, setVarianteElegida] = useState<VarianteBusqueda | null>(
    varianteInicial
      ? { id: varianteInicial.id, marca: varianteInicial.marca, producto: { id: '', nombre: varianteInicial.producto } }
      : null
  );

  const [lotes, setLotes] = useState<LoteInventario[]>([]);
  const [loteElegido, setLoteElegido] = useState<LoteInventario | null>(null);

  const [tipo, setTipo] = useState<Tipo>('merma');
  const [cantidad, setCantidad] = useState(0);
  const [motivo, setMotivo] = useState('');
  const [autorizadoPorTelefono, setAutorizadoPorTelefono] = useState('');
  const [autorizadoPin, setAutorizadoPin] = useState('');

  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (varianteInicial) {
      obtenerLotesDeVariante(varianteInicial.id).then(setLotes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const esSalida = tipo === 'merma' || tipo === 'correccion_negativa';
  const excedeDisponible = !!loteElegido && esSalida && cantidad > loteElegido.cantidadDisponible;

  const impactoEstimado =
    loteElegido && cantidad > 0
      ? (tipo === 'correccion_positiva' ? 1 : -1) * cantidad * loteElegido.costoUnitario
      : 0;

  async function buscar(valor: string) {
    setBusqueda(valor);
    if (valor.length < 2) {
      setResultados([]);
      return;
    }
    setResultados(await buscarVariantes(valor));
  }

  async function elegirVariante(v: VarianteBusqueda) {
    setVarianteElegida(v);
    setResultados([]);
    setBusqueda('');
    setLoteElegido(null);
    const data = await obtenerLotesDeVariante(v.id);
    setLotes(data);
  }

  function cambiarVariante() {
    setVarianteElegida(null);
    setLotes([]);
    setLoteElegido(null);
  }

  async function confirmar() {
    setError(null);
    if (!loteElegido || cantidad <= 0 || !motivo.trim()) {
      setError('Completa el lote, la cantidad y el motivo.');
      return;
    }
    if (excedeDisponible) {
      setError(`No puedes dar de baja mas de lo disponible (${loteElegido.cantidadDisponible} kg).`);
      return;
    }
    if (!autorizadoPorTelefono.trim() || !autorizadoPin.trim()) {
      setError('Un ajuste de inventario siempre necesita autorizacion: pide el telefono y PIN del administrador.');
      return;
    }

    setGuardando(true);
    try {
      await registrarAjusteInventario({
        loteId: loteElegido.id,
        tipo,
        cantidad,
        motivo: motivo.trim(),
        autorizadoPorTelefono: autorizadoPorTelefono.trim(),
        autorizadoPin: autorizadoPin.trim(),
      });
      setMensaje('Ajuste registrado correctamente.');
      // Reinicia el formulario para poder capturar otro ajuste sin cerrar.
      // Si se entro con una variante preseleccionada (desde Productos), la
      // mantenemos -- solo refrescamos sus lotes con el stock actualizado.
      if (varianteInicial) {
        setLotes(await obtenerLotesDeVariante(varianteInicial.id));
      } else {
        setVarianteElegida(null);
        setLotes([]);
      }
      setLoteElegido(null);
      setCantidad(0);
      setMotivo('');
      setAutorizadoPorTelefono('');
      setAutorizadoPin('');
    } catch (err: any) {
      if (err.code === 'REQUIERE_AUTORIZACION') {
        setError('El telefono o el PIN de autorizacion no son validos.');
      } else if (err.code === 'STOCK_INSUFICIENTE') {
        setError(err.error || 'No hay suficiente stock en ese lote para dar de baja esa cantidad.');
      } else {
        setError('No se pudo registrar el ajuste.');
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 480, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Ajuste de inventario</h2>
          <button onClick={onCerrar}>Cerrar</button>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        <label className="etiqueta">Producto</label>
        {varianteElegida ? (
          <div className="cliente-chip">
            <span>{varianteElegida.producto.nombre} · {varianteElegida.marca}</span>
            {!varianteInicial && <button onClick={cambiarVariante}>Cambiar</button>}
          </div>
        ) : (
          <>
            <input
              className="buscador"
              placeholder="Buscar por producto o marca"
              value={busqueda}
              onChange={(e) => buscar(e.target.value)}
            />
            {resultados.map((v) => (
              <div key={v.id} className="resultado-cliente" onClick={() => elegirVariante(v)}>
                {v.producto.nombre} · {v.marca}
              </div>
            ))}
          </>
        )}

        {varianteElegida && (
          <>
            <label className="etiqueta">Lote</label>
            {lotes.length === 0 && <p style={{ fontSize: 13, color: '#6b7280' }}>Este producto no tiene lotes registrados.</p>}
            <div className="lista-items-compra">
              {lotes.map((l) => (
                <div
                  key={l.id}
                  className="item-compra"
                  style={{
                    cursor: 'pointer',
                    background: loteElegido?.id === l.id ? '#f0f7ff' : undefined,
                    borderRadius: 14,
                  }}
                  onClick={() => setLoteElegido(l)}
                >
                  <div>
                    <p className="item-nombre">{new Date(l.fechaIngreso).toLocaleDateString()}</p>
                    <p className="item-detalle">
                      Costo ${l.costoUnitario.toFixed(2)}/kg · Disponible {l.cantidadDisponible} kg de {l.cantidadInicial} kg
                    </p>
                  </div>
                  {loteElegido?.id === l.id && <span>✓</span>}
                </div>
              ))}
            </div>
          </>
        )}

        {loteElegido && (
          <>
            <label className="etiqueta">Tipo de ajuste</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
              {Object.entries(ETIQUETAS_TIPO).map(([valor, texto]) => (
                <option key={valor} value={valor}>{texto}</option>
              ))}
            </select>

            <label className="etiqueta">Cantidad (kg)</label>
            <input
              type="number"
              step="0.1"
              value={cantidad || ''}
              onChange={(e) => setCantidad(Number(e.target.value))}
            />
            {excedeDisponible && (
              <div className="aviso-alerta">
                Ese lote solo tiene {loteElegido.cantidadDisponible} kg disponibles.
              </div>
            )}

            <label className="etiqueta">Motivo</label>
            <input
              placeholder="Ej. se descompuso, error al capturar la compra..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />

            {cantidad > 0 && (
              <div className="linea-resumen">
                <span>Impacto estimado en utilidad</span>
                <strong className={impactoEstimado < 0 ? 'texto-alerta' : ''}>
                  ${impactoEstimado.toFixed(2)}
                </strong>
              </div>
            )}

            <div className="bloque-autorizacion">
              <p className="texto-alerta">
                Todo ajuste de inventario necesita autorizacion. Llama al administrador
                para que te dicte su telefono y su PIN.
              </p>
              <label className="etiqueta">Telefono del administrador</label>
              <input
                placeholder="Telefono de quien autoriza"
                value={autorizadoPorTelefono}
                onChange={(e) => setAutorizadoPorTelefono(e.target.value)}
              />
              <label className="etiqueta">PIN del administrador</label>
              <input
                type="password"
                placeholder="PIN dictado por el administrador"
                value={autorizadoPin}
                onChange={(e) => setAutorizadoPin(e.target.value)}
              />
            </div>

            {error && <div className="aviso-alerta">{error}</div>}

            <button className="boton-primario" disabled={guardando} onClick={confirmar}>
              {guardando ? 'Guardando...' : 'Registrar ajuste'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
