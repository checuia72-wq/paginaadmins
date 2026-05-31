export type ReservaApi = {
  id_reserva: number;
  fecha_solicitud: string;
  fecha_aprobacion: string | null;
  cantidad_personas: number;
  aprobado: boolean;

  telefono_cliente: string;
  nombre_cliente?: string | null;
  atencion_humana?: boolean;

  id_plan: number;
  nombre_plan: string;
  precio_plan: number;
  fecha_plan: string;
  hora_plan: string;
  imagen_url: string | null;
};

export type ReservaStatus =
  | "pending"
  | "receipt_received"
  | "paid_confirmed"
  | "rejected"
  | "canceled";

export type ReservaHistoryEvent = {
  id: string;
  at: string;
  by: string;
  type:
    | "status_changed"
    | "receipt_attached"
    | "marked_paid"
    | "marked_pending";
  message: string;
};

export type ReservaMeta = {
  status?: ReservaStatus;
  receiptDataUrl?: string | null;
  paidAt?: string | null;
  paidBy?: string | null;
  history?: ReservaHistoryEvent[];
};

export type ReservasMetaStore = {
  version: 1;
  byId: Record<number, ReservaMeta>;
};

