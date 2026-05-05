// Robust configuration for NAT traversal (PC to Android)
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

// 1. Initialize Peer & Handle "Magic Link"
peer.on('open', (id) => {
    document.getElementById('my-id').value = id;
    
    // Create link that auto-fills ID on the other device
    const shareUrl = `${window.location.origin}${window.location.pathname}?join=${id}`;
    
    // Update QR to use the URL instead of just the ID
    const qrContainer = document.getElementById("qrcode");
    qrContainer.innerHTML = "";
    new QRCode(qrContainer, {
        text: shareUrl,
        width: 150,
        height: 150
    });

    showStatus("Ready");
});

// 2. Auto-fill if opened via QR link
window.addEventListener('load', () => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('join');
    if (joinId) {
        document.getElementById('remote-id').value = joinId;
        showStatus("ID loaded from link!");
    }
});

// 3. Connection Listeners
peer.on('connection', (conn) => {
    activeConn = conn;
    showStatus("Peer Connected!");
    setupReceiver();
});

function setupReceiver() {
    activeConn.on('data', (data) => {
        if (data.type === 'file') {
            const blob = new Blob([data.file], { type: data.fileType });
            const url = URL.createObjectURL(blob);
            const btn = document.getElementById('download-btn');
            btn.href = url;
            btn.download = data.fileName;
            btn.style.display = 'block';
            showStatus("Received: " + data.fileName);
        }
    });
}

function sendFile() {
    const remoteId = document.getElementById('remote-id').value.trim();
    const file = document.getElementById('file-input').files[0];
    
    if (!remoteId || !file) return alert("Please provide ID and File");

    // Initiate connection
    activeConn = peer.connect(remoteId, { reliable: true });
    showStatus("Connecting...");

    activeConn.on('open', () => {
        showStatus("Sending...");
        activeConn.send({
            type: 'file',
            file: file,
            fileName: file.name,
            fileType: file.type
        });
        showStatus("Sent Successfully!");
    });

    activeConn.on('error', (err) => {
        showStatus("Connection failed.");
        console.error(err);
    });
}

function copyLink() {
    const id = document.getElementById('my-id').value;
    const shareUrl = `${window.location.origin}${window.location.pathname}?join=${id}`;
    navigator.clipboard.writeText(shareUrl);
    alert("Link copied! Send this to your other device.");
}

function showStatus(msg) {
    document.getElementById('status-text').innerText = "Status: " + msg;
}