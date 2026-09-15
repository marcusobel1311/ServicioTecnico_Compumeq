import { supabase } from '../lib/supabase';
import { dbService } from './db';
import { Technician } from '../types';

export interface CustomFrequentEmail {
  id: string;
  email: string;
  label?: string;
  createdAt: number;
}

// ─────────────────────────────────────────────────────────────
// Clave de localStorage para respaldo local
// ─────────────────────────────────────────────────────────────
const LS_KEY = 'compumeq_frequent_emails';

// ─────────────────────────────────────────────────────────────
// Helpers de mapeo Supabase ↔ TypeScript
// ─────────────────────────────────────────────────────────────

/** Mapea una fila de `frequent_emails` al tipo CustomFrequentEmail */
function rowToCustomEmail(row: Record<string, unknown>): CustomFrequentEmail {
  return {
    id:        row.id as string,
    email:     row.email as string,
    label:     (row.label as string) || undefined,
    createdAt: new Date(row.created_at as string).getTime(),
  };
}

// ─────────────────────────────────────────────────────────────
// Helpers de localStorage (respaldo local)
// ─────────────────────────────────────────────────────────────

function lsRead(): CustomFrequentEmail[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as CustomFrequentEmail[]) : [];
  } catch {
    return [];
  }
}

function lsWrite(items: CustomFrequentEmail[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch {
    // Ignorar errores de cuota / modo privado
  }
}

function lsGenId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─────────────────────────────────────────────────────────────
// Servicio principal
// ─────────────────────────────────────────────────────────────

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

  // ── CORREOS GUARDADOS (Supabase + localStorage resiliente) ───

  /**
   * Obtiene todos los correos guardados.
   * 1️⃣ Intenta leer desde Supabase (fuente de verdad).
   * 2️⃣ Si falla (RLS, sin red), devuelve los guardados en localStorage.
   * Combina y sincroniza ambas fuentes: Supabase tiene prioridad.
   */
  getCustomEmails: async (): Promise<CustomFrequentEmail[]> => {
    const localItems = lsRead();

    try {
      const { data, error } = await supabase
        .from('frequent_emails')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const remoteItems = (data ?? []).map(row => rowToCustomEmail(row as Record<string, unknown>));

      // Mantener ítems locales que aún no existan en remoto (creados offline)
      const remoteIds = new Set(remoteItems.map(r => r.id));
      const onlyLocal = localItems.filter(l => !remoteIds.has(l.id));
      const combined  = [...remoteItems, ...onlyLocal];

      // Sincronizar localStorage con los datos combinados
      lsWrite(combined);
      return combined;
    } catch (err) {
      // Supabase no disponible o RLS bloqueó: devolvemos los locales
      console.warn('[frequentEmails] Supabase no disponible, usando localStorage:', err);
      return localItems;
    }
  },

  /**
   * Guarda un nuevo correo.
   * 1️⃣ Intenta insertar en Supabase.
   * 2️⃣ Si falla (RLS u otro error), persiste localmente con id temporal.
   * En ambos casos actualiza localStorage para que el estado sea inmediato.
   */
  addCustomEmail: async (email: string, label?: string): Promise<CustomFrequentEmail> => {
    const trimmedEmail = email.trim();
    const trimmedLabel = label?.trim() || '';

    try {
      const { data, error } = await supabase
        .from('frequent_emails')
        .insert({
          email: trimmedEmail,
          label: trimmedLabel || null,
        })
        .select()
        .single();

      if (error) throw error;

      const newItem = rowToCustomEmail(data as Record<string, unknown>);
      const local   = lsRead();
      lsWrite([newItem, ...local]);
      return newItem;
    } catch (err) {
      console.warn('[frequentEmails] addCustomEmail Supabase falló, guardando localmente:', err);

      const newItem: CustomFrequentEmail = {
        id:        lsGenId(),
        email:     trimmedEmail,
        label:     trimmedLabel || undefined,
        createdAt: Date.now(),
      };

      const local = lsRead();
      lsWrite([newItem, ...local]);
      return newItem;
    }
  },

  /**
   * Actualiza un correo existente.
   * Siempre actualiza localStorage de forma inmediata.
   * Si el id NO es local (fue guardado en Supabase), intenta el update remoto.
   */
  updateCustomEmail: async (id: string, email: string, label?: string): Promise<void> => {
    const trimmedEmail = email.trim();
    const trimmedLabel = label?.trim() || '';

    // Actualizar en localStorage de forma inmediata
    const local   = lsRead();
    const updated = local.map(item =>
      item.id === id
        ? { ...item, email: trimmedEmail, label: trimmedLabel || undefined }
        : item
    );
    lsWrite(updated);

    // Si el id es local, no intentar el update remoto
    if (id.startsWith('local_')) return;

    try {
      const { error } = await supabase
        .from('frequent_emails')
        .update({
          email: trimmedEmail,
          label: trimmedLabel || null,
        })
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      // El cambio ya quedó en localStorage; no bloqueamos al usuario
      console.warn('[frequentEmails] updateCustomEmail Supabase falló, cambio guardado localmente:', err);
    }
  },

  /**
   * Elimina un correo.
   * Elimina de localStorage de forma inmediata.
   * Si el id NO es local, intenta también eliminarlo de Supabase.
   */
  deleteCustomEmail: async (id: string): Promise<void> => {
    // Eliminar de localStorage de forma inmediata
    const local = lsRead();
    lsWrite(local.filter(item => item.id !== id));

    if (id.startsWith('local_')) return;

    try {
      const { error } = await supabase
        .from('frequent_emails')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.warn('[frequentEmails] deleteCustomEmail Supabase falló, eliminado solo localmente:', err);
    }
  },

  /**
   * Suscribe a cambios en la tabla `frequent_emails` vía Supabase Realtime.
   * Devuelve una función de limpieza para cancelar la suscripción.
   */
  subscribe: (callback: () => void): (() => void) => {
    try {
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
    } catch (err) {
      console.warn('[frequentEmails] subscribe Realtime no disponible:', err);
      return () => {};
    }
  },
};
