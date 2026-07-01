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
        if (!room) {
          console.log('[Server] dns-query pero no hay room');
          return;
        }

        const sender = room.getNodeBySocket(socket.id);
        const { name } = data;
        const result = room.dnsResolve(name);

        const dnsNodeId = room.getDnsNodeId();
        const dnsPath = room.bfs(sender.id, dnsNodeId);
        const returnPath = [...dnsPath].reverse();
        const fullPath = [...dnsPath, ...returnPath.slice(1)];

        let nodeLogs = [];
        try { nodeLogs = this._generateDnsLogs(room, fullPath, sender.name, name); } catch (e) { console.error('[Server] dnsLogs error:', e); }

        console.log('[Server] Enviando dns-query broadcast, from:', sender.id, 'fullPath:', fullPath);
        this.io.to(room.code).emit('dns-query', {
          from: sender.id,
          path: fullPath,
          query: name,
          nodeLogs,
        });

        console.log('[Server] Enviando dns-response al socket:', socket.id);
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
            firewallId: firewallCheck.firewallId,
          });
          this.io.to(room.code).emit('firewall-decision', {
            firewallId: firewallCheck.firewallId,
            decision: 'reject',
            fromId: sender.id,
            fromName: sender.name,
            toId: receiver.id,
            toName: receiver.name,
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

        const specialNodes = path
          .map(id => room.getNode(id))
          .filter(n => n && n.type && n.type !== 'client')
          .map(n => ({ id: n.id, type: n.type, name: n.name }));

        let nodeLogs = [];
        try { nodeLogs = this._generateNodeLogs(room, path, sender.name, receiver.name); } catch (e) { console.error('[Server] nodeLogs error:', e); }
        console.log('[Server] nodeLogs generados:', nodeLogs.length);

        const packetData = {
          from: sender.id,
          to: receiver.id,
          path: path,
          text: data.text,
          specialNodes,
          nodeLogs,
        };

        this.io.to(room.code).emit('packet', packetData);
        this.io.to(room.teacherSocketId).emit('packet', packetData);

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

  _generateNodeLogs(room, path, fromName, toName) {
    const logs = [];
    const base = Date.now();
    let offset = 0;

    const dns = path.find(id => room.getNode(id)?.type === 'dns');
    const dnsNode = dns ? room.getNode(dns) : null;

    for (let i = 0; i < path.length - 1; i++) {
      const currId = path[i];
      const nextId = path[i + 1];
      const curr = room.getNode(currId);
      const next = room.getNode(nextId);
      if (!curr || !next) continue;

      if (next.type === 'client') continue;

      if (curr.type === 'firewall') {
        logs.push({ nodeId: currId, text: `${curr.name}: Permitida ${fromName} → ${toName}`, type: 'firewall', timestamp: base + offset });
        offset += 100;
      } else if (next.type === 'firewall') {
        logs.push({ nodeId: currId, text: `${curr.name} → ${next.name}: ${fromName} → ${toName}`, type: curr.type, timestamp: base + offset });
        offset += 100;
      } else if (curr.type === 'dns') {
        logs.push({ nodeId: currId, text: `DNS: "${toName}" = ${next.name}`, type: 'dns', timestamp: base + offset });
        offset += 100;
      } else if (next.type === 'dns') {
        logs.push({ nodeId: currId, text: `${curr.name} → ${next.name}: consulta "${toName}"`, type: curr.type, timestamp: base + offset });
        offset += 100;
      } else if (curr.type !== 'client') {
        const isResponse = dnsNode && (i > path.indexOf(dns));
        if (isResponse) {
          logs.push({ nodeId: currId, text: `${curr.name} → ${next.name}: respuesta "${toName}"`, type: curr.type, timestamp: base + offset });
        } else {
          logs.push({ nodeId: currId, text: `${curr.name} → ${next.name}: ${fromName} → ${toName}`, type: curr.type, timestamp: base + offset });
        }
        offset += 100;
      }
    }

    return logs;
  }

  _generateDnsLogs(room, path, fromName, query) {
    const logs = [];
    const base = Date.now();
    let offset = 0;

    const dns = path.find(id => room.getNode(id)?.type === 'dns');
    const dnsNode = dns ? room.getNode(dns) : null;
    const senderNode = room.getNode(path[0]);

    for (let i = 0; i < path.length - 1; i++) {
      const currId = path[i];
      const nextId = path[i + 1];
      const curr = room.getNode(currId);
      const next = room.getNode(nextId);
      if (!curr || !next) continue;

      if (next.type === 'client') continue;

      if (curr.type === 'dns') {
        logs.push({ nodeId: currId, text: `DNS: "${query}" = ${next.name}`, type: 'dns', timestamp: base + offset });
        offset += 100;
      } else if (next.type === 'dns') {
        logs.push({ nodeId: currId, text: `${curr.name} → ${next.name}: consulta "${query}"`, type: curr.type, timestamp: base + offset });
        offset += 100;
      } else if (curr.type === 'firewall') {
        logs.push({ nodeId: currId, text: `${curr.name}: Permitida ${senderNode?.name || '?'} → ${next.name}`, type: 'firewall', timestamp: base + offset });
        offset += 100;
      } else if (next.type === 'firewall') {
        logs.push({ nodeId: currId, text: `${curr.name} → ${next.name}: consulta "${query}"`, type: curr.type, timestamp: base + offset });
        offset += 100;
      } else {
        const isResponse = dnsNode && (i > path.indexOf(dns));
        if (isResponse) {
          logs.push({ nodeId: currId, text: `${curr.name} → ${next.name}: respuesta "${query}"`, type: curr.type, timestamp: base + offset });
        } else {
          logs.push({ nodeId: currId, text: `${curr.name} → ${next.name}: consulta "${query}"`, type: curr.type, timestamp: base + offset });
        }
        offset += 100;
      }
    }

    return logs;
  }

  start() {
    this.httpServer.listen(this.port, () => {
      console.log(`[Server] NetNode Infrastructure server corriendo en http://localhost:${this.port}`);
    });
  }
}

export { SocketServer };
