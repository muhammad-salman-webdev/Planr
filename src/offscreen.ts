// offscreen.js
// This script runs in the offscreen document to play audio.

// Keep a reference to the audio element to prevent multiple instances or issues
let audio: HTMLAudioElement | null = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Offscreen document received message:", message);

  // Check if the message has the correct type and a valid soundUrl
  if (
    message.type === "playSoundInOffscreen" &&
    typeof message.soundUrl === "string" &&
    message.soundUrl.length > 0
  ) {
    try {
      if (audio) {
        audio.pause(); // Stop any currently playing audio
        audio.currentTime = 0; // Reset playback to the beginning
      }
      audio = new Audio(message.soundUrl);
      audio
        .play()
        .then(() => {
          console.log("Offscreen: Audio played successfully.");
          // No need to send a response back for this message, as the background script doesn't expect one.
        })
        .catch((error) => {
          console.error("Offscreen: Error playing audio:", error);
          // No need to send a response back
        });
    } catch (error) {
      console.error(
        "Offscreen: Unexpected error creating/playing audio:",
        error
      );
    }
  } else {
    // Log problematic messages that don't match the expected format
    console.warn(
      "Offscreen document received message with incorrect type or missing soundUrl:",
      message
    );
  }

  // IMPORTANT: Do NOT return true if you are NOT going to call sendResponse.
  // This listener does not send a response back to the background script.
  // The background script sends a 'fire-and-forget' message to play sound.
  // So, explicitly return false or don't return anything.
  return false;
});

console.log("Offscreen document script loaded.");
