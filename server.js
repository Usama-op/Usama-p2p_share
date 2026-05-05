import http from "http";
import * as fs from 'node:fs';
import * as path from 'path';
import WebSocket from "websocket";

const MAIN_SERVER_PORT = 6888;
const WEBSOCKET_SERVER_PORT = 8895;

let connections = {};
let senders = [];
let recievers = [];

const server = http.createServer((req, res) => {
    const filePath = path.join(path.resolve(), req.url === "/" ? "index.html" : req.url);
    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        if (req.url.endsWith(".js")) res.setHeader("Content-Type", "application/javascript");
        if (req.url.endsWith(".css")) res.setHeader("Content-Type", "text/css");
        res.end(data);
    });
});

const wsServer = new WebSocket.server({
    httpServer: http.createServer().listen(WEBSOCKET_SERVER_PORT)
});

wsServer.on("request", (req) => {
    const connection = req.accept(null, req.origin);
    const userId = String(Math.floor(1000 + Math.random() * 9000));
    connections[userId] = connection;
    connection.on("message", (msg) => {
        const data = JSON.parse(msg.utf8Data);
        if (data.type === "sender" && !senders.includes(userId)) senders.push(userId);
        if (data.type === "reciever" && !recievers.includes(userId)) recievers.push(userId);
        if (data.target && connections[data.target]) connections[data.target].send(JSON.stringify(data));
        senders.forEach(id => {
            if (connections[id]) connections[id].send(JSON.stringify({ type: "all-recievers", userIds: recievers }));
        });
    });
    connection.on("close", () => {
        delete connections[userId];
        senders = senders.filter(i => i !== userId);
        recievers = recievers.filter(i => i !== userId);
    });
    connection.send(JSON.stringify({ type: "user-id", userId }));
});

server.listen(MAIN_SERVER_PORT, () => console.log(`Usama's Server at http://localhost:${MAIN_SERVER_PORT}`));