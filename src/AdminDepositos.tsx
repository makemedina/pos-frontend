import { useEffect, useState } from 'react';
import { formatoMoneda } from './formato';
import { headerAuth, API_URL } from './api';
import { exportarAExcel } from './exportarExcel';

interface Deposito {
  id: string;
  monto: number;
  notas: string | null;
  fecha: string;
  registradoPor: { nombre: string };
  cancelado: boolean;
  canceladoEn: string | null;
}

interface Props {
  onCerrar: () => void;
}

export function AdminDepositos({ onCerrar }: Props) {
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [monto, setMonto] = useState('');
  const [notas, setNotas] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pestana, setPestana] = useState<'registrar' | 'historico'>('registrar');
  const [busqueda, setBusqueda] = useState('');

  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [necesitaAutorizacion, setNecesitaAutorizacion] = useState(false);
  const [autorizadoPorTelefono, setAutorizadoPorTelefono] = useState('');
  const [autorizadoPin, setAutorizadoPin] = useState('');
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    try {
      const res = await fetch(`${API_URL}/depositos`, { headers: headerAuth() });
      if (!res.ok) throw new Error();
      setDepositos(await res.json());
    } catch {
      setMensaje('No se pudieron cargar los depósitos.');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/depositos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headerAuth() },
        body: JSON.stringify({ monto: Number(monto), notas: notas.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar');
      setMensaje('Depósito registrado: se bajó de efectivo y se subió a banco.');
      setMonto('');
      setNotas('');
      cargar();
    } catch (err: any) {
      setMensaje(err.message || 'No se pudo registrar el depósito');
    }
  }

  async function confirmarCancelacion(depositoId: string) {
    setCancelando(true);
    try {
      const res = await fetch(`${API_URL}/depositos/${depositoId}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headerAuth() },
        body: JSON.stringify(
          necesitaAutorizacion ? { telefono: autorizadoPorTelefono, pin: autorizadoPin } : {}
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'REQUIERE_AUTORIZACION') {
          setNecesitaAutorizacion(true);
          setMensaje('Este depósito es de un día anterior: se necesita el teléfono y PIN de un administrador para cancelarlo.');
        } else {
          setMensaje(data.error || 'No se pudo cancelar el depósito.');
        }
        return;
      }
      setMensaje('Depósito cancelado: se regresó el monto a efectivo.');
      setConfirmandoId(null);
      setNecesitaAutorizacion(false);
      setAutorizadoPorTelefono('');
      setAutorizadoPin('');
      cargar();
    } finally {
      setCancelando(false);
    }
  }

  async function exportar() {
    try {
      await exportarAExcel(
        depositosFiltrados.map((d) => ({
          Fecha: new Date(d.fecha).toLocaleString(),
          Monto: Number(d.monto),
          Notas: d.notas || '',
          'Registrado por': d.registradoPor.nombre,
          Cancelado: d.cancelado ? 'Sí' : 'No',
        })),
        'depositos-banco'
      );
    } catch {
      setMensaje('No hay depósitos para exportar.');
    }
  }

  const depositosFiltrados = depositos.filter((d) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.trim().toLowerCase();
    return (d.notas || '').toLowerCase().includes(q) || d.registradoPor.nombre.toLowerCase().includes(q);
  });

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Depósitos a banco</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {pestana === 'historico' && <button onClick={exportar}>📊 Exportar Excel</button>}
            <button onClick={onCerrar}>Cerrar</button>
          </div>
        </div>

        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
          Úsalo cuando deposites al banco el efectivo de las ventas (por ejemplo, para pagarle a un
          proveedor por transferencia). Es un traspaso interno: baja de efectivo y sube en banco, no
          afecta ventas, gastos ni la utilidad.
        </p>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e5e5ea' }}>
          {(['registrar', 'historico'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPestana(p)}
              style={{
                background: 'none',
                border: 'none',
                padding: '8px 4px',
                borderBottom: pestana === p ? '2px solid #007aff' : '2px solid transparent',
                fontWeight: pestana === p ? 700 : 400,
                color: pestana === p ? '#007aff' : '#374151',
              }}
            >
              {p === 'registrar' ? 'Registrar' : 'Histórico'}
            </button>
          ))}
        </div>

        {pestana === 'registrar' && (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.75rem', border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '1rem', borderRadius: 14 }}>
            <h3>Registrar depósito</h3>
            <input value={monto} onChange={(e) => setMonto(e.target.value)} type="number" step="0.01" placeholder="Monto depositado" required />
            <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas (opcional, ej. para qué proveedor)" />
            <button type="submit">Guardar depósito</button>
          </form>
        )}

        {pestana === 'historico' && (
          <>
            <input
              className="buscador"
              placeholder="Buscar por notas o quién lo registró"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {depositosFiltrados.length === 0 && <p style={{ color: '#6b7280' }}>No hay depósitos que coincidan.</p>}
              {depositosFiltrados.map((deposito) => (
                <div key={deposito.id} style={{ border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)', padding: '0.75rem', borderRadius: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <strong>{formatoMoneda(Number(deposito.monto))}</strong>
                      {deposito.notas && <div style={{ fontSize: 13, color: '#6b7280' }}>{deposito.notas}</div>}
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{new Date(deposito.fecha).toLocaleString()}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <small>{deposito.registradoPor.nombre}</small>
                    </div>
                  </div>

                  {deposito.cancelado ? (
                    <div className="aviso-alerta" style={{ marginTop: 8 }}>
                      ❌ Cancelado{deposito.canceladoEn ? ` el ${new Date(deposito.canceladoEn).toLocaleString()}` : ''}
                    </div>
                  ) : confirmandoId === deposito.id ? (
                    <div className="bloque-autorizacion" style={{ marginTop: 8 }}>
                      <p className="texto-alerta" style={{ fontWeight: 600 }}>
                        ¿Seguro que quieres cancelar este depósito? No se puede deshacer.
                      </p>
                      {necesitaAutorizacion && (
                        <>
                          <input
                            placeholder="Teléfono del administrador"
                            value={autorizadoPorTelefono}
                            onChange={(e) => setAutorizadoPorTelefono(e.target.value)}
                          />
                          <input
                            placeholder="PIN"
                            type="password"
                            value={autorizadoPin}
                            onChange={(e) => setAutorizadoPin(e.target.value)}
                          />
                        </>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button onClick={() => confirmarCancelacion(deposito.id)} disabled={cancelando} style={{ flex: 1 }}>
                          {cancelando ? 'Cancelando...' : 'Sí, cancelar'}
                        </button>
                        <button onClick={() => { setConfirmandoId(null); setNecesitaAutorizacion(false); }} style={{ flex: 1 }}>
                          No, regresar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="boton-secundario"
                      onClick={() => setConfirmandoId(deposito.id)}
                      style={{ width: '100%', marginTop: 8, background: '#fff2f1', color: '#b91c1c' }}
                    >
                      🗑️ Cancelar depósito
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
