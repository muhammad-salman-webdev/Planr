import React from 'react';
import { Task } from '../types';
import TaskItem from './TaskItem';

interface TaskListProps {
  tasks: Task[];
  getTaskPosition: (task: Task) => { top: number; height: number };
  onTaskClick: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleNotification?: (taskId: string, enabled: boolean) => void; // Added prop
}

const TaskList: React.FC<TaskListProps> = ({ tasks, getTaskPosition, onTaskClick, onDeleteTask, onToggleNotification }) => {
  return (
    <>
      {tasks.map((task) => {
        const { top, height } = getTaskPosition(task);
        return (
          <div
            key={task.id}
            className="absolute left-4 right-4 z-20"
            style={{ top: `${top}px`, height: `${height}px` }}
            onMouseDown={(e: React.MouseEvent) => {
              e.stopPropagation(); // Prevent grid mousedown when clicking on a task
            }}
          >
            <TaskItem
              task={task}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onTaskClick(task);
              }}
              onDelete={(e) => {
                e.stopPropagation();
                onDeleteTask(task.id);
              }}
              onToggleNotification={onToggleNotification} // Pass down
            />
          </div>
        );
      })}
    </>
  );
};

export default TaskList;
