import { useState } from 'react';
import type { VarianteCatalogo } from './api';
import type { ItemCarrito } from './Carrito';

interface Props {
  variante: VarianteCatalogo;
  cantidadYaEnCarrito: number;
  onAgregar: (item: ItemCarrito) => void;
  onCerrar: () => void;
}

export function ModalAgregarProducto({ variante, cantidadYaEnCarrito, onAgregar, onCerrar }: Props) {
  const disponibleReal = Math.max(0, variante.stockDisponible - cantidadYaEnCarrito);
  const [cantidad, setCantidad] = useState(Math.min(1, disponibleReal || 1));
  const [precio, setPrecio] = useState(variante.precioVenta);

  const bajoCosto =
    variante.costoLoteMasViejo !== null && precio < variante.costoLoteMasViejo;
  const excedeStock = cantidad > disponibleReal;
  const subtotal = cantidad * precio;

  function ajustarCantidad(nueva: number) {
    setCantidad(Math.max(0.1, +nueva.toFixed(1)));
  }

  function agregar() {
    if (cantidad <= 0 || excedeStock || disponibleReal <= 0) return;
    onAgregar({
      varianteId: variante.id,
      producto: variante.producto,
      marca: variante.marca,
      cantidad,
      precioUnitario: precio,
      costoLote: variante.costoLoteMasViejo,
    });
    onCerrar();
  }

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal-contenido" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="titulo">{variante.producto}</p>
            <p className="subtitulo">{variante.marca}</p>
          </div>
          <button className="boton-cerrar" onClick={onCerrar}>✕</button>
        </div>

        <p style={{ fontSize: 13, color: '#6b7280' }}>
          Disponible: <strong>{disponibleReal.toFixed(1)} kg</strong>
          {cantidadYaEnCarrito > 0 && ` (ya tienes ${cantidadYaEnCarrito.toFixed(1)} kg de este producto en la nota)`}
        </p>

        {disponibleReal <= 0 ? (
          <div className="aviso-alerta">No hay stock disponible de este producto.</div>
        ) : (
          <>
            <label className="etiqueta">Cantidad (kg)</label>
            <div className="control-cantidad">
              <button onClick={() => ajustarCantidad(cantidad - 0.1)}>−</button>
              <input
                type="number"
                step="0.1"
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value))}
              />
              <button onClick={() => ajustarCantidad(cantidad + 0.1)}>+</button>
            </div>

            {excedeStock && (
              <div className="aviso-alerta">
                Solo hay {disponibleReal.toFixed(1)} kg disponibles de este producto.
              </div>
            )}

            <label className="etiqueta">Precio por kg</label>
            <div className={`campo-precio ${bajoCosto ? 'alerta' : ''}`}>
              <span>$</span>
              <input
                type="number"
                step="0.1"
                value={precio}
                onChange={(e) => setPrecio(Number(e.target.value))}
              />
            </div>

            {bajoCosto && (
              <div className="aviso-alerta">
                Precio por debajo del costo (${variante.costoLoteMasViejo}/kg). Se
                necesitara autorizacion de un administrador para completar esta
                venta.
              </div>
            )}

            <div className="subtotal-linea">
              <span>Subtotal</span>
              <strong>${subtotal.toFixed(2)}</strong>
            </div>

            <button className="boton-primario" onClick={agregar} disabled={excedeStock || cantidad <= 0}>
              {bajoCosto ? 'Agregar (requerira autorizacion)' : 'Agregar a la nota'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
