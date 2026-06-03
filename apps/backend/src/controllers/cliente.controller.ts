import { Request, Response } from "express";
import { pool } from "../config/database";

export const getClientes = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM cliente ORDER BY telefono ASC"
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener clientes", error });
  }
};

export const getClienteByTelefono = async (req: Request, res: Response) => {
  try {
    const { telefono } = req.params;

    const result = await pool.query(
      "SELECT * FROM cliente WHERE telefono = $1",
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

    const result = await pool.query(
      `
      INSERT INTO cliente 
        (telefono, atencion_humana, etapaconversacion)
      VALUES 
        ($1, $2, $3)
      RETURNING *
      `,
      [telefono, atencion_humana, etapaconversacion]
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
    const { atencion_humana, etapaconversacion } = req.body;

    if (typeof atencion_humana !== "boolean") {
      return res.status(400).json({
        message: "El campo atencion_humana debe ser true o false",
      });
    }

    const result = await pool.query(
      `
      UPDATE cliente
      SET 
        atencion_humana = $1,
        etapaconversacion = COALESCE($2, etapaconversacion)
      WHERE telefono = $3
      RETURNING *
      `,
      [atencion_humana, etapaconversacion, telefono]
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