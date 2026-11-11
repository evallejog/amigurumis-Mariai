import React from 'react';
import { Camera, Box, Sparkles, Image as ImageIcon } from 'lucide-react';

interface PlaceholderImageProps {
  aspectRatio?: 'square' | 'video' | 'portrait' | 'wide';
  label?: string;
  sublabel?: string;
  iconType?: 'product' | '3d' | 'logo' | 'hero';
  dimensionsText?: string;
  className?: string;
  badgeText?: string;
}

export const PlaceholderImage: React.FC<PlaceholderImageProps> = ({
  aspectRatio = 'square',
  label = 'Espacio reservado para fotografía real',
  sublabel = 'Resolución recomendada: 800 x 800 px (Fondo neutro)',
  iconType = 'product',
  dimensionsText = '1:1 • JPG / WebP',
  className = '',
  badgeText = 'Foto Provisional',
}) => {
  const aspectClass = {
    square: 'aspect-square',
    video: 'aspect-video',
    portrait: 'aspect-[3/4]',
    wide: 'aspect-[16/9]',
  }[aspectRatio];

  const renderIcon = () => {
    switch (iconType) {
      case '3d':
        return <Box className="w-8 h-8 text-stone-400 group-hover:text-stone-600 transition-colors" />;
      case 'hero':
        return <Sparkles className="w-9 h-9 text-stone-400 group-hover:text-amber-700 transition-colors" />;
      case 'logo':
        return <ImageIcon className="w-6 h-6 text-stone-400" />;
      case 'product':
      default:
        return <Camera className="w-7 h-7 text-stone-400 group-hover:text-stone-600 transition-colors" />;
    }
  };

  return (
    <div
      className={`relative w-full ${aspectClass} bg-gradient-to-b from-stone-100 to-stone-200/70 border-2 border-dashed border-stone-300 rounded-lg flex flex-col items-center justify-center p-4 text-center overflow-hidden group select-none transition-all duration-200 hover:border-stone-400 ${className}`}
    >
      {/* Blueprint grid subtle background */}
      <div 
        className="absolute inset-0 opacity-[0.35] pointer-events-none" 
        style={{
          backgroundImage: 'radial-gradient(circle, #78716c 0.75px, transparent 0.75px)',
          backgroundSize: '16px 16px'
        }}
      />

      {/* Corner crosshairs */}
      <div className="absolute top-2 left-2 w-2.5 h-2.5 border-t-2 border-l-2 border-stone-400" />
      <div className="absolute top-2 right-2 w-2.5 h-2.5 border-t-2 border-r-2 border-stone-400" />
      <div className="absolute bottom-2 left-2 w-2.5 h-2.5 border-b-2 border-l-2 border-stone-400" />
      <div className="absolute bottom-2 right-2 w-2.5 h-2.5 border-b-2 border-r-2 border-stone-400" />

      {/* Top indicator tag */}
      {badgeText && (
        <div className="absolute top-3 left-3 bg-stone-800/80 backdrop-blur-xs text-stone-100 text-[10px] tracking-wider uppercase font-mono px-2 py-0.5 rounded shadow-xs">
          {badgeText}
        </div>
      )}

      {/* Format / Dimensions tag */}
      {dimensionsText && (
        <div className="absolute top-3 right-3 bg-stone-200/90 text-stone-600 text-[10px] font-mono px-2 py-0.5 rounded border border-stone-300">
          {dimensionsText}
        </div>
      )}

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center max-w-[85%]">
        <div className="w-12 h-12 rounded-full bg-white/80 border border-stone-300 shadow-2xs flex items-center justify-center mb-2.5 transition-transform duration-200 group-hover:scale-105">
          {renderIcon()}
        </div>

        <p className="text-xs font-medium text-stone-700 leading-snug line-clamp-2">
          {label}
        </p>

        {sublabel && (
          <p className="text-[11px] text-stone-500 mt-1 line-clamp-2 font-mono">
            {sublabel}
          </p>
        )}
      </div>

      {/* Bottom technical note */}
      <div className="absolute bottom-2.5 text-[10px] font-mono text-stone-400 tracking-tight">
        [ÁREA TÉCNICA RESERVADA]
      </div>
    </div>
  );
};
