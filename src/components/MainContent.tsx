import React from "react";
import TaskForm from "./TaskForm";
import TimeGrid from "./TimeGrid";
import CalendarGrid from "./CalendarGrid";
import { Task } from "../types";

interface MainContentProps {
  isFormOpen: boolean;
  editingTask: Task | null;
  tempTimeRange: { start: Date; end: Date } | null;
  onSaveTask: (task: Task) => void;
  onCancelForm: () => void;
  defaultNotificationSetting: boolean;
  tasksForSelectedDate: Task[];
  startHour: number;
  endHour: number;
  onTaskClick: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onTimeSlotClick: (start: Date, end: Date) => void;
  onCurrentTimeReady: (position: number | null) => void;
  onTaskUpdate: (task: Task) => void;
  onToggleTaskNotification: (taskId: string, enabled: boolean) => void;
  scrollableContainerRef: React.RefObject<HTMLDivElement>;
  onCalendarDrop: () => void;
}

const MainContent: React.FC<MainContentProps> = ({
  isFormOpen,
  editingTask,
  tempTimeRange,
  onSaveTask,
  onCancelForm,
  defaultNotificationSetting,
  tasksForSelectedDate,
  startHour,
  endHour,
  onTaskClick,
  onDeleteTask,
  onTimeSlotClick,
  onCurrentTimeReady,
  onTaskUpdate,
  onToggleTaskNotification,
  scrollableContainerRef,
  onCalendarDrop,
}) =>
  isFormOpen ? (
    <div className="flex-grow p-4 overflow-y-auto">
      <TaskForm
        task={editingTask || undefined}
        startTime={tempTimeRange?.start}
        endTime={tempTimeRange?.end}
        onSave={onSaveTask}
        onCancel={onCancelForm}
        defaultNotificationSetting={defaultNotificationSetting}
      />
    </div>
  ) : (
    <div className="flex-grow overflow-y-auto" ref={scrollableContainerRef}>
      <div className="flex w-full pt-[10px]">
        <TimeGrid startHour={startHour} endHour={endHour} />
        <CalendarGrid
          selectedDate={new Date()}
          tasks={tasksForSelectedDate}
          startHour={startHour}
          endHour={endHour}
          onTaskClick={onTaskClick}
          onDeleteTask={onDeleteTask}
          onTimeSlotClick={onTimeSlotClick}
          onCurrentTimeReady={onCurrentTimeReady}
          onTaskUpdate={onTaskUpdate}
          onToggleTaskNotification={onToggleTaskNotification}
          onDropNotify={onCalendarDrop}
        />
      </div>
    </div>
  );

export default MainContent;
