import { create } from "zustand";
import type { ReservaStatus } from "./types";

export type FechaFiltroCampo = "fecha_solicitud" | "fecha_plan";

type ReservasUiState = {
  search: string;
  status: ReservaStatus | "all";
  fechaCampo: FechaFiltroCampo;
  fechaDesde: string;
  fechaHasta: string;
  page: number;
  pageSize: 10 | 25 | 50;

  setSearch: (value: string) => void;
  setStatus: (value: ReservasUiState["status"]) => void;
  setFechaCampo: (value: FechaFiltroCampo) => void;
  setFechaDesde: (value: string) => void;
  setFechaHasta: (value: string) => void;
  setPage: (value: number) => void;
  setPageSize: (value: ReservasUiState["pageSize"]) => void;
  resetFilters: () => void;
};

export const useReservasUiStore = create<ReservasUiState>((set) => ({
  search: "",
  status: "all",
  fechaCampo: "fecha_solicitud",
  fechaDesde: "",
  fechaHasta: "",
  page: 1,
  pageSize: 10,

  setSearch: (value) => set({ search: value, page: 1 }),
  setStatus: (value) => set({ status: value, page: 1 }),
  setFechaCampo: (value) => set({ fechaCampo: value, page: 1 }),
  setFechaDesde: (value) => set({ fechaDesde: value, page: 1 }),
  setFechaHasta: (value) => set({ fechaHasta: value, page: 1 }),
  setPage: (value) => set({ page: value }),
  setPageSize: (value) => set({ pageSize: value, page: 1 }),
  resetFilters: () =>
    set({
      search: "",
      status: "all",
      fechaCampo: "fecha_solicitud",
      fechaDesde: "",
      fechaHasta: "",
      page: 1,
      pageSize: 10,
    }),
}));

