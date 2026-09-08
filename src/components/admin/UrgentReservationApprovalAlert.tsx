import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BellRing, CalendarClock, CheckCircle2, Clock3 } from "lucide-react";
import { getReservas } from "../../services/api.service";

type ReservaUrgente = {
  id_reserva: number;
  codigo_reserva?: string | null;
  aprobado?: boolean | null;
  fecha_reserva?: string | null;
  hora_reserva?: string | null;
  nombre_plan?: string | null;
  cantidad_personas?: number | null;
};

const HOUR_MS = 60 * 60 * 1000;
const COLOMBIA_OFFSET = "-05:00";
const REFRESH_MS = 5 * 60 * 1000;
const NOTIFICATION_REPEAT_MS = 2 * HOUR_MS;
const NOTIFICATION_STORAGE_PREFIX = "checua-urgent-reservation-notification:";

function visitTimestamp(reserva: ReservaUrgente) {
  if (!reserva.fecha_reserva || !reserva.hora_reserva) return null;
  const fecha = String(reserva.fecha_reserva).slice(0, 10);
  const hora = String(reserva.hora_reserva).slice(0, 8).padEnd(8, ":00");
  const parsed = new Date(`${fecha}T${hora}${COLOMBIA_OFFSET}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function formatVisit(reserva: ReservaUrgente) {
  const ts = visitTimestamp(reserva);
  if (ts == null) return "Fecha sin definir";
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

function formatRemaining(ms: number) {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function findReservationRow(code: string) {
  return Array.from(document.querySelectorAll<HTMLTableRowElement>(".rv-table tbody tr")).find(
    (row) => row.querySelector("td:first-child")?.textContent?.trim().toLowerCase() === code.toLowerCase(),
  ) ?? null;
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export default function UrgentReservationApprovalAlert() {
  const [reservas, setReservas] = useState<ReservaUrgente[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [actionError, setActionError] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(() => getNotificationPermission());

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const data = await getReservas();
        if (!cancelled) setReservas(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("No se pudieron revisar reservas próximas", error);
      }
    };

    void refresh();
    const clockTimer = window.setInterval(() => setNow(Date.now()), 60_000);
    const refreshTimer = window.setInterval(() => void refresh(), REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(clockTimer);
      window.clearInterval(refreshTimer);
    };
  }, []);

  const urgentes = useMemo(() => reservas
    .map((reserva) => ({ reserva, visita: visitTimestamp(reserva) }))
    .filter(({ reserva, visita }) => {
      if (reserva.aprobado || visita == null) return false;
      const restante = visita - now;
      return restante > 0 && restante <= 24 * HOUR_MS;
    })
    .sort((a, b) => Number(a.visita) - Number(b.visita)), [reservas, now]);

  const openApproval = (reserva: ReservaUrgente) => {
    setActionError(null);
    const code = String(reserva.codigo_reserva || `#${reserva.id_reserva}`);

    const clickSwitch = () => {
      const row = findReservationRow(code);
      const button = row?.querySelector<HTMLButtonElement>("button.rv-switch");
      if (button) {
        row?.scrollIntoView({ behavior: "smooth", block: "center" });
        button.click();
        return true;
      }
      return false;
    };

    if (clickSwitch()) return;

    const search = document.querySelector<HTMLInputElement>(".rv-search-input");
    if (!search) {
      setActionError(`No fue posible localizar ${code} en la tabla.`);
      return;
    }

    setReactInputValue(search, code);
    window.setTimeout(() => {
      if (!clickSwitch()) {
        setActionError(`La reserva ${code} está próxima, pero no se pudo abrir automáticamente. Búscala por código para aprobarla.`);
      }
    }, 180);
  };

  const showDesktopNotification = (reserva: ReservaUrgente, visita: number, force = false) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const code = String(reserva.codigo_reserva || `#${reserva.id_reserva}`);
    const storageKey = `${NOTIFICATION_STORAGE_PREFIX}${reserva.id_reserva}`;
    const lastShown = Number(localStorage.getItem(storageKey) || 0);
    const currentTime = Date.now();

    if (!force && currentTime - lastShown < NOTIFICATION_REPEAT_MS) return;

    const remaining = Math.max(0, visita - currentTime);
    const notification = new Notification(`Reserva urgente por aprobar · ${code}`, {
      body: `${reserva.nombre_plan || "Plan sin nombre"}\nFaltan ${formatRemaining(remaining)} · ${reserva.cantidad_personas || 0} persona${Number(reserva.cantidad_personas || 0) === 1 ? "" : "s"}`,
      tag: `reserva-urgente-${reserva.id_reserva}`,
      requireInteraction: remaining <= 6 * HOUR_MS,
    });

    localStorage.setItem(storageKey, String(currentTime));

    notification.onclick = () => {
      window.focus();
      notification.close();
      openApproval(reserva);
    };
  };

  useEffect(() => {
    if (notificationPermission !== "granted" || urgentes.length === 0) return;
    urgentes.forEach(({ reserva, visita }) => showDesktopNotification(reserva, Number(visita)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urgentes, notificationPermission]);

  const enableNotifications = async () => {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      setActionError("Este navegador no permite notificaciones del sistema.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === "granted") {
        setActionError(null);
        urgentes.forEach(({ reserva, visita }) => showDesktopNotification(reserva, Number(visita), true));
      } else if (permission === "denied") {
        setActionError("Las notificaciones quedaron bloqueadas. Puedes habilitarlas desde los permisos del sitio en el navegador.");
      }
    } catch (error) {
      console.error("No se pudieron activar las notificaciones", error);
      setActionError("No fue posible solicitar permiso para las notificaciones.");
    }
  };

  if (urgentes.length === 0) return null;

  return (
    <section style={{
      margin: "0 0 18px",
      border: "1px solid #f1c56f",
      borderLeft: "5px solid #d49a2a",
      borderRadius: 16,
      background: "linear-gradient(135deg,#fffaf0 0%,#fff6df 100%)",
      boxShadow: "0 12px 30px rgba(122,82,21,.10)",
      overflow: "hidden",
    }}>
      <div style={{display:"flex",gap:12,alignItems:"flex-start",padding:"16px 18px",borderBottom:"1px solid rgba(212,154,42,.22)",flexWrap:"wrap"}}>
        <div style={{width:38,height:38,borderRadius:12,display:"grid",placeItems:"center",background:"#fff0c7",color:"#a96600",flex:"0 0 auto"}}>
          <AlertTriangle size={20}/>
        </div>
        <div style={{minWidth:0,flex:"1 1 520px"}}>
          <div style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:".08em",color:"#a96600"}}>Atención prioritaria</div>
          <h3 style={{margin:"3px 0 4px",fontSize:17,color:"#2c2418"}}>
            {urgentes.length === 1 ? "Hay 1 reserva pendiente a menos de 24 horas" : `Hay ${urgentes.length} reservas pendientes a menos de 24 horas`}
          </h3>
          <p style={{margin:0,fontSize:13,color:"#766550"}}>Revísalas y apruébalas antes de la hora de la visita.</p>
        </div>

        {notificationPermission !== "unsupported" && notificationPermission !== "granted" && (
          <button
            type="button"
            onClick={enableNotifications}
            style={{border:"1px solid #d5ad63",background:"#fff",color:"#8f5e0d",fontWeight:800,borderRadius:10,padding:"9px 12px",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:7,whiteSpace:"nowrap"}}
          >
            <BellRing size={16}/>
            {notificationPermission === "denied" ? "Notificaciones bloqueadas" : "Activar notificaciones del PC"}
          </button>
        )}

        {notificationPermission === "granted" && (
          <span style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 10px",borderRadius:999,background:"#edf8ef",color:"#2f6f45",fontSize:12,fontWeight:800,whiteSpace:"nowrap"}}>
            <BellRing size={14}/> Notificaciones activas
          </span>
        )}
      </div>

      <div style={{display:"grid",gap:10,padding:12}}>
        {urgentes.map(({reserva, visita}) => {
          const code = reserva.codigo_reserva || `#${reserva.id_reserva}`;
          const remaining = Number(visita) - now;
          return (
            <div key={reserva.id_reserva} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,padding:"12px 14px",border:"1px solid #ecdab9",borderRadius:13,background:"rgba(255,255,255,.82)",flexWrap:"wrap"}}>
              <div style={{display:"flex",gap:12,alignItems:"center",minWidth:0,flex:"1 1 520px"}}>
                <div style={{width:36,height:36,borderRadius:10,display:"grid",placeItems:"center",background:"#fff7e4",color:"#b47714",flex:"0 0 auto"}}><CalendarClock size={18}/></div>
                <div style={{minWidth:0}}>
                  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                    <strong style={{fontSize:14,color:"#31271a"}}>{code}</strong>
                    <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 8px",borderRadius:999,background:"#fff0c7",color:"#965f08",fontSize:11,fontWeight:800}}><Clock3 size={11}/> Faltan {formatRemaining(remaining)}</span>
                  </div>
                  <div style={{marginTop:3,fontSize:13,color:"#5f5140",whiteSpace:"normal"}}>{reserva.nombre_plan || "Plan sin nombre"}</div>
                  <div style={{marginTop:2,fontSize:12,color:"#8a755c"}}>{formatVisit(reserva)} · {reserva.cantidad_personas || 0} persona{Number(reserva.cantidad_personas || 0) === 1 ? "" : "s"}</div>
                </div>
              </div>
              <button type="button" onClick={() => openApproval(reserva)} style={{border:"1px solid #c78d2f",background:"#c8943d",color:"#20170b",fontWeight:800,borderRadius:10,padding:"10px 14px",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:7,boxShadow:"0 5px 12px rgba(160,104,17,.15)"}}>
                <CheckCircle2 size={16}/> Aprobar ahora
              </button>
            </div>
          );
        })}
      </div>

      {actionError && <div style={{padding:"0 14px 13px",fontSize:12,color:"#a33b2f",fontWeight:600}}>{actionError}</div>}
    </section>
  );
}
