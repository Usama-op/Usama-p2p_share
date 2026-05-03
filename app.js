// Liquid Glass P2P FileShare v2 - Fixed Buttons + Panels + Core Functionality
gsap.registerPlugin(Draggable);

class P2PFileShare {
  constructor() {
    this.db = null;
    this.localPeerId = null;
    this.currentMode = null;
    this.roomKey = null;
    this.audioContext = null;
    this.isMuted = false;
    this.transferSpeed = 3;
    this.pc = null;
    this.dc = null;
    this.iceCandidatesQueue = [];
    this.transferringFiles = new Map(); // To store File objects for potential re-sends
    this.receivedChunks = [];
    this.receivedChunksCount = 0;
    this.incomingFileInfo = null;
    this.receivedSize = 0;
    this.iceServers = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
    this.init();
  }

  init() {
    this.cacheElements();
    this.setupFirebase();
    this.setupAudio();
    this.bindEvents();
    this.updateTODOMarkdown();
    this.generateKey();
  }

  cacheElements() {
    this.els = {
      glass: document.getElementById('liquid-glass'),
      modeButtons: document.getElementById('mode-buttons'),
      senderPanel: document.getElementById('sender-panel'),
      receiverPanel: document.getElementById('receiver-panel'),
      muteIcon: document.getElementById('mute-icon'),
      muteBtn: document.getElementById('mute-btn'),
      roomKey: document.getElementById('room-key'),
      keyDisplay: document.getElementById('key-display'),
      fileInput: document.getElementById('file-input')
    };
  }

  setupFirebase() {
    // TODO: Replace with your Firebase config
    const firebaseConfig = {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_PROJECT.firebaseapp.com",
      databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
      projectId: "YOUR_PROJECT",
      storageBucket: "YOUR_PROJECT.appspot.com",
      messagingSenderId: "123456789",
      appId: "YOUR_APP_ID"
    };

    try {
      firebase.initializeApp(firebaseConfig);
      this.db = firebase.database();
      console.log('Firebase initialized');
    } catch (error) {
      console.error('Firebase init failed:', error);
    }
  }

  setupAudio() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  playLiquidGlassSound(frequency = 440) {
    if (this.isMuted || !this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.04);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.04);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    
    if (this.isMuted) {
      this.els.muteIcon.innerHTML = '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11c0 2.76-2.24 5-5 5-1.42 0-2.68-.44-3.5-1.17l-2.39 2.39 1.41 1.41 2.39-2.39c.91.73 2.08 1.17 3.5 1.17 3.04 0 5.5-2.46 5.5-5.5s-2.46-5.5-5.5-5.5-5.5 2.46-5.5 5.5H12z"/>';
      this.els.muteBtn.title = 'Unmute';
    } else {
      this.els.muteIcon.innerHTML = '<path d="M3 9v6h4l5 5V4L7 1v5H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>';
      this.els.muteBtn.title = 'Mute';
    }
    
