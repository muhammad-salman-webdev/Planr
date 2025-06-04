import React from 'react';
import { Task } from '../types';
import { format } from 'date-fns';
import { X, Bell, BellOff } from 'lucide-react'; // Added Bell and BellOff icons

interface TaskItemProps {
  task: Task;
  onClick?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  onToggleNotification?: (taskId: string, enabled: boolean) => void; // Added prop for toggling notification
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onClick, onDelete, onToggleNotification }) => {
  const startTime = format(task.startTime, 'h:mm a');
  const endTime = format(task.endTime, 'h:mm a');
  
  const backgroundColor = task.color || '#3b82f6';

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('taskId', task.id);
  };

  const handleNotificationToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering onClick for the task item itself
    if (onToggleNotification) {
      onToggleNotification(task.id, !task.notificationsEnabled);
    }
  };
  
  return (
    <div 
      draggable={true}
      onDragStart={handleDragStart}
      className="task-item rounded-md text-white text-sm relative overflow-hidden cursor-pointer transition-all hover:brightness-95 hover:shadow-md"
      style={{ 
        backgroundColor,
        height: '100%' 
      }}
      onClick={(e: React.MouseEvent) => {
        if (onClick) {
          e.stopPropagation();
          onClick(e);
        }
      }}
    >
      <div className="p-2 h-full flex flex-col">
        <div className="flex justify-between items-start">
          <h3 className="font-bold truncate flex-grow mr-1">{task.title}</h3>
          <div className="flex items-center space-x-1 shrink-0"> {/* Container for buttons */}
            {onToggleNotification && (
              <button
                onClick={handleNotificationToggle}
                className="text-white hover:bg-white/20 rounded-full p-0.5 transition-colors"
                title={task.notificationsEnabled ? "Disable notification" : "Enable notification"}
              >
                {task.notificationsEnabled ? <Bell size={14} /> : <BellOff size={14} />}
              </button>
            )}
            {onDelete && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (onDelete) onDelete(e);
                }}
                className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        <div className="text-xs text-white/80">
          {startTime} - {endTime}
        </div>
        {task.description && (
          <div className="text-xs text-white/80 truncate mt-1">
            {task.description}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskItem;