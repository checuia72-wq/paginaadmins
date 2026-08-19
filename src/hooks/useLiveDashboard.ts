/**
 * useLiveDashboard
 *
 * Mantiene el dashboard actualizado mediante polling y Supabase Realtime.
 * Cada consulta se resuelve de forma independiente para que un fallo puntual
 * en una tabla no deje todo el resumen en cero.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getReservas,
  getPlanes,
  getClientes,
  getParticipantes,
} from "../services/api.service";
import { supabase } from "../lib/supabase";
import type { EtapaConversacionValue } from "../lib/etapas";

export type { EtapaConversacionValue };

export interface Reserva {
  id_reserva: number;
  telefono_cliente?: string;
  id_plan?: number;
  cantidad_personas?: number;
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

export interface Cliente {
  telefono: string;
  nombre?: string;
  email?: string;
  atencion_humana?: boolean;
  etapaconversacion?: EtapaConversacionValue | null;
}

export interface Participante {
  id_participante: number;
  nombre?: string;
  edad?: number;
  telefono_cliente?: string;
  telefono_participante?: string;
  tipo_documento?: string;
  numero_documento?: string;
  correo?: string;
  nacionalidad?: string;
  id_reserva?: number;
  id_plan?: number;
  nombre_plan?: string;
}

const DEFAULT_INTERVAL_MS = 30_000;

interface UseLiveDashboardOptions {
  intervalMs?: number;
  disableRealtime?: boolean;
}

interface UseLiveDashboardResult {
  reservas: Reserva[];
  planes: Plan[];
  clientes: Cliente[];
  participantes: Participante[];
  loading: boolean;
  refreshing: boolean;
  lastUpdated: Date | null;
  refresh: () => void;
}

export function useLiveDashboard({
  intervalMs = DEFAULT_INTERVAL_MS,
  disableRealtime = false,
}: UseLiveDashboardOptions = {}): UseLiveDashboardResult {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchAll = useCallback(async (silent = false) => {
    if (!mountedRef.current) return;

    if (silent) setRefreshing(true);

    try {
      const results = await Promise.allSettled([
        getReservas(),
        getPlanes(),
        getClientes(),
        getParticipantes(),
      ]);

      if (!mountedRef.current) return;

      const [reservasResult, planesResult, clientesResult, participantesResult] = results;
      let successfulFetch = false;

      if (reservasResult.status === "fulfilled") {
        setReservas(reservasResult.value as Reserva[]);
        successfulFetch = true;
      } else {
        console.error("[Dashboard] Error cargando reservas:", reservasResult.reason);
      }

      if (planesResult.status === "fulfilled") {
        setPlanes(planesResult.value as Plan[]);
        successfulFetch = true;
      } else {
        console.error("[Dashboard] Error cargando planes:", planesResult.reason);
      }

      if (clientesResult.status === "fulfilled") {
        setClientes(clientesResult.value as Cliente[]);
        successfulFetch = true;
      } else {
        console.error("[Dashboard] Error cargando clientes:", clientesResult.reason);
      }

      if (participantesResult.status === "fulfilled") {
        setParticipantes(participantesResult.value as Participante[]);
        successfulFetch = true;
      } else {
        console.error("[Dashboard] Error cargando participantes:", participantesResult.reason);
      }

      if (successfulFetch) setLastUpdated(new Date());
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchAll(false);
  }, [fetchAll]);

  useEffect(() => {
    if (!intervalMs || intervalMs <= 0) return;

    const id = setInterval(() => fetchAll(true), intervalMs);
    return () => clearInterval(id);
  }, [fetchAll, intervalMs]);

  useEffect(() => {
    if (disableRealtime || !supabase) return;
    const client = supabase;

    const channel = client
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
      client.removeChannel(channel);
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
