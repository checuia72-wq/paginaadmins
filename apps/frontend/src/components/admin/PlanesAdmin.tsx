import { useEffect, useState } from "react";
import {
  getPlanes,
  createPlan,
  updatePlan,
  deletePlan,
} from "../../services/api.service";
import type { Plan } from "../../types";

type PlanForm = {
  nombre_plan: string;
  precio_plan: string;
  descripcion_basica: string;
  descripcion_detallada: string;
  fecha_plan: string;
  hora_plan: string;
  imagen_url: string;
  numero_plan: string;
};

const initialForm: PlanForm = {
  nombre_plan: "",
  precio_plan: "",
  descripcion_basica: "",
  descripcion_detallada: "",
  fecha_plan: "",
  hora_plan: "",
  imagen_url: "",
  numero_plan: "",
};

function PlanesAdmin() {
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [form, setForm] = useState<PlanForm>(initialForm);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const formatCOP = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const cargarPlanes = async () => {
    try {
      setLoading(true);
      const data = await getPlanes();
      setPlanes(data);
    } catch (error) {
      console.error(error);
      alert("Error al cargar los planes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarPlanes();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const limpiarFormulario = () => {
    setForm(initialForm);
    setEditandoId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.nombre_plan || !form.precio_plan) {
      alert("El nombre del plan y el precio son obligatorios");
      return;
    }

    const payload = {
      nombre_plan: form.nombre_plan,
      precio_plan: Number(form.precio_plan),
      descripcion_basica: form.descripcion_basica || null,
      descripcion_detallada: form.descripcion_detallada || null,
      fecha_plan: form.fecha_plan || null,
      hora_plan: form.hora_plan || null,
      imagen_url: form.imagen_url || null,
      numero_plan: form.numero_plan ? Number(form.numero_plan) : null,
    };

    try {
      if (editandoId) {
        await updatePlan(editandoId, payload);
        alert("Plan actualizado correctamente");
      } else {
        await createPlan(payload);
        alert("Plan creado correctamente");
      }

      limpiarFormulario();
      cargarPlanes();
    } catch (error) {
      console.error(error);
      alert("Error al guardar el plan");
    }
  };

  const handleEditar = (plan: Plan) => {
    setEditandoId(plan.id_plan);

    setForm({
      nombre_plan: plan.nombre_plan || "",
      precio_plan: String(plan.precio_plan || ""),
      descripcion_basica: plan.descripcion_basica || "",
      descripcion_detallada: plan.descripcion_detallada || "",
      fecha_plan: plan.fecha_plan ? plan.fecha_plan.substring(0, 10) : "",
      hora_plan: plan.hora_plan ? plan.hora_plan.substring(0, 5) : "",
      imagen_url: plan.imagen_url || "",
      numero_plan: plan.numero_plan != null ? String(plan.numero_plan) : "",
    });
  };

  const handleEliminar = async (id: number) => {
    const confirmar = confirm("¿Seguro que deseas eliminar este plan?");

    if (!confirmar) return;

    try {
      await deletePlan(id);
      alert("Plan eliminado correctamente");
      cargarPlanes();
    } catch (error) {
      console.error(error);
      alert(
        "No se pudo eliminar el plan. Puede que tenga reservas asociadas."
      );
    }
  };

  return (
    <section>
      <h2>Gestión de planes</h2>

      <form onSubmit={handleSubmit}>
        <h3>{editandoId ? "Editar plan" : "Crear nuevo plan"}</h3>

        <div>
          <label>Nombre del plan</label>
          <input
            type="text"
            name="nombre_plan"
            value={form.nombre_plan}
            onChange={handleChange}
            placeholder="Ej. Tour Guatapé"
          />
        </div>

        <div>
          <label>Número de plan</label>
          <input
            type="number"
            name="numero_plan"
            value={form.numero_plan}
            onChange={handleChange}
            placeholder="Ej. 1"
          />
        </div>

        <div>
          <label>Precio en pesos colombianos</label>
          <input
            type="number"
            name="precio_plan"
            value={form.precio_plan}
            onChange={handleChange}
            placeholder="Ej. 150000"
          />
        </div>

        <div>
          <label>Descripción básica</label>
          <input
            type="text"
            name="descripcion_basica"
            value={form.descripcion_basica}
            onChange={handleChange}
            placeholder="Resumen corto del plan"
          />
        </div>

        <div>
          <label>Descripción detallada</label>
          <textarea
            name="descripcion_detallada"
            value={form.descripcion_detallada}
            onChange={handleChange}
            placeholder="Detalles completos del plan"
          />
        </div>

        <div>
          <label>Fecha del plan</label>
          <input
            type="date"
            name="fecha_plan"
            value={form.fecha_plan}
            onChange={handleChange}
          />
        </div>

        <div>
          <label>Hora del plan</label>
          <input
            type="time"
            name="hora_plan"
            value={form.hora_plan}
            onChange={handleChange}
          />
        </div>

        <div>
          <label>URL de imagen</label>
          <input
            type="text"
            name="imagen_url"
            value={form.imagen_url}
            onChange={handleChange}
            placeholder="https://..."
          />
        </div>

        <button type="submit">
          {editandoId ? "Actualizar plan" : "Crear plan"}
        </button>

        {editandoId && (
          <button type="button" onClick={limpiarFormulario}>
            Cancelar edición
          </button>
        )}
      </form>

      <hr />

      <h3>Planes registrados</h3>

      {loading ? (
        <p>Cargando planes...</p>
      ) : planes.length === 0 ? (
        <p>No hay planes registrados.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>N°</th>
              <th>Nombre</th>
              <th>Precio</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Imagen</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {planes.map((plan) => (
              <tr key={plan.id_plan}>
                <td>{plan.numero_plan ?? "-"}</td>
                <td>{plan.nombre_plan}</td>
                <td>{formatCOP(Number(plan.precio_plan))}</td>
                <td>{plan.fecha_plan}</td>
                <td>{plan.hora_plan}</td>
                <td>
                  {plan.imagen_url ? (
                    <img
                      src={plan.imagen_url}
                      alt={plan.nombre_plan}
                      width="80"
                    />
                  ) : (
                    "Sin imagen"
                  )}
                </td>
                <td>
                  <button onClick={() => handleEditar(plan)}>Editar</button>

                  <button onClick={() => handleEliminar(plan.id_plan)}>
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

export default PlanesAdmin;