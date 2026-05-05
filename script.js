const peer = new Peer({
    config: {
        'iceServers': [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' },
            { urls: 'stun:stun.voiparound.com' },
            { urls: 'stun:stun.schlund.de' },
            { urls: 'stun:stun.sipgate.net:10000' }
        ],
        'iceCandidatePoolSize': 10,
        'sdpSemantics': 'unified-plan'
    }
});

let activeConn;

peer.on('open', (id) => {
    document.getElementById('my-id').value = id;
    const shareUrl = `${window.location.origin}${window.location.pathname}?join=${id}`;
    const qrContainer = document.getElementById("qrcode");
    qrContainer.innerHTML = "";
    new QRCode(qrContainer, { text: shareUrl, width: 160, height: 160 });
    showStatus("Ready to connect");
});

window.addEventListener('load', () => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('join');
    if (joinId) {
        document.getElementById('remote-id').value = joinId;
        showStatus("ID loaded from link. Press Connect.");
    }
});

peer.on('error', (err) => {
    console.error('PeerJS Error:', err.type);
    let msg = "Error: ";
    if (err.type === 'network') msg += "NAT/Firewall block. Try same Wi-Fi.";
    else if (err.type === 'peer-unavailable') msg += "Peer not found.";
    else msg += err.type;
    showStatus(msg);
    if(err.type !== 'disconnected') alert(msg);
});

peer.on('connection', (conn) => {
    activeConn = conn;
    setupConnectionListeners();
    showStatus("Connected!");
    uiConnected();
});

function connectToPeer() {
    const remoteId = document.getElementById('remote-id').value.trim();
    if (!remoteId) return alert("Please enter an ID");
    showStatus("Connecting...");
    activeConn = peer.connect(remoteId, { reliable: true });
    activeConn.on('open', () => {
        setupConnectionListeners();
        showStatus("Connected!");
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
            appendMessage('system', "📎 Received: " + data.fileName);
        }
    });
    activeConn.on('close', () => {
        showStatus("Disconnected");
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
    showStatus("Sending...");
    activeConn.send({
        type: 'file',
        file: file,
        fileName: file.name,
        fileType: file.type
    });
    appendMessage('system', "📤 Sent: " + file.name);
    showStatus("Sent!");
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
    alert("Link copied!");
}

function showStatus(msg) {
    document.getElementById('status-text').innerText = "Status: " + msg;
}

document.getElementById('chat-msg').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChat();
});