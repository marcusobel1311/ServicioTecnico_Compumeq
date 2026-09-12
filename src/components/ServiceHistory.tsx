import React, { useState, useEffect } from 'react';
import { dbService } from '../services/db';
import { sendEmailWithPdf } from '../services/notifications';
import { generateFichaPdfFromImages } from '../services/pdfGenerator';
import { Order } from '../types';
import { Search, Monitor, Clock, Plus, ArrowLeft, X, Minus, Eye, Loader2, Calendar, ChevronDown, RotateCcw } from 'lucide-react';
import ReceptionForm from './ReceptionForm';
import FichaViewerModal from './FichaViewerModal';
import FrequentEmailInput from './FrequentEmailInput';

function RegistrationModal({ order, onClose, onSuccess }: { order: Order; onClose: () => void; onSuccess: () => void }) {
  const [emails, setEmails] = useState<string[]>(order.client?.email ? [order.client.email] : ['']);
  const [subject, setSubject] = useState(`Ficha Registrada de Recepción de Equipo - Orden N° ${order.orderNumber}`);
  const defaultMessage = `Adjunto enviamos la ficha de recepción del equipo (${order.equipment.brandModel || 'Equipo'}), del cliente (${order.client.name || 'Cliente'} - ${order.client.ciRif || 'N/A'}).\n\nSaludos!! \nServicio Técnico Compumeq Express`;
  const [message, setMessage] = useState(defaultMessage);
  const [files, setFiles] = useState<FileList | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [submitError, setSubmitError] = useState('');

  const handleAddEmail = () => setEmails([...emails, '']);
  const handleEmailChange = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };
  const handleRemoveEmail = (index: number) => {
    const newEmails = emails.filter((_, i) => i !== index);
    setEmails(newEmails.length ? newEmails : ['']);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!files || files.length === 0) {
      setSubmitError('Debes adjuntar las fotos de la ficha de recepción impresa y firmada.');
      return;
    }

    setIsSubmitting(true);
    try {
      const fileArray = Array.from(files) as File[];

      // 1. Compresión en Cliente & 2. Generación de PDF con Encabezado Obligatorio
      setStatusMessage('Optimizando imágenes y generando PDF con encabezado...');
      const pdfBlob = await generateFichaPdfFromImages(fileArray, {
        orderNumber: order.orderNumber,
        clientName:  order.client.name,
        clientCi:    order.client.ciRif,
      });

      const pdfFileName = `Ficha_Recepcion_${order.orderNumber}.pdf`;
      const pdfFile = new File([pdfBlob], pdfFileName, { type: 'application/pdf' });

      // 3. Carga en Supabase Storage (Bucket 'fichas-recepcion')
      setStatusMessage('Subiendo documento a Supabase Storage...');
      const storageUrl = await dbService.uploadFichaPdf(pdfFileName, pdfBlob);

      // 4. Guardado en Base de Datos & Cambio de Estado a "subida"
      setStatusMessage('Guardando registro en la base de datos...');
      if (order.id) {
        await dbService.updateOrder(order.id, {
          fichaRegistrada: true,
          fichaUrl: storageUrl,
        });
      }

      // 5. Notificación por Correo Electrónico
      setStatusMessage('Enviando notificación por correo...');
      const validEmails = emails.filter(e => e.trim() !== '');

      for (const destinatario of validEmails) {
        await sendEmailWithPdf({
          destinatario,
          asunto:       subject,
          descripcion:  message || defaultMessage,
          documento:    pdfFile,
          nombreArchivo: pdfFileName,
        });
      }

      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al procesar la ficha.';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
      setStatusMessage('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 animate-in fade-in zoom-in-95">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base sm:text-lg font-bold">Registrar Ficha - #{order.orderNumber}</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Fotos de la Ficha Firmada (3 fotos de la ficha impresa)
            </label>
            <input 
              type="file" 
              multiple 
              accept="image/*"
              onChange={(e) => setFiles(e.target.files)}
              className="w-full text-sm border border-neutral-300 rounded-lg p-2"
              required
            />
            {files && files.length > 0 && (
              <p className="text-xs text-neutral-500 mt-1">
                {files.length === 3
                  ? '✅ 3 fotos seleccionadas'
                  : `📷 ${files.length} foto(s) seleccionada(s)`}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Destinatario(s)</label>
            <div className="space-y-3">
              {emails.map((email, i) => (
                <FrequentEmailInput
                  key={i}
                  index={i}
                  value={email}
                  onChange={(val) => handleEmailChange(i, val)}
                  placeholder="correo@ejemplo.com"
                  required
                  showRemove={emails.length > 1}
                  onRemove={() => handleRemoveEmail(i)}
                  showAdd={i === emails.length - 1}
                  onAdd={handleAddEmail}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Asunto</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Mensaje</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full border border-neutral-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Mensaje opcional..."
            />
          </div>

          {statusMessage && (
            <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {submitError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {submitError}
            </p>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? 'Procesando...' : 'Guardar y Enviar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type DateFilterMode = 'all' | '7days' | '1month' | 'specific' | 'range';

const getLocalDateString = (offsetDays: number = 0, offsetMonths: number = 0): string => {
  const d = new Date();
  if (offsetMonths !== 0) {
    d.setMonth(d.getMonth() - offsetMonths);
  }
  if (offsetDays !== 0) {
    d.setDate(d.getDate() - offsetDays);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function ServiceHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingPastService, setIsCreatingPastService] = useState(false);
  const [selectedOrderForUpload, setSelectedOrderForUpload] = useState<Order | null>(null);
  const [selectedOrderForView, setSelectedOrderForView] = useState<Order | null>(null);

  // Estados para filtrado por fecha
  const [dateFilter, setDateFilter] = useState<DateFilterMode>('all');
  const [specificDate, setSpecificDate] = useState<string>('');
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd, setRangeEnd] = useState<string>('');
  const [isDateFilterOpen, setIsDateFilterOpen] = useState<boolean>(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const data = await dbService.getOrders();
      // Supabase ya ordena por date DESC, time DESC — ordenamiento secundario en cliente
      data.sort((a, b) => new Date(b.date + 'T' + b.time).getTime() - new Date(a.date + 'T' + a.time).getTime());
      setOrders(data);
    } catch (err) {
      console.error('Error cargando órdenes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders = orders.filter(o => {
    // 1. Filtro por buscador (orden, cliente, CI, equipo)
    const query = search.trim().toLowerCase();
    const matchesSearch = !query ||
      o.orderNumber.toLowerCase().includes(query) || 
      o.client.name.toLowerCase().includes(query) ||
      o.client.ciRif.toLowerCase().includes(query) ||
      o.equipment.brandModel.toLowerCase().includes(query);

    if (!matchesSearch) return false;

    // 2. Filtro por fecha
    if (dateFilter === '7days') {
      const minDate = getLocalDateString(7, 0);
      return o.date >= minDate;
    }
    if (dateFilter === '1month') {
      const minDate = getLocalDateString(0, 1);
      return o.date >= minDate;
    }
    if (dateFilter === 'specific') {
      if (!specificDate) return true;
      return o.date === specificDate;
    }
    if (dateFilter === 'range') {
      if (rangeStart && rangeEnd) return o.date >= rangeStart && o.date <= rangeEnd;
      if (rangeStart) return o.date >= rangeStart;
      if (rangeEnd) return o.date <= rangeEnd;
      return true;
    }

    return true;
  });

  const getDateFilterButtonLabel = () => {
    if (dateFilter === '7days') return 'Últimos 7 días';
    if (dateFilter === '1month') return '1 mes';
    if (dateFilter === 'specific') return specificDate ? specificDate : 'Fecha específica';
    if (dateFilter === 'range') {
      if (rangeStart && rangeEnd) return `${rangeStart} ~ ${rangeEnd}`;
      if (rangeStart) return `Desde ${rangeStart}`;
      if (rangeEnd) return `Hasta ${rangeEnd}`;
      return 'Rango personalizado';
    }
    return 'Filtrar por fecha';
  };

  if (isCreatingPastService) {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <button
          onClick={() => setIsCreatingPastService(false)}
          className="flex items-center gap-2 px-4 py-2 text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-200 rounded-lg shadow-sm transition-colors w-fit"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver al Historial
        </button>
        <ReceptionForm 
          allowDateEdit={true} 
          onSave={() => {
            setIsCreatingPastService(false);
            loadOrders();
          }} 
        />
      </div>
    );
  }

  return (
    <div className="bg-white p-4 sm:p-5 md:p-6 rounded-xl shadow-sm border border-neutral-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 md:mb-6 gap-3 md:gap-4">
        <div className="w-full md:w-auto flex justify-between items-center">
          <div>
            <h2 className="text-base sm:text-lg md:text-2xl font-bold text-neutral-800 leading-tight">Historial de Servicios</h2>
            <p className="hidden md:block text-xs md:text-base text-neutral-500 mt-0.5">Consulte y filtre las recepciones anteriores.</p>
          </div>
        </div>
        <div className="flex flex-row flex-wrap sm:flex-nowrap gap-1.5 md:gap-3 w-full md:w-auto items-center">
          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 md:h-5 md:w-5 text-neutral-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar orden, cliente, C.I..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-7 md:pl-10 pr-2 py-1 md:py-2 text-xs md:text-base border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Componente de filtrado por fecha exactamente entre el banner de búsqueda y el botón Registrar anterior */}
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsDateFilterOpen(prev => !prev)}
              className={`flex items-center gap-1.5 px-2.5 md:px-3 py-1 md:py-2 text-xs md:text-sm rounded-lg border font-medium transition-all whitespace-nowrap cursor-pointer ${
                dateFilter !== 'all'
                  ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-xs'
                  : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400'
              }`}
              title="Filtrar por fecha"
            >
              <Calendar className={`w-3.5 h-3.5 md:w-4 md:h-4 ${dateFilter !== 'all' ? 'text-blue-600' : 'text-neutral-500'}`} />
              <span className="hidden sm:inline">{getDateFilterButtonLabel()}</span>
              <span className="sm:hidden">{dateFilter !== 'all' ? getDateFilterButtonLabel() : 'Fecha'}</span>
              <ChevronDown className={`w-3 h-3 md:w-3.5 md:h-3.5 transition-transform duration-200 ${isDateFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDateFilterOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setIsDateFilterOpen(false)}
                />
                <div className="absolute right-0 sm:left-0 sm:right-auto top-full mt-2 z-30 w-72 bg-white rounded-xl shadow-xl border border-neutral-200 p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                    <span className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      Filtro por Fecha
                    </span>
                    {dateFilter !== 'all' && (
                      <button
                        type="button"
                        onClick={() => {
                          setDateFilter('all');
                          setSpecificDate('');
                          setRangeStart('');
                          setRangeEnd('');
                          setIsDateFilterOpen(false);
                        }}
                        className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium hover:underline cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Limpiar
                      </button>
                    )}
                  </div>

                  {/* Opciones requeridas */}
                  <div className="grid grid-cols-1 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setDateFilter('all');
                        setIsDateFilterOpen(false);
                      }}
                      className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        dateFilter === 'all'
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      Todas las fechas
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDateFilter('7days');
                        setIsDateFilterOpen(false);
                      }}
                      className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        dateFilter === '7days'
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      Últimos 7 días
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDateFilter('1month');
                        setIsDateFilterOpen(false);
                      }}
                      className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        dateFilter === '1month'
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      1 mes
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateFilter('specific')}
                      className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        dateFilter === 'specific'
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      Fecha específica
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateFilter('range')}
                      className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        dateFilter === 'range'
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      Rango personalizado
                    </button>
                  </div>

                  {/* Selector Fecha Específica */}
                  {dateFilter === 'specific' && (
                    <div className="pt-2 border-t border-neutral-100 space-y-1.5">
                      <label className="block text-[11px] font-medium text-neutral-600">
                        Selecciona la fecha:
                      </label>
                      <input
                        type="date"
                        value={specificDate}
                        onChange={e => setSpecificDate(e.target.value)}
                        className="w-full text-xs border border-neutral-300 rounded-lg p-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Selector Rango Personalizado */}
                  {dateFilter === 'range' && (
                    <div className="pt-2 border-t border-neutral-100 space-y-2">
                      <label className="block text-[11px] font-medium text-neutral-600">
                        Rango de fechas (datepicker):
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-neutral-500 block mb-0.5">Desde</span>
                          <input
                            type="date"
                            value={rangeStart}
                            onChange={e => setRangeStart(e.target.value)}
                            className="w-full text-xs border border-neutral-300 rounded-lg p-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-neutral-500 block mb-0.5">Hasta</span>
                          <input
                            type="date"
                            value={rangeEnd}
                            onChange={e => setRangeEnd(e.target.value)}
                            className="w-full text-xs border border-neutral-300 rounded-lg p-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {(dateFilter === 'specific' || dateFilter === 'range') && (
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setIsDateFilterOpen(false)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors cursor-pointer"
                      >
                        Aplicar
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setIsCreatingPastService(true)}
            className="flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 md:px-4 md:py-2 text-xs md:text-base rounded-lg font-medium transition-colors whitespace-nowrap flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5 md:w-5 md:h-5" />
            <span className="hidden sm:inline">Registrar Anterior</span>
            <span className="sm:hidden">Anterior</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left border-collapse">
          <thead>
            <tr className="bg-neutral-50 border-y border-neutral-200 text-neutral-600 text-sm">
              <th className="py-3 px-4 font-medium">N° Orden / Fecha</th>
              <th className="py-3 px-4 font-medium">Cliente</th>
              <th className="py-3 px-4 font-medium">Equipo</th>
              <th className="py-3 px-4 font-medium">Falla Reportada</th>
              <th className="py-3 px-4 font-medium">Técnico</th>
              <th className="py-3 px-4 font-medium">Ficha Registrada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-neutral-500">Cargando órdenes...</td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-neutral-500">No se encontraron resultados</td>
              </tr>
            ) : (
              filteredOrders.map(order => (
                <tr key={order.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-mono font-bold text-blue-600">#{order.orderNumber}</div>
                    <div className="text-xs text-neutral-500 flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" /> {order.date} {order.time}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-neutral-800">{order.client.name}</div>
                    <div className="text-xs text-neutral-500">{order.client.ciRif}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm font-medium text-neutral-700 flex items-center gap-1">
                      <Monitor className="w-4 h-4 text-neutral-400" /> {order.equipment.type}
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">{order.equipment.brandModel}</div>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-sm text-neutral-600 line-clamp-2 max-w-xs">{order.serviceJob.reportedFailure}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-neutral-800 font-medium">
                      {order.technicianName || 'No asignado'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {order.fichaRegistrada ? (
                      <button
                        onClick={() => setSelectedOrderForView(order)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 hover:bg-green-200 transition-colors cursor-pointer group"
                        title="Ver Ficha de Recepción"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        <span>Subida</span>
                        <Eye className="w-3.5 h-3.5 text-green-600 group-hover:scale-110 transition-transform" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          No subida
                        </span>
                        <button
                          onClick={() => setSelectedOrderForUpload(order)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                          title="Subir Ficha"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedOrderForUpload && (
        <RegistrationModal
          order={selectedOrderForUpload}
          onClose={() => setSelectedOrderForUpload(null)}
          onSuccess={() => {
            setSelectedOrderForUpload(null);
            loadOrders();
          }}
        />
      )}

      {selectedOrderForView && (
        <FichaViewerModal
          order={selectedOrderForView}
          onClose={() => setSelectedOrderForView(null)}
        />
      )}
    </div>
  );
}
