import React from 'react';

interface DragSelectionProps {
  dragRange: { top: number; height: number } | null;
}

const DragSelection: React.FC<DragSelectionProps> = ({ dragRange }) => {
  if (!dragRange) {
    return null;
  }

  return (
    <div
      className="absolute left-4 right-4 bg-blue-200 opacity-70 rounded-md border-2 border-blue-400 z-10 pointer-events-none"
      style={{
        top: `${dragRange.top}px`,
        height: `${dragRange.height}px`,
      }}
    />
  );
};

export default DragSelection;
