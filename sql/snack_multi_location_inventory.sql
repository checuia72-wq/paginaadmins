-- ============================================================
-- INVENTARIO MULTIPUNTO DE SNACKS
-- Taquilla 1 + Enclave + transferencias entre inventarios
--
-- Ejecutar DESPUÉS de:
--   snack_inventory_sales.sql
--   snack_inventory_withdrawals.sql
--   snack_purchase_cost_analytics.sql
-- ============================================================

-- ============================================================
-- 1. PUNTOS DE VENTA
-- ============================================================

CREATE TABLE IF NOT EXISTS public.snack_ubicacion (
  codigo TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.snack_ubicacion (codigo, nombre, activo)
VALUES
  ('taquilla_1', 'Taquilla 1', TRUE),
  ('enclave', 'Enclave', TRUE)
ON CONFLICT (codigo)
DO UPDATE SET
  nombre = EXCLUDED.nombre,
  activo = EXCLUDED.activo;


-- ============================================================
-- 2. INVENTARIO POR UBICACIÓN
-- ============================================================

CREATE TABLE IF NOT EXISTS public.snack_inventario_ubicacion (
  id_producto BIGINT NOT NULL
    REFERENCES public.snack_producto(id_producto)
    ON DELETE CASCADE,

  codigo_ubicacion TEXT NOT NULL
    REFERENCES public.snack_ubicacion(codigo)
    ON DELETE RESTRICT,

  cantidad INTEGER NOT NULL DEFAULT 0
    CHECK (cantidad >= 0),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (id_producto, codigo_ubicacion)
);

CREATE INDEX IF NOT EXISTS idx_snack_inventario_ubicacion_codigo
  ON public.snack_inventario_ubicacion(codigo_ubicacion);

CREATE INDEX IF NOT EXISTS idx_snack_inventario_ubicacion_producto
  ON public.snack_inventario_ubicacion(id_producto);

ALTER TABLE public.snack_inventario_ubicacion ENABLE ROW LEVEL SECURITY;

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
      AND r.nombre IN ('administrador', 'atencion')
  )
);

GRANT SELECT
ON public.snack_inventario_ubicacion
TO authenticated;


-- ============================================================
-- 3. MIGRAR EL INVENTARIO ACTUAL
-- Todo el stock existente se toma inicialmente como Taquilla 1.
-- Enclave empieza en cero.
-- ============================================================

INSERT INTO public.snack_inventario_ubicacion (
  id_producto,
  codigo_ubicacion,
  cantidad
)
SELECT
  p.id_producto,
  'taquilla_1',
  p.cantidad
FROM public.snack_producto p
ON CONFLICT (id_producto, codigo_ubicacion)
DO NOTHING;

INSERT INTO public.snack_inventario_ubicacion (
  id_producto,
  codigo_ubicacion,
  cantidad
)
SELECT
  p.id_producto,
  'enclave',
  0
FROM public.snack_producto p
ON CONFLICT (id_producto, codigo_ubicacion)
DO NOTHING;


-- ============================================================
-- 4. IDENTIFICAR PUNTO DE VENTA EN CADA VENTA
-- Las ventas anteriores se consideran Taquilla 1.
-- ============================================================

ALTER TABLE public.snack_venta
ADD COLUMN IF NOT EXISTS ubicacion_codigo TEXT NOT NULL DEFAULT 'taquilla_1';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'snack_venta_ubicacion_fk'
  ) THEN
    ALTER TABLE public.snack_venta
    ADD CONSTRAINT snack_venta_ubicacion_fk
      FOREIGN KEY (ubicacion_codigo)
      REFERENCES public.snack_ubicacion(codigo)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_snack_venta_ubicacion_fecha
  ON public.snack_venta(ubicacion_codigo, fecha_venta);


-- ============================================================
-- 5. UBICACIÓN EN RETIROS Y AJUSTES
-- ============================================================

ALTER TABLE public.snack_inventario_movimiento
ADD COLUMN IF NOT EXISTS ubicacion_codigo TEXT NOT NULL DEFAULT 'taquilla_1';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'snack_movimiento_ubicacion_fk'
  ) THEN
    ALTER TABLE public.snack_inventario_movimiento
    ADD CONSTRAINT snack_movimiento_ubicacion_fk
      FOREIGN KEY (ubicacion_codigo)
      REFERENCES public.snack_ubicacion(codigo)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

DO $
DECLARE
  v_constraint RECORD;
BEGIN
  FOR v_constraint IN
    SELECT c.conname
    FROM pg_constraint c
    INNER JOIN pg_class t ON t.oid = c.conrelid
    INNER JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'snack_inventario_movimiento'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%tipo%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.snack_inventario_movimiento DROP CONSTRAINT %I',
      v_constraint.conname
    );
  END LOOP;
END;
$;

