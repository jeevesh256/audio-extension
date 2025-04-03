document.addEventListener('DOMContentLoaded', () => {
  const recordButton = document.getElementById('recordButton');
  const downloadButton = document.getElementById('downloadButton');
  const status = document.getElementById('status');
  const autoSaveCheckbox = document.getElementById('autoSave');
  const savePrefixInput = document.getElementById('savePrefix');
  const formatSelect = document.getElementById('format');
  const saveModal = document.getElementById('saveModal');
  const saveButton = document.getElementById('saveButton');
  const discardButton = document.getElementById('discardButton');
  let isRecording = false;
  let recordingTimer = null;
  let startTime = null;
  let audioUrl = null;

  function updateTimer() {
    const elapsed = Date.now() - startTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const formattedTime = `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
    status.textContent = `Recording... ${formattedTime}`;
  }

  // Load preferences
  chrome.storage.sync.get({
    autoSave: false,
    savePrefix: 'recording_',
    format: 'webm'
  }, (items) => {
    autoSaveCheckbox.checked = items.autoSave;
    savePrefixInput.value = items.savePrefix;
    formatSelect.value = items.format;
  });

  // Save preferences
  function savePreferences() {
    chrome.storage.sync.set({
      autoSave: autoSaveCheckbox.checked,
      savePrefix: savePrefixInput.value,
      format: formatSelect.value
    });
  }

  autoSaveCheckbox.addEventListener('change', savePreferences);
  savePrefixInput.addEventListener('change', savePreferences);
  formatSelect.addEventListener('change', savePreferences);

  function showSaveDialog() {
    saveModal.style.display = 'block';
  }

  function hideSaveDialog() {
    saveModal.style.display = 'none';
  }

  recordButton.addEventListener('click', async () => {
    if (!isRecording) {
      try {
        console.log('Requesting recording start...');
        recordButton.disabled = true;
        status.textContent = 'Starting recording...';
        chrome.runtime.sendMessage({ action: 'startRecording' });
      } catch (err) {
        console.error('Recording error:', err);
        status.textContent = 'Error: ' + (err.message || 'Failed to start recording');
        recordButton.disabled = false;
      }
    } else {
      recordButton.disabled = true;
      status.textContent = 'Stopping...';
      chrome.runtime.sendMessage({ action: 'stopRecording' });
    }
  });

  downloadButton.addEventListener('click', () => {
    if (audioUrl) {
      chrome.downloads.download({
        url: audioUrl,
        filename: `recording_${new Date().toISOString()}.webm`
      });
    }
  });

  saveButton.addEventListener('click', () => {
    if (audioUrl) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const prefix = savePrefixInput.value || 'recording_';
      const format = formatSelect.value;
      chrome.downloads.download({
        url: audioUrl,
        filename: `${prefix}${timestamp}.${format}`
      });
    }
    hideSaveDialog();
  });

  discardButton.addEventListener('click', hideSaveDialog);

  chrome.runtime.onMessage.addListener((message) => {
    if (message.status === 'recording') {
      isRecording = true;
      audioUrl = null;
      recordButton.textContent = 'Stop Recording';
      recordButton.style.backgroundColor = '#dc3545';
      recordButton.disabled = false;
      downloadButton.disabled = true;
    } else if (message.status === 'stopped') {
      isRecording = false;
      clearInterval(recordingTimer);
      audioUrl = message.audioUrl;
      recordButton.textContent = 'Start Recording';
      recordButton.style.backgroundColor = '#4285f4';
      recordButton.disabled = false;
      downloadButton.disabled = false;
      status.textContent = 'Recording completed';
      
      if (autoSaveCheckbox.checked) {
        saveButton.click();
      } else {
        showSaveDialog();
      }
    } else if (message.status === 'error') {
      isRecording = false;
      clearInterval(recordingTimer);
      status.textContent = `Error: ${message.error}`;
      recordButton.textContent = 'Start Recording';
      recordButton.style.backgroundColor = '#4285f4';
      recordButton.disabled = false;
      downloadButton.disabled = true;
    }
  });

  // Check recording state when popup opens
  chrome.runtime.sendMessage({ action: 'getState' }, (response) => {
    if (response.isRecording) {
      isRecording = true;
      recordButton.textContent = 'Stop Recording';
      recordButton.style.backgroundColor = '#dc3545';
      downloadButton.disabled = true;
      // Use the background script's start time
      startTime = response.startTime;
      recordingTimer = setInterval(updateTimer, 1000);
      updateTimer(); // Update immediately
      status.textContent = 'Recording...';
    }
  });
});
