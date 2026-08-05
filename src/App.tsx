import { useEffect, useState } from 'react';
import { obtenerCatalogo, registrarVenta, logout, type VarianteCatalogo, type UsuarioSesion } from './api';
import { Carrito, type ItemCarrito } from './Carrito';
import { ModalAgregarProducto } from './ModalAgregarProducto';
import { Checkout } from './Checkout';
import { PantallaCompra } from './PantallaCompra';
import { Login } from './Login';
import { AdminCartera } from './AdminCartera';
import { AdminCuentasPorPagar } from './AdminCuentasPorPagar';
import { AdminFacturasPendientes } from './AdminFacturasPendientes';
import { AdminHistorialCompras } from './AdminHistorialCompras';
import { AdminUsuarios } from './AdminUsuarios';
import { AdminHerramientas } from './AdminHerramientas';
import { AdminGastos } from './AdminGastos';
import { AdminCorteCaja } from './AdminCorteCaja';
import { AdminDashboard } from './AdminDashboard';
import { AdminAjusteInventario } from './AdminAjusteInventario';
import { AdminProductos } from './AdminProductos';
import { AdminClientes } from './AdminClientes';
import { AdminProveedores } from './AdminProveedores';
import { AdminMovimientosInventario } from './AdminMovimientosInventario';
import { AdminHistorialVentas } from './AdminHistorialVentas';
import { AdminHistorialCortes } from './AdminHistorialCortes';
import { AdminConfiguracion } from './AdminConfiguracion';
import { ConfiguracionRecibo } from './ConfiguracionRecibo';
import { ConfiguracionImpresora } from './ConfiguracionImpresora';
import { ReciboModal } from './ReciboModal';
import type { DatosRecibo } from './construirRecibo';
import { formatoMoneda } from './formato';
import {
  guardarCatalogoCache,
  obtenerCatalogoCache,
  encolarVenta,
  descontarStockLocal,
  refrescarCacheOffline,
  sincronizarVentasPendientes,
  contarVentasPendientes,
} from './offline';
import { VentasOffline } from './VentasOffline';

type Pantalla =
  | 'inicio'
  | 'catalogo'
  | 'compra'
  | 'cartera'
  | 'cuentas'
  | 'usuarios'
  | 'gastos'
  | 'corte'
  | 'dashboard'
  | 'ajuste'
  | 'clientes'
  | 'movimientosInventario'
  | 'productos'
  | 'historialCortes'
  | 'comprasMenu'
  | 'facturasPendientes'
  | 'historialCompras'
  | 'ventasOffline'
  | 'configuracion'
  | 'configuracionRecibo'
  | 'configuracionImpresora'
  | 'clientesMenu'
  | 'cuentasPorCobrarMenu'
  | 'cuentasPorPagarMenu'
  | 'proveedores'
  | 'inventarioMenu'
  | 'finanzasMenu'
  | 'configuracionMenu'
  | 'herramientas';

interface OpcionMenu {
  pantalla: Pantalla;
  icono: string;
  titulo: string;
  descripcion: string;
  clase: string;
}

// Estas opciones ahora alimentan el menu desplegable (☰) de la pantalla
// de inicio -- Ventas ya no es un grupo aparte, es la pantalla de inicio
// misma. Cada una se filtra segun los permisos reales del usuario.
const OPCIONES_MENU: OpcionMenu[] = [
  { pantalla: 'comprasMenu', icono: '📦', titulo: 'Compras', descripcion: 'Registrar compra e historial', clase: '' },
  { pantalla: 'clientesMenu', icono: '🧑‍🤝‍🧑', titulo: 'Clientes', descripcion: 'Datos, altas y edición', clase: 'boton-flotante-cartera' },
  { pantalla: 'cuentasPorCobrarMenu', icono: '💵', titulo: 'Cuentas por Cobrar', descripcion: 'Cartera de clientes', clase: 'boton-flotante-cartera' },
  { pantalla: 'cuentasPorPagarMenu', icono: '💳', titulo: 'Cuentas por Pagar', descripcion: 'Pagos, facturas y proveedores', clase: 'boton-flotante-cuentas' },
  { pantalla: 'inventarioMenu', icono: '🥩', titulo: 'Inventario', descripcion: 'Productos, stock y movimientos', clase: 'boton-flotante-ajuste' },
  { pantalla: 'finanzasMenu', icono: '💸', titulo: 'Finanzas', descripcion: 'Corte, gastos y estadísticas', clase: 'boton-flotante-gastos' },
  { pantalla: 'configuracionMenu', icono: '⚙️', titulo: 'Configuración', descripcion: 'Negocio, usuarios y herramientas', clase: 'boton-flotante-ajuste' },
];

