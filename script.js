
const CHUNK_SIZE = 16 * 1024; // 16KB Chunks for max stability
let peer = null;
let currentConn = null;

// Initialization
function initApp() {
    // Uses Google STUN servers to bypass most household/mobile firewalls
    peer = new Peer(undefined, {
        config: {
            'iceServers': [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        },
        debug: 1
    });

    peer.on('open', (id) => {
        document.getElementById('myId').innerText = id;
        document.getElementById('connectionStatus').innerText = 'Online';
        log('System ready. Share your ID.');
    });

    peer.on('connection', (conn) => {
        handleIncomingConnection(conn);
    });

    peer.on('error', (err) => {
        log('Error: ' + err.type, 'error');
        console.error(err);
    });
}

function startConnection() {
    const remoteId = document.getElementById('remoteIdInput').value;
    if (!remoteId) return;

    log(`Connecting to ${remoteId}...`);
    const conn = peer.connect(remoteId, { reliable: true });
    handleIncomingConnection(conn);
}

function handleIncomingConnection(conn) {
    if (currentConn) currentConn.close();
    currentConn = conn;

    currentConn.on('open', () => {
        log('Connection Established!', 'success');
        document.getElementById('connectionStatus').innerText = 'Connected';
        document.getElementById('transferSection').classList.remove('hidden');
        document.getElementById('connectBtn').innerText = 'Linked';
    });

    currentConn.on('data', (data) => {
        processIncomingData(data);
    });

    currentConn.on('close', () => {
        log('Peer disconnected.');
        document.getElementById('transferSection').classList.add('hidden');
        document.getElementById('connectionStatus').innerText = 'Online';
    });
}

// Sending Logic with Chunking (Fixes "File Not Sending" for files > 64KB)
async function sendFile(file) {
    if (!currentConn || !currentConn.open) return log('Not connected!', 'error');

    log(`Sending: ${file.name}`);
    toggleProgress(true, file.name);

    // 1. Send metadata
    currentConn.send({
        type: 'meta',
        name: file.name,
        size: file.size,
        mime: file.type
    });

    const buffer = await file.arrayBuffer();
    let offset = 0;

    // 2. Send chunks
    while (offset < file.size) {
        const chunk = buffer.slice(offset, offset + CHUNK_SIZE);
        currentConn.send({
            type: 'chunk',
            data: chunk
        });
        offset += CHUNK_SIZE;
        
        const percent = Math.min((offset / file.size) * 100, 100);
        updateProgress(percent);

        // Pause briefly every 1MB to prevent browser buffer overflow
        if (offset % (1024 * 1024) === 0) {
            await new Promise(r => setTimeout(r, 20));
        }
    }

    log(`Sent ${file.name} successfully.`, 'success');
    setTimeout(() => toggleProgress(false), 2000);
}

// Receiving Logic
let incomingFile = null;

function processIncomingData(data) {
    if (data.type === 'meta') {
        incomingFile = {
            name: data.name,
            size: data.size,
            chunks: [],
            bytesReceived: 0
        };
        toggleProgress(true, data.name);
        log(`Incoming: ${data.name}...`);
    } else if (data.type === 'chunk' && incomingFile) {
        incomingFile.chunks.push(data.data);
        incomingFile.bytesReceived += data.data.byteLength;
        
        const percent = (incomingFile.bytesReceived / incomingFile.size) * 100;
        updateProgress(percent);

        if (incomingFile.bytesReceived >= incomingFile.size) {
            completeDownload();
        }
    }
}

function completeDownload() {
    const blob = new Blob(incomingFile.chunks);
    const url = URL.createObjectURL(blob);
    
    const activityLog = document.getElementById('activityLog');
    const div = document.createElement('div');
    div.className = 'log-msg';
    div.innerHTML = `
        <strong>File Received: ${incomingFile.name}</strong><br>
        <a href="${url}" download="${incomingFile.name}" class="download-pill">Download Now</a>
    `;
    activityLog.prepend(div);
    
    toggleProgress(false);
    log(`Successfully received ${incomingFile.name}`);
}

// UI Utilities
function log(msg, type = '') {
    const logDiv = document.getElementById('activityLog');
    const msgDiv = document.createElement('div');
    msgDiv.className = `log-msg ${type}`;
    msgDiv.innerText = `> ${msg}`;
    logDiv.prepend(msgDiv);
}

function copyMyId() {
    const id = document.getElementById('myId').innerText;
    navigator.clipboard.writeText(id);
    log('ID copied to clipboard.');
}

function toggleProgress(show, name = '') {
    const wrapper = document.getElementById('progressWrapper');
    document.getElementById('progressFileName').innerText = name;
    wrapper.classList.toggle('hidden', !show);
}

function updateProgress(percent) {
    document.getElementById('progressFill').style.width = percent + '%';
    document.getElementById('progressPercent').innerText = Math.round(percent) + '%';
}

// Event Listeners
document.getElementById('dropZone').onclick = () => document.getElementById('fileInput').click();
document.getElementById('fileInput').onchange = (e) => sendFile(e.target.files[0]);

const dz = document.getElementById('dropZone');
dz.ondragover = (e) => { e.preventDefault(); dz.style.borderColor = "#3b82f6"; };
dz.ondragleave = () => { dz.style.borderColor = ""; };
dz.ondrop = (e) => {
    e.preventDefault();
    dz.style.borderColor = "";
    if (e.dataTransfer.files.length > 0) sendFile(e.dataTransfer.files[0]);
};

initApp();
