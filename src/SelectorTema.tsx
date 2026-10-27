import { useState } from 'react';
import { Icono, type NombreIcono } from './iconos';
import { guardarPreferenciaTema, leerPreferenciaTema, type PreferenciaTema } from './tema';

const SIGUIENTE: Record<PreferenciaTema, PreferenciaTema> = { claro: 'oscuro', oscuro: 'auto', auto: 'claro' };
const ETIQUETA: Record<PreferenciaTema, string> = { claro: 'Tema claro', oscuro: 'Tema oscuro', auto: 'Tema automático' };
const ICONO: Record<PreferenciaTema, NombreIcono> = { claro: 'sol', oscuro: 'luna', auto: 'monitor' };

// Un solo boton que rota Claro -> Oscuro -> Automatico (sigue al telefono/computadora).
export default function SelectorTema() {
  const [pref, setPref] = useState<PreferenciaTema>(leerPreferenciaTema);

  function cambiar() {
    const nueva = SIGUIENTE[pref];
    guardarPreferenciaTema(nueva);
    setPref(nueva);
  }

  return (
    <button
      type="button"
      className="boton-secundario"
      onClick={cambiar}
      style={{ width: '100%' }}
      title="Toca para cambiar entre claro, oscuro y automático"
    >
      <Icono nombre={ICONO[pref]} size={16} /> {ETIQUETA[pref]}
    </button>
  );
}
