-- ============================================================
-- ROLES COORDINADOR + GUIA Y PERMISOS DE VENTA POR PUNTO
--
-- Requiere haber ejecutado previamente:
--   snack_inventory_sales.sql
--   snack_inventory_withdrawals.sql
--   snack_purchase_cost_analytics.sql
--   snack_multi_location_inventory.sql
--
-- Reglas:
--   administrador -> mantiene acceso total.
--   atencion      -> mantiene sus accesos actuales y puede vender.
--   coordinador   -> ve Control Operativo, gestiona inventario y
--                    habilita ventas a guías.
--   guia          -> solo puede vender en los puntos que un
--                    coordinador/administrador le habilite.
--
-- El precio de compra continúa siendo exclusivo de administrador.
-- ============================================================


-- ============================================================
-- 1. CREAR ROLES
-- ============================================================

INSERT INTO public.roles (nombre)
SELECT 'coordinador'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.roles
  WHERE nombre = 'coordinador'
);

INSERT INTO public.roles (nombre)
SELECT 'guia'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.roles
  WHERE nombre = 'guia'
);


-- ============================================================
-- 2. AYUDANTES DE ROL
-- ============================================================

CREATE OR REPLACE FUNCTION public.snack_es_coordinador()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_roles ur
    INNER JOIN public.roles r
      ON r.id_rol = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.nombre = 'coordinador'
  );
$$;

REVOKE ALL
ON FUNCTION public.snack_es_coordinador()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.snack_es_coordinador()
TO authenticated;


CREATE OR REPLACE FUNCTION public.snack_puede_gestionar_inventario()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_roles ur
    INNER JOIN public.roles r
      ON r.id_rol = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.nombre IN ('administrador', 'coordinador')
  );
$$;

REVOKE ALL
ON FUNCTION public.snack_puede_gestionar_inventario()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.snack_puede_gestionar_inventario()
TO authenticated;


-- ============================================================
-- 3. PERMISOS INDIVIDUALES PARA GUÍAS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.snack_guia_venta_permiso (
  user_id UUID NOT NULL
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  ubicacion_codigo TEXT NOT NULL
    REFERENCES public.snack_ubicacion(codigo)
    ON DELETE CASCADE,

  habilitado BOOLEAN NOT NULL DEFAULT FALSE,

  actualizado_por UUID
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (
    user_id,
    ubicacion_codigo
  )
);

CREATE INDEX IF NOT EXISTS idx_snack_guia_permiso_ubicacion
  ON public.snack_guia_venta_permiso(ubicacion_codigo);

ALTER TABLE public.snack_guia_venta_permiso
ENABLE ROW LEVEL SECURITY;

-- No se expone la tabla directamente.
-- Todo acceso se hace mediante funciones SECURITY DEFINER.
REVOKE ALL
ON public.snack_guia_venta_permiso
FROM PUBLIC, anon, authenticated;


-- ============================================================
-- 4. COMPROBAR SI EL USUARIO PUEDE VENDER EN UN PUNTO
-- ============================================================

