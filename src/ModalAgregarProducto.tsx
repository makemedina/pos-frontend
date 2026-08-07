import { useState } from 'react';
import { formatoMoneda, formatoKg } from './formato';
import type { VarianteCatalogo } from './api';
import type { ItemCarrito } from './Carrito';

interface Props {
  variante: VarianteCatalogo;
  cantidadYaEnCarrito: number;
  ultimoPrecio?: { precioUnitario: number; fecha: string } | null;
  onAgregar: (item: ItemCarrito) => void;
  onCerrar: () => void;
}

export function ModalAgregarProducto({ variante, cantidadYaEnCarrito, ultimoPrecio, onAgregar, onCerrar }: Props) {
  const disponibleReal = Math.max(0, variante.stockDisponible - cantidadYaEnCarrito);
  const [cantidad, setCantidad] = useState(Math.min(1, disponibleReal || 1));
  const [precio, setPrecio] = useState(ultimoPrecio?.precioUnitario ?? variante.precioVenta);

  const bajoCosto =
    variante.costoLoteMasViejo !== null && precio < variante.costoLoteMasViejo;
  const excedeStock = cantidad > disponibleReal;
  const subtotal = cantidad * precio;

  function ajustarCantidad(nueva: number) {
    // Redondea a 3 decimales (la precision real que se guarda) solo para
    // limpiar el ruido de punto flotante de sumar/restar 0.1 repetidas
    // veces (ej. 0.1+0.1+0.1 = 0.30000000000000004) -- NO a 1 decimal,
    // que borraria un valor capturado a mano con mas precision.
    setCantidad(Math.max(0.001, Math.round(nueva * 1000) / 1000));
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
          Disponible: <strong>{formatoKg(disponibleReal)} kg</strong>
          {cantidadYaEnCarrito > 0 && ` (ya tienes ${formatoKg(cantidadYaEnCarrito)} kg de este producto en la nota)`}
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
                step="0.001"
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value))}
              />
              <button onClick={() => ajustarCantidad(cantidad + 0.1)}>+</button>
            </div>

            {excedeStock && (
              <div className="aviso-alerta">
                Solo hay {formatoKg(disponibleReal)} kg disponibles de este producto.
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

            {ultimoPrecio && (
              <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                Último precio a este cliente: {formatoMoneda(ultimoPrecio.precioUnitario)}/kg
                ({new Date(ultimoPrecio.fecha).toLocaleDateString()}) — precio de lista:{' '}
                {formatoMoneda(variante.precioVenta)}/kg
              </p>
            )}

            <div className="subtotal-linea">
              <span>Subtotal</span>
              <strong>{formatoMoneda(subtotal)}</strong>
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
