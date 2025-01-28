let socket;
let mediaRecorder;
let audioStream;
let roomId;
let audioContext;
let processor;
let source;

const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const statusDiv = document.getElementById("status");
const roomInput = document.getElementById("roomInput");
const joinRoomButton = document.getElementById("joinRoom");

function initializeSocket() {
  socket = io();

  socket.on("connect", () => {
    statusDiv.textContent = "Connected";
    statusDiv.className = "status connected";
    startButton.disabled = false;
  });

  socket.on("disconnect", () => {
    statusDiv.textContent = "Disconnected";
    statusDiv.className = "status disconnected";
    startButton.disabled = true;
    stopButton.disabled = true;
    stopRecording();
  });

  socket.on("audio-stream", (audioData) => {
    playAudio(audioData);
  });
}

joinRoomButton.onclick = () => {
  roomId = roomInput.value.trim();
  if (roomId) {
    socket.emit("join-room", roomId);
    roomInput.disabled = true;
    joinRoomButton.disabled = true;
  }
};

function startRecording() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  source = audioContext.createMediaStreamSource(audioStream);
  processor = audioContext.createScriptProcessor(1024, 1, 1);

  source.connect(processor);
  processor.connect(audioContext.destination);

  processor.onaudioprocess = (e) => {
    if (!socket.connected) return;

    const inputData = e.inputBuffer.getChannelData(0);
    const buffer = new ArrayBuffer(inputData.length * 2);
    const view = new DataView(buffer);

    for (let i = 0; i < inputData.length; i++) {
      view.setInt16(i * 2, inputData[i] * 0x7fff, true);
    }

    const base64data = btoa(
      String.fromCharCode.apply(null, new Uint8Array(buffer))
    );

    socket.emit("audio-stream", {
      roomId: roomId,
      audio: base64data,
    });
  };
}

function stopRecording() {
  if (processor) {
    processor.disconnect();
    processor = null;
  }

  if (source) {
    source.disconnect();
    source = null;
  }

  if (audioStream) {
    audioStream.getTracks().forEach((track) => track.stop());
    audioStream = null;
  }

  if (audioContext && audioContext.state !== "closed") {
    audioContext.close();
    audioContext = null;
  }
}

let playbackContext;

async function playAudio(base64Data) {
  try {
    if (!playbackContext || playbackContext.state === "closed") {
      playbackContext = new (window.AudioContext ||
        window.webkitAudioContext)();
    }

    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Int16Array(len / 2);

    for (let i = 0; i < len; i += 2) {
      bytes[i / 2] =
        (binaryString.charCodeAt(i) & 0xff) |
        ((binaryString.charCodeAt(i + 1) & 0xff) << 8);
    }

    const buffer = playbackContext.createBuffer(
      1,
      bytes.length,
      playbackContext.sampleRate
    );
    const channelData = buffer.getChannelData(0);

    for (let i = 0; i < bytes.length; i++) {
      channelData[i] = bytes[i] / 0x7fff;
    }

    const source = playbackContext.createBufferSource();
    source.buffer = buffer;
    source.connect(playbackContext.destination);
    source.start(0);
  } catch (err) {
    console.error("Error playing audio:", err);
  }
}

startButton.onclick = async () => {
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    startRecording();
    startButton.disabled = true;
    stopButton.disabled = false;
  } catch (err) {
    console.error("Error accessing microphone:", err);
    alert("Error accessing microphone");
  }
};

stopButton.onclick = () => {
  stopRecording();
  startButton.disabled = false;
  stopButton.disabled = true;
};

initializeSocket();
