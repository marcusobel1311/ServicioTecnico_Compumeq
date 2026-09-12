import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { dbService } from '../services/db';
import { Technician } from '../types';
import { Plus, Edit2, CheckCircle, Loader2 } from 'lucide-react';

export default function Technicians() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  const initialFormState: Technician = { name: '', ci: '', phone: '', email: '', isActive: true };
  const [formData, setFormData] = useState<Technician>(initialFormState);

  const toastTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadTechnicians();
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const handleCIChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    const isDeleting = (e.nativeEvent as InputEvent).inputType === 'deleteContentBackward';
    
    if (!val || (isDeleting && val === 'V')) {
      setFormData({ ...formData, ci: '' });
      return;
    }
    
    let digits = val.replace(/\D/g, '');
    
    if (!digits) {
      if (val.includes('V')) {
        setFormData({ ...formData, ci: 'V-' });
      } else {
        setFormData({ ...formData, ci: '' });
      }
      return;
    }
    
    if (digits.length > 8) {
      digits = digits.slice(0, 8);
    }
    
    const withDots = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    setFormData({ ...formData, ci: `V-${withDots}` });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    
    if (!val) {
      setFormData({ ...formData, phone: '' });
      return;
    }
    
    const raw = val.replace(/[^\d+]/g, '');
    
    if (raw === '+' || raw === '+5' || raw === '+58') {
      setFormData({ ...formData, phone: raw });
      return;
    }
    
    const digits = raw.replace(/\D/g, '');
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
    
    setFormData({ ...formData, phone: formatted });
  };

  const loadTechnicians = async () => {
    setIsLoading(true);
    try {
      const data = await dbService.getTechnicians();
      setTechnicians(data);
    } catch (err) {
      console.error('Error cargando técnicos:', err);
      showToast('⚠️ Error al cargar los técnicos');
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage('');
      toastTimeoutRef.current = null;
    }, 4000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.ci) return;
    
    setIsSaving(true);
    try {
      await dbService.saveTechnician(formData);
      await loadTechnicians();
      setFormData(initialFormState);
      setIsEditing(false);
      showToast('Técnico guardado exitosamente');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar.';
      showToast(`⚠️ ${msg}`);
      console.error('[Technicians] handleSave:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (technician: Technician) => {
    setFormData({
      ...technician,
      isActive: technician.isActive !== false
    });
    setIsEditing(true);
  };

  const handleToggleStatus = async (technician: Technician) => {
    if (!technician.id) return;
    const nextStatus = !(technician.isActive !== false);

    // Optimistic UI update
    setTechnicians(prev =>
      prev.map(t => (t.id === technician.id ? { ...t, isActive: nextStatus } : t))
    );
    setTogglingId(technician.id);

    try {
      await dbService.setTechnicianActive(technician.id, nextStatus);
      showToast(`Técnico ${technician.name} ${nextStatus ? 'activado' : 'desactivado'}`);
    } catch (err) {
      // Revertir en caso de error
      setTechnicians(prev =>
        prev.map(t => (t.id === technician.id ? { ...t, isActive: !nextStatus } : t))
      );
      const msg = err instanceof Error ? err.message : 'Error al actualizar el estado.';
      showToast(`⚠️ ${msg}`);
      console.error('[Technicians] handleToggleStatus:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleCancel = () => {
    setFormData(initialFormState);
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      {typeof document !== 'undefined' && toastMessage
        ? createPortal(
            <div
              className="fixed bottom-20 left-4 right-4 sm:bottom-4 sm:right-4 sm:left-auto sm:w-auto bg-neutral-800 text-white px-4 py-3 rounded-lg shadow-2xl flex items-center gap-2 transition-all pointer-events-none"
              style={{ zIndex: 999999 }}
            >
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              <span className="text-sm font-medium">{toastMessage}</span>
            </div>,
            document.body
          )
        : null}

      <div className="flex flex-row justify-between items-center gap-2 md:gap-4 bg-white p-4 sm:p-5 md:p-6 rounded-xl shadow-sm border border-neutral-200">
        <div>
          <h2 className="text-base sm:text-lg md:text-2xl font-bold text-neutral-800 leading-tight">Gestión de Técnicos</h2>
          <p className="hidden md:block text-xs md:text-base text-neutral-500 mt-0.5">Añada y administre el personal técnico activo e inactivo.</p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 md:px-4 md:py-2 text-xs md:text-base rounded-lg font-medium transition-colors sm:w-auto whitespace-nowrap flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="hidden sm:inline">Nuevo Técnico</span>
            <span className="sm:hidden">Nuevo</span>
          </button>
        )}
      </div>

      {isEditing && (
        <div className="bg-white p-4 sm:p-5 md:p-6 rounded-xl shadow-sm border border-neutral-200">
          <h3 className="text-base sm:text-lg font-semibold text-neutral-800 mb-4 border-b pb-2">
            {formData.id ? 'Editar Técnico' : 'Registrar Nuevo Técnico'}
          </h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre y Apellido *</label>
                <input 
                  type="text" 
                  required
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej. Juan Pérez"
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-neutral-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Cédula *</label>
                <input 
                  type="text" 
                  required
                  value={formData.ci} 
                  onChange={handleCIChange}
                  placeholder="Ej. V-12.345.678"
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-neutral-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Teléfono</label>
                <input 
                  type="tel" 
                  value={formData.phone} 
                  onChange={handlePhoneChange}
                  placeholder="Ej. +58 412-123-4567"
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-neutral-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
                <input 
                  type="email" 
                  value={formData.email} 
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  pattern=".*\.com"
                  title="El correo debe terminar en .com"
                  placeholder="Ej. juan.perez@email.com"
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-neutral-400"
                />
              </div>
            </div>
            
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={handleCancel}
                className="w-full sm:w-auto px-4 py-2 rounded-lg font-medium text-neutral-600 hover:bg-neutral-100 transition-colors border border-neutral-200 sm:border-transparent"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-70"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center items-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : technicians.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            No hay técnicos registrados. Añada uno para comenzar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-600 font-medium border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-3">Nombre</th>
                  <th className="px-6 py-3">Cédula</th>
                  <th className="px-6 py-3">Teléfono</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3 text-center">Estado</th>
                  <th className="px-6 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {technicians.map((tech) => {
                  const isActive = tech.isActive !== false;
                  const isTogglingThis = togglingId === tech.id;
                  
                  return (
                    <tr 
                      key={tech.id} 
                      className={`transition-colors ${isActive ? 'hover:bg-neutral-50/50' : 'bg-neutral-50/70 opacity-75 hover:bg-neutral-100/50'}`}
                    >
                      <td className="px-6 py-4 font-medium text-neutral-800">
                        <div className="flex items-center gap-2">
                          <span className={isActive ? 'text-neutral-900 font-semibold' : 'text-neutral-500 line-through decoration-neutral-400'}>
                            {tech.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-neutral-600">{tech.ci}</td>
                      <td className="px-6 py-4 text-neutral-600">{tech.phone || '—'}</td>
                      <td className="px-6 py-4 text-neutral-600">{tech.email || '—'}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* Switch toggle moderno */}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isActive}
                            disabled={isTogglingThis}
                            onClick={() => handleToggleStatus(tech)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                              isActive ? 'bg-green-500' : 'bg-neutral-300'
                            } ${isTogglingThis ? 'opacity-50 cursor-wait' : ''}`}
                            title={isActive ? 'Desactivar técnico' : 'Activar técnico'}
                          >
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                isActive ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block min-w-[65px] text-center ${
                            isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-neutral-200 text-neutral-600'
                          }`}>
                            {isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleEdit(tech)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-block"
                          title="Editar información del técnico"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
