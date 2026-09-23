import { useCallback, useEffect, useMemo, useState } from "react";
import { ArchiveRestore, PackageMinus, PackagePlus, Pencil, RefreshCw, Save, Search, X } from "lucide-react";
import {
  createSnackProduct,
  getSnackProductsAdmin,
  saveSnackPurchasePrice,
  setSnackStockByLocation,
  setSnackProductActive,
  updateSnackProduct,
  withdrawSnackStock,
  type SnackAdminProduct,
} from "../services/snack.service";
import "../styles/snacks.css";

const money = (value: number) => `$${Number(value || 0).toLocaleString("es-CO")}`;

type FormState = {
  numero_producto: string;
  nombre_producto: string;
  cantidad_taquilla_1: string;
  cantidad_enclave: string;
  precio: string;
  precio_compra: string;
};

const emptyForm: FormState = { numero_producto: "", nombre_producto: "", cantidad_taquilla_1: "0", cantidad_enclave: "0", precio: "", precio_compra: "" };

export default function InventarioSnacksPage() {
  const [products, setProducts] = useState<SnackAdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [withdrawingSaving, setWithdrawingSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<SnackAdminProduct | null>(null);
  const [withdrawing, setWithdrawing] = useState<SnackAdminProduct | null>(null);
  const [withdrawQty, setWithdrawQty] = useState("1");
  const [withdrawLocation, setWithdrawLocation] = useState<"taquilla_1" | "enclave">("taquilla_1");
  const [withdrawReason, setWithdrawReason] = useState("Vencimiento");
  const [form, setForm] = useState<FormState>(emptyForm);

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      setProducts(await getSnackProductsAdmin(true));
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

  const stockTaquilla = products.filter((p) => p.activo).reduce((sum, p) => sum + p.cantidad_taquilla_1, 0);
  const stockEnclave = products.filter((p) => p.activo).reduce((sum, p) => sum + p.cantidad_enclave, 0);
  const stockTotal = stockTaquilla + stockEnclave;
  const inventoryCost = products.filter((p) => p.activo).reduce((sum, p) => sum + p.cantidad_total * Number(p.precio_compra || 0), 0);
  const potentialRevenue = products.filter((p) => p.activo).reduce((sum, p) => sum + p.cantidad_total * p.precio, 0);
  const potentialProfit = potentialRevenue - inventoryCost;
  const lowStock = products.filter((p) => p.activo && (p.cantidad_taquilla_1 <= 5 || p.cantidad_enclave <= 5)).length;

  const startCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
  };

  const startEdit = (product: SnackAdminProduct) => {
    setEditing(product);
    setForm({
      numero_producto: product.numero_producto,
      nombre_producto: product.nombre_producto,
      cantidad_taquilla_1: String(product.cantidad_taquilla_1),
      cantidad_enclave: String(product.cantidad_enclave),
      precio: String(product.precio),
      precio_compra: product.precio_compra == null ? "" : String(product.precio_compra),
    });
    setWithdrawing(null);
    setError("");
    setSuccess("");
  };

  const startWithdrawal = (product: SnackAdminProduct) => {
    setWithdrawing(product);
    setEditing(null);
    const initialLocation = product.cantidad_taquilla_1 > 0 ? "taquilla_1" : "enclave";
    const available = initialLocation === "taquilla_1" ? product.cantidad_taquilla_1 : product.cantidad_enclave;
    setWithdrawLocation(initialLocation);
    setWithdrawQty(available > 0 ? "1" : "0");
    setWithdrawReason("Vencimiento");
    setError("");
    setSuccess("");
  };

  const save = async () => {
    const cantidadTaquilla = Number(form.cantidad_taquilla_1 || 0);
    const cantidadEnclave = Number(form.cantidad_enclave || 0);
    const precio = Number(form.precio || 0);
    const precioCompra = Number(form.precio_compra || 0);
    if (!form.numero_producto.trim() || !form.nombre_producto.trim()) {
      setError("Número y nombre del producto son obligatorios.");
      return;
    }
    if (!Number.isInteger(cantidadTaquilla) || cantidadTaquilla < 0 || !Number.isInteger(cantidadEnclave) || cantidadEnclave < 0) {
      setError("Las cantidades de Taquilla 1 y Enclave deben ser números enteros iguales o mayores a cero.");
      return;
    }
    if (!Number.isFinite(precio) || precio <= 0) {
      setError("El precio de venta debe ser mayor a cero.");
      return;
    }
    if (!Number.isFinite(precioCompra) || precioCompra < 0) {
      setError("El precio de compra debe ser igual o mayor a cero.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        numero_producto: form.numero_producto,
        nombre_producto: form.nombre_producto,
        precio,
      };
      if (editing) {
        await updateSnackProduct(editing.id_producto, payload);
        await saveSnackPurchasePrice(editing.id_producto, precioCompra);
        await setSnackStockByLocation(editing.id_producto, "taquilla_1", cantidadTaquilla, "Ajuste manual desde inventario");
        await setSnackStockByLocation(editing.id_producto, "enclave", cantidadEnclave, "Ajuste manual desde inventario");
        setSuccess("Producto, costos e inventarios por punto actualizados correctamente.");
      } else {
        const created: any = await createSnackProduct({ ...payload, cantidad: 0 });
        const id = Number(created.id_producto);
        await saveSnackPurchasePrice(id, precioCompra);
        await setSnackStockByLocation(id, "taquilla_1", cantidadTaquilla, "Inventario inicial");
        await setSnackStockByLocation(id, "enclave", cantidadEnclave, "Inventario inicial");
        setSuccess("Producto agregado a los inventarios de Taquilla 1 y Enclave.");
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

  const confirmWithdrawal = async () => {
    if (!withdrawing) return;
    const cantidad = Number(withdrawQty || 0);
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      setError("La cantidad a retirar debe ser un número entero mayor a cero.");
      return;
    }
    const available = withdrawLocation === "taquilla_1" ? withdrawing.cantidad_taquilla_1 : withdrawing.cantidad_enclave;
    if (cantidad > available) {
      setError(`No puedes retirar ${cantidad} unidades. En ${withdrawLocation === "taquilla_1" ? "Taquilla 1" : "Enclave"} hay ${available} disponibles.`);
      return;
    }
    if (!withdrawReason.trim()) {
      setError("Indica el motivo del retiro.");
      return;
    }

    setWithdrawingSaving(true);
    setError("");
    setSuccess("");
    try {
      await withdrawSnackStock(withdrawing.id_producto, cantidad, withdrawReason, withdrawLocation);
      const available = withdrawLocation === "taquilla_1" ? withdrawing.cantidad_taquilla_1 : withdrawing.cantidad_enclave;
      const remaining = available - cantidad;
      const locationLabel = withdrawLocation === "taquilla_1" ? "Taquilla 1" : "Enclave";
      setSuccess(`${cantidad} unidad${cantidad === 1 ? "" : "es"} de ${withdrawing.nombre_producto} retirada${cantidad === 1 ? "" : "s"} de ${locationLabel}. Stock restante allí: ${remaining}.`);
      setWithdrawing(null);
      setWithdrawQty("1");
      setWithdrawReason("Vencimiento");
      await load(true);
    } catch (e: any) {
      setError(e?.message || "No fue posible retirar unidades del inventario.");
    } finally {
      setWithdrawingSaving(false);
    }
  };

  const toggleActive = async (product: SnackAdminProduct) => {
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
          <p>Administra por separado las existencias de Taquilla 1 y Enclave. El costo de compra solo es visible para administradores.</p>
        </div>
        <button className="snack-btn secondary" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? "spin-icon" : ""} /> Actualizar
        </button>
      </div>

      {error && <div className="snack-alert error">{error}</div>}
      {success && <div className="snack-alert success">{success}</div>}

      <div className="snack-kpis">
        <div><span>Productos activos</span><b>{products.filter((p) => p.activo).length}</b></div>
        <div><span>Stock Taquilla 1</span><b>{stockTaquilla}</b></div>
        <div><span>Stock Enclave</span><b>{stockEnclave}</b></div>
        <div><span>Total unidades</span><b>{stockTotal}</b></div>
        <div><span>Capital invertido</span><b>{money(inventoryCost)}</b></div>
        <div><span>Ganancia potencial</span><b>{money(potentialProfit)}</b></div>
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
          <label>Stock Taquilla 1 *<input type="number" min={0} step={1} value={form.cantidad_taquilla_1} onChange={(e) => setForm({ ...form, cantidad_taquilla_1: e.target.value })} /></label>
          <label>Stock Enclave *<input type="number" min={0} step={1} value={form.cantidad_enclave} onChange={(e) => setForm({ ...form, cantidad_enclave: e.target.value })} /></label>
          <label>Precio de compra *<input type="number" min={0} step={100} value={form.precio_compra} onChange={(e) => setForm({ ...form, precio_compra: e.target.value })} placeholder="2000" /></label>
          <label>Precio de venta *<input type="number" min={0} step={100} value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} placeholder="5000" /></label>
          <button className="snack-btn primary" disabled={saving} onClick={save}><Save size={16} /> {saving ? "Guardando…" : editing ? "Guardar cambios" : "Agregar producto"}</button>
        </div>
      </section>

      {withdrawing && (
        <section className="snack-card snack-form-card">
          <div className="snack-card-title">
            <div><PackageMinus size={18} /><strong>Retirar unidades · {withdrawing.nombre_producto}</strong></div>
            <button className="snack-icon-btn" onClick={() => setWithdrawing(null)} title="Cancelar retiro"><X size={16} /></button>
          </div>
          <p style={{ margin: "0 0 12px", color: "#6f7785" }}>
            Usa esta opción para sacar productos vencidos, dañados o no vendibles del punto correcto. Taquilla 1: <strong>{withdrawing.cantidad_taquilla_1}</strong> · Enclave: <strong>{withdrawing.cantidad_enclave}</strong>.
          </p>
          <div className="snack-product-form">
            <label>Punto de inventario *
              <select value={withdrawLocation} onChange={(e) => { const next = e.target.value as "taquilla_1" | "enclave"; setWithdrawLocation(next); setWithdrawQty("1"); }}>
                <option value="taquilla_1">Taquilla 1 · {withdrawing.cantidad_taquilla_1} disponibles</option>
                <option value="enclave">Enclave · {withdrawing.cantidad_enclave} disponibles</option>
              </select>
            </label>
            <label>Cantidad a retirar *<input type="number" min={1} max={withdrawLocation === "taquilla_1" ? withdrawing.cantidad_taquilla_1 : withdrawing.cantidad_enclave} step={1} value={withdrawQty} onChange={(e) => setWithdrawQty(e.target.value)} /></label>
            <label style={{ gridColumn: "span 2" }}>Motivo *<input value={withdrawReason} onChange={(e) => setWithdrawReason(e.target.value)} placeholder="Ej. Vencimiento, producto dañado…" /></label>
            <label>Stock después<input value={Math.max(0, (withdrawLocation === "taquilla_1" ? withdrawing.cantidad_taquilla_1 : withdrawing.cantidad_enclave) - Number(withdrawQty || 0))} readOnly /></label>
            <button className="snack-btn primary" disabled={withdrawingSaving || (withdrawLocation === "taquilla_1" ? withdrawing.cantidad_taquilla_1 : withdrawing.cantidad_enclave) <= 0} onClick={confirmWithdrawal}><PackageMinus size={16} /> {withdrawingSaving ? "Retirando…" : "Confirmar retiro"}</button>
          </div>
        </section>
      )}

      <section className="snack-card">
        <div className="snack-toolbar">
          <div className="snack-search"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto…" /></div>
          <label className="snack-check"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Mostrar inactivos</label>
        </div>

        <div className="snack-table-wrap">
          <table className="snack-table">
            <thead><tr><th>N.º producto</th><th>Producto</th><th>Taquilla 1</th><th>Enclave</th><th>Total</th><th>Precio compra</th><th>Precio venta</th><th>Ganancia/u</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={10} className="snack-empty">Cargando inventario…</td></tr> : filtered.length === 0 ? <tr><td colSpan={10} className="snack-empty">No hay productos para mostrar.</td></tr> : filtered.map((product) => (
                <tr key={product.id_producto} className={!product.activo ? "inactive" : ""}>
                  <td><strong>{product.numero_producto}</strong></td>
                  <td>{product.nombre_producto}</td>
                  <td><span className={`snack-stock ${product.cantidad_taquilla_1 <= 5 ? "low" : ""}`}>{product.cantidad_taquilla_1}</span></td>
                  <td><span className={`snack-stock ${product.cantidad_enclave <= 5 ? "low" : ""}`}>{product.cantidad_enclave}</span></td>
                  <td><strong>{product.cantidad_total}</strong></td>
                  <td>{product.precio_compra == null ? "Sin definir" : money(product.precio_compra)}</td>
                  <td>{money(product.precio)}</td>
                  <td><strong>{product.precio_compra == null ? "—" : money(product.precio - product.precio_compra)}</strong></td>
                  <td><span className={`snack-status ${product.activo ? "active" : "inactive"}`}>{product.activo ? "Activo" : "Inactivo"}</span></td>
                  <td><div className="snack-actions"><button className="snack-icon-btn" onClick={() => startEdit(product)} title="Editar"><Pencil size={15} /></button><button className="snack-icon-btn" onClick={() => startWithdrawal(product)} disabled={product.cantidad_total <= 0} title="Retirar unidades del inventario"><PackageMinus size={15} /></button><button className="snack-icon-btn" onClick={() => toggleActive(product)} title={product.activo ? "Desactivar" : "Reactivar"}><ArchiveRestore size={15} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
