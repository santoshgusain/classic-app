import { Server } from "socket.io";

import { chatAppSocket } from "@/utils/socket/chat-app";
import { fileSharingSocket } from "@/utils/socket/file-sharing";

export default function ChatSocket(req, res) {
  console.log(process.env.ENV,'___________environment varibale loaded...');
  if (res.socket.server.io) {
    console.log("Socket is already running");
  } else {
    console.log("Socket is initializing");
    const socketConfig = {
      maxHttpBufferSize: 3e8, // Set maximum packet size to 100MB
      pingTimeout: 6000000, // 6000 seconds
      pingInterval: 2500000, // 2500 seconds
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    };
    const io = new Server(res.socket.server, socketConfig);
    res.socket.server.io = io;

    // Run when client connnects
    io.on("connection", (socket) => {
      chatAppSocket(io, socket);
      fileSharingSocket(io, socket);
    });
  }
  res.end();
}
