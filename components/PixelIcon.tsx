
import React from 'react';

interface PixelIconProps {
  type: 'money' | 'day' | 'weather' | 'seed';
  size?: 'sm' | 'md' | 'lg';
}

const PixelIcon: React.FC<PixelIconProps> = ({ type, size = 'md' }) => {
  const sizeMap = {
    sm: 'text-xl',
    md: 'text-3xl',
    lg: 'text-5xl'
  };

  const iconMap = {
    money: '💰',
    day: '🗓️',
    weather: '☀️',
    seed: '📦'
  };

  return (
    <span className={`${sizeMap[size]} drop-shadow-sm`} role="img" aria-label={type}>
      {iconMap[type]}
    </span>
  );
};

export default PixelIcon;
