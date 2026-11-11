import React from 'react';
import { Heart, Sparkles, ArrowUp } from 'lucide-react';
import { BrandLogo } from './common/BrandLogo';

interface FooterProps {
  onNavigate: (sectionId: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="border-t border-stone-200/60 bg-stone-100/60 backdrop-blur-md pt-14 pb-10 text-stone-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="md:col-span-2 space-y-3">
            <BrandLogo size="md" showTagline={true} />
            <p className="text-xs text-stone-500 max-w-sm leading-relaxed font-normal pt-1">
              Taller artesanal colombiano dedicado a la creación punto a punto de amigurumis y figuras
              a crochet con materiales hipoalergénicos y experiencias interactivas.
            </p>
          </div>

          {/* Nav links */}
          <div>
            <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-3 font-sans">
              Explorar
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onNavigate('inicio')}
                  className="hover:text-stone-900 transition-colors cursor-pointer"
                >
                  Inicio
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('catalogo')}
                  className="hover:text-stone-900 transition-colors cursor-pointer"
                >
                  Colección de Amigurumis
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('juego')}
                  className="hover:text-stone-900 transition-colors cursor-pointer"
                >
                  Las Aventuras de Pompón (Videojuego)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('nosotros')}
                  className="hover:text-stone-900 transition-colors cursor-pointer"
                >
                  Filosofía y Materiales
                </button>
              </li>
            </ul>
          </div>

          {/* Legal & Care */}
          <div>
            <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-3 font-sans">
              Compromiso de Calidad
            </h4>
            <ul className="space-y-2 text-xs text-stone-500">
              <li>100% Algodón Peinado y Suave</li>
              <li>Ojos con Traba de Seguridad</li>
              <li>Relleno Siliconado Hipoalergénico</li>
              <li>Envíos Nacionales en Colombia</li>
              <li>Atención Artesanal Directa</li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-stone-200/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-400">
          <p>
            © {new Date().getFullYear()} Amigurumis Mariai. Todos los derechos reservados. Colombia.
          </p>

          <button
            onClick={scrollToTop}
            className="flex items-center gap-1.5 text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
          >
            <span>Volver arriba</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
};
