// interface Task {
//   id: string;
//   title: string;
//   startTime: Date; // Changed to Date for internal use
//   endTime: Date; // Changed to Date for internal use
//   notificationsEnabled?: boolean;
//   // Add other task properties as needed
// }

// interface AllTasks {
//   [dateKey: string]: Task[];
// }

// const ALARM_NAME = "taskNotificationAlarm";

// async function getAllTasks(): Promise<AllTasks> {
//   return new Promise((resolve) => {
//     chrome.storage.sync.get("tasks", (result) => {
//       const allTasks: AllTasks = {};
//       try {
//         const tasksByDate = result.tasks;
//         for (const date in tasksByDate) {
//           allTasks[date] = tasksByDate[date].map((task: any) => ({
//             ...task,
//             startTime: new Date(task.startTime),
//             endTime: new Date(task.endTime),
//           }));
//         }
//       } catch (e) {
//         console.error("Error parsing tasks:", e);
//       }
//       resolve(allTasks);
//     });
//   });
// }

// async function getNotificationMinutesBefore(): Promise<number> {
//   return new Promise((resolve) => {
//     chrome.storage?.sync?.get(["notificationMinutesBefore"], (result) => {
//       const storedValue = result.notificationMinutesBefore;
//       resolve(storedValue);
//     });
//   });
// }

// async function getMuteNotification(): Promise<boolean> {
//   return new Promise((resolve) => {
//     chrome.storage.local.get("muteNotification", (result) => {
//       resolve(!!result.muteNotification);
//     });
//   });
// }

// async function ensureNotificationPermissions(): Promise<boolean> {
//   if (Notification.permission === "granted") return true;
//   if (Notification.permission === "denied") {
//     console.warn("Notifications denied by user.");
//     return false;
//   }
//   try {
//     const permission = await Notification.requestPermission();
//     return permission === "granted";
//   } catch (error) {
//     console.error("Notification permission error:", error);
//     return false;
//   }
// }

// async function cleanupOffscreenDocuments() {
//   try {
//     const contexts = await chrome.runtime.getContexts({
//       contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType],
//     });
//     if (contexts && contexts.length > 0) {
//       await chrome.offscreen.closeDocument();
//     }
//   } catch (error) {
//     console.error("Error cleaning offscreen documents:", error);
//   }
// }

// async function createOffscreenDocumentForSound() {
//   try {
//     await cleanupOffscreenDocuments();
//     await chrome.offscreen.createDocument({
//       url: chrome.runtime.getURL("offscreen.html"),
//       reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
//       justification: "Play notification sound for task reminder.",
//     });
//   } catch (error) {
//     console.error("Error creating offscreen document:", error);
//   }
// }

// async function showChromeNotification(
//   title: string,
//   message: string,
//   notificationId: string
// ) {
//   const iconUrl = chrome.runtime.getURL("icons/icon48.png");
//   try {
//     await chrome.notifications.create(notificationId, {
//       type: "basic",
//       iconUrl,
//       title,
//       message,
//       priority: 2,
//     });
//   } catch (error) {
//     console.error(`Error creating notification "${notificationId}":`, error);
//   }
// }

// async function checkAndSendNotifications() {
//   const hasPermission = await ensureNotificationPermissions();
//   if (!hasPermission) {
//     console.warn("Notification permissions not granted.");
//     return;
//   }

//   const allTasks = await getAllTasks();
//   const notificationMinutes = await getNotificationMinutesBefore();
//   const now = new Date();
//   const leadTimeMs = notificationMinutes * 60 * 1000;
//   const mute = await getMuteNotification();

//   for (const dateKey in allTasks) {
//     const tasks = allTasks[dateKey];
//     for (const task of tasks) {
//       if (task.notificationsEnabled) {
//         const startTime = task.startTime;
//         const notificationTime = new Date(startTime.getTime() - leadTimeMs);
//         const notificationShownKey = `bg_notification_sent_${task.id}`;

//         if (now >= notificationTime && now < startTime) {
//           // Use Promise wrapper for chrome.storage.session.get
//           const alreadySent = await new Promise<boolean>((resolve) => {
//             chrome.storage.session.get([notificationShownKey], (result) => {
//               resolve(!!result[notificationShownKey]);
//             });
//           });

//           if (!alreadySent) {
//             const message = `Task "${task.title}" is starting in ${notificationMinutes} minutes.`;
//             await showChromeNotification(
//               task.title,
//               message,
//               `task_reminder_${task.id}`
//             );

//             if (!mute) {
//               await createOffscreenDocumentForSound();
//               chrome.runtime.sendMessage({ playSound: true });
//             }

//             // Mark notification as sent in session storage
//             chrome.storage.session.set({ [notificationShownKey]: true });
//           }
//         }
//       }
//     }
//   }
// }

// chrome.alarms.onAlarm.addListener((alarm) => {
//   if (alarm.name === ALARM_NAME) {
//     checkAndSendNotifications();
//   }
// });

// // Remove chrome.alarms.create(ALARM_NAME, {...periodInMinutes: 1}) line or keep it for backup one-time check.
// chrome.runtime.onInstalled.addListener(() => {
//   console.log(
//     "Background: Extension installed. Starting notification check interval."
//   );
//   // Initial check once immediately
//   checkAndSendNotifications();

//   // Set interval to run check every 6 seconds (10 times per minute)
//   setInterval(() => {
//     checkAndSendNotifications();
//   }, 1000);
// });

// chrome.runtime.onStartup.addListener(() => {
//   console.log(
//     "Background: Extension started. Starting notification check interval."
//   );
//   checkAndSendNotifications();
//   setInterval(() => {
//     checkAndSendNotifications();
//   }, 1000);
// });

// chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
//   if (message.playSound) {
//     try {
//       const audio = new Audio(chrome.runtime.getURL("sounds/cat.wav"));
//       audio.play().catch(console.error);
//     } catch (error) {
//       console.error("Error playing sound:", error);
//     }
//     sendResponse(true);
//   }
//   if (message.testNotification) {
//     (async () => {
//       try {
//         const mute = await getMuteNotification();
//         await showChromeNotification(
//           "Test Notification",
//           "This is a test notification!",
//           `test_notification_${Date.now()}`
//         );

//         if (!mute) {
//           await createOffscreenDocumentForSound();
//           chrome.runtime.sendMessage({ playSound: true });
//         }
//         sendResponse(true);
//       } catch {
//         sendResponse(false);
//       }
//     })();
//     return true; // Keep channel open for async response
//   }
// });

// chrome.runtime.onSuspend.addListener(() => {
//   cleanupOffscreenDocuments();
// });

// console.log("Background script loaded.");

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
    // IMPORTANT: If your 'tasks' data can be large and was causing
    // "Resource::kQuotaBytesPerItem quota exceeded", you should use
    // chrome.storage.local here and in your `useTaskStore`.
    // Example: chrome.storage.local.get("tasks", (result) => {
    chrome.storage.sync.get("tasks", (result) => {
      // Consider changing this to chrome.storage.local.get
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
        console.error("Error parsing tasks from storage:", e);
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
    // Close only if an offscreen document for audio playback exists
    const audioOffscreenContext = contexts.find(
      (context) => context.url === chrome.runtime.getURL("offscreen.html")
    );
    if (audioOffscreenContext) {
      await chrome.offscreen.closeDocument();
      console.log("Closed existing offscreen document.");
    }
  } catch (error) {
    console.error("Error cleaning offscreen documents:", error);
  }
}

async function createOffscreenDocumentForSound() {
  try {
    // Check if an offscreen document already exists to avoid re-creating
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType],
      documentUrls: [chrome.runtime.getURL("offscreen.html")],
    });
    if (contexts.length > 0) {
      console.log("Offscreen document for sound already exists.");
      return; // Document already exists, no need to create
    }

    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL("offscreen.html"),
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: "Play notification sound for task reminder.",
    });
    console.log("Created offscreen document for sound.");
  } catch (error) {
    // If it's a "document already exists" error, just log it. Other errors should be reported.
    if (
      error instanceof Error &&
      error.message.includes("document already exists")
    ) {
      console.warn("Offscreen document already exists. Skipping creation.");
    } else {
      console.error("Error creating offscreen document:", error);
    }
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
    console.log(`Notification "${notificationId}" created.`);
  } catch (error) {
    console.error(`Error creating notification "${notificationId}":`, error);
  }
}

async function checkAndSendNotifications() {
  const hasPermission = await ensureNotificationPermissions();
  if (!hasPermission) {
    console.warn(
      "Notification permissions not granted. Cannot send notifications."
    );
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

        // Check if current time is within the notification window
        // and before the task start time to avoid repeated notifications
        if (now >= notificationTime && now < startTime) {
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
              // Send message to offscreen document to play sound
              chrome.runtime
                .sendMessage({ playSoundInOffscreen: true })
                .catch((error) =>
                  console.error(
                    "Error sending playSoundInOffscreen message:",
                    error
                  )
                );
            }

            // Mark notification as sent in session storage
            chrome.storage.session
              .set({ [notificationShownKey]: true })
              .catch((error) =>
                console.error(
                  "Error setting session storage for notification:",
                  error
                )
              );
          }
        }
      }
    }
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    console.log("Alarm triggered: checkAndSendNotifications");
    checkAndSendNotifications();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log(
    "Background: Extension installed. Starting notification check interval."
  );
  // Initial check once immediately
  checkAndSendNotifications();

  // It's generally better to use `chrome.alarms.create` for periodic tasks
  // in service workers, as setInterval might not be robust against service worker termination.
  // For frequent checks, setInterval might be okay, but alarms are more reliable.
  // If you want a 1-second interval, consider if you truly need that high frequency.
  // For notification checks, often 30-60 seconds is sufficient.
  setInterval(() => {
    checkAndSendNotifications();
  }, 1000); // 1 second interval
});

chrome.runtime.onStartup.addListener(() => {
  console.log(
    "Background: Extension started. Starting notification check interval."
  );
  checkAndSendNotifications();
  setInterval(() => {
    checkAndSendNotifications();
  }, 1000); // 1 second interval
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // IMPORTANT: The `new Audio()` call has been REMOVED from here.
  // The `playSound` message should now be handled exclusively by offscreen.js.
  if (message.playSound) {
    console.warn(
      "Received old 'playSound' message in background.js. This should now be handled by offscreen.js. No sound will be played from background script."
    );
    sendResponse(false); // Indicate that sound was not played from here
  }

  // This is for test notifications, which is fine to trigger from background.js
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
          chrome.runtime
            .sendMessage({ playSoundInOffscreen: true }) // Send new message
            .catch((error) =>
              console.error(
                "Error sending playSoundInOffscreen message for test notification:",
                error
              )
            );
        }
        sendResponse(true);
      } catch (error) {
        console.error("Error sending test notification:", error);
        sendResponse(false);
      }
    })();
    return true; // Keep channel open for async response
  }
});

chrome.runtime.onSuspend.addListener(() => {
  console.log("Background script suspending. Cleaning up offscreen documents.");
  cleanupOffscreenDocuments();
});

console.log("Background script loaded.");
