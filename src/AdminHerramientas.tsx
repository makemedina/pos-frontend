import { useState } from 'react';
import { API_URL, headerAuth } from './api';

interface Props {
  onCerrar: () => void;
}

interface FilaInventario {
  producto: string;
  marca: string;
  costo: number;
  precio: number;
  stock: number;
}

function parsearFilas(texto: string): FilaInventario[] {
  return texto
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((linea) => (linea.includes('\t') ? linea.split('\t') : linea.split(',')).map((p) => p.trim()))
    .filter((partes) => partes.length >= 5)
    .map((partes) => ({
      producto: partes[0],
      marca: partes[1],
      costo: Number(partes[2]),
      precio: Number(partes[3]),
      stock: Number(partes[4]),
    }))
    // Esto tambien descarta automaticamente una fila de encabezado
    // ("Producto, Marca, Costo, ...") porque Number('Costo') es NaN.
    .filter((f) => f.producto && f.marca && !isNaN(f.costo) && !isNaN(f.precio) && !isNaN(f.stock));
}

export function AdminHerramientas({ onCerrar }: Props) {
  const [mensaje, setMensaje] = useState<string | null>(null);

  // ---------- Reset de transacciones ----------
  const [confirmacionReset, setConfirmacionReset] = useState('');
  const [reseteando, setReseteando] = useState(false);
  const [mostrarReset, setMostrarReset] = useState(false);

  async function ejecutarReset() {
    if (confirmacionReset !== 'BORRAR TODO') return;
    setReseteando(true);
    try {
      const res = await fetch(`${API_URL}/admin/resetear-transacciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headerAuth() },
        body: JSON.stringify({ confirmacion: confirmacionReset }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo resetear.');
      setMensaje('Listo: ventas, compras, gastos, ajustes y cortes fueron borrados. Clientes, proveedores, productos y usuarios se conservaron.');
      setMostrarReset(false);
      setConfirmacionReset('');
    } catch (err: any) {
      setMensaje(err.message);
    } finally {
      setReseteando(false);
    }
  }

  // ---------- Carga de inventario inicial ----------
  const [textoInventario, setTextoInventario] = useState('');
  const [cargandoInventario, setCargandoInventario] = useState(false);

  const filasDetectadas = parsearFilas(textoInventario);

  async function cargarInventario() {
    if (filasDetectadas.length === 0) return;
    setCargandoInventario(true);
    try {
      const res = await fetch(`${API_URL}/admin/cargar-inventario-inicial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headerAuth() },
        body: JSON.stringify({ filas: filasDetectadas }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar el inventario.');
      setMensaje(`Se cargaron ${data.items.length} productos con su stock inicial.`);
      setTextoInventario('');
    } catch (err: any) {
      setMensaje(err.message);
    } finally {
      setCargandoInventario(false);
    }
  }

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Herramientas</h2>
          <button onClick={onCerrar}>Cerrar</button>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {/* ---------- Cargar inventario inicial ---------- */}
        <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14, display: 'grid', gap: '0.5rem' }}>
          <h3>📦 Cargar inventario inicial</h3>
          <p style={{ fontSize: 13, color: '#6b7280' }}>
            Pega las filas de tu tabla (Producto, Marca, Costo, Precio, Stock) — puedes pegar
            directo desde Excel/Sheets, o separadas por comas. Si el producto o la marca no
            existen, se crean automáticamente.
          </p>
          <textarea
            rows={10}
            placeholder={'Recorte de tocino\tOlymel\t42\t46\t353.86\nEsofago\tYoreme\t34\t45\t261.24\n...'}
            value={textoInventario}
            onChange={(e) => setTextoInventario(e.target.value)}
            style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
          />
          <button onClick={cargarInventario} disabled={cargandoInventario || filasDetectadas.length === 0}>
            {cargandoInventario ? 'Cargando...' : `Cargar ${filasDetectadas.length} producto(s)`}
          </button>
        </div>

        {/* ---------- Reset de transacciones (zona de peligro) ---------- */}
        <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14, display: 'grid', gap: '0.5rem', background: '#fff2f1' }}>
          <h3 style={{ color: '#b91c1c' }}>⚠️ Reiniciar transacciones</h3>
          <p style={{ fontSize: 13, color: '#7f1d1d' }}>
            Borra TODAS las ventas, compras, gastos, ajustes de inventario y cortes de caja —
            para poder empezar la operación real desde cero, sin datos de prueba. Esto{' '}
            <strong>no se puede deshacer</strong>. NO borra usuarios, clientes, proveedores ni
            productos/variantes (esos catálogos se conservan).
          </p>

          {!mostrarReset ? (
            <button
              onClick={() => setMostrarReset(true)}
              style={{ background: '#b91c1c', color: 'white' }}
            >
              Quiero reiniciar las transacciones
            </button>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              <label style={{ fontSize: 13 }}>
                Escribe <strong>BORRAR TODO</strong> para confirmar:
              </label>
              <input
                value={confirmacionReset}
                onChange={(e) => setConfirmacionReset(e.target.value)}
                placeholder="BORRAR TODO"
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={ejecutarReset}
                  disabled={confirmacionReset !== 'BORRAR TODO' || reseteando}
                  style={{ flex: 1, background: '#b91c1c', color: 'white' }}
                >
                  {reseteando ? 'Borrando...' : 'Confirmar y borrar todo'}
                </button>
                <button onClick={() => { setMostrarReset(false); setConfirmacionReset(''); }} style={{ flex: 1 }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
