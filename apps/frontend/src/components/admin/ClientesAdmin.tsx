import { useEffect, useState } from "react";
import {
  getClientes,
  createCliente,
  updateCliente,
  deleteCliente,
} from "../../services/api.service";

type Cliente = {
  telefono: string;
  atencion_humana: boolean;
};

type ClienteForm = {
  telefono: string;
  atencion_humana: boolean;
};

const initialForm: ClienteForm = {
  telefono: "",
  atencion_humana: false,
};

function ClientesAdmin() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
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

  useEffect(() => {
    cargarClientes();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;

    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
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

    try {
      if (editandoTelefono) {
        await updateCliente(editandoTelefono, {
          atencion_humana: form.atencion_humana,
        });

        alert("Cliente actualizado correctamente");
      } else {
        await createCliente({
          telefono: form.telefono,
          atencion_humana: form.atencion_humana,
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
      alert("No se pudo eliminar el cliente. Puede que tenga reservas asociadas.");
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
              <th>Atención humana</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {clientes.map((cliente) => (
              <tr key={cliente.telefono}>
                <td>{cliente.telefono}</td>
                <td>{cliente.atencion_humana ? "Sí" : "No"}</td>
                <td>
                  <button onClick={() => handleEditar(cliente)}>
                    Editar
                  </button>

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