import React from 'react';

interface TimeSlotsProps {
  hours: number[];
}

const TimeSlots: React.FC<TimeSlotsProps> = ({ hours }) => {
  return (
    <>
      {hours.map((hour) => (
        <div
          key={hour}
          className="hour-slot border-t border-gray-300 h-16 relative"
        >
          {/* Half-hour line */}
          <div className="border-t border-gray-200 border-dashed h-8 w-[calc(100%-16px)] absolute top-8 left-4" />
        </div>
      ))}
    </>
  );
};

export default TimeSlots;
