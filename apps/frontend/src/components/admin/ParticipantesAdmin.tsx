import { useEffect, useState } from "react";
import {
  getParticipantes,
  createParticipante,
  updateParticipante,
  deleteParticipante,
  getReservas,
} from "../../services/api.service";
import type { Participante, Reserva } from "../../types";

type ParticipanteForm = {
  id_reserva: string;
  nombre: string;
  edad: string;
  estatura: string;
  peso: string;
  telefono_cliente: string;
  telefono_participante: string;
};

const initialForm: ParticipanteForm = {
  id_reserva: "",
  nombre: "",
  edad: "",
  estatura: "",
  peso: "",
  telefono_cliente: "",
  telefono_participante: "",
};

function ParticipantesAdmin() {
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [form, setForm] = useState<ParticipanteForm>(initialForm);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const cargarParticipantes = async () => {
    try {
      setLoading(true);
      const data = await getParticipantes();
      setParticipantes(data);
    } catch (error) {
      console.error(error);
      alert("Error al cargar participantes");
    } finally {
      setLoading(false);
    }
  };

  const cargarReservas = async () => {
    try {
      const data = await getReservas();
      setReservas(data);
    } catch (error) {
      console.error(error);
      alert("Error al cargar reservas");
    }
  };

  useEffect(() => {
    cargarParticipantes();
    cargarReservas();
  }, []);

  // Teléfono del cliente de una reserva (viene del JOIN como telefono_cliente o telefono)
  const telefonoDeReserva = (id_reserva: number): string => {
    const reserva = reservas.find((r) => r.id_reserva === id_reserva);
    return reserva?.telefono_cliente ?? reserva?.telefono ?? "";
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    // Al elegir reserva, autocompletamos el teléfono del cliente
    if (name === "id_reserva") {
      const tel = value ? telefonoDeReserva(Number(value)) : "";
      setForm({
        ...form,
        id_reserva: value,
        telefono_cliente: tel,
      });
      return;
    }

    setForm({
      ...form,
      [name]: value,
    });
  };

  const limpiarFormulario = () => {
    setForm(initialForm);
    setEditandoId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.nombre.trim()) {
      alert("El nombre es obligatorio");
      return;
    }

    if (!form.id_reserva) {
      alert("Debes seleccionar una reserva");
      return;
    }

    const payload = {
      id_reserva: Number(form.id_reserva),
      nombre: form.nombre,
      edad: form.edad ? Number(form.edad) : null,
      estatura: form.estatura ? Number(form.estatura) : null,
      peso: form.peso ? Number(form.peso) : null,
      telefono_cliente: form.telefono_cliente || null,
      telefono_participante: form.telefono_participante || null,
    };

    try {
      if (editandoId) {
        await updateParticipante(editandoId, payload);
        alert("Participante actualizado correctamente");
      } else {
        await createParticipante(payload);
        alert("Participante creado correctamente");
      }

      limpiarFormulario();
      cargarParticipantes();
    } catch (error) {
      console.error(error);
      alert("Error al guardar participante");
    }
  };

  const handleEditar = (participante: Participante) => {
    setEditandoId(participante.id_participante);

    setForm({
      id_reserva: String(participante.id_reserva),
      nombre: participante.nombre,
      edad: participante.edad?.toString() || "",
      estatura: participante.estatura?.toString() || "",
      peso: participante.peso?.toString() || "",
      telefono_cliente: participante.telefono_cliente || "",
      telefono_participante: participante.telefono_participante || "",
    });
  };

  const handleEliminar = async (id: number) => {
    const confirmar = confirm(
      "¿Seguro que deseas eliminar este participante?"
    );

    if (!confirmar) return;

    try {
      await deleteParticipante(id);
      alert("Participante eliminado correctamente");
      cargarParticipantes();
    } catch (error) {
      console.error(error);
      alert("No se pudo eliminar el participante");
    }
  };

  return (
    <section>
      <h2>Gestión de participantes</h2>

      <form onSubmit={handleSubmit}>
        <h3>{editandoId ? "Editar participante" : "Crear participante"}</h3>

        <div>
          <label>Reserva</label>
          <select
            name="id_reserva"
            value={form.id_reserva}
            onChange={handleChange}
          >
            <option value="">Seleccionar reserva</option>
            {reservas.map((reserva) => (
              <option key={reserva.id_reserva} value={reserva.id_reserva}>
                #{reserva.id_reserva} - {reserva.nombre_plan ?? "Plan"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Nombre</label>
          <input
            type="text"
            name="nombre"
            value={form.nombre}
            onChange={handleChange}
            placeholder="Nombre participante"
          />
        </div>

        <div>
          <label>Edad</label>
          <input
            type="number"
            name="edad"
            value={form.edad}
            onChange={handleChange}
            placeholder="Edad"
          />
        </div>

        <div>
          <label>Estatura</label>
          <input
            type="number"
            step="0.01"
            name="estatura"
            value={form.estatura}
            onChange={handleChange}
            placeholder="Ej. 1.72"
          />
        </div>

        <div>
          <label>Peso</label>
          <input
            type="number"
            step="0.01"
            name="peso"
            value={form.peso}
            onChange={handleChange}
            placeholder="Ej. 70.5"
          />
        </div>

        <div>
          <label>Teléfono del cliente</label>
          <input
            type="text"
            name="telefono_cliente"
            value={form.telefono_cliente}
            onChange={handleChange}
            placeholder="Se autocompleta al elegir la reserva"
          />
        </div>

        <div>
          <label>Teléfono del participante</label>
          <input
            type="text"
            name="telefono_participante"
            value={form.telefono_participante}
            onChange={handleChange}
            placeholder="Ej. 3009876543"
          />
        </div>

        <button type="submit">
          {editandoId ? "Actualizar participante" : "Crear participante"}
        </button>

        {editandoId && (
          <button type="button" onClick={limpiarFormulario}>
            Cancelar edición
          </button>
        )}
      </form>

      <hr />

      <h3>Participantes registrados</h3>

      {loading ? (
        <p>Cargando participantes...</p>
      ) : participantes.length === 0 ? (
        <p>No hay participantes registrados.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Reserva</th>
              <th>Nombre</th>
              <th>Edad</th>
              <th>Estatura</th>
              <th>Peso</th>
              <th>Tel. cliente</th>
              <th>Tel. participante</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {participantes.map((participante) => (
              <tr key={participante.id_participante}>
                <td>{participante.id_participante}</td>
                <td>{participante.id_reserva}</td>
                <td>{participante.nombre}</td>
                <td>{participante.edad ?? "-"}</td>
                <td>{participante.estatura ?? "-"}</td>
                <td>{participante.peso ?? "-"}</td>
                <td>{participante.telefono_cliente ?? "-"}</td>
                <td>{participante.telefono_participante ?? "-"}</td>
                <td>
                  <button onClick={() => handleEditar(participante)}>
                    Editar
                  </button>

                  <button
                    onClick={() =>
                      handleEliminar(participante.id_participante)
                    }
                  >
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

export default ParticipantesAdmin;