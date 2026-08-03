import { useState } from 'react';
import {
  buscarProveedores,
  crearProveedorRapido,
  buscarProductos,
  obtenerVariantesDeProducto,
  crearVarianteRapida,
  registrarCompra,
  type Proveedor,
  type Producto,
  type VarianteExistente,
} from './api';

interface ItemCompraLocal {
  varianteId: string;
  nombreMostrar: string;
  cantidad: number;
  costoUnitario: number;
}

interface Props {
  onCompletada: (mensaje: string) => void;
  onCerrar: () => void;
}

export function PantallaCompra({ onCompletada, onCerrar }: Props) {
  const [busquedaProveedor, setBusquedaProveedor] = useState('');
  const [resultadosProveedor, setResultadosProveedor] = useState<Proveedor[]>([]);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<Proveedor | null>(null);
  const [altaProveedor, setAltaProveedor] = useState(false);
  const [nombreProveedorNuevo, setNombreProveedorNuevo] = useState('');

  const [numeroFactura, setNumeroFactura] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [pagoInicial, setPagoInicial] = useState(0);

  const [items, setItems] = useState<ItemCompraLocal[]>([]);
  const [mostrarBuscadorProducto, setMostrarBuscadorProducto] = useState(false);

  const total = items.reduce((acc, i) => acc + i.cantidad * i.costoUnitario, 0);
  const saldoPendiente = total - pagoInicial;

  async function buscarProv(valor: string) {
    setBusquedaProveedor(valor);
    if (valor.length < 2) {
      setResultadosProveedor([]);
      return;
    }
    setResultadosProveedor(await buscarProveedores(valor));
  }

  async function guardarProveedorNuevo() {
    if (!nombreProveedorNuevo) return;
    const p = await crearProveedorRapido(nombreProveedorNuevo);
    setProveedorSeleccionado(p);
    setAltaProveedor(false);
  }

  function agregarItem(item: ItemCompraLocal) {
    setItems((prev) => [...prev, item]);
    setMostrarBuscadorProducto(false);
  }

  function quitarItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function guardar() {
    if (!proveedorSeleccionado || items.length === 0) return;

    await registrarCompra({
      proveedorId: proveedorSeleccionado.id,
      numeroFactura: numeroFactura || undefined,
      fechaVencimiento: fechaVencimiento || undefined,
      items: items.map((i) => ({
        varianteId: i.varianteId,
        cantidad: i.cantidad,
        costoUnitario: i.costoUnitario,
      })),
      pagoInicial: pagoInicial || undefined,
    });

    onCompletada(`Compra registrada por $${total.toFixed(2)}`);
  }

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal-contenido" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <p className="titulo">Nueva compra</p>
          <button className="boton-cerrar" onClick={onCerrar}>X</button>
        </div>

        <label className="etiqueta">Proveedor</label>
        {proveedorSeleccionado ? (
          <div className="cliente-chip">
            <span>{proveedorSeleccionado.nombre}</span>
            <button onClick={() => setProveedorSeleccionado(null)}>Cambiar</button>
          </div>
        ) : (
          <>
            <input
              className="buscador"
              placeholder="Buscar proveedor"
              value={busquedaProveedor}
              onChange={(e) => buscarProv(e.target.value)}
            />
            {resultadosProveedor.map((p) => (
              <div
                key={p.id}
                className="resultado-cliente"
                onClick={() => {
                  setProveedorSeleccionado(p);
                  setResultadosProveedor([]);
                  setBusquedaProveedor('');
                }}
              >
                {p.nombre}
              </div>
            ))}
            {busquedaProveedor.length >= 2 && resultadosProveedor.length === 0 && !altaProveedor && (
              <button className="boton-secundario" onClick={() => setAltaProveedor(true)}>
                + Crear proveedor nuevo
              </button>
            )}
            {altaProveedor && (
              <div className="alta-rapida">
                <input
                  placeholder="Nombre del proveedor"
                  value={nombreProveedorNuevo}
                  onChange={(e) => setNombreProveedorNuevo(e.target.value)}
                />
                <button className="boton-primario" onClick={guardarProveedorNuevo}>
                  Guardar proveedor
                </button>
              </div>
            )}
          </>
        )}

        <div className="fila-dos-columnas">
          <div>
            <label className="etiqueta">No. de factura</label>
            <input
              placeholder="Opcional"
              value={numeroFactura}
              onChange={(e) => setNumeroFactura(e.target.value)}
            />
          </div>
          <div>
            <label className="etiqueta">Vence</label>
            <input
              type="date"
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
            />
          </div>
        </div>

        <label className="etiqueta">Productos</label>
        <div className="lista-items-compra">
          {items.map((item, idx) => (
            <div key={idx} className="item-compra">
              <div>
                <p className="item-nombre">{item.nombreMostrar}</p>
                <p className="item-detalle">
                  {item.cantidad} kg x ${item.costoUnitario}/kg
                </p>
              </div>
              <div className="item-derecha">
                <span>${(item.cantidad * item.costoUnitario).toFixed(2)}</span>
                <button onClick={() => quitarItem(idx)}>X</button>
              </div>
            </div>
          ))}
          <button className="boton-secundario" onClick={() => setMostrarBuscadorProducto(true)}>
            + Agregar producto
          </button>
        </div>

        <label className="etiqueta">Pago inicial (opcional)</label>
        <div className="campo-precio">
          <span>$</span>
          <input
            type="number"
            value={pagoInicial}
            onChange={(e) => setPagoInicial(Number(e.target.value))}
          />
        </div>

        <div className="subtotal-linea">
          <div>
            <p>Total de la compra</p>
            {saldoPendiente > 0 && (
              <p className="texto-alerta" style={{ fontSize: 12 }}>
                Queda pendiente: ${saldoPendiente.toFixed(2)}
              </p>
            )}
          </div>
          <strong>${total.toFixed(2)}</strong>
        </div>

        <button
          className="boton-primario"
          disabled={!proveedorSeleccionado || items.length === 0}
          onClick={guardar}
        >
          Registrar compra
        </button>
      </div>

      {mostrarBuscadorProducto && (
        <BuscadorProductoCompra
          onAgregar={agregarItem}
          onCerrar={() => setMostrarBuscadorProducto(false)}
        />
      )}
    </div>
  );
}

