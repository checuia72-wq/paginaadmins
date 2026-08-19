import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createReserva,
  deleteReserva,
  getClientes,
  getPlanes,
  getReservas,
  updateReserva,
} from "../../services/api.service";
import { queryClient } from "../../lib/queryClient";
import type { ReservaApi } from "./types";

export const reservasKeys = {
  all: ["reservas"] as const,
  list: () => [...reservasKeys.all, "list"] as const,
  clientes: () => [...reservasKeys.all, "clientes"] as const,
  planes: () => [...reservasKeys.all, "planes"] as const,
};

export type ClienteApi = {
  telefono: string;
  nombre?: string | null;
};

export type PlanApi = {
  id_plan: number;
  nombre_plan: string;
  precio_plan: number;
};

export function useReservasQuery() {
  return useQuery({
    queryKey: reservasKeys.list(),
    queryFn: async () => (await getReservas()) as ReservaApi[],
  });
}

export function useClientesQuery() {
  return useQuery({
    queryKey: reservasKeys.clientes(),
    queryFn: async () => (await getClientes()) as ClienteApi[],
  });
}

export function usePlanesQuery() {
  return useQuery({
    queryKey: reservasKeys.planes(),
    queryFn: async () => (await getPlanes()) as PlanApi[],
  });
}

export function useCreateReservaMutation() {
  return useMutation({
    mutationFn: async (data: {
      telefono_cliente: string;
      id_plan: number;
      cantidad_personas: number;
      aprobado?: boolean;
    }) => createReserva(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reservasKeys.list() });
    },
  });
}

export function useUpdateReservaMutation() {
  return useMutation({
    mutationFn: async (params: { id: number; data: any }) =>
      updateReserva(params.id, params.data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reservasKeys.list() });
    },
  });
}

export function useDeleteReservaMutation() {
  return useMutation({
    mutationFn: async (id: number) => deleteReserva(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reservasKeys.list() });
    },
  });
}