    this.playLiquidGlassSound(this.isMuted ? 200 : 800); // Low tone for mute, high for unmute
  }

  bindEvents() {
    // Mute button
    document.getElementById('mute-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMute();
    });

    // Glass expand/collapse
    const glass = document.getElementById('liquid-glass');
    glass.addEventListener('click', (e) => {
      if (!glass.classList.contains('is-expanded') && e.target.closest('#mode-buttons') === null) {
        this.toggleExpand();
      }
    });

    // All mode/switch buttons (including panel nav)
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.glass-mode-link, .back-btn');
      if (!btn) return;

      e.stopPropagation();
      if (btn.dataset.mode) {
        const mode = btn.dataset.mode;
        this.switchMode(mode);
      } else if (btn.dataset.action === 'back') {
        this.goBack();
      }
    });

    // Other buttons (stubs)
    document.getElementById('generate-key-btn')?.addEventListener('click', () => this.generateKey());
    document.getElementById('copy-key-btn')?.addEventListener('click', () => this.copyKey());
    document.getElementById('join-key-btn')?.addEventListener('click', () => this.joinKey());
    this.els.fileInput?.addEventListener('change', (e) => this.handleFiles(e));

    // Drag & drop
    const dropZone = document.getElementById('drop-zone');
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => this.preventDefaults(e));
    });
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'));
    });
    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'));
    });
    dropZone.addEventListener('drop', (e) => this.handleDrop(e));

    // Resume audio context on user interaction
    document.addEventListener('click', () => {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
    }, { once: true });
  }

  toggleExpand() {
    this.els.glass.classList.toggle('is-expanded');
    this.playLiquidGlassSound(660, 'chime');
  }

  switchMode(mode) {
    if (this.currentMode === mode) return;

    // Reset previous
    document.querySelectorAll('.glass-mode-link').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.glass-panel').forEach(panel => panel.classList.add('hidden'));
    this.els.modeButtons.classList.add('hidden');

    // Activate new
    this.currentMode = mode;
    const activeBtns = document.querySelectorAll(`[data-mode="${mode}"]`);
    activeBtns.forEach(btn => btn.classList.add('active'));

    const panel = mode === 'sender' ? this.els.senderPanel : this.els.receiverPanel;
    panel.classList.remove('hidden');

    if (!this.els.glass.classList.contains('is-expanded')) {
      this.els.glass.classList.add('is-expanded');
    }

    this.playLiquidGlassSound(mode === 'sender' ? 523 : 659, 'click');
    console.log(`Switched to ${mode} mode`);

    if (mode === 'sender' && this.roomKey) {
      this.listenForSignals();
      this.createConnection();
    }
  }

  goBack() {
    // Hide current panel, show mode buttons
    document.querySelectorAll('.glass-panel').forEach(panel => panel.classList.add('hidden'));
    document.querySelectorAll('.glass-mode-link').forEach(btn => btn.classList.remove('active'));
    this.els.modeButtons.classList.remove('hidden');
    this.currentMode = null;
    this.playLiquidGlassSound(440, 'click');
    console.log('Back to mode selection');
  }

  generateKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < 6; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.roomKey = key;
    this.els.roomKey.textContent = this.roomKey;
    this.els.keyDisplay.classList.remove('hidden');

    // QR Code
    const qrcode = document.getElementById('qrcode');
    qrcode.innerHTML = '';
    new QRCode(qrcode, {
      text: window.location.origin + '?room=' + this.roomKey,
      width: 128,
      height: 128,
      colorDark: '#000000',
      colorLight: '#ffffff'
    });

    this.playLiquidGlassSound(784);
  }

  copyKey() {
    navigator.clipboard.writeText(this.roomKey).then(() => {
      const btn = document.getElementById('copy-key-btn');
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = original, 1500);
      this.playLiquidGlassSound(880);
    });
  }

  joinKey() {
    const keyInput = document.getElementById('join-key-input');
    this.roomKey = keyInput.value.trim().toUpperCase();
    if (this.roomKey) {
      console.log('Joining room:', this.roomKey);
      keyInput.value = '';
      this.playLiquidGlassSound(698);

      const statusDiv = document.getElementById('receiver-status');
      statusDiv.classList.remove('hidden');
      
      this.listenForSignals();
    }
  }

  async handleFiles(e) {
    const files = Array.from(e.target.files || (e.dataTransfer && e.dataTransfer.files) || []);
    if (!files.length) return;

    console.log('Selected files:', files);
    this.playLiquidGlassSound(523);

    const statusDiv = document.getElementById('transfer-status');
    const progressDiv = document.getElementById('sender-progress');
    statusDiv.classList.remove('hidden');
    progressDiv.innerHTML = '';
    
    for (const file of files) {
      await this.transferFile(file, progressDiv);
    }
  }

  async transferFile(file, progressDiv) {
    if (!this.dc || this.dc.readyState !== 'open') {
      console.error("Connection not ready for transfer.");
      return;
    }

    // Store the file for potential re-sends
    this.transferringFiles.set(file.name, file);

    const item = document.createElement('div');
    item.className = 'file-item';
    item.textContent = file.name;
    progressDiv.appendChild(item);

    const barWrap = document.createElement('div');
    barWrap.className = 'progress-bar';
    const fill = document.createElement('div');
    fill.className = 'progress-fill';
    barWrap.appendChild(fill);
    progressDiv.appendChild(barWrap);

    const chunkSize = 16 * 1024;
    const totalChunks = Math.ceil(file.size / chunkSize);

    this.dc.send(JSON.stringify({
      type: 'metadata',
      name: file.name,
      size: file.size,
      mime: file.type,
      totalChunks: totalChunks
    }));

    await this.readAndChunkFile(file, fill, 0); // Start from offset 0 initially

    // Add clear end-of-transfer signal
    this.dc.send(JSON.stringify({
      type: 'end-of-file',
      name: file.name, // Include name for debugging/validation
      size: file.size // Include size for validation
    }));

    // After successful transfer, remove from map
    this.transferringFiles.delete(file.name);
  }

  animateProgress(element, duration) {
    let progress = 0;
    const step = 100 / (duration / 16);
    const interval = setInterval(() => {
      progress += step;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }
      element.style.width = progress + '%';
    }, 16);
  }

  async readAndChunkFile(file, progressFill, startOffset = 0) {
    const chunkSize = 16 * 1024;
    let offset = startOffset;
    
    while (offset < file.size) {
      // Handle backpressure (buffer full)
      if (this.dc.bufferedAmount > this.dc.bufferedAmountLowThreshold) {
        await new Promise(resolve => {
          this.dc.onbufferedamountlow = () => {
            this.dc.onbufferedamountlow = null;
            resolve();
          };
        });
      }

      const slice = file.slice(offset, offset + chunkSize);
      const buffer = await slice.arrayBuffer();

      // Retry mechanism for the send call
      let sent = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (this.dc.readyState !== 'open') throw new Error("DataChannel closed");
          this.dc.send(buffer);
          sent = true;
          break;
        } catch (err) {
          console.warn(`Chunk send failed (attempt ${attempt + 1}), retrying...`, err);
          await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
        }
      }

      if (!sent) throw new Error("Critical: Failed to send chunk after multiple retries.");

      offset += buffer.byteLength;
      if (progressFill) { // Only update progress if a fill element is provided
        progressFill.style.width = (offset / file.size) * 100 + '%';
      }
    }
  }

  handleDrop(e) {
    const files = e.dataTransfer.files;
    console.log('Dropped files:', files);
    this.els.fileInput.files = files;
    this.handleFiles({ target: { files } });
  }

  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  updateTODOMarkdown() {
    // Placeholder for TODO updates
  }

  updateConnectionUI(state) {
    const dot = document.getElementById(`${this.currentMode}-status-dot`);
    const text = document.getElementById(`${this.currentMode}-status-text`);
    if (!dot || !text) return;

    switch (state) {
      case 'connected':
        dot.classList.add('connected');
        text.textContent = 'Connected';
        break;
      case 'connecting':
        text.textContent = 'Connecting...';
        break;
      default:
        dot.classList.remove('connected');
        text.textContent = this.currentMode === 'sender' ? 'Waiting for receiver...' : 'Disconnected';
    }
  }

  // WebRTC Implementation based on provided reference
  async createConnection() {
    this.pc = new RTCPeerConnection(this.iceServers);

    this.dc = this.pc.createDataChannel("fileTransfer", { ordered: true });
    this.dc.bufferedAmountLowThreshold = 65536;

    this.setupDataChannelHandlers();

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({ candidate: event.candidate });
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log("Connection State:", this.pc.connectionState);
      this.updateConnectionUI(this.pc.connectionState);
    };

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.sendSignal({ offer: offer });
  }

  async handleOffer(offer) {
    this.pc = new RTCPeerConnection(this.iceServers);

    this.pc.ondatachannel = (event) => {
      this.dc = event.channel;
      this.setupDataChannelHandlers();
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({ candidate: event.candidate });
      }
    };

    this.pc.onconnectionstatechange = () => {
      this.updateConnectionUI(this.pc.connectionState);
    };

    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    
    if (this.iceCandidatesQueue.length) {
      this.iceCandidatesQueue.forEach(c => this.pc.addIceCandidate(new RTCIceCandidate(c)));
      this.iceCandidatesQueue = [];
    }

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.sendSignal({ answer: answer });
  }

  async handleAnswer(answer) {
    if (this.pc && this.pc.signalingState === "have-local-offer") {
      await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
      if (this.iceCandidatesQueue.length) {
        this.iceCandidatesQueue.forEach(c => this.pc.addIceCandidate(new RTCIceCandidate(c)));
        this.iceCandidatesQueue = [];
      }
    }
  }

  async handleCandidate(candidate) {
    try {
      if (this.pc && this.pc.remoteDescription) {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        this.iceCandidatesQueue.push(candidate);
      }
    } catch (e) {
      console.error("Candidate error:", e);
    }
  }

  setupDataChannelHandlers() {
    if (!this.dc) return;
    this.dc.binaryType = 'arraybuffer';
    
    this.dc.onopen = async () => {
      console.log("✅ DataChannel Connected");
      this.updateConnectionUI('connected');
      if (this.db && this.roomKey) {
        // Clean up signaling data after connection is established
        await this.db.ref(`rooms/${this.roomKey}/signals`).remove();
        console.log(`Cleaned up signaling data for room: ${this.roomKey}`);
      }
    };

    this.dc.onclose = () => {
      console.log("❌ DataChannel Disconnected");
      this.updateConnectionUI('disconnected');
      // Reset state on disconnect
      this.receivedChunks = [];
      this.receivedChunksCount = 0;
      this.incomingFileInfo = null;
      this.receivedSize = 0;
      this.transferringFiles.clear();
    };

    this.dc.onerror = (e) => console.error("Error:", e);

    this.dc.onmessage = async (e) => { // Make it async to allow await in handlers
      if (typeof e.data === 'string') {
        try {
          const msg = JSON.parse(e.data);

          if (this.currentMode === 'receiver') {
            if (msg.type === 'metadata') {
              this.incomingFileInfo = msg;
              this.receivedChunks = [];
              this.receivedChunksCount = 0;
              this.receivedSize = 0;
              console.log('Receiving file metadata:', msg.name, msg.size);
              document.getElementById('receiver-status-text').textContent = `Receiving: ${msg.name}`;
            } else if (msg.type === 'end-of-file') {
              // Explicit end-of-transfer signal
              if (this.incomingFileInfo && msg.name === this.incomingFileInfo.name) {
                if (this.receivedSize === this.incomingFileInfo.size) {
                  console.log('End-of-file signal received for:', msg.name);
                  this.finalizeDownload();
                  document.getElementById('receiver-status-text').textContent = `Download complete: ${msg.name}`;
                } else {
                  console.warn(`Incomplete file transfer for ${msg.name}. Expected ${this.incomingFileInfo.size} bytes, received ${this.receivedSize} bytes. Requesting remaining data.`);
                  // Request remaining data
                  this.dc.send(JSON.stringify({
                    type: 'request-remaining-data',
                    name: this.incomingFileInfo.name,
                    currentReceivedSize: this.receivedSize
                  }));
                  // Reset received chunks for the re-sent data
                  this.receivedChunks = [];
                  this.receivedChunksCount = 0;
                  this.receivedSize = 0;
                  this.updateReceiverProgress(0); // Reset progress bar
                  document.getElementById('receiver-status-text').textContent = `Requesting missing parts for ${this.incomingFileInfo.name}...`;
                }
              } else {
                console.error("File transfer error: End-of-file signal received but file info mismatch.", this.incomingFileInfo, msg);
              }
            }
          } else if (this.currentMode === 'sender') {
            // Sender handles requests from receiver
            if (msg.type === 'request-remaining-data') {
              const { name, currentReceivedSize } = msg;
              console.log(`Sender received request to re-send ${name} from offset ${currentReceivedSize}`);
              const fileToResend = this.transferringFiles.get(name);
              if (fileToResend) {
                await this.readAndChunkFile(fileToResend, null, currentReceivedSize); // Pass null for progressFill
                // Re-send end-of-file signal
                this.dc.send(JSON.stringify({ type: 'end-of-file', name: fileToResend.name, size: fileToResend.size }));
                console.log(`Re-sent remaining parts and end-of-file signal for ${name}.`);
              } else {
                console.error(`Sender: File ${name} not found for re-send request.`);
              }
            }
          } // End of sender message handling
        } catch (err) { console.error("Parse error", err); }
      } else {
        // Binary data (chunks) are always for the receiver
        if (this.currentMode === 'receiver') {
          this.receivedChunks.push(e.data);
          this.receivedChunksCount++;
          this.receivedSize += e.data.byteLength;
          
          if (this.incomingFileInfo) {
            const progress = (this.receivedSize / this.incomingFileInfo.size) * 100;
            this.updateReceiverProgress(progress);
          }
        } // Sender ignores binary data on its own DataChannel
      }
    };
  }

  updateReceiverProgress(percent) {
    const progressDiv = document.getElementById('receiver-progress');
    if (!progressDiv) return;
    let fill = progressDiv.querySelector('.progress-fill');
    if (!fill) {
      progressDiv.innerHTML = '<div class="progress-bar"><div class="progress-fill"></div></div>';
      fill = progressDiv.querySelector('.progress-fill');
    }
    fill.style.width = percent + '%';
  }

  finalizeDownload() {
    if (!this.incomingFileInfo) return;
    const blob = new Blob(this.receivedChunks, { type: this.incomingFileInfo.mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const linksDiv = document.getElementById('download-links');
    const link = document.createElement('a');
    link.className = 'download-link';
    link.textContent = `Download: ${this.incomingFileInfo.name}`;
    link.href = url;
    link.download = this.incomingFileInfo.name;
    linksDiv.appendChild(link);
    this.playLiquidGlassSound(880);
    this.receivedChunks = [];
    this.incomingFileInfo = null;
  }

  sendSignal(data) {
    if (!this.db || !this.roomKey) return;
    const role = this.currentMode;
    const ref = this.db.ref(`rooms/${this.roomKey}/signals/${role}`);
    if (data.candidate) ref.child('candidates').push(data.candidate);
    else ref.update(data);
  }

  listenForSignals() {
    if (!this.db || !this.roomKey) return;
    const otherRole = this.currentMode === 'sender' ? 'receiver' : 'sender';
    const ref = this.db.ref(`rooms/${this.roomKey}/signals/${otherRole}`);
    
    ref.on('value', (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      if (data.offer && this.currentMode === 'receiver' && !this.pc) this.handleOffer(data.offer);
      if (data.answer && this.currentMode === 'sender') this.handleAnswer(data.answer);
    });

    ref.child('candidates').on('child_added', (snapshot) => {
      const candidate = snapshot.val();
      this.handleCandidate(candidate);
    });
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  new P2PFileShare();
});
