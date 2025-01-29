let room;
const roomInput = document.getElementById("roomInput");
const nameInput = document.getElementById("nameInput");
const joinRoomButton = document.getElementById("joinRoom");
const toggleAudioButton = document.getElementById("toggleAudio");
const statusDiv = document.getElementById("status");
const participantsDiv = document.getElementById("participants");

// LiveKit Cloud WebSocket URL
const livekitUrl = "wss://ruby-5m7wgrgh.livekit.cloud";

async function connectToRoom() {
  const roomName = roomInput.value.trim();
  const participantName = nameInput.value.trim();

  if (!roomName || !participantName) {
    alert("Please enter both room name and participant name");
    return;
  }

  try {
    // Get token from your server
    const response = await fetch("/api/get-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        roomName,
        participantName,
      }),
    });
    const { token } = await response.json();

    room = new LivekitClient.Room({
      adaptiveStream: true,
      dynacast: true,
      audioPreference: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    room.on(
      LivekitClient.RoomEvent.ParticipantConnected,
      handleParticipantConnected
    );
    room.on(
      LivekitClient.RoomEvent.ParticipantDisconnected,
      handleParticipantDisconnected
    );
    room.on(LivekitClient.RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.on(LivekitClient.RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);

    await room.connect(livekitUrl, token);
    console.log("Connected to room:", room.name);

    statusDiv.textContent = "Connected";
    statusDiv.className = "status connected";
    toggleAudioButton.disabled = false;
    roomInput.disabled = true;
    nameInput.disabled = true;
    joinRoomButton.disabled = true;
  } catch (error) {
    console.error("Error connecting to room:", error);
    alert("Failed to connect to room");
  }
}

async function toggleAudio() {
  if (!room) return;

  try {
    const audioTrack = await LivekitClient.createLocalAudioTrack({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    });

    await room.localParticipant.publishTrack(audioTrack);
    toggleAudioButton.textContent = "Disable Microphone";
  } catch (error) {
    console.error("Error toggling audio:", error);
    alert("Error accessing microphone");
  }
}

function handleParticipantConnected(participant) {
  console.log("Participant connected:", participant.identity);
  updateParticipantsList();
}

function handleParticipantDisconnected(participant) {
  console.log("Participant disconnected:", participant.identity);
  updateParticipantsList();
}

function handleTrackSubscribed(track, publication, participant) {
  if (track.kind === "audio") {
    track.attach();
  }
}

function handleTrackUnsubscribed(track) {
  track.detach();
}

function updateParticipantsList() {
  if (!room) return;

  const participants = Array.from(room.participants.values());
  participantsDiv.innerHTML = `
        <h3>Participants:</h3>
        <ul>
            <li>You (${room.localParticipant.identity})</li>
            ${participants.map((p) => `<li>${p.identity}</li>`).join("")}
        </ul>
    `;
}

joinRoomButton.onclick = connectToRoom;
toggleAudioButton.onclick = toggleAudio;