function puedeVer(pantalla: Pantalla, usuario: UsuarioSesion): boolean {
  if (usuario.rolBase === 'administrador') return true;
  switch (pantalla) {
    case 'compra':
      return !!usuario.permisos?.puedeRegistrarCompras;
    case 'cartera':
    case 'cuentas':
    case 'facturasPendientes':
      return !!usuario.permisos?.puedeVerCarteraGeneral;
    case 'proveedores':
      return !!usuario.permisos?.puedeRegistrarCompras || !!usuario.permisos?.puedeVerCarteraGeneral;
    case 'historialCompras':
      return !!usuario.permisos?.puedeVerCostos;
    case 'ventasOffline':
      return true; // cualquiera puede ver y reintentar sus ventas guardadas sin conexion
    case 'comprasMenu':
      return !!usuario.permisos?.puedeRegistrarCompras;
    case 'usuarios':
      return false; // solo administrador
    case 'configuracion':
    case 'configuracionRecibo':
    case 'configuracionImpresora':
    case 'herramientas':
      return false; // solo administrador
    case 'gastos':
      return true; // cualquiera puede registrar/ver sus propios gastos
    case 'corte':
      return true; // cualquiera captura su conteo diario; utilidad/balanza se ocultan sin permiso
    case 'dashboard':
      return !!usuario.permisos?.puedeVerUtilidad;
    case 'ajuste':
      return true; // cualquiera puede solicitar un ajuste; la autorizacion se exige al confirmar
    case 'clientes':
      return true; // cualquiera puede ver clientes; el switch de credito se oculta si no es admin
    case 'movimientosInventario':
      return !!usuario.permisos?.puedeVerCostos;
    case 'productos':
      return !!usuario.permisos?.puedeVerCostos;
    case 'historialCortes':
      return false; // solo administrador puede editar cortes pasados
    case 'clientesMenu':
      return puedeVer('clientes', usuario);
    case 'cuentasPorCobrarMenu':
      return puedeVer('cartera', usuario);
    case 'cuentasPorPagarMenu':
      return puedeVer('cuentas', usuario) || puedeVer('facturasPendientes', usuario) || puedeVer('proveedores', usuario);
    case 'inventarioMenu':
      return puedeVer('productos', usuario) || puedeVer('movimientosInventario', usuario);
    case 'finanzasMenu':
      return puedeVer('gastos', usuario) || puedeVer('corte', usuario) || puedeVer('dashboard', usuario);
    case 'configuracionMenu':
      return puedeVer('configuracion', usuario) || puedeVer('usuarios', usuario);
    default:
      return true;
  }
}

