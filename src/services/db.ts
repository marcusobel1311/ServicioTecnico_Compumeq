/**
 * db.ts — Capa de acceso a datos (Supabase)
 *
 * Mapeo de nombres:
 *   TypeScript (camelCase)  ←→  Supabase/PostgreSQL (snake_case)
 *
 * Política de errores:
 *   Todas las funciones propagan el error al caller para que los
 *   componentes puedan mostrar feedback al usuario con try/catch.
 */

import { supabase } from '../lib/supabase';
import { Order, Client, PricingItem, Technician } from '../types';

// ─────────────────────────────────────────────────────────────
// Helpers de mapeo Supabase ↔ TypeScript
// ─────────────────────────────────────────────────────────────

/** Convierte una fila de `orders` (snake_case + client anidado) al tipo Order */
function rowToOrder(row: Record<string, unknown>): Order {
  const client = row.clients as Record<string, unknown>;
  return {
    id:             row.id as string,
    orderNumber:    row.order_number as string,
    technicianId:   (row.technician_id as string) ?? undefined,
    technicianName: (row.technician_name as string) ?? undefined,
    technicianCi:   (row.technician_ci as string) ?? undefined,
    date:           row.date as string,
    time:           row.time as string,
    client: {
      id:     client?.id as string | undefined,
      name:   client?.name as string,
      ciRif:  client?.ci_rif as string,
      phone:  client?.phone as string,
      email:  client?.email as string,
    },
    equipment:      row.equipment   as Order['equipment'],
    inspection:     row.inspection  as Order['inspection'],
    serviceJob:     row.service_job as Order['serviceJob'],
    status:         row.status as string,
    fichaRegistrada: row.ficha_registrada as boolean,
    fichaUrl:       (row.ficha_url as string) || ((row.service_job as Record<string, unknown>)?.fichaUrl as string) || undefined,
  };
}

/** Convierte una fila de `clients` al tipo Client */
function rowToClient(row: Record<string, unknown>): Client {
  return {
    id:    row.id as string,
    name:  row.name as string,
    ciRif: row.ci_rif as string,
    phone: (row.phone as string) ?? '',
    email: (row.email as string) ?? '',
  };
}

/** Convierte una fila de `pricing` al tipo PricingItem */
function rowToPricingItem(row: Record<string, unknown>): PricingItem {
  return {
    id:       row.id as string,
    service:  row.service as string,
    priceUSD: Number(row.price_usd),
    priceBCV: row.price_bcv !== undefined && row.price_bcv !== null && row.price_bcv !== ''
      ? Number(row.price_bcv)
      : undefined,
  };
}


/** Convierte una fila de `technicians` al tipo Technician */
function rowToTechnician(row: Record<string, unknown>): Technician {
  return {
    id:       row.id as string,
    name:     row.name as string,
    ci:       row.ci as string,
    phone:    (row.phone as string) ?? '',
    email:    (row.email as string) ?? '',
    isActive: row.is_active !== undefined && row.is_active !== null ? Boolean(row.is_active) : undefined,
  };
}

// ─────────────────────────────────────────────────────────────
// Servicio principal
// ─────────────────────────────────────────────────────────────