CREATE OR REPLACE FUNCTION public.snack_puede_vender_en(
  p_ubicacion TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_ubicacion NOT IN ('taquilla_1', 'enclave') THEN
    RETURN FALSE;
  END IF;

  SELECT r.nombre
  INTO v_role
  FROM public.usuario_roles ur
  INNER JOIN public.roles r
    ON r.id_rol = ur.role_id
  WHERE ur.user_id = auth.uid()
  LIMIT 1;

  IF v_role IN ('administrador', 'atencion') THEN
    RETURN TRUE;
  END IF;

  IF v_role <> 'guia' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.snack_guia_venta_permiso p
    WHERE p.user_id = auth.uid()
      AND p.ubicacion_codigo = p_ubicacion
      AND p.habilitado = TRUE
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.snack_puede_vender_en(TEXT)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.snack_puede_vender_en(TEXT)
TO authenticated;


-- ============================================================
-- 5. PERMISOS DEL USUARIO ACTUAL
-- ============================================================

CREATE OR REPLACE FUNCTION public.mis_permisos_venta_snack()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := '';
  v_taquilla BOOLEAN := FALSE;
  v_enclave BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión.';
  END IF;

  SELECT COALESCE(r.nombre, '')
  INTO v_role
  FROM public.usuario_roles ur
  INNER JOIN public.roles r
    ON r.id_rol = ur.role_id
  WHERE ur.user_id = auth.uid()
  LIMIT 1;

  IF v_role IN ('administrador', 'atencion') THEN
    v_taquilla := TRUE;
    v_enclave := TRUE;
  ELSIF v_role = 'guia' THEN
    SELECT
      COALESCE(BOOL_OR(p.habilitado) FILTER (
        WHERE p.ubicacion_codigo = 'taquilla_1'
      ), FALSE),
      COALESCE(BOOL_OR(p.habilitado) FILTER (
        WHERE p.ubicacion_codigo = 'enclave'
      ), FALSE)
    INTO
      v_taquilla,
      v_enclave
    FROM public.snack_guia_venta_permiso p
    WHERE p.user_id = auth.uid();
  END IF;

  RETURN jsonb_build_object(
    'role', v_role,
    'taquilla_1', v_taquilla,
    'enclave', v_enclave
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.mis_permisos_venta_snack()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.mis_permisos_venta_snack()
TO authenticated;


-- ============================================================
-- 6. LISTAR GUÍAS PARA COORDINACIÓN
-- ============================================================

CREATE OR REPLACE FUNCTION public.listar_guias_ventas()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  taquilla_1 BOOLEAN,
  enclave BOOLEAN
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

  IF NOT (
    public.snack_es_administrador()
    OR public.snack_es_coordinador()
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para administrar accesos de guías.';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    COALESCE(u.email, '')::TEXT,
    COALESCE((
      SELECT p.habilitado
      FROM public.snack_guia_venta_permiso p
      WHERE p.user_id = u.id
        AND p.ubicacion_codigo = 'taquilla_1'
      LIMIT 1
    ), FALSE) AS taquilla_1,
    COALESCE((
      SELECT p.habilitado
      FROM public.snack_guia_venta_permiso p
      WHERE p.user_id = u.id
        AND p.ubicacion_codigo = 'enclave'
      LIMIT 1
    ), FALSE) AS enclave
  FROM auth.users u
  INNER JOIN public.usuario_roles ur
    ON ur.user_id = u.id
  INNER JOIN public.roles r
    ON r.id_rol = ur.role_id
  WHERE r.nombre = 'guia'
  ORDER BY LOWER(COALESCE(u.email, ''));
END;
$$;

REVOKE ALL
ON FUNCTION public.listar_guias_ventas()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.listar_guias_ventas()
TO authenticated;


-- ============================================================
-- 7. COORDINADOR/ADMIN HABILITA O DESHABILITA UN GUÍA
-- ============================================================

CREATE OR REPLACE FUNCTION public.actualizar_permiso_venta_guia(
  p_user_id UUID,
  p_ubicacion TEXT,
  p_habilitado BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := '';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión.';
  END IF;

  IF NOT (
    public.snack_es_administrador()
    OR public.snack_es_coordinador()
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para habilitar ventas a guías.';
  END IF;

  IF p_ubicacion NOT IN ('taquilla_1', 'enclave') THEN
    RAISE EXCEPTION 'Punto de venta inválido.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.usuario_roles ur
    INNER JOIN public.roles r
      ON r.id_rol = ur.role_id
    WHERE ur.user_id = p_user_id
      AND r.nombre = 'guia'
  ) THEN
    RAISE EXCEPTION 'El usuario seleccionado no tiene rol de guía.';
  END IF;

  SELECT COALESCE(email, '')
  INTO v_email
  FROM auth.users
  WHERE id = p_user_id;

  INSERT INTO public.snack_guia_venta_permiso (
    user_id,
    ubicacion_codigo,
    habilitado,
    actualizado_por,
    updated_at
  )
  VALUES (
    p_user_id,
    p_ubicacion,
    COALESCE(p_habilitado, FALSE),
    auth.uid(),
    NOW()
  )
  ON CONFLICT (
    user_id,
    ubicacion_codigo
  )
  DO UPDATE SET
    habilitado = EXCLUDED.habilitado,
    actualizado_por = auth.uid(),
    updated_at = NOW();

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'email', v_email,
    'ubicacion', p_ubicacion,
    'habilitado', COALESCE(p_habilitado, FALSE),
    'actualizado_por', auth.uid(),
    'fecha', NOW()
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.actualizar_permiso_venta_guia(
  UUID,
  TEXT,
  BOOLEAN
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.actualizar_permiso_venta_guia(
  UUID,
  TEXT,
  BOOLEAN
)
TO authenticated;


-- ============================================================
-- 8. SEGURIDAD DE PRODUCTOS
-- Guías pueden consultar productos para vender.
-- Solo Administración y Coordinación pueden crear/editar inventario.
-- ============================================================

DROP POLICY IF EXISTS snack_producto_select_auth
ON public.snack_producto;

DROP POLICY IF EXISTS snack_producto_select
ON public.snack_producto;

DROP POLICY IF EXISTS snack_producto_select_roles
ON public.snack_producto;

CREATE POLICY snack_producto_select_roles
ON public.snack_producto
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.usuario_roles ur
    INNER JOIN public.roles r
      ON r.id_rol = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.nombre IN (
        'administrador',
        'atencion',
        'coordinador',
        'guia'
      )
  )
);


DROP POLICY IF EXISTS snack_producto_insert_auth
ON public.snack_producto;

DROP POLICY IF EXISTS snack_producto_insert
ON public.snack_producto;

DROP POLICY IF EXISTS snack_producto_insert_gestion
ON public.snack_producto;

CREATE POLICY snack_producto_insert_gestion
ON public.snack_producto
FOR INSERT
TO authenticated
WITH CHECK (
  public.snack_puede_gestionar_inventario()
);


DROP POLICY IF EXISTS snack_producto_update_auth
ON public.snack_producto;

DROP POLICY IF EXISTS snack_producto_update
ON public.snack_producto;

DROP POLICY IF EXISTS snack_producto_update_gestion
ON public.snack_producto;

CREATE POLICY snack_producto_update_gestion
ON public.snack_producto
FOR UPDATE
TO authenticated
USING (
  public.snack_puede_gestionar_inventario()
)
WITH CHECK (
  public.snack_puede_gestionar_inventario()
);


-- ============================================================
-- 9. SEGURIDAD DE INVENTARIO POR PUNTO
-- Un guía solo puede leer el inventario que tenga habilitado.
-- ============================================================

DROP POLICY IF EXISTS snack_inventario_ubicacion_select
ON public.snack_inventario_ubicacion;

CREATE POLICY snack_inventario_ubicacion_select
ON public.snack_inventario_ubicacion
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.usuario_roles ur
    INNER JOIN public.roles r
      ON r.id_rol = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.nombre IN (
        'administrador',
        'atencion',
        'coordinador'
      )
  )
  OR public.snack_puede_vender_en(codigo_ubicacion)
);


-- ============================================================
-- 10. SEGURIDAD DE HISTORIAL DE VENTAS
-- ============================================================

DROP POLICY IF EXISTS snack_venta_select_auth
ON public.snack_venta;

DROP POLICY IF EXISTS snack_venta_select
ON public.snack_venta;

DROP POLICY IF EXISTS snack_venta_select_roles
ON public.snack_venta;

CREATE POLICY snack_venta_select_roles
ON public.snack_venta
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.usuario_roles ur
    INNER JOIN public.roles r
      ON r.id_rol = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.nombre IN (
        'administrador',
        'atencion',
        'coordinador'
      )
  )
  OR public.snack_puede_vender_en(ubicacion_codigo)
);


