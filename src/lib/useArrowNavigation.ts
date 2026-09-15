import React, { useEffect, useRef, useCallback } from 'react';

export interface ArrowNavigationOptions {
  /** Selector CSS para los elementos interactivos enfocables. Por defecto inputs, selects, textareas, checkboxes y botones. */
  selector?: string;
  /** Activar o desactivar la navegación por teclado */
  enabled?: boolean;
  /** Clase CSS adicional para aplicar foco visual destacado */
  focusClass?: string;
  /** Permitir envolver la navegación (wrap-around) al llegar a los bordes. Por defecto false (respeta límites). */
  wrap?: boolean;
  /** Callback opcional al cambiar de casilla activa */
  onNavigate?: (current: HTMLElement, previous: HTMLElement) => void;
}

const DEFAULT_SELECTOR = [
  'input:not([type="hidden"]):not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled]):not([tabindex="-1"])',
  '[tabindex="0"]:not([disabled])',
].join(', ');

/**
 * Comprueba si un elemento es visible en el DOM y tiene dimensiones reales.
 */
function isElementVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Determina si las flechas horizontales o verticales deben permitirse para edición de texto interna
 * o si ya alcanzaron el borde del campo de texto y pueden saltar a la casilla siguiente.
 */
function shouldAllowDirectionalNav(
  el: HTMLElement,
  direction: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
): boolean {
  if (el instanceof HTMLTextAreaElement) {
    const val = el.value;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;

    if (direction === 'ArrowLeft') {
      return start === 0 && end === 0;
    }
    if (direction === 'ArrowRight') {
      return start === val.length && end === val.length;
    }
    if (direction === 'ArrowUp') {
      // Permitir salir solo si el cursor está en la primera línea
      const textBefore = val.slice(0, start);
      return !textBefore.includes('\n');
    }
    if (direction === 'ArrowDown') {
      // Permitir salir solo si el cursor está en la última línea
      const textAfter = val.slice(end);
      return !textAfter.includes('\n');
    }
    return false;
  }

  if (el instanceof HTMLInputElement) {
    const type = el.type.toLowerCase();
    // Casillas de verificación, radios, botones, rangos: siempre navegan con flechas
    if (['checkbox', 'radio', 'button', 'submit', 'reset', 'range'].includes(type)) {
      return true;
    }

    // Campos de texto y derivados
    try {
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const length = el.value.length;

      if (direction === 'ArrowLeft') {
        return start === 0 && end === 0;
      }
      if (direction === 'ArrowRight') {
        return start === length && end === length;
      }
      // En inputs de una sola línea (texto, fecha, etc.), Arriba y Abajo navegan verticalmente
      if (direction === 'ArrowUp' || direction === 'ArrowDown') {
        return true;
      }
    } catch {
      // Algunos inputs especiales (como date/time en ciertos motores) pueden lanzar error con selectionStart
      return true;
    }
  }

  // Para botones, selectores y contenedores enfocables: siempre navegan
  return true;
}

/**
 * Encuentra el elemento interactivo más cercano en la dirección dada (Navegación Espacial 2D).
 * Si no existe ningún elemento en esa dirección, devuelve null para respetar los límites del contenedor.
 */
function findNearestElementInDirection(
  current: HTMLElement,
  candidates: HTMLElement[],
  direction: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
): HTMLElement | null {
  const currentRect = current.getBoundingClientRect();
  const currentCenterX = currentRect.left + currentRect.width / 2;
  const currentCenterY = currentRect.top + currentRect.height / 2;

  let bestCandidate: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const candidate of candidates) {
    if (candidate === current) continue;

    const candRect = candidate.getBoundingClientRect();
    const candCenterX = candRect.left + candRect.width / 2;
    const candCenterY = candRect.top + candRect.height / 2;

    let isValidDirection = false;
    let primaryDistance = 0;
    let crossDistance = 0;

    switch (direction) {
      case 'ArrowUp':
        // Debe estar geométricamente arriba
        if (candRect.bottom <= currentRect.top + 6 || (candCenterY < currentCenterY - 4 && candRect.bottom <= currentRect.bottom - 8)) {
          isValidDirection = true;
          primaryDistance = Math.max(0, currentRect.top - candRect.bottom);
          crossDistance = Math.abs(candCenterX - currentCenterX);
        }
        break;

      case 'ArrowDown':
        // Debe estar geométricamente abajo
        if (candRect.top >= currentRect.bottom - 6 || (candCenterY > currentCenterY + 4 && candRect.top >= currentRect.top + 8)) {
          isValidDirection = true;
          primaryDistance = Math.max(0, candRect.top - currentRect.bottom);
          crossDistance = Math.abs(candCenterX - currentCenterX);
        }
        break;

      case 'ArrowLeft':
        // Debe estar geométricamente a la izquierda
        if (candRect.right <= currentRect.left + 6 || (candCenterX < currentCenterX - 4 && candRect.right <= currentRect.right - 8)) {
          isValidDirection = true;
          primaryDistance = Math.max(0, currentRect.left - candRect.right);
          crossDistance = Math.abs(candCenterY - currentCenterY);
        }
        break;

      case 'ArrowRight':
        // Debe estar geométricamente a la derecha
        if (candRect.left >= currentRect.right - 6 || (candCenterX > currentCenterX + 4 && candRect.left >= currentRect.left + 8)) {
          isValidDirection = true;
          primaryDistance = Math.max(0, candRect.left - currentRect.right);
          crossDistance = Math.abs(candCenterY - currentCenterY);
        }
        break;
    }

    if (isValidDirection) {
      // Ponderación: la distancia perpendicular (cruce) penaliza más para preferir la misma fila/columna
      const score = primaryDistance + crossDistance * 2.2;
      if (score < bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }
  }

  return bestCandidate;
}

