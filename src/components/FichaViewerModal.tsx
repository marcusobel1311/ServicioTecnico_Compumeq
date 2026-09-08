import React, { useEffect, useState } from 'react';
import { Order } from '../types';
import { dbService } from '../services/db';
import { X, ExternalLink, FileText, Loader2 } from 'lucide-react';

interface FichaViewerModalProps {
  order: Order;
  onClose: () => void;
}

export default function FichaViewerModal({ order, onClose }: FichaViewerModalProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(order.fichaUrl || null);
  const [isLoading, setIsLoading] = useState<boolean>(!order.fichaUrl);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadFichaUrl() {
      if (order.fichaUrl) {
        setPdfUrl(order.fichaUrl);
        setIsLoading(false);
        return;
      }

      if (!order.id) {
        setError('No se encontró el identificador del servicio.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const freshOrder = await dbService.getOrderById(order.id);
        if (isMounted) {
          if (freshOrder?.fichaUrl) {
            setPdfUrl(freshOrder.fichaUrl);
          } else {
            setError('La ficha no tiene un documento PDF registrado en la base de datos.');
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Error al consultar la ficha en la base de datos.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadFichaUrl();

    return () => {
      isMounted = false;
    };
  }, [order]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden border border-neutral-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 bg-neutral-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-neutral-900">
                  Ficha de Recepción — #{order.orderNumber}
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                  Subida
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Cliente: <span className="font-medium text-neutral-700">{order.client.name}</span> ({order.client.ciRif})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-neutral-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Abrir en pestaña nueva"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors ml-1"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 bg-neutral-100 relative flex items-center justify-center overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 text-neutral-500">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm font-medium">Cargando documento PDF de Supabase Storage...</p>
            </div>
          ) : error ? (
            <div className="text-center p-6 max-w-md">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
                <X className="w-6 h-6" />
              </div>
              <h4 className="text-base font-semibold text-neutral-800 mb-1">No se pudo cargar el PDF</h4>
              <p className="text-sm text-neutral-500 mb-4">{error}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Entendido
              </button>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              title={`Ficha de Recepción #${order.orderNumber}`}
              className="w-full h-full border-0"
            />
          ) : (
            <p className="text-sm text-neutral-500">No hay documento disponible.</p>
          )}
        </div>
      </div>
    </div>
  );
}
