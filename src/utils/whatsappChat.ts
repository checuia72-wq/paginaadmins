/**
 * Todos los accesos desde Clientes reutilizan la misma pestaña creada
 * por Página Admin. Una pestaña de WhatsApp abierta manualmente antes
 * no puede identificarse ni controlarse desde otro sitio por seguridad.
 */
export const WHATSAPP_TAB_TARGET = "checua_whatsapp";

export function whatsappChatUrl(telefono: string): string | null {
  let digitos = String(telefono ?? "").replace(/\D/g, "");
  if (digitos.length === 10 && digitos.startsWith("3")) digitos = "57" + digitos;
  if (!/^[1-9]\d{10,14}$/.test(digitos)) return null;

  // En el PC abrimos WhatsApp Web directamente, sin pasar por wa.me,
  // que puede lanzar otra pestaña adicional durante la redirección.
  const mobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return mobile
    ? "https://wa.me/" + digitos
    : "https://web.whatsapp.com/send?phone=" + digitos;
}

/** Para las notificaciones del sistema, que no son enlaces <a>. */
export function openWhatsAppChat(url: string): boolean {
  const tab = window.open(url, WHATSAPP_TAB_TARGET);
  if (!tab) return false;
  tab.focus();
  return true;
}
