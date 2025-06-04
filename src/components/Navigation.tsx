import React from 'react';
import { format, addDays, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface NavigationProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentDate, onDateChange }) => {
  const today = new Date();
  const isToday = isSameDay(currentDate, today);
  
  const goToPreviousDay = () => {
    onDateChange(addDays(currentDate, -1));
  };
  
  const goToNextDay = () => {
    onDateChange(addDays(currentDate, 1));
  };
  
  return (
    <div className="flex items-center justify-between py-3 px-2 border-b border-gray-200">
      <button 
        onClick={goToPreviousDay}
        className="p-1 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Previous day"
      >
        <ChevronLeft size={20} className="text-gray-600" />
      </button>
      
      <div className="flex items-center space-x-2">
        <h2 className="text-lg font-semibold">
          {isToday ? `Today, ${format(currentDate, 'MMMM d')}` : format(currentDate, 'EEEE, MMMM d')}
        </h2>
      </div>
      
      <button 
        onClick={goToNextDay}
        className="p-1 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Next day"
      >
        <ChevronRight size={20} className="text-gray-600" />
      </button>
    </div>
  );
};

export default React.memo(Navigation);