const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // safe for demo; restrict in prod
    methods: ["GET", "POST"]
  }
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Simple room management
let rooms = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join_room", (roomName) => {
    if (!rooms[roomName]) rooms[roomName] = [];

    if (rooms[roomName].length < 2) {
      socket.join(roomName);
      rooms[roomName].push(socket.id);
      socket.emit("room_joined", { roomName, clientId: socket.id });

      if (rooms[roomName].length === 2) {
        io.to(rooms[roomName][0]).emit("start_peer_connection", { isInitiator: true });
        io.to(rooms[roomName][1]).emit("start_peer_connection", { isInitiator: false });
        console.log(`Room ${roomName} full → peer connection started`);
      }
    } else {
      socket.emit("room_full", roomName);
      console.log(`Room ${roomName} is full. User ${socket.id} rejected`);
    }
  });

  socket.on("signal", (data) => {
    const other = rooms[data.roomName]?.find((id) => id !== socket.id);
    if (other) io.to(other).emit("signal", data);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    for (const roomName in rooms) {
      const idx = rooms[roomName].indexOf(socket.id);
      if (idx !== -1) {
        rooms[roomName].splice(idx, 1);
        if (rooms[roomName].length > 0) {
          io.to(rooms[roomName][0]).emit("peer_disconnected");
        } else {
          delete rooms[roomName];
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));
