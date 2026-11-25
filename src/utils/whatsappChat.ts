/**
 * Enlace al chat: el número se valida para evitar redirecciones indebidas.
 * Abrir WhatsApp desde una pestaña previamente creada no es fiable por
 * aislamiento entre sitios (COOP). Usamos la pestaña actual para garantizar
 * que no se abra una pestaña adicional en cada clic.
 */
export function whatsappChatUrl(telefono: string): string | null {
  let digitos = String(telefono ?? "").replace(/\D/g, "");
  if (digitos.length === 10 && digitos.startsWith("3")) digitos = "57" + digitos;
  if (!/^[1-9]\d{10,14}$/.test(digitos)) return null;
  const mobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return mobile
    ? "https://wa.me/" + digitos
    : "https://web.whatsapp.com/send?phone=" + digitos;
}

/** Navega desde Página Admin a WhatsApp SIN crear ventanas ni pestañas. */
export function openWhatsAppChat(url: string): void {
  window.location.assign(url);
}
