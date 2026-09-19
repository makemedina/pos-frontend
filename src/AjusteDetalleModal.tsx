import { useEffect, useState } from 'react';
import { formatoMoneda, formatoKg, formatoFechaHora } from './formato';
import { obtenerAjuste, type AjusteDetalle } from './api';

interface Props {
  ajusteId: string;
  onCerrar: () => void;
}

const ETIQUETAS_TIPO: Record<AjusteDetalle['tipo'], string> = {
  merma: 'Merma',
  correccion_positiva: 'Corrección +',
  correccion_negativa: 'Corrección −',
};

export function AjusteDetalleModal({ ajusteId, onCerrar }: Props) {
  const [ajuste, setAjuste] = useState<AjusteDetalle | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    obtenerAjuste(ajusteId)
      .then(setAjuste)
      .catch(() => setMensaje('No se pudo cargar el ajuste.'))
      .finally(() => setCargando(false));
  }, [ajusteId]);

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal-contenido" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '80vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <p className="titulo">{ajuste ? ETIQUETAS_TIPO[ajuste.tipo] : 'Ajuste de inventario'}</p>
          <button className="boton-cerrar" onClick={onCerrar}>✕</button>
        </div>

        {cargando && <p>Cargando...</p>}
        {mensaje && <div className="banner-mensaje">{mensaje}</div>}

        {ajuste && (
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            <div>
              <strong>{ajuste.producto}</strong> {ajuste.marca}
            </div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>{formatoFechaHora(new Date(ajuste.fecha))}</div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e5e5ea', paddingTop: 8 }}>
              <span>Cantidad</span>
              <strong>{formatoKg(ajuste.cantidad)} kg</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Impacto en utilidad</span>
              <strong style={{ color: ajuste.impactoUtilidad >= 0 ? '#16a34a' : '#b91c1c' }}>
                {formatoMoneda(ajuste.impactoUtilidad)}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Motivo</span>
              <strong>{ajuste.motivo}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Solicitado por</span>
              <strong>{ajuste.solicitadoPor}</strong>
            </div>
            {ajuste.autorizadoPor && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Autorizado por</span>
                <strong>{ajuste.autorizadoPor}</strong>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
