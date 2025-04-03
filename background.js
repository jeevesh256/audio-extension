let mediaRecorder = null;
let audioChunks = [];
let recordingStream = null;
let audioContext = null;
let isRecording = false;
let recordingStartTime = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startRecording') {
    if (!isRecording) {
      startRecording();
    }
  } else if (message.action === 'stopRecording') {
    stopRecording();
  } else if (message.action === 'getState') {
    sendResponse({
      isRecording: isRecording,
      startTime: recordingStartTime,
      error: null
    });
  }
  return true;
});

function startRecording() {
  console.log('Starting recording...');
  recordingStartTime = Date.now();
  
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs || tabs.length === 0) {
      chrome.runtime.sendMessage({ 
        status: 'error', 
        error: 'No active tab found'
      });
      return;
    }
    
    console.log('Found active tab:', tabs[0].id);

    chrome.tabCapture.capture({
      audio: true,
      video: false
    }, function(stream) {
      if (!stream) {
        chrome.runtime.sendMessage({ 
          status: 'error', 
          error: 'Failed to capture tab audio. Please ensure you are on a webpage.'
        });
        return;
      }
      console.log('Stream captured successfully');

      // Create audio context and connect stream to speakers
      audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(audioContext.destination); // Route to speakers

      recordingStream = stream;
      
      // Initialize WAV recorder instead of MediaRecorder
      mediaRecorder = new WavRecorder(stream, (blob) => {
        const url = URL.createObjectURL(blob);
        chrome.runtime.sendMessage({ 
          status: 'stopped',
          audioUrl: url
        });
        cleanup();
      });
      
      audioChunks = [];
      isRecording = true;

      mediaRecorder.start();
      console.log('WAV Recorder started');
      chrome.runtime.sendMessage({ status: 'recording' });
    });
  });
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    console.log('Stopping recording...');
    isRecording = false;
    recordingStartTime = null;
    mediaRecorder.stop();
  }
}

function cleanup() {
  if (recordingStream) {
    recordingStream.getTracks().forEach(track => track.stop());
    recordingStream = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
}
