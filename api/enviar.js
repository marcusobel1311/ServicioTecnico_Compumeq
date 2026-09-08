/**
 * api/enviar.js — Vercel Serverless Function
 *
 * Reemplaza el servidor Express local (Api correo).
 * Vercel detecta automáticamente la carpeta /api y expone este handler en:
 *   POST /api/enviar
 *
 * Variables de entorno requeridas (configurar en el panel de Vercel):
 *   EMAIL_USER  — correo Gmail remitente
 *   EMAIL_PASS  — contraseña de aplicación de Gmail (App Password)
 *
 * Contrato de API (idéntico al servidor local):
 *   Content-Type: multipart/form-data
 *   Campos: destinatario, asunto, descripcion, documento (PDF)
 */

import formidable from 'formidable';
import nodemailer from 'nodemailer';
import { promises as fs } from 'fs';

// Desactivar el bodyParser de Vercel para manejar multipart manualmente
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // ── CORS ────────────────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  // ── Parsear multipart/form-data ─────────────────────────────────────────────
  const form = formidable({
    maxFileSize: 50 * 1024 * 1024, // 50 MB
    filter: ({ mimetype }) => mimetype === 'application/pdf',
  });

  let fields, files;
  try {
    [fields, files] = await form.parse(req);
  } catch (parseError) {
    console.error('Error parseando formulario:', parseError);
    return res.status(400).json({ success: false, message: 'Error al procesar el formulario: ' + parseError.message });
  }

  // Formidable v3+ devuelve arrays para cada campo
  const destinatario = Array.isArray(fields.destinatario) ? fields.destinatario[0] : fields.destinatario;
  const asunto       = Array.isArray(fields.asunto)       ? fields.asunto[0]       : fields.asunto;
  const descripcion  = Array.isArray(fields.descripcion)  ? fields.descripcion[0]  : fields.descripcion;
  const documento    = files.documento?.[0];

  if (!documento) {
    return res.status(400).json({ success: false, message: 'No se subió ningún archivo PDF.' });
  }

  if (!destinatario || !asunto) {
    return res.status(400).json({ success: false, message: 'Faltan campos obligatorios: destinatario, asunto.' });
  }

  // ── Leer el PDF del sistema de archivos temporal ────────────────────────────
  let pdfBuffer;
  try {
    pdfBuffer = await fs.readFile(documento.filepath);
  } catch (readError) {
    console.error('Error leyendo el PDF:', readError);
    return res.status(500).json({ success: false, message: 'Error leyendo el PDF adjunto.' });
  }

  // ── Enviar correo con Nodemailer ────────────────────────────────────────────
  const descripcionHtml = descripcion ? descripcion.replace(/\n/g, '<br>') : '';

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from:    `"Envíos Compumeq" <${process.env.EMAIL_USER}>`,
      to:      destinatario,
      subject: asunto,
      html:    `<div style="font-family:sans-serif;">${descripcionHtml}</div>`,
      attachments: [
        {
          filename:    documento.originalFilename || 'documento.pdf',
          content:     pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    return res.status(200).json({ success: true, message: '¡Correo enviado con éxito!' });
  } catch (mailError) {
    console.error('Error enviando correo:', mailError);
    return res.status(500).json({
      success: false,
      message: 'Error enviando correo: ' + mailError.message,
    });
  }
}
