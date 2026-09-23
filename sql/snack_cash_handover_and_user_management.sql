-- ============================================================
-- ENTREGA DE EFECTIVO DE GUÍAS A COORDINACIÓN
-- + soporte de roles para gestión segura de usuarios
--
-- Requiere:
--   snack_inventory_sales.sql
--   snack_multi_location_inventory.sql
--   coordinator_guide_roles_and_sales_access.sql
--
-- Flujo:
--   1. El guía vende snacks en efectivo.
--   2. El sistema calcula automáticamente qué ventas en efectivo
--      todavía no han sido entregadas.
--   3. El guía registra la entrega a un coordinador.
--   4. El coordinador confirma que recibió el dinero.
--   5. Cada venta queda ligada a una sola entrega para evitar
--      duplicar efectivo.
-- ============================================================


-- ============================================================
-- 1. ASEGURAR LOS CUATRO ROLES VÁLIDOS
-- ============================================================

ALTER TABLE public.roles
DROP CONSTRAINT IF EXISTS roles_nombre_valido;

ALTER TABLE public.roles
ADD CONSTRAINT roles_nombre_valido
CHECK (
  nombre IN (
    'administrador',
    'atencion',
    'coordinador',
    'guia'
  )
);

INSERT INTO public.roles (nombre)
SELECT 'coordinador'
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles WHERE nombre = 'coordinador'
);

INSERT INTO public.roles (nombre)
SELECT 'guia'
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles WHERE nombre = 'guia'
);


-- ============================================================
-- 2. IDENTIFICAR PAGOS EN EFECTIVO
-- ============================================================

