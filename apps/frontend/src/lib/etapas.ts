/* etapas.ts — Fuente única de verdad para las etapas de conversación.
   La usan OverviewPage y ClientesAdmin. El tipo EtapaConversacion se reutiliza
   del hook existente para no duplicar definiciones. */

import type { EtapaConversacion } from "../hooks/useLiveDashboard";

export interface EtapaInfo {
  key: EtapaConversacion;
  label: string;
  color: string;
  bg: string;
}

/* Orden y estilo de cada etapa. Editar aquí afecta a Overview y a Clientes. */
export const ETAPAS: EtapaInfo[] = [
  { key: "saludo",             label: "Saludo",        color: "#6366f1", bg: "#eef2ff" },
  { key: "descripcionincluye", label: "Descripción",   color: "#3b82f6", bg: "#eff6ff" },
  { key: "como_reservar",      label: "Cómo reservar", color: "#f59e0b", bg: "#fffbeb" },
  { key: "por_confirmar",      label: "Por confirmar", color: "#f97316", bg: "#fff7ed" },
  { key: "confirmada",         label: "Confirmada",    color: "#22c55e", bg: "#f0fdf4" },
];

/* Acceso rápido por clave. */
export const ETAPAS_MAP: Record<string, EtapaInfo> = ETAPAS.reduce(
  (acc, e) => { acc[e.key] = e; return acc; },
  {} as Record<string, EtapaInfo>
);

/* Info de una etapa, con fallback neutro para valores desconocidos o nulos. */
export function getEtapaInfo(etapa?: string | null): EtapaInfo {
  if (etapa && ETAPAS_MAP[etapa]) return ETAPAS_MAP[etapa];
  return {
    key: (etapa ?? "—") as EtapaConversacion,
    label: etapa ?? "—",
    color: "#475569",
    bg: "#f1f5f9",
  };
}

/* Cuenta items por etapa (misma forma que etapaCounts en Overview). */
export function contarPorEtapa<T extends { etapaconversacion?: string | null }>(
  items: T[]
): (EtapaInfo & { count: number })[] {
  return ETAPAS.map((e) => ({
    ...e,
    count: items.filter((it) => it.etapaconversacion === e.key).length,
  }));
}