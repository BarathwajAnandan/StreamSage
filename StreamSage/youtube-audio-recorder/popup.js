document.addEventListener('DOMContentLoaded', function() {
    displayStatus();
  
    document.getElementById('startBtn').addEventListener('click', () => {
      chrome.runtime.sendMessage("startCapture");
      displayStatus();
    });
  
    document.getElementById('stopBtn').addEventListener('click', () => {
      chrome.runtime.sendMessage("stopCapture");
      displayStatus();
    });
  });
  
  function displayStatus() {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      const status = document.getElementById("status");
      const startButton = document.getElementById('startBtn');
      const stopButton = document.getElementById('stopBtn');
  
      chrome.runtime.sendMessage({currentTab: tabs[0].id}, (response) => {
        if (response) {
          status.textContent = "Tab is currently being captured";
          startButton.disabled = true;
          stopButton.disabled = false;
        } else {
          status.textContent = "Ready to record";
          startButton.disabled = false;
          stopButton.disabled = true;
        }
      });
    });
  }