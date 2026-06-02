import { useEffect, useState, useRef } from "react";
import {
  getPlanes,
  createPlan,
  updatePlan,
  deletePlan,
} from "../../services/api.service";
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
} from "lucide-react";
import "../../styles/planes.css";

interface Plan {
  id_plan: number;
  nombre_plan: string;
  precio_plan?: number | null;
  descripcion_basica?: string | null;
  descripcion_detallada?: string | null;
  fecha_plan?: string | null;
  hora_plan?: string | null;
  imagen_url?: string | null;
}

const emptyPlan: Omit<Plan, "id_plan"> = {
  nombre_plan: "",
  precio_plan: null,
  descripcion_basica: null,
  descripcion_detallada: null,
  fecha_plan: null,
  hora_plan: null,
  imagen_url: null,
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
    const channel = supabase
      .channel("planes-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "plan" }, fetchPlanes)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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

  const openEdit = (plan: Plan) => {
    setOpenMenu(null);
    setEditing(plan);
    setFormData({
      nombre_plan: plan.nombre_plan,
      precio_plan: plan.precio_plan ?? null,
      descripcion_basica: plan.descripcion_basica ?? null,
      descripcion_detallada: plan.descripcion_detallada ?? null,
      fecha_plan: plan.fecha_plan ?? null,
      hora_plan: plan.hora_plan ?? null,
      imagen_url: plan.imagen_url ?? null,
    });
    setShowForm(true);
  };

  const openView = (plan: Plan) => {
    setOpenMenu(null);
    setViewing(plan);
  };

  const handleSave = async () => {
    if (!formData.nombre_plan.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updatePlan(editing.id_plan, formData);
      } else {
        await createPlan(formData);
      }
      setShowForm(false);
      await fetchPlanes();
    } catch (e) {
      console.error(e);
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
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: "#dbeafe", color: "#1e40af" }}>
            <Package size={24} />
          </div>
          <div className="kpi-info">
            <h3>{planes.length}</h3>
            <p>Total planes</p>
          </div>
        </div>
        <div className="kpi-card">
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
              <th>PLAN</th>
              <th>PRECIO</th>
              <th>DESCRIPCIÓN</th>
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
                <td>
                  <div className="plan-name-cell">
                    {plan.imagen_url ? (
                      <img
                        src={plan.imagen_url}
                        alt={plan.nombre_plan}
                        className="plan-thumb"
                        onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                      />
                    ) : (
                      <div className="plan-thumb-placeholder"><Package size={18} /></div>
                    )}
                    <div>
                      <div className="plan-name">{plan.nombre_plan}</div>
                      <div className="plan-desc-short">{plan.descripcion_basica ?? ""}</div>
                    </div>
                  </div>
                </td>
                <td className="precio-cell">
                  {fmtPrecio(plan.precio_plan) ?? <span className="rv-null">—</span>}
                </td>
                <td className="descripcion-cell">{plan.descripcion_basica || <span className="rv-null">—</span>}</td>
                <td>{plan.fecha_plan ?? <span className="rv-null">—</span>}</td>
                <td>{plan.hora_plan ?? <span className="rv-null">—</span>}</td>
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
                <span className="plan-card-meta-label">Fecha</span>
                <span className="plan-card-meta-value">{plan.fecha_plan ?? "—"}</span>
              </div>
              <div className="plan-card-meta-item">
                <span className="plan-card-meta-label">Hora</span>
                <span className="plan-card-meta-value">{plan.hora_plan ?? "—"}</span>
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
              {viewing.imagen_url && (
                <img src={viewing.imagen_url} alt={viewing.nombre_plan} className="modal-img" />
              )}
              <div className="modal-field"><label>Nombre</label><span>{viewing.nombre_plan}</span></div>
              <div className="modal-field"><label>Precio</label><span>{fmtPrecio(viewing.precio_plan) ?? "—"}</span></div>
              <div className="modal-field"><label>Descripción básica</label><span>{viewing.descripcion_basica || "—"}</span></div>
              <div className="modal-field"><label>Descripción detallada</label><span>{viewing.descripcion_detallada || "—"}</span></div>
              <div className="modal-field"><label>Fecha</label><span>{viewing.fecha_plan || "—"}</span></div>
              <div className="modal-field"><label>Hora</label><span>{viewing.hora_plan || "—"}</span></div>
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
                <label>Nombre *</label>
                <input
                  value={formData.nombre_plan}
                  onChange={(e) => setFormData({ ...formData, nombre_plan: e.target.value })}
                  placeholder="Nombre del plan"
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
              <div className="form-row">
                <div className="form-group">
                  <label>Fecha</label>
                  <input
                    type="date"
                    value={formData.fecha_plan ?? ""}
                    onChange={(e) => setFormData({ ...formData, fecha_plan: e.target.value || null })}
                  />
                </div>
                <div className="form-group">
                  <label>Hora</label>
                  <input
                    type="time"
                    value={formData.hora_plan ?? ""}
                    onChange={(e) => setFormData({ ...formData, hora_plan: e.target.value || null })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>URL de imagen</label>
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