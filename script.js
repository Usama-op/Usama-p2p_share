const peer = new Peer();
let activeConn;

// Initialize Peer
peer.on('open', (id) => {
    document.getElementById('my-id').value = id;
    new QRCode(document.getElementById("qrcode"), {
        text: id,
        width: 128,
        height: 128
    });
});

// Listener for incoming connections
peer.on('connection', (conn) => {
    activeConn = conn;
    showStatus("Peer Connected");
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
            showStatus("File Received: " + data.fileName);
        }
    });
}

function sendFile() {
    const remoteId = document.getElementById('remote-id').value;
    const file = document.getElementById('file-input').files[0];
    
    if (!remoteId || !file) return alert("Please provide ID and File");

    activeConn = peer.connect(remoteId);
    showStatus("Connecting...");

    activeConn.on('open', () => {
        showStatus("Sending file...");
        activeConn.send({
            type: 'file',
            file: file,
            fileName: file.name,
            fileType: file.type
        });
        showStatus("Sent Successfully!");
    });
}

function copyId() {
    const input = document.getElementById('my-id');
    input.select();
    navigator.clipboard.writeText(input.value);
}

function showStatus(msg) {
    document.getElementById('status-text').innerText = "Status: " + msg;
}