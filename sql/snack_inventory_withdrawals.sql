-- ============================================================
-- RETIRO DE UNIDADES DEL INVENTARIO DE SNACKS
-- Ejecutar DESPUÉS de snack_inventory_sales.sql
-- Permite retirar productos vencidos, dañados o no vendibles
-- sin registrar una venta y dejando trazabilidad del movimiento.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.snack_inventario_movimiento (
    id_movimiento BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_producto BIGINT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'retiro'
        CHECK (tipo IN ('retiro')),
    cantidad INTEGER NOT NULL
        CHECK (cantidad > 0),
    motivo TEXT NOT NULL,
    stock_anterior INTEGER NOT NULL
        CHECK (stock_anterior >= 0),
    stock_nuevo INTEGER NOT NULL
        CHECK (stock_nuevo >= 0),
    registrado_por UUID,
    registrado_email TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT snack_inventario_movimiento_producto_fk
        FOREIGN KEY (id_producto)
        REFERENCES public.snack_producto(id_producto)
        ON DELETE RESTRICT,

    CONSTRAINT snack_inventario_movimiento_usuario_fk
        FOREIGN KEY (registrado_por)
        REFERENCES auth.users(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_snack_movimiento_producto
    ON public.snack_inventario_movimiento(id_producto);

CREATE INDEX IF NOT EXISTS idx_snack_movimiento_fecha
    ON public.snack_inventario_movimiento(created_at);

ALTER TABLE public.snack_inventario_movimiento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS snack_movimiento_select_admin
ON public.snack_inventario_movimiento;

CREATE POLICY snack_movimiento_select_admin
ON public.snack_inventario_movimiento
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.usuario_roles ur
        INNER JOIN public.roles r
            ON r.id_rol = ur.role_id
        WHERE ur.user_id = auth.uid()
          AND r.nombre = 'administrador'
    )
);

GRANT SELECT
ON public.snack_inventario_movimiento
TO authenticated;


-- ============================================================
-- RPC: retirar_stock_snack
-- - Solo administradores
-- - Bloquea la fila del producto durante la operación
-- - No permite retirar más unidades que las existentes
-- - Actualiza el stock
-- - Registra quién, cuánto y por qué retiró unidades
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
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión para retirar productos del inventario.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.usuario_roles ur
        INNER JOIN public.roles r
            ON r.id_rol = ur.role_id
        WHERE ur.user_id = v_user_id
          AND r.nombre = 'administrador'
    ) THEN
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
        registrado_email
    )
    VALUES (
        p_id_producto,
        'retiro',
        p_cantidad,
        v_motivo,
        v_stock_anterior,
        v_stock_nuevo,
        v_user_id,
        v_email
    )
    RETURNING id_movimiento
    INTO v_movimiento_id;

    RETURN jsonb_build_object(
        'id_movimiento', v_movimiento_id,
        'id_producto', p_id_producto,
        'producto', v_producto.nombre_producto,
        'cantidad_retirada', p_cantidad,
        'motivo', v_motivo,
        'stock_anterior', v_stock_anterior,
        'stock_nuevo', v_stock_nuevo,
        'registrado_por', v_user_id,
        'registrado_email', v_email,
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
-- COMPROBACIÓN
-- ============================================================

SELECT
    id_movimiento,
    id_producto,
    cantidad,
    motivo,
    stock_anterior,
    stock_nuevo,
    registrado_email,
    created_at
FROM public.snack_inventario_movimiento
ORDER BY created_at DESC
LIMIT 20;
