const peer = new Peer({
    config: {
        'iceServers': [
            { url: 'stun:stun.l.google.com:19302' },
            { url: 'stun:stun1.l.google.com:19302' },
            { url: 'stun:stun2.l.google.com:19302' }
        ]
    }
});

let activeConn;

peer.on('open', (id) => {
    document.getElementById('my-id').value = id;
    const shareUrl = `${window.location.origin}${window.location.pathname}?join=${id}`;
    const qrContainer = document.getElementById("qrcode");
    qrContainer.innerHTML = "";
    new QRCode(qrContainer, { text: shareUrl, width: 128, height: 128 });
    showStatus("Ready");
});

window.addEventListener('load', () => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('join');
    if (joinId) {
        document.getElementById('remote-id').value = joinId;
        showStatus("ID loaded from link. Press Connect.");
    }
});

// Listener for incoming connections
peer.on('connection', (conn) => {
    activeConn = conn;
    setupConnectionListeners();
    showStatus("Peer Connected!");
    uiConnected();
});

function connectToPeer() {
    const remoteId = document.getElementById('remote-id').value.trim();
    if (!remoteId) return alert("Enter an ID");
    
    activeConn = peer.connect(remoteId, { reliable: true });
    showStatus("Connecting...");
    
    activeConn.on('open', () => {
        setupConnectionListeners();
        showStatus("Connected to " + remoteId);
        uiConnected();
    });
}

function setupConnectionListeners() {
    activeConn.on('data', (data) => {
        if (data.type === 'chat') {
            appendMessage('peer', data.message);
        } else if (data.type === 'file') {
            const blob = new Blob([data.file], { type: data.fileType });
            const url = URL.createObjectURL(blob);
            const btn = document.getElementById('download-btn');
            btn.href = url;
            btn.download = data.fileName;
            btn.style.display = 'block';
            showStatus("Received: " + data.fileName);
            appendMessage('system', "📎 Received file: " + data.fileName);
        }
    });

    activeConn.on('close', () => {
        showStatus("Connection closed.");
        document.getElementById('chat-card').style.display = 'none';
        document.getElementById('file-card').style.display = 'none';
    });
}

function sendChat() {
    const input = document.getElementById('chat-msg');
    const msg = input.value.trim();
    if (!msg || !activeConn) return;

    activeConn.send({ type: 'chat', message: msg });
    appendMessage('me', msg);
    input.value = '';
}

function sendFile() {
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];
    if (!file || !activeConn) return alert("Select a file first");

    showStatus("Sending file...");
    activeConn.send({
        type: 'file',
        file: file,
        fileName: file.name,
        fileType: file.type
    });
    showStatus("File sent!");
    appendMessage('system', "📤 Sent file: " + file.name);
}

function appendMessage(sender, text) {
    const box = document.getElementById('chat-box');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;
    msgDiv.innerText = text;
    box.appendChild(msgDiv);
    box.scrollTop = box.scrollHeight;
}

function uiConnected() {
    document.getElementById('chat-card').style.display = 'block';
    document.getElementById('file-card').style.display = 'block';
}

function copyLink() {
    const id = document.getElementById('my-id').value;
    const shareUrl = `${window.location.origin}${window.location.pathname}?join=${id}`;
    navigator.clipboard.writeText(shareUrl);
    alert("Shareable link copied!");
}

function showStatus(msg) {
    document.getElementById('status-text').innerText = "Status: " + msg;
}

// Enter key support for chat
document.getElementById('chat-msg').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChat();
});