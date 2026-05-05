let peerConnection;
let dataChannel;
let receiveChannel;
let file;
let userId;
const ws = new WebSocket("ws://localhost:8895");

const userIdElement = document.getElementById("user-id");
const container = document.querySelector(".container");

ws.onmessage = (e) => {
    const data = JSON.parse(e.data);
    switch(data.type) {
        case "user-id":
            userId = data.userId;
            userIdElement.textContent = `Creator: Usama | ID: ${userId}`;
            break;
        case "all-recievers":
            showUsers(data.userIds);
            break;
        case "join":
            createOffer(data.target);
            break;
        case "offer":
            createAnswer(data.name, data.sdp);
            break;
        case "answer":
            addAnswer(data.sdp);
            break;
        case "new-ice-candidate":
            addIceCandidates(new RTCIceCandidate(data.candidate));
            break;
        case "accept-request":
            handlePopup(data);
            break;
        case "request-status":
            if (data.status === "accepted") {
                ws.send(JSON.stringify({ type: "initate", userId, target: data.userId }));
            }
            break;
    }
};

const handlePopup = (data) => {
    const popup = document.createElement("div");
    popup.className = "popup";
    popup.innerHTML = `
        <p>User ${data.userId} wants to send a file</p>
        <div style="display:flex; gap:10px;">
            <button class="accept">Accept</button>
            <button class="decline">Decline</button>
        </div>
    `;
    popup.querySelector(".accept").onclick = () => {
        popup.remove();
        ws.send(JSON.stringify({ type: "request-status", userId, target: data.userId, status: "accepted" }));
    };
    popup.querySelector(".decline").onclick = () => { popup.remove(); };
    document.body.appendChild(popup);
};

const openDataChannel = () => { 
    dataChannel = peerConnection.createDataChannel(JSON.stringify({name: file.name, size: file.size}), { reliable: true });
    dataChannel.binaryType = "arraybuffer";

    dataChannel.onopen = async () => {
        const status = document.querySelector(".status");
        const buffer = await file.arrayBuffer();
        const chunkSize = 16384; 
        let offset = 0;

        const sendNext = () => {
            while (offset < buffer.byteLength) {
                if (dataChannel.bufferedAmount > dataChannel.bufferedAmountLowThreshold) {
                    dataChannel.onbufferedamountlow = () => {
                        dataChannel.onbufferedamountlow = null;
                        sendNext();
                    };
                    return;
                }
                const chunk = buffer.slice(offset, offset + chunkSize);
                dataChannel.send(chunk);
                offset += chunk.byteLength;
                status.textContent = `Transferring: ${Math.round((offset / file.size) * 100)}%`;
            }
            dataChannel.send('done');
            status.textContent = "Transfer Complete!";
        };
        sendNext();
    };
};

const showUsers = (users) => {
    const wrapper = document.querySelector(".wrapper");
    if (!wrapper) return;
    let usersContainer = wrapper.querySelector(".users");
    if (!usersContainer) {
        usersContainer = document.createElement("div");
        usersContainer.className = "users";
        wrapper.appendChild(usersContainer);
    }
    usersContainer.innerHTML = "";
    users.forEach((user) => {
        if (user === userId) return;
        let userElement = document.createElement("button");
        userElement.className = "user";
        userElement.textContent = user;
        userElement.onclick = () => ws.send(JSON.stringify({ type: "accept-request", userId, target: user }));
        usersContainer.appendChild(userElement);
    });
};

const homePage = () => {
    container.innerHTML = "";
    const btnContainer = document.createElement("div");
    btnContainer.className = "btn-container";
    const sendBtn = document.createElement("button");
    sendBtn.className = "send btn";
    sendBtn.textContent = "send";
    sendBtn.onclick = sender;
    const recBtn = document.createElement("button");
    recBtn.className = "recieve btn";
    recBtn.textContent = "recieve";
    recBtn.onclick = receiver;
    btnContainer.append(sendBtn, recBtn);
    container.appendChild(btnContainer);
};

const sender = () => {
    container.innerHTML = "";
    ws.send(JSON.stringify({ type: "sender", userId }));
    const wrapper = document.createElement("div");
    wrapper.className = "wrapper";
    const status = document.createElement("p");
    status.className = "status";
    status.textContent = "Progress: 0%";
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = (e) => { file = e.target.files[0]; };
    wrapper.append(status, input);
    container.appendChild(wrapper);
};

const receiver = () => {
    container.innerHTML = "";
    ws.send(JSON.stringify({ type: "reciever", userId }));
    const box = document.createElement("div");
    box.className = "progress_box";
    const progress = document.createElement("p");
    progress.className = "progress";
    progress.textContent = "0%";
    box.append(progress);
    container.appendChild(box);
};

const servers = { iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }] };

const createPeerConnection = (targetUserId, isSender = false) => {
    peerConnection = new RTCPeerConnection(servers);
    peerConnection.onicecandidate = (e) => {
        if (e.candidate) ws.send(JSON.stringify({ type: "new-ice-candidate", target: targetUserId, candidate: e.candidate }));
    };
    if (isSender) openDataChannel();
    peerConnection.ondatachannel = (e) => {
        receiveChannel = e.channel;
        let chunks = [];
        let meta = JSON.parse(receiveChannel.label);
        let recSize = 0;
        receiveChannel.onmessage = (ev) => {
            if (ev.data === "done") {
                const blob = new Blob(chunks);
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = meta.name;
                a.click();
            } else {
                chunks.push(ev.data);
                recSize += ev.data.byteLength || ev.data.size;
                const p = document.querySelector(".progress");
                if (p) p.textContent = Math.round((recSize / meta.size) * 100) + "%";
            }
        };
    };
};

const createOffer = async (t) => {
    createPeerConnection(t, true);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: "offer", name: userId, target: t, sdp: offer }));
};

const createAnswer = async (t, o) => {
    createPeerConnection(t);
    await peerConnection.setRemoteDescription(o);
    const ans = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(ans);
    ws.send(JSON.stringify({ type: "answer", name: userId, target: t, sdp: ans }));
};

const addAnswer = (a) => peerConnection.setRemoteDescription(a);
const addIceCandidates = (c) => peerConnection.addIceCandidate(c);

homePage();