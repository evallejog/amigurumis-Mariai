import React from 'react';
import { Feather, Heart, Sparkles, Shield, Clock, Compass } from 'lucide-react';

export const AboutSection: React.FC = () => {
  const pillars = [
    {
      icon: Feather,
      title: 'Hilo 100% Algodón Peinado',
      description:
        'Seleccionamos fibras vegetales nobles de origen nacional, teñidas con pigmentos al agua no tóxicos. El tacto es sedoso, seguro para la piel de recién nacidos y totalmente transpirable.',
    },
    {
      icon: Compass,
      title: 'Técnica Japonesa en Espiral',
      description:
        'Cada muñeco se confecciona sin costuras intermedias visibles, siguiendo la ancestral técnica de espiral continua que otorga solidez estructural y una caída orgánica incomparable.',
    },
    {
      icon: Shield,
      title: 'Seguridad Infantil Certificada',
      description:
        'Ojos con arandela de anclaje interno irremovible y costuras dobles reforzadas. El relleno de vellón siliconado es hipoalergénico, inodoro y lavable a mano.',
    },
    {
      icon: Sparkles,
      title: 'Innovación y Experiencia Lúdica',
      description:
        'Fusionamos el amor por el tejido tradicional con experiencias lúdicas e interactivas. A través de nuestro videojuego y dinámicas promocionales, celebramos el crochet de forma divertida, cercana y gratificante.',
    },
  ];

  return (
    <section id="nosotros" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="max-w-3xl mb-14">
        <span className="text-xs font-bold text-amber-800 tracking-wider uppercase block mb-2">
          01. Filosofía de Confección
        </span>
        <h2 className="text-3xl sm:text-4xl font-sans font-extrabold text-stone-900 tracking-tight">
          La lentitud consciente frente a la producción en masa
        </h2>
        <p className="mt-4 text-stone-600 text-sm sm:text-base leading-relaxed font-light">
          En un mundo acelerado por la manufactura industrial estandarizada, nosotros reivindicamos el valor
          del tiempo. Cada vuelta de hilo encierra dedicación, destreza y una intención de permanencia.
        </p>
      </div>

      {/* 4-Pillar Grid with Liquid Glass cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {pillars.map((pillar, idx) => {
          const Icon = pillar.icon;
          return (
            <div
              key={pillar.title}
              className="liquid-glass rounded-3xl p-6 sm:p-7 border border-white/70 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="w-11 h-11 rounded-2xl bg-amber-100/60 border border-amber-200/50 flex items-center justify-center text-amber-900 mb-5 shadow-2xs">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-stone-900 mb-2">
                  {pillar.title}
                </h3>
                <p className="text-xs text-stone-600 leading-relaxed font-light">
                  {pillar.description}
                </p>
              </div>

              <div className="pt-6 mt-6 border-t border-stone-200/40 text-[11px] font-mono text-stone-400">
                Principio 0{idx + 1}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
