import { Server } from 'socket.io';
import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { RoomManager } from '../domain/RoomManager.js';

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

      socket.on('create-room', (data) => {
        const { groupName, teacherName } = data;
        if (!groupName || !groupName.trim()) {
          socket.emit('error', { message: 'Nombre de grupo invalido' });
          return;
        }

        const room = this.roomManager.createRoom(groupName.trim(), socket.id);
        room.teacherName = teacherName || 'Profesor';
        room.topology = 'school-network';

        room.createSubnets();

        socket.join(room.code);

        socket.emit('room-created', {
          code: room.code,
          groupName: room.groupName,
          teacherName: room.teacherName,
          topology: room.topology,
        });

        console.log(`[Server] Profesor creo sala: ${room.code} (${room.groupName})`);
      });

      socket.on('join-room', (data) => {
        const { code, name } = data;
        if (!code || !name) {
          socket.emit('error', { message: 'Codigo y nombre son requeridos' });
          return;
        }

        const room = this.roomManager.getRoom(code);
        if (!room) {
          socket.emit('error', { message: 'Sala no encontrada' });
          return;
        }

        const node = room.addNode(name.trim(), socket.id);
        socket.join(code);

        socket.emit('room-joined', {
          nodeId: node.id,
          label: node.label,
          subnetId: node.subnetId,
          state: room.getState(),
        });

        this.io.to(code).emit('state-update', room.getState());

        this.io.to(room.teacherSocketId).emit('student-joined', {
          nodeId: node.id,
          label: node.label,
          name: node.name,
          subnetId: node.subnetId,
          totalNodes: room.nodeCount(),
        });

        console.log(`[Server] Nodo registrado en sala ${code}: ${node.label} (${name}) - Subnet: ${node.subnetId}`);
      });

      socket.on('dns-query', (data) => {
        const room = this.roomManager.getRoomByStudentSocket(socket.id);
        if (!room) return;

        const { name } = data;
        const result = room.dnsResolve(name);

        socket.emit('dns-response', {
          query: name,
          found: result.found,
          nodeId: result.nodeId || null,
          label: result.label || null,
          nodeName: result.name || null,
        });

        console.log(`[Server] DNS query en sala ${room.code}: "${name}" -> ${result.found ? result.nodeId : 'NOT FOUND'}`);
      });

      socket.on('send-message', (data) => {
        const room = this.roomManager.getRoomByStudentSocket(socket.id);
        if (!room) return;

        const sender = room.getNodeBySocket(socket.id);
        if (!sender) return;

        const receiver = room.getNode(data.toNodeId);
        if (!receiver) {
          socket.emit('message-error', { reason: 'receptor-no-existe' });
          return;
        }

        if (!receiver.on) {
          socket.emit('message-error', { reason: 'receptor-apagado', receiverName: receiver.name });
          return;
        }

        const firewallCheck = room.checkFirewall(sender.id, receiver.id);
        if (!firewallCheck.allowed) {
          socket.emit('message-error', {
            reason: firewallCheck.reason,
            receiverName: receiver.name,
            firewallName: firewallCheck.firewallName,
          });
          console.log(`[Server] Firewall bloqueo mensaje en sala ${room.code}: ${sender.name} -> ${receiver.name} (${firewallCheck.firewallName})`);
          return;
        }

        const path = room.bfs(sender.id, receiver.id);
        if (!path) {
          socket.emit('message-error', { reason: 'sin-ruta', receiverName: receiver.name });
          return;
        }

        room.logMessage(sender.id, receiver.id, data.text);

        this.io.to(room.code).emit('packet', {
          from: sender.id,
          to: receiver.id,
          path: path,
          text: data.text,
        });

        this.io.to(room.teacherSocketId).emit('packet', {
          from: sender.id,
          to: receiver.id,
          path: path,
          text: data.text,
        });

        this.io.to(receiver.socketId).emit('receive-message', {
          from: sender.id,
          fromLabel: sender.label,
          fromName: sender.name,
          toNodeId: receiver.id,
          text: data.text,
          timestamp: Date.now(),
        });

        this.io.to(room.teacherSocketId).emit('room-message', {
          from: sender.name,
          fromLabel: sender.label,
          to: receiver.name,
          toLabel: receiver.label,
          text: data.text,
          timestamp: Date.now(),
        });
      });

      socket.on('toggle-node', (data) => {
        const room = this.roomManager.getRoomByStudentSocket(socket.id);
        if (!room) return;

        const node = room.getNodeBySocket(socket.id);
        if (node) {
          room.toggleNode(node.id);
          this.io.to(room.code).emit('state-update', room.getState());
          console.log(`[Server] Nodo toggled en sala ${room.code}: ${node.label} -> on: ${room.getNode(node.id).on}`);
        }
      });

      socket.on('set-firewall-rules', (data) => {
        const room = this.roomManager.getRoomByTeacherSocket(socket.id);
        if (!room) return;

        const { firewallId, rules } = data;
        room.setFirewallRules(firewallId, rules);
        this.io.to(room.code).emit('state-update', room.getState());
        console.log(`[Server] Firewall rules actualizadas en sala ${room.code}: Firewall ${firewallId}`);
      });

      socket.on('get-firewall-rules', (data) => {
        const room = this.roomManager.getRoomByTeacherSocket(socket.id);
        if (!room) return;

        const { firewallId } = data;
        const rules = room.getFirewallRules(firewallId);
        socket.emit('firewall-rules', { firewallId, rules });
      });

      socket.on('get-chat-log', (data) => {
        const room = this.roomManager.getRoomByTeacherSocket(socket.id);
        if (!room) return;

        const { nodeA, nodeB } = data;
        const log = room.getChatLog(nodeA, nodeB);
        socket.emit('chat-log', { nodeA, nodeB, messages: log });
      });

      socket.on('get-chat-pairs', () => {
        const room = this.roomManager.getRoomByTeacherSocket(socket.id);
        if (!room) return;

        const pairs = room.getChatPairs();
        socket.emit('chat-pairs', pairs);
      });

      socket.on('disconnect', () => {
        const teacherRoom = this.roomManager.getRoomByTeacherSocket(socket.id);
        if (teacherRoom) {
          this.io.to(teacherRoom.code).emit('room-closed', {
            reason: 'El profesor cerro la sala',
          });

          for (const node of teacherRoom.nodes.values()) {
            if (node.socketId) {
              this.io.to(node.socketId).emit('room-closed', {
                reason: 'El profesor cerro la sala',
              });
            }
          }

          this.roomManager.removeRoom(teacherRoom.code);
          console.log(`[Server] Sala cerrada por profesor: ${teacherRoom.code}`);
          return;
        }

        const result = this.roomManager.removeStudentFromAllRooms(socket.id);
        if (result) {
          const { room, node } = result;
          this.io.to(room.code).emit('state-update', room.getState());
          this.io.to(room.teacherSocketId).emit('student-left', {
            nodeId: node.id,
            label: node.label,
            name: node.name,
            totalNodes: room.nodeCount(),
          });
          console.log(`[Server] Nodo desconectado de sala ${room.code}: ${node.label} (${node.name})`);
        }
      });
    });
  }

  start() {
    this.httpServer.listen(this.port, () => {
      console.log(`[Server] NetNode Infrastructure server corriendo en http://localhost:${this.port}`);
    });
  }
}

export { SocketServer };
