import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Link2, Pencil, Plus, RefreshCw, Save, Search, Trash2, Utensils, X } from "lucide-react";
import { getPlanes } from "../services/api.service";
import { getRestaurantesActivos } from "../services/restaurante.service";
import {
  createCodigoOperativo,
  deleteCodigoOperativo,
  getCodigosOperativos,
  updateCodigoOperativo,
  type CodigoOperativo,
} from "../services/codigoOperativo.service";
import "../styles/codigos-operativos.css";

type Plan = { id_plan: number; nombre_plan: string };
type FormState = {
  codigo_ch: string;
  descripcion: string;
  id_plan: number | "";
  incluye_almuerzo: boolean;
  restaurante: string;
  prioridad: number;
  activo: boolean;
};

const emptyForm = (): FormState => ({
  codigo_ch: "CH",
  descripcion: "",
  id_plan: "",
  incluye_almuerzo: false,
  restaurante: "",
  prioridad: 10,
  activo: true,
});

export default function CodigosOperativosPage() {
  const [codigos, setCodigos] = useState<CodigoOperativo[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [restaurantes, setRestaurantes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CodigoOperativo | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, p, r] = await Promise.all([getCodigosOperativos(), getPlanes(), getRestaurantesActivos()]);
      setCodigos(c);
      setPlanes(p as Plan[]);
      setRestaurantes(r);
    } catch (e: any) {
      setError(e?.message || "No fue posible cargar los códigos operativos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return codigos;
    return codigos.filter((c) =>
      [c.codigo_ch, c.descripcion, c.plan?.nombre_plan, c.restaurante]
        .some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [codigos, search]);

  const vinculados = codigos.filter((c) => c.id_plan != null).length;
  const pendientes = codigos.length - vinculados;

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openEdit = (c: CodigoOperativo) => {
    setEditing(c);
    setForm({
      codigo_ch: c.codigo_ch,
      descripcion: c.descripcion,
      id_plan: c.id_plan ?? "",
      incluye_almuerzo: !!c.incluye_almuerzo,
      restaurante: c.restaurante ?? "",
      prioridad: c.prioridad,
      activo: c.activo,
    });
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async () => {
    const code = form.codigo_ch.trim().toUpperCase();
    if (!/^CH\d{3}$/.test(code)) {
      setError("El código debe tener formato CH000, por ejemplo CH034.");
      return;
    }
    if (!form.descripcion.trim()) {
      setError("Escribe una descripción para identificar este código.");
      return;
    }
    if (form.incluye_almuerzo && !form.restaurante && !confirm("Este CH incluye almuerzo pero no tiene restaurante específico. Se usará como variante general para ese plan. ¿Continuar?")) return;

    setSaving(true);
    setError(null);
    try {
      const payload = {
        codigo_ch: code,
        descripcion: form.descripcion,
        id_plan: form.id_plan === "" ? null : Number(form.id_plan),
        incluye_almuerzo: form.incluye_almuerzo,
        restaurante: form.incluye_almuerzo ? form.restaurante || null : null,
        prioridad: form.prioridad,
        activo: form.activo,
      };
      if (editing) await updateCodigoOperativo(editing.id_codigo_operativo, payload);
      else await createCodigoOperativo(payload);
      setEditing(null);
      setForm(emptyForm());
      await load();
    } catch (e: any) {
      setError(e?.message || "No fue posible guardar el código.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: CodigoOperativo) => {
    if (!confirm(`¿Eliminar ${c.codigo_ch}? Si ya está vinculado a reservas es mejor desactivarlo en lugar de borrarlo.`)) return;
    try {
      await deleteCodigoOperativo(c.id_codigo_operativo);
      await load();
    } catch (e: any) {
      setError(e?.message || "No fue posible eliminar el código. Puedes desactivarlo.");
    }
  };

  return (
    <div className="co-page">
      <div className="co-head">
        <div>
          <span>Configuración administrativa</span>
          <h1>Códigos operativos</h1>
          <p>Asigna cada CH al plan correcto y define las variantes de almuerzo y restaurante.</p>
        </div>
        <div className="co-head-actions">
          <button className="co-secondary" onClick={load}><RefreshCw size={16}/> Actualizar</button>
          <button className="co-primary" onClick={openNew}><Plus size={16}/> Nuevo código</button>
        </div>
      </div>

      <div className="co-kpis">
        <div className="co-kpi"><strong>{codigos.length}</strong><span>Códigos registrados</span></div>
        <div className="co-kpi success"><strong>{vinculados}</strong><span>Vinculados a un plan</span></div>
        <div className="co-kpi warning"><strong>{pendientes}</strong><span>Pendientes por vincular</span></div>
      </div>

      {error && <div className="co-error">{error}</div>}

      <section className={`co-editor ${editing ? "is-editing" : ""}`}>
        <div className="co-editor-title">
          <div>
            <span className="co-step-label">{editing ? "Editando configuración" : "Nueva configuración"}</span>
            <strong>{editing ? `${editing.codigo_ch} · ${editing.descripcion}` : "Crear código operativo"}</strong>
            <small>Completa los campos de izquierda a derecha. El consecutivo final se genera automáticamente al aprobar una reserva.</small>
          </div>
          {editing && <button className="co-icon" onClick={openNew} title="Cancelar edición"><X size={17}/></button>}
        </div>

        <div className="co-form-grid">
          <div className="co-form-card">
            <div className="co-form-card-title"><span>1</span><div><strong>Identificación</strong><small>Qué código es y cómo lo reconocerás.</small></div></div>
            <div className="co-field-row two">
              <label><span>Código CH</span><input value={form.codigo_ch} maxLength={5} onChange={(e) => setForm({...form, codigo_ch:e.target.value.toUpperCase()})} placeholder="CH034"/></label>
              <label><span>Descripción</span><input value={form.descripcion} onChange={(e) => setForm({...form, descripcion:e.target.value})} placeholder="Ej. Senderismo en el desierto de Checua"/></label>
            </div>
          </div>

          <div className="co-form-card">
            <div className="co-form-card-title"><span>2</span><div><strong>Vinculación</strong><small>Define qué plan utiliza este CH.</small></div></div>
            <label><span>Plan vinculado</span><select value={form.id_plan} onChange={(e) => setForm({...form,id_plan:e.target.value ? Number(e.target.value) : ""})}><option value="">Selecciona un plan</option>{planes.map((p) => <option key={p.id_plan} value={p.id_plan}>{p.nombre_plan}</option>)}</select></label>
            {form.id_plan === "" && <div className="co-inline-help warning"><Link2 size={14}/> Este código todavía quedará sin vincular.</div>}
          </div>

          <div className="co-form-card">
            <div className="co-form-card-title"><span>3</span><div><strong>Almuerzo y restaurante</strong><small>Solo aplica cuando el CH cambia por restaurante.</small></div></div>
            <div className="co-toggle-row">
              <label className="co-switch-line"><input type="checkbox" checked={form.incluye_almuerzo} onChange={(e) => setForm({...form,incluye_almuerzo:e.target.checked,restaurante:e.target.checked?form.restaurante:""})}/><span>Este CH incluye almuerzo</span></label>
            </div>
            {form.incluye_almuerzo ? (
              <label><span>Restaurante</span><select value={form.restaurante} onChange={(e) => setForm({...form,restaurante:e.target.value})}><option value="">General / cualquier restaurante</option>{restaurantes.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
            ) : (
              <div className="co-inline-help"><Utensils size={14}/> Este CH se usará como variante sin almuerzo.</div>
            )}
          </div>

          <div className="co-form-card compact">
            <div className="co-form-card-title"><span>4</span><div><strong>Estado</strong><small>Control de uso del código.</small></div></div>
            <div className="co-field-row two compact-row">
              <label><span>Prioridad</span><input inputMode="numeric" value={form.prioridad} onChange={(e) => setForm({...form,prioridad:Number(e.target.value.replace(/\D/g,""))||0})}/></label>
              <label className="co-switch-line boxed"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({...form,activo:e.target.checked})}/><span>{form.activo ? "Activo" : "Inactivo"}</span></label>
            </div>
          </div>
        </div>

        <div className="co-editor-footer">
          {editing && <button className="co-secondary" onClick={openNew}>Cancelar</button>}
          <button className="co-save" onClick={save} disabled={saving}>{editing?<Save size={17}/>:<Plus size={17}/>} {saving?"Guardando…":editing?"Guardar configuración":"Crear código"}</button>
        </div>
      </section>

      <section className="co-list">
        <div className="co-list-head">
          <div><strong>Códigos registrados</strong><small>Los pendientes de vincular aparecen resaltados para que puedas identificarlos rápido.</small></div>
          <div className="co-search"><Search size={16}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar CH, plan o restaurante…"/></div>
        </div>

        <div className="co-table-wrap">
          <table>
            <thead><tr><th>CH</th><th>Descripción</th><th>Plan vinculado</th><th>Configuración</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="co-empty">Cargando…</td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className="co-empty">No hay resultados.</td></tr> : filtered.map((c) => (
                <tr key={c.id_codigo_operativo} className={!c.id_plan ? "needs-link" : ""}>
                  <td><span className="co-code-badge">{c.codigo_ch}</span></td>
                  <td><div className="co-desc-cell"><strong>{c.descripcion}</strong><small>{c.incluye_almuerzo ? "Variante con almuerzo" : "Variante base / sin almuerzo"}</small></div></td>
                  <td>{c.plan?.nombre_plan ? <div className="co-plan-ok"><CheckCircle2 size={15}/><span>{c.plan.nombre_plan}</span></div> : <button className="co-link-now" onClick={() => openEdit(c)}><Link2 size={14}/> Vincular ahora</button>}</td>
                  <td><div className="co-config-tags"><span className={c.incluye_almuerzo ? "with-lunch" : "without-lunch"}>{c.incluye_almuerzo ? "Con almuerzo" : "Sin almuerzo"}</span>{c.restaurante && <span>{c.restaurante}</span>}</div></td>
                  <td><span className={c.activo?"co-on":"co-off"}>{c.activo?"Activo":"Inactivo"}</span></td>
                  <td><div className="co-actions"><button className="edit" onClick={()=>openEdit(c)} title="Editar configuración"><Pencil size={15}/><span>Editar</span></button><button className="delete" onClick={()=>remove(c)} title="Eliminar"><Trash2 size={15}/></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
