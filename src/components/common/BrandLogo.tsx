import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  inverted?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 'md',
  showTagline = false,
  inverted = false,
}) => {
  const heightClass =
    size === 'sm'
      ? 'h-8 sm:h-9 md:h-10'
      : size === 'lg'
      ? 'h-14 sm:h-16 md:h-[72px]'
      : 'h-10 sm:h-12 md:h-13';

  const taglineSize = size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-xs' : 'text-[11px]';

  return (
    <div className={`inline-flex flex-col items-start leading-none shrink-0 ${className}`}>
      <img
        src="/brand-logo.png"
        alt="Amigurumis Mariai"
        width={336}
        height={154}
        decoding="async"
        className={`${heightClass} w-auto max-w-full object-contain select-none transition-transform duration-200 group-hover:scale-[1.02] ${
          inverted ? 'drop-shadow-[0_1px_6px_rgba(255,255,255,0.28)]' : ''
        }`}
      />
      {showTagline && (
        <span
          className={`font-sans font-medium tracking-normal mt-1.5 ${taglineSize} ${
            inverted ? 'text-stone-300' : 'text-stone-500'
          }`}
        >
          Tejidos artesanales a crochet · Colombia
        </span>
      )}
    </div>
  );
};
