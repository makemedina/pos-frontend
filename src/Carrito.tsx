import { formatoMoneda } from './formato';

export interface ItemCarrito {
  varianteId: string;
  producto: string;
  marca: string;
  cantidad: number;
  precioUnitario: number;
  costoLote: number | null;
}

interface Props {
  items: ItemCarrito[];
  onCobrar: () => void;
  onEliminar: (index: number) => void;
}

export function Carrito({ items, onCobrar, onEliminar }: Props) {
  const total = items.reduce((acc, i) => acc + i.cantidad * i.precioUnitario, 0);

  if (items.length === 0) return null;

  return (
    <div className="barra-carrito">
      <div className="carrito-detalle">
        {items.map((item, index) => (
          <div key={`${item.varianteId}-${index}`} className="linea-carrito">
            <div>
              <strong>{item.producto}</strong>
              <div className="detalle-pequenio">
                {item.marca} · {item.cantidad.toFixed(1)} kg · {formatoMoneda(item.precioUnitario)}
              </div>
            </div>
            <button className="boton-quitar" onClick={() => onEliminar(index)}>
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="carrito-resumen">
        <span>{items.length} producto{items.length !== 1 ? 's' : ''} en la nota</span>
        <strong>Total: {formatoMoneda(total)}</strong>
      </div>
      <button className="boton-primario" onClick={onCobrar}>
        Cobrar
      </button>
    </div>
  );
}