type Paso = 'corte' | 'marca' | 'cantidad';

function BuscadorProductoCompra({
  onAgregar,
  onCerrar,
}: {
  onAgregar: (item: ItemCompraLocal) => void;
  onCerrar: () => void;
}) {
  const [paso, setPaso] = useState<Paso>('corte');

  const [busquedaCorte, setBusquedaCorte] = useState('');
  const [resultadosCorte, setResultadosCorte] = useState<Producto[]>([]);
  const [corteElegido, setCorteElegido] = useState<Producto | null>(null);
  const [corteNuevoNombre, setCorteNuevoNombre] = useState('');

  const [marcasExistentes, setMarcasExistentes] = useState<VarianteExistente[]>([]);
  const [crearMarcaNueva, setCrearMarcaNueva] = useState(false);
  const [marcaNueva, setMarcaNueva] = useState('');
  const [precioVentaNueva, setPrecioVentaNueva] = useState(0);

  const [varianteId, setVarianteId] = useState<string | null>(null);
  const [nombreMostrar, setNombreMostrar] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [costo, setCosto] = useState(0);

  async function buscarCorte(valor: string) {
    setBusquedaCorte(valor);
    setCorteNuevoNombre(valor);
    if (valor.length < 2) {
      setResultadosCorte([]);
      return;
    }
    setResultadosCorte(await buscarProductos(valor));
  }

  async function elegirCorteExistente(p: Producto) {
    setCorteElegido(p);
    const marcas = await obtenerVariantesDeProducto(p.id);
    setMarcasExistentes(marcas);
    setPaso('marca');
  }

  function elegirCorteNuevo() {
    setCorteElegido(null);
    setMarcasExistentes([]);
    setCrearMarcaNueva(true);
    setPaso('marca');
  }

  function elegirMarcaExistente(v: VarianteExistente) {
    setVarianteId(v.id);
    setNombreMostrar(corteElegido?.nombre + ' - ' + v.marca);
    setPaso('cantidad');
  }

  async function crearMarcaYContinuar() {
    if (!marcaNueva || !precioVentaNueva) return;
    const nombreCorte = corteElegido?.nombre ?? corteNuevoNombre;
    const nueva = await crearVarianteRapida(nombreCorte, marcaNueva, precioVentaNueva);
    setVarianteId(nueva.id);
    setNombreMostrar(nombreCorte + ' - ' + marcaNueva);
    setPaso('cantidad');
  }

  function confirmar() {
    if (!varianteId || cantidad <= 0 || costo <= 0) return;
    onAgregar({ varianteId, nombreMostrar, cantidad, costoUnitario: costo });
  }

  return (
    <div className="modal-fondo" onClick={onCerrar} style={{ zIndex: 20 }}>
      <div className="modal-contenido" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <p className="titulo">Agregar producto</p>
          <button className="boton-cerrar" onClick={onCerrar}>X</button>
        </div>

        {paso === 'corte' && (
          <>
            <label className="etiqueta">Corte</label>
            <input
              className="buscador"
              placeholder="Ej. Pierna de cerdo"
              value={busquedaCorte}
              onChange={(e) => buscarCorte(e.target.value)}
            />
            {resultadosCorte.map((p) => (
              <div key={p.id} className="resultado-cliente" onClick={() => elegirCorteExistente(p)}>
                {p.nombre}
              </div>
            ))}
            {busquedaCorte.length >= 2 && (
              <button className="boton-secundario" onClick={elegirCorteNuevo}>
                + es un corte nuevo
              </button>
            )}
          </>
        )}

        {paso === 'marca' && (
          <>
            <div className="cliente-chip">
              <span>{corteElegido?.nombre ?? corteNuevoNombre}</span>
              <button onClick={() => setPaso('corte')}>Cambiar</button>
            </div>

            {marcasExistentes.length > 0 && !crearMarcaNueva && (
              <>
                <label className="etiqueta">Marca</label>
                <div className="lista-marcas">
                  {marcasExistentes.map((v) => (
                    <div key={v.id} className="chip-marca" onClick={() => elegirMarcaExistente(v)}>
                      {v.marca}
                    </div>
                  ))}
                  <div className="chip-marca chip-nueva" onClick={() => setCrearMarcaNueva(true)}>
                    + Nueva marca
                  </div>
                </div>
              </>
            )}

            {(crearMarcaNueva || marcasExistentes.length === 0) && (
              <div className="alta-rapida">
                <label className="etiqueta">Marca nueva</label>
                <input
                  placeholder="Ej. Yoreme"
                  value={marcaNueva}
                  onChange={(e) => setMarcaNueva(e.target.value)}
                />
                <label className="etiqueta">Precio de venta sugerido /kg</label>
                <div className="campo-precio">
                  <span>$</span>
                  <input
                    type="number"
                    value={precioVentaNueva || ''}
                    onChange={(e) => setPrecioVentaNueva(Number(e.target.value))}
                  />
                </div>
                <button className="boton-primario" onClick={crearMarcaYContinuar}>
                  Crear marca y continuar
                </button>
                {marcasExistentes.length > 0 && (
                  <button className="boton-secundario" onClick={() => setCrearMarcaNueva(false)}>
                    Volver a marcas existentes
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {paso === 'cantidad' && (
          <>
            <div className="cliente-chip">
              <span>{nombreMostrar}</span>
              <button onClick={() => setPaso('marca')}>Cambiar</button>
            </div>

            <div className="fila-dos-columnas">
              <div>
                <label className="etiqueta">Cantidad (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={cantidad}
                  onChange={(e) => setCantidad(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="etiqueta">Costo /kg</label>
                <div className="campo-precio">
                  <span>$</span>
                  <input
                    type="number"
                    value={costo || ''}
                    onChange={(e) => setCosto(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <button className="boton-primario" onClick={confirmar}>
              Agregar a la compra
            </button>
          </>
        )}
      </div>
    </div>
  );
}