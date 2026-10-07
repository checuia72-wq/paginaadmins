-- ============================================================
-- CONSUMO OPERATIVO DE SNACKS
-- Ejecutar en Supabase SQL Editor después de:
--   snack_multi_location_inventory.sql
--   coordinator_guide_roles_and_sales_access.sql
--
-- Todos los roles autenticados de la plataforma pueden registrar
-- su propio consumo operativo. Administrador y coordinador pueden
-- consultar el historial completo.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.snack_consumo_operativo (
  id_consumo BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fecha_consumo TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ubicacion_codigo TEXT NOT NULL
    REFERENCES public.snack_ubicacion(codigo)
    ON DELETE RESTRICT,
  total_unidades INTEGER NOT NULL DEFAULT 0
    CHECK (total_unidades > 0),
  registrado_por UUID
    REFERENCES auth.users(id)
    ON DELETE SET NULL,
  registrado_email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.snack_consumo_operativo_detalle (
  id_detalle BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_consumo BIGINT NOT NULL
    REFERENCES public.snack_consumo_operativo(id_consumo)
    ON DELETE CASCADE,
  id_producto BIGINT
    REFERENCES public.snack_producto(id_producto)
    ON DELETE SET NULL,
  numero_producto TEXT NOT NULL,
  nombre_producto TEXT NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snack_consumo_operativo_fecha
  ON public.snack_consumo_operativo(fecha_consumo DESC);

CREATE INDEX IF NOT EXISTS idx_snack_consumo_operativo_ubicacion
  ON public.snack_consumo_operativo(ubicacion_codigo, fecha_consumo DESC);

CREATE INDEX IF NOT EXISTS idx_snack_consumo_operativo_detalle_consumo
  ON public.snack_consumo_operativo_detalle(id_consumo);

ALTER TABLE public.snack_consumo_operativo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snack_consumo_operativo_detalle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS snack_consumo_operativo_select_gestion
ON public.snack_consumo_operativo;

CREATE POLICY snack_consumo_operativo_select_gestion
ON public.snack_consumo_operativo
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.usuario_roles ur
    INNER JOIN public.roles r
      ON r.id_rol = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.nombre IN ('administrador', 'coordinador')
  )
);

DROP POLICY IF EXISTS snack_consumo_operativo_detalle_select_gestion
ON public.snack_consumo_operativo_detalle;

CREATE POLICY snack_consumo_operativo_detalle_select_gestion
ON public.snack_consumo_operativo_detalle
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.usuario_roles ur
    INNER JOIN public.roles r
      ON r.id_rol = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.nombre IN ('administrador', 'coordinador')
  )
);

GRANT SELECT ON public.snack_consumo_operativo TO authenticated;
GRANT SELECT ON public.snack_consumo_operativo_detalle TO authenticated;

