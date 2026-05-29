import { Request, Response } from "express";
import { pool } from "../config/database";

export const getPlans = async (req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM plan ORDER BY id_plan ASC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener planes", error });
  }
};

export const getPlanById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "SELECT * FROM plan WHERE id_plan = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Plan no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener plan", error });
  }
};

export const createPlan = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      nombre_plan,
      precio_plan,
      descripcion_basica,
      descripcion_detallada,
      fecha_plan,
      hora_plan,
      imagen_url,
    } = req.body;

    // VALIDACIONES
    if (!nombre_plan || !precio_plan) {
      return res.status(400).json({
        message:
          "El nombre del plan y el precio son obligatorios",
      });
    }

    if (precio_plan <= 0) {
      return res.status(400).json({
        message:
          "El precio del plan debe ser mayor a 0",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO plan (
        nombre_plan,
        precio_plan,
        descripcion_basica,
        descripcion_detallada,
        fecha_plan,
        hora_plan,
        imagen_url
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [
        nombre_plan,
        precio_plan,
        descripcion_basica,
        descripcion_detallada,
        fecha_plan,
        hora_plan,
        imagen_url,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({
      message: "Error al crear plan",
      error,
    });
  }
};

export const updatePlan = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    const {
      nombre_plan,
      precio_plan,
      descripcion_basica,
      descripcion_detallada,
      fecha_plan,
      hora_plan,
      imagen_url,
    } = req.body;

    // VALIDACIONES
    if (!nombre_plan || !precio_plan) {
      return res.status(400).json({
        message:
          "El nombre del plan y el precio son obligatorios",
      });
    }

    if (precio_plan <= 0) {
      return res.status(400).json({
        message:
          "El precio del plan debe ser mayor a 0",
      });
    }

    const result = await pool.query(
      `
      UPDATE plan
      SET
        nombre_plan = $1,
        precio_plan = $2,
        descripcion_basica = $3,
        descripcion_detallada = $4,
        fecha_plan = $5,
        hora_plan = $6,
        imagen_url = $7
      WHERE id_plan = $8
      RETURNING *
      `,
      [
        nombre_plan,
        precio_plan,
        descripcion_basica,
        descripcion_detallada,
        fecha_plan,
        hora_plan,
        imagen_url,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Plan no encontrado",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({
      message: "Error al actualizar plan",
      error,
    });
  }
};

export const deletePlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const reservas = await pool.query(
      "SELECT 1 FROM reserva WHERE id_plan = $1 LIMIT 1",
      [id]
    );

    if (reservas.rows.length > 0) {
      return res.status(400).json({
        message: "No se puede eliminar el plan porque tiene reservas registradas",
      });
    }

    const result = await pool.query(
      "DELETE FROM plan WHERE id_plan = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Plan no encontrado",
      });
    }

    return res.json({
      message: "Plan eliminado correctamente",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error al eliminar plan",
      error,
    });
  }
};