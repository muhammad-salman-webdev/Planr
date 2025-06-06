import React, { useRef, useState, useEffect } from "react";
import {
  setHours,
  setMinutes,
  addHours,
  isSameDay,
  differenceInMilliseconds,
  addMilliseconds,
  addMinutes,
} from "date-fns";
import { Task } from "../types";
import TaskList from "./TaskList";
import TimeSlots from "./TimeSlots";
import CurrentTimeIndicator from "./CurrentTimeIndicator";
import DragSelection from "./DragSelection";

interface CalendarGridProps {
  selectedDate: Date;
  tasks: Task[];
  startHour?: number;
  endHour?: number;
  onTaskClick: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onTimeSlotClick: (startTime: Date, endTime: Date) => void;
  onCurrentTimeReady?: (position: number | null) => void;
  onTaskUpdate: (updatedTask: Task) => void;
  onToggleTaskNotification?: (taskId: string, enabled: boolean) => void;
  onDropNotify: () => void;
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
  onTaskUpdate,
  onToggleTaskNotification,
  onDropNotify,
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [currentTimePosition, setCurrentTimePosition] = useState<number | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Date | null>(null);
  const [dragEnd, setDragEnd] = useState<Date | null>(null);
  const [dragRange, setDragRange] = useState<{
    top: number;
    height: number;
  } | null>(null);

  const PIXELS_PER_HOUR = 64;
  const PIXELS_PER_MINUTE = PIXELS_PER_HOUR / 60;

  const hours = Array.from(
    { length: endHour - startHour + 1 },
    (_, i) => startHour + i
  );

