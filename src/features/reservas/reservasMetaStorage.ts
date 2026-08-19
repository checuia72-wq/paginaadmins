import type {
  ReservaApi,
  ReservaHistoryEvent,
  ReservaMeta,
  ReservaStatus,
  ReservasMetaStore,
} from "./types";

const STORAGE_KEY = "forigua:reservas_meta:v1";

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function getReservasMetaStore(): ReservasMetaStore {
  const parsed = safeJsonParse<ReservasMetaStore>(
    localStorage.getItem(STORAGE_KEY)
  );

  if (parsed && parsed.version === 1 && parsed.byId) return parsed;

  return { version: 1, byId: {} };
}

export function setReservasMetaStore(next: ReservasMetaStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function getReservaMeta(idReserva: number): ReservaMeta {
  const store = getReservasMetaStore();
  return store.byId[idReserva] ?? {};
}

function setReservaMeta(idReserva: number, next: ReservaMeta) {
  const store = getReservasMetaStore();
  store.byId[idReserva] = next;
  setReservasMetaStore(store);
}

function appendHistory(
  idReserva: number,
  event: Omit<ReservaHistoryEvent, "id">
) {
  const meta = getReservaMeta(idReserva);
  const history = meta.history ?? [];
  const full: ReservaHistoryEvent = {
    ...event,
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
  };
  setReservaMeta(idReserva, { ...meta, history: [full, ...history] });
}

export function resolveEffectiveStatus(
  reserva: ReservaApi,
  meta: ReservaMeta
): ReservaStatus {
  if (meta.status) return meta.status;

  if (reserva.aprobado) return "paid_confirmed";
  if (meta.receiptDataUrl) return "receipt_received";

  return "pending";
}

export function updateReservaStatus(params: {
  idReserva: number;
  nextStatus: ReservaStatus;
  by: string;
}) {
  const meta = getReservaMeta(params.idReserva);
  setReservaMeta(params.idReserva, { ...meta, status: params.nextStatus });

  appendHistory(params.idReserva, {
    at: new Date().toISOString(),
    by: params.by,
    type: "status_changed",
    message: `Estado cambiado a "${params.nextStatus}"`,
  });
}

export function attachReceipt(params: {
  idReserva: number;
  receiptDataUrl: string;
  by: string;
}) {
  const meta = getReservaMeta(params.idReserva);
  setReservaMeta(params.idReserva, {
    ...meta,
    receiptDataUrl: params.receiptDataUrl,
  });

  appendHistory(params.idReserva, {
    at: new Date().toISOString(),
    by: params.by,
    type: "receipt_attached",
    message: "Recibo adjuntado",
  });
}

export function markPaid(params: {
  idReserva: number;
  by: string;
  at?: string;
}) {
  const meta = getReservaMeta(params.idReserva);
  const at = params.at ?? new Date().toISOString();
  setReservaMeta(params.idReserva, {
    ...meta,
    status: "paid_confirmed",
    paidAt: at,
    paidBy: params.by,
  });

  appendHistory(params.idReserva, {
    at,
    by: params.by,
    type: "marked_paid",
    message: "Marcado como pagado/confirmado",
  });
}

export function markPending(params: { idReserva: number; by: string }) {
  const meta = getReservaMeta(params.idReserva);
  setReservaMeta(params.idReserva, {
    ...meta,
    status: "pending",
    paidAt: null,
    paidBy: null,
  });

  appendHistory(params.idReserva, {
    at: new Date().toISOString(),
    by: params.by,
    type: "marked_pending",
    message: "Marcado como pendiente",
  });
}

