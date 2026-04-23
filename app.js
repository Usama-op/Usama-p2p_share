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
    this.roomKey = keyInput.value.trim();
    if (this.roomKey) {
      console.log('Joining room:', this.roomKey);
      keyInput.value = '';
      this.playLiquidGlassSound(698);

      this.listenForSignals();

      const statusDiv = document.getElementById('receiver-status');
      const progressDiv = document.getElementById('receiver-progress');
      const linksDiv = document.getElementById('download-links');
      statusDiv.classList.remove('hidden');
      progressDiv.innerHTML = '';
      linksDiv.innerHTML = '';

      const barWrap = document.createElement('div');
      barWrap.className = 'progress-bar';
      const fill = document.createElement('div');
      fill.className = 'progress-fill';
      barWrap.appendChild(fill);
      progressDiv.appendChild(barWrap);

      // Simulate chunked receiving for smoother faster progress
      const totalChunks = 20;
      let currentChunk = 0;
      const step = () => {
        currentChunk++;
        const progress = (currentChunk / totalChunks) * 100;
        fill.style.width = progress + '%';
        if (currentChunk < totalChunks) {
          setTimeout(step, 50 / this.transferSpeed);
        } else {
          const link = document.createElement('a');
          link.className = 'download-link';
          link.textContent = 'Download received file';
          link.href = '#';
          linksDiv.appendChild(link);
        }
      };
      step();
    }
  }

  handleFiles(e) {
    const files = Array.from(e.target.files);
    console.log('Selected files:', files);
    this.playLiquidGlassSound(523);

    const statusDiv = document.getElementById('transfer-status');
    const progressDiv = document.getElementById('sender-progress');
    statusDiv.classList.remove('hidden');
    progressDiv.innerHTML = '';

    files.forEach((file) => {
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

      this.readAndChunkFile(file, fill);
    });
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

  async readAndChunkFile(file, progressFill) {
    const chunkSize = 64 * 1024; // 64KB
    let offset = 0;

    const sendNextChunk = () => {
      // Check if network buffer is too full (threshold: 16MB)
      if (this.dc && this.dc.bufferedAmount > 16 * 1024 * 1024) {
        this.dc.onbufferedamountlow = () => {
          this.dc.onbufferedamountlow = null;
          sendNextChunk();
        };
        return;
      }

      const blob = file.slice(offset, offset + chunkSize);
      const reader = new FileReader();
      reader.onload = (e) => {
        if (this.dc && this.dc.readyState === 'open') {
          this.dc.send(e.target.result);
        }
        offset += e.target.result.byteLength;
        progressFill.style.width = (offset / file.size) * 100 + '%';

        if (offset < file.size) {
          sendNextChunk();
        }
      };
      reader.readAsArrayBuffer(blob);
    };

    sendNextChunk();
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

    this.dc = this.pc.createDataChannel("data", {
      ordered: false,
      maxRetransmits: 0
    });
    this.dc.bufferedAmountLowThreshold = 65536; // 64KB

    this.setupDataChannelHandlers();

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({ candidate: event.candidate });
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log("State:", this.pc.connectionState);
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
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.sendSignal({ answer: answer });
  }

  async handleAnswer(answer) {
    if (this.pc && this.pc.signalingState === "have-local-offer") {
      await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  async handleCandidate(candidate) {
    try {
      if (this.pc) {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (e) {
      console.error("Candidate error:", e);
    }
  }

  setupDataChannelHandlers() {
    if (!this.dc) return;
    this.dc.onopen = () => console.log("✅ Connected");
    this.dc.onclose = () => console.log("❌ Disconnected");
    this.dc.onerror = (e) => console.error("Error:", e);
    this.dc.onmessage = (e) => console.log("Received:", e.data);
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
