import { useEffect, useState } from "react";
import { AlertTriangle, BellRing, ExternalLink, Headphones, MessageCircle } from "lucide-react";

export interface ClienteHandoffPendiente {
  telefono: string;
  nombre: string;
  plan: string | null;
  fechaEstado: string | null;
  ultimaInteraccion: string | null;
  whatsappUrl: string | null;
}

interface Props {
  pendientes: ClienteHandoffPendiente[];
  onShowAll: () => void;
  onAtender: (telefono: string) => void;
}

const MAX_VISIBLES = 5;
const STORAGE_PREFIX = "checua-handoff-notificacion:";
const getPermission = (): NotificationPermission | "unsupported" =>
  typeof Notification === "undefined" ? "unsupported" : Notification.permission;

function fechaLegible(value: string | null) {
  if (!value) return "Sin fecha de interacción registrada";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sin fecha de interacción registrada";
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  }).format(parsed);
}

/** Solo los chats derivados desde el bot generan estas alertas. */
export default function ClientesHandoffAlert({ pendientes, onShowAll, onAtender }: Props) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(getPermission);
  const [notificationError, setNotificationError] = useState("");

  useEffect(() => {
    if (permission !== "granted") return;
    for (const cliente of pendientes) {
      const key = STORAGE_PREFIX + cliente.telefono;
      const handoffId = cliente.fechaEstado || "pendiente";
      try {
        if (localStorage.getItem(key) === handoffId) continue;
        const notif = new Notification("Cliente necesita atención · Desierto de Checua", {
          body: cliente.nombre + " solicita atención humana desde el bot.",
          tag: "checua-handoff-" + cliente.telefono.replace(/\D/g, ""),
        });
        localStorage.setItem(key, handoffId);
        notif.onclick = () => {
          window.focus();
          notif.close();
          if (cliente.whatsappUrl) {
            window.open(cliente.whatsappUrl, "_blank", "noopener,noreferrer");
            onAtender(cliente.telefono);
          }
        };
      } catch (error) {
        console.warn("No fue posible presentar una notificación de atención", error);
      }
    }
  }, [pendientes, permission, onAtender]);

  const activarNotificaciones = async () => {
    if (typeof Notification === "undefined") return;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "denied") setNotificationError("El navegador tiene bloqueadas las notificaciones. Actívalas desde los permisos del sitio.");
      else setNotificationError("");
    } catch {
      setNotificationError("No fue posible habilitar las notificaciones del navegador.");
    }
  };

  if (!pendientes.length) return null;

  return (
    <section className="cl-handoff-alert" role="region" aria-label="Clientes que necesitan atención humana">
      <div className="cl-handoff-header">
        <div className="cl-handoff-icon"><AlertTriangle size={20}/></div>
        <div className="cl-handoff-intro">
          <div className="cl-handoff-eyebrow">Atención prioritaria · WhatsApp</div>
          <h2>
            {pendientes.length === 1
              ? "1 cliente necesita atención humana"
              : pendientes.length + " clientes necesitan atención humana"}
          </h2>
          <p>El bot derivó estas conversaciones a un asesor. Abre cada chat para continuar la atención.</p>
        </div>
        {permission === "default" && (
          <button type="button" className="cl-handoff-notify" onClick={activarNotificaciones}>
            <BellRing size={15}/> Activar notificaciones del PC
          </button>
        )}
        {permission === "granted" && (
          <span className="cl-handoff-notify-ok"><BellRing size={14}/> Alertas del PC activas</span>
        )}
      </div>
      {notificationError && <p className="cl-handoff-error" role="alert">{notificationError}</p>}
      <div className="cl-handoff-list">
        {pendientes.slice(0, MAX_VISIBLES).map((cliente) => (
          <div className="cl-handoff-item" key={cliente.telefono}>
            <div className="cl-handoff-person-icon"><Headphones size={18}/></div>
            <div className="cl-handoff-data">
              <strong>{cliente.nombre}</strong>
              <div className="cl-handoff-meta">
                <span>{cliente.telefono}</span>
                {cliente.plan && <span>· {cliente.plan}</span>}
              </div>
              <small>Última interacción: {fechaLegible(cliente.ultimaInteraccion)}</small>
            </div>
            {cliente.whatsappUrl ? (
              <a className="cl-attend-btn" href={cliente.whatsappUrl} target="_blank" rel="noopener noreferrer"
                onClick={() => onAtender(cliente.telefono)}
                aria-label={"Atender en WhatsApp a " + cliente.nombre}>
                <MessageCircle size={16}/> Atender <ExternalLink size={14}/>
              </a>
            ) : (
              <span className="cl-handoff-invalid" title="El teléfono no tiene un formato válido para WhatsApp">Revisar teléfono</span>
            )}
          </div>
        ))}
      </div>
      {pendientes.length > MAX_VISIBLES && (
        <div className="cl-handoff-footer">
          <button type="button" className="cl-handoff-show-all" onClick={onShowAll}>
            Ver los {pendientes.length} clientes que necesitan atención
          </button>
        </div>
      )}
    </section>
  );
}
