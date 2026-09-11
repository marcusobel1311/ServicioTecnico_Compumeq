import React, { useState, useEffect, useRef } from 'react';
import { Mail, Plus, X, Edit2, Trash2, Check, UserCheck, Bookmark, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { frequentEmailsService, CustomFrequentEmail } from '../services/frequentEmails';
import { Technician } from '../types';

interface FrequentEmailInputProps {
  key?: React.Key;
  value: string;
  onChange: (value: string) => void;
  onRemove?: () => void;
  onAdd?: () => void;
  showRemove?: boolean;
  showAdd?: boolean;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  inputClassName?: string;
  index?: number;
}

export default function FrequentEmailInput({
  value,
  onChange,
  onRemove,
  onAdd,
  showRemove = false,
  showAdd = false,
  placeholder = 'correo@ejemplo.com',
  required = false,
  disabled = false,
  inputClassName = '',
  index,
}: FrequentEmailInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [customEmails, setCustomEmails] = useState<CustomFrequentEmail[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Estados para formulario de creación/edición de correos personalizados
  const [isCreating, setIsCreating] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [formError, setFormError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editLabel, setEditLabel] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cargar datos (getTechnicians y getCustomEmails son ambos async/Supabase)
  const loadData = async () => {
    setLoading(true);
    try {
      const [techs, customs] = await Promise.all([
        frequentEmailsService.getTechnicians(),
        frequentEmailsService.getCustomEmails(),
      ]);
      setTechnicians(techs);
      setCustomEmails(customs);
    } catch (err) {
      console.error('Error cargando correos frecuentes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Suscripción Realtime: cuando cualquier equipo cambia la tabla, re-fetch para todos
  useEffect(() => {
    const unsubscribe = frequentEmailsService.subscribe(() => {
      frequentEmailsService.getCustomEmails().then(setCustomEmails);
    });
    return () => unsubscribe();
  }, []);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setIsCreating(false);
        setEditingId(null);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectEmail = (selectedEmail: string) => {
    onChange(selectedEmail);
    setIsOpen(false);
    setIsCreating(false);
    setEditingId(null);
  };

  const handleCreateCustomEmail = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setFormError('');

    const trimmed = newEmail.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setFormError('Por favor ingresa un correo electrónico válido');
      return;
    }

    try {
      await frequentEmailsService.addCustomEmail(trimmed, newLabel.trim());
      setNewEmail('');
      setNewLabel('');
      setIsCreating(false);
    } catch {
      setFormError('Error al guardar el correo. Intenta nuevamente.');
    }
  };

  const handleStartEdit = (item: CustomFrequentEmail, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditEmail(item.email);
    setEditLabel(item.label || '');
    setIsCreating(false);
  };

  const handleSaveEdit = async (id: string, e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setFormError('');

    const trimmed = editEmail.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setFormError('Por favor ingresa un correo electrónico válido');
      return;
    }

    try {
      await frequentEmailsService.updateCustomEmail(id, trimmed, editLabel.trim());
      setEditingId(null);
    } catch {
      setFormError('Error al actualizar el correo. Intenta nuevamente.');
    }
  };

  const handleDeleteCustomEmail = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('¿Deseas eliminar este correo frecuente personalizado?')) {
      try {
        await frequentEmailsService.deleteCustomEmail(id);
        if (editingId === id) {
          setEditingId(null);
        }
      } catch (err) {
        console.error('Error al eliminar correo frecuente:', err);
      }
    }
  };

  // Filtrado de búsquedas
  const query = searchQuery.toLowerCase().trim();
  const filteredTechnicians = technicians.filter(
    t =>
      t.email?.toLowerCase().includes(query) ||
      t.name?.toLowerCase().includes(query) ||
      t.ci?.toLowerCase().includes(query)
  );

  const filteredCustomEmails = customEmails.filter(
    c =>
      c.email.toLowerCase().includes(query) ||
      (c.label && c.label.toLowerCase().includes(query))
  );

  return (
    <div className="relative w-full space-y-1.5" ref={containerRef}>
      {/* Botón superior de Correos Frecuentes */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-neutral-500 font-medium">
          {index !== undefined ? `Destinatario #${index + 1}` : ''}
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
            isOpen
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300'
          }`}
          title="Ver o seleccionar correos frecuentes y técnicos"
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span>Correos frecuentes</span>
          {isOpen ? (
            <ChevronUp className="w-3 h-3 ml-0.5 opacity-80" />
          ) : (
            <ChevronDown className="w-3 h-3 ml-0.5 opacity-80" />
          )}
        </button>
      </div>

      {/* Popover / Menú desplegable */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-1 z-50 w-full sm:w-96 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-2xl border border-neutral-200 overflow-hidden animate-in fade-in zoom-in-95"
        >
          {/* Cabecera del popover */}
          <div className="bg-neutral-50 px-3.5 py-2.5 border-b border-neutral-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                Correos Frecuentes
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsCreating(false);
                setEditingId(null);
              }}
              className="text-neutral-400 hover:text-neutral-600 p-0.5 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Formulario de creación nuevo */}
          {isCreating ? (
            <div
              className="p-3 bg-blue-50/60 border-b border-blue-100 space-y-2.5"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCreateCustomEmail();
                }
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-900">
                  Nuevo Correo Guardado
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setFormError('');
                  }}
                  className="text-neutral-400 hover:text-neutral-600 text-xs"
                >
                  Cancelar
                </button>
              </div>

              {formError && (
                <p className="text-[11px] text-red-600 font-medium bg-red-50 p-1.5 rounded border border-red-200">
                  {formError}
                </p>
              )}

              <div>
                <input
                  type="email"
                  placeholder="correo@ejemplo.com *"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  autoFocus
                  required
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Etiqueta / Nombre (Opcional, ej. Gerencia)"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setFormError('');
                  }}
                  className="px-2.5 py-1 text-xs text-neutral-600 bg-white border border-neutral-300 rounded-md hover:bg-neutral-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={(e) => handleCreateCustomEmail(e)}
                  className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm"
                >
                  Guardar
                </button>
              </div>
            </div>
          ) : (
            /* Botón para abrir creación */
            <div className="p-2 border-b border-neutral-100 flex items-center justify-between gap-2 bg-neutral-50/50">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar técnico o correo..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(true);
                  setEditingId(null);
                  setFormError('');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shrink-0 transition-colors"
                title="Añadir nuevo correo frecuente"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Crear</span>
              </button>
            </div>
          )}

          {/* Lista scrolleable con técnicos y personalizados */}
          <div className="max-h-64 overflow-y-auto divide-y divide-neutral-100 p-1">
            {loading ? (
              <div className="p-4 text-center text-xs text-neutral-400">
                Cargando correos frecuentes...
              </div>
            ) : filteredTechnicians.length === 0 && filteredCustomEmails.length === 0 ? (
              <div className="p-4 text-center text-xs text-neutral-500">
                {searchQuery ? 'No se encontraron resultados' : 'No hay correos frecuentes guardados aún.'}
              </div>
            ) : (
              <>
                {/* SECCIÓN: Técnicos Registrados */}
                {filteredTechnicians.length > 0 && (
                  <div className="py-1">
                    <div className="px-2.5 py-1 text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-3 h-3 text-emerald-600" />
                      <span>Técnicos del Sistema</span>
                    </div>
                    {filteredTechnicians.map(tech => (
                      <button
                        key={tech.id || tech.email}
                        type="button"
                        onClick={() => handleSelectEmail(tech.email)}
                        className="w-full text-left px-2.5 py-2 hover:bg-emerald-50/70 rounded-lg transition-colors flex items-center justify-between group"
                      >
                        <div className="truncate pr-2">
                          <div className="text-xs font-medium text-neutral-800 flex items-center gap-1.5">
                            <span className="truncate">{tech.name}</span>
                            <span className="inline-block text-[10px] px-1.5 py-0.2 text-emerald-700 bg-emerald-100/80 rounded font-normal">
                              Técnico
                            </span>
                          </div>
                          <div className="text-[11px] text-neutral-500 truncate group-hover:text-emerald-700">
                            {tech.email}
                          </div>
                        </div>
                        <div className="text-xs text-emerald-600 opacity-0 group-hover:opacity-100 font-medium shrink-0 flex items-center gap-1 transition-opacity">
                          <span>Seleccionar</span>
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* SECCIÓN: Correos Personalizados Guardados */}
                {filteredCustomEmails.length > 0 && (
                  <div className="py-1">
                    <div className="px-2.5 py-1 text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Bookmark className="w-3 h-3 text-blue-600" />
                      <span>Correos Guardados</span>
                    </div>
                    {filteredCustomEmails.map(item => (
                      <div
                        key={item.id}
                        className="px-2 py-1.5 hover:bg-blue-50/60 rounded-lg transition-colors group"
                      >
                        {editingId === item.id ? (
                          /* Formulario inline de edición */
                          <div
                            className="space-y-2 p-1"
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                                handleSaveEdit(item.id);
                              }
                            }}
                          >
                            {formError && (
                              <p className="text-[11px] text-red-600 font-medium bg-red-50 p-1 rounded">
                                {formError}
                              </p>
                            )}
                            <input
                              type="email"
                              value={editEmail}
                              onChange={e => setEditEmail(e.target.value)}
                              className="w-full text-xs px-2 py-1 border border-neutral-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                              required
                              autoFocus
                            />
                            <input
                              type="text"
                              value={editLabel}
                              onChange={e => setEditLabel(e.target.value)}
                              placeholder="Etiqueta / Nombre (opcional)"
                              className="w-full text-xs px-2 py-1 border border-neutral-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                            />
                            <div className="flex justify-end gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="px-2 py-0.5 text-xs text-neutral-600 bg-white border border-neutral-200 rounded hover:bg-neutral-100"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleSaveEdit(item.id, e)}
                                className="px-2.5 py-0.5 text-xs text-white bg-blue-600 rounded hover:bg-blue-700"
                              >
                                Guardar
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Vista de item regular */
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => handleSelectEmail(item.email)}
                              className="text-left flex-1 truncate pr-2"
                            >
                              {item.label && (
                                <div className="text-xs font-semibold text-neutral-800 truncate">
                                  {item.label}
                                </div>
                              )}
                              <div
                                className={`text-[11px] truncate group-hover:text-blue-700 ${
                                  item.label ? 'text-neutral-500' : 'text-xs font-medium text-neutral-800'
                                }`}
                              >
                                {item.email}
                              </div>
                            </button>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={e => handleStartEdit(item, e)}
                                className="p-1 text-neutral-400 hover:text-blue-600 hover:bg-blue-100/50 rounded transition-colors"
                                title="Editar correo guardado"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={e => handleDeleteCustomEmail(item.id, e)}
                                className="p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Eliminar correo guardado"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Input principal de correo junto con botones de acción (+ / -) */}
      <div className="flex gap-2 items-center">
        <input
          type="email"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={
            inputClassName ||
            'flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
          }
        />

        {showRemove && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-2 rounded-md transition-colors shrink-0"
            title="Eliminar destinatario"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {showAdd && onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-2 rounded-md transition-colors shrink-0"
            title="Agregar destinatario"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
