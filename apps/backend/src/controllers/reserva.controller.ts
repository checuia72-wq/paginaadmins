import { Request, Response } from "express";
import { pool } from "../config/database";

export const getReservas = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        r.id_reserva,
        r.fecha_solicitud,
        r.fecha_aprobacion,
        r.cantidad_personas,
        r.aprobado,

        c.telefono AS telefono_cliente,
        c.atencion_humana,

        p.id_plan,
        p.nombre_plan,
        p.precio_plan,
        p.fecha_plan,
        p.hora_plan,
        p.imagen_url

      FROM reserva r
      INNER JOIN cliente c ON r.telefono_cliente = c.telefono
      INNER JOIN plan p ON r.id_plan = p.id_plan
      ORDER BY r.fecha_solicitud DESC
    `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener reservas", error });
  }
};

export const getReservaById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        r.id_reserva,
        r.fecha_solicitud,
        r.fecha_aprobacion,
        r.cantidad_personas,
        r.aprobado,

        c.telefono AS telefono_cliente,
        c.atencion_humana,

        p.id_plan,
        p.nombre_plan,
        p.precio_plan,
        p.descripcion_basica,
        p.descripcion_detallada,
        p.fecha_plan,
        p.hora_plan,
        p.imagen_url

      FROM reserva r
      INNER JOIN cliente c ON r.telefono_cliente = c.telefono
      INNER JOIN plan p ON r.id_plan = p.id_plan
      WHERE r.id_reserva = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Reserva no encontrada" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener reserva", error });
  }
};

export const createReserva = async (req: Request, res: Response) => {
  try {
    const { telefono_cliente, id_plan, aprobado } = req.body;

    if (!telefono_cliente || !id_plan) {
      return res.status(400).json({
        message: "Teléfono del cliente y plan son obligatorios",
      });
    }

    const clienteExiste = await pool.query(
      "SELECT * FROM cliente WHERE telefono = $1",
      [telefono_cliente]
    );

    if (clienteExiste.rows.length === 0) {
      return res.status(404).json({ message: "El cliente no existe" });
    }

    const planExiste = await pool.query(
      "SELECT * FROM plan WHERE id_plan = $1",
      [id_plan]
    );

    if (planExiste.rows.length === 0) {
      return res.status(404).json({ message: "El plan no existe" });
    }

    const result = await pool.query(
      `
      INSERT INTO reserva (
        telefono_cliente,
        id_plan,
        cantidad_personas,
        aprobado
      )
      VALUES ($1, $2, 0, $3)
      RETURNING *
      `,
      [telefono_cliente, id_plan, aprobado ?? false]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Error al crear reserva", error });
  }
};

export const updateReserva = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { telefono_cliente, id_plan, aprobado } = req.body;

    if (telefono_cliente !== undefined) {
      const clienteExiste = await pool.query(
        "SELECT * FROM cliente WHERE telefono = $1",
        [telefono_cliente]
      );

      if (clienteExiste.rows.length === 0) {
        return res.status(404).json({ message: "El cliente no existe" });
      }
    }

    if (id_plan !== undefined) {
      const planExiste = await pool.query(
        "SELECT * FROM plan WHERE id_plan = $1",
        [id_plan]
      );

      if (planExiste.rows.length === 0) {
        return res.status(404).json({ message: "El plan no existe" });
      }
    }

    const result = await pool.query(
      `
      UPDATE reserva
      SET
        telefono_cliente = COALESCE($1, telefono_cliente),
        id_plan = COALESCE($2, id_plan),
        aprobado = COALESCE($3, aprobado),
        fecha_aprobacion =
          CASE
            WHEN $3 = true THEN CURRENT_TIMESTAMP
            WHEN $3 = false THEN NULL
            ELSE fecha_aprobacion
          END
      WHERE id_reserva = $4
      RETURNING *
      `,
      [telefono_cliente, id_plan, aprobado, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Reserva no encontrada" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar reserva", error });
  }
};

export const deleteReserva = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const participantes = await pool.query(
      "SELECT 1 FROM participante WHERE id_reserva = $1 LIMIT 1",
      [id]
    );

    if (participantes.rows.length > 0) {
      return res.status(400).json({
        message:
          "No se puede eliminar la reserva porque tiene participantes registrados",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM reserva
      WHERE id_reserva = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Reserva no encontrada" });
    }

    res.json({ message: "Reserva eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar reserva", error });
  }
};