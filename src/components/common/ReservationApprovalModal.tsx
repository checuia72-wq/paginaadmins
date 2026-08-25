import { CheckCircle2, Clock3, ShieldCheck, X } from "lucide-react";
import "../../styles/reservation-approval-modal.css";

type Props = {
  open: boolean;
  approving: boolean;
  reservationCode?: string | null;
  planName?: string | null;
  people?: number | null;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ReservationApprovalModal({
  open,
  approving,
  reservationCode,
  planName,
  people,
  loading = false,
  onCancel,
  onConfirm,
}: Props) {
  if (!open) return null;

  return (
    <div className="ram-overlay" role="presentation">
      <div
        className={`ram-card ${approving ? "ram-card-approve" : "ram-card-pending"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ram-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="ram-close" onClick={onCancel} disabled={loading} aria-label="Cerrar">
          <X size={19} />
        </button>

        <div className="ram-icon-wrap">
          {approving ? <CheckCircle2 size={30} /> : <Clock3 size={30} />}
        </div>

        <div className="ram-eyebrow">CONFIRMACIÓN DE RESERVA</div>
        <h2 id="ram-title">{approving ? "Aprobar reserva" : "Volver a pendiente"}</h2>
        <p className="ram-description">
          {approving
            ? "La reserva quedará confirmada y se registrará la fecha de aprobación."
            : "La reserva dejará de estar aprobada y volverá al estado pendiente. No se eliminará ningún dato."}
        </p>

        <div className="ram-summary">
          <div className="ram-summary-row">
            <span>Reserva</span>
            <strong>{reservationCode || "Sin código"}</strong>
          </div>
          {planName && (
            <div className="ram-summary-row">
              <span>Plan</span>
              <strong>{planName}</strong>
            </div>
          )}
          <div className="ram-summary-row">
            <span>Personas</span>
            <strong>{people ?? "—"}</strong>
          </div>
        </div>

        <div className="ram-note">
          <ShieldCheck size={17} />
          <span>
            {approving
              ? "Revisa los datos antes de confirmar la aprobación."
              : "Esta acción es reversible: podrás aprobar la reserva nuevamente cuando lo necesites."}
          </span>
        </div>

        <div className="ram-actions">
          <button className="ram-btn ram-btn-secondary" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button
            className={`ram-btn ${approving ? "ram-btn-success" : "ram-btn-warning"}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Guardando..." : approving ? "Sí, aprobar reserva" : "Sí, dejar pendiente"}
          </button>
        </div>
      </div>
    </div>
  );
}