-- Lista los productos disponibles para consumo sin exponer precios.
CREATE OR REPLACE FUNCTION public.listar_snacks_consumo_operativo(
  p_ubicacion TEXT
)
RETURNS TABLE (
  id_producto BIGINT,
  numero_producto TEXT,
  nombre_producto TEXT,
  cantidad INTEGER
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

  IF p_ubicacion NOT IN ('taquilla_1', 'enclave') THEN
    RAISE EXCEPTION 'Punto de inventario inválido.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.usuario_roles ur
    INNER JOIN public.roles r
      ON r.id_rol = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.nombre IN ('administrador', 'atencion', 'coordinador', 'guia')
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para registrar consumos operativos.';
  END IF;

  RETURN QUERY
  SELECT
    p.id_producto,
    p.numero_producto,
    p.nombre_producto,
    COALESCE(i.cantidad, 0)::INTEGER
  FROM public.snack_producto p
  LEFT JOIN public.snack_inventario_ubicacion i
    ON i.id_producto = p.id_producto
   AND i.codigo_ubicacion = p_ubicacion
  WHERE p.activo = TRUE
  ORDER BY p.numero_producto, p.nombre_producto;
END;
$$;

REVOKE ALL
ON FUNCTION public.listar_snacks_consumo_operativo(TEXT)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.listar_snacks_consumo_operativo(TEXT)
TO authenticated;

-- Registra el consumo y descuenta el inventario de forma atómica.
CREATE OR REPLACE FUNCTION public.registrar_consumo_operativo_snack(
  p_items JSONB,
  p_ubicacion TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email TEXT := '';
  v_consumo_id BIGINT;
  v_item JSONB;
  v_producto public.snack_producto%ROWTYPE;
  v_producto_id BIGINT;
  v_cantidad INTEGER;
  v_disponible INTEGER := 0;
  v_total_unidades INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para registrar un consumo.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.usuario_roles ur
    INNER JOIN public.roles r
      ON r.id_rol = ur.role_id
    WHERE ur.user_id = v_user_id
      AND r.nombre IN ('administrador', 'atencion', 'coordinador', 'guia')
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para registrar consumos operativos.';
  END IF;

  IF p_ubicacion NOT IN ('taquilla_1', 'enclave') THEN
    RAISE EXCEPTION 'Punto de inventario inválido.';
  END IF;

  IF p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Agrega al menos un snack al consumo.';
  END IF;

  SELECT COALESCE(email, '')
  INTO v_email
  FROM auth.users
  WHERE id = v_user_id;

  INSERT INTO public.snack_consumo_operativo (
    ubicacion_codigo,
    total_unidades,
    registrado_por,
    registrado_email
  )
  VALUES (
    p_ubicacion,
    1,
    v_user_id,
    v_email
  )
  RETURNING id_consumo
  INTO v_consumo_id;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items)
  LOOP
    v_producto_id := NULLIF(v_item ->> 'id_producto', '')::BIGINT;
    v_cantidad := NULLIF(v_item ->> 'cantidad', '')::INTEGER;

    IF v_producto_id IS NULL
       OR v_cantidad IS NULL
       OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Hay un producto con cantidad inválida.';
    END IF;

    SELECT *
    INTO v_producto
    FROM public.snack_producto
    WHERE id_producto = v_producto_id
      AND activo = TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El producto % no existe o está inactivo.', v_producto_id;
    END IF;

    INSERT INTO public.snack_inventario_ubicacion (
      id_producto,
      codigo_ubicacion,
      cantidad
    )
    VALUES (
      v_producto_id,
      p_ubicacion,
      0
    )
    ON CONFLICT (id_producto, codigo_ubicacion)
    DO NOTHING;

    SELECT cantidad
    INTO v_disponible
    FROM public.snack_inventario_ubicacion
    WHERE id_producto = v_producto_id
      AND codigo_ubicacion = p_ubicacion
    FOR UPDATE;

    IF v_disponible < v_cantidad THEN
      RAISE EXCEPTION
        'Stock insuficiente para %. Disponible: %, solicitado: %.',
        v_producto.nombre_producto,
        v_disponible,
        v_cantidad;
    END IF;

    UPDATE public.snack_inventario_ubicacion
    SET
      cantidad = cantidad - v_cantidad,
      updated_at = NOW()
    WHERE id_producto = v_producto_id
      AND codigo_ubicacion = p_ubicacion;

    INSERT INTO public.snack_consumo_operativo_detalle (
      id_consumo,
      id_producto,
      numero_producto,
      nombre_producto,
      cantidad
    )
    VALUES (
      v_consumo_id,
      v_producto.id_producto,
      v_producto.numero_producto,
      v_producto.nombre_producto,
      v_cantidad
    );

    v_total_unidades := v_total_unidades + v_cantidad;

    PERFORM public.snack_sincronizar_total_producto(v_producto_id);
  END LOOP;

  UPDATE public.snack_consumo_operativo
  SET total_unidades = v_total_unidades
  WHERE id_consumo = v_consumo_id;

  RETURN jsonb_build_object(
    'id_consumo', v_consumo_id,
    'ubicacion', p_ubicacion,
    'total_unidades', v_total_unidades,
    'registrado_por', v_user_id,
    'registrado_email', v_email,
    'fecha_consumo', NOW()
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.registrar_consumo_operativo_snack(JSONB, TEXT)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.registrar_consumo_operativo_snack(JSONB, TEXT)
TO authenticated;
