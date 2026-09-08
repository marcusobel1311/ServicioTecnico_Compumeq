# 📖 Guía: Modificación de Textos y Asuntos de Correos

Esta guía detalla exactamente en qué archivos y líneas modificar los textos, asuntos y mensajes que se autogeneran al enviar correos dentro del sistema.

---

## 1. 📧 Correo de Recepción de Equipo (Al crear la orden)

📍 **Archivo:** [`src/components/ReceptionForm.tsx`](file:///c:/Users/PC/Downloads/servicio-t%C3%A9cnico-compumeq/src/components/ReceptionForm.tsx)

### A. Asunto y Mensaje predeterminado (Al dar clic en *"Vista Previa / Confirmar"*):
Busca la función `handlePreview` (aproximadamente en las líneas **116 a 121**):

```tsx
setEmailForm({
  recipients: order.client.email ? [order.client.email] : [''],
  subject: `Ficha para (IMPRIMIR) Recepción de Equipo - Orden N° ${currentOrderNumber}`,
  message: `Adjunto enviamos la ficha de recepción del equipo (${typeText}).\n\nPor favor, imprimir este comprobante.\n\nSaludos y Muchas Gracias!! \nServicio Técnico`
});
```

* **`\n`**: Crea un salto de línea (enter).
* **`${currentOrderNumber}`**: Inserta automáticamente el número de orden (ej. `000017`).
* **`${typeText}`**: Inserta el tipo de equipo (Laptop, Desktop, etc.).

---

### B. Títulos, Etiquetas e Inputs visuales:
Ubicados en la sección inferior de la vista previa (aproximadamente en las líneas **415 a 490**):
* **Título "Enviar por Correo":** Línea 417
* **Etiqueta "Destinatario(s)":** Línea 423
* **Placeholder del correo (`correo@ejemplo.com`):** Línea 436
* **Etiqueta "Asunto":** Línea 468
* **Etiqueta "Mensaje":** Línea 481

---

## 2. 📑 Correo de Ficha Registrada / Firmada (En Historial de Servicios)

📍 **Archivo:** [`src/components/ServiceHistory.tsx`](file:///c:/Users/PC/Downloads/servicio-t%C3%A9cnico-compumeq/src/components/ServiceHistory.tsx)

### A. Asunto y Mensaje predeterminado:
Busca la definición del estado dentro del componente `RegistrationModal` (aproximadamente en las líneas **12 a 15**):

```tsx
const [subject, setSubject] = useState(`Ficha Registrada de Recepción de Equipo - Orden N° ${order.orderNumber}`);
const defaultMessage = `Adjunto enviamos la ficha de recepción del equipo (${order.equipment.brandModel || 'Equipo'}), del cliente (${order.client.name || 'Cliente'} - ${order.client.ciRif || 'N/A'}).\n\nSaludos!! \nServicio Técnico Compumeq Express`;
const [message, setMessage] = useState(defaultMessage);
```

---

### B. Mensaje de respaldo (Fallback en caso de estar vacío):
Ubicado en la función `handleSubmit` (aproximadamente en la línea **76**):

```tsx
descripcion: message || defaultMessage,
```

---

### C. Títulos, Etiquetas y Placeholders visuales del Modal:
Ubicados dentro del formulario del modal (aproximadamente en las líneas **95 a 170**):
* **Título del modal (`Registrar Ficha - #...`):** Línea 95
* **Etiqueta de fotos (`Fotos de la Ficha Firmada...`):** Línea 104
* **Etiqueta "Destinatario(s)":** Línea 124
* **Placeholder del correo (`correo@ejemplo.com`):** Línea 133
* **Etiqueta "Asunto":** Línea 152
* **Etiqueta "Mensaje" y placeholder (`Mensaje opcional...`):** Líneas 163 y 169

---

## 💡 Resumen Rápido

| Qué quiero cambiar | Archivo | Dónde buscar |
| :--- | :--- | :--- |
| Asunto/Mensaje de **Recepción / Impresión** | `src/components/ReceptionForm.tsx` | Dentro de `handlePreview` (~Línea 116) |
| Asunto de **Ficha Registrada (Firmada)** | `src/components/ServiceHistory.tsx` | En `useState(``Ficha Registrada...``)` (~Línea 12) |
| Mensaje alternativo de **Ficha Firmada** | `src/components/ServiceHistory.tsx` | En `handleSubmit` (`descripcion: message \|\| ...`) (~Línea 75) |
