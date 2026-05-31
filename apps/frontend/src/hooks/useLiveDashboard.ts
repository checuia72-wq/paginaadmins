/**
 * useLiveDashboard
 *
 * Combina dos estrategias para mantener el dashboard siempre fresco:
 *
 * 1. POLLING — recarga todos los datos cada `intervalMs` ms (default 30 s).
 *    Funciona aunque Realtime esté desactivado en el proyecto de Supabase.
 *
 * 2. SUPABASE REALTIME — suscripción a cambios en las tablas principales.
 *    Cuando llega un evento INSERT / UPDATE / DELETE dispara un refetch
 *    inmediato, sin esperar al siguiente tick del polling.
 *
 * Uso:
 *   const { reservas, planes, clientes, participantes, loading, lastUpdated } =
 *     useLiveDashboard();
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getReservas,
  getPlanes,
  getClientes,
  getParticipantes,
} from "../services/api.service";
import { supabase } from "../lib/supabase";

/* ── tipos re-exportados para que OverviewPage los importe de aquí ── */
export interface Reserva {
  id_reserva: number;
  telefono_cliente?: string;
  id_plan?: number;
  fecha_solicitud?: string;
  fecha_aprobacion?: string;
  aprobado?: boolean;
  plan?: { nombre_plan?: string };
  nombre_plan?: string;
}

export interface Plan {
  id_plan: number;
  nombre_plan: string;
  precio_plan?: number;
  precio?: number;
  descripcion_basica?: string;
  fecha_plan?: string;
  hora_plan?: string;
}

export type EtapaConversacion =
  | "saludo"
  | "descripcionincluye"
  | "como_reservar"
  | "por_confirmar"
  | "confirmada"
  | null;

export interface Cliente {
  telefono: string;
  nombre?: string;
  email?: string;
  atencion_humana?: boolean;
  etapaconversacion?: EtapaConversacion;
}

export interface Participante {
  id_participante: number;
  nombre?: string;
  edad?: number;
  id_reserva?: number;
  id_plan?: number;
  nombre_plan?: string;
}

/* ── tablas que se monitorizan en Realtime ── */
const WATCHED_TABLES = ["reserva", "plan", "cliente", "participante"] as const;

/* ── intervalo de polling por defecto: 30 segundos ── */
const DEFAULT_INTERVAL_MS = 30_000;

interface UseLiveDashboardOptions {
  /** Intervalo de polling en ms. Default: 30000 (30 s). */
  intervalMs?: number;
  /** Deshabilitar Supabase Realtime (solo polling). */
  disableRealtime?: boolean;
}

interface UseLiveDashboardResult {
  reservas: Reserva[];
  planes: Plan[];
  clientes: Cliente[];
  participantes: Participante[];
  /** true solo durante la carga inicial, no en refetches silenciosos */
  loading: boolean;
  /** true mientras un refetch silencioso está en curso */
  refreshing: boolean;
  /** fecha/hora del último fetch exitoso */
  lastUpdated: Date | null;
  /** fuerza un refetch manual */
  refresh: () => void;
}

export function useLiveDashboard({
  intervalMs = DEFAULT_INTERVAL_MS,
  disableRealtime = false,
}: UseLiveDashboardOptions = {}): UseLiveDashboardResult {
  const [reservas,      setReservas]      = useState<Reserva[]>([]);
  const [planes,        setPlanes]        = useState<Plan[]>([]);
  const [clientes,      setClientes]      = useState<Cliente[]>([]);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [lastUpdated,   setLastUpdated]   = useState<Date | null>(null);

  // Ref para evitar actualizar estado si el componente ya se desmontó
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── fetch central ────────────────────────────────────────────
  const fetchAll = useCallback(async (silent = false) => {
    if (!mountedRef.current) return;

    if (silent) setRefreshing(true);

    try {
      const [r, pl, cl, pa] = await Promise.all([
        getReservas(),
        getPlanes(),
        getClientes(),
        getParticipantes(),
      ]);

      if (!mountedRef.current) return;

      setReservas(r      as Reserva[]);
      setPlanes(pl       as Plan[]);
      setClientes(cl     as Cliente[]);
      setParticipantes(pa as Participante[]);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("[useLiveDashboard] fetch error:", err);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // ── carga inicial ─────────────────────────────────────────────
  useEffect(() => {
    fetchAll(false);
  }, [fetchAll]);

  // ── polling ───────────────────────────────────────────────────
  useEffect(() => {
    if (!intervalMs || intervalMs <= 0) return;

    const id = setInterval(() => fetchAll(true), intervalMs);
    return () => clearInterval(id);
  }, [fetchAll, intervalMs]);

  // ── supabase realtime ─────────────────────────────────────────
  useEffect(() => {
    if (disableRealtime || !supabase) return;

    // Un canal único con una suscripción por tabla
    const channel = supabase
      .channel("dashboard-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reserva" },
        () => fetchAll(true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "plan" },
        () => fetchAll(true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cliente" },
        () => fetchAll(true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participante" },
        () => fetchAll(true)
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[useLiveDashboard] Realtime conectado ✓");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [disableRealtime, fetchAll]);

  return {
    reservas,
    planes,
    clientes,
    participantes,
    loading,
    refreshing,
    lastUpdated,
    refresh: () => fetchAll(true),
  };
}