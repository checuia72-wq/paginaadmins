import { Request, Response } from "express";
import { pool } from "../config/database.js";

export const getPlans = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM plan
      ORDER BY numero_plan ASC NULLS LAST, id_plan ASC
    `);

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

export const createPlan = async (req: Request, res: Response) => {
  try {
    const {
      nombre_plan,
      precio_plan,
      descripcion_basica,
      descripcion_detallada,
      fecha_plan,
      hora_plan,
      imagen_url,
      numero_plan,
    } = req.body;

    if (!nombre_plan || precio_plan === undefined || precio_plan === null) {
      return res.status(400).json({
        message: "El nombre del plan y el precio son obligatorios",
      });
    }

    if (Number(precio_plan) <= 0) {
      return res.status(400).json({
        message: "El precio del plan debe ser mayor a 0",
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
        imagen_url,
        numero_plan
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
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
        numero_plan,
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

export const updatePlan = async (req: Request, res: Response) => {
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
      numero_plan,
    } = req.body;

    if (!nombre_plan || precio_plan === undefined || precio_plan === null) {
      return res.status(400).json({
        message: "El nombre del plan y el precio son obligatorios",
      });
    }

    if (Number(precio_plan) <= 0) {
      return res.status(400).json({
        message: "El precio del plan debe ser mayor a 0",
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
        imagen_url = $7,
        numero_plan = $8
      WHERE id_plan = $9
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
        numero_plan,
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

    const clientes = await pool.query(
      "SELECT 1 FROM cliente WHERE id_plan = $1 LIMIT 1",
      [id]
    );

    if (clientes.rows.length > 0) {
      return res.status(400).json({
        message: "No se puede eliminar el plan porque está asignado a clientes",
      });
    }

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