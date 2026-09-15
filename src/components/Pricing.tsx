import React, { useState, useEffect } from 'react';
import { dbService } from '../services/db';
import { PricingItem } from '../types';
import { DollarSign, Cpu, Plus, X, Edit, Trash2 } from 'lucide-react';
import { useArrowNavigation } from '../lib/useArrowNavigation';

export default function Pricing() {
  const [pricing, setPricing] = useState<PricingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pricingError, setPricingError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newService, setNewService] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newPriceBCV, setNewPriceBCV] = useState('');

  useEffect(() => {
    loadPricing();
  }, []);

  const loadPricing = async () => {
    setIsLoading(true);
    setPricingError('');
    try {
      const data = await dbService.getPricing();
      setPricing(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al cargar el tarifario.';
      setPricingError(msg);
      console.error('[Pricing] loadPricing:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newService || !newPrice) return;
    
    try {
      await dbService.savePricingItem({
        id: editingId || undefined,
        service: newService,
        priceUSD: parseFloat(newPrice),
        priceBCV: newPriceBCV.trim() ? parseFloat(newPriceBCV) : undefined,
      });
      setNewService('');
      setNewPrice('');
      setNewPriceBCV('');
      setEditingId(null);
      setShowAddForm(false);
      await loadPricing();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el servicio.';
      setPricingError(msg);
      console.error('[Pricing] handleAddPricing:', err);
    }
  };

  const handleEditClick = (item: PricingItem) => {
    setEditingId(item.id || null);
    setNewService(item.service);
    setNewPrice(item.priceUSD.toString());
    setNewPriceBCV(item.priceBCV !== undefined && item.priceBCV !== null ? item.priceBCV.toString() : '');
    setShowAddForm(true);
  };

  const handleDeleteClick = async (id: string) => {
    try {
      await dbService.deletePricingItem(id);
      await loadPricing();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar.';
      setPricingError(msg);
      console.error('[Pricing] handleDeleteClick:', err);
    }
  };

  const resetForm = () => {
    setShowAddForm(!showAddForm);
    if (showAddForm) {
      setEditingId(null);
      setNewService('');
      setNewPrice('');
      setNewPriceBCV('');
    }
  };

  const navRef = useArrowNavigation<HTMLDivElement>();

  return (
    <div ref={navRef} className="max-w-4xl mx-auto">
      <div className="bg-white p-4 sm:p-5 md:p-6 rounded-xl shadow-sm border border-neutral-200">
        <div className="flex flex-row items-center justify-between gap-2 md:gap-4 mb-5 md:mb-6 border-b pb-4">
          <div className="flex items-center gap-1.5 md:gap-3">
            <div className="bg-green-100 p-1 md:p-2 rounded-lg text-green-700 flex-shrink-0">
              <DollarSign className="w-4 h-4 md:w-6 md:h-6" />
            </div>
            <h2 className="text-base sm:text-2xl font-bold text-neutral-800 leading-tight">Tarifario Referencial</h2>
          </div>
          <button
            onClick={resetForm}
            className="flex items-center justify-center gap-1 px-2.5 py-1.5 md:px-4 md:py-2 text-xs md:text-base bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors sm:w-auto whitespace-nowrap"
          >
            {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{showAddForm ? 'Cancelar' : 'Agregar Servicio'}</span>
            <span className="sm:hidden">{showAddForm ? 'Cancelar' : 'Agregar'}</span>
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddPricing} className="mb-6 sm:mb-8 p-3.5 sm:p-4 bg-neutral-50 rounded-lg border border-neutral-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 items-end">
              <div className="sm:col-span-2 md:col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">Nombre del Servicio *</label>
                <input
                  type="text"
                  required
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: Instalación de Antivirus"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">Precio ($ USD) *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-neutral-500 text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full pl-7 px-3 py-2 text-sm border border-neutral-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">Precio (BCV)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                    <span className="text-neutral-500 text-xs font-semibold">Bs.</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newPriceBCV}
                    onChange={(e) => setNewPriceBCV(e.target.value)}
                    className="w-full pl-8 pr-12 px-3 py-2 text-sm border border-neutral-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                  <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
                    <span className="text-neutral-500 text-xs font-medium">BCV</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="w-full sm:w-auto px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-md transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto px-5 py-2 text-sm bg-green-600 text-white font-medium rounded-md hover:bg-green-700 transition-colors shadow-xs"
              >
                {editingId ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="text-center py-8 text-neutral-500">Cargando tarifario...</div>
        ) : pricingError ? (
          <div className="text-center py-8 text-red-600 bg-red-50 rounded-lg border border-red-200 px-4">
            <p className="font-medium">Error al cargar el tarifario</p>
            <p className="text-sm mt-1 text-red-500">{pricingError}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {pricing.map((item, idx) => (
              <div key={item.id || idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3.5 sm:p-4 rounded-lg border border-neutral-100 hover:border-blue-200 hover:bg-blue-50/50 transition-colors gap-3">
                <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                  <Cpu className="w-5 h-5 text-neutral-400 shrink-0 mt-0.5 sm:mt-0" />
                  <span className="font-medium text-neutral-700 text-sm sm:text-base break-words">{item.service}</span>
                </div>
                <div className="flex items-center justify-between w-full sm:w-auto gap-3 sm:gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
                  <div className="flex flex-col items-start sm:items-end gap-1">
                    {item.priceBCV !== undefined && item.priceBCV !== null && !isNaN(item.priceBCV) ? (
                      <>
                        {/* 1. Precio BCV Primero (Arriba) */}
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200">
                          <span className="text-[11px] sm:text-xs font-bold text-blue-700">Bs.</span>
                          <span className="text-base sm:text-lg font-black text-neutral-900 tracking-tight leading-none">
                            {Number(item.priceBCV).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[9px] sm:text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-600 text-white tracking-wider leading-none shadow-xs">
                            BCV
                          </span>
                        </div>
                        {/* 2. Precio en $ Abajo */}
                        <div className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-emerald-600 px-1">
                          <span className="text-neutral-500 text-[11px] font-normal">Ref.</span>
                          <span className="font-bold">${item.priceUSD.toFixed(2)}</span>
                        </div>
                      </>
                    ) : (
                      /* Si no tiene tasa BCV, muestra solo USD destacado */
                      <div className="flex flex-col items-start sm:items-end">
                        <span className="text-base sm:text-lg font-bold text-emerald-600 leading-tight">
                          ${item.priceUSD.toFixed(2)}
                        </span>
                        <span className="text-[11px] text-neutral-500">Ref. USD</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                    <button 
                      onClick={() => handleEditClick(item)}
                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                      title="Editar servicio"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {item.id && (
                      <button 
                        onClick={() => handleDeleteClick(item.id!)}
                        className="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition-colors"
                        title="Eliminar servicio"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
