import React from 'react';
import { Sparkles, ArrowRight, ShoppingBag, ShieldCheck, Heart, Award, Gamepad2 } from 'lucide-react';

interface HeroProps {
  onNavigateToCatalog: () => void;
  onNavigateToCustomizer: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  onNavigateToCatalog,
  onNavigateToCustomizer,
}) => {
  return (
    <section className="relative pt-8 pb-8 sm:pt-14 sm:pb-12 overflow-hidden">
      {/* Background ambient liquid orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-amber-200/25 via-rose-200/20 to-emerald-100/20 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Headline and CTAs (7 cols) */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full liquid-glass text-xs font-semibold text-stone-800 shadow-xs border border-white/80">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Alta Confección a Crochet & Videojuego Interactivo Pompón</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-sans font-extrabold text-stone-900 tracking-tight leading-[1.12] text-balance">
              El arte del tejido artesanal llevado a una nueva dimensión
            </h1>

            <p className="text-base sm:text-lg text-stone-600 max-w-xl mx-auto lg:mx-0 font-normal leading-relaxed">
              Descubre criaturas mágicas tejidas a mano con hilos seleccionados,
              o sumérgete en nuestro minivideojuego de plataformas 2D para acompañar a Pompón,
              rescatar los ovillos perdidos y desbloquear beneficios exclusivos.
            </p>

            {/* CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5">
              <button
                onClick={onNavigateToCustomizer}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl liquid-btn-primary text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer group"
              >
                <Gamepad2 className="w-4 h-4 text-amber-300 transition-transform group-hover:scale-110" />
                <span>Jugar y Ganar Recompensas</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>

              <button
                onClick={onNavigateToCatalog}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl liquid-btn-secondary text-stone-800 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 text-stone-600" />
                <span>Explorar Colección</span>
              </button>
            </div>

            {/* Adjacent Trust Proof Strip (Adjacency requirement) */}
            <div className="pt-8 border-t border-stone-200/60 grid grid-cols-3 gap-4 text-center lg:text-left">
              <div>
                <span className="block text-sm sm:text-base font-bold font-sans text-stone-900">Tejido</span>
                <span className="text-xs text-stone-500 font-medium">Con atención al detalle</span>
              </div>
              <div>
                <span className="block text-sm sm:text-base font-bold font-sans text-stone-900">Artesanal</span>
                <span className="text-xs text-stone-500 font-medium">Piezas hechas a mano</span>
              </div>
              <div>
                <span className="block text-sm sm:text-base font-bold font-sans text-stone-900">Cercano</span>
                <span className="text-xs text-stone-500 font-medium">Diseños para explorar</span>
              </div>
            </div>
          </div>

          {/* Right Column: Hero High-Res Showcase Card (5 cols) */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-3xl overflow-hidden liquid-glass-elevated p-3 sm:p-4 border border-white/80 shadow-2xl">
              <div className="relative aspect-4/3 sm:aspect-square rounded-2xl overflow-hidden bg-stone-100">
                <img
                  src="/src/assets/images/hero_amigurumi_showcase_1794329731742.jpg"
                  alt="Colección artesanal de amigurumis tejidos a mano"
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                  referrerPolicy="no-referrer"
                />

                {/* Glass Overlays */}
                <div className="absolute bottom-3 left-3 right-3 p-3.5 rounded-xl liquid-glass border border-white/70 backdrop-blur-md flex items-center justify-between">
                  <div>
                    <span className="text-[11px] uppercase font-bold text-amber-900 tracking-wider block">
                      Serie Amigurumis Mariai 2026
                    </span>
                    <span className="text-xs font-semibold text-stone-800">
                      Osito, Conejita y Dragón Pastel
                    </span>
                  </div>
                  <button
                    onClick={onNavigateToCatalog}
                    className="p-2 rounded-lg bg-stone-900 text-white text-xs font-medium hover:bg-stone-800 transition-colors"
                  >
                    Ver Catálogo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