ALTER TABLE public.snack_inventario_movimiento
ADD CONSTRAINT snack_inventario_movimiento_tipo_check
CHECK (tipo IN ('retiro', 'ajuste'));


-- ============================================================
-- 6. HISTORIAL DE TRANSFERENCIAS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.snack_transferencia (
  id_transferencia BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  id_producto BIGINT NOT NULL
    REFERENCES public.snack_producto(id_producto)
    ON DELETE RESTRICT,

  numero_producto TEXT NOT NULL,
  nombre_producto TEXT NOT NULL,

  origen_codigo TEXT NOT NULL
    REFERENCES public.snack_ubicacion(codigo)
    ON DELETE RESTRICT,

  destino_codigo TEXT NOT NULL
    REFERENCES public.snack_ubicacion(codigo)
    ON DELETE RESTRICT,

  cantidad INTEGER NOT NULL
    CHECK (cantidad > 0),

  motivo TEXT NOT NULL DEFAULT '',

  registrado_por UUID
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

  registrado_email TEXT NOT NULL DEFAULT '',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (origen_codigo <> destino_codigo)
);

CREATE INDEX IF NOT EXISTS idx_snack_transferencia_fecha
  ON public.snack_transferencia(created_at);

CREATE INDEX IF NOT EXISTS idx_snack_transferencia_producto
  ON public.snack_transferencia(id_producto);

ALTER TABLE public.snack_transferencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS snack_transferencia_select_admin
ON public.snack_transferencia;

CREATE POLICY snack_transferencia_select_admin
ON public.snack_transferencia
FOR SELECT
TO authenticated
USING (public.snack_es_administrador());

GRANT SELECT
ON public.snack_transferencia
TO authenticated;


-- ============================================================
-- 7. SINCRONIZAR EL TOTAL GENERAL DEL PRODUCTO
-- snack_producto.cantidad se conserva como total general
-- para compatibilidad con el resto del sistema.
-- ============================================================

CREATE OR REPLACE FUNCTION public.snack_sincronizar_total_producto(
  p_id_producto BIGINT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER := 0;
BEGIN
  SELECT COALESCE(SUM(cantidad), 0)::INTEGER
  INTO v_total
  FROM public.snack_inventario_ubicacion
  WHERE id_producto = p_id_producto;

  UPDATE public.snack_producto
  SET
    cantidad = v_total,
    updated_at = NOW()
  WHERE id_producto = p_id_producto;

  RETURN v_total;
END;
$$;

REVOKE ALL
ON FUNCTION public.snack_sincronizar_total_producto(BIGINT)
FROM PUBLIC;


-- ============================================================
-- 8. CREAR AUTOMÁTICAMENTE LOS DOS INVENTARIOS
-- AL CREAR UN PRODUCTO NUEVO
-- ============================================================

CREATE OR REPLACE FUNCTION public.snack_inicializar_inventarios_producto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.snack_inventario_ubicacion (
    id_producto,
    codigo_ubicacion,
    cantidad
  )
  VALUES
    (NEW.id_producto, 'taquilla_1', COALESCE(NEW.cantidad, 0)),
    (NEW.id_producto, 'enclave', 0)
  ON CONFLICT (id_producto, codigo_ubicacion)
  DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snack_inicializar_inventarios
ON public.snack_producto;

CREATE TRIGGER trg_snack_inicializar_inventarios
AFTER INSERT
ON public.snack_producto
FOR EACH ROW
EXECUTE FUNCTION public.snack_inicializar_inventarios_producto();


-- ============================================================
-- 9. RPC ADMIN: FIJAR STOCK DE UN PUNTO
-- Se usa al editar el inventario desde Administración.
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

  IF NOT public.snack_es_administrador() THEN
    RAISE EXCEPTION 'Solo un administrador puede ajustar inventarios de snacks.';
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
  ON CONFLICT (id_producto, codigo_ubicacion)
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
      CASE WHEN v_costo IS NULL THEN NULL ELSE ROUND(v_costo * v_diferencia, 2) END,
      FALSE,
      p_ubicacion
    );
  END IF;

  v_total_general := public.snack_sincronizar_total_producto(p_id_producto);

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
ON FUNCTION public.admin_fijar_stock_snack(BIGINT, TEXT, INTEGER, TEXT)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.admin_fijar_stock_snack(BIGINT, TEXT, INTEGER, TEXT)
TO authenticated;


-- ============================================================
-- 10. RPC: TRANSFERIR ENTRE TAQUILLA 1 Y ENCLAVE
-- No cambia el total general, solamente mueve unidades.
-- ============================================================

