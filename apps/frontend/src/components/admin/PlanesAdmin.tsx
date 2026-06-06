import { useEffect, useState, useRef } from "react";
import {
  getPlanes,
  createPlan,
  updatePlan,
  deletePlan,
} from "../../services/api.service";
import PlanImage from "../common/PlanImage";
import "../../styles/planes.css";
import { supabase } from "../../lib/supabase";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  Package,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  MoreVertical,
  Upload,
  Calendar,
  Clock,
  Trash,
} from "lucide-react";

interface PlanFecha {
  id_fecha?: number;
  id_plan?: number;
  fecha: string;
}

interface PlanHora {
  id_hora?: number;
  id_plan?: number;
  hora: string;
}

interface Plan {
  id_plan: number;
  nombre_plan: string;
  precio_plan?: number | null;
  descripcion_basica?: string | null;
  descripcion_detallada?: string | null;
  imagen_url?: string | null;
  numero_plan?: number | null;
  tipo_fecha: "cualquier_dia" | "fechas_especificas";
  tipo_hora: "sin_hora" | "hora_fija" | "varias_horas";
  plan_fechas?: PlanFecha[];
  plan_horas?: PlanHora[];
}

const emptyPlan: Omit<Plan, "id_plan"> = {
  nombre_plan: "",
  precio_plan: null,
  descripcion_basica: null,
  descripcion_detallada: null,
  imagen_url: null,
  numero_plan: null,
  tipo_fecha: "cualquier_dia",
  tipo_hora: "sin_hora",
  plan_fechas: [],
  plan_horas: [],
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

function fmtPrecio(v?: number | null) {
  if (v == null) return null;
  return "$" + Number(v).toLocaleString("es-CO");
}

export default function PlanesAdmin() {
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros y paginación
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // Form modal
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [formData, setFormData] = useState<Omit<Plan, "id_plan">>(emptyPlan);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // View modal
  const [viewing, setViewing] = useState<Plan | null>(null);

  // Menú de acciones (móvil) — guarda el id_plan abierto
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const fetchPlanes = async () => {
    try {
      const data = await getPlanes();
      setPlanes(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlanes(); }, []);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const channel = client
      .channel("planes-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "plan" }, fetchPlanes)
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, []);

  // Cerrar el menú al hacer clic fuera
  useEffect(() => {
    if (openMenu == null) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenu]);

  const openCreate = () => {
    setEditing(null);
    setFormData(emptyPlan);
    setShowForm(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("planes")
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error("Detalle error Supabase:", uploadError);
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from("planes")
        .getPublicUrl(filePath);

      setFormData((prev) => ({ ...prev, imagen_url: publicUrlData.publicUrl }));
    } catch (error) {
      console.error("Error subiendo imagen:", error);
      alert("No se pudo subir la imagen.");
    } finally {
      setUploading(false);
    }
  };

  const openEdit = (plan: Plan) => {
    setOpenMenu(null);
    setEditing(plan);
    setFormData({
      nombre_plan: plan.nombre_plan,
      precio_plan: plan.precio_plan ?? null,
      descripcion_basica: plan.descripcion_basica ?? null,
      descripcion_detallada: plan.descripcion_detallada ?? null,
      imagen_url: plan.imagen_url ?? null,
      numero_plan: plan.numero_plan ?? null,
      tipo_fecha: plan.tipo_fecha || "cualquier_dia",
      tipo_hora: plan.tipo_hora || "sin_hora",
      plan_fechas: plan.plan_fechas || [],
      plan_horas: plan.plan_horas || [],
    });
    setShowForm(true);
  };

  const openView = (plan: Plan) => {
    setOpenMenu(null);
    setViewing(plan);
  };

  const handleSave = async () => {
    if (!formData.nombre_plan.trim()) return;

    // Validaciones de disponibilidad
    if (formData.tipo_fecha === "fechas_especificas" && (!formData.plan_fechas || formData.plan_fechas.length === 0)) {
      alert("Debe agregar al menos una fecha para el tipo de fecha específica.");
      return;
    }

    if (formData.tipo_hora === "hora_fija" && (!formData.plan_horas || formData.plan_horas.length !== 1)) {
      alert("Debe agregar exactamente una hora para el tipo de hora fija.");
      return;
    }

    if (formData.tipo_hora === "varias_horas" && (!formData.plan_horas || formData.plan_horas.length === 0)) {
      alert("Debe agregar al menos una hora para el tipo de varias horas.");
      return;
    }

    setSaving(true);

    // Limpiar datos según tipos seleccionados antes de enviar
    const finalPayload = {
      ...formData,
      plan_fechas: formData.tipo_fecha === "fechas_especificas" ? formData.plan_fechas : [],
      plan_horas: formData.tipo_hora !== "sin_hora" ? formData.plan_horas : [],
    };

    try {
      if (editing) {
        await updatePlan(editing.id_plan, finalPayload);
      } else {
        await createPlan(finalPayload);
      }
      setShowForm(false);
      await fetchPlanes();
    } catch (e) {
      console.error(e);
      alert("Ocurrió un error al guardar el plan.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (plan: Plan) => {
    setOpenMenu(null);
    if (!confirm(`¿Eliminar "${plan.nombre_plan}"?`)) return;
    try {
      await deletePlan(plan.id_plan);
      await fetchPlanes();
    } catch (e) {
      console.error(e);
    }
  };

  /* ── Filtrado y paginación ── */
  const filtered = planes.filter((p) =>
    p.nombre_plan.toLowerCase().includes(search.toLowerCase()) ||
    String(p.id_plan).includes(search.toLowerCase()) ||
    String(p.numero_plan ?? "").includes(search.toLowerCase()) ||
    (p.descripcion_basica ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleClear = () => { setSearch(""); setPage(1); };

  /* ── Acciones reutilizables (botones desktop) ── */
  const ActionButtons = ({ plan }: { plan: Plan }) => (
    <div className="action-buttons">
      <button className="action-btn action-ver" onClick={() => openView(plan)} title="Ver">
        <Eye size={15} /> Ver
      </button>
      <button className="action-btn action-editar" onClick={() => openEdit(plan)} title="Editar">
        <Pencil size={15} /> Editar
      </button>
      <button className="action-btn action-eliminar" onClick={() => handleDelete(plan)} title="Eliminar">
        <Trash2 size={15} /> Eliminar
      </button>
    </div>
  );

  /* ── Menú de tres puntos (tarjetas móviles) ── */
  const ActionMenu = ({ plan }: { plan: Plan }) => (
    <div className="plan-card-menu" ref={openMenu === plan.id_plan ? menuRef : undefined}>
      <button
        className="plan-menu-trigger"
        onClick={() => setOpenMenu(openMenu === plan.id_plan ? null : plan.id_plan)}
        aria-label="Acciones"
      >
        <MoreVertical size={18} />
      </button>
      {openMenu === plan.id_plan && (
        <div className="plan-menu-dropdown">
          <button onClick={() => openView(plan)}><Eye size={15} /> Ver</button>
          <button onClick={() => openEdit(plan)}><Pencil size={15} /> Editar</button>
          <button className="plan-menu-danger" onClick={() => handleDelete(plan)}>
            <Trash2 size={15} /> Eliminar
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="planes-page">
      {/* Header */}
      <div className="planes-header">
        <div>
          <h1 className="planes-title">Planes</h1>
          <p className="planes-subtitle">Gestión de planes, precios y disponibilidad</p>
        </div>
        <button className="btn-nuevo-plan" onClick={openCreate}>
          <Plus size={16} /> Nuevo plan
        </button>
      </div>

      {/* KPIs */}
      <div className="planes-kpis">
        <div className="kpi-card line-blue">
          <div className="kpi-icon" style={{ background: "#dbeafe", color: "#1e40af" }}>
            <Package size={24} />
          </div>
          <div className="kpi-info">
            <h3>{planes.length}</h3>
            <p>Total planes</p>
          </div>
        </div>
        <div className="kpi-card line-green">
          <div className="kpi-icon" style={{ background: "#ecfdf5", color: "#0f766e" }}>
            <Package size={24} />
          </div>
          <div className="kpi-info">
            <h3>{planes.length}</h3>
            <p>Planes activos</p>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="planes-filter-bar">
        <div className="planes-search-wrap">
          <Search size={18} className="planes-search-icon" />
          <input
            className="planes-search-input"
            placeholder="Buscar por nombre o descripción..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <div className="planes-filter-divider" />

        <button className="planes-clear-btn" onClick={handleClear}>
          <X size={14} /> Limpiar
        </button>

        <div className="planes-filter-divider" />

        <span className="planes-rows-label">Filas:</span>
        <select
          className="planes-rows-select"
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
        >
          {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>

        <button onClick={fetchPlanes} className="btn-refresh" title="Recargar">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* ── Tabla (desktop) ── */}
      <div className="planes-table-wrap planes-desktop-only">
        <table className="planes-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>N° PLAN</th>
              <th>PLAN</th>
              <th>PRECIO</th>
              <th>FECHA</th>
              <th>HORA</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>Cargando...</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>Sin resultados</td></tr>
            ) : paginated.map((plan) => (
              <tr key={plan.id_plan}>
                <td><strong>#{plan.id_plan}</strong></td>
                <td>{plan.numero_plan ?? <span className="rv-null">—</span>}</td>
                <td>
                  <div className="plan-name-cell">
                    <PlanImage 
                      src={plan.imagen_url} 
                      alt={plan.nombre_plan} 
                      className="plan-thumb" 
                    />
                    <div>
                      <div className="plan-name">{plan.nombre_plan}</div>
                      <div className="plan-desc-short">{plan.descripcion_basica ?? ""}</div>
                    </div>
                  </div>
                </td>
                <td className="precio-cell">
                  {fmtPrecio(plan.precio_plan) ?? <span className="rv-null">—</span>}
                </td>
                <td>
                  <div className="disp-badge-cell">
                    {plan.tipo_fecha === "cualquier_dia" ? (
                      <span className="badge badge-gray">Cualquier día</span>
                    ) : (
                      <span className="badge badge-yellow">Fechas esp. ({plan.plan_fechas?.length || 0})</span>
                    )}
                  </div>
                </td>
                <td>
                  <div className="disp-badge-cell">
                    {plan.tipo_hora === "sin_hora" ? (
                      <span className="badge badge-gray">Sin hora</span>
                    ) : plan.tipo_hora === "hora_fija" ? (
                      <span className="badge badge-blue">Hora fija</span>
                    ) : (
                      <span className="badge badge-teal">Varias ({plan.plan_horas?.length || 0})</span>
                    )}
                  </div>
                </td>
                <td>
                  <ActionButtons plan={plan} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Paginación */}
        <div className="planes-pagination">
          <span className="planes-pag-info">
            Mostrando {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} de {filtered.length}
          </span>
          <div className="planes-pag-controls">
            <button className="planes-pag-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={15} /> Anterior
            </button>
            <span className="planes-pag-current">Página {page} / {totalPages}</span>
            <button className="planes-pag-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Siguiente <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Tarjetas (móvil) ── */}
      <div className="planes-cards planes-mobile-only">
        {loading ? (
          <div className="plan-card-empty">Cargando...</div>
        ) : paginated.length === 0 ? (
          <div className="plan-card-empty">Sin resultados</div>
        ) : paginated.map((plan) => (
          <div className="plan-card" key={plan.id_plan}>
            <div className="plan-card-top">
              {plan.imagen_url ? (
                <img
                  src={plan.imagen_url}
                  alt={plan.nombre_plan}
                  className="plan-card-thumb"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                />
              ) : (
                <div className="plan-card-thumb-ph"><Package size={20} /></div>
              )}
              <div className="plan-card-headtext">
                <span className="plan-card-id">#{plan.id_plan}</span>
                <span className="plan-card-name">{plan.nombre_plan}</span>
                {plan.numero_plan != null && (
                  <span className="plan-card-num">N° {plan.numero_plan}</span>
                )}
              </div>
              <ActionMenu plan={plan} />
            </div>

            {plan.descripcion_basica && (
              <p className="plan-card-desc">{plan.descripcion_basica}</p>
            )}

            <div className="plan-card-meta">
              <div className="plan-card-meta-item">
                <span className="plan-card-meta-label">Precio</span>
                <span className="plan-card-meta-value precio-cell">
                  {fmtPrecio(plan.precio_plan) ?? "—"}
                </span>
              </div>
              <div className="plan-card-meta-item">
                <span className="plan-card-meta-label">Disponibilidad</span>
                <div className="plan-card-meta-value">
                  <div className="disp-badge-cell">
                    {plan.tipo_fecha === "cualquier_dia" ? (
                      <span className="badge badge-gray">Cualquier día</span>
                    ) : (
                      <span className="badge badge-yellow">Fechas esp. ({plan.plan_fechas?.length || 0})</span>
                    )}
                    {plan.tipo_hora === "sin_hora" ? (
                      <span className="badge badge-gray">Sin hora</span>
                    ) : plan.tipo_hora === "hora_fija" ? (
                      <span className="badge badge-blue">Hora fija</span>
                    ) : (
                      <span className="badge badge-teal">Varias ({plan.plan_horas?.length || 0})</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Paginación móvil */}
        <div className="planes-pagination planes-pagination-mobile">
          <span className="planes-pag-info">
            {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} de {filtered.length}
          </span>
          <div className="planes-pag-controls">
            <button className="planes-pag-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={15} />
            </button>
            <span className="planes-pag-current">{page} / {totalPages}</span>
            <button className="planes-pag-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal Ver ── */}
      {viewing && (
        <div className="modal-overlay" onClick={() => setViewing(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Detalle del plan</h2>
              <button className="modal-close" onClick={() => setViewing(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <PlanImage 
                src={viewing.imagen_url} 
                alt={viewing.nombre_plan} 
                className="modal-img" 
              />
              <div className="modal-field"><label>Nombre</label><span>{viewing.nombre_plan}</span></div>
              <div className="modal-field"><label>N° de plan</label><span>{viewing.numero_plan ?? "—"}</span></div>
              <div className="modal-field"><label>Precio</label><span>{fmtPrecio(viewing.precio_plan) ?? "—"}</span></div>
              <div className="modal-field"><label>Descripción básica</label><span>{viewing.descripcion_basica || "—"}</span></div>
              <div className="modal-field"><label>Descripción detallada</label><span>{viewing.descripcion_detallada || "—"}</span></div>
              
              <div className="modal-field">
                <label>Disponibilidad de fecha</label>
                <span>{viewing.tipo_fecha === "cualquier_dia" ? "Cualquier día" : "Fechas específicas"}</span>
                {viewing.tipo_fecha === "fechas_especificas" && viewing.plan_fechas && (
                  <div className="modal-sublist">
                    {viewing.plan_fechas.map((f, i) => <div key={i} className="modal-subitem"><Calendar size={12} /> {f.fecha}</div>)}
                  </div>
                )}
              </div>

              <div className="modal-field">
                <label>Disponibilidad de hora</label>
                <span>
                  {viewing.tipo_hora === "sin_hora" ? "Sin hora" : 
                   viewing.tipo_hora === "hora_fija" ? "Hora fija" : "Varias horas"}
                </span>
                {viewing.tipo_hora !== "sin_hora" && viewing.plan_horas && (
                  <div className="modal-sublist">
                    {viewing.plan_horas.map((h, i) => <div key={i} className="modal-subitem"><Clock size={12} /> {h.hora}</div>)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Crear / Editar ── */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? "Editar plan" : "Nuevo plan"}</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Descripción básica</label>
                <textarea
                  value={formData.descripcion_basica ?? ""}
                  onChange={(e) => setFormData({ ...formData, descripcion_basica: e.target.value || null })}
                  rows={3}
                  placeholder="Descripción corta..."
                />
              </div>
              <div className="form-group">
                <label>Descripción detallada</label>
                <textarea
                  value={formData.descripcion_detallada ?? ""}
                  onChange={(e) => setFormData({ ...formData, descripcion_detallada: e.target.value || null })}
                  rows={4}
                  placeholder="Descripción larga..."
                />
              </div>
              <div className="form-group">
                <label>Nombre *</label>
                <input
                  value={formData.nombre_plan}
                  onChange={(e) => setFormData({ ...formData, nombre_plan: e.target.value })}
                  placeholder="Nombre del plan"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>N° de plan</label>
                  <input
                    type="number"
                    value={formData.numero_plan ?? ""}
                    onChange={(e) => setFormData({ ...formData, numero_plan: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Ej. 1"
                  />
                </div>
                <div className="form-group">
                  <label>Precio (COP)</label>
                  <input
                    type="number"
                    value={formData.precio_plan ?? ""}
                    onChange={(e) => setFormData({ ...formData, precio_plan: e.target.value ? Number(e.target.value) : null })}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* DISPONIBILIDAD DE FECHA */}
              <div className="form-section">
                <h3 className="section-title">Disponibilidad de fecha</h3>
                <div className="radio-group">
                  <label className="radio-label">
                    <input 
                      type="radio" 
                      name="tipo_fecha" 
                      value="cualquier_dia" 
                      checked={formData.tipo_fecha === "cualquier_dia"}
                      onChange={() => setFormData({ ...formData, tipo_fecha: "cualquier_dia", plan_fechas: [] })}
                    />
                    <span>Cualquier día</span>
                  </label>
                  <label className="radio-label">
                    <input 
                      type="radio" 
                      name="tipo_fecha" 
                      value="fechas_especificas" 
                      checked={formData.tipo_fecha === "fechas_especificas"}
                      onChange={() => setFormData({ ...formData, tipo_fecha: "fechas_especificas" })}
                    />
                    <span>Fechas específicas</span>
                  </label>
                </div>

                {formData.tipo_fecha === "fechas_especificas" && (
                  <div className="dynamic-list">
                    {formData.plan_fechas?.map((f, idx) => (
                      <div key={idx} className="dynamic-item">
                        <Calendar size={16} className="item-icon" />
                        <input 
                          type="date" 
                          value={f.fecha} 
                          onChange={(e) => {
                            const newFechas = [...(formData.plan_fechas || [])];
                            newFechas[idx].fecha = e.target.value;
                            setFormData({ ...formData, plan_fechas: newFechas });
                          }}
                        />
                        <button type="button" className="btn-remove-item" onClick={() => {
                          const newFechas = formData.plan_fechas?.filter((_, i) => i !== idx);
                          setFormData({ ...formData, plan_fechas: newFechas });
                        }}>
                          <Trash size={14} />
                        </button>
                      </div>
                    ))}
                    <button type="button" className="btn-add-item" onClick={() => {
                      setFormData({ ...formData, plan_fechas: [...(formData.plan_fechas || []), { fecha: "" }] });
                    }}>
                      <Plus size={14} /> Agregar fecha
                    </button>
                  </div>
                )}
              </div>

              {/* DISPONIBILIDAD DE HORA */}
              <div className="form-section">
                <h3 className="section-title">Disponibilidad de hora</h3>
                <div className="radio-group">
                  <label className="radio-label">
                    <input 
                      type="radio" 
                      name="tipo_hora" 
                      value="sin_hora" 
                      checked={formData.tipo_hora === "sin_hora"}
                      onChange={() => setFormData({ ...formData, tipo_hora: "sin_hora", plan_horas: [] })}
                    />
                    <span>Sin hora</span>
                  </label>
                  <label className="radio-label">
                    <input 
                      type="radio" 
                      name="tipo_hora" 
                      value="hora_fija" 
                      checked={formData.tipo_hora === "hora_fija"}
                      onChange={() => {
                        const newHoras = formData.plan_horas?.length ? [formData.plan_horas[0]] : [{ hora: "" }];
                        setFormData({ ...formData, tipo_hora: "hora_fija", plan_horas: newHoras });
                      }}
                    />
                    <span>Hora fija</span>
                  </label>
                  <label className="radio-label">
                    <input 
                      type="radio" 
                      name="tipo_hora" 
                      value="varias_horas" 
                      checked={formData.tipo_hora === "varias_horas"}
                      onChange={() => setFormData({ ...formData, tipo_hora: "varias_horas" })}
                    />
                    <span>Varias horas</span>
                  </label>
                </div>

                {formData.tipo_hora !== "sin_hora" && (
                  <div className="dynamic-list">
                    {formData.plan_horas?.map((h, idx) => (
                      <div key={idx} className="dynamic-item">
                        <Clock size={16} className="item-icon" />
                        <input 
                          type="time" 
                          value={h.hora} 
                          onChange={(e) => {
                            const newHoras = [...(formData.plan_horas || [])];
                            newHoras[idx].hora = e.target.value;
                            setFormData({ ...formData, plan_horas: newHoras });
                          }}
                        />
                        {formData.tipo_hora === "varias_horas" && (
                          <button type="button" className="btn-remove-item" onClick={() => {
                            const newHoras = formData.plan_horas?.filter((_, i) => i !== idx);
                            setFormData({ ...formData, plan_horas: newHoras });
                          }}>
                            <Trash size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                    {formData.tipo_hora === "varias_horas" && (
                      <button type="button" className="btn-add-item" onClick={() => {
                        setFormData({ ...formData, plan_horas: [...(formData.plan_horas || []), { hora: "" }] });
                      }}>
                        <Plus size={14} /> Agregar hora
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Imagen del plan</label>
                <div className="image-upload-container">
                  {formData.imagen_url ? (
                    <div className="image-preview-wrap">
                      <PlanImage 
                        src={formData.imagen_url} 
                        alt="Preview" 
                        className="image-preview" 
                      />
                      <button 
                        type="button" 
                        className="btn-remove-image" 
                        onClick={() => setFormData({ ...formData, imagen_url: null })}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button 
                      type="button" 
                      className="btn-upload-placeholder" 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <RefreshCw size={24} className="spin" />
                      ) : (
                        <>
                          <Upload size={24} />
                          <span>Subir imagen</span>
                        </>
                      )}
                    </button>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    style={{ display: "none" }}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>O ingresar URL de imagen manualmente</label>
                <input
                  value={formData.imagen_url ?? ""}
                  onChange={(e) => setFormData({ ...formData, imagen_url: e.target.value || null })}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancelar" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn-guardar" onClick={handleSave} disabled={saving}>
                {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}