/**
 * notifications.ts — Servicio de notificaciones por correo
 *
 * Conecta con la "Api correo" local (Express + Nodemailer).
 * Endpoint: POST {VITE_EMAIL_API_URL}/api/enviar
 * Content-Type: multipart/form-data
 *
 * Campos requeridos por la API:
 *   - destinatario : string  (email del destinatario)
 *   - asunto       : string  (asunto del correo)
 *   - descripcion  : string  (cuerpo HTML / texto)
 *   - documento    : File    (archivo PDF — OBLIGATORIO por la API)
 *
 * IMPORTANTE: El endpoint requiere un PDF adjunto. Si no se provee
 * un archivo, la función lanzará un error descriptivo.
 */

// Si VITE_EMAIL_API_URL está definido (ej. en producción apuntando a Render/Railway/Vercel), se usa esa URL.
// Si no está definido o está vacío, se usa string vacío (ruta relativa '/api/enviar')
// para que pase por el proxy de Vite en desarrollo local (permitiendo acceso desde celulares/tablets en la misma red).
const EMAIL_API_BASE =
  (import.meta.env.VITE_EMAIL_API_URL as string)?.trim().replace(/\/+$/, '') || '';

export interface EmailPayload {
  /** Dirección de correo del destinatario */
  destinatario: string;
  /** Asunto del correo */
  asunto: string;
  /** Cuerpo del mensaje (texto plano; los saltos de línea se convierten en <br> en el servidor) */
  descripcion: string;
  /** Archivo PDF a adjuntar (obligatorio por la API) */
  documento: File | Blob;
  /** Nombre del archivo adjunto (opcional, por defecto "documento.pdf") */
  nombreArchivo?: string;
}

/**
 * Envía un correo con un archivo PDF adjunto a través de la Api correo local.
 *
 * @throws Error con mensaje descriptivo si la API responde con error o no está disponible.
 */
export async function sendEmailWithPdf(payload: EmailPayload): Promise<void> {
  const form = new FormData();
  form.append('destinatario', payload.destinatario);
  form.append('asunto',       payload.asunto);
  form.append('descripcion',  payload.descripcion);
  form.append(
    'documento',
    payload.documento,
    payload.nombreArchivo ?? 'documento.pdf'
  );

  let response: Response;
  try {
    response = await fetch(`${EMAIL_API_BASE}/api/enviar`, {
      method: 'POST',
      body:   form,
      // No establecer Content-Type manualmente; el browser lo fija con el boundary correcto
    });
  } catch (networkError) {
    throw new Error(
      `No se pudo conectar con la Api correo (${EMAIL_API_BASE || '/api/enviar'}). ` +
      `Asegúrese de que el servidor esté corriendo.\n` +
      String(networkError)
    );
  }

  const json = await response.json().catch(() => ({})) as { success?: boolean; message?: string };

  if (!response.ok || !json.success) {
    throw new Error(
      `Error al enviar correo: ${json.message ?? response.statusText}`
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Compatibilidad con la firma anterior (usada en ReceptionForm)
// Se mantiene para no romper ningún otro llamador.
// En el flujo de ReceptionForm, el correo se envía desde
// ServiceHistory → RegistrationModal (con PDF real).
// Esta función queda como stub informativo.
// ─────────────────────────────────────────────────────────────
export const notificationService = {
  /**
   * @deprecated Usar `sendEmailWithPdf` directamente.
   * Esta función ya no simula; simplemente re-exporta la firma
   * para retrocompatibilidad con código que la llame sin PDF.
   *
   * Si se llama desde ReceptionForm (sin PDF disponible aún),
   * loguea una advertencia y resuelve true sin enviar correo.
   * El correo real se envía desde RegistrationModal con el PDF adjunto.
   */
  sendEmailNotification: async (
    orderNumber: string,
    recipients: string[],
    subject?: string,
    message?: string
  ): Promise<boolean> => {
    console.info(
      `[notifications] Orden ${orderNumber} guardada. ` +
      `El correo con PDF se enviará desde el modal de Registro de Ficha.\n` +
      `Destinatarios previstos: ${recipients.join(', ')}\n` +
      `Asunto: ${subject}\n` +
      `Mensaje: ${message}`
    );
    // Resuelve true para no bloquear el flujo del formulario.
    // El envío real ocurre en RegistrationModal con el archivo PDF.
    return true;
  },
};
