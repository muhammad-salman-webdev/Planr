import { format, isToday, parseISO } from "date-fns"; // Added imports

// Define Task interface for how it's stored and passed (ISO strings for dates)
interface Task {
  id: string;
  title: string;
  description?: string;
  startTime: string; // Changed to string (ISO date string)
  endTime: string; // Changed to string (ISO date string)
  color?: string; // Added color based on App.tsx usage
  notificationsEnabled?: boolean;
}

interface AllTasks {
  [dateKey: string]: Task[];
}

const ALARM_NAME = "taskNotificationAlarm";

// Define Google OAuth constants here, as the flow is now initiated in background
const GOOGLE_CLIENT_ID =
  "815584967222-p4c0isjf3pabp14eb3jfdar331hrm6gv.apps.googleusercontent.com"; // Client ID
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

// Helper to get all tasks from storage
async function getAllTasks(): Promise<AllTasks> {
  return new Promise((resolve) => {
    chrome.storage.sync.get("tasks", (result) => {
      const allTasks: AllTasks = {};
      try {
        const tasksByDate = result.tasks;
        if (tasksByDate) {
          for (const date in tasksByDate) {
            // Tasks are stored with ISO strings, so no conversion needed here
            // unless the background script itself needs Date objects for other logic.
            allTasks[date] = tasksByDate[date];
          }
        }
      } catch (e) {
        console.error("Error parsing tasks from storage:", e);
      }
      resolve(allTasks);
    });
  });
}

// Helper to add tasks to storage, merging with existing ones and preventing duplicates
async function addTasksToStorage(
  newTasks: Task[],
  defaultNotificationSetting: boolean
) {
  const existingTasks = await getAllTasks();
  const updatedTasksByDate: AllTasks = { ...existingTasks };

  newTasks.forEach((newTask) => {
    // Ensure task has notificationsEnabled if it's missing (important for Google events)
    const taskToAdd: Task = {
      ...newTask,
      notificationsEnabled:
        newTask.notificationsEnabled !== undefined
          ? newTask.notificationsEnabled
          : defaultNotificationSetting,
    };

    // Extract date key from ISO string startTime
    const dateKey = new Date(taskToAdd.startTime).toISOString().split("T")[0]; // Format as YYYY-MM-DD
    if (!updatedTasksByDate[dateKey]) {
      updatedTasksByDate[dateKey] = [];
    }
    // Avoid adding the same Google event multiple times by checking ID
    if (!updatedTasksByDate[dateKey].some((t) => t.id === taskToAdd.id)) {
      updatedTasksByDate[dateKey].push(taskToAdd);
    }
  });

  await chrome.storage.sync.set({ tasks: updatedTasksByDate });
  console.log("Background: Tasks updated in storage after import.");
}

// Helper to get default notification setting from storage
async function getDefaultNotificationSetting(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.sync.get("defaultNotificationSetting", (result) => {
      // Default to true if not set in storage
      resolve(
        result.defaultNotificationSetting !== undefined
          ? result.defaultNotificationSetting
          : true
      );
    });
  });
}

async function getNotificationMinutesBefore(): Promise<number> {
  return new Promise((resolve) => {
    chrome.storage?.sync?.get(["notificationMinutesBefore"], (result) => {
      const storedValue = result.notificationMinutesBefore;
      resolve(storedValue === undefined ? 5 : Number(storedValue)); // Default to 5 if not set
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
    console.warn("Background: Notifications denied by user.");
    return false;
  }
  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch (error) {
    console.error("Background: Notification permission error:", error);
    return false;
  }
}

async function cleanupOffscreenDocuments() {
  try {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType],
    });
    const audioOffscreenContext = contexts.find(
      (context) => context.url === chrome.runtime.getURL("offscreen.html")
    );
    if (audioOffscreenContext) {
      await chrome.offscreen.closeDocument();
      console.log("Background: Closed existing offscreen document.");
    }
  } catch (error) {
    console.error("Background: Error cleaning offscreen documents:", error);
  }
}

async function createOffscreenDocumentForSound() {
  try {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType],
      documentUrls: [chrome.runtime.getURL("offscreen.html")],
    });
    if (contexts.length > 0) {
      console.log("Background: Offscreen document for sound already exists.");
      return;
    }

    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL("offscreen.html"),
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: "Play notification sound for task reminder.",
    });
    console.log("Background: Created offscreen document for sound.");
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("document already exists")
    ) {
      console.warn(
        "Background: Offscreen document already exists. Skipping creation."
      );
    } else {
      console.error("Background: Error creating offscreen document:", error);
    }
  }
}

