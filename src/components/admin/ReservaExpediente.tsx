import { useEffect, useState } from "react";
import { CircleDollarSign, ClipboardList, CreditCard, Gift, Plus, Trash2, UserRound, Utensils } from "lucide-react";
import { getAdicionales, type Adicional, type ReservaAdicionalInput } from "../../services/adicional.service";
import type { ManagedUser } from "../../services/adminUsers.service";
import { desgloseEdicionReserva, impactoAdicionalesGuardados, type DetalleCompletoReserva } from "../../services/reservaDetalleCompleto.service";
import "../../styles/reserva-expediente.css";

const money = (amount: number | null | undefined) => "$" + Number(amount || 0).toLocaleString("es-CO");
const when = (v?: string | null) => v ? String(v).replace("T", " ").slice(0, 16) : "Sin registrar";
const txt = (v: unknown) => v == null || v === "" ? "Sin registrar" : String(v);

type Props = {
  detalle: DetalleCompletoReserva | null;
  loading?: boolean;
  editing?: boolean;
  extrasDirty?: boolean;
  cantidad: number;
  precioUnitario: number;
  totalActual: number;
  extras?: ReservaAdicionalInput[];
  onExtrasChange?: (value: ReservaAdicionalInput[]) => void;
  observacion?: string;
  onObservacionChange?: (value: string) => void;
  guias?: ManagedUser[];
  guiaSeleccionada?: string;
  onGuiaChange?: (userId: string) => void;
  refrigerio?: boolean;
  onRefrigerioChange?: (value: boolean) => void;
};

