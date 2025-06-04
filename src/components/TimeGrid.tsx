import React from 'react';
import { format } from 'date-fns';

interface TimeGridProps {
  startHour?: number;
  endHour?: number;
}

const TimeGrid: React.FC<TimeGridProps> = ({ 
  startHour = 0, 
  endHour = 24 
}) => {
  // Generate hours from start to end
  const hours = Array.from(
    { length: endHour - startHour + 1 }, 
    (_, i) => startHour + i
  );

  return (
    <div className="time-grid w-16 flex-shrink-0 border-r border-gray-200 bg-gray-50">
      {hours.map((hour) => (
        <div 
          key={hour} 
          className="time-slot h-16 relative"
        >
          <div className="absolute top-[-10px] right-2 text-xs text-gray-500 font-medium">
            {format(new Date().setHours(hour, 0, 0), 'h:mm a')}
          </div>
        </div>
      ))}
    </div>
  );
};

export default React.memo(TimeGrid);
