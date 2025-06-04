import React, { useState, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { Task } from './types';
import useTaskStore from './store/taskStore';
import SettingsDrawer from './components/SettingsDrawer';
import ImportModal from './components/ImportModal';
import Header from './components/Header';
import MainContent from './components/MainContent';
import useWeather from './hooks/useWeather';
import useNotifications from './hooks/useNotifications';
import appIcon from '../icons/icon32.png';

function App() {
  // State
  const [selectedDate, setSelectedDate] = useState(new Date());
  const headerContainerRef = useRef<HTMLDivElement>(null);
  const scrollableContainerRef = useRef<HTMLDivElement>(null);
  const initialScrollDoneRef = useRef(false);
  const lastScrollPositionRef = useRef<number>(0);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [tempTimeRange, setTempTimeRange] = useState<{start: Date, end: Date} | null>(null);
  const {
    addTask,
    updateTask,
    deleteTask,
    getTasksForDate,
    defaultNotificationSetting,
    setDefaultNotificationSetting
  } = useTaskStore();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [temperatureUnit, setTemperatureUnit] = useState<'C' | 'F'>('C');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [notificationMinutesBefore, setNotificationMinutesBefore] = useState<number>(() => {
    const saved = localStorage.getItem('notificationMinutesBefore');
    return saved ? Number(saved) : 5;
  });
  const handleNotificationMinutesBeforeChange = (minutes: number) => {
    setNotificationMinutesBefore(minutes);
    localStorage.setItem('notificationMinutesBefore', String(minutes));
  };

  // Weather
  const { weatherData, weatherLoading, weatherError } = useWeather();

  // Notifications
  const dateKey = format(selectedDate, 'yyyy-MM-dd');
  const tasksForSelectedDate = getTasksForDate(dateKey);
  useNotifications({ tasksForSelectedDate, notificationMinutesBefore, appIcon });

  // Handlers
  const toggleTemperatureUnit = () => {
    const newUnit = temperatureUnit === 'C' ? 'F' : 'C';
    setTemperatureUnit(newUnit);
    localStorage.setItem('temperatureUnit', newUnit);
  };

  const handleToggleDefaultNotifications = useCallback(() => {
    setDefaultNotificationSetting(!defaultNotificationSetting);
  }, [defaultNotificationSetting, setDefaultNotificationSetting]);

  const handleToggleTaskNotification = useCallback((taskId: string, enabled: boolean) => {
    const taskToUpdate = tasksForSelectedDate.find(t => t.id === taskId);
    if (taskToUpdate) {
      updateTask(taskId, dateKey, { notificationsEnabled: enabled });
    }
  }, [tasksForSelectedDate, updateTask, dateKey]);

  const handleDateChange = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const handleTaskClick = useCallback((task: Task) => {
    if (scrollableContainerRef.current) {
      lastScrollPositionRef.current = scrollableContainerRef.current.scrollTop;
    }
    setEditingTask(task);
    setTempTimeRange(null);
    setIsFormOpen(true);
  }, []);

  const handleDeleteTask = useCallback((taskId: string) => {
    if (scrollableContainerRef.current) {
      lastScrollPositionRef.current = scrollableContainerRef.current.scrollTop;
    }
    deleteTask(taskId, dateKey);
  }, [deleteTask, dateKey]);

  const handleSaveTask = useCallback((task: Task) => {
    // Check for overlapping tasks, excluding the current task being edited
    const isOverlapping = tasksForSelectedDate.some(existingTask => {
      if (editingTask && existingTask.id === editingTask.id) return false;
      return (task.startTime < existingTask.endTime && task.endTime > existingTask.startTime);
    });

    if (isOverlapping) {
      alert('Cannot save task: Time slot overlaps with an existing task');
      return;
    }

    if (editingTask) {
      updateTask(editingTask.id, dateKey, task);
    } else {
      addTask(task);
    }
    setIsFormOpen(false);
    setEditingTask(null);
    setTempTimeRange(null);
  }, [tasksForSelectedDate, editingTask, updateTask, dateKey, addTask]);

  const handleCancelForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingTask(null);
    setTempTimeRange(null);
  }, []);

  const handleCurrentTimeReady = useCallback((timePosition: number | null) => {
    if (scrollableContainerRef.current) {
      if (!initialScrollDoneRef.current && timePosition !== null) {
        // Initial scroll for date load: center current time
        const scrollableViewportHeight = scrollableContainerRef.current.clientHeight;
        // Ensure scroll position is not negative and not beyond max scroll height
        const newScrollTop = Math.max(0, timePosition - (scrollableViewportHeight / 2));
        
        scrollableContainerRef.current.scrollTop = newScrollTop;
        initialScrollDoneRef.current = true;
        // Store this initial position as the last known good position as well
        lastScrollPositionRef.current = newScrollTop; 
      } else if (initialScrollDoneRef.current) {
        // Subsequent updates on the same date (e.g., after task C/U/D, form close):
        // Restore to the last captured scroll position.
        scrollableContainerRef.current.scrollTop = lastScrollPositionRef.current;
      }
    }
  }, []);

  // --- Import Calendar Logic ---
  const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID'; // TODO: Replace with your client ID
  const GOOGLE_REDIRECT_URI = window.location.origin; // e.g., http://localhost:5173
  const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

  const handleGoogleImport = () => {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: GOOGLE_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };
  const handleOutlookImport = () => {
    // TODO: Implement Outlook OAuth flow
    alert('Outlook import not yet implemented.');
  };

  // Handlers for MainContent
  const handleTimeSlotClick = useCallback((startTime: Date, endTime: Date) => {
    const isOverlapping = tasksForSelectedDate.some(task => {
      return (startTime < task.endTime && endTime > task.startTime);
    });
    if (isOverlapping) {
      alert('Cannot create task: Time slot overlaps with an existing task');
      return;
    }
    if (scrollableContainerRef.current) {
      lastScrollPositionRef.current = scrollableContainerRef.current.scrollTop;
    }
    setTempTimeRange({ start: startTime, end: endTime });
    setEditingTask(null);
    setIsFormOpen(true);
  }, [tasksForSelectedDate]);

  const handleTaskUpdate = useCallback((updatedTask: Task) => {
    const isOverlapping = tasksForSelectedDate.some(existingTask => {
      if (existingTask.id === updatedTask.id) return false;
      return (updatedTask.startTime < existingTask.endTime && updatedTask.endTime > existingTask.startTime);
    });
    if (isOverlapping) {
      alert('Cannot move task: Time slot overlaps with an existing task');
      return;
    }
    updateTask(updatedTask.id, dateKey, updatedTask);
  }, [tasksForSelectedDate, updateTask, dateKey]);

  return (
    <div className="flex flex-col h-[600px] w-[400px] bg-white text-gray-900 overflow-hidden rounded-lg shadow-lg relative">
      <SettingsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        temperatureUnit={temperatureUnit}
        onToggleTemperatureUnit={toggleTemperatureUnit}
        defaultNotificationsEnabled={defaultNotificationSetting}
        onToggleDefaultNotifications={handleToggleDefaultNotifications}
        notificationMinutesBefore={notificationMinutesBefore}
        onNotificationMinutesBeforeChange={handleNotificationMinutesBeforeChange}
      />
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onGoogleImport={handleGoogleImport}
        onOutlookImport={handleOutlookImport}
      />
      <div ref={headerContainerRef}>
        <Header
          appIcon={appIcon}
          onMenuClick={() => setIsDrawerOpen(true)}
          weatherData={weatherData}
          weatherLoading={weatherLoading}
          weatherError={weatherError}
          temperatureUnit={temperatureUnit}
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
        />
      </div>
      <MainContent
        isFormOpen={isFormOpen}
        editingTask={editingTask}
        tempTimeRange={tempTimeRange}
        onSaveTask={handleSaveTask}
        onCancelForm={handleCancelForm}
        defaultNotificationSetting={defaultNotificationSetting}
        tasksForSelectedDate={tasksForSelectedDate}
        startHour={0}
        endHour={24}
        onTaskClick={handleTaskClick}
        onDeleteTask={handleDeleteTask}
        onTimeSlotClick={handleTimeSlotClick}
        onCurrentTimeReady={handleCurrentTimeReady}
        onTaskUpdate={handleTaskUpdate}
        onToggleTaskNotification={handleToggleTaskNotification}
        scrollableContainerRef={scrollableContainerRef}
      />
    </div>
  );
}

export default App;