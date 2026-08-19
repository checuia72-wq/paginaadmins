import { useEffect, useMemo, useState } from "react";
import {
  getReservas,
  createReserva,
  updateReserva,
  deleteReserva,
  getPlanes,
  getClientes,
  createCliente,
  getParticipantesPorReserva,
  createParticipante,
} from "../../services/api.service";
import {
  Plus, Eye, Pencil, Trash2, Search, X,
  ChevronLeft, ChevronRight, Phone, CheckCircle, Clock, Users, Calendar,
  UserCheck,
} from "lucide-react";
import "../../styles/reservas.css";

interface Reserva {
  id_reserva: number;
  codigo_reserva?: string | null;
  fecha_solicitud?: string | null;
  fecha_aprobacion?: string | null;
  telefono_cliente: string;
  id_plan: number;
  nombre_plan?: string;
  cantidad_personas?: number | null;
  aprobado?: boolean | null;
}

interface Plan {
  id_plan: number;
  nombre_plan: string;
}

interface Participante {
  id_participante: number;
  id_reserva: number;
  nombre: string;
  edad: number | null;
  nacionalidad?: string | null;
  tipo_documento?: string | null;
  numero_documento?: string | null;
  correo?: string | null;
  telefono_cliente?: string | null;
  telefono_participante?: string | null;
}

type NuevoParticipante = {
  nombre: string;
  edad: string;
  nacionalidad: string;
  tipo_documento: string;
  numero_documento: string;
  correo: string;
  telefono: string;
};

const emptyParticipant = (): NuevoParticipante => ({
  nombre: "",
  edad: "",
  nacionalidad: "",
  tipo_documento: "CC",
  numero_documento: "",
  correo: "",
  telefono: "",
});

