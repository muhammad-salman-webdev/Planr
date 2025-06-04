import React, { useState } from 'react';
import { format } from 'date-fns';
import { Task } from '../types';
import { Bell, BellOff } from 'lucide-react';

interface TaskFormProps {
  task?: Task;
  startTime?: Date;
  endTime?: Date;
  onSave: (task: Task) => void;
  onCancel: () => void;
  defaultNotificationSetting?: boolean; // New prop
}

const DEFAULT_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f97316', // Orange
  '#8b5cf6', // Purple
  '#ec4899', // Pink
];

const TaskForm: React.FC<TaskFormProps> = ({ 
  task, 
  startTime: initialStartTime, 
  endTime: initialEndTime, 
  onSave, 
  onCancel,
  defaultNotificationSetting = false // fallback
}) => {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [startTime, setStartTime] = useState<Date>(
    task?.startTime || initialStartTime || new Date()
  );
  const [endTime, setEndTime] = useState<Date>(() => {
    if (task?.endTime) {
      return task.endTime;
    }
    if (initialEndTime) {
      return initialEndTime;
    }
    return new Date(new Date().getTime() + 60 * 60 * 1000);
  });
  const [color, setColor] = useState(task?.color || DEFAULT_COLORS[0]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    task?.notificationsEnabled ?? defaultNotificationSetting
  );

  // Format times for input fields
  const formatTimeForInput = (date: Date) => {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return '';
    }
    return format(date, 'HH:mm');
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      return;
    }
    const newTask: Task = {
      id: task?.id || crypto.randomUUID(),
      title,
      description,
      startTime,
      endTime,
      color,
      notificationsEnabled,
    };
    onSave(newTask);
  };

  // Handle time input changes
  const handleTimeChange = (
    timeString: string, 
    setter: React.Dispatch<React.SetStateAction<Date>>
  ) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const newDate = new Date();
    newDate.setHours(hours, minutes, 0, 0);
    setter(newDate);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-4">
      <div className="mb-4">
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          Task Title
        </label>
        <input
          type="text"
          id="title"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Meeting, Break, etc."
          autoFocus
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1">
            Start Time
          </label>
          <input
            type="time"
            id="startTime"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={formatTimeForInput(startTime)}
            onChange={(e) => handleTimeChange(e.target.value, setStartTime)}
            required
          />
        </div>
        <div>
          <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-1">
            End Time
          </label>
          <input
            type="time"
            id="endTime"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={formatTimeForInput(endTime)}
            onChange={(e) => handleTimeChange(e.target.value, setEndTime)}
            required
          />
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description (Optional)
        </label>
        <textarea
          id="description"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add details..."
          rows={2}
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Color
        </label>
        <div className="flex space-x-2">
          {DEFAULT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`w-8 h-8 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>
      {/* Notification toggle */}
      <div className="mb-4 flex items-center">
        <button
          type="button"
          onClick={() => setNotificationsEnabled((v) => !v)}
          className={`mr-2 rounded-full p-1 border transition-colors ${notificationsEnabled ? 'bg-blue-500 border-blue-500 text-white' : 'bg-gray-200 border-gray-300 text-gray-600'}`}
          title={notificationsEnabled ? 'Disable notification' : 'Enable notification'}
        >
          {notificationsEnabled ? <Bell size={18} /> : <BellOff size={18} />}
        </button>
        <span className="text-sm text-gray-700">
          {notificationsEnabled ? 'Notification enabled' : 'Notification disabled'}
        </span>
      </div>

      <div className="flex justify-end space-x-2">
        <button
          type="button"
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Save
        </button>
      </div>
    </form>
  );
};

export default React.memo(TaskForm);