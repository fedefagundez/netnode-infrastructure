import { Server } from 'socket.io';
import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { RoomManager } from '../domain/RoomManager.js';
import { RoomEventHandler } from './RoomEventHandler.js';
import { MessageEventHandler } from './MessageEventHandler.js';
import { DnsEventHandler } from './DnsEventHandler.js';
import { ChatEventHandler } from './ChatEventHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class SocketServer {
  constructor(port = 3000) {
    this.port = port;
    this.roomManager = new RoomManager();

    this.app = express();
    this.app.set('trust proxy', 1);
    this.httpServer = createServer(this.app);
    this.io = new Server(this.httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
    });

    this.roomHandler = new RoomEventHandler(this.roomManager, this.io);
    this.messageHandler = new MessageEventHandler(this.roomManager, this.io);
    this.dnsHandler = new DnsEventHandler(this.roomManager, this.io);
    this.chatHandler = new ChatEventHandler(this.roomManager, this.io);

    this.setupStaticFiles();
    this.setupSocketEvents();
  }

  setupStaticFiles() {
    const clientPath = join(__dirname, '..', '..');
    this.app.get('/health', (req, res) => res.sendStatus(200));
    this.app.use(express.static(clientPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      }
    }));
  }

  setupSocketEvents() {
    this.io.on('connection', (socket) => {
      console.log(`[Server] Cliente conectado: ${socket.id}`);

      socket.on('create-room', (data) => this.roomHandler.handleCreateRoom(socket, data));
      socket.on('join-room', (data) => this.roomHandler.handleJoinRoom(socket, data));
      socket.on('toggle-node', () => this.roomHandler.handleToggleNode(socket));
      socket.on('disconnect', () => this.roomHandler.handleDisconnect(socket));

      socket.on('dns-query', (data) => this.dnsHandler.handleDnsQuery(socket, data));
      socket.on('send-message', (data) => this.messageHandler.handleSendMessage(socket, data));

      socket.on('set-firewall-rules', (data) => this.chatHandler.handleSetFirewallRules(socket, data));
      socket.on('get-firewall-rules', (data) => this.chatHandler.handleGetFirewallRules(socket, data));
      socket.on('get-chat-log', (data) => this.chatHandler.handleGetChatLog(socket, data));
      socket.on('get-chat-pairs', () => this.chatHandler.handleGetChatPairs(socket));
    });
  }

  start() {
    this.httpServer.listen(this.port, () => {
      console.log(`[Server] NetNode Infrastructure server corriendo en http://localhost:${this.port}`);
    });
  }
}

export { SocketServer };
