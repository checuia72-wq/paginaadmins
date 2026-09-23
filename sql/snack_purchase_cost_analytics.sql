-- ============================================================
-- COSTO DE COMPRA Y ANALÍTICA DE RENTABILIDAD DE SNACKS
-- Ejecutar después de:
--   snack_inventory_sales.sql
--   snack_inventory_withdrawals.sql
--
-- Objetivos:
-- 1) El precio de compra solo puede consultarlo/editarlo un administrador.
-- 2) Cada venta conserva el costo histórico del producto al momento de vender.
-- 3) Los retiros por vencimiento/daño conservan el costo de la merma.
-- 4) El Resumen puede calcular ingresos, costos, ganancia, margen,
--    snack más vendido, más rentable, capital invertido y merma.
-- ============================================================


-- ============================================================
-- 1. AYUDANTE DE SEGURIDAD: SOLO ADMINISTRADORES
-- ============================================================

CREATE OR REPLACE FUNCTION public.snack_es_administrador()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_roles ur
    INNER JOIN public.roles r ON r.id_rol = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.nombre = 'administrador'
  );
$$;

REVOKE ALL ON FUNCTION public.snack_es_administrador() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.snack_es_administrador() TO authenticated;


-- ============================================================
-- 2. COSTO ACTUAL DE CADA PRODUCTO
-- Se guarda separado de snack_producto para que Atención
-- nunca pueda obtener el precio de compra desde el inventario de venta.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.snack_producto_costo (
  id_producto BIGINT PRIMARY KEY
    REFERENCES public.snack_producto(id_producto)
    ON DELETE CASCADE,

  precio_compra NUMERIC(12,2) NOT NULL
    CHECK (precio_compra >= 0),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

  updated_email TEXT NOT NULL DEFAULT ''
);

ALTER TABLE public.snack_producto_costo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS snack_producto_costo_select_admin
ON public.snack_producto_costo;

CREATE POLICY snack_producto_costo_select_admin
ON public.snack_producto_costo
FOR SELECT
TO authenticated
USING (public.snack_es_administrador());

GRANT SELECT ON public.snack_producto_costo TO authenticated;


