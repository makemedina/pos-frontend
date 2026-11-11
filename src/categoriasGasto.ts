import type { NombreIcono } from './iconos';

// Categorias principales del gasto (en la base es CategoriaGasto.departamento;
// la subcategoria es CategoriaGasto.nombre). Se usan en el registro de
// gastos (AdminGastos) y en la pantalla para administrar subcategorias
// (AdminCategoriasGasto).
export const DEPARTAMENTOS = ['Administrativos', 'Operativos', 'Financieros', 'Recursos Humanos'];

export const ESTILO_DEPARTAMENTO: Record<string, { icono: NombreIcono; color: string }> = {
  Administrativos: { icono: 'documento', color: '#3f6b73' },
  Operativos: { icono: 'herramientas', color: '#ab6f47' },
  Financieros: { icono: 'banco', color: '#b8892f' },
  'Recursos Humanos': { icono: 'usuario', color: '#6b7f4e' },
};
