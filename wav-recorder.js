class WavRecorder {
  constructor(stream, onDataAvailable) {
    this.stream = stream;
    this.onDataAvailable = onDataAvailable;
    this.audioContext = new AudioContext();
    this.chunks = [];
    this.state = 'inactive';
    
    // Create processing nodes
    this.source = this.audioContext.createMediaStreamSource(stream);
    this.processor = this.audioContext.createScriptProcessor(16384, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
      if (this.state === 'recording') {
        const channelData = e.inputBuffer.getChannelData(0);
        this.chunks.push(new Float32Array(channelData));
      }
    };
  }

  start() {
    this.chunks = [];
    this.state = 'recording';
    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  stop() {
    this.state = 'inactive';
    this.processor.disconnect();
    this.source.disconnect();
    
    // Convert to WAV
    const sampleRate = this.audioContext.sampleRate;
    const numChannels = 1;
    const dataLength = this.chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    
    // Create WAV buffer
    const buffer = new ArrayBuffer(44 + dataLength * 2);
    const view = new DataView(buffer);
    
    // Write WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength * 2, true);
    
    // Write audio data
    let offset = 44;
    for (const chunk of this.chunks) {
      for (let i = 0; i < chunk.length; i++) {
        const sample = Math.max(-1, Math.min(1, chunk[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    const blob = new Blob([buffer], { type: 'audio/wav' });
    this.onDataAvailable(blob);
  }
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
