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
DECLARE result jsonb;
BEGIN
  IF (select auth.uid()) IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.usuario_roles ur JOIN public.roles ro ON ro.id_rol=ur.role_id
    WHERE ur.user_id=(select auth.uid()) AND ro.nombre='administrador'
  ) THEN RAISE EXCEPTION 'No tienes permisos para consultar las métricas del bot' USING ERRCODE='42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>120
    OR p_to>(now() AT TIME ZONE 'America/Bogota')::date
  THEN RAISE EXCEPTION 'Selecciona un rango válido de hasta 121 días y sin fechas futuras' USING ERRCODE='22023';
  END IF;

  WITH activated AS MATERIALIZED (
    -- Activación comprobada: al menos una respuesta DE IA aceptada por YCloud.
    -- La llegada al webhook y los seguimientos automáticos NO son activaciones.
    SELECT a.clave_cliente,
      min(a.creado_en) AS primera_respuesta_ia,
      CASE WHEN length(regexp_replace(a.clave_cliente,'[^0-9]','','g'))=10
        THEN '57'||regexp_replace(a.clave_cliente,'[^0-9]','','g')
        ELSE regexp_replace(a.clave_cliente,'[^0-9]','','g') END AS phone
    FROM public.bot_mensaje_auditoria a
    WHERE a.creado_en >= (p_from::timestamp AT TIME ZONE 'America/Bogota')
      AND a.creado_en < ((p_to+1)::timestamp AT TIME ZONE 'America/Bogota')
      AND a.clave_cliente IS NOT NULL
      AND a.tipo_evento='saliente'
      AND a.estado_envio='aceptado_ycloud'
      AND a.detalles->>'tipo_ruta'='ia'
    GROUP BY a.clave_cliente
  ),
  -- Únicamente eventos de contactos cuya activación IA fue confirmada EN este rango.
  -- La derivación humana corta la atribución: los mensajes que lleguen
  -- después NO suman al bot hasta una nueva respuesta IA aceptada.
  scoped_events_raw AS MATERIALIZED (
    SELECT a.id,a.clave_cliente,a.creado_en,a.tipo_evento,a.estado_envio,a.detalles,
      a.primera_presentacion,a.informacion_plan_enviada,a.derivado_humano,
      a.etapa,a.respuesta_bot,a.verificacion_comercial,
      max(CASE WHEN a.tipo_evento='saliente' AND a.derivado_humano IS TRUE THEN a.id END)
        OVER (PARTITION BY a.clave_cliente ORDER BY a.creado_en,a.id ROWS UNBOUNDED PRECEDING) AS last_handoff_id,
      max(CASE WHEN a.tipo_evento='saliente' AND a.estado_envio='aceptado_ycloud'
                AND a.detalles->>'tipo_ruta'='ia' THEN a.id END)
        OVER (PARTITION BY a.clave_cliente ORDER BY a.creado_en,a.id ROWS UNBOUNDED PRECEDING) AS last_ai_id
    FROM public.bot_mensaje_auditoria a
    JOIN activated c ON c.clave_cliente=a.clave_cliente
    WHERE a.creado_en >= (p_from::timestamp AT TIME ZONE 'America/Bogota')
      AND a.creado_en < ((p_to+1)::timestamp AT TIME ZONE 'America/Bogota')
  ),
  scoped_events AS (
    SELECT clave_cliente,creado_en,tipo_evento,estado_envio,detalles,
      primera_presentacion,informacion_plan_enviada,derivado_humano,
      etapa,respuesta_bot,verificacion_comercial
    FROM scoped_events_raw
    WHERE last_handoff_id IS NULL OR last_ai_id>last_handoff_id
      OR (tipo_evento='saliente' AND derivado_humano IS TRUE)
  ),
  contacts AS (
    SELECT clave_cliente,
      count(*) FILTER (WHERE tipo_evento='entrante') AS inbound,
      count(*) FILTER (WHERE tipo_evento='saliente' AND estado_envio='aceptado_ycloud') AS outgoing,
      count(*) FILTER (WHERE tipo_evento='saliente' AND estado_envio='aceptado_ycloud' AND detalles->>'tipo_ruta'='ia') AS outgoing_ai,
      count(*) FILTER (WHERE tipo_evento='saliente' AND estado_envio='aceptado_ycloud' AND detalles->>'tipo_ruta'='seguimiento') AS followups,
      count(*) FILTER (WHERE tipo_evento='saliente' AND coalesce(estado_envio,'')<>'aceptado_ycloud') AS failed,
      bool_or(tipo_evento='saliente' AND estado_envio='aceptado_ycloud' AND informacion_plan_enviada IS TRUE) AS sent_plan,
      bool_or(tipo_evento='saliente' AND estado_envio='aceptado_ycloud' AND respuesta_bot ILIKE '%reservas.checua.shop/%') AS sent_link,
      bool_or(tipo_evento='saliente' AND estado_envio='aceptado_ycloud' AND etapa='como_reservar') AS booking_stage,
      bool_or(tipo_evento='saliente' AND derivado_humano IS TRUE) AS handoff,
      bool_or(tipo_evento='saliente' AND verificacion_comercial='alerta') AS commercial_alert
    FROM scoped_events GROUP BY clave_cliente
  ),
  overview AS (
    SELECT count(*) AS contactos_activaron_bot,
      count(*) FILTER (WHERE inbound>0) AS contactos_entrantes,
      count(*) FILTER (WHERE outgoing_ai>0) AS contactos_atendidos,
      count(*) FILTER (WHERE inbound=1) AS contactos_un_mensaje,
      count(*) FILTER (WHERE inbound>=2) AS contactos_continuaron,
      0::bigint AS contactos_sin_respuesta_bot,
      coalesce(sum(inbound),0) AS mensajes_entrantes,
      coalesce(sum(outgoing),0) AS mensajes_aceptados_ycloud,
      coalesce(sum(outgoing_ai),0) AS mensajes_ia,
      coalesce(sum(followups),0) AS mensajes_seguimiento,
      coalesce(sum(failed),0) AS mensajes_fallidos_ycloud,
      count(*) FILTER (WHERE sent_plan) AS contactos_con_plan,
      count(*) FILTER (WHERE sent_link) AS contactos_con_enlace,
      count(*) FILTER (WHERE booking_stage) AS contactos_como_reservar,
      count(*) FILTER (WHERE handoff) AS contactos_derivados,
      count(*) FILTER (WHERE commercial_alert) AS contactos_con_alerta
    FROM contacts
  ),
  daily AS (
    SELECT (creado_en AT TIME ZONE 'America/Bogota')::date AS dia,
      count(*) FILTER(WHERE tipo_evento='entrante') AS mensajes_entrantes,
      count(*) FILTER(WHERE tipo_evento='saliente' AND estado_envio='aceptado_ycloud') AS mensajes_aceptados,
      count(DISTINCT clave_cliente) FILTER(WHERE tipo_evento='entrante') AS contactos_entrantes,
      count(DISTINCT clave_cliente) FILTER(WHERE tipo_evento='saliente' AND estado_envio='aceptado_ycloud' AND detalles->>'tipo_ruta'='ia') AS contactos_atendidos,
      count(DISTINCT clave_cliente) FILTER(WHERE tipo_evento='saliente' AND estado_envio='aceptado_ycloud' AND respuesta_bot ILIKE '%reservas.checua.shop/%') AS contactos_con_enlace
    FROM scoped_events GROUP BY 1
  ),
  -- Reserva asociada solamente si hubo respuesta real de IA ANTES de reservar.
  sales AS (
    SELECT r.id_reserva,r.aprobado,greatest(0,coalesce(r.valor_total,0)) AS valor_total
    FROM public.reserva r
    WHERE r.fecha_solicitud>=p_from::timestamp
      AND r.fecha_solicitud<(p_to+1)::timestamp
      AND EXISTS (
        SELECT 1 FROM activated a
        WHERE a.phone=(CASE WHEN length(regexp_replace(r.telefono_cliente,'[^0-9]','','g'))=10
          THEN '57'||regexp_replace(r.telefono_cliente,'[^0-9]','','g')
          ELSE regexp_replace(r.telefono_cliente,'[^0-9]','','g') END)
          AND length(a.phone)>=10
          AND a.primera_respuesta_ia <= (r.fecha_solicitud AT TIME ZONE 'America/Bogota')
          AND a.primera_respuesta_ia >= (r.fecha_solicitud AT TIME ZONE 'America/Bogota')-interval '7 days'
      )
  )
  SELECT jsonb_build_object(
    'desde',p_from,'hasta',p_to,
    'bitacora_desde',(SELECT min(creado_en) FROM public.bot_mensaje_auditoria),
    'criterio_activacion','Respuesta IA aceptada por YCloud dentro del rango',
    'metricas',(SELECT to_jsonb(o) FROM overview o),
    'diario',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.dia),'[]'::jsonb) FROM daily d),
    'ventas_asociadas',(
      SELECT jsonb_build_object(
        'reservas_registradas',count(*),
        'reservas_aprobadas',count(*) FILTER(WHERE aprobado IS TRUE),
        'valor_aprobado_cop',coalesce(sum(valor_total) FILTER(WHERE aprobado IS TRUE),0)
      ) FROM sales
    )
  ) INTO result;
  RETURN result;
END $function$;

REVOKE ALL ON FUNCTION public.checua_bot_metrics(date,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.checua_bot_metrics(date,date) TO authenticated;
COMMENT ON FUNCTION public.checua_bot_metrics(date,date) IS 'Métricas agregadas Checua IA sólo para administradores. Solo conversaciones con respuesta de IA aceptada por YCloud, excluye webhooks sin IA y seguimientos aislados. Ventas asociadas, no causalidad.';
