import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye, Filter, Pencil, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { getControlOperativo, updateControlParticipante, updateControlReserva, type ControlOperativoRow } from "../services/controlOperativo.service";
import { getMetodosPagoActivos } from "../services/medioPago.service";
import { getRestaurantesActivos } from "../services/restaurante.service";
import "../styles/control-operativo.css";

const money = (value: number) => `$${Number(value || 0).toLocaleString("es-CO")}`;
const yesNo = (value: boolean | null) => (value ? "SI" : "NO");
const normalizeHour = (value: string) => value ? value.slice(0, 5) : "—";
const normalizePhone = (value: string) => String(value || "").replace(/\D/g, "");
const normalizeText = (value: unknown) => String(value ?? "").trim().toLowerCase();
const formatDate = (value: string) => {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};
const esc = (value: unknown) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function exportExcel(rows: ControlOperativoRow[]) {
  const columns: [string, (r: ControlOperativoRow) => unknown][] = [
    ["Código reserva", r => r.reserva_codigo], ["Ruta/Plan", r => r.plan], ["Fecha reserva", r => formatDate(r.fecha)], ["Horario", r => normalizeHour(r.hora)],
    ["Nombre", r => r.nombre], ["Edad", r => r.edad ?? ""], ["Nacionalidad", r => r.nacionalidad], ["Documento", r => r.documento], ["Contacto", r => r.contacto],
    ["Cantidad", r => r.cantidad ?? ""], ["Mina", r => yesNo(r.mina)], ["Refrigerio", r => yesNo(r.refrigerio)], ["Restaurante", r => r.restaurante], ["Almuerzo", r => r.almuerzo],
    ["Total", r => r.total], ["Abono", r => r.abono], ["Medio Abono", r => r.medio_abono], ["Pago Saldo", r => r.pago_saldo], ["Medio Saldo", r => r.medio_saldo],
    ["Saldo Pendiente", r => r.saldo_pendiente], ["Observación", r => r.observacion],
  ];
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${columns.map(([h]) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${columns.map(([, fn]) => `<td>${esc(fn(r))}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
  const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `control-operativo-${new Date().toISOString().slice(0, 10)}.xls`; a.click(); URL.revokeObjectURL(url);
}

export default function ControlOperativoPage() {
  const [rows, setRows] = useState<ControlOperativoRow[]>([]);
  const [metodosPago, setMetodosPago] = useState<string[]>([]);
  const [restaurantes, setRestaurantes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(""); const [fecha, setFecha] = useState(""); const [plan, setPlan] = useState(""); const [hora, setHora] = useState("");
  const [mina, setMina] = useState(""); const [refrigerio, setRefrigerio] = useState(""); const [almuerzo, setAlmuerzo] = useState("");
  const [selected, setSelected] = useState<ControlOperativoRow | null>(null); const [editing, setEditing] = useState<ControlOperativoRow | null>(null); const [saving, setSaving] = useState(false);

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true); setError(null);
    try {
      const [operativo, pagos, restaurantesData] = await Promise.all([
        getControlOperativo(),
        getMetodosPagoActivos(),
        getRestaurantesActivos(),
      ]);
      setRows(operativo);
      setMetodosPago(pagos);
      setRestaurantes(restaurantesData);
    } catch (e: any) { setError(e?.message || "No fue posible cargar el control operativo."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const planes = useMemo(() => [...new Set(rows.map(r => r.plan).filter(Boolean))].sort(), [rows]);
  const fechas = useMemo(() => [...new Set(rows.map(r => r.fecha).filter(Boolean))].sort(), [rows]);
  const horas = useMemo(() => [...new Set(rows.map(r => r.hora).filter(Boolean))].sort(), [rows]);
  const planOptions = useMemo(() => [...new Map(rows.filter(r => r.id_plan != null).map(r => [r.id_plan as number, r.plan])).entries()], [rows]);
  const hourOptions = useMemo(() => [...new Map(rows.filter(r => r.id_hora != null).map(r => [r.id_hora as number, r.hora])).entries()], [rows]);

  const filtered = useMemo(() => {
    const q = normalizeText(search);
    return rows.filter(r => {
      if (fecha && r.fecha !== fecha) return false;
      if (plan && r.plan !== plan) return false;
      if (hora && r.hora !== hora) return false;
      if (mina === "si" && !r.mina) return false;
      if (mina === "no" && !!r.mina) return false;
      if (refrigerio === "si" && !r.refrigerio) return false;
      if (refrigerio === "no" && !!r.refrigerio) return false;
      const tieneAlmuerzo = !!normalizeText(r.almuerzo);
      if (almuerzo === "si" && !tieneAlmuerzo) return false;
      if (almuerzo === "no" && tieneAlmuerzo) return false;
      if (q) {
        const haystack = [r.reserva_codigo, r.plan, r.fecha, formatDate(r.fecha), normalizeHour(r.hora), r.nombre, r.documento, r.contacto, r.nacionalidad, r.observacion, r.restaurante, r.almuerzo].map(normalizeText).join(" ");
        if (!haystack.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => (b.id_reserva - a.id_reserva) || ((a.id_participante ?? 0) - (b.id_participante ?? 0)));
  }, [rows, search, fecha, plan, hora, mina, refrigerio, almuerzo]);

  const quickToggle = async (row: ControlOperativoRow, field: "mina" | "refrigerio") => {
    const value = !row[field];
    try { await updateControlReserva(row.id_reserva, { [field]: value }); setRows(prev => prev.map(r => r.id_reserva === row.id_reserva ? { ...r, [field]: value } : r)); }
    catch (e: any) { setError(e?.message || "No fue posible guardar el cambio."); }
  };

  const saveEdit = async () => {
    if (!editing) return; setSaving(true); setError(null);
    try {
      await updateControlReserva(editing.id_reserva, { id_plan: editing.id_plan, id_hora: editing.id_hora, mina: editing.mina, refrigerio: editing.refrigerio, restaurante: editing.restaurante || null, valor_total: editing.total, valor_abonado: editing.abono, valor_saldo_pagado: editing.pago_saldo, metodo_pago_abono: editing.medio_abono || null, metodo_pago_saldo: editing.medio_saldo || null, observacion: editing.observacion || null });
      if (editing.id_participante) {
        const participantPhone = normalizePhone(editing.contacto) && normalizePhone(editing.contacto) !== normalizePhone(editing.contacto_cliente) ? editing.contacto.trim() : null;
        await updateControlParticipante(editing.id_participante, { nombre: editing.nombre || null, edad: editing.edad, nacionalidad: editing.nacionalidad || null, numero_documento: editing.documento || null, telefono_participante: participantPhone, tipo_almuerzo: editing.almuerzo.trim() || null });
      }
      setEditing(null); await load(true);
    } catch (e: any) { setError(e?.message || "No fue posible guardar los cambios."); } finally { setSaving(false); }
  };

  if (loading) return <div className="op-loading"><div className="spinner" /><span>Cargando control operativo…</span></div>;
  let previousReserva: number | null = null;

  return <div className="op-page">
    <div className="op-head"><div><h1>Control Operativo</h1><p>Vista consolidada de reservas, participantes, servicios y pagos.</p></div><div className="op-head-actions">
      <button className="op-btn secondary" onClick={() => load(true)} disabled={refreshing}><RefreshCw size={16} className={refreshing ? "spin-icon" : ""} /> Actualizar</button>
      <button className="op-btn primary" onClick={() => exportExcel(filtered)} disabled={!filtered.length}><Download size={16} /> Exportar Excel</button>
    </div></div>
    {error && <div className="op-error">{error}</div>}

    <div className="op-filters">
      <div className="op-search"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar código, nombre, fecha, horario, documento…" /></div>
      <label><span>Fecha reserva</span><select value={fecha} onChange={e => setFecha(e.target.value)}><option value="">Todas</option>{fechas.map(v => <option key={v} value={v}>{formatDate(v)}</option>)}</select></label>
      <label><span>Plan</span><select value={plan} onChange={e => setPlan(e.target.value)}><option value="">Todos</option>{planes.map(v => <option key={v} value={v}>{v}</option>)}</select></label>
      <label><span>Horario</span><select value={hora} onChange={e => setHora(e.target.value)}><option value="">Todos</option>{horas.map(v => <option key={v} value={v}>{normalizeHour(v)}</option>)}</select></label>
      <label><span>Mina</span><select value={mina} onChange={e => setMina(e.target.value)}><option value="">Todos</option><option value="si">Sí</option><option value="no">No</option></select></label>
      <label><span>Refrigerio</span><select value={refrigerio} onChange={e => setRefrigerio(e.target.value)}><option value="">Todos</option><option value="si">Sí</option><option value="no">No</option></select></label>
      <label><span>Almuerzo</span><select value={almuerzo} onChange={e => setAlmuerzo(e.target.value)}><option value="">Todos</option><option value="si">Con almuerzo</option><option value="no">Sin almuerzo</option></select></label>
      <button className="op-clear" onClick={() => { setSearch(""); setFecha(""); setPlan(""); setHora(""); setMina(""); setRefrigerio(""); setAlmuerzo(""); }}><X size={14} /> Limpiar</button>
    </div>

    <div className="op-summary"><span><Filter size={14} /> {filtered.length} filas</span><span>{new Set(filtered.map(r => r.id_reserva)).size} reservas</span><span>{filtered.filter(r => r.id_participante).length} participantes</span><span>Saldo pendiente: <b>{money([...new Map(filtered.map(r => [r.id_reserva, r])).values()].reduce((s, r) => s + r.saldo_pendiente, 0))}</b></span></div>

    <div className="op-table-wrap"><table className="op-table"><thead><tr>
      <th>Código reserva</th><th>Ruta / Plan</th><th>Fecha reserva</th><th>Horario</th><th>Nombre</th><th>Edad</th><th>Nacionalidad</th><th>Documento</th><th>Contacto</th><th>Cantidad</th><th>Mina</th><th>Refrigerio</th><th>Restaurante</th><th>Almuerzo</th><th>Total</th><th>Abono</th><th>Medio Abono</th><th>Pago Saldo</th><th>Medio Saldo</th><th>Saldo Pendiente</th><th>Observación</th><th>Acciones</th>
    </tr></thead><tbody>
      {!filtered.length ? <tr><td colSpan={22} className="op-empty">No hay registros para los filtros seleccionados.</td></tr> : filtered.map((r, index) => {
        const isFirstOfReservation = previousReserva !== r.id_reserva; const groupStart = isFirstOfReservation; previousReserva = r.id_reserva;
        return <tr key={`${r.id_reserva}-${r.id_participante ?? index}`} className={groupStart ? "group-start" : ""}>
          <td><div className="op-reserva"><strong>{r.reserva_codigo}</strong><span className="state ok">Aprobada</span></div></td><td className="plan-cell">{r.plan || "—"}</td><td className="center">{formatDate(r.fecha)}</td><td className="center">{normalizeHour(r.hora)}</td>
          <td>{r.nombre || "—"}</td><td>{r.edad ?? "—"}</td><td>{r.nacionalidad || "—"}</td><td>{r.documento || "—"}</td><td>{r.contacto || "—"}</td><td className="center">{isFirstOfReservation ? (r.cantidad ?? "—") : null}</td>
          <td><button className={`yn ${r.mina ? "yes" : "no"}`} onClick={() => quickToggle(r, "mina")}>{yesNo(r.mina)}</button></td><td><button className={`yn ${r.refrigerio ? "yes" : "no"}`} onClick={() => quickToggle(r, "refrigerio")}>{yesNo(r.refrigerio)}</button></td><td>{r.restaurante || "—"}</td><td>{r.almuerzo || "—"}</td>
          <td className="money">{isFirstOfReservation ? money(r.total) : null}</td><td className="money">{isFirstOfReservation ? money(r.abono) : null}</td><td>{isFirstOfReservation ? (r.medio_abono || "—") : null}</td><td className="money">{isFirstOfReservation ? money(r.pago_saldo) : null}</td><td>{isFirstOfReservation ? (r.medio_saldo || "—") : null}</td><td className={`money ${r.saldo_pendiente > 0 ? "pending-money" : "paid-money"}`}>{isFirstOfReservation ? money(r.saldo_pendiente) : null}</td><td className="obs-cell" title={isFirstOfReservation ? r.observacion : ""}>{isFirstOfReservation ? (r.observacion || "—") : null}</td>
          <td><div className="op-actions"><button title="Ver detalle" onClick={() => setSelected(r)}><Eye size={15} /></button><button title="Editar" onClick={() => setEditing({ ...r })}><Pencil size={15} /></button></div></td>
        </tr>;
      })}
    </tbody></table></div>

    {selected && <div className="op-modal-backdrop" onMouseDown={() => setSelected(null)}><div className="op-modal" onMouseDown={e => e.stopPropagation()}><div className="op-modal-head"><div><h2>Detalle operativo</h2><p>Reserva {selected.reserva_codigo}</p></div><button onClick={() => setSelected(null)}><X size={20} /></button></div><div className="op-detail-grid">{[
      ["Plan", selected.plan], ["Fecha reserva", formatDate(selected.fecha)], ["Horario", normalizeHour(selected.hora)], ["Participante", selected.nombre], ["Documento", `${selected.tipo_documento} ${selected.documento}`.trim()], ["Contacto", selected.contacto], ["Mina", yesNo(selected.mina)], ["Refrigerio", yesNo(selected.refrigerio)], ["Restaurante", selected.restaurante || "—"], ["Almuerzo", selected.almuerzo || "—"], ["Total", money(selected.total)], ["Abono", money(selected.abono)], ["Medio abono", selected.medio_abono || "—"], ["Pago saldo", money(selected.pago_saldo)], ["Medio saldo", selected.medio_saldo || "—"], ["Saldo pendiente", money(selected.saldo_pendiente)], ["Observación", selected.observacion || "—"],
    ].map(([k,v]) => <div key={k}><span>{k}</span><strong>{v}</strong></div>)}</div></div></div>}

    {editing && <div className="op-modal-backdrop"><div className="op-modal edit-modal"><div className="op-modal-head"><div><h2>Edición operativa</h2><p>Participante de la reserva {editing.reserva_codigo}</p></div><button onClick={() => setEditing(null)}><X size={20} /></button></div><div className="op-edit-grid">
      <label>Código de reserva<input value={editing.reserva_codigo} readOnly title="Código comercial autogenerado por la base de datos." /></label><label>Fecha reserva<input value={formatDate(editing.fecha)} readOnly /></label>
      <label>Plan<select value={editing.id_plan ?? ""} onChange={e => { const id = e.target.value ? Number(e.target.value) : null; const name = planOptions.find(([optionId]) => optionId === id)?.[1] || ""; setEditing({ ...editing, id_plan: id, plan: name }); }}><option value="">Sin plan</option>{planOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>Hora<select value={editing.id_hora ?? ""} onChange={e => { const id = e.target.value ? Number(e.target.value) : null; const value = hourOptions.find(([optionId]) => optionId === id)?.[1] || ""; setEditing({ ...editing, id_hora: id, hora: value }); }}><option value="">Sin hora</option>{hourOptions.map(([id, value]) => <option key={id} value={id}>{normalizeHour(value)}</option>)}</select></label>
      <label>Nombre<input value={editing.nombre} onChange={e => setEditing({ ...editing, nombre: e.target.value })} /></label><label>Edad<input type="number" value={editing.edad ?? ""} onChange={e => setEditing({ ...editing, edad: e.target.value ? Number(e.target.value) : null })} /></label><label>Nacionalidad<input value={editing.nacionalidad} onChange={e => setEditing({ ...editing, nacionalidad: e.target.value })} /></label><label>Documento<input value={editing.documento} onChange={e => setEditing({ ...editing, documento: e.target.value })} /></label><label>Contacto<input value={editing.contacto} onChange={e => setEditing({ ...editing, contacto: e.target.value })} /></label>
      <label>Restaurante<select value={editing.restaurante || ""} onChange={e => setEditing({ ...editing, restaurante: e.target.value })}><option value="">Sin restaurante</option>{editing.restaurante && !restaurantes.includes(editing.restaurante) && <option value={editing.restaurante}>{editing.restaurante} (histórico)</option>}{restaurantes.map(r => <option key={r} value={r}>{r}</option>)}</select></label><label>Almuerzo<input value={editing.almuerzo} onChange={e => setEditing({ ...editing, almuerzo: e.target.value })} placeholder="Opcional" /></label><label>Total<input type="number" value={editing.total} onChange={e => setEditing({ ...editing, total: Number(e.target.value) })} /></label><label>Abono<input type="number" value={editing.abono} onChange={e => setEditing({ ...editing, abono: Number(e.target.value) })} /></label>
      <label>Medio abono<select value={editing.medio_abono || ""} onChange={e => setEditing({ ...editing, medio_abono: e.target.value })}><option value="">Sin método</option>{editing.medio_abono && !metodosPago.includes(editing.medio_abono) && <option value={editing.medio_abono}>{editing.medio_abono} (histórico)</option>}{metodosPago.map(m => <option key={m} value={m}>{m}</option>)}</select></label>
      <label>Pago saldo<input type="number" value={editing.pago_saldo} onChange={e => setEditing({ ...editing, pago_saldo: Number(e.target.value) })} /></label>
      <label>Medio saldo<select value={editing.medio_saldo || ""} onChange={e => setEditing({ ...editing, medio_saldo: e.target.value })}><option value="">Sin método</option>{editing.medio_saldo && !metodosPago.includes(editing.medio_saldo) && <option value={editing.medio_saldo}>{editing.medio_saldo} (histórico)</option>}{metodosPago.map(m => <option key={m} value={m}>{m}</option>)}</select></label>
      <div className="op-checks"><label><input type="checkbox" checked={!!editing.mina} onChange={e => setEditing({ ...editing, mina: e.target.checked })} /> Mina</label><label><input type="checkbox" checked={!!editing.refrigerio} onChange={e => setEditing({ ...editing, refrigerio: e.target.checked })} /> Refrigerio</label></div><label className="full">Observación<textarea rows={3} value={editing.observacion} onChange={e => setEditing({ ...editing, observacion: e.target.value })} /></label>
    </div><div className="op-modal-footer"><button className="op-btn secondary" onClick={() => setEditing(null)}>Cancelar</button><button className="op-btn primary" onClick={saveEdit} disabled={saving}><SlidersHorizontal size={16} /> {saving ? "Guardando…" : "Guardar cambios"}</button></div></div></div>}
  </div>;
}
