import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, BarChart3, Bot, CheckCircle2, CircleHelp, FilePlus2,
  MessageCircle, Pencil, RefreshCw, Search, ShieldAlert, Trash2, Users, X,
} from "lucide-react";
import {
  getBotMetricas, listBotFaq, removeBotFaq, saveBotFaq,
  type BotMetricas, type FaqPayload, type PreguntaFrecuenteBot,
} from "../services/botIA.service";
import "../styles/bot-ia.css";

type Tab = "metricas" | "faq";
type Formulario = Omit<FaqPayload, "palabras_clave"> & { palabras: string };

function fechaBogota(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (name: string) => parts.find(item => item.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

const todayBogota = () => fechaBogota(new Date());
const daysAgo = (days: number) => fechaBogota(new Date(Date.now() - days * 86_400_000));
const numero = (value: number | null | undefined) => new Intl.NumberFormat("es-CO").format(Number(value ?? 0));
const pesos = (value: number | null | undefined) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value ?? 0));
const shortDate = (value: string) =>
  new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));
const blankForm = (): Formulario => ({
  codigo: "", categoria: "general", pregunta: "", respuesta: "", palabras: "",
  confirmacion_por_plan: false, activa: true, prioridad: 5,
});
const slug = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0,72);

function ErrorBanner({ message }: { message: string }) {
  return <div className="bot-ia-error" role="alert"><ShieldAlert size={18} /><span>{message}</span></div>;
}

