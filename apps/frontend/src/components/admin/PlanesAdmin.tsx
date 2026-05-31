/**
 * PlanesAdmin.tsx
 * CRUD completo de planes con Supabase en tiempo real.
 * Estética coherente con el dashboard: header oscuro, cards, modales.
 */

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
  X,
  Package,
  Search,
  RefreshCw,
  Calendar,
  Clock,
  ImageIcon,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

/* ─── tipos ─────────────────────────────────────────────── */
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

type SortKey = "nombre_plan" | "precio_plan" | "fecha_plan";
type SortDir = "asc" | "desc";

const EMPTY_FORM: Omit<Plan, "id_plan"> = {
  nombre_plan: "",
  precio_plan: null,
  descripcion_basica: "",
  descripcion_detallada: "",
  fecha_plan: null,
  hora_plan: null,
  imagen_url: "",
};

const AVATAR_COLORS = [
  "#3b82f6","#8b5cf6","#ec4899","#f59e0b",
  "#10b981","#06b6d4","#f97316","#6366f1",
];

/* ─── helpers ───────────────────────────────────────────── */
const fmt = (n?: number | null) =>
  n != null ? `$${Number(n).toLocaleString("es-CO")}` : "—";

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "—";

/* ─── Toast ─────────────────────────────────────────────── */
interface ToastProps { msg: string; type: "ok" | "err" }
function Toast({ msg, type }: ToastProps) {
  return (
    <div className={`planes-toast planes-toast-${type}`}>
      {type === "ok" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
      {msg}
    </div>
  );
}

/* ─── Modal de confirmación de borrado ───────────────────── */
function DeleteModal({
  plan,
  onConfirm,
  onCancel,
  loading,
}: {
  plan: Plan;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="planes-overlay" onClick={onCancel}>
      <div className="planes-modal planes-modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="planes-modal-icon-danger">
          <Trash2 size={22} />
        </div>
        <h3 className="planes-modal-title">Eliminar plan</h3>
        <p className="planes-modal-sub">
          ¿Estás seguro de que deseas eliminar{" "}
          <strong>«{plan.nombre_plan}»</strong>? Esta acción no se puede deshacer.
        </p>
        <div className="planes-modal-actions">
          <button className="btn-ghost" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button className="btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? "Eliminando…" : "Sí, eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Formulario (crear / editar) ────────────────────────── */
function PlanForm({
  initial,
  onSave,
  onClose,
  saving,
}: {
  initial: Omit<Plan, "id_plan"> | Plan;
  onSave: (data: Omit<Plan, "id_plan">) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Omit<Plan, "id_plan">>(
    "id_plan" in initial
      ? { ...initial }
      : { ...initial }
  );

  const set = (key: keyof typeof form, val: unknown) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  const isEdit = "id_plan" in initial;

  return (
    <div className="planes-overlay" onClick={onClose}>
      <div className="planes-modal" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="planes-modal-header">
          <div className="planes-modal-header-left">
            <div className="planes-modal-icon">
              <Package size={18} />
            </div>
            <div>
              <h3 className="planes-modal-title">
                {isEdit ? "Editar plan" : "Nuevo plan"}
              </h3>
              <p className="planes-modal-sub">
                {isEdit ? "Modifica los datos del plan" : "Completa los campos para crear un plan"}
              </p>
            </div>
          </div>
          <button className="planes-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* body */}
        <form onSubmit={handleSubmit} className="planes-form">
          <div className="form-grid-2">
            <div className="form-field form-field-full">
              <label>Nombre del plan *</label>
              <input
                required
                value={form.nombre_plan}
                onChange={(e) => set("nombre_plan", e.target.value)}
                placeholder="Ej. Plan Premium"
              />
            </div>

            <div className="form-field">
              <label>Precio (COP)</label>
              <input
                type="number"
                min={0}
                value={form.precio_plan ?? ""}
                onChange={(e) =>
                  set("precio_plan", e.target.value === "" ? null : Number(e.target.value))
                }
                placeholder="0"
              />
            </div>

            <div className="form-field">
              <label>Fecha del plan</label>
              <input
                type="date"
                value={form.fecha_plan ?? ""}
                onChange={(e) => set("fecha_plan", e.target.value || null)}
              />
            </div>

            <div className="form-field">
              <label>Hora del plan</label>
              <input
                type="time"
                value={form.hora_plan ?? ""}
                onChange={(e) => set("hora_plan", e.target.value || null)}
              />
            </div>

            <div className="form-field form-field-full">
              <label>Descripción básica</label>
              <input
                value={form.descripcion_basica ?? ""}
                onChange={(e) => set("descripcion_basica", e.target.value)}
                placeholder="Descripción corta del plan"
              />
            </div>

            <div className="form-field form-field-full">
              <label>Descripción detallada</label>
              <textarea
                rows={3}
                value={form.descripcion_detallada ?? ""}
                onChange={(e) => set("descripcion_detallada", e.target.value)}
                placeholder="Detalles completos del plan…"
              />
            </div>

            <div className="form-field form-field-full">
              <label>URL de imagen</label>
              <div className="input-with-icon">
                <ImageIcon size={14} className="input-icon" />
                <input
                  value={form.imagen_url ?? ""}
                  onChange={(e) => set("imagen_url", e.target.value)}
                  placeholder="https://…"
                />
              </div>
            </div>
          </div>

          <div className="planes-modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════ */
export default function PlanesAdmin() {
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("nombre_plan");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(false);

  const [toast, setToast] = useState<ToastProps | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /* ── fetch ── */
  const fetchPlanes = async (silent = false) => {
    if (silent) setRefreshing(true);
    try {
      const data = await getPlanes();
      if (mountedRef.current) setPlanes(data as Plan[]);
    } catch (e) {
      console.error(e);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => { fetchPlanes(false); }, []);

  /* ── realtime ── */
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("planes-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "plan" },
        () => fetchPlanes(true))
      .subscribe();
    return () => { supabase!.removeChannel(channel); };
  }, []);

  /* ── toast helper ── */
  const showToast = (msg: string, type: "ok" | "err") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  /* ── CRUD handlers ── */
  const handleSave = async (data: Omit<Plan, "id_plan">) => {
    setSaving(true);
    try {
      if (editing) {
        await updatePlan(editing.id_plan, data);
        showToast("Plan actualizado correctamente", "ok");
      } else {
        await createPlan(data);
        showToast("Plan creado correctamente", "ok");
      }
      setShowForm(false);
      setEditing(null);
      fetchPlanes(true);
    } catch (e: any) {
      showToast(e?.message ?? "Error al guardar", "err");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingId(true);
    try {
      await deletePlan(deleting.id_plan);
      showToast("Plan eliminado", "ok");
      setDeleting(null);
      fetchPlanes(true);
    } catch (e: any) {
      showToast(e?.message ?? "Error al eliminar", "err");
    } finally {
      setDeletingId(false);
    }
  };

  /* ── sort ── */
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronUp size={12} style={{ opacity: .25 }} />;
    return sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  /* ── filtered + sorted list ── */
  const filtered = planes
    .filter((p) =>
      p.nombre_plan.toLowerCase().includes(search.toLowerCase()) ||
      (p.descripcion_basica ?? "").toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let va: string | number = a[sortKey] ?? "";
      let vb: string | number = b[sortKey] ?? "";
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  /* ─────────────────────────────────────────────────────── */
  return (
    <div className="planes-page">

      {/* ── TOAST ── */}
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* ── MODALES ── */}
      {(showForm || editing) && (
        <PlanForm
          initial={editing ?? EMPTY_FORM}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
          saving={saving}
        />
      )}
      {deleting && (
        <DeleteModal
          plan={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
          loading={deletingId}
        />
      )}

      {/* ── HEADER ── */}
      <div className="planes-header">
        <div>
          <h1 className="planes-title">Planes</h1>
          <p className="planes-sub">{planes.length} plan{planes.length !== 1 ? "es" : ""} registrado{planes.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="planes-header-actions">
          <button
            className="btn-icon-sm"
            onClick={() => fetchPlanes(true)}
            disabled={refreshing}
            title="Actualizar"
          >
            <RefreshCw size={15} className={refreshing ? "spin-icon" : ""} />
          </button>
          <button
            className="btn-primary"
            onClick={() => { setEditing(null); setShowForm(true); }}
          >
            <Plus size={16} />
            Nuevo plan
          </button>
        </div>
      </div>

      {/* ── BARRA DE BÚSQUEDA ── */}
      <div className="planes-toolbar">
        <div className="search-wrap">
          <Search size={15} className="search-icon" />
          <input
            className="search-input"
            placeholder="Buscar plan…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch("")}>
              <X size={13} />
            </button>
          )}
        </div>
        <span className="planes-count">
          {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── TABLA ── */}
      {loading ? (
        <div className="planes-loading">
          <div className="spinner" />
          <p>Cargando planes…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="planes-empty">
          <Package size={36} style={{ color: "var(--text-muted)" }} />
          <p>{search ? "Sin resultados para esa búsqueda" : "No hay planes registrados"}</p>
          {!search && (
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              <Plus size={14} /> Crear primer plan
            </button>
          )}
        </div>
      ) : (
        <div className="planes-table-wrap">
          <table className="planes-table">
            <thead>
              <tr>
                <th className="th-sort" onClick={() => toggleSort("nombre_plan")}>
                  Nombre <SortIcon k="nombre_plan" />
                </th>
                <th className="th-sort" onClick={() => toggleSort("precio_plan")}>
                  Precio <SortIcon k="precio_plan" />
                </th>
                <th>Descripción</th>
                <th className="th-sort" onClick={() => toggleSort("fecha_plan")}>
                  <Calendar size={13} style={{ display: "inline", marginRight: 4 }} />
                  Fecha <SortIcon k="fecha_plan" />
                </th>
                <th>
                  <Clock size={13} style={{ display: "inline", marginRight: 4 }} />
                  Hora
                </th>
                <th style={{ textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((plan, i) => {
                const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                return (
                  <tr key={plan.id_plan} className="planes-row">
                    <td>
                      <div className="plan-name-cell">
                        {plan.imagen_url ? (
                          <img
                            src={plan.imagen_url}
                            alt={plan.nombre_plan}
                            className="plan-thumb"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <div
                            className="plan-thumb-placeholder"
                            style={{ background: color + "22", color }}
                          >
                            <Package size={14} />
                          </div>
                        )}
                        <span className="plan-table-name">{plan.nombre_plan}</span>
                      </div>
                    </td>
                    <td>
                      <span className="price-chip">{fmt(plan.precio_plan)}</span>
                    </td>
                    <td className="desc-cell">
                      {plan.descripcion_basica
                        ? plan.descripcion_basica.length > 60
                          ? plan.descripcion_basica.slice(0, 60) + "…"
                          : plan.descripcion_basica
                        : <span style={{ color: "var(--text-muted)" }}>—</span>}
                    </td>
                    <td className="meta-cell">{fmtDate(plan.fecha_plan)}</td>
                    <td className="meta-cell">{plan.hora_plan ?? "—"}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="action-btn action-edit"
                          onClick={() => { setEditing(plan); setShowForm(false); }}
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="action-btn action-delete"
                          onClick={() => setDeleting(plan)}
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}