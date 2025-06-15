import React, { useState, useRef, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { Task } from "./types";
import useTaskStore from "./store/taskStore";
import SettingsDrawer from "./components/SettingsDrawer";
import ImportModal from "./components/ImportModal";
import Header from "./components/Header";
import MainContent from "./components/MainContent";
import useWeather from "./hooks/useWeather";
import useNotifications from "./hooks/useNotifications";
import appIcon from "../icons/icon32.png";

function App() {
  // NOTE: GOOGLE_CLIENT_ID is primarily handled in background.ts for the OAuth flow.
  // It's defined there, not here, for security and proper flow execution.

  // State
  const [selectedDate, setSelectedDate] = useState(new Date());
  const headerContainerRef = useRef<HTMLDivElement>(null);
  const scrollableContainerRef = useRef<HTMLDivElement>(null);
  const initialScrollDoneRef = useRef(false);
  const lastScrollPositionRef = useRef<number>(0);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [tempTimeRange, setTempTimeRange] = useState<{
    start: Date;
    end: Date;
  } | null>(null);
  const {
    addTask,
    updateTask,
    deleteTask,
    getTasksForDate,
    defaultNotificationSetting,
    setDefaultNotificationSetting,
    clearTasks,
  } = useTaskStore();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [temperatureUnit, setTemperatureUnit] = useState<"C" | "F">("C");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importingStatus, setImportingStatus] = useState<string | null>(null);

  const [notificationMinutesBefore, setNotificationMinutesBefore] =
    useState<number>(5);

  // Load notification settings and initial tasks on mount
  useEffect(() => {
    // Load notificationMinutesBefore from storage
    chrome.storage?.sync?.get(["notificationMinutesBefore"], (result) => {
      const storedValue = result.notificationMinutesBefore;
      if (storedValue === undefined) {
        chrome.storage?.sync?.set({ notificationMinutesBefore: 5 });
        setNotificationMinutesBefore(5);
      } else {
        setNotificationMinutesBefore(Number(storedValue));
      }
    });

    // --- Listen for messages from the background script ---
    const messageListener = (
      message: any,
      sender: chrome.runtime.MessageSender,
      sendResponse: Function
    ) => {
      if (message.action === "googleEventsFetched") {
        console.log(
          "App.tsx: Received Google events from background:",
          message.tasks
        );

        if (message.status === "success" && message.tasks) {
          // --- Clear existing tasks before adding new ones from Google ---
          clearTasks();

          message.tasks.forEach((taskData: any) => {
            // Convert ISO strings back to Date objects before adding to store
            const task: Task = {
              ...taskData,
              startTime: new Date(taskData.startTime),
              endTime: new Date(taskData.endTime),
            };
            addTask(task); // Add each task to your Zustand store
          });
          setImportingStatus("Import successful!");
        } else if (message.status === "error") {
          console.error(
            "App.tsx: Error during Google import:",
            message.message
          );
          setImportingStatus(`Import failed: ${message.message}`);
          alert(`Google Calendar import failed: ${message.message}`);
        }
        setIsImportModalOpen(false); // Always close the modal after the process finishes
        sendResponse({ acknowledged: true }); // Acknowledge the message
      } else if (message.action === "importProcessStarted") {
        console.log("App.tsx: Google OAuth process initiated by background.");
        setImportingStatus("Connecting to Google for authentication...");
      } else if (message.action === "importFetchingData") {
        console.log("App.tsx: Fetching calendar data...");
        setImportingStatus("Fetching calendar data from Google...");
      }
      return true; // Keep the message channel open for async sendResponse
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [addTask, clearTasks]);

  // Update both state and storage
  const handleNotificationMinutesBeforeChange = (minutes: number) => {
    setNotificationMinutesBefore(minutes);
    chrome.storage?.sync?.set({ notificationMinutesBefore: minutes });
  };

  // ------------------
  // Weather
  const { weatherData, weatherLoading, weatherError } = useWeather();

  // Notifications
  const dateKey = format(selectedDate, "yyyy-MM-dd");
  const tasksForSelectedDate = getTasksForDate(dateKey);
  useNotifications({
    tasksForSelectedDate,
    notificationMinutesBefore,
    appIcon,
  });

  // Handlers
  const toggleTemperatureUnit = () => {
    const newUnit = temperatureUnit === "C" ? "F" : "C";
    setTemperatureUnit(newUnit);
    // Consider using chrome.storage.sync or local for consistency in Chrome extension
    localStorage.setItem("temperatureUnit", newUnit);
  };

  const handleToggleDefaultNotifications = useCallback(() => {
    // This action from useTaskStore should also save to chrome.storage.sync
    setDefaultNotificationSetting(!defaultNotificationSetting);
  }, [defaultNotificationSetting, setDefaultNotificationSetting]);

  const handleToggleTaskNotification = useCallback(
    (taskId: string, enabled: boolean) => {
      const taskToUpdate = tasksForSelectedDate.find((t) => t.id === taskId);
      if (taskToUpdate) {
        updateTask(taskId, dateKey, { notificationsEnabled: enabled });
      }
    },
    [tasksForSelectedDate, updateTask, dateKey]
  );

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

  const handleDeleteTask = useCallback(
    (taskId: string) => {
      if (scrollableContainerRef.current) {
        lastScrollPositionRef.current =
          scrollableContainerRef.current.scrollTop;
      }
      deleteTask(taskId, dateKey);
    },
    [deleteTask, dateKey]
  );

  const handleSaveTask = useCallback(
    (task: Task) => {
      // Check for overlapping tasks, excluding the current task being edited
      const isOverlapping = tasksForSelectedDate.some((existingTask) => {
        if (editingTask && existingTask.id === editingTask.id) return false;
        return (
          task.startTime < existingTask.endTime &&
          task.endTime > existingTask.startTime
        );
      });

      if (isOverlapping) {
        alert("Cannot save task: Time slot overlaps with an existing task");
        return;
      }

      if (editingTask) {
        // When updating, also consider if the date of the task has changed (e.g., dragged to another day)
        // If the date changes, it needs to be deleted from the old date key and added to the new one.
        const oldDateKey = format(editingTask.startTime, "yyyy-MM-dd");
        const newDateKey = format(task.startTime, "yyyy-MM-dd");

        if (oldDateKey !== newDateKey) {
          deleteTask(editingTask.id, oldDateKey); // Delete from old date
          addTask(task); // Add to new date
        } else {
          updateTask(editingTask.id, dateKey, task); // Update on same date
        }
      } else {
        addTask(task);
      }
      setIsFormOpen(false);
      setEditingTask(null);
      setTempTimeRange(null);
    },
    [
      tasksForSelectedDate,
      editingTask,
      updateTask,
      dateKey,
      addTask,
      deleteTask,
    ] // Added deleteTask to dependencies
  );

  const handleCancelForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingTask(null);
    setTempTimeRange(null);
  }, []);

  const handleCurrentTimeReady = useCallback((timePosition: number | null) => {
    if (scrollableContainerRef.current) {
      if (!initialScrollDoneRef.current && timePosition !== null) {
        const scrollableViewportHeight =
          scrollableContainerRef.current.clientHeight;
        const newScrollTop = Math.max(
          0,
          timePosition - scrollableViewportHeight / 2
        );

        scrollableContainerRef.current.scrollTop = newScrollTop;
        initialScrollDoneRef.current = true;
        lastScrollPositionRef.current = newScrollTop;
      } else if (initialScrollDoneRef.current) {
        scrollableContainerRef.current.scrollTop =
          lastScrollPositionRef.current;
      }
    }
  }, []);

  // --- MODIFIED handleGoogleImport ---
  const handleGoogleImport = () => {
    setIsImportModalOpen(true); // Open the modal
    setImportingStatus("Initiating Google OAuth..."); // Set initial status
    // Send a message to the background script to start the OAuth flow
    chrome.runtime
      .sendMessage({ action: "initiateGoogleOAuth" })
      .then((response) => {
        // This 'response' is from the background script acknowledging the initiation of the message,
        // not the final result of the OAuth flow. The actual results will come via the
        // chrome.runtime.onMessage listener in the useEffect hook.
        if (response && response.status === "error") {
          console.error(
            "App.tsx: Error initiating OAuth message to background:",
            response.message
          );
          setImportingStatus(`Failed to start: ${response.message}`);
          alert(`Failed to initiate Google import: ${response.message}`);
          setIsImportModalOpen(false); // Close modal on immediate error
        } else {
          console.log(
            "App.tsx: Google OAuth initiation message sent to background."
          );
        }
      })
      .catch((error) => {
        console.error("App.tsx: Failed to send message to background:", error);
        setImportingStatus(`Failed to send message: ${error.message}`);
        alert(
          `Could not communicate with extension background: ${error.message}`
        );
        setIsImportModalOpen(false); // Close modal on communication error
      });
  };

  // ---------------------
  // ---------------------
  // ---------------------

  const handleOutlookImport = () => {
    // TODO: Implement Outlook OAuth flow
    alert("Outlook import not yet implemented.");
  };

  // Handlers for MainContent
  const handleTimeSlotClick = useCallback(
    (startTime: Date, endTime: Date) => {
      // Logic for overlapping tasks is already in handleSaveTask,
      // it's generally better to create task first and then validate/save.
      // If you want to prevent creation on overlap, this logic is okay here.
      const isOverlapping = tasksForSelectedDate.some((task) => {
        // Exclude the new task itself if it somehow ends up in tasksForSelectedDate before saving
        // This check from handleSaveTask is likely more robust for new tasks.
        return startTime < task.endTime && endTime > task.startTime;
      });

      if (isOverlapping) {
        alert("Cannot create task: Time slot overlaps with an existing task");
        return;
      }

      if (scrollableContainerRef.current) {
        lastScrollPositionRef.current =
          scrollableContainerRef.current.scrollTop;
      }
      setTempTimeRange({ start: startTime, end: endTime });
      setEditingTask(null);
      setIsFormOpen(true);
    },
    [tasksForSelectedDate]
  );

  const handleTaskUpdate = useCallback(
    (updatedTask: Task) => {
      const isOverlapping = tasksForSelectedDate.some((existingTask) => {
        if (existingTask.id === updatedTask.id) return false;
        return (
          updatedTask.startTime < existingTask.endTime &&
          updatedTask.endTime > existingTask.startTime
        );
      });
      if (isOverlapping) {
        alert("Cannot move task: Time slot overlaps with an existing task");
        return;
      }
      // When updating, also consider if the date of the task has changed (e.g., dragged to another day)
      // If the date changes, it needs to be deleted from the old date key and added to the new one.
      const oldDateKey = format(
        tasksForSelectedDate.find((t) => t.id === updatedTask.id)?.startTime ||
          updatedTask.startTime,
        "yyyy-MM-dd"
      );
      const newDateKey = format(updatedTask.startTime, "yyyy-MM-dd");

      if (oldDateKey !== newDateKey) {
        deleteTask(updatedTask.id, oldDateKey); // Delete from old date
        addTask(updatedTask); // Add to new date
      } else {
        updateTask(updatedTask.id, dateKey, updatedTask); // Update on same date
      }
    },
    [tasksForSelectedDate, updateTask, dateKey, deleteTask, addTask] // Added deleteTask and addTask to dependencies
  );

  const handleCalendarDrop = () => {
    // Ensure ref is not null before accessing .current
    if (scrollableContainerRef.current) {
      lastScrollPositionRef.current = scrollableContainerRef.current.scrollTop;
    }
  };

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
        onNotificationMinutesBeforeChange={
          handleNotificationMinutesBeforeChange
        }
      />
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onGoogleImport={handleGoogleImport}
        onOutlookImport={handleOutlookImport}
        importingStatus={importingStatus}
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
          onImportOpen={() => setIsImportModalOpen(true)}
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
        onCalendarDrop={handleCalendarDrop}
        selectedDate={selectedDate} // ADDED HERE: Pass selectedDate to MainContent
      />
    </div>
  );
}

export default App;
