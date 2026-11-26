-- Checua IA - panel de métricas y preguntas frecuentes (administradores)
-- Los roles públicos NO reciben acceso al contenido de la bitácora de WhatsApp.
ALTER TABLE public.faq_bot ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS faq_admin_select ON public.faq_bot;
DROP POLICY IF EXISTS faq_admin_insert ON public.faq_bot;
DROP POLICY IF EXISTS faq_admin_update ON public.faq_bot;
DROP POLICY IF EXISTS faq_admin_delete ON public.faq_bot;
REVOKE ALL ON public.faq_bot FROM PUBLIC,anon,authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faq_bot TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.faq_bot_id_seq TO authenticated;

CREATE POLICY faq_admin_select ON public.faq_bot FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.usuario_roles ur JOIN public.roles r ON r.id_rol=ur.role_id
 WHERE ur.user_id=(select auth.uid()) AND r.nombre='administrador'));
CREATE POLICY faq_admin_insert ON public.faq_bot FOR INSERT TO authenticated
 WITH CHECK (EXISTS (SELECT 1 FROM public.usuario_roles ur JOIN public.roles r ON r.id_rol=ur.role_id
 WHERE ur.user_id=(select auth.uid()) AND r.nombre='administrador'));
CREATE POLICY faq_admin_update ON public.faq_bot FOR UPDATE TO authenticated
 USING (EXISTS (SELECT 1 FROM public.usuario_roles ur JOIN public.roles r ON r.id_rol=ur.role_id
 WHERE ur.user_id=(select auth.uid()) AND r.nombre='administrador'))
 WITH CHECK (EXISTS (SELECT 1 FROM public.usuario_roles ur JOIN public.roles r ON r.id_rol=ur.role_id
 WHERE ur.user_id=(select auth.uid()) AND r.nombre='administrador'));
CREATE POLICY faq_admin_delete ON public.faq_bot FOR DELETE TO authenticated
 USING (EXISTS (SELECT 1 FROM public.usuario_roles ur JOIN public.roles r ON r.id_rol=ur.role_id
 WHERE ur.user_id=(select auth.uid()) AND r.nombre='administrador'));