-- ============================================================
-- 3. COSTO HISTÓRICO DE CADA LÍNEA VENDIDA
-- No se guarda en snack_venta_detalle para que Atención no vea costos.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.snack_venta_costo (
  id_detalle BIGINT PRIMARY KEY
    REFERENCES public.snack_venta_detalle(id_detalle)
    ON DELETE CASCADE,

  costo_unitario NUMERIC(12,2) NOT NULL
    CHECK (costo_unitario >= 0),

  costo_total NUMERIC(12,2) NOT NULL
    CHECK (costo_total >= 0),

  estimado BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.snack_venta_costo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS snack_venta_costo_select_admin
ON public.snack_venta_costo;

CREATE POLICY snack_venta_costo_select_admin
ON public.snack_venta_costo
FOR SELECT
TO authenticated
USING (public.snack_es_administrador());

GRANT SELECT ON public.snack_venta_costo TO authenticated;


-- ============================================================
-- 4. AMPLIAR HISTORIAL DE RETIROS PARA VALORAR LA MERMA
-- ============================================================

ALTER TABLE public.snack_inventario_movimiento
ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC(12,2)
  CHECK (costo_unitario IS NULL OR costo_unitario >= 0);

ALTER TABLE public.snack_inventario_movimiento
ADD COLUMN IF NOT EXISTS costo_total NUMERIC(12,2)
  CHECK (costo_total IS NULL OR costo_total >= 0);

ALTER TABLE public.snack_inventario_movimiento
ADD COLUMN IF NOT EXISTS costo_estimado BOOLEAN NOT NULL DEFAULT FALSE;


-- ============================================================
-- 5. RPC ADMIN: GUARDAR PRECIO DE COMPRA
-- También completa costos históricos que todavía no tenían costo.
-- Esos registros quedan marcados como estimados.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_guardar_costo_snack(
  p_id_producto BIGINT,
  p_precio_compra NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email TEXT := '';
  v_nombre TEXT := '';
  v_backfill_ventas INTEGER := 0;
  v_backfill_retiros INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión.';
  END IF;

  IF NOT public.snack_es_administrador() THEN
    RAISE EXCEPTION 'Solo un administrador puede ver o modificar el precio de compra.';
  END IF;

  IF p_id_producto IS NULL OR p_id_producto <= 0 THEN
    RAISE EXCEPTION 'Producto inválido.';
  END IF;

  IF p_precio_compra IS NULL OR p_precio_compra < 0 THEN
    RAISE EXCEPTION 'El precio de compra debe ser igual o mayor a cero.';
  END IF;

  SELECT nombre_producto
  INTO v_nombre
  FROM public.snack_producto
  WHERE id_producto = p_id_producto;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El producto % no existe.', p_id_producto;
  END IF;

  SELECT COALESCE(email, '')
  INTO v_email
  FROM auth.users
  WHERE id = v_user_id;

  INSERT INTO public.snack_producto_costo (
    id_producto,
    precio_compra,
    updated_at,
    updated_by,
    updated_email
  )
  VALUES (
    p_id_producto,
    ROUND(p_precio_compra, 2),
    NOW(),
    v_user_id,
    v_email
  )
  ON CONFLICT (id_producto)
  DO UPDATE SET
    precio_compra = EXCLUDED.precio_compra,
    updated_at = NOW(),
    updated_by = v_user_id,
    updated_email = v_email;

  -- Ventas antiguas sin costo: se estiman con el primer costo configurado.
  INSERT INTO public.snack_venta_costo (
    id_detalle,
    costo_unitario,
    costo_total,
    estimado
  )
  SELECT
    d.id_detalle,
    ROUND(p_precio_compra, 2),
    ROUND(p_precio_compra * d.cantidad, 2),
    TRUE
  FROM public.snack_venta_detalle d
  LEFT JOIN public.snack_venta_costo c
    ON c.id_detalle = d.id_detalle
  WHERE d.id_producto = p_id_producto
    AND c.id_detalle IS NULL;

  GET DIAGNOSTICS v_backfill_ventas = ROW_COUNT;

  -- Retiros antiguos sin costo: misma lógica de estimación.
  UPDATE public.snack_inventario_movimiento
  SET
    costo_unitario = ROUND(p_precio_compra, 2),
    costo_total = ROUND(p_precio_compra * cantidad, 2),
    costo_estimado = TRUE
  WHERE id_producto = p_id_producto
    AND costo_unitario IS NULL;

  GET DIAGNOSTICS v_backfill_retiros = ROW_COUNT;

  RETURN jsonb_build_object(
    'id_producto', p_id_producto,
    'producto', v_nombre,
    'precio_compra', ROUND(p_precio_compra, 2),
    'ventas_historicas_estimadas', v_backfill_ventas,
    'retiros_historicos_estimados', v_backfill_retiros,
    'actualizado_por', v_email
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.admin_guardar_costo_snack(BIGINT, NUMERIC)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.admin_guardar_costo_snack(BIGINT, NUMERIC)
TO authenticated;


-- ============================================================
-- 6. REEMPLAZAR RPC DE VENTA
-- La venta sigue funcionando para Administrador y Atención.
-- El costo se toma internamente, pero NO se devuelve ni se expone.
-- ============================================================

CREATE OR REPLACE FUNCTION public.registrar_venta_snack(
  p_items JSONB,
  p_medio_pago TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email TEXT := '';
  v_venta_id BIGINT;
  v_item JSONB;
  v_producto public.snack_producto%ROWTYPE;
  v_producto_id BIGINT;
  v_cantidad INTEGER;
  v_subtotal NUMERIC(12,2);
  v_total NUMERIC(12,2) := 0;
  v_medio_pago TEXT;
  v_detalle_id BIGINT;
  v_costo_unitario NUMERIC(12,2);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para registrar una venta.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.usuario_roles ur
    INNER JOIN public.roles r ON r.id_rol = ur.role_id
    WHERE ur.user_id = v_user_id
      AND r.nombre IN ('administrador', 'atencion')
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para registrar ventas de snacks.';
  END IF;

  IF p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta no contiene productos.';
  END IF;

  v_medio_pago := TRIM(COALESCE(p_medio_pago, ''));

  IF v_medio_pago = '' THEN
    RAISE EXCEPTION 'Selecciona un método de pago.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.medio_pago_config m
    WHERE LOWER(TRIM(m.valor)) = LOWER(v_medio_pago)
      AND m.activo = TRUE
  ) THEN
    RAISE EXCEPTION 'El método de pago "%" no está habilitado.', v_medio_pago;
  END IF;

  SELECT m.valor
  INTO v_medio_pago
  FROM public.medio_pago_config m
  WHERE LOWER(TRIM(m.valor)) = LOWER(v_medio_pago)
    AND m.activo = TRUE
  LIMIT 1;

  SELECT COALESCE(email, '')
  INTO v_email
  FROM auth.users
  WHERE id = v_user_id;

  INSERT INTO public.snack_venta (
    medio_pago,
    total,
    vendedor_user_id,
    vendedor_email
  )
  VALUES (
    v_medio_pago,
    0,
    v_user_id,
    v_email
  )
  RETURNING id_venta INTO v_venta_id;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_items)
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

    IF v_producto.cantidad < v_cantidad THEN
      RAISE EXCEPTION
        'Stock insuficiente para %. Disponible: %, solicitado: %.',
        v_producto.nombre_producto,
        v_producto.cantidad,
        v_cantidad;
    END IF;

    v_subtotal := ROUND(v_producto.precio * v_cantidad, 2);
    v_total := v_total + v_subtotal;

    UPDATE public.snack_producto
    SET
      cantidad = cantidad - v_cantidad,
      updated_at = NOW()
    WHERE id_producto = v_producto_id;

    INSERT INTO public.snack_venta_detalle (
      id_venta,
      id_producto,
      numero_producto,
      nombre_producto,
      cantidad,
      precio_unitario,
      subtotal
    )
    VALUES (
      v_venta_id,
      v_producto.id_producto,
      v_producto.numero_producto,
      v_producto.nombre_producto,
      v_cantidad,
      v_producto.precio,
      v_subtotal
    )
    RETURNING id_detalle INTO v_detalle_id;

    v_costo_unitario := NULL;

    SELECT precio_compra
    INTO v_costo_unitario
    FROM public.snack_producto_costo
    WHERE id_producto = v_producto_id;

    IF v_costo_unitario IS NOT NULL THEN
      INSERT INTO public.snack_venta_costo (
        id_detalle,
        costo_unitario,
        costo_total,
        estimado
      )
      VALUES (
        v_detalle_id,
        v_costo_unitario,
        ROUND(v_costo_unitario * v_cantidad, 2),
        FALSE
      );
    END IF;
  END LOOP;

  UPDATE public.snack_venta
  SET total = v_total
  WHERE id_venta = v_venta_id;

  -- Importante: no devolver costo/ganancia a quien realiza la venta.
  RETURN jsonb_build_object(
    'id_venta', v_venta_id,
    'total', v_total,
    'medio_pago', v_medio_pago,
    'fecha_venta', NOW()
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.registrar_venta_snack(JSONB, TEXT)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.registrar_venta_snack(JSONB, TEXT)
TO authenticated;


-- ============================================================
-- 7. REEMPLAZAR RPC DE RETIRO
-- Guarda el costo de la merma al momento del retiro.
-- ============================================================

CREATE OR REPLACE FUNCTION public.retirar_stock_snack(
  p_id_producto BIGINT,
  p_cantidad INTEGER,
  p_motivo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email TEXT := '';
  v_producto public.snack_producto%ROWTYPE;
  v_motivo TEXT := TRIM(COALESCE(p_motivo, ''));
  v_stock_anterior INTEGER;
  v_stock_nuevo INTEGER;
  v_movimiento_id BIGINT;
  v_costo_unitario NUMERIC(12,2);
  v_costo_total NUMERIC(12,2);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para retirar productos del inventario.';
  END IF;

  IF NOT public.snack_es_administrador() THEN
    RAISE EXCEPTION 'Solo un administrador puede retirar productos del inventario.';
  END IF;

  IF p_id_producto IS NULL OR p_id_producto <= 0 THEN
    RAISE EXCEPTION 'Producto inválido.';
  END IF;

  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad a retirar debe ser mayor a cero.';
  END IF;

  IF v_motivo = '' THEN
    RAISE EXCEPTION 'Debes indicar el motivo del retiro.';
  END IF;

  SELECT *
  INTO v_producto
  FROM public.snack_producto
  WHERE id_producto = p_id_producto
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El producto % no existe.', p_id_producto;
  END IF;

  v_stock_anterior := v_producto.cantidad;

  IF p_cantidad > v_stock_anterior THEN
    RAISE EXCEPTION
      'No puedes retirar % unidades de %. Stock disponible: %.',
      p_cantidad,
      v_producto.nombre_producto,
      v_stock_anterior;
  END IF;

  v_stock_nuevo := v_stock_anterior - p_cantidad;

  SELECT COALESCE(email, '')
  INTO v_email
  FROM auth.users
  WHERE id = v_user_id;

  SELECT precio_compra
  INTO v_costo_unitario
  FROM public.snack_producto_costo
  WHERE id_producto = p_id_producto;

  IF v_costo_unitario IS NOT NULL THEN
    v_costo_total := ROUND(v_costo_unitario * p_cantidad, 2);
  ELSE
    v_costo_total := NULL;
  END IF;

  UPDATE public.snack_producto
  SET
    cantidad = v_stock_nuevo,
    updated_at = NOW()
  WHERE id_producto = p_id_producto;

  INSERT INTO public.snack_inventario_movimiento (
    id_producto,
    tipo,
    cantidad,
    motivo,
    stock_anterior,
    stock_nuevo,
    registrado_por,
    registrado_email,
    costo_unitario,
    costo_total,
    costo_estimado
  )
  VALUES (
    p_id_producto,
    'retiro',
    p_cantidad,
    v_motivo,
    v_stock_anterior,
    v_stock_nuevo,
    v_user_id,
    v_email,
    v_costo_unitario,
    v_costo_total,
    FALSE
  )
  RETURNING id_movimiento INTO v_movimiento_id;

  RETURN jsonb_build_object(
    'id_movimiento', v_movimiento_id,
    'id_producto', p_id_producto,
    'producto', v_producto.nombre_producto,
    'cantidad_retirada', p_cantidad,
    'motivo', v_motivo,
    'stock_anterior', v_stock_anterior,
    'stock_nuevo', v_stock_nuevo,
    'fecha', NOW()
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.retirar_stock_snack(BIGINT, INTEGER, TEXT)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.retirar_stock_snack(BIGINT, INTEGER, TEXT)
TO authenticated;


-- ============================================================
-- 8. RPC ADMIN: RESUMEN Y MÉTRICAS DE SNACKS
-- p_desde / p_hasta siguen el mismo filtro de fechas del Resumen.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_resumen_snacks(
  p_desde DATE DEFAULT NULL,
  p_hasta DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión.';
  END IF;

  IF NOT public.snack_es_administrador() THEN
    RAISE EXCEPTION 'Solo un administrador puede consultar la rentabilidad de snacks.';
  END IF;

  WITH ventas_filtradas AS (
    SELECT v.*
    FROM public.snack_venta v
    WHERE
      (p_desde IS NULL OR (v.fecha_venta AT TIME ZONE 'America/Bogota')::DATE >= p_desde)
      AND
      (p_hasta IS NULL OR (v.fecha_venta AT TIME ZONE 'America/Bogota')::DATE <= p_hasta)
  ),
  detalles AS (
    SELECT
      d.id_detalle,
      d.id_venta,
      d.id_producto,
      d.nombre_producto,
      d.cantidad,
      d.subtotal,
      COALESCE(c.costo_total, 0) AS costo_total,
      (c.id_detalle IS NULL) AS sin_costo,
      COALESCE(c.estimado, FALSE) AS estimado
    FROM public.snack_venta_detalle d
    INNER JOIN ventas_filtradas v
      ON v.id_venta = d.id_venta
    LEFT JOIN public.snack_venta_costo c
      ON c.id_detalle = d.id_detalle
  ),
  totales AS (
    SELECT
      (SELECT COUNT(*) FROM ventas_filtradas)::BIGINT AS ventas,
      COALESCE((SELECT SUM(total) FROM ventas_filtradas), 0)::NUMERIC AS ingresos,
      COALESCE(SUM(cantidad), 0)::BIGINT AS unidades,
      COALESCE(SUM(costo_total), 0)::NUMERIC AS costo_vendido,
      COALESCE(SUM(CASE WHEN sin_costo THEN 1 ELSE 0 END), 0)::BIGINT AS lineas_sin_costo,
      COALESCE(SUM(CASE WHEN estimado THEN 1 ELSE 0 END), 0)::BIGINT AS costos_estimados
    FROM detalles
  ),
  productos AS (
    SELECT
      id_producto,
      MAX(nombre_producto) AS nombre_producto,
      SUM(cantidad)::BIGINT AS unidades,
      SUM(subtotal)::NUMERIC AS ingresos,
      SUM(costo_total)::NUMERIC AS costo,
      (SUM(subtotal) - SUM(costo_total))::NUMERIC AS ganancia,
      CASE
        WHEN SUM(subtotal) > 0
        THEN ((SUM(subtotal) - SUM(costo_total)) / SUM(subtotal) * 100)::NUMERIC
        ELSE 0::NUMERIC
      END AS margen,
      SUM(CASE WHEN sin_costo THEN 1 ELSE 0 END)::BIGINT AS lineas_sin_costo
    FROM detalles
    GROUP BY id_producto
  ),
  metodos AS (
    SELECT
      medio_pago,
      COUNT(*)::BIGINT AS ventas,
      SUM(total)::NUMERIC AS total
    FROM ventas_filtradas
    GROUP BY medio_pago
  ),
  inventario AS (
    SELECT
      COUNT(*) FILTER (WHERE p.activo)::BIGINT AS productos_activos,
      COALESCE(SUM(p.cantidad) FILTER (WHERE p.activo), 0)::BIGINT AS stock_unidades,
      COALESCE(SUM(p.cantidad * COALESCE(c.precio_compra, 0)) FILTER (WHERE p.activo), 0)::NUMERIC AS capital_invertido,
      COALESCE(SUM(p.cantidad * p.precio) FILTER (WHERE p.activo), 0)::NUMERIC AS valor_potencial_venta,
      COUNT(*) FILTER (WHERE p.activo AND c.id_producto IS NULL)::BIGINT AS productos_sin_costo
    FROM public.snack_producto p
    LEFT JOIN public.snack_producto_costo c
      ON c.id_producto = p.id_producto
  ),
  retiros AS (
    SELECT
      COALESCE(SUM(m.cantidad), 0)::BIGINT AS retiros_unidades,
      COALESCE(SUM(m.costo_total), 0)::NUMERIC AS costo_retiros
    FROM public.snack_inventario_movimiento m
    WHERE
      (p_desde IS NULL OR (m.created_at AT TIME ZONE 'America/Bogota')::DATE >= p_desde)
      AND
      (p_hasta IS NULL OR (m.created_at AT TIME ZONE 'America/Bogota')::DATE <= p_hasta)
  )
  SELECT jsonb_build_object(
    'ventas', t.ventas,
    'ingresos', t.ingresos,
    'unidades', t.unidades,
    'costo_vendido', t.costo_vendido,
    'ganancia_bruta', t.ingresos - t.costo_vendido,
    'margen',
      CASE
        WHEN t.ingresos > 0
        THEN ((t.ingresos - t.costo_vendido) / t.ingresos * 100)
        ELSE 0
      END,
    'ticket_promedio',
      CASE WHEN t.ventas > 0 THEN t.ingresos / t.ventas ELSE 0 END,
    'lineas_sin_costo', t.lineas_sin_costo,
    'costos_estimados', t.costos_estimados,

    'retiros_unidades', r.retiros_unidades,
    'costo_retiros', r.costo_retiros,

    'productos_activos', i.productos_activos,
    'stock_unidades', i.stock_unidades,
    'capital_invertido', i.capital_invertido,
    'valor_potencial_venta', i.valor_potencial_venta,
    'ganancia_potencial', i.valor_potencial_venta - i.capital_invertido,
    'productos_sin_costo', i.productos_sin_costo,

    'top_productos',
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id_producto', p.id_producto,
            'nombre_producto', p.nombre_producto,
            'unidades', p.unidades,
            'ingresos', p.ingresos,
            'costo', p.costo,
            'ganancia', p.ganancia,
            'margen', p.margen,
            'lineas_sin_costo', p.lineas_sin_costo
          )
          ORDER BY p.unidades DESC, p.ingresos DESC
        )
        FROM productos p
      ), '[]'::JSONB),

    'metodos_pago',
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'medio_pago', m.medio_pago,
            'ventas', m.ventas,
            'total', m.total
          )
          ORDER BY m.total DESC
        )
        FROM metodos m
      ), '[]'::JSONB)
  )
  INTO v_result
  FROM totales t
  CROSS JOIN inventario i
  CROSS JOIN retiros r;

  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$$;

REVOKE ALL
ON FUNCTION public.admin_resumen_snacks(DATE, DATE)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.admin_resumen_snacks(DATE, DATE)
TO authenticated;


-- ============================================================
-- 9. COMPROBACIÓN
-- Debe devolver las tablas/funciones sin exponer costos a Atención.
-- ============================================================

SELECT
  'snack_producto_costo' AS objeto,
  COUNT(*)::BIGINT AS registros
FROM public.snack_producto_costo

UNION ALL

SELECT
  'snack_venta_costo',
  COUNT(*)::BIGINT
FROM public.snack_venta_costo;
