const express = require('express');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let waitingPlayer = null;
let waitingTimeout = null;

io.on('connection', socket => {
  console.log('Client connected:', socket.id);
  socket.emit('searching');

  if (waitingPlayer === null) {
    waitingPlayer = socket;

    waitingTimeout = setTimeout(() => {
      if (waitingPlayer === socket) {
        const roomID = `ai_room_${socket.id}`;
        socket.join(roomID);
        socket.emit('startGame', { room: roomID, ai: true });
        startAIActions(roomID, socket);
        waitingPlayer = null;
      }
    }, 5000);

  } else {
    clearTimeout(waitingTimeout);
    const roomID = `${waitingPlayer.id}${socket.id}`;
    waitingPlayer.join(roomID);
    socket.join(roomID);
    waitingPlayer.emit('startGame', { room: roomID });
    socket.emit('startGame', { room: roomID });
    waitingPlayer = null;
  }

  socket.on('clickCircle', ({ room, x }) => {
    socket.to(room).emit('opponentClicked', { x });
  });

  socket.on('scoreUpdate', ({ room, score }) => {
    socket.to(room).emit('opponentScore', score);
  });

  socket.on('chat', ({ room, message }) => {
    socket.to(room).emit('chat', { message });
  });

  socket.on('rematch', ({ room }) => {
    io.in(room).emit('rematch');
  });

  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id);
    if (waitingPlayer && waitingPlayer.id === socket.id) {
      clearTimeout(waitingTimeout);
      waitingPlayer = null;
    }
    io.emit('opponentDisconnected');
  });
});

function startAIActions(room, playerSocket) {
  let aiScore = 0;
  const aiInterval = setInterval(() => {
    if (!playerSocket.connected) {
      clearInterval(aiInterval);
      return;
    }
    const x = Math.random() * 700;
    playerSocket.emit('opponentClicked', { x });
    aiScore++;
    playerSocket.emit('opponentScore', aiScore);
    if (aiScore >= 100) clearInterval(aiInterval);
  }, 1800);
}

server.listen(PORT, () => {
  console.log(`Server with opponent search running at http://localhost:${PORT}`);
});
