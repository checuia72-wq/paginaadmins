/**
 * Presentación de observaciones de reserva. El campo puede contener la
 * configuración estructurada de Buggies usada para conservar asignaciones y
 * tarifas; nunca reemplazar ese JSON por un texto legible en la base de datos.
 */
type PersonaBuggy = { key?: string; name?: string; nombre?: string };
type AsignacionBuggy = { buggy?: number | string; driver?: string; passenger?: string | null };
type ConfiguracionBuggy = {
  tipo: "configuracion_buggy";
  ruta?: string | null;
  grupo?: string | null;
  cantidad_personas?: number;
  cantidad_buggies?: number;
  buggies_individuales?: number;
  buggies_dobles?: number;
  tarifa_buggy_individual?: number;
  tarifa_buggy_doble?: number;
  total_aplicado?: number;
  participantes?: PersonaBuggy[];
  asignacion?: AsignacionBuggy[];
  nota_operativa?: string;
  [key: string]: unknown;
};

export function parsearConfiguracionBuggy(observacion: string | null | undefined): ConfiguracionBuggy | null {
  if (!observacion || !observacion.trim().startsWith("{")) return null;
  try {
    const item: unknown = JSON.parse(observacion);
    if (item && typeof item === "object" && !Array.isArray(item) &&
        (item as Record<string, unknown>).tipo === "configuracion_buggy") {
      return item as ConfiguracionBuggy;
    }
  } catch {
    // La observación también puede ser un texto libre.
  }
  return null;
}

/** Solo el comentario humano es editable; los datos de Buggies quedan intactos. */
export function notaEditableReserva(observacion: string | null | undefined): string {
  const buggy = parsearConfiguracionBuggy(observacion);
  return buggy ? String(buggy.nota_operativa ?? "") : String(observacion ?? "");
}

export function guardarNotaReserva(
  observacionOriginal: string | null | undefined,
  texto: string,
): string | null {
  const nota = texto.trim();
  const buggy = parsearConfiguracionBuggy(observacionOriginal);
  if (!buggy) return nota || null;
  const resultado: ConfiguracionBuggy = { ...buggy };
  if (nota) resultado.nota_operativa = nota;
  else delete resultado.nota_operativa;
  return JSON.stringify(resultado);
}

const numero = (n: unknown): number => Number.isFinite(Number(n)) ? Math.max(0, Number(n)) : 0;
const monedas = (n: unknown) => "$" + numero(n).toLocaleString("es-CO", { maximumFractionDigits: 0 });

/** Texto para Ver reserva, Control Operativo, Excel y otras vistas. */
export function observacionLegibleReserva(observacion: string | null | undefined): string {
  const buggy = parsearConfiguracionBuggy(observacion);
  if (!buggy) return String(observacion ?? "").trim();
  const personas = numero(buggy.cantidad_personas);
  const total = numero(buggy.cantidad_buggies);
  const dobles = numero(buggy.buggies_dobles);
  const individuales = numero(buggy.buggies_individuales);
  const partes: string[] = [];
  if (buggy.ruta) partes.push("Ruta: " + buggy.ruta + ".");
  const composicion: string[] = [];
  if (dobles) composicion.push(dobles + (dobles === 1 ? " buggy doble" : " buggies dobles"));
  if (individuales) composicion.push(individuales + (individuales === 1 ? " buggy individual" : " buggies individuales"));
  if (!composicion.length && total) composicion.push(total + (total === 1 ? " buggy" : " buggies"));
  if (composicion.length) partes.push("Vehículos: " + composicion.join(" y ") + ".");
  if (personas) partes.push("Personas: " + personas + ".");
  const participantes = Array.isArray(buggy.participantes) ? buggy.participantes : [];
  const nombres = new Map(participantes.map(p => [String(p.key ?? ""), String(p.name ?? p.nombre ?? "")]));
  const asignaciones = Array.isArray(buggy.asignacion) ? buggy.asignacion : [];
  for (const [idx, item] of asignaciones.entries()) {
    const conductor = nombres.get(String(item.driver ?? "")) || "Sin especificar";
    const acompanante = item.passenger ? (nombres.get(String(item.passenger)) || "Sin especificar") : "";
    const numeroBuggy = numero(item.buggy) || idx + 1;
    partes.push("Buggy " + numeroBuggy + ": conduce " + conductor +
      (acompanante ? "; acompaña " + acompanante : "") + ".");
  }
  // La tarifa del vehículo no debe confundirse con el total de la reserva,
  // que puede incorporar adicionales u otros conceptos.
  if (dobles && numero(buggy.tarifa_buggy_doble)) {
    partes.push("Tarifa de buggy doble: " + monedas(buggy.tarifa_buggy_doble) + ".");
  }
  if (individuales && numero(buggy.tarifa_buggy_individual)) {
    partes.push("Tarifa de buggy individual: " + monedas(buggy.tarifa_buggy_individual) + ".");
  }
  if (buggy.nota_operativa?.trim()) partes.push("Observación adicional: " + buggy.nota_operativa.trim());
  return partes.join("\n");
}