export default function App() {
  const [catalogo, setCatalogo] = useState<VarianteCatalogo[]>([]);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [varianteSeleccionada, setVarianteSeleccionada] = useState<VarianteCatalogo | null>(
    null
  );
  const [mostrarCheckout, setMostrarCheckout] = useState(false);
  const [pantallaActiva, setPantallaActiva] = useState<Pantalla>('inicio');
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [errorVenta, setErrorVenta] = useState<string | null>(null);
  const [reciboActivo, setReciboActivo] = useState<DatosRecibo | null>(null);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [varianteParaAjuste, setVarianteParaAjuste] = useState<{ id: string; producto: string; marca: string } | null>(null);
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  const [ventasPendientesCount, setVentasPendientesCount] = useState(0);
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    if (usuario) {
      cargarCatalogo();
      refrescarCacheOffline();
    }
  }, [usuario]);

  // Detecta cuando se pierde/recupera la conexion. Al recuperarla, intenta
  // subir las ventas que quedaron guardadas localmente y refresca la
  // copia local del catalogo y clientes para la proxima vez que se caiga.
  useEffect(() => {
    setVentasPendientesCount(contarVentasPendientes());

    async function alRecuperarConexion() {
      setEnLinea(true);
      const { exitosas, conError } = await sincronizarVentasPendientes();
      setVentasPendientesCount(contarVentasPendientes());
      if (exitosas > 0 || conError > 0) {
        const partes = [];
        if (exitosas > 0) partes.push(`${exitosas} venta${exitosas !== 1 ? 's' : ''} subida${exitosas !== 1 ? 's' : ''}`);
        if (conError > 0) partes.push(`${conError} con error, revisa "Ventas pendientes"`);
        setMensaje(`Conexión recuperada: ${partes.join(', ')}.`);
      }
      refrescarCacheOffline();
      cargarCatalogo();
    }

    function alPerderConexion() {
      setEnLinea(false);
      setMensaje('Se perdió la conexión a internet. Puedes seguir vendiendo; se sincronizará solo.');
    }

    window.addEventListener('online', alRecuperarConexion);
    window.addEventListener('offline', alPerderConexion);
    return () => {
      window.removeEventListener('online', alRecuperarConexion);
      window.removeEventListener('offline', alPerderConexion);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarCatalogo() {
    setCargando(true);
    try {
      const data = await obtenerCatalogo();
      setCatalogo(data);
      guardarCatalogoCache(data);
    } catch (err) {
      const cache = obtenerCatalogoCache();
      if (cache.length > 0) {
        setCatalogo(cache);
        setMensaje('Sin conexión: mostrando el catálogo guardado la última vez que hubo internet.');
      } else {
        setMensaje('No se pudo cargar el catalogo. Revisa que el backend este corriendo.');
      }
    } finally {
      setCargando(false);
    }
  }

  function agregarAlCarrito(item: ItemCarrito) {
    setCarrito((prev) => [...prev, item]);
  }

  function eliminarDelCarrito(index: number) {
    setCarrito((prev) => prev.filter((_, i) => i !== index));
  }

  async function confirmarVenta(datos: {
    clienteId: string;
    clienteNombre: string;
    clienteTelefono: string;
    esCredito: boolean;
    montoPagadoAhora: number;
    metodoPago: string;
    autorizadoPorTelefono?: string;
    autorizadoPin?: string;
    motivoAutorizacion?: string;
  }) {
    setErrorVenta(null);
    const algunaLineaRequiereAutorizacion = carrito.some(
      (i) => i.costoLote !== null && i.precioUnitario < i.costoLote
    );
    try {
      const resultado = await registrarVenta({
        clienteId: datos.clienteId,
        items: carrito.map((i) => {
          const requiereAutorizacion = i.costoLote !== null && i.precioUnitario < i.costoLote;
          return {
            varianteId: i.varianteId,
            cantidad: i.cantidad,
            precioUnitario: i.precioUnitario,
            // Solo se manda la autorizacion en las lineas que realmente
            // la necesitan, no a toda la nota.
            ...(requiereAutorizacion
              ? {
                  autorizadoPorTelefono: datos.autorizadoPorTelefono,
                  autorizadoPin: datos.autorizadoPin,
                  motivoAutorizacion: datos.motivoAutorizacion,
                }
              : {}),
          };
        }),
        esCredito: datos.esCredito,
        montoPagadoAhora: datos.montoPagadoAhora,
        metodoPago: datos.metodoPago,
      });
      setMensaje(`Venta #${resultado.venta.folio} registrada. Total: $${resultado.venta.total}`);
      setReciboActivo({
        folio: resultado.venta.folio,
        fecha: new Date(resultado.venta.fecha ?? Date.now()).toLocaleString(),
        vendedor: usuario!.nombre,
        cliente: { nombre: datos.clienteNombre, telefono: datos.clienteTelefono },
        items: carrito.map((i) => ({
          producto: i.producto,
          marca: i.marca,
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
        })),
        total: Number(resultado.venta.total),
        metodoPago: datos.metodoPago,
        esCredito: datos.esCredito,
        saldoPendiente: Number(resultado.venta.saldoPendiente ?? 0),
        saldoTotalCliente: resultado.saldoTotalCliente !== undefined ? Number(resultado.saldoTotalCliente) : undefined,
      });
      setCarrito([]);
      setMostrarCheckout(false);
      cargarCatalogo();
    } catch (err: any) {
      const esFalloDeRed = !err?.status && !err?.code;

      if (esFalloDeRed && algunaLineaRequiereAutorizacion) {
        // Sin conexion no se puede validar el PIN de autorizacion contra
        // el servidor -- no es seguro aceptar esta venta sin conexion.
        setErrorVenta(
          'Esta venta necesita autorización de un administrador y no se puede completar sin conexión a internet.'
        );
        return;
      }

      if (esFalloDeRed) {
        // Verificacion final: sumamos cuanto se pide de cada variante y lo
        // comparamos contra el stock que muestra el catalogo actual (que
        // en este momento viene de la copia guardada localmente). Si algo
        // no alcanza, se bloquea la venta en vez de encolarla.
        const pedidoPorVariante = new Map<string, number>();
        for (const i of carrito) {
          pedidoPorVariante.set(i.varianteId, (pedidoPorVariante.get(i.varianteId) ?? 0) + i.cantidad);
        }
        for (const [varianteId, cantidadPedida] of pedidoPorVariante) {
          const variante = catalogo.find((v) => v.id === varianteId);
          if (!variante || cantidadPedida > variante.stockDisponible) {
            setErrorVenta(
              `No hay suficiente stock de "${variante?.producto ?? 'este producto'}" para completar la venta sin conexión.`
            );
            return;
          }
        }

        // Sin conexion pero es una venta normal (sin autorizacion pendiente):
        // se guarda en el celular y se sube sola cuando regrese internet.
        const total = carrito.reduce((acc, i) => acc + i.cantidad * i.precioUnitario, 0);
        encolarVenta(
          {
            clienteId: datos.clienteId,
            items: carrito.map((i) => ({
              varianteId: i.varianteId,
              cantidad: i.cantidad,
              precioUnitario: i.precioUnitario,
            })),
            esCredito: datos.esCredito,
            montoPagadoAhora: datos.montoPagadoAhora,
            metodoPago: datos.metodoPago,
          },
          {
            clienteNombre: datos.clienteNombre,
            totalItems: carrito.length,
            total,
            fecha: new Date().toISOString(),
          }
        );
        descontarStockLocal(carrito.map((i) => ({ varianteId: i.varianteId, cantidad: i.cantidad })));
        setVentasPendientesCount(contarVentasPendientes());

        setMensaje('Sin conexión: la venta se guardó en este celular y se subirá sola cuando vuelva internet.');
        setReciboActivo({
          folio: 'pendiente',
          fecha: new Date().toLocaleString(),
          vendedor: usuario!.nombre,
          cliente: { nombre: datos.clienteNombre, telefono: datos.clienteTelefono },
          items: carrito.map((i) => ({
            producto: i.producto,
            marca: i.marca,
            cantidad: i.cantidad,
            precioUnitario: i.precioUnitario,
          })),
          total,
          metodoPago: datos.metodoPago,
          esCredito: datos.esCredito,
          saldoPendiente: datos.esCredito ? total - datos.montoPagadoAhora : 0,
        });
        setCarrito([]);
        setMostrarCheckout(false);
        cargarCatalogo();
        return;
      }

      // Este error se muestra DENTRO del Checkout (que sigue abierto),
      // no en un banner que quedaria tapado por el modal.
      if (err.code === 'STOCK_INSUFICIENTE') {
        setErrorVenta('No hay stock suficiente para completar la venta.');
      } else if (err.code === 'REQUIERE_AUTORIZACION') {
        setErrorVenta('El telefono, PIN o motivo de autorizacion no son validos. Verifica con el administrador.');
      } else if (err.code === 'CLIENTE_SIN_CREDITO') {
        setErrorVenta('Este cliente no tiene autorizado comprar a credito.');
      } else {
        setErrorVenta('Ocurrio un error al registrar la venta.');
      }
    }
  }

  function abrirPantalla(pantalla: Pantalla) {
    setPantallaActiva(pantalla);
    setMostrarCheckout(false);
    setVarianteSeleccionada(null);
    // El inventario puede haber cambiado en cualquier pantalla (compra,
    // ajuste, venta). Refrescamos el catalogo cada vez que se navega,
    // para no depender de que cada pantalla se acuerde de hacerlo.
    if (pantalla === 'catalogo' || pantalla === 'inicio') {
      cargarCatalogo();
    }
  }

  function volverAlInicio() {
    abrirPantalla('inicio');
  }

  function compraCompletada(mensajeExito: string) {
    setMensaje(mensajeExito);
    abrirPantalla('comprasMenu');
  }

  async function handleLogout() {
    await logout();
    setUsuario(null);
    setCarrito([]);
    setCatalogo([]);
    setPantallaActiva('inicio');
  }

  if (!usuario) {
    return <Login onLogin={setUsuario} />;
  }

  interface OpcionSubmenu {
    pantalla: Pantalla;
    icono: string;
    titulo: string;
    descripcion: string;
    clase: string;
  }

  function renderSubmenu(titulo: string, opciones: OpcionSubmenu[]) {
    const visibles = opciones.filter((o) => puedeVer(o.pantalla, usuario!));
    return (
      <>
        <header className="encabezado">
          <button className="boton-secundario" onClick={volverAlInicio} style={{ height: 40, width: 'auto', marginTop: 0, padding: '0 16px' }}>
            ← Inicio
          </button>
          <strong>{titulo}</strong>
        </header>
        <div className="grid-menu">
          {visibles.map((o) => (
            <div key={o.pantalla} className="tarjeta-menu" onClick={() => abrirPantalla(o.pantalla)}>
              <div className={`icono-menu ${o.clase}`}>{o.icono}</div>
              <p className="titulo-menu">{o.titulo}</p>
              <p className="descripcion-menu">{o.descripcion}</p>
            </div>
          ))}
        </div>
      </>
    );
  }

  function renderPantalla() {
    if (!usuario) return null;

    // Si por alguna razon se quedo activa una pantalla que este usuario
    // ya no puede ver (cambio de permisos, etc), lo regresamos al inicio
    // en vez de mostrar un componente que el backend le va a rechazar.
    if (pantallaActiva !== 'inicio' && pantallaActiva !== 'catalogo' && !puedeVer(pantallaActiva, usuario)) {
      setPantallaActiva('inicio');
      return null;
    }

    if (pantallaActiva === 'clientesMenu') {
      return renderSubmenu('Clientes', [
        { pantalla: 'clientes', icono: '🧑‍🤝‍🧑', titulo: 'Clientes', descripcion: 'Alta, edición y datos', clase: 'boton-flotante-cartera' },
      ]);
    }
    if (pantallaActiva === 'cuentasPorCobrarMenu') {
      return renderSubmenu('Cuentas por Cobrar', [
        { pantalla: 'cartera', icono: '💵', titulo: 'Cartera', descripcion: 'Clientes con saldo pendiente', clase: 'boton-flotante-cartera' },
      ]);
    }
    if (pantallaActiva === 'cuentasPorPagarMenu') {
      return renderSubmenu('Cuentas por Pagar', [
        { pantalla: 'cuentas', icono: '💳', titulo: 'Registrar pago a factura', descripcion: 'Abonar una factura pendiente', clase: 'boton-flotante-cuentas' },
        { pantalla: 'facturasPendientes', icono: '📋', titulo: 'Facturas por pagar', descripcion: 'Solo ver el listado', clase: 'boton-flotante-historial' },
        { pantalla: 'proveedores', icono: '🚚', titulo: 'Proveedores', descripcion: 'Alta y edición de proveedores', clase: '' },
      ]);
    }
    if (pantallaActiva === 'inventarioMenu') {
      return renderSubmenu('Inventario', [
        { pantalla: 'productos', icono: '🥩', titulo: 'Productos', descripcion: 'Stock, historial y ajustes', clase: 'boton-flotante-ajuste' },
        { pantalla: 'movimientosInventario', icono: '📈', titulo: 'Movimientos de inventario', descripcion: 'Entradas, salidas, merma y correcciones', clase: 'boton-flotante-historial' },
      ]);
    }
    if (pantallaActiva === 'finanzasMenu') {
      return renderSubmenu('Finanzas', [
        { pantalla: 'corte', icono: '🗒️', titulo: 'Corte de caja', descripcion: 'Cierre diario de efectivo y banco', clase: 'boton-flotante-corte' },
        { pantalla: 'gastos', icono: '💸', titulo: 'Gastos', descripcion: 'Registrar y ver gastos operativos', clase: 'boton-flotante-gastos' },
        { pantalla: 'dashboard', icono: '📊', titulo: 'Estadísticas', descripcion: 'Ventas, utilidad y mas vendidos', clase: 'boton-flotante-dashboard' },
      ]);
    }
    if (pantallaActiva === 'configuracionMenu') {
      return renderSubmenu('Configuración', [
        { pantalla: 'configuracion', icono: '⚙️', titulo: 'Datos del negocio', descripcion: 'Negocio, recibo e impresora', clase: 'boton-flotante-ajuste' },
        { pantalla: 'usuarios', icono: '👤', titulo: 'Usuarios', descripcion: 'Altas, PIN y permisos', clase: 'boton-flotante-usuarios' },
        { pantalla: 'herramientas', icono: '🛠️', titulo: 'Herramientas', descripcion: 'Carga inicial y reinicio de datos', clase: 'boton-flotante-ajuste' },
      ]);
    }

    if (pantallaActiva === 'comprasMenu') {
      return renderSubmenu('Compras', [
        { pantalla: 'compra', icono: '📦', titulo: 'Registrar compra', descripcion: 'Nueva compra a proveedor', clase: '' },
        { pantalla: 'historialCompras', icono: '📜', titulo: 'Historial de compras', descripcion: 'Todas, pagadas y pendientes', clase: 'boton-flotante-historial' },
      ]);
    }

    if (pantallaActiva === 'compra') {
      return <PantallaCompra onCompletada={compraCompletada} onCerrar={() => abrirPantalla('comprasMenu')} />;
    }
    if (pantallaActiva === 'cartera') {
      return <AdminCartera onCerrar={() => abrirPantalla('cuentasPorCobrarMenu')} />;
    }
    if (pantallaActiva === 'cuentas') {
      return <AdminCuentasPorPagar onCerrar={() => abrirPantalla('cuentasPorPagarMenu')} />;
    }
    if (pantallaActiva === 'facturasPendientes') {
      return <AdminFacturasPendientes onCerrar={() => abrirPantalla('cuentasPorPagarMenu')} />;
    }
    if (pantallaActiva === 'proveedores') {
      return <AdminProveedores onCerrar={() => abrirPantalla('cuentasPorPagarMenu')} />;
    }
    if (pantallaActiva === 'historialCompras') {
      return <AdminHistorialCompras onCerrar={() => abrirPantalla('comprasMenu')} />;
    }
    if (pantallaActiva === 'usuarios') {
      return <AdminUsuarios onCerrar={() => abrirPantalla('configuracionMenu')} />;
    }
    if (pantallaActiva === 'herramientas') {
      return <AdminHerramientas onCerrar={() => abrirPantalla('configuracionMenu')} />;
    }
    if (pantallaActiva === 'gastos') {
      return <AdminGastos onCerrar={() => abrirPantalla('finanzasMenu')} />;
    }
    if (pantallaActiva === 'corte') {
      return (
        <AdminCorteCaja
          onCerrar={() => abrirPantalla('finanzasMenu')}
          onVerHistorial={usuario.rolBase === 'administrador' ? () => abrirPantalla('historialCortes') : undefined}
        />
      );
    }
    if (pantallaActiva === 'historialCortes') {
      return <AdminHistorialCortes onCerrar={() => abrirPantalla('corte')} />;
    }
    if (pantallaActiva === 'configuracion') {
      return <AdminConfiguracion onCerrar={() => abrirPantalla('configuracionMenu')} onIrARecibo={() => abrirPantalla('configuracionRecibo')} />;
    }
    if (pantallaActiva === 'configuracionRecibo') {
      return (
        <ConfiguracionRecibo
          onCerrar={() => abrirPantalla('configuracion')}
          onIrAImpresora={() => abrirPantalla('configuracionImpresora')}
        />
      );
    }
    if (pantallaActiva === 'configuracionImpresora') {
      return <ConfiguracionImpresora onCerrar={() => abrirPantalla('configuracionRecibo')} />;
    }
    if (pantallaActiva === 'dashboard') {
      return <AdminDashboard onCerrar={() => abrirPantalla('finanzasMenu')} />;
    }
    if (pantallaActiva === 'ajuste') {
      return (
        <AdminAjusteInventario
          onCerrar={() => abrirPantalla('productos')}
          varianteInicial={varianteParaAjuste ?? undefined}
        />
      );
    }
    if (pantallaActiva === 'productos') {
      return (
        <AdminProductos
          onCerrar={() => abrirPantalla('inventarioMenu')}
          onIrAjusteGeneral={() => {
            setVarianteParaAjuste(null);
            abrirPantalla('ajuste');
          }}
          onRegistrarAjuste={(v) => {
            setVarianteParaAjuste(v);
            abrirPantalla('ajuste');
          }}
          esAdmin={usuario.rolBase === 'administrador'}
        />
      );
    }
    if (pantallaActiva === 'clientes') {
      return <AdminClientes onCerrar={() => abrirPantalla('clientesMenu')} esAdmin={usuario.rolBase === 'administrador'} />;
    }
    if (pantallaActiva === 'movimientosInventario') {
      return <AdminMovimientosInventario onCerrar={() => abrirPantalla('inventarioMenu')} />;
    }
    if (pantallaActiva === 'ventasOffline') {
      return (
        <VentasOffline
          onCerrar={() => abrirPantalla('inicio')}
          onCambio={() => setVentasPendientesCount(contarVentasPendientes())}
        />
      );
    }

    if (pantallaActiva === 'catalogo') {
      const catalogoFiltrado = catalogo.filter((v) => {
        if (!busquedaProducto.trim()) return true;
        const q = busquedaProducto.trim().toLowerCase();
        return v.producto.toLowerCase().includes(q) || v.marca.toLowerCase().includes(q);
      });

      return (
        <>
          <header className="encabezado">
            <button className="boton-secundario" onClick={volverAlInicio} style={{ height: 40, width: 'auto', marginTop: 0, padding: '0 16px' }}>
              ← Inicio
            </button>
          </header>

          {mensaje && (
            <div className="banner-mensaje" onClick={() => setMensaje(null)}>
              {mensaje}
            </div>
          )}

          <input
            className="buscador"
            placeholder="Buscar producto o marca"
            value={busquedaProducto}
            onChange={(e) => setBusquedaProducto(e.target.value)}
            style={{ marginBottom: 10 }}
          />

          {cargando && catalogo.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#6b7280', marginTop: 24 }}>Cargando catalogo...</p>
          ) : catalogoFiltrado.length === 0 ? (
            <p className="sin-resultados">No hay productos que coincidan.</p>
          ) : (
            <div className="lista-productos">
              {catalogoFiltrado.map((v) => (
                <div
                  key={v.id}
                  className={`fila-producto ${v.pocoStock ? 'poco-stock' : ''}`}
                  onClick={() => setVarianteSeleccionada(v)}
                >
                  <div>
                    <p className="nombre">{v.producto}</p>
                    <p className="marca">
                      {v.marca} {v.pocoStock && '· poco stock'}
                    </p>
                  </div>
                  <div className="fila-precio">
                    <span>{formatoMoneda(v.precioVenta)}/kg</span>
                    <span className="stock">{v.stockDisponible} kg</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      );
    }

    // Pantalla de inicio: ahora es directamente el listado de ventas
    // (antes era una cuadrícula de 6 tarjetas). El menú de grupos (☰) y
    // "Salir" viven en el panel desplegable que se abre desde ahí.
    return (
      <AdminHistorialVentas
        esAdmin={usuario.rolBase === 'administrador'}
        esInicio
        onAbrirMenu={() => setMenuAbierto(true)}
        onNuevaVenta={() => abrirPantalla('catalogo')}
        onVerSinSincronizar={() => abrirPantalla('ventasOffline')}
        ventasPendientesCount={ventasPendientesCount}
        mensajeGlobal={mensaje}
        onCerrarMensajeGlobal={() => setMensaje(null)}
      />
    );
  }

  return (
    <div className="app">
      {!enLinea && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 20,
            background: '#ff9500',
            color: 'white',
            textAlign: 'center',
            fontSize: 12,
            fontWeight: 600,
            padding: '6px 0',
          }}
        >
          📴 Sin conexión — puedes seguir vendiendo, se sincronizará solo
        </div>
      )}
      {renderPantalla()}

      {pantallaActiva === 'catalogo' && varianteSeleccionada && (
        <ModalAgregarProducto
          variante={varianteSeleccionada}
          cantidadYaEnCarrito={carrito
            .filter((i) => i.varianteId === varianteSeleccionada.id)
            .reduce((acc, i) => acc + i.cantidad, 0)}
          onAgregar={agregarAlCarrito}
          onCerrar={() => setVarianteSeleccionada(null)}
        />
      )}

      {pantallaActiva === 'catalogo' && mostrarCheckout && (
        <Checkout
          items={carrito}
          onConfirmar={confirmarVenta}
          errorServidor={errorVenta}
          onCerrar={() => {
            setMostrarCheckout(false);
            setErrorVenta(null);
          }}
        />
      )}

      {reciboActivo && (
        <ReciboModal datos={reciboActivo} onCerrar={() => setReciboActivo(null)} />
      )}

      {pantallaActiva === 'catalogo' && (
        <Carrito items={carrito} onCobrar={() => setMostrarCheckout(true)} onEliminar={eliminarDelCarrito} />
      )}

      {menuAbierto && (
        <div
          onClick={() => setMenuAbierto(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 45,
            display: 'flex',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              width: 280,
              maxWidth: '80vw',
              height: '100%',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              boxShadow: '2px 0 12px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 8 }}>
              <strong>{usuario.nombre}</strong>
              <small style={{ color: '#6b7280' }}>{usuario.rolBase}</small>
            </div>

            {OPCIONES_MENU.filter((o) => puedeVer(o.pantalla, usuario)).map((o) => (
              <div
                key={o.pantalla}
                onClick={() => {
                  abrirPantalla(o.pantalla);
                  setMenuAbierto(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 8px',
                  borderRadius: 10,
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 20 }}>{o.icono}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{o.titulo}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{o.descripcion}</div>
                </div>
              </div>
            ))}

            <div style={{ flex: 1 }} />
            <button
              className="boton-secundario"
              onClick={() => {
                setMenuAbierto(false);
                handleLogout();
              }}
              style={{ width: '100%' }}
            >
              Salir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
