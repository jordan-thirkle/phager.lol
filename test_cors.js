import { io } from "socket.io-client";

const socket = io("http://localhost:3001");

socket.on("connect", () => {
  console.log("Connected successfully!");
  process.exit(0);
});

socket.on("connect_error", (err) => {
  console.error("Connection error:", err.message);
  process.exit(1);
});

setTimeout(() => {
  console.error("Connection timed out");
  process.exit(1);
}, 2000);
