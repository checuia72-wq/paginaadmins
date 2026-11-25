/** Recargo oficial informado por la Mina de Sal, por persona extranjera. */
export const RECARGO_MINA_EXTRANJERO = 14_000;

const normalize = (v: unknown) => String(v ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export const esExtranjero = (nacionalidad: unknown): boolean => {
  const value = normalize(nacionalidad);
  return Boolean(value) && !["colombia", "colombiano", "colombiana", "col", "co"].includes(value);
};

export type PlanMina = {
  nombre_plan?: string | null;
  descripcion_basica?: string | null;
  descripcion_detallada?: string | null;
  mina?: boolean | null;
};

export const planIncluyeMina = (plan?: PlanMina | null): boolean => {
  if (!plan) return false;
  if (plan.mina === true) return true;
  const title = normalize(plan.nombre_plan);
  const detail = normalize(plan.descripcion_detallada);
  const summary = normalize(plan.descripcion_basica);
  return /\bmina\b/.test(title) ||
    /\b(ingreso|visita|acceso|entrada|recorrido)\b[^\n.]{0,65}\bmina\b/.test(detail) ||
    /\b(ingreso|visita|acceso|entrada|recorrido)\b[^\n.]{0,65}\bmina\b/.test(summary);
};

export const calcularRecargoMina = (plan: PlanMina | null | undefined, nacionalidades: unknown[] = []) => {
  const incluyeMina = planIncluyeMina(plan);
  const extranjeros = incluyeMina ? nacionalidades.filter(esExtranjero).length : 0;
  return { incluyeMina, extranjeros, valor: extranjeros * RECARGO_MINA_EXTRANJERO };
};
