import { SocketServer } from './infrastructure/SocketServer.js';

const PORT = process.env.PORT || 3001;
const server = new SocketServer(PORT);
server.start();
