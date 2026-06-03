import { useEffect, useState, useRef } from "react";
import {
  getClientes,
  createCliente,
  updateCliente,
  deleteCliente,
  getPlanes,
} from "../../services/api.service";
import {
  Plus, Eye, Pencil, Trash2, Search, X,
  ChevronLeft, ChevronRight, Phone, Users, Headphones, Bot,
  MessageSquare, MoreVertical, Package,
} from "lucide-react";
import "../../styles/clientes.css";
import { ETAPAS, getEtapaInfo } from "../../lib/etapas";

/* ── Tipos ─────────────────────────────────── */
interface Cliente {
  telefono: string;
  atencion_humana: boolean;
  etapaconversacion?: string | null;
  id_plan?: number | null;
}

interface Plan {
  id_plan: number;
  nombre_plan: string;
}

const emptyForm = {
  telefono: "",
  atencion_humana: false,
  etapaconversacion: "",
  id_plan: "" as number | "",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];


/* ── Componente ────────────────────────────── */
export default function ClientesAdmin() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState("");
  const [etapaFilter, setEtapaFilter] = useState("todas");
  const [atencionFilter, setAtencionFilter] = useState<"todas" | "humana" | "bot">("todas");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // Modal form
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Modal ver
  const [viewing, setViewing] = useState<Cliente | null>(null);

  // Menú acciones (móvil)
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  /* ── Fetch ── */
  const fetchClientes = async () => {
    try {
      setLoading(true);
      const [data, planesData] = await Promise.all([getClientes(), getPlanes()]);
      setClientes(data);
      setPlanes(planesData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClientes(); }, []);

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

  /* ── Helpers ── */
  const openCreate = () => {
    setEditing(null);
    setFormData(emptyForm);
    setShowForm(true);
  };

  const openEdit = (c: Cliente) => {
    setOpenMenu(null);
    setEditing(c);
    setFormData({
      telefono: c.telefono,
      atencion_humana: c.atencion_humana,
      etapaconversacion: c.etapaconversacion ?? "",
      id_plan: c.id_plan ?? "",
    });
    setShowForm(true);
  };

  const openView = (c: Cliente) => {
    setOpenMenu(null);
    setViewing(c);
  };

  const handleSave = async () => {
    if (!formData.telefono.trim()) {
      alert("El teléfono es obligatorio");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateCliente(editing.telefono, {
          atencion_humana: formData.atencion_humana,
          etapaconversacion: formData.etapaconversacion || null,
          id_plan: formData.id_plan === "" ? null : Number(formData.id_plan),
        });
      } else {
        await createCliente({
          telefono: formData.telefono,
          atencion_humana: formData.atencion_humana,
          etapaconversacion: formData.etapaconversacion || null,
          id_plan: formData.id_plan === "" ? null : Number(formData.id_plan),
        });
      }
      setShowForm(false);
      await fetchClientes();
    } catch (e: any) {
      console.error(e);
      alert("No se pudo guardar el cliente: " + (e?.message ?? "puede que el teléfono ya exista."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Cliente) => {
    setOpenMenu(null);
    if (!confirm(`¿Eliminar al cliente ${c.telefono}?`)) return;
    try {
      await deleteCliente(c.telefono);
      await fetchClientes();
    } catch (e: any) {
      console.error(e);
      alert("No se pudo eliminar. Puede que tenga reservas asociadas.");
    }
  };

  /* ── Filtrado y paginación ── */
  const etapasDisponibles = Array.from(
    new Set(clientes.map((c) => c.etapaconversacion).filter(Boolean))
  ) as string[];

  const filtered = clientes.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      c.telefono.toLowerCase().includes(q) ||
      (c.etapaconversacion ?? "").toLowerCase().includes(q);
    const matchEtapa = etapaFilter === "todas" ? true : c.etapaconversacion === etapaFilter;
    const matchAtencion =
      atencionFilter === "todas" ? true :
      atencionFilter === "humana" ? c.atencion_humana === true :
      c.atencion_humana === false;
    return matchSearch && matchEtapa && matchAtencion;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleClear = () => {
    setSearch(""); setEtapaFilter("todas"); setAtencionFilter("todas"); setPage(1);
  };

  /* ── KPIs ── */
  const totalClientes = clientes.length;
  const conHumana = clientes.filter((c) => c.atencion_humana).length;
  const soloBot = clientes.filter((c) => !c.atencion_humana).length;
  const etapasDistintas = etapasDisponibles.length;

  /* ── Sub-componentes ── */
  const nombrePlan = (id_plan?: number | null) => {
    if (id_plan == null) return null;
    return planes.find((p) => p.id_plan === id_plan)?.nombre_plan ?? `#${id_plan}`;
  };

  const PlanBadge = ({ id_plan }: { id_plan?: number | null }) => {
    const nombre = nombrePlan(id_plan);
    if (!nombre) return <span className="rv-null">—</span>;
    return <span className="cl-badge cl-badge-plan"><Package size={12} /> {nombre}</span>;
  };

  const AtencionBadge = ({ humana }: { humana: boolean }) =>
    humana
      ? <span className="cl-badge cl-badge-humana"><Headphones size={12} /> Humana</span>
      : <span className="cl-badge cl-badge-bot"><Bot size={12} /> Bot</span>;

  const EtapaBadge = ({ etapa }: { etapa?: string | null }) => {
    if (!etapa) return <span className="rv-null">—</span>;
    const info = getEtapaInfo(etapa);
    return (
      <span
        className="cl-etapa"
        style={{ color: info.color, background: info.bg, borderColor: info.color + "33" }}
      >
        <MessageSquare size={12} /> {info.label}
      </span>
    );
  };

  const ActionButtons = ({ c }: { c: Cliente }) => (
    <div className="action-buttons">
      <button className="action-btn action-ver" onClick={() => openView(c)}>
        <Eye size={14} /> Ver
      </button>
      <button className="action-btn action-editar" onClick={() => openEdit(c)}>
        <Pencil size={14} /> Editar
      </button>
      <button className="action-btn action-eliminar" onClick={() => handleDelete(c)}>
        <Trash2 size={14} /> Eliminar
      </button>
    </div>
  );

  const ActionMenu = ({ c }: { c: Cliente }) => (
    <div className="cl-card-menu" ref={openMenu === c.telefono ? menuRef : undefined}>
      <button
        className="cl-menu-trigger"
        onClick={() => setOpenMenu(openMenu === c.telefono ? null : c.telefono)}
        aria-label="Acciones"
      >
        <MoreVertical size={18} />
      </button>
      {openMenu === c.telefono && (
        <div className="cl-menu-dropdown">
          <button onClick={() => openView(c)}><Eye size={15} /> Ver</button>
          <button onClick={() => openEdit(c)}><Pencil size={15} /> Editar</button>
          <button className="cl-menu-danger" onClick={() => handleDelete(c)}>
            <Trash2 size={15} /> Eliminar
          </button>
        </div>
      )}
    </div>
  );

  /* ── Render ── */
  return (
    <div className="cl-page">

      {/* Header */}
      <div className="cl-header">
        <div>
          <h1 className="cl-title">Clientes</h1>
          <p className="cl-subtitle">Gestión de clientes, etapas de conversación y atención.</p>
        </div>
        <button className="cl-btn-new" onClick={openCreate}>
          <Plus size={16} /> Nuevo cliente
        </button>
      </div>

      {/* KPIs */}
      <div className="cl-kpis">
        <div className="cl-kpi line-blue">
          <div className="cl-kpi-icon cl-kpi-blue"><Users size={20} /></div>
          <div>
            <div className="cl-kpi-label">Total clientes</div>
            <div className="cl-kpi-value">{totalClientes}</div>
          </div>
        </div>
        <div className="cl-kpi line-amber">
          <div className="cl-kpi-icon cl-kpi-amber"><Headphones size={20} /></div>
          <div>
            <div className="cl-kpi-label">Atención humana</div>
            <div className="cl-kpi-value">{conHumana}</div>
          </div>
        </div>
        <div className="cl-kpi line-slate">
          <div className="cl-kpi-icon cl-kpi-slate"><Bot size={20} /></div>
          <div>
            <div className="cl-kpi-label">Solo bot</div>
            <div className="cl-kpi-value">{soloBot}</div>
          </div>
        </div>
        <div className="cl-kpi line-violet">
          <div className="cl-kpi-icon cl-kpi-violet"><MessageSquare size={20} /></div>
          <div>
            <div className="cl-kpi-label">Etapas distintas</div>
            <div className="cl-kpi-value">{etapasDistintas}</div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="cl-filter-bar">
        <div className="cl-search-wrap">
          <Search size={15} className="cl-search-icon" />
          <input
            className="cl-search-input"
            placeholder="Buscar por teléfono o etapa..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <div className="cl-filter-divider" />

        <div className="cl-filter-group">
          <span className="cl-filter-label">Etapa:</span>
          <select
            className="cl-filter-select"
            value={etapaFilter}
            onChange={(e) => { setEtapaFilter(e.target.value); setPage(1); }}
          >
            <option value="todas">Todas</option>
            {ETAPAS.map((et) => <option key={et.key} value={et.key}>{et.label}</option>)}
          </select>
        </div>

        <div className="cl-filter-divider" />

        <div className="cl-filter-group">
          <span className="cl-filter-label">Atención:</span>
          <select
            className="cl-filter-select"
            value={atencionFilter}
            onChange={(e) => { setAtencionFilter(e.target.value as any); setPage(1); }}
          >
            <option value="todas">Todas</option>
            <option value="humana">Humana</option>
            <option value="bot">Solo bot</option>
          </select>
        </div>

        <div className="cl-filter-divider" />

        <button className="cl-clear-btn" onClick={handleClear}>
          <X size={14} /> Limpiar
        </button>

        <div className="cl-filter-divider" />

        <span className="cl-filter-label">Filas:</span>
        <select
          className="cl-filter-select"
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
        >
          {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {/* ── Tabla (desktop) ── */}
      <div className="cl-table-wrap cl-desktop-only">
        <table className="cl-table">
          <thead>
            <tr>
              <th>TELÉFONO</th>
              <th>ATENCIÓN</th>
              <th>ETAPA</th>
              <th>PLAN</th>
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="cl-empty">Cargando...</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={5} className="cl-empty">Sin resultados</td></tr>
            ) : paginated.map((c) => (
              <tr key={c.telefono}>
                <td><span className="cl-phone"><Phone size={13} /> {c.telefono}</span></td>
                <td><AtencionBadge humana={c.atencion_humana} /></td>
                <td><EtapaBadge etapa={c.etapaconversacion} /></td>
                <td><PlanBadge id_plan={c.id_plan} /></td>
                <td><ActionButtons c={c} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Paginación */}
        <div className="cl-pagination">
          <span className="cl-pag-info">
            Mostrando {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} de {filtered.length}
          </span>
          <div className="cl-pag-controls">
            <button className="cl-pag-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={15} /> Anterior
            </button>
            <span className="cl-pag-current">Página {page} / {totalPages}</span>
            <button className="cl-pag-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Siguiente <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Tarjetas (móvil) ── */}
      <div className="cl-cards cl-mobile-only">
        {loading ? (
          <div className="cl-card-empty">Cargando...</div>
        ) : paginated.length === 0 ? (
          <div className="cl-card-empty">Sin resultados</div>
        ) : paginated.map((c) => (
          <div className="cl-card" key={c.telefono}>
            <div className="cl-card-top">
              <span className="cl-card-phone"><Phone size={15} /> {c.telefono}</span>
              <ActionMenu c={c} />
            </div>
            <div className="cl-card-badges">
              <AtencionBadge humana={c.atencion_humana} />
              <EtapaBadge etapa={c.etapaconversacion} />
              <PlanBadge id_plan={c.id_plan} />
            </div>
          </div>
        ))}

        {/* Paginación móvil */}
        <div className="cl-pagination cl-pagination-mobile">
          <span className="cl-pag-info">
            {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} de {filtered.length}
          </span>
          <div className="cl-pag-controls">
            <button className="cl-pag-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={15} />
            </button>
            <span className="cl-pag-current">{page} / {totalPages}</span>
            <button className="cl-pag-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal Ver ── */}
      {viewing && (
        <div className="cl-overlay" onClick={() => setViewing(null)}>
          <div className="cl-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cl-modal-header">
              <h2>Detalle del cliente</h2>
              <button className="cl-modal-close" onClick={() => setViewing(null)}><X size={20} /></button>
            </div>
            <div className="cl-modal-body">
              <div className="cl-detail-field"><label>Teléfono</label><span>{viewing.telefono}</span></div>
              <div className="cl-detail-field"><label>Atención</label><span><AtencionBadge humana={viewing.atencion_humana} /></span></div>
              <div className="cl-detail-field"><label>Etapa de conversación</label><span><EtapaBadge etapa={viewing.etapaconversacion} /></span></div>
              <div className="cl-detail-field"><label>Plan asociado</label><span><PlanBadge id_plan={viewing.id_plan} /></span></div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Crear / Editar ── */}
      {showForm && (
        <div className="cl-overlay" onClick={() => setShowForm(false)}>
          <div className="cl-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cl-modal-header">
              <h2>{editing ? "Editar cliente" : "Nuevo cliente"}</h2>
              <button className="cl-modal-close" onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <div className="cl-modal-body">
              <div className="cl-form-group">
                <label>Teléfono *</label>
                <input
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  placeholder="Ej. 3001234567"
                  disabled={!!editing}
                />
              </div>
              <div className="cl-form-group">
                <label>Etapa de conversación</label>
                <input
                  value={formData.etapaconversacion}
                  onChange={(e) => setFormData({ ...formData, etapaconversacion: e.target.value })}
                  placeholder="Ej. saludo, confirmada..."
                />
              </div>
              <div className="cl-form-group">
                <label>Plan asociado</label>
                <select
                  value={formData.id_plan}
                  onChange={(e) => setFormData({ ...formData, id_plan: e.target.value === "" ? "" : Number(e.target.value) })}
                >
                  <option value="">Sin plan</option>
                  {planes.map((p) => (
                    <option key={p.id_plan} value={p.id_plan}>#{p.id_plan} — {p.nombre_plan}</option>
                  ))}
                </select>
              </div>
              <div className="cl-form-check">
                <input
                  type="checkbox"
                  id="atencion-check"
                  checked={formData.atencion_humana}
                  onChange={(e) => setFormData({ ...formData, atencion_humana: e.target.checked })}
                />
                <label htmlFor="atencion-check">Requiere atención humana</label>
              </div>
            </div>
            <div className="cl-modal-footer">
              <button className="cl-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="cl-btn-save" onClick={handleSave} disabled={saving}>
                {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear cliente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}