export default function ReservaExpediente({
  detalle, loading = false, editing = false, extrasDirty = false, cantidad, precioUnitario, totalActual,
  extras, onExtrasChange, observacion, onObservacionChange,
  guias = [], guiaSeleccionada, onGuiaChange, refrigerio, onRefrigerioChange,
}: Props) {
  const [catalogo, setCatalogo] = useState<Adicional[]>([]);
  const [catalogoSeleccionado, setCatalogoSeleccionado] = useState("");
  const [catalogoError, setCatalogoError] = useState("");
  useEffect(() => {
    if (!editing) return;
    let active = true;
    getAdicionales(true).then(items => {
      if (active) { setCatalogo(items); setCatalogoError(""); }
    }).catch(error => {
      if (active) setCatalogoError(error instanceof Error ? error.message : "No se pudo obtener el catálogo.");
    });
    return () => { active = false; };
  }, [editing]);

  if (loading) return <div className="rv-xp-loading">Cargando datos completos de la reserva…</div>;
  if (!detalle) return <div className="rv-xp-loading">No se pudieron cargar los datos adicionales. No se realizarán cambios financieros.</div>;

  const reserva = detalle.reserva;
  const filas = editing ? (extras ?? detalle.adicionales) : detalle.adicionales;
  const separacion = desgloseEdicionReserva(Number(reserva.valor_total || 0),
    Number(reserva.precio_unitario || precioUnitario), Number(reserva.cantidad_personas || cantidad),
    detalle.adicionales, detalle.planesAdicionales);
  const adicionalesTotal = impactoAdicionalesGuardados(filas);
  const totalCalculado = editing && extrasDirty
    ? separacion.base + separacion.planesExtra + adicionalesTotal
    : Number(reserva.valor_total || totalActual);
  const abono = Number(reserva.valor_abonado || 0);
  const saldoPagado = Number(reserva.valor_saldo_pagado || 0);
  const pendiente = Math.max(0, totalCalculado - abono - saldoPagado);
  const alter = (index: number, patch: Partial<ReservaAdicionalInput>) => {
    if (!onExtrasChange) return;
    const result = filas.map((item, i) => {
      if (index !== i) return { ...item };
      const next = { ...item, ...patch };
      const qty = next.tipo_cobro === "por_reserva" ? 1
        : Math.min(Math.max(1, Number(cantidad) || 1), Math.max(1, Math.floor(Number(next.cantidad_aplicada) || 1)));
      return { ...next, cantidad_aplicada: qty,
        impacto_total: next.tipo_movimiento === "agregado" ? Number(next.precio_unitario || 0) * qty : Number(item.impacto_total || 0) };
    });
    onExtrasChange(result);
  };
  const anexarCatalogo = () => {
    if (!onExtrasChange) return;
    const item = catalogo.find(x => String(x.id_adicional) === catalogoSeleccionado);
    if (!item) return;
    const entry: ReservaAdicionalInput = {
      id_adicional: item.id_adicional,
      codigo_adicional: item.codigo,
      nombre_adicional: item.nombre,
      tipo_cobro: item.tipo_cobro,
      tipo_movimiento: "agregado",
      precio_unitario: Number(item.precio || 0),
      cantidad_aplicada: 1,
      impacto_total: Number(item.precio || 0),
    };
    onExtrasChange([...filas, entry]);
    setCatalogoSeleccionado("");
  };
  const anexarTemporal = () => {
    onExtrasChange?.([...filas, {
      id_adicional: null, codigo_adicional: "temporal_reserva",
      nombre_adicional: "", descripcion_temporal: "", tipo_cobro: "por_persona",
      tipo_movimiento: "agregado", precio_unitario: 0, cantidad_aplicada: 1, impacto_total: 0,
    }]);
  };
  const contratado = Number(reserva.precio_unitario || precioUnitario) * Math.max(1, Number(reserva.cantidad_personas || cantidad));
  const precioBaseMostrar = editing ? separacion.base : (separacion.base || contratado);
  const planExtras = detalle.planesAdicionales.filter(p => p.activo);

  return (
    <div className="rv-xp">
      <section className="rv-xp-section">
        <h3><CircleDollarSign size={17}/> Desglose económico de la reserva</h3>
        <div className="rv-xp-finance-grid">
          <div><span>Precio del plan por persona</span><strong>{money(precioUnitario || reserva.precio_unitario)}</strong></div>
          <div><span>Personas</span><strong>{cantidad}</strong></div>
          <div><span>Plan contratado y ajustes anteriores</span><strong>{money(precioBaseMostrar)}</strong></div>
          <div><span>Adicionales seleccionados</span><strong>{money(adicionalesTotal)}</strong></div>
          {separacion.planesExtra > 0 && <div><span>Otros planes adicionales</span><strong>{money(separacion.planesExtra)}</strong></div>}
        </div>
        <div className="rv-xp-total">
          <span>{editing && extrasDirty ? "Total estimado después de guardar" : "Total actual de la reserva"}</span>
          <strong>{money(totalCalculado)}</strong>
        </div>
        {editing && detalle.adicionales.length > 0 && separacion.adicionalesCobrados < separacion.adicionalesHistoricos &&
          <p className="rv-xp-hint">Algunos adicionales antiguos aparecen registrados pero no cobrados en el total original. Solo se aplicará el nuevo desglose cuando modifiques los adicionales.</p>}
        <div className="rv-xp-finance-grid rv-xp-finance-grid-small">
          <div><span>Abonos registrados</span><strong>{money(abono)}</strong></div>
          <div><span>Saldos pagados</span><strong>{money(saldoPagado)}</strong></div>
          <div><span>Saldo pendiente</span><strong>{money(pendiente)}</strong></div>
        </div>
      </section>

      <section className="rv-xp-section">
        <h3><Gift size={17}/> Adicionales y servicios incluidos</h3>
        {filas.length === 0 && <p className="rv-xp-muted">Esta reserva no tiene adicionales registrados.</p>}
        <div className="rv-xp-extra-list">
          {filas.map((item,index) => {
            const canEdit = editing && item.tipo_movimiento === "agregado" && !!onExtrasChange;
            return (
              <div className="rv-xp-extra-row" key={String((item as any).id_reserva_adicional ?? "extra") + "-" + index}>
                {canEdit ? (
                  <>
                    <div className="rv-xp-extra-edit-main">
                      <label>Servicio</label>
                      <input value={item.nombre_adicional} placeholder="Nombre del adicional" onChange={e=>alter(index,{nombre_adicional:e.target.value})}/>
                      {item.id_adicional == null && <>
                        <label>Qué incluye / observaciones</label>
                        <input value={item.descripcion_temporal || ""} placeholder="Descripción del servicio" onChange={e=>alter(index,{descripcion_temporal:e.target.value})}/>
                      </>}
                    </div>
                    <div className="rv-xp-extra-numbers">
                      <label>Unidad</label>
                      <select value={item.tipo_cobro} onChange={e=>alter(index,{tipo_cobro:e.target.value as ReservaAdicionalInput["tipo_cobro"]})}>
                        <option value="por_persona">Por persona</option><option value="por_reserva">Por reserva</option>
                      </select>
                      <label>Cantidad</label>
                      <input type="number" min={1} max={item.tipo_cobro==="por_persona"?cantidad:1} value={item.cantidad_aplicada}
                        onChange={e=>alter(index,{cantidad_aplicada:Number(e.target.value)})}/>
                      <label>Precio unitario</label>
                      <input type="number" min={0} value={item.precio_unitario} onChange={e=>alter(index,{precio_unitario:Number(e.target.value)})}/>
                    </div>
                    <strong className="rv-xp-extra-amount">{money(item.impacto_total)}</strong>
                    <button className="rv-xp-remove" type="button" title="Quitar adicional" onClick={()=>onExtrasChange?.(filas.filter((_,i)=>i!==index))}><Trash2 size={17}/></button>
                  </>
                ) : (
                  <>
                    <div className="rv-xp-extra-info"><strong>{txt(item.nombre_adicional)}</strong>
                      <small>{item.tipo_movimiento === "incluido" ? "Incluido en el plan" :
                        item.tipo_movimiento === "retirado" ? "Retirado del plan" : "Adicional"}
                        {" · "}{item.cantidad_aplicada} × {money(item.precio_unitario)}
                        {item.descripcion_temporal ? " · " + item.descripcion_temporal : ""}
                      </small></div>
                    <span className={"rv-xp-extra-pill "+(item.tipo_movimiento==="incluido"?"rv-xp-included":"")}>
                      {item.tipo_movimiento === "incluido" ? "Incluido" : money(item.impacto_total)}
                    </span>
                  </>
                )}
              </div>
            );
          })}
          {planExtras.map(item=><div className="rv-xp-extra-row" key={"plan-extra-"+item.id_reserva_plan_adicional}>
            <div className="rv-xp-extra-info"><strong>{item.nombre}</strong>
              <small>Plan adicional · {item.cantidad_personas} persona(s) · {money(item.precio_unitario)} unitario</small>
            </div><span className="rv-xp-extra-pill">{money(item.impacto_total)}</span>
          </div>)}
        </div>
        {editing && onExtrasChange && <div className="rv-xp-add-actions">
          <select value={catalogoSeleccionado} onChange={e=>setCatalogoSeleccionado(e.target.value)} aria-label="Seleccionar adicional del catálogo">
            <option value="">Selecciona un servicio del catálogo…</option>
            {catalogo.filter(item=>!filas.some(f=>f.id_adicional===item.id_adicional)).map(item=>
              <option key={item.id_adicional} value={item.id_adicional}>{item.nombre} · {money(item.precio)}</option>)}
          </select>
          <button type="button" disabled={!catalogoSeleccionado} onClick={anexarCatalogo}><Plus size={15}/> Agregar</button>
          <button type="button" onClick={anexarTemporal}><Plus size={15}/> Adicional temporal</button>
          {catalogoError && <small className="rv-xp-error">{catalogoError}</small>}
        </div>}
      </section>

      <section className="rv-xp-section">
        <h3><CreditCard size={17}/> Abonos y movimientos de pago</h3>
        {detalle.pagos.length === 0
          ? <p className="rv-xp-muted">{abono > 0 ? "Abono acumulado registrado: " + money(abono) : "No hay pagos registrados."}</p>
          : <div className="rv-xp-payment-list">{detalle.pagos.map(p=><div key={p.id_pago ?? (p.tipo_pago+"-"+p.fecha_pago)} className="rv-xp-payment">
              <div><strong>{p.tipo_pago === "abono" ? "Abono" : "Pago de saldo"}</strong>
                <small>{txt(p.medio_pago)} · {when(p.fecha_abono || p.fecha_pago)}</small>
                {p.observacion && <small>{p.observacion}</small>}</div><strong>{money(p.monto)}</strong>
            </div>)}</div>}
        {editing && <p className="rv-xp-hint">Los pagos históricos se conservan. Para corregir recaudos utiliza las funciones de pagos o Control Operativo; editar esta reserva no eliminará movimientos.</p>}
      </section>

      <section className="rv-xp-section">
        <h3><ClipboardList size={17}/> Datos operativos y del PDF</h3>
        <div className="rv-xp-info-grid">
          <div><span>Código operativo (CH)</span><b>{txt(detalle.codigoOperativo)}</b></div>
          <div><span>Estado</span><b>{reserva.aprobado ? "Aprobada" : "Pendiente"}</b></div>
          <div><span>Fecha de solicitud</span><b>{when(reserva.fecha_solicitud)}</b></div>
          <div><span>Fecha de aprobación</span><b>{when(reserva.fecha_aprobacion)}</b></div>
          <div><span>Guía acompañante</span><b>{txt(reserva.guia_username)}</b></div>
          <div><span>Teléfono del guía</span><b>{txt(reserva.guia_telefono)}</b></div>
          <div><span>Almuerzo incluido</span><b>{reserva.incluye_almuerzo ? "Sí" : "No"}</b></div>
          <div><span>Restaurante</span><b>{txt(reserva.restaurante)}</b></div>
          <div><span>Restaurante de almuerzo adicional</span><b>{txt(reserva.restaurante_almuerzo_adicional)}</b></div>
          <div><span>Refrigerio</span><b>{reserva.refrigerio ? "Incluido" : "No incluido"}</b></div>
          <div><span>Estado operativo</span><b>{txt(reserva.estado_operativo)}</b></div>
          <div><span>Referencia del abono</span><b>{txt(reserva.referencia_pago_abono)}</b></div>
          <div><span>Medio de pago (abono)</span><b>{txt(reserva.metodo_pago_abono)}</b></div>
          <div><span>Medio de pago (saldo)</span><b>{txt(reserva.metodo_pago_saldo)}</b></div>
          <div><span>Observación operativa</span><b>{txt(reserva.motivo_estado_operativo)}</b></div>
          <div><span>Aprobó</span><b>{txt(reserva.aprobado_por_username)}</b></div>
        </div>
        {Array.isArray(reserva.seleccion_almuerzos) && reserva.seleccion_almuerzos.length > 0 && (
          <div className="rv-xp-lunch"><Utensils size={15}/> Selección de almuerzos: {reserva.seleccion_almuerzos.map((x: any, i: number)=>"Persona "+(x.numero??i+1)+": "+(detalle.nombresMenu[Number(x.id_menu)] || (x.id_menu ? "Menú #" + x.id_menu : "Sin plato asignado"))).join(" · ")}</div>
        )}
      </section>

      {editing && <section className="rv-xp-section">
        <h3><UserRound size={17}/> Ajustes para el nuevo PDF</h3>
        <div className="rv-xp-info-grid">
          <div className="rv-xp-edit-field">
            <label htmlFor="rv-xp-guia">Guía acompañante</label>
            <select id="rv-xp-guia" value={guiaSeleccionada ?? String(reserva.guia_user_id ?? "")}
              onChange={e=>onGuiaChange?.(e.target.value)}>
              <option value="">Selecciona un guía</option>
              {guiaSeleccionada && !guias.some(g=>g.user_id===guiaSeleccionada) &&
                <option value={guiaSeleccionada}>{reserva.guia_username || "Guía registrado actualmente"}</option>}
              {guias.filter(g=>g.telefono).map(g=><option key={g.user_id} value={g.user_id}>
                {g.username} · {g.telefono}
              </option>)}
            </select>
          </div>
          <div className="rv-xp-edit-field">
            <label>Refrigerio</label>
            <label className="rv-xp-checkbox"><input type="checkbox"
              checked={refrigerio ?? Boolean(reserva.refrigerio)}
              onChange={e=>onRefrigerioChange?.(e.target.checked)}/> Incluido en la experiencia</label>
          </div>
        </div>
        <p className="rv-xp-hint">El CH, los restaurantes y los pagos históricos se mantienen sin cambios automáticamente para proteger el control operativo.</p>
      </section>}
      <section className="rv-xp-section">
        <h3><UserRound size={17}/> Observaciones de la reserva</h3>
        {editing ? <textarea className="rv-xp-notes" value={observacion || ""} onChange={e=>onObservacionChange?.(e.target.value)}
          rows={3} placeholder="Observaciones que debe conservar el PDF y Control Operativo"/> :
          <p className="rv-xp-observation">{txt(reserva.observacion)}</p>}
      </section>
    </div>
  );
}