export default function BotIAPage() {
  const [tab, setTab] = useState<Tab>("metricas");
  const [desde, setDesde] = useState(() => daysAgo(29));
  const [hasta, setHasta] = useState(() => todayBogota());
  const [refreshKey, setRefreshKey] = useState(0);
  const [metricas, setMetricas] = useState<BotMetricas | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [errorMetrics, setErrorMetrics] = useState("");
  const [faqs, setFaqs] = useState<PreguntaFrecuenteBot[]>([]);
  const [loadingFaq, setLoadingFaq] = useState(true);
  const [errorFaq, setErrorFaq] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"todas" | "activas" | "inactivas">("todas");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Formulario>(blankForm);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const loadFaq = useCallback(async () => {
    setLoadingFaq(true);
    setErrorFaq("");
    try {
      setFaqs(await listBotFaq());
    } catch (error) {
      setErrorFaq(error instanceof Error ? error.message : "No se pudieron consultar las preguntas frecuentes");
    } finally {
      setLoadingFaq(false);
    }
  }, []);

  useEffect(() => { void loadFaq(); }, [loadFaq]);

  useEffect(() => {
    let active = true;
    setLoadingMetrics(true);
    setErrorMetrics("");
    const dates = [desde, hasta].map(t => Date.parse(`${t}T12:00:00Z`));
    const today = todayBogota();
    if (!Number.isFinite(dates[0]) || !Number.isFinite(dates[1]) ||
        desde > hasta || hasta > today || (dates[1] - dates[0]) / 86_400_000 > 120) {
      setMetricas(null);
      setErrorMetrics("Selecciona un rango válido de máximo 121 días, sin fechas futuras.");
      setLoadingMetrics(false);
      return;
    }
    void getBotMetricas(desde, hasta)
      .then(data => { if (active) setMetricas(data); })
      .catch(error => {
        if (active) { setMetricas(null); setErrorMetrics(error instanceof Error ? error.message : "No se pudieron cargar las métricas"); }
      })
      .finally(() => { if (active) setLoadingMetrics(false); });
    return () => { active = false; };
  }, [desde, hasta, refreshKey]);

  const filtered = useMemo(() => {
    const q = search.toLocaleLowerCase("es-CO").trim();
    return faqs.filter(faq => {
      if (status === "activas" && !faq.activa) return false;
      if (status === "inactivas" && faq.activa) return false;
      return !q || [faq.codigo, faq.categoria, faq.pregunta, faq.respuesta, ...faq.palabras_clave]
        .some(value => value.toLocaleLowerCase("es-CO").includes(q));
    });
  }, [faqs, search, status]);

  const updateForm = <K extends keyof Formulario>(field: K, value: Formulario[K]) =>
    setForm(current => ({ ...current, [field]: value }));

  const startCreate = () => {
    setEditingId(null); setForm(blankForm()); setErrorFaq(""); setNotice(""); setFormOpen(true);
  };
  const startEdit = (faq: PreguntaFrecuenteBot) => {
    setEditingId(faq.id);
    setForm({
      codigo: faq.codigo, categoria: faq.categoria, pregunta: faq.pregunta,
      respuesta: faq.respuesta, palabras: faq.palabras_clave.join(", "),
      confirmacion_por_plan: faq.confirmacion_por_plan,
      activa: faq.activa, prioridad: faq.prioridad,
    });
    setErrorFaq(""); setNotice(""); setFormOpen(true);
  };

  const save = async () => {
    setSaving(true); setErrorFaq(""); setNotice("");
    try {
      await saveBotFaq({
        ...form,
        palabras_clave: form.palabras.split(/[,\n;]+/).map(value => value.trim()).filter(Boolean),
      }, editingId ?? undefined);
      await loadFaq();
      setFormOpen(false);
      setNotice(editingId == null ? "Pregunta frecuente creada correctamente." : "Pregunta frecuente actualizada correctamente.");
    } catch (error) {
      setErrorFaq(error instanceof Error ? error.message : "No se pudo guardar la pregunta");
    } finally { setSaving(false); }
  };

  const changeActive = async (faq: PreguntaFrecuenteBot) => {
    setSaving(true); setErrorFaq(""); setNotice("");
    try {
      await saveBotFaq({ ...faq, activa: !faq.activa }, faq.id);
      await loadFaq();
      setNotice(faq.activa ? "Pregunta desactivada. El bot ya no debería utilizarla." : "Pregunta activada.");
    } catch (error) {
      setErrorFaq(error instanceof Error ? error.message : "No se pudo cambiar el estado");
    } finally { setSaving(false); }
  };

  const remove = async (faq: PreguntaFrecuenteBot) => {
    if (!window.confirm(`¿Eliminar permanentemente la pregunta "${faq.pregunta}"? Esta acción no se puede deshacer.`)) return;
    setSaving(true); setErrorFaq(""); setNotice("");
    try {
      await removeBotFaq(faq.id);
      await loadFaq();
      setNotice("Pregunta eliminada correctamente.");
    } catch (error) {
      setErrorFaq(error instanceof Error ? error.message : "No se pudo eliminar la pregunta");
    } finally { setSaving(false); }
  };

  const m = metricas?.metricas;
  const v = metricas?.ventas_asociadas;
  const daily = metricas?.diario ?? [];
  const dailyMax = Math.max(1, ...daily.map(day => Math.max(day.contactos_entrantes, day.contactos_atendidos)));
  const percentage = (value: number, denominator: number) => denominator > 0
    ? `${(value / denominator * 100).toFixed(1).replace(".", ",")}%` : "—";

  return (
    <div className="bot-ia-page">
      <header className="bot-ia-head">
        <div className="bot-ia-head-icon"><Bot size={26} /></div>
        <div className="bot-ia-head-text">
          <p className="bot-ia-eyebrow">Administración · Checua IA</p>
          <h1>Control del chatbot</h1>
          <p>Seguimiento comercial y gestión de las respuestas que consulta el bot en Supabase.</p>
        </div>
      </header>

      <div className="bot-ia-tabs" role="tablist" aria-label="Apartados de Checua IA">
        <button type="button" role="tab" aria-selected={tab === "metricas"} className={tab === "metricas" ? "selected" : ""} onClick={() => setTab("metricas")}>
          <BarChart3 size={18} /> Métricas y ventas
        </button>
        <button type="button" role="tab" aria-selected={tab === "faq"} className={tab === "faq" ? "selected" : ""} onClick={() => setTab("faq")}>
          <CircleHelp size={18} /> Preguntas frecuentes
          <span className="bot-ia-count">{faqs.length}</span>
        </button>
      </div>

      {tab === "metricas" ? (
        <section className="bot-ia-space" aria-label="Métricas del bot">
          <div className="bot-ia-toolbar">
            <div>
              <h2>Rendimiento de la atención</h2>
              <p>Contactos únicos y mensajes registrados en la bitácora del bot.</p>
            </div>
            <div className="bot-ia-filter">
              <label>Desde<input type="date" max={hasta} value={desde} onChange={event => setDesde(event.target.value)} /></label>
              <label>Hasta<input type="date" min={desde} max={todayBogota()} value={hasta} onChange={event => setHasta(event.target.value)} /></label>
              <button type="button" className="bot-ia-button outline" title="Actualizar cifras" onClick={() => setRefreshKey(v => v + 1)} disabled={loadingMetrics}>
                <RefreshCw size={16} /> Actualizar
              </button>
            </div>
          </div>

          {errorMetrics && <ErrorBanner message={errorMetrics} />}
          {loadingMetrics && <p className="bot-ia-loading"><RefreshCw size={17} className="bot-ia-spin" /> Consultando estadísticas…</p>}
          {!loadingMetrics && metricas && m && v && (
            <>
              <div className="bot-ia-coverage">
                <Activity size={17} />
                <span>La bitácora comenzó el <strong>{metricas.bitacora_desde ? new Date(metricas.bitacora_desde).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" }) : "periodo aún sin datos"}</strong>.
                  Los indicadores siguientes solo incluyen eventos disponibles en este registro. Aceptado por YCloud no equivale a leído por el cliente.</span>
              </div>

              <div className="bot-ia-kpis">
                <article className="bot-ia-kpi"><div><Users size={18} /> Contactos que escribieron</div><strong>{numero(m.contactos_entrantes)}</strong><small>Contactos únicos con mensaje entrante</small></article>
                <article className="bot-ia-kpi"><div><Bot size={18} /> Atendidos por el bot</div><strong>{numero(m.contactos_atendidos)}</strong><small>Con al menos una respuesta aceptada por YCloud</small></article>
                <article className="bot-ia-kpi"><div><MessageCircle size={18} /> Continuaron conversando</div><strong>{numero(m.contactos_continuaron)}</strong><small>Enviaron dos o más mensajes al sistema</small></article>
                <article className="bot-ia-kpi"><div><ArrowUpRight size={18} /> Recibieron enlace</div><strong>{numero(m.contactos_con_enlace)}</strong><small>Contactos a quienes se les envió el enlace de reservas</small></article>
              </div>

              <div className="bot-ia-grid-two">
                <article className="bot-ia-panel bot-ia-sales">
                  <div className="bot-ia-section-title"><h3>Reservas asociadas al bot</h3><CheckCircle2 size={20} /></div>
                  <div className="bot-ia-sales-number">{numero(v.reservas_aprobadas)} <span>aprobadas</span></div>
                  <p className="bot-ia-sales-amount">{pesos(v.valor_aprobado_cop)} <span>valor total de reservas aprobadas</span></p>
                  <p>{numero(v.reservas_registradas)} reservas registradas tras una respuesta del bot al mismo número, dentro de los 7 días anteriores.</p>
                  <div className="bot-ia-note"><ShieldAlert size={16} /><span>Es una asociación verificable por teléfono y fecha, no una prueba de que el bot causó la venta. No equivale a utilidades ni a pagos recibidos.</span></div>
                </article>

                <article className="bot-ia-panel">
                  <div className="bot-ia-section-title"><h3>Embudo de atención</h3><BarChart3 size={20} /></div>
                  <div className="bot-ia-funnel">
                    {[
                      ["Escribieron", m.contactos_entrantes],
                      ["Recibieron respuesta del bot", m.contactos_atendidos],
                      ["Recibieron información del plan", m.contactos_con_plan],
                      ["Recibieron enlace de reserva", m.contactos_con_enlace],
                      ["Llegaron a «Cómo reservar»", m.contactos_como_reservar],
                    ].map(([label, raw]) => {
                      const number = Number(raw);
                      return <div key={String(label)} className="bot-ia-funnel-row">
                        <span>{label}</span><strong>{numero(number)}</strong>
                        <div className="bot-ia-track"><div style={{ width: `${m.contactos_entrantes ? Math.min(100, number / m.contactos_entrantes * 100) : 0}%` }} /></div>
                      </div>;
                    })}
                  </div>
                  <p className="bot-ia-funnel-foot">Avance a enlace: <strong>{percentage(m.contactos_con_enlace, m.contactos_entrantes)}</strong> de quienes escribieron. Las etapas pueden no ser consecutivas.</p>
                </article>
              </div>

              <div className="bot-ia-subkpis">
                <div><span>Un único mensaje entrante</span><strong>{numero(m.contactos_un_mensaje)}</strong><small>No demuestra abandono ni solo clic en un anuncio.</small></div>
                <div><span>Sin respuesta registrada del bot</span><strong>{numero(m.contactos_sin_respuesta_bot)}</strong><small>Pudieron ser atendidos por humanos u otros canales.</small></div>
                <div><span>Derivados a humanos</span><strong>{numero(m.contactos_derivados)}</strong><small>Solicitudes de atención humana registradas.</small></div>
                <div><span>Errores de envío YCloud</span><strong>{numero(m.mensajes_fallidos_ycloud)}</strong><small>Mensajes salientes con error en bitácora.</small></div>
                <div><span>Mensajes entrantes</span><strong>{numero(m.mensajes_entrantes)}</strong><small>Total de eventos, no contactos.</small></div>
                <div><span>Mensajes aceptados</span><strong>{numero(m.mensajes_aceptados_ycloud)}</strong><small>No implica entrega ni lectura.</small></div>
                <div><span>Contactos con alerta</span><strong>{numero(m.contactos_con_alerta)}</strong><small>Detecciones automáticas comerciales.</small></div>
              </div>

              <article className="bot-ia-panel">
                <div className="bot-ia-section-title"><h3>Actividad diaria</h3><Activity size={20} /></div>
                {daily.length === 0 ? <p className="bot-ia-empty">No hay eventos registrados en este rango.</p> : (
                  <div className="bot-ia-daily">
                    <div className="bot-ia-chart-legend"><span className="bot-ia-dot inbound" /> Contactos entrantes <span className="bot-ia-dot answered" /> Contactos atendidos</div>
                    {daily.map(day => <div className="bot-ia-daily-row" key={day.dia}>
                      <time dateTime={day.dia}>{shortDate(day.dia)}</time>
                      <div className="bot-ia-daily-bars">
                        <div className="bot-ia-daily-bar inbound" style={{ width: `${Math.max(0, day.contactos_entrantes / dailyMax * 100)}%` }} />
                        <div className="bot-ia-daily-bar answered" style={{ width: `${Math.max(0, day.contactos_atendidos / dailyMax * 100)}%` }} />
                      </div>
                      <strong>{numero(day.contactos_entrantes)} / {numero(day.contactos_atendidos)}</strong>
                    </div>)}
                  </div>
                )}
              </article>
            </>
          )}
        </section>
      ) : (
        <section className="bot-ia-space" aria-label="Gestión de preguntas frecuentes">
          <div className="bot-ia-toolbar">
            <div><h2>Base de conocimiento del bot</h2><p>Las preguntas activas son consultadas por Checua IA para responder a los clientes.</p></div>
            <div className="bot-ia-toolbar-actions">
              <button className="bot-ia-button outline" type="button" onClick={() => void loadFaq()} disabled={loadingFaq}><RefreshCw size={16} /> Actualizar</button>
              <button className="bot-ia-button primary" type="button" onClick={startCreate}><FilePlus2 size={17} /> Nueva pregunta</button>
            </div>
          </div>
          {notice && <div className="bot-ia-notice" role="status"><CheckCircle2 size={17} /> {notice}</div>}
          {errorFaq && <ErrorBanner message={errorFaq} />}
          <div className="bot-ia-faq-filters">
            <label className="bot-ia-search"><Search size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por pregunta, categoría o palabras clave…" /></label>
            <select value={status} onChange={event => setStatus(event.target.value as typeof status)}>
              <option value="todas">Todas</option><option value="activas">Activas</option><option value="inactivas">Inactivas</option>
            </select>
          </div>
          <p className="bot-ia-faq-count">{filtered.length} de {faqs.length} preguntas · {faqs.filter(f => f.activa).length} activas</p>
          {loadingFaq ? <p className="bot-ia-loading"><RefreshCw size={17} className="bot-ia-spin" /> Cargando preguntas…</p> : filtered.length === 0 ? (
            <p className="bot-ia-empty">No hay preguntas que coincidan con los filtros.</p>
          ) : (
            <div className="bot-ia-faq-list">
              {filtered.map(faq => <article className="bot-ia-faq" key={faq.id}>
                <div className="bot-ia-faq-heading">
                  <div><span className="bot-ia-category">{faq.categoria}</span><span className={faq.activa ? "bot-ia-state active" : "bot-ia-state"}>{faq.activa ? "Activa" : "Inactiva"}</span><span className="bot-ia-priority">Prioridad {faq.prioridad}</span></div>
                  <code>{faq.codigo}</code>
                </div>
                <h3>{faq.pregunta}</h3>
                <p className="bot-ia-faq-answer">{faq.respuesta}</p>
                <div className="bot-ia-faq-meta">
                  <span><strong>Palabras clave:</strong> {faq.palabras_clave.length ? faq.palabras_clave.join(", ") : "Sin palabras clave"}</span>
                  {faq.confirmacion_por_plan && <span className="bot-ia-check-plan">Requiere confirmar por plan</span>}
                </div>
                <div className="bot-ia-faq-actions">
                  <button type="button" className="bot-ia-button outline" onClick={() => startEdit(faq)} disabled={saving}><Pencil size={15} /> Editar</button>
                  <button type="button" className="bot-ia-button outline" onClick={() => void changeActive(faq)} disabled={saving}>
                    {faq.activa ? "Desactivar" : "Activar"}
                  </button>
                  <button type="button" className="bot-ia-button danger" onClick={() => void remove(faq)} disabled={saving}><Trash2 size={15} /> Eliminar</button>
                </div>
              </article>)}
            </div>
          )}
        </section>
      )}

      {formOpen && <div className="bot-ia-modal-backdrop" role="presentation" onMouseDown={event => {
        if (event.target === event.currentTarget && !saving) setFormOpen(false);
      }}>
        <div className="bot-ia-modal" role="dialog" aria-modal="true" aria-labelledby="bot-ia-form-title">
          <div className="bot-ia-modal-title"><div><h2 id="bot-ia-form-title">{editingId == null ? "Nueva pregunta frecuente" : "Editar pregunta frecuente"}</h2><p>Los cambios se reflejan en la base de conocimiento que utiliza el bot.</p></div><button type="button" aria-label="Cerrar" onClick={() => setFormOpen(false)} disabled={saving}><X size={21} /></button></div>
          {errorFaq && <ErrorBanner message={errorFaq} />}
          <form onSubmit={event => { event.preventDefault(); void save(); }}>
            <div className="bot-ia-form-grid">
              <label>Código único *
                <div className="bot-ia-input-with-action"><input required maxLength={100} pattern="[a-z0-9_]+" value={form.codigo} onChange={event => updateForm("codigo", event.target.value.toLowerCase())} placeholder="ej. horario_senderismo" />
                <button type="button" title="Generar código a partir de la pregunta" onClick={() => updateForm("codigo", slug(form.pregunta))}>Generar</button></div>
              </label>
              <label>Categoría *<input required value={form.categoria} onChange={event => updateForm("categoria", event.target.value)} placeholder="Ubicación, edades, horarios…" /></label>
            </div>
            <label>Pregunta del cliente *<textarea required rows={2} value={form.pregunta} onChange={event => updateForm("pregunta", event.target.value)} /></label>
            <label>Respuesta que debe conocer el bot *<textarea required minLength={15} rows={5} value={form.respuesta} onChange={event => updateForm("respuesta", event.target.value)} placeholder="Escribe información verificada, sin inventar tarifas u horarios." /></label>
            <label>Palabras clave <textarea rows={2} value={form.palabras} onChange={event => updateForm("palabras", event.target.value)} placeholder="separadas por coma: horario, hora de salida, duración" /><small>Ayudan a identificar preguntas relacionadas. Sepáralas con comas.</small></label>
            <div className="bot-ia-form-grid bot-ia-settings">
              <label>Prioridad <input type="number" min={0} max={32767} value={form.prioridad} onChange={event => updateForm("prioridad", Number(event.target.value))} /></label>
              <div className="bot-ia-checks">
                <label><input type="checkbox" checked={form.activa} onChange={event => updateForm("activa", event.target.checked)} /> Pregunta activa</label>
                <label><input type="checkbox" checked={form.confirmacion_por_plan} onChange={event => updateForm("confirmacion_por_plan", event.target.checked)} /> Requiere confirmación específica del plan</label>
              </div>
            </div>
            <div className="bot-ia-form-actions"><button type="button" className="bot-ia-button outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</button><button type="submit" className="bot-ia-button primary" disabled={saving}>{saving ? <RefreshCw size={16} className="bot-ia-spin" /> : <CheckCircle2 size={16} />}{saving ? "Guardando…" : "Guardar pregunta"}</button></div>
          </form>
        </div>
      </div>}
    </div>
  );
}
