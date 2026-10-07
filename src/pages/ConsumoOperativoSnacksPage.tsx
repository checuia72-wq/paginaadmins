import { useCallback, useEffect, useMemo, useState } from "react";
import { History, MapPin, Minus, PackageMinus, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { getCurrentRole } from "../services/role.service";
import {
  getOperationalSnackConsumptions,
  getOperationalSnackProducts,
  registerOperationalSnackConsumption,
  snackLocationLabel,
  type SnackLocationCode,
  type SnackOperationalConsumption,
  type SnackOperationalProduct,
} from "../services/snack.service";
import "../styles/snacks.css";

type Cart = Record<number, number>;

const timeBogota = (value: string) =>
  new Date(value).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "medium",
    timeStyle: "short",
  });

export default function ConsumoOperativoSnacksPage() {
  const [ubicacion, setUbicacion] = useState<SnackLocationCode>("taquilla_1");
  const [products, setProducts] = useState<SnackOperationalProduct[]>([]);
  const [consumptions, setConsumptions] = useState<SnackOperationalConsumption[]>([]);
  const [cart, setCart] = useState<Cart>({});
  const [search, setSearch] = useState("");
  const [canViewHistory, setCanViewHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setError("");

    try {
      const current = await getCurrentRole();
      const historyAllowed = current?.role === "administrador" || current?.role === "coordinador";
      setCanViewHistory(historyAllowed);

      const [productData, historyData] = await Promise.all([
        getOperationalSnackProducts(ubicacion),
        historyAllowed ? getOperationalSnackConsumptions(100) : Promise.resolve([]),
      ]);

      setProducts(productData);
      setConsumptions(historyData);
      setCart((currentCart) => {
        const next: Cart = {};
        for (const product of productData) {
          const quantity = Math.min(currentCart[product.id_producto] ?? 0, product.cantidad);
          if (quantity > 0) next[product.id_producto] = quantity;
        }
        return next;
      });
    } catch (e: any) {
      setError(e?.message || "No fue posible cargar el consumo operativo de snacks.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ubicacion]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refresh = () => void load(true);
    window.addEventListener("snack-stock-changed", refresh);
    window.addEventListener("snack-operational-consumption-recorded", refresh);
    return () => {
      window.removeEventListener("snack-stock-changed", refresh);
      window.removeEventListener("snack-operational-consumption-recorded", refresh);
    };
  }, [load]);

  useEffect(() => {
    setCart({});
    setSuccess("");
    setError("");
  }, [ubicacion]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((product) =>
      !q ||
      product.numero_producto.toLowerCase().includes(q) ||
      product.nombre_producto.toLowerCase().includes(q),
    );
  }, [products, search]);

  const cartItems = useMemo(
    () =>
      products
        .filter((product) => (cart[product.id_producto] ?? 0) > 0)
        .map((product) => ({
          product,
          cantidad: cart[product.id_producto] ?? 0,
        })),
    [products, cart],
  );

  const units = cartItems.reduce((sum, item) => sum + item.cantidad, 0);

  const setQuantity = (product: SnackOperationalProduct, quantity: number) => {
    const next = Math.max(0, Math.min(product.cantidad, Math.floor(quantity || 0)));
    setCart((current) => {
      const copy = { ...current };
      if (next <= 0) delete copy[product.id_producto];
      else copy[product.id_producto] = next;
      return copy;
    });
  };

  const consume = async () => {
    if (!cartItems.length) {
      setError("Agrega al menos un snack para registrar el consumo.");
      return;
    }

    const confirmed = window.confirm(
      `¿Registrar el consumo operativo de ${units} unidad${units === 1 ? "" : "es"} desde ${snackLocationLabel(ubicacion)}?\n\nEste movimiento descontará el inventario y quedará asociado a tu usuario.`,
    );
    if (!confirmed) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await registerOperationalSnackConsumption(
        cartItems.map(({ product, cantidad }) => ({
          id_producto: product.id_producto,
          cantidad,
        })),
        ubicacion,
      );

      setCart({});
      setSuccess(
        `Consumo operativo registrado: ${units} unidad${units === 1 ? "" : "es"} descontada${units === 1 ? "" : "s"} de ${snackLocationLabel(ubicacion)}.`,
      );
      await load(true);
    } catch (e: any) {
      setError(e?.message || "No fue posible registrar el consumo operativo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="snack-page">
      <div className="snack-page-head">
        <div>
          <h1>Consumo de snacks operativos</h1>
          <p>
            Registra snacks tomados para uso del personal. No genera venta ni recaudo:
            solo descuenta inventario y deja trazabilidad de quién realizó el consumo.
          </p>
        </div>
        <button className="snack-btn secondary" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? "spin-icon" : ""} /> Actualizar
        </button>
      </div>

      {error && <div className="snack-alert error">{error}</div>}
      {success && <div className="snack-alert success">{success}</div>}

      <div className="snack-kpis">
        <div>
          <span>Punto de consumo</span>
          <b>{snackLocationLabel(ubicacion)}</b>
        </div>
        <div>
          <span>Productos disponibles</span>
          <b>{products.filter((product) => product.cantidad > 0).length}</b>
        </div>
        <div>
          <span>Unidades seleccionadas</span>
          <b>{units}</b>
        </div>
      </div>

      <section className="snack-card" style={{ marginBottom: 18 }}>
        <div className="snack-card-title">
          <div>
            <MapPin size={18} />
            <strong>Selecciona de qué inventario salen los snacks</strong>
          </div>
        </div>
        <div>
          <label className="snack-payment-label" style={{ maxWidth: 320, marginBottom: 0 }}>
            <span>Ubicación</span>
            <select
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value as SnackLocationCode)}
              disabled={saving}
            >
              <option value="taquilla_1">Taquilla 1</option>
              <option value="enclave">Enclave</option>
            </select>
          </label>
        </div>
      </section>

      <div className="snack-sales-layout">
        <section className="snack-card">
          <div className="snack-toolbar">
            <div className="snack-search">
              <Search size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Buscar snack en ${snackLocationLabel(ubicacion)}…`}
              />
            </div>
          </div>

          <div className="snack-product-grid">
            {loading ? (
              <div className="snack-empty">Cargando productos…</div>
            ) : filtered.length === 0 ? (
              <div className="snack-empty">No hay productos disponibles en esta ubicación.</div>
            ) : (
              filtered.map((product) => {
                const quantity = cart[product.id_producto] ?? 0;
                return (
                  <article
                    key={product.id_producto}
                    className={`snack-sale-product ${product.cantidad <= 0 ? "sold-out" : ""}`}
                  >
                    <div className="snack-sale-product-head">
                      <span>{product.numero_producto}</span>
                      <span className={`snack-stock ${product.cantidad <= 5 ? "low" : ""}`}>
                        {product.cantidad} disp.
                      </span>
                    </div>
                    <h3>{product.nombre_producto}</h3>
                    <div className="snack-qty-control">
                      <button
                        disabled={quantity <= 0}
                        onClick={() => setQuantity(product, quantity - 1)}
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={product.cantidad}
                        value={quantity}
                        onChange={(e) => setQuantity(product, Number(e.target.value))}
                      />
                      <button
                        disabled={product.cantidad <= 0 || quantity >= product.cantidad}
                        onClick={() => setQuantity(product, quantity + 1)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <aside className="snack-card snack-cart-card">
          <div className="snack-cart-head">
            <div className="snack-cart-heading">
              <span className="snack-cart-icon">
                <PackageMinus size={20} />
              </span>
              <div>
                <strong>Consumo actual</strong>
                <small>Sin precio ni método de pago</small>
              </div>
            </div>
            <div className="snack-unit-badge">
              <b>{units}</b>
              <span>unidad{units === 1 ? "" : "es"}</span>
            </div>
          </div>

          <div className={`snack-cart-list ${cartItems.length === 0 ? "is-empty" : ""}`}>
            {cartItems.length === 0 ? (
              <div className="snack-cart-empty">
                <span className="snack-cart-empty-icon">
                  <PackageMinus size={24} />
                </span>
                <strong>Aún no has agregado snacks.</strong>
                <p>Selecciona lo que vas a consumir para descontarlo correctamente del inventario.</p>
              </div>
            ) : (
              cartItems.map(({ product, cantidad }) => (
                <div className="snack-cart-row" key={product.id_producto}>
                  <div>
                    <strong>{product.nombre_producto}</strong>
                    <small>{cantidad} unidad{cantidad === 1 ? "" : "es"}</small>
                  </div>
                  <div>
                    <b>{cantidad}</b>
                    <button
                      className="snack-icon-btn"
                      onClick={() => setQuantity(product, 0)}
                      title="Quitar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="snack-cart-total">
            <div>
              <span>Total a consumir</span>
              <small>Se descontará de {snackLocationLabel(ubicacion)}</small>
            </div>
            <b>{units}</b>
          </div>

          <button
            type="button"
            className="snack-btn primary"
            style={{ width: "100%", justifyContent: "center" }}
            disabled={saving || units <= 0}
            onClick={consume}
          >
            <PackageMinus size={17} />
            {saving ? "Registrando…" : "Consumir snacks"}
          </button>
        </aside>
      </div>

      {canViewHistory && (
        <section className="snack-card" style={{ marginTop: 20 }}>
          <div className="snack-card-title">
            <div>
              <History size={18} />
              <strong>Registro de consumos operativos</strong>
            </div>
            <span>Visible para Administración y Coordinación</span>
          </div>

          {consumptions.length === 0 ? (
            <div className="snack-empty">Todavía no hay consumos operativos registrados.</div>
          ) : (
            <div className="snack-table-wrap">
              <table className="snack-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Usuario</th>
                    <th>Ubicación</th>
                    <th>Snacks consumidos</th>
                    <th>Unidades</th>
                  </tr>
                </thead>
                <tbody>
                  {consumptions.map((consumption) => (
                    <tr key={consumption.id_consumo}>
                      <td>{timeBogota(consumption.fecha_consumo)}</td>
                      <td>{consumption.registrado_email || "Usuario sin correo"}</td>
                      <td>{snackLocationLabel(consumption.ubicacion_codigo)}</td>
                      <td>
                        {consumption.items
                          .map((item) => `${item.cantidad}× ${item.nombre_producto}`)
                          .join(", ")}
                      </td>
                      <td><strong>{consumption.total_unidades}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
