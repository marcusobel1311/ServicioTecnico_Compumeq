/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import ReceptionForm from './components/ReceptionForm';
import ServiceHistory from './components/ServiceHistory';
import Pricing from './components/Pricing';
import Technicians from './components/Technicians';
import { FileText, History, Tag, Wrench, Sun, Moon } from 'lucide-react';

const VALID_TABS = ['form', 'history', 'pricing', 'technicians'] as const;
type TabType = (typeof VALID_TABS)[number];

function getInitialTab(): TabType {
  const hash = window.location.hash.replace('#', '') as TabType;
  if (VALID_TABS.includes(hash)) {
    return hash;
  }
  const saved = localStorage.getItem('compumeq_active_tab') as TabType;
  if (VALID_TABS.includes(saved)) {
    return saved;
  }
  return 'form';
}

function getInitialTheme(): boolean {
  const saved = localStorage.getItem('compumeq_theme');
  if (saved) {
    return saved === 'dark';
  }
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);
  const [isDark, setIsDark] = useState<boolean>(getInitialTheme);

  useEffect(() => {
    localStorage.setItem('compumeq_active_tab', activeTab);
    window.location.hash = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as TabType;
      if (VALID_TABS.includes(hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('compumeq_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('compumeq_theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(prev => !prev);
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans pb-16 md:pb-0">
      {/* Header - Hidden on print */}
      <header className="bg-white border-b border-neutral-200 print:hidden sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-12 lg:px-16">
          <div className="flex justify-between h-13 md:h-16 items-center gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <img
                src="/logo_compumeq.png"
                alt="Logo Compumeq"
                className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover shadow-xs ring-1 ring-neutral-200 shrink-0"
              />
              <h1 className="text-sm sm:text-lg md:text-xl font-bold text-neutral-800 tracking-tight truncate">
                Servicio Técnico Compumeq
              </h1>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {/* Desktop Navigation */}
              <nav className="hidden md:flex space-x-2">
                <button
                  onClick={() => setActiveTab('form')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'form' ? 'bg-blue-50 text-blue-700' : 'text-neutral-600 hover:bg-neutral-100'}`}
                >
                  <FileText className="w-4 h-4" />
                  Nueva Recepción
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-blue-50 text-blue-700' : 'text-neutral-600 hover:bg-neutral-100'}`}
                >
                  <History className="w-4 h-4" />
                  Historial
                </button>
                <button
                  onClick={() => setActiveTab('pricing')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'pricing' ? 'bg-blue-50 text-blue-700' : 'text-neutral-600 hover:bg-neutral-100'}`}
                >
                  <Tag className="w-4 h-4" />
                  Tarifario
                </button>
                <button
                  onClick={() => setActiveTab('technicians')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'technicians' ? 'bg-blue-50 text-blue-700' : 'text-neutral-600 hover:bg-neutral-100'}`}
                >
                  <Wrench className="w-4 h-4" />
                  Técnicos
                </button>
              </nav>

              {/* Botón de alternancia de Modo Oscuro */}
              <button
                type="button"
                onClick={toggleTheme}
                className="p-2 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer flex items-center justify-center"
                title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              >
                {isDark ? (
                  <Sun className="w-5 h-5 text-amber-400" />
                ) : (
                  <Moon className="w-5 h-5 text-neutral-600" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 md:px-12 lg:px-20 py-4 sm:py-6 md:py-8 print:p-0 print:m-0 print:max-w-none">
        {activeTab === 'form' && <ReceptionForm />}
        {activeTab === 'history' && <ServiceHistory />}
        {activeTab === 'pricing' && <Pricing />}
        {activeTab === 'technicians' && <Technicians />}
      </main>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 flex justify-around items-center p-1.5 sm:p-2 z-50 print:hidden pb-safe">
        <button
          onClick={() => setActiveTab('form')}
          className={`flex flex-col items-center gap-1 p-2 rounded-md text-xs font-medium transition-colors w-full ${activeTab === 'form' ? 'text-blue-700' : 'text-neutral-500'}`}
        >
          <div className={`${activeTab === 'form' ? 'bg-blue-100' : ''} p-1 rounded-full transition-colors`}>
            <FileText className="w-5 h-5" />
          </div>
          Recepción
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center gap-1 p-2 rounded-md text-xs font-medium transition-colors w-full ${activeTab === 'history' ? 'text-blue-700' : 'text-neutral-500'}`}
        >
          <div className={`${activeTab === 'history' ? 'bg-blue-100' : ''} p-1 rounded-full transition-colors`}>
            <History className="w-5 h-5" />
          </div>
          Historial
        </button>
        <button
          onClick={() => setActiveTab('pricing')}
          className={`flex flex-col items-center gap-1 p-2 rounded-md text-xs font-medium transition-colors w-full ${activeTab === 'pricing' ? 'text-blue-700' : 'text-neutral-500'}`}
        >
          <div className={`${activeTab === 'pricing' ? 'bg-blue-100' : ''} p-1 rounded-full transition-colors`}>
            <Tag className="w-5 h-5" />
          </div>
          Tarifario
        </button>
        <button
          onClick={() => setActiveTab('technicians')}
          className={`flex flex-col items-center gap-1 p-2 rounded-md text-xs font-medium transition-colors w-full ${activeTab === 'technicians' ? 'text-blue-700' : 'text-neutral-500'}`}
        >
          <div className={`${activeTab === 'technicians' ? 'bg-blue-100' : ''} p-1 rounded-full transition-colors`}>
            <Wrench className="w-5 h-5" />
          </div>
          Técnicos
        </button>
      </nav>
    </div>
  );
}
