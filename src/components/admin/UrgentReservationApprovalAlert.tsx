import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3 } from "lucide-react";
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

export default function UrgentReservationApprovalAlert() {
  const [reservas, setReservas] = useState<ReservaUrgente[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getReservas()
      .then((data) => {
        if (!cancelled) setReservas(Array.isArray(data) ? data : []);
      })
      .catch((error) => console.error("No se pudieron revisar reservas próximas", error));

    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
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

  if (urgentes.length === 0) return null;

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
      <div style={{display:"flex",gap:12,alignItems:"flex-start",padding:"16px 18px",borderBottom:"1px solid rgba(212,154,42,.22)"}}>
        <div style={{width:38,height:38,borderRadius:12,display:"grid",placeItems:"center",background:"#fff0c7",color:"#a96600",flex:"0 0 auto"}}>
          <AlertTriangle size={20}/>
        </div>
        <div style={{minWidth:0,flex:1}}>
          <div style={{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:".08em",color:"#a96600"}}>Atención prioritaria</div>
          <h3 style={{margin:"3px 0 4px",fontSize:17,color:"#2c2418"}}>
            {urgentes.length === 1 ? "Hay 1 reserva pendiente a menos de 24 horas" : `Hay ${urgentes.length} reservas pendientes a menos de 24 horas`}
          </h3>
          <p style={{margin:0,fontSize:13,color:"#766550"}}>Revísalas y apruébalas antes de la hora de la visita.</p>
        </div>
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
