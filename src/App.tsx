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
  // TODO: Replace with your client ID
  const GOOGLE_CLIENT_ID =
    "815584967222-p4c0isjf3pabp14eb3jfdar331hrm6gv.apps.googleusercontent.com";

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
  } = useTaskStore();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [temperatureUnit, setTemperatureUnit] = useState<"C" | "F">("C");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [notificationMinutesBefore, setNotificationMinutesBefore] =
    useState<number>(5);

  // Load the value once on mount
  useEffect(() => {
    chrome.storage?.sync?.get(["notificationMinutesBefore"], (result) => {
      const storedValue = result.notificationMinutesBefore;

      if (storedValue === undefined) {
        // Not found → set to 5 and update state
        chrome.storage?.sync?.set({ notificationMinutesBefore: 5 });
        setNotificationMinutesBefore(5);
      } else {
        setNotificationMinutesBefore(Number(storedValue));
      }
    });
  }, []);

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
    localStorage.setItem("temperatureUnit", newUnit);
  };

  const handleToggleDefaultNotifications = useCallback(() => {
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
        updateTask(editingTask.id, dateKey, task);
      } else {
        addTask(task);
      }
      setIsFormOpen(false);
      setEditingTask(null);
      setTempTimeRange(null);
    },
    [tasksForSelectedDate, editingTask, updateTask, dateKey, addTask]
  );

  const handleCancelForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingTask(null);
    setTempTimeRange(null);
  }, []);

  const handleCurrentTimeReady = useCallback((timePosition: number | null) => {
    if (scrollableContainerRef.current) {
      if (!initialScrollDoneRef.current && timePosition !== null) {
        // Initial scroll for date load: center current time
        const scrollableViewportHeight =
          scrollableContainerRef.current.clientHeight;
        // Ensure scroll position is not negative and not beyond max scroll height
        const newScrollTop = Math.max(
          0,
          timePosition - scrollableViewportHeight / 2
        );

        scrollableContainerRef.current.scrollTop = newScrollTop;
        initialScrollDoneRef.current = true;
        // Store this initial position as the last known good position as well
        lastScrollPositionRef.current = newScrollTop;
      } else if (initialScrollDoneRef.current) {
        // Subsequent updates on the same date (e.g., after task C/U/D, form close):
        // Restore to the last captured scroll position.
        scrollableContainerRef.current.scrollTop =
          lastScrollPositionRef.current;
      }
    }
  }, []);

  // --- Import Calendar Logic ---
  // const GOOGLE_REDIRECT_URI = window.location.origin; // e.g., http://localhost:5173
  const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

  // colbalbjjlacenlkomkbpfjdockdkfka - Extension ID

  const handleGoogleImport = () => {
    const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org/`;
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "token", // or "code" if using server-side exchange
      scope: GOOGLE_SCOPE,
      access_type: "online",
      prompt: "consent",
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl,
        interactive: true,
      },
      (redirectUrl) => {
        if (chrome.runtime.lastError) {
          console.error("Auth failed:", chrome.runtime.lastError.message);
          return;
        }

        // Extract access token from redirect URL
        const url = new URL(redirectUrl);
        const hashParams = new URLSearchParams(url.hash.slice(1));
        const accessToken = hashParams.get("access_token");

        console.log("Access Token:", accessToken);
        fetchCalendarEvents(accessToken);
        // You can now use this token to fetch calendar data
      }
    );
  };

  const fetchCalendarEvents = async (accessToken: string) => {
    // Step 1: Get color map from Google
    const getGoogleColorMap = async () => {
      const res = await fetch("https://www.googleapis.com/calendar/v3/colors", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await res.json();
      return data.event || {};
    };

    // Step 2: Fetch events from primary calendar
    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const googleEvents = await response.json();
    if (!googleEvents.items) return;

    const colorMap = await getGoogleColorMap();

    // Get current month range
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    console.log(googleEvents);
    googleEvents.items.forEach((event) => {
      const rawStart = event.start?.dateTime || event.start?.date;
      const rawEnd = event.end?.dateTime || event.end?.date;

      if (!rawStart || !rawEnd) return; // Skip if no valid times

      const start = new Date(rawStart);
      const end = new Date(rawEnd);

      // Only add tasks from the current month
      if (start < firstOfMonth || start >= firstOfNextMonth) return;

      const task: Task = {
        id: event.id || crypto.randomUUID(),
        title: event.summary || "Untitled Event",
        description: event.description || "",
        startTime: start,
        endTime: end,
        color: colorMap[event.colorId]?.background || "#3399FF",
        notificationsEnabled: defaultNotificationSetting,
      };

      addTask(task);
    });

    // Getting Back to the App
    setIsImportModalOpen(false);
  };

  // ---------------------
  // ---------------------
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
      const isOverlapping = tasksForSelectedDate.find((task) => {
        const overLapCheck =
          startTime < task.endTime && endTime > task.startTime;

        if (overLapCheck) {
          if (startTime < task.endTime) startTime = task.endTime;
          // return false; // Stop looping and return this task
        }
        return false;
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
      updateTask(updatedTask.id, dateKey, updatedTask);
    },
    [tasksForSelectedDate, updateTask, dateKey]
  );

  const handleCalendarDrop = () => {
    lastScrollPositionRef.current = scrollableContainerRef.current.scrollTop;
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
      />
    </div>
  );
}

export default App;
