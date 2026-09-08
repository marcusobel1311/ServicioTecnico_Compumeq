import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Order } from '../types';

/**
 * Genera un archivo PDF (Blob) a partir de los elementos DOM visibles de la vista previa,
 * garantizando que las fuentes y el espaciado de las letras no se superpongan.
 * 
 * @param pageElementIds IDs de los elementos HTML que corresponden a cada página A4.
 */
export async function generatePdfFromElements(
  pageElementIds: string[],
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  // 1. Asegurar que las fuentes del navegador estén totalmente cargadas
  if (typeof document !== 'undefined' && 'fonts' in document) {
    await document.fonts.ready;
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // En dispositivos móviles se utiliza escala 1.25 para evitar agotar la memoria de WebKit/Canvas (OOM).
  // En ordenadores de escritorio se usa 1.5. Ambas brindan excelente nitidez y texto claro.
  const isMobile =
    typeof window !== 'undefined' &&
    (window.innerWidth < 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
  const optimalScale = isMobile ? 1.25 : 1.5;

  for (let i = 0; i < pageElementIds.length; i++) {
    if (onProgress) {
      onProgress(i + 1, pageElementIds.length);
    }

    const pageId = pageElementIds[i];
    const element = document.getElementById(pageId);

    if (!element) {
      throw new Error(`Elemento de página no encontrado: #${pageId}`);
    }

    // Pequeña pausa para permitir que el hilo de interfaz pinte y el navegador móvil no colapse
    await new Promise(resolve => setTimeout(resolve, 60));

    const canvas = await html2canvas(element, {
      scale: optimalScale,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
      windowWidth: 1024, // Simula ancho completo para que no se deforme en móviles
      onclone: (clonedDoc) => {
        // Neutralizar transformaciones y zoom de react-zoom-pan-pinch si existiesen
        const transformComponents = clonedDoc.querySelectorAll('.react-transform-component');
        transformComponents.forEach((el) => {
          (el as HTMLElement).style.transform = 'none';
          (el as HTMLElement).style.overflow = 'visible';
        });

        const transformWrappers = clonedDoc.querySelectorAll('.react-transform-wrapper');
        transformWrappers.forEach((el) => {
          (el as HTMLElement).style.transform = 'none';
          (el as HTMLElement).style.overflow = 'visible';
        });

        // Asegurar que las fuentes y espaciado de letras sean uniformes en el elemento clonado
        const targetPage = clonedDoc.getElementById(pageId);
        if (targetPage) {
          targetPage.style.fontFamily = "'Courier New', Courier, monospace";
          targetPage.style.letterSpacing = "0.02em";
          targetPage.style.transform = 'none';
        }
      },
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.90);

    // Liberar memoria del canvas inmediatamente para móviles
    canvas.width = 0;
    canvas.height = 0;

    if (i > 0) {
      pdf.addPage('a4', 'portrait');
    }

    // A4 estándar: 210mm x 297mm
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
  }

  return pdf.output('blob');
}

/**
 * Redimensiona y comprime una imagen en el cliente usando HTML5 Canvas.
 * Reduce fotos pesadas de cámaras móviles (5-15MB) a un peso ligero (~200KB)
 * preservando nitidez y legibilidad de textos y firmas.
 */
export async function compressImage(
  file: File | Blob,
  maxWidth = 1600,
  maxHeight = 2200,
  quality = 0.82
): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo obtener el contexto del canvas'));
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({ dataUrl, width, height });
      };
      img.onerror = () => reject(new Error('Error al decodificar la imagen'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(file);
  });
}

export interface FichaPdfOptions {
  orderNumber: string;
  clientName: string;
  clientCi: string;
}

/**
 * Convierte un arreglo de imágenes (las 3 fotos de la ficha firmada)
 * en un único archivo PDF que incluye en cada página el encabezado
 * obligatorio con Número de Orden, Nombre del Cliente y Cédula/RIF.
 */
export async function generateFichaPdfFromImages(
  imageFiles: (File | Blob)[],
  options: FichaPdfOptions
): Promise<Blob> {
  if (!imageFiles || imageFiles.length === 0) {
    throw new Error('Debe proporcionar al menos una imagen para generar el PDF.');
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 8;
  const headerHeight = 22;
  const availableWidth = pageWidth - marginX * 2;
  const availableHeight = pageHeight - headerHeight - 10;

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    const compressed = await compressImage(file, 1600, 2200, 0.82);

    if (i > 0) {
      pdf.addPage('a4', 'portrait');
    }

    // ── ENCABEZADO OBLIGATORIO ──────────────────────────────────
    // Fondo sutil para el encabezado
    pdf.setFillColor(243, 244, 246);
    pdf.rect(0, 0, pageWidth, headerHeight, 'F');

    // Borde divisor
    pdf.setDrawColor(209, 213, 219);
    pdf.setLineWidth(0.4);
    pdf.line(0, headerHeight, pageWidth, headerHeight);

    // Título institucional
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10.5);
    pdf.setTextColor(30, 58, 138);
    pdf.text('SERVICIO TÉCNICO COMPUMEQ — FICHA DE RECEPCIÓN', marginX, 7.5);

    // Indicador de página
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(107, 114, 128);
    pdf.text(`Página ${i + 1} de ${imageFiles.length}`, pageWidth - marginX, 7.5, { align: 'right' });

    // Datos obligatorios: Orden, Cliente, Cédula
    pdf.setFontSize(9);
    pdf.setTextColor(17, 24, 39);

    pdf.setFont('helvetica', 'bold');
    pdf.text('N° Orden: ', marginX, 15);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`#${options.orderNumber}`, marginX + 16, 15);

    const clientX = marginX + 48;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Cliente: ', clientX, 15);
    pdf.setFont('helvetica', 'normal');
    pdf.text(options.clientName, clientX + 13, 15);

    const ciX = marginX + 135;
    pdf.setFont('helvetica', 'bold');
    pdf.text('C.I./RIF: ', ciX, 15);
    pdf.setFont('helvetica', 'normal');
    pdf.text(options.clientCi || 'N/A', ciX + 15, 15);

    // ── IMAGEN DE LA FICHA (Centrada y ajustada) ───────────────
    const imgAspect = compressed.width / compressed.height;
    let renderW = availableWidth;
    let renderH = renderW / imgAspect;

    if (renderH > availableHeight) {
      renderH = availableHeight;
      renderW = renderH * imgAspect;
    }

    const posX = marginX + (availableWidth - renderW) / 2;
    const posY = headerHeight + 4 + (availableHeight - renderH) / 2;

    pdf.addImage(compressed.dataUrl, 'JPEG', posX, posY, renderW, renderH);
  }

  return pdf.output('blob');
}

