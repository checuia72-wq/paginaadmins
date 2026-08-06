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