export const dbService = {

  // ── ORDERS ────────────────────────────────────────────────

  /**
   * Obtiene el siguiente número de orden usando la sequence atómica de PostgreSQL.
   * Llama a la función SQL `next_order_number()` vía RPC para garantizar
   * que dos usuarios simultáneos nunca reciban el mismo número.
   */
  getNextOrderNumber: async (): Promise<string> => {
    const { data, error } = await supabase.rpc('next_order_number');

    if (error) {
      console.warn('getNextOrderNumber RPC error:', error.message);
      // Fallback: buscar el máximo actual y sumar 1
      const { data: fallbackData } = await supabase
        .from('orders')
        .select('order_number')
        .order('order_number', { ascending: false })
        .limit(1);
      const last = fallbackData?.[0]?.order_number;
      const lastNum = last && /^\d{6}$/.test(String(last)) ? parseInt(String(last), 10) : -1;
      return String(lastNum + 1).padStart(6, '0');
    }

    return data as string;
  },

  /** Obtiene todas las órdenes con el cliente embebido (JOIN) */
  getOrders: async (): Promise<Order[]> => {
    const { data, error } = await supabase
      .from('orders')
      .select('*, clients(*)')
      .order('date', { ascending: false })
      .order('time', { ascending: false });

    if (error) throw new Error(`getOrders: ${error.message}`);
    return (data ?? []).map(rowToOrder);
  },

  /**
   * Guarda una nueva orden en Supabase.
   * 1. Hace upsert del cliente (por ci_rif único).
   * 2. Inserta la orden referenciando el client_id.
   * Devuelve la Order con el id asignado por la BD.
   */
  saveOrder: async (order: Order): Promise<Order> => {
    // 1 — Upsert del cliente
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .upsert(
        {
          name:   order.client.name,
          ci_rif: order.client.ciRif,
          phone:  order.client.phone,
          email:  order.client.email,
        },
        { onConflict: 'ci_rif' }
      )
      .select('id')
      .single();

    if (clientError) throw new Error(`saveOrder (client upsert): ${clientError.message}`);

    // 2 — Comprobar si la orden ya existe (por id o por order_number)
    let existingOrderId = order.id;
    if (!existingOrderId && order.orderNumber) {
      const { data: existing } = await supabase
        .from('orders')
        .select('id')
        .eq('order_number', order.orderNumber)
        .maybeSingle();
      if (existing?.id) {
        existingOrderId = existing.id as string;
      }
    }

    if (existingOrderId) {
      await dbService.updateOrder(existingOrderId, {
        technicianId:   order.technicianId,
        technicianName: order.technicianName,
        technicianCi:   order.technicianCi,
        date:           order.date,
        time:           order.time,
        equipment:      order.equipment,
        inspection:     order.inspection,
        serviceJob:     order.serviceJob,
        status:         order.status ?? 'Recibido',
        fichaRegistrada: order.fichaRegistrada ?? false,
      });

      const updated = await dbService.getOrderById(existingOrderId);
      if (updated) return updated;
    }

    // 3 — Insertar la orden nueva
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number:     order.orderNumber,
        client_id:        clientData.id,
        technician_id:    order.technicianId ?? null,
        technician_name:  order.technicianName ?? null,
        technician_ci:    order.technicianCi ?? null,
        date:             order.date,
        time:             order.time,
        equipment:        order.equipment,
        inspection:       order.inspection,
        service_job:      order.serviceJob,
        status:           order.status ?? 'Recibido',
        ficha_registrada: order.fichaRegistrada ?? false,
      })
      .select('*, clients(*)')
      .single();

    if (orderError) throw new Error(`saveOrder (insert): ${orderError.message}`);
    return rowToOrder(orderData as Record<string, unknown>);
  },

  /** Actualiza campos parciales de una orden existente */
  updateOrder: async (id: string, updates: Partial<Order>): Promise<void> => {
    // Convertir de camelCase a snake_case solo los campos presentes
    const payload: Record<string, unknown> = {};
    if (updates.status           !== undefined) payload.status            = updates.status;
    if (updates.fichaRegistrada  !== undefined) payload.ficha_registrada  = updates.fichaRegistrada;
    if (updates.fichaUrl         !== undefined) payload.ficha_url         = updates.fichaUrl;
    if (updates.technicianId     !== undefined) payload.technician_id     = updates.technicianId;
    if (updates.technicianName   !== undefined) payload.technician_name   = updates.technicianName;
    if (updates.technicianCi     !== undefined) payload.technician_ci     = updates.technicianCi;
    if (updates.equipment        !== undefined) payload.equipment         = updates.equipment;
    if (updates.inspection       !== undefined) payload.inspection        = updates.inspection;
    if (updates.serviceJob       !== undefined) payload.service_job       = updates.serviceJob;

    if (Object.keys(payload).length === 0) return;

    let { error } = await supabase
      .from('orders')
      .update(payload)
      .eq('id', id);

    // Fallback: si la columna 'ficha_url' aún no existe físicamente en la tabla 'orders'
    if (error && error.message && error.message.includes('ficha_url')) {
      delete payload.ficha_url;
      if (updates.fichaUrl !== undefined) {
        const { data: currentOrder } = await supabase.from('orders').select('service_job').eq('id', id).single();
        const currentJob = (currentOrder?.service_job as Record<string, unknown>) || {};
        payload.service_job = { ...currentJob, fichaUrl: updates.fichaUrl };
      }
      const retry = await supabase.from('orders').update(payload).eq('id', id);
      error = retry.error;
    }

    if (error) throw new Error(`updateOrder: ${error.message}`);
  },

  /** Obtiene una orden por su ID */
  getOrderById: async (id: string): Promise<Order | null> => {
    const { data, error } = await supabase
      .from('orders')
      .select('*, clients(*)')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return rowToOrder(data as Record<string, unknown>);
  },

  /**
   * Sube un archivo PDF de ficha al bucket de Supabase Storage ('fichas-recepcion').
   * Retorna la URL pública del archivo subido.
   */
  uploadFichaPdf: async (fileName: string, pdfBlob: Blob): Promise<string> => {
    const bucketName = 'fichas-recepcion';
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `fichas/${Date.now()}_${cleanFileName}`;

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      if (error.message.toLowerCase().includes('bucket not found') || (error as { statusCode?: string }).statusCode === '404') {
        throw new Error(
          "El bucket 'fichas-recepcion' no existe en Supabase Storage. Créalo en tu consola de Supabase (Storage → New bucket → 'fichas-recepcion' → marcar 'Public')."
        );
      }
      throw new Error(`Error al subir la ficha a Supabase Storage: ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  },

  // ── CLIENTS ───────────────────────────────────────────────

  /** Devuelve todos los clientes */
  getClients: async (): Promise<Client[]> => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name');

    if (error) throw new Error(`getClients: ${error.message}`);
    return (data ?? []).map(rowToClient);
  },

  /** Busca un cliente por su C.I. o RIF (búsqueda exacta) */
  findClientByCiRif: async (ciRif: string): Promise<Client | null> => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('ci_rif', ciRif)
      .maybeSingle();

    if (error) throw new Error(`findClientByCiRif: ${error.message}`);
    return data ? rowToClient(data as Record<string, unknown>) : null;
  },

  /** Inserta o actualiza un cliente por ci_rif */
  saveClient: async (client: Client): Promise<void> => {
    const { error } = await supabase
      .from('clients')
      .upsert(
        {
          name:   client.name,
          ci_rif: client.ciRif,
          phone:  client.phone,
          email:  client.email,
        },
        { onConflict: 'ci_rif' }
      );

    if (error) throw new Error(`saveClient: ${error.message}`);
  },

  // ── PRICING ───────────────────────────────────────────────

  /** Devuelve el tarifario completo */
  getPricing: async (): Promise<PricingItem[]> => {
    const { data, error } = await supabase
      .from('pricing')
      .select('*')
      .order('service');

    if (error) throw new Error(`getPricing: ${error.message}`);
    const items = (data ?? []).map(rowToPricingItem);

    // Leer overrides / valores locales de BCV si la columna en BD aún no existe
    try {
      const stored = localStorage.getItem('compumeq_pricing_bcv');
      if (stored) {
        const overrides: Record<string, number> = JSON.parse(stored);
        return items.map(item => {
          const key = item.id || item.service;
          if (overrides[key] !== undefined && item.priceBCV === undefined) {
            return { ...item, priceBCV: overrides[key] };
          }
          return item;
        });
      }
    } catch {
      // Ignorar errores de localStorage
    }

    return items;
  },

  /** Inserta un nuevo ítem o actualiza uno existente por id */
  savePricingItem: async (item: PricingItem): Promise<void> => {
    const payload: Record<string, unknown> = {
      service: item.service,
      price_usd: item.priceUSD,
    };

    if (item.priceBCV !== undefined && !isNaN(item.priceBCV)) {
      payload.price_bcv = item.priceBCV;
    }

    const saveLocalBCV = (key: string) => {
      try {
        const raw = localStorage.getItem('compumeq_pricing_bcv');
        const map: Record<string, number> = raw ? JSON.parse(raw) : {};
        if (item.priceBCV !== undefined && !isNaN(item.priceBCV)) {
          map[key] = item.priceBCV;
        } else {
          delete map[key];
        }
        localStorage.setItem('compumeq_pricing_bcv', JSON.stringify(map));
      } catch {}
    };

    if (item.id) {
      // Actualizar existente
      let { error } = await supabase
        .from('pricing')
        .update(payload)
        .eq('id', item.id);

      // Si la columna price_bcv no existe aún en la tabla de Supabase, reintentar sin ella
      if (error && error.message && error.message.includes('price_bcv')) {
        delete payload.price_bcv;
        const retry = await supabase
          .from('pricing')
          .update(payload)
          .eq('id', item.id);
        error = retry.error;
        if (!error) {
          saveLocalBCV(item.id);
        }
      } else if (!error) {
        saveLocalBCV(item.id);
      }

      if (error) throw new Error(`savePricingItem (update): ${error.message}`);
    } else {
      // Insertar nuevo
      let { data, error } = await supabase
        .from('pricing')
        .insert(payload)
        .select()
        .single();

      if (error && error.message && error.message.includes('price_bcv')) {
        delete payload.price_bcv;
        const retry = await supabase
          .from('pricing')
          .insert(payload)
          .select()
          .single();
        error = retry.error;
        data = retry.data;
        if (!error && (data?.id || item.service)) {
          saveLocalBCV(data?.id || item.service);
        }
      } else if (!error && (data?.id || item.service)) {
        saveLocalBCV(data?.id || item.service);
      }

      if (error) throw new Error(`savePricingItem (insert): ${error.message}`);
    }
  },

  /** Elimina un ítem del tarifario por id */
  deletePricingItem: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('pricing')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`deletePricingItem: ${error.message}`);

    try {
      const raw = localStorage.getItem('compumeq_pricing_bcv');
      if (raw) {
        const map: Record<string, number> = JSON.parse(raw);
        delete map[id];
        localStorage.setItem('compumeq_pricing_bcv', JSON.stringify(map));
      }
    } catch {}
  },

  // ── TECHNICIANS ───────────────────────────────────────────

  /** Devuelve todos los técnicos */
  getTechnicians: async (): Promise<Technician[]> => {
    const { data, error } = await supabase
      .from('technicians')
      .select('*')
      .order('name');

    if (error) throw new Error(`getTechnicians: ${error.message}`);
    const techs = (data ?? []).map(rowToTechnician);

    // Leer overrides locales si la columna en BD aún no existe
    try {
      const stored = localStorage.getItem('compumeq_technicians_status');
      if (stored) {
        const overrides: Record<string, boolean> = JSON.parse(stored);
        return techs.map(t => {
          if (t.id && overrides[t.id] !== undefined) {
            return { ...t, isActive: overrides[t.id] };
          }
          return { ...t, isActive: t.isActive ?? true };
        });
      }
    } catch {
      // Ignorar errores de localStorage
    }

    return techs.map(t => ({ ...t, isActive: t.isActive ?? true }));
  },

  /** Inserta o actualiza un técnico */
  saveTechnician: async (technician: Technician): Promise<void> => {
    const payload: Record<string, unknown> = {
      name:  technician.name,
      ci:    technician.ci,
      phone: technician.phone,
      email: technician.email,
    };

    if (technician.isActive !== undefined) {
      payload.is_active = technician.isActive;
    }

    if (technician.id) {
      // Actualizar existente
      let { error } = await supabase
        .from('technicians')
        .update(payload)
        .eq('id', technician.id);

      // Si la columna is_active no existe aún en la tabla de Supabase, reintentar sin ella
      if (error && error.message && error.message.includes('is_active')) {
        delete payload.is_active;
        const retry = await supabase
          .from('technicians')
          .update(payload)
          .eq('id', technician.id);
        error = retry.error;

        // Guardar estado localmente si se especificó
        if (!error && technician.id && technician.isActive !== undefined) {
          try {
            const raw = localStorage.getItem('compumeq_technicians_status');
            const map: Record<string, boolean> = raw ? JSON.parse(raw) : {};
            map[technician.id] = technician.isActive;
            localStorage.setItem('compumeq_technicians_status', JSON.stringify(map));
          } catch {}
        }
      }

      if (error) throw new Error(`saveTechnician (update): ${error.message}`);
    } else {
      // Insertar nuevo
      let { data, error } = await supabase
        .from('technicians')
        .insert(payload)
        .select('id')
        .single();

      if (error && error.message && error.message.includes('is_active')) {
        delete payload.is_active;
        const retry = await supabase
          .from('technicians')
          .insert(payload)
          .select('id')
          .single();
        error = retry.error;
        data = retry.data;

        if (!error && data?.id && technician.isActive !== undefined) {
          try {
            const raw = localStorage.getItem('compumeq_technicians_status');
            const map: Record<string, boolean> = raw ? JSON.parse(raw) : {};
            map[data.id] = technician.isActive;
            localStorage.setItem('compumeq_technicians_status', JSON.stringify(map));
          } catch {}
        }
      }

      if (error) throw new Error(`saveTechnician (insert): ${error.message}`);
    }
  },

  /** Actualiza únicamente el estado activo/inactivo de un técnico */
  setTechnicianActive: async (id: string, isActive: boolean): Promise<void> => {
    let { error } = await supabase
      .from('technicians')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error && error.message && error.message.includes('is_active')) {
      // Guardar en almacenamiento local como fallback transparente
      try {
        const raw = localStorage.getItem('compumeq_technicians_status');
        const map: Record<string, boolean> = raw ? JSON.parse(raw) : {};
        map[id] = isActive;
        localStorage.setItem('compumeq_technicians_status', JSON.stringify(map));
      } catch (storageErr) {
        console.error('Error guardando estado local del técnico:', storageErr);
      }
      return;
    }

    // Si tuvo éxito en Supabase, sincronizar también el fallback local
    try {
      const raw = localStorage.getItem('compumeq_technicians_status');
      const map: Record<string, boolean> = raw ? JSON.parse(raw) : {};
      map[id] = isActive;
      localStorage.setItem('compumeq_technicians_status', JSON.stringify(map));
    } catch {}

    if (error) throw new Error(`setTechnicianActive: ${error.message}`);
  },

  /** Elimina un técnico por id (mantenido por compatibilidad si fuese necesario) */
  deleteTechnician: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('technicians')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`deleteTechnician: ${error.message}`);
  },
};
