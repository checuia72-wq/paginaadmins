import { Request, Response } from "express";
import { pool } from "../config/database.js";

export const getParticipantes = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        pa.id_participante,
        pa.id_reserva,
        pa.telefono_cliente,
        pa.telefono_participante,
        pa.nombre,
        pa.edad,
        pa.estatura,
        pa.peso,
        r.id_plan,
        p.nombre_plan
      FROM participante pa
      INNER JOIN reserva r ON pa.id_reserva = r.id_reserva
      INNER JOIN plan p ON r.id_plan = p.id_plan
      ORDER BY pa.id_participante ASC
    `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener participantes",
      error,
    });
  }
};

export const getParticipanteById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT 
        pa.id_participante,
        pa.id_reserva,
        pa.telefono_cliente,
        pa.telefono_participante,
        pa.nombre,
        pa.edad,
        pa.estatura,
        pa.peso,
        r.id_plan,
        p.nombre_plan
      FROM participante pa
      INNER JOIN reserva r ON pa.id_reserva = r.id_reserva
      INNER JOIN plan p ON r.id_plan = p.id_plan
      WHERE pa.id_participante = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Participante no encontrado",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener participante",
      error,
    });
  }
};

export const createParticipante = async (req: Request, res: Response) => {
  try {
    const {
      id_reserva,
      telefono_cliente,
      telefono_participante,
      nombre,
      edad,
      estatura,
      peso,
    } = req.body;

    if (!id_reserva || !telefono_cliente || !telefono_participante || !nombre) {
      return res.status(400).json({
        message:
          "La reserva, el teléfono del cliente, el teléfono del participante y el nombre son obligatorios",
      });
    }

    if (telefono_cliente === telefono_participante) {
      return res.status(400).json({
        message:
          "El teléfono del participante no puede ser igual al teléfono del cliente",
      });
    }

    if (edad !== undefined && edad <= 0) {
      return res.status(400).json({
        message: "La edad debe ser mayor a 0",
      });
    }

    if (estatura !== undefined && estatura <= 0) {
      return res.status(400).json({
        message: "La estatura debe ser mayor a 0",
      });
    }

    if (peso !== undefined && peso <= 0) {
      return res.status(400).json({
        message: "El peso debe ser mayor a 0",
      });
    }

    const reservaExiste = await pool.query(
      `
      SELECT *
      FROM reserva
      WHERE id_reserva = $1
      AND telefono_cliente = $2
      `,
      [id_reserva, telefono_cliente]
    );

    if (reservaExiste.rows.length === 0) {
      return res.status(404).json({
        message:
          "La reserva no existe o no pertenece al cliente indicado",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO participante (
        id_reserva,
        telefono_cliente,
        telefono_participante,
        nombre,
        edad,
        estatura,
        peso
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        id_reserva,
        telefono_cliente,
        telefono_participante,
        nombre,
        edad,
        estatura,
        peso,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({
      message: "Error al crear participante",
      error,
    });
  }
};

export const updateParticipante = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const {
      id_reserva,
      telefono_cliente,
      telefono_participante,
      nombre,
      edad,
      estatura,
      peso,
    } = req.body;

    if (!id_reserva || !telefono_cliente || !telefono_participante || !nombre) {
      return res.status(400).json({
        message:
          "La reserva, el teléfono del cliente, el teléfono del participante y el nombre son obligatorios",
      });
    }

    if (telefono_cliente === telefono_participante) {
      return res.status(400).json({
        message:
          "El teléfono del participante no puede ser igual al teléfono del cliente",
      });
    }

    if (edad !== undefined && edad <= 0) {
      return res.status(400).json({
        message: "La edad debe ser mayor a 0",
      });
    }

    if (estatura !== undefined && estatura <= 0) {
      return res.status(400).json({
        message: "La estatura debe ser mayor a 0",
      });
    }

    if (peso !== undefined && peso <= 0) {
      return res.status(400).json({
        message: "El peso debe ser mayor a 0",
      });
    }

    const reservaExiste = await pool.query(
      `
      SELECT *
      FROM reserva
      WHERE id_reserva = $1
      AND telefono_cliente = $2
      `,
      [id_reserva, telefono_cliente]
    );

    if (reservaExiste.rows.length === 0) {
      return res.status(404).json({
        message:
          "La reserva no existe o no pertenece al cliente indicado",
      });
    }

    const result = await pool.query(
      `
      UPDATE participante
      SET
        id_reserva = $1,
        telefono_cliente = $2,
        telefono_participante = $3,
        nombre = $4,
        edad = $5,
        estatura = $6,
        peso = $7
      WHERE id_participante = $8
      RETURNING *
      `,
      [
        id_reserva,
        telefono_cliente,
        telefono_participante,
        nombre,
        edad,
        estatura,
        peso,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Participante no encontrado",
      });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({
      message: "Error al actualizar participante",
      error,
    });
  }
};

export const deleteParticipante = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM participante
      WHERE id_participante = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Participante no encontrado",
      });
    }

    res.json({
      message: "Participante eliminado correctamente",
      participante: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al eliminar participante",
      error,
    });
  }
};

export const getParticipantesByReserva = async (req: Request, res: Response) => {
  try {
    const { id_reserva } = req.params;

    const result = await pool.query(
      `
      SELECT *
      FROM participante
      WHERE id_reserva = $1
      ORDER BY id_participante ASC
      `,
      [id_reserva]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener participantes de la reserva",
      error,
    });
  }
};