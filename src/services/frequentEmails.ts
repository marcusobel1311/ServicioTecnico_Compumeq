import { supabase } from '../lib/supabase';
import { dbService } from './db';
import { Technician } from '../types';

export interface CustomFrequentEmail {
  id: string;
  email: string;
  label?: string;
  createdAt: number;
}

/** Mapea una fila de `frequent_emails` al tipo CustomFrequentEmail */
function rowToCustomEmail(row: Record<string, unknown>): CustomFrequentEmail {
  return {
    id:        row.id as string,
    email:     row.email as string,
    label:     (row.label as string) || undefined,
    createdAt: new Date(row.created_at as string).getTime(),
  };
}

export const frequentEmailsService = {
  // ── TÉCNICOS ────────────────────────────────────────────────

  /** Obtiene técnicos de Supabase (solo los activos y con email válido) */
  getTechnicians: async (): Promise<Technician[]> => {
    try {
      const technicians = await dbService.getTechnicians();
      return technicians.filter(t => t.isActive !== false && t.email && t.email.trim().length > 0);
    } catch (err) {
      console.error('Error al cargar técnicos para correos frecuentes:', err);
      return [];
    }
  },

  // ── CORREOS GUARDADOS (Supabase) ─────────────────────────────

  /** Obtiene todos los correos guardados desde Supabase */
  getCustomEmails: async (): Promise<CustomFrequentEmail[]> => {
    try {
      const { data, error } = await supabase
        .from('frequent_emails')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []).map(row => rowToCustomEmail(row as Record<string, unknown>));
    } catch (err) {
      console.error('Error al leer correos frecuentes personalizados:', err);
      return [];
    }
  },

  /** Guarda un nuevo correo en Supabase */
  addCustomEmail: async (email: string, label?: string): Promise<CustomFrequentEmail> => {
    const trimmedEmail = email.trim();
    const trimmedLabel = label?.trim() || '';

    const { data, error } = await supabase
      .from('frequent_emails')
      .insert({
        email: trimmedEmail,
        label: trimmedLabel || null,
      })
      .select()
      .single();

    if (error) throw new Error(`addCustomEmail: ${error.message}`);
    return rowToCustomEmail(data as Record<string, unknown>);
  },

  /** Actualiza un correo existente en Supabase */
  updateCustomEmail: async (id: string, email: string, label?: string): Promise<void> => {
    const trimmedEmail = email.trim();
    const trimmedLabel = label?.trim() || '';

    const { error } = await supabase
      .from('frequent_emails')
      .update({
        email: trimmedEmail,
        label: trimmedLabel || null,
      })
      .eq('id', id);

    if (error) throw new Error(`updateCustomEmail: ${error.message}`);
  },

  /** Elimina un correo de Supabase */
  deleteCustomEmail: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('frequent_emails')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`deleteCustomEmail: ${error.message}`);
  },

  /**
   * Suscribe a cambios en la tabla `frequent_emails` vía Supabase Realtime.
   * Devuelve una función de limpieza para cancelar la suscripción.
   */
  subscribe: (callback: () => void): (() => void) => {
    const channel = supabase
      .channel('frequent_emails_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'frequent_emails' },
        () => callback()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