/**
 * Genera la Ficha de Recepción completa (3 páginas A4) en formato PDF vectorial nativo con jsPDF.
 * - 0% uso de canvas ni clones DOM (elimina de raíz pantallas blancas y caídas de memoria en celulares).
 * - Generación instantánea en menos de 20 milisegundos.
 * - Tipografía Courier monocromática idéntica a la vista previa, nítida para impresión y liviana (~10KB).
 */
export async function generateReceptionOrderPdf(order: Order): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const check = (val: boolean, label: string) => (val ? '[X] ' : '[ ] ') + label;

  const drawHeader = (pageNumber: number) => {
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(12);
    pdf.text('FICHA DE RECEPCIÓN DE EQUIPOS', 105, 18, { align: 'center' });

    pdf.setFont('courier', 'normal');
    pdf.setFontSize(9);
    pdf.text(`N° Orden: = ${order.orderNumber || ''}`, 15, 27);
    pdf.text(`Fecha: = ${order.date || ''}`, 70, 27);
    pdf.text(`Hora: = ${order.time || ''}`, 125, 27);
    pdf.text(`Página: = ${pageNumber} de 3`, 165, 27);
  };

  const drawDashedLine = (x1: number, y: number, x2: number) => {
    pdf.setLineDashPattern([1.5, 1.5], 0);
    pdf.setLineWidth(0.2);
    pdf.line(x1, y, x2, y);
    pdf.setLineDashPattern([], 0);
  };

  // ═════════════════════════════════════════════════════════════════
  // PÁGINA 1
  // ═════════════════════════════════════════════════════════════════
  drawHeader(1);

  // INFORMACIÓN DEL CLIENTE
  let y = 37;
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(9.5);
  pdf.text('INFORMACIÓN DEL CLIENTE', 15, y);
  drawDashedLine(15, y + 2, 80);

  y += 8;
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(9);
  pdf.text(`Nombre y apellido: = ${order.client.name || ''}`, 15, y);
  pdf.text(`Teléfono: = ${order.client.phone || ''}`, 110, y);

  y += 6;
  pdf.text(`C.I./RIF: = ${order.client.ciRif || ''}`, 15, y);
  pdf.text(`Email: = ${order.client.email || ''}`, 110, y);

  // IDENTIFICACIÓN DEL EQUIPO
  y += 12;
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(9.5);
  pdf.text('IDENTIFICACIÓN DEL EQUIPO:', 15, y);
  drawDashedLine(15, y + 2, 85);

  y += 7;
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(9);
  pdf.text('Equipo:', 15, y);
  pdf.text('Accesorios incluidos:', 110, y);

  y += 5;
  pdf.setFont('courier', 'normal');
  pdf.text(check(order.equipment.type === 'Laptop', 'Laptop'), 18, y);
  pdf.text(check(order.equipment.accessories.includes('Cargador original'), 'Cargador original'), 113, y);

  y += 5;
  pdf.text(check(order.equipment.type === 'Desktop', 'Desktop'), 18, y);
  pdf.text(check(order.equipment.accessories.includes('Cargador genérico'), 'Cargador genérico'), 113, y);

  y += 5;
  pdf.text(check(order.equipment.type === 'All-in-one', 'All-in-one'), 18, y);
  pdf.text(check(order.equipment.accessories.includes('Cable de poder'), 'Cable de poder'), 113, y);

  y += 5;
  const otherEq = order.equipment.type === 'Otro' ? `: ${order.equipment.otherType || ''}` : '';
  pdf.text(check(order.equipment.type === 'Otro', `Otro${otherEq}`), 18, y);
  pdf.text(check(order.equipment.accessories.includes('Estuche/Bolso'), 'Estuche/Bolso'), 113, y);

  y += 5;
  pdf.text(check(order.equipment.accessories.includes('Ninguno'), 'Ninguno'), 113, y);

  y += 5;
  const otherAcc = order.equipment.accessories.includes('Otro') ? `: ${order.equipment.otherAccessory || ''}` : '';
  pdf.text(check(order.equipment.accessories.includes('Otro'), `Otro${otherAcc}`), 113, y);

  y += 3;
  pdf.text(`Marca/Modelo: = ${order.equipment.brandModel || ''}`, 15, y);

  y += 6;
  pdf.text(`Color: = ${order.equipment.color || ''}`, 15, y);

  y += 6;
  pdf.text(`N° de serie: = ${order.equipment.serialNumber || ''}`, 15, y);

  // SEGURIDAD DEL EQUIPO
  y += 10;
  pdf.setFont('courier', 'bold');
  pdf.text('SEGURIDAD DEL EQUIPO:', 110, y);
  drawDashedLine(110, y + 2, 170);

  y += 6;
  pdf.setFont('courier', 'normal');
  pdf.text(`Usuario: = ${order.equipment.username || ''}`, 110, y);

  y += 6;
  pdf.text(`Contraseña: = ${order.equipment.password || ''}`, 110, y);

  // ═════════════════════════════════════════════════════════════════
  // PÁGINA 2
  // ═════════════════════════════════════════════════════════════════
  pdf.addPage('a4', 'portrait');
  drawHeader(2);

  y = 37;
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(9.5);
  pdf.text('INSPECCIÓN FÍSICA Y DIAGNÓSTICO PREVIO:', 15, y);
  drawDashedLine(15, y + 2, 110);

  y += 8;
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(8.5);
  pdf.text('Encendido:', 15, y);
  pdf.text('Pantalla/Video:', 80, y);
  pdf.text('Teclado/Touchpad:', 140, y);

  y += 5;
  pdf.setFont('courier', 'normal');
  pdf.text(check(order.inspection.power.status.includes('Sí'), 'Sí'), 18, y);
  pdf.text(check(order.inspection.screen.status.includes('OK'), 'OK'), 83, y);
  pdf.text(check(order.inspection.keyboard.status.includes('OK'), 'OK'), 143, y);

  y += 4.5;
  pdf.text(check(order.inspection.power.status.includes('No'), 'No'), 18, y);
  pdf.text(check(order.inspection.screen.status.includes('Rota'), 'Rota'), 83, y);
  pdf.text(check(order.inspection.keyboard.status.includes('Faltan teclas'), 'Faltan teclas'), 143, y);

  y += 4.5;
  pdf.text(check(order.inspection.power.status.includes('Se apaga solo'), 'Se apaga'), 18, y);
  pdf.text(check(order.inspection.screen.status.includes('Rayada'), 'Rayada'), 83, y);
  pdf.text(check(order.inspection.keyboard.status.includes('No responde'), 'No responde'), 143, y);

  y += 4.5;
  pdf.text(check(order.inspection.screen.status.includes('Sin video'), 'Sin video'), 83, y);

  y += 5;
  pdf.text(`Notas: = ${order.inspection.power.notes || ''}`, 15, y);
  pdf.text(`Notas: = ${order.inspection.screen.notes || ''}`, 80, y);
  pdf.text(`Notas: = ${order.inspection.keyboard.notes || ''}`, 140, y);

  // Segunda fila de inspección
  y += 10;
  pdf.setFont('courier', 'bold');
  pdf.text('Puertos USB/Carga:', 15, y);
  pdf.text('Chasis/Tornillos:', 80, y);
  pdf.text('Unidad Óptica/Otros:', 140, y);

  y += 5;
  pdf.setFont('courier', 'normal');
  pdf.text(check(order.inspection.ports.status.includes('OK'), 'OK'), 18, y);
  pdf.text(check(order.inspection.chassis.status.includes('Completo'), 'Completo'), 83, y);
  pdf.text(check(order.inspection.opticalDrive.status.includes('OK'), 'OK'), 143, y);

  y += 4.5;
  pdf.text(check(order.inspection.ports.status.includes('Sulfatados'), 'Sulfatados'), 18, y);
  pdf.text(check(order.inspection.chassis.status.includes('Golpes'), 'Golpes'), 83, y);
  pdf.text(check(order.inspection.opticalDrive.status.includes('No aplica'), 'No aplica'), 143, y);

  y += 4.5;
  pdf.text(check(order.inspection.ports.status.includes('Flojos/Rotos'), 'Flojos/Rotos'), 18, y);
  pdf.text(check(order.inspection.chassis.status.includes('Faltan tornillos'), 'Falta torn.'), 83, y);
  pdf.text(check(order.inspection.opticalDrive.status.includes('Dañado'), 'Dañado'), 143, y);

  y += 5;
  pdf.text(`Notas: = ${order.inspection.ports.notes || ''}`, 15, y);
  pdf.text(`Notas: = ${order.inspection.chassis.notes || ''}`, 80, y);
  pdf.text(`Notas: = ${order.inspection.opticalDrive.notes || ''}`, 140, y);

  // MOTIVO DE INGRESO
  y += 12;
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(9.5);
  pdf.text('MOTIVO DE INGRESO:', 15, y);
  drawDashedLine(15, y + 2, 70);

  y += 6;
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(9);
  const failureLines = pdf.splitTextToSize(`= ${order.serviceJob.reportedFailure || 'Ninguno especificado.'}`, 180);
  pdf.text(failureLines, 15, y);
  y += (failureLines.length * 5) + 6;

  // TRABAJO SUGERIDO/SOLICITADO
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(9.5);
  pdf.text('TRABAJO SUGERIDO/SOLICITADO:', 15, y);
  drawDashedLine(15, y + 2, 85);

  y += 7;
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(8.5);
  pdf.text(check(order.serviceJob.services.includes('Mantenimiento preventivo térmico y físico'), 'Mantenimiento preventivo térmico y físico'), 18, y);
  y += 5;
  pdf.text(check(order.serviceJob.services.includes('Diagnóstico de hardware por falla'), 'Diagnóstico de hardware por falla'), 18, y);
  y += 5;
  pdf.text(check(order.serviceJob.services.includes('Optimización de Software/Sistema Operativo (OS)'), 'Optimización de Software/Sistema Operativo (OS)'), 18, y);

  y += 6;
  pdf.text('- Respaldo de datos:', 15, y);
  y += 5;
  const backupRoute = order.serviceJob.backupRoute ? ` Ruta = ${order.serviceJob.backupRoute}` : '';
  pdf.text(check(order.serviceJob.backupRequired, `Sí requiere respaldo.${backupRoute}`), 18, y);
  if (order.serviceJob.backupRequired) {
    y += 4.5;
    pdf.text(`Prioridad: [X] ${order.serviceJob.backupPriority || 'No especificada'}`, 26, y);
  }
  y += 5;
  pdf.text(check(!order.serviceJob.backupRequired, 'No requiere respaldo.'), 18, y);

  y += 6;
  const partText = order.serviceJob.partsRequested ? ` = ${order.serviceJob.partsRequested}` : '';
  pdf.text(check(!!order.serviceJob.partsRequested, `Reemplazo de pieza${partText}`), 18, y);

  // ═════════════════════════════════════════════════════════════════
  // PÁGINA 3
  // ═════════════════════════════════════════════════════════════════
  pdf.addPage('a4', 'portrait');
  drawHeader(3);

  y = 37;
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(9.5);
  pdf.text('TÉRMINOS, CONDICIONES Y RESPONSABILIDAD LEGAL:', 15, y);
  drawDashedLine(15, y + 2, 120);

  y += 8;
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(8.5);
  pdf.text('Garantía de Datos:', 15, y);
  y += 4.5;
  pdf.setFont('courier', 'normal');
  const casoA = pdf.splitTextToSize(
    `${check(!order.serviceJob.backupRequired, 'Caso A, el cliente no solicita respaldo:')} El cliente declara que ha respaldado toda información crítica. El técnico no se hace responsable por la pérdida parcial o total de datos, software o configuraciones durante el proceso de soporte o pruebas de estrés de hardware.`,
    178
  );
  pdf.text(casoA, 18, y);
  y += (casoA.length * 4.2) + 3;

  const casoB = pdf.splitTextToSize(
    `${check(order.serviceJob.backupRequired, 'Caso B, el cliente solicita respaldo y recuperación:')} El cliente autoriza expresamente al técnico a acceder a sus unidades de almacenamiento para realizar la extracción de datos. El técnico se compromete a aplicar las mejores prácticas de ingeniería para salvaguardar la información. No obstante, debido a la naturaleza impredecible de las fallas de hardware (sectores dañados, degradación magnética o chips de memoria corruptos), el cliente acepta que la recuperación total o parcial está sujeta al estado físico real del disco, eximiendo al servicio técnico de responsabilidad si los datos ya fuesen técnicamente irrecuperables al momento del ingreso.`,
    178
  );
  pdf.text(casoB, 18, y);
  y += (casoB.length * 4.2) + 4;

  pdf.setFont('courier', 'bold');
  pdf.text('Equipos Inoperativos: ', 15, y);
  pdf.setFont('courier', 'normal');
  const eqInop = pdf.splitTextToSize('Si el equipo ingresa sin encender o sin dar video, el cliente acepta que existen riesgos de fallas preexistentes ocultas en la placa lógica que imposibiliten su reparación o que se manifiesten al energizar el circuito.', 178);
  pdf.text(eqInop, 15, y + 4.2);
  y += (eqInop.length * 4.2) + 7;

  pdf.setFont('courier', 'bold');
  pdf.text('Licenciamiento: ', 15, y);
  pdf.setFont('courier', 'normal');
  const lic = pdf.splitTextToSize('El cliente es responsable de las licencias del software que solicite instalar. El servicio técnico solo provee la mano de obra de instalación y configuración.', 178);
  pdf.text(lic, 15, y + 4.2);
  y += (lic.length * 4.2) + 7;

  pdf.setFont('courier', 'bold');
  pdf.text('Retiro y Abandono: ', 15, y);
  pdf.setFont('courier', 'normal');
  const ret = pdf.splitTextToSize('Todo equipo genera un costo de almacenamiento diario de 1,00$ (1 USD al cambio, a la tasa BCV del día) si no es retirado pasados los 15 días continuos de la notificación de entrega. A los 45 días continuos, el equipo se declarará legalmente en abandono y pasará a ser propiedad del servicio técnico para cubrir costos operativos y de repuestos.', 178);
  pdf.text(ret, 15, y + 4.2);
  y += (ret.length * 4.2) + 10;

  // DECLARACIÓN DE CONFORMIDAD
  pdf.setFont('courier', 'bold');
  pdf.text('DECLARACIÓN DE CONFORMIDAD:', 15, y);
  drawDashedLine(15, y + 2, 85);
  y += 6;
  pdf.setFont('courier', 'normal');
  pdf.text('Al firmar, ambas partes validan el inventario, las fallas declaradas y aceptan las condiciones del servicio.', 15, y);

  // FIRMAS
  y = 250;
  pdf.setLineWidth(0.3);
  pdf.line(20, y, 85, y);
  pdf.line(115, y, 180, y);

  y += 4.5;
  pdf.text('Cliente / Quien entrega', 52, y, { align: 'center' });
  pdf.text('Técnico / Quien recibe', 147, y, { align: 'center' });

  y += 4.5;
  pdf.setFont('courier', 'bold');
  pdf.text((order.client.name || 'NOMBRE DEL CLIENTE').toUpperCase(), 52, y, { align: 'center' });
  pdf.text((order.technicianName || 'NOMBRE DEL TÉCNICO').toUpperCase(), 147, y, { align: 'center' });

  y += 4.5;
  pdf.setFont('courier', 'normal');
  pdf.text(`C.I.: ${order.client.ciRif || ''}`, 52, y, { align: 'center' });
  pdf.text(`C.I.: ${order.technicianCi || ''}`, 147, y, { align: 'center' });

  return pdf.output('blob');
}
