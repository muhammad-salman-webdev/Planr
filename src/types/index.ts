export interface Task {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  color?: string;
  notificationsEnabled?: boolean; 
}

export interface TimeSlot {
  hour: number;
  minute: number;
}

export interface TaskStore {
  tasks: Record<string, Task[]>; // Key is date in YYYY-MM-DD format
  defaultNotificationSetting: boolean; // Added
  setTasks: (tasks: Record<string, Task[]>) => void; // Added
  setDefaultNotificationSetting: (enabled: boolean) => void; // Added
  addTask: (task: Task) => void;
  updateTask: (taskId: string, date: string, updatedTask: Partial<Task>) => void;
  deleteTask: (taskId: string, date: string) => void;
  getTasksForDate: (date: string) => Task[];
}