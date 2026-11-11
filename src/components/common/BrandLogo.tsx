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
  const iconSize = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-11 h-11' : 'w-9 h-9';
  const titleSize = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-2xl' : 'text-base sm:text-lg';
  const taglineSize = size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-xs' : 'text-[11px]';

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Discrete artisan mark: Stylized yarn loop & crochet needle badge */}
      <div
        className={`${iconSize} rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-transform duration-200 group-hover:scale-105 ${
          inverted
            ? 'bg-amber-400/20 border border-amber-300/40 text-amber-200'
            : 'bg-linear-to-br from-amber-100 to-amber-200/80 border border-amber-300/60 text-amber-900'
        }`}
      >
        <svg
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5"
          aria-hidden="true"
        >
          {/* Yarn sphere loop */}
          <circle
            cx="14"
            cy="14"
            r="8.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeDasharray="2 1.5"
          />
          {/* Inner swirl stitch */}
          <path
            d="M9 13.5C9 10.7386 11.2386 8.5 14 8.5C16.7614 8.5 19 10.7386 19 13.5C19 16.2614 16.7614 18.5 14 18.5C12 18.5 10.8 17 11 15"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          {/* Stylized crochet hook line */}
          <path
            d="M6 21L21 6"
            stroke={inverted ? '#FDE68A' : '#78350F'}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M21 6C21.5 5.5 22.5 5.5 22.8 6.2C23 6.8 22.5 7.6 21.8 7.8L19.5 8"
            stroke={inverted ? '#FDE68A' : '#78350F'}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Brand Wordmark */}
      <div className="flex flex-col leading-none">
        <div className="flex items-baseline gap-1">
          <span
            className={`font-sans font-extrabold tracking-tight ${titleSize} ${
              inverted ? 'text-white' : 'text-stone-900'
            }`}
          >
            Amigurumis Mariai
          </span>
        </div>
        {showTagline && (
          <span
            className={`font-sans font-medium tracking-normal mt-0.5 ${taglineSize} ${
              inverted ? 'text-stone-300' : 'text-stone-500'
            }`}
          >
            Tejidos artesanales a crochet · Colombia
          </span>
        )}
      </div>
    </div>
  );
};