CREATE OR REPLACE FUNCTION public.transferir_stock_snack(
  p_id_producto BIGINT,
  p_cantidad INTEGER,
  p_origen TEXT,
  p_destino TEXT,
  p_motivo TEXT DEFAULT 'Traslado de inventario'
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
  v_stock_origen INTEGER := 0;
  v_stock_destino INTEGER := 0;
  v_transferencia BIGINT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión.';
  END IF;

  IF NOT public.snack_es_administrador() THEN
    RAISE EXCEPTION 'Solo un administrador puede transferir productos entre inventarios.';
  END IF;

  IF p_origen NOT IN ('taquilla_1', 'enclave')
     OR p_destino NOT IN ('taquilla_1', 'enclave') THEN
    RAISE EXCEPTION 'Origen o destino inválido.';
  END IF;

  IF p_origen = p_destino THEN
    RAISE EXCEPTION 'El origen y el destino deben ser diferentes.';
  END IF;

  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad a transferir debe ser mayor a cero.';
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
  VALUES
    (p_id_producto, p_origen, 0),
    (p_id_producto, p_destino, 0)
  ON CONFLICT (id_producto, codigo_ubicacion)
  DO NOTHING;

  PERFORM 1
  FROM public.snack_inventario_ubicacion
  WHERE id_producto = p_id_producto
    AND codigo_ubicacion IN (p_origen, p_destino)
  ORDER BY codigo_ubicacion
  FOR UPDATE;

  SELECT cantidad
  INTO v_stock_origen
  FROM public.snack_inventario_ubicacion
  WHERE id_producto = p_id_producto
    AND codigo_ubicacion = p_origen;

  SELECT cantidad
  INTO v_stock_destino
  FROM public.snack_inventario_ubicacion
  WHERE id_producto = p_id_producto
    AND codigo_ubicacion = p_destino;

  IF v_stock_origen < p_cantidad THEN
    RAISE EXCEPTION
      'Stock insuficiente en %. Disponible: %, solicitado: %.',
      p_origen,
      v_stock_origen,
      p_cantidad;
  END IF;

  UPDATE public.snack_inventario_ubicacion
  SET
    cantidad = cantidad - p_cantidad,
    updated_at = NOW()
  WHERE id_producto = p_id_producto
    AND codigo_ubicacion = p_origen;

  UPDATE public.snack_inventario_ubicacion
  SET
    cantidad = cantidad + p_cantidad,
    updated_at = NOW()
  WHERE id_producto = p_id_producto
    AND codigo_ubicacion = p_destino;

  SELECT COALESCE(email, '')
  INTO v_email
  FROM auth.users
  WHERE id = v_user_id;

  INSERT INTO public.snack_transferencia (
    id_producto,
    numero_producto,
    nombre_producto,
    origen_codigo,
    destino_codigo,
    cantidad,
    motivo,
    registrado_por,
    registrado_email
  )
  VALUES (
    p_id_producto,
    v_producto.numero_producto,
    v_producto.nombre_producto,
    p_origen,
    p_destino,
    p_cantidad,
    TRIM(COALESCE(p_motivo, 'Traslado de inventario')),
    v_user_id,
    v_email
  )
  RETURNING id_transferencia
  INTO v_transferencia;

  PERFORM public.snack_sincronizar_total_producto(p_id_producto);

  RETURN jsonb_build_object(
    'id_transferencia', v_transferencia,
    'id_producto', p_id_producto,
    'producto', v_producto.nombre_producto,
    'origen', p_origen,
    'destino', p_destino,
    'cantidad', p_cantidad,
    'stock_origen', v_stock_origen - p_cantidad,
    'stock_destino', v_stock_destino + p_cantidad,
    'fecha', NOW()
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.transferir_stock_snack(BIGINT, INTEGER, TEXT, TEXT, TEXT)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.transferir_stock_snack(BIGINT, INTEGER, TEXT, TEXT, TEXT)
TO authenticated;


-- ============================================================
-- 11. RPC DE RETIRO POR PUNTO
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

  IF NOT public.snack_es_administrador() THEN
    RAISE EXCEPTION 'Solo un administrador puede retirar productos del inventario.';
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
  ON CONFLICT (id_producto, codigo_ubicacion)
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

  PERFORM public.snack_sincronizar_total_producto(p_id_producto);

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
ON FUNCTION public.retirar_stock_snack(BIGINT, INTEGER, TEXT, TEXT)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.retirar_stock_snack(BIGINT, INTEGER, TEXT, TEXT)
TO authenticated;

-- Compatibilidad con versiones anteriores: retira desde Taquilla 1.
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
-- 12. RPC DE VENTA POR PUNTO
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.usuario_roles ur
    INNER JOIN public.roles r
      ON r.id_rol = ur.role_id
    WHERE ur.user_id = v_user_id
      AND r.nombre IN ('administrador', 'atencion')
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para registrar ventas de snacks.';
  END IF;

  IF p_ubicacion NOT IN ('taquilla_1', 'enclave') THEN
    RAISE EXCEPTION 'Punto de venta inválido.';
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
        'Stock insuficiente para % en %. Disponible: %, solicitado: %.',
        v_producto.nombre_producto,
        p_ubicacion,
        v_disponible,
        v_cantidad;
    END IF;

    v_subtotal := ROUND(v_producto.precio * v_cantidad, 2);
    v_total := v_total + v_subtotal;

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

    PERFORM public.snack_sincronizar_total_producto(v_producto_id);
  END LOOP;

  UPDATE public.snack_venta
  SET total = v_total
  WHERE id_venta = v_venta_id;

  RETURN jsonb_build_object(
    'id_venta', v_venta_id,
    'total', v_total,
    'medio_pago', v_medio_pago,
    'ubicacion', p_ubicacion,
    'fecha_venta', NOW()
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.registrar_venta_snack(JSONB, TEXT, TEXT)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.registrar_venta_snack(JSONB, TEXT, TEXT)
TO authenticated;

-- Compatibilidad con versiones anteriores: vende desde Taquilla 1.
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
-- 13. ACTUALIZAR ANALÍTICA ADMIN
-- Incluye comparación Taquilla 1 vs. Enclave.
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

  ubicaciones AS (
    SELECT
      u.codigo AS ubicacion_codigo,
      u.nombre AS ubicacion,
      COUNT(DISTINCT v.id_venta)::BIGINT AS ventas,
      COALESCE(SUM(d.cantidad), 0)::BIGINT AS unidades,
      COALESCE(SUM(d.subtotal), 0)::NUMERIC AS ingresos
    FROM public.snack_ubicacion u
    LEFT JOIN ventas_filtradas v
      ON v.ubicacion_codigo = u.codigo
    LEFT JOIN public.snack_venta_detalle d
      ON d.id_venta = v.id_venta
    WHERE u.activo = TRUE
    GROUP BY u.codigo, u.nombre
  ),

  inventario AS (
    SELECT
      (SELECT COUNT(*) FROM public.snack_producto p WHERE p.activo)::BIGINT AS productos_activos,
      COALESCE(SUM(i.cantidad), 0)::BIGINT AS stock_unidades,
      COALESCE(SUM(i.cantidad * COALESCE(c.precio_compra, 0)), 0)::NUMERIC AS capital_invertido,
      COALESCE(SUM(i.cantidad * p.precio), 0)::NUMERIC AS valor_potencial_venta,
      (
        SELECT COUNT(*)::BIGINT
        FROM public.snack_producto p2
        LEFT JOIN public.snack_producto_costo c2
          ON c2.id_producto = p2.id_producto
        WHERE p2.activo = TRUE
          AND c2.id_producto IS NULL
      ) AS productos_sin_costo
    FROM public.snack_inventario_ubicacion i
    INNER JOIN public.snack_producto p
      ON p.id_producto = i.id_producto
     AND p.activo = TRUE
    LEFT JOIN public.snack_producto_costo c
      ON c.id_producto = p.id_producto
  ),

  retiros AS (
    SELECT
      COALESCE(SUM(m.cantidad), 0)::BIGINT AS retiros_unidades,
      COALESCE(SUM(m.costo_total), 0)::NUMERIC AS costo_retiros
    FROM public.snack_inventario_movimiento m
    WHERE m.tipo = 'retiro'
      AND (p_desde IS NULL OR (m.created_at AT TIME ZONE 'America/Bogota')::DATE >= p_desde)
      AND (p_hasta IS NULL OR (m.created_at AT TIME ZONE 'America/Bogota')::DATE <= p_hasta)
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
      CASE
        WHEN t.ventas > 0
        THEN t.ingresos / t.ventas
        ELSE 0
      END,

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
      ), '[]'::JSONB),

    'ubicaciones',
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'ubicacion_codigo', u.ubicacion_codigo,
            'ubicacion', u.ubicacion,
            'ventas', u.ventas,
            'unidades', u.unidades,
            'ingresos', u.ingresos
          )
          ORDER BY u.ingresos DESC, u.ubicacion
        )
        FROM ubicaciones u
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
-- 14. COMPROBACIÓN
-- ============================================================

SELECT
  p.numero_producto,
  p.nombre_producto,
  COALESCE(t.cantidad, 0) AS taquilla_1,
  COALESCE(e.cantidad, 0) AS enclave,
  COALESCE(t.cantidad, 0) + COALESCE(e.cantidad, 0) AS total
FROM public.snack_producto p
LEFT JOIN public.snack_inventario_ubicacion t
  ON t.id_producto = p.id_producto
 AND t.codigo_ubicacion = 'taquilla_1'
LEFT JOIN public.snack_inventario_ubicacion e
  ON e.id_producto = p.id_producto
 AND e.codigo_ubicacion = 'enclave'
ORDER BY p.numero_producto;
