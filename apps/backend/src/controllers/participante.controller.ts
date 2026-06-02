import { Request, Response } from "express";
import { pool } from "../config/database";

export const getParticipantes = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM participante
      ORDER BY id_participante ASC
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
      "SELECT * FROM participante WHERE id_participante = $1",
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
    const { id_reserva, nombre, edad, estatura, peso } = req.body;

    if (!id_reserva || !nombre) {
      return res.status(400).json({
        message: "La reserva y el nombre son obligatorios",
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
      "SELECT * FROM reserva WHERE id_reserva = $1",
      [id_reserva]
    );

    if (reservaExiste.rows.length === 0) {
      return res.status(404).json({
        message: "La reserva no existe",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO participante (
        id_reserva,
        nombre,
        edad,
        estatura,
        peso
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [id_reserva, nombre, edad, estatura, peso]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({
      message: "Error al crear participante",
      error,
    });
  }
};

export const updateParticipante = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { id_reserva, nombre, edad, estatura, peso } = req.body;

    if (!id_reserva || !nombre) {
      return res.status(400).json({
        message: "La reserva y el nombre son obligatorios",
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
      "SELECT * FROM reserva WHERE id_reserva = $1",
      [id_reserva]
    );

    if (reservaExiste.rows.length === 0) {
      return res.status(404).json({
        message: "La reserva no existe",
      });
    }

    const result = await pool.query(
      `
      UPDATE participante
      SET
        id_reserva = $1,
        nombre = $2,
        edad = $3,
        estatura = $4,
        peso = $5
      WHERE id_participante = $6
      RETURNING *
      `,
      [id_reserva, nombre, edad, estatura, peso, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Participante no encontrado",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
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
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al eliminar participante",
      error,
    });
  }
};