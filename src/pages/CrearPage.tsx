import { useEffect, useMemo, useState } from "react";
import { CreditCard, Pencil, Plus, RefreshCw, Store, Trash2, UtensilsCrossed, X } from "lucide-react";
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
import {
  createMenuRestaurante,
  deleteMenuRestaurante,
  getMenusRestaurante,
  toggleMenuRestaurante,
  updateMenuRestaurante,
  type RestauranteMenuItem,
} from "../services/restauranteMenu.service";
import "../styles/crear.css";

function friendlyError(message: string, recurso: "métodos de pago" | "restaurantes" | "tipos de almuerzo") {
  const text = message.toLowerCase();
  if (text.includes("no tienes permisos") || text.includes("row-level security")) return `No tienes permisos para administrar ${recurso}.`;
  if (text.includes("duplicate") || text.includes("already exists") || text.includes("ya existe")) return `Ese valor ya existe en ${recurso}.`;
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
  const [menus, setMenus] = useState<RestauranteMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nuevo, setNuevo] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const [nuevoRestaurante, setNuevoRestaurante] = useState("");
  const [editingRestaurante, setEditingRestaurante] = useState<string | null>(null);
  const [editRestauranteValue, setEditRestauranteValue] = useState("");

  const [menuRestaurante, setMenuRestaurante] = useState("");
  const [nuevoPlato, setNuevoPlato] = useState("");
  const [nuevaDescripcion, setNuevaDescripcion] = useState("");
  const [nuevoOrden, setNuevoOrden] = useState(0);
  const [editingMenu, setEditingMenu] = useState<number | null>(null);
  const [editMenuRestaurante, setEditMenuRestaurante] = useState("");
  const [editMenuNombre, setEditMenuNombre] = useState("");
  const [editMenuDescripcion, setEditMenuDescripcion] = useState("");
  const [editMenuOrden, setEditMenuOrden] = useState(0);
  const [menuFiltro, setMenuFiltro] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pagos, restaurantesData, menusData] = await Promise.all([
        getMetodosPago(),
        getRestaurantes(),
        getMenusRestaurante().catch(() => []),
      ]);
      setItems(pagos);
      setRestaurantes(restaurantesData);
      setMenus(menusData);
      if (!menuRestaurante && restaurantesData.length) setMenuRestaurante(restaurantesData[0]);
    } catch (e: any) {
      setError(e?.message || "No fue posible cargar la configuración administrativa.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const menusVisibles = useMemo(
    () => menus.filter(menu => !menuFiltro || menu.restaurante === menuFiltro),
    [menus, menuFiltro],
  );

  const add = async () => {
    const value = nuevo.trim().toLowerCase();
    if (!value) return;
    setSaving(true); setError(null);
    try { await createMetodoPago(value); setNuevo(""); await load(); }
    catch (e: any) { setError(friendlyError(e?.message || "No fue posible crear el método de pago.", "métodos de pago")); }
    finally { setSaving(false); }
  };

  const saveRename = async () => {
    if (!editing || !editValue.trim()) return;
    setSaving(true); setError(null);
    try { await renameMetodoPago(editing, editValue); setEditing(null); setEditValue(""); await load(); }
    catch (e: any) { setError(friendlyError(e?.message || "No fue posible renombrar el método de pago.", "métodos de pago")); }
    finally { setSaving(false); }
  };

  const remove = async (value: string) => {
    if (!confirm(`¿Quitar “${value}” de los métodos disponibles?`)) return;
    setSaving(true); setError(null);
    try { await deleteMetodoPago(value); await load(); }
    catch (e: any) { setError(friendlyError(e?.message || "No fue posible quitar el método de pago.", "métodos de pago")); }
    finally { setSaving(false); }
  };

  const addRestaurante = async () => {
    const value = titleCase(nuevoRestaurante.trim());
    if (!value) return;
    setSaving(true); setError(null);
    try { await createRestaurante(value); setNuevoRestaurante(""); await load(); }
    catch (e: any) { setError(friendlyError(e?.message || "No fue posible crear el restaurante.", "restaurantes")); }
    finally { setSaving(false); }
  };

  const saveRenameRestaurante = async () => {
    if (!editingRestaurante || !editRestauranteValue.trim()) return;
    setSaving(true); setError(null);
    try { await renameRestaurante(editingRestaurante, titleCase(editRestauranteValue.trim())); setEditingRestaurante(null); setEditRestauranteValue(""); await load(); }
    catch (e: any) { setError(friendlyError(e?.message || "No fue posible renombrar el restaurante.", "restaurantes")); }
    finally { setSaving(false); }
  };

  const removeRestaurante = async (value: string) => {
    if (!confirm(`¿Quitar “${value}” de los restaurantes disponibles?`)) return;
    setSaving(true); setError(null);
    try { await deleteRestaurante(value); await load(); }
    catch (e: any) { setError(friendlyError(e?.message || "No fue posible quitar el restaurante.", "restaurantes")); }
    finally { setSaving(false); }
  };

  const addMenu = async () => {
    if (!menuRestaurante || !nuevoPlato.trim()) return;
    setSaving(true); setError(null);
    try {
      await createMenuRestaurante({
        restaurante: menuRestaurante,
        nombre_plato: titleCase(nuevoPlato.trim()),
        descripcion: nuevaDescripcion.trim() || null,
        orden: nuevoOrden,
        activo: true,
      });
      setNuevoPlato(""); setNuevaDescripcion(""); setNuevoOrden(0);
      await load();
    } catch (e: any) {
      setError(friendlyError(e?.message || "No fue posible crear el tipo de almuerzo.", "tipos de almuerzo"));
    } finally { setSaving(false); }
  };

  const startEditMenu = (menu: RestauranteMenuItem) => {
    setEditingMenu(menu.id_menu);
    setEditMenuRestaurante(menu.restaurante);
    setEditMenuNombre(menu.nombre_plato);
    setEditMenuDescripcion(menu.descripcion || "");
    setEditMenuOrden(menu.orden || 0);
  };

  const cancelEditMenu = () => {
    setEditingMenu(null);
    setEditMenuRestaurante(""); setEditMenuNombre(""); setEditMenuDescripcion(""); setEditMenuOrden(0);
  };

  const saveMenu = async () => {
    const actual = menus.find(menu => menu.id_menu === editingMenu);
    if (!actual || !editMenuRestaurante || !editMenuNombre.trim()) return;
    setSaving(true); setError(null);
    try {
      await updateMenuRestaurante(actual.id_menu, {
        restaurante: editMenuRestaurante,
        nombre_plato: titleCase(editMenuNombre.trim()),
        descripcion: editMenuDescripcion.trim() || null,
        orden: editMenuOrden,
        activo: actual.activo,
      });
      cancelEditMenu();
      await load();
    } catch (e: any) {
      setError(friendlyError(e?.message || "No fue posible actualizar el tipo de almuerzo.", "tipos de almuerzo"));
    } finally { setSaving(false); }
  };

  const toggleMenu = async (menu: RestauranteMenuItem) => {
    setSaving(true); setError(null);
    try { await toggleMenuRestaurante(menu.id_menu, !menu.activo); await load(); }
    catch (e: any) { setError(friendlyError(e?.message || "No fue posible cambiar el estado del tipo de almuerzo.", "tipos de almuerzo")); }
    finally { setSaving(false); }
  };

  const removeMenu = async (menu: RestauranteMenuItem) => {
    if (!confirm(`¿Eliminar “${menu.nombre_plato}” del menú de ${menu.restaurante}?`)) return;
    setSaving(true); setError(null);
    try { await deleteMenuRestaurante(menu.id_menu); await load(); }
    catch (e: any) { setError(friendlyError(e?.message || "No fue posible eliminar el tipo de almuerzo.", "tipos de almuerzo")); }
    finally { setSaving(false); }
  };

  return (
    <div className="crear-page">
      <div className="crear-head">
        <div><span className="crear-eyebrow">Configuración administrativa</span><h1>Crear</h1><p>Administra catálogos operativos disponibles para reservas y atención.</p></div>
        <button className="crear-btn secondary" onClick={load} disabled={loading || saving}><RefreshCw size={16} /> Actualizar</button>
      </div>

      {error && <div className="crear-error">{error}</div>}

      <div className="crear-grid">
        <section className="crear-card crear-create-card">
          <div className="crear-card-title"><div className="crear-icon"><Plus size={20} /></div><div><h2>Nuevo método de pago</h2><p>El nuevo valor quedará disponible para futuras operaciones.</p></div></div>
          <div className="crear-form-row"><input value={nuevo} onChange={e => setNuevo(e.target.value)} placeholder="Ej. tarjeta" onKeyDown={e => { if (e.key === "Enter") add(); }} /><button className="crear-btn primary" onClick={add} disabled={saving || !nuevo.trim()}><Plus size={16} /> Agregar</button></div>
          <small>Se guarda en minúsculas para mantener una nomenclatura consistente.</small>
        </section>
        <section className="crear-card crear-summary-card"><div className="crear-summary-icon"><CreditCard size={23} /></div><div><span>Métodos disponibles</span><strong>{items.length}</strong></div></section>
      </div>

      <section className="crear-card crear-list-card">
        <div className="crear-list-head"><div><h2>Métodos de pago</h2><p>Valores disponibles actualmente para el sistema.</p></div></div>
        {loading ? <div className="crear-empty">Cargando métodos de pago…</div> : items.length === 0 ? <div className="crear-empty">No hay métodos de pago disponibles.</div> : <div className="crear-table-wrap"><table className="crear-table"><thead><tr><th>#</th><th>Valor</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{items.map((item, index) => <tr key={item}><td>{index + 1}</td><td>{editing === item ? <input className="crear-edit-input" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus /> : <span className="crear-value">{item}</span>}</td><td><span className="crear-status">Disponible</span></td><td><div className="crear-actions">{editing === item ? <><button className="crear-action save" onClick={saveRename} disabled={saving || !editValue.trim()}>Guardar</button><button className="crear-action" onClick={() => { setEditing(null); setEditValue(""); }}><X size={15} /></button></> : <><button className="crear-action" title="Renombrar" onClick={() => { setEditing(item); setEditValue(item); }}><Pencil size={15} /></button><button className="crear-action danger" title="Quitar de disponibles" onClick={() => remove(item)} disabled={saving}><Trash2 size={15} /></button></>}</div></td></tr>)}</tbody></table></div>}
      </section>

      <div className="crear-grid" style={{ marginTop: 18 }}>
        <section className="crear-card crear-create-card">
          <div className="crear-card-title"><div className="crear-icon"><Plus size={20} /></div><div><h2>Nuevo restaurante</h2><p>Quedará disponible para selección en Control Operativo.</p></div></div>
          <div className="crear-form-row"><input value={nuevoRestaurante} onChange={e => setNuevoRestaurante(e.target.value)} placeholder="Ej. Garden" onKeyDown={e => { if (e.key === "Enter") addRestaurante(); }} /><button className="crear-btn primary" onClick={addRestaurante} disabled={saving || !nuevoRestaurante.trim()}><Plus size={16} /> Agregar</button></div>
          <small>Los restaurantes se administran como catálogo para evitar escritura libre.</small>
        </section>
        <section className="crear-card crear-summary-card"><div className="crear-summary-icon"><Store size={23} /></div><div><span>Restaurantes disponibles</span><strong>{restaurantes.length}</strong></div></section>
      </div>

      <section className="crear-card crear-list-card" style={{ marginTop: 18 }}>
        <div className="crear-list-head"><div><h2>Restaurantes</h2><p>Catálogo disponible para asignar a las reservas.</p></div></div>
        {loading ? <div className="crear-empty">Cargando restaurantes…</div> : restaurantes.length === 0 ? <div className="crear-empty">No hay restaurantes disponibles.</div> : <div className="crear-table-wrap"><table className="crear-table"><thead><tr><th>#</th><th>Restaurante</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{restaurantes.map((item, index) => <tr key={item}><td>{index + 1}</td><td>{editingRestaurante === item ? <input className="crear-edit-input" value={editRestauranteValue} onChange={e => setEditRestauranteValue(e.target.value)} autoFocus /> : <span className="crear-value">{item}</span>}</td><td><span className="crear-status">Disponible</span></td><td><div className="crear-actions">{editingRestaurante === item ? <><button className="crear-action save" onClick={saveRenameRestaurante} disabled={saving || !editRestauranteValue.trim()}>Guardar</button><button className="crear-action" onClick={() => { setEditingRestaurante(null); setEditRestauranteValue(""); }}><X size={15} /></button></> : <><button className="crear-action" title="Renombrar" onClick={() => { setEditingRestaurante(item); setEditRestauranteValue(item); }}><Pencil size={15} /></button><button className="crear-action danger" title="Quitar de disponibles" onClick={() => removeRestaurante(item)} disabled={saving}><Trash2 size={15} /></button></>}</div></td></tr>)}</tbody></table></div>}
      </section>

      <div className="crear-grid" style={{ marginTop: 18 }}>
        <section className="crear-card crear-create-card crear-menu-create">
          <div className="crear-card-title"><div className="crear-icon"><UtensilsCrossed size={20} /></div><div><h2>Nuevo tipo de almuerzo</h2><p>Cada plato queda vinculado exclusivamente al restaurante seleccionado.</p></div></div>
          <div className="crear-menu-form">
            <label>Restaurante<select value={menuRestaurante} onChange={e => setMenuRestaurante(e.target.value)}><option value="">Seleccionar restaurante</option>{restaurantes.map(r => <option key={r} value={r}>{r}</option>)}</select></label>
            <label>Nombre del plato<input value={nuevoPlato} onChange={e => setNuevoPlato(e.target.value)} placeholder="Ej. Pechuga a la plancha" /></label>
            <label>Orden<input type="number" min={0} value={nuevoOrden} onChange={e => setNuevoOrden(Number(e.target.value))} /></label>
            <label className="crear-menu-description">Descripción opcional<input value={nuevaDescripcion} onChange={e => setNuevaDescripcion(e.target.value)} placeholder="Detalle breve del plato" /></label>
            <button className="crear-btn primary" onClick={addMenu} disabled={saving || !menuRestaurante || !nuevoPlato.trim()}><Plus size={16} /> Agregar plato</button>
          </div>
        </section>
        <section className="crear-card crear-summary-card"><div className="crear-summary-icon"><UtensilsCrossed size={23} /></div><div><span>Tipos de almuerzo</span><strong>{menus.filter(m => m.activo).length}</strong></div></section>
      </div>

      <section className="crear-card crear-list-card" style={{ marginTop: 18 }}>
        <div className="crear-list-head crear-menu-head"><div><h2>Tipos de almuerzo por restaurante</h2><p>Activa, desactiva, edita o elimina los platos disponibles para cada restaurante.</p></div><select className="crear-menu-filter" value={menuFiltro} onChange={e => setMenuFiltro(e.target.value)}><option value="">Todos los restaurantes</option>{restaurantes.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
        {loading ? <div className="crear-empty">Cargando tipos de almuerzo…</div> : menusVisibles.length === 0 ? <div className="crear-empty">No hay tipos de almuerzo configurados para este restaurante.</div> : (
          <div className="crear-table-wrap"><table className="crear-table crear-menu-table"><thead><tr><th>#</th><th>Restaurante</th><th>Plato</th><th>Descripción</th><th>Orden</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{menusVisibles.map((menu, index) => {
            const isEditing = editingMenu === menu.id_menu;
            return <tr key={menu.id_menu}>
              <td>{index + 1}</td>
              <td>{isEditing ? <select className="crear-edit-input" value={editMenuRestaurante} onChange={e => setEditMenuRestaurante(e.target.value)}>{restaurantes.map(r => <option key={r} value={r}>{r}</option>)}</select> : <span className="crear-value">{menu.restaurante}</span>}</td>
              <td>{isEditing ? <input className="crear-edit-input" value={editMenuNombre} onChange={e => setEditMenuNombre(e.target.value)} /> : <strong>{menu.nombre_plato}</strong>}</td>
              <td>{isEditing ? <input className="crear-edit-input" value={editMenuDescripcion} onChange={e => setEditMenuDescripcion(e.target.value)} /> : <span>{menu.descripcion || "—"}</span>}</td>
              <td>{isEditing ? <input className="crear-edit-input crear-order-input" type="number" min={0} value={editMenuOrden} onChange={e => setEditMenuOrden(Number(e.target.value))} /> : menu.orden}</td>
              <td>{isEditing ? <span className={menu.activo ? "crear-status" : "crear-status inactive"}>{menu.activo ? "Disponible" : "Inactivo"}</span> : <button className={`crear-status crear-status-button ${menu.activo ? "" : "inactive"}`} onClick={() => toggleMenu(menu)} disabled={saving}>{menu.activo ? "Disponible" : "Inactivo"}</button>}</td>
              <td><div className="crear-actions">{isEditing ? <><button className="crear-action save" onClick={saveMenu} disabled={saving || !editMenuNombre.trim() || !editMenuRestaurante}>Guardar</button><button className="crear-action" onClick={cancelEditMenu}><X size={15} /></button></> : <><button className="crear-action" title="Editar plato" onClick={() => startEditMenu(menu)}><Pencil size={15} /></button><button className="crear-action danger" title="Eliminar plato" onClick={() => removeMenu(menu)} disabled={saving}><Trash2 size={15} /></button></>}</div></td>
            </tr>;
          })}</tbody></table></div>
        )}
      </section>
    </div>
  );
}
