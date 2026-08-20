import { useEffect, useState } from 'react';
import { obtenerLlamadasDeHoy, actualizarLlamadaCliente, type LlamadaHoy } from './api';

interface Props {
  onCerrar: () => void;
}

const DIAS_NOMBRE = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// wa.me necesita el numero en formato internacional. Los telefonos de
// clientes se capturan a 10 digitos (celular mexicano) sin lada pais --
// se le antepone 52 si ya viene "limpio" a 10 digitos; si ya trae algo
// distinto (ya tiene lada, espacios, etc.) se manda tal cual sin el 52
// para no inventar un numero equivocado.
function linkWhatsapp(telefono: string, mensaje: string) {
  const soloDigitos = telefono.replace(/\D/g, '');
  const numero = soloDigitos.length === 10 ? `52${soloDigitos}` : soloDigitos;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

export function AdminLlamadasHoy({ onCerrar }: Props) {
  const [llamadas, setLlamadas] = useState<LlamadaHoy[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    try {
      setLlamadas(await obtenerLlamadasDeHoy());
    } catch {
      setMensaje('No se pudieron cargar las llamadas de hoy.');
    } finally {
      setCargando(false);
    }
  }

  // Optimista para hecha/hizoPedido (feedback al toque); las notas se
  // guardan al salir del campo (onBlur), no en cada letra.
  async function actualizar(cliente: LlamadaHoy, datos: { hecha?: boolean; notas?: string; hizoPedido?: boolean }) {
    setLlamadas((prev) => prev.map((l) => (l.id === cliente.id ? { ...l, ...datos } : l)));
    setGuardandoId(cliente.id);
    try {
      await actualizarLlamadaCliente(cliente.id, datos);
    } catch {
      setMensaje('No se pudo guardar. Intenta otra vez.');
      cargar();
    } finally {
      setGuardandoId(null);
    }
  }

  const pendientes = llamadas.filter((l) => !l.hecha);
  const hechas = llamadas.filter((l) => l.hecha);
  const hoyNombre = DIAS_NOMBRE[new Date().getDay()];

  function tarjeta(c: LlamadaHoy) {
    return (
      <div
        key={c.id}
        style={{
          display: 'grid',
          gap: 8,
          border: 'none',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 8px rgba(0,0,0,0.04)',
          padding: '0.75rem',
          borderRadius: 14,
          opacity: c.hecha ? 0.75 : 1,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={c.hecha}
              disabled={guardandoId === c.id}
              onChange={() => actualizar(c, { hecha: !c.hecha })}
              style={{ marginTop: 3 }}
            />
            <span>
              <strong style={{ textDecoration: c.hecha ? 'line-through' : 'none' }}>{c.nombre}</strong>
              {c.notasCliente && <div style={{ fontSize: 12, color: '#6b7280' }}>{c.notasCliente}</div>}
            </span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <a
            href={`tel:${c.telefono}`}
            style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 10, background: '#f3f4f6', color: '#111', textDecoration: 'none', fontSize: 14 }}
          >
            📞 Llamar
          </a>
          <a
            href={linkWhatsapp(c.telefono, `Hola ${c.nombre}, te habla Mr Carnes para ofrecerte producto.`)}
            target="_blank"
            rel="noreferrer"
            style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 10, background: '#dcfce7', color: '#166534', textDecoration: 'none', fontSize: 14 }}
          >
            💬 WhatsApp
          </a>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={c.hizoPedido}
            disabled={guardandoId === c.id}
            onChange={() => actualizar(c, { hizoPedido: !c.hizoPedido })}
          />
          Hizo pedido
        </label>

        <textarea
          placeholder="Notas de esta llamada (qué dijo, cuándo volver a hablarle, etc.)"
          defaultValue={c.notas}
          onBlur={(e) => {
            if (e.target.value !== c.notas) actualizar(c, { notas: e.target.value });
          }}
          rows={2}
          style={{ fontSize: 13, resize: 'vertical' }}
        />
      </div>
    );
  }

  return (
    <div className="pantalla-centrada" style={{ alignItems: 'flex-start', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 620, display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, textTransform: 'capitalize' }}>Llamadas de hoy ({hoyNombre})</h2>
          <button onClick={onCerrar}>Cerrar</button>
        </div>

        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
          Clientes y prospectos configurados para que se les hable hoy. Márcalos conforme les hables — el
          checklist se reinicia solo cada día.
        </p>

        {mensaje && <div className="banner-mensaje" onClick={() => setMensaje(null)}>{mensaje}</div>}

        {cargando ? (
          <p style={{ textAlign: 'center', color: '#6b7280' }}>Cargando...</p>
        ) : llamadas.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#6b7280' }}>
            Nadie tiene hoy configurado como día de llamada. Puedes elegir los días de cada cliente en su
            ficha, dentro de Clientes.
          </p>
        ) : (
          <>
            {pendientes.length > 0 && (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <strong style={{ fontSize: 13, color: '#6b7280' }}>Por llamar ({pendientes.length})</strong>
                {pendientes.map(tarjeta)}
              </div>
            )}

            {hechas.length > 0 && (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <strong style={{ fontSize: 13, color: '#6b7280' }}>Ya llamados ({hechas.length})</strong>
                {hechas.map(tarjeta)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
