import { dbService } from './db';
import { Technician } from '../types';

export interface CustomFrequentEmail {
  id: string;
  email: string;
  label?: string;
  createdAt: number;
}

const STORAGE_KEY = 'compumeq_custom_frequent_emails';
const EVENT_KEY = 'compumeq_frequent_emails_updated';

export const frequentEmailsService = {
  // Obtener técnicos de la base de datos
  getTechnicians: async (): Promise<Technician[]> => {
    try {
      const technicians = await dbService.getTechnicians();
      // Filtrar solo técnicos con email válido
      return technicians.filter(t => t.email && t.email.trim().length > 0);
    } catch (err) {
      console.error('Error al cargar técnicos para correos frecuentes:', err);
      return [];
    }
  },

  // Obtener correos personalizados de localStorage
  getCustomEmails: (): CustomFrequentEmail[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data) as CustomFrequentEmail[];
    } catch (err) {
      console.error('Error al leer correos frecuentes personalizados:', err);
      return [];
    }
  },

  // Guardar nuevo correo personalizado
  addCustomEmail: (email: string, label?: string): CustomFrequentEmail => {
    const trimmedEmail = email.trim();
    const trimmedLabel = label?.trim() || '';
    const current = frequentEmailsService.getCustomEmails();

    const newEntry: CustomFrequentEmail = {
      id: 'custom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      email: trimmedEmail,
      label: trimmedLabel || undefined,
      createdAt: Date.now(),
    };

    const updated = [newEntry, ...current];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(EVENT_KEY));
    return newEntry;
  },

  // Actualizar correo personalizado existente
  updateCustomEmail: (id: string, email: string, label?: string): void => {
    const trimmedEmail = email.trim();
    const trimmedLabel = label?.trim() || '';
    const current = frequentEmailsService.getCustomEmails();

    const updated = current.map(item => {
      if (item.id === id) {
        return {
          ...item,
          email: trimmedEmail,
          label: trimmedLabel || undefined,
        };
      }
      return item;
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(EVENT_KEY));
  },

  // Eliminar correo personalizado
  deleteCustomEmail: (id: string): void => {
    const current = frequentEmailsService.getCustomEmails();
    const updated = current.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(EVENT_KEY));
  },

  // Escuchar cambios
  subscribe: (callback: () => void) => {
    const handler = () => callback();
    window.addEventListener(EVENT_KEY, handler);
    return () => window.removeEventListener(EVENT_KEY, handler);
  },
};
