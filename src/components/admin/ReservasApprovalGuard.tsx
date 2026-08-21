import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CreditCard, Tag, X } from "lucide-react";
import ReservasAdmin from "./ReservasAdmin";
import { getReservas } from "../../services/api.service";
import { getMetodosPagoActivos } from "../../services/medioPago.service";
import { getRestaurantesActivos } from "../../services/restaurante.service";
import {
  aprobarReservaOperativa,
  codigosCompatibles,
  getCodigosOperativos,
  type CodigoOperativo,
} from "../../services/codigoOperativo.service";

type ReservaLite = {
  id_reserva: number;
  codigo_reserva?: string | null;
  fecha_solicitud?: string | null;
  telefono_cliente: string;
  id_plan: number;
  aprobado?: boolean | null;
};

const onlyDigits = (value: string) => value.replace(/\D/g, "");
const parseMoney = (value: string) => Number(value.replace(/\./g, "").replace(/,/g, ".").replace(/[^\d.]/g, "") || 0);
const labelMetodo = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function ReservasApprovalGuard() {
  const [reservas, setReservas] = useState<ReservaLite[]>([]);
  const [metodosPago, setMetodosPago] = useState<string[]>([]);
  const [restaurantes, setRestaurantes] = useState<string[]>([]);
  const [codigos, setCodigos] = useState<CodigoOperativo[]>([]);
  const [selected, setSelected] = useState<ReservaLite | null>(null);
  const [valorAbonado, setValorAbonado] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [incluyeAlmuerzo, setIncluyeAlmuerzo] = useState(false);
  const [restaurante, setRestaurante] = useState("");
  const [codigoId, setCodigoId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getReservas(), getMetodosPagoActivos(), getRestaurantesActivos(), getCodigosOperativos()])
      .then(([reservasData, metodosData, restaurantesData, codigosData]) => {
        setReservas(Array.isArray(reservasData) ? reservasData : []);
        setMetodosPago(Array.isArray(metodosData) ? metodosData : []);
        setRestaurantes(Array.isArray(restaurantesData) ? restaurantesData : []);
        setCodigos(codigosData);
      })
      .catch((e) => console.error("No se pudieron precargar los datos para aprobación", e));
  }, []);

  const opcionesCH = useMemo(() => selected ? codigosCompatibles(codigos, selected.id_plan, incluyeAlmuerzo, restaurante) : [], [codigos, selected, incluyeAlmuerzo, restaurante]);
  useEffect(() => {
    if (!selected) return;
    if (!opcionesCH.some(c => c.id_codigo_operativo === codigoId)) setCodigoId(opcionesCH[0]?.id_codigo_operativo ?? "");
  }, [opcionesCH, selected, codigoId]);

  const identifyReservation = (button: HTMLElement): ReservaLite | null => {
    const row = button.closest("tr"); if (!row) return null;
    const codigo = row.querySelector("td:first-child")?.textContent?.trim() ?? "";
    if (codigo) {
      const byCode = reservas.find((r) => String(r.codigo_reserva ?? "").trim().toLowerCase() === codigo.toLowerCase());
      if (byCode) return byCode;
      const legacyId = Number(codigo.replace(/\D/g, ""));
      if (codigo.startsWith("#") && legacyId) { const byId = reservas.find((r) => Number(r.id_reserva) === legacyId); if (byId) return byId; }
    }
    const phone = onlyDigits(row.querySelector(".rv-phone")?.textContent ?? "");
    const candidates = reservas.filter((r) => onlyDigits(r.telefono_cliente) === phone && !r.aprobado);
    return candidates.length === 1 ? candidates[0] : null;
  };

  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    const button = (event.target as HTMLElement).closest("button.rv-switch") as HTMLElement | null;
    if (!button || button.getAttribute("aria-checked") === "true") return;
    event.preventDefault(); event.stopPropagation();
    const reserva = identifyReservation(button);
    if (!reserva) { alert("No se pudo identificar la reserva para aprobar. Actualiza la página e inténtalo nuevamente."); return; }
    setSelected(reserva); setValorAbonado(""); setMetodoPago(""); setIncluyeAlmuerzo(false); setRestaurante(""); setCodigoId(""); setError(null);
  };

  const closeModal = () => { if (!saving) setSelected(null); };

  const aprobarReserva = async () => {
    if (!selected) return;
    const valor = parseMoney(valorAbonado);
    if (!Number.isFinite(valor) || valor <= 0) { setError("Ingresa un valor abonado mayor a $0."); return; }
    if (!metodoPago) { setError("Selecciona el método de pago del abono."); return; }
    if (incluyeAlmuerzo && !restaurante) { setError("Selecciona el restaurante para la reserva con almuerzo."); return; }
    if (!codigoId) { setError("No existe un CH configurado para este plan y esta combinación. Vincúlalo primero en Códigos operativos."); return; }

    setSaving(true); setError(null);
    try {
      await aprobarReservaOperativa({ id_reserva:selected.id_reserva, valor_abonado:valor, metodo_pago:metodoPago, incluye_almuerzo:incluyeAlmuerzo, restaurante:incluyeAlmuerzo?restaurante:null, id_codigo_operativo:Number(codigoId) });
      setSelected(null); window.location.reload();
    } catch (e: any) { console.error(e); setError(e?.message || "No se pudo aprobar la reserva."); }
    finally { setSaving(false); }
  };

  return <>
    <div onClickCapture={handleClickCapture}><ReservasAdmin /></div>
    {selected && <div className="rv-overlay" onClick={closeModal}><div className="rv-modal rv-approval-modal" onClick={(e) => e.stopPropagation()}>
      <div className="rv-modal-header rv-approval-header"><div><span className="rv-approval-eyebrow">Confirmación de reserva</span><h2>Aprobar reserva {selected.codigo_reserva || `#${selected.id_reserva}`}</h2><p>Registra el abono y define la configuración operativa antes de confirmar.</p></div><button className="rv-modal-close" onClick={closeModal} disabled={saving}><X size={20}/></button></div>
      <div className="rv-modal-body rv-approval-body">
        <div className="rv-approval-grid">
          <div className="rv-form-group"><label>Valor abonado *</label><div className="rv-money-input-wrap"><span>$</span><input type="text" inputMode="numeric" autoFocus value={valorAbonado} onChange={(e)=>{const digits=e.target.value.replace(/\D/g,"");setValorAbonado(digits?Number(digits).toLocaleString("es-CO"):"");setError(null)}} placeholder="0" disabled={saving}/></div></div>
          <div className="rv-form-group"><label>Método de pago del abono *</label><select value={metodoPago} onChange={(e)=>{setMetodoPago(e.target.value);setError(null)}} disabled={saving}><option value="">Seleccionar método de pago</option>{metodosPago.map((m)=><option key={m} value={m}>{labelMetodo(m)}</option>)}</select></div>
        </div>

        <div className="rv-approval-note" style={{marginTop:14}}><div className="rv-approval-note-icon"><Tag size={18}/></div><span>El CH se calcula según el plan, si incluye almuerzo y el restaurante seleccionado. Puedes cambiar el CH entre las opciones válidas.</span></div>

        <div className="rv-approval-grid" style={{marginTop:14}}>
          <div className="rv-form-group"><label>¿Incluye almuerzo?</label><select value={incluyeAlmuerzo?"si":"no"} onChange={(e)=>{const v=e.target.value==="si";setIncluyeAlmuerzo(v);if(!v)setRestaurante("");setError(null)}}><option value="no">No</option><option value="si">Sí</option></select></div>
          <div className="rv-form-group"><label>Restaurante {incluyeAlmuerzo?"*":""}</label><select disabled={!incluyeAlmuerzo} value={restaurante} onChange={(e)=>{setRestaurante(e.target.value);setError(null)}}><option value="">Seleccionar restaurante</option>{restaurantes.map((r)=><option key={r} value={r}>{r}</option>)}</select></div>
          <div className="rv-form-group" style={{gridColumn:"1 / -1"}}><label>Código CH *</label><select value={codigoId} onChange={(e)=>setCodigoId(e.target.value?Number(e.target.value):"")}><option value="">Sin CH compatible</option>{opcionesCH.map((c)=><option key={c.id_codigo_operativo} value={c.id_codigo_operativo}>{c.codigo_ch} — {c.descripcion}</option>)}</select></div>
        </div>

        <div className="rv-approval-note"><div className="rv-approval-note-icon"><CreditCard size={18}/></div><span>Al confirmar, Supabase generará el consecutivo libre del CH para el mes de la fecha reservada y evitará códigos duplicados.</span></div>
        {error && <div className="rv-approval-error">{error}</div>}
      </div>
      <div className="rv-modal-footer rv-approval-footer"><button className="rv-btn-cancel" onClick={closeModal} disabled={saving}>Cancelar</button><button className="rv-btn-save rv-approval-save" onClick={aprobarReserva} disabled={saving}><CheckCircle2 size={16}/>{saving?"Aprobando...":"Confirmar aprobación"}</button></div>
    </div></div>}
  </>;
}
