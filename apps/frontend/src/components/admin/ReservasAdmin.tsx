import { useEffect, useState } from "react";
import {
  getReservas,
  createReserva,
  updateReserva,
  deleteReserva,
  getClientes,
  getPlanes,
} from "../../services/api.service";

type Reserva = {
  id_reserva: number;
  fecha_solicitud: string;
  fecha_aprobacion: string | null;
  cantidad_personas: number;
  aprobado: boolean;

  telefono_cliente: string;
  atencion_humana?: boolean;

  id_plan: number;
  nombre_plan: string;
  precio_plan: number;
  fecha_plan: string;
  hora_plan: string;
  imagen_url: string | null;
};

type Cliente = {
  telefono: string;
  atencion_humana: boolean;
};

type Plan = {
  id_plan: number;
  nombre_plan: string;
  precio_plan: number;
};

type ReservaForm = {
  telefono_cliente: string;
  id_plan: string;
  cantidad_personas: string;
};

const initialForm: ReservaForm = {
  telefono_cliente: "",
  id_plan: "",
  cantidad_personas: "",
};

function ReservasAdmin() {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [form, setForm] = useState<ReservaForm>(initialForm);
  const [loading, setLoading] = useState(false);

  const cargarReservas = async () => {
    try {
      setLoading(true);
      const data = await getReservas();
      setReservas(data);
    } catch (error) {
      console.error(error);
      alert("Error al cargar las reservas");
    } finally {
      setLoading(false);
    }
  };

  const cargarDatosFormulario = async () => {
    try {
      const clientesData = await getClientes();
      const planesData = await getPlanes();

      setClientes(clientesData);
      setPlanes(planesData);
    } catch (error) {
      console.error(error);
      alert("Error al cargar clientes o planes");
    }
  };

  useEffect(() => {
    cargarReservas();
    cargarDatosFormulario();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const limpiarFormulario = () => {
    setForm(initialForm);
  };

  const handleCrearReserva = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.telefono_cliente || !form.id_plan || !form.cantidad_personas) {
      alert("Todos los campos son obligatorios");
      return;
    }

    try {
      await createReserva({
        telefono_cliente: form.telefono_cliente,
        id_plan: Number(form.id_plan),
        cantidad_personas: Number(form.cantidad_personas),
      });

      alert("Reserva creada correctamente");
      limpiarFormulario();
      cargarReservas();
    } catch (error) {
      console.error(error);
      alert("Error al crear la reserva");
    }
  };

  const formatearFecha = (fecha: string | null) => {
    if (!fecha) return "Pendiente";
    return new Date(fecha).toLocaleString("es-CO");
  };

  const formatearPrecio = (precio: number) => {
    return Number(precio).toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
    });
  };

  const handleAprobar = async (reserva: Reserva) => {
    try {
      await updateReserva(reserva.id_reserva, {
        aprobado: !reserva.aprobado,
      });

      alert(
        reserva.aprobado
          ? "Reserva marcada como pendiente"
          : "Reserva aprobada correctamente"
      );

      cargarReservas();
    } catch (error) {
      console.error(error);
      alert("Error al actualizar la reserva");
    }
  };

  const handleEliminar = async (id_reserva: number) => {
    const confirmar = confirm("¿Seguro que deseas eliminar esta reserva?");

    if (!confirmar) return;

    try {
      await deleteReserva(id_reserva);
      alert("Reserva eliminada correctamente");
      cargarReservas();
    } catch (error) {
      console.error(error);
      alert("No se pudo eliminar la reserva");
    }
  };

  return (
    <section>
      <h2>Gestión de reservas</h2>

      <form onSubmit={handleCrearReserva}>
        <h3>Crear nueva reserva</h3>

        <div>
          <label>Cliente</label>
          <select
            name="telefono_cliente"
            value={form.telefono_cliente}
            onChange={handleChange}
          >
            <option value="">Selecciona un cliente</option>

            {clientes.map((cliente) => (
              <option key={cliente.telefono} value={cliente.telefono}>
                {cliente.telefono}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Plan</label>
          <select
            name="id_plan"
            value={form.id_plan}
            onChange={handleChange}
          >
            <option value="">Selecciona un plan</option>

            {planes.map((plan) => (
              <option key={plan.id_plan} value={plan.id_plan}>
                {plan.nombre_plan} - {formatearPrecio(plan.precio_plan)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Cantidad de personas</label>
          <input
            type="number"
            name="cantidad_personas"
            value={form.cantidad_personas}
            onChange={handleChange}
            min="1"
            placeholder="Ej. 2"
          />
        </div>

        <button type="submit">Crear reserva</button>
      </form>

      <hr />

      <h3>Reservas registradas</h3>

      {loading ? (
        <p>Cargando reservas...</p>
      ) : reservas.length === 0 ? (
        <p>No hay reservas registradas.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Teléfono</th>
              <th>Atención humana</th>
              <th>Plan</th>
              <th>Precio</th>
              <th>Fecha del plan</th>
              <th>Hora</th>
              <th>Personas</th>
              <th>Solicitud</th>
              <th>Aprobación</th>
              <th>Estado</th>
              <th>Imagen</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {reservas.map((reserva) => (
              <tr key={reserva.id_reserva}>
                <td>{reserva.id_reserva}</td>
                <td>{reserva.telefono_cliente}</td>
                <td>{reserva.atencion_humana ? "Sí" : "No"}</td>
                <td>{reserva.nombre_plan}</td>
                <td>{formatearPrecio(reserva.precio_plan)}</td>

                <td>
                  {reserva.fecha_plan
                    ? new Date(reserva.fecha_plan).toLocaleDateString("es-CO")
                    : "Sin fecha"}
                </td>

                <td>{reserva.hora_plan || "Sin hora"}</td>
                <td>{reserva.cantidad_personas}</td>
                <td>{formatearFecha(reserva.fecha_solicitud)}</td>
                <td>{formatearFecha(reserva.fecha_aprobacion)}</td>
                <td>{reserva.aprobado ? "Aprobada" : "Pendiente"}</td>

                <td>
                  {reserva.imagen_url ? (
                    <img
                      src={reserva.imagen_url}
                      alt={reserva.nombre_plan}
                      width="70"
                    />
                  ) : (
                    "Sin imagen"
                  )}
                </td>

                <td>
                  <button onClick={() => handleAprobar(reserva)}>
                    {reserva.aprobado ? "Marcar pendiente" : "Aprobar"}
                  </button>

                  <button onClick={() => handleEliminar(reserva.id_reserva)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default ReservasAdmin;