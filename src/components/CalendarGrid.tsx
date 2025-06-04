import React, { useRef, useState, useEffect } from 'react';
import { format, setHours, setMinutes, addHours, isSameDay, differenceInMilliseconds, addMilliseconds, addMinutes } from 'date-fns';
import { Task } from '../types';
import TaskList from './TaskList';
import TimeSlots from './TimeSlots';
import CurrentTimeIndicator from './CurrentTimeIndicator';
import DragSelection from './DragSelection';

interface CalendarGridProps {
  selectedDate: Date;
  tasks: Task[];
  startHour?: number;
  endHour?: number;
  onTaskClick: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onTimeSlotClick: (startTime: Date, endTime: Date) => void;
  onCurrentTimeReady?: (position: number | null) => void;
  onTaskUpdate: (updatedTask: Task) => void; // New prop to handle task updates
  onToggleTaskNotification?: (taskId: string, enabled: boolean) => void; // Added prop
}

const CalendarGrid: React.FC<CalendarGridProps> = ({
  selectedDate,
  tasks,
  startHour = 6,
  endHour = 22,
  onTaskClick,
  onDeleteTask,
  onTimeSlotClick,
  onCurrentTimeReady,
  onTaskUpdate, // New prop
  onToggleTaskNotification // Added prop
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [currentTimePosition, setCurrentTimePosition] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Date | null>(null);
  const [dragEnd, setDragEnd] = useState<Date | null>(null);
  const [dragRange, setDragRange] = useState<{ top: number; height: number } | null>(null);

  // Generate hours
  const hours = Array.from(
    { length: endHour - startHour + 1 }, 
    (_, i) => startHour + i
  );

  // Update current time indicator position
  useEffect(() => {
    const today = new Date();
    const isSelectedDateToday = isSameDay(selectedDate, today);

    if (!isSelectedDateToday) {
      setCurrentTimePosition(null);
      if (onCurrentTimeReady) {
        onCurrentTimeReady(null);
      }
      return; // No interval setup needed if not today
    }

    // Original logic for when it IS today
    const updateCurrentTimePosition = () => {
      const now = new Date(); // `now` should be `today` if we only want to show for `selectedDate` when it's today.
                           // Or, if indicator must move, `now` is correct.
                           // The requirement is "display ... only if selectedDate ... is ... current day".
                           // The position should still reflect the *actual current time*.
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      if (currentHour >= startHour && currentHour <= endHour) {
        const hourPosition = (currentHour - startHour) * 64; // 64px per hour
        const minutePosition = (currentMinute / 60) * 64;
        const calculatedPosition = hourPosition + minutePosition;
        setCurrentTimePosition(calculatedPosition);
        if (onCurrentTimeReady) {
          onCurrentTimeReady(calculatedPosition);
        }
      } else {
        setCurrentTimePosition(null);
        if (onCurrentTimeReady) {
          onCurrentTimeReady(null);
        }
      }
    };
    
    updateCurrentTimePosition(); // Initial call
    const interval = setInterval(updateCurrentTimePosition, 60000); // Update every minute
    
    return () => {
      clearInterval(interval); // Cleanup interval
    };
  }, [selectedDate, startHour, endHour, onCurrentTimeReady]); // Added selectedDate to dependencies

  // Calculate task position and height
  const getTaskPosition = (task: Task) => {
    const startTimeDate = task.startTime instanceof Date ? task.startTime : new Date(task.startTime);
    const endTimeDate = task.endTime instanceof Date ? task.endTime : new Date(task.endTime);
    
    const taskStartHour = startTimeDate.getHours();
    const taskStartMinute = startTimeDate.getMinutes();
    const taskEndHour = endTimeDate.getHours();
    const taskEndMinute = endTimeDate.getMinutes();
    
    const startPosition = ((taskStartHour - startHour) + (taskStartMinute / 60)) * 64;
    const endPosition = ((taskEndHour - startHour) + (taskEndMinute / 60)) * 64;
    const height = endPosition - startPosition;

    // console.log('Task:', task.title);
    // console.log('Start Time:', startTimeDate, 'End Time:', endTimeDate);
    // console.log('Task Start Hour:', taskStartHour, 'Task Start Minute:', taskStartMinute);
    // console.log('Task End Hour:', taskEndHour, 'Task End Minute:', taskEndMinute);
    // console.log('Calculated Start Position (top):', startPosition);
    // console.log('Calculated End Position:', endPosition);
    // console.log('Calculated Height (before Math.max):', height);
    
    return {
      top: startPosition,
      height: Math.max(height, 20) 
    };
  };

  // Round time to nearest 30 minutes
  const roundToNearestThirty = (date: Date): Date => {
    const minutes = date.getMinutes();
    const roundedMinutes = Math.round(minutes / 30) * 30;
    const newDate = new Date(date);
    newDate.setMinutes(roundedMinutes, 0, 0);
    return newDate;
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Allow drop
    // Optionally, provide visual feedback for drop target
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId || !gridRef.current) return;

    const draggedTask = tasks.find(t => t.id === taskId);
    if (!draggedTask) return;

    const gridRect = gridRef.current.getBoundingClientRect();
    const dropY = e.clientY - gridRect.top;
    
    // Calculate new start time based on drop position
    const hourFraction = dropY / 64; // 64px per hour
    const totalMinutesFromStartHour = hourFraction * 60;
    
    let newStartHour = startHour + Math.floor(totalMinutesFromStartHour / 60);
    let newStartMinute = totalMinutesFromStartHour % 60;

    let newStartTime = setMinutes(setHours(new Date(selectedDate), newStartHour), newStartMinute);
    newStartTime = roundToNearestThirty(newStartTime); // Snap to nearest 30 mins

    // Ensure newStartTime is within the grid boundaries
    const minTime = setMinutes(setHours(new Date(selectedDate), startHour), 0);
    const maxTimeBoundary = setMinutes(setHours(new Date(selectedDate), endHour), 0); // Max start time for a task to fit

    if (newStartTime < minTime) newStartTime = minTime;
    
    const taskDuration = differenceInMilliseconds(
        draggedTask.endTime instanceof Date ? draggedTask.endTime : new Date(draggedTask.endTime),
        draggedTask.startTime instanceof Date ? draggedTask.startTime : new Date(draggedTask.startTime)
    );
    let newEndTime = addMilliseconds(newStartTime, taskDuration);

    // Prevent task from extending beyond grid end
    if (newEndTime > addHours(maxTimeBoundary,1) ) { // allow task to end at endHour:00
        newEndTime = addHours(maxTimeBoundary,1);
        // Optionally adjust start time if duration makes it exceed
        newStartTime = addMilliseconds(newEndTime, -taskDuration);
        newStartTime = roundToNearestThirty(newStartTime); // Re-round after adjustment
         if (newStartTime < minTime) newStartTime = minTime; // Re-check min boundary
    }


    // Basic collision detection (more sophisticated needed for partial overlaps)
    const collision = tasks.some(task => {
      if (task.id === taskId) return false; // Don't check against itself
      const existingTaskStart = task.startTime instanceof Date ? task.startTime : new Date(task.startTime);
      const existingTaskEnd = task.endTime instanceof Date ? task.endTime : new Date(task.endTime);
      
      // Check for overlap: (StartA < EndB) and (EndA > StartB)
      return (newStartTime < existingTaskEnd && addMilliseconds(newStartTime, taskDuration) > existingTaskStart);
    });

    if (collision) {
      console.warn('Collision detected! Task drop aborted.');
      // Optionally, provide user feedback about the collision
      return;
    }

    const updatedTask: Task = {
      ...draggedTask,
      startTime: newStartTime,
      endTime: newEndTime,
    };

    onTaskUpdate(updatedTask);
  };


  // Handle mouse events for drag creation
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!gridRef.current) return;
    
    const rect = gridRef.current.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const hourDecimal = offsetY / 64; // 64px per hour
    
    // Calculate time from grid position and round to nearest 30 minutes
    const hours = Math.floor(hourDecimal) + startHour;
    const minutes = Math.floor((hourDecimal % 1) * 60);
    
    const startTime = new Date(selectedDate);
    startTime.setHours(hours, minutes, 0, 0);
    const roundedStartTime = roundToNearestThirty(startTime);
    const endTime = addMinutes(roundedStartTime, 30); // Changed from 1 hour
    
    setIsDragging(true);
    setDragStart(roundedStartTime);
    setDragEnd(endTime);
    
    // Calculate visual position based on rounded time
    const startHourDecimal = roundedStartTime.getHours() - startHour + roundedStartTime.getMinutes() / 60;
    const startY = startHourDecimal * 64;
    
    setDragRange({
      top: startY,
      height: 32 // 0.5 hour default height, changed from 64
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !gridRef.current || !dragStart) return;
    
    const rect = gridRef.current.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const hourDecimal = offsetY / 64;
    
    // Calculate time from grid position
    const hours = Math.floor(hourDecimal) + startHour;
    const minutes = Math.floor((hourDecimal % 1) * 60);
    
    const endTime = new Date(selectedDate);
    endTime.setHours(hours, minutes, 0, 0);
    
    setDragEnd(endTime);
    
    // Update visual range
    const dragStartY = (dragStart.getHours() - startHour + dragStart.getMinutes() / 60) * 64;
    const height = offsetY - dragStartY;
    
    if (height >= 0) {
      setDragRange({
        top: dragStartY,
        height: height
      });
    } else {
      setDragRange({
        top: offsetY,
        height: Math.abs(height)
      });
    }
  };

  const handleMouseUp = () => {
    if (isDragging && dragStart && dragEnd) {
      let start = dragStart;
      let end = dragEnd;
      
      // Swap if end is before start
      if (end < start) {
        [start, end] = [end, start];
      }
      
      onTimeSlotClick(start, end);
    }
    
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
    setDragRange(null);
  };

  return (
    <div 
      ref={gridRef}
      className="calendar-grid flex-grow relative cursor-pointer" // Added cursor-pointer for better UX
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp} // End drag if mouse leaves grid
      onDragOver={handleDragOver} // Added for drag-and-drop
      onDrop={handleDrop}         // Added for drag-and-drop
    >
      <TimeSlots hours={hours} />
      
      <CurrentTimeIndicator position={currentTimePosition} />
      
      <TaskList 
        tasks={tasks} 
        getTaskPosition={getTaskPosition} 
        onTaskClick={onTaskClick} 
        onDeleteTask={onDeleteTask} 
        onToggleNotification={onToggleTaskNotification} // Pass down
      />
      
      <DragSelection dragRange={dragRange} />
    </div>
  );
};

export default React.memo(CalendarGrid);

// In the parent component (e.g., App.tsx or similar)
// ...
// <CalendarGrid tasks={tasks} onTaskUpdate={handleUpdateTask} ... />