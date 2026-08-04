import { useState } from 'react';
import { API_URL, headerAuth, cargarSaldosIniciales, importarProveedores, cargarFacturasIniciales, migrarSaldoInicialANotas } from './api';

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

// Acepta "Proveedor<TAB>Telefono<TAB>Factura<TAB>$1,234.56" (desde Excel)
// o separado por comas. El importe se limpia de "$", comas y espacios.
function parsearFacturas(texto: string): { proveedor: string; telefono?: string; factura: string; importe: number }[] {
  return texto
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((linea) => (linea.includes('\t') ? linea.split('\t') : linea.split(',')).map((p) => p.trim()))
    .filter((partes) => partes.length >= 4)
    .map((partes) => ({
      proveedor: partes[0],
      telefono: partes[1] || undefined,
      factura: partes[2],
      importe: Number(partes[3].replace(/[$,\s]/g, '')),
    }))
    // Descarta automaticamente la fila de encabezado, porque
    // Number("Importe") es NaN.
    .filter((f) => f.proveedor && f.factura && !isNaN(f.importe));
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

// Acepta "Nombre<TAB>$1,234.56" o "Nombre,$1,234.56" -- el monto se
// reconoce por el patron al final de la linea, sin que le afecten las
// comas que separan miles dentro del propio numero.
function parsearSaldos(texto: string): { nombre: string; saldo: number }[] {
  const resultado: { nombre: string; saldo: number }[] = [];
  const lineas = texto.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  for (const linea of lineas) {
    const match = linea.match(/^(.+?)[\t,]+\s*\$?\s*([\d,]+\.?\d*)\s*$/);
    if (!match) continue;
    const nombre = match[1].trim();
    const saldo = Number(match[2].replace(/,/g, ''));
    if (nombre && !isNaN(saldo)) resultado.push({ nombre, saldo });
  }
  return resultado;
}

export function AdminHerramientas({ onCerrar }: Props) {
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Fecha compartida por las 3 herramientas de carga inicial (clientes,
  // proveedores/facturas, inventario) -- por default, ayer. Asi ninguna
  // de estas cargas se ve como "de hoy" en el primer corte de caja.
  const [fechaCarga, setFechaCarga] = useState(() => {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    return ayer.toISOString().slice(0, 10);
  });

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
        body: JSON.stringify({ filas: filasDetectadas, fecha: fechaCarga }),
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

  // ---------- Carga de saldos iniciales de cartera ----------
  const [textoSaldos, setTextoSaldos] = useState('');
  const [cargandoSaldos, setCargandoSaldos] = useState(false);

  const saldosDetectados = parsearSaldos(textoSaldos);

  async function cargarSaldos() {
    if (saldosDetectados.length === 0) return;
    setCargandoSaldos(true);
    try {
      const { actualizados, noEncontrados } = await cargarSaldosIniciales(saldosDetectados, fechaCarga);
      setMensaje(
        noEncontrados.length === 0
          ? `Se crearon ${actualizados.length} notas de saldo inicial (se pueden abonar desde Cartera).`
          : `Se crearon ${actualizados.length} notas. No se encontraron: ${noEncontrados.join(', ')}.`
      );
      setTextoSaldos('');
    } catch (err: any) {
      setMensaje(err.message);
    } finally {
      setCargandoSaldos(false);
    }
  }

  // ---------- Migrar saldoInicial viejo (solo si ya usaste la version anterior de esta herramienta) ----------
  const [migrando, setMigrando] = useState(false);

  async function migrarSaldosViejos() {
    setMigrando(true);
    try {
      const { migrados } = await migrarSaldoInicialANotas(fechaCarga);
      setMensaje(
        migrados.length === 0
          ? 'No había ningún saldo inicial viejo por migrar.'
          : `Se convirtieron en notas: ${migrados.join(', ')}.`
      );
    } catch (err: any) {
      setMensaje(err.message);
    } finally {
      setMigrando(false);
    }
  }

  // ---------- Importar lista de proveedores ----------
  const [textoProveedores, setTextoProveedores] = useState('');
  const [importandoProveedores, setImportandoProveedores] = useState(false);

  const proveedoresDetectados = textoProveedores
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  async function importarListaProveedores() {
    if (proveedoresDetectados.length === 0) return;
    setImportandoProveedores(true);
    try {
      const { creados } = await importarProveedores(proveedoresDetectados);
      setMensaje(`Se importaron ${creados} proveedores.`);
      setTextoProveedores('');
    } catch (err: any) {
      setMensaje(err.message);
    } finally {
      setImportandoProveedores(false);
    }
  }

  // ---------- Cargar facturas iniciales de proveedores ----------
  const [textoFacturas, setTextoFacturas] = useState('');
  const [cargandoFacturas, setCargandoFacturas] = useState(false);

  const facturasDetectadas = parsearFacturas(textoFacturas);

  async function cargarFacturas() {
    if (facturasDetectadas.length === 0) return;
    setCargandoFacturas(true);
    try {
      const { creadas } = await cargarFacturasIniciales(facturasDetectadas, fechaCarga);
      setMensaje(`Se cargaron ${creadas} facturas pendientes de proveedores.`);
      setTextoFacturas('');
    } catch (err: any) {
      setMensaje(err.message);
    } finally {
      setCargandoFacturas(false);
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

        <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14, background: '#eef0f4' }}>
          <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
            📅 Fecha para las cargas iniciales (clientes, proveedores, inventario)
          </label>
          <input type="date" value={fechaCarga} onChange={(e) => setFechaCarga(e.target.value)} />
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
            Por default es ayer, para que ninguna de estas cargas cuente como movimiento
            de "hoy" en tu primer corte de caja.
          </p>
        </div>

        {/* ---------- Importar lista de proveedores ---------- */}
        <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14, display: 'grid', gap: '0.5rem' }}>
          <h3>🚚 Importar lista de proveedores</h3>
          <p style={{ fontSize: 13, color: '#6b7280' }}>
            Pega los nombres, uno por línea. Se crean sin teléfono — lo puedes agregar después
            desde la búsqueda de proveedor en Compras o Gastos.
          </p>
          <textarea
            rows={8}
            placeholder={'Proveedor 1\nProveedor 2\n...'}
            value={textoProveedores}
            onChange={(e) => setTextoProveedores(e.target.value)}
            style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
          />
          <button onClick={importarListaProveedores} disabled={importandoProveedores || proveedoresDetectados.length === 0}>
            {importandoProveedores ? 'Importando...' : `Importar ${proveedoresDetectados.length} proveedor(es)`}
          </button>
        </div>

        {/* ---------- Cargar facturas iniciales de proveedores ---------- */}
        <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14, display: 'grid', gap: '0.5rem' }}>
          <h3>🧾 Cargar facturas iniciales de proveedores</h3>
          <p style={{ fontSize: 13, color: '#6b7280' }}>
            Pega Proveedor, Teléfono, Factura e Importe (desde Excel o con comas). Si el
            proveedor no existe, se crea con ese teléfono. Cada fila queda como una factura
            pendiente real — aparece en "Facturas pendientes" y se puede abonar normal.
          </p>
          <textarea
            rows={8}
            placeholder={'Productos meza\t6681494535\t129958\t$7,511.76\nCarnes el Tigre\t6679969480\t65\t$1,730.57\n...'}
            value={textoFacturas}
            onChange={(e) => setTextoFacturas(e.target.value)}
            style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
          />
          <button onClick={cargarFacturas} disabled={cargandoFacturas || facturasDetectadas.length === 0}>
            {cargandoFacturas ? 'Cargando...' : `Cargar ${facturasDetectadas.length} factura(s)`}
          </button>
        </div>

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

        {/* ---------- Cargar saldos iniciales de cartera ---------- */}
        <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14, display: 'grid', gap: '0.5rem' }}>
          <h3>💰 Cargar saldos iniciales de cartera</h3>
          <p style={{ fontSize: 13, color: '#6b7280' }}>
            Pega Nombre y Saldo (uno por línea, desde Excel o separado por coma). Busca al
            cliente por su nombre exacto — debe estar ya dado de alta (usa "Importar lista" en
            Clientes si todavía no). Cada fila crea una <strong>nota real</strong> que se puede
            abonar desde Cartera, con su propio folio — no es solo un número suelto. Si un
            nombre no coincide con nadie, te lo avisa al final.
          </p>
          <textarea
            rows={8}
            placeholder={'Luis Valdez\t$76,996.16\nAlfredo\t$833.00\n...'}
            value={textoSaldos}
            onChange={(e) => setTextoSaldos(e.target.value)}
            style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
          />
          <button onClick={cargarSaldos} disabled={cargandoSaldos || saldosDetectados.length === 0}>
            {cargandoSaldos ? 'Cargando...' : `Cargar ${saldosDetectados.length} nota(s)`}
          </button>

          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e5ea' }}>
            <p style={{ fontSize: 12, color: '#6b7280' }}>
              ¿Ya habías cargado saldos con la versión anterior de esta herramienta (donde solo
              quedaba un número en el cliente, sin nota)? Conviértelos en notas reales:
            </p>
            <button onClick={migrarSaldosViejos} disabled={migrando}>
              {migrando ? 'Migrando...' : 'Migrar saldos antiguos a notas'}
            </button>
          </div>
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
