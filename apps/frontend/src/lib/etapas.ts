/* etapas.ts — Fuente única de verdad para las etapas de conversación.
   La usan OverviewPage y ClientesAdmin. */

export const EtapaConversacion = {
  SALUDO: "saludo",
  DESCRIPCION_INCLUYE: "descripcionincluye",
  COMO_RESERVAR: "como_reservar",
  POR_CONFIRMAR: "por_confirmar",
  CONFIRMADA: "confirmada",
} as const;

export type EtapaConversacionValue =
  (typeof EtapaConversacion)[keyof typeof EtapaConversacion];

export const ETAPAS_VALIDAS: readonly EtapaConversacionValue[] = [
  EtapaConversacion.SALUDO,
  EtapaConversacion.DESCRIPCION_INCLUYE,
  EtapaConversacion.COMO_RESERVAR,
  EtapaConversacion.POR_CONFIRMAR,
  EtapaConversacion.CONFIRMADA,
];

export function esEtapaValida(v: unknown): v is EtapaConversacionValue {
  return typeof v === "string" && ETAPAS_VALIDAS.includes(v as EtapaConversacionValue);
}

export interface EtapaInfo {
  key: EtapaConversacionValue;
  label: string;
  color: string;
  bg: string;
}

/* Orden y estilo de cada etapa. Editar aquí afecta a Overview y a Clientes. */
export const ETAPAS: EtapaInfo[] = [
  { key: EtapaConversacion.SALUDO,              label: "Saludo",        color: "#6366f1", bg: "#eef2ff" },
  { key: EtapaConversacion.DESCRIPCION_INCLUYE, label: "Descripción",   color: "#3b82f6", bg: "#eff6ff" },
  { key: EtapaConversacion.COMO_RESERVAR,       label: "Cómo reservar", color: "#f59e0b", bg: "#fffbeb" },
  { key: EtapaConversacion.POR_CONFIRMAR,       label: "Por confirmar", color: "#f97316", bg: "#fff7ed" },
  { key: EtapaConversacion.CONFIRMADA,          label: "Confirmada",    color: "#22c55e", bg: "#f0fdf4" },
];

/* Acceso rápido por clave. */
export const ETAPAS_MAP: Record<EtapaConversacionValue, EtapaInfo> = ETAPAS.reduce(
  (acc, e) => { acc[e.key] = e; return acc; },
  {} as Record<EtapaConversacionValue, EtapaInfo>
);

/* Info de una etapa, con fallback neutro para valores desconocidos o nulos. */
export function getEtapaInfo(etapa?: EtapaConversacionValue | string | null): EtapaInfo {
  if (etapa && esEtapaValida(etapa) && ETAPAS_MAP[etapa]) return ETAPAS_MAP[etapa];
  return {
    key: etapa as EtapaConversacionValue ?? ("—" as EtapaConversacionValue),
    label: etapa ?? "—",
    color: "#475569",
    bg: "#f1f5f9",
  };
}

/* Cuenta items por etapa (misma forma que etapaCounts en Overview). */
export function contarPorEtapa<T extends { etapaconversacion?: EtapaConversacionValue | string | null }>(
  items: T[]
): (EtapaInfo & { count: number })[] {
  return ETAPAS.map((e) => ({
    ...e,
    count: items.filter((it) => it.etapaconversacion === e.key).length,
  }));
}