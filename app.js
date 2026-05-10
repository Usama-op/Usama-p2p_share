import { db } from './firebase-config.js';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  arrayUnion
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const roomIdInput = document.getElementById('roomId');
const sendBtn = document.getElementById('sendBtn');
const fileInput = document.getElementById('fileInput');
const progressBar = document.getElementById('progressBar');
const statusText = document.getElementById('status');
const downloadLink = document.getElementById('downloadLink');

let peerConnection;
let dataChannel;
let receiveBuffer = [];
let receivedSize = 0;
let fileSize = 0;
let fileName = '';
const addedCandidates = new Set();

const servers = {
  iceServers: [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:global.stun.twilio.com:3478'
      ]
    }
  ]
};

function updateStatus(message) {
  statusText.innerText = message;
}

function updateProgress(value) {
  progressBar.style.width = value + '%';
}

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(servers);
  peerConnection.onconnectionstatechange = () => {
    updateStatus('Connection: ' + peerConnection.connectionState);
  };
  peerConnection.ondatachannel = event => {
    dataChannel = event.channel;
    setupDataChannel();
  };
}

function setupDataChannel() {
  dataChannel.binaryType = 'arraybuffer';
  dataChannel.bufferedAmountLowThreshold = 65535;
  dataChannel.onopen = () => updateStatus('Connected');
  dataChannel.onclose = () => updateStatus('Disconnected');
  dataChannel.onerror = err => {
    console.error(err);
    updateStatus('Channel error');
  };
  dataChannel.onmessage = event => {
    try {
      if (typeof event.data === 'string') {
        const metadata = JSON.parse(event.data);
        fileName = metadata.fileName;
        fileSize = metadata.fileSize;
        receiveBuffer = [];
        receivedSize = 0;
        updateProgress(0);
        return;
      }
      receiveBuffer.push(event.data);
      receivedSize += event.data.byteLength;
      updateProgress((receivedSize / fileSize) * 100);
      if (receivedSize >= fileSize) {
        const blob = new Blob(receiveBuffer);
        const url = URL.createObjectURL(blob);
        downloadLink.href = url;
        downloadLink.download = fileName;
        downloadLink.innerText = 'Download ' + fileName;
        downloadLink.classList.remove('hidden');
        downloadLink.click();
        updateStatus('File received');
        receiveBuffer = [];
        receivedSize = 0;
      }
    } catch (err) {
      console.error(err);
      updateStatus('Receive failed');
    }
  };
}

createBtn.onclick = async () => {
  try {
    createPeerConnection();
    dataChannel = peerConnection.createDataChannel('fileChannel');
    setupDataChannel();
    const roomId = Math.random().toString(36).substring(2, 10);
    roomIdInput.value = roomId;
    const roomRef = doc(db, 'rooms', roomId);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await setDoc(roomRef, {
      offer: { type: offer.type, sdp: offer.sdp }
    });
    peerConnection.onicecandidate = async event => {
      if (event.candidate) {
        await updateDoc(roomRef, {
          candidates: arrayUnion(event.candidate.toJSON())
        });
      }
    };
    onSnapshot(roomRef, async snapshot => {
      const data = snapshot.data();
      if (data?.answer && !peerConnection.currentRemoteDescription) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
      if (data?.joinCandidates) {
        for (const candidate of data.joinCandidates) {
          const key = JSON.stringify(candidate);
          if (!addedCandidates.has(key)) {
            addedCandidates.add(key);
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }
      }
    });
    updateStatus('Room created');
  } catch (err) {
    console.error(err);
    updateStatus('Create failed');
  }
};

joinBtn.onclick = async () => {
  try {
    const roomId = roomIdInput.value.trim();
    if (!roomId) {
      updateStatus('Enter room ID');
      return;
    }
    createPeerConnection();
    const roomRef = doc(db, 'rooms', roomId);
    const roomSnapshot = await getDoc(roomRef);
    if (!roomSnapshot.exists()) {
      updateStatus('Room not found');
      return;
    }
    const roomData = roomSnapshot.data();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(roomData.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    await updateDoc(roomRef, {
      answer: { type: answer.type, sdp: answer.sdp }
    });
    peerConnection.onicecandidate = async event => {
      if (event.candidate) {
        await updateDoc(roomRef, {
          joinCandidates: arrayUnion(event.candidate.toJSON())
        });
      }
    };
    if (roomData.candidates) {
      for (const candidate of roomData.candidates) {
        const key = JSON.stringify(candidate);
        if (!addedCandidates.has(key)) {
          addedCandidates.add(key);
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }
    }
    updateStatus('Joined room');
  } catch (err) {
    console.error(err);
    updateStatus('Join failed');
  }
};

sendBtn.onclick = async () => {
  try {
    const file = fileInput.files[0];
    if (!file) {
      updateStatus('Select file');
      return;
    }
    if (!dataChannel || dataChannel.readyState !== 'open') {
      updateStatus('Not connected');
      return;
    }
    dataChannel.send(JSON.stringify({ fileName: file.name, fileSize: file.size }));
    const chunkSize = 65536;
    let offset = 0;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        dataChannel.send(e.target.result);
        offset += e.target.result.byteLength;
        updateProgress((offset / file.size) * 100);
        if (offset < file.size) {
          readSlice(offset);
        } else {
          updateStatus('File sent');
        }
      } catch (err) {
        console.error(err);
        updateStatus('Send failed');
      }
    };
    function readSlice(o) {
      const slice = file.slice(o, o + chunkSize);
      reader.readAsArrayBuffer(slice);
    }
    readSlice(0);
  } catch (err) {
    console.error(err);
    updateStatus('Transfer failed');
  }
};