CREATE OR REPLACE FUNCTION public.snack_es_pago_efectivo(
  p_medio_pago TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT LOWER(TRIM(COALESCE(p_medio_pago, ''))) = 'efectivo';
$$;


-- ============================================================
-- 3. CABECERA DE ENTREGA DE EFECTIVO
-- ============================================================

CREATE TABLE IF NOT EXISTS public.snack_entrega_efectivo (
  id_entrega BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  guia_user_id UUID NOT NULL
    REFERENCES auth.users(id)
    ON DELETE RESTRICT,

  guia_email TEXT NOT NULL DEFAULT '',

  coordinador_user_id UUID NOT NULL
    REFERENCES auth.users(id)
    ON DELETE RESTRICT,

  coordinador_email TEXT NOT NULL DEFAULT '',

  monto NUMERIC(12,2) NOT NULL DEFAULT 0
    CHECK (monto >= 0),

  cantidad_ventas INTEGER NOT NULL DEFAULT 0
    CHECK (cantidad_ventas >= 0),

  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'confirmada')),

  observacion TEXT NOT NULL DEFAULT '',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  confirmado_at TIMESTAMPTZ,

  confirmado_por UUID
    REFERENCES auth.users(id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_snack_entrega_efectivo_guia
  ON public.snack_entrega_efectivo(guia_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_snack_entrega_efectivo_coordinador
  ON public.snack_entrega_efectivo(coordinador_user_id, estado, created_at DESC);

ALTER TABLE public.snack_entrega_efectivo
ENABLE ROW LEVEL SECURITY;

REVOKE ALL
ON public.snack_entrega_efectivo
FROM PUBLIC, anon, authenticated;


-- ============================================================
-- 4. VENTAS INCLUIDAS EN CADA ENTREGA
--
-- UNIQUE(id_venta) garantiza que una venta en efectivo no pueda
-- entregarse dos veces.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.snack_entrega_efectivo_venta (
  id_entrega BIGINT NOT NULL
    REFERENCES public.snack_entrega_efectivo(id_entrega)
    ON DELETE CASCADE,

  id_venta BIGINT NOT NULL UNIQUE
    REFERENCES public.snack_venta(id_venta)
    ON DELETE RESTRICT,

  monto NUMERIC(12,2) NOT NULL
    CHECK (monto >= 0),

  PRIMARY KEY (
    id_entrega,
    id_venta
  )
);

CREATE INDEX IF NOT EXISTS idx_snack_entrega_venta_entrega
  ON public.snack_entrega_efectivo_venta(id_entrega);

ALTER TABLE public.snack_entrega_efectivo_venta
ENABLE ROW LEVEL SECURITY;

REVOKE ALL
ON public.snack_entrega_efectivo_venta
FROM PUBLIC, anon, authenticated;


-- ============================================================
-- 5. LISTAR COORDINADORES DISPONIBLES
-- ============================================================

CREATE OR REPLACE FUNCTION public.listar_coordinadores_efectivo()
RETURNS TABLE (
  user_id UUID,
  email TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión.';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    COALESCE(u.email, '')::TEXT
  FROM auth.users u
  INNER JOIN public.usuario_roles ur
    ON ur.user_id = u.id
  INNER JOIN public.roles r
    ON r.id_rol = ur.role_id
  WHERE r.nombre = 'coordinador'
  ORDER BY LOWER(COALESCE(u.email, ''));
END;
$$;

REVOKE ALL
ON FUNCTION public.listar_coordinadores_efectivo()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.listar_coordinadores_efectivo()
TO authenticated;


-- ============================================================
-- 6. SALDO DE EFECTIVO DEL GUÍA
-- ============================================================

CREATE OR REPLACE FUNCTION public.mi_saldo_efectivo_snacks()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT := '';
  v_total NUMERIC(12,2) := 0;
  v_pendiente NUMERIC(12,2) := 0;
  v_hoy NUMERIC(12,2) := 0;
  v_ventas_hoy INTEGER := 0;
  v_entregas INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión.';
  END IF;

  SELECT COALESCE(r.nombre, '')
  INTO v_role
  FROM public.usuario_roles ur
  INNER JOIN public.roles r
    ON r.id_rol = ur.role_id
  WHERE ur.user_id = v_user_id
  LIMIT 1;

  IF v_role <> 'guia' THEN
    RAISE EXCEPTION 'Esta consulta corresponde al saldo de efectivo de un guía.';
  END IF;

  SELECT COALESCE(SUM(v.total), 0)
  INTO v_total
  FROM public.snack_venta v
  WHERE v.vendedor_user_id = v_user_id
    AND public.snack_es_pago_efectivo(v.medio_pago);

  SELECT COALESCE(SUM(v.total), 0)
  INTO v_pendiente
  FROM public.snack_venta v
  WHERE v.vendedor_user_id = v_user_id
    AND public.snack_es_pago_efectivo(v.medio_pago)
    AND NOT EXISTS (
      SELECT 1
      FROM public.snack_entrega_efectivo_venta ev
      WHERE ev.id_venta = v.id_venta
    );

  SELECT
    COALESCE(SUM(v.total), 0),
    COUNT(*)::INTEGER
  INTO
    v_hoy,
    v_ventas_hoy
  FROM public.snack_venta v
  WHERE v.vendedor_user_id = v_user_id
    AND public.snack_es_pago_efectivo(v.medio_pago)
    AND (v.fecha_venta AT TIME ZONE 'America/Bogota')::DATE =
        (NOW() AT TIME ZONE 'America/Bogota')::DATE;

  SELECT COUNT(*)::INTEGER
  INTO v_entregas
  FROM public.snack_entrega_efectivo e
  WHERE e.guia_user_id = v_user_id;

  RETURN jsonb_build_object(
    'efectivo_pendiente', v_pendiente,
    'efectivo_hoy', v_hoy,
    'ventas_hoy', v_ventas_hoy,
    'ventas_efectivo_total', v_total,
    'entregas_registradas', v_entregas
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.mi_saldo_efectivo_snacks()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.mi_saldo_efectivo_snacks()
TO authenticated;


-- ============================================================
-- 7. GUÍA REGISTRA LA ENTREGA DE TODO SU EFECTIVO PENDIENTE
-- ============================================================

CREATE OR REPLACE FUNCTION public.registrar_entrega_efectivo_snacks(
  p_coordinador_user_id UUID,
  p_observacion TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT := '';
  v_guia_email TEXT := '';
  v_coordinador_email TEXT := '';
  v_entrega_id BIGINT;
  v_monto NUMERIC(12,2) := 0;
  v_cantidad INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión.';
  END IF;

  SELECT COALESCE(r.nombre, '')
  INTO v_role
  FROM public.usuario_roles ur
  INNER JOIN public.roles r
    ON r.id_rol = ur.role_id
  WHERE ur.user_id = v_user_id
  LIMIT 1;

  IF v_role <> 'guia' THEN
    RAISE EXCEPTION 'Solo un guía puede registrar una entrega de efectivo.';
  END IF;

  IF p_coordinador_user_id IS NULL THEN
    RAISE EXCEPTION 'Selecciona el coordinador que recibe el dinero.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.usuario_roles ur
    INNER JOIN public.roles r
      ON r.id_rol = ur.role_id
    WHERE ur.user_id = p_coordinador_user_id
      AND r.nombre = 'coordinador'
  ) THEN
    RAISE EXCEPTION 'El usuario seleccionado no tiene rol de coordinador.';
  END IF;

  SELECT COALESCE(email, '')
  INTO v_guia_email
  FROM auth.users
  WHERE id = v_user_id;

  SELECT COALESCE(email, '')
  INTO v_coordinador_email
  FROM auth.users
  WHERE id = p_coordinador_user_id;

  -- Bloquear las ventas pendientes del guía mientras se crea la entrega.
  PERFORM v.id_venta
  FROM public.snack_venta v
  WHERE v.vendedor_user_id = v_user_id
    AND public.snack_es_pago_efectivo(v.medio_pago)
    AND NOT EXISTS (
      SELECT 1
      FROM public.snack_entrega_efectivo_venta ev
      WHERE ev.id_venta = v.id_venta
    )
  ORDER BY v.id_venta
  FOR UPDATE;

  INSERT INTO public.snack_entrega_efectivo (
    guia_user_id,
    guia_email,
    coordinador_user_id,
    coordinador_email,
    monto,
    cantidad_ventas,
    estado,
    observacion
  )
  VALUES (
    v_user_id,
    v_guia_email,
    p_coordinador_user_id,
    v_coordinador_email,
    0,
    0,
    'pendiente',
    TRIM(COALESCE(p_observacion, ''))
  )
  RETURNING id_entrega
  INTO v_entrega_id;

  INSERT INTO public.snack_entrega_efectivo_venta (
    id_entrega,
    id_venta,
    monto
  )
  SELECT
    v_entrega_id,
    v.id_venta,
    v.total
  FROM public.snack_venta v
  WHERE v.vendedor_user_id = v_user_id
    AND public.snack_es_pago_efectivo(v.medio_pago)
    AND NOT EXISTS (
      SELECT 1
      FROM public.snack_entrega_efectivo_venta ev
      WHERE ev.id_venta = v.id_venta
    )
  ORDER BY v.id_venta;

  SELECT
    COALESCE(SUM(ev.monto), 0),
    COUNT(*)::INTEGER
  INTO
    v_monto,
    v_cantidad
  FROM public.snack_entrega_efectivo_venta ev
  WHERE ev.id_entrega = v_entrega_id;

  IF v_cantidad = 0 OR v_monto <= 0 THEN
    DELETE FROM public.snack_entrega_efectivo
    WHERE id_entrega = v_entrega_id;

    RAISE EXCEPTION 'No tienes ventas en efectivo pendientes por entregar.';
  END IF;

  UPDATE public.snack_entrega_efectivo
  SET
    monto = v_monto,
    cantidad_ventas = v_cantidad
  WHERE id_entrega = v_entrega_id;

  RETURN jsonb_build_object(
    'id_entrega', v_entrega_id,
    'guia_user_id', v_user_id,
    'guia_email', v_guia_email,
    'coordinador_user_id', p_coordinador_user_id,
    'coordinador_email', v_coordinador_email,
    'monto', v_monto,
    'cantidad_ventas', v_cantidad,
    'estado', 'pendiente',
    'fecha', NOW()
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.registrar_entrega_efectivo_snacks(
  UUID,
  TEXT
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.registrar_entrega_efectivo_snacks(
  UUID,
  TEXT
)
TO authenticated;


-- ============================================================
-- 8. COORDINADOR CONFIRMA QUE RECIBIÓ EL EFECTIVO
-- Administrador también puede confirmar para soporte/auditoría.
-- ============================================================

CREATE OR REPLACE FUNCTION public.confirmar_entrega_efectivo_snacks(
  p_id_entrega BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT := '';
  v_entrega public.snack_entrega_efectivo%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión.';
  END IF;

  SELECT COALESCE(r.nombre, '')
  INTO v_role
  FROM public.usuario_roles ur
  INNER JOIN public.roles r
    ON r.id_rol = ur.role_id
  WHERE ur.user_id = v_user_id
  LIMIT 1;

  IF v_role NOT IN ('administrador', 'coordinador') THEN
    RAISE EXCEPTION 'Solo Coordinación o Administración pueden confirmar la recepción.';
  END IF;

  SELECT *
  INTO v_entrega
  FROM public.snack_entrega_efectivo
  WHERE id_entrega = p_id_entrega
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La entrega de efectivo no existe.';
  END IF;

  IF v_entrega.estado = 'confirmada' THEN
    RETURN jsonb_build_object(
      'id_entrega', v_entrega.id_entrega,
      'estado', 'confirmada',
      'monto', v_entrega.monto,
      'confirmado_at', v_entrega.confirmado_at
    );
  END IF;

  IF v_role = 'coordinador'
     AND v_entrega.coordinador_user_id <> v_user_id THEN
    RAISE EXCEPTION 'Esta entrega fue dirigida a otro coordinador.';
  END IF;

  UPDATE public.snack_entrega_efectivo
  SET
    estado = 'confirmada',
    confirmado_at = NOW(),
    confirmado_por = v_user_id
  WHERE id_entrega = p_id_entrega;

  RETURN jsonb_build_object(
    'id_entrega', p_id_entrega,
    'estado', 'confirmada',
    'monto', v_entrega.monto,
    'guia_email', v_entrega.guia_email,
    'coordinador_email', v_entrega.coordinador_email,
    'confirmado_at', NOW()
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.confirmar_entrega_efectivo_snacks(BIGINT)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.confirmar_entrega_efectivo_snacks(BIGINT)
TO authenticated;


-- ============================================================
-- 9. HISTORIAL VISIBLE SEGÚN EL ROL
--
-- Administrador: todas.
-- Coordinador: entregas dirigidas a él.
-- Guía: sus propias entregas.
-- ============================================================

CREATE OR REPLACE FUNCTION public.listar_entregas_efectivo_snacks()
RETURNS TABLE (
  id_entrega BIGINT,
  guia_user_id UUID,
  guia_email TEXT,
  coordinador_user_id UUID,
  coordinador_email TEXT,
  monto NUMERIC,
  cantidad_ventas INTEGER,
  estado TEXT,
  observacion TEXT,
  created_at TIMESTAMPTZ,
  confirmado_at TIMESTAMPTZ,
  confirmado_por UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT := '';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión.';
  END IF;

  SELECT COALESCE(r.nombre, '')
  INTO v_role
  FROM public.usuario_roles ur
  INNER JOIN public.roles r
    ON r.id_rol = ur.role_id
  WHERE ur.user_id = v_user_id
  LIMIT 1;

  IF v_role NOT IN ('administrador', 'coordinador', 'guia') THEN
    RAISE EXCEPTION 'No tienes acceso a las entregas de efectivo.';
  END IF;

  RETURN QUERY
  SELECT
    e.id_entrega,
    e.guia_user_id,
    e.guia_email,
    e.coordinador_user_id,
    e.coordinador_email,
    e.monto,
    e.cantidad_ventas,
    e.estado,
    e.observacion,
    e.created_at,
    e.confirmado_at,
    e.confirmado_por
  FROM public.snack_entrega_efectivo e
  WHERE
    v_role = 'administrador'
    OR (v_role = 'coordinador' AND e.coordinador_user_id = v_user_id)
    OR (v_role = 'guia' AND e.guia_user_id = v_user_id)
  ORDER BY
    CASE WHEN e.estado = 'pendiente' THEN 0 ELSE 1 END,
    e.created_at DESC;
END;
$$;

REVOKE ALL
ON FUNCTION public.listar_entregas_efectivo_snacks()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.listar_entregas_efectivo_snacks()
TO authenticated;


-- ============================================================
-- 10. COMPROBACIÓN
-- ============================================================

SELECT
  r.id_rol,
  r.nombre
FROM public.roles r
WHERE r.nombre IN (
  'administrador',
  'atencion',
  'coordinador',
  'guia'
)
ORDER BY r.nombre;