async function showChromeNotification(
  title: string,
  message: string,
  notificationId: string
) {
  const iconUrl = chrome.runtime.getURL("icons/icon48.png"); // Ensure this path is correct
  try {
    await chrome.notifications.create(notificationId, {
      type: "basic",
      iconUrl,
      title,
      message,
      priority: 2,
    });
    console.log(`Background: Notification "${notificationId}" created.`);
  } catch (error) {
    console.error(
      `Background: Error creating notification "${notificationId}":`,
      error
    );
  }
}

async function checkAndSendNotifications() {
  const hasPermission = await ensureNotificationPermissions();
  if (!hasPermission) {
    console.warn(
      "Background: Notification permissions not granted. Cannot send notifications."
    );
    return;
  }

  const allTasks = await getAllTasks();
  const notificationMinutes = await getNotificationMinutesBefore();
  const now = new Date();
  const leadTimeMs = notificationMinutes * 60 * 1000;
  const mute = await getMuteNotification();

  // Get the date key for today
  const todayKey = format(now, "yyyy-MM-dd"); // Use date-fns for consistent formatting

  // Only consider tasks for today's date
  const tasksForToday = allTasks[todayKey] || [];

  for (const task of tasksForToday) {
    // ONLY ITERATE TASKS FOR TODAY
    if (task.notificationsEnabled) {
      // Convert ISO string to Date object for comparison
      const startTime = parseISO(task.startTime); // Use parseISO for reliability
      const notificationTime = new Date(startTime.getTime() - leadTimeMs);
      const notificationShownKey = `bg_notification_sent_${task.id}`;

      // Condition: Current time is between notification time and task start time
      if (now >= notificationTime && now < startTime) {
        // Explicitly check that notificationTime is on the same day as now
        const isNotificationTimeToday = isToday(notificationTime);

        if (!isNotificationTimeToday) {
          console.log(
            `Background: Skipping notification for task ${task.id} as its notification time (${notificationTime}) is not today.`
          );
          continue; // Skip if notification time isn't today
        }

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
            const soundPath = chrome.runtime.getURL("sounds/cat.wav"); // Ensure this path is correct
            chrome.runtime
              .sendMessage({
                type: "playSoundInOffscreen",
                soundUrl: soundPath,
              })
              .catch((error) =>
                console.error(
                  "Background: Error sending playSoundInOffscreen message for alarm:",
                  error
                )
              );
          }

          chrome.storage.session
            .set({ [notificationShownKey]: true })
            .catch((error) =>
              console.error(
                "Background: Error setting session storage for notification:",
                error
              )
            );
        }
      } else {
        // Clear notificationShownKey if a task's notification window has passed
        const alreadySent = await new Promise<boolean>((resolve) => {
          chrome.storage.session.get([notificationShownKey], (result) => {
            resolve(!!result[notificationShownKey]);
          });
        });
        // If notification was sent and task has already started (or passed its notification window for today)
        if (alreadySent && now >= startTime) {
          chrome.storage.session
            .remove(notificationShownKey)
            .catch((error) =>
              console.error(
                "Background: Error removing session storage for past notification:",
                error
              )
            );
        }
      }
    }
  }
}

// --- NEW: fetchCalendarEvents (moved from App.tsx) ---
const fetchCalendarEvents = async (accessToken: string) => {
  try {
    // Get default notification setting from storage for new tasks
    const defaultNotificationSetting = await getDefaultNotificationSetting();

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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Google Calendar API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const googleEvents = await response.json();
    console.log("Background: Raw Google Events API response:", googleEvents);

    if (!googleEvents.items || googleEvents.items.length === 0) {
      console.warn("Background: No Google Calendar items found for import.");
      return [];
    }

    const colorMap = await getGoogleColorMap();

    const now = new Date();
    // Fetch events for current month (or a wider range if you prefer)
    // For now, retaining the logic to fetch for current month based on your provided code.
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const tasksToProcessAndSave: Task[] = googleEvents.items
      .map((event: any) => {
        // Using 'any' for Google event structure, consider stronger typing
        const rawStart = event.start?.dateTime || event.start?.date;
        const rawEnd = event.end?.dateTime || event.end?.date;

        if (!rawStart || !rawEnd) return null; // Skip if no valid times

        const start = new Date(rawStart);
        const end = new Date(rawEnd);

        // Only add tasks from the current month (or adjust range as needed)
        // This filter is applied when importing, not when checking for notifications.
        if (start < firstOfMonth || start >= firstOfNextMonth) return null;

        return {
          id: event.id || crypto.randomUUID(),
          title: event.summary || "Untitled Event",
          description: event.description || "",
          startTime: start.toISOString(), // Convert to ISO string for storage/messaging
          endTime: end.toISOString(), // Convert to ISO string for storage/messaging
          color: colorMap[event.colorId]?.background || "#3399FF",
          notificationsEnabled: defaultNotificationSetting, // Use default from storage
        };
      })
      .filter(Boolean) as Task[]; // Filter out nulls and assert type

    await addTasksToStorage(tasksToProcessAndSave, defaultNotificationSetting); // Add/merge with existing tasks in storage
    return tasksToProcessAndSave; // Return the fetched tasks
  } catch (error: any) {
    console.error("Background: Error fetching Google Calendar events:", error);
    throw error; // Re-throw to be caught by the message sender
  }
};

