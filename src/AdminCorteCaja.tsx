import { useEffect, useState } from 'react';
import { formatoMoneda } from './formato';
import { obtenerCorteDelDia, guardarCorte, type ResumenCorteDia } from './api';
import { generarImagenRecibo, generarPdfRecibo, compartirArchivo, CompartirCanceladoError } from './reciboExport';
import { ReporteCorte } from './ReporteCorte';

interface Props {
  onCerrar: () => void;
  onVerHistorial?: () => void;
}

export function AdminCorteCaja({ onCerrar, onVerHistorial }: Props) {
  const [efectivoContado, setEfectivoContado] = useState('');
  const [saldoBancoContado, setSaldoBancoContado] = useState('');
  const [observacion, setObservacion] = useState('');
  const [usarFechaPersonalizada, setUsarFechaPersonalizada] = useState(false);
  const [fechaPersonalizada, setFechaPersonalizada] = useState(() => {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    return ayer.toISOString().slice(0, 10);
  });
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ResumenCorteDia | null>(null);
  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState<'imagen' | 'pdf' | null>(null);
  const [imagenBlob, setImagenBlob] = useState<Blob | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  useEffect(() => {
    cargarResumen();
  }, []);

  async function cargarResumen() {
    setCargando(true);
    try {
      const data = await obtenerCorteDelDia();
      setResumen(data);
    } catch {
      setMensaje('No se pudo cargar el resumen del día');
    } finally {
      setCargando(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await guardarCorte(
        Number(efectivoContado),
        Number(saldoBancoContado),
        usarFechaPersonalizada ? fechaPersonalizada : undefined,
        observacion
      );
      setMensaje('Corte de caja guardado');
      setEfectivoContado('');
      setSaldoBancoContado('');
      setObservacion('');
      setUsarFechaPersonalizada(false);
      cargarResumen();
    } catch (err: any) {
      if (err.code === 'CORTE_YA_EXISTE') {
        setMensaje(err.error || 'Ya existe un corte de caja para hoy.');
        cargarResumen();
      } else {
        setMensaje(err.error || 'No se pudo guardar el corte');
      }
    }
  }

  // Generar y compartir van separados a proposito: si se comparte justo
  // despues de generar (que tarda un momento en el celular), el
  // navegador ya no lo reconoce como accion directa del usuario.
  async function generarImagen() {
    setExportando('imagen');
    setMensaje(null);
    try {
      const blob = await generarImagenRecibo('corte-reporte');
      setImagenBlob(blob);
    } catch (err: any) {
      setMensaje(err?.message || 'No se pudo generar la imagen del corte.');
    } finally {
      setExportando(null);
    }
  }

  async function compartirImagenLista() {
    if (!imagenBlob) return;
    try {
      await compartirArchivo(imagenBlob, 'corte-de-caja.png', 'image/png');
    } catch (err: any) {
      if (!(err instanceof CompartirCanceladoError)) {
        setMensaje(err?.message || 'No se pudo compartir la imagen.');
      }
    }
  }

  async function generarPdf() {
    setExportando('pdf');
    setMensaje(null);
    try {
      const blob = await generarPdfRecibo('corte-reporte');
      setPdfBlob(blob);
    } catch (err: any) {
      setMensaje(err?.message || 'No se pudo generar el PDF del corte.');
    } finally {
      setExportando(null);
    }
  }

  async function compartirPdfListo() {
    if (!pdfBlob) return;
    try {
      await compartirArchivo(pdfBlob, 'corte-de-caja.pdf', 'application/pdf');
    } catch (err: any) {
      if (!(err instanceof CompartirCanceladoError)) {
        setMensaje(err?.message || 'No se pudo compartir el PDF.');
      }
    }
  }

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Corte de caja</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {resumen && !cargando && (
              <>
                {!imagenBlob ? (
                  <button onClick={generarImagen} disabled={!!exportando}>
                    {exportando === 'imagen' ? 'Generando...' : '🖼️ Imagen'}
                  </button>
                ) : (
                  <button onClick={compartirImagenLista}>📤 Compartir imagen</button>
                )}
                {!pdfBlob ? (
                  <button onClick={generarPdf} disabled={!!exportando}>
                    {exportando === 'pdf' ? 'Generando...' : '📄 PDF'}
                  </button>
                ) : (
                  <button onClick={compartirPdfListo}>📤 Compartir PDF</button>
                )}
              </>
            )}
            {onVerHistorial && <button onClick={onVerHistorial}>Histórico</button>}
            <button onClick={onCerrar}>Cerrar</button>
          </div>
        </div>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {cargando ? (
          <p>Cargando...</p>
        ) : (
          <div id="corte-reporte" style={{ display: 'grid', gap: '1rem', background: 'white' }}>            {resumen?.yaExisteCorteHoy ? (
              <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14, background: '#f0fdf4' }}>
                <strong>El corte de hoy ya se realizó.</strong>
                <div style={{ marginTop: 6 }}>
                  Efectivo contado: {formatoMoneda(resumen.corteExistente?.efectivoContado)}
                </div>
                <div>Saldo en banco: {formatoMoneda(resumen.corteExistente?.saldoBancoContado)}</div>
                {onVerHistorial && (
                  <p style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>
                    Si te equivocaste al capturarlo, corrígelo desde el botón "Histórico".
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.75rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
                <h3>Captura del día</h3>
                {resumen && (
                  <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                    El sistema lleva {formatoMoneda(resumen.saldoEfectivoSistema)} en efectivo — compáralo contra lo que cuentes:
                  </p>
                )}
                <input value={efectivoContado} onChange={(e) => setEfectivoContado(e.target.value)} type="number" step="0.01" placeholder="Efectivo contado" required />
                {resumen && (
                  <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                    El sistema lleva {formatoMoneda(resumen.saldoBancoSistema)} en bancos (por transferencias) — compáralo contra tu banco real:
                  </p>
                )}
                <input value={saldoBancoContado} onChange={(e) => setSaldoBancoContado(e.target.value)} type="number" step="0.01" placeholder="Saldo en banco" required />

                <label>
                  Observación (opcional)
                  <textarea
                    value={observacion}
                    onChange={(e) => setObservacion(e.target.value)}
                    placeholder="Ej. faltaron $50 porque se le regalaron a un cliente"
                    rows={2}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </label>

                {onVerHistorial && (
                  <div style={{ fontSize: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={usarFechaPersonalizada}
                        onChange={(e) => setUsarFechaPersonalizada(e.target.checked)}
                        style={{ width: 'auto' }}
                      />
                      Capturar con otra fecha (ej. el día de ayer, como punto de partida)
                    </label>
                    {usarFechaPersonalizada && (
                      <input
                        type="date"
                        value={fechaPersonalizada}
                        onChange={(e) => setFechaPersonalizada(e.target.value)}
                        style={{ marginTop: 6 }}
                      />
                    )}
                  </div>
                )}

                <button type="submit">Guardar corte</button>
              </form>
            )}

            {resumen && (
              <ReporteCorte
                resumen={resumen}
                elementId="corte-reporte-cuerpo"
                efectivoContadoEnVivo={Number(efectivoContado) || 0}
                saldoBancoContadoEnVivo={Number(saldoBancoContado) || 0}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
