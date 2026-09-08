import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { dbService } from '../services/db';
import { sendEmailWithPdf } from '../services/notifications';
import { generateReceptionOrderPdf } from '../services/pdfGenerator';
import { Order, Technician } from '../types';
import { Printer, CheckCircle, Search, Loader2, ArrowLeft, Check, Plus, X, Mail } from 'lucide-react';
import PrintLayout from './PrintLayout';
import FrequentEmailInput from './FrequentEmailInput';

const getEmptyOrder = (): Order => ({
  orderNumber: '',
  date: new Date().toISOString().split('T')[0],
  time: new Date().toTimeString().split(' ')[0].substring(0, 5),
  client: { name: '', ciRif: '', phone: '', email: '' },
  equipment: { type: 'Laptop', brandModel: '', color: '', serialNumber: '', accessories: [], password: '' },
  inspection: {
    power: { status: [], notes: '' },
    screen: { status: [], notes: '' },
    keyboard: { status: [], notes: '' },
    ports: { status: [], notes: '' },
    chassis: { status: [], notes: '' },
    opticalDrive: { status: [], notes: '' }
  },
  serviceJob: { reportedFailure: '', services: [], backupRequired: false, hasPartsReplacement: false, partsRequested: '' },
  status: 'Recibido'
});

export default function ReceptionForm({ allowDateEdit = false, onSave }: { allowDateEdit?: boolean, onSave?: () => void } = {}) {
  const [order, setOrder] = useState<Order>(getEmptyOrder());
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [techError, setTechError] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [emailForm, setEmailForm] = useState({
    recipients: [''],
    subject: 'Ficha de Recepción de Equipo',
    message: 'Adjunto enviamos la ficha de recepción de su equipo.'
  });
  // Ref para evitar actualizaciones de estado después del desmontaje del componente.
  const isMounted = React.useRef(true);
  const toastTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMounted.current = true;
    dbService.getTechnicians().then(setTechnicians);
    dbService.getNextOrderNumber().then(num => {
      setOrder(prev => (prev.orderNumber ? prev : { ...prev, orderNumber: num }));
    });
    return () => {
      isMounted.current = false;
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const handleClientSearch = async () => {
    if (!order.client.ciRif) return;
    setIsSearchingClient(true);
    const client = await dbService.findClientByCiRif(order.client.ciRif);
    if (client) {
      setOrder(prev => ({ ...prev, client }));
      showToast('Cliente encontrado y auto-completado');
    } else {
      showToast('Cliente no encontrado, registre los datos');
    }
    setIsSearchingClient(false);
  };

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage('');
      toastTimeoutRef.current = null;
    }, 6000);
  };

  const resetForm = async () => {
    try {
      const nextNum = await dbService.getNextOrderNumber();
      setOrder({
        ...getEmptyOrder(),
        orderNumber: nextNum,
      });
    } catch {
      setOrder(getEmptyOrder());
    }
    setIsPreview(false);
  };

  const handlePreview = async () => {
    // 1. Validación obligatoria de Selección de Técnico
    if (!order.technicianId) {
      setTechError(true);
      showToast('⚠️ La selección de un Técnico Asignado es obligatoria.');
      const techEl = document.getElementById('technician-select');
      if (techEl) {
        techEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        techEl.focus();
      }
      return;
    }
    setTechError(false);

    let currentOrderNumber = order.orderNumber;
    if (!currentOrderNumber) {
      currentOrderNumber = await dbService.getNextOrderNumber();
      setOrder(prev => ({ ...prev, orderNumber: currentOrderNumber }));
    }

    const typeText = order.equipment.type === 'Otro' && order.equipment.otherType ? order.equipment.otherType : order.equipment.type;

    setEmailForm({
      recipients: [''],
      subject: `Ficha para (IMPRIMIR) Recepción de Equipo - Orden N° ${currentOrderNumber}`,
      message: `Adjunto enviamos la ficha de recepción del equipo (${typeText}).\n\nPor favor, imprimir este comprobante.\n\nSaludos y Muchas Gracias!! \nServicio Técnico`
    });

    setIsPreview(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleConfirmAndSend = async () => {
    // 1. Validación obligatoria de campos en Enviar por Correo
    const rawRecipients = emailForm.recipients.map(r => r.trim());
    const validRecipients = rawRecipients.filter(r => r.length > 0);

    if (validRecipients.length === 0) {
      showToast('⚠️ Ingrese al menos un correo de destinatario.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of validRecipients) {
      if (!emailRegex.test(email)) {
        showToast(`⚠️ El correo "${email}" no tiene un formato válido.`);
        return;
      }
    }

    if (!emailForm.subject.trim()) {
      showToast('⚠️ El asunto del correo es obligatorio.');
      return;
    }

    if (!emailForm.message.trim()) {
      showToast('⚠️ El mensaje del correo es obligatorio.');
      return;
    }

    setIsSaving(true);
    try {
      let finalOrderNumber = order.orderNumber;
      if (!finalOrderNumber) {
        finalOrderNumber = await dbService.getNextOrderNumber();
      }

      const finalOrder: Order = {
        ...order,
        orderNumber: finalOrderNumber,
        fichaRegistrada: false,
      };

      setOrder(finalOrder);

      // 2. Generación automática del archivo PDF vectorial
      showToast('📄 Generando documento PDF...');
      const pdfBlob = await generateReceptionOrderPdf(finalOrder);

      const pdfFileName = `Ficha_Recepcion_${finalOrderNumber}.pdf`;
      const pdfFile = typeof File !== 'undefined'
        ? new File([pdfBlob], pdfFileName, { type: 'application/pdf' })
        : (Object.assign(pdfBlob, { name: pdfFileName }) as File);

      // 3. Guardar orden en Supabase
      showToast('💾 Guardando orden en el sistema...');
      const saved = await dbService.saveOrder(finalOrder);
      if (saved?.id) {
        setOrder(prev => ({ ...prev, id: saved.id, orderNumber: saved.orderNumber }));
      }

      // 4. Envío automático por correo a cada destinatario
      showToast('📧 Enviando ficha por correo...');
      let emailErrorMsg = '';
      try {
        for (const destinatario of validRecipients) {
          await sendEmailWithPdf({
            destinatario,
            asunto: emailForm.subject.trim(),
            descripcion: emailForm.message.trim(),
            documento: pdfFile,
            nombreArchivo: pdfFileName,
          });
        }
      } catch (mailErr) {
        console.error('[ReceptionForm] Error al enviar correo:', mailErr);
        emailErrorMsg = mailErr instanceof Error ? mailErr.message : 'Error al conectar con el servidor de correo.';
      }

      if (emailErrorMsg) {
        showToast(`⚠️ Orden #${finalOrderNumber} guardada, pero no se pudo enviar el correo: ${emailErrorMsg}`);
      } else {
        showToast('✅ ¡Orden guardada y correo enviado exitosamente!');
      }

      setTimeout(async () => {
        try {
          if (onSave) {
            onSave();
          }
          if (isMounted.current) {
            await resetForm();
          }
        } catch {
          // Ignorar errores de desmontaje del DOM durante el reseteo
        }
      }, 3500);

    } catch (err) {
      console.error('[ReceptionForm] handleConfirmAndSend:', err);
      const msg = err instanceof Error ? err.message : (typeof err === 'string' ? err : JSON.stringify(err));
      showToast(`❌ ${msg || 'Error desconocido al procesar la orden.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const updateClient = (field: keyof Order['client'], value: string) => {
    setOrder(prev => ({ ...prev, client: { ...prev.client, [field]: value } }));
  };

  const handleCIChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase();
    const isDeleting = (e.nativeEvent as InputEvent).inputType === 'deleteContentBackward';

    if (!val || (isDeleting && ['V', 'E', 'J'].includes(val))) {
      updateClient('ciRif', '');
      return;
    }

    let prefix = '';
    if (val.startsWith('V')) prefix = 'V';
    else if (val.startsWith('E')) prefix = 'E';
    else if (val.startsWith('J')) prefix = 'J';
    else if (val.includes('V')) prefix = 'V';
    else if (val.includes('E')) prefix = 'E';
    else if (val.includes('J')) prefix = 'J';
    else if (/\d/.test(val)) prefix = 'V'; // por defecto V si escribe números

    let digits = val.replace(/\D/g, '');

    if (!digits) {
      if (prefix) {
        updateClient('ciRif', `${prefix}-`);
      } else {
        updateClient('ciRif', '');
      }
      return;
    }

    if (prefix === 'J') {
      if (digits.length > 9) digits = digits.slice(0, 9);
      let formatted = `J-${digits}`;
      if (digits.length > 8) {
        formatted = `J-${digits.slice(0, 8)}-${digits.slice(8)}`;
      }
      updateClient('ciRif', formatted);
    } else {
      if (digits.length > 8) digits = digits.slice(0, 8);
      const withDots = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      updateClient('ciRif', `${prefix || 'V'}-${withDots}`);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;

    if (!val) {
      updateClient('phone', '');
      return;
    }

    const raw = val.replace(/[^\d+]/g, '');

    if (raw === '+' || raw === '+5' || raw === '+58') {
      updateClient('phone', raw);
      return;
    }

    let digits = raw.replace(/\D/g, '');
    let numberPart = digits;

    if (digits.startsWith('58')) {
      numberPart = digits.slice(2);
    }

    if (numberPart.startsWith('0')) {
      numberPart = numberPart.slice(1);
    }

    if (numberPart.length > 10) {
      numberPart = numberPart.slice(0, 10);
    }

    let formatted = '';
    if (numberPart.length > 0) {
      formatted = '+58 ';
      const operator = numberPart.slice(0, 3);
      const part1 = numberPart.slice(3, 6);
      const part2 = numberPart.slice(6, 10);

      formatted += operator;
      if (part1) formatted += `-${part1}`;
      if (part2) formatted += `-${part2}`;
    } else if (digits.length > 0) {
      formatted = '+' + digits;
    } else {
      formatted = raw;
    }

    updateClient('phone', formatted);
  };

  const updateEquipment = (field: keyof Order['equipment'], value: any) => {
    setOrder(prev => ({ ...prev, equipment: { ...prev.equipment, [field]: value } }));
  };

  const toggleEquipmentAccessory = (accessory: string) => {
    setOrder(prev => {
      const accs = prev.equipment.accessories;
      const newAccs = accs.includes(accessory) ? accs.filter(a => a !== accessory) : [...accs, accessory];
      return { ...prev, equipment: { ...prev.equipment, accessories: newAccs } };
    });
  };

  const updateInspection = (category: keyof Order['inspection'], field: 'status' | 'notes', value: any) => {
    setOrder(prev => ({
      ...prev,
      inspection: {
        ...prev.inspection,
        [category]: { ...prev.inspection[category], [field]: value }
      }
    }));
  };

  const toggleInspectionStatus = (category: keyof Order['inspection'], statusValue: string) => {
    setOrder(prev => {
      const currentStatus = prev.inspection[category].status;
      const newStatus = currentStatus.includes(statusValue)
        ? currentStatus.filter(s => s !== statusValue)
        : [...currentStatus, statusValue];
      return {
        ...prev,
        inspection: {
          ...prev.inspection,
          [category]: { ...prev.inspection[category], status: newStatus }
        }
      };
    });
  };

  const updateServiceJob = (field: keyof Order['serviceJob'], value: any) => {
    setOrder(prev => ({ ...prev, serviceJob: { ...prev.serviceJob, [field]: value } }));
  };

  const toggleServiceJob = (service: string) => {
    setOrder(prev => {
      const services = prev.serviceJob.services;
      const newServices = services.includes(service) ? services.filter(s => s !== service) : [...services, service];
      return { ...prev, serviceJob: { ...prev.serviceJob, services: newServices } };
    });
  };

  return (
    <>
      {typeof document !== 'undefined' && toastMessage
        ? createPortal(
          <div
            className="fixed bottom-20 left-4 right-4 sm:bottom-4 sm:right-4 sm:left-auto sm:w-auto bg-neutral-800 text-white px-4 py-3 rounded-lg shadow-2xl flex items-center gap-2 print:hidden transition-all pointer-events-none"
            style={{ zIndex: 999999 }}
          >
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            <span className="text-sm font-medium">{toastMessage}</span>
          </div>,
          document.body
        )
        : null}

      {isPreview ? (
        <div className="print:hidden space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-neutral-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-800">Vista Previa</h2>
              <p className="text-sm sm:text-base text-neutral-500">Revise la información antes de confirmar y generar la orden.</p>
            </div>
            <div className="flex w-full md:w-auto gap-3 sm:gap-4">
              <button
                onClick={() => setIsPreview(false)}
                className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-3 sm:py-2 rounded-lg font-medium text-neutral-600 hover:bg-neutral-100 transition-colors border border-neutral-200 bg-white"
              >
                <ArrowLeft className="w-5 h-5" />
                Atrás y Editar
              </button>
            </div>
          </div>

          <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
            <PrintLayout order={order} previewMode={true} />
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200 mt-6">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-neutral-800">Enviar por Correo</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Destinatario(s) <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="space-y-3">
                  {emailForm.recipients.map((recipient, index) => (
                    <FrequentEmailInput
                      key={index}
                      index={index}
                      value={recipient}
                      onChange={(val) => {
                        const newRecipients = [...emailForm.recipients];
                        newRecipients[index] = val;
                        setEmailForm(prev => ({ ...prev, recipients: newRecipients }));
                      }}
                      placeholder="correo@ejemplo.com"
                      required
                      showRemove={emailForm.recipients.length > 1}
                      onRemove={() => {
                        const newRecipients = emailForm.recipients.filter((_, i) => i !== index);
                        setEmailForm(prev => ({ ...prev, recipients: newRecipients }));
                      }}
                      showAdd={index === emailForm.recipients.length - 1}
                      onAdd={() => setEmailForm(prev => ({ ...prev, recipients: [...prev.recipients, ''] }))}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Asunto <span className="text-red-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
                  required
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Mensaje <span className="text-red-500 font-bold">*</span>
                </label>
                <textarea
                  rows={4}
                  value={emailForm.message}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, message: e.target.value }))}
                  required
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pb-4 sm:pb-0">
            <button
              onClick={handleConfirmAndSend}
              disabled={isSaving}
              className="w-full sm:w-auto flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 sm:py-2 rounded-lg font-medium shadow-lg shadow-blue-500/30 transition-all active:scale-95 disabled:opacity-70"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              {isSaving ? 'Procesando y Enviando...' : 'Confirmar y Enviar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="print:hidden space-y-5 md:space-y-6">
          <div className="bg-white p-5 md:p-6 rounded-xl shadow-sm border border-neutral-200 mb-5 md:mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base md:text-2xl font-bold text-neutral-800 leading-tight">{allowDateEdit ? 'Registrar Servicio Anterior' : 'Nueva Recepción'}</h2>
                  <p className="hidden md:block text-xs md:text-base text-neutral-500 mt-0.5">Complete los datos para generar la ficha de ingreso.</p>
                </div>
              </div>

              <div className="flex flex-row flex-wrap gap-2 md:gap-4 items-end">
                {allowDateEdit && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Fecha</label>
                      <input
                        type="date"
                        value={order.date}
                        onChange={e => setOrder(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Hora</label>
                      <input
                        type="time"
                        value={order.time}
                        onChange={e => setOrder(prev => ({ ...prev, time: e.target.value }))}
                        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                  </>
                )}

                <div className="min-w-[250px]">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Técnico Asignado <span className="text-red-500 font-bold">*</span>
                  </label>
                  <select
                    id="technician-select"
                    value={order.technicianId || ''}
                    onChange={e => {
                      setTechError(false);
                      const tech = technicians.find(t => t.id === e.target.value);
                      if (tech) {
                        setOrder(prev => ({ ...prev, technicianId: tech.id, technicianName: tech.name, technicianCi: tech.ci }));
                      } else {
                        setOrder(prev => ({ ...prev, technicianId: '', technicianName: '', technicianCi: '' }));
                      }
                    }}
                    className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white transition-colors ${techError
                      ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-500'
                      : 'border-neutral-300 focus:ring-blue-500'
                      }`}
                  >
                    <option value="">-- Seleccione un técnico (Obligatorio) --</option>
                    {technicians.map(tech => (
                      <option key={tech.id} value={tech.id}>{tech.name}</option>
                    ))}
                  </select>
                  {techError && (
                    <p className="text-xs text-red-600 mt-1 font-medium">Debe seleccionar un técnico asignado.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            <section className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200">
              <h3 className="text-lg font-semibold text-neutral-800 mb-4 border-b pb-2">Información del Cliente</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">C.I. / RIF</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={order.client.ciRif}
                      onChange={handleCIChange}
                      className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-neutral-400"
                      placeholder="Ej. V-12.345.678 / J-12345678-9"
                    />
                    <button
                      onClick={handleClientSearch}
                      disabled={isSearchingClient}
                      className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-3 py-2 rounded-md transition-colors flex items-center"
                    >
                      {isSearchingClient ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre y Apellido</label>
                  <input
                    type="text"
                    value={order.client.name}
                    onChange={e => updateClient('name', e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-neutral-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Teléfono</label>
                    <input
                      type="tel"
                      value={order.client.phone}
                      onChange={handlePhoneChange}
                      placeholder="Ej. +58 412-123-4567"
                      className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-neutral-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={order.client.email}
                      onChange={e => updateClient('email', e.target.value)}
                      pattern=".*\.com"
                      title="El correo debe terminar en .com"
                      placeholder="Ej. juan.perez@email.com"
                      className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-neutral-400"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200">
              <h3 className="text-lg font-semibold text-neutral-800 mb-4 border-b pb-2">Identificación del Equipo</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Tipo de Equipo</label>
                  <div className="flex flex-wrap gap-2">
                    {['Laptop', 'Desktop', 'All-in-one', 'Otro'].map(type => (
                      <button
                        key={type}
                        onClick={() => updateEquipment('type', type)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${order.equipment.type === type ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  {order.equipment.type === 'Otro' && (
                    <input
                      type="text"
                      placeholder="Especifique..."
                      value={order.equipment.otherType || ''}
                      onChange={e => updateEquipment('otherType', e.target.value)}
                      className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Marca/Modelo</label>
                    <input
                      type="text"
                      value={order.equipment.brandModel}
                      onChange={e => updateEquipment('brandModel', e.target.value)}
                      className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Color</label>
                    <input
                      type="text"
                      value={order.equipment.color}
                      onChange={e => updateEquipment('color', e.target.value)}
                      className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">N° de Serie</label>
                  <input
                    type="text"
                    value={order.equipment.serialNumber}
                    onChange={e => updateEquipment('serialNumber', e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Usuario SO</label>
                    <input
                      type="text"
                      value={order.equipment.username || ''}
                      onChange={e => updateEquipment('username', e.target.value)}
                      className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Contraseña</label>
                    <input
                      type="text"
                      value={order.equipment.password || ''}
                      onChange={e => updateEquipment('password', e.target.value)}
                      className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Accesorios Incluidos</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Cargador original', 'Cargador genérico', 'Cable de poder', 'Estuche/Bolso', 'Ninguno', 'Otro'].map(acc => (
                      <label key={acc} className="flex items-center space-x-2 text-sm text-neutral-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={order.equipment.accessories.includes(acc)}
                          onChange={() => toggleEquipmentAccessory(acc)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>{acc}</span>
                      </label>
                    ))}
                  </div>
                  {order.equipment.accessories.includes('Otro') && (
                    <input
                      type="text"
                      placeholder="Especifique accesorios..."
                      value={order.equipment.otherAccessory || ''}
                      onChange={e => updateEquipment('otherAccessory', e.target.value)}
                      className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              </div>
            </section>
          </div>

          <section className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4 border-b pb-2">Inspección Física y Diagnóstico Previo</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                <h4 className="font-medium text-neutral-800 mb-2">Encendido</h4>
                <div className="space-y-2 mb-3">
                  {['Sí', 'No', 'Se apaga solo'].map(opt => (
                    <label key={opt} className="flex items-center space-x-2 text-sm text-neutral-700 cursor-pointer">
                      <input type="checkbox" checked={order.inspection.power.status.includes(opt)} onChange={() => toggleInspectionStatus('power', opt)} className="rounded text-blue-600 focus:ring-blue-500" />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
                <input type="text" placeholder="Notas..." value={order.inspection.power.notes} onChange={e => updateInspection('power', 'notes', e.target.value)} className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                <h4 className="font-medium text-neutral-800 mb-2">Pantalla/Video</h4>
                <div className="space-y-2 mb-3">
                  {['OK', 'Rota', 'Rayada', 'Sin video'].map(opt => (
                    <label key={opt} className="flex items-center space-x-2 text-sm text-neutral-700 cursor-pointer">
                      <input type="checkbox" checked={order.inspection.screen.status.includes(opt)} onChange={() => toggleInspectionStatus('screen', opt)} className="rounded text-blue-600 focus:ring-blue-500" />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
                <input type="text" placeholder="Notas..." value={order.inspection.screen.notes} onChange={e => updateInspection('screen', 'notes', e.target.value)} className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                <h4 className="font-medium text-neutral-800 mb-2">Teclado/Touchpad</h4>
                <div className="space-y-2 mb-3">
                  {['OK', 'Faltan teclas', 'No responde'].map(opt => (
                    <label key={opt} className="flex items-center space-x-2 text-sm text-neutral-700 cursor-pointer">
                      <input type="checkbox" checked={order.inspection.keyboard.status.includes(opt)} onChange={() => toggleInspectionStatus('keyboard', opt)} className="rounded text-blue-600 focus:ring-blue-500" />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
                <input type="text" placeholder="Notas..." value={order.inspection.keyboard.notes} onChange={e => updateInspection('keyboard', 'notes', e.target.value)} className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                <h4 className="font-medium text-neutral-800 mb-2">Puertos USB/Carga</h4>
                <div className="space-y-2 mb-3">
                  {['OK', 'Sulfatados', 'Flojos/Rotos'].map(opt => (
                    <label key={opt} className="flex items-center space-x-2 text-sm text-neutral-700 cursor-pointer">
                      <input type="checkbox" checked={order.inspection.ports.status.includes(opt)} onChange={() => toggleInspectionStatus('ports', opt)} className="rounded text-blue-600 focus:ring-blue-500" />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
                <input type="text" placeholder="Notas..." value={order.inspection.ports.notes} onChange={e => updateInspection('ports', 'notes', e.target.value)} className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                <h4 className="font-medium text-neutral-800 mb-2">Chasis/Tornillos</h4>
                <div className="space-y-2 mb-3">
                  {['Completo', 'Golpes', 'Faltan tornillos'].map(opt => (
                    <label key={opt} className="flex items-center space-x-2 text-sm text-neutral-700 cursor-pointer">
                      <input type="checkbox" checked={order.inspection.chassis.status.includes(opt)} onChange={() => toggleInspectionStatus('chassis', opt)} className="rounded text-blue-600 focus:ring-blue-500" />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
                <input type="text" placeholder="Notas..." value={order.inspection.chassis.notes} onChange={e => updateInspection('chassis', 'notes', e.target.value)} className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                <h4 className="font-medium text-neutral-800 mb-2">Unidad Óptica/Otros</h4>
                <div className="space-y-2 mb-3">
                  {['OK', 'No aplica', 'Dañado'].map(opt => (
                    <label key={opt} className="flex items-center space-x-2 text-sm text-neutral-700 cursor-pointer">
                      <input type="checkbox" checked={order.inspection.opticalDrive.status.includes(opt)} onChange={() => toggleInspectionStatus('opticalDrive', opt)} className="rounded text-blue-600 focus:ring-blue-500" />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
                <input type="text" placeholder="Notas..." value={order.inspection.opticalDrive.notes} onChange={e => updateInspection('opticalDrive', 'notes', e.target.value)} className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

            </div>
          </section>

          <section className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4 border-b pb-2">Motivo de Ingreso y Trabajo Solicitado</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Motivo de Ingreso (Falla reportada por el cliente)</label>
                <textarea
                  rows={2}
                  value={order.serviceJob.reportedFailure}
                  onChange={e => updateServiceJob('reportedFailure', e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Trabajo Sugerido/Solicitado</label>
                  <div className="space-y-2">
                    {['Mantenimiento preventivo térmico y físico', 'Diagnóstico de hardware por falla', 'Optimización de Software/Sistema Operativo (OS)'].map(opt => (
                      <label key={opt} className="flex items-center space-x-2 text-sm text-neutral-700 cursor-pointer">
                        <input type="checkbox" checked={order.serviceJob.services.includes(opt)} onChange={() => toggleServiceJob(opt)} className="rounded text-blue-600 focus:ring-blue-500" />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-4 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                    <label className="flex items-center space-x-2 text-sm font-medium text-neutral-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={order.serviceJob.hasPartsReplacement || false}
                        onChange={e => updateServiceJob('hasPartsReplacement', e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>¿Requiere Reemplazo de pieza?</span>
                    </label>
                    {order.serviceJob.hasPartsReplacement && (
                      <input
                        type="text"
                        placeholder="Especificar repuestos..."
                        value={order.serviceJob.partsRequested || ''}
                        onChange={e => updateServiceJob('partsRequested', e.target.value)}
                        className="mt-3 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>
                </div>

                <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                  <label className="block text-sm font-medium text-neutral-800 mb-2">Respaldo de Datos</label>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-2 text-sm text-neutral-700 cursor-pointer font-medium">
                      <input
                        type="radio"
                        name="backup"
                        checked={!order.serviceJob.backupRequired}
                        onChange={() => updateServiceJob('backupRequired', false)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>No requiere respaldo.</span>
                    </label>

                    <label className="flex items-start space-x-2 text-sm text-neutral-700 cursor-pointer font-medium">
                      <input
                        type="radio"
                        name="backup"
                        checked={order.serviceJob.backupRequired}
                        onChange={() => updateServiceJob('backupRequired', true)}
                        className="mt-1 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1 space-y-3">
                        <span>Sí requiere respaldo.</span>
                        {order.serviceJob.backupRequired && (
                          <div className="space-y-3 ml-2 p-3 bg-white rounded border border-blue-200">
                            <div>
                              <span className="block text-xs text-neutral-500 mb-1">Ruta específica:</span>
                              <input
                                type="text"
                                value={order.serviceJob.backupRoute || ''}
                                onChange={e => updateServiceJob('backupRoute', e.target.value)}
                                className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
                              />
                            </div>
                            <div>
                              <span className="block text-xs text-neutral-500 mb-1">Prioridad:</span>
                              <div className="flex flex-col gap-1">
                                {['Fotos', 'Documentos', 'Todo el usuario'].map(prio => (
                                  <label key={prio} className="flex items-center space-x-2 text-sm cursor-pointer">
                                    <input type="radio" name="priority" checked={order.serviceJob.backupPriority === prio} onChange={() => updateServiceJob('backupPriority', prio)} className="text-blue-600" />
                                    <span className="font-normal">{prio}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-4 mt-8 pb-4 sm:pb-0">
            <button
              onClick={handlePreview}
              className="w-full sm:w-auto flex justify-center items-center gap-2 bg-neutral-800 hover:bg-neutral-900 text-white px-6 py-3 rounded-lg font-medium shadow-lg shadow-neutral-500/30 transition-all active:scale-95"
            >
              Vista Previa / Confirmar
            </button>
          </div>
        </div>
      )}

      {/* Actual print layout, only rendered globally for printing unless previewMode is handled internally */}
      <PrintLayout order={order} />
    </>
  );
}
