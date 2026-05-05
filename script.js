const peer = new Peer({
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            }
        ]
    }
});

let activeConn;
let incomingFile = [];
let incomingMeta = {};

peer.on('open', id => {
    document.getElementById('my-id').value = id;
    showStatus("Ready");

    const url = location.origin + location.pathname + "?join=" + id;
    new QRCode(document.getElementById("qrcode"), url);

    const params = new URLSearchParams(location.search);
    const join = params.get('join');
    if (join) {
        document.getElementById('remote-id').value = join;
        connectToPeer();
    }
});

peer.on('connection', conn => {
    activeConn = conn;
    setup();
});

function connectToPeer() {
    const id = document.getElementById('remote-id').value;
    activeConn = peer.connect(id);
    setup();
}

function setup() {
    activeConn.on('open', () => showStatus("Connected"));
    activeConn.on('data', handleData);
    activeConn.on('close', () => showStatus("Disconnected"));
    activeConn.on('error', () => showStatus("Error"));
}

function sendChat() {
    const msg = document.getElementById('chat-msg').value;
    activeConn.send({type:'chat', message:msg});
}

function sendFile() {
    const file = document.getElementById('file-input').files[0];
    const chunkSize = 16 * 1024;
    let offset = 0;

    const reader = new FileReader();

    reader.onload = e => {
        activeConn.send({
            type:'file-chunk',
            data:e.target.result,
            fileName:file.name,
            fileType:file.type
        });

        offset += e.target.result.byteLength;

        if (offset < file.size) readSlice(offset);
        else activeConn.send({type:'file-complete'});
    };

    function readSlice(o){
        reader.readAsArrayBuffer(file.slice(o, o + chunkSize));
    }

    readSlice(0);
}

function handleData(data){
    if(data.type==='chat'){
        console.log("Peer:", data.message);
    }
    else if(data.type==='file-chunk'){
        incomingFile.push(data.data);
        incomingMeta = data;
    }
    else if(data.type==='file-complete'){
        const blob = new Blob(incomingFile,{type:incomingMeta.fileType});
        const url = URL.createObjectURL(blob);

        const btn = document.getElementById('download-btn');
        btn.href = url;
        btn.download = incomingMeta.fileName;
        btn.style.display='block';

        incomingFile=[];
    }
}

function copyLink(){
    navigator.clipboard.writeText(location.href+"?join="+peer.id);
}

function showStatus(msg){
    document.getElementById('status-text').innerText="Status: "+msg;
}
