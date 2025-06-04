import { useCallback } from 'react';
import { Task } from '../types';

export default function useTaskHandlers({
  tasksForSelectedDate,
  updateTask,
  addTask,
  deleteTask,
  dateKey,
  setIsFormOpen,
  setEditingTask,
  setTempTimeRange,
  scrollableContainerRef,
  lastScrollPositionRef
}: any) {
  const handleTaskClick = useCallback((task: Task) => {
    if (scrollableContainerRef.current) {
      lastScrollPositionRef.current = scrollableContainerRef.current.scrollTop;
    }
    setEditingTask(task);
    setTempTimeRange(null);
    setIsFormOpen(true);
  }, [scrollableContainerRef, lastScrollPositionRef, setEditingTask, setTempTimeRange, setIsFormOpen]);

  const handleDeleteTask = useCallback((taskId: string) => {
    if (scrollableContainerRef.current) {
      lastScrollPositionRef.current = scrollableContainerRef.current.scrollTop;
    }
    deleteTask(taskId, dateKey);
  }, [deleteTask, dateKey, scrollableContainerRef, lastScrollPositionRef]);

  return { handleTaskClick, handleDeleteTask };
}
