/**
 * ClientPickerModal.tsx
 *
 * Modal responsivo para seleccionar o editar clientes registrados en Supabase.
 * - Lista todos los clientes de la tabla `clients`.
 * - Búsqueda en tiempo real por nombre o cédula/RIF.
 * - Selección: autocompleta el formulario de recepción y cierra el modal.
 * - Edición inline: la ÚNICA vía permitida para modificar datos de un cliente.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Pencil, Check, Loader2, UserX, User, ChevronRight } from 'lucide-react';
import { dbService } from '../services/db';
import { Client } from '../types';

interface ClientPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectClient: (client: Client) => void;
  /** Se llama cuando un cliente fue editado, para actualizar el formulario si era el seleccionado */
  onClientUpdated?: (client: Client) => void;
}

interface EditState {
  name: string;
  ciRif: string;
  phone: string;
  email: string;
}

/** Autoformatea cédula o RIF venezolano idéntico al formulario de recepción */
function formatCIRif(rawVal: string, isDeleting: boolean = false): string {
  let val = rawVal.toUpperCase();
  if (!val || (isDeleting && ['V', 'E', 'J'].includes(val))) {
    return '';
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
    return prefix ? `${prefix}-` : '';
  }

  if (prefix === 'J') {
    if (digits.length > 9) digits = digits.slice(0, 9);
    let formatted = `J-${digits}`;
    if (digits.length > 8) {
      formatted = `J-${digits.slice(0, 8)}-${digits.slice(8)}`;
    }
    return formatted;
  } else {
    if (digits.length > 8) digits = digits.slice(0, 8);
    const withDots = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${prefix || 'V'}-${withDots}`;
  }
}

/** Autoformatea teléfono venezolano idéntico al formulario de recepción (+58 4XX-XXX-XXXX) */
function formatPhoneNumber(val: string): string {
  if (!val) return '';
  const raw = val.replace(/[^\d+]/g, '');

  if (raw === '+' || raw === '+5' || raw === '+58') {
    return raw;
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

  if (numberPart.length > 0) {
    let formatted = '+58 ';
    const operator = numberPart.slice(0, 3);
    const part1 = numberPart.slice(3, 6);
    const part2 = numberPart.slice(6, 10);

    formatted += operator;
    if (part1) formatted += `-${part1}`;
    if (part2) formatted += `-${part2}`;
    return formatted;
  } else if (digits.length > 0) {
    return '+' + digits;
  }
  return raw;
}

export default function ClientPickerModal({
  isOpen,
  onClose,
  onSelectClient,
  onClientUpdated,
}: ClientPickerModalProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ name: '', ciRif: '', phone: '', email: '' });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Cargar clientes al abrir ────────────────────────────────────────────────
  const loadClients = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await dbService.getClients();
      setClients(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Error al cargar clientes.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setEditingId(null);
      setEditError('');
      loadClients();
      // Enfocar barra de búsqueda cuando se abre
      setTimeout(() => searchRef.current?.focus(), 80);
    }
  }, [isOpen, loadClients]);

  // ── Filtrado y ordenamiento A–Z en tiempo real ─────────────────────────────
  const filtered = clients
    .filter(c => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.ciRif.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

  // ── Seleccionar cliente ─────────────────────────────────────────────────────
  const handleSelect = (client: Client) => {
    // No seleccionar si estamos editando esa misma fila
    if (editingId === client.id) return;
    onSelectClient(client);
    onClose();
  };

  // ── Iniciar edición ─────────────────────────────────────────────────────────
  const startEdit = (e: React.MouseEvent, client: Client) => {
    e.stopPropagation(); // No seleccionar al hacer clic en editar
    setEditingId(client.id ?? null);
    setEditState({ name: client.name, ciRif: client.ciRif, phone: client.phone, email: client.email });
    setEditError('');
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditError('');
  };

  // ── Guardar edición ─────────────────────────────────────────────────────────
  const saveEdit = async (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    if (!client.id) return;

    // Validaciones
    if (!editState.name.trim()) {
      setEditError('El nombre y apellido no puede estar vacío.');
      return;
    }
    if (!editState.ciRif.trim()) {
      setEditError('La cédula/RIF no puede estar vacía.');
      return;
    }
    const ciDigits = editState.ciRif.replace(/\D/g, '');
    if (ciDigits.length < 5) {
      setEditError('La cédula o RIF debe tener al menos 5 dígitos.');
      return;
    }
    if (!editState.phone.trim()) {
      setEditError('El número de teléfono es obligatorio.');
      return;
    }
    const phoneDigits = editState.phone.replace(/\D/g, '');
    const phoneWithout58 = phoneDigits.startsWith('58') ? phoneDigits.slice(2) : phoneDigits;
    if (phoneWithout58.length < 10) {
      setEditError('El número de teléfono debe estar completo (+58 4XX-XXX-XXXX).');
      return;
    }
    if (!editState.email.trim()) {
      setEditError('El correo electrónico es obligatorio.');
      return;
    }
    const emailTrimmed = editState.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed) || !emailTrimmed.toLowerCase().endsWith('.com')) {
      setEditError('El correo debe tener un formato válido y terminar en .com');
      return;
    }

    setIsSavingEdit(true);
    setEditError('');
    try {
      await dbService.updateClient(client.id, {
        name:  editState.name.trim(),
        ciRif: editState.ciRif.trim(),
        phone: editState.phone.trim(),
        email: editState.email.trim(),
      });

      // Actualizar lista local
      const updatedClient: Client = {
        ...client,
        name:  editState.name.trim(),
        ciRif: editState.ciRif.trim(),
        phone: editState.phone.trim(),
        email: editState.email.trim(),
      };
      setClients(prev => prev.map(c => (c.id === client.id ? updatedClient : c)));
      setEditingId(null);

      // Notificar al formulario padre si era el cliente activo
      onClientUpdated?.(updatedClient);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Error al guardar cambios.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ── Cerrar con Escape ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingId) {
          setEditingId(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, editingId, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-0 sm:p-4"
      style={{ zIndex: 99999 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Seleccionar cliente"
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative w-full sm:max-w-lg bg-white sm:rounded-2xl shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[85vh] overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-neutral-100 bg-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-800 leading-tight">Seleccionar Cliente</h2>
              <p className="text-xs text-neutral-500 leading-tight">Elige o edita un cliente registrado</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Barra de búsqueda ── */}
        <div className="px-4 sm:px-6 py-3 border-b border-neutral-100 bg-white flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o cédula…"
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-neutral-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                aria-label="Limpiar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Contenido (lista) ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Estado: cargando */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-neutral-400 gap-3">
              <Loader2 className="w-7 h-7 animate-spin" />
              <span className="text-sm">Cargando clientes…</span>
            </div>
          )}

          {/* Estado: error de carga */}
          {!isLoading && loadError && (
            <div className="m-4 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
              <span className="flex-shrink-0 mt-0.5">⚠️</span>
              <div>
                <p className="font-medium">Error al cargar</p>
                <p className="text-xs mt-0.5 text-red-600">{loadError}</p>
                <button onClick={loadClients} className="mt-2 text-xs font-medium text-red-700 underline hover:no-underline">
                  Reintentar
                </button>
              </div>
            </div>
          )}

          {/* Estado: sin resultados */}
          {!isLoading && !loadError && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-neutral-400 gap-3">
              <UserX className="w-10 h-10 text-neutral-300" />
              <div className="text-center">
                <p className="text-sm font-medium text-neutral-500">
                  {search ? 'Sin resultados' : 'No hay clientes registrados'}
                </p>
                {search && (
                  <p className="text-xs text-neutral-400 mt-1">
                    Intenta con otro nombre o cédula
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Lista de clientes ── */}
          {!isLoading && !loadError && filtered.length > 0 && (
            <ul className="divide-y divide-neutral-100">
              {filtered.map(client => {
                const isEditing = editingId === client.id;
                return (
                  <li key={client.id} className="group">
                    {/* Fila normal (seleccionable) */}
                    {!isEditing && (
                      <div
                        onClick={() => handleSelect(client)}
                        className="flex items-center gap-3 px-4 sm:px-6 py-3.5 cursor-pointer hover:bg-blue-50 transition-colors group/row"
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleSelect(client); }}
                        aria-label={`Seleccionar a ${client.name}`}
                      >
                        {/* Avatar inicial */}
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-semibold text-blue-700 uppercase leading-none">
                            {client.name.charAt(0)}
                          </span>
                        </div>

                        {/* Datos */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-800 truncate group-hover/row:text-blue-700 transition-colors">
                            {client.name}
                          </p>
                          <p className="text-xs text-neutral-500 truncate">{client.ciRif}</p>
                        </div>

                        {/* Acciones */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* Botón editar */}
                          <button
                            onClick={e => startEdit(e, client)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:bg-amber-50 hover:text-amber-600 transition-colors opacity-0 group-hover/row:opacity-100 focus:opacity-100"
                            aria-label={`Editar a ${client.name}`}
                            title="Editar cliente"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {/* Flecha seleccionar */}
                          <ChevronRight className="w-4 h-4 text-neutral-300 group-hover/row:text-blue-400 transition-colors" />
                        </div>
                      </div>
                    )}

                    {/* Fila en modo edición */}
                    {isEditing && (
                      <div
                        className="px-4 sm:px-6 py-4 bg-amber-50 border-l-4 border-amber-400"
                        onClick={e => e.stopPropagation()}
                      >
                        {/* Encabezado de edición */}
                        <div className="flex items-center gap-2 mb-3">
                          <Pencil className="w-3.5 h-3.5 text-amber-600" />
                          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                            Editando cliente
                          </span>
                        </div>

                        {/* Campos editables */}
                        <div className="space-y-2.5">
                          <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">
                              Nombre y Apellido <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={editState.name}
                              onChange={e => setEditState(s => ({ ...s, name: e.target.value }))}
                              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-white"
                              placeholder="Nombre completo"
                              autoFocus
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">
                              C.I. / RIF <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={editState.ciRif}
                              onChange={e => {
                                const isDeleting = (e.nativeEvent as InputEvent).inputType === 'deleteContentBackward';
                                setEditState(s => ({ ...s, ciRif: formatCIRif(e.target.value, isDeleting) }));
                              }}
                              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-white font-mono"
                              placeholder="Ej. V-12.345.678"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-xs font-medium text-neutral-600 mb-1">
                                Teléfono <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="tel"
                                value={editState.phone}
                                onChange={e => setEditState(s => ({ ...s, phone: formatPhoneNumber(e.target.value) }))}
                                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-white"
                                placeholder="+58 412-123-4567"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-neutral-600 mb-1">
                                Email <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="email"
                                value={editState.email}
                                onChange={e => setEditState(s => ({ ...s, email: e.target.value }))}
                                pattern=".*\.com"
                                title="El correo debe terminar en .com"
                                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-white"
                                placeholder="correo@ejemplo.com"
                              />
                            </div>
                          </div>

                          {/* Error de edición */}
                          {editError && (
                            <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                              <span>⚠️</span> {editError}
                            </p>
                          )}

                          {/* Botones de acción */}
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={e => saveEdit(e, client)}
                              disabled={isSavingEdit}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-colors disabled:opacity-60 shadow-sm"
                            >
                              {isSavingEdit
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Check className="w-3.5 h-3.5" />}
                              {isSavingEdit ? 'Guardando…' : 'Guardar cambios'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={isSavingEdit}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white hover:bg-neutral-100 text-neutral-600 text-xs font-semibold border border-neutral-200 transition-colors disabled:opacity-60"
                            >
                              <X className="w-3.5 h-3.5" />
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── Footer con contador ── */}
        {!isLoading && !loadError && (
          <div className="px-4 sm:px-6 py-3 border-t border-neutral-100 bg-neutral-50 flex-shrink-0">
            <p className="text-xs text-neutral-400 text-center">
              {filtered.length === clients.length
                ? `${clients.length} cliente${clients.length !== 1 ? 's' : ''} registrado${clients.length !== 1 ? 's' : ''}`
                : `${filtered.length} de ${clients.length} clientes`}
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
