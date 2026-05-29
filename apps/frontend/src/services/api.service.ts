import { supabase } from "../lib/supabase";

const API_URL = import.meta.env.VITE_API_URL;

const getAuthHeaders = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("No hay sesión activa");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
};

const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
) => {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || "Error en la solicitud");
  }

  return text ? JSON.parse(text) : null;
};

/* =========================
   PLANES
========================= */

export const getPlanes = () => {
  return apiRequest("/planes");
};

export const createPlan = (data: any) => {
  return apiRequest("/planes", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const updatePlan = (id: number, data: any) => {
  return apiRequest(`/planes/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const deletePlan = (id: number) => {
  return apiRequest(`/planes/${id}`, {
    method: "DELETE",
  });
};

/* =========================
   CLIENTES
========================= */

export const getClientes = () => {
  return apiRequest("/clientes");
};

export const createCliente = (data: any) => {
  return apiRequest("/clientes", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const updateCliente = (telefono: string, data: any) => {
  return apiRequest(`/clientes/${telefono}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const deleteCliente = (telefono: string) => {
  return apiRequest(`/clientes/${telefono}`, {
    method: "DELETE",
  });
};

/* =========================
   RESERVAS
========================= */

export const getReservas = () => {
  return apiRequest("/reservas");
};

export const createReserva = (data: any) => {
  return apiRequest("/reservas", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const updateReserva = (id: number, data: any) => {
  return apiRequest(`/reservas/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const deleteReserva = (id: number) => {
  return apiRequest(`/reservas/${id}`, {
    method: "DELETE",
  });
};

/* =========================
   PARTICIPANTES
========================= */

export const getParticipantes = () => {
  return apiRequest("/participantes");
};

export const createParticipante = (data: any) => {
  return apiRequest("/participantes", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const updateParticipante = (id: number, data: any) => {
  return apiRequest(`/participantes/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const deleteParticipante = (id: number) => {
  return apiRequest(`/participantes/${id}`, {
    method: "DELETE",
  });
};