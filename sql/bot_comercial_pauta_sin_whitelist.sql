-- Checua IA: permitir atención bot a cualquier número que llegue desde pauta.
-- La validación del origen (pauta / seguimiento) y de la línea Checua 1
-- pertenece al flujo comercial de n8n, no a una whitelist en la base de datos.
-- No modificar los estados existentes ni enviar mensajes mediante esta migración.

ALTER TABLE public.cliente
  DROP CONSTRAINT IF EXISTS cliente_bot_only_authorized_test_number;

CREATE OR REPLACE FUNCTION public.checua_sincronizar_estado_atencion()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.estado_atencion = 'atencion_bot' OR NEW.bot_habilitado IS TRUE THEN
      NEW.estado_atencion := 'atencion_bot';
      NEW.atencion_humana := false;
      NEW.bot_habilitado := true;
    ELSE
      NEW.atencion_humana := (NEW.estado_atencion <> 'atencion_bot');
      NEW.bot_habilitado := false;
    END IF;
    NEW.fecha_estado_atencion := now();
  ELSE
    IF NEW.estado_atencion IS DISTINCT FROM OLD.estado_atencion THEN
      NEW.fecha_estado_atencion := now();
      NEW.atencion_humana := (NEW.estado_atencion <> 'atencion_bot');
      NEW.bot_habilitado := (NEW.estado_atencion = 'atencion_bot');
    ELSIF NEW.bot_habilitado IS DISTINCT FROM OLD.bot_habilitado
       OR NEW.atencion_humana IS DISTINCT FROM OLD.atencion_humana THEN
      IF NEW.bot_habilitado THEN
        NEW.estado_atencion := 'atencion_bot';
      ELSIF OLD.estado_atencion = 'atencion_humana_desde_bot'
            AND NEW.atencion_humana THEN
        NEW.estado_atencion := 'atencion_humana_desde_bot';
      ELSE
        NEW.estado_atencion := 'atencion_humana';
      END IF;
      NEW.fecha_estado_atencion := now();
      NEW.atencion_humana := (NEW.estado_atencion <> 'atencion_bot');
      NEW.bot_habilitado := (NEW.estado_atencion = 'atencion_bot');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.cliente.bot_habilitado IS
  'Permite el bot sin whitelist por teléfono; n8n restringe a leads de pauta de Checua 1 y respeta atención humana.';
