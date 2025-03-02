import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { Server } from 'socket.io';
import http from 'http';

export const app = express();
export const _dirname = path.resolve();

//Change values after frontend URL ; 
app.use(cors({
    origin: ["http://localhost:5173"],
    credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join("/public")));

// SOCKET.io
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ['http://localhost:5173'],
        credentials: true,
    },
});

const userSocket = {};


export const getSocketId = (username) => {
    return userSocket[username];
};

io.on('connection', (socket) => {
    const username = socket.handshake.query.username;
    if (username) {
        userSocket[username] = socket.id;
    }
    io.emit('onlineUsers', Object.keys(userSocket));
    socket.on('disconnect', () => {
        delete userSocket[username];
        io.emit('onlineUsers', Object.keys(userSocket));
    });
});

export { io, server };


//Routes
import { userRouter } from "./routes/user.routes.js";
import { messageRouter } from "./routes/messages.routes.js";
import { notiRouter } from "./routes/notifications.routes.js";
app.use("/api/v1/user", userRouter);
app.use("/api/v1/message", messageRouter);
app.use("/api/v1/notifications", notiRouter);