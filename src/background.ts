interface Task {
  id: string;
  title: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  notificationsEnabled?: boolean;
  // Add other task properties as needed
}

interface AllTasks {
  [dateKey: string]: Task[];
}

const ALARM_NAME = 'taskNotificationAlarm';

// Function to get all tasks from storage
async function getAllTasks(): Promise<AllTasks> {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (result) => {
      const allTasks: AllTasks = {};
      for (const key in result) {
        if (key.match(/^\d{4}-\d{2}-\d{2}$/)) { // Check if the key is a date string
          try {
            const tasks = JSON.parse(result[key]);
            // Ensure task times are proper Date objects
            allTasks[key] = tasks.map((task: any) => ({
              ...task,
              startTime: new Date(task.startTime),
              endTime: new Date(task.endTime),
            }));
          } catch (e) {
            console.error(`Error parsing tasks for key ${key}:`, e);
            allTasks[key] = [];
          }
        }
      }
      resolve(allTasks);
    });
  });
}

// Function to get notification settings
async function getNotificationMinutesBefore(): Promise<number> {
  return new Promise((resolve) => {
    chrome.storage.local.get('notificationMinutesBefore', (result) => {
      resolve(result.notificationMinutesBefore ? Number(result.notificationMinutesBefore) : 5);
    });
  });
}

// Helper to get mute setting
async function getMuteNotification(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get('muteNotification', (result) => {
      resolve(!!result.muteNotification);
    });
  });
}

// Function to check and request notification permissions
async function ensureNotificationPermissions(): Promise<boolean> {
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission === 'denied') {
    console.warn('Notifications are denied by the user');
    return false;
  }
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

// Function to cleanup offscreen documents
async function cleanupOffscreenDocuments() {
  try {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType]
    });
    
    if (contexts && contexts.length > 0) {
      await chrome.offscreen.closeDocument();
    }
  } catch (error) {
    console.error('Error cleaning up offscreen documents:', error);
  }
}

// Helper to create offscreen document for sound
async function createOffscreenDocumentForSound() {
  try {
    await cleanupOffscreenDocuments();
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: 'Play notification sound for task reminder.'
    });
  } catch (error) {
    console.error('Error creating offscreen document:', error);
  }
}

// NEW function to show notification using chrome.notifications API
async function showChromeNotification(title: string, message: string, notificationId: string) {
  const iconUrl = chrome.runtime.getURL("icons/icon48.png");
  try {
    await chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: iconUrl,
      title: title,
      message: message,
      priority: 2,
    });
    console.log(`Chrome Notification "${notificationId}" created.`);
  } catch (error) {
    console.error(`Error creating chrome notification "${notificationId}":`, error);
  }
}

async function checkAndSendNotifications() {
  const hasPermission = await ensureNotificationPermissions();
  if (!hasPermission) {
    console.warn('Notification permissions not granted for chrome.notifications');
    return;
  }

  const allTasks = await getAllTasks();
  const notificationMinutes = await getNotificationMinutesBefore();
  const now = new Date();
  const leadTimeMs = notificationMinutes * 60 * 1000;
  const mute = await getMuteNotification();

  for (const dateKey in allTasks) {
    const tasks = allTasks[dateKey];
    tasks.forEach(async task => { // Make sure this callback is async if using await inside
      if (task.notificationsEnabled) {
        const startTime = new Date(task.startTime);
        const notificationTime = new Date(startTime.getTime() - leadTimeMs);
        const notificationShownKey = `bg_notification_sent_${task.id}`; // Use a consistent key

        // console.log(`Checking task: ${task.title}, Notification Time: ${notificationTime}, Current Time: ${now}`);

        if (now >= notificationTime && now < startTime) {
          chrome.storage.session.get([notificationShownKey], async (result) => {
            if (!result[notificationShownKey]) {
              console.log(`Triggering Chrome notification for task: ${task.title}`);
              const message = `Task "${task.title}" is starting in ${notificationMinutes} minutes.`;
              await showChromeNotification(task.title, message, `task_reminder_${task.id}`);

              if (!mute) {
                await createOffscreenDocumentForSound();
                chrome.runtime.sendMessage({ playSound: true });
              }

              chrome.storage.session.set({ [notificationShownKey]: true });
            } else {
              // console.log(`Chrome Notification already sent for task: ${task.title}`);
            }
          });
        }
      }
    });
  }
}

// Listener for when the alarm goes off
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    checkAndSendNotifications();
  }
});

// Create the alarm when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 1, // Start checking after 1 minute
    periodInMinutes: 1 // Check every 1 minute
  });
  console.log('Background: Alarm created.');
  checkAndSendNotifications(); // Initial check
});

// Optional: Listener for when the browser starts up
chrome.runtime.onStartup.addListener(() => {
  console.log('Background: Extension started up.');
  checkAndSendNotifications(); // Check on startup
  // Ensure alarm is still set (it should persist, but good to double-check or re-create if needed)
  chrome.alarms.get(ALARM_NAME, (alarm) => {
    if (!alarm) {
      chrome.alarms.create(ALARM_NAME, {
        delayInMinutes: 1,
        periodInMinutes: 1
      });
    }
  });
});

// Message listener for playing sound
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.playSound) {
    console.log('Background: playSound message received');
    try {
      const audio = new Audio(chrome.runtime.getURL('sounds/cat.wav'));
      audio.play().catch(error => {
        console.error('Error playing sound:', error);
      });
    } catch (error) {
      console.error('Error creating Audio object:', error);
    }
    sendResponse(true);
  }
  if (message.testNotification) {
    console.log('Background: testNotification message received');
    (async () => {
      try {
        const mute = await getMuteNotification();
        console.log('Notification mute status:', mute);
        
        console.log('Starting 3 second delay...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('Delay complete, showing Chrome notification...');

        // Show Chrome notification
        await showChromeNotification('Test Notification', 'This is a test notification!', `test_notification_${Date.now()}`);

        if (!mute) {
          console.log('Playing notification sound...');
          await createOffscreenDocumentForSound();
          chrome.runtime.sendMessage({ playSound: true });
        }
        
        sendResponse(true);
      } catch (error) {
        console.error('Error sending test notification:', error);
        sendResponse(false);
      }
    })();
    return true; // Keep the message channel open for async
  }
});

// Cleanup on unload
chrome.runtime.onSuspend.addListener(() => {
  cleanupOffscreenDocuments();
});

console.log('Background script loaded.');
