export const fileSharingSocket = (io, socket) => {
  socket.on("upload", ({ fileName, chunk, totalChunks, roomName }) => {
    let data = {
      fileName,
      chunk,
      totalChunks,
    };
    const clients = io.sockets.adapter.rooms.get(roomName);
    const receiverId = [...clients].filter((id) => id !== socket.id)[0];
    io.to(receiverId).emit("download", data);
    // io.to(socket.id).emit("packet-received", data);
  });

  // for handling room joining
  socket.on("join-room", (roomName) => {
    socket.join(roomName);
    const room = io.sockets.adapter.rooms.get(roomName);
    if (room.size > 1 && room.size <= 2) {
      const senderId = [...room].filter((id) => id !== socket.id)[0];
      io.to(senderId).emit("transfer-data", { roomName });
      console.log("transfer-data emitted.....");
    }
    console.log(room);
    console.log(`Socket ${socket.id} joined room ${roomName}`);
  });

  // for handling room joining
  socket.on("progress-done", (payload) => {
    const { roomName, progress } = payload;
    if (!roomName || !progress) return;
    // console.log(roomName, progress, "----------");
    try {
      console.log(io.sockets.adapter.rooms)
      const clients = io.sockets.adapter.rooms.get(roomName);
      console.log(clients);
      // if (clients.size > 1 && clients.size <= 2) {
      const senderId = [...clients].filter((id) => id !== socket.id)[0];
      io.to(senderId).emit("download-progress", progress);
      console.log("tracking progress.....");
      // }
    } catch (err) {
      console.log(err, "socket error====");
    }
  });
};