DROP POLICY IF EXISTS snack_detalle_select_auth
ON public.snack_venta_detalle;

DROP POLICY IF EXISTS snack_venta_detalle_select
ON public.snack_venta_detalle;

DROP POLICY IF EXISTS snack_detalle_select_roles
ON public.snack_venta_detalle;

CREATE POLICY snack_detalle_select_roles
ON public.snack_venta_detalle
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.snack_venta v
    WHERE v.id_venta = snack_venta_detalle.id_venta
      AND (
        EXISTS (
          SELECT 1
          FROM public.usuario_roles ur
          INNER JOIN public.roles r
            ON r.id_rol = ur.role_id
          WHERE ur.user_id = auth.uid()
            AND r.nombre IN (
              'administrador',
              'atencion',
              'coordinador'
            )
        )
        OR public.snack_puede_vender_en(v.ubicacion_codigo)
      )
  )
);


-- ============================================================
-- 11. COORDINADOR PUEDE AJUSTAR STOCK
-- El costo de compra NO se expone.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_fijar_stock_snack(
  p_id_producto BIGINT,
  p_ubicacion TEXT,
  p_cantidad INTEGER,
  p_motivo TEXT DEFAULT 'Ajuste manual de inventario'
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
  v_anterior INTEGER := 0;
  v_nuevo INTEGER := 0;
  v_diferencia INTEGER := 0;
  v_costo NUMERIC(12,2);
  v_total_general INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión.';
  END IF;

  IF NOT public.snack_puede_gestionar_inventario() THEN
    RAISE EXCEPTION 'Solo Administración o Coordinación pueden ajustar inventarios de snacks.';
  END IF;

  IF p_id_producto IS NULL OR p_id_producto <= 0 THEN
    RAISE EXCEPTION 'Producto inválido.';
  END IF;

  IF p_ubicacion NOT IN ('taquilla_1', 'enclave') THEN
    RAISE EXCEPTION 'Punto de inventario inválido.';
  END IF;

  IF p_cantidad IS NULL OR p_cantidad < 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser igual o mayor a cero.';
  END IF;

  SELECT *
  INTO v_producto
  FROM public.snack_producto
  WHERE id_producto = p_id_producto
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El producto % no existe.', p_id_producto;
  END IF;

  INSERT INTO public.snack_inventario_ubicacion (
    id_producto,
    codigo_ubicacion,
    cantidad
  )
  VALUES (
    p_id_producto,
    p_ubicacion,
    0
  )
  ON CONFLICT (
    id_producto,
    codigo_ubicacion
  )
  DO NOTHING;

  SELECT cantidad
  INTO v_anterior
  FROM public.snack_inventario_ubicacion
  WHERE id_producto = p_id_producto
    AND codigo_ubicacion = p_ubicacion
  FOR UPDATE;

  v_nuevo := p_cantidad;
  v_diferencia := ABS(v_nuevo - v_anterior);

  UPDATE public.snack_inventario_ubicacion
  SET
    cantidad = v_nuevo,
    updated_at = NOW()
  WHERE id_producto = p_id_producto
    AND codigo_ubicacion = p_ubicacion;

  SELECT COALESCE(email, '')
  INTO v_email
  FROM auth.users
  WHERE id = v_user_id;

  -- El costo se usa solo internamente para trazabilidad.
  -- Nunca se devuelve al coordinador.
  SELECT precio_compra
  INTO v_costo
  FROM public.snack_producto_costo
  WHERE id_producto = p_id_producto;

  IF v_diferencia > 0 THEN
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
      costo_estimado,
      ubicacion_codigo
    )
    VALUES (
      p_id_producto,
      'ajuste',
      v_diferencia,
      TRIM(COALESCE(p_motivo, 'Ajuste manual de inventario')),
      v_anterior,
      v_nuevo,
      v_user_id,
      v_email,
      v_costo,
      CASE
        WHEN v_costo IS NULL THEN NULL
        ELSE ROUND(v_costo * v_diferencia, 2)
      END,
      FALSE,
      p_ubicacion
    );
  END IF;

  v_total_general :=
    public.snack_sincronizar_total_producto(
      p_id_producto
    );

  RETURN jsonb_build_object(
    'id_producto', p_id_producto,
    'producto', v_producto.nombre_producto,
    'ubicacion', p_ubicacion,
    'stock_anterior', v_anterior,
    'stock_nuevo', v_nuevo,
    'total_general', v_total_general
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.admin_fijar_stock_snack(
  BIGINT,
  TEXT,
  INTEGER,
  TEXT
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.admin_fijar_stock_snack(
  BIGINT,
  TEXT,
  INTEGER,
  TEXT
)
TO authenticated;


-- ============================================================
-- 12. COORDINADOR PUEDE RETIRAR VENCIDOS/DAÑADOS
-- ============================================================

CREATE OR REPLACE FUNCTION public.retirar_stock_snack(
  p_id_producto BIGINT,
  p_cantidad INTEGER,
  p_motivo TEXT,
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
  v_producto public.snack_producto%ROWTYPE;
  v_stock_anterior INTEGER := 0;
  v_stock_nuevo INTEGER := 0;
  v_movimiento_id BIGINT;
  v_costo_unitario NUMERIC(12,2);
  v_costo_total NUMERIC(12,2);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para retirar productos del inventario.';
  END IF;

  IF NOT public.snack_puede_gestionar_inventario() THEN
    RAISE EXCEPTION 'Solo Administración o Coordinación pueden retirar productos del inventario.';
  END IF;

  IF p_ubicacion NOT IN ('taquilla_1', 'enclave') THEN
    RAISE EXCEPTION 'Punto de inventario inválido.';
  END IF;

  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad a retirar debe ser mayor a cero.';
  END IF;

  IF TRIM(COALESCE(p_motivo, '')) = '' THEN
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

  INSERT INTO public.snack_inventario_ubicacion (
    id_producto,
    codigo_ubicacion,
    cantidad
  )
  VALUES (
    p_id_producto,
    p_ubicacion,
    0
  )
  ON CONFLICT (
    id_producto,
    codigo_ubicacion
  )
  DO NOTHING;

  SELECT cantidad
  INTO v_stock_anterior
  FROM public.snack_inventario_ubicacion
  WHERE id_producto = p_id_producto
    AND codigo_ubicacion = p_ubicacion
  FOR UPDATE;

  IF p_cantidad > v_stock_anterior THEN
    RAISE EXCEPTION
      'No puedes retirar % unidades de %. Stock disponible en %: %.',
      p_cantidad,
      v_producto.nombre_producto,
      p_ubicacion,
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
  END IF;

  UPDATE public.snack_inventario_ubicacion
  SET
    cantidad = v_stock_nuevo,
    updated_at = NOW()
  WHERE id_producto = p_id_producto
    AND codigo_ubicacion = p_ubicacion;

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
    costo_estimado,
    ubicacion_codigo
  )
  VALUES (
    p_id_producto,
    'retiro',
    p_cantidad,
    TRIM(p_motivo),
    v_stock_anterior,
    v_stock_nuevo,
    v_user_id,
    v_email,
    v_costo_unitario,
    v_costo_total,
    FALSE,
    p_ubicacion
  )
  RETURNING id_movimiento
  INTO v_movimiento_id;

  PERFORM
    public.snack_sincronizar_total_producto(
      p_id_producto
    );

  RETURN jsonb_build_object(
    'id_movimiento', v_movimiento_id,
    'id_producto', p_id_producto,
    'producto', v_producto.nombre_producto,
    'ubicacion', p_ubicacion,
    'cantidad_retirada', p_cantidad,
    'stock_anterior', v_stock_anterior,
    'stock_nuevo', v_stock_nuevo,
    'fecha', NOW()
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.retirar_stock_snack(
  BIGINT,
  INTEGER,
  TEXT,
  TEXT
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.retirar_stock_snack(
  BIGINT,
  INTEGER,
  TEXT,
  TEXT
)
TO authenticated;


-- Compatibilidad con versión anterior.
CREATE OR REPLACE FUNCTION public.retirar_stock_snack(
  p_id_producto BIGINT,
  p_cantidad INTEGER,
  p_motivo TEXT
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.retirar_stock_snack(
    p_id_producto,
    p_cantidad,
    p_motivo,
    'taquilla_1'
  );
$$;


-- ============================================================
-- 13. VENTA SEGURA SEGÚN PERMISO INDIVIDUAL
-- ============================================================

CREATE OR REPLACE FUNCTION public.registrar_venta_snack(
  p_items JSONB,
  p_medio_pago TEXT,
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
  v_venta_id BIGINT;
  v_item JSONB;
  v_producto public.snack_producto%ROWTYPE;
  v_producto_id BIGINT;
  v_cantidad INTEGER;
  v_disponible INTEGER := 0;
  v_subtotal NUMERIC(12,2);
  v_total NUMERIC(12,2) := 0;
  v_medio_pago TEXT;
  v_detalle_id BIGINT;
  v_costo_unitario NUMERIC(12,2);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para registrar una venta.';
  END IF;

  IF p_ubicacion NOT IN ('taquilla_1', 'enclave') THEN
    RAISE EXCEPTION 'Punto de venta inválido.';
  END IF;

  IF NOT public.snack_puede_vender_en(p_ubicacion) THEN
    RAISE EXCEPTION
      'No tienes habilitadas las ventas en %.',
      CASE
        WHEN p_ubicacion = 'taquilla_1' THEN 'Taquilla 1'
        ELSE 'Enclave'
      END;
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
    vendedor_email,
    ubicacion_codigo
  )
  VALUES (
    v_medio_pago,
    0,
    v_user_id,
    v_email,
    p_ubicacion
  )
  RETURNING id_venta
  INTO v_venta_id;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items)
  LOOP
    v_producto_id :=
      NULLIF(v_item ->> 'id_producto', '')::BIGINT;

    v_cantidad :=
      NULLIF(v_item ->> 'cantidad', '')::INTEGER;

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
    ON CONFLICT (
      id_producto,
      codigo_ubicacion
    )
    DO NOTHING;

    SELECT cantidad
    INTO v_disponible
    FROM public.snack_inventario_ubicacion
    WHERE id_producto = v_producto_id
      AND codigo_ubicacion = p_ubicacion
    FOR UPDATE;

    IF v_disponible < v_cantidad THEN
      RAISE EXCEPTION
        'Stock insuficiente para % en %. Disponible: %, solicitado: %.',
        v_producto.nombre_producto,
        CASE
          WHEN p_ubicacion = 'taquilla_1' THEN 'Taquilla 1'
          ELSE 'Enclave'
        END,
        v_disponible,
        v_cantidad;
    END IF;

    v_subtotal :=
      ROUND(
        v_producto.precio * v_cantidad,
        2
      );

    v_total :=
      v_total + v_subtotal;

    UPDATE public.snack_inventario_ubicacion
    SET
      cantidad = cantidad - v_cantidad,
      updated_at = NOW()
    WHERE id_producto = v_producto_id
      AND codigo_ubicacion = p_ubicacion;

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
    RETURNING id_detalle
    INTO v_detalle_id;

    -- Costo utilizado internamente para rentabilidad.
    -- Nunca se devuelve al guía.
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
        ROUND(
          v_costo_unitario * v_cantidad,
          2
        ),
        FALSE
      );
    END IF;

    PERFORM
      public.snack_sincronizar_total_producto(
        v_producto_id
      );
  END LOOP;

  UPDATE public.snack_venta
  SET total = v_total
  WHERE id_venta = v_venta_id;

  RETURN jsonb_build_object(
    'id_venta', v_venta_id,
    'total', v_total,
    'medio_pago', v_medio_pago,
    'ubicacion', p_ubicacion,
    'fecha_venta', NOW(),
    'vendedor_user_id', v_user_id,
    'vendedor_email', v_email
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.registrar_venta_snack(
  JSONB,
  TEXT,
  TEXT
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.registrar_venta_snack(
  JSONB,
  TEXT,
  TEXT
)
TO authenticated;


-- Compatibilidad: llamadas antiguas se consideran Taquilla 1.
CREATE OR REPLACE FUNCTION public.registrar_venta_snack(
  p_items JSONB,
  p_medio_pago TEXT
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.registrar_venta_snack(
    p_items,
    p_medio_pago,
    'taquilla_1'
  );
$$;


-- ============================================================
-- 14. AYUDA PARA ASIGNAR LOS NUEVOS ROLES A CUENTAS EXISTENTES
--
-- NO EJECUTES ESTAS DOS LÍNEAS TAL CUAL.
-- Sustituye el correo por el correo real del usuario.
-- ============================================================

-- EJEMPLO COORDINADOR:
-- INSERT INTO public.usuario_roles (user_id, role_id)
-- SELECT u.id, r.id_rol
-- FROM auth.users u
-- CROSS JOIN public.roles r
-- WHERE LOWER(u.email) = LOWER('coordinador@correo.com')
--   AND r.nombre = 'coordinador'
-- ON CONFLICT (user_id) DO UPDATE SET role_id = EXCLUDED.role_id;

-- EJEMPLO GUÍA:
-- INSERT INTO public.usuario_roles (user_id, role_id)
-- SELECT u.id, r.id_rol
-- FROM auth.users u
-- CROSS JOIN public.roles r
-- WHERE LOWER(u.email) = LOWER('guia@correo.com')
--   AND r.nombre = 'guia'
-- ON CONFLICT (user_id) DO UPDATE SET role_id = EXCLUDED.role_id;


-- ============================================================
-- 15. COMPROBACIÓN
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
