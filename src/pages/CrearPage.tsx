import { useEffect, useState } from "react";
import { CreditCard, Pencil, Plus, RefreshCw, Store, Trash2, X } from "lucide-react";
import {
  createMetodoPago,
  deleteMetodoPago,
  getMetodosPago,
  renameMetodoPago,
} from "../services/medioPago.service";
import {
  createRestaurante,
  deleteRestaurante,
  getRestaurantes,
  renameRestaurante,
} from "../services/restaurante.service";
import "../styles/crear.css";

function friendlyError(message: string, recurso: "métodos de pago" | "restaurantes") {
  const text = message.toLowerCase();
  if (text.includes("no tienes permisos")) return `No tienes permisos para administrar ${recurso}.`;
  if (text.includes("ya existe")) return message;
  return message;
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function CrearPage() {
  const [items, setItems] = useState<string[]>([]);
  const [restaurantes, setRestaurantes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nuevo, setNuevo] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const [nuevoRestaurante, setNuevoRestaurante] = useState("");
  const [editingRestaurante, setEditingRestaurante] = useState<string | null>(null);
  const [editRestauranteValue, setEditRestauranteValue] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pagos, restaurantesData] = await Promise.all([
        getMetodosPago(),
        getRestaurantes(),
      ]);
      setItems(pagos);
      setRestaurantes(restaurantesData);
    } catch (e: any) {
      setError(e?.message || "No fue posible cargar la configuración administrativa.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    const value = nuevo.trim().toLowerCase();
    if (!value) return;
    setSaving(true);
    setError(null);
    try {
      await createMetodoPago(value);
      setNuevo("");
      await load();
    } catch (e: any) {
      setError(friendlyError(e?.message || "No fue posible crear el método de pago.", "métodos de pago"));
    } finally {
      setSaving(false);
    }
  };

  const saveRename = async () => {
    if (!editing || !editValue.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await renameMetodoPago(editing, editValue);
      setEditing(null);
      setEditValue("");
      await load();
    } catch (e: any) {
      setError(friendlyError(e?.message || "No fue posible renombrar el método de pago.", "métodos de pago"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (value: string) => {
    if (!confirm(`¿Quitar “${value}” de los métodos disponibles?`)) return;
    setSaving(true);
    setError(null);
    try {
      await deleteMetodoPago(value);
      await load();
    } catch (e: any) {
      setError(friendlyError(e?.message || "No fue posible quitar el método de pago.", "métodos de pago"));
    } finally {
      setSaving(false);
    }
  };

  const addRestaurante = async () => {
    const value = titleCase(nuevoRestaurante.trim());
    if (!value) return;
    setSaving(true);
    setError(null);
    try {
      await createRestaurante(value);
      setNuevoRestaurante("");
      await load();
    } catch (e: any) {
      setError(friendlyError(e?.message || "No fue posible crear el restaurante.", "restaurantes"));
    } finally {
      setSaving(false);
    }
  };

  const saveRenameRestaurante = async () => {
    if (!editingRestaurante || !editRestauranteValue.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await renameRestaurante(editingRestaurante, titleCase(editRestauranteValue.trim()));
      setEditingRestaurante(null);
      setEditRestauranteValue("");
      await load();
    } catch (e: any) {
      setError(friendlyError(e?.message || "No fue posible renombrar el restaurante.", "restaurantes"));
    } finally {
      setSaving(false);
    }
  };

  const removeRestaurante = async (value: string) => {
    if (!confirm(`¿Quitar “${value}” de los restaurantes disponibles?`)) return;
    setSaving(true);
    setError(null);
    try {
      await deleteRestaurante(value);
      await load();
    } catch (e: any) {
      setError(friendlyError(e?.message || "No fue posible quitar el restaurante.", "restaurantes"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="crear-page">
      <div className="crear-head">
        <div>
          <span className="crear-eyebrow">Configuración administrativa</span>
          <h1>Crear</h1>
          <p>Administra catálogos operativos disponibles para reservas y atención.</p>
        </div>
        <button className="crear-btn secondary" onClick={load} disabled={loading || saving}>
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>

      {error && <div className="crear-error">{error}</div>}

      <div className="crear-grid">
        <section className="crear-card crear-create-card">
          <div className="crear-card-title">
            <div className="crear-icon"><Plus size={20} /></div>
            <div><h2>Nuevo método de pago</h2><p>El nuevo valor quedará disponible para futuras operaciones.</p></div>
          </div>
          <div className="crear-form-row">
            <input value={nuevo} onChange={e => setNuevo(e.target.value)} placeholder="Ej. tarjeta" onKeyDown={e => { if (e.key === "Enter") add(); }} />
            <button className="crear-btn primary" onClick={add} disabled={saving || !nuevo.trim()}><Plus size={16} /> Agregar</button>
          </div>
          <small>Se guarda en minúsculas para mantener una nomenclatura consistente.</small>
        </section>

        <section className="crear-card crear-summary-card">
          <div className="crear-summary-icon"><CreditCard size={23} /></div>
          <div><span>Métodos disponibles</span><strong>{items.length}</strong></div>
        </section>
      </div>

      <section className="crear-card crear-list-card">
        <div className="crear-list-head">
          <div><h2>Métodos de pago</h2><p>Valores disponibles actualmente para el sistema.</p></div>
        </div>
        {loading ? <div className="crear-empty">Cargando métodos de pago…</div> : items.length === 0 ? <div className="crear-empty">No hay métodos de pago disponibles.</div> : (
          <div className="crear-table-wrap">
            <table className="crear-table">
              <thead><tr><th>#</th><th>Valor</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>{items.map((item, index) => (
                <tr key={item}><td>{index + 1}</td><td>{editing === item ? <input className="crear-edit-input" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus /> : <span className="crear-value">{item}</span>}</td><td><span className="crear-status">Disponible</span></td><td><div className="crear-actions">{editing === item ? <><button className="crear-action save" onClick={saveRename} disabled={saving || !editValue.trim()}>Guardar</button><button className="crear-action" onClick={() => { setEditing(null); setEditValue(""); }}><X size={15} /></button></> : <><button className="crear-action" title="Renombrar" onClick={() => { setEditing(item); setEditValue(item); }}><Pencil size={15} /></button><button className="crear-action danger" title="Quitar de disponibles" onClick={() => remove(item)} disabled={saving}><Trash2 size={15} /></button></>}</div></td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <div className="crear-grid" style={{ marginTop: 18 }}>
        <section className="crear-card crear-create-card">
          <div className="crear-card-title">
            <div className="crear-icon"><Plus size={20} /></div>
            <div><h2>Nuevo restaurante</h2><p>Quedará disponible para selección en Control Operativo.</p></div>
          </div>
          <div className="crear-form-row">
            <input value={nuevoRestaurante} onChange={e => setNuevoRestaurante(e.target.value)} placeholder="Ej. Garden" onKeyDown={e => { if (e.key === "Enter") addRestaurante(); }} />
            <button className="crear-btn primary" onClick={addRestaurante} disabled={saving || !nuevoRestaurante.trim()}><Plus size={16} /> Agregar</button>
          </div>
          <small>Los restaurantes se administran como catálogo para evitar escritura libre.</small>
        </section>

        <section className="crear-card crear-summary-card">
          <div className="crear-summary-icon"><Store size={23} /></div>
          <div><span>Restaurantes disponibles</span><strong>{restaurantes.length}</strong></div>
        </section>
      </div>

      <section className="crear-card crear-list-card" style={{ marginTop: 18 }}>
        <div className="crear-list-head">
          <div><h2>Restaurantes</h2><p>Catálogo disponible para asignar a las reservas.</p></div>
        </div>
        {loading ? <div className="crear-empty">Cargando restaurantes…</div> : restaurantes.length === 0 ? <div className="crear-empty">No hay restaurantes disponibles.</div> : (
          <div className="crear-table-wrap">
            <table className="crear-table">
              <thead><tr><th>#</th><th>Restaurante</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>{restaurantes.map((item, index) => (
                <tr key={item}><td>{index + 1}</td><td>{editingRestaurante === item ? <input className="crear-edit-input" value={editRestauranteValue} onChange={e => setEditRestauranteValue(e.target.value)} autoFocus /> : <span className="crear-value">{item}</span>}</td><td><span className="crear-status">Disponible</span></td><td><div className="crear-actions">{editingRestaurante === item ? <><button className="crear-action save" onClick={saveRenameRestaurante} disabled={saving || !editRestauranteValue.trim()}>Guardar</button><button className="crear-action" onClick={() => { setEditingRestaurante(null); setEditRestauranteValue(""); }}><X size={15} /></button></> : <><button className="crear-action" title="Renombrar" onClick={() => { setEditingRestaurante(item); setEditRestauranteValue(item); }}><Pencil size={15} /></button><button className="crear-action danger" title="Quitar de disponibles" onClick={() => removeRestaurante(item)} disabled={saving}><Trash2 size={15} /></button></>}</div></td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
