import React from 'react';
import { BorderItem } from '../../utils/bordersStorage.ts';

interface ProfileBorderWrapperProps {
  border?: BorderItem | null;
  children: React.ReactNode;
  className?: string;
  sizeClassName?: string; // e.g. "w-10 h-10" or "w-24 h-24"
  roundedClassName?: string; // default "rounded-full"
  showGlow?: boolean;
}

export default function ProfileBorderWrapper({
  border,
  children,
  className = '',
  sizeClassName = 'w-10 h-10',
  roundedClassName = 'rounded-full',
  showGlow = true,
}: ProfileBorderWrapperProps) {
  if (!border) {
    return <div className={`relative ${sizeClassName} ${className}`}>{children}</div>;
  }

  const isGradientClass = border.gradientClass.startsWith('border-animated-') || border.gradientClass.startsWith('from-');

  return (
    <div
      className={`relative flex items-center justify-center p-[3px] transition-all duration-300 ${roundedClassName} ${sizeClassName} ${className}`}
      style={{
        boxShadow: showGlow && border.glowColor ? border.glowColor : 'none',
      }}
    >
      {/* Outer Border Layer */}
      <div
        className={`absolute inset-0 ${roundedClassName} ${
          isGradientClass ? border.gradientClass : ''
        } ${border.animationClass || ''}`}
        style={
          !isGradientClass
            ? { backgroundColor: border.gradientClass }
            : undefined
        }
      />

      {/* Inner Avatar Content Container */}
      <div
        className={`relative w-full h-full ${roundedClassName} overflow-hidden bg-[#16181b] z-10 flex items-center justify-center`}
      >
        {children}
      </div>
    </div>
  );
}