/**
 * Hook reutilizable para proveer navegación por teclado con flechas direccionales (Arriba, Abajo, Izquierda, Derecha),
 * garantizando que el foco visual se mantenga activo y no se sobrepasen los límites del contenedor.
 */
export function useArrowNavigation<T extends HTMLElement = HTMLElement>(
  options: ArrowNavigationOptions = {}
) {
  const {
    selector = DEFAULT_SELECTOR,
    enabled = true,
    focusClass = 'focus-keyboard-active',
    wrap = false,
    onNavigate,
  } = options;

  const containerRef = useRef<T | null>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const key = event.key;
      if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'ArrowLeft' && key !== 'ArrowRight') {
        return;
      }

      const container = containerRef.current;
      if (!container) return;

      const activeElement = document.activeElement as HTMLElement | null;
      if (!activeElement || !container.contains(activeElement)) {
        return;
      }

      // Validar si el elemento actual permite el desplazamiento con esta flecha
      if (!shouldAllowDirectionalNav(activeElement, key)) {
        return;
      }

      // Obtener todos los elementos interactivos visibles dentro del contenedor
      const rawCandidates = Array.from(container.querySelectorAll(selector)) as HTMLElement[];
      const candidates: HTMLElement[] = rawCandidates.filter(isElementVisible);

      if (candidates.length <= 1) return;

      // Buscar el candidato más cercano en la dirección de la flecha
      let nextElement = findNearestElementInDirection(activeElement, candidates, key);

      // Si wrap está activado y no hay elemento adelante, envolver
      if (!nextElement && wrap) {
        const currentIndex = candidates.indexOf(activeElement);
        if (key === 'ArrowRight' || key === 'ArrowDown') {
          nextElement = candidates[(currentIndex + 1) % candidates.length];
        } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
          nextElement = candidates[(currentIndex - 1 + candidates.length) % candidates.length];
        }
      }

      // Si se encontró el siguiente elemento dentro de los límites del contenedor
      if (nextElement && nextElement !== activeElement) {
        event.preventDefault(); // Evitar scroll no deseado de la página o incremento accidental en inputs

        // Quitar clase visual del elemento previo
        if (focusClass) {
          activeElement.classList.remove(focusClass);
          nextElement.classList.add(focusClass);
        }

        // Enfocar el nuevo elemento
        nextElement.focus();

        // Desplazamiento suave para mantenerlo visible dentro del viewport/contenedor
        nextElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        });

        if (onNavigate) {
          onNavigate(nextElement, activeElement);
        }
      } else {
        // Límite alcanzado del contenedor: se respeta el límite manteniendo el foco visual en el elemento activo
        if (['ArrowUp', 'ArrowDown'].includes(key)) {
          event.preventDefault();
        }
      }
    },
    [enabled, selector, focusClass, wrap, onNavigate]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    // Escuchamos el evento en la fase de captura o burbuja del contenedor
    container.addEventListener('keydown', handleKeyDown);

    // Limpieza de clase de foco visual cuando se pierde el foco
    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && focusClass) {
        target.classList.remove(focusClass);
      }
    };
    container.addEventListener('focusout', handleFocusOut);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('focusout', handleFocusOut);
    };
  }, [handleKeyDown, enabled, focusClass]);

  return containerRef;
}

/**
 * Componente contenedor que activa automáticamente la navegación por teclado
 * con flechas direccionales en todos los inputs y casillas dentro de él.
 */
export function ArrowNavContainer({
  children,
  className,
  ...options
}: {
  children?: React.ReactNode;
  className?: string;
} & ArrowNavigationOptions) {
  const containerRef = useArrowNavigation<HTMLDivElement>(options);
  return React.createElement('div', { ref: containerRef, className }, children);
}

export default useArrowNavigation;
