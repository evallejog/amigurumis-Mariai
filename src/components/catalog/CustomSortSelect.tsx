import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, SlidersHorizontal } from 'lucide-react';

export type SortOptionValue = 'featured' | 'price-asc' | 'price-desc' | 'craft-time';

export interface SortOption {
  value: SortOptionValue;
  label: string;
}

const SORT_OPTIONS: SortOption[] = [
  { value: 'featured', label: 'Destacados' },
  { value: 'price-asc', label: 'Precio: Menor a Mayor' },
  { value: 'price-desc', label: 'Precio: Mayor a Menor' },
  { value: 'craft-time', label: 'Tiempo de Confección' },
];

interface CustomSortSelectProps {
  value: SortOptionValue;
  onChange: (value: SortOptionValue) => void;
}

export const CustomSortSelect: React.FC<CustomSortSelectProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedOption = SORT_OPTIONS.find((opt) => opt.value === value) || SORT_OPTIONS[0];

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const currentIndex = SORT_OPTIONS.findIndex((opt) => opt.value === value);
        const nextIndex = (currentIndex + 1) % SORT_OPTIONS.length;
        onChange(SORT_OPTIONS[nextIndex].value);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const currentIndex = SORT_OPTIONS.findIndex((opt) => opt.value === value);
        const prevIndex = (currentIndex - 1 + SORT_OPTIONS.length) % SORT_OPTIONS.length;
        onChange(SORT_OPTIONS[prevIndex].value);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left w-full sm:w-auto">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Ordenar catálogo por: ${selectedOption.label}`}
        className="w-full sm:w-auto flex items-center justify-between gap-2.5 px-3.5 py-2 rounded-2xl bg-white/85 hover:bg-white backdrop-blur-xl border border-white/90 hover:border-amber-300/70 shadow-xs text-xs font-semibold text-stone-800 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/30"
      >
        <div className="flex items-center gap-2 truncate">
          <SlidersHorizontal className="w-3.5 h-3.5 text-stone-500 shrink-0" />
          <span className="text-stone-500 font-normal">Ordenar por:</span>
          <span className="font-bold text-stone-900 truncate">{selectedOption.label}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-stone-500 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-amber-800' : ''
          }`}
        />
      </button>

      {/* Floating Menu Dropdown */}
      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className="absolute right-0 mt-2 w-full sm:w-56 rounded-2xl bg-white/95 backdrop-blur-xl border border-white/90 shadow-2xl p-1.5 z-40 animate-fadeIn space-y-1 focus:outline-none"
        >
          {SORT_OPTIONS.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer text-left ${
                  isSelected
                    ? 'bg-amber-100/80 text-amber-950 font-bold'
                    : 'text-stone-700 hover:bg-stone-100/80 hover:text-stone-900'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-amber-800 stroke-[2.5]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
