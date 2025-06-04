import { create } from 'zustand';
import { format } from 'date-fns';
import { Task, TaskStore } from '../types';

// Helper to format dates for storage keys
const formatDateKey = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

// Helper to convert task dates from strings to Date objects
const hydrateTaskDates = (task: Task): Task => {
  try {
    return {
      ...task,
      startTime: new Date(task.startTime),
      endTime: new Date(task.endTime)
    };
  } catch (error) {
    console.error('Error hydrating task dates:', error);
    // Return a fallback task with current time if date parsing fails
    const now = new Date();
    return {
      ...task,
      startTime: now,
      endTime: new Date(now.getTime() + 60 * 60 * 1000) // 1 hour later
    };
  }
};

// Helper to serialize tasks for storage
const serializeTasks = (tasks: Record<string, Task[]>): Record<string, any[]> => {
  const serializedTasks: Record<string, any[]> = {};
  for (const [date, taskList] of Object.entries(tasks)) {
    serializedTasks[date] = taskList.map(task => ({
      ...task,
      startTime: task.startTime.toISOString(),
      endTime: task.endTime.toISOString()
    }));
  }
  return serializedTasks;
};

// Helper to save to Chrome storage
const saveToStorage = (tasks: Record<string, Task[]>) => {
  const serializedTasks = serializeTasks(tasks);
  chrome.storage?.sync?.set({ tasks: serializedTasks }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error saving to storage:', chrome.runtime.lastError);
    }
  });
};

// Helper to hydrate all tasks in a record
const hydrateTasks = (tasks: Record<string, Task[]>): Record<string, Task[]> => {
  const hydratedTasks: Record<string, Task[]> = {};
  for (const [date, taskList] of Object.entries(tasks)) {
    hydratedTasks[date] = taskList.map(hydrateTaskDates);
  }
  return hydratedTasks;
};

// Create the store
const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: {},
  defaultNotificationSetting: false, // Added default notification setting

  setTasks: (tasks: Record<string, Task[]>) => {
    set({ tasks });
    saveToStorage(tasks);
  },

  setDefaultNotificationSetting: (enabled: boolean) => { // Added setter for default notification
    set({ defaultNotificationSetting: enabled });
    // Optionally, save this to localStorage or chrome.storage as a user preference
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.set({ defaultNotificationSetting: enabled });
    } else {
      localStorage.setItem('defaultNotificationSetting', JSON.stringify(enabled));
    }
  },

  addTask: (task: Task) => {
    const dateKey = formatDateKey(task.startTime);
    const taskWithNotificationSetting = {
      ...task,
      notificationsEnabled: task.notificationsEnabled !== undefined
        ? task.notificationsEnabled
        : get().defaultNotificationSetting,
    };

    set((state) => {
      const tasksForDate = state.tasks[dateKey] || [];
      const updatedTasks = {
        ...state.tasks,
        [dateKey]: [...tasksForDate, taskWithNotificationSetting]
      };

      saveToStorage(updatedTasks);

      return { tasks: updatedTasks };
    });
  },

  updateTask: (taskId: string, date: string, updatedTask: Partial<Task>) => {
    set((state) => {
      const tasksForDate = state.tasks[date] || [];
      const updatedTasks = {
        ...state.tasks,
        [date]: tasksForDate.map(task => 
          task.id === taskId ? { ...task, ...updatedTask } : task
        )
      };
      
      // Save to Chrome storage if available
      saveToStorage(updatedTasks);
      
      return { tasks: updatedTasks };
    });
  },

  deleteTask: (taskId: string, date: string) => {
    set((state) => {
      const tasksForDate = state.tasks[date] || [];
      const updatedTasks = {
        ...state.tasks,
        [date]: tasksForDate.filter(task => task.id !== taskId)
      };
      
      // Save to Chrome storage if available
      saveToStorage(updatedTasks);
      
      return { tasks: updatedTasks };
    });
  },

  getTasksForDate: (date: string) => {
    const tasks = get().tasks[date] || [];
    return tasks.map(hydrateTaskDates); // Dates are hydrated here
  }
}));

// Initialize from Chrome storage if available
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.sync.get(['tasks', 'defaultNotificationSetting'], (result) => { // Load setting
    if (result.tasks) {
      useTaskStore.setState({ tasks: hydrateTasks(result.tasks) });
    }
    if (result.defaultNotificationSetting !== undefined) {
      useTaskStore.setState({ defaultNotificationSetting: result.defaultNotificationSetting });
    }
  });
} else {
  // Load from localStorage for development
  try {
    const savedTasks = localStorage.getItem('day-planner-tasks');
    if (savedTasks) {
      const parsedTasks = JSON.parse(savedTasks);
      useTaskStore.setState({ tasks: hydrateTasks(parsedTasks) });
    }
    const savedDefaultNotification = localStorage.getItem('defaultNotificationSetting');
    if (savedDefaultNotification) {
      useTaskStore.setState({ defaultNotificationSetting: JSON.parse(savedDefaultNotification) });
    }
  } catch (e) {
    console.error('Error loading from localStorage:', e);
  }
  
  // Subscribe to changes to save to localStorage
  useTaskStore.subscribe((state) => {
    localStorage.setItem('day-planner-tasks', JSON.stringify(serializeTasks(state.tasks)));
  });
}

export default useTaskStore;