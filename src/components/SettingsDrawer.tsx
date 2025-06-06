import React, { useEffect, useState } from "react";
import { X } from "lucide-react";

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  temperatureUnit: "C" | "F";
  onToggleTemperatureUnit: () => void;
  defaultNotificationsEnabled: boolean;
  onToggleDefaultNotifications: () => void;
  notificationMinutesBefore: number;
  onNotificationMinutesBeforeChange: (minutes: number) => void;
}

const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  temperatureUnit,
  onToggleTemperatureUnit,
  defaultNotificationsEnabled,
  onToggleDefaultNotifications,
  notificationMinutesBefore,
  onNotificationMinutesBeforeChange,
}) => {
  const [muteNotification, setMuteNotification] = useState(false);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get("muteNotification", (result) => {
        setMuteNotification(!!result.muteNotification);
      });
    }
    setNotificationPermission(Notification.permission);
  }, [isOpen]);

  const handleMuteToggle = () => {
    const newMute = !muteNotification;
    setMuteNotification(newMute);
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.set({ muteNotification: newMute });
    }
  };

  const handleNotificationPermissionRequest = async () => {
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    }
  };

  const handleTestNotification = () => {
    if (notificationPermission !== "granted") {
      handleNotificationPermissionRequest();
      return;
    }
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({ testNotification: true });
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-40">
      <div
        className="absolute inset-0 bg-black opacity-50"
        onClick={onClose}></div>
      <div className="absolute left-0 top-0 h-full w-3/4 max-w-xs bg-white shadow-xl p-4 z-50">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="p-1">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Temperature Unit
            </label>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  if (temperatureUnit !== "C") onToggleTemperatureUnit();
                }}
                className={`px-3 py-1 rounded-md text-sm font-medium
                            ${
                              temperatureUnit === "C"
                                ? "bg-blue-500 text-white"
                                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                            }`}>
                Celsius (°C)
              </button>
              <button
                onClick={() => {
                  if (temperatureUnit !== "F") onToggleTemperatureUnit();
                }}
                className={`px-3 py-1 rounded-md text-sm font-medium
                            ${
                              temperatureUnit === "F"
                                ? "bg-blue-500 text-white"
                                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                            }`}>
                Fahrenheit (°F)
              </button>
            </div>
          </div>
          {/* New setting for default task notifications */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Task Notifications
            </label>
            <div className="flex items-center">
              <button
                onClick={onToggleDefaultNotifications}
                className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  defaultNotificationsEnabled ? "bg-blue-600" : "bg-gray-200"
                }`}>
                <span className="sr-only">Enable default notifications</span>
                <span
                  className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 ease-in-out ${
                    defaultNotificationsEnabled
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
              <span className="ml-2 text-sm text-gray-600">
                {defaultNotificationsEnabled ? "On" : "Off"}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Set whether new tasks have notifications enabled by default.
            </p>
          </div>
          {/* Notification lead time setting */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notification Lead Time
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min={1}
                max={120}
                value={notificationMinutesBefore}
                onChange={(e) =>
                  onNotificationMinutesBeforeChange(Number(e.target.value))
                }
                className="w-16 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <span className="text-sm text-gray-700">
                minutes before task starts
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Set how many minutes before a task starts to show a notification.
            </p>
          </div>
          {/* Mute notification sound setting */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mute Notification Sound
            </label>
            <div className="flex items-center">
              <button
                onClick={handleMuteToggle}
                className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  muteNotification ? "bg-blue-600" : "bg-gray-200"
                }`}>
                <span className="sr-only">Mute notification sound</span>
                <span
                  className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 ease-in-out ${
                    muteNotification ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className="ml-2 text-sm text-gray-600">
                {muteNotification ? "Muted" : "Unmuted"}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Mute or unmute the notification sound for reminders.
            </p>
          </div>
          {/* Test notification button */}
          <div>
            <button
              onClick={handleTestNotification}
              className="px-3 py-1 rounded-md bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors">
              Test Notification
            </button>
            {notificationPermission !== "granted" && (
              <p className="text-xs text-orange-500 mt-1">
                {notificationPermission === "denied"
                  ? "Notifications are blocked. Please enable them in your browser settings."
                  : "Please allow notifications when prompted."}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Tap to trigger a test notification (with sound, unless muted).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsDrawer;