  useEffect(() => {
    const today = new Date();
    const isSelectedDateToday = isSameDay(selectedDate, today);

    if (!isSelectedDateToday) {
      setCurrentTimePosition(null);
      if (onCurrentTimeReady) onCurrentTimeReady(null);
      return;
    }

    const updateCurrentTimePosition = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      if (currentHour >= startHour && currentHour <= endHour) {
        const calculatedPosition =
          (currentHour - startHour) * PIXELS_PER_HOUR +
          currentMinute * PIXELS_PER_MINUTE;
        setCurrentTimePosition(calculatedPosition);
        if (onCurrentTimeReady) onCurrentTimeReady(calculatedPosition);
      } else {
        setCurrentTimePosition(null);
        if (onCurrentTimeReady) onCurrentTimeReady(null);
      }
    };

    updateCurrentTimePosition();
    const interval = setInterval(updateCurrentTimePosition, 60000);
    return () => clearInterval(interval);
  }, [selectedDate, startHour, endHour, onCurrentTimeReady]);

  const getTaskPosition = (task: Task) => {
    const start =
      task.startTime instanceof Date
        ? task.startTime
        : new Date(task.startTime);
    const end =
      task.endTime instanceof Date ? task.endTime : new Date(task.endTime);

    const top =
      (start.getHours() - startHour) * PIXELS_PER_HOUR +
      start.getMinutes() * PIXELS_PER_MINUTE;
    const bottom =
      (end.getHours() - startHour) * PIXELS_PER_HOUR +
      end.getMinutes() * PIXELS_PER_MINUTE;
    const height = Math.max(bottom - top, 20);

    return { top, height };
  };

  const roundToNearestMinute = (date: Date): Date => {
    const newDate = new Date(date);
    newDate.setSeconds(0, 0);
    return newDate;
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    if (!taskId || !gridRef.current) return;

    const draggedTask = tasks.find((t) => t.id === taskId);
    if (!draggedTask) return;

    const gridRect = gridRef.current.getBoundingClientRect();
    const dropY = e.clientY - gridRect.top;
    const totalMinutes = dropY / PIXELS_PER_MINUTE;

    const newStartHour = startHour + Math.floor(totalMinutes / 60);
    const newStartMinute = totalMinutes % 60;

    let newStartTime = setMinutes(
      setHours(new Date(selectedDate), newStartHour),
      newStartMinute
    );
    newStartTime = roundToNearestMinute(newStartTime);

    const minTime = setMinutes(setHours(new Date(selectedDate), startHour), 0);
    const maxTimeBoundary = setMinutes(
      setHours(new Date(selectedDate), endHour),
      0
    );

    if (newStartTime < minTime) newStartTime = minTime;

    const taskDuration = differenceInMilliseconds(
      draggedTask.endTime instanceof Date
        ? draggedTask.endTime
        : new Date(draggedTask.endTime),
      draggedTask.startTime instanceof Date
        ? draggedTask.startTime
        : new Date(draggedTask.startTime)
    );
    let newEndTime = addMilliseconds(newStartTime, taskDuration);

    if (newEndTime > addHours(maxTimeBoundary, 1)) {
      newEndTime = addHours(maxTimeBoundary, 1);
      newStartTime = addMilliseconds(newEndTime, -taskDuration);
      newStartTime = roundToNearestMinute(newStartTime);
      if (newStartTime < minTime) newStartTime = minTime;
    }

    const collision = tasks.some((task) => {
      if (task.id === taskId) return false;
      const taskStart =
        task.startTime instanceof Date
          ? task.startTime
          : new Date(task.startTime);
      const taskEnd =
        task.endTime instanceof Date ? task.endTime : new Date(task.endTime);
      return (
        newStartTime < taskEnd &&
        addMilliseconds(newStartTime, taskDuration) > taskStart
      );
    });

    if (collision) {
      console.warn("Collision detected! Task drop aborted.");
      return;
    }

    const updatedTask: Task = {
      ...draggedTask,
      startTime: newStartTime,
      endTime: newEndTime,
    };

    onTaskUpdate(updatedTask);

    onDropNotify();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const totalMinutes = offsetY / PIXELS_PER_MINUTE;
    const hours = Math.floor(totalMinutes / 60) + startHour;
    const minutes = Math.floor(totalMinutes % 60);

    const startTime = new Date(selectedDate);
    startTime.setHours(hours, minutes, 0, 0);
    const roundedStartTime = roundToNearestMinute(startTime);
    const endTime = addMinutes(roundedStartTime, 30);

    setIsDragging(true);
    setDragStart(roundedStartTime);
    setDragEnd(endTime);

    const startY =
      (roundedStartTime.getHours() - startHour) * PIXELS_PER_HOUR +
      roundedStartTime.getMinutes() * PIXELS_PER_MINUTE;

    setDragRange({
      top: startY,
      height: 32,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !gridRef.current || !dragStart) return;

    const rect = gridRef.current.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const totalMinutes = offsetY / PIXELS_PER_MINUTE;
    const hours = Math.floor(totalMinutes / 60) + startHour;
    const minutes = Math.floor(totalMinutes % 60);

    const endTime = new Date(selectedDate);
    endTime.setHours(hours, minutes, 0, 0);
    setDragEnd(endTime);

    const dragStartY =
      (dragStart.getHours() - startHour) * PIXELS_PER_HOUR +
      dragStart.getMinutes() * PIXELS_PER_MINUTE;
    const height = offsetY - dragStartY;

    if (height >= 0) {
      setDragRange({ top: dragStartY, height });
    } else {
      setDragRange({ top: offsetY, height: Math.abs(height) });
    }
  };

  const handleMouseUp = () => {
    if (isDragging && dragStart && dragEnd) {
      let start = dragStart;
      let end = dragEnd;
      if (end < start) [start, end] = [end, start];
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
      className="calendar-grid flex-grow relative cursor-pointer"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDragOver={handleDragOver}
      onDrop={handleDrop}>
      <TimeSlots hours={hours} />
      <CurrentTimeIndicator position={currentTimePosition} />
      <TaskList
        tasks={tasks}
        getTaskPosition={getTaskPosition}
        onTaskClick={onTaskClick}
        onDeleteTask={onDeleteTask}
        onToggleNotification={onToggleTaskNotification}
      />
      <DragSelection dragRange={dragRange} />
    </div>
  );
};

export default React.memo(CalendarGrid);