const emptyForm = {
  telefono_cliente: "",
  id_plan: "" as number | "",
  cantidad_personas: 1,
  aprobado: false,
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

function fmt(dateStr?: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleString("es-CO", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function ReservasAdmin() {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [clientes, setClientes] = useState<{ telefono: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<"todos" | "aprobado" | "pendiente">("todos");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Reserva | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [newParticipants, setNewParticipants] = useState<NuevoParticipante[]>([emptyParticipant()]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [viewing, setViewing] = useState<Reserva | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [loadingParticipantes, setLoadingParticipantes] = useState(false);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [r, p, c] = await Promise.all([getReservas(), getPlanes(), getClientes()]);
      setReservas(r);
      setPlanes(p);
      setClientes(c);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const syncParticipantCount = (count: number) => {
    const safe = Math.max(1, Math.min(30, Number(count) || 1));
    setFormData((prev) => ({ ...prev, cantidad_personas: safe }));
    setNewParticipants((prev) => {
      if (prev.length === safe) return prev;
      if (prev.length < safe) return [...prev, ...Array.from({ length: safe - prev.length }, emptyParticipant)];
      return prev.slice(0, safe);
    });
  };

  const openCreate = () => {
    setEditing(null);
    setFormData(emptyForm);
    setNewParticipants([emptyParticipant()]);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (r: Reserva) => {
    setEditing(r);
    setFormData({
      telefono_cliente: r.telefono_cliente,
      id_plan: r.id_plan,
      cantidad_personas: r.cantidad_personas ?? 1,
      aprobado: !!r.aprobado,
    });
    setFormError(null);
    setShowForm(true);
  };

  const openView = async (r: Reserva) => {
    setViewing(r);
    setParticipantes([]);
    setLoadingParticipantes(true);
    try {
      setParticipantes(await getParticipantesPorReserva(r.id_reserva));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingParticipantes(false);
    }
  };

  const updateNewParticipant = (index: number, field: keyof NuevoParticipante, value: string) => {
    setNewParticipants((prev) => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
    if (index === 0 && field === "telefono") {
      setFormData((prev) => ({ ...prev, telefono_cliente: value }));
    }
  };

  const validateCreate = () => {
    if (formData.id_plan === "") return "Selecciona un plan.";
    if (!formData.telefono_cliente.trim()) return "El teléfono del cliente es obligatorio.";
    for (let i = 0; i < newParticipants.length; i++) {
      const p = newParticipants[i];
      if (!p.nombre.trim()) return `Falta el nombre del participante ${i + 1}.`;
      if (!p.telefono.trim()) return `Falta el teléfono del participante ${i + 1}.`;
      if (!p.numero_documento.trim()) return `Falta el documento del participante ${i + 1}.`;
      if (!p.nacionalidad.trim()) return `Falta la nacionalidad del participante ${i + 1}.`;
    }
    return null;
  };

  const handleSave = async () => {
    setFormError(null);
    setSaving(true);
    try {
      const fecha_aprobacion = formData.aprobado
        ? (editing?.fecha_aprobacion ?? new Date().toISOString())
        : null;

      if (editing) {
        await updateReserva(editing.id_reserva, {
          id_plan: Number(formData.id_plan),
          cantidad_personas: Number(formData.cantidad_personas),
          aprobado: formData.aprobado,
          fecha_aprobacion,
        });
      } else {
        const validation = validateCreate();
        if (validation) {
          setFormError(validation);
          return;
        }

        const clientPhone = formData.telefono_cliente.trim();
        const clientExists = clientes.some((c) => c.telefono === clientPhone);
        if (!clientExists) {
          await createCliente({
            telefono: clientPhone,
            atencion_humana: true,
            etapaconversacion: "saludo",
            id_plan: Number(formData.id_plan),
          });
        }

        const created = await createReserva({
          telefono_cliente: clientPhone,
          id_plan: Number(formData.id_plan),
          cantidad_personas: Number(formData.cantidad_personas),
          aprobado: formData.aprobado,
          fecha_aprobacion,
        });

        for (let index = 0; index < newParticipants.length; index++) {
          const p = newParticipants[index];
          await createParticipante({
            id_reserva: created.id_reserva,
            telefono_cliente: clientPhone,
            telefono_participante: index === 0 ? null : p.telefono.trim(),
            nombre: p.nombre.trim(),
            edad: p.edad ? Number(p.edad) : null,
            nacionalidad: p.nacionalidad.trim() || null,
            tipo_documento: p.tipo_documento || null,
            numero_documento: p.numero_documento.trim() || null,
            correo: p.correo.trim() || null,
          });
        }
      }

      setShowForm(false);
      await fetchAll();
    } catch (e: any) {
      console.error(e);
      setFormError(e?.message || "No fue posible guardar la reserva.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r: Reserva) => {
    if (!confirm(`¿Eliminar la reserva ${r.codigo_reserva || `#${r.id_reserva}`}?`)) return;
    try {
      await deleteReserva(r.id_reserva);
      await fetchAll();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleApproved = async (r: Reserva) => {
    const next = !r.aprobado;
    if (!confirm(next ? "¿Aprobar esta reserva?" : "¿Marcar esta reserva como pendiente?")) return;
    await updateReserva(r.id_reserva, {
      aprobado: next,
      fecha_aprobacion: next ? (r.fecha_aprobacion ?? new Date().toISOString()) : null,
    });
    await fetchAll();
  };

  const filtered = useMemo(() => reservas.filter((r) => {
    const q = search.trim().toLowerCase();
    const matchSearch = !q || [r.codigo_reserva, r.id_reserva, r.telefono_cliente, r.nombre_plan]
      .some((v) => String(v ?? "").toLowerCase().includes(q));
    const matchEstado = estadoFilter === "todos" || (estadoFilter === "aprobado" ? !!r.aprobado : !r.aprobado);
    return matchSearch && matchEstado;
  }), [reservas, search, estadoFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPersonas = reservas.reduce((s, r) => s + (r.cantidad_personas ?? 0), 0);
  const aprobadas = reservas.filter((r) => r.aprobado).length;
  const pendientes = reservas.length - aprobadas;

  const EstadoBadge = ({ aprobado }: { aprobado?: boolean | null }) => aprobado
    ? <span className="rv-badge rv-badge-ok"><CheckCircle size={12} /> Aprobado</span>
    : <span className="rv-badge rv-badge-pend"><Clock size={12} /> Pendiente</span>;

  return (
    <div className="rv-page">
      <div className="rv-header">
        <div><h1 className="rv-title">Reservas</h1><p className="rv-subtitle">Gestión de solicitudes, aprobaciones y participantes.</p></div>
        <button className="rv-btn-new" onClick={openCreate}><Plus size={16} /> Nueva reserva</button>
      </div>

      <div className="rv-kpis">
        <div className="rv-kpi line-blue"><div className="rv-kpi-icon rv-kpi-blue"><Calendar size={20} /></div><div><div className="rv-kpi-label">Total reservas</div><div className="rv-kpi-value">{reservas.length}</div></div></div>
        <div className="rv-kpi line-green"><div className="rv-kpi-icon rv-kpi-green"><CheckCircle size={20} /></div><div><div className="rv-kpi-label">Aprobadas</div><div className="rv-kpi-value">{aprobadas}</div></div></div>
        <div className="rv-kpi line-amber"><div className="rv-kpi-icon rv-kpi-amber"><Clock size={20} /></div><div><div className="rv-kpi-label">Pendientes</div><div className="rv-kpi-value">{pendientes}</div></div></div>
        <div className="rv-kpi line-violet"><div className="rv-kpi-icon rv-kpi-violet"><Users size={20} /></div><div><div className="rv-kpi-label">Total personas</div><div className="rv-kpi-value">{totalPersonas}</div></div></div>
      </div>

      <div className="rv-filter-bar">
        <div className="rv-search-wrap"><Search size={15} className="rv-search-icon" /><input className="rv-search-input" placeholder="Buscar código, teléfono o plan..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
        <div className="rv-filter-group"><span className="rv-filter-label">Estado:</span><select className="rv-filter-select" value={estadoFilter} onChange={(e) => { setEstadoFilter(e.target.value as "todos" | "aprobado" | "pendiente"); setPage(1); }}><option value="todos">Todos</option><option value="aprobado">Aprobado</option><option value="pendiente">Pendiente</option></select></div>
        <button className="rv-clear-btn" onClick={() => { setSearch(""); setEstadoFilter("todos"); setPage(1); }}><X size={14} /> Limpiar</button>
        <span className="rv-filter-label">Filas:</span><select className="rv-filter-select" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>{PAGE_SIZE_OPTIONS.map((n) => <option key={n}>{n}</option>)}</select>
      </div>

      <div className="rv-table-wrap rv-desktop-only">
        <table className="rv-table">
          <thead><tr><th>Código</th><th>Fecha solicitud</th><th>Fecha aprobación</th><th>Teléfono</th><th>Plan</th><th>Personas</th><th>Estado</th><th>Aprobar</th><th>Acciones</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={9} className="rv-empty">Cargando...</td></tr> : paginated.length === 0 ? <tr><td colSpan={9} className="rv-empty">Sin resultados</td></tr> : paginated.map((r) => (
              <tr key={r.id_reserva}>
                <td><strong>{r.codigo_reserva || `#${r.id_reserva}`}</strong></td>
                <td>{fmt(r.fecha_solicitud) ?? "—"}</td><td>{fmt(r.fecha_aprobacion) ?? "—"}</td>
                <td><span className="rv-phone"><Phone size={13} /> {r.telefono_cliente}</span></td>
                <td>{r.nombre_plan || `#${r.id_plan}`}</td><td>{r.cantidad_personas ?? "—"}</td><td><EstadoBadge aprobado={r.aprobado} /></td>
                <td><button type="button" role="switch" aria-checked={!!r.aprobado} className={`rv-switch ${r.aprobado ? "rv-switch-on" : ""}`} onClick={() => toggleApproved(r)}><span className="rv-switch-knob" /></button></td>
                <td><div className="action-buttons"><button className="action-btn action-ver" onClick={() => openView(r)}><Eye size={14} /> Ver</button><button className="action-btn action-editar" onClick={() => openEdit(r)}><Pencil size={14} /> Editar</button><button className="action-btn action-eliminar" onClick={() => handleDelete(r)}><Trash2 size={14} /> Eliminar</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="rv-pagination"><span className="rv-pag-info">Mostrando {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} de {filtered.length}</span><div className="rv-pag-controls"><button className="rv-pag-btn" disabled={page === 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={15} /> Anterior</button><span className="rv-pag-current">Página {page} / {totalPages}</span><button className="rv-pag-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente <ChevronRight size={15} /></button></div></div>
      </div>

      {viewing && <div className="rv-overlay" onClick={() => setViewing(null)}><div className="rv-modal rv-modal-lg" onClick={(e) => e.stopPropagation()}><div className="rv-modal-header"><h2>Reserva {viewing.codigo_reserva || `#${viewing.id_reserva}`}</h2><button className="rv-modal-close" onClick={() => setViewing(null)}><X size={20} /></button></div><div className="rv-modal-body"><div className="rv-detail-grid"><div className="rv-detail-field"><label>Teléfono</label><span>{viewing.telefono_cliente}</span></div><div className="rv-detail-field"><label>Plan</label><span>{viewing.nombre_plan}</span></div><div className="rv-detail-field"><label>Personas</label><span>{viewing.cantidad_personas}</span></div><div className="rv-detail-field"><label>Estado</label><span><EstadoBadge aprobado={viewing.aprobado} /></span></div></div><div className="rv-parts"><div className="rv-parts-head"><h3 className="rv-parts-title"><UserCheck size={15} /> Participantes</h3></div>{loadingParticipantes ? <p>Cargando…</p> : <div className="rv-parts-table-wrap"><table className="rv-parts-table"><thead><tr><th>Nombre</th><th>Edad</th><th>Nacionalidad</th><th>Documento</th><th>Teléfono</th></tr></thead><tbody>{participantes.map((p) => <tr key={p.id_participante}><td>{p.nombre}</td><td>{p.edad ?? "—"}</td><td>{p.nacionalidad || "—"}</td><td>{`${p.tipo_documento || ""} ${p.numero_documento || ""}`.trim() || "—"}</td><td>{p.telefono_participante || p.telefono_cliente || "—"}</td></tr>)}</tbody></table></div>}</div></div></div></div>}

      {showForm && <div className="rv-overlay" onClick={() => !saving && setShowForm(false)}><div className="rv-modal rv-modal-lg" onClick={(e) => e.stopPropagation()}><div className="rv-modal-header"><h2>{editing ? `Editar reserva ${editing.codigo_reserva || `#${editing.id_reserva}`}` : "Nueva reserva"}</h2><button className="rv-modal-close" onClick={() => setShowForm(false)}><X size={20} /></button></div><div className="rv-modal-body">
        {formError && <div className="rv-field-error" style={{ marginBottom: 14 }}>{formError}</div>}
        {!editing && <p style={{ marginTop: 0, color: "#64748b" }}>El participante 1 corresponde también a los datos principales del cliente.</p>}
        <div className="rv-form-group"><label>Plan *</label><select value={formData.id_plan} onChange={(e) => setFormData({ ...formData, id_plan: e.target.value ? Number(e.target.value) : "" })}><option value="">Seleccionar plan</option>{planes.map((p) => <option key={p.id_plan} value={p.id_plan}>#{p.id_plan} — {p.nombre_plan}</option>)}</select></div>
        <div className="rv-form-group"><label>Cantidad de personas *</label><input type="number" min={1} max={30} value={formData.cantidad_personas} onChange={(e) => editing ? setFormData({ ...formData, cantidad_personas: Math.max(1, Number(e.target.value) || 1) }) : syncParticipantCount(Number(e.target.value))} /></div>
        <div className="rv-form-check"><input type="checkbox" id="aprobado-check" checked={formData.aprobado} onChange={(e) => setFormData({ ...formData, aprobado: e.target.checked })} /><label htmlFor="aprobado-check">Marcar como aprobada</label></div>

        {!editing && <div style={{ marginTop: 22 }}><h3 style={{ marginBottom: 12 }}>Datos de participantes</h3>{newParticipants.map((p, index) => <div key={index} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, marginBottom: 14, background: index === 0 ? "#fffbeb" : "#fff" }}><strong>Participante {index + 1}{index === 0 ? " · Cliente" : ""}</strong><div className="pt-form-row pt-form-row-2" style={{ marginTop: 10 }}><div className="pt-form-group"><label>Nombre completo *</label><input value={p.nombre} onChange={(e) => updateNewParticipant(index, "nombre", e.target.value)} /></div><div className="pt-form-group"><label>Teléfono *</label><input value={p.telefono} onChange={(e) => updateNewParticipant(index, "telefono", e.target.value)} /></div></div><div className="pt-form-row" style={{ marginTop: 10 }}><div className="pt-form-group"><label>Edad</label><input type="number" min={0} value={p.edad} onChange={(e) => updateNewParticipant(index, "edad", e.target.value)} /></div><div className="pt-form-group"><label>Nacionalidad *</label><input value={p.nacionalidad} onChange={(e) => updateNewParticipant(index, "nacionalidad", e.target.value)} /></div></div><div className="pt-form-row" style={{ marginTop: 10 }}><div className="pt-form-group"><label>Tipo documento</label><select value={p.tipo_documento} onChange={(e) => updateNewParticipant(index, "tipo_documento", e.target.value)}><option value="CC">CC</option><option value="TI">TI</option><option value="CE">CE</option><option value="PASAPORTE">Pasaporte</option><option value="OTRO">Otro</option></select></div><div className="pt-form-group"><label>Número documento *</label><input value={p.numero_documento} onChange={(e) => updateNewParticipant(index, "numero_documento", e.target.value)} /></div></div><div className="pt-form-group" style={{ marginTop: 10 }}><label>Correo</label><input type="email" value={p.correo} onChange={(e) => updateNewParticipant(index, "correo", e.target.value)} /></div></div>)}</div>}
      </div><div className="rv-modal-footer"><button className="rv-btn-cancel" onClick={() => setShowForm(false)} disabled={saving}>Cancelar</button><button className="rv-btn-save" onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : editing ? "Guardar cambios" : `Crear reserva con ${formData.cantidad_personas} participante${formData.cantidad_personas === 1 ? "" : "s"}`}</button></div></div></div>}
    </div>
  );
}
