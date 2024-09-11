let mediaRecorder;
let audioStream;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request === "startCapture") {
    startCapture(sendResponse);
    return true; // Indicates that we will send a response asynchronously
  } else if (request === "stopCapture") {
    stopCapture(sendResponse);
    return true; // Indicates that we will send a response asynchronously
  }
});

function startCapture(sendResponse) {
  chrome.tabCapture.capture({ audio: true }, (stream) => {
    if (!stream) {
      console.error("Failed to capture audio");
      sendResponse({ status: "error", message: "Failed to capture audio" });
      return;
    }
    audioStream = stream;
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      const blob = new Blob([event.data], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({
        url: url,
        filename: `audio_${Date.now()}.wav`,
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError.message);
          sendResponse({ status: "error", message: chrome.runtime.lastError.message });
        } else {
          sendResponse({ status: "success", message: "Recording saved" });
        }
      });
    };

    mediaRecorder.start();
    sendResponse({ status: "started" });
  });
}

function stopCapture(sendResponse) {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.onstop = () => {
      sendResponse({ status: "stopped" });
    };
    mediaRecorder.stop();
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
    }
  } else {
    console.error("No recording in progress to stop");
    sendResponse({ status: "error", message: "No recording in progress to stop" });
  }
}