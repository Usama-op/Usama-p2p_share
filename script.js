const peer = new Peer();
let conn;

// Initialize Peer
peer.on('open', (id) => {
    document.getElementById('myId').innerText = id;
    log('✅ System Ready. Share your ID to receive files.');
});

// Handle Incoming Connections
peer.on('connection', (c) => {
    conn = c;
    setupEventListeners();
    log('🔗 Peer connected to you!');
});

// Initiate Connection
function connectPeer() {
    const peerId = document.getElementById('connectId').value;
    if (!peerId) return alert("Please enter an ID");
    
    log(`⏳ Attempting to connect to: ${peerId}`);
    conn = peer.connect(peerId);
    setupEventListeners();
}

function setupEventListeners() {
    conn.on('open', () => {
        log('🚀 Connection established! You can now send files.');
        document.getElementById('connectBtn').innerText = "Connected";
        document.getElementById('connectBtn').style.background = "#10b981";
    });

    conn.on('data', (data) => {
        if (data.type === 'file') {
            const blob = new Blob([data.file]);
            const url = URL.createObjectURL(blob);
            
            const div = document.createElement('div');
            div.innerHTML = `
                <p>📄 <strong>${data.name}</strong> received</p>
                <a href="${url}" download="${data.name}" class="download-link">Click to Download</a>
                <hr style="border:0; border-top:1px solid #334155; margin: 10px 0;">
            `;
            document.getElementById('log').appendChild(div);
            log(`📩 Received: ${data.name}`);
        }
    });

    conn.on('error', (err) => log('❌ Connection Error: ' + err));
    conn.on('close', () => log('System: Connection closed.'));
}

// File Handling Logic
function sendFile(file) {
    if (!file) return;
    if (!conn || !conn.open) {
        alert("Not connected! Connect to a peer first.");
        return;
    }

    log(`📤 Sending: ${file.name}...`);
    
    const reader = new FileReader();
    reader.onload = () => {
        conn.send({
            type: 'file',
            name: file.name,
            file: reader.result
        });
        log(`✅ Sent: ${file.name}`);
    };
    reader.readAsArrayBuffer(file);
}

// Helper Functions
function log(msg) {
    const logDiv = document.getElementById('log');
    logDiv.innerHTML += `<div>${msg}</div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
}

function copyId() {
    const id = document.getElementById('myId').innerText;
    navigator.clipboard.writeText(id);
    log('📋 ID copied to clipboard!');
}

// UI Triggers
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

dropZone.onclick = () => fileInput.click();
fileInput.onchange = (e) => sendFile(e.target.files[0]);

dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = "#3b82f6"; };
dropZone.ondragleave = () => { dropZone.style.borderColor = "#334155"; };
dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "#334155";
    sendFile(e.dataTransfer.files[0]);
};
