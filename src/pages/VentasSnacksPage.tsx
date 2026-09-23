import { useCallback, useEffect, useMemo, useState } from "react";
import { Minus, Plus, RefreshCw, Search, ShoppingCart, Trash2 } from "lucide-react";
import { getMetodosPagoActivos } from "../services/medioPago.service";
import {
  getSnackProducts,
  getSnackSalesByDate,
  registerSnackSale,
  snackLocationLabel,
  type SnackLocationCode,
  type SnackProduct,
  type SnackSale,
} from "../services/snack.service";
import "../styles/snacks.css";

const money = (value: number) => `$${Number(value || 0).toLocaleString("es-CO")}`;
const todayBogota = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
const timeBogota = (value: string) => new Date(value).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" });

type Cart = Record<number, number>;

type Props = {
  ubicacion?: SnackLocationCode;
  titulo?: string;
};

export default function VentasSnacksPage({
  ubicacion = "taquilla_1",
  titulo,
}: Props) {
  const locationLabel = snackLocationLabel(ubicacion);
  const pageTitle = titulo || `Ventas ${locationLabel}`;

  const [products, setProducts] = useState<SnackProduct[]>([]);
  const [metodos, setMetodos] = useState<string[]>([]);
  const [sales, setSales] = useState<SnackSale[]>([]);
  const [cart, setCart] = useState<Cart>({});
  const [medioPago, setMedioPago] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [productData, paymentData, saleData] = await Promise.all([
        getSnackProducts(false, ubicacion),
        getMetodosPagoActivos(),
        getSnackSalesByDate(todayBogota(), ubicacion),
      ]);
      setProducts(productData);
      setMetodos(paymentData);
      setSales(saleData);
      setCart((current) => {
        const next: Cart = {};
        for (const product of productData) {
          const qty = Math.min(current[product.id_producto] ?? 0, product.cantidad);
          if (qty > 0) next[product.id_producto] = qty;
        }
        return next;
      });
      if (paymentData.length === 1) setMedioPago(paymentData[0]);
    } catch (e: any) {
      setError(e?.message || `No fue posible cargar las ventas de ${locationLabel}.`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ubicacion, locationLabel]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const refresh = () => void load(true);
    window.addEventListener("snack-stock-changed", refresh);
    return () => window.removeEventListener("snack-stock-changed", refresh);
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((product) =>
      !q || [product.numero_producto, product.nombre_producto].some((value) => value.toLowerCase().includes(q)),
    );
  }, [products, search]);

  const cartItems = useMemo(() => products
    .filter((product) => (cart[product.id_producto] ?? 0) > 0)
    .map((product) => ({ product, cantidad: cart[product.id_producto] ?? 0 })), [products, cart]);

  const total = cartItems.reduce((sum, item) => sum + item.product.precio * item.cantidad, 0);
  const units = cartItems.reduce((sum, item) => sum + item.cantidad, 0);
  const totalToday = sales.reduce((sum, sale) => sum + sale.total, 0);

  const setQuantity = (product: SnackProduct, quantity: number) => {
    const next = Math.max(0, Math.min(product.cantidad, Math.floor(quantity || 0)));
    setCart((current) => {
      const copy = { ...current };
      if (next <= 0) delete copy[product.id_producto];
      else copy[product.id_producto] = next;
      return copy;
    });
  };

  const sell = async () => {
    if (!cartItems.length) {
      setError("Agrega al menos un producto a la venta.");
      return;
    }
    if (!medioPago) {
      setError("Selecciona el método de pago.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await registerSnackSale(
        cartItems.map(({ product, cantidad }) => ({ id_producto: product.id_producto, cantidad })),
        medioPago,
        ubicacion,
      );
      setCart({});
      setSuccess(`Venta registrada por ${money(total)} en ${locationLabel}. El inventario de este punto fue descontado automáticamente.`);
      await load(true);
    } catch (e: any) {
      setError(e?.message || "No fue posible registrar la venta.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="snack-page">
      <div className="snack-page-head">
        <div>
          <h1>{pageTitle}</h1>
          <p>Registra ventas usando únicamente el inventario disponible en <strong>{locationLabel}</strong>.</p>
        </div>
        <button className="snack-btn secondary" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? "spin-icon" : ""} /> Actualizar
        </button>
      </div>

      {error && <div className="snack-alert error">{error}</div>}
      {success && <div className="snack-alert success">{success}</div>}

      <div className="snack-kpis">
        <div><span>Ventas de hoy · {locationLabel}</span><b>{sales.length}</b></div>
        <div><span>Recaudo hoy</span><b>{money(totalToday)}</b></div>
        <div><span>Productos disponibles</span><b>{products.filter((p) => p.cantidad > 0).length}</b></div>
        <div><span>Unidades en carrito</span><b>{units}</b></div>
      </div>

      <div className="snack-sales-layout">
        <section className="snack-card">
          <div className="snack-toolbar">
            <div className="snack-search">
              <Search size={16} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Buscar snack en ${locationLabel}…`} />
            </div>
          </div>

          <div className="snack-product-grid">
            {loading ? (
              <div className="snack-empty">Cargando productos…</div>
            ) : filtered.length === 0 ? (
              <div className="snack-empty">No hay productos disponibles en {locationLabel}.</div>
            ) : filtered.map((product) => {
              const quantity = cart[product.id_producto] ?? 0;
              return (
                <article key={product.id_producto} className={`snack-sale-product ${product.cantidad <= 0 ? "sold-out" : ""}`}>
                  <div className="snack-sale-product-head">
                    <span>{product.numero_producto}</span>
                    <span className={`snack-stock ${product.cantidad <= 5 ? "low" : ""}`}>{product.cantidad} disp.</span>
                  </div>
                  <h3>{product.nombre_producto}</h3>
                  <strong className="snack-price">{money(product.precio)}</strong>
                  <div className="snack-qty-control">
                    <button disabled={quantity <= 0} onClick={() => setQuantity(product, quantity - 1)}><Minus size={14} /></button>
                    <input type="number" min={0} max={product.cantidad} value={quantity} onChange={(e) => setQuantity(product, Number(e.target.value))} />
                    <button disabled={product.cantidad <= 0 || quantity >= product.cantidad} onClick={() => setQuantity(product, quantity + 1)}><Plus size={14} /></button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="snack-card snack-cart-card">
          <div className="snack-card-title">
            <div><ShoppingCart size={18} /><strong>Venta actual · {locationLabel}</strong></div>
            <span>{units} unidad{units === 1 ? "" : "es"}</span>
          </div>
          <div className="snack-cart-list">
            {cartItems.length === 0 ? (
              <div className="snack-empty">Aún no has agregado productos.</div>
            ) : cartItems.map(({ product, cantidad }) => (
              <div className="snack-cart-row" key={product.id_producto}>
                <div><strong>{product.nombre_producto}</strong><small>{cantidad} × {money(product.precio)}</small></div>
                <div>
                  <b>{money(product.precio * cantidad)}</b>
                  <button className="snack-icon-btn" onClick={() => setQuantity(product, 0)} title="Quitar"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="snack-cart-total"><span>Total</span><b>{money(total)}</b></div>
          <label className="snack-payment-label">
            Método de pago *
            <select value={medioPago} onChange={(e) => setMedioPago(e.target.value)}>
              <option value="">Seleccionar</option>
              {metodos.map((method) => <option key={method} value={method}>{method}</option>)}
            </select>
          </label>
          <button className="snack-btn primary wide" disabled={saving || !cartItems.length} onClick={sell}>
            {saving ? "Registrando venta…" : `Cobrar ${money(total)}`}
          </button>
        </aside>
      </div>

      <section className="snack-card">
        <div className="snack-card-title">
          <div><strong>Ventas registradas hoy · {locationLabel}</strong></div>
          <span>{todayBogota()}</span>
        </div>
        <div className="snack-table-wrap">
          <table className="snack-table">
            <thead><tr><th>Hora</th><th>Productos</th><th>Método</th><th>Vendedor</th><th>Total</th></tr></thead>
            <tbody>
              {sales.length === 0 ? (
                <tr><td colSpan={5} className="snack-empty">Todavía no hay ventas de snacks hoy en {locationLabel}.</td></tr>
              ) : sales.map((sale) => (
                <tr key={sale.id_venta}>
                  <td>{timeBogota(sale.fecha_venta)}</td>
                  <td>{sale.items.map((item) => `${item.cantidad}× ${item.nombre_producto}`).join(", ")}</td>
                  <td>{sale.medio_pago}</td>
                  <td>{sale.vendedor_email || "—"}</td>
                  <td><strong>{money(sale.total)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
