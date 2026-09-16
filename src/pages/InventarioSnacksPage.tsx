import { useCallback, useEffect, useMemo, useState } from "react";
import { ArchiveRestore, PackagePlus, Pencil, RefreshCw, Save, Search, X } from "lucide-react";
import {
  createSnackProduct,
  getSnackProducts,
  setSnackProductActive,
  updateSnackProduct,
  type SnackProduct,
} from "../services/snack.service";
import "../styles/snacks.css";

const money = (value: number) => `$${Number(value || 0).toLocaleString("es-CO")}`;

type FormState = {
  numero_producto: string;
  nombre_producto: string;
  cantidad: string;
  precio: string;
};

const emptyForm: FormState = { numero_producto: "", nombre_producto: "", cantidad: "0", precio: "" };

export default function InventarioSnacksPage() {
  const [products, setProducts] = useState<SnackProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<SnackProduct | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      setProducts(await getSnackProducts(true));
    } catch (e: any) {
      setError(e?.message || "No fue posible cargar el inventario de snacks.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (!showInactive && !p.activo) return false;
      if (!q) return true;
      return [p.numero_producto, p.nombre_producto].some((value) => value.toLowerCase().includes(q));
    });
  }, [products, search, showInactive]);

  const stockTotal = products.filter((p) => p.activo).reduce((sum, p) => sum + p.cantidad, 0);
  const inventoryValue = products.filter((p) => p.activo).reduce((sum, p) => sum + p.cantidad * p.precio, 0);
  const lowStock = products.filter((p) => p.activo && p.cantidad <= 5).length;

  const startCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
  };

  const startEdit = (product: SnackProduct) => {
    setEditing(product);
    setForm({
      numero_producto: product.numero_producto,
      nombre_producto: product.nombre_producto,
      cantidad: String(product.cantidad),
      precio: String(product.precio),
    });
    setError("");
    setSuccess("");
  };

  const save = async () => {
    const cantidad = Number(form.cantidad || 0);
    const precio = Number(form.precio || 0);
    if (!form.numero_producto.trim() || !form.nombre_producto.trim()) {
      setError("Número y nombre del producto son obligatorios.");
      return;
    }
    if (!Number.isInteger(cantidad) || cantidad < 0) {
      setError("La cantidad debe ser un número entero igual o mayor a cero.");
      return;
    }
    if (!Number.isFinite(precio) || precio <= 0) {
      setError("El precio debe ser mayor a cero.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        numero_producto: form.numero_producto,
        nombre_producto: form.nombre_producto,
        cantidad,
        precio,
      };
      if (editing) {
        await updateSnackProduct(editing.id_producto, payload);
        setSuccess("Producto actualizado correctamente.");
      } else {
        await createSnackProduct(payload);
        setSuccess("Producto agregado al inventario.");
      }
      setEditing(null);
      setForm(emptyForm);
      await load(true);
    } catch (e: any) {
      setError(e?.message || "No fue posible guardar el producto.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (product: SnackProduct) => {
    setError("");
    setSuccess("");
    try {
      await setSnackProductActive(product.id_producto, !product.activo);
      setSuccess(product.activo ? "Producto retirado de ventas." : "Producto reactivado.");
      await load(true);
    } catch (e: any) {
      setError(e?.message || "No fue posible cambiar el estado del producto.");
    }
  };

  return (
    <div className="snack-page">
      <div className="snack-page-head">
        <div>
          <h1>Inventario de snacks</h1>
          <p>Administra productos, existencias y precios de venta.</p>
        </div>
        <button className="snack-btn secondary" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? "spin-icon" : ""} /> Actualizar
        </button>
      </div>

      {error && <div className="snack-alert error">{error}</div>}
      {success && <div className="snack-alert success">{success}</div>}

      <div className="snack-kpis">
        <div><span>Productos activos</span><b>{products.filter((p) => p.activo).length}</b></div>
        <div><span>Unidades disponibles</span><b>{stockTotal}</b></div>
        <div><span>Valor del inventario</span><b>{money(inventoryValue)}</b></div>
        <div className={lowStock ? "warning" : ""}><span>Stock bajo ≤ 5</span><b>{lowStock}</b></div>
      </div>

      <section className="snack-card snack-form-card">
        <div className="snack-card-title">
          <div><PackagePlus size={18} /><strong>{editing ? `Editar ${editing.numero_producto}` : "Nuevo producto"}</strong></div>
          {editing && <button className="snack-icon-btn" onClick={startCreate} title="Cancelar edición"><X size={16} /></button>}
        </div>
        <div className="snack-product-form">
          <label>Número de producto *<input value={form.numero_producto} onChange={(e) => setForm({ ...form, numero_producto: e.target.value })} placeholder="Ej. SNK-001" /></label>
          <label>Nombre del producto *<input value={form.nombre_producto} onChange={(e) => setForm({ ...form, nombre_producto: e.target.value })} placeholder="Ej. Agua 600 ml" /></label>
          <label>Cantidad *<input type="number" min={0} step={1} value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} /></label>
          <label>Precio de venta *<input type="number" min={0} step={100} value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} placeholder="5000" /></label>
          <button className="snack-btn primary" disabled={saving} onClick={save}><Save size={16} /> {saving ? "Guardando…" : editing ? "Guardar cambios" : "Agregar producto"}</button>
        </div>
      </section>

      <section className="snack-card">
        <div className="snack-toolbar">
          <div className="snack-search"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto…" /></div>
          <label className="snack-check"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Mostrar inactivos</label>
        </div>

        <div className="snack-table-wrap">
          <table className="snack-table">
            <thead><tr><th>N.º producto</th><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="snack-empty">Cargando inventario…</td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className="snack-empty">No hay productos para mostrar.</td></tr> : filtered.map((product) => (
                <tr key={product.id_producto} className={!product.activo ? "inactive" : ""}>
                  <td><strong>{product.numero_producto}</strong></td>
                  <td>{product.nombre_producto}</td>
                  <td><span className={`snack-stock ${product.cantidad <= 5 ? "low" : ""}`}>{product.cantidad}</span></td>
                  <td>{money(product.precio)}</td>
                  <td><span className={`snack-status ${product.activo ? "active" : "inactive"}`}>{product.activo ? "Activo" : "Inactivo"}</span></td>
                  <td><div className="snack-actions"><button className="snack-icon-btn" onClick={() => startEdit(product)} title="Editar"><Pencil size={15} /></button><button className="snack-icon-btn" onClick={() => toggleActive(product)} title={product.activo ? "Desactivar" : "Reactivar"}><ArchiveRestore size={15} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
