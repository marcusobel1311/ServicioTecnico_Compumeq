# Mapa de Integración Backend (INTEGRATION_MAP.md)

## Contexto del Proyecto
Esta es una aplicación web (React + TypeScript + Vite) diseñada para la gestión de recepción de servicios, control de historial, asignación de técnicos y gestión de precios.

Actualmente, el frontend está completamente terminado a nivel de Interfaz de Usuario (UI) y Diseño (Tailwind CSS). Sin embargo, la capa de datos es "mock" (simulada o basada en almacenamiento local) y la capa de notificaciones es ficticia.

## El Objetivo Principal
Migrar toda la capa de datos a una base de datos real en **Supabase** y la capa de notificaciones a una API de correos local (**Api correo**), **SIN ALTERAR en lo absoluto el diseño visual, las clases de Tailwind ni la estructura HTML/CSS de los componentes.**

## Mapa de Entidades (Data Models)
Basado en las interfaces en `/src/types.ts` y la UI, el modelo de negocio maneja:
1. **Reception (Recepción/Tickets):** Información del cliente, equipo, estado del servicio, técnico asignado.
2. **Technician (Técnicos):** Personal encargado de los servicios.
3. **Pricing (Precios/Catálogo):** Catálogo de servicios y sus costos.
4. **ServiceHistory (Historial):** Registro de cambios de estado o actualizaciones de un ticket.

## Los Cabos Sueltos (Nodos de Integración)

### Nodo 1: Base de Datos (`/src/services/db.ts`)
*   **Estado actual:** Funciona con datos simulados o `localStorage`.
*   **Acción requerida:** Reemplazar todas las funciones CRUD para que consuman el SDK de Supabase (`@supabase/supabase-js`).
*   **Requisito previo:** Generar un esquema SQL optimizado, relacional y profesional para crear las tablas en Supabase.

### Nodo 2: Notificaciones (`/src/services/notifications.ts`)
*   **Estado actual:** Simula el envío de correos con `console.log` o `setTimeout`.
*   **Acción requerida:** Conectar con la carpeta anexa "Api correo". Debe hacer peticiones HTTP (fetch) a los endpoints expuestos en esa carpeta para enviar correos reales al cambiar de estado un servicio o crear una recepción.

### Nodo 3: Componentes de UI (Frontend a Lógica)
*   `/src/components/ReceptionForm.tsx`
*   `/src/components/ServiceHistory.tsx`
*   `/src/components/Technicians.tsx`
*   `/src/components/Pricing.tsx`
*   **Acción requerida:** Conectar los hooks y estados a los nuevos servicios de `db.ts` y `notifications.ts`. Implementar estados de carga lógicos (`isLoading`) y manejo de errores (try/catch). 
*   **RESTRICCIÓN CRÍTICA:** Está estrictamente prohibido modificar la estética, clases de Tailwind, o estructura visual. Solo se debe inyectar la lógica de estado.
