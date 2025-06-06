interface Task {
  id: string;
  title: string;
  startTime: Date; // Changed to Date for internal use
  endTime: Date; // Changed to Date for internal use
  notificationsEnabled?: boolean;
  // Add other task properties as needed
}

interface AllTasks {
  [dateKey: string]: Task[];
}

const ALARM_NAME = "taskNotificationAlarm";

async function getAllTasks(): Promise<AllTasks> {
  return new Promise((resolve) => {
    chrome.storage.sync.get("tasks", (result) => {
      const allTasks: AllTasks = {};
      try {
        const tasksByDate = result.tasks;
        for (const date in tasksByDate) {
          allTasks[date] = tasksByDate[date].map((task: any) => ({
            ...task,
            startTime: new Date(task.startTime),
            endTime: new Date(task.endTime),
          }));
        }
      } catch (e) {
        console.error("Error parsing tasks:", e);
      }
      resolve(allTasks);
    });
  });
}

async function getNotificationMinutesBefore(): Promise<number> {
  return new Promise((resolve) => {
    chrome.storage?.sync?.get(["notificationMinutesBefore"], (result) => {
      const storedValue = result.notificationMinutesBefore;
      resolve(storedValue);
    });
  });
}

async function getMuteNotification(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get("muteNotification", (result) => {
      resolve(!!result.muteNotification);
    });
  });
}

async function ensureNotificationPermissions(): Promise<boolean> {
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") {
    console.warn("Notifications denied by user.");
    return false;
  }
  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch (error) {
    console.error("Notification permission error:", error);
    return false;
  }
}

async function cleanupOffscreenDocuments() {
  try {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType],
    });
    if (contexts && contexts.length > 0) {
      await chrome.offscreen.closeDocument();
    }
  } catch (error) {
    console.error("Error cleaning offscreen documents:", error);
  }
}

async function createOffscreenDocumentForSound() {
  try {
    await cleanupOffscreenDocuments();
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL("offscreen.html"),
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: "Play notification sound for task reminder.",
    });
  } catch (error) {
    console.error("Error creating offscreen document:", error);
  }
}

async function showChromeNotification(
  title: string,
  message: string,
  notificationId: string
) {
  const iconUrl = chrome.runtime.getURL("icons/icon48.png");
  try {
    await chrome.notifications.create(notificationId, {
      type: "basic",
      iconUrl,
      title,
      message,
      priority: 2,
    });
  } catch (error) {
    console.error(`Error creating notification "${notificationId}":`, error);
  }
}

async function checkAndSendNotifications() {
  const hasPermission = await ensureNotificationPermissions();
  if (!hasPermission) {
    console.warn("Notification permissions not granted.");
    return;
  }

  const allTasks = await getAllTasks();
  const notificationMinutes = await getNotificationMinutesBefore();
  const now = new Date();
  const leadTimeMs = notificationMinutes * 60 * 1000;
  const mute = await getMuteNotification();

  for (const dateKey in allTasks) {
    const tasks = allTasks[dateKey];
    for (const task of tasks) {
      if (task.notificationsEnabled) {
        const startTime = task.startTime;
        const notificationTime = new Date(startTime.getTime() - leadTimeMs);
        const notificationShownKey = `bg_notification_sent_${task.id}`;

        if (now >= notificationTime && now < startTime) {
          // Use Promise wrapper for chrome.storage.session.get
          const alreadySent = await new Promise<boolean>((resolve) => {
            chrome.storage.session.get([notificationShownKey], (result) => {
              resolve(!!result[notificationShownKey]);
            });
          });

          if (!alreadySent) {
            const message = `Task "${task.title}" is starting in ${notificationMinutes} minutes.`;
            await showChromeNotification(
              task.title,
              message,
              `task_reminder_${task.id}`
            );

            if (!mute) {
              await createOffscreenDocumentForSound();
              chrome.runtime.sendMessage({ playSound: true });
            }

            // Mark notification as sent in session storage
            chrome.storage.session.set({ [notificationShownKey]: true });
          }
        }
      }
    }
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    checkAndSendNotifications();
  }
});

// Remove chrome.alarms.create(ALARM_NAME, {...periodInMinutes: 1}) line or keep it for backup one-time check.
chrome.runtime.onInstalled.addListener(() => {
  console.log(
    "Background: Extension installed. Starting notification check interval."
  );
  // Initial check once immediately
  checkAndSendNotifications();

  // Set interval to run check every 6 seconds (10 times per minute)
  setInterval(() => {
    checkAndSendNotifications();
  }, 1000);
});

chrome.runtime.onStartup.addListener(() => {
  console.log(
    "Background: Extension started. Starting notification check interval."
  );
  checkAndSendNotifications();
  setInterval(() => {
    checkAndSendNotifications();
  }, 1000);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.playSound) {
    try {
      const audio = new Audio(chrome.runtime.getURL("sounds/cat.wav"));
      audio.play().catch(console.error);
    } catch (error) {
      console.error("Error playing sound:", error);
    }
    sendResponse(true);
  }
  if (message.testNotification) {
    (async () => {
      try {
        const mute = await getMuteNotification();
        await showChromeNotification(
          "Test Notification",
          "This is a test notification!",
          `test_notification_${Date.now()}`
        );

        if (!mute) {
          await createOffscreenDocumentForSound();
          chrome.runtime.sendMessage({ playSound: true });
        }
        sendResponse(true);
      } catch {
        sendResponse(false);
      }
    })();
    return true; // Keep channel open for async response
  }
});

chrome.runtime.onSuspend.addListener(() => {
  cleanupOffscreenDocuments();
});

console.log("Background script loaded.");
