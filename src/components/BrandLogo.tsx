import React from 'react';

interface BrandLogoProps {
  variant?: 'default' | 'light' | 'monochrome';
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  showTagline?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'default',
  size = 'md',
  showWordmark = true,
  showTagline = false,
}) => {
  const iconDim = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-10 h-10' : 'w-8 h-8';
  const textSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-xl' : 'text-lg';

  const shieldStroke =
    variant === 'light' ? '#5EEAD4' : variant === 'monochrome' ? 'currentColor' : '#0E7C86';
  const shieldFill =
    variant === 'light' ? 'rgba(255,255,255,0.08)' : variant === 'monochrome' ? 'transparent' : '#EFF8FA';
  const crossFill =
    variant === 'light' ? '#FFFFFF' : variant === 'monochrome' ? 'currentColor' : '#0E7C86';
  const pulseStroke =
    variant === 'light' ? '#0F2334' : variant === 'monochrome' ? '#FFFFFF' : '#FFFFFF';
  const wordmarkClass =
    variant === 'light' ? 'text-white' : 'text-[#0F2334]';

  return (
    <div className="inline-flex items-center gap-2.5 shrink-0">
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconDim} shrink-0`}
        aria-hidden="true"
      >
        {/* Clinical Trust Shield */}
        <path
          d="M20 3L34 8.5V19.2C34 27.9 28 34.8 20 37.5C12 34.8 6 27.9 6 19.2V8.5L20 3Z"
          fill={shieldFill}
          stroke={shieldStroke}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {/* Medical Cross */}
        <path
          d="M17.5 11.5C17.5 10.9477 17.9477 10.5 18.5 10.5H21.5C22.0523 10.5 22.5 10.9477 22.5 11.5V17.5H28.5C29.0523 17.5 29.5 17.9477 29.5 18.5V21.5C29.5 22.0523 29.0523 22.5 28.5 22.5H22.5V28.5C22.5 29.0523 22.0523 29.5 21.5 29.5H18.5C17.9477 29.5 17.5 29.0523 17.5 28.5V22.5H11.5C10.9477 22.5 10.5 22.0523 10.5 21.5V18.5C10.5 17.9477 10.9477 17.5 11.5 17.5H17.5V11.5Z"
          fill={crossFill}
        />
        {/* Connected Pulse Motif */}
        <path
          d="M12.5 20H16.2L18 16.5L20.8 23.5L22.6 19L24.2 20H27.5"
          stroke={pulseStroke}
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {showWordmark && (
        <div className="leading-none">
          <span className={`${textSize} font-bold tracking-tight whitespace-nowrap ${wordmarkClass}`}>
            MediLink Vault
          </span>
          {showTagline && (
            <span className={`block text-[11px] font-medium mt-1 ${variant === 'light' ? 'text-teal-200' : 'text-[#0E7C86]'}`}>
              One Health Record. Everywhere.
            </span>
          )}
        </div>
      )}
    </div>
  );
};
