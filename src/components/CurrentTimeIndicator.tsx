import React from 'react';

interface CurrentTimeIndicatorProps {
  position: number | null;
}

const CurrentTimeIndicator: React.FC<CurrentTimeIndicatorProps> = ({ position }) => {
  if (position === null) {
    return null;
  }

  return (
    <div
      className="current-time-indicator absolute left-4 right-4 border-t-2 border-red-500 z-30 pointer-events-none"
      style={{ top: `${position}px` }}
    >
      <div className="w-2 h-2 rounded-full bg-red-500 -mt-1 -ml-1" />
    </div>
  );
};

export default CurrentTimeIndicator;
