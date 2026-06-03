import { Request, Response } from "express";
import { pool } from "../config/database";

export const getClientes = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        c.telefono,
        c.atencion_humana,
        c.etapaconversacion,
        c.id_plan,
        p.nombre_plan,
        p.numero_plan
      FROM cliente c
      LEFT JOIN plan p ON c.id_plan = p.id_plan
      ORDER BY c.telefono ASC
    `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener clientes", error });
  }
};

export const getClienteByTelefono = async (req: Request, res: Response) => {
  try {
    const { telefono } = req.params;

    const result = await pool.query(
      `
      SELECT
        c.telefono,
        c.atencion_humana,
        c.etapaconversacion,
        c.id_plan,
        p.nombre_plan,
        p.numero_plan
      FROM cliente c
      LEFT JOIN plan p ON c.id_plan = p.id_plan
      WHERE c.telefono = $1
      `,
      [telefono]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener cliente", error });
  }
};

export const createCliente = async (req: Request, res: Response) => {
  try {
    const {
      telefono,
      atencion_humana = false,
      etapaconversacion = "saludo",
      id_plan = null,
    } = req.body;

    if (!telefono) {
      return res.status(400).json({
        message: "El teléfono es obligatorio",
      });
    }

    if (typeof atencion_humana !== "boolean") {
      return res.status(400).json({
        message: "El campo atencion_humana debe ser true o false",
      });
    }

    if (id_plan !== null && id_plan !== undefined) {
      const planExiste = await pool.query(
        "SELECT 1 FROM plan WHERE id_plan = $1",
        [id_plan]
      );

      if (planExiste.rows.length === 0) {
        return res.status(400).json({
          message: "El plan seleccionado no existe",
        });
      }
    }

    const result = await pool.query(
      `
      INSERT INTO cliente 
        (telefono, atencion_humana, etapaconversacion, id_plan)
      VALUES 
        ($1, $2, $3, $4)
      RETURNING *
      `,
      [telefono, atencion_humana, etapaconversacion, id_plan]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(400).json({
        message: "Ya existe un cliente con ese teléfono",
      });
    }

    res.status(500).json({
      message: "Error al crear cliente",
      error,
    });
  }
};

export const updateCliente = async (req: Request, res: Response) => {
  try {
    const { telefono } = req.params;
    const { atencion_humana, etapaconversacion, id_plan } = req.body;

    if (
      atencion_humana !== undefined &&
      typeof atencion_humana !== "boolean"
    ) {
      return res.status(400).json({
        message: "El campo atencion_humana debe ser true o false",
      });
    }

    if (id_plan !== null && id_plan !== undefined) {
      const planExiste = await pool.query(
        "SELECT 1 FROM plan WHERE id_plan = $1",
        [id_plan]
      );

      if (planExiste.rows.length === 0) {
        return res.status(400).json({
          message: "El plan seleccionado no existe",
        });
      }
    }

    const result = await pool.query(
      `
      UPDATE cliente
      SET 
        atencion_humana = COALESCE($1, atencion_humana),
        etapaconversacion = COALESCE($2, etapaconversacion),
        id_plan = $3
      WHERE telefono = $4
      RETURNING *
      `,
      [atencion_humana, etapaconversacion, id_plan ?? null, telefono]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Cliente no encontrado",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({
      message: "Error al actualizar cliente",
      error,
    });
  }
};

export const deleteCliente = async (req: Request, res: Response) => {
  try {
    const { telefono } = req.params;

    const reservas = await pool.query(
      "SELECT 1 FROM reserva WHERE telefono_cliente = $1 LIMIT 1",
      [telefono]
    );

    if (reservas.rows.length > 0) {
      return res.status(400).json({
        message:
          "No se puede eliminar el cliente porque tiene reservas registradas",
      });
    }

    const participantes = await pool.query(
      "SELECT 1 FROM participante WHERE telefono_cliente = $1 LIMIT 1",
      [telefono]
    );

    if (participantes.rows.length > 0) {
      return res.status(400).json({
        message:
          "No se puede eliminar el cliente porque tiene participantes relacionados",
      });
    }

    const logs = await pool.query(
      "SELECT 1 FROM cliente_log WHERE telefono_cliente = $1 LIMIT 1",
      [telefono]
    );

    if (logs.rows.length > 0) {
      return res.status(400).json({
        message:
          "No se puede eliminar el cliente porque tiene historial registrado",
      });
    }

    const result = await pool.query(
      "DELETE FROM cliente WHERE telefono = $1 RETURNING *",
      [telefono]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    return res.json({ message: "Cliente eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({
      message: "Error al eliminar cliente",
      error,
    });
  }
};