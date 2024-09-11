chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "audioReady") {
      const audio = document.getElementById('recordedAudio');
      audio.src = message.audioUrl;
    }
  });
  