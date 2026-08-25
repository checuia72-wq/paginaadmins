import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import "../../styles/global-alert-modal.css";

type AlertTone = "error" | "warning" | "success" | "info";

type AlertState = {
  open: boolean;
  message: string;
  tone: AlertTone;
};

const inferTone = (message: string): AlertTone => {
  const text = message.toLowerCase();
  if (/error|no se pudo|fall[oó]|violat|denied|inv[aá]lid|obligatori|superar|no puede|no existe/.test(text)) return "error";
  if (/éxito|exito|guardad|actualizad|cread|completad/.test(text)) return "success";
  if (/advert|atenci[oó]n|revisa|debes|selecciona|agrega/.test(text)) return "warning";
  return "info";
};

export default function GlobalAlertModal() {
  const [state, setState] = useState<AlertState>({ open: false, message: "", tone: "info" });

  useEffect(() => {
    const originalAlert = window.alert;

    window.alert = (message?: any) => {
      const text = String(message ?? "").trim() || "Ocurrió una situación que requiere tu atención.";
      setState({ open: true, message: text, tone: inferTone(text) });
    };

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  const copy = useMemo(() => {
    if (state.tone === "error") return { title: "No se pudo completar la operación", subtitle: "Revisa la información e inténtalo nuevamente.", Icon: AlertTriangle };
    if (state.tone === "warning") return { title: "Revisa esta información", subtitle: "Hay un dato que debes validar antes de continuar.", Icon: AlertTriangle };
    if (state.tone === "success") return { title: "Operación completada", subtitle: "Los cambios se procesaron correctamente.", Icon: CheckCircle2 };
    return { title: "Información", subtitle: "Ten en cuenta el siguiente mensaje.", Icon: Info };
  }, [state.tone]);

  if (!state.open) return null;

  const close = () => setState((prev) => ({ ...prev, open: false }));
  const Icon = copy.Icon;

  return (
    <div className="global-alert-backdrop" role="presentation">
      <section className={`global-alert-card is-${state.tone}`} role="alertdialog" aria-modal="true" aria-labelledby="global-alert-title">
        <button className="global-alert-close" type="button" onClick={close} aria-label="Cerrar">
          <X size={18} />
        </button>

        <div className="global-alert-icon" aria-hidden="true">
          <Icon size={24} />
        </div>

        <div className="global-alert-content">
          <span className="global-alert-eyebrow">DESIERTO DE CHECUA · ADMINISTRACIÓN</span>
          <h2 id="global-alert-title">{copy.title}</h2>
          <p className="global-alert-subtitle">{copy.subtitle}</p>
          <div className="global-alert-message">{state.message}</div>
        </div>

        <div className="global-alert-actions">
          <button type="button" className="global-alert-primary" onClick={close}>Entendido</button>
        </div>
      </section>
    </div>
  );
}