CREATE OR REPLACE FUNCTION public.checua_bot_metrics(p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF (select auth.uid()) IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.usuario_roles ur
    JOIN public.roles roles_user ON roles_user.id_rol=ur.role_id
    WHERE ur.user_id=(select auth.uid()) AND roles_user.nombre='administrador'
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para consultar las métricas del bot'
      USING ERRCODE='42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>120
     OR p_to>(now() AT TIME ZONE 'America/Bogota')::date THEN
    RAISE EXCEPTION 'Selecciona un rango válido de hasta 121 días y sin fechas futuras'
      USING ERRCODE='22023';
  END IF;

  WITH events AS MATERIALIZED (
    SELECT a.clave_cliente, a.creado_en, a.tipo_evento, a.estado_envio,
           a.primera_presentacion, a.informacion_plan_enviada,
           a.derivado_humano, a.etapa, a.respuesta_bot, a.verificacion_comercial
    FROM public.bot_mensaje_auditoria a
    WHERE a.creado_en >= (p_from::timestamp AT TIME ZONE 'America/Bogota')
      AND a.creado_en < ((p_to + 1)::timestamp AT TIME ZONE 'America/Bogota')
      AND a.clave_cliente IS NOT NULL
  ),
  contacts AS (
    SELECT clave_cliente,
      count(*) FILTER (WHERE tipo_evento='entrante') as inbound,
      count(*) FILTER (WHERE tipo_evento='saliente' AND estado_envio='aceptado_ycloud') as outbound,
      count(*) FILTER (WHERE tipo_evento='saliente' AND estado_envio<>'aceptado_ycloud') as failed,
      bool_or(tipo_evento='saliente' AND estado_envio='aceptado_ycloud' AND primera_presentacion IS TRUE AND informacion_plan_enviada IS TRUE) AS plan_shared,
      bool_or(tipo_evento='saliente' AND estado_envio='aceptado_ycloud' AND respuesta_bot ILIKE '%reservas.checua.shop/%') AS booking_link,
      bool_or(tipo_evento='saliente' AND estado_envio='aceptado_ycloud' AND etapa='como_reservar') AS booking_stage,
      bool_or(tipo_evento='saliente' AND derivado_humano IS TRUE) AS handoff,
      bool_or(tipo_evento='saliente' AND verificacion_comercial='alerta') AS alert
    FROM events GROUP BY clave_cliente
  ),
  overview AS (
    SELECT
      count(*) FILTER (WHERE inbound>0) AS contactos_entrantes,
      count(*) FILTER (WHERE outbound>0) AS contactos_atendidos,
      count(*) FILTER (WHERE inbound>0 AND outbound=0) AS contactos_sin_respuesta_bot,
      count(*) FILTER (WHERE inbound=1) AS contactos_un_mensaje,
      count(*) FILTER (WHERE inbound>=2) AS contactos_continuaron,
      coalesce(sum(inbound),0) AS mensajes_entrantes,
      coalesce(sum(outbound),0) AS mensajes_aceptados_ycloud,
      coalesce(sum(failed),0) AS mensajes_fallidos_ycloud,
      count(*) FILTER (WHERE plan_shared) AS contactos_con_plan,
      count(*) FILTER (WHERE booking_link) AS contactos_con_enlace,
      count(*) FILTER (WHERE booking_stage) AS contactos_como_reservar,
      count(*) FILTER (WHERE handoff) AS contactos_derivados,
      count(*) FILTER (WHERE alert) AS contactos_con_alerta
    FROM contacts
  ),
  daily AS (
    SELECT (creado_en AT TIME ZONE 'America/Bogota')::date AS dia,
      count(*) FILTER (WHERE tipo_evento='entrante') AS mensajes_entrantes,
      count(*) FILTER (WHERE tipo_evento='saliente' AND estado_envio='aceptado_ycloud') AS mensajes_aceptados,
      count(DISTINCT clave_cliente) FILTER (WHERE tipo_evento='entrante') AS contactos_entrantes,
      count(DISTINCT clave_cliente) FILTER (WHERE tipo_evento='saliente' AND estado_envio='aceptado_ycloud') AS contactos_atendidos,
      count(DISTINCT clave_cliente) FILTER (WHERE tipo_evento='saliente' AND estado_envio='aceptado_ycloud' AND respuesta_bot ILIKE '%reservas.checua.shop/%') AS contactos_con_enlace
    FROM events GROUP BY 1
  ),
  sales AS (
    SELECT r.id_reserva, r.aprobado, greatest(0,coalesce(r.valor_total,0)) AS valor_total
    FROM public.reserva r
    WHERE r.fecha_solicitud >= p_from::timestamp
      AND r.fecha_solicitud < (p_to+1)::timestamp
      AND length(regexp_replace(r.telefono_cliente,'[^0-9]','','g'))>=10
      AND EXISTS (
        SELECT 1 FROM public.bot_mensaje_auditoria a
        WHERE a.tipo_evento='saliente'
          AND a.estado_envio='aceptado_ycloud'
          AND length(regexp_replace(coalesce(a.clave_cliente,''),'[^0-9]','','g'))>=10
          AND (CASE WHEN length(regexp_replace(a.clave_cliente,'[^0-9]','','g'))=10
              THEN '57'||regexp_replace(a.clave_cliente,'[^0-9]','','g')
              ELSE regexp_replace(a.clave_cliente,'[^0-9]','','g') END)
             = (CASE WHEN length(regexp_replace(r.telefono_cliente,'[^0-9]','','g'))=10
              THEN '57'||regexp_replace(r.telefono_cliente,'[^0-9]','','g')
              ELSE regexp_replace(r.telefono_cliente,'[^0-9]','','g') END)
          AND a.creado_en <= (r.fecha_solicitud AT TIME ZONE 'America/Bogota')
          AND a.creado_en >= (r.fecha_solicitud AT TIME ZONE 'America/Bogota') - interval '7 days'
      )
  )
  SELECT jsonb_build_object(
    'desde',p_from,'hasta',p_to,
    'bitacora_desde',(SELECT min(creado_en) FROM public.bot_mensaje_auditoria),
    'metricas',(SELECT to_jsonb(o) FROM overview o),
    'diario',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.dia),'[]'::jsonb) FROM daily d),
    'ventas_asociadas',(
      SELECT jsonb_build_object(
        'reservas_registradas', count(*),
        'reservas_aprobadas', count(*) FILTER (WHERE aprobado IS TRUE),
        'valor_aprobado_cop', coalesce(sum(valor_total) FILTER (WHERE aprobado IS TRUE),0)
      ) FROM sales
    )
  ) INTO result;
  RETURN result;
END;
$function$

REVOKE ALL ON FUNCTION public.checua_bot_metrics(date,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.checua_bot_metrics(date,date) TO authenticated;
COMMENT ON FUNCTION public.checua_bot_metrics(date,date) IS 'Métricas agregadas Checua IA sólo para administradores. Asociación de reservas por respuesta YCloud al mismo número hasta 7 días antes, no atribución causal.';
