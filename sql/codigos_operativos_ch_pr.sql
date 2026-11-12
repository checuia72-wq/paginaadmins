-- Códigos operativos: habilita CH (habitual) y PR (promoción).
-- Aplicado a Supabase en noviembre de 2026.
-- Se conserva codigo_ch como nombre histórico por compatibilidad.
-- Los códigos registrados y las reservas existentes no se modifican.

ALTER TABLE public.codigo_operativo
  DROP CONSTRAINT IF EXISTS codigo_operativo_codigo_formato;

ALTER TABLE public.codigo_operativo
  ADD CONSTRAINT codigo_operativo_codigo_formato
  CHECK (codigo_ch::text ~ '^(CH|PR)[0-9]{3}$');

COMMENT ON COLUMN public.codigo_operativo.codigo_ch IS
  'Código operativo de cinco caracteres: CH000-CH999 o PR000-PR999. Nombre heredado por compatibilidad con reservas y funciones actuales.';
