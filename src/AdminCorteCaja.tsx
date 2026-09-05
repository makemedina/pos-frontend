import { useEffect, useState } from 'react';
import { formatoMoneda } from './formato';
import {
  obtenerCorteDelDia,
  guardarEfectivoCorte,
  guardarBancoCorte,
  conciliarCorte,
  type ResumenCorteDia,
} from './api';
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
  const [guardando, setGuardando] = useState(false);
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

  const fecha = usarFechaPersonalizada ? fechaPersonalizada : undefined;

  async function handleGuardarEfectivo(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      await guardarEfectivoCorte(Number(efectivoContado), fecha, observacion);
      setMensaje('Efectivo guardado. Ahora captura cuánto hay en banco.');
      setEfectivoContado('');
      setObservacion('');
      setUsarFechaPersonalizada(false);
      cargarResumen();
    } catch (err: any) {
      setMensaje(err.error || 'No se pudo guardar el efectivo del corte');
    } finally {
      setGuardando(false);
    }
  }

  async function handleGuardarBanco(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      await guardarBancoCorte(Number(saldoBancoContado), fecha, observacion);
      setMensaje('Banco guardado. Ahora concilia el corte para cerrarlo.');
      setSaldoBancoContado('');
      setObservacion('');
      cargarResumen();
    } catch (err: any) {
      setMensaje(err.error || 'No se pudo guardar el banco del corte');
    } finally {
      setGuardando(false);
    }
  }

  async function handleConciliar() {
    setGuardando(true);
    try {
      await conciliarCorte(fecha);
      setMensaje('Corte conciliado y cerrado.');
      cargarResumen();
    } catch (err: any) {
      setMensaje(err.error || 'No se pudo conciliar el corte');
    } finally {
      setGuardando(false);
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

  const estado = resumen?.corteExistente?.estado ?? null;

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
          <div id="corte-reporte" style={{ display: 'grid', gap: '1rem', background: 'white' }}>
            {estado === 'conciliado' ? (
              <div style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14, background: '#f0fdf4' }}>
                <strong>El corte de hoy ya se realizó.</strong>
                <div style={{ marginTop: 6 }}>
                  Efectivo contado: {formatoMoneda(resumen!.corteExistente!.efectivoContado)}
                </div>
                <div>Saldo en banco: {formatoMoneda(resumen!.corteExistente!.saldoBancoContado)}</div>
                {onVerHistorial && (
                  <p style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>
                    Si te equivocaste al capturarlo, corrígelo desde el botón "Histórico".
                  </p>
                )}
              </div>
            ) : estado === 'banco' ? (
              <div style={{ display: 'grid', gap: '0.75rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
                <h3>Paso 3 de 3: conciliar</h3>
                <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
                  Efectivo y banco ya están capturados. Revisa el reporte de abajo y, si todo se ve bien,
                  concilia el corte para cerrarlo — ya no se podrá editar desde aquí después de esto.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ flex: 1, border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 10 }}>
                    Efectivo capturado
                    <div style={{ fontWeight: 700 }}>{formatoMoneda(resumen!.corteExistente!.efectivoContado)}</div>
                  </div>
                  <div style={{ flex: 1, border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 10 }}>
                    Banco capturado
                    <div style={{ fontWeight: 700 }}>{formatoMoneda(resumen!.corteExistente!.saldoBancoContado)}</div>
                  </div>
                </div>
                <button onClick={handleConciliar} disabled={guardando}>
                  {guardando ? 'Conciliando...' : '✅ Conciliar y cerrar el corte'}
                </button>
              </div>
            ) : estado === 'efectivo' ? (
              <form onSubmit={handleGuardarBanco} style={{ display: 'grid', gap: '0.75rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
                <h3>Paso 2 de 3: banco</h3>
                <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
                  Efectivo ya capturado: {formatoMoneda(resumen!.corteExistente!.efectivoContado)}. Ahora captura
                  cuánto hay en banco.
                </p>
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
                <button type="submit" disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar banco'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleGuardarEfectivo} style={{ display: 'grid', gap: '0.75rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
                <h3>Paso 1 de 3: efectivo</h3>
                {resumen && (
                  <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                    El sistema lleva {formatoMoneda(resumen.saldoEfectivoSistema)} en efectivo — compáralo contra lo que cuentes:
                  </p>
                )}
                <input value={efectivoContado} onChange={(e) => setEfectivoContado(e.target.value)} type="number" step="0.01" placeholder="Efectivo contado" required />

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

                <button type="submit" disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar efectivo'}
                </button>
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
