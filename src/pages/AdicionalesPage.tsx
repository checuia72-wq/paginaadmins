import { useEffect, useMemo, useState } from "react";
import { CirclePlus, Pencil, RefreshCw, Save, Search, Trash2, X } from "lucide-react";
import {
  createAdicional,
  deleteAdicional,
  getAdicionales,
  updateAdicional,
  type Adicional,
  type TipoCobroAdicional,
} from "../services/adicional.service";
import "../styles/adicionales.css";

type FormState = {
  codigo: string;
  nombre: string;
  descripcion: string;
  precio: string;
  tipo_cobro: TipoCobroAdicional;
  activo: boolean;
};

const emptyForm = (): FormState => ({
  codigo: "",
  nombre: "",
  descripcion: "",
  precio: "",
  tipo_cobro: "por_persona",
  activo: true,
});

const money = (value: number) => "$" + Number(value || 0).toLocaleString("es-CO");

export default function AdicionalesPage() {
  const [items, setItems] = useState<Adicional[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editing, setEditing] = useState<Adicional | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await getAdicionales(false));
    } catch (e: any) {
      setError(e?.message || "No fue posible cargar los adicionales.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => [item.nombre, item.codigo, item.descripcion].some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [items, search]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setError(null);
  };

  const openEdit = (item: Adicional) => {
    setEditing(item);
    setForm({
      codigo: item.codigo,
      nombre: item.nombre,
      descripcion: item.descripcion ?? "",
      precio: String(item.precio ?? ""),
      tipo_cobro: item.tipo_cobro,
      activo: item.activo,
    });
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async () => {
    const precio = Number(form.precio.replace(/[^0-9]/g, ""));
    if (!form.nombre.trim()) return setError("Escribe el nombre del adicional.");
    if (!form.codigo.trim()) return setError("Escribe un código para el adicional.");
    if (!Number.isFinite(precio) || precio < 0) return setError("El precio debe ser válido.");

    setSaving(true);
    setError(null);
    try {
      const payload = {
        codigo: form.codigo,
        nombre: form.nombre,
        descripcion: form.descripcion || null,
        precio,
        tipo_cobro: form.tipo_cobro,
        activo: form.activo,
      };
      if (editing) await updateAdicional(editing.id_adicional, payload);
      else await createAdicional(payload);
      openNew();
      await load();
    } catch (e: any) {
      setError(e?.message || "No fue posible guardar el adicional.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: Adicional) => {
    if (!confirm(`¿Eliminar "${item.nombre}"? Si ya fue usado en reservas, desactívalo en lugar de eliminarlo.`)) return;
    try {
      await deleteAdicional(item.id_adicional);
      await load();
    } catch (e: any) {
      setError(e?.message || "No se pudo eliminar. Puedes desactivarlo para conservar el historial.");
    }
  };

  return (
    <div className="ad-page">
      <div className="ad-head">
        <div>
          <span>Configuración administrativa</span>
          <h1>Adicionales</h1>
          <p>Administra servicios que pueden sumarse al plan o venir incluidos, como almuerzo y transporte.</p>
        </div>
        <div className="ad-head-actions">
          <button className="ad-secondary" onClick={load}><RefreshCw size={16}/> Actualizar</button>
          <button className="ad-primary" onClick={openNew}><CirclePlus size={17}/> Nuevo adicional</button>
        </div>
      </div>

      <div className="ad-kpis">
        <div><strong>{items.length}</strong><span>Registrados</span></div>
        <div><strong>{items.filter((x) => x.activo).length}</strong><span>Activos</span></div>
        <div><strong>{items.filter((x) => x.tipo_cobro === "por_persona").length}</strong><span>Por persona</span></div>
      </div>

      {error && <div className="ad-error">{error}</div>}

      <section className="ad-editor">
        <div className="ad-editor-title">
          <div>
            <span>{editing ? "Editando adicional" : "Nueva configuración"}</span>
            <strong>{editing ? editing.nombre : "Crear adicional"}</strong>
          </div>
          {editing && <button className="ad-icon" onClick={openNew}><X size={17}/></button>}
        </div>

        <div className="ad-form-grid">
          <label><span>Nombre *</span><input value={form.nombre} onChange={(e) => setForm({...form, nombre:e.target.value})} placeholder="Ej. Almuerzo"/></label>
          <label><span>Código *</span><input value={form.codigo} onChange={(e) => setForm({...form, codigo:e.target.value})} placeholder="almuerzo"/></label>
          <label><span>Precio *</span><div className="ad-money"><b>$</b><input inputMode="numeric" value={form.precio} onChange={(e) => setForm({...form, precio:e.target.value.replace(/\D/g, "")})} placeholder="30000"/></div></label>
          <label><span>Tipo de cobro</span><select value={form.tipo_cobro} onChange={(e) => setForm({...form, tipo_cobro:e.target.value as TipoCobroAdicional})}><option value="por_persona">Por persona</option><option value="por_reserva">Por reserva</option></select></label>
          <label className="wide"><span>Descripción</span><textarea rows={3} value={form.descripcion} onChange={(e) => setForm({...form, descripcion:e.target.value})}/></label>
          <label className="ad-switch"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({...form, activo:e.target.checked})}/><span>{form.activo ? "Activo" : "Inactivo"}</span></label>
        </div>

        <div className="ad-editor-footer">
          {editing && <button className="ad-secondary" onClick={openNew}>Cancelar</button>}
          <button className="ad-primary" onClick={save} disabled={saving}>{editing ? <Save size={16}/> : <CirclePlus size={16}/>} {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear adicional"}</button>
        </div>
      </section>

      <section className="ad-list">
        <div className="ad-list-head">
          <div><strong>Adicionales registrados</strong><small>El precio general puede sobrescribirse para un plan específico.</small></div>
          <div className="ad-search"><Search size={16}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar adicional…"/></div>
        </div>
        <div className="ad-table-wrap">
          <table>
            <thead><tr><th>Adicional</th><th>Código</th><th>Precio</th><th>Cobro</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="ad-empty">Cargando…</td></tr> :
                filtered.length === 0 ? <tr><td colSpan={6} className="ad-empty">No hay adicionales.</td></tr> :
                filtered.map((item) => <tr key={item.id_adicional}>
                  <td><div className="ad-name"><strong>{item.nombre}</strong><small>{item.descripcion || "Sin descripción"}</small></div></td>
                  <td><code>{item.codigo}</code></td>
                  <td><strong>{money(item.precio)}</strong></td>
                  <td>{item.tipo_cobro === "por_persona" ? "Por persona" : "Por reserva"}</td>
                  <td><span className={item.activo ? "ad-on" : "ad-off"}>{item.activo ? "Activo" : "Inactivo"}</span></td>
                  <td><div className="ad-actions"><button onClick={() => openEdit(item)}><Pencil size={15}/> Editar</button><button className="danger" onClick={() => remove(item)}><Trash2 size={15}/></button></div></td>
                </tr>)
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