// --- NEW: Listener for Google OAuth initiation from popup ---
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === "initiateGoogleOAuth") {
    console.log("Background: Received initiateGoogleOAuth message from popup.");
    // Acknowledge receipt immediately to the popup so it can update its UI (e.g., show loading)
    // This is important because the OAuth flow itself can take time.
    sendResponse({ status: "acknowledged", message: "OAuth flow initiated." });

    try {
      // Inform popup that auth process has started
      // Using chrome.runtime.sendMessage here because the original sendResponse
      // has already been called to acknowledge the initial request.
      // This allows for continuous status updates.
      chrome.runtime
        .sendMessage({ action: "importProcessStarted" })
        .catch((e) =>
          console.warn("Could not send importProcessStarted message:", e)
        );

      const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org/`;
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "token",
        scope: GOOGLE_SCOPE,
        access_type: "online",
        prompt: "consent",
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

      const redirectUrl = await new Promise<string | undefined>(
        (resolve, reject) => {
          chrome.identity.launchWebAuthFlow(
            {
              url: authUrl,
              interactive: true,
            },
            (url) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(url);
              }
            }
          );
        }
      );

      if (!redirectUrl) {
        throw new Error("OAuth flow did not return a redirect URL.");
      }

      const url = new URL(redirectUrl);
      const hashParams = new URLSearchParams(url.hash.slice(1));
      const accessToken = hashParams.get("access_token");

      if (!accessToken) {
        throw new Error(
          "Access token not found in redirect URL. This usually means the user denied access or there was an issue with the redirect_uri/client_id."
        );
      }

      console.log(
        "Background: Access Token received, proceeding to fetch events..."
      );
      chrome.runtime
        .sendMessage({ action: "importFetchingData" })
        .catch((e) =>
          console.warn("Could not send importFetchingData message:", e)
        );

      // Fetch calendar events using the token
      const fetchedTasks = await fetchCalendarEvents(accessToken);

      // Send success message back to the popup with the data
      chrome.runtime
        .sendMessage({
          action: "googleEventsFetched",
          status: "success",
          tasks: fetchedTasks,
        })
        .catch((e) =>
          console.warn("Could not send googleEventsFetched success message:", e)
        );
    } catch (error: any) {
      console.error("Background: OAuth or event fetch failed:", error.message);
      // Send error message back to the popup
      chrome.runtime
        .sendMessage({
          action: "googleEventsFetched",
          status: "error",
          message: error.message,
        })
        .catch((e) =>
          console.warn("Could not send googleEventsFetched error message:", e)
        );
    }
  }

  // Existing message handlers below this point
  if (message.playSound) {
    console.warn(
      "Background: Received old 'playSound' message. This should now be handled by offscreen.js if sound playback is needed."
    );
    sendResponse(false); // Acknowledge with false if this is an old/deprecated message
    return true; // Needed because sendResponse is used
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
          const soundPath = chrome.runtime.getURL("sounds/cat.wav");
          chrome.runtime
            .sendMessage({ type: "playSoundInOffscreen", soundUrl: soundPath })
            .catch((error) =>
              console.error(
                "Background: Error sending playSoundInOffscreen message for test notification:",
                error
              )
            );
        }
        sendResponse(true); // Acknowledge success
      } catch (error) {
        console.error("Background: Error sending test notification:", error);
        sendResponse(false); // Acknowledge failure
      }
    })();
    return true; // Keep channel open for async response
  }
  // For messages not handled by any specific condition, return false
  return false;
});

// Replaced setInterval with chrome.alarms for better Service Worker lifecycle management
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    console.log("Background: Alarm triggered: checkAndSendNotifications");
    checkAndSendNotifications();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log(
    "Background: Extension installed. Setting up notification alarm."
  );
  // Ensure the alarm is created/updated on install
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 }); // Check every minute
  checkAndSendNotifications(); // Initial check
});

chrome.runtime.onStartup.addListener(() => {
  console.log("Background: Extension started. Setting up notification alarm.");
  // Ensure the alarm is created/updated on browser startup
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
  checkAndSendNotifications(); // Initial check
});

chrome.runtime.onSuspend.addListener(() => {
  console.log("Background script suspending. Cleaning up offscreen documents.");
  cleanupOffscreenDocuments();
});

console.log("Background script loaded.");
