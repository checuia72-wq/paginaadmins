import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CreditCard, Info, Minus, Pencil, Plus, RefreshCw, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { getMetodosPagoActivos } from "../services/medioPago.service";
import { getCurrentRole } from "../services/role.service";
import {
  deleteSnackSaleAdmin,
  getSnackProducts,
  getSnackSalesByDate,
  registerSnackSale,
  snackLocationLabel,
  updateSnackSalePaymentReference,
  type SnackLocationCode,
  type SnackProduct,
  type SnackSale,
  type SnackSalePayment,
  type SnackSalePaymentInput,
} from "../services/snack.service";
import "../styles/snacks.css";

const money = (value: number) => `$${Number(value || 0).toLocaleString("es-CO")}`;
const todayBogota = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
const timeBogota = (value: string) => new Date(value).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" });

type Cart = Record<number, number>;
type PaymentSplit = SnackSalePaymentInput & { referencia_pago: string };

const emptyPayment = (): PaymentSplit => ({ monto: 0, medio_pago: "", referencia_pago: "" });
const paymentKey = (sale: SnackSale, payment: SnackSalePayment) => `${sale.id_venta}:${payment.id_pago ?? "legacy"}`;

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
  const [payments, setPayments] = useState<PaymentSplit[]>([emptyPayment()]);
  const [editingReferenceKey, setEditingReferenceKey] = useState<string | null>(null);
  const [editingReference, setEditingReference] = useState("");
  const [savingReference, setSavingReference] = useState(false);
  const [deletingSaleId, setDeletingSaleId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
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
      const [productData, paymentData, saleData, currentRole] = await Promise.all([
        getSnackProducts(false, ubicacion),
        getMetodosPagoActivos(),
        getSnackSalesByDate(todayBogota(), ubicacion),
        getCurrentRole(),
      ]);
      setProducts(productData);
      setMetodos(paymentData);
      setSales(saleData);
      setIsAdmin(currentRole?.role === "administrador");
      setCart((current) => {
        const next: Cart = {};
        for (const product of productData) {
          const qty = Math.min(current[product.id_producto] ?? 0, product.cantidad);
          if (qty > 0) next[product.id_producto] = qty;
        }
        return next;
      });
      if (paymentData.length === 1) {
        setPayments((current) =>
          current.length === 1 && !current[0].medio_pago && current[0].monto === 0
            ? [{ ...current[0], medio_pago: paymentData[0] }]
            : current,
        );
      }
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
  const assignedPayment = payments.reduce((sum, payment) => sum + Number(payment.monto || 0), 0);
  const pendingPayment = total - assignedPayment;

  const setQuantity = (product: SnackProduct, quantity: number) => {
    const next = Math.max(0, Math.min(product.cantidad, Math.floor(quantity || 0)));
    setCart((current) => {
      const copy = { ...current };
      if (next <= 0) delete copy[product.id_producto];
      else copy[product.id_producto] = next;
      return copy;
    });
  };

  const updatePayment = (index: number, patch: Partial<PaymentSplit>) => {
    setPayments((current) => current.map((payment, currentIndex) =>
      currentIndex === index ? { ...payment, ...patch } : payment,
    ));
  };

  const addPayment = () => {
    setPayments((current) => [...current, emptyPayment()]);
    setError("");
  };

  const removePayment = (index: number) => {
    setPayments((current) => {
      const next = current.filter((_, currentIndex) => currentIndex !== index);
      return next.length ? next : [emptyPayment()];
    });
    setError("");
  };

  const sell = async () => {
    if (!cartItems.length) {
      setError("Agrega al menos un producto a la venta.");
      return;
    }

    const cleanPayments = payments.filter((payment) =>
      Number(payment.monto || 0) > 0 || payment.medio_pago || payment.referencia_pago,
    );

    if (!cleanPayments.length) {
      setError("Agrega al menos un método de pago.");
      return;
    }

    if (cleanPayments.some((payment) => Number(payment.monto || 0) <= 0 || !payment.medio_pago)) {
      setError("Cada método de pago debe tener un valor mayor a cero y un medio seleccionado.");
      return;
    }

    if (cleanPayments.some((payment) => payment.referencia_pago && payment.referencia_pago.length !== 4)) {
      setError("La referencia es opcional, pero si la ingresas debe tener exactamente los últimos 4 dígitos.");
      return;
    }

    const paymentTotal = cleanPayments.reduce((sum, payment) => sum + Number(payment.monto || 0), 0);
    if (Math.abs(paymentTotal - total) > 0.009) {
      setError(`Los métodos de pago suman ${money(paymentTotal)} y la venta vale ${money(total)}. Deben coincidir exactamente.`);
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await registerSnackSale(
        cartItems.map(({ product, cantidad }) => ({ id_producto: product.id_producto, cantidad })),
        cleanPayments,
        ubicacion,
      );
      setCart({});
      setPayments([emptyPayment()]);
      setSuccess(`Venta registrada por ${money(total)} en ${locationLabel} con ${cleanPayments.length} método${cleanPayments.length === 1 ? "" : "s"} de pago. El inventario fue descontado automáticamente.`);
      await load(true);
    } catch (e: any) {
      setError(e?.message || "No fue posible registrar la venta.");
    } finally {
      setSaving(false);
    }
  };

  const beginEditReference = (sale: SnackSale, payment: SnackSalePayment) => {
    setEditingReferenceKey(paymentKey(sale, payment));
    setEditingReference(payment.referencia_pago || "");
    setError("");
    setSuccess("");
  };

  const savePaymentReference = async (sale: SnackSale, payment: SnackSalePayment) => {
    if (editingReference && editingReference.length !== 4) {
      setError("La referencia debe tener exactamente los últimos 4 dígitos, o quedar vacía si deseas quitarla.");
      return;
    }

    setSavingReference(true);
    setError("");
    setSuccess("");
    try {
      const savedReference = await updateSnackSalePaymentReference(
        sale.id_venta,
        editingReference,
        payment.id_pago,
      );
      setSales((current) => current.map((item) => {
        if (item.id_venta !== sale.id_venta) return item;
        const nextPayments = item.pagos.map((currentPayment) =>
          currentPayment.id_pago === payment.id_pago
            ? { ...currentPayment, referencia_pago: savedReference }
            : currentPayment,
        );
        return {
          ...item,
          pagos: nextPayments,
          referencia_pago: nextPayments.length === 1 ? savedReference : item.referencia_pago,
        };
      }));
      setEditingReferenceKey(null);
      setEditingReference("");
      setSuccess(savedReference
        ? `Referencia •••• ${savedReference} guardada para ${payment.medio_pago} en la venta #${sale.id_venta}. El valor no fue modificado.`
        : `Referencia de ${payment.medio_pago} retirada de la venta #${sale.id_venta}. El valor no fue modificado.`);
    } catch (e: any) {
      setError(e?.message || "No fue posible actualizar la referencia de pago.");
    } finally {
      setSavingReference(false);
    }
  };

  const deleteSale = async (sale: SnackSale) => {
    if (!isAdmin) return;

    const productsLabel = sale.items
      .map((item) => `${item.cantidad}× ${item.nombre_producto}`)
      .join(", ");
    const confirmed = window.confirm(
      `¿Eliminar la venta #${sale.id_venta} por ${money(sale.total)}?\n\n${productsLabel}\n\nLas unidades volverán al inventario de ${snackLocationLabel(sale.ubicacion_codigo)}. Esta acción es exclusiva del administrador.`,
    );
    if (!confirmed) return;

    setDeletingSaleId(sale.id_venta);
    setError("");
    setSuccess("");
    try {
      const result = await deleteSnackSaleAdmin(sale.id_venta);
      setEditingReferenceKey((current) => current?.startsWith(`${sale.id_venta}:`) ? null : current);
      setSales((current) => current.filter((item) => item.id_venta !== sale.id_venta));
      setSuccess(
        result.id_reserva
          ? `Venta #${sale.id_venta} eliminada. Se devolvió el inventario y se corrigió el total de la reserva vinculada.`
          : `Venta #${sale.id_venta} eliminada. Las unidades fueron devueltas al inventario de ${snackLocationLabel(result.ubicacion)}.`,
      );
      await load(true);
    } catch (e: any) {
      setError(e?.message || "No fue posible eliminar la venta.");
    } finally {
      setDeletingSaleId(null);
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
          <div className="snack-cart-head">
            <div className="snack-cart-heading">
              <span className="snack-cart-icon"><ShoppingCart size={20} /></span>
              <div>
                <strong>Venta actual · {locationLabel}</strong>
                <small>Productos agregados al carrito</small>
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
                <span className="snack-cart-empty-icon"><ShoppingCart size={24} /></span>
                <strong>Aún no has agregado productos.</strong>
                <p>Busca y agrega los snacks que desea la persona.</p>
                <button
                  type="button"
                  className="snack-empty-add-btn"
                  onClick={() => {
                    const input = document.querySelector<HTMLInputElement>(".snack-search input");
                    input?.scrollIntoView({ behavior: "smooth", block: "center" });
                    window.setTimeout(() => input?.focus(), 250);
                  }}
                >
                  <Plus size={16} /> Agregar productos
                </button>
              </div>
            ) : cartItems.map(({ product, cantidad }) => (
              <div className="snack-cart-row" key={product.id_producto}>
                <div>
                  <strong>{product.nombre_producto}</strong>
                  <small>{cantidad} × {money(product.precio)}</small>
                </div>
                <div>
                  <b>{money(product.precio * cantidad)}</b>
                  <button className="snack-icon-btn" onClick={() => setQuantity(product, 0)} title="Quitar"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="snack-cart-total">
            <div>
              <span>Total de productos</span>
              <small>Suma de todos los snacks en el carrito</small>
            </div>
            <b>{money(total)}</b>
          </div>

          <div className="snack-split-payments">
            <div className="snack-split-payments-head">
              <div>
                <strong>Métodos de pago</strong>
                <small>Puedes dividir el pago de la venta entre varios medios.</small>
              </div>
              <button type="button" className="snack-btn secondary compact" onClick={addPayment}>
                <Plus size={15} /> Añadir método
              </button>
            </div>

            <div className="snack-payment-cards">
              {payments.map((payment, index) => (
                <div className="snack-split-payment-row" key={index}>
                  <span className="snack-payment-number" aria-hidden="true">{index + 1}</span>

                  <label className="method">
                    <span className="snack-field-title">Medio de pago <em>*</em></span>
                    <select
                      value={payment.medio_pago}
                      onChange={(e) => updatePayment(index, {
                        medio_pago: e.target.value,
                        monto: payments.length === 1 && payment.monto === 0 && total > 0 ? total : payment.monto,
                      })}
                    >
                      <option value="">Seleccionar</option>
                      {metodos.map((method) => <option key={method} value={method}>{method}</option>)}
                    </select>
                  </label>

                  <label className="amount">
                    <span className="snack-field-title">Valor <em>*</em></span>
                    <div className="snack-money-input">
                      <span>$</span>
                      <input
                        inputMode="numeric"
                        value={payment.monto || ""}
                        placeholder="0"
                        onChange={(e) => updatePayment(index, { monto: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
                      />
                    </div>
                  </label>

                  <label className="reference">
                    <span className="snack-field-title">
                      Referencia
                      <span className="snack-reference-help" title="Últimos 4 dígitos de la referencia de pago"><Info size={12} /></span>
                    </span>
                    <small>4 dígitos · opcional</small>
                    <input
                      value={payment.referencia_pago}
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="Ej. 4821"
                      onChange={(e) => updatePayment(index, { referencia_pago: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                    />
                  </label>

                  <button
                    type="button"
                    className="snack-payment-delete"
                    title="Quitar método"
                    aria-label={`Quitar método de pago ${index + 1}`}
                    onClick={() => removePayment(index)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            <div className="snack-payment-info">
              <Info size={18} />
              <div>
                <strong>La suma de los métodos de pago debe ser igual al total de la venta.</strong>
                <span>Puedes usar uno o varios medios de pago.</span>
              </div>
            </div>

            <div className="snack-split-totals">
              <div>
                <span>Asignado</span>
                <b>{money(assignedPayment)}</b>
              </div>
              <div className={Math.abs(pendingPayment) > 0.009 ? "pending" : "complete"}>
                <span>{pendingPayment >= 0 ? "Falta por asignar" : "Valor excedido"}</span>
                <b>{money(Math.abs(pendingPayment))}</b>
              </div>
            </div>
          </div>

          <button
            className="snack-btn primary wide snack-charge-btn"
            disabled={saving || !cartItems.length || Math.abs(pendingPayment) > 0.009}
            onClick={sell}
          >
            <CreditCard size={19} />
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
            <thead><tr><th>Hora</th><th>Productos</th><th>Métodos de pago</th><th>Referencias</th><th>Vendedor</th><th>Total</th><th></th></tr></thead>
            <tbody>
              {sales.length === 0 ? (
                <tr><td colSpan={7} className="snack-empty">Todavía no hay ventas de snacks hoy en {locationLabel}.</td></tr>
              ) : sales.map((sale) => (
                <tr key={sale.id_venta}>
                  <td>{timeBogota(sale.fecha_venta)}</td>
                  <td>{sale.items.map((item) => `${item.cantidad}× ${item.nombre_producto}`).join(", ")}</td>
                  <td>
                    <div className="snack-sale-payments">
                      {sale.pagos.map((payment, index) => (
                        <div key={payment.id_pago ?? index}>
                          <strong>{payment.medio_pago}</strong>
                          <span>{money(payment.monto)}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="snack-sale-references">
                      {sale.pagos.map((payment, index) => {
                        const key = paymentKey(sale, payment);
                        const editingReferenceNow = editingReferenceKey === key;
                        return (
                          <div key={payment.id_pago ?? index}>
                            {editingReferenceNow ? (
                              <div className="snack-reference-editor">
                                <input
                                  autoFocus
                                  value={editingReference}
                                  inputMode="numeric"
                                  maxLength={4}
                                  placeholder="4 dígitos"
                                  onChange={(e) => setEditingReference(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                />
                                <button
                                  className="snack-icon-btn"
                                  title="Guardar referencia"
                                  disabled={savingReference || Boolean(editingReference && editingReference.length !== 4)}
                                  onClick={() => savePaymentReference(sale, payment)}
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  className="snack-icon-btn"
                                  title="Cancelar"
                                  disabled={savingReference}
                                  onClick={() => { setEditingReferenceKey(null); setEditingReference(""); }}
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <>
                                {payment.referencia_pago ? (
                                  <span className="snack-payment-reference">•••• {payment.referencia_pago}</span>
                                ) : (
                                  <span className="snack-payment-reference empty">Sin referencia</span>
                                )}
                                <button
                                  className="snack-icon-btn"
                                  title={`Editar referencia de ${payment.medio_pago}`}
                                  onClick={() => beginEditReference(sale, payment)}
                                >
                                  <Pencil size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  <td>{sale.vendedor_email || "—"}</td>
                  <td><strong>{money(sale.total)}</strong></td>
                  <td>
                    {isAdmin && (
                      <div className="snack-actions">
                        <button
                          className="snack-icon-btn danger"
                          title="Eliminar venta"
                          aria-label={`Eliminar venta #${sale.id_venta}`}
                          disabled={deletingSaleId === sale.id_venta}
                          onClick={() => deleteSale(sale)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
