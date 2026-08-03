import { useEffect, useState } from 'react';
import { obtenerConfiguracion, type Configuracion } from './api';
import { obtenerConfiguracionCache } from './offline';
import { ReciboVenta } from './ReciboVenta';
import { construirLineasRecibo, type DatosRecibo } from './construirRecibo';
import { generarImagenRecibo, generarPdfRecibo, compartirArchivo } from './reciboExport';
import {
  impresoraConectada,
  nombreImpresoraConectada,
  conectarImpresora,
  imprimirLineas,
} from './impresionBluetooth';

interface Props {
  datos: DatosRecibo;
  onCerrar: () => void;
}

const ELEMENT_ID = 'recibo-venta-render';

export function ReciboModal({ datos, onCerrar }: Props) {
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    obtenerConfiguracion()
      .then(setConfig)
      .catch(() => {
        // Sin conexion: se usa la configuracion guardada la ultima vez que hubo internet.
        const enCache = obtenerConfiguracionCache();
        if (enCache) {
          setConfig(enCache);
        } else {
          setMensaje('No se pudo cargar la configuración del recibo.');
        }
      })
      .finally(() => setCargando(false));
  }, []);

  async function compartirImagen() {
    setOcupado('imagen');
    setMensaje(null);
    try {
      const blob = await generarImagenRecibo(ELEMENT_ID);
      await compartirArchivo(blob, `recibo-${datos.folio}.png`, 'image/png');
    } catch {
      setMensaje('No se pudo generar o compartir la imagen.');
    } finally {
      setOcupado(null);
    }
  }

  async function descargarPdf() {
    setOcupado('pdf');
    setMensaje(null);
    try {
      const blob = await generarPdfRecibo(ELEMENT_ID);
      await compartirArchivo(blob, `recibo-${datos.folio}.pdf`, 'application/pdf');
    } catch {
      setMensaje('No se pudo generar el PDF.');
    } finally {
      setOcupado(null);
    }
  }

  async function imprimir() {
    if (!config) return;
    setOcupado('imprimir');
    setMensaje(null);
    try {
      if (!impresoraConectada()) {
        await conectarImpresora();
      }
      const lineas = construirLineasRecibo(config, datos);
      const veces = config.imprimirDosVeces ? 2 : 1;
      await imprimirLineas(lineas, veces);
      setMensaje('Recibo enviado a la impresora.');
    } catch (err: any) {
      setMensaje(err.message || 'No se pudo imprimir. Revisa que la impresora esté prendida y cerca.');
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="modal-fondo" onClick={onCerrar} style={{ zIndex: 40 }}>
      <div className="modal-contenido" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <p className="titulo">Venta registrada</p>
          <button className="boton-cerrar" onClick={onCerrar}>✕</button>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {cargando || !config ? (
          <p style={{ textAlign: 'center', color: '#6b7280' }}>Cargando recibo...</p>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
              <ReciboVenta config={config} datos={datos} elementId={ELEMENT_ID} />
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <button className="boton-primario" disabled={!!ocupado} onClick={compartirImagen}>
                {ocupado === 'imagen' ? 'Generando...' : '📤 Compartir imagen (WhatsApp)'}
              </button>
              <button className="boton-secundario" disabled={!!ocupado} onClick={descargarPdf} style={{ width: '100%', marginTop: 0 }}>
                {ocupado === 'pdf' ? 'Generando...' : '📄 Descargar PDF'}
              </button>
              <button className="boton-secundario" disabled={!!ocupado} onClick={imprimir} style={{ width: '100%', marginTop: 0 }}>
                {ocupado === 'imprimir'
                  ? 'Imprimiendo...'
                  : impresoraConectada()
                    ? `🖨️ Imprimir (${nombreImpresoraConectada()})`
                    : '🖨️ Conectar e imprimir'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
