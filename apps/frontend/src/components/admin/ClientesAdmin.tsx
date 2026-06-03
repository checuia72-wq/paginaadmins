import { useEffect, useState } from "react";
import {
  getClientes,
  createCliente,
  updateCliente,
  deleteCliente,
  getPlanes,
} from "../../services/api.service";
import {
  ETAPAS_CONVERSACION,
  type Cliente,
  type EtapaConversacion,
  type Plan,
} from "../../types";

type ClienteForm = {
  telefono: string;
  atencion_humana: boolean;
  etapaconversacion: EtapaConversacion;
  id_plan: string;
};

const initialForm: ClienteForm = {
  telefono: "",
  atencion_humana: false,
  etapaconversacion: "saludo",
  id_plan: "",
};

function ClientesAdmin() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [form, setForm] = useState<ClienteForm>(initialForm);
  const [editandoTelefono, setEditandoTelefono] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const cargarClientes = async () => {
    try {
      setLoading(true);
      const data = await getClientes();
      setClientes(data);
    } catch (error) {
      console.error(error);
      alert("Error al cargar los clientes");
    } finally {
      setLoading(false);
    }
  };

  const cargarPlanes = async () => {
    try {
      const data = await getPlanes();
      setPlanes(data);
    } catch (error) {
      console.error(error);
      alert("Error al cargar los planes");
    }
  };

  useEffect(() => {
    cargarClientes();
    cargarPlanes();
  }, []);

  const nombrePlan = (id_plan: number | null) => {
    if (id_plan == null) return "-";
    const plan = planes.find((p) => p.id_plan === id_plan);
    return plan ? plan.nombre_plan : `#${id_plan}`;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;

    setForm({
      ...form,
      [name]: type === "checkbox" ? target.checked : value,
    });
  };

  const limpiarFormulario = () => {
    setForm(initialForm);
    setEditandoTelefono(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.telefono.trim()) {
      alert("El teléfono es obligatorio");
      return;
    }

    const payload = {
      atencion_humana: form.atencion_humana,
      etapaconversacion: form.etapaconversacion,
      id_plan: form.id_plan ? Number(form.id_plan) : null,
    };

    try {
      if (editandoTelefono) {
        await updateCliente(editandoTelefono, payload);
        alert("Cliente actualizado correctamente");
      } else {
        await createCliente({
          telefono: form.telefono,
          ...payload,
        });
        alert("Cliente creado correctamente");
      }

      limpiarFormulario();
      cargarClientes();
    } catch (error) {
      console.error(error);
      alert("Error al guardar el cliente. Puede que el teléfono ya exista.");
    }
  };

  const handleEditar = (cliente: Cliente) => {
    setEditandoTelefono(cliente.telefono);

    setForm({
      telefono: cliente.telefono,
      atencion_humana: cliente.atencion_humana,
      etapaconversacion: cliente.etapaconversacion || "saludo",
      id_plan: cliente.id_plan != null ? String(cliente.id_plan) : "",
    });
  };

  const handleEliminar = async (telefono: string) => {
    const confirmar = confirm("¿Seguro que deseas eliminar este cliente?");

    if (!confirmar) return;

    try {
      await deleteCliente(telefono);
      alert("Cliente eliminado correctamente");
      cargarClientes();
    } catch (error) {
      console.error(error);
      alert(
        "No se pudo eliminar el cliente. Puede que tenga reservas asociadas."
      );
    }
  };

  return (
    <section>
      <h2>Gestión de clientes</h2>

      <form onSubmit={handleSubmit}>
        <h3>{editandoTelefono ? "Editar cliente" : "Crear nuevo cliente"}</h3>

        <div>
          <label>Teléfono</label>
          <input
            type="text"
            name="telefono"
            value={form.telefono}
            onChange={handleChange}
            placeholder="Ej. 3001234567"
            disabled={!!editandoTelefono}
          />
        </div>

        <div>
          <label>Etapa de conversación</label>
          <select
            name="etapaconversacion"
            value={form.etapaconversacion}
            onChange={handleChange}
          >
            {ETAPAS_CONVERSACION.map((etapa) => (
              <option key={etapa} value={etapa}>
                {etapa}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Plan asociado</label>
          <select name="id_plan" value={form.id_plan} onChange={handleChange}>
            <option value="">Sin plan</option>
            {planes.map((plan) => (
              <option key={plan.id_plan} value={plan.id_plan}>
                {plan.nombre_plan}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>
            <input
              type="checkbox"
              name="atencion_humana"
              checked={form.atencion_humana}
              onChange={handleChange}
            />
            Requiere atención humana
          </label>
        </div>

        <button type="submit">
          {editandoTelefono ? "Actualizar cliente" : "Crear cliente"}
        </button>

        {editandoTelefono && (
          <button type="button" onClick={limpiarFormulario}>
            Cancelar edición
          </button>
        )}
      </form>

      <hr />

      <h3>Clientes registrados</h3>

      {loading ? (
        <p>Cargando clientes...</p>
      ) : clientes.length === 0 ? (
        <p>No hay clientes registrados.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Teléfono</th>
              <th>Etapa</th>
              <th>Plan</th>
              <th>Atención humana</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {clientes.map((cliente) => (
              <tr key={cliente.telefono}>
                <td>{cliente.telefono}</td>
                <td>{cliente.etapaconversacion}</td>
                <td>{nombrePlan(cliente.id_plan)}</td>
                <td>{cliente.atencion_humana ? "Sí" : "No"}</td>
                <td>
                  <button onClick={() => handleEditar(cliente)}>Editar</button>

                  <button onClick={() => handleEliminar(cliente.telefono)}>
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

export default ClientesAdmin;