// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'showReminderBanner') {
    showNotification(message.title, message.minutes);
  }
});

function showNotification(title: string, minutes: number) {
  // Inject the notification iframe if it doesn't exist
  let iframe = document.getElementById('planr-notification-frame') as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'planr-notification-frame';
    iframe.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 400px;
      height: 100px;
      border: none;
      z-index: 2147483647;
      background: transparent;
    `;
    iframe.src = chrome.runtime.getURL('notification.html');
    document.body.appendChild(iframe);
  }

  // Wait for iframe to load and then show notification
  iframe.onload = () => {
    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'showNotification',
        title: 'Task Reminder',
        message: `${title} starts in ${minutes} minutes`
      }, '*');
    }
  };
}
