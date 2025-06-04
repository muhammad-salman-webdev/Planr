import { useEffect } from 'react';

type Task = {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  notificationsEnabled?: boolean;
};

export default function useNotifications({
  tasksForSelectedDate,
  notificationMinutesBefore,
  appIcon
}: {
  tasksForSelectedDate: Task[];
  notificationMinutesBefore: number;
  appIcon: string;
}) {
  useEffect(() => {
    // Request notification permissions when the hook is first used
    const requestPermission = async () => {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    };
    requestPermission();
  }, [tasksForSelectedDate, notificationMinutesBefore, appIcon]);
}
