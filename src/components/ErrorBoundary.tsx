import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Patrones de errores internos del DOM de React que no afectan la funcionalidad real
// y son consecuencia de transiciones de estado rápidas (p.ej: desmontaje de vista previa).
const REACT_INTERNAL_DOM_ERRORS = [
  'insertBefore',
  'removeChild',
  'NotFoundError',
  'HierarchyRequestError',
  'The node before which the new node',
  'nodo antes del cual',
];

function isReactDomInternalError(error: Error): boolean {
  const msg = (error.message || '') + (error.name || '');
  return REACT_INTERNAL_DOM_ERRORS.some(pattern =>
    msg.toLowerCase().includes(pattern.toLowerCase())
  );
}

export class ErrorBoundary extends Component<Props, State> {
  props: Props;
  state: State;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    // Si es un error interno de manipulación del DOM de React, lo ignoramos.
    if (isReactDomInternalError(error)) {
      console.warn('[ErrorBoundary] Error de DOM interno de React ignorado (no afecta funcionalidad):', error.message);
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (!isReactDomInternalError(error)) {
      console.error('[ErrorBoundary] Error crítico capturado:', error, errorInfo);
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-100 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 text-center border border-neutral-200">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">
              !
            </div>
            <h2 className="text-xl font-bold text-neutral-800 mb-2">Ha ocurrido un problema</h2>
            <p className="text-sm text-neutral-600 mb-4 bg-neutral-50 p-3 rounded text-left font-mono break-words">
              {this.state.error?.message || 'Error inesperado al procesar la aplicación.'}
            </p>
            <button
              onClick={() => {
                (this as any).setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors w-full"
            >
              Recargar aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
