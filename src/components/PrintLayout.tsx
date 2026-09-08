import React from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Order } from '../types';

const Check: React.FC<{ checked: boolean; label: string }> = ({ checked, label }) => (
  <span className="inline-flex items-center mr-4 mb-1">
    <span className="inline-block w-3 h-3 border border-black mr-1 flex-shrink-0 relative top-[-1px]">
      {checked && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold leading-none">X</span>}
    </span>
    <span className="whitespace-nowrap">{label}</span>
  </span>
);

export function OrderDocumentPages({ 
  order, 
  previewMode = false, 
  idPrefix = 'print' 
}: { 
  order: Order; 
  previewMode?: boolean; 
  idPrefix?: string;
}) {
  const Page: React.FC<{ children: React.ReactNode; isLast?: boolean; pageNumber: number }> = ({ 
    children, 
    isLast = false, 
    pageNumber 
  }) => (
    <div 
      id={`${idPrefix}-sheet-page-${pageNumber}`}
      className={`font-mono text-[11pt] leading-tight text-black bg-white mx-auto relative compumeq-sheet-page ${
        previewMode 
          ? 'w-[794px] min-h-[1123px] shadow-2xl mb-8 p-12' // Formato estándar A4 para vista previa
          : `w-full print:w-full print:p-0 ${isLast ? 'print-no-break-after' : 'break-after-page'}` // Impresión
      }`}
      style={{
        fontFamily: "'Courier New', Courier, monospace",
        letterSpacing: "0.02em",
      }}
    >
      {children}
    </div>
  );

  return (
    <>
      {/* PAGE 1 */}
      <div className={previewMode ? "min-w-[794px]" : "w-full"}>
        <Page pageNumber={1}>
          {/* HEADER */}
          <div className="text-center font-bold text-lg mb-6 tracking-wider">
            FICHA DE RECEPCIÓN DE EQUIPOS
          </div>
          
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div>
              <span className="font-bold">N° Orden:</span><br/>
              = {order.orderNumber}
            </div>
            <div>
              <span className="font-bold">Fecha:</span><br/>
              = {order.date}
            </div>
            <div>
              <span className="font-bold">Hora:</span><br/>
              = {order.time}
            </div>
            <div>
              <span className="font-bold">Página:</span><br/>
              = 1 de 3
            </div>
          </div>

          {/* CLIENTE */}
          <div className="mb-6">
            <div className="font-bold uppercase mb-1">INFORMACIÓN DEL CLIENTE</div>
            <div className="border-b border-black border-dashed mb-2 w-64"></div>
            <div className="grid grid-cols-2 gap-y-4">
              <div>
                <span className="font-bold">Nombre y apellido:</span><br/>
                = {order.client.name || ' '}
              </div>
              <div>
                <span className="font-bold">Teléfono:</span><br/>
                = {order.client.phone || ' '}
              </div>
              <div>
                <span className="font-bold">C.I./RIF:</span><br/>
                = {order.client.ciRif || ' '}
              </div>
              <div>
                <span className="font-bold">Email:</span><br/>
                = {order.client.email || ' '}
              </div>
            </div>
          </div>

          {/* EQUIPO */}
          <div className="mb-6">
            <div className="font-bold uppercase mb-1">IDENTIFICACIÓN DEL EQUIPO:</div>
            <div className="border-b border-black border-dashed mb-2 w-64"></div>
            
            <div className="grid grid-cols-2 gap-y-4">
              <div>
                <span className="font-bold">Equipo:</span><br/>
                <div className="flex flex-col mt-1 ml-4">
                  {['Laptop', 'Desktop', 'All-in-one', 'Otro'].map(t => (
                    <Check key={t} checked={order.equipment.type === t} label={t + (t === 'Otro' && order.equipment.type === 'Otro' ? `: ${order.equipment.otherType || ''}` : '')} />
                  ))}
                </div>
                
                <div className="mt-4">
                  <span className="font-bold">Marca/Modelo:</span><br/>
                  = {order.equipment.brandModel || ' '}
                </div>
                <div className="mt-4">
                  <span className="font-bold">Color:</span><br/>
                  = {order.equipment.color || ' '}
                </div>
                <div className="mt-4">
                  <span className="font-bold">N° de serie:</span><br/>
                  = {order.equipment.serialNumber || ' '}
                </div>
              </div>
              
              <div>
                <span className="font-bold">Accesorios incluidos:</span><br/>
                <div className="flex flex-col mt-1 ml-4">
                  {['Cargador original', 'Cargador genérico', 'Cable de poder', 'Estuche/Bolso', 'Ninguno', 'Otro'].map(a => (
                    <Check key={a} checked={order.equipment.accessories.includes(a)} label={a + (a === 'Otro' && order.equipment.accessories.includes('Otro') ? `: ${order.equipment.otherAccessory || ''}` : '')} />
                  ))}
                </div>
                
                <div className="mt-6">
                  <div className="font-bold uppercase mb-1">SEGURIDAD DEL EQUIPO:</div>
                  <div className="border-b border-black border-dashed mb-2 w-48"></div>
                  <div>
                    <span className="font-bold">Usuario:</span><br/>
                    = {order.equipment.username || ' '}
                  </div>
                  <div className="mt-2">
                    <span className="font-bold">Contraseña:</span><br/>
                    = {order.equipment.password || ' '}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Page>
      </div>
      
      {/* PAGE 2 */}
      <div className={previewMode ? "min-w-[794px]" : "w-full"}>
        <Page pageNumber={2}>
          {/* HEADER PAGE 2 */}
          <div className="text-center font-bold text-lg mb-6 tracking-wider">
            FICHA DE RECEPCIÓN DE EQUIPOS
          </div>
          
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div>
              <span className="font-bold">N° Orden:</span><br/>
              = {order.orderNumber}
            </div>
            <div>
              <span className="font-bold">Fecha:</span><br/>
              = {order.date}
            </div>
            <div>
              <span className="font-bold">Hora:</span><br/>
              = {order.time}
            </div>
            <div>
              <span className="font-bold">Página:</span><br/>
              = 2 de 3
            </div>
          </div>

          {/* INSPECCION */}
          <div className="mb-6">
            <div className="font-bold uppercase mb-1">INSPECCIÓN FÍSICA Y DIAGNÓSTICO PREVIO:</div>
            <div className="border-b border-black border-dashed mb-4 w-96"></div>
            
            <div className="grid grid-cols-3 gap-6 gap-y-8">
              {/* Encendido */}
              <div>
                <div className="font-bold mb-1">Encendido:</div>
                <div className="border-b border-black border-dashed mb-2 w-24"></div>
                <div className="flex flex-col ml-4">
                  {['Sí', 'No', 'Se apaga solo'].map(o => <Check key={o} checked={order.inspection.power.status.includes(o)} label={o}/>)}
                </div>
                <div className="mt-2 font-bold">Notas:</div>
                <div>= {order.inspection.power.notes || ' '}</div>
              </div>
              {/* Pantalla */}
              <div>
                <div className="font-bold mb-1">Pantalla/Video:</div>
                <div className="border-b border-black border-dashed mb-2 w-32"></div>
                <div className="flex flex-col ml-4">
                  {['OK', 'Rota', 'Rayada', 'Sin video'].map(o => <Check key={o} checked={order.inspection.screen.status.includes(o)} label={o}/>)}
                </div>
                <div className="mt-2 font-bold">Notas:</div>
                <div>= {order.inspection.screen.notes || ' '}</div>
              </div>
              {/* Teclado */}
              <div>
                <div className="font-bold mb-1">Teclado/Touchpad:</div>
                <div className="border-b border-black border-dashed mb-2 w-32"></div>
                <div className="flex flex-col ml-4">
                  {['OK', 'Faltan teclas', 'No responde'].map(o => <Check key={o} checked={order.inspection.keyboard.status.includes(o)} label={o}/>)}
                </div>
                <div className="mt-2 font-bold">Notas:</div>
                <div>= {order.inspection.keyboard.notes || ' '}</div>
              </div>
              
              {/* Puertos */}
              <div>
                <div className="font-bold mb-1">Puertos USB/Carga:</div>
                <div className="border-b border-black border-dashed mb-2 w-40"></div>
                <div className="flex flex-col ml-4">
                  {['OK', 'Sulfatados', 'Flojos/Rotos'].map(o => <Check key={o} checked={order.inspection.ports.status.includes(o)} label={o}/>)}
                </div>
                <div className="mt-2 font-bold">Notas:</div>
                <div>= {order.inspection.ports.notes || ' '}</div>
              </div>
              {/* Chasis */}
              <div>
                <div className="font-bold mb-1">Chasis/Tornillos:</div>
                <div className="border-b border-black border-dashed mb-2 w-40"></div>
                <div className="flex flex-col ml-4">
                  {['Completo', 'Golpes', 'Faltan tornillos'].map(o => <Check key={o} checked={order.inspection.chassis.status.includes(o)} label={o}/>)}
                </div>
                <div className="mt-2 font-bold">Notas:</div>
                <div>= {order.inspection.chassis.notes || ' '}</div>
              </div>
              {/* Optica */}
              <div>
                <div className="font-bold mb-1">Unidad Óptica/Otros:</div>
                <div className="border-b border-black border-dashed mb-2 w-48"></div>
                <div className="flex flex-col ml-4">
                  {['OK', 'No aplica', 'Dañado'].map(o => <Check key={o} checked={order.inspection.opticalDrive.status.includes(o)} label={o}/>)}
                </div>
                <div className="mt-2 font-bold">Notas:</div>
                <div>= {order.inspection.opticalDrive.notes || ' '}</div>
              </div>
            </div>
          </div>

          {/* MOTIVO */}
          <div className="mb-6 mt-8">
            <div className="font-bold uppercase mb-1">MOTIVO DE INGRESO:</div>
            <div className="border-b border-black border-dashed mb-2 w-40"></div>
            <div>= {order.serviceJob.reportedFailure || ' '}</div>
          </div>

          {/* TRABAJO SUGERIDO */}
          <div className="mb-6">
            <div className="font-bold uppercase mb-1">TRABAJO SUGERIDO/SOLICITADO:</div>
            <div className="border-b border-black border-dashed mb-2 w-64"></div>
            <div className="flex flex-col ml-4">
              {['Mantenimiento preventivo térmico y físico', 'Diagnóstico de hardware por falla', 'Optimización de Software/Sistema Operativo (OS)'].map(s => (
                 <Check key={s} checked={order.serviceJob.services.includes(s)} label={s}/>
              ))}
              <div className="mt-1 ml-[-1rem]">
                - Respaldo de datos:
                <div className="ml-4 flex flex-col mt-1">
                  <Check checked={order.serviceJob.backupRequired} label={`Sí requiere respaldo. Ruta = ${order.serviceJob.backupRoute || ''}`} />
                  {order.serviceJob.backupRequired && (
                    <div className="ml-8 mb-1">
                      Prioridad:<br/>
                      <div className="ml-4 flex flex-col mt-1">
                        {['Fotos', 'Documentos', 'Todo el usuario'].map(p => (
                          <Check key={p} checked={order.serviceJob.backupPriority === p} label={p}/>
                        ))}
                      </div>
                    </div>
                  )}
                  <Check checked={!order.serviceJob.backupRequired} label="No requiere respaldo." />
                </div>
              </div>
              <Check checked={!!order.serviceJob.partsRequested} label={`Reemplazo de pieza = ${order.serviceJob.partsRequested || ''}`} />
            </div>
          </div>
        </Page>
      </div>
      
      {/* PAGE 3 */}
      <div className={previewMode ? "min-w-[794px]" : "w-full"}>
        <Page pageNumber={3} isLast={true}>
          {/* HEADER PAGE 3 */}
          <div className="text-center font-bold text-lg mb-6 tracking-wider">
            FICHA DE RECEPCIÓN DE EQUIPOS
          </div>
          
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div>
              <span className="font-bold">N° Orden:</span><br/>
              = {order.orderNumber}
            </div>
            <div>
              <span className="font-bold">Fecha:</span><br/>
              = {order.date}
            </div>
            <div>
              <span className="font-bold">Hora:</span><br/>
              = {order.time}
            </div>
            <div>
              <span className="font-bold">Página:</span><br/>
              = 3 de 3
            </div>
          </div>

          {/* TÉRMINOS */}
          <div className="mb-8 text-[11pt] leading-tight text-justify">
            <div className="font-bold uppercase mb-1">TÉRMINOS, CONDICIONES Y RESPONSABILIDAD LEGAL:</div>
            <div className="border-b border-black border-dashed mb-3 w-96"></div>
            
            <div className="font-bold mb-1">Garantía de Datos:</div>
            <div className="ml-4 mb-2">
              <Check checked={!order.serviceJob.backupRequired} label="Caso A, el cliente no solicita respaldo:" /> El cliente declara que ha respaldado toda información crítica. El técnico no se hace responsable por la pérdida parcial o total de datos, software o configuraciones durante el proceso de soporte o pruebas de estrés de hardware.<br/>
              <Check checked={order.serviceJob.backupRequired} label="Caso B, el cliente solicita respaldo y recuperación:" /> El cliente autoriza expresamente al técnico a acceder a sus unidades de almacenamiento para realizar la extracción de datos. El técnico se compromete a aplicar las mejores prácticas de ingeniería para salvaguardar la información. No obstante, debido a la naturaleza impredecible de las fallas de hardware (sectores dañados, degradación magnética o chips de memoria corruptos), el cliente acepta que la recuperación total o parcial está sujeta al estado físico real del disco, eximiendo al servicio técnico de responsabilidad si los datos ya fuesen técnicamente irrecuperables al momento del ingreso.
            </div>
            <br/>
            
            <div className="font-bold inline">Equipos Inoperativos:</div> Si el equipo ingresa sin encender o sin dar video, el cliente acepta que existen riesgos de fallas preexistentes ocultas en la placa lógica que imposibiliten su reparación o que se manifiesten al energizar el circuito.<br/><br/>
            
            <div className="font-bold inline">Licenciamiento:</div> El cliente es responsable de las licencias del software que solicite instalar. El servicio técnico solo provee la mano de obra de instalación y configuración.<br/><br/>
            
            <div className="font-bold inline">Retiro y Abandono:</div> Todo equipo genera un costo de almacenamiento diario de 1,00$ (1 USD al cambio, a la tasa BCV del día) si no es retirado pasados los 15 días continuos de la notificación de entrega. A los 45 días continuos, el equipo se declarará legalmente en abandono y pasará a ser propiedad del servicio técnico para cubrir costos operativos y de repuestos.<br/><br/>
          </div>

          {/* FIRMAS */}
          <div className="mt-12">
            <div className="font-bold uppercase mb-1">DECLARACIÓN DE CONFORMIDAD:</div>
            <div className="border-b border-black border-dashed mb-2 w-64"></div>
            <p className="mb-20 text-[11pt]">Al firmar, ambas partes validan el inventario, las fallas declaradas y aceptan las condiciones del servicio de forma vinculante.</p>
            
            <div className="flex justify-between px-8 text-center text-[11pt]">
              <div>
                <div className="border-t border-black w-64 mb-1 mx-auto"></div>
                Cliente / Quien entrega<br/>
                <span className="font-bold uppercase">{order.client.name || 'NOMBRE DEL CLIENTE'}</span><br/>
                C.I.: {order.client.ciRif || ' '}
              </div>
              <div>
                <div className="border-t border-black w-64 mb-1 mx-auto"></div>
                Técnico / Quien recibe<br/>
                <span className="font-bold uppercase">{order.technicianName || 'NOMBRE DEL TÉCNICO'}</span><br/>
                C.I.: {order.technicianCi || ''}
              </div>
            </div>
          </div>
        </Page>
      </div>
    </>
  );
}

export default function PrintLayout({ order, previewMode = false }: { order: Order; previewMode?: boolean }) {
  if (previewMode) {
    return (
      <>
        {/* Vista interactiva con zoom y pan para el usuario */}
        <div className="block w-full bg-neutral-500 overflow-hidden relative cursor-grab active:cursor-grabbing touch-none" style={{ height: '80vh' }}>
          <TransformWrapper
            initialScale={typeof window !== 'undefined' && window.innerWidth < 794 ? window.innerWidth / 820 : 1}
            minScale={0.2}
            maxScale={3}
            centerOnInit={true}
            wheel={{ step: 0.01, activationKeys: ["Shift"] }}
            trackPadPanning={{ disabled: false }}
            pinch={{ step: 2 }}
            doubleClick={{ step: 0.3 }}
          >
            <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ padding: "2rem 0", display: "flex", justifyContent: "center", width: "100%" }}>
              <div>
                <OrderDocumentPages order={order} previewMode={true} idPrefix="preview" />
              </div>
            </TransformComponent>
          </TransformWrapper>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-xs font-medium pointer-events-none backdrop-blur-sm whitespace-nowrap">
            <span className="md:hidden">Pellizcar para hacer zoom</span>
            <span className="hidden md:inline">Shift + Rueda para zoom</span>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="hidden print:block">
      <OrderDocumentPages order={order} previewMode={false} idPrefix="print" />
    </div>
  );
}
